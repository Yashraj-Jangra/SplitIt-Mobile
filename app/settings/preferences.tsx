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
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { groupService } from '../../src/services/group.service';
import { haptics } from '../../src/services/haptics.service';
import { useHaptics } from '../../src/contexts/haptics.context';
import { useCurrency, PRESET_CURRENCIES } from '../../src/contexts/currency.context';

export default function PreferencesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { enabled: hapticsEnabled, setEnabled: setHapticsEnabled } = useHaptics();
  const { currencyCode, currencySymbol, isCustom, setCurrency, formatCurrency } = useCurrency();

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
        {/* ── CARD 1: PRIMARY CURRENCY ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconBox}>
              <Coins size={16} color={THEME.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Default Currency Logo</Text>
              <Text style={styles.cardSubtitle}>
                Single-currency model · Changes the display logo without converting values
              </Text>
            </View>
          </View>

          {/* Active Currency Live Preview */}
          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>ACTIVE CURRENCY PREVIEW</Text>
            <View style={styles.previewRow}>
              <Text style={styles.previewSymbolBadge}>{currencySymbol}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.previewSampleText}>
                  {formatCurrency(1499, { decimals: 2 })}
                </Text>
                <Text style={styles.previewSubtext}>
                  {isCustom ? `Custom Logo ("${currencySymbol}")` : `${currencyCode} · Everywhere in app`}
                </Text>
              </View>
            </View>
          </View>

          {/* Custom Currency Logo / Symbol Input */}
          <View style={styles.customCurrencyCard}>
            <View style={styles.customCurrencyHeader}>
              <Sparkles size={14} color={THEME.colors.primary} />
              <Text style={styles.customCurrencyTitle}>Custom Currency Logo</Text>
            </View>
            <Text style={styles.customCurrencySubtitle}>
              Type any custom currency symbol, abbreviation, or crypto sign (e.g. Rs., kr, Rp, ₿, CHF).
            </Text>
            <View style={styles.customInputRow}>
              <TextInput
                style={styles.customInput}
                value={customSymbolInput}
                onChangeText={setCustomSymbolInput}
                placeholder="e.g. Rs., kr, ₿"
                placeholderTextColor={THEME.colors.textMuted}
                maxLength={8}
                autoCapitalize="none"
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
                <Check size={12} color={THEME.colors.primary} strokeWidth={2.5} />
                <Text style={styles.customActiveText}>Custom logo "{currencySymbol}" is currently active</Text>
              </View>
            )}
          </View>

          <Text style={styles.presetSectionLabel}>POPULAR CURRENCY PRESETS</Text>
          <View style={styles.currencyList}>
            {PRESET_CURRENCIES.map((item, index) => {
              const isSelected = !isCustom && currencyCode === item.code;
              const isLast = index === PRESET_CURRENCIES.length - 1;

              return (
                <TouchableOpacity
                  key={item.code}
                  style={[styles.currencyRow, !isLast && styles.currencyRowBorder]}
                  onPress={() => handleSelectCurrency(item.code)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.flagText}>{item.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.currencyName}>{item.name}</Text>
                    <Text style={styles.currencyCode}>
                      {item.code} ({item.symbol})
                    </Text>
                  </View>

                  {isSelected && (
                    <View style={styles.selectedPill}>
                      <Check size={14} color={THEME.colors.primary} strokeWidth={2.5} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── CARD 2: HARDWARE & INTERACTION ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconBox}>
              <Vibrate size={16} color={THEME.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Haptics & Feedback</Text>
              <Text style={styles.cardSubtitle}>Tactile hardware feedback during interactions</Text>
            </View>
          </View>

          <View style={styles.settingToggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingToggleTitle}>Haptic Feedback</Text>
              <Text style={styles.settingToggleSubtitle}>
                Vibration on button taps, swipes, and settlement recordings
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

        {/* ── CARD 3: DEFAULT GROUP ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconBox}>
              <Layers size={16} color={THEME.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Default Group</Text>
              <Text style={styles.cardSubtitle}>Pre-selected group when recording expenses</Text>
            </View>
          </View>

          <View style={styles.defaultGroupBody}>
            <Text style={styles.defaultGroupLabel}>ACTIVE DEFAULT:</Text>
            <View style={styles.defaultGroupInfoRow}>
              <Text style={styles.defaultGroupValue}>
                {defaultGroupName ? defaultGroupName : 'None (Auto-pick most recent)'}
              </Text>
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
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    padding: 16,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  cardIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  cardSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  currencyList: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    paddingHorizontal: 12,
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  currencyRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  flagText: {
    fontSize: 20,
  },
  currencyName: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  currencyCode: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  selectedPill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME.colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
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
  defaultGroupBody: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    padding: 12,
    gap: 6,
  },
  defaultGroupLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.5,
  },
  defaultGroupInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  defaultGroupValue: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  clearBtn: {
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  clearBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.negative,
  },
  previewBox: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    padding: 12,
    gap: 8,
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.5,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewSymbolBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.colors.primary + '20',
    color: THEME.colors.primary,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 44,
  },
  previewSampleText: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.5,
  },
  previewSubtext: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  customCurrencyCard: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    padding: 12,
    gap: 8,
  },
  customCurrencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customCurrencyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  customCurrencySubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    lineHeight: 16,
  },
  customInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  customInput: {
    flex: 1,
    height: 42,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 12,
    color: THEME.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  customApplyBtn: {
    height: 42,
    paddingHorizontal: 16,
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.radius.md,
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
    gap: 6,
    paddingTop: 4,
  },
  customActiveText: {
    fontSize: 11,
    color: THEME.colors.primary,
    fontWeight: '600',
  },
  presetSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 6,
  },
});
