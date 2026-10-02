// src/services/supabase.ts
//
// RPS Arena — Supabase client + auth helpers.
//
// Chat 9:   initial.
// Chat 9b:  emailRedirectTo, anonymous metadata, linkEmailPassword.
// Chat 12a: getExistingSession, signInAnonymously, SupabaseProfile
//           gains email + is_guest, markProfileAsMember.
// Chat 12b: signOutLocal / signOut clear the @rps_identity cache.
// Chat 12b (fix):
//   - Confirmed emailRedirectTo is set on both updateUser and
//     resetPasswordForEmail (via getWebOrigin()).
//   - Added a TODO comment on getWebOrigin explaining the native
//     deep-link scheme change required for the APK build.
//   - detectSessionInUrl on web is what makes the confirmation link
//     work. Documented in the client config comment.
//   - No new helpers. App.tsx calls onAuthStateChange directly.
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
// Supabase ignores the option — which means native email
// confirmation does not work yet.
//
// TODO (native): when building the APK, switch this to the custom
// scheme 'rpsarena://confirm' (registered in app.json) and add a
// Linking handler in App.tsx to process the auth token returned in
// the URL. Also change `detectSessionInUrl` to `false` on native so
// Supabase does not attempt URL-fragment parsing there.
//
// Until then, native sign-up users must confirm their email on the
// web (or the flow should be disabled on native — separate chat).
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
//
// detectSessionInUrl: true (web) is what makes email-confirmation
// links work end-to-end:
//
//   1. User clicks the link in their email. The browser opens
//      <origin>/#access_token=...&refresh_token=...&type=signup
//      (or type=recovery for password reset).
//   2. On module load, createClient parses the URL fragment,
//      stores the session in localStorage, and queues a
//      SIGNED_IN (or PASSWORD_RECOVERY) auth-state event.
//   3. App.tsx subscribes to onAuthStateChange BEFORE reading the
//      existing session, so the queued event fires into our
//      handler. The handler bootstraps the store and flips
//      isOnboarded true. The navigator remounts on Home.
//
// On native, detectSessionInUrl is false. The redirect target
// (getWebOrigin) returns undefined, so Supabase falls back to its
// own default. Native deep-link handling is deferred — see the
// TODO on getWebOrigin above.
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
// explicit metadata.
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
 * Never creates an anonymous session.
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
 * Explicit anonymous sign-in.
 *
 * Called ONLY from OnboardingScreen (Continue as Guest and Sign Up).
 * Never from App boot. Never from bootstrapAuth.
 */
export async function signInAnonymously(opts?: {
  username?: string;
  avatar?: string;
}): Promise<{ success: boolean; session: Session | null; message?: string }> {
  try {
    const existing = await getExistingSession();
    if (existing) {
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
 * REQUIRES an existing session (guest or member).
 *
 * Passes emailRedirectTo on web so the confirmation email returns
 * to the deployed origin. See getWebOrigin's TODO for the native
 * story.
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

    // Refresh profiles.username/avatar in case the trigger had
    // seeded a placeholder. RLS permits self-update of these.
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
 * Mark a profile as a member.
 *
 * Writes profiles.email and flips profiles.is_guest = false for the
 * current user. Called after linkEmailPassword succeeds.
 *
 * Note: SignupLinkScreen currently performs this write inline (it
 * already has the session in scope). This helper is kept for any
 * future caller that wants a one-shot function.
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
 * Login with email + password.
 *
 * On success, caller should inspect the session's
 * user.email_confirmed_at to decide whether to route to Home or
 * VerifyEmail. Supabase's signInWithPassword succeeds even for
 * unconfirmed users when email confirmation is enabled.
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
 * Sign in with email OR username.
 *
 * Not used by LoginScreen (which does the two-step flow inline so
 * it can show the "resolving" state). Kept for other callers.
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

// ──────────────────────────────────────────────────────────────
// Identity cache clear
// ──────────────────────────────────────────────────────────────
//
// The @rps_identity cache lives in AsyncStorage / localStorage and
// is written by userStore (via identity.ts's saveIdentity). It
// holds the last-known username/avatar so the app can render
// something on first paint before Supabase resolves.
//
// On logout, that cache must be cleared. Otherwise the stale
// username ("Joker") is visible on the next launch, before
// Onboarding replaces it.
async function clearIdentityCache(): Promise<void> {
  try {
    const identity = require('./identity');
    if (identity && typeof identity.clearIdentity === 'function') {
      await identity.clearIdentity();
    }
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.log('[SUPABASE] clearIdentityCache failed:', e?.message || e);
  }
}

/**
 * Sign out ONLY this device. Also clears the local identity cache.
 */
export async function signOutLocal(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[SUPABASE] signOutLocal error:', e?.message || e);
  }
  await clearIdentityCache();
}

/**
 * Full sign out (this device). Also clears the local identity cache.
 */
export async function signOut(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[SUPABASE] signOut error:', e?.message || e);
  }
  await clearIdentityCache();
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
// src/services/supabase.ts