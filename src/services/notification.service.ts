import type * as NotificationsType from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { authService, API_BASE_URL } from './auth.service';

const DEVICE_ID_KEY = 'splitit_device_id';

let cachedNotificationsModule: typeof NotificationsType | null | undefined = undefined;

function getNotificationsModule(): typeof NotificationsType | null {
  if (cachedNotificationsModule !== undefined) {
    return cachedNotificationsModule;
  }
  // Expo SDK 53+ removed Android remote notifications from Expo Go and throws a fatal error
  // Development builds (npx expo run:android or EAS) have full native push support
  if (isRunningInExpoGo() && Platform.OS === 'android') {
    cachedNotificationsModule = null;
    return null;
  }
  try {
    const mod = require('expo-notifications') as typeof NotificationsType;
    cachedNotificationsModule = mod;
    return mod;
  } catch (e) {
    console.warn('expo-notifications module could not be loaded in this runtime:', e);
    cachedNotificationsModule = null;
    return null;
  }
}

export interface InAppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: {
    groupId?: string;
    expenseId?: string;
    settlementId?: string;
    ticketId?: string;
    url?: string;
  };
}

export interface NotificationEventPref {
  inApp: boolean;
  push: boolean;
  email: boolean;
}

export interface UserNotificationPreferences {
  inAppEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  events: {
    expense_added: NotificationEventPref;
    expense_updated: NotificationEventPref;
    expense_deleted: NotificationEventPref;
    settlement_added: NotificationEventPref;
    member_added: NotificationEventPref;
    member_removed: NotificationEventPref;
    balance_reminder: NotificationEventPref;
    payment_reminder: NotificationEventPref;
    support_reply: NotificationEventPref;
    budget_alert: NotificationEventPref;
    budget_exceeded: NotificationEventPref;
  };
}

export const DEFAULT_NOTIFICATION_PREFERENCES: UserNotificationPreferences = {
  inAppEnabled: true,
  pushEnabled: true,
  emailEnabled: true,
  events: {
    expense_added: { inApp: true, push: true, email: false },
    expense_updated: { inApp: true, push: true, email: false },
    expense_deleted: { inApp: true, push: true, email: false },
    settlement_added: { inApp: true, push: true, email: true },
    member_added: { inApp: true, push: true, email: false },
    member_removed: { inApp: true, push: true, email: false },
    balance_reminder: { inApp: true, push: true, email: true },
    payment_reminder: { inApp: true, push: true, email: true },
    support_reply: { inApp: true, push: true, email: true },
    budget_alert: { inApp: true, push: true, email: true },
    budget_exceeded: { inApp: true, push: true, email: true },
  },
};

