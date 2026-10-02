# RPS Arena — Project State

_Last updated: end of Chat 11 + Known Issues triage_

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
  - Deployed: Vercel (manual drag-drop of `dist/` folder — repo NOT
    connected to Vercel; deliberate, avoids Hobby plan's commercial-
    use clause)
  - Android APK: not built yet (roadmap #10)

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
- Client: Vercel free (manual drag-drop)
- Database: Supabase free tier
- Auth: Supabase Auth free tier (anonymous + email/password)
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

**Alternative revenue paths (deferred):**
- Poki / CrazyGames ad revenue share (needs traffic)
- Ku-di / Jiwe IO (Ghana-friendly donations)
- Grey / Raenest for USD receiving account (works in Ghana)

**Vercel plan note:** Hobby plan is non-commercial only. Manual
drag-drop deployment is used to keep RPS Arena off the connected-repo
auto-deploy path while testing. If the app monetizes, either upgrade
Vercel to Pro ($20/mo) or switch the client to Netlify (free plan
explicitly allows commercial use).

---

## 🗺️ FULL BUILD ROADMAP — BREADTH PASS

Build every feature to **"working"** state first, then debug with real
testers. Never spend more than 2 chats per feature in this pass.

| # | Item | Status |
|---|---|---|
| 1 | Real database (Supabase) | ✅ Working |
| 2 | Dojo stats sync to server | ✅ Working |
| 3 | Notification center (in-app) | ✅ Working |
| 4 | Achievements (25-item catalog) | ✅ Working |
| 5 | PWA + Web Push | 🟡 Deferred (priority #5) |
| 6 | Home stats card + History detail | ✅ Working |
| 7 | Cross-device login + PIN recovery | ✅ Superseded by Chat 9 |
| 8 | AI Training UI | ✅ Working |
| 9 | Monetization | 🟡 In discussion (priority #3) |
| 10 | Native Android build ($0 via APK download) | ❌ Priority #6 |
| 11 | Public website / download page | ❌ Priority #4 |
| 12 | Native iOS build | 🚫 Blocked ($99/yr) |
| 13 | Tournament Mode | ✅ Working (needs bug fixes — see below) |
| 14 | Security hardening | ❌ Priority #2 |
| 15 | Polish pass + fix minor bugs | 🚧 **Priority #1 — in progress** |

**After breadth pass → debug pass → iterate.**

**Priority order (current):**
1. Polish pass + fix all minor bugs
2. Security hardening
3. Monetization
4. Public website + download page
5. PWA + Web Push
6. Native Android build (APK)

---

## 🐛 KNOWN ISSUES (breadth pass log)

Bugs identified but not yet fixed — logged here for the debug pass.

### 🔴 Confirmed broken (Chat 12a targets)

| # | Issue | Severity | Notes |
|---|---|---|---|
| 1 | Post-match invite fails — overlay doesn't appear, spinner spins forever | HIGH | Confirmed still broken. Works fresh; fails after 1+ matches. No error toast. |
| 14 | Custom avatar images not synced | Medium | Confirmed still broken. Client keeps custom image locally; server stores emoji + null imageUrl. `avatars.image_url` exists but unused. |
| 15 | `public.users.username` and `profiles.username` can drift | Medium | Confirmed still broken. Sync happens on change + on identify, but legacy rows may drift. |

### 🟡 Untested (this chat will test)

| # | Issue | Severity | Notes |
|---|---|---|---|
| 24 | Live tournaments in-memory only | Medium | Server restart mid-tournament loses live state. Lobby tournaments rehydrate from Supabase on demand. Test and decide on fix. |
| 35 | Human vs Human tournament untested end-to-end | Medium | All tests have been avatar-vs-avatar. Flow is mode-agnostic — should work. Test end-to-end. |

### ✅ Fixed (verified)

| # | Issue | Notes |
|---|---|---|
| 6 | Notifications scoped per-account | Fixed |
| 7 | Achievement notifications not firing | Fixed in Chat 9 follow-up |
| 8 | Achievements UI may not reflect unlocks | Fixed in Chat 9 follow-up |
| 9 | Home stats card — live updates unreliable | Fixed |
| 10 | Match detail modal — data may be stale | Fixed |
| 11 | Dojo match results don't update avatar W/L/T | Fixed |
| 13 | `UsernameScreen.tsx` unreachable | Probably fixed — verify dead code removed |
| 18 | Live scoreboard shows on only one device | Fixed in Chat 11 |
| 19 | Active countdown static / never ticks | Fixed (window removed) |
| 20 | "0 left" blacks out everyone | Fixed (window removed) |
| 21 | "First to 30" instead of configured N | Fixed in Chat 11 |
| 22 | Match doesn't return to bracket after "You Win" | Fixed in Chat 11 |
| 23 | Seeded players disconnected automatically | Fixed in Chat 11 |
| 25 | `_lookupUsernameSync` only resolves online users | Fixed |

### ⚪ Skipped (low priority / cosmetic)

| # | Issue | Notes |
|---|---|---|
| 2 | userId-based identity matching deferred | Cosmetic — no visible bug |
| 3 | `inviteAccepted` side detection uses username | Same root as #2 |
| 4 | Notification `action` deep-links unused | No notifications set it |
| 5 | `roomReady` has two listeners in `App.tsx` | Intentional |
| 12 | `attachServerListener` dies on socket reconnect | Low priority — rare |
| 16 | `profiles.is_premium` enforcement is server-side only | Relevant when monetization ships |
| 26 | App Links for APK not implemented | Relevant when APK ships |
| 27 | iOS Universal Links not implemented | Blocked by $99/yr |
| 28 | `[TOURNAMENT]` logs are verbose | Cosmetic |
| 29 | `activeWindowUpdate` removed but code kept | Safe dead code |
| 30 | `matchCancelled` still emitted | Functional — leave |
| 31 | `identify` loops all tournaments on every connection | Negligible at scale |
| 32 | Tournament chat not persisted | Low priority |
| 33 | `generateTournamentCode` collision fallback | Handled — no action |
| 34 | Tournament `winnerId: null` shows "No champion" | Intentional graceful handling |
| 36 | No "force advance" for stalled matches | Rare |
| 37 | Celebration music cut off if user taps Leave | Expected behavior |
| 38 | `ScreenScroll` header height drift | Design — leave |
| 39 | Reconnect safety net for `TournamentMatchScreen` | Rare |
| 40 | `usernames` map may lag on host promotion | Rare |

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
| Chat 7 | Achievements — 25-item catalog (roadmap #4) | `schema.sql`, `db.js`, `server.js`, `achievementStore.ts`, `AchievementsScreen.tsx`, `ProfileScreen.tsx`, `AppNavigator.tsx`, `multiplayer.ts`, `App.tsx` |
| Chat 8 | Home stats card + Match history detail (roadmap #6) | `HomeStatsCard.tsx` (new), `MatchDetailModal.tsx` (new), `HomeScreen.tsx`, `ProfileScreen.tsx` |
| Chat 9 | Supabase Auth migration (Option A-lite) | `schema.sql`, `db.js`, `server.js`, `src/services/supabase.ts` (new), `identity.ts`, `multiplayer.ts`, `App.tsx`, `userStore.ts`, `SettingsScreen.tsx`, `AppNavigator.tsx`, new auth screens, `GuestBanner.tsx`, `PremiumGate.tsx` |
| Chat 9b | Server-side avatars + 3 bug fixes | `schema.sql`, `db.js`, `server.js`, `supabase.ts`, `multiplayer.ts`, `avatarStore.ts`, `App.tsx` |
| Chat 9c | ES256-only JWT verification | `server.js`, `package.json` |
| Chat 9d | Avatar UUID fix + auto-create + username at signup | `db.js`, `server.js`, `multiplayer.ts`, `avatarStore.ts`, `SignupLinkScreen.tsx` |
| Chat 10 | AI Training UI (roadmap #8) | `TrainingScreen.tsx`, `TrainingMatchScreen.tsx` (new), `TrainingResultScreen.tsx` (new), `PersonalityChart.tsx` (new), `avatarStore.ts`, `multiplayer.ts`, `server.js`, `db.js`, `AppNavigator.tsx` |
| Chat 11 | Tournament Mode — server + client, real data (roadmap #13) | `schema.sql`, `db.js`, `server.js`, `multiplayer.ts`, 5 new components (`BracketSquare`, `BracketConnector`, `ActiveCountdown`, `LiveScoreboardStrip`, `TournamentChatPanel`), 7 new screens (`TournamentEntry`, `TournamentConfig`, `TournamentLobby`, `TournamentJoin`, `TournamentBracket`, `TournamentMatch`, `TournamentChampion`), `OnlineModeScreen.tsx`, `AppNavigator.tsx`, `App.tsx`, `LoginScreen.tsx`, `HomeScreen.tsx`, `ProfileScreen.tsx`, `TournamentJoinScreen.tsx`, `app.json` |
| Chat 12a | Critical bug fixes (Phase 1 start) | 🚧 Next — bugs #1, #14, #15 + test #24, #35 |

---

## Architecture

### Server (`rps-server/`)

Four files:

- **`server.js`** — Express + Socket.IO, all game logic, tournament
  engine, ephemeral state. JWT middleware verifies Supabase tokens via
  JWKS (ES256, `jose`).
- **`aiEngine.js`** — dependency-free Node port of the client's
  `src/engine/AIEngine.ts` `AdaptiveAI`.
- **`db.js`** — Supabase client + helpers (users, profiles, stats,
  history, achievements, avatars, tournaments, rounds, legacy migration).
- **`schema.sql`** — Supabase schema (run once in SQL editor; idempotent).

### Ephemeral state (in-memory, wiped on restart — intentional)

| Map | Key | Purpose |
|---|---|---|
| `rooms` | roomCode | Active matches |
| `players` | socketId | Live socket → identity |
| `onlinePlayers` | socketId | Presence + status |
| `activeInvites` | inviteId | Pending invites (5 min TTL) |
| `recentOpponents` | socketId | Recently played with (max 5) |
| `tournaments` | tournamentId | Tournament state (Chat 11) |
| `tournamentCodes` | code | Tournament code → id index (Chat 11) |

### Persistent state (Supabase — survives restart)

- `users` — `"userId"` (text: Supabase UID or legacy `user_xxx`),
  username, avatar, createdAt, updatedAt
- `auth_tokens` — LEGACY. Kept for one release for `migrateLegacyToken`.
- `profiles` — `id` (uuid PK → auth.users.id), username, avatar,
  is_premium, premium_since, created_at, updated_at
- `player_stats` — `"userId"`, wins, losses, ties, total, per-mode
  stats, currentStreak, bestStreak, opponentsPlayed[], dailyWinDates[],
  masterWins jsonb
- `match_history` — id, `"userId"`, mode, opponent, opponentId, result,
  myScore, theirScore, rounds, timestamp
- `achievements` — `"userId"`, achievementId, unlockedAt
- `avatars` — id (uuid), `"userId"`, name, emoji, personality jsonb,
  rating, level, xp, wins, losses, ties, win_streak, best_streak,
  titles[], defeated_masters[], is_selected, image_url, created_at,
  updated_at
- `tournaments` — id (uuid), code (unique, 6 chars), `"hostId"` (text),
  type ('human' | 'avatar'), `"maxPlayers"` (int, 2-32), `"winTarget"`
  (int, 15-30), `"autoAdvance"` (bool), name (text, nullable),
  `"isPrivate"` (bool), status ('lobby' | 'live' | 'finished'),
  `"currentRound"` (int), `"colorMap"` (jsonb), players (text[]),
  `"winnerId"` (text, nullable), created_at, updated_at (Chat 11)
- `tournament_rounds` — id (uuid), `"tournamentId"` (uuid, FK cascade),
  `"roundNumber"` (int), matches (jsonb), bye (text, nullable),
  status ('pending' | 'active' | 'complete'), started_at, completed_at
  (Chat 11)
- `migration_log` — id, old_user_id, new_uid, legacy_token, migrated_at

---

## Auth (Chat 9) — Supabase Auth, Option A-lite

**Source of truth:** Supabase Auth. Client holds a Supabase session
(anonymous by default, upgradable to email/password).

**Anonymous guest mode:**
- First open → `supabase.auth.signInAnonymously()`.
- Real Supabase UID. Can play offline modes (AI Dojo, Training, Local).
- Cannot play online, tournaments, or use any persistent feature.
- Guest banner on Home: "Save your progress".

**Linking:**
- Settings → Save Progress → email + password + username.
- `supabase.auth.updateUser({ email, password, data: { username } })`.
- Same UID preserved — no data loss.

**New device login:**
- Email + password via `signInWithPassword`.
- Same UID, stats/history/premium/avatars all restored.

**Session replacement (Option X):**
- Single active session per account.
- Second connect kicks the first. First device shows "Signed in
  elsewhere" and lands on LoginScreen.

**Password reset:**
- `resetPasswordForEmail(email, { redirectTo: window.location.origin })`.
- Web only. Native deep-link config deferred.

**JWT verification (Chat 9c):**
- ES256-only, verified via Supabase JWKS using `jose`.
- JWKS URL: `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`.
- Fetched with `apikey: SUPABASE_ANON_KEY` header, cached in memory.
- HS256 rejected. `jsonwebtoken` removed.

**Server env vars (Render):**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY` (used by `db.js`)
- `SUPABASE_ANON_KEY` (used by `server.js` for JWKS fetch)

**Client env vars (`.env` at repo root):**
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

**Preserved rules:**
- Username normalization: lowercase, `[^a-z0-9_]` stripped, 3-15 chars.
- Uniqueness enforced against both live players and stored accounts.
- `changeUsername` and `deleteAccount` authenticate via the JWT
  `socket.data.userId`.

---

## Registration boundary (Chat 11)

**Rule:** anything that persists to the server requires a registered
account. Guests can play offline modes freely.

**Gated routes (redirect to Login via `AuthGate`):**
- `OnlineMode`, `OnlineLobby`, `OnlineGame`
- `TournamentEntry`, `TournamentConfig`, `TournamentLobby`,
  `TournamentJoin`, `TournamentBracket`, `TournamentMatch`,
  `TournamentChampion`

**Ungated routes (guest-friendly):**
- `Home`, `Game` (AI / local multiplayer)
- `AIDojo`, `DojoMatch`, `Training`, `TrainingMatch`, `TrainingResult`
- `BlitzMatch`
- `Settings`, `AISettings`, `AvatarImage`, `Notifications`, `Premium`
- `Profile`, `Leaderboard`, `Achievements` — viewable with guest
  placeholders in gated tabs
- Auth screens (Login, SignupLink, ForgotPassword, ResetPassword)

**Implementation:** `AuthGate` wrapper in `AppNavigator.tsx` reads
`useUserStore().isAnonymous`. When a guest lands on a gated route, it
calls `navigation.replace('Login', { returnTo: route.name,
returnParams: route.params })`. After sign-in, `LoginScreen` routes
back via `navigation.replace(returnTo, returnParams)`.

**Visual signals:**
- Home screen: yellow guest banner "Sign in to play online & save
  progress" + lock icon on Online Multiplayer and Leaderboard cards.
- Profile screen: yellow banner "Save your progress" + per-tab
  placeholders in Stats/History/Leaderboard/Achievements for guests.

---

## Deep links (Chat 11)

**Web:** `https://<origin>/?tournament=CODE` is read at boot by
`App.tsx`. If the user is a guest → Login with `returnTo:
'TournamentJoin'` and `returnParams: { code }`. If registered →
`TournamentJoin` with `{ code }` pre-filled and auto-submitted.

**APK:** custom scheme `rpsarena://join/CODE` is registered in
`app.json` (top-level `scheme` + Android `intentFilters`). Read by
`Linking.getInitialURL()` (cold start) and
`Linking.addEventListener('url', ...)` (warm start). Same routing as web.

**Not implemented:** App Links for `https://...vercel.app/?tournament=CODE`
opening the APK. Requires `assetlinks.json` on Vercel. Deferred.

---

## Player status system

Single source of truth: `setPlayerStatus(socketId, status)` on the server.
Statuses:

- `online` — default; connected, not in a match.
- `in-match` — client has mounted the match screen.

**Client-driven:**
- Client emits `enterMatchScreen` when OnlineGame or TournamentMatch
  mounts → status becomes `in-match`.
- Client emits `leaveMatchScreen` when it unmounts → status becomes
  `online`.
- The server does not flip status on room creation, invite accept,
  match end, or player join. Only reacts to those two events, plus bulk
  resets when a room empties (`resetPlayersToOnline`).

---

## Battle modes

- **`human`** — Human vs Human. Both players send `makeMove`; server
  resolves when both have moved. Results persist to Supabase.
  Selected avatars are snapshotted at match start and updated with
  W/L at match end (`recordAvatarResult`).
- **`avatar`** — Avatar Arena. Server auto-plays both sides with adaptive
  AI. Clients only watch. Results persist. Same avatar W/L treatment.
- **`dojo`** — AI Dojo. Client plays vs `AdaptiveAI` locally. Results
  sync via `recordDojoMatch` (increments dojoWins/Losses/Ties + overall
  stats + history entry). Updates avatar W/L now (Chat 12a fix for #11).
- **`training`** — AI Training Lab. Client plays vs own avatar's AI,
  personality shifts after match. Persists to avatars.personality.
- **`tournament`** — sub-mode of `human` or `avatar`. Rooms carry
  `tournamentId` + `tournamentMatchId`. The tournament engine advances
  the bracket on match resolution. Uses `makeMove` (human) or
  `startAvatarAutoPlay` (avatar) — same as non-tournament rooms.

---

## Tournament Mode (Chat 11)

**Purpose:** up to 32 players compete in a single-elimination bracket.

### Flow

1. Host creates a tournament with config (type, maxPlayers 2–32,
   winTarget 15–30, autoAdvance, name, isPrivate) → gets a 6-char code.
2. Players join by code or share link (lobby status only).
3. Host presses Start → colors assigned, round 1 begins.
4. Each round: pairings shuffled, odd player gets a BYE, matched
   players are navigated to their match immediately.
5. Matches run through the existing room system.
6. Match resolution → `onMatchProgress` → `checkRoundComplete`.
7. Round completes → next round begins automatically (`autoAdvance:
   true`, 4-second delay) or host presses "Begin Round X".
8. Last player standing → `finishTournament` → rewards applied.

### Round lifecycle (post Chat 11)

**No Active window.** The original STEP 5 Active window (90 seconds
where every player must press a button or be eliminated) was removed
in Chat 11 because it caused state divergence: matched players were
sent to their match before they could press Active, and BYE players'
auto-active state did not sync reliably. The replacement is a
state-driven flow:

- Round starts: server pairs players, creates rooms, emits
  `matchAssigned` to matched players, advances the BYE player silently.
- Matched players navigate to their match screen.
- BYE player stays on the bracket and sees the live scoreboard strip
  update as the other match progresses.
- Matches resolve. `roundComplete` fires. Next round begins.
- Disconnect handling (`_handleParticipantGone`) is the only presence
  check. A disconnected player's match resolves as a walkover for the
  opponent.

### Rewards (STEP 5, unchanged)

- Champion: +50 rating, +500 XP, "Tournament Champion" title
- Runner-up: +25 rating, +250 XP
- Semifinalists: +10 rating, +100 XP
- All participants: +50 XP

### Server events

**Client → server:**
- `createTournament({ type, maxPlayers, winTarget, autoAdvance, name?, isPrivate? })` → `tournamentCreated { tournamentId, code }`
- `joinTournament({ code })` → `tournamentJoined { tournamentId, code }` | `tournamentError { action: 'join', message }`
- `leaveTournament({ tournamentId })`
- `startTournament({ tournamentId })` — host only
- `beginNextRound({ tournamentId })` — host only, `!autoAdvance`
- `getTournament({ tournamentId? , code? })` → `tournamentState`
- `pressActive` — no-op (Active window removed; kept for compat)

**Server → client:**
- `tournamentState { full state }` — on join, on change, on request
- `tournamentStarted { colorMap }`
- `roundStarted { roundNumber, bye, matches }`
- `playerActive` — unused (Active removed)
- `playerInactive` — unused (Active removed)
- `hostChanged { newHostId }`
- `matchAssigned { matchId, roomCode, opponentUserId }`
- `tournamentScoresUpdate { [matchId]: { p1, p2, scores, round, status } }`
- `roundComplete { roundNumber, winners, nextRound }`
- `tournamentComplete { winnerId, rewards }`
- `matchCancelled { winnerId, winnerSocketId, reason }` — walkover path
- `tournamentError { action, message }`

### Server constants

- `TOURNAMENT_CODE_LEN = 6`
- `TOURNAMENT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'`
- `TOURNAMENT_COLORS` = 32-color palette
- `AVATAR_ROUND_DELAY = 2000` (avatar mode, from Chat 2)

### Client screens

- `TournamentEntryScreen` — pick Human vs Human or Avatar vs Avatar.
- `TournamentConfigScreen` — host config form.
- `TournamentLobbyScreen` — share code, joined list, start button.
- `TournamentJoinScreen` — enter code or paste link.
- `TournamentBracketScreen` — bracket, live scores for BYE/waiting
  players, chat.
- `TournamentMatchScreen` — the actual match, live scoreboard strip,
  chat.
- `TournamentChampionScreen` — reveal + rewards breakdown.

### Client components

- `BracketSquare` — a single player slot in a bracket column.
- `BracketConnector` — the lines between columns (no SVG dependency).
- `ActiveCountdown` — unused (kept for potential future reuse).
- `LiveScoreboardStrip` — horizontal strip on match + bracket screens.
- `TournamentChatPanel` — wrapper around `ChatBubble` scoped by
  `tournamentId`; renders floating emoji animations.

### Client services

- `multiplayer.ts` — tournament types, `createTournamentOnServer`,
  `joinTournamentOnServer`, `leaveTournamentOnServer`,
  `pressActiveOnServer` (no-op), `startTournamentOnServer`,
  `beginNextRoundOnServer`, `getTournamentFromServer`, and one
  `on*` subscription per broadcast event.

### Debug instrumentation

- Server: `[TOURNAMENT]` logs on every engine method entry/exit, every
  emit, every state mutation, every active-window tick (removed).
- Client: `[TOURNAMENT CLIENT]` on every tournament emit and receive.
  `[TOURNAMENT <SCREEN>]` on every screen lifecycle step.
- Correlation: same event names on both sides, filterable by prefix.
- To trim: after the tournament is stable across multiple test
  sessions, reduce server logs to state transitions only and client
  logs to error paths only.

---

## Avatar Arena — adaptive AI (Chat 2)

### Client side

- Avatars live in `useAvatarStore` — server-authoritative cache since
  Chat 9b. Reads/writes go through socket events; the store mirrors the
  server's response.
- `Avatar.personality` is `{ aggression, memory, randomness, defense }`,
  each 0..1. Default `{ 0.5, 0.5, 0.5, 0.5 }`.
- When the client emits `createRoom` / `sendInvite` / `joinRoom` /
  `respondToInvite` (accept only), it includes
  `avatarPersonality: getSelectedAvatar()?.personality ?? 'adaptive'`.

### Server side

- `rps-server/aiEngine.js` exports:
  - `AdaptiveAI` class
  - `createAdaptiveAI(name, personalityInput)`
  - `normalizePersonality(input)`
  - `PERSONALITY_PRESETS`
- A room in `avatar` mode has `room.aiState = { [p1SocketId]: AdaptiveAI,
  [p2SocketId]: AdaptiveAI }`, created by `ensureAvatarAI(room)`.
- `ensureAvatarAI` is called from `respondToInvite`, `joinRoom`,
  `playAgain`, and `startAvatarAutoPlay`.
- `clearAvatarAI` is called from `playAgain`, `handleLeave`, and both
  branches of `handleDisconnect`.
- Round cadence: `AVATAR_ROUND_DELAY = 2000` ms between rounds.

---

## AI Training Lab (Chat 10)

**Purpose:** players play practice matches against their own avatar's AI
to shift its personality over time. Trained personality is used in
Avatar Arena.

**Client:**
- `TrainingScreen.tsx` — list of avatars, "Train by playing" section,
  and existing manual sliders preserved.
- `TrainingMatchScreen.tsx` — training session flow (5 rounds).
- `TrainingResultScreen.tsx` — post-match personality chart showing
  before/after weights.
- `PersonalityChart.tsx` — visualizes { aggression, memory, randomness,
  defense }.

**Personality shift rules (per match):**
- Track: userMoveDiversity, userWinRate, aiWinRate.
- If user dominated → memory+, randomness+.
- If AI dominated → aggression+, defense+.
- If user predictable → memory+, aggression+.
- If user diverse → randomness+, defense+.
- Clamp to [0.05, 0.95].

**Persistence:** updated via `updateAvatarPersonality` socket event →
`avatars.personality` in Supabase. Trained weights feed Avatar Arena.

---

## Avatars (Chat 9b / 9d)

**Server-authoritative. Client caches.**

**Socket events:**
- `getAvatars` → `avatars { avatars: ServerAvatar[] }`
- `createAvatar` → `avatarCreated { avatar }` + `avatars` | `avatarError`
- `updateAvatar` → `avatarUpdated { avatar }` + `avatars` | `avatarError`
- `deleteAvatar` → `avatarDeleted { avatarId, newSelectedId }` + `avatars`
- `selectAvatar` → `avatars` | `avatarError`
- `updateAvatarPersonality` → `avatarUpdated { avatar }` (Chat 10)

**ServerAvatar shape:**
```ts
{
  id: string;                    // UUID, server-generated
  userId: string;                // Supabase UID as text
  name: string;
  emoji: string;
  personality: { aggression, memory, randomness, defense };
  rating: number;
  level: number;
  xp: number;
  wins: number;
  losses: number;
  ties: number;
  winStreak: number;
  bestStreak: number;
  titles: string[];
  defeatedMasters: string[];
  isSelected: boolean;
  imageUrl: string | null;       // reserved, unused
  createdAt: string;
  updatedAt: string;
}