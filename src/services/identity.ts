import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const IDENTITY_KEY = '@rps_identity';

export interface UserIdentity {
  userId: string;
  token: string;
  username: string;
  avatar: string;
  createdAt: number;
}

const win = globalThis as any;

const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return win.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    }
    return AsyncStorage.getItem(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        win.localStorage?.setItem(key, value);
      } catch {}
    } else {
      await AsyncStorage.setItem(key, value);
    }
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        win.localStorage?.removeItem(key);
      } catch {}
    } else {
      await AsyncStorage.removeItem(key);
    }
  },
};

/**
 * Load the stored identity.
 *
 * A stored identity is only considered valid if it has BOTH a token and a
 * username. Anything else (e.g. a pre-token legacy record) is treated as
 * "no identity" so the app can go through fresh server registration.
 */
export async function loadIdentity(): Promise<UserIdentity | null> {
  try {
    const stored = await storage.get(IDENTITY_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.token || !parsed.username) return null;
    if (!parsed.userId || !parsed.avatar) return null;
    return parsed as UserIdentity;
  } catch {
    return null;
  }
}

export async function saveIdentity(identity: UserIdentity): Promise<void> {
  await storage.set(IDENTITY_KEY, JSON.stringify(identity));
}

/**
 * Create a local identity SHELL for a first-time user.
 *
 * No userId and no token are generated here — the server owns those.
 * The shell only carries the user's chosen username + avatar so that
 * `registerOrRestoreIdentity` has something to send on the very first
 * `registerIdentity` call.
 *
 * After the server responds with `identityRegistered`, the caller must
 * `updateIdentity({ userId, token, ... })` (or `saveIdentity`) to persist
 * the server-issued credentials.
 */
export async function createIdentity(
  username: string,
  avatar: string = '🤖'
): Promise<UserIdentity> {
  const shell: UserIdentity = {
    userId: '',
    token: '',
    username: username.trim().slice(0, 15),
    avatar,
    createdAt: Date.now(),
  };
  await saveIdentity(shell);
  return shell;
}

export async function updateIdentity(
  updates: Partial<UserIdentity>
): Promise<UserIdentity | null> {
  const current = await loadIdentity();
  // Allow updating even from a shell (which loadIdentity rejects) by
  // reading raw storage when loadIdentity returns null.
  let base: UserIdentity | null = current;
  if (!base) {
    try {
      const stored = await storage.get(IDENTITY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          base = parsed as UserIdentity;
        }
      }
    } catch {
      // fall through
    }
  }
  if (!base) return null;

  const updated: UserIdentity = { ...base, ...updates };
  await saveIdentity(updated);
  return updated;
}

export async function clearIdentity(): Promise<void> {
  await storage.remove(IDENTITY_KEY);
}