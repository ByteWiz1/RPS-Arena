// src/store/userStore.ts
//
// RPS Arena — user/identity store.
//
// Chat 9: Supabase Auth is the source of truth. This store holds a
//         resolved snapshot for the rest of the app.
// Chat 12a: hasSession, isGuest, setFromIdentify, no auto-guest.
// Chat 12b: isOnboarded, pendingConfirmation, pendingEmail.
// Chat 12c: Onboarding gate reverted.
//   - Removed isOnboarded, pendingConfirmation, pendingEmail.
//   - Restored auto-guest in bootstrapAuth: if getExistingSession()
//     returns null, we call signInAnonymously() silently and populate
//     the store from the fresh session. Same behavior as pre-Chat-12a.
//   - Kept: isGuest, email, setFromIdentify, setFromSession,
//     setFromProfile, markProfileAsMember pattern, drift heal on the
//     server.
//
// Lifecycle:
//   - bootstrapAuth() is called from App.tsx on mount and after a
//     successful sign-in or link. Auto-guests if no session exists.
//   - updateUser() writes to the @rps_identity cache but NOT to the
//     server. Server-side username changes go through
//     changeUsernameOnServer() first.
//   - resetUser() is called on sessionReplaced (caller already
//     called signOutLocal() which cleared the identity cache).
//   - clearUser() is called on deleteAccount.

import { create } from 'zustand';
import {
  UserIdentity,
  saveIdentity,
  clearIdentity as clearStoredIdentity,
} from '../services/identity';
import {
  getExistingSession,
  signInAnonymously,
  fetchProfile,
  signOut as supabaseSignOut,
} from '../services/supabase';

interface UserState {
  // ── Source-of-truth snapshot ──
  userId: string | null;
  email: string | null;
  isAnonymous: boolean;
  isGuest: boolean;

  username: string | null;
  avatar: string | null;
  isPremium: boolean;
  premiumSince: string | null;

  // ── Lifecycle ──
  authReady: boolean;      // boot finished deciding
  hasSession: boolean;     // a Supabase session currently exists
  loaded: boolean;         // kept for compat with old consumers

  // ── Cache mirrored for legacy consumers ──
  identity: UserIdentity | null;

  // ── Actions ──
  bootstrapAuth: () => Promise<void>;

  setAuthReady: (v: boolean) => void;
  setFromSession: (s: {
    userId: string;
    email: string | null;
    isAnonymous: boolean;
  }) => void;
  setFromProfile: (p: {
    username?: string | null;
    avatar?: string | null;
    isPremium?: boolean;
    premiumSince?: string | null;
  }) => void;

  // Server identify payload. Authoritative for isGuest / isPremium /
  // email.
  setFromIdentify: (r: {
    username?: string | null;
    avatar?: string | null;
    isPremium?: boolean;
    premiumSince?: string | null;
    email?: string | null;
    isGuest?: boolean;
    isAnonymous?: boolean;
  }) => void;

  updateUser: (
    updates: Partial<Pick<UserIdentity, 'username' | 'avatar'>>
  ) => Promise<void>;

  refreshPremium: () => Promise<void>;

  resetUser: () => void;         // sessionReplaced (no sign-out)
  clearUser: () => Promise<void>; // deleteAccount (signs out)
}

const DEFAULT_USERNAME = 'Player';
const DEFAULT_AVATAR = '🤖';

// Internal: build the legacy-shaped `identity` cache from current state.
function buildIdentityCache(
  userId: string | null,
  username: string | null,
  avatar: string | null
): UserIdentity | null {
  if (!userId) return null;
  return {
    userId,
    username: username || DEFAULT_USERNAME,
    avatar: avatar || DEFAULT_AVATAR,
  };
}

// Internal: hydrate the store from a session + profile pair.
//
// Used by bootstrapAuth after we have a session (auto-guested or
// pre-existing). Reads profile for is_guest / is_premium / email,
// falls back to the JWT heuristic for is_anonymous.
async function hydrateFromSession(
  session: any,
  set: (partial: Partial<UserState>) => void
): Promise<void> {
  const profile = await fetchProfile();
  const u = session.user;
  const meta: any = u.user_metadata || {};
  const jwtSaysAnon = !u.email || meta.is_anonymous === true;

  const isGuest =
    profile && typeof profile.is_guest === 'boolean'
      ? profile.is_guest
      : jwtSaysAnon;

  const username =
    profile?.username || meta.username || DEFAULT_USERNAME;
  const avatar = profile?.avatar || meta.avatar || DEFAULT_AVATAR;
  const email = profile?.email || u.email || null;

  const identity = buildIdentityCache(u.id, username, avatar);
  if (identity) {
    await saveIdentity(identity);
  }

  set({
    userId: u.id,
    email,
    isAnonymous: jwtSaysAnon,
    isGuest,
    username,
    avatar,
    isPremium: !!profile?.is_premium,
    premiumSince: profile?.premium_since || null,
    identity,
    hasSession: true,
    authReady: true,
    loaded: true,
  });
}

