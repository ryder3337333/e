# Mace Forge — Minecraft Mace PvP Hub

## Overview
All-in-one mobile app (Expo Router / React Native) for Minecraft Mace PvP players. Authenticated experience — every user has a unique email + username + password.

## Features
- **Email Authentication (JWT, bcrypt)** — signup, login, logout, 30-day token expiry, brute-force lockout (5 attempts / 15 min), unique-username enforcement (case-insensitive).
- **Home Dashboard**: Welcome by username, battle log (kills/deaths/K-D/streak with +KILL/+DEATH actions + reset), 6 quick-access tiles, daily tip, notification bell with unread badge, logout.
- **Guide** (4 tabs): Mace Mechanics, Enchantments, PvP Tips, Tier List.
- **Loadout Forge**: Per-user persistent build planner (7 enchant chips + 6 armor chips + notes).
- **DPS Calculator**: Mojang 1.21 smash-damage formula (fall blocks, Density, Breach, Strength, target armor) → raw + post-armor damage in hearts.
- **Weekly Leaderboard**: Aggregated K/D from last 7 days, top 50, current user highlighted.
- **Community Forum**: Posts with optional image OR video URL attachment, likes (flame), threaded comments. Commenting on another user's post creates an in-app notification.
- **In-App Notifications Inbox**: Reply notifications with unread count badge on Home (true Expo push deferred to dev-build release; push-token field reserved in profiles).
- **AI Coach (MaceCoach)**: Multi-turn Claude Sonnet 4.5 chat via Emergent LLM Key, history persisted per-user.

## Tech Stack
- **Frontend**: Expo Router (file-based, `(tabs)` group + standalone screens), React Native, StyleSheet, `@expo/vector-icons`, `@/src/utils/storage` for token persistence, custom `api()` fetch helper that auto-attaches `Authorization: Bearer <token>`.
- **Backend**: FastAPI + Motor (MongoDB), `passlib[bcrypt]`, `python-jose`, `emergentintegrations.llm.chat.LlmChat` with `anthropic/claude-sonnet-4-5-20250929`.
- **Visual**: Minecraft pixel-blocky theme — stone/dirt textures, monospace caps headings, 4-px borders, gold/diamond/emerald/redstone palette, custom enchanted-mace asset with transparent background.

## Auth Endpoints
- `POST /api/auth/signup` → {token, user}
- `POST /api/auth/login` → {token, user}
- `GET /api/auth/me` → user (Bearer required)

## Protected User-scoped Endpoints (Bearer required)
- Forum: `POST /api/forum/posts`, `POST /api/forum/posts/{id}/like`, `POST /api/forum/posts/{id}/comments`
- Loadouts: `GET/POST /api/loadouts`, `DELETE /api/loadouts/{id}`
- Stats: `GET /api/stats`, `POST /api/stats/log`, `POST /api/stats/reset`
- Chat: `POST /api/chat`, `GET /api/chat/{session_id}`
- Notifications: `GET /api/notifications`, `POST /api/notifications/read`, `GET /api/notifications/unread-count`

## Public Endpoints
- `GET /api/forum/posts`, `GET /api/forum/posts/{id}/comments`, `GET /api/leaderboard/weekly`

## Smart Business Enhancement
The AI Coach + per-user analytics drive daily retention. Future paywall: premium AI replay analysis (upload clip → coach grades positioning, combos, timing).
