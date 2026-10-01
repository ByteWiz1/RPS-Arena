// src/services/multiplayer.ts
//
// RPS Arena — Socket.IO client.
//
// Chat 9: JWT-at-handshake, identify, migrateLegacyToken.
// Chat 9b: avatar event wrappers, onAvatarsUpdate, reconnectWithFreshJWT.
// Chat 9c: nothing client-side.
// Chat 9d:
//   - createAvatarOnServer no longer sends an `id`. The server
//     generates the UUID (fixes "invalid input syntax for type uuid").
//   - New checkUsernameAvailabilityOnServer(username).
// Chat 11: tournament socket helpers + types.
// Chat 11: tournament socket helpers + types.
// Chat 11b (debug pass):
//   - onTournamentError: subscribe to server-side tournament errors.
//   - onMatchCancelled: subscribe to match cancellation events.
//   - [TOURNAMENT CLIENT] logs on every tournament emit and receive.
//   - getTournamentFromServer logs the emit and result.
// Chat 11e — Active window removed.
//   - pressActiveOnServer: kept as a no-op. The server's pressActive
//     handler is a no-op too. Safe if any stale client still emits it.
//   - onActiveWindowUpdate / onPlayerActive / onPlayerInactive: kept
//     for compatibility. The server no longer emits these, so the
//     subscriptions never fire. Harmless.
//   - No other changes.
//
// IMPORTANT: tournament screens must call getSocket() first and only
// fall back to connectToServer if no socket is connected. Calling
// connectToServer while a socket exists calls removeAllListeners()
// and disconnects, which would kill listeners on other mounted
// screens. See connectToServer below.

import { io, Socket } from 'socket.io-client';
import { UserIdentity } from './identity';

let socket: Socket | null = null;
const SERVER_URL = 'https://rps-arena-server-2mxh.onrender.com';

// ────────────────────────────────────────────────────────────
// Connection
// ────────────────────────────────────────────────────────────
export function connectToServer(
  getToken: () => Promise<string | null>
): Promise<Socket> {
  return new Promise((resolve, reject) => {
    if (socket?.connected) {
      resolve(socket);
      return;
    }

    if (socket) {
      try {
        socket.removeAllListeners();
        socket.disconnect();
      } catch {}
      socket = null;
    }

    socket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 60000,
      auth: (cb: (data: { token: string | null }) => void) => {
        getToken()
          .then((token) => cb({ token: token || null }))
          .catch(() => cb({ token: null }));
      },
    });

    socket.on('connect', () => {
      resolve(socket!);
    });

    socket.on('connect_error', (error) => {
      reject(error);
    });
  });
}

export async function reconnectWithFreshJWT(
  getToken: () => Promise<string | null>
): Promise<Socket | null> {
  try {
    if (socket) {
      try {
        socket.removeAllListeners();
        socket.disconnect();
      } catch {}
      socket = null;
    }
    return await connectToServer(getToken);
  } catch (e: any) {
    console.log('[SOCKET] reconnectWithFreshJWT failed:', e?.message || e);
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// identify
// ────────────────────────────────────────────────────────────
export function identifyOnServer(payload?: {
  username?: string;
  avatar?: string;
}): Promise<{
  userId: string;
  username: string;
  avatar: string;
  isPremium: boolean;
  premiumSince: string | null;
  email: string | null;
  isAnonymous: boolean;
}> {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Not connected to server'));
      return;
    }

    let settled = false;

    const onRegistered = (data: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket?.off('selfRegistered', onRegistered);
      socket?.off('identifyError', onError);
      resolve(data);
    };

    const onError = (err: { message?: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket?.off('selfRegistered', onRegistered);
      socket?.off('identifyError', onError);
      reject(new Error(err?.message || 'Identify failed'));
    };

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket?.off('selfRegistered', onRegistered);
      socket?.off('identifyError', onError);
      reject(new Error('Identify timed out'));
    }, 8000);

    socket.on('selfRegistered', onRegistered);
    socket.on('identifyError', onError);
    socket.emit('identify', payload || {});
  });
}

