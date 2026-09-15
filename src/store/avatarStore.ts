import { create } from 'zustand';
import { Avatar, createAvatar, updateAvatarStats } from '../engine/AvatarEngine';

interface AvatarState {
  avatars: Avatar[];
  selectedAvatarId: string | null;
}

interface AvatarActions {
  createNewAvatar: (name: string) => void;
  selectAvatar: (id: string) => void;
  updateAvatarAfterMatch: (id: string, result: 'win' | 'lose' | 'tie') => void;
  deleteAvatar: (id: string) => void;
  getSelectedAvatar: () => Avatar | null;
}

export const useAvatarStore = create<AvatarState & AvatarActions>((set, get) => ({
  avatars: [],
  selectedAvatarId: null,

  createNewAvatar: (name: string) => {
    const avatar = createAvatar(name);
    set((state) => ({
      avatars: [...state.avatars, avatar],
      selectedAvatarId: state.selectedAvatarId || avatar.id,
    }));
  },

  selectAvatar: (id: string) => set({ selectedAvatarId: id }),

  updateAvatarAfterMatch: (id, result) => {
    set((state) => {
      const avatar = state.avatars.find(a => a.id === id);
      if (!avatar) return state;
      const updated = updateAvatarStats(avatar, result);
      return { avatars: state.avatars.map(a => a.id === id ? updated : a) };
    });
  },

  deleteAvatar: (id) => {
    set((state) => ({
      avatars: state.avatars.filter(a => a.id !== id),
      selectedAvatarId: state.selectedAvatarId === id ? null : state.selectedAvatarId,
    }));
  },

  getSelectedAvatar: () => {
    const { avatars, selectedAvatarId } = get();
    return avatars.find(a => a.id === selectedAvatarId) || null;
  },
}));