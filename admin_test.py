"""
Admin / Moderation endpoint tests for the Mace PvP backend.

Strategy:
  - Sign up 3 fresh users (U_admin candidate, U_target, U_other).
  - Promote U_admin to admin via a direct MongoDB rename to one of the
    hard-coded admin usernames ("rydersworld" / "greenboottap").
  - Login as the admin again to get a fresh token (now is_admin=True).
  - Walk every admin endpoint with PASS/FAIL logging.
"""
import asyncio
import os
import random
import string
import sys
import time
import uuid

import requests
from motor.motor_asyncio import AsyncIOMotorClient

BACKEND = "https://pvp-mace-forge.preview.emergentagent.com/api"

# load envs the same way server does
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"

PASS = 0
FAIL = 0
FAILURES = []


def log(label, ok, detail=""):
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f"  PASS  {label}  {detail}")
    else:
        FAIL += 1
        FAILURES.append(f"{label} :: {detail}")
        print(f"  FAIL  {label}  {detail}")


def rand_suffix(n=6):
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


def signup(username, email, password="MacePvP123!"):
    r = requests.post(f"{BACKEND}/auth/signup", json={
        "email": email, "username": username, "password": password,
    }, timeout=30)
    return r


def login(email, password="MacePvP123!"):
    r = requests.post(f"{BACKEND}/auth/login", json={
        "email": email, "password": password,
    }, timeout=30)
    return r


def auth(token):
    return {"Authorization": f"Bearer {token}"}


STASHED_ADMIN = {}  # id -> original (username, username_lower) so we can restore later


async def promote_to_admin(target_username_lower, new_admin_name):
    """Rename a fresh user record to the admin username (in DB only).

    If the admin username is already squatted by another DB record (likely an
    old test artifact), temporarily move that record aside, take the admin
    name for our test user, and remember the stash so we can restore it
    after the test run.
    """
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    existing = await db.users.find_one({"username_lower": new_admin_name.lower()})
    if existing:
        stash_name = f"{existing['username']}_stash_{uuid.uuid4().hex[:6]}"
        STASHED_ADMIN[existing["id"]] = (existing["username"], existing["username_lower"])
        await db.users.update_one(
            {"id": existing["id"]},
            {"$set": {"username": stash_name, "username_lower": stash_name.lower()}},
        )
    res = await db.users.update_one(
        {"username_lower": target_username_lower},
        {"$set": {"username": new_admin_name, "username_lower": new_admin_name.lower()}},
    )
    client.close()
    return res.modified_count == 1, str(res.raw_result)


async def restore_stashed_admin():
    if not STASHED_ADMIN:
        return
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    for uid, (orig_username, orig_username_lower) in STASHED_ADMIN.items():
        # Only restore if the slot is currently free (our test user no longer holds it).
        clash = await db.users.find_one({"username_lower": orig_username_lower})
        if clash and clash["id"] != uid:
            # Move our test user out of the way first
            new_lower = f"{clash['username']}_tmp_{uuid.uuid4().hex[:4]}"
            await db.users.update_one({"id": clash["id"]}, {"$set": {"username": new_lower, "username_lower": new_lower.lower()}})
        await db.users.update_one(
            {"id": uid},
            {"$set": {"username": orig_username, "username_lower": orig_username_lower}},
        )
    client.close()