// ────────────────────────────────────────────────────────────
// Legacy migration
// ────────────────────────────────────────────────────────────
export function migrateLegacyTokenOnServer(legacyToken: string): Promise<{
  success: boolean;
  userId?: string;
  access_token?: string | null;
  refresh_token?: string | null;
  message?: string;
}> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, message: 'Not connected to server' });
      return;
    }

    let settled = false;

    const handler = (data: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket?.off('legacyMigrationResult', handler);
      resolve(data);
    };

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket?.off('legacyMigrationResult', handler);
      resolve({ success: false, message: 'Migration timed out' });
    }, 15000);

    socket.on('legacyMigrationResult', handler);
    socket.emit('migrateLegacyToken', { token: legacyToken });
  });
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectFromServer(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export type { UserIdentity };

// ============================================================
// CHANGE USERNAME
// ============================================================
export function changeUsernameOnServer(
  newUsername: string
): Promise<{ success: boolean; username?: string; message?: string }> {
  return new Promise((resolve) => {
    const connected = !!socket?.connected;
    console.log(
      '[SOCKET] changeUsername emit | connected:', connected,
      '| socketId:', socket?.id || '(none)',
      '| newUsername:', JSON.stringify(newUsername)
    );

    if (!socket?.connected) {
      resolve({ success: false, message: 'Not connected to server' });
      return;
    }

    let done = false;

    const handler = (result: {
      success: boolean;
      username?: string;
      message?: string;
    }) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      socket?.off('changeUsernameResult', handler);
      console.log('[SOCKET] changeUsernameResult:', JSON.stringify(result));
      resolve(result);
    };

    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      socket?.off('changeUsernameResult', handler);
      console.log('[SOCKET] changeUsername timed out');
      resolve({ success: false, message: 'Server did not respond' });
    }, 8000);

    socket.on('changeUsernameResult', handler);
    socket.emit('changeUsername', { newUsername });
  });
}

// ============================================================
// CHECK USERNAME AVAILABILITY (Chat 9d)
// ============================================================
export function checkUsernameAvailabilityOnServer(
  username: string
): Promise<{ available: boolean; message?: string }> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ available: false, message: 'Not connected to server' });
      return;
    }

    let done = false;

    const handler = (result: {
      username: string;
      available: boolean;
      message?: string;
    }) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      socket?.off('usernameAvailability', handler);
      resolve({
        available: !!result?.available,
        message: result?.message,
      });
    };

    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      socket?.off('usernameAvailability', handler);
      resolve({ available: false, message: 'Check timed out' });
    }, 5000);

    socket.on('usernameAvailability', handler);
    socket.emit('checkUsernameAvailability', { username });
  });
}

// ============================================================
// DELETE ACCOUNT
// ============================================================
export function deleteAccountOnServer(): Promise<{
  success: boolean;
  message?: string;
}> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: true, message: 'Already offline' });
      return;
    }

    let done = false;

    const handler = (result: { success: boolean; message?: string }) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      socket?.off('deleteAccountResult', handler);
      resolve(result);
    };

    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      socket?.off('deleteAccountResult', handler);
      resolve({ success: true, message: 'Timed out, treated as deleted' });
    }, 5000);

    socket.on('deleteAccountResult', handler);
    socket.emit('deleteAccount');
  });
}

// ============================================================
// MATCH HISTORY
// ============================================================
export interface MatchRecord {
  mode: string;
  opponent: string;
  opponentId: string;
  result: 'win' | 'loss';
  myScore: number;
  theirScore: number;
  p1Ties: number;
  p2Ties: number;
  rounds: number;
  timestamp: number;
}

export function getMatchHistoryFromServer(): Promise<MatchRecord[]> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve([]);
      return;
    }

    let done = false;

    const handler = (data: { matches: MatchRecord[] }) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      socket?.off('matchHistory', handler);
      resolve(data.matches || []);
    };

    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      socket?.off('matchHistory', handler);
      resolve([]);
    }, 6000);

    socket.on('matchHistory', handler);
    socket.emit('getMatchHistory');
  });
}

// ============================================================
// PLAYER STATS
// ============================================================
export interface PlayerStats {
  wins: number;
  losses: number;
  ties: number;
  total: number;
  humanWins: number;
  humanLosses: number;
  humanTies: number;
  avatarWins: number;
  avatarLosses: number;
  avatarTies: number;
  dojoWins: number;
  dojoLosses: number;
  dojoTies: number;
  currentStreak: number;
  bestStreak: number;
}

