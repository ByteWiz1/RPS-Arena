import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Avatar,
  AvatarPersonality,
  createAvatar,
  updateAvatarStats,
  DEFAULT_PERSONALITY,
} from '../engine/AvatarEngine';

const STORAGE_KEY = '@rps_avatars';

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
}

interface AvatarActions {
  createNewAvatar: (name: string, emoji?: string) => void;
  selectAvatar: (id: string) => void;
  updateAvatarAfterMatch: (id: string, result: 'win' | 'lose' | 'tie') => void;
  deleteAvatar: (id: string) => void;
  getSelectedAvatar: () => Avatar | null;
  updateAvatarPersonality: (id: string, personality: AvatarPersonality) => void;
  addTitle: (id: string, title: string) => void;
  addDefeatedMaster: (id: string, masterId: string) => void;
  addXPReward: (id: string, xp: number, rating?: number) => void;
  recordMatch: (record: Omit<MatchRecord, 'id' | 'timestamp'>) => void;
  getAvatarMatches: (avatarId: string) => MatchRecord[];
  getRecentMatches: (limit?: number) => MatchRecord[];
  loadAvatars: () => Promise<void>;
}

export const useAvatarStore = create<AvatarState & AvatarActions>((set, get) => ({
  avatars: [],
  selectedAvatarId: null,
  matchHistory: [],
  loaded: false,

  loadAvatars: async () => {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      if (json) {
        const data = JSON.parse(json);
        const avatars = (data.avatars || []).map((a: any) => ({
          ...a,
          personality: a.personality || { ...DEFAULT_PERSONALITY },
          titles: a.titles || [],
          defeatedMasters: a.defeatedMasters || [],
          winStreak: a.winStreak || 0,
          bestStreak: a.bestStreak || 0,
          emoji: a.emoji || '🤖',
          createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
        }));
        set({
          avatars,
          selectedAvatarId: data.selectedAvatarId || null,
          matchHistory: data.matchHistory || [],
          loaded: true,
        });
      } else {
        set({ loaded: true });
      }
    } catch (error) {
      console.log('Load avatars error:', error);
      set({ loaded: true });
    }
  },

  createNewAvatar: (name, emoji) => {
    const avatar = createAvatar(name);
    if (emoji) avatar.emoji = emoji;
    set((state) => {
      const newState = {
        avatars: [...state.avatars, avatar],
        selectedAvatarId: state.selectedAvatarId || avatar.id,
      };
      saveAll(newState.avatars, newState.selectedAvatarId, state.matchHistory);
      return newState;
    });
  },

  selectAvatar: (id) => {
    set((state) => {
      saveAll(state.avatars, id, state.matchHistory);
      return { selectedAvatarId: id };
    });
  },

  updateAvatarAfterMatch: (id, result) => {
    set((state) => {
      const avatar = state.avatars.find((a) => a.id === id);
      if (!avatar) return state;
      const updated = updateAvatarStats(avatar, result);
      const avatars = state.avatars.map((a) => (a.id === id ? updated : a));
      saveAll(avatars, state.selectedAvatarId, state.matchHistory);
      return { avatars };
    });
  },

  updateAvatarPersonality: (id, personality) => {
    set((state) => {
      const avatars = state.avatars.map((a) =>
        a.id === id ? { ...a, personality } : a
      );
      saveAll(avatars, state.selectedAvatarId, state.matchHistory);
      return { avatars };
    });
  },

  addTitle: (id, title) => {
    set((state) => {
      const avatars = state.avatars.map((a) =>
        a.id === id && !a.titles.includes(title)
          ? { ...a, titles: [...a.titles, title] }
          : a
      );
      saveAll(avatars, state.selectedAvatarId, state.matchHistory);
      return { avatars };
    });
  },

  addDefeatedMaster: (id, masterId) => {
    set((state) => {
      const avatars = state.avatars.map((a) =>
        a.id === id && !a.defeatedMasters.includes(masterId)
          ? { ...a, defeatedMasters: [...a.defeatedMasters, masterId] }
          : a
      );
      saveAll(avatars, state.selectedAvatarId, state.matchHistory);
      return { avatars };
    });
  },

  addXPReward: (id, xp, rating = 0) => {
    set((state) => {
      const avatars = state.avatars.map((a) => {
        if (a.id !== id) return a;
        const newXP = a.xp + xp;
        const newRating = Math.max(0, a.rating + rating);
        const newLevel = calculateLevelLocal(newXP);
        return { ...a, xp: newXP, rating: newRating, level: newLevel };
      });
      saveAll(avatars, state.selectedAvatarId, state.matchHistory);
      return { avatars };
    });
  },

  recordMatch: (record) => {
    set((state) => {
      const newRecord: MatchRecord = {
        ...record,
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        timestamp: Date.now(),
      };
      const matchHistory = [newRecord, ...state.matchHistory].slice(0, 100);
      saveAll(state.avatars, state.selectedAvatarId, matchHistory);
      return { matchHistory };
    });
  },

  getAvatarMatches: (avatarId) => {
    return get().matchHistory.filter((m) => m.avatarId === avatarId);
  },

  getRecentMatches: (limit = 10) => {
    return get().matchHistory.slice(0, limit);
  },

  deleteAvatar: (id) => {
    set((state) => {
      const avatars = state.avatars.filter((a) => a.id !== id);
      const selectedAvatarId =
        state.selectedAvatarId === id ? null : state.selectedAvatarId;
      const matchHistory = state.matchHistory.filter((m) => m.avatarId !== id);
      saveAll(avatars, selectedAvatarId, matchHistory);
      return { avatars, selectedAvatarId, matchHistory };
    });
  },

  getSelectedAvatar: () => {
    const { avatars, selectedAvatarId } = get();
    return avatars.find((a) => a.id === selectedAvatarId) || null;
  },
}));

function calculateLevelLocal(xp: number): number {
  const LEVELS = [0, 100, 250, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i]) return i + 1;
  }
  return 1;
}

async function saveAll(
  avatars: Avatar[],
  selectedAvatarId: string | null,
  matchHistory: MatchRecord[]
) {
  try {
    const data = JSON.stringify({ avatars, selectedAvatarId, matchHistory });
    await AsyncStorage.setItem(STORAGE_KEY, data);
  } catch (error) {
    console.log('Save avatars error:', error);
  }
}