// src/services/identity.ts
//
// RPS Arena — lightweight identity cache (Chat 9 rewrite).
//
// This file used to be the source of truth for auth: it stored
// { userId, token, username, avatar } and drove the server-side
// registerIdentity handshake.
//
// After Chat 9, Supabase Auth is the source of truth. This module
// is now ONLY a local cache so the app can render something before
// the Supabase session resolves (offline / slow network).
//
// The cache shape is deliberately a subset:
//   { userId, username, avatar, createdAt? }
//
// Legacy records (from the pre-Chat-9 custom token system) still
// have a `token` field. Those are detected by `isLegacyIdentity`
// and reported to App.tsx so it can call `migrateLegacyToken` on
// the server before continuing. After a successful migration, the
// cache is overwritten with a new record that has no `token`.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const IDENTITY_KEY = '@rps_identity';

export interface UserIdentity {
  userId: string;
  username: string;
  avatar: string;
  createdAt?: number;
  // Present ONLY on pre-Chat-9 records. Should never be written by
  // post-Chat-9 code. Used purely to detect legacy clients that
  // need server-side migration.
  token?: string;
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
 * Load the raw identity record from storage.
 *
 * Unlike the pre-Chat-9 version, this does NOT reject records just
 * because they lack a token. A record without a token is the new
 * normal. A record WITH a token is a legacy record that will be
 * migrated by App.tsx.
 *
 * Returns null if nothing is stored or the stored value is malformed.
 */
export async function loadIdentity(): Promise<UserIdentity | null> {
  try {
    const stored = await storage.get(IDENTITY_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') return null;

    // Must at least have a userId to be useful. Anything else, treat
    // as absent.
    if (typeof parsed.userId !== 'string' || !parsed.userId) return null;

    const out: UserIdentity = {
      userId: parsed.userId,
      username:
        typeof parsed.username === 'string' && parsed.username
          ? parsed.username
          : 'Player',
      avatar:
        typeof parsed.avatar === 'string' && parsed.avatar
          ? parsed.avatar
          : '🤖',
    };

    if (typeof parsed.createdAt === 'number') {
      out.createdAt = parsed.createdAt;
    }

    // Preserve a legacy token if present so callers can migrate.
    if (typeof parsed.token === 'string' && parsed.token) {
      out.token = parsed.token;
    }

    return out;
  } catch {
    return null;
  }
}

/**
 * Persist the cache. Callers should NOT include a `token` field —
 * doing so would re-mark the record as legacy on the next load.
 * The function strips `token` defensively.
 */
export async function saveIdentity(identity: UserIdentity): Promise<void> {
  const clean: UserIdentity = {
    userId: identity.userId,
    username: identity.username,
    avatar: identity.avatar,
  };
  if (typeof identity.createdAt === 'number') {
    clean.createdAt = identity.createdAt;
  }
  await storage.set(IDENTITY_KEY, JSON.stringify(clean));
}

/**
 * Partial update. Reads the current record (which may be a legacy
 * record — we do NOT want to accidentally wipe the token before
 * migration runs), merges, and writes back.
 *
 * If the updates object contains `token: undefined`, the field is
 * dropped — that's how migration clears the legacy marker.
 */
export async function updateIdentity(
  updates: Partial<UserIdentity>
): Promise<UserIdentity | null> {
  const current = await loadIdentity();
  if (!current) return null;

  const merged: UserIdentity = { ...current, ...updates };

  // Allow callers to explicitly remove the legacy token by passing
  // `{ token: undefined }`. TS treats `undefined` as "no key" for
  // JSON.stringify, so this works naturally.
  if (merged.token === undefined) {
    delete (merged as any).token;
  }

  // Strip undefined values so JSON.stringify doesn't silently drop
  // fields we care about.
  const cleaned: UserIdentity = {
    userId: merged.userId,
    username: merged.username,
    avatar: merged.avatar,
  };
  if (typeof merged.createdAt === 'number') {
    cleaned.createdAt = merged.createdAt;
  }
  if (typeof merged.token === 'string' && merged.token) {
    cleaned.token = merged.token;
  }

  await storage.set(IDENTITY_KEY, JSON.stringify(cleaned));
  return cleaned;
}

/**
 * Remove the cache entirely. Called on logout and after a
 * sessionReplaced kick.
 */
export async function clearIdentity(): Promise<void> {
  await storage.remove(IDENTITY_KEY);
}

/**
 * True if this record predates Chat 9 (has a custom token).
 * Used by App.tsx to decide whether to run the server-side
 * migrateLegacyToken flow before booting.
 */
export function isLegacyIdentity(identity: UserIdentity | null): boolean {
  return !!(identity && typeof identity.token === 'string' && identity.token);
}