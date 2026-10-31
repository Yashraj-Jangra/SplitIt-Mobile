import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Coins,
  Vibrate,
  Users,
  Palette,
  Receipt,
  Sparkles,
} from 'lucide-react-native';
import Constants from 'expo-constants';
import { THEME } from '../../src/constants/theme';
import { groupService, GroupListItem } from '../../src/services/group.service';
import { haptics } from '../../src/services/haptics.service';
import { appEventEmitter } from '../../src/services/event-emitter';
import { useHaptics } from '../../src/contexts/haptics.context';
import { useCurrency } from '../../src/contexts/currency.context';
import { useAppTheme } from '../../src/contexts/theme.context';
import { SettingsSection } from '../../src/components/settings/SettingsSection';
import { SettingsRow } from '../../src/components/settings/SettingsRow';
import { CurrencyPickerModal } from '../../src/components/common/CurrencyPickerModal';
import { GroupPickerModal } from '../../src/components/common/GroupPickerModal';
import { updateService, type UpdateInfo } from '../../src/services/update.service';
import { UpdateModal } from '../../src/components/common/UpdateModal';

export default function PreferencesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { enabled: hapticsEnabled, setEnabled: setHapticsEnabled } = useHaptics();
  const { currencyCode, currencySymbol, isCustom, setCurrency, formatCurrency } = useCurrency();
  const { currentAccent } = useAppTheme();

  // Modals state
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const appVersion = Constants.expoConfig?.version || '1.2.1';

  const handleCheckForUpdates = async () => {
    if (checkingUpdate) return;
    haptics.tap();
    setCheckingUpdate(true);
    try {
      const info = await updateService.checkForUpdate(true);
      setUpdateInfo(info);
      if (info.available) {
        haptics.saveSuccess();
        setShowUpdateModal(true);
      } else {
        haptics.tap();
        Alert.alert('Up to Date', `SplitIt v${appVersion} is the latest version available.`);
      }
    } catch {
      haptics.warning();
      Alert.alert(
        'Check Failed',
        'Unable to check for updates right now. Please check your network connection.'
      );
    } finally {
      setCheckingUpdate(false);
    }
  };

  // Groups and Default Group
  const [userGroups, setUserGroups] = useState<GroupListItem[]>([]);
  const [defaultGroupId, setDefaultGroupId] = useState<string | null>(null);
  const [defaultGroupName, setDefaultGroupName] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPrefs() {
      try {
        const memGroups = groupService.getInMemoryGroups();
        if (memGroups.length > 0 && isMounted) {
          setUserGroups(memGroups);
        }

        const [defId, groups] = await Promise.all([
          groupService.getDefaultGroupId(),
          groupService.getUserGroups({ skipBalances: true }),
        ]);

        if (!isMounted) return;

        setDefaultGroupId(defId);
        if (groups && groups.length > 0) {
          setUserGroups(groups);
        }

        if (defId) {
          const listToSearch = groups.length > 0 ? groups : memGroups;
          const defGroup = listToSearch.find((g) => g.id === defId);
          if (defGroup) {
            setDefaultGroupName(defGroup.name);
          }
        }
      } catch {
        // Fallback gracefully
      }
    }

    loadPrefs();

    // Subscribe to cross-screen default group changes (e.g. from Add Expense or Settle Up)
    const unsub = appEventEmitter.on('DEFAULT_GROUP_CHANGED', (newGroupId: string | null) => {
      if (!isMounted) return;
      setDefaultGroupId(newGroupId);
      if (newGroupId) {
        setUserGroups((prev) => {
          const matched = prev.find((g) => g.id === newGroupId);
          setDefaultGroupName(matched ? matched.name : null);
          return prev;
        });
      } else {
        setDefaultGroupName(null);
      }
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  const handleSelectCurrency = async (code: string) => {
    await setCurrency(code);
  };

  const handleApplyCustomSymbol = async (symbol: string) => {
    await setCurrency('CUSTOM', symbol);
  };

  const handleToggleHaptics = async (val: boolean) => {
    await setHapticsEnabled(val);
    if (val) haptics.toggleSwitch();
  };

  const handleSelectDefaultGroup = async (groupId: string | null) => {
    await groupService.setDefaultGroupId(groupId);
    setDefaultGroupId(groupId);
    if (groupId) {
      const matched = userGroups.find((g) => g.id === groupId);
      setDefaultGroupName(matched ? matched.name : null);
    } else {
      setDefaultGroupName(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Pinned Editorial Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={20} color={THEME.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>App Preferences</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── TOP ATMOSPHERIC LIVE FORMATTING HERO PREVIEW ── */}
        <View style={styles.heroSection}>
          {/* Subtle Ambient Glow */}
          <View
            style={[
              styles.heroAmbientGlow,
              { backgroundColor: currentAccent.primary, opacity: 0.12 },
            ]}
          />

          <View style={styles.heroTopRow}>
            {/* Symbol Node */}
            <View
              style={[
                styles.heroSymbolBadge,
                {
                  backgroundColor: currentAccent.primaryMuted,
                  borderColor: currentAccent.borderFocus,
                },
              ]}
            >
              <Text style={[styles.heroSymbolText, { color: currentAccent.primary }]}>
                {currencySymbol}
              </Text>
            </View>

            {/* Live Status Pill */}
            <View style={[styles.heroLivePill, { backgroundColor: currentAccent.primaryMuted }]}>
              <View style={[styles.heroLiveDot, { backgroundColor: currentAccent.primary }]} />
              <Text style={[styles.heroLivePillText, { color: currentAccent.primary }]}>
                {isCustom ? `CUSTOM · "${currencySymbol}"` : `${currencyCode} · ACTIVE`}
              </Text>
            </View>
          </View>

          {/* Hero Formatted Amount */}
          <View style={styles.heroAmountRow}>
            <Text style={styles.heroAmountNumber}>
              {formatCurrency(1499, { decimals: 2 })}
            </Text>
          </View>

          {/* Sleek Context Sample Strip */}
          <View style={styles.heroSampleStrip}>
            <View style={styles.heroSampleLeft}>
              <Receipt size={13} color={THEME.colors.textMuted} />
              <Text style={styles.heroSampleLabel}>Groceries split</Text>
            </View>
            <Text style={styles.heroSampleValue}>
              -{formatCurrency(42.5, { decimals: 2 })}
            </Text>
          </View>
        </View>

        {/* ── SECTION 1: DISPLAY & THEMING ── */}
        <SettingsSection title="DISPLAY & THEMING">
          <SettingsRow
            icon={Palette}
            iconColor={currentAccent.primary}
            iconBg={currentAccent.primaryMuted}
            title="Appearance & Accent"
            subtitle="Theme palettes & custom colors"
            value={
              <View style={[styles.accentPill, { backgroundColor: currentAccent.primaryMuted }]}>
                <View style={[styles.accentDot, { backgroundColor: currentAccent.primary }]} />
                <Text style={[styles.accentPillText, { color: currentAccent.primary }]}>
                  {currentAccent.name}
                </Text>
              </View>
            }
            onPress={() => router.push('/settings/appearance')}
          />
          <SettingsRow
            icon={Coins}
            title="Default Currency"
            subtitle={isCustom ? `Custom symbol ("${currencySymbol}")` : `${currencyCode} · Display format`}
            value={`${currencySymbol} ${isCustom ? 'Custom' : currencyCode}`}
            onPress={() => setShowCurrencyModal(true)}
            isLast
          />
        </SettingsSection>

        {/* ── SECTION 2: HARDWARE & INTERACTION ── */}
        <SettingsSection title="HARDWARE & INTERACTION">
          <SettingsRow
            icon={Vibrate}
            title="Haptic Feedback"
            subtitle="Tactile hardware response on taps & actions"
            rightElement={
              <Switch
                value={hapticsEnabled}
                onValueChange={handleToggleHaptics}
                trackColor={{ false: THEME.colors.surfaceElevated, true: currentAccent.primary }}
                thumbColor={THEME.colors.text}
              />
            }
            isLast
          />
        </SettingsSection>

        {/* ── SECTION 3: WORKFLOW DEFAULTS ── */}
        <SettingsSection title="WORKFLOW DEFAULTS">
          <SettingsRow
            icon={Users}
            title="Default Group"
            subtitle={defaultGroupName ? `Pre-selects "${defaultGroupName}"` : 'Auto-pick most recent group'}
            value={defaultGroupName || 'Auto (Recent)'}
            onPress={() => setShowGroupModal(true)}
            isLast
          />
        </SettingsSection>

        {/* ── SECTION 4: SYSTEM & UPDATES ── */}
        <SettingsSection title="SYSTEM & UPDATES">
          <SettingsRow
            icon={Sparkles}
            iconColor={currentAccent.primary}
            iconBg={currentAccent.primaryMuted}
            title="Check for Updates"
            subtitle={checkingUpdate ? 'Checking GitHub Releases...' : `Installed: v${appVersion} · GitHub Releases`}
            value={checkingUpdate ? 'Checking...' : `v${appVersion}`}
            onPress={handleCheckForUpdates}
            isLast
          />
        </SettingsSection>
      </ScrollView>

      {/* ── MODULAR POPUP PICKERS (WIDE & NO-DIV) ── */}
      <CurrencyPickerModal
        visible={showCurrencyModal}
        onClose={() => setShowCurrencyModal(false)}
        currentCode={currencyCode}
        currentSymbol={currencySymbol}
        isCustom={isCustom}
        onSelectCurrency={handleSelectCurrency}
        onApplyCustomSymbol={handleApplyCustomSymbol}
      />

      <GroupPickerModal
        visible={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        groups={userGroups}
        selectedGroupId={defaultGroupId}
        defaultGroupId={defaultGroupId}
        onSelectGroup={handleSelectDefaultGroup}
        allowNoneOption
        title="Default Group"
        subtitle="Choose which group is pre-selected when creating expenses"
      />

      <UpdateModal
        visible={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        updateInfo={updateInfo}
      />
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.3,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 20,
  },

  /* ── ATMOSPHERIC HERO PREVIEW ── */
  heroSection: {
    position: 'relative',
    backgroundColor: THEME.colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    overflow: 'hidden',
    gap: 14,
  },
  heroAmbientGlow: {
    position: 'absolute',
    top: -40,
    left: '20%',
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroSymbolBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  heroSymbolText: {
    fontSize: 18,
    fontWeight: '900',
  },
  heroLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
  },
  heroLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  heroLivePillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroAmountRow: {
    paddingVertical: 4,
  },
  heroAmountNumber: {
    fontSize: 32,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -0.8,
  },
  heroSampleStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.colors.hairline,
  },
  heroSampleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroSampleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  heroSampleValue: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },

  /* ── ACCENT PILL ── */
  accentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.full,
  },
  accentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  accentPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
