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
// Chat 12a:
//   - ensureSession() REMOVED. It was the auto-guest-on-boot path.
//     Replaced by:
//       getExistingSession()  — read-only, returns null if none.
//       signInAnonymously()   — explicit opt-in, called only from
//                               OnboardingScreen (Guest + Sign Up)
//                               and never from App boot.
//   - SupabaseProfile gains email + is_guest.
//   - fetchProfile selects email + is_guest.
//   - New markProfileAsMember(email) — updates profiles.email and
//     flips is_guest to false. Kept here so SignupLinkScreen and any
//     future email-change flow have one place to call. (SignupLink
//     currently writes directly, but this helper is the canonical
//     entry point going forward.)
//   - New signInWithEmailOrUsername(identifier, password) — if
//     identifier contains '@', signs in as email; else resolves the
//     username via the socket helper (multiplayer.ts) and signs in
//     with the resolved email. Normalizes all failures to
//     "Invalid credentials".
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
  email: string | null;
  is_guest: boolean;
  created_at: string;
  updated_at: string;
}

// ──────────────────────────────────────────────────────────────
// Default username / avatar generators
// ──────────────────────────────────────────────────────────────
// Used ONLY by signInAnonymously when the caller does not provide
// explicit metadata. Produces something like 'guest4729'. Length
// is 6 + 4 = 10 chars, within the 3-15 normalization window.
// Lowercase because the server normalizes to lowercase anyway.
//
// NOTE: the handle_new_user trigger also produces a 'Guest_XXXX'
// placeholder for anonymous inserts when metadata.username is null.
// Whichever one lands first wins; the server's identify path
// resolves collisions. This generator is kept so the metadata
// payload is always non-empty and predictable.
export function generateDefaultUsername(): string {
  const n = Math.floor(Math.random() * 9000) + 1000;
  return `guest${n}`;
}

export function generateDefaultAvatar(): string {
  const opts = ['🤖', '🐉', '🦊', '🐼', '🦉', '🐙', '🦁', '🐺'];
  return opts[Math.floor(Math.random() * opts.length)];
}

// ──────────────────────────────────────────────────────────────
// Session helpers
// ──────────────────────────────────────────────────────────────

/**
 * Read-only. Returns the current Supabase session, or null if none.
 *
 * Chat 12a — this REPLACES ensureSession(). It never creates an
 * anonymous session. App.tsx boot and userStore.bootstrapAuth use
 * this; if it returns null, the app renders Onboarding.
 */
export async function getExistingSession(): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[SUPABASE] getExistingSession error:', error.message);
      return null;
    }
    return data?.session || null;
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[SUPABASE] getExistingSession exception:', e?.message || e);
    return null;
  }
}

/**
 * Chat 12a — explicit anonymous sign-in.
 *
 * Called ONLY from OnboardingScreen:
 *   - "Continue as Guest" button
 *   - "Sign Up" button (creates a session first, then routes to
 *     SignupLinkScreen, which needs an existing session to link)
 *
 * Never called from App boot. Never called by bootstrapAuth.
 *
 * Passes user_metadata { username, avatar } so the handle_new_user
 * trigger seeds profiles with a real name.
 */
export async function signInAnonymously(opts?: {
  username?: string;
  avatar?: string;
}): Promise<{ success: boolean; session: Session | null; message?: string }> {
  try {
    const existing = await getExistingSession();
    if (existing) {
      // Already have a session — return it, do not create a new one.
      // This can happen if the user double-taps the Guest button or
      // if a session was created by another tab.
      return { success: true, session: existing };
    }

    const username = opts?.username || generateDefaultUsername();
    const avatar = opts?.avatar || generateDefaultAvatar();

    const { data, error } = await supabase.auth.signInAnonymously({
      options: {
        data: { username, avatar },
      },
    });

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[SUPABASE] signInAnonymously error:', error.message);
      return { success: false, session: null, message: error.message };
    }

    return { success: true, session: data?.session || null };
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[SUPABASE] signInAnonymously exception:', e?.message || e);
    return {
      success: false,
      session: null,
      message: e?.message || 'Could not start a session',
    };
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
 *
 * REQUIRES an existing session. Under Chat 12a's Option 1 flow,
 * OnboardingScreen creates an anonymous session before routing the
 * user here, so this precondition holds. The legacy guest-upgrade
 * path from Settings also holds, because the guest already has a
 * session.
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
 * Chat 12a — mark a profile as a member.
 *
 * Writes profiles.email and flips profiles.is_guest = false for the
 * current user. Called after linkEmailPassword succeeds.
 *
 * RLS: "profiles update own" permits self-update of email/is_guest
 * (only is_premium and premium_since are pinned by WITH CHECK).
 *
 * Non-fatal callers: SignupLinkScreen logs failures but does not
 * block. Server-side identify will re-sync on next connect if the
 * write is dropped — but only for username; email is not re-derived
 * from the JWT on identify. So this write is the primary path and
 * should be treated as required, not optional.
 */
export async function markProfileAsMember(
  email: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;
    if (!uid) {
      return { success: false, message: 'No active session' };
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        email,
        is_guest: false,
      })
      .eq('id', uid);

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[SUPABASE] markProfileAsMember error:', error.message);
      return { success: false, message: error.message };
    }
    return { success: true };
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[SUPABASE] markProfileAsMember exception:', e?.message || e);
    return { success: false, message: e?.message || 'Profile update failed' };
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
 * Chat 12a — sign in with either an email or a username.
 *
 * If `identifier` contains '@', it is treated as an email.
 * Otherwise, it is treated as a username and resolved to an email
 * via the socket helper `resolveEmailFromUsernameOnServer` (in
 * multiplayer.ts — this file does not import from there to avoid a
 * circular dependency; the caller passes the resolver in, OR uses
 * LoginScreen's own two-step flow).
 *
 * NOTE: this helper is provided for callers that want a single
 * entry point. LoginScreen currently does the two-step flow
 * itself so it can render the "resolving" state without a
 * helper bounce. Both paths produce the same result.
 *
 * All failures normalize to "Invalid credentials". Never leaks
 * which half of the pair (identifier or password) was wrong.
 */
export async function signInWithEmailOrUsername(
  identifier: string,
  password: string,
  resolveEmail: (username: string) => Promise<string | null>
): Promise<{ success: boolean; message?: string }> {
  const INVALID = 'Invalid credentials';

  const trimmed = (identifier || '').trim();
  if (!trimmed || !password) {
    return { success: false, message: INVALID };
  }

  let emailToUse = trimmed;

  if (!trimmed.includes('@')) {
    const resolved = await resolveEmail(trimmed);
    if (!resolved) {
      return { success: false, message: INVALID };
    }
    emailToUse = resolved;
  }

  const result = await signInWithEmail(emailToUse, password);
  if (!result.success) {
    return { success: false, message: INVALID };
  }
  return { success: true };
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
      .select(
        'id, username, avatar, is_premium, premium_since, email, is_guest, created_at, updated_at'
      )
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