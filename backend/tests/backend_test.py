"""Backend pytest suite for Mace PvP API.

Covers: root, stats (log/get/reset), forum (CRUD + comments + likes),
loadouts (create/list/delete), and AI chat (Claude Sonnet 4.5 + history).
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = "https://pvp-mace-forge.preview.emergentagent.com"
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module")
def device_id():
    return f"TEST_dev_{uuid.uuid4().hex[:8]}"


# ---------- Root ----------
class TestRoot:
    def test_root_ok(self, s):
        r = s.get(f"{API}/")
        assert r.status_code == 200
        assert "message" in r.json()


# ---------- Stats ----------
class TestStats:
    def test_reset_initial(self, s, device_id):
        r = s.post(f"{API}/stats/reset", json={"device_id": device_id, "kind": "kill"})
        assert r.status_code == 200

    def test_log_kill_increments(self, s, device_id):
        r = s.post(f"{API}/stats/log", json={"device_id": device_id, "kind": "kill"})
        assert r.status_code == 200
        d = r.json()
        assert d["kills"] == 1 and d["deaths"] == 0
        assert d["streak"] == 1

    def test_log_death_increments(self, s, device_id):
        r = s.post(f"{API}/stats/log", json={"device_id": device_id, "kind": "death"})
        assert r.status_code == 200
        d = r.json()
        assert d["kills"] == 1 and d["deaths"] == 1
        assert d["streak"] == 0
        assert d["kdr"] == 1.0

    def test_get_stats_summary(self, s, device_id):
        r = s.get(f"{API}/stats", params={"device_id": device_id})
        assert r.status_code == 200
        d = r.json()
        assert d["device_id"] == device_id
        assert d["kills"] == 1 and d["deaths"] == 1

    def test_invalid_kind_400(self, s, device_id):
        r = s.post(f"{API}/stats/log", json={"device_id": device_id, "kind": "wat"})
        assert r.status_code == 400

    def test_reset_clears(self, s, device_id):
        s.post(f"{API}/stats/reset", json={"device_id": device_id, "kind": "kill"})
        r = s.get(f"{API}/stats", params={"device_id": device_id})
        d = r.json()
        assert d["kills"] == 0 and d["deaths"] == 0


# ---------- Forum ----------
class TestForum:
    post_id = None

    def test_create_post(self, s):
        payload = {"author": "TEST_user", "title": "TEST_Mace tips", "body": "Density 5 stack"}
        r = s.post(f"{API}/forum/posts", json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["title"] == payload["title"]
        assert d["likes"] == 0 and d["comments_count"] == 0
        assert "id" in d
        TestForum.post_id = d["id"]

    def test_list_posts_contains(self, s):
        r = s.get(f"{API}/forum/posts")
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()]
        assert TestForum.post_id in ids

    def test_like_increments(self, s):
        r = s.post(f"{API}/forum/posts/{TestForum.post_id}/like")
        assert r.status_code == 200
        assert r.json()["likes"] == 1
        r2 = s.post(f"{API}/forum/posts/{TestForum.post_id}/like")
        assert r2.json()["likes"] == 2

    def test_add_comment(self, s):
        r = s.post(
            f"{API}/forum/posts/{TestForum.post_id}/comments",
            json={"author": "TEST_commenter", "text": "nice build"},
        )
        assert r.status_code == 200
        d = r.json()
        assert d["text"] == "nice build"
        assert d["post_id"] == TestForum.post_id

    def test_list_comments(self, s):
        r = s.get(f"{API}/forum/posts/{TestForum.post_id}/comments")
        assert r.status_code == 200
        comments = r.json()
        assert len(comments) >= 1

    def test_post_comments_count_incremented(self, s):
        r = s.get(f"{API}/forum/posts")
        post = next(p for p in r.json() if p["id"] == TestForum.post_id)
        assert post["comments_count"] >= 1

    def test_like_unknown_404(self, s):
        r = s.post(f"{API}/forum/posts/nonexistent-id/like")
        assert r.status_code == 404

    def test_comment_on_unknown_404(self, s):
        r = s.post(f"{API}/forum/posts/nonexistent-id/comments",
                   json={"author": "x", "text": "y"})
        assert r.status_code == 404


# ---------- Loadouts ----------
class TestLoadouts:
    loadout_id = None

    def test_create_loadout(self, s, device_id):
        payload = {
            "device_id": device_id,
            "name": "TEST_Smash Build",
            "enchantments": ["Density V", "Breach IV", "Wind Burst III"],
            "armor": ["Netherite Helmet", "Elytra"],
            "notes": "fall stack",
        }
        r = s.post(f"{API}/loadouts", json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["name"] == payload["name"]
        assert "Density V" in d["enchantments"]
        TestLoadouts.loadout_id = d["id"]

    def test_list_loadouts(self, s, device_id):
        r = s.get(f"{API}/loadouts", params={"device_id": device_id})
        assert r.status_code == 200
        ids = [l["id"] for l in r.json()]
        assert TestLoadouts.loadout_id in ids

    def test_delete_loadout(self, s, device_id):
        r = s.delete(f"{API}/loadouts/{TestLoadouts.loadout_id}")
        assert r.status_code == 200
        # verify gone
        r2 = s.get(f"{API}/loadouts", params={"device_id": device_id})
        ids = [l["id"] for l in r2.json()]
        assert TestLoadouts.loadout_id not in ids

    def test_delete_unknown_404(self, s):
        r = s.delete(f"{API}/loadouts/nonexistent")
        assert r.status_code == 404


# ---------- Chat (Claude Sonnet 4.5) ----------
class TestChat:
    session_id = f"TEST_sess_{uuid.uuid4().hex[:8]}"

    def test_chat_reply(self, s):
        r = s.post(
            f"{API}/chat",
            json={"session_id": TestChat.session_id, "message": "In one sentence: what does Density do?"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["session_id"] == TestChat.session_id
        assert isinstance(d["reply"], str) and len(d["reply"]) > 0

    def test_chat_multi_turn_history(self, s):
        r = s.post(
            f"{API}/chat",
            json={"session_id": TestChat.session_id, "message": "And Breach in one sentence?"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        time.sleep(1)
        h = s.get(f"{API}/chat/{TestChat.session_id}")
        assert h.status_code == 200
        msgs = h.json()
        # 2 user + 2 assistant = 4 messages minimum
        assert len(msgs) >= 4
        roles = [m["role"] for m in msgs]
        assert roles.count("user") >= 2 and roles.count("assistant") >= 2

    def test_chat_empty_message_400(self, s):
        r = s.post(f"{API}/chat", json={"session_id": TestChat.session_id, "message": "   "})
        assert r.status_code == 400
