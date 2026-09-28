# RPS Arena — Project State

_Last updated: end of Chat 3_

## Overview

RPS Arena is a React Native + Expo web game (rock paper scissors) with
multiplayer and AI modes.

- **Server:** Node.js + Express + Socket.IO, deployed on Render
  - URL: https://rps-arena-server-2mxh.onrender.com
  - Repo: `C:\Users\lilel\rps-server`
  - Files: `server.js` (single entry), `aiEngine.js` (adaptive AI port)
- **Client:** React Native + Expo, exported to web via
  `npx expo export --platform web`
  - Repo: `C:\Users\lilel\RPS-Arena`
  - Deployed: Vercel (drag-drop of `dist/` folder)

---

## Architecture

### Server (`rps-server/`)

Two files:

- **`server.js`** — Express + Socket.IO, all game logic, in-memory state.
- **`aiEngine.js`** — dependency-free Node port of the client's
  `src/engine/AIEngine.ts` `AdaptiveAI`, plus a `createAdaptiveAI(name,
  personalityInput)` factory and a `normalizePersonality` shim that accepts
  either a numeric personality object or a string tag.

### In-memory state maps (server)

| Map | Key | Value | Purpose |
|---|---|---|---|
| `rooms` | roomCode | room object | Active matches |
| `players` | socketId | `{ room, name, username, userId, token, avatar }` | Live socket → identity |
| `onlinePlayers` | socketId | `{ userId, name, username, avatar, status, socketId, token, connectedAt }` | Presence + status |
| `activeInvites` | inviteId | invite object | Pending invites (5 min TTL) |
| `recentOpponents` | socketId | array of `{ id, name, lastPlayed }` (max 5) | Recently played with |
| `matchHistory` | userId | array of match records (max 20) | Per-user history |
| `playerStats` | userId | stats object (see below) | Per-user stats |
| `userAccounts` | token | `{ userId, username, avatar, createdAt }` | Auth lookup by token |
| `accountsByUserId` | userId | `{ token, username, avatar, createdAt }` | Auth lookup by userId |

All state is in-memory. A server restart wipes everything. Full Supabase
migration is deferred.

---

## Auth (Tier 1, in-memory) — built in Chat 1

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
- Username normalization: lowercase, `[^a-z0-9_]` stripped, 3–15 chars.
- Uniqueness enforced against **both** live players and stored accounts.
- `changeUsername` and `deleteAccount` both authenticate via token, not
  socketId.
- Do NOT modify the auth system without a dedicated chat — it was just
  built and stabilized.

---

## Player status system

The single source of truth for a player's status is
`setPlayerStatus(socketId, status)` on the server. Statuses:

- `online` — default; connected, not in a match.
- `in-match` — client has mounted the match screen.

**Client-driven, not server-driven:**
- Client emits `enterMatchScreen` when OnlineGame mounts → status becomes
  `in-match`.
- Client emits `leaveMatchScreen` when it unmounts → status becomes
  `online`.
- The server does **not** flip status on room creation, invite accept,
  match end, or player join. It only reacts to the two events above, plus
  bulk resets when a room empties (`resetPlayersToOnline`).

This design keeps status honest even if a client crashes mid-match — the
socket disconnect path handles cleanup.

---

## Battle modes

- **`human`** — Human vs Human. Both players send `makeMove`; server
  resolves when both have moved.
- **`avatar`** — Avatar Arena. Server auto-plays both sides with adaptive
  AI. Clients only watch. `makeMove` is a no-op in this mode.
- **`dojo`** — AI Dojo. Currently tracked **client-side only**;
  `dojoWins/Losses/Ties` on the server default to 0 and are not incremented
  yet. Wiring dojo results to the server is deferred.
  **UI note (Chat 3):** The Profile → Stats tab renders a Dojo
  breakdown card. It will read `0-0-0` until dojo results are wired
  server-side. This is expected, not a bug.

---

## Avatar Arena — adaptive AI (Chat 2)

### Client side

- Avatars live in `useAvatarStore` (Zustand + AsyncStorage).
- `Avatar.personality` is an **object**: `{ aggression, memory, randomness,
  defense }`, each 0..1. Default is `{ 0.5, 0.5, 0.5, 0.5 }`.
- When the client emits `createRoom` / `sendInvite` / `joinRoom` /
  `respondToInvite` (accept only), it now includes
  `avatarPersonality: getSelectedAvatar()?.personality ?? 'adaptive'`.
- The client never sends a "difficulty" — the server derives it.

### Server side

- `rps-server/aiEngine.js` exports:
  - `AdaptiveAI` class (faithful port of the client's `AdaptiveAI`).
  - `createAdaptiveAI(name, personalityInput)` — the factory `server.js`
    uses.
  - `normalizePersonality(input)` — accepts:
    - an object with any of `{aggression, memory, randomness, defense}` →
      sanitized, difficulty `'medium'`;
    - a string tag (`'adaptive' | 'counter' | 'frequency' | 'pattern' |
      'random'`) → preset lookup;
    - `undefined`/unknown → `'adaptive'` preset.
  - `PERSONALITY_PRESETS` — the string-tag table.
- A room in `avatar` mode has `room.aiState = { [p1SocketId]: AdaptiveAI,
  [p2SocketId]: AdaptiveAI }`, created by `ensureAvatarAI(room)`.
- `ensureAvatarAI(room)` is called from:
  - `respondToInvite` (accept path), once both players are known.
  - `joinRoom` (code-join), when the second player arrives.
  - `playAgain`, to give the rematch fresh AI (previous learning
    discarded).
  - `startAvatarAutoPlay`, as a safety net if AI is somehow missing.
- `clearAvatarAI(room)` is called from `playAgain`, `handleLeave`, and
  both branches of `handleDisconnect`.
- `startAvatarAutoPlay` → `runRound`:
  - `move1 = ai1.makeMove()`, `move2 = ai2.makeMove()`
  - `ai1.recordOpponentMove(move2)`, `ai2.recordOpponentMove(move1)`
  - `ai1.recordResult(...)`, `ai2.recordResult(...)` based on round result
  - No more `Math.random()` move picking for avatar mode.
- Round cadence unchanged: `AVATAR_ROUND_DELAY = 2000` ms between rounds;
  first round starts 2000 ms after the room is ready.

### Important caveat

The client's `AIEngine.ts` does **not** contain a `patterns` map or a
`learnPatterns()` method. Pattern learning lives inline in
`predictByPattern()` (bigram scan over the last `depth` moves) and
`predictByFrequency()` (most-common move over a window). The server port
preserves the actual behavior of the source file; there is no separate
`patterns` data structure to speak of. This was flagged during Chat 2 and
confirmed acceptable.

---

## Stats schema (Chat 2)

`playerStats` per userId (created by `createEmptyStats()` /
`getOrCreateStats(userId)` on the server):

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