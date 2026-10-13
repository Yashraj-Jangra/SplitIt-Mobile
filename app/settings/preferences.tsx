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
  Layers,
  Check,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { storageService } from '../../src/services/storage.service';
import { groupService } from '../../src/services/group.service';
import * as Haptics from 'expo-haptics';

interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
  flag: string;
}

const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳' },
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', flag: '🇦🇪' },
];

export default function PreferencesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [selectedCurrency, setSelectedCurrency] = useState('INR');
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [defaultGroupName, setDefaultGroupName] = useState<string | null>(null);

  useEffect(() => {
    async function loadPrefs() {
      const curr = await storageService.getCurrencyPreference();
      setSelectedCurrency(curr);

      const haptics = await storageService.getHapticsPreference();
      setHapticsEnabled(haptics);

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

  const handleSelectCurrency = async (curr: string) => {
    if (hapticsEnabled) {
      Haptics.selectionAsync();
    }
    setSelectedCurrency(curr);
    await storageService.setCurrencyPreference(curr);
  };

  const handleToggleHaptics = async (enabled: boolean) => {
    if (enabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setHapticsEnabled(enabled);
    await storageService.setHapticsPreference(enabled);
  };

  const handleClearDefaultGroup = async () => {
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
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
            if (hapticsEnabled) Haptics.selectionAsync();
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
              <Text style={styles.cardTitle}>Default Currency</Text>
              <Text style={styles.cardSubtitle}>Preferred currency symbol for calculations</Text>
            </View>
          </View>

          <View style={styles.currencyList}>
            {CURRENCY_OPTIONS.map((item, index) => {
              const isSelected = selectedCurrency === item.code;
              const isLast = index === CURRENCY_OPTIONS.length - 1;

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
});