export const EMPTY_PLAYER_STATS: PlayerStats = {
  wins: 0,
  losses: 0,
  ties: 0,
  total: 0,
  humanWins: 0,
  humanLosses: 0,
  humanTies: 0,
  avatarWins: 0,
  avatarLosses: 0,
  avatarTies: 0,
  dojoWins: 0,
  dojoLosses: 0,
  dojoTies: 0,
  currentStreak: 0,
  bestStreak: 0,
};

export function getPlayerStatsFromServer(): Promise<PlayerStats> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ ...EMPTY_PLAYER_STATS });
      return;
    }

    let done = false;

    const handler = (data: { stats: PlayerStats }) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      socket?.off('playerStats', handler);
      resolve(data.stats || { ...EMPTY_PLAYER_STATS });
    };

    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      socket?.off('playerStats', handler);
      resolve({ ...EMPTY_PLAYER_STATS });
    }, 6000);

    socket.on('playerStats', handler);
    socket.emit('getPlayerStats');
  });
}

// ============================================================
// DOJO MATCH SYNC
// ============================================================
export interface DojoMatchPayload {
  result: 'win' | 'loss' | 'tie';
  opponentName: string;
  myScore: number;
  opponentScore: number;
  myTies: number;
  opponentTies: number;
  rounds: number;
}

export function recordDojoMatchOnServer(payload: DojoMatchPayload): void {
  if (!socket?.connected) return;
  socket.emit('recordDojoMatch', payload);
}

// ============================================================
// LISTEN FOR PUSHED STATS
// ============================================================
export function onPlayerStatsUpdate(
  callback: (stats: PlayerStats) => void
): () => void {
  if (!socket) return () => {};

  const handler = (data: { stats: PlayerStats }) => {
    if (data?.stats) callback(data.stats);
  };

  socket.on('playerStats', handler);

  return () => {
    socket?.off('playerStats', handler);
  };
}

// ============================================================
// LEADERBOARD
// ============================================================
export interface LeaderboardEntry {
  userId: string;
  username: string;
  avatar: string;
  wins: number;
  losses: number;
  ties: number;
  winRate: number;
  bestStreak: number;
  total: number;
}

export interface Leaderboard {
  topByWins: LeaderboardEntry[];
  topByWinRate: LeaderboardEntry[];
  topByStreak: LeaderboardEntry[];
}

export const EMPTY_LEADERBOARD: Leaderboard = {
  topByWins: [],
  topByWinRate: [],
  topByStreak: [],
};

export function getLeaderboardFromServer(): Promise<Leaderboard> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ ...EMPTY_LEADERBOARD });
      return;
    }

    let done = false;

    const handler = (data: Leaderboard) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      socket?.off('leaderboard', handler);
      resolve({
        topByWins: data?.topByWins || [],
        topByWinRate: data?.topByWinRate || [],
        topByStreak: data?.topByStreak || [],
      });
    };

    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      socket?.off('leaderboard', handler);
      resolve({ ...EMPTY_LEADERBOARD });
    }, 8000);

    socket.on('leaderboard', handler);
    socket.emit('getLeaderboard');
  });
}

// ============================================================
// AVATARS
// ============================================================
export interface ServerAvatar {
  id: string;
  userId: string;
  name: string;
  emoji: string;
  personality: {
    aggression: number;
    memory: number;
    randomness: number;
    defense: number;
  };
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
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export function getAvatarsFromServer(): Promise<ServerAvatar[]> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve([]);
      return;
    }

    let done = false;

    const handler = (data: { avatars: ServerAvatar[] }) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      socket?.off('avatars', handler);
      resolve(Array.isArray(data?.avatars) ? data.avatars : []);
    };

    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      socket?.off('avatars', handler);
      resolve([]);
    }, 6000);

    socket.on('avatars', handler);
    socket.emit('getAvatars');
  });
}

export function createAvatarOnServer(avatar: {
  name: string;
  emoji: string;
  personality?: {
    aggression: number;
    memory: number;
    randomness: number;
    defense: number;
  };
  defeatedMasters?: string[];
  imageUrl?: string | null;
}): Promise<{ success: boolean; avatar?: ServerAvatar; message?: string }> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, message: 'Not connected to server' });
      return;
    }

    let done = false;

    const onCreated = (data: { avatar: ServerAvatar }) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      socket?.off('avatarCreated', onCreated);
      socket?.off('avatarError', onError);
      resolve({ success: true, avatar: data.avatar });
    };

    const onError = (err: { action?: string; message?: string }) => {
      if (done) return;
      if (err?.action && err.action !== 'create') return;
      done = true;
      clearTimeout(timeout);
      socket?.off('avatarCreated', onCreated);
      socket?.off('avatarError', onError);
      resolve({ success: false, message: err?.message || 'Create failed' });
    };

    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      socket?.off('avatarCreated', onCreated);
      socket?.off('avatarError', onError);
      resolve({ success: false, message: 'Server did not respond' });
    }, 8000);

    socket.on('avatarCreated', onCreated);
    socket.on('avatarError', onError);
    socket.emit('createAvatar', { avatar });
  });
}

