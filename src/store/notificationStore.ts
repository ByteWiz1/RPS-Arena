import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type NotificationType =
  | 'invite_received'
  | 'invite_accepted'
  | 'invite_declined'
  | 'match_starting'
  | 'achievement'
  | 'info';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  action?: { screen: string; params?: any };
}

/** Fields the caller supplies — id, timestamp, read are auto-filled. */
export type NewNotification = Omit<
  AppNotification,
  'id' | 'timestamp' | 'read'
> & { read?: boolean };

const NOTIFICATIONS_KEY = '@rps_notifications';
const MAX_NOTIFICATIONS = 50;

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  loaded: boolean;

  addNotification: (partial: NewNotification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  loadNotifications: () => Promise<void>;
}

/** Recompute unread count from a list. Keeps state.unreadCount in sync. */
function countUnread(list: AppNotification[]): number {
  return list.filter((n) => !n.read).length;
}

/** Auto id: timestamp + random suffix (collision-safe enough for this use). */
function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Sort newest-first and cap. Used after load/merge. */
function normalize(list: AppNotification[]): AppNotification[] {
  return [...list]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_NOTIFICATIONS);
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loaded: false,

  addNotification: (partial) => {
    const entry: AppNotification = {
      id: makeId(),
      timestamp: Date.now(),
      read: partial.read ?? false,
      type: partial.type,
      title: partial.title,
      body: partial.body,
      action: partial.action,
    };
    // Prepend, cap at 50.
    const next = normalize([entry, ...get().notifications]);
    set({ notifications: next, unreadCount: countUnread(next) });
    saveNotifications();
  },

  markAsRead: (id) => {
    let changed = false;
    const next = get().notifications.map((n) => {
      if (n.id === id && !n.read) {
        changed = true;
        return { ...n, read: true };
      }
      return n;
    });
    if (!changed) return;
    set({ notifications: next, unreadCount: countUnread(next) });
    saveNotifications();
  },

  markAllAsRead: () => {
    const current = get().notifications;
    if (current.every((n) => n.read)) return;
    const next = current.map((n) => (n.read ? n : { ...n, read: true }));
    set({ notifications: next, unreadCount: 0 });
    saveNotifications();
  },

  clearAll: () => {
    set({ notifications: [], unreadCount: 0 });
    saveNotifications();
  },

  loadNotifications: async () => {
    try {
      const json = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
      const persisted: AppNotification[] = json ? JSON.parse(json) : [];

      // Merge with anything that arrived while we were loading (socket events
      // can fire before this resolves). Dedupe by id, newest-first, cap 50.
      const live = get().notifications;
      const merged = normalize([...live, ...persisted]);

      set({
        notifications: merged,
        unreadCount: countUnread(merged),
        loaded: true,
      });
    } catch (error) {
      console.log('Load notifications error:', error);
      // Keep whatever is already in memory; just mark loaded.
      const live = get().notifications;
      set({ unreadCount: countUnread(live), loaded: true });
    }
  },
}));

async function saveNotifications() {
  try {
    const { notifications } = useNotificationStore.getState();
    await AsyncStorage.setItem(
      NOTIFICATIONS_KEY,
      JSON.stringify(notifications)
    );
  } catch (error) {
    console.log('Save notifications error:', error);
  }
}