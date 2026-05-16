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
    hits: int = 0
    misses: int = 0
    accuracy: float = 0.0
    elo: int = 1000


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
    if payload.kind not in ("kill", "death", "hit", "miss"):
        raise HTTPException(status_code=400, detail="kind must be kill|death|hit|miss")
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
    ).sort("created_at", 1).to_list(20000)
    kills = sum(1 for e in events if e["kind"] == "kill")
    deaths = sum(1 for e in events if e["kind"] == "death")
    hits = sum(1 for e in events if e["kind"] == "hit")
    misses = sum(1 for e in events if e["kind"] == "miss")
    kdr = round(kills / deaths, 2) if deaths > 0 else float(kills)
    streak = 0
    for e in reversed(events):
        if e["kind"] in ("kill", "death"):
            if e["kind"] == "kill":
                streak += 1
            else:
                break
    accuracy = round(hits / (hits + misses), 3) if (hits + misses) > 0 else 0.0
    elo = compute_elo(kills, deaths, hits, misses)
    return StatsSummary(kills=kills, deaths=deaths, kdr=kdr, streak=streak,
                        hits=hits, misses=misses, accuracy=accuracy, elo=elo)


def compute_elo(kills: int, deaths: int, hits: int, misses: int) -> int:
    base = 1000
    kdr = kills / deaths if deaths > 0 else float(kills)
    acc = hits / (hits + misses) if (hits + misses) > 0 else 0.0
    return int(base + 30 * kdr + 2 * kills + 200 * acc)


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


# ---------- Tips Feed ----------
TIPS = [
    {"id": "t1", "category": "mechanic", "title": "Smash Damage Stacking", "body": "Density V adds +0.5 damage per fall block. From 20 blocks that's +50 raw damage BEFORE armor calc. Pair with Strength I (+3) and you one-shot full Netherite."},
    {"id": "t2", "category": "movement", "title": "Wind Burst Escape", "body": "Wind Burst III launches you 4-5 blocks up. Use it to escape pearls or to chain smash attacks mid-air without ender pearls."},
    {"id": "t3", "category": "counter", "title": "Anti-Crystal", "body": "Place crystals around YOUR feet, not theirs. Mace players need height — deny them takeoff space with crystal walls."},
    {"id": "t4", "category": "movement", "title": "Bedrock Sky Stalker", "body": "Bedrock players: keep a stack of cobwebs. Cobweb above a player + mace smash = guaranteed kill, they can't escape the slow-fall."},
    {"id": "t5", "category": "loadout", "title": "Totem Stack", "body": "Always run two Totems (offhand swap macro). Density mace + 2 totems gives you 3 second-chances per fight."},
    {"id": "t6", "category": "mechanic", "title": "Crit Threshold", "body": "12+ blocks of fall guarantees a critical hit. Sprint-jump from a 10-block tower = +50% damage minimum."},
    {"id": "t7", "category": "counter", "title": "Shield Mace Trade", "body": "Java only: shield ABSORBS the smash. Bait their slam, shield-up at the last frame, then counter-axe their shield to disable it."},
    {"id": "t8", "category": "movement", "title": "Pearl-Slam Combo", "body": "Pearl 30 blocks up, immediately mace-smash. The pearl height-bonus + mace damage = instant kill on any unarmored target."},
    {"id": "t9", "category": "loadout", "title": "Feather Falling Math", "body": "FF IV reduces fall damage 48%. Stack with Mace Smash Attack (negates ALL fall) — combine them for safe high-altitude slams."},
    {"id": "t10", "category": "mechanic", "title": "Breach + Density", "body": "Breach IV strips 60% of armor effectiveness. Combined with Density V, you can ignore Netherite — your raw damage punches through."},
    {"id": "t11", "category": "counter", "title": "Anchor Cancel", "body": "Place a respawn anchor below YOUR feet. If mace player slams you, the anchor blast launches them up — counter-smash incoming."},
    {"id": "t12", "category": "movement", "title": "Elytra Mace Dive", "body": "Elytra-launch high, then disengage chestplate slot for mace mid-air. Dive-bomb playstyle that's nearly unmatched."},
]


@api_router.get("/tips")
async def list_tips(category: Optional[str] = None):
    out = [t for t in TIPS if not category or t["category"] == category]
    return out


@api_router.get("/tips/daily")
async def daily_tip():
    # Deterministic daily rotation
    day_idx = (datetime.now(timezone.utc) - datetime(2025, 1, 1, tzinfo=timezone.utc)).days
    return TIPS[day_idx % len(TIPS)]