export function updateAvatarOnServer(
  avatarId: string,
  patch: Partial<{
    name: string;
    emoji: string;
    personality: ServerAvatar['personality'];
    rating: number;
    level: number;
    xp: number;
    winStreak: number;
    bestStreak: number;
    titles: string[];
    defeatedMasters: string[];
    imageUrl: string | null;
  }>
): Promise<{ success: boolean; avatar?: ServerAvatar; message?: string }> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, message: 'Not connected to server' });
      return;
    }

    let done = false;

    const onUpdated = (data: { avatar: ServerAvatar }) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      socket?.off('avatarUpdated', onUpdated);
      socket?.off('avatarError', onError);
      resolve({ success: true, avatar: data.avatar });
    };

    const onError = (err: { action?: string; message?: string }) => {
      if (done) return;
      if (err?.action && err.action !== 'update') return;
      done = true;
      clearTimeout(timeout);
      socket?.off('avatarUpdated', onUpdated);
      socket?.off('avatarError', onError);
      resolve({ success: false, message: err?.message || 'Update failed' });
    };

    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      socket?.off('avatarUpdated', onUpdated);
      socket?.off('avatarError', onError);
      resolve({ success: false, message: 'Server did not respond' });
    }, 8000);

    socket.on('avatarUpdated', onUpdated);
    socket.on('avatarError', onError);
    socket.emit('updateAvatar', { avatarId, patch });
  });
}

export function deleteAvatarOnServer(
  avatarId: string
): Promise<{ success: boolean; newSelectedId?: string | null; message?: string }> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, message: 'Not connected to server' });
      return;
    }

    let done = false;

    const onDeleted = (data: { avatarId: string; newSelectedId: string | null }) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      socket?.off('avatarDeleted', onDeleted);
      socket?.off('avatarError', onError);
      resolve({ success: true, newSelectedId: data.newSelectedId });
    };

    const onError = (err: { action?: string; message?: string }) => {
      if (done) return;
      if (err?.action && err.action !== 'delete') return;
      done = true;
      clearTimeout(timeout);
      socket?.off('avatarDeleted', onDeleted);
      socket?.off('avatarError', onError);
      resolve({ success: false, message: err?.message || 'Delete failed' });
    };

    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      socket?.off('avatarDeleted', onDeleted);
      socket?.off('avatarError', onError);
      resolve({ success: false, message: 'Server did not respond' });
    }, 8000);

    socket.on('avatarDeleted', onDeleted);
    socket.on('avatarError', onError);
    socket.emit('deleteAvatar', { avatarId });
  });
}

export function selectAvatarOnServer(
  avatarId: string
): Promise<{ success: boolean; message?: string }> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, message: 'Not connected to server' });
      return;
    }

    let done = false;

    const onAvatars = () => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      socket?.off('avatars', onAvatars);
      socket?.off('avatarError', onError);
      resolve({ success: true });
    };

    const onError = (err: { action?: string; message?: string }) => {
      if (done) return;
      if (err?.action && err.action !== 'select') return;
      done = true;
      clearTimeout(timeout);
      socket?.off('avatars', onAvatars);
      socket?.off('avatarError', onError);
      resolve({ success: false, message: err?.message || 'Select failed' });
    };

    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      socket?.off('avatars', onAvatars);
      socket?.off('avatarError', onError);
      resolve({ success: false, message: 'Server did not respond' });
    }, 8000);

    socket.on('avatars', onAvatars);
    socket.on('avatarError', onError);
    socket.emit('selectAvatar', { avatarId });
  });
}

