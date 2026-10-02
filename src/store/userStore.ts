// src/store/userStore.ts
//
// RPS Arena — user/identity store.
//
// Chat 9 model:
//   - Supabase Auth is the source of truth (session + profiles).
//   - This store holds a resolved snapshot for the rest of the app.
//   - `identity` is a UserIdentity-shaped cache for legacy consumers.
//
// Chat 12a:
//   - New `hasSession: boolean` — true iff a Supabase session exists.
//   - New `isGuest: boolean` — profiles.is_guest (server-authoritative).
//   - bootstrapAuth no longer auto-guests. Uses getExistingSession()
//     (read-only). If no session → hasSession: false.
//   - New setFromIdentify(reg) — App.tsx calls this after
//     identifyOnServer so the store reflects the server's view.
//   - setFromSession sets hasSession: true.
//   - resetUser / clearUser clear hasSession to false.
//
// Chat 12b:
//   - NO BEHAVIORAL CHANGES. AppNavigator derives its dynamic
//     initial route and remount key from `hasSession`. Bootstrap
//     flips hasSession correctly (Chat 12a). Sign-in/up auto-nav
//     to Home is handled entirely by that mechanism.
//   - Comment added on `resetUser()` noting that the identity cache
//     is now cleared by `signOutLocal()` in supabase.ts, so this
//     store method does not need to clear it again.
//
// Lifecycle:
//   - bootstrapAuth() is called from App.tsx on mount and after
//     sign-in / link. It resolves the session (never creates one),
//     loads the profiles row, and populates this store.
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
  // email. Called after identifyOnServer().
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
  // NO auto-guest. Reads the existing session. If none, sets
  // hasSession: false and lets AppNavigator render Onboarding.
  // ────────────────────────────────────────────────────────
  bootstrapAuth: async () => {
    const session = await getExistingSession();
    if (!session) {
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

    const profile = await fetchProfile();
    const u = session.user;
    const meta: any = u.user_metadata || {};
    const jwtSaysAnon = !u.email || meta.is_anonymous === true;

    // isGuest: profiles.is_guest is authoritative when present.
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
      // Do not flip isGuest here — setFromIdentify is authoritative.
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

  // ────────────────────────────────────────────────────────
  // setFromIdentify — server identify payload.
  //
  // Authoritative for isGuest + isPremium + email. Every field is
  // optional; undefined leaves the current value untouched.
  // ────────────────────────────────────────────────────────
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

  // ────────────────────────────────────────────────────────
  // updateUser — local-only update of username/avatar.
  // ────────────────────────────────────────────────────────
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

  // ────────────────────────────────────────────────────────
  // refreshPremium — re-read profiles.is_premium.
  // ────────────────────────────────────────────────────────
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
  //
  // Caller is responsible for calling signOutLocal() first. That
  // function clears the @rps_identity cache (Chat 12b fix). This
  // method only clears the in-memory state.
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