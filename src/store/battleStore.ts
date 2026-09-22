import { create } from 'zustand';

export type BattleMode = 'human' | 'avatar';

interface BattleState {
  mode: BattleMode;
  setMode: (mode: BattleMode) => void;
  reset: () => void;
}

export const useBattleStore = create<BattleState>((set) => ({
  mode: 'human',
  setMode: (mode) => {
    console.log('[BATTLE STORE] mode set to:', mode);
    set({ mode });
  },
  reset: () => set({ mode: 'human' }),
}));