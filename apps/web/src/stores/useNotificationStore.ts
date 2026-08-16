import { createStore } from "./createStore";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: "chat" | "knowledge" | "analytics" | "system";
  timestamp: string;
  read: boolean;
  action_url?: string;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [];

interface NotificationState {
  notifications: NotificationItem[];
  addNotification: (item: Omit<NotificationItem, "id" | "timestamp" | "read"> & { id?: string }) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = createStore<NotificationState>((set, get) => ({
  notifications: INITIAL_NOTIFICATIONS,

  addNotification: (item) => {
    const newNotif: NotificationItem = {
      id: item.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: item.title,
      message: item.message,
      type: item.type,
      timestamp: new Date().toISOString(),
      read: false,
      action_url: item.action_url,
    };
    set((state) => ({
      notifications: [newNotif, ...state.notifications],
    }));
  },

  markAsRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clearAll: () => {
    set({ notifications: [] });
  },
}));
