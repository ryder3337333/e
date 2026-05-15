"""Backend pytest suite for Mace PvP API (JWT Auth migration).

Covers:
- Auth: signup/login/me + duplicate/invalid validations
- Public endpoints (forum list, leaderboard) reachable without token
- Protected endpoints reject 401 without token, succeed with valid bearer
- Forum: author matches authenticated user.username
- Loadouts/Stats are scoped per user (cross-user isolation)
- Chat: Claude reply + per-user history
- Notifications: created when user B comments on user A's post
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL", "https://pvp-mace-forge.preview.emergentagent.com"
).rstrip("/")
API = f"{BASE_URL}/api"


def _rand(prefix: str = "u") -> str:
    return f"TEST_{prefix}_{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module")
def user_a(s):
    uname = _rand("ua")
    payload = {"email": f"{uname}@test.com", "username": uname, "password": "secret123"}
    r = s.post(f"{API}/auth/signup", json=payload)
    assert r.status_code == 200, r.text
    d = r.json()
    return {"token": d["token"], "user": d["user"], "password": payload["password"]}


@pytest.fixture(scope="module")
def user_b(s):
    uname = _rand("ub")
    payload = {"email": f"{uname}@test.com", "username": uname, "password": "secret123"}
    r = s.post(f"{API}/auth/signup", json=payload)
    assert r.status_code == 200, r.text
    d = r.json()
    return {"token": d["token"], "user": d["user"], "password": payload["password"]}


def H(u):
    return {"Authorization": f"Bearer {u['token']}"}


# ---------- Root ----------
class TestRoot:
    def test_root_ok(self, s):
        r = s.get(f"{API}/")
        assert r.status_code == 200
        assert "message" in r.json()


# ---------- Auth: signup ----------
class TestSignup:
    def test_signup_success(self, s):
        uname = _rand("new")
        r = s.post(f"{API}/auth/signup", json={
            "email": f"{uname}@test.com", "username": uname, "password": "secret123"
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert "token" in d and isinstance(d["token"], str) and len(d["token"]) > 10
        assert d["user"]["username"] == uname
        assert d["user"]["email"] == f"{uname}@test.com".lower()
        assert "id" in d["user"]

    def test_signup_duplicate_email(self, s, user_a):
        # same email, new username -> 400 email already registered
        r = s.post(f"{API}/auth/signup", json={
            "email": user_a["user"]["email"],
            "username": _rand("diff"),
            "password": "secret123",
        })
        assert r.status_code == 400
        assert "Email already registered" in r.json().get("detail", "")

    def test_signup_duplicate_username_case_insensitive(self, s, user_a):
        # new email, same username (different case) -> 400 username taken
        uname_upper = user_a["user"]["username"].upper()
        r = s.post(f"{API}/auth/signup", json={
            "email": f"new_{uuid.uuid4().hex[:6]}@test.com",
            "username": uname_upper,
            "password": "secret123",
        })
        assert r.status_code == 400
        assert "Username already taken" in r.json().get("detail", "")

    def test_signup_invalid_email_422(self, s):
        r = s.post(f"{API}/auth/signup", json={
            "email": "not-an-email", "username": _rand("e"), "password": "secret123"
        })
        assert r.status_code == 422

    def test_signup_short_username_422(self, s):
        r = s.post(f"{API}/auth/signup", json={
            "email": f"{_rand('s')}@test.com", "username": "ab", "password": "secret123"
        })
        assert r.status_code == 422

    def test_signup_invalid_username_chars_422(self, s):
        r = s.post(f"{API}/auth/signup", json={
            "email": f"{_rand('s')}@test.com", "username": "bad name!", "password": "secret123"
        })
        assert r.status_code == 422


# ---------- Auth: login + me ----------
class TestLoginMe:
    def test_login_success(self, s, user_a):
        r = s.post(f"{API}/auth/login", json={
            "email": user_a["user"]["email"], "password": user_a["password"]
        })
        assert r.status_code == 200
        d = r.json()
        assert "token" in d
        assert d["user"]["id"] == user_a["user"]["id"]

    def test_login_wrong_password(self, s, user_a):
        r = s.post(f"{API}/auth/login", json={
            "email": user_a["user"]["email"], "password": "wrongpass!"
        })
        assert r.status_code == 401
        assert "Invalid email or password" in r.json().get("detail", "")

    def test_me_without_token_401(self, s):
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, s, user_a):
        r = s.get(f"{API}/auth/me", headers=H(user_a))
        assert r.status_code == 200
        assert r.json()["id"] == user_a["user"]["id"]
        assert r.json()["username"] == user_a["user"]["username"]


# ---------- Public endpoints ----------
class TestPublic:
    def test_forum_list_public(self, s):
        r = s.get(f"{API}/forum/posts")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_leaderboard_public(self, s):
        r = s.get(f"{API}/leaderboard/weekly")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Protected endpoints reject without token ----------
class TestProtectedAuthRequired:
    @pytest.mark.parametrize("method,path,body", [
        ("POST", "/forum/posts", {"title": "x", "body": "y"}),
        ("POST", "/loadouts", {"name": "x"}),
        ("POST", "/stats/log", {"kind": "kill"}),
        ("POST", "/chat", {"message": "hi"}),
        ("GET", "/loadouts", None),
        ("GET", "/stats", None),
        ("GET", "/notifications", None),
    ])
    def test_unauthed_401(self, s, method, path, body):
        if method == "POST":
            r = s.post(f"{API}{path}", json=body)
        else:
            r = s.get(f"{API}{path}")
        assert r.status_code == 401, f"{method} {path} expected 401, got {r.status_code}"


# ---------- Forum: author = authenticated user.username ----------
class TestForumAuth:
    def test_create_post_uses_authed_user(self, s, user_a):
        r = s.post(f"{API}/forum/posts", headers=H(user_a),
                   json={"title": "TEST_authpost", "body": "auth body"})
        assert r.status_code == 200
        d = r.json()
        assert d["author"] == user_a["user"]["username"]
        assert d["user_id"] == user_a["user"]["id"]

    def test_create_post_with_media(self, s, user_a):
        r = s.post(f"{API}/forum/posts", headers=H(user_a), json={
            "title": "TEST_media", "body": "b",
            "media_url": "https://x/y.png", "media_type": "image"
        })
        assert r.status_code == 200
        assert r.json()["media_type"] == "image"


# ---------- Loadouts: per-user scoping ----------
class TestLoadoutsScoping:
    def test_user_a_creates_loadout(self, s, user_a):
        r = s.post(f"{API}/loadouts", headers=H(user_a), json={
            "name": "TEST_A_build", "enchantments": ["Density V"], "armor": ["Netherite Helmet"]
        })
        assert r.status_code == 200
        TestLoadoutsScoping.a_loadout_id = r.json()["id"]

    def test_user_b_cannot_see_a_loadouts(self, s, user_b):
        r = s.get(f"{API}/loadouts", headers=H(user_b))
        assert r.status_code == 200
        ids = [lo["id"] for lo in r.json()]
        assert TestLoadoutsScoping.a_loadout_id not in ids

    def test_user_a_sees_own(self, s, user_a):
        r = s.get(f"{API}/loadouts", headers=H(user_a))
        ids = [lo["id"] for lo in r.json()]
        assert TestLoadoutsScoping.a_loadout_id in ids

    def test_user_b_cannot_delete_a_loadout(self, s, user_b):
        r = s.delete(f"{API}/loadouts/{TestLoadoutsScoping.a_loadout_id}", headers=H(user_b))
        assert r.status_code == 404  # scoped delete returns 404


# ---------- Stats: per-user scoping ----------
class TestStatsScoping:
    def test_a_logs_kill(self, s, user_a):
        r = s.post(f"{API}/stats/log", headers=H(user_a), json={"kind": "kill"})
        assert r.status_code == 200
        assert r.json()["kills"] >= 1

    def test_b_stats_separate(self, s, user_b):
        r = s.get(f"{API}/stats", headers=H(user_b))
        assert r.status_code == 200
        # user_b has not logged any kill -> 0
        assert r.json()["kills"] == 0

    def test_invalid_kind_400(self, s, user_a):
        r = s.post(f"{API}/stats/log", headers=H(user_a), json={"kind": "nope"})
        assert r.status_code == 400


# ---------- Chat (Claude) + per-user history ----------
class TestChat:
    def test_chat_reply(self, s, user_a):
        r = s.post(f"{API}/chat", headers=H(user_a),
                   json={"message": "In one sentence: what does Density do?"}, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d["reply"], str) and len(d["reply"]) > 0
        TestChat.session_id = d["session_id"]

    def test_history_scoped_to_user(self, s, user_a, user_b):
        time.sleep(1)
        # user_a sees own history
        r = s.get(f"{API}/chat/{TestChat.session_id}", headers=H(user_a))
        assert r.status_code == 200
        assert len(r.json()) >= 2
        # user_b sees nothing under user_a's session
        r2 = s.get(f"{API}/chat/{TestChat.session_id}", headers=H(user_b))
        assert r2.status_code == 200
        assert r2.json() == []


# ---------- Notifications: user B comments -> user A gets notification ----------
class TestNotifications:
    def test_notification_on_comment(self, s, user_a, user_b):
        # user A creates a post
        rp = s.post(f"{API}/forum/posts", headers=H(user_a),
                    json={"title": "TEST_notif_post", "body": "x"})
        assert rp.status_code == 200
        post_id = rp.json()["id"]

        # user B comments
        rc = s.post(f"{API}/forum/posts/{post_id}/comments", headers=H(user_b),
                    json={"text": "TEST_notif_comment"})
        assert rc.status_code == 200

        # user A fetches notifications -> sees one
        time.sleep(0.5)
        rn = s.get(f"{API}/notifications", headers=H(user_a))
        assert rn.status_code == 200
        notifs = rn.json()
        match = [n for n in notifs if n["post_id"] == post_id]
        assert len(match) >= 1
        assert match[0]["actor"] == user_b["user"]["username"]
        assert match[0]["kind"] == "comment"

    def test_no_self_notification(self, s, user_a):
        # user A comments on own post -> no extra notification
        rp = s.post(f"{API}/forum/posts", headers=H(user_a),
                    json={"title": "TEST_self_post", "body": "x"})
        post_id = rp.json()["id"]
        before = s.get(f"{API}/notifications", headers=H(user_a)).json()
        s.post(f"{API}/forum/posts/{post_id}/comments", headers=H(user_a),
               json={"text": "self comment"})
        after = s.get(f"{API}/notifications", headers=H(user_a)).json()
        # No new notif for self-comment
        assert len(after) == len(before)
