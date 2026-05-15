# Mace Forge — Minecraft Mace PvP Hub

## Overview
All-in-one mobile app (Expo / React Native) for Minecraft Mace PvP players.

## Features
- **Home dashboard**: Battle log (kills/deaths/K-D ratio/streak), quick tiles to all sections, daily tip.
- **Guide** (4 tabs): Mace Mechanics, Enchantments (Density/Breach/Wind Burst/Smite/etc.), PvP Tips & Combos, Tier List (S–D weapons & armor).
- **Loadout Forge**: Build planner — pick enchantments + armor + notes, persist multiple loadouts per device.
- **Community Forum**: Create posts, like (flame), thread view with comments.
- **AI Coach (MaceCoach)**: Multi-turn chat with Claude Sonnet 4.5 via Emergent LLM Key, persistent session per device, suggestions for new users.

## Tech Stack
- **Frontend**: Expo Router (file-based tabs), React Native, StyleSheet, @expo/vector-icons, AsyncStorage via `@/src/utils/storage`.
- **Backend**: FastAPI + Motor (MongoDB), `emergentintegrations.llm.chat.LlmChat` with `anthropic/claude-sonnet-4-5-20250929`.
- **Visual**: Minecraft pixel-blocky theme — stone/dirt textures, monospace caps headings, hard 4px borders, gold/diamond/emerald/redstone palette.

## Storage
- `forum_posts`, `forum_comments`, `loadouts`, `stat_events`, `chat_messages` collections in MongoDB.
- Per-user data scoped by anonymous `device_id` stored in AsyncStorage (no auth required).

## Endpoints (all prefixed `/api`)
- `POST /chat`, `GET /chat/{session_id}`
- `GET/POST /forum/posts`, `POST /forum/posts/{id}/like`, `GET/POST /forum/posts/{id}/comments`
- `GET/POST /loadouts`, `DELETE /loadouts/{id}`
- `GET /stats`, `POST /stats/log`, `POST /stats/reset`

## Smart Business Enhancement
The AI Coach drives engagement & retention — players come back daily for personalized strats. Future: paywall premium coach analyses (build optimizer, video review tips).
