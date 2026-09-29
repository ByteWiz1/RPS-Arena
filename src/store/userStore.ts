// src/store/userStore.ts
//
// RPS Arena — user/identity store (Chat 9 rewrite).
//
// Chat 9 model:
//   - Supabase Auth is the source of truth (session + profiles).
//   - This store holds a resolved snapshot for the rest of the app:
//     userId, email, isAnonymous, username, avatar, isPremium.
//   - `identity` is a UserIdentity-shaped cache so existing consumers
//     (screens that read identity.userId / identity.username) keep
//     working without edits. Its `token` field is intentionally unset.
//
// Lifecycle:
//   - bootstrapAuth() is called once from App.tsx on mount.
//     It resolves the Supabase session, loads the profiles row, and
//     populates this store.
//   - updateUser() writes to the @rps_identity cache but NOT to the
//     server. Server-side username changes go through
//     changeUsernameOnServer() first (see SettingsScreen).
//   - resetUser() is called on sessionReplaced: clears local state
//     without signing out the Supabase session (the caller does that
//     via signOutLocal()).
//   - clearUser() is called on deleteAccount: signs out Supabase and
//     wipes local storage.

import { create } from 'zustand';
import {
  UserIdentity,
  saveIdentity,
  clearIdentity as clearStoredIdentity,
} from '../services/identity';
import {
  ensureSession,
  fetchProfile,
  signOut as supabaseSignOut,
} from '../services/supabase';

interface UserState {
  // ── Source-of-truth snapshot ──
  userId: string | null;
  email: string | null;
  isAnonymous: boolean;

  username: string | null;
  avatar: string | null;
  isPremium: boolean;
  premiumSince: string | null;

  // ── Lifecycle ──
  authReady: boolean;      // session resolved + store populated
  loaded: boolean;         // kept for compat with old consumers

  // ── Cache mirrored for legacy consumers ──
  // Shaped like the old UserIdentity so existing screens keep working.
  // `token` is intentionally never set (Supabase owns auth now).
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

  username: null,
  avatar: null,
  isPremium: false,
  premiumSince: null,

  authReady: false,
  loaded: false,

  identity: null,

  // ────────────────────────────────────────────────────────
  // bootstrapAuth — full boot from a cold start.
  //   1. ensureSession() (anonymous if none)
  //   2. fetchProfile()
  //   3. populate all fields + identity cache + @rps_identity
  // ────────────────────────────────────────────────────────
  bootstrapAuth: async () => {
    const session = await ensureSession();
    if (!session) {
      set({ authReady: true, loaded: true });
      return;
    }

    const profile = await fetchProfile();
    const u = session.user;
    const meta: any = u.user_metadata || {};
    const isAnonymous = !u.email || meta.is_anonymous === true;

    const username =
      profile?.username || meta.username || DEFAULT_USERNAME;
    const avatar = profile?.avatar || meta.avatar || DEFAULT_AVATAR;

    const identity = buildIdentityCache(u.id, username, avatar);
    if (identity) {
      // Persist the cache so the app can render offline next launch.
      await saveIdentity(identity);
    }

    set({
      userId: u.id,
      email: u.email || null,
      isAnonymous,
      username,
      avatar,
      isPremium: !!profile?.is_premium,
      premiumSince: profile?.premium_since || null,
      identity,
      authReady: true,
      loaded: true,
    });
  },

  // ────────────────────────────────────────────────────────
  // Granular setters — used by App.tsx boot + re-identify.
  // ────────────────────────────────────────────────────────
  setAuthReady: (v) => set({ authReady: v, loaded: true }),

  setFromSession: ({ userId, email, isAnonymous }) => {
    const { username, avatar } = get();
    const identity = buildIdentityCache(userId, username, avatar);
    if (identity) {
      // Fire-and-forget — no need to await, cache is a convenience.
      saveIdentity(identity).catch(() => {});
    }
    set({
      userId,
      email,
      isAnonymous,
      identity,
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
  // updateUser — local-only update of username/avatar.
  // The server call (changeUsernameOnServer) is the caller's
  // responsibility, as it was before Chat 9.
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
  // Used by PremiumGate and post-purchase flows.
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
  // Used by the sessionReplaced handler (Option X): the caller
  // signs out locally, then calls resetUser().
  // ────────────────────────────────────────────────────────
  resetUser: () => {
    set({
      userId: null,
      email: null,
      isAnonymous: true,
      username: null,
      avatar: null,
      isPremium: false,
      premiumSince: null,
      identity: null,
      authReady: true,
      loaded: true,
    });
  },

  // ────────────────────────────────────────────────────────
  // clearUser — full wipe. Signs out Supabase, clears cache.
  // Used by deleteAccount (SettingsScreen).
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
      username: null,
      avatar: null,
      isPremium: false,
      premiumSince: null,
      identity: null,
      authReady: false,
      loaded: true,
    });
  },
}));