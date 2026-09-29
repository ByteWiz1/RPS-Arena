import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PremiumTier = 'free' | 'premium';

export interface PremiumState {
  tier: PremiumTier;
  expiresAt: number | null;
  plan: 'monthly' | '3month' | '6month' | 'yearly' | null;
  loaded: boolean;

  isPremium: () => boolean;
  activate: (plan: 'monthly' | '3month' | '6month' | 'yearly') => void;
  deactivate: () => void;
  loadPremium: () => Promise<void>;
}

const STORAGE_KEY = '@rps_premium';

const PLAN_DURATIONS = {
  monthly: 30 * 24 * 60 * 60 * 1000,
  '3month': 90 * 24 * 60 * 60 * 1000,
  '6month': 180 * 24 * 60 * 60 * 1000,
  yearly: 365 * 24 * 60 * 60 * 1000,
};

export const usePremiumStore = create<PremiumState>((set, get) => ({
  tier: 'free',
  expiresAt: null,
  plan: null,
  loaded: false,

  isPremium: () => {
    const { tier, expiresAt } = get();
    if (tier !== 'premium') return false;
    if (expiresAt && expiresAt < Date.now()) {
      set({ tier: 'free', expiresAt: null, plan: null });
      savePremium('free', null, null);
      return false;
    }
    return true;
  },

  activate: (plan) => {
    const duration = PLAN_DURATIONS[plan];
    const expiresAt = Date.now() + duration;
    set({ tier: 'premium', expiresAt, plan });
    savePremium('premium', expiresAt, plan);
  },

  deactivate: () => {
    set({ tier: 'free', expiresAt: null, plan: null });
    savePremium('free', null, null);
  },

  loadPremium: async () => {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      if (json) {
        const data = JSON.parse(json);
        const tier = data.tier || 'free';
        const expiresAt = data.expiresAt || null;
        const plan = data.plan || null;

        if (tier === 'premium' && expiresAt && expiresAt < Date.now()) {
          set({ tier: 'free', expiresAt: null, plan: null, loaded: true });
          savePremium('free', null, null);
        } else {
          set({ tier, expiresAt, plan, loaded: true });
        }
      } else {
        set({ loaded: true });
      }
    } catch (error) {
      console.log('Load premium error:', error);
      set({ loaded: true });
    }
  },
}));

async function savePremium(
  tier: PremiumTier,
  expiresAt: number | null,
  plan: string | null
) {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ tier, expiresAt, plan })
    );
  } catch (error) {
    console.log('Save premium error:', error);
  }
}

export const PREMIUM_FEATURES = [
  { id: 'online', label: 'Online Multiplayer', desc: 'Play with anyone worldwide', icon: '🌐' },
  { id: 'leaderboard', label: 'Leaderboard', desc: 'Compete globally for rank', icon: '🏆' },
  { id: 'avatars', label: '5 Avatar Slots', desc: 'Train multiple champions', icon: '🎭' },
  { id: 'analytics', label: 'Advanced Analytics', desc: 'Deep AI training insights', icon: '📊' },
  { id: 'rules', label: 'Custom Match Rules', desc: 'Best of 3, 5, or 7', icon: '⚙️' },
  { id: 'tournaments', label: 'Private Tournaments', desc: 'Host 8-player brackets', icon: '🥋' },
  { id: 'skins', label: 'Premium Avatar Skins', desc: 'Exclusive visuals', icon: '✨' },
  { id: 'badge', label: 'Premium Badge', desc: 'Stand out on leaderboards', icon: '👑' },
  { id: 'early', label: 'Early Access', desc: 'Try new features first', icon: '🚀' },
];

export const PREMIUM_PLANS = [
  { id: 'monthly', label: 'Monthly', price: '$2.99', period: '/month', savings: null, popular: false },
  { id: '3month', label: '3 Months', price: '$6.99', period: 'total', savings: 'Save 22%', popular: false },
  { id: '6month', label: '6 Months', price: '$12.99', period: 'total', savings: 'Save 28%', popular: true },
  { id: 'yearly', label: 'Yearly', price: '$19.99', period: 'total', savings: 'Save 44%', popular: false },
];