import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const IDENTITY_KEY = '@rps_identity';

export interface UserIdentity {
  userId: string;
  username: string;
  avatar: string;
  createdAt: number;
}

function generateUUID(): string {
  return (
    'user_' +
    Date.now().toString(36) +
    Math.random().toString(36).substring(2, 10)
  );
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

export async function loadIdentity(): Promise<UserIdentity | null> {
  try {
    const stored = await storage.get(IDENTITY_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (!parsed.userId || !parsed.username) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveIdentity(identity: UserIdentity): Promise<void> {
  await storage.set(IDENTITY_KEY, JSON.stringify(identity));
}

export async function createIdentity(
  username: string,
  avatar: string = '🤖'
): Promise<UserIdentity> {
  const identity: UserIdentity = {
    userId: generateUUID(),
    username: username.trim().slice(0, 15),
    avatar,
    createdAt: Date.now(),
  };
  await saveIdentity(identity);
  return identity;
}

export async function updateIdentity(
  updates: Partial<UserIdentity>
): Promise<UserIdentity | null> {
  const current = await loadIdentity();
  if (!current) return null;
  const updated = { ...current, ...updates };
  await saveIdentity(updated);
  return updated;
}

export async function clearIdentity(): Promise<void> {
  await storage.remove(IDENTITY_KEY);
}