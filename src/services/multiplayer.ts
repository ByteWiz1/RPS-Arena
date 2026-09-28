import { io, Socket } from 'socket.io-client';
import { UserIdentity } from './identity';

let socket: Socket | null = null;
const SERVER_URL = 'https://rps-arena-server-2mxh.onrender.com';

/**
 * Connect to the server.
 *
 * If `identity` is provided AND we are establishing a brand-new socket,
 * the identity will be auto-registered on connect (fire-and-forget).
 * Pass `null` / omit `identity` if you intend to drive registration
 * yourself via `registerOrRestoreIdentity` (recommended at app startup).
 */
export function connectToServer(identity?: UserIdentity | null): Promise<Socket> {
  return new Promise((resolve, reject) => {
    if (socket?.connected) {
      if (identity && (identity.token || identity.username)) {
        socket.emit('registerIdentity', {
          token: identity.token || null,
          username: identity.username || undefined,
          avatar: identity.avatar || undefined,
        });
      }
      resolve(socket);
      return;
    }

    socket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 60000,
    });

    socket.on('connect', () => {
      if (identity && (identity.token || identity.username)) {
        socket!.emit('registerIdentity', {
          token: identity.token || null,
          username: identity.username || undefined,
          avatar: identity.avatar || undefined,
        });
      }
      resolve(socket!);
    });

    socket.on('connect_error', (error) => {
      reject(error);
    });
  });
}

/**
 * Fire-and-forget re-registration on an already-connected socket.
 * Sends token (if present) so the server can restore the same userId.
 */
export function registerIdentityOnServer(identity: UserIdentity): void {
  if (socket?.connected) {
    socket.emit('registerIdentity', {
      token: identity.token || null,
      username: identity.username || undefined,
      avatar: identity.avatar || undefined,
    });
  }
}

/**
 * Startup flow: connect (no auto-register), then perform the
 * registerIdentity ↔ identityRegistered handshake and resolve with the
 * server-issued identity.
 *
 * - If `identity` has a token → server restores the same userId.
 * - If `identity` has no token (fresh shell) → server issues a new userId+token.
 *
 * Resolves with `{ userId, token, username, avatar }`.
 * Rejects on `identityError` or after an 8s timeout.
 */
export function registerOrRestoreIdentity(
  identity?: UserIdentity | null
): Promise<{ userId: string; token: string; username: string; avatar: string }> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (
      fn: () => void
    ) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket?.off('identityRegistered', onRegistered);
      socket?.off('identityError', onError);
      fn();
    };

    const onRegistered = (data: {
      userId: string;
      token: string;
      username: string;
      avatar: string;
    }) => {
      finish(() => resolve(data));
    };

    const onError = (err: { message?: string }) => {
      finish(() => reject(new Error(err?.message || 'Identity registration failed')));
    };

    const timeout = setTimeout(() => {
      finish(() => reject(new Error('Identity registration timed out')));
    }, 8000);

    // Ensure a socket exists WITHOUT auto-registering (pass null).
    connectToServer(null)
      .then((s) => {
        if (settled) return;
        s.on('identityRegistered', onRegistered);
        s.on('identityError', onError);
        s.emit('registerIdentity', {
          token: identity?.token || null,
          username: identity?.username || undefined,
          avatar: identity?.avatar || undefined,
        });
      })
      .catch((e) => {
        finish(() => reject(e));
      });
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

// ============================================================
// CHANGE USERNAME  (server resolves caller via token)
// ============================================================
export function changeUsernameOnServer(
  newUsername: string
): Promise<{ success: boolean; username?: string; message?: string }> {
  return new Promise((resolve) => {
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
      resolve(result);
    };

    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      socket?.off('changeUsernameResult', handler);
      resolve({ success: false, message: 'Server did not respond' });
    }, 8000);

    socket.on('changeUsernameResult', handler);
    socket.emit('changeUsername', { newUsername });
  });
}

// ============================================================
// DELETE ACCOUNT  (server resolves caller via token)
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
  // overall
  wins: number;
  losses: number;
  ties: number;
  total: number;
  // per-mode (Chat 2)
  humanWins: number;
  humanLosses: number;
  humanTies: number;
  avatarWins: number;
  avatarLosses: number;
  avatarTies: number;
  dojoWins: number;
  dojoLosses: number;
  dojoTies: number;
  // overall streaks (Chat 2)
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
// LISTEN FOR PUSHED STATS (auto-updated on match end)
// ============================================================
export function onPlayerStatsUpdate(
  callback: (stats: PlayerStats) => void
): () => void {
  if (!socket) return () => {};

  const handler = (data: { stats: PlayerStats }) => {
    if (data?.stats) callback(data.stats);
  };

  socket.on('playerStats', handler);

  // Return unsubscribe
  return () => {
    socket?.off('playerStats', handler);
  };
}

// ============================================================
// LEADERBOARD  (pull-based — client asks on demand)
// ============================================================
export interface LeaderboardEntry {
  userId: string;
  username: string;
  avatar: string;
  wins: number;
  losses: number;
  ties: number;
  winRate: number; // 0..1
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

/**
 * Fetch the leaderboard from the server.
 * Resolves with an empty leaderboard if not connected or on timeout.
 * Call this when the leaderboard screen mounts.
 */
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