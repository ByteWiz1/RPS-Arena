// src/store/avatarStore.ts
//
// RPS Arena — avatar store (Chat 9b rewrite).
//
// Chat 9b: server-authoritative. Avatars live in public.avatars and
// are read/written via socket events. This store is a client cache
// that mirrors server state.
//
// Public API unchanged: every existing consumer keeps working.
// The difference is that mutations now go through the server, and
// the server pushes back the canonical list which we mirror.
//
// Boot flow (driven from App.tsx):
//   1. Avatar store starts empty, loaded=false.
//   2. After socket connect + identify, App.tsx calls
//      syncFromServer() which fetches avatars and flips loaded=true.
//
// Match history (MatchRecord[]) is still client-only. It mirrors
// what the client already tracks (local dojo / pvp / pvc history).
// Server-side match_history is separate and read via multiplayer's
// getMatchHistoryFromServer().

import { create } from 'zustand';
import {
  Avatar,
  AvatarPersonality,
  createAvatar as engineCreateAvatar,
  updateAvatarStats,
  DEFAULT_PERSONALITY,
} from '../engine/AvatarEngine';
import {
  ServerAvatar,
  getAvatarsFromServer,
  createAvatarOnServer,
  updateAvatarOnServer,
  deleteAvatarOnServer,
  selectAvatarOnServer,
  onAvatarsUpdate,
} from '../services/multiplayer';

export interface MatchRecord {
  id: string;
  avatarId: string;
  mode: 'pvc' | 'pvp' | 'online' | 'dojo';
  opponentName: string;
  myScore: number;
  opponentScore: number;
  myTies: number;
  opponentTies: number;
  result: 'win' | 'lose' | 'tie';
  timestamp: number;
}

interface AvatarState {
  avatars: Avatar[];
  selectedAvatarId: string | null;
  matchHistory: MatchRecord[];
  loaded: boolean;
  syncInFlight: boolean;
}

interface AvatarActions {
  // ── Existing public API (unchanged signatures) ──
  createNewAvatar: (name: string, emoji?: string) => void;
  selectAvatar: (id: string) => void;
  updateAvatarAfterMatch: (id: string, result: 'win' | 'lose' | 'tie') => void;
  deleteAvatar: (id: string) => void;
  getSelectedAvatar: () => Avatar | null;
  updateAvatarPersonality: (id: string, personality: AvatarPersonality) => void;
  updateAvatarImage: (
    id: string,
    image: { type: 'emoji' | 'custom'; value: string }
  ) => void;
  addTitle: (id: string, title: string) => void;
  addDefeatedMaster: (id: string, masterId: string) => void;
  addXPReward: (id: string, xp: number, rating?: number) => void;
  recordMatch: (record: Omit<MatchRecord, 'id' | 'timestamp'>) => void;
  getAvatarMatches: (avatarId: string) => MatchRecord[];
  getRecentMatches: (limit?: number) => MatchRecord[];
  loadAvatars: () => Promise<void>;

  // ── New in Chat 9b ──
  syncFromServer: () => Promise<void>;
  attachServerListener: () => () => void;
}

// ────────────────────────────────────────────────────────────
// Server → client mapping
// ────────────────────────────────────────────────────────────
function serverToClient(s: ServerAvatar): Avatar {
  // The client Avatar has an `image` field that the server doesn't
  // carry except as imageUrl. Emoji avatars get { type: 'emoji' }.
  // Custom-image avatars (deferred) would get { type: 'custom' }.
  const image =
    s.imageUrl
      ? { type: 'custom' as const, value: s.imageUrl }
      : { type: 'emoji' as const, value: s.emoji || '🤖' };

  return {
    id: s.id,
    name: s.name,
    emoji: s.emoji,
    image,
    personality: s.personality || { ...DEFAULT_PERSONALITY },
    rating: s.rating,
    level: s.level,
    xp: s.xp,
    wins: s.wins,
    losses: s.losses,
    ties: s.ties,
    winStreak: s.winStreak,
    bestStreak: s.bestStreak,
    titles: Array.isArray(s.titles) ? s.titles : [],
    defeatedMasters: Array.isArray(s.defeatedMasters) ? s.defeatedMasters : [],
    createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
  } as Avatar;
}