export function onAvatarsUpdate(
  callback: (avatars: ServerAvatar[]) => void
): () => void {
  if (!socket) return () => {};

  const handler = (data: { avatars: ServerAvatar[] }) => {
    if (Array.isArray(data?.avatars)) callback(data.avatars);
  };

  socket.on('avatars', handler);

  return () => {
    socket?.off('avatars', handler);
  };
}

// ============================================================
// ACHIEVEMENTS
// ============================================================
export interface AchievementCatalogEntry {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  rule: string;
}

export interface AchievementUnlockEvent {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
}

export function getAchievementsFromServer(): Promise<Record<string, number>> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({});
      return;
    }

    let done = false;

    const handler = (data: { unlocked: Record<string, number> }) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      socket?.off('achievements', handler);
      resolve(data?.unlocked || {});
    };

    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      socket?.off('achievements', handler);
      resolve({});
    }, 6000);

    socket.on('achievements', handler);
    socket.emit('getAchievements');
  });
}

export function getAchievementCatalogFromServer(): Promise<
  AchievementCatalogEntry[]
> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve([]);
      return;
    }

    let done = false;

    const handler = (data: { catalog: AchievementCatalogEntry[] }) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      socket?.off('achievementCatalog', handler);
      resolve(Array.isArray(data?.catalog) ? data.catalog : []);
    };

    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      socket?.off('achievementCatalog', handler);
      resolve([]);
    }, 6000);

    socket.on('achievementCatalog', handler);
    socket.emit('getAchievementCatalog');
  });
}

export function onAchievementUnlocked(
  callback: (achievement: AchievementUnlockEvent) => void
): () => void {
  if (!socket) return () => {};

  const handler = (data: AchievementUnlockEvent) => {
    if (data?.id) callback(data);
  };

  socket.on('achievementUnlocked', handler);

  return () => {
    socket?.off('achievementUnlocked', handler);
  };
}

// ============================================================
// TOURNAMENTS (Chat 11)
// ============================================================

export type TournamentType = 'human' | 'avatar';
export type TournamentStatus = 'lobby' | 'live' | 'finished';

export interface TournamentConfig {
  type: TournamentType;
  maxPlayers: number;   // 2..32
  winTarget: number;    // 15..30
  autoAdvance: boolean;
  name?: string | null;
  isPrivate?: boolean;
}

export interface TournamentMatch {
  matchId: string;
  p1: string;
  p2: string;
  roomCode: string | null;
  winner: string | null;
  status: 'pending' | 'active' | 'complete';
  scores: { p1: number; p2: number; round: number };
}

export interface TournamentRound {
  roundNumber: number;
  bye: string | null;
  status: 'pending' | 'active' | 'complete';
  matches: TournamentMatch[];
}

export interface Tournament {
  id: string;
  code: string;
  hostId: string;
  type: TournamentType;
  maxPlayers: number;
  winTarget: number;
  autoAdvance: boolean;
  name: string | null;
  isPrivate: boolean;
  status: TournamentStatus;
  currentRound: number;
  colorMap: Record<string, string>;
  players: string[];
  winnerId: string | null;
  usernames: Record<string, string>;
  activeUserIds: string[];
  activeSecondsLeft: number;
  rounds: TournamentRound[];
}

export interface TournamentRewards {
  [userId: string]: {
    ratingDelta: number;
    xpDelta: number;
    title: string | null;
  };
}

export interface TournamentErrorPayload {
  action: string;
  message: string;
}

// ────────────────────────────────────────────────────────────
// One-shot request / response
// ────────────────────────────────────────────────────────────

export function createTournamentOnServer(
  cfg: TournamentConfig
): Promise<{ success: boolean; tournamentId?: string; code?: string; message?: string }> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      console.log('[TOURNAMENT CLIENT] create — not connected');
      resolve({ success: false, message: 'Not connected to server' });
      return;
    }
    console.log(
      '[TOURNAMENT CLIENT] create emit | socket:', socket.id,
      '| cfg:', JSON.stringify(cfg)
    );

    let done = false;

    const onCreated = (data: { tournamentId: string; code: string }) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      socket?.off('tournamentCreated', onCreated);
      socket?.off('tournamentError', onError);
      console.log(
        '[TOURNAMENT CLIENT] create recv tournamentCreated |',
        data.tournamentId, data.code
      );
      resolve({ success: true, tournamentId: data.tournamentId, code: data.code });
    };

    const onError = (err: { action?: string; message?: string }) => {
      if (done) return;
      if (err?.action && err.action !== 'create') return;
      done = true;
      clearTimeout(timeout);
      socket?.off('tournamentCreated', onCreated);
      socket?.off('tournamentError', onError);
      console.log('[TOURNAMENT CLIENT] create recv tournamentError |', err?.message);
      resolve({ success: false, message: err?.message || 'Create failed' });
    };

    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      socket?.off('tournamentCreated', onCreated);
      socket?.off('tournamentError', onError);
      console.log('[TOURNAMENT CLIENT] create — timeout');
      resolve({ success: false, message: 'Server did not respond' });
    }, 8000);

    socket.on('tournamentCreated', onCreated);
    socket.on('tournamentError', onError);
    socket.emit('createTournament', cfg);
  });
}