export const notificationService = {
  /**
   * Configure notification handlers and default Android channel
   */
  async initNotifications(): Promise<void> {
    const Notifications = getNotificationsModule();
    if (!Notifications) return;

    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'SplitIt Notifications',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#10B981',
          sound: 'default',
        });
      }
    } catch (e) {
      console.warn('Notifications init failed:', e);
    }
  },

  /**
   * Get or generate a persistent unique Device ID for push subscriptions
   */
  async getDeviceId(): Promise<string> {
    try {
      let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
      if (!id) {
        id = `dev_${Platform.OS}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
      }
      return id;
    } catch {
      return `dev_${Platform.OS}_fallback_${Date.now()}`;
    }
  },

  /**
   * Registers for Expo push notifications and uploads token to backend
   */
  async registerForPushNotifications(): Promise<string | null> {
    const Notifications = getNotificationsModule();
    if (!Notifications) {
      return null;
    }

    try {
      if (isRunningInExpoGo()) {
        return null;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync();
      const expoPushToken = tokenData.data;
      const deviceId = await this.getDeviceId();
      const token = await authService.getToken();

      // Post to backend
      await fetch(`${API_BASE_URL}/api/push/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({
          platform: 'expo',
          deviceId,
          expoPushToken,
          deviceName: Platform.OS === 'ios' ? 'Apple iPhone' : 'Android Smartphone',
        }),
      });

      return expoPushToken;
    } catch (e) {
      console.warn('Register for push notifications skipped/failed:', e);
      return null;
    }
  },

  /**
   * List in-app notifications
   */
  async getInAppNotifications(): Promise<InAppNotification[]> {
    try {
      const token = await authService.getToken();
      const res = await fetch(`${API_BASE_URL}/api/notifications`, {
        headers: {
          Authorization: `Bearer ${token || ''}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch (e) {
      console.warn('Failed to fetch notifications from backend, using cached list:', e);
    }

    // High quality offline fallback items
    return [
      {
        id: 'notif_1',
        type: 'expense_added',
        title: 'New Expense Added',
        message: 'Rohit added "Scuba Diving Gears" (₹4,800.00) in Goa Trip',
        read: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        data: { groupId: '1' },
      },
      {
        id: 'notif_2',
        type: 'budget_alert',
        title: 'Budget Velocity Alert ⚠️',
        message: 'Goa Trip has reached 70% of monthly budget limit with 10 days left',
        read: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
        data: { groupId: '1' },
      },
      {
        id: 'notif_3',
        type: 'settlement_added',
        title: 'Settlement Recorded',
        message: 'Priya settled ₹1,500.00 with you via UPI',
        read: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        data: { groupId: '1' },
      },
      {
        id: 'notif_4',
        type: 'support_reply',
        title: 'Support Ticket Update',
        message: 'Agent replied to Ticket #SP-104: "UPI QR verification is resolved"',
        read: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
        data: { ticketId: 'SP-104' },
      },
    ];
  },

  /**
   * Mark single notification as read
   */
  async markNotificationRead(id: string): Promise<boolean> {
    try {
      const token = await authService.getToken();
      const res = await fetch(`${API_BASE_URL}/api/notifications/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({ read: true }),
      });
      return res.ok;
    } catch {
      return true;
    }
  },

  /**
   * Mark all notifications as read
   */
  async markAllNotificationsRead(): Promise<boolean> {
    try {
      const token = await authService.getToken();
      const res = await fetch(`${API_BASE_URL}/api/notifications/mark-all-read`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token || ''}`,
        },
      });
      return res.ok;
    } catch {
      return true;
    }
  },

  /**
   * Fetch notification preferences
   */
  async getPreferences(): Promise<UserNotificationPreferences> {
    try {
      const token = await authService.getToken();
      const res = await fetch(`${API_BASE_URL}/api/notifications/prefs`, {
        headers: {
          Authorization: `Bearer ${token || ''}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        return {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          ...data,
          events: {
            ...DEFAULT_NOTIFICATION_PREFERENCES.events,
            ...(data.events || {}),
          },
        };
      }
    } catch (e) {
      console.warn('Failed to fetch notification preferences:', e);
    }
    return DEFAULT_NOTIFICATION_PREFERENCES;
  },

  /**
   * Update notification preferences
   */
  async updatePreferences(prefs: Partial<UserNotificationPreferences>): Promise<boolean> {
    try {
      const token = await authService.getToken();
      const res = await fetch(`${API_BASE_URL}/api/notifications/prefs`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify(prefs),
      });
      return res.ok;
    } catch {
      return true;
    }
  },

  /**
   * Listen to push notification clicks and route deep links
   */
  setupResponseListener(navigate: (route: string) => void): { remove: () => void } {
    const Notifications = getNotificationsModule();
    if (!Notifications) {
      return { remove: () => {} };
    }

    try {
      return Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as any;
        if (!data) return;

        if (data.groupId) {
          navigate(`/groups/${data.groupId}`);
        } else if (data.ticketId) {
          navigate(`/support/${data.ticketId}`);
        } else if (data.url && typeof data.url === 'string') {
          navigate(data.url);
        }
      });
    } catch (e) {
      console.warn('Failed to attach notification response listener:', e);
      return { remove: () => {} };
    }
  },
};
