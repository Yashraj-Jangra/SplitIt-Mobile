import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { QuantumSpinner } from '../../src/components/brand/QuantumLogo';
import {
  ArrowLeft,
  Settings,
  Check,
  CheckCheck,
  Receipt,
  Handshake,
  Users,
  Wallet,
  TrendingUp,
  History,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Megaphone,
  ShieldAlert,
  Bell,
  BellRing,
  BellOff,
  ChevronRight,
  RotateCcw,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import {
  notificationService,
  InAppNotification,
} from '../../src/services/notification.service';
import { haptics } from '../../src/services/haptics.service';
import { useAppTheme } from '../../src/contexts/theme.context';

type NotificationCategoryTab = 'all' | 'expenses' | 'settlements' | 'reminders' | 'other';

export default function NotificationsCenterScreen() {
  const router = useRouter();
  const { currentAccent } = useAppTheme();
  const [notifications, setNotifications] = useState<InAppNotification[]>(() =>
    notificationService.getInMemoryNotifications()
  );
  const [activeTab, setActiveTab] = useState<NotificationCategoryTab>('all');
  const [loading, setLoading] = useState(
    () => notificationService.getInMemoryNotifications().length === 0
  );
  const [refreshing, setRefreshing] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<{
    status: 'granted' | 'denied' | 'undetermined';
    canAskAgain: boolean;
    granted: boolean;
  } | null>(null);

  const checkPermission = useCallback(async () => {
    try {
      const status = await notificationService.getPermissionStatus();
      setPermissionStatus(status);
    } catch {
      // Ignored
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkPermission();
    }, [checkPermission])
  );

  const loadNotifications = async () => {
    const list = await notificationService.getInAppNotifications();
    setNotifications(list);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    haptics.tap();
    loadNotifications();
  };

  const handleMarkAllRead = async () => {
    haptics.saveSuccess();
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true, isRead: true }))
    );
    await notificationService.markAllNotificationsRead();
  };

  const handleMarkSingleRead = async (id: string) => {
    haptics.tap();
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true, isRead: true } : n))
    );
    await notificationService.markNotificationRead(id);
  };

  const handleTapNotification = async (item: InAppNotification) => {
    haptics.tap();
    const isUnread = item.isRead !== undefined ? !item.isRead : !item.read;
    if (isUnread) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read: true, isRead: true } : n))
      );
      notificationService.markNotificationRead(item.id);
    }

    // Deep link navigation matching web getNotificationUrl logic
    const { type, groupId, expenseId, settlementId, data } = item;
    const finalGroupId = groupId || data?.groupId;
    const finalExpenseId = expenseId || data?.expenseId;
    const finalSettlementId = settlementId || data?.settlementId;
    const finalTicketId = data?.ticketId;
    const finalUrl = data?.url;

    if (finalUrl && typeof finalUrl === 'string') {
      router.push(finalUrl as any);
      return;
    }

    switch (type) {
      case 'expense_added':
      case 'expense_updated':
      case 'expense_restored':
        if (finalExpenseId && finalGroupId) {
          router.push(`/expenses/${finalExpenseId}?groupId=${finalGroupId}` as any);
        } else if (finalGroupId) {
          router.push(`/groups/${finalGroupId}`);
        }
        break;

      case 'expense_deleted':
        if (finalGroupId) {
          router.push(`/groups/${finalGroupId}`);
        }
        break;

      case 'settlement_added':
      case 'settlement_updated':
      case 'settlement_restored':
        if (finalSettlementId && finalGroupId) {
          router.push({
            pathname: '/settlements/[id]',
            params: { id: finalSettlementId, groupId: finalGroupId },
          } as any);
        } else if (finalGroupId) {
          router.push(`/groups/${finalGroupId}`);
        }
        break;

      case 'settlement_deleted':
      case 'group_updated':
      case 'member_added':
      case 'member_removed':
      case 'balance_reminder':
      case 'group_inactivity':
        if (finalGroupId) {
          router.push(`/groups/${finalGroupId}`);
        }
        break;

      case 'budget_updated':
      case 'budget_alert':
      case 'budget_exceeded':
        if (finalGroupId) {
          router.push(`/groups/${finalGroupId}?tab=budget`);
        }
        break;

      case 'payment_reminder':
      case 'payment_confirmation_request':
        if (finalSettlementId && finalGroupId) {
          router.push({
            pathname: '/settlements/[id]',
            params: { id: finalSettlementId, groupId: finalGroupId },
          } as any);
        } else if (finalGroupId) {
          router.push(`/groups/${finalGroupId}`);
        }
        break;

      case 'support_reply':
        if (finalTicketId) {
          router.push(`/support/${finalTicketId}` as any);
        } else {
          router.push('/support');
        }
        break;

      case 'monthly_summary':
        router.push('/(tabs)/analysis' as any);
        break;

      case 'broadcast_announcement':
      case 'broadcast_critical':
      default:
        if (finalGroupId) {
          router.push(`/groups/${finalGroupId}`);
        }
        break;
    }
  };

  // Categorization matching website logic exactly
  const expensesNotifs = useMemo(
    () => notifications.filter((n) => n.type.includes('expense')),
    [notifications]
  );
  const settlementsNotifs = useMemo(
    () => notifications.filter((n) => n.type.includes('settlement')),
    [notifications]
  );
  const remindersNotifs = useMemo(
    () =>
      notifications.filter((n) =>
        [
          'payment_reminder',
          'balance_reminder',
          'payment_confirmation_request',
          'monthly_summary',
          'group_inactivity',
          'budget_alert',
          'budget_exceeded',
        ].includes(n.type)
      ),
    [notifications]
  );
  const otherNotifs = useMemo(
    () =>
      notifications.filter(
        (n) =>
          !n.type.includes('expense') &&
          !n.type.includes('settlement') &&
          ![
            'payment_reminder',
            'balance_reminder',
            'payment_confirmation_request',
            'monthly_summary',
            'group_inactivity',
            'budget_alert',
            'budget_exceeded',
          ].includes(n.type)
      ),
    [notifications]
  );

  // Unread badge counts per tab
  const isItemUnread = (n: InAppNotification) =>
    n.isRead !== undefined ? !n.isRead : !n.read;

  const unreadCount = useMemo(
    () => notifications.filter(isItemUnread).length,
    [notifications]
  );
  const unreadExpenses = useMemo(
    () => expensesNotifs.filter(isItemUnread).length,
    [expensesNotifs]
  );
  const unreadSettlements = useMemo(
    () => settlementsNotifs.filter(isItemUnread).length,
    [settlementsNotifs]
  );
  const unreadReminders = useMemo(
    () => remindersNotifs.filter(isItemUnread).length,
    [remindersNotifs]
  );
  const unreadOther = useMemo(
    () => otherNotifs.filter(isItemUnread).length,
    [otherNotifs]
  );

  const currentTabList = useMemo(() => {
    switch (activeTab) {
      case 'expenses':
        return expensesNotifs;
      case 'settlements':
        return settlementsNotifs;
      case 'reminders':
        return remindersNotifs;
      case 'other':
        return otherNotifs;
      case 'all':
      default:
        return notifications;
    }
  }, [activeTab, notifications, expensesNotifs, settlementsNotifs, remindersNotifs, otherNotifs]);

  const getEmptyMessage = () => {
    switch (activeTab) {
      case 'expenses':
        return 'No expense notifications yet.';
      case 'settlements':
        return 'No payment notifications yet.';
      case 'reminders':
        return 'No reminder notifications yet.';
      case 'other':
        return 'No system notifications yet.';
      default:
        return "You're all caught up!";
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top App Bar with Title */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity
            onPress={() => {
              haptics.tap();
              router.back();
            }}
            style={styles.circleButton}
            activeOpacity={0.7}
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={19} color={THEME.colors.text} />
          </TouchableOpacity>

          <View style={styles.topBarTitleRow}>
            <Text style={styles.topBarTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <View
                style={[
                  styles.unreadHeaderBadge,
                  {
                    borderColor: `${currentAccent.primary}40`,
                    backgroundColor: `${currentAccent.primary}18`,
                  },
                ]}
              >
                <Text style={[styles.unreadHeaderBadgeText, { color: currentAccent.primary }]}>
                  {unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.topBarActions}>
          <TouchableOpacity
            onPress={handleMarkAllRead}
            style={[
              styles.markAllButton,
              unreadCount > 0
                ? {
                    backgroundColor: `${currentAccent.primary}18`,
                    borderColor: `${currentAccent.primary}40`,
                  }
                : styles.markAllButtonDisabled,
            ]}
            activeOpacity={0.7}
            disabled={unreadCount === 0}
            accessibilityRole="button"
            accessibilityLabel="Mark all as read"
          >
            <CheckCheck
              size={15}
              color={unreadCount > 0 ? currentAccent.primary : THEME.colors.textMuted}
            />
            <Text
              style={[
                styles.markAllButtonText,
                { color: unreadCount > 0 ? currentAccent.primary : THEME.colors.textMuted },
              ]}
            >
              Mark all read
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              haptics.tap();
              router.push('/notifications/preferences');
            }}
            style={styles.circleButton}
            activeOpacity={0.7}
            accessibilityLabel="Notification settings"
          >
            <Settings size={17} color={THEME.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Real-time System Push Notification Status */}
      {permissionStatus && (
        <View style={styles.systemStatusContainer}>
          {permissionStatus.granted ? (
            <View style={styles.grantedBanner}>
              <View style={styles.grantedStatusLeft}>
                <View style={styles.livePulseDot} />
                <BellRing size={13} color={THEME.colors.success} />
                <Text style={styles.grantedStatusText}>Push Alerts Active</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  haptics.tap();
                  router.push('/notifications/preferences');
                }}
                style={styles.channelsLinkButton}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Notification channel preferences"
              >
                <Text style={styles.channelsLinkText}>Channels</Text>
                <ChevronRight size={12} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.disabledBanner}>
              <View style={styles.disabledLeft}>
                <View style={styles.disabledIconBadge}>
                  <BellOff size={16} color={THEME.colors.warning} />
                </View>
                <View style={styles.disabledTextCol}>
                  <Text style={styles.disabledTitle}>Push Alerts Disabled</Text>
                  <Text style={styles.disabledSubtitle} numberOfLines={2}>
                    {permissionStatus.status === 'denied'
                      ? 'Enable in system settings to receive bill & settlement alerts.'
                      : 'Allow notifications to get instant alerts on expense splits.'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={async () => {
                  haptics.tap();
                  if (permissionStatus.status === 'undetermined' && permissionStatus.canAskAgain) {
                    await notificationService.requestPermission();
                    await checkPermission();
                  } else {
                    await notificationService.openSystemSettings();
                  }
                }}
                style={[
                  styles.disabledActionButton,
                  { backgroundColor: currentAccent.primary },
                ]}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Enable push notifications"
              >
                <Text style={styles.disabledActionText}>
                  {permissionStatus.status === 'undetermined' && permissionStatus.canAskAgain
                    ? 'Enable'
                    : 'Settings'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Website-Style Category Tabs with Badges */}
      <View style={styles.tabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}
        >
          {/* Tab: All */}
          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === 'all' && [
                styles.tabPillActive,
                { borderColor: currentAccent.primary, backgroundColor: `${currentAccent.primary}12` },
              ],
            ]}
            onPress={() => {
              haptics.tap();
              setActiveTab('all');
            }}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.tabPillText,
                activeTab === 'all' && styles.tabPillTextActive,
              ]}
            >
              All
            </Text>
            {unreadCount > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: `${currentAccent.primary}20` }]}>
                <Text style={[styles.tabBadgeText, { color: currentAccent.primary }]}>
                  {unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Tab: Expenses */}
          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === 'expenses' && styles.tabPillActive,
            ]}
            onPress={() => {
              haptics.tap();
              setActiveTab('expenses');
            }}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.tabPillText,
                activeTab === 'expenses' && styles.tabPillTextActive,
              ]}
            >
              Expenses
            </Text>
            {unreadExpenses > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
                <Text style={[styles.tabBadgeText, { color: THEME.colors.notification.expense }]}>
                  {unreadExpenses}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Tab: Payments */}
          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === 'settlements' && styles.tabPillActive,
            ]}
            onPress={() => {
              haptics.tap();
              setActiveTab('settlements');
            }}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.tabPillText,
                activeTab === 'settlements' && styles.tabPillTextActive,
              ]}
            >
              Payments
            </Text>
            {unreadSettlements > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                <Text style={[styles.tabBadgeText, { color: THEME.colors.notification.payment }]}>
                  {unreadSettlements}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Tab: Reminders */}
          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === 'reminders' && styles.tabPillActive,
            ]}
            onPress={() => {
              haptics.tap();
              setActiveTab('reminders');
            }}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.tabPillText,
                activeTab === 'reminders' && styles.tabPillTextActive,
              ]}
            >
              Reminders
            </Text>
            {unreadReminders > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                <Text style={[styles.tabBadgeText, { color: THEME.colors.notification.budget }]}>
                  {unreadReminders}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Tab: System & Help */}
          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === 'other' && styles.tabPillActive,
            ]}
            onPress={() => {
              haptics.tap();
              setActiveTab('other');
            }}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.tabPillText,
                activeTab === 'other' && styles.tabPillTextActive,
              ]}
            >
              System & Help
            </Text>
            {unreadOther > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: 'rgba(168, 85, 247, 0.2)' }]}>
                <Text style={[styles.tabBadgeText, { color: THEME.colors.notification.announcement }]}>
                  {unreadOther}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Notification List Container */}
      {/* Notification List Container — No-Div Wider Layout */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <QuantumSpinner size={36} color={currentAccent.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={currentAccent.primary}
            />
          }
        >
          {currentTabList.length === 0 ? (
            <EmptyState message={getEmptyMessage()} />
          ) : (
            currentTabList.map((item, index) => {
              const isLast = index === currentTabList.length - 1;
              return (
                <NotificationItemRow
                  key={item.id}
                  notification={item}
                  isLast={isLast}
                  accentColor={currentAccent.primary}
                  onPress={() => handleTapNotification(item)}
                  onMarkRead={() => handleMarkSingleRead(item.id)}
                />
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// Helper to determine icon, color, and left accent border by notification type
function getNotificationVisuals(type: string, isRead: boolean, accentColor: string = THEME.colors.primary) {
  let Icon = Bell;
  let iconColor: string = accentColor;
  let iconBg: string = `${accentColor}18`;
  let accentBorderColor: string = accentColor;

  switch (type) {
    case 'expense_added':
    case 'expense_updated':
    case 'expense_deleted':
      Icon = Receipt;
      iconColor = THEME.colors.notification.expense;
      iconBg = 'rgba(59, 130, 246, 0.12)';
      accentBorderColor = THEME.colors.notification.expense;
      break;

    case 'expense_restored':
      Icon = RotateCcw;
      iconColor = THEME.colors.palette.purple;
      iconBg = 'rgba(168, 85, 247, 0.12)';
      accentBorderColor = THEME.colors.palette.purple;
      break;

    case 'settlement_added':
    case 'settlement_updated':
      Icon = Handshake;
      iconColor = THEME.colors.notification.payment;
      iconBg = 'rgba(16, 185, 129, 0.12)';
      accentBorderColor = THEME.colors.notification.payment;
      break;

    case 'settlement_deleted':
      Icon = Handshake;
      iconColor = THEME.colors.notification.critical;
      iconBg = 'rgba(239, 68, 68, 0.12)';
      accentBorderColor = THEME.colors.notification.critical;
      break;

    case 'settlement_restored':
      Icon = RotateCcw;
      iconColor = THEME.colors.palette.purple;
      iconBg = 'rgba(168, 85, 247, 0.12)';
      accentBorderColor = THEME.colors.palette.purple;
      break;

    case 'group_updated':
      Icon = Users;
      iconColor = THEME.colors.notification.member;
      iconBg = 'rgba(249, 115, 22, 0.12)';
      accentBorderColor = THEME.colors.notification.member;
      break;

    case 'budget_updated':
      Icon = Wallet;
      iconColor = THEME.colors.notification.payment;
      iconBg = 'rgba(16, 185, 129, 0.12)';
      accentBorderColor = THEME.colors.notification.payment;
      break;

    case 'member_added':
    case 'member_removed':
      Icon = Users;
      iconColor = THEME.colors.notification.member;
      iconBg = 'rgba(249, 115, 22, 0.12)';
      accentBorderColor = THEME.colors.notification.member;
      break;

    case 'balance_reminder':
    case 'payment_reminder':
    case 'payment_confirmation_request':
      Icon = Wallet;
      iconColor = THEME.colors.notification.payment;
      iconBg = 'rgba(16, 185, 129, 0.12)';
      accentBorderColor = THEME.colors.notification.payment;
      break;

    case 'monthly_summary':
      Icon = TrendingUp;
      iconColor = THEME.colors.primary;
      iconBg = 'rgba(20, 184, 166, 0.12)';
      accentBorderColor = THEME.colors.primary;
      break;

    case 'group_inactivity':
      Icon = History;
      iconColor = THEME.colors.notification.budget;
      iconBg = 'rgba(245, 158, 11, 0.12)';
      accentBorderColor = THEME.colors.notification.budget;
      break;

    case 'budget_alert':
      Icon = AlertTriangle;
      iconColor = THEME.colors.notification.budget;
      iconBg = 'rgba(245, 158, 11, 0.12)';
      accentBorderColor = THEME.colors.notification.budget;
      break;

    case 'budget_exceeded':
      Icon = AlertCircle;
      iconColor = THEME.colors.notification.budgetExceeded;
      iconBg = 'rgba(244, 63, 94, 0.12)';
      accentBorderColor = THEME.colors.notification.budgetExceeded;
      break;

    case 'support_reply':
      Icon = HelpCircle;
      iconColor = THEME.colors.notification.support;
      iconBg = 'rgba(6, 182, 212, 0.12)';
      accentBorderColor = THEME.colors.notification.support;
      break;

    case 'broadcast_announcement':
      Icon = Megaphone;
      iconColor = THEME.colors.notification.announcement;
      iconBg = 'rgba(168, 85, 247, 0.12)';
      accentBorderColor = THEME.colors.notification.announcement;
      break;

    case 'broadcast_critical':
      Icon = ShieldAlert;
      iconColor = THEME.colors.notification.critical;
      iconBg = 'rgba(239, 68, 68, 0.12)';
      accentBorderColor = THEME.colors.notification.critical;
      break;

    default:
      Icon = Bell;
      iconColor = THEME.colors.primary;
      iconBg = 'rgba(28, 194, 159, 0.12)';
      accentBorderColor = THEME.colors.primary;
      break;
  }

  return {
    Icon,
    iconColor,
    iconBg,
    leftBorderColor: isRead ? 'transparent' : accentBorderColor,
  };
}

function getInitials(firstName?: string, lastName?: string): string {
  const f = firstName?.trim() || '';
  const l = lastName?.trim() || '';
  if (f && l) return `${f[0]}${l[0]}`.toUpperCase();
  if (f) return f.slice(0, 2).toUpperCase();
  if (l) return l.slice(0, 2).toUpperCase();
  return 'U';
}

function formatTimeAgo(dateStr: string): string {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    if (isNaN(diffMs)) return 'Recently';
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 4) return `${diffWeeks}w ago`;
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Recently';
  }
}

interface NotificationItemRowProps {
  notification: InAppNotification;
  isLast: boolean;
  accentColor: string;
  onPress: () => void;
  onMarkRead: () => void;
}

function NotificationItemRow({
  notification,
  isLast,
  accentColor,
  onPress,
  onMarkRead,
}: NotificationItemRowProps) {
  const swipeableRef = useRef<SwipeableMethods | null>(null);
  const isRead =
    notification.isRead !== undefined
      ? !!notification.isRead
      : !!notification.read;

  const { Icon, iconColor, iconBg, leftBorderColor } = getNotificationVisuals(
    notification.type,
    isRead,
    accentColor
  );

  const actor = notification.actor;
  const initials = actor ? getInitials(actor.firstName, actor.lastName) : '';
  const messageBody = notification.body || notification.message || '';

  const handleSwipeOpen = () => {
    haptics.saveSuccess();
    onMarkRead();
    setTimeout(() => {
      swipeableRef.current?.close();
    }, 200);
  };

  const renderSwipeAction = (direction: 'left' | 'right') => {
    return (
      <View
        style={[
          styles.swipeActionContainer,
          direction === 'left' ? styles.swipeActionLeft : styles.swipeActionRight,
          { backgroundColor: accentColor },
        ]}
      >
        <View style={styles.swipeActionContent}>
          <CheckCheck size={20} color={THEME.colors.primaryForeground} />
          <Text style={[styles.swipeActionText, { color: THEME.colors.primaryForeground }]}>
            Mark Read
          </Text>
        </View>
      </View>
    );
  };

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      friction={1.5}
      leftThreshold={60}
      rightThreshold={60}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={() => renderSwipeAction('left')}
      renderRightActions={() => renderSwipeAction('right')}
      onSwipeableOpen={handleSwipeOpen}
      containerStyle={styles.swipeableContainer}
    >
      <TouchableOpacity
        style={[
          styles.itemRow,
          !isRead && styles.itemRowUnread,
          { borderLeftColor: leftBorderColor },
          isLast && styles.itemRowLast,
        ]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {/* Avatar or Icon Badge */}
        {actor?.avatarUrl ? (
          <Image source={{ uri: actor.avatarUrl }} style={styles.avatarImg} />
        ) : actor ? (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitialText}>{initials}</Text>
          </View>
        ) : (
          <View style={[styles.iconBadge, { backgroundColor: iconBg }]}>
            <Icon size={19} color={iconColor} />
          </View>
        )}

        {/* Main Text Content */}
        <View style={styles.itemTextContainer}>
          <Text
            style={[
              styles.itemTitle,
              !isRead && styles.itemTitleUnread,
            ]}
            numberOfLines={1}
          >
            {notification.title}
          </Text>

          {messageBody ? (
            <Text style={styles.itemBody} numberOfLines={2}>
              {messageBody}
            </Text>
          ) : null}

          <View style={styles.itemTimeRow}>
            <History size={11} color={THEME.colors.textMuted} />
            <Text style={styles.itemTimeText}>
              {formatTimeAgo(notification.createdAt)}
            </Text>
          </View>
        </View>

        {/* Unread Action Buttons: Checkmark Mark-Read + Pulsing Dot */}
        {!isRead && (
          <View style={styles.itemRightActions}>
            <TouchableOpacity
              style={styles.checkButton}
              onPress={(e) => {
                onMarkRead();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.6}
            >
              <Check size={14} color={THEME.colors.textSecondary} />
            </TouchableOpacity>
            <View style={[styles.unreadDot, { backgroundColor: accentColor }]} />
          </View>
        )}
      </TouchableOpacity>
    </ReanimatedSwipeable>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconBox}>
        <Bell size={28} color={THEME.colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>{message}</Text>
      <Text style={styles.emptySubtitle}>
        No notifications to show here right now.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  topBarTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topBarTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -0.4,
  },
  circleButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
  },
  markAllButtonDisabled: {
    backgroundColor: THEME.colors.surface,
    borderColor: THEME.colors.hairline,
    opacity: 0.5,
  },
  markAllButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  unreadHeaderBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
  },
  unreadHeaderBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  tabsContainer: {
    paddingBottom: 10,
  },
  tabsScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  tabPillActive: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderColor: THEME.colors.borderFocus,
  },
  tabPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  tabPillTextActive: {
    color: THEME.colors.text,
    fontWeight: '700',
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: THEME.radius.full,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 36,
  },
  swipeableContainer: {
    backgroundColor: THEME.colors.background,
  },
  swipeActionContainer: {
    justifyContent: 'center',
    width: 110,
    height: '100%',
  },
  swipeActionLeft: {
    alignItems: 'flex-start',
    paddingLeft: 20,
  },
  swipeActionRight: {
    alignItems: 'flex-end',
    paddingRight: 20,
  },
  swipeActionContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  swipeActionText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderLeftWidth: 3.5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.colors.hairline,
    backgroundColor: THEME.colors.background,
  },
  itemRowUnread: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  itemRowLast: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: THEME.colors.hairlineLight,
    marginTop: 2,
  },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  avatarInitialText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  itemTextContainer: {
    flex: 1,
    gap: 3,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    lineHeight: 18,
  },
  itemTitleUnread: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  itemBody: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    lineHeight: 18,
  },
  itemTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  itemTimeText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  itemRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    marginLeft: 4,
  },
  checkButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 56,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyIconBox: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 18,
  },
  systemStatusContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  grantedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.22)',
  },
  grantedStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.success,
  },
  grantedStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.success,
  },
  channelsLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  channelsLinkText: {
    fontSize: 11,
    fontWeight: '500',
    color: THEME.colors.textMuted,
  },
  disabledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    gap: 12,
  },
  disabledLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  disabledIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: THEME.colors.warningMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledTextCol: {
    flex: 1,
  },
  disabledTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
    marginBottom: 2,
  },
  disabledSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    lineHeight: 15,
  },
  disabledActionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: THEME.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primaryForeground,
  },
});
