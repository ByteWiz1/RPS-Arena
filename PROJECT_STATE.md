# RPS Arena — Project State

_Last updated: end of Chat 8_

## Overview

RPS Arena is a React Native + Expo web game (rock paper scissors) with
multiplayer and AI modes.

- **Server:** Node.js + Express + Socket.IO, deployed on Render
  - URL: https://rps-arena-server-2mxh.onrender.com
  - Repo: `C:\Users\lilel\rps-server`
  - Files: `server.js` (entry), `aiEngine.js` (adaptive AI port),
    `db.js` (Supabase helpers), `schema.sql` (Supabase schema)
- **Client:** React Native + Expo, exported to web via
  `npx expo export --platform web`
  - Repo: `C:\Users\lilel\RPS-Arena`
  - Deployed: Vercel (drag-drop of `dist/` folder)

---

## 🎯 STANDING RULE — ZERO BUILD COST, PREMIUM MONETIZATION

**Cost to build and run: $0.**
Every tool, service, and tier used during development and production
must be free. No paid infrastructure, subscriptions, or one-time fees.

**Revenue model: premium / monetized.**
The app has paid tiers, in-app purchases, and premium features.
Users pay for extras. The app earns income. All revenue is profit
(minus standard payment processing fees).

**Two rules in one:**
1. Do not spend money to build or run the app.
2. Do not be shy about charging users for premium features.

**Free stack (build + run):**
- Server: Render free tier
- Client: Vercel free
- Database: Supabase free tier
- Auth: Supabase Auth free / server-issued tokens
- Push: Expo Push + FCM + Web Push (VAPID) = free
- Monitoring: Sentry free tier
- Analytics: Umami free tier or self-hosted
- Payments: RevenueCat free under $2.5K/month, Stripe takes 2.9% + $0.30
  per successful transaction only

**Optional (skip unless revenue justifies):**
- Google Play: $25 one-time (skip — use APK download)
- Apple Developer: $99/year (skip — use PWA)

**Premium model — subscription only, no ads:**

| Tier | Price | Monthly equiv. | Savings |
|---|---|---|---|
| Monthly | $2.99 | $2.99/mo | — |
| 3-month | $7.99 | $2.66/mo | 11% off |
| 6-month | $13.99 | $2.33/mo | 22% off |
| Annual | $24.99 | $2.08/mo | 30% off |

**Minimum anchor: $2.99/month.** Never goes below this on any tier.

**No ads. No consumable currency.** One subscription unlocks all
premium content. Free users play the full game.

**Premium unlocks (all bonus, none core):**
- Unlimited AI training slots (free = 1)
- Advanced AI personalities
- Cosmetic skins
- Early access to new features
- Supporter badge next to username

**Payment infra (all free until revenue):**
- RevenueCat — free under $2.5K/mo revenue
- Stripe — 2.9% + $0.30 per successful transaction
- Web-only for now → no Apple/Google cut

**Revenue reality (rough):**
- 1K MAU × 3% conv → ~$240/yr
- 10K MAU × 4% conv → ~$3K/yr
- 50K MAU × 5% conv → ~$19K/yr

---

## 🗺️ FULL BUILD ROADMAP — BREADTH PASS

Build every feature to **"working"** state first, then debug with real
testers. Never spend more than 2 chats per feature in this pass.

| # | Item | Status |
|---|---|---|
| 1 | Real database (Supabase) | ✅ Working |
| 2 | Dojo stats sync to server | ✅ Working |
| 3 | Notification center (in-app) | ✅ Working |
| 4 | Achievements (25-item catalog) | ⚠️ Shipped, notification wiring broken |
| 5 | PWA + Web Push | ❌ Not started |
| 6 | Home stats card + History detail | ⚠️ Shipped, live updates broken |
| 7 | Cross-device login + PIN recovery | ❌ Not started |
| 8 | AI Training UI | ❌ Not started |
| 9 | Monetization (RevenueCat + subscription tiers) | ❌ Not started |
| 10 | Native Android build ($0 via APK download) | ❌ Not started |
| 11 | Public website / download page | ❌ Not started |
| 12 | Native iOS build | 🚫 Blocked ($99/yr, skip until revenue) |
| 13 | Security hardening (rate limits, Sentry) | ❌ Not started |
| 14 | Polish pass (sounds, animations, onboarding) | ❌ Not started |

**After breadth pass → debug pass → iterate.**

---

## 🐛 KNOWN ISSUES (breadth pass log)