async def main():
    print("=" * 70)
    print("ADMIN / MODERATION ENDPOINT TESTS")
    print("=" * 70)

    suffix = rand_suffix()
    # Pick admin candidate names. We'll try rydersworld first; if taken, try greenboottap.
    admin_target_username = f"qa_admin_{suffix}"
    target_username = f"qa_target_{suffix}"
    other_username = f"qa_other_{suffix}"

    admin_email = f"qa_admin_{suffix}@test.io"
    target_email = f"qa_target_{suffix}@test.io"
    other_email = f"qa_other_{suffix}@test.io"

    # ---- 1) Signup 3 users ----
    r = signup(admin_target_username, admin_email)
    log("signup admin-candidate", r.status_code == 200, f"HTTP={r.status_code} body={r.text[:160]}")
    if r.status_code != 200:
        print("FATAL: cannot continue")
        return
    admin_user_id = r.json()["user"]["id"]
    admin_token = r.json()["token"]  # not yet admin

    r = signup(target_username, target_email)
    log("signup target", r.status_code == 200, f"HTTP={r.status_code}")
    if r.status_code != 200:
        print("FATAL: cannot continue")
        return
    target_token = r.json()["token"]
    target_user_id = r.json()["user"]["id"]

    r = signup(other_username, other_email)
    log("signup other", r.status_code == 200, f"HTTP={r.status_code}")
    if r.status_code != 200:
        print("FATAL: cannot continue")
        return
    other_token = r.json()["token"]

    # ---- 2) Promote admin-candidate via DB ----
    display = "RydersWorld"
    ok, info = await promote_to_admin(admin_target_username.lower(), display)
    promoted = ok
    promoted_username = display if ok else None
    log("promote candidate to admin (DB rename, stashing prior holder if needed)", promoted, f"now username={promoted_username}")
    if not promoted:
        print("FATAL: could not promote any user to admin")
        return

    # Re-login as admin (existing token still works because is_admin is computed at runtime).
    r = login(admin_email)
    log("re-login as admin", r.status_code == 200, f"HTTP={r.status_code}")
    if r.status_code == 200:
        admin_token = r.json()["token"]
        is_admin = r.json()["user"].get("is_admin")
        log("login response shows is_admin=true", is_admin is True, f"is_admin={is_admin}")

    # ============================================================
    # 1) GET /api/admin/me
    # ============================================================
    print("\n--- GET /api/admin/me ---")
    r = requests.get(f"{BACKEND}/admin/me", headers=auth(admin_token), timeout=15)
    ok = r.status_code == 200 and r.json().get("is_admin") is True and r.json().get("username", "").lower() in ("rydersworld", "greenboottap")
    log("admin /admin/me returns is_admin:true with admin username", ok, f"HTTP={r.status_code} body={r.text[:160]}")

    r = requests.get(f"{BACKEND}/admin/me", headers=auth(target_token), timeout=15)
    ok = r.status_code == 200 and r.json().get("is_admin") is False
    log("non-admin /admin/me returns is_admin:false", ok, f"HTTP={r.status_code} body={r.text[:160]}")

    # ============================================================
    # 2) GET /api/admin/users
    # ============================================================
    print("\n--- GET /api/admin/users ---")
    r = requests.get(f"{BACKEND}/admin/users", timeout=15)
    log("no-auth -> 401", r.status_code == 401, f"HTTP={r.status_code}")

    r = requests.get(f"{BACKEND}/admin/users", headers=auth(target_token), timeout=15)
    log("non-admin -> 403", r.status_code == 403, f"HTTP={r.status_code}")

    r = requests.get(f"{BACKEND}/admin/users", headers=auth(admin_token), timeout=15)
    ok = r.status_code == 200 and isinstance(r.json(), list) and len(r.json()) > 0
    fields_ok = False
    if ok:
        sample = r.json()[0]
        fields_ok = all(k in sample for k in ("id", "username", "email", "is_banned", "muted_until", "is_admin", "created_at"))
    log("admin -> 200 with expected fields", ok and fields_ok, f"HTTP={r.status_code} sample_keys={list(r.json()[0].keys()) if ok else 'n/a'}")

    r = requests.get(f"{BACKEND}/admin/users", params={"q": target_username[:6]}, headers=auth(admin_token), timeout=15)
    ok = r.status_code == 200 and isinstance(r.json(), list) and any(u["username"] == target_username for u in r.json())
    log("admin ?q= filter returns target user", ok, f"HTTP={r.status_code} count={len(r.json()) if r.status_code==200 else 'n/a'}")

    # ============================================================
    # 3) POST /api/admin/ban
    # ============================================================
    print("\n--- POST /api/admin/ban ---")
    r = requests.post(f"{BACKEND}/admin/ban", json={"username": target_username}, headers=auth(admin_token), timeout=15)
    ok = r.status_code == 200 and r.json().get("banned") is True
    log("ban target", ok, f"HTTP={r.status_code} body={r.text[:160]}")

    # Login attempt by target should now 403
    r = login(target_email)
    log("banned target login -> 403", r.status_code == 403, f"HTTP={r.status_code} body={r.text[:160]}")

    # Non-admin attempt to ban -> 403
    r = requests.post(f"{BACKEND}/admin/ban", json={"username": other_username}, headers=auth(other_token), timeout=15)
    log("non-admin ban -> 403", r.status_code == 403, f"HTTP={r.status_code}")

    # Banning an admin -> 400
    r = requests.post(f"{BACKEND}/admin/ban", json={"username": promoted_username}, headers=auth(admin_token), timeout=15)
    log("ban admin -> 400 'Cannot ban another admin'", r.status_code == 400 and "admin" in r.text.lower(), f"HTTP={r.status_code} body={r.text[:160]}")

    # ============================================================
    # 4) POST /api/admin/unban
    # ============================================================
    print("\n--- POST /api/admin/unban ---")
    r = requests.post(f"{BACKEND}/admin/unban", json={"username": target_username}, headers=auth(admin_token), timeout=15)
    ok = r.status_code == 200 and r.json().get("banned") is False
    log("unban target", ok, f"HTTP={r.status_code} body={r.text[:160]}")

    r = login(target_email)
    log("unbanned target can login", r.status_code == 200, f"HTTP={r.status_code}")
    if r.status_code == 200:
        target_token = r.json()["token"]  # refresh token after unban

    # ============================================================
    # 5) POST /api/admin/mute (timed + permanent)
    # ============================================================
    print("\n--- POST /api/admin/mute (5 min) ---")
    r = requests.post(f"{BACKEND}/admin/mute", json={"username": target_username, "minutes": 5}, headers=auth(admin_token), timeout=15)
    ok = r.status_code == 200 and r.json().get("scope") == "5min" and r.json().get("muted_until")
    log("mute target 5min returns scope=5min and muted_until", ok, f"HTTP={r.status_code} body={r.text[:200]}")

    # Target should NOT be able to post in forum
    r = requests.post(f"{BACKEND}/forum/posts",
                      json={"title": "muted test", "body": "should fail"},
                      headers=auth(target_token), timeout=15)
    ok = r.status_code == 403 and "muted" in r.text.lower()
    log("muted target POST /forum/posts -> 403 'You are muted'", ok, f"HTTP={r.status_code} body={r.text[:160]}")

    # Unmute, then test permanent mute
    requests.post(f"{BACKEND}/admin/unmute", json={"username": target_username}, headers=auth(admin_token), timeout=15)

    print("\n--- POST /api/admin/mute (permanent) ---")
    r = requests.post(f"{BACKEND}/admin/mute", json={"username": target_username}, headers=auth(admin_token), timeout=15)
    ok = r.status_code == 200 and r.json().get("scope") == "permanent"
    log("mute target permanent returns scope=permanent", ok, f"HTTP={r.status_code} body={r.text[:200]}")

    # Muting an admin -> 400
    r = requests.post(f"{BACKEND}/admin/mute", json={"username": promoted_username, "minutes": 1}, headers=auth(admin_token), timeout=15)
    log("mute admin -> 400 'Cannot mute another admin'", r.status_code == 400 and "admin" in r.text.lower(), f"HTTP={r.status_code} body={r.text[:160]}")

    # ============================================================
    # 6) POST /api/admin/unmute
    # ============================================================
    print("\n--- POST /api/admin/unmute ---")
    r = requests.post(f"{BACKEND}/admin/unmute", json={"username": target_username}, headers=auth(admin_token), timeout=15)
    ok = r.status_code == 200 and r.json().get("muted") is False
    log("unmute target", ok, f"HTTP={r.status_code} body={r.text[:160]}")

    # After unmute target should be able to post
    r = requests.post(f"{BACKEND}/forum/posts",
                      json={"title": "after unmute", "body": "should work"},
                      headers=auth(target_token), timeout=15)
    ok = r.status_code == 200
    log("unmuted target can POST /forum/posts", ok, f"HTTP={r.status_code} body={r.text[:160]}")
    target_post_id = r.json().get("id") if ok else None

    # ============================================================
    # 7) DELETE /api/admin/forum/posts/{post_id}
    # ============================================================
    print("\n--- DELETE /api/admin/forum/posts/{post_id} ---")
    # U_other create a post
    r = requests.post(f"{BACKEND}/forum/posts",
                      json={"title": "Other's post", "body": "to be deleted by admin"},
                      headers=auth(other_token), timeout=15)
    log("U_other creates a forum post", r.status_code == 200, f"HTTP={r.status_code}")
    other_post_id = r.json().get("id") if r.status_code == 200 else None

    # Non-admin can't delete
    if other_post_id:
        r = requests.delete(f"{BACKEND}/admin/forum/posts/{other_post_id}", headers=auth(target_token), timeout=15)
        log("non-admin DELETE post -> 403", r.status_code == 403, f"HTTP={r.status_code}")

    # Admin deletes it
    if other_post_id:
        r = requests.delete(f"{BACKEND}/admin/forum/posts/{other_post_id}", headers=auth(admin_token), timeout=15)
        ok = r.status_code == 200 and r.json().get("ok") is True
        log("admin DELETE post -> 200", ok, f"HTTP={r.status_code} body={r.text[:160]}")

    # Non-existent
    r = requests.delete(f"{BACKEND}/admin/forum/posts/non-existent-id-{uuid.uuid4()}", headers=auth(admin_token), timeout=15)
    log("admin DELETE non-existent post -> 404", r.status_code == 404, f"HTTP={r.status_code}")

    # ============================================================
    # 8) DELETE /api/admin/forum/comments/{comment_id}
    # ============================================================
    print("\n--- DELETE /api/admin/forum/comments/{comment_id} ---")
    # Use target's recently created post (target_post_id) — create comment as U_other
    if not target_post_id:
        # fallback: create one
        r = requests.post(f"{BACKEND}/forum/posts",
                          json={"title": "fallback post", "body": "."},
                          headers=auth(target_token), timeout=15)
        target_post_id = r.json().get("id")

    r = requests.post(f"{BACKEND}/forum/posts/{target_post_id}/comments",
                      json={"text": "U_other comment to be admin-deleted"},
                      headers=auth(other_token), timeout=15)
    log("U_other adds a comment", r.status_code == 200, f"HTTP={r.status_code} body={r.text[:160]}")
    comment_id = r.json().get("id") if r.status_code == 200 else None

    if comment_id:
        r = requests.delete(f"{BACKEND}/admin/forum/comments/{comment_id}", headers=auth(admin_token), timeout=15)
        ok = r.status_code == 200 and r.json().get("ok") is True
        log("admin DELETE comment -> 200", ok, f"HTTP={r.status_code} body={r.text[:160]}")

    r = requests.delete(f"{BACKEND}/admin/forum/comments/non-existent-{uuid.uuid4()}", headers=auth(admin_token), timeout=15)
    log("admin DELETE non-existent comment -> 404", r.status_code == 404, f"HTTP={r.status_code}")

    # ============================================================
    # Bonus: admin can post even if somehow muted (require_not_muted bypass)
    # ============================================================
    print("\n--- Bonus: admin bypasses mute on /forum/posts ---")
    # Mark admin user muted directly in DB and try posting
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    from datetime import datetime, timezone, timedelta
    forced_mute = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    await db.users.update_one({"id": admin_user_id}, {"$set": {"muted_until": forced_mute}})
    client.close()

    r = requests.post(f"{BACKEND}/forum/posts",
                      json={"title": "admin bypass", "body": "should still post"},
                      headers=auth(admin_token), timeout=15)
    ok = r.status_code == 200
    log("admin can post even with muted_until set", ok, f"HTTP={r.status_code} body={r.text[:160]}")

    # cleanup mute flag on admin
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    await db.users.update_one({"id": admin_user_id}, {"$unset": {"muted_until": ""}})
    client.close()

    print("\n" + "=" * 70)
    print(f"RESULTS: {PASS} PASS / {FAIL} FAIL")
    print("=" * 70)
    if FAILURES:
        print("\nFAILED CHECKS:")
        for f in FAILURES:
            print(" - " + f)
    sys.exit(0 if FAIL == 0 else 1)


if __name__ == "__main__":
    asyncio.run(main())
