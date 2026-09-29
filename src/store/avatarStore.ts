// src/store/avatarStore.ts
//
// RPS Arena — avatar store.
//
// Chat 9b: server-authoritative cache.
// Chat 9d:
//   - createNewAvatar no longer does an optimistic insert. It waits
//     for the server response and inserts the server-returned avatar
//     (with the server-generated UUID). Fixes the ID-mismatch case
//     where the client's AvatarEngine id is not a UUID.
//
// Public API unchanged. Every existing consumer keeps working.

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const MATCH_HISTORY_KEY = '@rps_match_history';

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

  syncFromServer: () => Promise<void>;
  attachServerListener: () => () => void;
}

// ────────────────────────────────────────────────────────────
// Server → client mapping
// ────────────────────────────────────────────────────────────
function serverToClient(s: ServerAvatar): Avatar {
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

// ────────────────────────────────────────────────────────────
// Local match-history persistence (still AsyncStorage)
// ────────────────────────────────────────────────────────────
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
        const selected = serverAvatars.find((x) => x.isSelected);

        set({
          avatars,
          selectedAvatarId: selected?.id || null,
          matchHistory: localHistory,
          loaded: true,
          syncInFlight: false,
        });
      } catch (e) {
        console.log('[AVATAR STORE] syncFromServer error:', e);
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

    loadAvatars: async () => {
      await get().syncFromServer();
    },

    // ────────────────────────────────────────────────────────
    // createNewAvatar — server-generates the ID (Chat 9d).
    // No optimistic insert. Wait for the server response, then
    // add the server-returned avatar to state.
    // ────────────────────────────────────────────────────────
    createNewAvatar: (name, emoji) => {
      // Build a local engine avatar so we have the right shape for
      // personality defaults, etc. The engine's id is discarded — the
      // server sends back the real one.
      const draft = engineCreateAvatar(name);
      if (emoji) {
        draft.emoji = emoji;
        draft.image = { type: 'emoji', value: emoji };
      }

      createAvatarOnServer({
        name: draft.name,
        emoji: draft.emoji,
        personality: draft.personality,
        defeatedMasters: draft.defeatedMasters,
      }).then((res) => {
        if (res.success && res.avatar) {
          const created = serverToClient(res.avatar);
          set((state) => {
            const already = state.avatars.some((a) => a.id === created.id);
            if (already) return state;
            return {
              avatars: [...state.avatars, created],
              selectedAvatarId: state.selectedAvatarId || created.id,
            };
          });
        } else {
          console.log('[AVATAR STORE] createAvatar failed:', res.message);
        }
      });
    },

    // ────────────────────────────────────────────────────────
    // selectAvatar — optimistic, then server
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
    // updateAvatarAfterMatch
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
    // updateAvatarPersonality — optimistic + server
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
    // updateAvatarImage
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
    // addTitle — optimistic + server
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
    // addDefeatedMaster — optimistic + server
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
    // addXPReward — optimistic + server
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
    // recordMatch — local-only
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
    // deleteAvatar — optimistic + server
    // ────────────────────────────────────────────────────────
    deleteAvatar: (id) => {
      const wasSelected = get().selectedAvatarId === id;

      set((state) => ({
        avatars: state.avatars.filter((a) => a.id !== id),
        selectedAvatarId:
          state.selectedAvatarId === id ? null : state.selectedAvatarId,
        matchHistory: state.matchHistory.filter((m) => m.avatarId !== id),
      }));

      saveMatchHistoryLocal(get().matchHistory);

      deleteAvatarOnServer(id).then((res) => {
        if (!res.success) {
          console.log('[AVATAR STORE] deleteAvatar server failed:', res.message);
          return;
        }
        if (wasSelected && res.newSelectedId) {
          set({ selectedAvatarId: res.newSelectedId });
        }
      });
    },

    // ────────────────────────────────────────────────────────
    // getSelectedAvatar
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