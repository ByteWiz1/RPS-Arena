import { create } from 'zustand';
import {
  UserIdentity,
  loadIdentity,
  createIdentity,
  updateIdentity,
  clearIdentity as clearStoredIdentity,
} from '../services/identity';

interface UserState {
  identity: UserIdentity | null;
  loaded: boolean;
  isNewUser: boolean;

  loadUser: () => Promise<void>;
  createUser: (username: string, avatar?: string) => Promise<void>;
  updateUser: (updates: Partial<UserIdentity>) => Promise<void>;
  clearUser: () => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  identity: null,
  loaded: false,
  isNewUser: false,

  loadUser: async () => {
    const identity = await loadIdentity();
    set({
      identity,
      loaded: true,
      isNewUser: !identity,
    });
  },

  createUser: async (username, avatar) => {
    const identity = await createIdentity(username, avatar);
    set({
      identity,
      loaded: true,
      isNewUser: false,
    });
  },

  updateUser: async (updates) => {
    const updated = await updateIdentity(updates);
    if (updated) set({ identity: updated });
  },

  clearUser: async () => {
    await clearStoredIdentity();
    set({ identity: null, isNewUser: true });
  },
}));