Bugs we've identified but are **not fixing yet** — they get logged here
and addressed in the debug pass.

| # | Issue | Severity | Notes |
|---|---|---|---|
| 1 | Post-match invite sometimes fails silently | Medium | Works fresh, fails after 1+ matches. Toast shows but overlay doesn't pop. |
| 2 | userId-based identity matching deferred | Low | Client matches by username in some events. Should use userId. |
| 3 | `inviteAccepted` side detection relies on `identity.username` vs `data.opponentName` | Low | Fix by comparing `opponentId` to `identity.userId` instead. Ties into issue #2. |
| 4 | Notification `action` deep-links unused | Low | Typed as `{ screen: string; params?: any }`. No notifications set it yet. Present for future use. |
| 5 | `roomReady` has two listeners in `App.tsx` | Low | One navigates, one notifies. Intentional and non-conflicting. Dedupe via `handledRoomRef` + `notifiedRoomsRef`. |
| 6 | Notifications are not scoped per-account | Low | `@rps_notifications` key is global to the device, not keyed by `userId`. Namespace by `userId` in debug pass. |
| 7 | Achievement notifications not firing | Medium | Achievements unlock server-side but client notification + bell badge don't update. |
| 8 | Achievements UI may not reflect unlocks | Medium | AchievementsScreen may show stale locked state after unlock. |
| 9 | Home stats card — live updates unreliable | Medium | Card renders but doesn't always reflect live stat changes. |
| 10 | Match detail modal — data may be stale | Medium | Tapping a history row opens the modal but data may be stale or layout imperfect. |

---

## 📜 RECENT CHATS

