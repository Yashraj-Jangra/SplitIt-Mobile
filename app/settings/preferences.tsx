import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  Image,
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
  Search,
  RotateCcw,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { groupService, GroupListItem } from '../../src/services/group.service';
import { haptics } from '../../src/services/haptics.service';
import { useHaptics } from '../../src/contexts/haptics.context';
import { useCurrency, PRESET_CURRENCIES } from '../../src/contexts/currency.context';
import { useAppTheme } from '../../src/contexts/theme.context';
import { BottomSheetModal } from '../../src/components/common/BottomSheetModal';

export default function PreferencesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { enabled: hapticsEnabled, setEnabled: setHapticsEnabled } = useHaptics();
  const { currencyCode, currencySymbol, isCustom, setCurrency, formatCurrency } = useCurrency();
  const { currentAccent } = useAppTheme();

  // Modal display states
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');

  // Custom currency input
  const [customSymbolInput, setCustomSymbolInput] = useState(isCustom ? currencySymbol : '');

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

  // Filtered Currencies for Picker
  const filteredCurrencies = useMemo(() => {
    const q = currencySearch.trim().toLowerCase();
    if (!q) return PRESET_CURRENCIES;
    return PRESET_CURRENCIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q)
    );
  }, [currencySearch]);

  // Filtered Groups for Picker
  const filteredGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    if (!q) return userGroups;
    return userGroups.filter((g) => g.name.toLowerCase().includes(q));
  }, [userGroups, groupSearch]);

  const handleSelectCurrency = async (code: string) => {
    haptics.tap();
    await setCurrency(code);
    setShowCurrencyModal(false);
    setCurrencySearch('');
  };

  const handleApplyCustomSymbol = async () => {
    const trimmed = customSymbolInput.trim();
    if (!trimmed) {
      Alert.alert('Invalid Logo', 'Please enter a currency symbol or logo (e.g. Rs., kr, ₿).');
      return;
    }
    haptics.saveSuccess();
    await setCurrency('CUSTOM', trimmed);
    setShowCurrencyModal(false);
    setCurrencySearch('');
  };

  const handleToggleHaptics = async (val: boolean) => {
    await setHapticsEnabled(val);
    if (val) haptics.tick();
  };

  const handleSelectDefaultGroup = async (groupId: string | null) => {
    haptics.tap();
    await groupService.setDefaultGroupId(groupId);
    setDefaultGroupId(groupId);
    if (groupId) {
      const matched = userGroups.find((g) => g.id === groupId);
      setDefaultGroupName(matched ? matched.name : null);
    } else {
      setDefaultGroupName(null);
    }
    setShowGroupModal(false);
    setGroupSearch('');
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
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionOverline}>DISPLAY & THEMING</Text>
          <View style={styles.modularCard}>
            {/* Row 1: Appearance & Accent */}
            <TouchableOpacity
              style={[styles.settingRow, styles.settingRowBorder]}
              onPress={() => {
                haptics.tap();
                router.push('/settings/appearance');
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.rowGlyph, { backgroundColor: currentAccent.primaryMuted }]}>
                <Palette size={16} color={currentAccent.primary} />
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle}>Appearance & Accent</Text>
                <Text style={styles.rowSubtitle}>Visual themes & accent colors</Text>
              </View>
              <View style={styles.rowRight}>
                <View style={[styles.accentPill, { backgroundColor: currentAccent.primaryMuted }]}>
                  <View style={[styles.accentDot, { backgroundColor: currentAccent.primary }]} />
                  <Text style={[styles.accentPillText, { color: currentAccent.primary }]}>
                    {currentAccent.name}
                  </Text>
                </View>
                <ChevronRight size={15} color={THEME.colors.textMuted} />
              </View>
            </TouchableOpacity>

            {/* Row 2: Default Currency */}
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => {
                haptics.tap();
                setCustomSymbolInput(isCustom ? currencySymbol : '');
                setShowCurrencyModal(true);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.rowGlyph}>
                <Coins size={16} color={THEME.colors.primary} />
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle}>Default Currency</Text>
                <Text style={styles.rowSubtitle}>
                  {isCustom ? `Custom logo ("${currencySymbol}")` : `${currencyCode} · Display logo`}
                </Text>
              </View>
              <View style={styles.rowRight}>
                <View style={styles.currencyValuePill}>
                  <Text style={styles.currencyValueText}>
                    {currencySymbol} {isCustom ? 'Custom' : currencyCode}
                  </Text>
                </View>
                <ChevronRight size={15} color={THEME.colors.textMuted} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── SECTION 2: HARDWARE & INTERACTION ── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionOverline}>HARDWARE & INTERACTION</Text>
          <View style={styles.modularCard}>
            <View style={styles.settingRow}>
              <View style={styles.rowGlyph}>
                <Vibrate size={16} color={THEME.colors.primary} />
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle}>Haptic Feedback</Text>
                <Text style={styles.rowSubtitle}>Tactile hardware response on taps & actions</Text>
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

        {/* ── SECTION 3: WORKFLOW DEFAULTS ── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionOverline}>WORKFLOW DEFAULTS</Text>
          <View style={styles.modularCard}>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => {
                haptics.tap();
                setShowGroupModal(true);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.rowGlyph}>
                <Layers size={16} color={THEME.colors.primary} />
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle}>Default Circle</Text>
                <Text style={styles.rowSubtitle}>
                  {defaultGroupName ? `Pre-selects "${defaultGroupName}"` : 'Auto-pick most recent circle'}
                </Text>
              </View>
              <View style={styles.rowRight}>
                <View style={styles.groupValuePill}>
                  <Text style={styles.groupValueText} numberOfLines={1}>
                    {defaultGroupName || 'Auto (Recent)'}
                  </Text>
                </View>
                <ChevronRight size={15} color={THEME.colors.textMuted} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── SECTION 4: LIVE PREVIEW (OPEN EDITORIAL) ── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionOverline}>FORMATTING PREVIEW</Text>
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
        </View>
      </ScrollView>

      {/* ── POPUP PICKER 1: CURRENCY SELECTION BOTTOM SHEET ── */}
      <BottomSheetModal
        visible={showCurrencyModal}
        onClose={() => {
          setShowCurrencyModal(false);
          setCurrencySearch('');
        }}
        title="Select Currency"
        subtitle="Single-currency model · Changes display logo without converting values"
        maxHeight="86%"
      >
        {/* Compact Search Box */}
        <View style={styles.modalSearchBox}>
          <Search size={15} color={THEME.colors.textMuted} />
          <TextInput
            style={styles.modalSearchInput}
            placeholder="Search currency code or name..."
            placeholderTextColor={THEME.colors.textMuted}
            value={currencySearch}
            onChangeText={setCurrencySearch}
            autoCapitalize="none"
            multiline={false}
            numberOfLines={1}
          />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.modalList}>
          {/* Preset Currencies Ledger */}
          <View style={styles.modalLedger}>
            {filteredCurrencies.map((item, index) => {
              const isSelected = !isCustom && currencyCode === item.code;
              const isLast = index === filteredCurrencies.length - 1;

              return (
                <TouchableOpacity
                  key={item.code}
                  style={[styles.modalItemRow, !isLast && styles.modalItemBorder]}
                  onPress={() => handleSelectCurrency(item.code)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalFlag}>{item.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemTitle}>{item.name}</Text>
                    <Text style={styles.modalItemSub}>
                      {item.code} · {item.symbol}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={styles.modalCheckPill}>
                      <Check size={12} color={THEME.colors.primary} strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── CUSTOM CURRENCY OPTION AT BOTTOM ── */}
          <View style={styles.customOptionBlock}>
            <View style={styles.customOptionHeader}>
              <Sparkles size={14} color={THEME.colors.primary} />
              <Text style={styles.customOptionTitle}>CUSTOM CURRENCY LOGO</Text>
            </View>
            <Text style={styles.customOptionDesc}>
              Enter any sign, cryptocurrency, or fiat abbreviation (e.g. Rs., kr, Rp, ₿, CHF)
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
                  Active logo: "{currencySymbol}"
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </BottomSheetModal>

      {/* ── POPUP PICKER 2: DEFAULT CIRCLE BOTTOM SHEET ── */}
      <BottomSheetModal
        visible={showGroupModal}
        onClose={() => {
          setShowGroupModal(false);
          setGroupSearch('');
        }}
        title="Default Circle"
        subtitle="Choose which circle is automatically pre-selected when creating expenses"
        maxHeight="80%"
      >
        {userGroups.length > 5 && (
          <View style={styles.modalSearchBox}>
            <Search size={15} color={THEME.colors.textMuted} />
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search circles..."
              placeholderTextColor={THEME.colors.textMuted}
              value={groupSearch}
              onChangeText={setGroupSearch}
              autoCapitalize="none"
              multiline={false}
              numberOfLines={1}
            />
          </View>
        )}

        <ScrollView showsVerticalScrollIndicator={false} style={styles.modalList}>
          <View style={styles.modalLedger}>
            {/* Option 1: None / Auto */}
            <TouchableOpacity
              style={[styles.modalItemRow, styles.modalItemBorder]}
              onPress={() => handleSelectDefaultGroup(null)}
              activeOpacity={0.7}
            >
              <View style={styles.modalItemGlyph}>
                <RotateCcw size={15} color={THEME.colors.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalItemTitle}>None (Auto-pick most recent)</Text>
                <Text style={styles.modalItemSub}>
                  Uses whichever circle you last recorded an expense for
                </Text>
              </View>
              {!defaultGroupId && (
                <View style={styles.modalCheckPill}>
                  <Check size={12} color={THEME.colors.primary} strokeWidth={3} />
                </View>
              )}
            </TouchableOpacity>

            {/* User Circles */}
            {filteredGroups.map((grp, index) => {
              const isSelected = defaultGroupId === grp.id;
              const isLast = index === filteredGroups.length - 1;

              return (
                <TouchableOpacity
                  key={grp.id}
                  style={[styles.modalItemRow, !isLast && styles.modalItemBorder]}
                  onPress={() => handleSelectDefaultGroup(grp.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.modalItemAvatar}>
                    {grp.coverImageUrl ? (
                      <Image source={{ uri: grp.coverImageUrl }} style={styles.avatarImg} />
                    ) : (
                      <Text style={styles.avatarInitial}>{grp.name.charAt(0)}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemTitle} numberOfLines={1}>
                      {grp.name}
                    </Text>
                    <Text style={styles.modalItemSub}>
                      {grp.membersCount || 1} {grp.membersCount === 1 ? 'member' : 'members'}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={styles.modalCheckPill}>
                      <Check size={12} color={THEME.colors.primary} strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </BottomSheetModal>
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
  sectionBlock: {
    gap: 8,
  },
  sectionOverline: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
    paddingHorizontal: 2,
  },
  modularCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  settingRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  rowGlyph: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
    letterSpacing: -0.2,
  },
  rowSubtitle: {
    fontSize: 11.5,
    fontWeight: '500',
    color: THEME.colors.textMuted,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  currencyValuePill: {
    backgroundColor: THEME.colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  currencyValueText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  groupValuePill: {
    backgroundColor: THEME.colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    maxWidth: 120,
  },
  groupValueText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  previewBanner: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
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
    paddingVertical: 12,
    paddingHorizontal: 12,
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
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text,
    padding: 0,
  },
  modalList: {
    paddingHorizontal: 16,
  },
  modalLedger: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    overflow: 'hidden',
  },
  modalItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  modalItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  modalFlag: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  modalItemGlyph: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalItemAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  modalItemTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  modalItemSub: {
    fontSize: 11.5,
    fontWeight: '500',
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  modalCheckPill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME.colors.primaryLight + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customOptionBlock: {
    marginTop: 16,
    marginBottom: 24,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    padding: 14,
    gap: 8,
  },
  customOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customOptionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.primary,
    letterSpacing: 0.6,
  },
  customOptionDesc: {
    fontSize: 11.5,
    fontWeight: '500',
    color: THEME.colors.textMuted,
    lineHeight: 16,
  },
  customInputRow: {
    flexDirection: 'row',
    gap: 8,
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
    fontWeight: '700',
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
    fontWeight: '800',
    color: THEME.colors.primaryForeground,
  },
  customActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  customActiveText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: THEME.colors.success,
  },
});
