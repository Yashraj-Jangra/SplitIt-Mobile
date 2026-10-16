import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Coins,
  Vibrate,
  Layers,
  Palette,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { groupService, GroupListItem } from '../../src/services/group.service';
import { haptics } from '../../src/services/haptics.service';
import { useHaptics } from '../../src/contexts/haptics.context';
import { useCurrency } from '../../src/contexts/currency.context';
import { useAppTheme } from '../../src/contexts/theme.context';
import { SettingsSection } from '../../src/components/settings/SettingsSection';
import { SettingsRow } from '../../src/components/settings/SettingsRow';
import { CurrencyPickerModal } from '../../src/components/common/CurrencyPickerModal';
import { GroupPickerModal } from '../../src/components/common/GroupPickerModal';

export default function PreferencesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { enabled: hapticsEnabled, setEnabled: setHapticsEnabled } = useHaptics();
  const { currencyCode, currencySymbol, isCustom, setCurrency, formatCurrency } = useCurrency();
  const { currentAccent } = useAppTheme();

  // Modals state
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);

  // Groups and Default Group
  const [userGroups, setUserGroups] = useState<GroupListItem[]>([]);
  const [defaultGroupId, setDefaultGroupId] = useState<string | null>(null);
  const [defaultGroupName, setDefaultGroupName] = useState<string | null>(null);

  useEffect(() => {
    async function loadPrefs() {
      try {
        const memGroups = groupService.getInMemoryGroups();
        if (memGroups.length > 0) {
          setUserGroups(memGroups);
        }

        const [defId, groups] = await Promise.all([
          groupService.getDefaultGroupId(),
          groupService.getUserGroups({ skipBalances: true }),
        ]);

        setDefaultGroupId(defId);
        setUserGroups(groups);

        if (defId) {
          const defGroup = groups.find((g) => g.id === defId);
          if (defGroup) {
            setDefaultGroupName(defGroup.name);
          }
        }
      } catch {
        // Fallback gracefully
      }
    }
    loadPrefs();
  }, []);

  const handleSelectCurrency = async (code: string) => {
    await setCurrency(code);
  };

  const handleApplyCustomSymbol = async (symbol: string) => {
    await setCurrency('CUSTOM', symbol);
  };

  const handleToggleHaptics = async (val: boolean) => {
    await setHapticsEnabled(val);
    if (val) haptics.tick();
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
            subtitle={isCustom ? `Custom logo ("${currencySymbol}")` : `${currencyCode} · Display logo`}
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
                trackColor={{ false: THEME.colors.surfaceElevated, true: THEME.colors.primary }}
                thumbColor={THEME.colors.text}
              />
            }
            isLast
          />
        </SettingsSection>

        {/* ── SECTION 3: WORKFLOW DEFAULTS ── */}
        <SettingsSection title="WORKFLOW DEFAULTS">
          <SettingsRow
            icon={Layers}
            title="Default Circle"
            subtitle={defaultGroupName ? `Pre-selects "${defaultGroupName}"` : 'Auto-pick most recent circle'}
            value={defaultGroupName || 'Auto (Recent)'}
            onPress={() => setShowGroupModal(true)}
            isLast
          />
        </SettingsSection>

        {/* ── SECTION 4: LIVE PREVIEW (OPEN EDITORIAL) ── */}
        <SettingsSection title="FORMATTING PREVIEW">
          <View style={styles.previewBanner}>
            <View style={styles.previewAccentBar} />
            <View style={styles.previewBody}>
              <View style={styles.previewSymbolBadge}>
                <Text style={styles.previewSymbolBadgeText}>{currencySymbol}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.previewNumberText}>
                  {formatCurrency(1499, { decimals: 2 })}
                </Text>
                <Text style={styles.previewCaptionText}>
                  {isCustom
                    ? `Custom symbol "${currencySymbol}" active everywhere`
                    : `${currencyCode} active · Single-currency display model`}
                </Text>
              </View>
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.livePillText}>LIVE</Text>
              </View>
            </View>
          </View>
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
        onSelectGroup={handleSelectDefaultGroup}
        allowNoneOption
        title="Default Circle"
        subtitle="Choose which circle is automatically pre-selected when creating expenses"
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
  previewBanner: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surface,
    overflow: 'hidden',
  },
  previewAccentBar: {
    width: 3.5,
    backgroundColor: THEME.colors.primary,
  },
  previewBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  previewSymbolBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  previewSymbolBadgeText: {
    fontSize: 16,
    fontWeight: '900',
    color: THEME.colors.primary,
  },
  previewNumberText: {
    fontSize: 16,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -0.4,
  },
  previewCaptionText: {
    fontSize: 11,
    fontWeight: '500',
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: THEME.radius.full,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: THEME.colors.success,
  },
  livePillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: THEME.colors.success,
    letterSpacing: 0.5,
  },
});
