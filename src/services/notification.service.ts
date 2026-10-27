import type * as NotificationsType from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { authService } from './auth.service';
import { getAuthenticatedHeaders, API_BASE_URL } from './api-headers';
import { THEME } from '../constants/theme';
import { appEventEmitter } from './event-emitter';

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
  } catch {
    cachedNotificationsModule = null;
    return null;
  }
}

export interface InAppNotification {
  id: string;
  type: string;
  title: string;
  message?: string;
  body?: string;
  read?: boolean;
  isRead?: boolean;
  createdAt: string;
  actorId?: string;
  actor?: {
    uid?: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
    email?: string;
  };
  groupId?: string;
  expenseId?: string;
  settlementId?: string;
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
    expense_restored: NotificationEventPref;
    settlement_added: NotificationEventPref;
    settlement_updated: NotificationEventPref;
    settlement_deleted: NotificationEventPref;
    settlement_restored: NotificationEventPref;
    member_added: NotificationEventPref;
    member_removed: NotificationEventPref;
    group_updated: NotificationEventPref;
    balance_reminder: NotificationEventPref;
    payment_reminder: NotificationEventPref;
    payment_confirmation_request: NotificationEventPref;
    support_reply: NotificationEventPref;
    budget_alert: NotificationEventPref;
    budget_exceeded: NotificationEventPref;
    budget_updated: NotificationEventPref;
    broadcast_announcement: NotificationEventPref;
    broadcast_critical: NotificationEventPref;
    monthly_summary: NotificationEventPref;
    group_inactivity: NotificationEventPref;
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
    expense_restored: { inApp: true, push: true, email: false },
    settlement_added: { inApp: true, push: true, email: true },
    settlement_updated: { inApp: true, push: true, email: false },
    settlement_deleted: { inApp: true, push: true, email: false },
    settlement_restored: { inApp: true, push: true, email: true },
    member_added: { inApp: true, push: true, email: false },
    member_removed: { inApp: true, push: true, email: false },
    group_updated: { inApp: true, push: true, email: false },
    balance_reminder: { inApp: true, push: true, email: true },
    payment_reminder: { inApp: true, push: true, email: true },
    payment_confirmation_request: { inApp: true, push: true, email: true },
    support_reply: { inApp: true, push: true, email: true },
    budget_alert: { inApp: true, push: true, email: true },
    budget_exceeded: { inApp: true, push: true, email: true },
    budget_updated: { inApp: true, push: true, email: true },
    broadcast_announcement: { inApp: true, push: true, email: false },
    broadcast_critical: { inApp: true, push: true, email: true },
    monthly_summary: { inApp: true, push: false, email: true },
    group_inactivity: { inApp: true, push: true, email: true },
  },
};

let _cachedNotifications: InAppNotification[] = [];