| Chat | Scope | Files touched |
|---|---|---|
| Chat 1 | Auth tokens | `server.js`, `identity.ts`, `multiplayer.ts`, `App.tsx`, `SettingsScreen.tsx` |
| Chat 2 | Adaptive AI port + per-mode stats + leaderboard | `aiEngine.js` (new), `server.js`, `multiplayer.ts`, `OnlineLobbyScreen.tsx`, `GlobalInviteOverlay.tsx` |
| Chat 3 | Profile tabs (Stats/History/Avatars/Leaderboard) | `ProfileScreen.tsx`, `SettingsScreen.tsx`, new components |
| Chat 4 | Supabase migration (roadmap #1) | `server.js`, `db.js` (new), `schema.sql` (new), `.env.example` (new) |
| Chat 5 | Dojo stats sync (roadmap #2) | `server.js`, `db.js`, client sync hooks |
| Chat 6 | Notification center (roadmap #3) | `notificationStore.ts` (new), `NotificationsScreen.tsx` (new), `NotificationBell.tsx` (new), `HomeScreen.tsx`, `AppNavigator.tsx`, `App.tsx` |
| Chat 7 | Achievements — 25-item catalog (roadmap #4) | `schema.sql`, `db.js`, `server.js`, `achievementStore.ts`, `AchievementsScreen.tsx`, `ProfileScreen.tsx`, `AppNavigator.tsx`, `multiplayer.ts`, `App.tsx` — ⚠️ shipped, notification wiring wrong |
| Chat 8 | Home stats card + Match history detail (roadmap #6) | `HomeStatsCard.tsx` (new), `MatchDetailModal.tsx` (new), `HomeScreen.tsx`, `ProfileScreen.tsx` — ⚠️ shipped, live updates broken |

---

## Architecture

### Server (`rps-server/`)

Four files:

- **`server.js`** — Express + Socket.IO, all game logic, ephemeral state.
- **`aiEngine.js`** — dependency-free Node port of the client's
  `src/engine/AIEngine.ts` `AdaptiveAI`, plus a `createAdaptiveAI(name,
  personalityInput)` factory and a `normalizePersonality` shim.
- **`db.js`** — Supabase client + helpers (users, tokens, stats, match
  history, achievements).
- **`schema.sql`** — Supabase schema (run once in SQL editor).

### Ephemeral state (in-memory, wiped on restart — intentional)

| Map | Key | Purpose |
|---|---|---|
| `rooms` | roomCode | Active matches |
| `players` | socketId | Live socket → identity |
| `onlinePlayers` | socketId | Presence + status |
| `activeInvites` | inviteId | Pending invites (5 min TTL) |
| `recentOpponents` | socketId | Recently played with (max 5) |

### Persistent state (Supabase — survives restart)

- `users` — userId, username, avatar, createdAt, updatedAt
- `auth_tokens` — token, userId, createdAt, lastUsedAt
- `player_stats` — userId, wins, losses, ties, total, per-mode stats,
  currentStreak, bestStreak, achievements meta columns
- `match_history` — id, userId, mode, opponent, opponentId, result,
  myScore, theirScore, rounds, timestamp
- `achievements` — userId, achievementId, unlockedAt

---

## Auth (Tier 1) — built in Chat 1

Server-issued tokens, client stores `{ userId, token }` in localStorage
under `@rps_identity`.

**Flow:**
1. Client connects → emits `registerIdentity` with `{ token, username,
   avatar }` (or `token: null` for fresh).
2. Server either restores the account (valid token) or issues a fresh
   `userId` + `token`.
3. Server responds with `identityRegistered { userId, token, username,
   avatar }`.
4. Duplicate sessions: if a second socket registers with the same `userId`,
   the older socket gets `sessionReplaced` and is force-disconnected.

**Preserved constants / rules:**
- Username normalization: lowercase, `[^a-z0-9_]` stripped, 3-15 chars.
- Uniqueness enforced against **both** live players and stored accounts.
- `changeUsername` and `deleteAccount` both authenticate via token, not
  socketId.
- Do NOT modify the auth system without a dedicated chat — it was just
  built and stabilized.

---

## Player status system

Single source of truth: `setPlayerStatus(socketId, status)` on the server.
Statuses:

- `online` — default; connected, not in a match.
- `in-match` — client has mounted the match screen.

**Client-driven:**
- Client emits `enterMatchScreen` when OnlineGame mounts → status becomes
  `in-match`.
- Client emits `leaveMatchScreen` when it unmounts → status becomes
  `online`.
- The server does **not** flip status on room creation, invite accept,
  match end, or player join. Only reacts to those two events, plus bulk
  resets when a room empties (`resetPlayersToOnline`).

---

## Battle modes

- **`human`** — Human vs Human. Both players send `makeMove`; server
  resolves when both have moved. Results persist to Supabase.
- **`avatar`** — Avatar Arena. Server auto-plays both sides with adaptive
  AI. Clients only watch. Results persist.
- **`dojo`** — AI Dojo. Client plays vs `AdaptiveAI` locally.
  **Chat 5 fix:** results now sync to the server via `recordDojoMatch`,
  incrementing `dojoWins/Losses/Ties` and adding history entries.

---

## Avatar Arena — adaptive AI (Chat 2)

### Client side

- Avatars live in `useAvatarStore` (Zustand + AsyncStorage).
- `Avatar.personality` is an object: `{ aggression, memory, randomness,
  defense }`, each 0..1. Default `{ 0.5, 0.5, 0.5, 0.5 }`.
- When the client emits `createRoom` / `sendInvite` / `joinRoom` /
  `respondToInvite` (accept only), it includes
  `avatarPersonality: getSelectedAvatar()?.personality ?? 'adaptive'`.

### Server side

- `rps-server/aiEngine.js` exports:
  - `AdaptiveAI` class
  - `createAdaptiveAI(name, personalityInput)`
  - `normalizePersonality(input)` — accepts object, string tag, or
    undefined → `'adaptive'`
  - `PERSONALITY_PRESETS`
- A room in `avatar` mode has `room.aiState = { [p1SocketId]: AdaptiveAI,
  [p2SocketId]: AdaptiveAI }`, created by `ensureAvatarAI(room)`.
- `ensureAvatarAI` is called from `respondToInvite`, `joinRoom`,
  `playAgain`, and `startAvatarAutoPlay`.
- `clearAvatarAI` is called from `playAgain`, `handleLeave`, and both
  branches of `handleDisconnect`.
- Round cadence: `AVATAR_ROUND_DELAY = 2000` ms between rounds.

### Important caveat

Client's `AIEngine.ts` has no `patterns` map or `learnPatterns()` method.
Pattern learning lives inline in `predictByPattern()` (bigram scan over
the last `depth` moves) and `predictByFrequency()` (most-common move over
a window). Server port preserves actual behavior.

---

## Stats schema (Chat 2)

`playerStats` per userId:

```js
{
  // overall
  wins: 0,
  losses: 0,
  ties: 0,
  total: 0,

  // per-mode
  humanWins: 0,   humanLosses: 0,   humanTies: 0,
  avatarWins: 0,  avatarLosses: 0,  avatarTies: 0,
  dojoWins: 0,    dojoLosses: 0,    dojoTies: 0,

  // streaks (overall, across all modes)
  currentStreak: 0,
  bestStreak: 0,
}