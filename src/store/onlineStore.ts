import { create } from 'zustand';

export interface OnlineUser {
  userId: string;
  name: string;
  username: string;
  avatar: string;
  status: 'online' | 'in-match' | 'offline';
  socketId: string;
}

interface OnlineState {
  users: OnlineUser[];
  count: number;
  setUsers: (users: OnlineUser[]) => void;
  setCount: (count: number) => void;
}

export const useOnlineStore = create<OnlineState>((set) => ({
  users: [],
  count: 0,
  setUsers: (users) => set({ users }),
  setCount: (count) => set({ count }),
}));