# ---------- Friends ----------
class FriendRow(BaseModel):
    user_id: str
    username: str
    elo: int
    kdr: float


@api_router.get("/users/search", response_model=List[FriendRow])
async def search_users(q: str, user=Depends(get_current_user)):
    if len(q.strip()) < 2:
        return []
    q_low = q.lower()
    docs = await db.users.find(
        {"username_lower": {"$regex": f"^{q_low}"}, "id": {"$ne": user["id"]}},
        {"_id": 0, "password_hash": 0}
    ).limit(20).to_list(20)
    out = []
    for u in docs:
        s = await _summary(u["id"])
        out.append(FriendRow(user_id=u["id"], username=u["username"], elo=s.elo, kdr=s.kdr))
    return out


@api_router.post("/friends/{friend_id}")
async def add_friend(friend_id: str, user=Depends(get_current_user)):
    if friend_id == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot friend yourself")
    target = await db.users.find_one({"id": friend_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    await db.friends.update_one(
        {"follower_id": user["id"], "followee_id": friend_id},
        {"$setOnInsert": {"follower_id": user["id"], "followee_id": friend_id, "created_at": now_iso()}},
        upsert=True,
    )
    return {"ok": True}


@api_router.delete("/friends/{friend_id}")
async def remove_friend(friend_id: str, user=Depends(get_current_user)):
    await db.friends.delete_one({"follower_id": user["id"], "followee_id": friend_id})
    return {"ok": True}


@api_router.get("/friends", response_model=List[FriendRow])
async def list_friends(user=Depends(get_current_user)):
    edges = await db.friends.find({"follower_id": user["id"]}, {"_id": 0}).to_list(500)
    out = []
    for e in edges:
        u = await db.users.find_one({"id": e["followee_id"]}, {"_id": 0, "password_hash": 0})
        if not u:
            continue
        s = await _summary(u["id"])
        out.append(FriendRow(user_id=u["id"], username=u["username"], elo=s.elo, kdr=s.kdr))
    out.sort(key=lambda r: r.elo, reverse=True)
    return out


# ---------- Server Finder ----------
SERVERS = [
    {"id": "s1", "name": "MaceMC", "ip": "play.macemc.net", "region": "NA", "players": 1284, "max": 2000, "modes": ["FFA", "Duels", "Ranked"], "version": "1.21.4"},
    {"id": "s2", "name": "Hypixel", "ip": "mc.hypixel.net", "region": "GLOBAL", "players": 42800, "max": 100000, "modes": ["Skywars", "Duels"], "version": "1.21.4"},
    {"id": "s3", "name": "PvPLand", "ip": "pvpland.net", "region": "EU", "players": 952, "max": 1500, "modes": ["Mace 1v1", "Sumo", "Ranked"], "version": "1.21.4"},
    {"id": "s4", "name": "MinemenClub", "ip": "minemen.club", "region": "EU/NA", "players": 1810, "max": 3000, "modes": ["Practice", "Ranked Mace"], "version": "1.21.4"},
    {"id": "s5", "name": "BedwarsPractice", "ip": "bwp.gg", "region": "NA", "players": 640, "max": 1200, "modes": ["Mace Box", "MLG"], "version": "1.21.4"},
    {"id": "s6", "name": "GommeHD", "ip": "gommehd.net", "region": "EU", "players": 2100, "max": 5000, "modes": ["FFA", "1v1"], "version": "1.21.4"},
    {"id": "s7", "name": "SaicoPvP", "ip": "saicopvp.com", "region": "NA", "players": 470, "max": 1000, "modes": ["UHC Mace", "Ranked"], "version": "1.21.4"},
    {"id": "s8", "name": "Loyisa", "ip": "play.loyisa.com", "region": "AS", "players": 1320, "max": 2000, "modes": ["Practice", "Mace Box"], "version": "1.21.4"},
]


@api_router.get("/servers")
async def list_servers():
    return SERVERS


# ---------- Replay Analyzer ----------
class ReplayReq(BaseModel):
    image_base64: Optional[str] = None
    description: str
    server: Optional[str] = None


@api_router.post("/replay/analyze")
async def replay_analyze(req: ReplayReq, user=Depends(get_current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")
    if not req.description.strip() and not req.image_base64:
        raise HTTPException(status_code=400, detail="Provide an image or description")

    prompt = (
        "You are MaceCoach Pro, analyzing a Minecraft 1.21+ Mace PvP clip. "
        "Give a critique in this exact structure:\n"
        "### What Went Right\n- bullet 1\n- bullet 2\n"
        "### What Went Wrong\n- bullet 1\n- bullet 2\n"
        "### How to Improve\n- bullet 1\n- bullet 2\n"
        "Be specific about mace mechanics (Density stacking, Wind Burst, fall heights, totem timing). "
        "Keep total response under 220 words. Use Java/Bedrock-aware advice."
    )
    user_input = f"Server: {req.server or 'unknown'}\nClip description: {req.description.strip()}"

    try:
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"replay_{user['id']}_{uuid.uuid4()}", system_message=prompt)
        chat = chat.with_model("anthropic", "claude-sonnet-4-5-20250929")
        if req.image_base64:
            # Attach image as content via multimodal
            msg = UserMessage(text=user_input, file_contents=[{"mime_type": "image/png", "data": req.image_base64}])
        else:
            msg = UserMessage(text=user_input)
        reply = await chat.send_message(msg)
        analysis = str(reply or "")
    except Exception as e:
        logging.exception("Replay LLM error")
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")

    record = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "description": req.description[:500],
        "server": req.server,
        "analysis": analysis,
        "created_at": now_iso(),
    }
    await db.replay_analyses.insert_one(record)
    return {"id": record["id"], "analysis": analysis, "created_at": record["created_at"]}


@api_router.get("/replay/history")
async def replay_history(user=Depends(get_current_user)):
    docs = await db.replay_analyses.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    return docs


# ---------- Clans ----------
class ClanCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=24)
    tag: str = Field(..., min_length=2, max_length=5, pattern=r"^[A-Z0-9]+$")
    description: str = Field("", max_length=200)


class ClanPublic(BaseModel):
    id: str
    name: str
    tag: str
    description: str
    leader_id: str
    leader_name: str
    member_count: int
    avg_elo: int
    is_member: bool = False
    created_at: str


class ClanMember(BaseModel):
    user_id: str
    username: str
    role: str
    elo: int
    kdr: float
    joined_at: str


async def _build_clan(doc: dict, viewer_id: Optional[str] = None) -> ClanPublic:
    members = await db.clan_members.find({"clan_id": doc["id"]}, {"_id": 0}).to_list(200)
    elo_sum = 0
    count = 0
    is_member = False
    for m in members:
        if viewer_id and m["user_id"] == viewer_id:
            is_member = True
        s = await _summary(m["user_id"])
        elo_sum += s.elo
        count += 1
    avg_elo = int(elo_sum / count) if count > 0 else 0
    leader = await db.users.find_one({"id": doc["leader_id"]}, {"_id": 0})
    leader_name = leader["username"] if leader else "Unknown"
    return ClanPublic(
        id=doc["id"], name=doc["name"], tag=doc["tag"], description=doc.get("description", ""),
        leader_id=doc["leader_id"], leader_name=leader_name,
        member_count=count, avg_elo=avg_elo, is_member=is_member,
        created_at=doc["created_at"],
    )


@api_router.post("/clans", response_model=ClanPublic)
async def create_clan(payload: ClanCreate, user=Depends(get_current_user)):
    existing_membership = await db.clan_members.find_one({"user_id": user["id"]})
    if existing_membership:
        raise HTTPException(status_code=400, detail="Leave your current clan first")
    if await db.clans.find_one({"name_lower": payload.name.lower()}):
        raise HTTPException(status_code=400, detail="Clan name taken")
    if await db.clans.find_one({"tag": payload.tag.upper()}):
        raise HTTPException(status_code=400, detail="Clan tag taken")
    cid = str(uuid.uuid4())
    doc = {
        "id": cid, "name": payload.name, "name_lower": payload.name.lower(),
        "tag": payload.tag.upper(), "description": payload.description,
        "leader_id": user["id"], "created_at": now_iso(),
    }
    await db.clans.insert_one(doc)
    await db.clan_members.insert_one({
        "clan_id": cid, "user_id": user["id"], "role": "leader", "joined_at": now_iso(),
    })
    return await _build_clan(doc, user["id"])


@api_router.get("/clans", response_model=List[ClanPublic])
async def list_clans(authorization: Optional[str] = Header(None)):
    viewer = await maybe_user(authorization)
    viewer_id = viewer["id"] if viewer else None
    docs = await db.clans.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    out = []
    for d in docs:
        out.append(await _build_clan(d, viewer_id))
    out.sort(key=lambda c: c.avg_elo, reverse=True)
    return out


@api_router.get("/clans/mine")
async def my_clan(user=Depends(get_current_user)):
    m = await db.clan_members.find_one({"user_id": user["id"]}, {"_id": 0})
    if not m:
        return None
    doc = await db.clans.find_one({"id": m["clan_id"]}, {"_id": 0})
    if not doc:
        return None
    return await _build_clan(doc, user["id"])


@api_router.get("/clans/{clan_id}")
async def get_clan(clan_id: str, authorization: Optional[str] = Header(None)):
    viewer = await maybe_user(authorization)
    doc = await db.clans.find_one({"id": clan_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Clan not found")
    members_docs = await db.clan_members.find({"clan_id": clan_id}, {"_id": 0}).to_list(200)
    members: List[ClanMember] = []
    for m in members_docs:
        u = await db.users.find_one({"id": m["user_id"]}, {"_id": 0, "password_hash": 0})
        if not u:
            continue
        s = await _summary(u["id"])
        members.append(ClanMember(user_id=u["id"], username=u["username"], role=m["role"],
                                  elo=s.elo, kdr=s.kdr, joined_at=m["joined_at"]))
    members.sort(key=lambda x: (x.role != "leader", -x.elo))
    info = await _build_clan(doc, viewer["id"] if viewer else None)
    return {"clan": info.model_dump(), "members": [m.model_dump() for m in members]}


@api_router.post("/clans/{clan_id}/join")
async def join_clan(clan_id: str, user=Depends(get_current_user)):
    existing = await db.clan_members.find_one({"user_id": user["id"]})
    if existing:
        raise HTTPException(status_code=400, detail="Already in a clan")
    doc = await db.clans.find_one({"id": clan_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Clan not found")
    await db.clan_members.insert_one({
        "clan_id": clan_id, "user_id": user["id"], "role": "member", "joined_at": now_iso(),
    })
    return {"ok": True}


@api_router.delete("/clans/{clan_id}/leave")
async def leave_clan(clan_id: str, user=Depends(get_current_user)):
    m = await db.clan_members.find_one({"clan_id": clan_id, "user_id": user["id"]}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Not a member")
    if m["role"] == "leader":
        # Disband if leader leaves & no other members; otherwise promote next
        others = await db.clan_members.find({"clan_id": clan_id, "user_id": {"$ne": user["id"]}}, {"_id": 0}).to_list(200)
        if not others:
            await db.clans.delete_one({"id": clan_id})
            await db.clan_members.delete_many({"clan_id": clan_id})
            return {"ok": True, "disbanded": True}
        new_leader = others[0]
        await db.clan_members.update_one({"clan_id": clan_id, "user_id": new_leader["user_id"]},
                                          {"$set": {"role": "leader"}})
        await db.clans.update_one({"id": clan_id}, {"$set": {"leader_id": new_leader["user_id"]}})
    await db.clan_members.delete_one({"clan_id": clan_id, "user_id": user["id"]})
    return {"ok": True}


# ---------- 1v1 Challenges ----------
class ChallengeCreate(BaseModel):
    opponent_username: str
    mode: str = "Mace 1v1"
    server: str = "Hypixel"
    message: str = Field("", max_length=200)


class ChallengeRow(BaseModel):
    id: str
    challenger_id: str
    challenger_name: str
    opponent_id: str
    opponent_name: str
    mode: str
    server: str
    message: str
    status: str  # pending | accepted | declined | completed
    winner_id: Optional[str] = None
    created_at: str
    responded_at: Optional[str] = None


@api_router.post("/challenges", response_model=ChallengeRow)
async def create_challenge(payload: ChallengeCreate, user=Depends(get_current_user)):
    opp = await db.users.find_one({"username_lower": payload.opponent_username.lower()},
                                  {"_id": 0, "password_hash": 0})
    if not opp:
        raise HTTPException(status_code=404, detail="Player not found")
    if opp["id"] == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot challenge yourself")
    doc = {
        "id": str(uuid.uuid4()),
        "challenger_id": user["id"], "challenger_name": user["username"],
        "opponent_id": opp["id"], "opponent_name": opp["username"],
        "mode": payload.mode, "server": payload.server, "message": payload.message,
        "status": "pending", "winner_id": None,
        "created_at": now_iso(), "responded_at": None,
    }
    await db.challenges.insert_one(doc)
    # Drop a notification to the opponent
    notif = Notification(
        user_id=opp["id"], kind="challenge", post_id=doc["id"],
        post_title=f"{payload.mode} on {payload.server}", actor=user["username"],
        preview=(payload.message or f"{user['username']} challenged you to {payload.mode}!")[:120],
    )
    await db.notifications.insert_one(notif.model_dump())
    return ChallengeRow(**doc)


@api_router.get("/challenges", response_model=List[ChallengeRow])
async def list_challenges(user=Depends(get_current_user), direction: str = "all"):
    q: dict = {}
    if direction == "incoming":
        q = {"opponent_id": user["id"]}
    elif direction == "outgoing":
        q = {"challenger_id": user["id"]}
    else:
        q = {"$or": [{"opponent_id": user["id"]}, {"challenger_id": user["id"]}]}
    docs = await db.challenges.find(q, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [ChallengeRow(**d) for d in docs]


async def _respond_challenge(cid: str, user, new_status: str, winner_id: Optional[str] = None):
    doc = await db.challenges.find_one({"id": cid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Challenge not found")
    if user["id"] not in (doc["opponent_id"], doc["challenger_id"]):
        raise HTTPException(status_code=403, detail="Not your challenge")
    upd = {"status": new_status, "responded_at": now_iso()}
    if winner_id:
        upd["winner_id"] = winner_id
    await db.challenges.update_one({"id": cid}, {"$set": upd})
    doc.update(upd)
    return ChallengeRow(**doc)


@api_router.post("/challenges/{cid}/accept", response_model=ChallengeRow)
async def accept_challenge(cid: str, user=Depends(get_current_user)):
    doc = await db.challenges.find_one({"id": cid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Challenge not found")
    if doc["opponent_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the challenged player can accept")
    return await _respond_challenge(cid, user, "accepted")


@api_router.post("/challenges/{cid}/decline", response_model=ChallengeRow)
async def decline_challenge(cid: str, user=Depends(get_current_user)):
    doc = await db.challenges.find_one({"id": cid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Challenge not found")
    if doc["opponent_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the challenged player can decline")
    return await _respond_challenge(cid, user, "declined")


class CompleteReq(BaseModel):
    winner_id: str


@api_router.post("/challenges/{cid}/complete", response_model=ChallengeRow)
async def complete_challenge(cid: str, payload: CompleteReq, user=Depends(get_current_user)):
    doc = await db.challenges.find_one({"id": cid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Challenge not found")
    if payload.winner_id not in (doc["opponent_id"], doc["challenger_id"]):
        raise HTTPException(status_code=400, detail="Winner must be a participant")
    return await _respond_challenge(cid, user, "completed", winner_id=payload.winner_id)


# ---------- Find Duo ----------
DUO_TTL_HOURS = 2


class DuoCreate(BaseModel):
    mode: str = "Ranked Duos"
    region: str = "NA"
    skill: str = "any"  # any | bronze | silver | gold | diamond
    message: str = Field("", max_length=200)


class DuoRow(BaseModel):
    id: str
    user_id: str
    username: str
    mode: str
    region: str
    skill: str
    message: str
    elo: int
    kdr: float
    created_at: str


@api_router.post("/duo", response_model=DuoRow)
async def post_duo(payload: DuoCreate, user=Depends(get_current_user)):
    # One open post per user — overwrite
    await db.duo_queue.delete_many({"user_id": user["id"]})
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"], "username": user["username"],
        "mode": payload.mode, "region": payload.region, "skill": payload.skill,
        "message": payload.message, "created_at": now_iso(),
    }
    await db.duo_queue.insert_one(doc)
    s = await _summary(user["id"])
    return DuoRow(**doc, elo=s.elo, kdr=s.kdr)


@api_router.get("/duo", response_model=List[DuoRow])
async def list_duo(region: Optional[str] = None):
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=DUO_TTL_HOURS)).isoformat()
    q: dict = {"created_at": {"$gte": cutoff}}
    if region and region != "ALL":
        q["region"] = region
    docs = await db.duo_queue.find(q, {"_id": 0}).sort("created_at", -1).to_list(100)
    out: List[DuoRow] = []
    for d in docs:
        s = await _summary(d["user_id"])
        out.append(DuoRow(**d, elo=s.elo, kdr=s.kdr))
    return out


@api_router.delete("/duo")
async def cancel_duo(user=Depends(get_current_user)):
    await db.duo_queue.delete_many({"user_id": user["id"]})
    return {"ok": True}


@api_router.get("/duo/mine")
async def my_duo(user=Depends(get_current_user)):
    doc = await db.duo_queue.find_one({"user_id": user["id"]}, {"_id": 0})
    if not doc:
        return None
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=DUO_TTL_HOURS)).isoformat()
    if doc["created_at"] < cutoff:
        await db.duo_queue.delete_many({"user_id": user["id"]})
        return None
    s = await _summary(user["id"])
    return DuoRow(**doc, elo=s.elo, kdr=s.kdr).model_dump()


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
