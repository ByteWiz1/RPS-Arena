# RPS Arena — Project State

_Last updated: end of Chat 11b_

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
  - Deployed: Vercel (drag-drop of `dist/` folder)
  - Android APK: not built yet (see roadmap #10)

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
| 5 | PWA + Web Push | 🟡 Deferred |
| 6 | Home stats card + History detail | ✅ Working |
| 7 | Cross-device login + PIN recovery | ✅ Superseded by Chat 9 (Supabase Auth + email reset) |
| 8 | AI Training UI | ✅ Working |
| 9 | Monetization (RevenueCat + subscription tiers) | 🟡 In discussion |
| 10 | Native Android build ($0 via APK download) | ❌ Not started |
| 11 | Public website / download page | ❌ Not started |
| 12 | Native iOS build | 🚫 Blocked ($99/yr, skip until revenue) |
| 13 | Tournament Mode | ✅ Working — debug pass in progress |
| 14 | Security hardening (rate limits, Sentry) | ❌ Not started |
| 15 | Polish pass (sounds, animations, onboarding) | ❌ Not started |
| 16 | Registration boundary (persistent features require account) | ✅ Working |
| 17 | Deep links (web `?tournament=CODE`, APK `rpsarena://`) | 🟡 Web complete, App Links deferred |

**After breadth pass → debug pass → iterate.**

---

## 🐛 KNOWN ISSUES (breadth pass log)

Bugs identified but not yet fixed — logged here for the debug pass.

| # | Issue | Severity | Notes |
|---|---|---|---|
| 1 | Post-match invite sometimes fails silently | Medium | Works fresh, fails after 1+ matches. Toast shows but overlay doesn't pop. |
| 2 | userId-based identity matching deferred | Low | Client matches by username in some events. Should use userId. |
| 3 | `inviteAccepted` side detection relies on `identity.username` vs `data.opponentName` | Low | Fix by comparing `opponentId` to `identity.userId` instead. Ties into issue #2. |
| 4 | Notification `action` deep-links unused | Low | Typed as `{ screen: string; params?: any }`. No notifications set it yet. |
| 5 | `roomReady` has two listeners in `App.tsx` | Low | One navigates, one notifies. Intentional and non-conflicting. |
| 6 | Notifications are not scoped per-account | Low | `@rps_notifications` key is global to the device, not keyed by `userId`. |
| 7 | Achievement notifications not firing | ✅ Fixed | Chat 9 follow-up |
| 8 | Achievements UI may not reflect unlocks | ✅ Fixed | Chat 9 follow-up |
| 9 | Home stats card — live updates unreliable | ✅ Fixed | Resolved |
| 10 | Match detail modal — data may be stale | ✅ Fixed | Resolved |
| 11 | Dojo match results do not update avatar W/L/T | Medium | Only online human/avatar matches update avatar stats via `recordAvatarResult`. Dojo is client-side and does not pass `avatarId`. |
| 12 | `attachServerListener` subscription dies on socket reconnect | Low | `avatarStore.attachServerListener` is bound to a specific socket instance. After a socket reconnect, the subscription is dead. |
| 13 | `UsernameScreen.tsx` unreachable | Low | Not mounted since Chat 9. Delete or repurpose. |
| 14 | Custom avatar images deferred | Low | `avatars.image_url` column exists, nullable, unused. Client store sets `{ type: 'custom' }` locally but the server stores `emoji` + null `imageUrl`. Not synced. |
| 15 | `public.users.username` and `profiles.username` can drift | Low | Sync happens on change and on identify. Migration backfill for legacy drift is manual. |
| 16 | `profiles.is_premium` enforcement is server-side only | Low | Client reads `is_premium` for UI gating. Server gates actual premium features. |
| 17 | Chat 10 (AI Training) known issues | — | Folded into Chat 10 wrap-up. |
| 18 | ~~Live scoreboard shows on only one device~~ | ✅ Fixed | Chat 11b — socket now joins tournament room on `identify` for every tournament the user is in. Root cause was missing room membership for the second joiner. |
| 19 | ~~Active countdown static / never ticks~~ | ✅ Fixed | Chat 11b — same root cause as #18. Verified with `[TOURNAMENT] tick` logs. |
| 20 | ~~"0 left" blacks out everyone after window expiry~~ | ✅ Fixed | Chat 11b — same root cause. Was caused by clients never receiving the initial `activeWindowUpdate` broadcasts. |
| 21 | ~~"First to 30" instead of configured N~~ | ✅ Fixed | Chat 11b — client no longer sends `winTarget`; server is authoritative from `createTournamentRoom`. |
| 22 | ~~Match doesn't return to bracket after "You Win"~~ | ✅ Fixed | Chat 11b — client listens for `matchCancelled` and both win/loss paths call `triggerMatchEnd`. |
| 23 | ~~Seeded players disconnected automatically~~ | ✅ Fixed | Chat 11b — `_handleParticipantGone` no longer removes a user who still has another live socket. |
| 24 | Live tournaments are in-memory only | Medium | Server restart mid-tournament loses live state. Lobby tournaments are rehydrated on demand from Supabase. To fix: replay round state from `tournament_rounds` on boot. Logged for the debug pass. |
| 25 | `_lookupUsernameSync` only resolves online users | Low | `tournament.usernames` is populated from `onlinePlayers` on join and from `db.getUserById` at start time. If a user joins, disconnects, and reconnects between start and broadcast, their name may briefly show as the short userId. |
| 26 | App Links (`https://...vercel.app/?tournament=CODE` opening the APK) not implemented | Low | Custom scheme `rpsarena://join/CODE` works on APK. Web URLs open in the browser, not the app. Fix requires `assetlinks.json` on Vercel + `autoVerify: true` in `app.json`. |
| 27 | iOS Universal Links not implemented | Low | Blocked by the $99/yr Apple Developer account. Skipped. |
| 28 | `[TOURNAMENT]` server logs are verbose | Low | Chat 11b added ~30 log lines per round transition + a tick every 10 seconds. Reduce verbosity once the tournament is stable. |
| 29 | `activeWindowUpdate` tick log every 10s | Low | Same as #28 — temporary for the debug pass. |
| 30 | `matchCancelled` only handled by `TournamentMatchScreen` | Low | If the client is on another screen when the match is cancelled, the event is dropped. In practice only the match screen is affected. |
| 31 | `identify` loops all tournaments on every connection | Low | `joinUserToAllTournaments` iterates the in-memory `tournaments` map on every socket connect. Negligible at current scale. Revisit if tournaments count exceeds ~100. |
| 32 | Tournament chat is not persisted | Low | Messages live only in server memory for the duration of the tournament. No Supabase table. Consistent with the "messages persisted for the duration of the tournament only" spec. |
| 33 | `guessTournamentCode` collision fallback | Low | `generateTournamentCode` retries 20 times against the in-memory code index. If all 20 collide (impossible at real scale), it falls back to a timestamp-derived code that may not match the alphabet. |
| 34 | Tournament `winnerId: null` shows "No champion" | Low | When all players leave before a champion is determined, the champion screen shows "No champion" instead of crashing. This is intentional per STEP 3's "0 or 1 player remaining → champion (or error if 0)" spec, but currently shows a placeholder instead of an error. |
| 35 | `ScreenScroll` header height drift | Low | Tournament screens use `headerHeight={70}`. ProfileScreen uses `headerHeight={140}` due to the tab bar. If a future refactor changes header heights, all screens need re-checking. |
| 36 | Guest banner `authReady` race | Low | `GuestBanner` reads `isAnonymous` and `authReady` from the store. If a user signs up mid-render, the banner may briefly show for a registered user. Cosmetic only. |

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
| Chat 11 | Tournament Mode — server + client, real data | `schema.sql`, `db.js`, `server.js`, `multiplayer.ts`, 5 new components (`BracketSquare`, `BracketConnector`, `ActiveCountdown`, `LiveScoreboardStrip`, `TournamentChatPanel`), 7 new screens (`TournamentEntry`, `TournamentConfig`, `TournamentLobby`, `TournamentJoin`, `TournamentBracket`, `TournamentMatch`, `TournamentChampion`), `OnlineModeScreen.tsx`, `AppNavigator.tsx` |
| Chat 11b | Tournament bug-fix pass | `server.js`, `TournamentMatchScreen.tsx`, `TournamentBracketScreen.tsx`, `TournamentChampionScreen.tsx`, `TournamentLobbyScreen.tsx`, `multiplayer.ts` |
| Chat 11c | Registration boundary + deep links + instrumentation | `App.tsx`, `LoginScreen.tsx`, `AppNavigator.tsx`, `TournamentJoinScreen.tsx`, `HomeScreen.tsx`, `ProfileScreen.tsx`, `app.json`, `server.js`, `multiplayer.ts`, `TournamentConfigScreen.tsx`, `TournamentLobbyScreen.tsx`, `TournamentBracketScreen.tsx`, `TournamentMatchScreen.tsx`, `TournamentChampionScreen.tsx` |

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
| `tournamentCodes` | code | Tournament code → id index |

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
- `tournaments` — id (uuid), code, `"hostId"`, type, `"maxPlayers"`,
  `"winTarget"`, `"autoAdvance"`, name, `"isPrivate"`, status,
  `"currentRound"`, `"colorMap"` jsonb, players text[], `"winnerId"`,
  created_at, updated_at (Chat 11)
- `tournament_rounds` — id (uuid), `"tournamentId"` (FK, cascade),
  `"roundNumber"`, matches jsonb, bye, status, started_at, completed_at
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

**Server env vars (Render):**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY` (used by `db.js`)
- `SUPABASE_ANON_KEY` (used by `server.js` for JWKS fetch)

**Client env vars (`.env` at repo root):**
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

---

## Registration boundary (Chat 11c)

**Rule:** anything that persists to the server requires a registered
account. Guests can play offline modes freely.

**Gated (redirect to Login):**
- `OnlineMode`, `OnlineLobby`, `OnlineGame`
- `TournamentEntry`, `TournamentConfig`, `TournamentLobby`,
  `TournamentJoin`, `TournamentBracket`, `TournamentMatch`,
  `TournamentChampion`
- Persistence inside Profile tabs: Stats, History, Leaderboard,
  Achievements, Avatars (fetch + mutations). Guests see a "sign in"
  placeholder.
- Home screen lock indicator on Online Multiplayer and Leaderboard.

**Not gated (guest-friendly):**
- Home, Game (AI / local multiplayer)
- AIDojo, DojoMatch
- Training, TrainingMatch, TrainingResult
- BlitzMatch
- Settings, AISettings, AvatarImage
- Notifications, Premium
- Profile (viewable with placeholders for gated tabs)
- Leaderboard (viewable with placeholders)
- Achievements (viewable with placeholders)
- Auth screens (Login, SignupLink, ForgotPassword, ResetPassword)

**Implementation:** `AuthGate` wrapper in `AppNavigator.tsx` reads
`useUserStore().isAnonymous`. When a guest lands on a gated route, it
calls `navigation.replace('Login', { returnTo: route.name, returnParams: route.params })`.
After sign-in, `LoginScreen` routes back via `navigation.replace(returnTo, returnParams)`.

---

## Deep links (Chat 11c)

**Web:** `https://<origin>/?tournament=CODE` is read at boot by
`App.tsx`. If the user is a guest → Login with `returnTo: 'TournamentJoin'`
and `returnParams: { code }`. If registered → `TournamentJoin` with
`{ code }` pre-filled and auto-submitted.

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
- **`avatar`** — Avatar Arena. Server auto-plays both sides with adaptive
  AI. Clients only watch. Results persist.
- **`dojo`** — AI Dojo. Client plays vs `AdaptiveAI` locally. Results
  sync via `recordDojoMatch`. Does NOT update avatar W/L (Known Issue 11).
- **`training`** — AI Training Lab. Client plays vs own avatar's AI,
  personality shifts after match. Persists to avatars.personality.
- **`tournament`** — sub-mode of `human` or `avatar` used in bracket
  matches. Rooms carry `tournamentId` + `tournamentMatchId`. The
  tournament engine advances the bracket on match resolution.

---

## Tournament Mode (Chat 11 + 11b + 11c)

**Purpose:** up to 32 players compete in a single-elimination bracket.

**Flow:**
1. Host creates a tournament with config (type, maxPlayers 2–32,
   winTarget 15–30, autoAdvance, name, isPrivate) → gets a 6-char code.
2. Players join by code or share link (lobby status only).
3. Host presses Start → colors assigned, round 1 begins.
4. Each round: pairings shuffled, odd player gets a BYE,
   a 90-second Active window opens. Everyone (host included) must
   press Active.
5. Survivors' matches are assigned via `matchAssigned`. Rooms are
   real `human` or `avatar` rooms with `tournamentId` set.
6. Match resolution → `onMatchProgress` → `checkRoundComplete`.
7. Round completes → next round begins automatically
   (`autoAdvance: true`) or host presses "Begin Round X".
8. Last player standing → `finishTournament` → rewards applied.

**Rewards (STEP 5):**
- Champion: +50 rating, +500 XP, "Tournament Champion" title
- Runner-up: +25 rating, +250 XP
- Semifinalists: +10 rating, +100 XP
- All participants: +50 XP

**Server events (client → server):** `createTournament`,
`joinTournament`, `leaveTournament`, `pressActive`, `startTournament`,
`beginNextRound`, `getTournament`.

**Server events (server → client):** `tournamentState`,
`tournamentStarted`, `roundStarted`, `activeWindowUpdate`,
`playerActive`, `playerInactive`, `hostChanged`, `matchAssigned`,
`tournamentScoresUpdate`, `roundComplete`, `tournamentComplete`,
`matchCancelled`, `tournamentError`.

**Server constants:** `ACTIVE_WINDOW_MS = 90000`,
`ACTIVE_TICK_MS = 1000`, `TOURNAMENT_CODE_LEN = 6`,
`TOURNAMENT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'`,
`TOURNAMENT_COLORS` = 32-color palette.

**Client screens:**
- `TournamentEntryScreen` — pick Human vs Human or Avatar vs Avatar.
- `TournamentConfigScreen` — host config.
- `TournamentLobbyScreen` — share code, joined list, start button.
- `TournamentJoinScreen` — enter code or paste link.
- `TournamentBracketScreen` — bracket, Active window, chat.
- `TournamentMatchScreen` — the actual match, live scoreboard strip.
- `TournamentChampionScreen` — reveal + rewards.

**Client components:**
- `BracketSquare` — a single player slot in a bracket column.
- `BracketConnector` — the lines between columns (no SVG).
- `ActiveCountdown` — the 90s ring (no SVG).
- `LiveScoreboardStrip` — horizontal strip on the match screen.
- `TournamentChatPanel` — wrapper around `ChatBubble` scoped by
  `tournamentId`.

---

## Debug instrumentation (Chat 11b)

**Server:** every tournament engine method logs `[TOURNAMENT] <method> — enter/exit`
with the relevant state (id, round, players, activeSet, room size).
Every emit is logged. The `activeWindowUpdate` tick logs every 10s plus
the last 5 seconds. `broadcastState` and `broadcastScores` log the
number of sockets in the tournament room at broadcast time.

**Client:** every tournament emit and every tournament event received
logs `[TOURNAMENT CLIENT] <event>` with the relevant fields.
`getTournamentFromServer` logs the emit, the received state (or "null"),
and the timeout. Every tournament screen logs `[TOURNAMENT <SCREEN>] <step>`
for its own lifecycle.

**Correlation:** the client and server logs use the same event names,
so a filtered console shows the full round trip: client emit → server
receive → server process → server emit → client receive.

**Purpose:** identify at a glance which transition failed in a
tournament test. Remove or reduce verbosity once the tournament is
stable in production (Known Issues 28, 29).

---

## AI Training Lab (Chat 10)

**Purpose:** players play practice matches against their own avatar's AI
to shift its personality over time. Trained personality is used in
Avatar Arena.

**Personality shift rules (per match):**
- Track: userMoveDiversity, userWinRate, aiWinRate.
- If user dominated → memory+, randomness+.
- If AI dominated → aggression+, defense+.
- If user predictable → memory+, aggression+.
- If user diverse → randomness+, defense+.
- Clamp to [0.05, 0.95].

**Persistence:** updated via `updateAvatarPersonality` socket event →
`avatars.personality` in Supabase.

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

**ServerAvatar shape:** documented in Chat 9b section.

---

## Environment (Build / Run)

**Client `.env` at repo root:**
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

**Server env vars on Render:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `SUPABASE_ANON_KEY`

**APK build (deferred — roadmap #10):**
- `npx eas-cli build --platform android --profile preview`
- Or `npx expo prebuild && cd android && ./gradlew assembleRelease`
- Deep-link scheme `rpsarena://` is registered in `app.json`.

**Web build:**