export function joinTournamentOnServer(
  code: string
): Promise<{
  success: boolean;
  tournamentId?: string;
  code?: string;
  message?: string;
}> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      console.log('[TOURNAMENT CLIENT] join — not connected');
      resolve({ success: false, message: 'Not connected to server' });
      return;
    }
    console.log(
      '[TOURNAMENT CLIENT] join emit | socket:', socket.id,
      '| code:', code
    );

    let done = false;

    const onJoined = (data: { tournamentId: string; code: string }) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      socket?.off('tournamentJoined', onJoined);
      socket?.off('tournamentError', onError);
      console.log(
        '[TOURNAMENT CLIENT] join recv tournamentJoined |',
        data.tournamentId, data.code
      );
      resolve({ success: true, tournamentId: data.tournamentId, code: data.code });
    };

    const onError = (err: { action?: string; message?: string }) => {
      if (done) return;
      if (err?.action && err.action !== 'join') return;
      done = true;
      clearTimeout(timeout);
      socket?.off('tournamentJoined', onJoined);
      socket?.off('tournamentError', onError);
      console.log('[TOURNAMENT CLIENT] join recv tournamentError |', err?.message);
      resolve({ success: false, message: err?.message || 'Join failed' });
    };

    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      socket?.off('tournamentJoined', onJoined);
      socket?.off('tournamentError', onError);
      console.log('[TOURNAMENT CLIENT] join — timeout');
      resolve({ success: false, message: 'Server did not respond' });
    }, 8000);

    socket.on('tournamentJoined', onJoined);
    socket.on('tournamentError', onError);
    socket.emit('joinTournament', { code });
  });
}

export function leaveTournamentOnServer(tournamentId: string): void {
  if (!socket?.connected) return;
  console.log('[TOURNAMENT CLIENT] leave emit |', tournamentId);
  socket.emit('leaveTournament', { tournamentId });
}

export function pressActiveOnServer(tournamentId: string): void {
  if (!socket?.connected) return;
  console.log('[TOURNAMENT CLIENT] pressActive emit |', tournamentId);
  socket.emit('pressActive', { tournamentId });
}

export function startTournamentOnServer(tournamentId: string): void {
  if (!socket?.connected) return;
  console.log('[TOURNAMENT CLIENT] start emit |', tournamentId);
  socket.emit('startTournament', { tournamentId });
}

export function beginNextRoundOnServer(tournamentId: string): void {
  if (!socket?.connected) return;
  console.log('[TOURNAMENT CLIENT] beginNextRound emit |', tournamentId);
  socket.emit('beginNextRound', { tournamentId });
}

export function getTournamentFromServer(params: {
  tournamentId?: string;
  code?: string;
}): Promise<Tournament | null> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      console.log('[TOURNAMENT CLIENT] getTournament — not connected');
      resolve(null);
      return;
    }
    console.log(
      '[TOURNAMENT CLIENT] getTournament emit | socket:', socket.id,
      '| params:', JSON.stringify(params)
    );

    let done = false;

    const handler = (data: Tournament | null) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      socket?.off('tournamentState', handler);
      if (data) {
        console.log(
          '[TOURNAMENT CLIENT] getTournament recv | id:', data.id,
          '| status:', data.status,
          '| round:', data.currentRound,
          '| players:', data.players?.length ?? 0,
          '| winTarget:', data.winTarget
        );
      } else {
        console.log('[TOURNAMENT CLIENT] getTournament recv null state');
      }
      resolve(data || null);
    };

    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      socket?.off('tournamentState', handler);
      console.log('[TOURNAMENT CLIENT] getTournament — timeout (no state received)');
      resolve(null);
    }, 6000);

    socket.on('tournamentState', handler);
    socket.emit('getTournament', params);
  });
}