function clientToServerShape(a: Avatar): any {
  return {
    id: a.id,
    name: a.name,
    emoji: a.emoji,
    personality: a.personality,
    rating: a.rating,
    level: a.level,
    xp: a.xp,
    titles: a.titles,
    defeatedMasters: a.defeatedMasters,
    imageUrl: a.image?.type === 'custom' ? a.image.value : null,
  };
}

// ────────────────────────────────────────────────────────────
// Local match-history persistence (unchanged — still AsyncStorage)
// ────────────────────────────────────────────────────────────
import AsyncStorage from '@react-native-async-storage/async-storage';
const MATCH_HISTORY_KEY = '@rps_match_history';

async function saveMatchHistoryLocal(matchHistory: MatchRecord[]) {
  try {
    await AsyncStorage.setItem(
      MATCH_HISTORY_KEY,
      JSON.stringify(matchHistory.slice(0, 100))
    );
  } catch (e) {
    console.log('[AVATAR STORE] match history save error:', e);
  }
}

async function loadMatchHistoryLocal(): Promise<MatchRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(MATCH_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ────────────────────────────────────────────────────────────
// Store
// ────────────────────────────────────────────────────────────
export const useAvatarStore = create<AvatarState & AvatarActions>(
  (set, get) => ({
    avatars: [],
    selectedAvatarId: null,
    matchHistory: [],
    loaded: false,
    syncInFlight: false,

    // ────────────────────────────────────────────────────────
    // Server sync
    // ────────────────────────────────────────────────────────
    syncFromServer: async () => {
      if (get().syncInFlight) return;
      set({ syncInFlight: true });

      try {
        const [serverAvatars, localHistory] = await Promise.all([
          getAvatarsFromServer(),
          loadMatchHistoryLocal(),
        ]);

        const avatars = serverAvatars.map(serverToClient);
        const selected = avatars.find((a) => {
          const s = serverAvatars.find((x) => x.id === a.id);
          return s?.isSelected;
        });

        set({
          avatars,
          selectedAvatarId: selected?.id || null,
          matchHistory: localHistory,
          loaded: true,
          syncInFlight: false,
        });
      } catch (e) {
        console.log('[AVATAR STORE] syncFromServer error:', e);
        // Still mark loaded so UI can render empty state.
        set({ loaded: true, syncInFlight: false });
      }
    },

    attachServerListener: () => {
      return onAvatarsUpdate((serverAvatars) => {
        const avatars = serverAvatars.map(serverToClient);
        const selected = serverAvatars.find((x) => x.isSelected);
        set({
          avatars,
          selectedAvatarId: selected?.id || null,
        });
      });
    },

    // ────────────────────────────────────────────────────────
    // loadAvatars — kept as a thin wrapper around syncFromServer
    // so App.tsx's existing boot code keeps working.
    // ────────────────────────────────────────────────────────
    loadAvatars: async () => {
      await get().syncFromServer();
    },

    // ────────────────────────────────────────────────────────
    // createNewAvatar — the public API is sync, but the server
    // call is async. We do an optimistic local insert so the UI
    // updates immediately, then reconcile with the server.
    // ────────────────────────────────────────────────────────
    createNewAvatar: (name, emoji) => {
      // Build the client-side avatar via the engine (generates id,
      // default stats, etc.). We'll push the same shape to the server.
      const avatar = engineCreateAvatar(name);
      if (emoji) {
        avatar.emoji = emoji;
        avatar.image = { type: 'emoji', value: emoji };
      }

      // Optimistic local insert.
      set((state) => {
        const next = {
          avatars: [...state.avatars, avatar],
          selectedAvatarId: state.selectedAvatarId || avatar.id,
        };
        return next;
      });

      // Push to server.
      createAvatarOnServer({
        id: avatar.id,
        name: avatar.name,
        emoji: avatar.emoji,
        personality: avatar.personality,
        defeatedMasters: avatar.defeatedMasters,
      }).then((res) => {
        if (!res.success) {
          console.log('[AVATAR STORE] createAvatar server failed:', res.message);
          // Revert the optimistic insert.
          set((state) => ({
            avatars: state.avatars.filter((a) => a.id !== avatar.id),
            selectedAvatarId:
              state.selectedAvatarId === avatar.id
                ? null
                : state.selectedAvatarId,
          }));
        }
      });
    },

    // ────────────────────────────────────────────────────────
    // selectAvatar — optimistic, then server. Server re-broadcasts
    // the canonical list which onAvatarsUpdate mirrors.
    // ────────────────────────────────────────────────────────
    selectAvatar: (id) => {
      set({ selectedAvatarId: id });
      selectAvatarOnServer(id).then((res) => {
        if (!res.success) {
          console.log('[AVATAR STORE] selectAvatar server failed:', res.message);
        }
      });
    },

    // ────────────────────────────────────────────────────────
    // updateAvatarAfterMatch — used by local match flows.
    // The server also updates the avatar on online matches, so this
    // is primarily for dojo/pvc/pvp where the server isn't tracking.
    // Optimistic local update, then best-effort server push.
    // ────────────────────────────────────────────────────────
       updateAvatarAfterMatch: (id, result) => {
      let patched: Avatar | undefined;

      set((state) => {
        const avatar = state.avatars.find((a) => a.id === id);
        if (!avatar) return state;
        const updated = updateAvatarStats(avatar, result);
        patched = updated;
        const avatars = state.avatars.map((a) => (a.id === id ? updated : a));
        return { avatars };
      });

      if (!patched) return;

      // Explicit local capture so TS doesn't narrow `patched` to never.
      const snap: Avatar = patched;

      updateAvatarOnServer(id, {
        xp: snap.xp,
        level: snap.level,
        rating: snap.rating,
        winStreak: snap.winStreak,
        bestStreak: snap.bestStreak,
      }).catch(() => {});
    },

    // ────────────────────────────────────────────────────────
    // updateAvatarPersonality — optimistic + server.
    // ────────────────────────────────────────────────────────
    updateAvatarPersonality: (id, personality) => {
      set((state) => ({
        avatars: state.avatars.map((a) =>
          a.id === id ? { ...a, personality } : a
        ),
      }));

      updateAvatarOnServer(id, { personality }).catch(() => {});
    },

    // ────────────────────────────────────────────────────────
    // updateAvatarImage — the client Avatar has an `image` field
    // that the server stores as `imageUrl` (nullable). For emoji
    // images, we set emoji + null imageUrl. For custom (deferred),
    // the URL is stored in imageUrl.
    // ────────────────────────────────────────────────────────
    updateAvatarImage: (id, image) => {
      const emoji = image.type === 'emoji' ? image.value : '📷';
      set((state) => ({
        avatars: state.avatars.map((a) =>
          a.id === id ? { ...a, image, emoji } : a
        ),
      }));

      updateAvatarOnServer(id, {
        emoji,
        imageUrl: image.type === 'custom' ? image.value : null,
      }).catch(() => {});
    },

    // ────────────────────────────────────────────────────────
    // addTitle — optimistic + server.
    // ────────────────────────────────────────────────────────
    addTitle: (id, title) => {
      let nextTitles: string[] | null = null;

      set((state) => {
        const avatar = state.avatars.find((a) => a.id === id);
        if (!avatar) return state;
        if (avatar.titles.includes(title)) return state;
        nextTitles = [...avatar.titles, title];
        return {
          avatars: state.avatars.map((a) =>
            a.id === id ? { ...a, titles: nextTitles! } : a
          ),
        };
      });

      if (nextTitles) {
        updateAvatarOnServer(id, { titles: nextTitles }).catch(() => {});
      }
    },

    // ────────────────────────────────────────────────────────
    // addDefeatedMaster — optimistic + server.
    // ────────────────────────────────────────────────────────
    addDefeatedMaster: (id, masterId) => {
      let nextMasters: string[] | null = null;

      set((state) => {
        const avatar = state.avatars.find((a) => a.id === id);
        if (!avatar) return state;
        if (avatar.defeatedMasters.includes(masterId)) return state;
        nextMasters = [...avatar.defeatedMasters, masterId];
        return {
          avatars: state.avatars.map((a) =>
            a.id === id ? { ...a, defeatedMasters: nextMasters! } : a
          ),
        };
      });

      if (nextMasters) {
        updateAvatarOnServer(id, { defeatedMasters: nextMasters }).catch(
          () => {}
        );
      }
    },

    // ────────────────────────────────────────────────────────
    // addXPReward — optimistic + server.
    // ────────────────────────────────────────────────────────
    addXPReward: (id, xp, rating = 0) => {
      let patch: {
        xp: number;
        rating: number;
        level: number;
      } | null = null;

      set((state) => {
        const avatar = state.avatars.find((a) => a.id === id);
        if (!avatar) return state;

        const newXP = avatar.xp + xp;
        const newRating = Math.max(0, avatar.rating + rating);
        const newLevel = calculateLevelLocal(newXP);
        patch = { xp: newXP, rating: newRating, level: newLevel };

        return {
          avatars: state.avatars.map((a) =>
            a.id === id
              ? { ...a, xp: newXP, rating: newRating, level: newLevel }
              : a
          ),
        };
      });

      if (patch) {
        updateAvatarOnServer(id, patch).catch(() => {});
      }
    },

    // ────────────────────────────────────────────────────────
    // recordMatch — local-only, unchanged from pre-Chat-9b.
    // Server-side match_history is separate.
    // ────────────────────────────────────────────────────────
    recordMatch: (record) => {
      set((state) => {
        const newRecord: MatchRecord = {
          ...record,
          id:
            Date.now().toString(36) +
            Math.random().toString(36).substring(2, 6),
          timestamp: Date.now(),
        };
        const matchHistory = [newRecord, ...state.matchHistory].slice(0, 100);
        saveMatchHistoryLocal(matchHistory);
        return { matchHistory };
      });
    },

    getAvatarMatches: (avatarId) => {
      return get().matchHistory.filter((m) => m.avatarId === avatarId);
    },

    getRecentMatches: (limit = 10) => {
      return get().matchHistory.slice(0, limit);
    },

    // ────────────────────────────────────────────────────────
    // deleteAvatar — optimistic + server. Server auto-selects next
    // most recent if we just deleted the selected one.
    // ────────────────────────────────────────────────────────
    deleteAvatar: (id) => {
      const wasSelected = get().selectedAvatarId === id;

      set((state) => ({
        avatars: state.avatars.filter((a) => a.id !== id),
        selectedAvatarId:
          state.selectedAvatarId === id ? null : state.selectedAvatarId,
        matchHistory: state.matchHistory.filter((m) => m.avatarId !== id),
      }));

      // Persist trimmed match history.
      saveMatchHistoryLocal(get().matchHistory);

      deleteAvatarOnServer(id).then((res) => {
        if (!res.success) {
          console.log('[AVATAR STORE] deleteAvatar server failed:', res.message);
          return;
        }
        // Server may have auto-selected a different avatar. The
        // onAvatarsUpdate listener will reconcile, but to be safe we
        // also apply the newSelectedId directly.
        if (wasSelected && res.newSelectedId) {
          set({ selectedAvatarId: res.newSelectedId });
        }
      });
    },

    // ────────────────────────────────────────────────────────
    // getSelectedAvatar — unchanged.
    // ────────────────────────────────────────────────────────
    getSelectedAvatar: () => {
      const { avatars, selectedAvatarId } = get();
      return avatars.find((a) => a.id === selectedAvatarId) || null;
    },
  })
);

function calculateLevelLocal(xp: number): number {
  const LEVELS = [0, 100, 250, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i]) return i + 1;
  }
  return 1;
}