from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, status
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from collections import defaultdict

from passlib.context import CryptContext
from jose import jwt, JWTError

from emergentintegrations.llm.chat import LlmChat, UserMessage


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = os.environ.get('JWT_ALGO', 'HS256')
JWT_EXPIRES_DAYS = int(os.environ.get('JWT_EXPIRES_DAYS', '30'))

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI()
api_router = APIRouter(prefix="/api")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- Auth helpers ----------
def create_token(user_id: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRES_DAYS)
    return jwt.encode({"sub": user_id, "exp": exp}, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        uid = payload.get("sub")
        if not uid:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def maybe_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        return None
    try:
        return await get_current_user(authorization)
    except HTTPException:
        return None


# Brute-force tracker (in-memory)
_attempts = defaultdict(list)
_MAX_ATTEMPTS = 5
_WINDOW = timedelta(minutes=15)


def check_locked(key: str) -> bool:
    now = datetime.now(timezone.utc)
    _attempts[key] = [t for t in _attempts[key] if now - t < _WINDOW]
    return len(_attempts[key]) >= _MAX_ATTEMPTS


def record_failure(key: str):
    _attempts[key].append(datetime.now(timezone.utc))


def clear_attempts(key: str):
    _attempts.pop(key, None)


# ---------- Models ----------
class SignupReq(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=24, pattern=r"^[A-Za-z0-9_]+$")
    password: str = Field(..., min_length=6, max_length=128)


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    username: str
    created_at: str


class AuthResponse(BaseModel):
    token: str
    user: UserPublic


class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str


class ChatResponse(BaseModel):
    session_id: str
    reply: str


class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    user_id: str
    role: str
    text: str
    created_at: str = Field(default_factory=now_iso)


class ForumPostCreate(BaseModel):
    title: str
    body: str
    media_url: Optional[str] = None
    media_type: Optional[str] = None  # "image" | "video"


class ForumPost(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    author: str
    title: str
    body: str
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    likes: int = 0
    comments_count: int = 0
    created_at: str = Field(default_factory=now_iso)


class CommentCreateReq(BaseModel):
    text: str


class Comment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    post_id: str
    user_id: str
    author: str
    text: str
    created_at: str = Field(default_factory=now_iso)


class LoadoutCreate(BaseModel):
    name: str
    enchantments: List[str] = []
    armor: List[str] = []
    notes: Optional[str] = ""


class Loadout(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    enchantments: List[str] = []
    armor: List[str] = []
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class StatLogCreate(BaseModel):
    kind: str


class StatsSummary(BaseModel):
    kills: int
    deaths: int
    kdr: float
    streak: int


class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    kind: str
    post_id: str
    post_title: str
    actor: str
    preview: str
    read: bool = False
    created_at: str = Field(default_factory=now_iso)


class LeaderRow(BaseModel):
    user_id: str
    username: str
    kills: int
    deaths: int
    kdr: float


# ---------- Startup: indexes ----------
@app.on_event("startup")
async def ensure_indexes():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("username_lower", unique=True)
    await db.users.create_index("id", unique=True)
    await db.forum_posts.create_index("created_at")
    await db.stat_events.create_index([("user_id", 1), ("created_at", -1)])


# ---------- Auth Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Mace PvP API online"}


@api_router.post("/auth/signup", response_model=AuthResponse)
async def signup(req: SignupReq):
    email = req.email.lower()
    uname_lower = req.username.lower()

    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    if await db.users.find_one({"username_lower": uname_lower}):
        raise HTTPException(status_code=400, detail="Username already taken")

    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "email": email,
        "username": req.username,
        "username_lower": uname_lower,
        "password_hash": pwd_ctx.hash(req.password),
        "created_at": now_iso(),
    }
    try:
        await db.users.insert_one(doc)
    except Exception:
        raise HTTPException(status_code=400, detail="Email or username already in use")

    token = create_token(uid)
    return AuthResponse(
        token=token,
        user=UserPublic(id=uid, email=email, username=req.username, created_at=doc["created_at"]),
    )


@api_router.post("/auth/login", response_model=AuthResponse)
async def login(req: LoginReq):
    email = req.email.lower()
    key = f"login:{email}"
    if check_locked(key):
        raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")

    user = await db.users.find_one({"email": email})
    if not user or not pwd_ctx.verify(req.password, user["password_hash"]):
        record_failure(key)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    clear_attempts(key)
    token = create_token(user["id"])
    return AuthResponse(
        token=token,
        user=UserPublic(id=user["id"], email=user["email"], username=user["username"], created_at=user["created_at"]),
    )


@api_router.get("/auth/me", response_model=UserPublic)
async def me(user=Depends(get_current_user)):
    return UserPublic(id=user["id"], email=user["email"], username=user["username"], created_at=user["created_at"])


# ---------- Chat ----------
SYSTEM_PROMPT = (
    "You are MaceCoach, an expert Minecraft 1.21+ Mace PvP coach. "
    "Give concise, practical, tactical advice about the Mace weapon: smash attack mechanics, "
    "Density, Breach, and Wind Burst enchantments, fall-damage stacking, totem of undying combos, "
    "Java vs Bedrock differences, crystal/anchor pairings, and counters. "
    "Keep replies short, punchy, structured with bullets when useful. Stay on-topic."
)


@api_router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest, user=Depends(get_current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Empty message")

    session_id = req.session_id or f"s_{user['id']}"
    await db.chat_messages.insert_one(
        ChatMessage(session_id=session_id, user_id=user["id"], role="user", text=req.message).model_dump()
    )

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=SYSTEM_PROMPT,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        reply_text = str(await chat.send_message(UserMessage(text=req.message)) or "")
    except Exception as e:
        logging.exception("LLM error")
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")

    await db.chat_messages.insert_one(
        ChatMessage(session_id=session_id, user_id=user["id"], role="assistant", text=reply_text).model_dump()
    )
    return ChatResponse(session_id=session_id, reply=reply_text)


@api_router.get("/chat/{session_id}", response_model=List[ChatMessage])
async def chat_history(session_id: str, user=Depends(get_current_user)):
    docs = await db.chat_messages.find(
        {"session_id": session_id, "user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    return [ChatMessage(**d) for d in docs]


# ---------- Forum ----------
@api_router.get("/forum/posts", response_model=List[ForumPost])
async def list_posts():
    docs = await db.forum_posts.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [ForumPost(**d) for d in docs]


@api_router.post("/forum/posts", response_model=ForumPost)
async def create_post(payload: ForumPostCreate, user=Depends(get_current_user)):
    post = ForumPost(
        user_id=user["id"], author=user["username"],
        title=payload.title, body=payload.body,
        media_url=payload.media_url, media_type=payload.media_type,
    )
    await db.forum_posts.insert_one(post.model_dump())
    return post


@api_router.post("/forum/posts/{post_id}/like", response_model=ForumPost)
async def like_post(post_id: str, user=Depends(get_current_user)):
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
async def add_comment(post_id: str, payload: CommentCreateReq, user=Depends(get_current_user)):
    post = await db.forum_posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    comment = Comment(post_id=post_id, user_id=user["id"], author=user["username"], text=payload.text)
    await db.forum_comments.insert_one(comment.model_dump())
    await db.forum_posts.update_one({"id": post_id}, {"$inc": {"comments_count": 1}})
    target = post.get("user_id")
    if target and target != user["id"]:
        notif = Notification(
            user_id=target, kind="comment", post_id=post_id,
            post_title=post.get("title", "")[:60], actor=user["username"],
            preview=payload.text[:80],
        )
        await db.notifications.insert_one(notif.model_dump())
    return comment


# ---------- Loadouts ----------
@api_router.get("/loadouts", response_model=List[Loadout])
async def list_loadouts(user=Depends(get_current_user)):
    docs = await db.loadouts.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return [Loadout(**d) for d in docs]


@api_router.post("/loadouts", response_model=Loadout)
async def create_loadout(payload: LoadoutCreate, user=Depends(get_current_user)):
    lo = Loadout(user_id=user["id"], **payload.model_dump())
    await db.loadouts.insert_one(lo.model_dump())
    return lo


@api_router.delete("/loadouts/{loadout_id}")
async def delete_loadout(loadout_id: str, user=Depends(get_current_user)):
    res = await db.loadouts.delete_one({"id": loadout_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Loadout not found")
    return {"ok": True}


# ---------- Stats ----------
@api_router.post("/stats/log", response_model=StatsSummary)
async def log_stat(payload: StatLogCreate, user=Depends(get_current_user)):
    if payload.kind not in ("kill", "death"):
        raise HTTPException(status_code=400, detail="kind must be kill or death")
    await db.stat_events.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "kind": payload.kind,
        "created_at": now_iso(),
    })
    return await _summary(user["id"])


@api_router.get("/stats", response_model=StatsSummary)
async def get_stats(user=Depends(get_current_user)):
    return await _summary(user["id"])


@api_router.post("/stats/reset")
async def reset_stats(user=Depends(get_current_user)):
    await db.stat_events.delete_many({"user_id": user["id"]})
    return {"ok": True}


async def _summary(uid: str) -> StatsSummary:
    events = await db.stat_events.find(
        {"user_id": uid}, {"_id": 0}
    ).sort("created_at", 1).to_list(5000)
    kills = sum(1 for e in events if e["kind"] == "kill")
    deaths = sum(1 for e in events if e["kind"] == "death")
    kdr = round(kills / deaths, 2) if deaths > 0 else float(kills)
    streak = 0
    for e in reversed(events):
        if e["kind"] == "kill":
            streak += 1
        else:
            break
    return StatsSummary(kills=kills, deaths=deaths, kdr=kdr, streak=streak)


# ---------- Notifications ----------
@api_router.get("/notifications", response_model=List[Notification])
async def list_notifications(user=Depends(get_current_user)):
    docs = await db.notifications.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return [Notification(**d) for d in docs]


@api_router.post("/notifications/read")
async def mark_notifications_read(user=Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": user["id"], "read": False},
        {"$set": {"read": True}},
    )
    return {"ok": True}


@api_router.get("/notifications/unread-count")
async def unread_count(user=Depends(get_current_user)):
    n = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return {"count": n}


# ---------- Leaderboard ----------
@api_router.get("/leaderboard/weekly", response_model=List[LeaderRow])
async def weekly_leaderboard():
    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    pipeline = [
        {"$match": {"created_at": {"$gte": cutoff}}},
        {"$group": {
            "_id": "$user_id",
            "kills": {"$sum": {"$cond": [{"$eq": ["$kind", "kill"]}, 1, 0]}},
            "deaths": {"$sum": {"$cond": [{"$eq": ["$kind", "death"]}, 1, 0]}},
        }},
    ]
    rows: List[LeaderRow] = []
    async for r in db.stat_events.aggregate(pipeline):
        u = await db.users.find_one({"id": r["_id"]}, {"_id": 0})
        name = u["username"] if u else "Unknown"
        kdr = round(r["kills"] / r["deaths"], 2) if r["deaths"] > 0 else float(r["kills"])
        rows.append(LeaderRow(user_id=r["_id"], username=name,
                              kills=r["kills"], deaths=r["deaths"], kdr=kdr))
    rows.sort(key=lambda x: (x.kdr, x.kills), reverse=True)
    return rows[:50]


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
