// src/services/supabase.ts
//
// RPS Arena — Supabase client + auth helpers.
//
// Chat 9:   initial.
// Chat 9b:
//   - emailRedirectTo: window.location.origin on updateUser({ email })
//     and resetPasswordForEmail, so email links land on the deployed
//     origin instead of localhost.
//   - signInAnonymously now passes user_metadata { username, avatar }
//     so the handle_new_user trigger seeds profiles with a real name.
//   - linkEmailPassword syncs profiles.username after the link (RLS
//     allows updating your own row; premium fields are blocked).
//   - generateDefaultUsername() helper for guest names.
//
// Env vars (client — add to .env at the project root):
//   EXPO_PUBLIC_SUPABASE_URL
//   EXPO_PUBLIC_SUPABASE_ANON_KEY

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  createClient,
  SupabaseClient,
  Session,
  User,
  AuthChangeEvent,
} from '@supabase/supabase-js';

// ──────────────────────────────────────────────────────────────
// Env
// ──────────────────────────────────────────────────────────────
declare const process: {
  env: {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
  };
};

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.error(
    '[SUPABASE] Missing EXPO_PUBLIC_SUPABASE_URL or ' +
    'EXPO_PUBLIC_SUPABASE_ANON_KEY. Set both before build.'
  );
}

// Web-only redirect target. On native this is undefined and
// Supabase ignores the option (deep-link config is a later chat).
function getWebOrigin(): string | undefined {
  if (Platform.OS !== 'web') return undefined;
  try {
    const loc = (globalThis as any).location;
    if (loc && typeof loc.origin === 'string' && loc.origin) {
      return loc.origin;
    }
  } catch {}
  return undefined;
}

// ──────────────────────────────────────────────────────────────
// Storage adapter
// ──────────────────────────────────────────────────────────────
const win = globalThis as any;

const SupabaseStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return win.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    }
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        win.localStorage?.setItem(key, value);
      } catch {}
    } else {
      await AsyncStorage.setItem(key, value);
    }
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        win.localStorage?.removeItem(key);
      } catch {}
    } else {
      await AsyncStorage.removeItem(key);
    }
  },
};

// ──────────────────────────────────────────────────────────────
// Client
// ──────────────────────────────────────────────────────────────
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: SupabaseStorageAdapter,
      storageKey: '@rps_supabase_auth',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  }
);

// ──────────────────────────────────────────────────────────────
// Profile shape
// ──────────────────────────────────────────────────────────────
export interface SupabaseProfile {
  id: string;
  username: string | null;
  avatar: string | null;
  is_premium: boolean;
  premium_since: string | null;
  created_at: string;
  updated_at: string;
}

// ──────────────────────────────────────────────────────────────
// Default username generator
// ──────────────────────────────────────────────────────────────
// Produces something like 'player4729'. Length is 6 + 4 = 10 chars,
// within the 3-15 server normalization window. Lowercase because the
// server normalizes to lowercase anyway.
export function generateDefaultUsername(): string {
  const n = Math.floor(Math.random() * 9000) + 1000;
  return `player${n}`;
}

export function generateDefaultAvatar(): string {
  // Small set of starter emojis — stable, deterministic, no deps.
  const opts = ['🤖', '🐉', '🦊', '🐼', '🦉', '🐙', '🦁', '🐺'];
  return opts[Math.floor(Math.random() * opts.length)];
}

// ──────────────────────────────────────────────────────────────
// Session helpers
// ──────────────────────────────────────────────────────────────

/**
 * Return the current session, or create an anonymous one if none
 * exists. Passes a generated username + avatar in user_metadata so
 * the handle_new_user trigger seeds profiles with a real name
 * (Chat 9b — Bug 2 fix).
 */
