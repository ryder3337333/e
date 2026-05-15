from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone

from emergentintegrations.llm.chat import LlmChat, UserMessage


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- Models ----------
class ChatRequest(BaseModel):
    session_id: str
    message: str


class ChatResponse(BaseModel):
    session_id: str
    reply: str


class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    role: str  # "user" | "assistant"
    text: str
    created_at: str = Field(default_factory=now_iso)


class ForumPostCreate(BaseModel):
    author: str
    title: str
    body: str


class ForumPost(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    author: str
    title: str
    body: str
    likes: int = 0
    comments_count: int = 0
    created_at: str = Field(default_factory=now_iso)


class CommentCreate(BaseModel):
    author: str
    text: str


class Comment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    post_id: str
    author: str
    text: str
    created_at: str = Field(default_factory=now_iso)


class LoadoutCreate(BaseModel):
    device_id: str
    name: str
    enchantments: List[str] = []
    armor: List[str] = []
    notes: Optional[str] = ""


class Loadout(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    device_id: str
    name: str
    enchantments: List[str] = []
    armor: List[str] = []
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class StatLogCreate(BaseModel):
    device_id: str
    kind: str  # "kill" | "death"


class StatsSummary(BaseModel):
    device_id: str
    kills: int
    deaths: int
    kdr: float
    streak: int


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Mace PvP API online"}


# Chat
SYSTEM_PROMPT = (
    "You are MaceCoach, an expert Minecraft 1.21+ Mace PvP coach. "
    "Give concise, practical, tactical advice about the Mace weapon: smash attack mechanics, "
    "Density, Breach, and Wind Burst enchantments, fall-damage stacking, totem of undying combos, "
    "Java vs Bedrock differences, crystal/anchor pairings, and counters. "
    "Keep replies short, punchy, structured with bullets when useful. Stay on-topic."
)


@api_router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Empty message")

    user_msg = ChatMessage(session_id=req.session_id, role="user", text=req.message)
    await db.chat_messages.insert_one(user_msg.model_dump())

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=req.session_id,
            system_message=SYSTEM_PROMPT,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        reply = await chat.send_message(UserMessage(text=req.message))
        reply_text = str(reply) if reply is not None else ""
    except Exception as e:
        logging.exception("LLM error")
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")

    asst_msg = ChatMessage(session_id=req.session_id, role="assistant", text=reply_text)
    await db.chat_messages.insert_one(asst_msg.model_dump())

    return ChatResponse(session_id=req.session_id, reply=reply_text)


@api_router.get("/chat/{session_id}", response_model=List[ChatMessage])
async def chat_history(session_id: str):
    docs = await db.chat_messages.find(
        {"session_id": session_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    return [ChatMessage(**d) for d in docs]


# Forum
@api_router.get("/forum/posts", response_model=List[ForumPost])
async def list_posts():
    docs = await db.forum_posts.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [ForumPost(**d) for d in docs]


@api_router.post("/forum/posts", response_model=ForumPost)
async def create_post(payload: ForumPostCreate):
    post = ForumPost(**payload.model_dump())
    await db.forum_posts.insert_one(post.model_dump())
    return post


@api_router.post("/forum/posts/{post_id}/like", response_model=ForumPost)
async def like_post(post_id: str):
    res = await db.forum_posts.find_one_and_update(
        {"id": post_id},
        {"$inc": {"likes": 1}},
        return_document=True,
        projection={"_id": 0},
    )
    if not res:
        raise HTTPException(status_code=404, detail="Post not found")
    return ForumPost(**res)


@api_router.get("/forum/posts/{post_id}/comments", response_model=List[Comment])
async def list_comments(post_id: str):
    docs = await db.forum_comments.find(
        {"post_id": post_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    return [Comment(**d) for d in docs]


@api_router.post("/forum/posts/{post_id}/comments", response_model=Comment)
async def add_comment(post_id: str, payload: CommentCreate):
    post = await db.forum_posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    comment = Comment(post_id=post_id, **payload.model_dump())
    await db.forum_comments.insert_one(comment.model_dump())
    await db.forum_posts.update_one({"id": post_id}, {"$inc": {"comments_count": 1}})
    return comment


# Loadouts
@api_router.get("/loadouts", response_model=List[Loadout])
async def list_loadouts(device_id: str):
    docs = await db.loadouts.find(
        {"device_id": device_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return [Loadout(**d) for d in docs]


@api_router.post("/loadouts", response_model=Loadout)
async def create_loadout(payload: LoadoutCreate):
    lo = Loadout(**payload.model_dump())
    await db.loadouts.insert_one(lo.model_dump())
    return lo


@api_router.delete("/loadouts/{loadout_id}")
async def delete_loadout(loadout_id: str):
    res = await db.loadouts.delete_one({"id": loadout_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Loadout not found")
    return {"ok": True}


# Stats
@api_router.post("/stats/log", response_model=StatsSummary)
async def log_stat(payload: StatLogCreate):
    if payload.kind not in ("kill", "death"):
        raise HTTPException(status_code=400, detail="kind must be kill or death")
    await db.stat_events.insert_one({
        "id": str(uuid.uuid4()),
        "device_id": payload.device_id,
        "kind": payload.kind,
        "created_at": now_iso(),
    })
    return await _summary(payload.device_id)


@api_router.get("/stats", response_model=StatsSummary)
async def get_stats(device_id: str):
    return await _summary(device_id)


@api_router.post("/stats/reset")
async def reset_stats(payload: StatLogCreate):
    await db.stat_events.delete_many({"device_id": payload.device_id})
    return {"ok": True}


async def _summary(device_id: str) -> StatsSummary:
    events = await db.stat_events.find(
        {"device_id": device_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(5000)
    kills = sum(1 for e in events if e["kind"] == "kill")
    deaths = sum(1 for e in events if e["kind"] == "death")
    kdr = round(kills / deaths, 2) if deaths > 0 else float(kills)
    # current streak = consecutive kills from end (until a death)
    streak = 0
    for e in reversed(events):
        if e["kind"] == "kill":
            streak += 1
        else:
            break
    return StatsSummary(device_id=device_id, kills=kills, deaths=deaths, kdr=kdr, streak=streak)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