export const notificationService = {
  /**
   * Synchronous accessor for in-memory cached notifications (prevents screen blanking).
   */
  getInMemoryNotifications(): InAppNotification[] {
    return _cachedNotifications;
  },

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
          lightColor: THEME.colors.primary,
          sound: 'default',
        });
      }
    } catch {
      // Ignored for environments without native notification channels
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
        headers: getAuthenticatedHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          platform: 'expo',
          deviceId,
          expoPushToken,
          deviceName: Platform.OS === 'ios' ? 'Apple iPhone' : 'Android Smartphone',
        }),
      });

      return expoPushToken;
    } catch {
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
        headers: getAuthenticatedHeaders(token),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const normalized: InAppNotification[] = data.map((item: any) => ({
            ...item,
            body: item.body || item.message || '',
            message: item.message || item.body || '',
            isRead: item.isRead !== undefined ? !!item.isRead : !!item.read,
            read: item.isRead !== undefined ? !!item.isRead : !!item.read,
            groupId: item.groupId || item.data?.groupId,
            expenseId: item.expenseId || item.data?.expenseId,
            settlementId: item.settlementId || item.data?.settlementId,
          }));
          _cachedNotifications = normalized;
          return normalized;
        }
      }
    } catch {
      // Fall through to cached / offline list
    }

    if (_cachedNotifications.length > 0) return _cachedNotifications;
    return [];
  },

  /**
   * Synchronous check for unread notifications count from in-memory cache.
   */
  getUnreadCount(): number {
    return _cachedNotifications.filter((n) => (n.isRead !== undefined ? !n.isRead : !n.read)).length;
  },

  /**
   * Asynchronously fetch in-app notifications and return the authoritative unread count.
   */
  async fetchUnreadCount(): Promise<number> {
    const list = await this.getInAppNotifications();
    return list.filter((n) => (n.isRead !== undefined ? !n.isRead : !n.read)).length;
  },

  /**
   * Mark single notification as read
   */
  async markNotificationRead(id: string): Promise<boolean> {
    _cachedNotifications = _cachedNotifications.map((n) =>
      n.id === id ? { ...n, read: true, isRead: true } : n
    );
    appEventEmitter.emit('data-changed', { type: 'notifications_updated' });
    try {
      const token = await authService.getToken();
      const res = await fetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: getAuthenticatedHeaders(token, { 'Content-Type': 'application/json' }),
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
    _cachedNotifications = _cachedNotifications.map((n) => ({ ...n, read: true, isRead: true }));
    appEventEmitter.emit('data-changed', { type: 'notifications_updated' });
    try {
      const token = await authService.getToken();
      const res = await fetch(`${API_BASE_URL}/api/notifications/mark-all-read`, {
        method: 'POST',
        headers: getAuthenticatedHeaders(token),
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
        headers: getAuthenticatedHeaders(token),
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
    } catch {
      // Fall through to defaults
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
        headers: getAuthenticatedHeaders(token, { 'Content-Type': 'application/json' }),
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

        const { type, groupId, expenseId, settlementId, ticketId, url, tab } = data;

        // 1. Direct explicit URL payload
        if (url && typeof url === 'string') {
          navigate(url);
          return;
        }

        // 2. Expense item view
        if (expenseId && groupId) {
          navigate(`/expenses/${expenseId}?groupId=${groupId}`);
          return;
        }

        // 3. Settlement item view
        if (settlementId && groupId) {
          navigate(`/settlements/${settlementId}?groupId=${groupId}`);
          return;
        }

        // 4. Budget tab view
        if (tab === 'budget' && groupId) {
          navigate(`/groups/${groupId}?tab=budget`);
          return;
        }
        if (type === 'budget_alert' || type === 'budget_exceeded' || type === 'budget_updated') {
          if (groupId) {
            navigate(`/groups/${groupId}?tab=budget`);
            return;
          }
        }

        // 5. Monthly summary analysis
        if (type === 'monthly_summary') {
          navigate('/(tabs)/analysis');
          return;
        }

        // 6. Support ticket resolution
        if (ticketId || type === 'support_reply') {
          navigate(ticketId ? `/support/${ticketId}` : '/support');
          return;
        }

        // 7. Group landing view
        if (groupId) {
          navigate(`/groups/${groupId}`);
          return;
        }

        // 8. System broadcast announcements
        if (type === 'broadcast_announcement' || type === 'broadcast_critical') {
          navigate('/notifications');
          return;
        }
      });
    } catch {
      return { remove: () => {} };
    }
  },

  /**
   * Send settle-up payment reminder notification (push + email)
   */
  async sendPaymentReminder(params: {
    debtorId: string;
    amount: number;
    groupName?: string;
    groupId?: string;
    sendEmail?: boolean;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const token = await authService.getToken();
      const currentUser = await authService.getCachedUser();
      const actorId = currentUser?.id || 'u1';
      const actorName = currentUser?.name || 'Member';
      const actorUpiId = currentUser?.upiId;

      const upiUri = actorUpiId
        ? `upi://pay?pa=${encodeURIComponent(actorUpiId)}&pn=${encodeURIComponent(actorName)}&am=${Number(params.amount || 0).toFixed(2)}&cu=INR&tn=${encodeURIComponent('SplitWise Settlement')}`
        : undefined;

      const disclaimer =
        "Note: You'll need to update it manually in SplitIt that the amount is paid, because we don't directly receive or track payments and it is a free platform with zero usage fee.";

      const bodyPayload = {
        type: 'payment_reminder',
        recipientIds: [params.debtorId],
        title: 'Settle Up Reminder',
        body: `A member is asking you to settle up ₹${Number(params.amount || 0).toFixed(2)}${params.groupName ? ` in "${params.groupName}"` : ''}.\n\n${disclaimer}`,
        actorId,
        groupId: params.groupId,
        target: 'specific_users',
        balanceAmount: `₹${Number(params.amount || 0).toFixed(2)}`,
        groupName: params.groupName || 'your group',
        upiUrl: upiUri,
        forceEmail: params.sendEmail !== false,
        disclaimer,
      };

      const res = await fetch(`${API_BASE_URL}/api/notifications/send`, {
        method: 'POST',
        headers: getAuthenticatedHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify(bodyPayload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, error: err.error || 'Failed to send reminder' };
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error' };
    }
  },

  clearCache(): void {
    _cachedNotifications = [];
  },
};