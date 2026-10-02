// src/store/userStore.ts
//
// RPS Arena — user/identity store.
//
// Chat 9: Supabase Auth is the source of truth. This store holds a
//         resolved snapshot for the rest of the app.
// Chat 12a:
//   - hasSession, isGuest, setFromIdentify, no auto-guest.
// Chat 12b (fix):
//   - NEW: isOnboarded — the render gate. Distinct from hasSession.
//     hasSession answers "does a Supabase session exist?".
//     isOnboarded answers "has the user made an explicit choice to
//     enter the app (sign in / sign up / continue as guest)?".
//     Silent sessions created during Sign Up or Continue as Guest
//     flip hasSession true immediately, but do NOT flip isOnboarded.
//     That is what the previous Chat 12b got wrong: it keyed the
//     navigator on hasSession, so the navigator remounted mid-flow.
//   - NEW: pendingConfirmation + pendingEmail — set when the user
//     has an unconfirmed email session. AppNavigator uses these to
//     route to VerifyEmail instead of Onboarding or Home.
//   - bootstrapAuth now computes isOnboarded from the session:
//       no session                     → isOnboarded false
//       session, user is anonymous     → isOnboarded true (chose guest)
//       session, email_confirmed_at set → isOnboarded true
//       session, unconfirmed email      → isOnboarded false, pending
//   - resetUser / clearUser reset all new fields.
//
// Lifecycle:
//   - bootstrapAuth() is called from App.tsx on mount and from
//     LoginScreen / SignupLinkScreen after a successful sign-in or
//     link. It resolves the session (never creates one).
//   - updateUser() writes to the @rps_identity cache but NOT to the
//     server.
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

  // ── Chat 12b: render gate ──
  // isOnboarded drives the AppNavigator key. See header comment.
  isOnboarded: boolean;
  // Set when the user has an unconfirmed email session.
  pendingConfirmation: boolean;
  pendingEmail: string | null;

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

  // Chat 12b — onboarding flow control.
  setOnboarded: (v: boolean) => void;
  setPendingConfirmation: (email: string | null) => void;

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

// Chat 12b — compute isOnboarded from a session + profile.
//
//   no session                          → false
//   session.user.is_anonymous (guest)   → true  (user chose guest previously)
//   session.user.email_confirmed_at set → true  (member, confirmed)
//   session.user.email, unconfirmed     → false (waiting for confirmation)
//
// The profile is passed so we can prefer profiles.is_guest over the
// JWT heuristic for the anonymous check (matches identify's logic).
function computeOnboarded(
  session: any,
  profile: any
): {
  isOnboarded: boolean;
  pendingConfirmation: boolean;
  pendingEmail: string | null;
} {
  if (!session || !session.user) {
    return {
      isOnboarded: false,
      pendingConfirmation: false,
      pendingEmail: null,
    };
  }

  const u = session.user;
  const meta: any = u.user_metadata || {};
  const isAnonByJwt = !u.email || meta.is_anonymous === true;
  const isGuestByProfile =
    profile && typeof profile.is_guest === 'boolean'
      ? profile.is_guest
      : null;

  const isAnon = isGuestByProfile !== null ? isGuestByProfile : isAnonByJwt;

  if (isAnon) {
    return {
      isOnboarded: true,
      pendingConfirmation: false,
      pendingEmail: null,
    };
  }

  if (u.email_confirmed_at) {
    return {
      isOnboarded: true,
      pendingConfirmation: false,
      pendingEmail: null,
    };
  }

  // Member with an unconfirmed email.
  return {
    isOnboarded: false,
    pendingConfirmation: true,
    pendingEmail: u.email || null,
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

  isOnboarded: false,
  pendingConfirmation: false,
  pendingEmail: null,

  identity: null,

  // ────────────────────────────────────────────────────────
  // bootstrapAuth — full boot from a cold start.
  //
  // Never creates a session. If none exists, isOnboarded stays
  // false and AppNavigator renders Onboarding.
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
        isOnboarded: false,
        pendingConfirmation: false,
        pendingEmail: null,
        authReady: true,
        loaded: true,
      });
      return;
    }

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

    const onboarded = computeOnboarded(session, profile);

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
      isOnboarded: onboarded.isOnboarded,
      pendingConfirmation: onboarded.pendingConfirmation,
      pendingEmail: onboarded.pendingEmail,
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
  // Chat 12b — onboarding flow control.
  // ────────────────────────────────────────────────────────
  setOnboarded: (v) => set({ isOnboarded: !!v }),

  setPendingConfirmation: (email) => {
    if (!email) {
      set({ pendingConfirmation: false, pendingEmail: null });
      return;
    }
    set({ pendingConfirmation: true, pendingEmail: email });
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
      isOnboarded: false,
      pendingConfirmation: false,
      pendingEmail: null,
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
      isOnboarded: false,
      pendingConfirmation: false,
      pendingEmail: null,
      authReady: false,
      loaded: true,
    });
  },
}));
// src/store/userStore.ts