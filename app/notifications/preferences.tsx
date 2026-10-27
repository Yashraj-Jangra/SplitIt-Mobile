import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { QuantumSpinner } from '../../src/components/brand/QuantumLogo';
import {
  ArrowLeft,
  Bell,
  Smartphone,
  Mail,
  Check,
  ShieldCheck,
  ShieldAlert,
  SlidersHorizontal,
  ExternalLink,
  Receipt,
  Handshake,
  Clock,
  PieChart,
  Users,
  Megaphone,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import {
  notificationService,
  UserNotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../../src/services/notification.service';
import { haptics } from '../../src/services/haptics.service';
import { useAppTheme } from '../../src/contexts/theme.context';

export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const { currentAccent } = useAppTheme();
  const [prefs, setPrefs] = useState<UserNotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES
  );
  const [loading, setLoading] = useState(true);
  const [savedBanner, setSavedBanner] = useState(false);
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

  useEffect(() => {
    const load = async () => {
      const data = await notificationService.getPreferences();
      setPrefs(data);
      setLoading(false);
    };
    load();
  }, []);

  const triggerSave = async (updated: UserNotificationPreferences) => {
    setPrefs(updated);
    haptics.toggleSwitch();
    await notificationService.updatePreferences(updated);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2000);
  };

  const toggleGlobal = (key: 'inAppEnabled' | 'pushEnabled' | 'emailEnabled') => {
    const updated = { ...prefs, [key]: !prefs[key] };
    triggerSave(updated);
  };

  const toggleEventPush = (eventKey: keyof UserNotificationPreferences['events']) => {
    const current =
      prefs.events?.[eventKey] ||
      DEFAULT_NOTIFICATION_PREFERENCES.events[eventKey] || { inApp: true, push: true, email: false };
    const updated: UserNotificationPreferences = {
      ...prefs,
      events: {
        ...(prefs.events || DEFAULT_NOTIFICATION_PREFERENCES.events),
        [eventKey]: {
          ...current,
          push: !current.push,
        },
      },
    };
    triggerSave(updated);
  };

  const getEventPushValue = (eventKey: keyof UserNotificationPreferences['events']): boolean => {
    return (
      prefs.events?.[eventKey]?.push ??
      DEFAULT_NOTIFICATION_PREFERENCES.events[eventKey]?.push ??
      true
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          style={styles.headerButton}
        >
          <ArrowLeft size={20} color={THEME.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Notification Settings</Text>
      </View>

      {savedBanner && (
        <View style={styles.savedBanner}>
          <Check size={14} color={THEME.colors.primaryForeground} />
          <Text style={styles.savedBannerText}>Preferences synchronized</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <QuantumSpinner size={36} color={THEME.colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Device System Notification Status */}
          {permissionStatus && (
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>DEVICE SYSTEM STATUS</Text>
              <View style={styles.card}>
                <View style={styles.row}>
                  <View
                    style={[
                      styles.rowIcon,
                      {
                        backgroundColor: permissionStatus.granted
                          ? 'rgba(16, 185, 129, 0.12)'
                          : 'rgba(245, 158, 11, 0.12)',
                      },
                    ]}
                  >
                    {permissionStatus.granted ? (
                      <ShieldCheck size={18} color={THEME.colors.success} />
                    ) : (
                      <ShieldAlert size={18} color={THEME.colors.warning} />
                    )}
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>
                      {permissionStatus.granted
                        ? 'Push Notifications Active'
                        : 'Push Notifications Disabled'}
                    </Text>
                    <Text style={styles.rowSubtitle}>
                      {permissionStatus.granted
                        ? 'OS background push delivery & wakeups enabled'
                        : 'Blocked by device settings — notifications will not show'}
                    </Text>
                  </View>
                  {!permissionStatus.granted && (
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
                      style={[styles.systemStatusButton, { backgroundColor: currentAccent.primary }]}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel="Enable notifications in system settings"
                    >
                      <Text style={styles.systemStatusButtonText}>
                        {permissionStatus.status === 'undetermined' && permissionStatus.canAskAgain
                          ? 'Enable'
                          : 'Fix'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {permissionStatus.granted && (
                    <View style={styles.statusPillActive}>
                      <Text style={styles.statusPillActiveText}>Active</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Android Categorized Notification Channels */}
          {Platform.OS === 'android' && (
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>ANDROID SYSTEM CHANNELS</Text>
              <View style={styles.card}>
                <View style={styles.channelHeader}>
                  <Text style={styles.channelHeaderTitle}>Categorized Notification Channels</Text>
                  <Text style={styles.channelHeaderSubtitle}>
                    Android 8.0+ organizes alerts into dedicated channels. You can customize individual notification sounds, vibration patterns, lock screen visibility, and priority:
                  </Text>
                </View>

                {/* Channel List Items */}
                <View style={[styles.channelItemRow, styles.borderTop]}>
                  <View style={[styles.channelDot, { backgroundColor: '#00C4CC' }]} />
                  <View style={styles.channelItemTextCol}>
                    <Text style={styles.channelItemName}>Expenses & Splits</Text>
                    <Text style={styles.channelItemDesc}>Max Priority • Sound & Vibration • Cyan</Text>
                  </View>
                </View>

                <View style={[styles.channelItemRow, styles.borderTop]}>
                  <View style={[styles.channelDot, { backgroundColor: '#10B981' }]} />
                  <View style={styles.channelItemTextCol}>
                    <Text style={styles.channelItemName}>Settlements & Payments</Text>
                    <Text style={styles.channelItemDesc}>Max Priority • Sound & Vibration • Emerald</Text>
                  </View>
                </View>

                <View style={[styles.channelItemRow, styles.borderTop]}>
                  <View style={[styles.channelDot, { backgroundColor: '#F59E0B' }]} />
                  <View style={styles.channelItemTextCol}>
                    <Text style={styles.channelItemName}>Payment & Balance Reminders</Text>
                    <Text style={styles.channelItemDesc}>High Priority • Custom Pattern • Amber</Text>
                  </View>
                </View>

                <View style={[styles.channelItemRow, styles.borderTop]}>
                  <View style={[styles.channelDot, { backgroundColor: '#EF4444' }]} />
                  <View style={styles.channelItemTextCol}>
                    <Text style={styles.channelItemName}>Budget & Spending Alerts</Text>
                    <Text style={styles.channelItemDesc}>High Priority • Limit Warnings • Coral</Text>
                  </View>
                </View>

                <View style={[styles.channelItemRow, styles.borderTop]}>
                  <View style={[styles.channelDot, { backgroundColor: '#8B5CF6' }]} />
                  <View style={styles.channelItemTextCol}>
                    <Text style={styles.channelItemName}>Group Activity & Members</Text>
                    <Text style={styles.channelItemDesc}>Default Priority • Invites & Changes • Purple</Text>
                  </View>
                </View>

                <View style={[styles.channelItemRow, styles.borderTop]}>
                  <View style={[styles.channelDot, { backgroundColor: '#6366F1' }]} />
                  <View style={styles.channelItemTextCol}>
                    <Text style={styles.channelItemName}>Announcements & System</Text>
                    <Text style={styles.channelItemDesc}>High Priority • Broadcasts & Replies • Indigo</Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={async () => {
                    haptics.tap();
                    await notificationService.openSystemSettings();
                  }}
                  style={[styles.manageChannelsButton, styles.borderTop]}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Manage Android notification channels in system settings"
                >
                  <SlidersHorizontal size={15} color={currentAccent.primary} />
                  <Text style={[styles.manageChannelsButtonText, { color: currentAccent.primary }]}>
                    Configure Android Channels in Settings
                  </Text>
                  <ExternalLink size={13} color={currentAccent.primary} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Master Delivery Channels */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>DELIVERY CHANNELS</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.rowIcon}>
                  <Bell size={18} color={THEME.colors.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>In-App Notifications</Text>
                  <Text style={styles.rowSubtitle}>Notification center banner feeds</Text>
                </View>
                <Switch
                  value={prefs.inAppEnabled}
                  onValueChange={() => toggleGlobal('inAppEnabled')}
                  trackColor={{ false: THEME.colors.surfaceElevated, true: THEME.colors.primary }}
                  thumbColor={THEME.colors.palette.white}
                />
              </View>

              <View style={[styles.row, styles.borderTop]}>
                <View style={styles.rowIcon}>
                  <Smartphone size={18} color={THEME.colors.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Mobile Push Notifications</Text>
                  <Text style={styles.rowSubtitle}>Lock screen and vibration alerts</Text>
                </View>
                <Switch
                  value={prefs.pushEnabled}
                  onValueChange={() => toggleGlobal('pushEnabled')}
                  trackColor={{ false: THEME.colors.surfaceElevated, true: THEME.colors.primary }}
                  thumbColor={THEME.colors.palette.white}
                />
              </View>

              <View style={[styles.row, styles.borderTop]}>
                <View style={styles.rowIcon}>
                  <Mail size={18} color={THEME.colors.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Email Digests</Text>
                  <Text style={styles.rowSubtitle}>Monthly settlement summaries</Text>
                </View>
                <Switch
                  value={prefs.emailEnabled}
                  onValueChange={() => toggleGlobal('emailEnabled')}
                  trackColor={{ false: THEME.colors.surfaceElevated, true: THEME.colors.primary }}
                  thumbColor={THEME.colors.palette.white}
                />
              </View>
            </View>
          </View>

          {/* Granular Event Triggers */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>EXPENSE ALERTS</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Expense Added</Text>
                  <Text style={styles.rowSubtitle}>When someone splits a new bill</Text>
                </View>
                <Switch
                  value={getEventPushValue('expense_added')}
                  onValueChange={() => toggleEventPush('expense_added')}
                  trackColor={{ false: THEME.colors.surfaceElevated, true: THEME.colors.primary }}
                  thumbColor={THEME.colors.palette.white}
                />
              </View>

              <View style={[styles.row, styles.borderTop]}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Expense Updated or Deleted</Text>
                  <Text style={styles.rowSubtitle}>When splits or amounts change</Text>
                </View>
                <Switch
                  value={getEventPushValue('expense_updated')}
                  onValueChange={() => toggleEventPush('expense_updated')}
                  trackColor={{ false: THEME.colors.surfaceElevated, true: THEME.colors.primary }}
                  thumbColor={THEME.colors.palette.white}
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeader}>SETTLEMENTS & DEBTS</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Settlement Recorded</Text>
                  <Text style={styles.rowSubtitle}>When a member pays or clears balance</Text>
                </View>
                <Switch
                  value={getEventPushValue('settlement_added')}
                  onValueChange={() => toggleEventPush('settlement_added')}
                  trackColor={{ false: THEME.colors.surfaceElevated, true: THEME.colors.primary }}
                  thumbColor={THEME.colors.palette.white}
                />
              </View>

              <View style={[styles.row, styles.borderTop]}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Payment Reminders</Text>
                  <Text style={styles.rowSubtitle}>Friendly reminder for pending debts</Text>
                </View>
                <Switch
                  value={getEventPushValue('payment_reminder')}
                  onValueChange={() => toggleEventPush('payment_reminder')}
                  trackColor={{ false: THEME.colors.surfaceElevated, true: THEME.colors.primary }}
                  thumbColor={THEME.colors.palette.white}
                />
              </View>

              <View style={[styles.row, styles.borderTop]}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Balance & Settle-up Requests</Text>
                  <Text style={styles.rowSubtitle}>Payment confirmations and balance alerts</Text>
                </View>
                <Switch
                  value={getEventPushValue('balance_reminder')}
                  onValueChange={() => toggleEventPush('balance_reminder')}
                  trackColor={{ false: THEME.colors.surfaceElevated, true: THEME.colors.primary }}
                  thumbColor={THEME.colors.palette.white}
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeader}>AI & BUDGETS</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Budget Velocity Warning</Text>
                  <Text style={styles.rowSubtitle}>Alert when spend reaches 70% threshold</Text>
                </View>
                <Switch
                  value={getEventPushValue('budget_alert')}
                  onValueChange={() => toggleEventPush('budget_alert')}
                  trackColor={{ false: THEME.colors.surfaceElevated, true: THEME.colors.primary }}
                  thumbColor={THEME.colors.palette.white}
                />
              </View>

              <View style={[styles.row, styles.borderTop]}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Budget Exceeded Alert</Text>
                  <Text style={styles.rowSubtitle}>When category limit is breached</Text>
                </View>
                <Switch
                  value={getEventPushValue('budget_exceeded')}
                  onValueChange={() => toggleEventPush('budget_exceeded')}
                  trackColor={{ false: THEME.colors.surfaceElevated, true: THEME.colors.primary }}
                  thumbColor={THEME.colors.palette.white}
                />
              </View>

              <View style={[styles.row, styles.borderTop]}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Monthly Spend Summaries</Text>
                  <Text style={styles.rowSubtitle}>Insights on monthly spending trends</Text>
                </View>
                <Switch
                  value={getEventPushValue('monthly_summary')}
                  onValueChange={() => toggleEventPush('monthly_summary')}
                  trackColor={{ false: THEME.colors.surfaceElevated, true: THEME.colors.primary }}
                  thumbColor={THEME.colors.palette.white}
                />
              </View>

              <View style={[styles.row, styles.borderTop]}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Customer Support Replies</Text>
                  <Text style={styles.rowSubtitle}>Updates on your support tickets</Text>
                </View>
                <Switch
                  value={getEventPushValue('support_reply')}
                  onValueChange={() => toggleEventPush('support_reply')}
                  trackColor={{ false: THEME.colors.surfaceElevated, true: THEME.colors.primary }}
                  thumbColor={THEME.colors.palette.white}
                />
              </View>
            </View>
          </View>
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
    flex: 1,
    marginLeft: 12,
    fontSize: 17,
    fontWeight: '800',
    color: THEME.colors.text,
    textAlign: 'left',
  },
  savedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.colors.primary,
    paddingVertical: 6,
  },
  savedBannerText: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.primaryForeground,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 20,
    paddingBottom: 36,
  },
  section: {
    gap: 8,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: THEME.colors.textMuted,
    paddingLeft: 4,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 12,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
    marginBottom: 2,
  },
  rowSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  systemStatusButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: THEME.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  systemStatusButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primaryForeground,
  },
  statusPillActive: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusPillActiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.success,
  },
  channelHeader: {
    padding: 14,
    gap: 4,
  },
  channelHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  channelHeaderSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    lineHeight: 16,
  },
  channelItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  channelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  channelItemTextCol: {
    flex: 1,
  },
  channelItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text,
    marginBottom: 1,
  },
  channelItemDesc: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  manageChannelsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    gap: 8,
    backgroundColor: THEME.colors.surfaceSubtle,
  },
  manageChannelsButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