// ────────────────────────────────────────────────────────────
// Subscriptions — one per server → client broadcast.
// Every helper returns an unsubscribe function.
// ────────────────────────────────────────────────────────────

export function onTournamentState(
  callback: (state: Tournament) => void
): () => void {
  if (!socket) return () => {};
  const handler = (state: Tournament | null) => {
    if (state) {
      console.log(
        '[TOURNAMENT CLIENT] recv tournamentState | status:', state.status,
        '| round:', state.currentRound,
        '| players:', state.players?.length ?? 0,
        '| activeSet:', state.activeUserIds?.length ?? 0,
        '| activeSecondsLeft:', state.activeSecondsLeft
      );
      callback(state);
    }
  };
  socket.on('tournamentState', handler);
  return () => {
    socket?.off('tournamentState', handler);
  };
}

export function onTournamentStarted(
  callback: (data: { colorMap: Record<string, string> }) => void
): () => void {
  if (!socket) return () => {};
  const handler = (data: { colorMap: Record<string, string> }) => {
    if (data?.colorMap) {
      console.log(
        '[TOURNAMENT CLIENT] recv tournamentStarted | colors:',
        Object.keys(data.colorMap).length
      );
      callback(data);
    }
  };
  socket.on('tournamentStarted', handler);
  return () => {
    socket?.off('tournamentStarted', handler);
  };
}

export interface RoundStartedPayload {
  roundNumber: number;
  bye: string | null;
  matches: {
    matchId: string;
    p1: string;
    p2: string;
    roomCode: string | null;
    status: 'pending' | 'active' | 'complete';
  }[];
  activeWindowMs?: number;
}

export function onRoundStarted(
  callback: (payload: RoundStartedPayload) => void
): () => void {
  if (!socket) return () => {};
  const handler = (payload: RoundStartedPayload) => {
    if (payload?.roundNumber) {
      console.log(
        '[TOURNAMENT CLIENT] recv roundStarted | round:', payload.roundNumber,
        '| matches:', payload.matches?.length ?? 0,
        '| bye:', payload.bye,
        '| windowMs:', payload.activeWindowMs
      );
      callback(payload);
    }
  };
  socket.on('roundStarted', handler);
  return () => {
    socket?.off('roundStarted', handler);
  };
}

export function onActiveWindowUpdate(
  callback: (data: { secondsLeft: number }) => void
): () => void {
  if (!socket) return () => {};
  const handler = (data: { secondsLeft: number }) => {
    if (typeof data?.secondsLeft === 'number') {
      // Log only every 10s to avoid drowning the console.
      if (data.secondsLeft % 10 === 0 || data.secondsLeft <= 5) {
        console.log(
          '[TOURNAMENT CLIENT] recv activeWindowUpdate | secondsLeft:',
          data.secondsLeft
        );
      }
      callback(data);
    }
  };
  socket.on('activeWindowUpdate', handler);
  return () => {
    socket?.off('activeWindowUpdate', handler);
  };
}

export function onPlayerActive(
  callback: (data: { userId: string; color: string | null }) => void
): () => void {
  if (!socket) return () => {};
  const handler = (data: { userId: string; color: string | null }) => {
    if (data?.userId) {
      console.log('[TOURNAMENT CLIENT] recv playerActive | userId:', data.userId);
      callback(data);
    }
  };
  socket.on('playerActive', handler);
  return () => {
    socket?.off('playerActive', handler);
  };
}

export function onPlayerInactive(
  callback: (data: { userId: string; reason: string }) => void
): () => void {
  if (!socket) return () => {};
  const handler = (data: { userId: string; reason: string }) => {
    if (data?.userId) {
      console.log(
        '[TOURNAMENT CLIENT] recv playerInactive | userId:', data.userId,
        '| reason:', data.reason
      );
      callback(data);
    }
  };
  socket.on('playerInactive', handler);
  return () => {
    socket?.off('playerInactive', handler);
  };
}

export function onHostChanged(
  callback: (data: { newHostId: string }) => void
): () => void {
  if (!socket) return () => {};
  const handler = (data: { newHostId: string }) => {
    if (data?.newHostId) {
      console.log('[TOURNAMENT CLIENT] recv hostChanged | newHost:', data.newHostId);
      callback(data);
    }
  };
  socket.on('hostChanged', handler);
  return () => {
    socket?.off('hostChanged', handler);
  };
}

