import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { QuantumSpinner } from '../../src/components/brand/QuantumLogo';
import {
  ArrowLeft,
  Bell,
  Smartphone,
  Mail,
  Check,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import {
  notificationService,
  UserNotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../../src/services/notification.service';
import { haptics } from '../../src/services/haptics.service';

export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<UserNotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES
  );
  const [loading, setLoading] = useState(true);
  const [savedBanner, setSavedBanner] = useState(false);

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
    haptics.tick();
    await notificationService.updatePreferences(updated);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2000);
  };

  const toggleGlobal = (key: 'inAppEnabled' | 'pushEnabled' | 'emailEnabled') => {
    const updated = { ...prefs, [key]: !prefs[key] };
    triggerSave(updated);
  };

  const toggleEventPush = (eventKey: keyof UserNotificationPreferences['events']) => {
    const current = prefs.events[eventKey] || { inApp: true, push: true, email: false };
    const updated: UserNotificationPreferences = {
      ...prefs,
      events: {
        ...prefs.events,
        [eventKey]: {
          ...current,
          push: !current.push,
        },
      },
    };
    triggerSave(updated);
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
                  value={prefs.events.expense_added.push}
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
                  value={prefs.events.expense_updated.push}
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
                  value={prefs.events.settlement_added.push}
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
                  value={prefs.events.payment_reminder.push}
                  onValueChange={() => toggleEventPush('payment_reminder')}
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
                  value={prefs.events.budget_alert.push}
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
                  value={prefs.events.budget_exceeded.push}
                  onValueChange={() => toggleEventPush('budget_exceeded')}
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
                  value={prefs.events.support_reply.push}
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
});
