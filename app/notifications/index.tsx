import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Sliders,
  CheckCheck,
  Receipt,
  Sparkles,
  Handshake,
  MessageSquare,
  Bell,
  AlertCircle,
  ChevronRight,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import {
  notificationService,
  InAppNotification,
} from '../../src/services/notification.service';
import * as Haptics from 'expo-haptics';

export default function NotificationsCenterScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadNotifications();
  };

  const handleMarkAllRead = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await notificationService.markAllNotificationsRead();
  };

  const handleTapNotification = async (item: InAppNotification) => {
    Haptics.selectionAsync();
    if (!item.read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
      );
      notificationService.markNotificationRead(item.id);
    }

    if (item.data?.groupId) {
      router.push(`/groups/${item.data.groupId}`);
    } else if (item.data?.ticketId) {
      router.push(`/support/${item.data.ticketId}`);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'expense_added':
      case 'expense_updated':
        return {
          icon: Receipt,
          color: THEME.colors.primary,
          bg: 'rgba(16, 185, 129, 0.12)',
        };
      case 'budget_alert':
      case 'budget_exceeded':
        return {
          icon: Sparkles,
          color: '#F59E0B',
          bg: 'rgba(245, 158, 11, 0.12)',
        };
      case 'settlement_added':
        return {
          icon: Handshake,
          color: THEME.colors.primary,
          bg: 'rgba(16, 185, 129, 0.12)',
        };
      case 'support_reply':
        return {
          icon: MessageSquare,
          color: THEME.colors.aiLight,
          bg: 'rgba(139, 92, 246, 0.12)',
        };
      default:
        return {
          icon: Bell,
          color: THEME.colors.textSecondary,
          bg: THEME.colors.surfaceElevated,
        };
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 60) return `${Math.max(1, diffMins)}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const filteredList = notifications.filter((n) =>
    filter === 'all' ? true : !n.read
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          style={styles.headerButton}
        >
          <ArrowLeft size={20} color={THEME.colors.text} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Notifications</Text>

        <View style={styles.headerRight}>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={handleMarkAllRead}
              style={styles.headerButton}
            >
              <CheckCheck size={19} color={THEME.colors.primary} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              router.push('/notifications/preferences');
            }}
            style={styles.headerButton}
          >
            <Sliders size={18} color={THEME.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setFilter('all');
          }}
        >
          <Text
            style={[
              styles.filterChipText,
              filter === 'all' && styles.filterChipTextActive,
            ]}
          >
            All ({notifications.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            filter === 'unread' && styles.filterChipActive,
          ]}
          onPress={() => {
            Haptics.selectionAsync();
            setFilter('unread');
          }}
        >
          <Text
            style={[
              styles.filterChipText,
              filter === 'unread' && styles.filterChipTextActive,
            ]}
          >
            Unread ({unreadCount})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={THEME.colors.primary}
            />
          }
        >
          {filteredList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Bell size={40} color={THEME.colors.textMuted} />
              <Text style={styles.emptyTitle}>All Caught Up!</Text>
              <Text style={styles.emptySubtitle}>
                {filter === 'unread'
                  ? 'No unread notifications at the moment.'
                  : 'You will receive updates on expenses, debts, and budgets here.'}
              </Text>
            </View>
          ) : (
            filteredList.map((item) => {
              const { icon: IconComp, color, bg } = getNotificationIcon(item.type);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.notificationCard,
                    !item.read && styles.notificationCardUnread,
                  ]}
                  onPress={() => handleTapNotification(item)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.iconContainer, { backgroundColor: bg }]}>
                    <IconComp size={18} color={color} />
                  </View>

                  <View style={styles.cardContent}>
                    <View style={styles.cardHeaderRow}>
                      <Text
                        style={[
                          styles.cardTitle,
                          !item.read && styles.cardTitleUnread,
                        ]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      <Text style={styles.timeText}>
                        {formatTimeAgo(item.createdAt)}
                      </Text>
                    </View>

                    <Text style={styles.messageText} numberOfLines={2}>
                      {item.message}
                    </Text>
                  </View>

                  {!item.read && <View style={styles.unreadDot} />}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surface,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  filterChipActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textMuted,
  },
  filterChipTextActive: {
    color: '#09090B',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 10,
    paddingBottom: 24,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: 12,
  },
  notificationCardUnread: {
    borderColor: 'rgba(16, 185, 129, 0.25)',
    backgroundColor: 'rgba(24, 24, 27, 0.95)',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    flex: 1,
  },
  cardTitleUnread: {
    fontWeight: '800',
    color: THEME.colors.text,
  },
  timeText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginLeft: 6,
  },
  messageText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    lineHeight: 17,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.primary,
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 18,
  },
});
