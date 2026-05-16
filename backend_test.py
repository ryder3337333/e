"""
Backend tests for Minecraft Mace PvP app - new feature groups:
1) Clans
2) 1v1 Challenges
3) Find Duo
"""
import os
import sys
import uuid
import json
import requests

BASE = "https://pvp-mace-forge.preview.emergentagent.com/api"

results = []  # (group, name, ok, detail)

def log(group, name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    line = f"[{status}] {group} :: {name}"
    if detail:
        line += f" -> {detail}"
    print(line)
    results.append((group, name, ok, detail))


def signup(suffix):
    uname = f"mace_{suffix}_{uuid.uuid4().hex[:6]}"
    body = {
        "email": f"{uname}@example.com",
        "username": uname,
        "password": "Strong#Pass1",
    }
    r = requests.post(f"{BASE}/auth/signup", json=body, timeout=30)
    if r.status_code != 200:
        print("Signup failed:", r.status_code, r.text)
        sys.exit(1)
    data = r.json()
    return {"token": data["token"], "id": data["user"]["id"], "username": data["user"]["username"], "email": data["user"]["email"]}


def H(u):
    return {"Authorization": f"Bearer {u['token']}"}


def main():
    print("=" * 70)
    print("Creating two fresh accounts for cross-user tests...")
    A = signup("alpha")
    B = signup("bravo")
    C = signup("charlie")  # for clan promotion test
    print(f"User A: {A['username']} ({A['id']})")
    print(f"User B: {B['username']} ({B['id']})")
    print(f"User C: {C['username']} ({C['id']})")

    # ============================================================
    # 1) CLANS
    # ============================================================
    print("\n" + "=" * 70)
    print("CLANS TESTS")
    print("=" * 70)

    # Create clan as A
    tag_a = "M" + uuid.uuid4().hex[:3].upper()  # 4 chars, A-Z0-9
    clan_name = f"AlphaMace{uuid.uuid4().hex[:4]}"
    body = {"name": clan_name, "tag": tag_a, "description": "Elite mace players"}
    r = requests.post(f"{BASE}/clans", json=body, headers=H(A), timeout=30)
    if r.status_code == 200:
        clan = r.json()
        clan_id = clan["id"]
        ok = clan["leader_id"] == A["id"] and clan["member_count"] == 1
        log("CLANS", "POST /clans create + leader auto-assigned", ok,
            f"leader_id={clan['leader_id']}, members={clan['member_count']}, avg_elo={clan['avg_elo']}")
    else:
        log("CLANS", "POST /clans create", False, f"{r.status_code} {r.text}")
        return

    # Duplicate name
    r = requests.post(f"{BASE}/clans", json={"name": clan_name, "tag": "ZZ9", "description": ""}, headers=H(B), timeout=30)
    log("CLANS", "POST /clans duplicate name rejected", r.status_code == 400, f"status={r.status_code}, body={r.text[:120]}")

    # Duplicate tag
    r = requests.post(f"{BASE}/clans", json={"name": f"OtherClan{uuid.uuid4().hex[:4]}", "tag": tag_a, "description": ""}, headers=H(B), timeout=30)
    log("CLANS", "POST /clans duplicate tag rejected", r.status_code == 400, f"status={r.status_code}, body={r.text[:120]}")

    # User A already in clan -> can't create another
    r = requests.post(f"{BASE}/clans", json={"name": f"SecondClan{uuid.uuid4().hex[:4]}", "tag": "SC" + uuid.uuid4().hex[:2].upper(), "description": ""}, headers=H(A), timeout=30)
    log("CLANS", "POST /clans rejects if user already in clan", r.status_code == 400, f"status={r.status_code}, body={r.text[:120]}")

    # GET /clans (no auth)
    r = requests.get(f"{BASE}/clans", timeout=30)
    if r.status_code == 200:
        clans = r.json()
        found = next((c for c in clans if c["id"] == clan_id), None)
        ok = found is not None and "leader_name" in found and "member_count" in found and "avg_elo" in found
        log("CLANS", "GET /clans (no auth) lists clan with leader_name/member_count/avg_elo", ok,
            f"found={found is not None}, leader_name={(found or {}).get('leader_name')}, count={len(clans)}")
    else:
        log("CLANS", "GET /clans", False, f"{r.status_code} {r.text}")

    # GET /clans/mine (A)
    r = requests.get(f"{BASE}/clans/mine", headers=H(A), timeout=30)
    log("CLANS", "GET /clans/mine returns user's clan (A)", r.status_code == 200 and (r.json() or {}).get("id") == clan_id,
        f"status={r.status_code}, body={(r.text or '')[:120]}")

    # GET /clans/mine (B - none)
    r = requests.get(f"{BASE}/clans/mine", headers=H(B), timeout=30)
    log("CLANS", "GET /clans/mine returns null for non-member (B)", r.status_code == 200 and (r.json() is None),
        f"status={r.status_code}, body={r.text[:60]}")

    # GET /clans/{id}
    r = requests.get(f"{BASE}/clans/{clan_id}", timeout=30)
    if r.status_code == 200:
        data = r.json()
        ok = "clan" in data and "members" in data and len(data["members"]) >= 1
        m0 = data["members"][0]
        ok &= all(k in m0 for k in ("role", "elo", "kdr", "username"))
        log("CLANS", "GET /clans/{id} returns clan + members[role,elo,kdr]", ok,
            f"members={len(data['members'])}, sample={m0}")
    else:
        log("CLANS", "GET /clans/{id}", False, f"{r.status_code} {r.text}")

    # B joins
    r = requests.post(f"{BASE}/clans/{clan_id}/join", headers=H(B), timeout=30)
    log("CLANS", "POST /clans/{id}/join as B becomes member", r.status_code == 200, f"status={r.status_code} body={r.text[:120]}")

    # C joins (for promotion test)
    r = requests.post(f"{BASE}/clans/{clan_id}/join", headers=H(C), timeout=30)
    log("CLANS", "POST /clans/{id}/join as C becomes member", r.status_code == 200, f"status={r.status_code} body={r.text[:120]}")

    # B tries to join another clan -> need a second clan. Let's create one with another user is hard.
    # Instead: B tries to join same again -> should still be 400 (already in a clan)
    r = requests.post(f"{BASE}/clans/{clan_id}/join", headers=H(B), timeout=30)
    log("CLANS", "POST /clans/{id}/join rejects if already in a clan", r.status_code == 400,
        f"status={r.status_code} body={r.text[:120]}")

    # Confirm member roles via GET
    r = requests.get(f"{BASE}/clans/{clan_id}", timeout=30)
    data = r.json()
    b_member = next((m for m in data["members"] if m["user_id"] == B["id"]), None)
    log("CLANS", "Member B role=='member' after join", b_member and b_member["role"] == "member",
        f"role={(b_member or {}).get('role')}, total_members={len(data['members'])}")

    # B leaves
    r = requests.delete(f"{BASE}/clans/{clan_id}/leave", headers=H(B), timeout=30)
    log("CLANS", "DELETE /clans/{id}/leave member B", r.status_code == 200, f"status={r.status_code} body={r.text[:120]}")

    r = requests.get(f"{BASE}/clans/{clan_id}", timeout=30)
    data = r.json()
    has_b = any(m["user_id"] == B["id"] for m in data["members"])
    log("CLANS", "B no longer in member list after leave", not has_b, f"members_after={len(data['members'])}")

    # Leader A leaves -> C should be promoted to leader (C is still in)
    r = requests.delete(f"{BASE}/clans/{clan_id}/leave", headers=H(A), timeout=30)
    log("CLANS", "DELETE /clans/{id}/leave by leader A", r.status_code == 200, f"status={r.status_code} body={r.text[:120]}")

    r = requests.get(f"{BASE}/clans/{clan_id}", timeout=30)
    if r.status_code == 200:
        data = r.json()
        new_leader_ok = data["clan"]["leader_id"] == C["id"]
        c_member = next((m for m in data["members"] if m["user_id"] == C["id"]), None)
        role_ok = c_member and c_member["role"] == "leader"
        log("CLANS", "Leader promotion: C is new leader after A leaves", new_leader_ok and role_ok,
            f"leader_id={data['clan']['leader_id']} expected {C['id']}, c.role={(c_member or {}).get('role')}")
    else:
        log("CLANS", "Leader promotion lookup", False, f"{r.status_code} {r.text}")

    # C leaves -> clan disbanded
    r = requests.delete(f"{BASE}/clans/{clan_id}/leave", headers=H(C), timeout=30)
    disbanded_flag = False
    if r.status_code == 200:
        try:
            disbanded_flag = r.json().get("disbanded") is True
        except Exception:
            pass
    log("CLANS", "DELETE leave by last member returns disbanded=true", disbanded_flag, f"status={r.status_code} body={r.text[:120]}")

    r = requests.get(f"{BASE}/clans/{clan_id}", timeout=30)
    log("CLANS", "Clan record removed after disband (GET /clans/{id} 404)", r.status_code == 404,
        f"status={r.status_code}")

    # ============================================================
    # 2) CHALLENGES
    # ============================================================
    print("\n" + "=" * 70)
    print("CHALLENGES TESTS")
    print("=" * 70)

    # Unknown opponent
    r = requests.post(f"{BASE}/challenges",
                      json={"opponent_username": f"ghost_{uuid.uuid4().hex[:6]}", "mode": "Mace 1v1",
                            "server": "Hypixel", "message": "ggwp"},
                      headers=H(A), timeout=30)
    log("CHALLENGES", "POST /challenges unknown opponent -> 404", r.status_code == 404, f"status={r.status_code}")

    # Challenging self
    r = requests.post(f"{BASE}/challenges",
                      json={"opponent_username": A["username"], "mode": "Mace 1v1", "server": "Hypixel", "message": ""},
                      headers=H(A), timeout=30)
    log("CHALLENGES", "POST /challenges self -> 400", r.status_code == 400, f"status={r.status_code}")

    # Valid: A challenges B
    r = requests.post(f"{BASE}/challenges",
                      json={"opponent_username": B["username"], "mode": "Mace 1v1", "server": "MaceMC", "message": "1v1 me"},
                      headers=H(A), timeout=30)
    if r.status_code == 200:
        ch = r.json()
        ch_id = ch["id"]
        log("CHALLENGES", "POST /challenges A->B created", ch["status"] == "pending" and ch["opponent_id"] == B["id"],
            f"id={ch_id}, status={ch['status']}")
    else:
        log("CHALLENGES", "POST /challenges A->B", False, f"{r.status_code} {r.text}")
        return

    # Verify notification for B
    r = requests.get(f"{BASE}/notifications", headers=H(B), timeout=30)
    if r.status_code == 200:
        notifs = r.json()
        match = next((n for n in notifs if n.get("kind") == "challenge" and n.get("actor") == A["username"]), None)
        log("CHALLENGES", "B received 'challenge' notification", match is not None,
            f"count={len(notifs)}, match={bool(match)}")
    else:
        log("CHALLENGES", "GET /notifications for B", False, f"{r.status_code}")

    # Incoming for B
    r = requests.get(f"{BASE}/challenges?direction=incoming", headers=H(B), timeout=30)
    ok = r.status_code == 200 and any(c["id"] == ch_id for c in r.json())
    log("CHALLENGES", "GET /challenges?direction=incoming (B)", ok, f"count={len(r.json()) if r.status_code==200 else 'err'}")

    # Outgoing for A
    r = requests.get(f"{BASE}/challenges?direction=outgoing", headers=H(A), timeout=30)
    ok = r.status_code == 200 and any(c["id"] == ch_id for c in r.json())
    log("CHALLENGES", "GET /challenges?direction=outgoing (A)", ok, f"count={len(r.json()) if r.status_code==200 else 'err'}")

    # A tries to accept own challenge -> 403
    r = requests.post(f"{BASE}/challenges/{ch_id}/accept", headers=H(A), timeout=30)
    log("CHALLENGES", "Non-opponent accept rejected (A on own)", r.status_code == 403, f"status={r.status_code}")

    # B accepts
    r = requests.post(f"{BASE}/challenges/{ch_id}/accept", headers=H(B), timeout=30)
    log("CHALLENGES", "POST /challenges/{id}/accept by B -> accepted",
        r.status_code == 200 and r.json().get("status") == "accepted",
        f"status={r.status_code}, body_status={(r.json() if r.status_code==200 else {}).get('status')}")

    # Complete with invalid winner -> 400
    r = requests.post(f"{BASE}/challenges/{ch_id}/complete",
                      json={"winner_id": str(uuid.uuid4())}, headers=H(A), timeout=30)
    log("CHALLENGES", "POST /challenges/{id}/complete invalid winner -> 400", r.status_code == 400,
        f"status={r.status_code}, body={r.text[:120]}")

    # Complete with valid winner (B)
    r = requests.post(f"{BASE}/challenges/{ch_id}/complete",
                      json={"winner_id": B["id"]}, headers=H(A), timeout=30)
    if r.status_code == 200:
        data = r.json()
        ok = data.get("status") == "completed" and data.get("winner_id") == B["id"]
        log("CHALLENGES", "POST /challenges/{id}/complete valid winner -> completed", ok,
            f"status={data.get('status')}, winner_id={data.get('winner_id')}")
    else:
        log("CHALLENGES", "POST /challenges/{id}/complete valid winner", False, f"{r.status_code} {r.text}")

    # Test decline path -> create another and have B decline
    r = requests.post(f"{BASE}/challenges",
                      json={"opponent_username": B["username"], "mode": "Sumo", "server": "PvPLand", "message": "rematch"},
                      headers=H(A), timeout=30)
    if r.status_code == 200:
        ch2_id = r.json()["id"]
        # A tries to decline own (non-opponent) -> 403
        r2 = requests.post(f"{BASE}/challenges/{ch2_id}/decline", headers=H(A), timeout=30)
        log("CHALLENGES", "Non-opponent decline rejected", r2.status_code == 403, f"status={r2.status_code}")
        # B declines
        r2 = requests.post(f"{BASE}/challenges/{ch2_id}/decline", headers=H(B), timeout=30)
        log("CHALLENGES", "POST /challenges/{id}/decline by B -> declined",
            r2.status_code == 200 and r2.json().get("status") == "declined",
            f"status={r2.status_code}, body_status={(r2.json() if r2.status_code==200 else {}).get('status')}")
    else:
        log("CHALLENGES", "Create challenge for decline-flow", False, f"{r.status_code} {r.text}")

    # ============================================================
    # 3) FIND DUO
    # ============================================================
    print("\n" + "=" * 70)
    print("DUO TESTS")
    print("=" * 70)

    # First duo post by A
    body = {"mode": "Ranked Duos", "region": "NA", "skill": "gold", "message": "lf chill duo NA East"}
    r = requests.post(f"{BASE}/duo", json=body, headers=H(A), timeout=30)
    if r.status_code == 200:
        d1 = r.json()
        log("DUO", "POST /duo create (A)", d1["region"] == "NA" and d1["user_id"] == A["id"],
            f"id={d1['id']}, region={d1['region']}, elo={d1['elo']}")
    else:
        log("DUO", "POST /duo create", False, f"{r.status_code} {r.text}")
        return

    first_id = d1["id"]

    # Overwrite: second post by A
    body2 = {"mode": "Mace Box", "region": "EU", "skill": "diamond", "message": "switching to EU"}
    r = requests.post(f"{BASE}/duo", json=body2, headers=H(A), timeout=30)
    second_id = r.json()["id"] if r.status_code == 200 else None
    log("DUO", "POST /duo overwrites previous (A)", r.status_code == 200 and second_id != first_id,
        f"first={first_id}, second={second_id}")

    # B posts NA
    r = requests.post(f"{BASE}/duo",
                      json={"mode": "Ranked Duos", "region": "NA", "skill": "silver", "message": "B looking"},
                      headers=H(B), timeout=30)
    log("DUO", "POST /duo create (B, NA)", r.status_code == 200, f"status={r.status_code}")

    # GET /duo (no auth) — list all non-expired
    r = requests.get(f"{BASE}/duo", timeout=30)
    if r.status_code == 200:
        listing = r.json()
        # A's latest should be EU; B's NA should be there; first_id (A's old NA) should NOT
        a_post = next((p for p in listing if p["user_id"] == A["id"]), None)
        b_post = next((p for p in listing if p["user_id"] == B["id"]), None)
        no_old = not any(p["id"] == first_id for p in listing)
        ok = a_post and a_post["region"] == "EU" and b_post and b_post["region"] == "NA" and no_old
        log("DUO", "GET /duo lists current posts (no old/overwritten)", ok,
            f"a_region={(a_post or {}).get('region')}, b_region={(b_post or {}).get('region')}, no_old={no_old}")
    else:
        log("DUO", "GET /duo", False, f"{r.status_code} {r.text}")

    # GET /duo?region=NA
    r = requests.get(f"{BASE}/duo?region=NA", timeout=30)
    if r.status_code == 200:
        listing = r.json()
        all_na = all(p["region"] == "NA" for p in listing)
        has_b = any(p["user_id"] == B["id"] for p in listing)
        no_a = not any(p["user_id"] == A["id"] for p in listing)
        log("DUO", "GET /duo?region=NA filters correctly", all_na and has_b and no_a,
            f"count={len(listing)}, all_NA={all_na}, has_B={has_b}, A_excluded={no_a}")
    else:
        log("DUO", "GET /duo?region=NA", False, f"{r.status_code} {r.text}")

    # GET /duo/mine
    r = requests.get(f"{BASE}/duo/mine", headers=H(A), timeout=30)
    if r.status_code == 200:
        mine = r.json()
        log("DUO", "GET /duo/mine (A)", mine and mine.get("region") == "EU",
            f"region={(mine or {}).get('region')}")
    else:
        log("DUO", "GET /duo/mine (A)", False, f"{r.status_code} {r.text}")

    # DELETE /duo (A)
    r = requests.delete(f"{BASE}/duo", headers=H(A), timeout=30)
    log("DUO", "DELETE /duo (A)", r.status_code == 200, f"status={r.status_code}")

    r = requests.get(f"{BASE}/duo/mine", headers=H(A), timeout=30)
    log("DUO", "GET /duo/mine after delete returns null", r.status_code == 200 and r.json() is None,
        f"body={r.text[:60]}")

    # ============================================================
    # Summary
    # ============================================================
    print("\n" + "=" * 70)
    print("RESULTS SUMMARY")
    print("=" * 70)
    by_group = {}
    for g, n, ok, _ in results:
        by_group.setdefault(g, [0, 0])
        by_group[g][0 if ok else 1] += 1
    for g, (p, f) in by_group.items():
        print(f"{g}: {p} pass, {f} fail")
    fails = [r for r in results if not r[2]]
    if fails:
        print("\nFAILED:")
        for g, n, _, d in fails:
            print(f" - [{g}] {n} :: {d}")
    print("=" * 70)
    return len(fails) == 0


if __name__ == "__main__":
    ok = main()
    sys.exit(0 if ok else 1)
