import type * as NotificationsType from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { authService } from './auth.service';
import { getAuthenticatedHeaders, API_BASE_URL } from './api-headers';
import { THEME } from '../constants/theme';
import { appEventEmitter } from './event-emitter';

const DEVICE_ID_KEY = 'splitit_device_id';
export const BACKGROUND_NOTIFICATION_TASK = 'SPLITIT_BACKGROUND_NOTIFICATION_SYNC';

let cachedNotificationsModule: typeof NotificationsType | null | undefined = undefined;

function getNotificationsModule(): typeof NotificationsType | null {
  if (cachedNotificationsModule !== undefined) {
    return cachedNotificationsModule;
  }
  // Expo Go on Android has removed expo-notifications native code since SDK 51/53.
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

export function getChannelIdForType(type: string): string {
  if (type.includes('expense')) return 'expenses';
  if (type.includes('settlement')) return 'settlements';
  if (type.includes('reminder') || type.includes('confirmation')) return 'reminders';
  if (type.includes('budget')) return 'budgets';
  if (type.includes('group') || type.includes('member')) return 'groups';
  if (type.includes('broadcast') || type.includes('announcement') || type.includes('support')) return 'announcements';
  return 'default';
}

export const notificationService = {
  _isInitialized: false,

  /**
   * Synchronous accessor for in-memory cached notifications (prevents screen blanking).
   */
  getInMemoryNotifications(): InAppNotification[] {
    return _cachedNotifications;
  },

  /**
   * Configure notification handlers and modern categorized Android notification channels
   */
  async initNotifications(): Promise<void> {
    const Notifications = getNotificationsModule();
    if (!Notifications) return;

    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      if (Platform.OS === 'android') {
        // 1. Expenses & Splits Channel (Max Importance, Cyan)
        await Notifications.setNotificationChannelAsync('expenses', {
          name: 'Expenses & Splits',
          description: 'Alerts when someone adds, updates, or deletes expenses in your groups',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#00C4CC',
          sound: 'default',
          enableLights: true,
          enableVibrate: true,
          showBadge: true,
        });

        // 2. Settlements & Payments Channel (Max Importance, Emerald)
        await Notifications.setNotificationChannelAsync('settlements', {
          name: 'Settlements & Payments',
          description: 'Alerts when settlements are recorded, paid, or cleared',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#10B981',
          sound: 'default',
          enableLights: true,
          enableVibrate: true,
          showBadge: true,
        });

        // 3. Reminders & Settle-up Channel (High Importance, Amber)
        await Notifications.setNotificationChannelAsync('reminders', {
          name: 'Payment & Balance Reminders',
          description: 'Direct payment reminders, settle-up requests, and pending balance alerts',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 300, 150, 300],
          lightColor: '#F59E0B',
          sound: 'default',
          enableLights: true,
          enableVibrate: true,
          showBadge: true,
        });

        // 4. Budget & Spending Alerts Channel (High Importance, Coral)
        await Notifications.setNotificationChannelAsync('budgets', {
          name: 'Budget & Spending Alerts',
          description: 'Monthly budget limits, burn rate warnings, and threshold alerts',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 200, 200, 200],
          lightColor: '#EF4444',
          sound: 'default',
          enableLights: true,
          enableVibrate: true,
          showBadge: true,
        });

        // 5. Group Activity & Members Channel (Default Importance, Purple)
        await Notifications.setNotificationChannelAsync('groups', {
          name: 'Group Activity & Members',
          description: 'Member invites, members joining/leaving, and group settings changes',
          importance: Notifications.AndroidImportance.DEFAULT,
          lightColor: '#8B5CF6',
          sound: 'default',
          showBadge: true,
        });

        // 6. Announcements & System Channel (High Importance, Indigo)
        await Notifications.setNotificationChannelAsync('announcements', {
          name: 'Announcements & Updates',
          description: 'Important service announcements, release updates, and support replies',
          importance: Notifications.AndroidImportance.HIGH,
          lightColor: '#6366F1',
          sound: 'default',
          showBadge: true,
        });

        // 7. Default Fallback Channel (High Importance)
        await Notifications.setNotificationChannelAsync('default', {
          name: 'General Notifications',
          description: 'General account alerts and fallback notifications',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: THEME.colors.primary,
          sound: 'default',
          showBadge: true,
        });
      }

      this._isInitialized = true;
    } catch {
      // Ignored for environments without native notification channels
    }
  },

  /**
   * Inspect current OS notification permission status without prompting
   */
  async getPermissionStatus(): Promise<{
    status: 'granted' | 'denied' | 'undetermined';
    canAskAgain: boolean;
    granted: boolean;
  }> {
    const Notifications = getNotificationsModule();
    if (!Notifications) {
      return { status: 'undetermined', canAskAgain: true, granted: false };
    }
    try {
      const perms = await Notifications.getPermissionsAsync();
      const status = perms.status === 'granted'
        ? 'granted'
        : perms.status === 'denied'
        ? 'denied'
        : 'undetermined';
      return {
        status,
        canAskAgain: perms.canAskAgain !== false,
        granted: perms.granted || perms.status === 'granted',
      };
    } catch {
      return { status: 'undetermined', canAskAgain: true, granted: false };
    }
  },

  /**
   * Request notification permission from OS (e.g. Android 13+ POST_NOTIFICATIONS / iOS)
   */
  async requestPermission(): Promise<boolean> {
    const Notifications = getNotificationsModule();
    if (!Notifications) return false;

    try {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });

      const granted = status === 'granted';
      if (granted) {
        this.registerForPushNotifications().catch(() => {});
      }
      return granted;
    } catch {
      return false;
    }
  },

  /**
   * Open Device System App Details / Notification Settings
   */
  async openSystemSettings(): Promise<void> {
    try {
      await Linking.openSettings();
    } catch {
      // Fallback
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
   * Registers for native FCM (or Expo fallback) push notifications and uploads token to backend
   */
  async registerForPushNotifications(): Promise<string | null> {
    const Notifications = getNotificationsModule();
    if (!Notifications) {
      return null;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return null;
      }

      if (isRunningInExpoGo() && Platform.OS === 'android') {
        return null;
      }

      let activeToken: string | null = null;
      let platformType: 'fcm' | 'expo' = 'fcm';

      // 1. Direct native FCM token via Google Play Services / Firebase
      try {
        const deviceToken = await Notifications.getDevicePushTokenAsync();
        if (deviceToken?.data) {
          activeToken = typeof deviceToken.data === 'string' ? deviceToken.data : String(deviceToken.data);
          platformType = 'fcm';
        }
      } catch {
        // Fallback for environments where device token is unavailable
      }

      // 2. Fallback to Expo push token if native device token could not be obtained
      if (!activeToken) {
        try {
          const projectId =
            Constants.expoConfig?.extra?.eas?.projectId ??
            Constants.easConfig?.projectId ??
            '564133e2-dfca-4435-b76a-9fad3532cd14';
          const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
          if (tokenData?.data) {
            activeToken = tokenData.data;
            platformType = 'expo';
          }
        } catch {
          // Expo push token fallback failed
        }
      }

      if (!activeToken) {
        return null;
      }

      const deviceId = await this.getDeviceId();
      const token = await authService.getToken();
      if (!token) return activeToken;

      // Post to backend
      await fetch(`${API_BASE_URL}/api/push/subscribe`, {
        method: 'POST',
        headers: getAuthenticatedHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          platform: platformType,
          deviceId,
          fcmToken: platformType === 'fcm' ? activeToken : undefined,
          expoPushToken: platformType === 'expo' ? activeToken : undefined,
          deviceName: Platform.OS === 'ios' ? 'Apple iPhone' : 'Android Smartphone',
        }),
      });

      return activeToken;
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

        if (url && typeof url === 'string') {
          navigate(url);
          return;
        }

        if (expenseId && groupId) {
          navigate(`/expenses/${expenseId}?groupId=${groupId}`);
          return;
        }

        if (settlementId && groupId) {
          navigate(`/settlements/${settlementId}?groupId=${groupId}`);
          return;
        }

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

        if (type === 'monthly_summary') {
          navigate('/(tabs)/analysis');
          return;
        }

        if (ticketId || type === 'support_reply') {
          navigate(ticketId ? `/support/${ticketId}` : '/support');
          return;
        }

        if (groupId) {
          navigate(`/groups/${groupId}`);
          return;
        }

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

  /**
   * Background task registration stub (native FCM delivers notifications directly in background).
   */
  async registerBackgroundTask(): Promise<void> {},

  /**
   * Background task unregistration stub.
   */
  async unregisterBackgroundTask(): Promise<void> {},

  /**
   * Starts notification sync on app launch / resume to populate local in-app cache.
   */
  async startLiveSync(): Promise<void> {
    this.getInAppNotifications().catch(() => {});
  },

  /**
   * Stop notification sync (stub maintained for backward compatibility).
   */
  stopLiveSync(): void {},

  /**
   * Present an immediate native system notification banner on the device
   */
  async presentLocalNotification(notification: InAppNotification): Promise<void> {
    const Notifications = getNotificationsModule();
    if (!Notifications) return;

    try {
      if (!this._isInitialized) {
        await this.initNotifications();
      }

      const channelId = getChannelIdForType(notification.type);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body || notification.message || '',
          sound: 'default',
          badge: 1,
          data: {
            type: notification.type,
            groupId: notification.groupId || notification.data?.groupId || '',
            expenseId: notification.expenseId || notification.data?.expenseId || '',
            settlementId: notification.settlementId || notification.data?.settlementId || '',
            ticketId: notification.data?.ticketId || '',
            url: notification.data?.url || '',
            channelId,
          },
        },
        trigger: null,
      });
    } catch {
      // Ignored
    }
  },

  /**
   * Check if app was launched via clicking a notification (cold start)
   */
  async checkColdStartNotification(navigate: (route: string) => void): Promise<void> {
    const Notifications = getNotificationsModule();
    if (!Notifications) return;
    try {
      const response = await Notifications.getLastNotificationResponseAsync();
      if (response) {
        const data = response.notification?.request?.content?.data as any;
        if (!data) return;
        const { type, groupId, expenseId, settlementId, ticketId, url } = data;
        if (url && typeof url === 'string') {
          navigate(url);
          return;
        }
        if (expenseId && groupId) {
          navigate(`/expenses/${expenseId}?groupId=${groupId}`);
          return;
        }
        if (settlementId && groupId) {
          navigate(`/settlements/${settlementId}?groupId=${groupId}`);
          return;
        }
        if (ticketId || type === 'support_reply') {
          navigate(ticketId ? `/support/${ticketId}` : '/support');
          return;
        }
        if (groupId) {
          navigate(`/groups/${groupId}`);
          return;
        }
      }
    } catch {
      // Ignored
    }
  },

  clearCache(): void {
    _cachedNotifications = [];
  },
};
