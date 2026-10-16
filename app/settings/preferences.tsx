import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Coins,
  Vibrate,
  Layers,
  Check,
  Sparkles,
  Palette,
  ChevronRight,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { groupService } from '../../src/services/group.service';
import { haptics } from '../../src/services/haptics.service';
import { useHaptics } from '../../src/contexts/haptics.context';
import { useCurrency, PRESET_CURRENCIES } from '../../src/contexts/currency.context';
import { useAppTheme } from '../../src/contexts/theme.context';

export default function PreferencesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { enabled: hapticsEnabled, setEnabled: setHapticsEnabled } = useHaptics();
  const { currencyCode, currencySymbol, isCustom, setCurrency, formatCurrency } = useCurrency();
  const { currentAccent } = useAppTheme();

  const [customSymbolInput, setCustomSymbolInput] = useState(isCustom ? currencySymbol : '');
  const [defaultGroupName, setDefaultGroupName] = useState<string | null>(null);

  useEffect(() => {
    async function loadPrefs() {
      const defaultGroupId = await groupService.getDefaultGroupId();
      if (defaultGroupId) {
        const groups = await groupService.getUserGroups();
        const defGroup = groups.find((g) => g.id === defaultGroupId);
        if (defGroup) {
          setDefaultGroupName(defGroup.name);
        }
      }
    }
    loadPrefs();
  }, []);

  const handleSelectCurrency = async (code: string) => {
    haptics.tap();
    await setCurrency(code);
  };

  const handleApplyCustomSymbol = async () => {
    const trimmed = customSymbolInput.trim();
    if (!trimmed) {
      Alert.alert('Invalid Logo', 'Please enter a currency symbol or logo (e.g. Rs., kr, ₿).');
      return;
    }
    haptics.saveSuccess();
    await setCurrency('CUSTOM', trimmed);
    Alert.alert('Currency Updated', `Default currency logo set to "${trimmed}". All amounts in the app will now display with this symbol.`);
  };

  const handleToggleHaptics = async (val: boolean) => {
    await setHapticsEnabled(val);
    if (val) haptics.tick();
  };

  const handleClearDefaultGroup = async () => {
    haptics.tap();
    await groupService.setDefaultGroupId(null);
    setDefaultGroupName(null);
    Alert.alert('Default Group Reset', 'Default group has been cleared.');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Pinned Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={20} color={THEME.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>App Preferences</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── CARD 0: APPEARANCE & ACCENT THEME ── */}
        <TouchableOpacity
          style={styles.appearanceCard}
          onPress={() => {
            haptics.tap();
            router.push('/settings/appearance');
          }}
          activeOpacity={0.8}
        >
          <View style={[styles.cardIconBox, { backgroundColor: currentAccent.primaryMuted }]}>
            <Palette size={16} color={currentAccent.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <Text style={styles.cardTitle}>Appearance & Accent</Text>
              <View style={[styles.activeAccentPill, { backgroundColor: currentAccent.primaryMuted }]}>
                <View style={[styles.accentDot, { backgroundColor: currentAccent.primary }]} />
                <Text style={[styles.activeAccentText, { color: currentAccent.primary }]}>
                  {currentAccent.name}
                </Text>
              </View>
            </View>
            <Text style={styles.cardSubtitle}>
              Sleek open-editorial theme palettes & custom hex colors
            </Text>
          </View>
          <ChevronRight size={16} color={THEME.colors.textMuted} />
        </TouchableOpacity>

        {/* ── SECTION 1: CURRENCY & DISPLAY (OPEN EDITORIAL) ── */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBadge}>
              <Coins size={15} color={THEME.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Default Currency Logo</Text>
              <Text style={styles.sectionSubtitle}>
                Single-currency model · Changes the display logo without converting values
              </Text>
            </View>
          </View>

          {/* Active Currency Live Preview Strip (Single-layer surface) */}
          <View style={styles.previewStrip}>
            <View style={styles.previewSymbolBox}>
              <Text style={styles.previewSymbolText}>{currencySymbol}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.previewAmountText}>
                {formatCurrency(1499, { decimals: 2 })}
              </Text>
              <Text style={styles.previewDescText}>
                {isCustom ? `Custom symbol ("${currencySymbol}")` : `${currencyCode} · Active Everywhere`}
              </Text>
            </View>
            <View style={styles.activeStatusPill}>
              <View style={styles.activeStatusDot} />
              <Text style={styles.activeStatusText}>ACTIVE</Text>
            </View>
          </View>

          {/* Custom Currency Inline Input Group */}
          <View style={styles.customInputCard}>
            <View style={styles.customInputHeaderRow}>
              <Sparkles size={13} color={THEME.colors.primary} />
              <Text style={styles.customInputHeaderTitle}>Custom Currency Logo</Text>
            </View>
            <Text style={styles.customInputDesc}>
              Type any custom sign or abbreviation (e.g. Rs., kr, Rp, ₿, CHF)
            </Text>
            <View style={styles.customInputRow}>
              <TextInput
                style={styles.customTextInput}
                value={customSymbolInput}
                onChangeText={setCustomSymbolInput}
                placeholder="e.g. Rs., kr, ₿"
                placeholderTextColor={THEME.colors.textMuted}
                maxLength={8}
                autoCapitalize="none"
                numberOfLines={1}
                multiline={false}
              />
              <TouchableOpacity
                style={styles.customApplyBtn}
                onPress={handleApplyCustomSymbol}
                activeOpacity={0.8}
              >
                <Text style={styles.customApplyBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>
            {isCustom && (
              <View style={styles.customActiveBadge}>
                <Check size={12} color={THEME.colors.success} strokeWidth={2.5} />
                <Text style={styles.customActiveText}>
                  Custom logo "{currencySymbol}" is currently active
                </Text>
              </View>
            )}
          </View>

          {/* Popular Currency Presets (Open Hairline Ledger) */}
          <View style={styles.presetsLedgerWrapper}>
            <Text style={styles.presetsOverline}>POPULAR CURRENCY PRESETS</Text>
            <View style={styles.presetsLedger}>
              {PRESET_CURRENCIES.map((item, index) => {
                const isSelected = !isCustom && currencyCode === item.code;
                const isLast = index === PRESET_CURRENCIES.length - 1;

                return (
                  <TouchableOpacity
                    key={item.code}
                    style={[styles.presetRow, !isLast && styles.presetRowBorder]}
                    onPress={() => {
                      haptics.tap();
                      handleSelectCurrency(item.code);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.presetFlag}>{item.flag}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.presetName}>{item.name}</Text>
                      <Text style={styles.presetCode}>
                        {item.code} · {item.symbol}
                      </Text>
                    </View>

                    {isSelected && (
                      <View style={styles.selectedCheckPill}>
                        <Check size={12} color={THEME.colors.primary} strokeWidth={3} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* ── SECTION 2: HARDWARE & INTERACTION ── */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBadge}>
              <Vibrate size={15} color={THEME.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Haptics & Feedback</Text>
              <Text style={styles.sectionSubtitle}>Tactile hardware feedback during interactions</Text>
            </View>
          </View>

          <View style={styles.singleLayerCard}>
            <View style={styles.settingToggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingToggleTitle}>Haptic Feedback</Text>
                <Text style={styles.settingToggleSubtitle}>
                  Tactile responses on taps, gestures, and transaction workflows
                </Text>
              </View>
              <Switch
                value={hapticsEnabled}
                onValueChange={handleToggleHaptics}
                trackColor={{ false: THEME.colors.surfaceElevated, true: THEME.colors.primary }}
                thumbColor={THEME.colors.text}
              />
            </View>
          </View>
        </View>

        {/* ── SECTION 3: DEFAULT GROUP ── */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBadge}>
              <Layers size={15} color={THEME.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Default Group</Text>
              <Text style={styles.sectionSubtitle}>Pre-selected group when recording expenses</Text>
            </View>
          </View>

          <View style={styles.singleLayerCard}>
            <View style={styles.defaultGroupInfoRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.defaultGroupLabel}>ACTIVE DEFAULT</Text>
                <Text style={styles.defaultGroupValue}>
                  {defaultGroupName ? defaultGroupName : 'None (Auto-pick most recent)'}
                </Text>
              </View>
              {defaultGroupName && (
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={handleClearDefaultGroup}
                >
                  <Text style={styles.clearBtnText}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

      </ScrollView>
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
    gap: 16,
  },
  appearanceCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activeAccentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  accentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeAccentText: {
    fontSize: 11,
    fontWeight: THEME.typography.weight.bold,
  },
  cardIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  cardSubtitle: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  sectionBlock: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 2,
  },
  sectionIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: THEME.colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.text,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  previewStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  previewSymbolBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewSymbolText: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.colors.primary,
  },
  previewAmountText: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.3,
  },
  previewDescText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  activeStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.primaryMuted,
  },
  activeStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.primary,
  },
  activeStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.primary,
    letterSpacing: 0.5,
  },
  customInputCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    gap: 8,
  },
  customInputHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customInputHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  customInputDesc: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    lineHeight: 15,
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  customTextInput: {
    flex: 1,
    height: 40,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  customApplyBtn: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customApplyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.primaryForeground,
  },
  customActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  customActiveText: {
    fontSize: 11,
    color: THEME.colors.success,
    fontWeight: '600',
  },
  presetsLedgerWrapper: {
    gap: 8,
    marginTop: 4,
  },
  presetsOverline: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: THEME.colors.textMuted,
    paddingHorizontal: 2,
  },
  presetsLedger: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    paddingHorizontal: 14,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  presetRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  presetFlag: {
    fontSize: 20,
  },
  presetName: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  presetCode: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  selectedCheckPill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: THEME.colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  singleLayerCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  settingToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingToggleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  settingToggleSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  defaultGroupInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  defaultGroupLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  defaultGroupValue: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  clearBtn: {
    backgroundColor: THEME.colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  clearBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.negative,
  },
});