export function onMatchAssigned(
  callback: (data: {
    matchId: string;
    roomCode: string;
    opponentUserId: string;
  }) => void
): () => void {
  if (!socket) return () => {};
  const handler = (data: {
    matchId: string;
    roomCode: string;
    opponentUserId: string;
  }) => {
    if (data?.matchId && data?.roomCode) {
      console.log(
        '[TOURNAMENT CLIENT] recv matchAssigned | match:', data.matchId,
        '| room:', data.roomCode,
        '| opponent:', data.opponentUserId
      );
      callback(data);
    }
  };
  socket.on('matchAssigned', handler);
  return () => {
    socket?.off('matchAssigned', handler);
  };
}

export interface TournamentScoresPayload {
  [matchId: string]: {
    p1: string;
    p2: string;
    scores: { p1: number; p2: number; round: number };
    round: number;
    status: 'pending' | 'active' | 'complete';
  };
}

export function onTournamentScoresUpdate(
  callback: (scores: TournamentScoresPayload) => void
): () => void {
  if (!socket) return () => {};
  const handler = (scores: TournamentScoresPayload) => {
    if (scores && typeof scores === 'object') {
      console.log(
        '[TOURNAMENT CLIENT] recv tournamentScoresUpdate | matches:',
        Object.keys(scores).length
      );
      callback(scores);
    }
  };
  socket.on('tournamentScoresUpdate', handler);
  return () => {
    socket?.off('tournamentScoresUpdate', handler);
  };
}

export function onRoundComplete(
  callback: (data: {
    roundNumber: number;
    winners: string[];
    nextRound: number | null;
  }) => void
): () => void {
  if (!socket) return () => {};
  const handler = (data: {
    roundNumber: number;
    winners: string[];
    nextRound: number | null;
  }) => {
    if (typeof data?.roundNumber === 'number') {
      console.log(
        '[TOURNAMENT CLIENT] recv roundComplete | round:', data.roundNumber,
        '| winners:', data.winners?.length ?? 0,
        '| nextRound:', data.nextRound
      );
      callback(data);
    }
  };
  socket.on('roundComplete', handler);
  return () => {
    socket?.off('roundComplete', handler);
  };
}

export function onTournamentComplete(
  callback: (data: {
    winnerId: string | null;
    rewards: TournamentRewards;
  }) => void
): () => void {
  if (!socket) return () => {};
  const handler = (data: {
    winnerId: string | null;
    rewards: TournamentRewards;
  }) => {
    if (data && (data.winnerId !== undefined)) {
      console.log(
        '[TOURNAMENT CLIENT] recv tournamentComplete | winner:', data.winnerId,
        '| rewards:', Object.keys(data.rewards || {}).length
      );
      callback(data);
    }
  };
  socket.on('tournamentComplete', handler);
  return () => {
    socket?.off('tournamentComplete', handler);
  };
}

// NEW: server-side tournament errors.
export function onTournamentError(
  callback: (err: TournamentErrorPayload) => void
): () => void {
  if (!socket) return () => {};
  const handler = (err: TournamentErrorPayload) => {
    if (err && typeof err.message === 'string') {
      console.log(
        '[TOURNAMENT CLIENT] recv tournamentError | action:', err.action,
        '| message:', err.message
      );
      callback(err);
    }
  };
  socket.on('tournamentError', handler);
  return () => {
    socket?.off('tournamentError', handler);
  };
}

// NEW: match cancelled by the tournament engine (walkover, active
// timeout). Emitted to the room by _cancelTournamentRoom.
export function onMatchCancelled(
  callback: (data: {
    winnerId: string | null;
    winnerSocketId: string | null;
    reason: string;
  }) => void
): () => void {
  if (!socket) return () => {};
  const handler = (data: {
    winnerId: string | null;
    winnerSocketId: string | null;
    reason: string;
  }) => {
    if (data) {
      console.log(
        '[TOURNAMENT CLIENT] recv matchCancelled | winner:', data.winnerId,
        '| winnerSocket:', data.winnerSocketId,
        '| reason:', data.reason
      );
      callback(data);
    }
  };
  socket.on('matchCancelled', handler);
  return () => {
    socket?.off('matchCancelled', handler);
  };
}