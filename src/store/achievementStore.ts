// src/store/achievementStore.ts
//
// RPS Arena — achievement state (Chat 7, roadmap item #4).
//
// Holds the 25-item catalog and this user's unlocked set. The catalog
// is static (server-owned, pulled once per session); unlocks are keyed
// by achievementId with their unlock timestamp.
//
// Persistence: none. The server is the source of truth — we refetch on
// mount. A local cache would just risk drift (e.g. after a schema/catalog
// change) with no real benefit at this scale.
//
// Listens for nothing itself — the socket wiring lives in App.tsx, which
// calls handleUnlock() when the server pushes 'achievementUnlocked'.

import { create } from 'zustand';

import {
  AchievementCatalogEntry,
  getAchievementCatalogFromServer,
  getAchievementsFromServer,
} from '../services/multiplayer';

interface AchievementState {
  catalog: AchievementCatalogEntry[];
  /** achievementId → unlockedAt (ms) */
  unlockedIds: Record<string, number>;
  catalogLoaded: boolean;
  unlockedLoaded: boolean;

  /** Fetch the 25-item catalog once. Idempotent. */
  loadCatalog: () => Promise<void>;
  /** Fetch this user's unlocked set. Safe to call on focus. */
  loadUnlocked: () => Promise<void>;
  /** Record a fresh unlock pushed from the server. */
  handleUnlock: (achievement: {
    id: string;
    name?: string;
    description?: string;
    icon?: string;
    category?: string;
  }) => void;
  /** Convenience — how many of the catalog are unlocked. */
  unlockedCount: () => number;
}

export const useAchievementStore = create<AchievementState>((set, get) => ({
  catalog: [],
  unlockedIds: {},
  catalogLoaded: false,
  unlockedLoaded: false,

  loadCatalog: async () => {
    // Catalog is immutable for the session — only fetch once.
    if (get().catalogLoaded && get().catalog.length > 0) return;

    const catalog = await getAchievementCatalogFromServer();
    set({ catalog, catalogLoaded: true });
  },

  loadUnlocked: async () => {
    const unlocked = await getAchievementsFromServer();
    set({ unlockedIds: unlocked || {}, unlockedLoaded: true });
  },

  handleUnlock: (achievement) => {
    if (!achievement?.id) return;

    const current = get().unlockedIds;
    if (current[achievement.id]) {
      // Already known — no-op. Server shouldn't re-emit, but be safe.
      return;
    }

    set({
      unlockedIds: {
        ...current,
        [achievement.id]: Date.now(),
      },
    });
  },

  unlockedCount: () => {
    const { unlockedIds, catalog } = get();
    if (!catalog.length) return Object.keys(unlockedIds).length;
    // Only count ids that are actually in the catalog, so a stale
    // unlock (e.g. a removed achievement) never skews the total.
    let n = 0;
    for (const a of catalog) {
      if (unlockedIds[a.id]) n++;
    }
    return n;
  },
}));