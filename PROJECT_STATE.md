# RPS Arena — Project State

_Last updated: after Chat 12 + Netlify migration + tournament bug reports_

## Overview

RPS Arena is a React Native + Expo web game (rock paper scissors) with
multiplayer, AI modes, and tournament mode.

- **Server:** Node.js + Express + Socket.IO, deployed on Render
  - URL: https://rps-arena-server-2mxh.onrender.com
  - Repo: `C:\Users\lilel\rps-server`
  - Files: `server.js` (entry), `aiEngine.js` (adaptive AI port),
    `db.js` (Supabase helpers), `schema.sql` (Supabase schema)
- **Client:** React Native + Expo, exported to web via
  `npx expo export --platform web`
  - Repo: `C:\Users\lilel\RPS-Arena`
  - Deployed: **Netlify** (auto-deploy from GitHub `main` branch)
  - URL: https://rps-arena-g.netlify.app
  - Build command: `npx expo export --platform web`
  - Publish dir: `dist`
  - Config: `netlify.toml` in repo root
  - Env vars: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - Migrated from Vercel (Hobby plan is non-commercial only)
  - Android APK: not built yet (roadmap #10)

---

## 🎯 STANDING RULE — ZERO BUILD COST, PREMIUM MONETIZATION

**Cost to build and run: $0.**
Every tool, service, and tier must be free.

**Revenue model: premium / monetized.**
Users pay for extras. All revenue is profit (minus payment processing).

**Two rules in one:**
1. Do not spend money to build or run the app.
2. Do not be shy about charging users for premium features.

**Free stack:**
- Server: Render free tier
- Client: Netlify free (auto-deploy)
- Database: Supabase free tier
- Auth: Supabase Auth free tier
- Push: Expo Push + FCM + Web Push = free
- Monitoring: Sentry free tier
- Payments: RevenueCat free under $2.5K/mo, Stripe 2.9% + $0.30/txn

**Optional (skip):**
- Google Play: $25 one-time
- Apple Developer: $99/year

**Premium model — subscription only, no ads:**

| Tier | Price | Monthly equiv. | Savings |
|---|---|---|---|
| Monthly | $2.99 | $2.99/mo | — |
| 3-month | $7.99 | $2.66/mo | 11% off |
| 6-month | $13.99 | $2.33/mo | 22% off |
| Annual | $24.99 | $2.08/mo | 30% off |

**Minimum anchor: $2.99/month.**

**No ads. No consumable currency.** One subscription unlocks all
premium content. Free users play the full game.

**Premium unlocks (bonus, not core):**
- Unlimited AI training slots (free = 1)
- Advanced AI personalities
- Cosmetic skins
- Early access to new features
- Supporter badge next to username

**Revenue reality (rough):**
- 1K MAU × 3% conv → ~$240/yr
- 10K MAU × 4% conv → ~$3K/yr
- 50K MAU × 5% conv → ~$19K/yr

**Alternative revenue paths (deferred):**
- Poki / CrazyGames ad revenue share
- Ku-di / Jiwe IO (Ghana-friendly)
- Grey / Raenest for USD receiving

---

## 🗺️ FULL BUILD ROADMAP

| # | Item | Status |
|---|---|---|
| 1 | Real database (Supabase) | ✅ Working |
| 2 | Dojo stats sync to server | ✅ Working |
| 3 | Notification center (in-app) | ✅ Working |
| 4 | Achievements (25-item catalog) | ✅ Working |
| 5 | PWA + Web Push | 🟡 Priority #5 |
| 6 | Home stats card + History detail | ✅ Working |
| 7 | Cross-device login | ✅ Superseded by Chat 9 |
| 8 | AI Training UI | ✅ Working |
| 9 | Monetization | 🟡 Priority #3 |
| 10 | Native Android build (APK) | ❌ Priority #6 |
| 11 | Public website / download page | ❌ Priority #4 |
| 12 | Native iOS build | 🚫 Blocked ($99/yr) |
| 13 | Tournament Mode | ⚠️ Critical bugs (T1–T5) |
| 14 | Security hardening | ❌ Priority #2 |
| 15 | Polish pass + fix minor bugs | 🚧 **Priority #1** |
| 16 | is_guest flips to false before email is confirmed | Medium | Users who sign up but never confirm end up with locked accounts (is_guest = false, email unconfirmed, can never log in). Fix: set is_guest = false only after email_confirmed_at is set, verified at identify time. |

**Priority order:**
1. Polish pass + fix all minor bugs (including tournament)
2. Security hardening
3. Monetization
4. Public website + download page
5. PWA + Web Push
6. Native Android build (APK)

---

## 🐛 KNOWN ISSUES

### 🔴 CRITICAL — Tournament bugs (blocking launch)

| # | Issue | Severity | Notes |
|---|---|---|---|
| T1 | Champion declared before final round plays | CRITICAL | 3-player test: R1 plays, BYE player never plays. "Opponent left the match" shown. Must work for all N (2–32), both modes. |
| T2 | BYE player doesn't see live scores | HIGH | Scoreboard strip doesn't update for BYE/waiting players. |
| T3 | Champion "View Bracket" loops back | HIGH | Navigation loop; celebration sound replays on every mount. |
| T4 | Human vs Human tournament untested | HIGH | Only avatar mode tested. Both must share checkRoundComplete. |
| T5 | BYE player has no UX feedback | MEDIUM | Add "🎉 You advanced to the next round" banner + BYE badge. |

### 🔴 Confirmed broken (non-tournament)

| # | Issue | Severity | Notes |
|---|---|---|---|
| 1 | Post-match invite fails | HIGH | Overlay doesn't appear, spinner spins forever. Works fresh; fails after 1+ matches. |
| 14 | Custom avatar images not synced | Medium | Client keeps locally; server has no imageUrl. |
| 15 | `users.username` and `profiles.username` drift | Medium | Sync happens on change + identify; legacy rows may drift. |

### 🟡 Untested

| # | Issue | Severity | Notes |
|---|---|---|---|
| 24 | Live tournaments in-memory only | Medium | Server restart loses state. Test and decide. |

### ✅ Fixed

| # | Issue |
|---|---|
| 6 | Notifications scoped per-account |
| 7 | Achievement notifications firing |
| 8 | Achievements UI reflecting unlocks |
| 9 | Home stats card live updates |
| 10 | Match detail modal freshness |
| 11 | Dojo updating avatar W/L/T |
| 13 | UsernameScreen removed |
| 18 | Live scoreboard multi-device |
| 19 | Active countdown (window removed) |
| 20 | "0 left" bug (window removed) |
| 21 | "First to 30" bug |
| 22 | Match return to bracket |
| 23 | Seeded players disconnect |
| 25 | `_lookupUsernameSync` |

### ⚪ Skipped (low priority)

| # | Issue |
|---|---|
| 2, 3 | userId-based identity matching |
| 4 | Notification deep-links unused |
| 5 | `roomReady` two listeners (intentional) |
| 12 | `attachServerListener` on reconnect |
| 16 | `is_premium` server-side only |
| 26, 27 | Native deep links |
| 28–40 | Verbose logs, dead code, edge cases |

---

## 📜 RECENT CHATS

| Chat | Scope |
|---|---|
| Chat 1 | Auth tokens |
| Chat 2 | Adaptive AI port + stats + leaderboard |
| Chat 3 | Profile tabs |
| Chat 4 | Supabase migration |
| Chat 5 | Dojo stats sync |
| Chat 6 | Notification center |
| Chat 7 | Achievements (25-item) |
| Chat 8 | Home stats card + History detail |
| Chat 9 | Supabase Auth migration |
| Chat 9b | Server-side avatars + 3 bugs |
| Chat 9c | ES256-only JWT |
| Chat 9d | Avatar UUID + auto-create + username |
| Chat 10 | AI Training UI |
| Chat 11 | Tournament Mode |
| Chat 12 | Onboarding revert + username propagation + email auto-login |
| Netlify | Client migrated Vercel → Netlify |
| Chat 12d | **Tournament bug fixes — IN PROGRESS** |

---

## Architecture

### Server (`rps-server/`)

- **`server.js`** — Express + Socket.IO, all game logic, tournament
  engine. JWT via Supabase JWKS (ES256, `jose`).
- **`aiEngine.js`** — Adaptive AI port.
- **`db.js`** — Supabase helpers.
- **`schema.sql`** — Supabase schema (idempotent).

### Ephemeral state (in-memory)

| Map | Purpose |
|---|---|
| `rooms` | Active matches |
| `players` | Live socket → identity |
| `onlinePlayers` | Presence + status |
| `activeInvites` | Pending invites (5 min TTL) |
| `recentOpponents` | Recently played (max 5) |
| `tournaments` | Tournament state |
| `tournamentCodes` | Code → id index |

### Persistent state (Supabase)

- `users`, `auth_tokens` (legacy), `profiles`, `player_stats`,
  `match_history`, `achievements`, `avatars`, `tournaments`,
  `tournament_rounds`, `migration_log`

---

## Auth — Supabase Auth

**Flow:**
- Fresh open → auto-guest session → Home
- Guest banner on Home
- Sign In / Sign Up from banner or Settings
- Sign up → confirmation email → auto-login via `onAuthStateChange`
- Same UID throughout (guest → member)
- Same `profiles` row updated in place

**Guest name:** `Guest_XXXX`

**Email confirmation:** handled via `onAuthStateChange` at boot

**Server env vars (Render):**
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`

**Client env vars (Netlify + local `.env`):**
- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`

---

## Registration boundary

**Gated (guest → Login):** all online + tournament routes
**Ungated (guest allowed):** Home, offline modes, Profile, Settings,
Leaderboard, Achievements (with placeholders)

---

## Battle modes

- **`human`** — Both send `makeMove`
- **`avatar`** — Server auto-plays with adaptive AI
- **`dojo`** — Client vs `AdaptiveAI` locally
- **`training`** — Training Lab
- **`tournament`** — Sub-mode of human or avatar

---

## Tournament Mode — CURRENTLY BROKEN (see T1–T5)

**Flow:** up to 32 players, single-elimination bracket.

- Host configures (type, maxPlayers 2–32, winTarget 15–30,
  autoAdvance, name, isPrivate) → 6-char code
- Players join by code or link (lobby only)
- Host starts → colors assigned → round 1 begins
- Each round: random re-pairing, odd → BYE
- Match resolution → `checkRoundComplete`
- Last standing → `finishTournament`

**⚠️ Known bugs (T1–T5):**
- Champion declared before final round
- BYE player can't see live scores
- Champion "View Bracket" loops
- Human mode untested
- No BYE UX feedback

**Rewards:**
- Champion: +50 rating, +500 XP, title
- Runner-up: +25 rating, +250 XP
- Semifinalists: +10 rating, +100 XP
- All: +50 XP

---

## Avatar Arena — adaptive AI

- `aiEngine.js`: `AdaptiveAI`, `createAdaptiveAI`, `normalizePersonality`,
  `PERSONALITY_PRESETS`
- Avatar rooms: `room.aiState = { [p1]: AdaptiveAI, [p2]: AdaptiveAI }`
- `AVATAR_ROUND_DELAY = 2000` ms

---

## AI Training Lab

- `TrainingScreen.tsx`, `TrainingMatchScreen.tsx`,
  `TrainingResultScreen.tsx`, `PersonalityChart.tsx`
- Personality shifts based on match outcome + user move diversity
- Clamped to [0.05, 0.95]
- Persists to `avatars.personality`

---

## Avatars

**Server-authoritative. Client caches.**

**Events:** `getAvatars`, `createAvatar`, `updateAvatar`,
`deleteAvatar`, `selectAvatar`, `updateAvatarPersonality`

**Shape:** id, userId, name, emoji, personality, rating, level, xp,
wins, losses, ties, winStreak, bestStreak, titles[], defeatedMasters[],
isSelected, imageUrl, createdAt, updatedAt