export const useUserStore = create<UserState>((set, get) => ({
  userId: null,
  email: null,
  isAnonymous: true,
  isGuest: true,

  username: null,
  avatar: null,
  isPremium: false,
  premiumSince: null,

  authReady: false,
  hasSession: false,
  loaded: false,

  identity: null,

  // ────────────────────────────────────────────────────────
  // bootstrapAuth — full boot from a cold start.
  //
  // Chat 12c: auto-guests if no session exists. Same behavior as
  // pre-Chat-12a. The user lands on Home as a guest without having
  // to choose anything.
  // ─────────────────────────────────────────────────────────
  bootstrapAuth: async () => {
    // 1. Read any existing session.
    let session = await getExistingSession();

    // 2. Auto-guest if none.
    if (!session) {
      console.log('[USERSTORE] no session — auto-guesting');
      const result = await signInAnonymously();
      if (!result.success || !result.session) {
        // Could not establish any session at all. Stay in a
        // non-ready state so App.tsx keeps rendering null and the
        // user sees nothing rather than a broken screen. Extremely
        // rare — Supabase is down or the network is broken.
        console.error(
          '[USERSTORE] auto-guest failed:',
          result.message || 'unknown'
        );
        set({
          userId: null,
          email: null,
          isAnonymous: true,
          isGuest: true,
          username: null,
          avatar: null,
          isPremium: false,
          premiumSince: null,
          identity: null,
          hasSession: false,
          authReady: true,
          loaded: true,
        });
        return;
      }
      session = result.session;
    }

    // 3. Hydrate from the session + profile.
    await hydrateFromSession(session, set);
  },

  // ────────────────────────────────────────────────────────
  // Granular setters
  // ────────────────────────────────────────────────────────
  setAuthReady: (v) => set({ authReady: v, loaded: true }),

  setFromSession: ({ userId, email, isAnonymous }) => {
    const { username, avatar, isGuest } = get();
    const identity = buildIdentityCache(userId, username, avatar);
    if (identity) {
      saveIdentity(identity).catch(() => {});
    }
    set({
      userId,
      email,
      isAnonymous,
      isGuest,
      identity,
      hasSession: true,
    });
  },

  setFromProfile: ({ username, avatar, isPremium, premiumSince }) => {
    const { userId, username: curU, avatar: curA } = get();
    const nextUsername = username !== undefined ? username : curU;
    const nextAvatar = avatar !== undefined ? avatar : curA;

    const identity = buildIdentityCache(userId, nextUsername, nextAvatar);
    if (identity) {
      saveIdentity(identity).catch(() => {});
    }

    set({
      username: nextUsername,
      avatar: nextAvatar,
      isPremium:
        isPremium !== undefined ? !!isPremium : get().isPremium,
      premiumSince:
        premiumSince !== undefined ? premiumSince : get().premiumSince,
      identity,
    });
  },

  setFromIdentify: (r) => {
    const {
      userId,
      username: curU,
      avatar: curA,
      isPremium: curP,
      premiumSince: curPS,
      email: curE,
      isGuest: curG,
    } = get();

    const nextUsername = r.username !== undefined ? r.username : curU;
    const nextAvatar = r.avatar !== undefined ? r.avatar : curA;

    const identity = buildIdentityCache(userId, nextUsername, nextAvatar);
    if (identity) {
      saveIdentity(identity).catch(() => {});
    }

    set({
      username: nextUsername,
      avatar: nextAvatar,
      isPremium: r.isPremium !== undefined ? !!r.isPremium : curP,
      premiumSince:
        r.premiumSince !== undefined ? r.premiumSince : curPS,
      email: r.email !== undefined ? r.email : curE,
      isGuest: r.isGuest !== undefined ? !!r.isGuest : curG,
      identity,
    });
  },

  updateUser: async (updates) => {
    const { userId, username, avatar } = get();
    if (!userId) return;

    const nextUsername =
      updates.username !== undefined ? updates.username : username;
    const nextAvatar =
      updates.avatar !== undefined ? updates.avatar : avatar;

    const identity = buildIdentityCache(userId, nextUsername, nextAvatar);
    if (identity) {
      await saveIdentity(identity);
    }

    set({
      username: nextUsername,
      avatar: nextAvatar,
      identity,
    });
  },

  refreshPremium: async () => {
    const profile = await fetchProfile();
    if (!profile) return;
    set({
      isPremium: !!profile.is_premium,
      premiumSince: profile.premium_since || null,
    });
  },

  // ────────────────────────────────────────────────────────
  // resetUser — soft reset, no Supabase sign-out.
  // Caller already called signOutLocal() (which cleared the
  // identity cache).
  // ────────────────────────────────────────────────────────
  resetUser: () => {
    set({
      userId: null,
      email: null,
      isAnonymous: true,
      isGuest: true,
      username: null,
      avatar: null,
      isPremium: false,
      premiumSince: null,
      identity: null,
      hasSession: false,
      authReady: true,
      loaded: true,
    });
  },

  // ────────────────────────────────────────────────────────
  // clearUser — full wipe. Signs out Supabase, clears cache.
  // ────────────────────────────────────────────────────────
  clearUser: async () => {
    try {
      await supabaseSignOut();
    } catch {}
    try {
      await clearStoredIdentity();
    } catch {}
    set({
      userId: null,
      email: null,
      isAnonymous: true,
      isGuest: true,
      username: null,
      avatar: null,
      isPremium: false,
      premiumSince: null,
      identity: null,
      hasSession: false,
      authReady: false,
      loaded: true,
    });
  },
}));
// src/store/userStore.ts