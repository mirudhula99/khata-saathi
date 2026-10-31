// Notifications: tasks and alerts for the shopkeeper (GET /api/notifications), plus "seen" tracking.
// Unread = items that arrived after the merchant last opened the bell, kept per device in localStorage.
// Items in "action" (needs you now) count as unread until the condition clears, not just until seen.
import { create } from 'zustand';
import { api } from '@/lib/api';
import type { Notification, NotificationCategory } from '@/lib/types';

const SEEN_KEY = 'ks.notifications.seen';
const readSeen = (): string => { try { return localStorage.getItem(SEEN_KEY) ?? ''; } catch { return ''; } };
const writeSeen = (iso: string) => { try { localStorage.setItem(SEEN_KEY, iso); } catch { /* private mode */ } };

interface NotificationsStore {
  items: Notification[];
  counts: Partial<Record<NotificationCategory, number>>;
  loaded: boolean;
  seen: string;
  load: () => Promise<void>;
  markAllRead: () => void;
  isUnread: (n: Notification) => boolean;
  unreadCount: () => number;
}

export const useNotifications = create<NotificationsStore>((set, get) => ({
  items: [],
  counts: {},
  loaded: false,
  seen: readSeen(),
  load: async () => {
    try {
      const r = await api.notifications();
      set({ items: r.items, counts: r.counts, loaded: true });
    } catch { set({ loaded: true }); }
  },
  markAllRead: () => { const now = new Date().toISOString(); writeSeen(now); set({ seen: now }); },
  isUnread: (n) => n.category === 'action' ? true : n.at > get().seen,
  // The bell badge: open tasks plus unseen events. Future-dated "due tomorrow" rows don't count.
  unreadCount: () => get().items.filter((n) => n.category === 'action' || (n.at > get().seen && n.at <= new Date().toISOString())).length,
}));
