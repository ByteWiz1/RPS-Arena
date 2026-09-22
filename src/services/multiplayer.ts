import { io, Socket } from 'socket.io-client';
import { UserIdentity } from './identity';

let socket: Socket | null = null;
const SERVER_URL = 'https://rps-arena-server-2mxh.onrender.com';

export function connectToServer(identity?: UserIdentity | null): Promise<Socket> {
  return new Promise((resolve, reject) => {
    if (socket?.connected) {
      if (identity) {
        socket.emit('registerIdentity', {
          userId: identity.userId,
          username: identity.username,
          avatar: identity.avatar,
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
      if (identity) {
        socket!.emit('registerIdentity', {
          userId: identity.userId,
          username: identity.username,
          avatar: identity.avatar,
        });
      }
      resolve(socket!);
    });

    socket.on('connect_error', (error) => {
      reject(error);
    });
  });
}

export function registerIdentityOnServer(identity: UserIdentity): void {
  if (socket?.connected) {
    socket.emit('registerIdentity', {
      userId: identity.userId,
      username: identity.username,
      avatar: identity.avatar,
    });
  }
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
// 🆕 CHANGE USERNAME
// ============================================================
export function changeUsernameOnServer(
  userId: string,
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
    socket.emit('changeUsername', { userId, newUsername });
  });
}

// ============================================================
// 🆕 DELETE ACCOUNT
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
// 🆕 MATCH HISTORY
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
// 🆕 PLAYER STATS
// ============================================================
export interface PlayerStats {
  wins: number;
  losses: number;
  ties: number;
  total: number;
}

export function getPlayerStatsFromServer(): Promise<PlayerStats> {
  return new Promise((resolve) => {
    const empty: PlayerStats = { wins: 0, losses: 0, ties: 0, total: 0 };

    if (!socket?.connected) {
      resolve(empty);
      return;
    }

    let done = false;

    const handler = (data: { stats: PlayerStats }) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      socket?.off('playerStats', handler);
      resolve(data.stats || empty);
    };

    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      socket?.off('playerStats', handler);
      resolve(empty);
    }, 6000);

    socket.on('playerStats', handler);
    socket.emit('getPlayerStats');
  });
}

// ============================================================
// 🆕 LISTEN FOR PUSHED STATS (auto-updated on match end)
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