export async function ensureSession(): Promise<Session | null> {
  try {
    const { data: existing, error: getErr } = await supabase.auth.getSession();
    if (getErr) {
      // eslint-disable-next-line no-console
      console.error('[SUPABASE] getSession error:', getErr.message);
    }
    if (existing?.session) return existing.session;

    const username = generateDefaultUsername();
    const avatar = generateDefaultAvatar();

    const { data, error } = await supabase.auth.signInAnonymously({
      options: {
        data: { username, avatar },
      },
    });

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[SUPABASE] signInAnonymously error:', error.message);
      return null;
    }
    return data?.session || null;
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[SUPABASE] ensureSession error:', e?.message || e);
    return null;
  }
}

export async function getAccessToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[SUPABASE] getAccessToken error:', error.message);
      return null;
    }
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user || null;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────
// Auth flows
// ──────────────────────────────────────────────────────────────

/**
 * Upgrade an anonymous user to an email/password account.
 * Same userId preserved — no data loss.
 *
 * `emailRedirectTo` is set to the current web origin so the
 * confirmation email returns to the deployed site, not localhost.
 *
 * After the update, if `username` was provided, sync profiles.username
 * directly (RLS allows updating your own row; premium fields are
 * blocked by the WITH CHECK policy).
 */
export async function linkEmailPassword(
  email: string,
  password: string,
  username?: string,
  avatar?: string
): Promise<{ success: boolean; message?: string; needsConfirmation?: boolean }> {
  try {
    const { data, error } = await supabase.auth.updateUser(
      {
        email,
        password,
        data: {
          ...(username ? { username } : {}),
          ...(avatar ? { avatar } : {}),
        },
      },
      {
        emailRedirectTo: getWebOrigin(),
      }
    );
    if (error) return { success: false, message: error.message };

    // If the trigger had previously seeded profiles with a
    // placeholder, refresh profiles now so username/avatar match.
    if (username) {
      try {
        const uid = data?.user?.id;
        if (uid) {
          await supabase
            .from('profiles')
            .update({
              username,
              ...(avatar ? { avatar } : {}),
            })
            .eq('id', uid);
        }
      } catch (e: any) {
        // Non-fatal — server will re-sync on next identify.
        // eslint-disable-next-line no-console
        console.error('[SUPABASE] profile sync after link failed:', e?.message);
      }
    }

    const needsConfirmation = !data?.user?.email_confirmed_at;
    return { success: true, needsConfirmation };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Linking failed' };
  }
}

/**
 * Login with email + password (new device).
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { success: false, message: error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Login failed' };
  }
}

/**
 * Send a password reset email.
 * Redirects back to the deployed origin on web.
 */
export async function sendPasswordReset(
  email: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getWebOrigin(),
    });
    if (error) return { success: false, message: error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Reset request failed' };
  }
}

/**
 * Complete a password reset. Called with a recovery session active.
 */
export async function completePasswordReset(
  newPassword: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) return { success: false, message: error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Reset failed' };
  }
}

/**
 * Sign out ONLY this device.
 */
export async function signOutLocal(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[SUPABASE] signOutLocal error:', e?.message || e);
  }
}

/**
 * Full sign out (this device).
 */
export async function signOut(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[SUPABASE] signOut error:', e?.message || e);
  }
}

// ──────────────────────────────────────────────────────────────
// Profile reads
// ──────────────────────────────────────────────────────────────

export async function fetchProfile(): Promise<SupabaseProfile | null> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;
    if (!uid) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar, is_premium, premium_since, created_at, updated_at')
      .eq('id', uid)
      .maybeSingle();

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[SUPABASE] fetchProfile error:', error.message);
      return null;
    }
    return (data as SupabaseProfile) || null;
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[SUPABASE] fetchProfile exception:', e?.message || e);
    return null;
  }
}

export async function fetchIsPremium(): Promise<boolean> {
  const p = await fetchProfile();
  return !!(p && p.is_premium);
}

// ──────────────────────────────────────────────────────────────
// Auth state subscription
// ──────────────────────────────────────────────────────────────
export type { AuthChangeEvent };

export function onAuthStateChange(
  cb: (event: AuthChangeEvent, session: Session | null) => void
) {
  return supabase.auth.onAuthStateChange((event, session) => {
    cb(event, session);
  });
}