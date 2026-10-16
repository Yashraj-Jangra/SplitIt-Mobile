import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Check,
  RotateCcw,
  Sparkles,
  Palette,
  CreditCard,
  Plus,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { haptics } from '../../src/services/haptics.service';
import { useAppTheme, ACCENT_PRESETS } from '../../src/contexts/theme.context';
import { QuantumLogo } from '../../src/components/brand/QuantumLogo';
import { useCurrency } from '../../src/contexts/currency.context';

export default function AppearanceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activePresetId, currentAccent, presets, setAccentPreset, setCustomAccentColor, resetToDefault } = useAppTheme();
  const { currencySymbol } = useCurrency();

  const [hexInput, setHexInput] = useState('');

  const handleSelectPreset = async (id: string) => {
    haptics.tap();
    await setAccentPreset(id);
  };

  const handleApplyCustomHex = async () => {
    let clean = hexInput.trim();
    if (!clean.startsWith('#')) clean = `#${clean}`;
    if (!/^#[0-9A-Fa-f]{6}$/.test(clean)) {
      haptics.warning();
      Alert.alert('Invalid Hex Code', 'Please enter a valid 6-character hex color (e.g. #00E5FF or #FF6B6B).');
      return;
    }
    await setCustomAccentColor(clean);
    setHexInput('');
    Alert.alert('Accent Color Applied', `Custom accent color ${clean.toUpperCase()} is now active.`);
  };

  const handleReset = async () => {
    haptics.tap();
    await resetToDefault();
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
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <ArrowLeft size={20} color={THEME.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Appearance</Text>
        <TouchableOpacity
          onPress={handleReset}
          style={styles.resetHeaderBtn}
          accessibilityLabel="Reset to default"
          accessibilityRole="button"
        >
          <RotateCcw size={16} color={THEME.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── ATMOSPHERIC HERO PREVIEW (No-Div Open Editorial) ── */}
        <View style={styles.heroSection}>
          <View style={styles.logoAtmosphereWrap}>
            <View
              style={[
                styles.ambientGlow,
                { backgroundColor: currentAccent.primary, opacity: 0.15 },
              ]}
            />
            <QuantumLogo size={64} color={currentAccent.primary} />
          </View>

          <Text style={styles.heroTitle}>{currentAccent.name}</Text>
          <Text style={styles.heroSubtitle}>
            {currentAccent.description}
          </Text>

          {/* Interactive Live UI Preview Strip */}
          <View style={styles.previewStrip}>
            {/* Mock Pill */}
            <View style={[styles.previewPill, { backgroundColor: currentAccent.primaryMuted, borderColor: currentAccent.borderFocus }]}>
              <View style={[styles.previewPillDot, { backgroundColor: currentAccent.primary }]} />
              <Text style={[styles.previewPillText, { color: currentAccent.primary }]}>
                {currentAccent.tag}
              </Text>
            </View>

            {/* Mock Amount */}
            <View style={styles.previewAmountRow}>
              <Text style={[styles.previewCurrency, { color: currentAccent.primary }]}>{currencySymbol}</Text>
              <Text style={styles.previewAmountNumber}>14,250</Text>
              <Text style={styles.previewAmountCents}>.00</Text>
            </View>

            {/* Mock Action Button */}
            <View style={[styles.previewActionButton, { backgroundColor: currentAccent.primary }]}>
              <Plus size={14} color="#09090B" strokeWidth={2.5} />
              <Text style={styles.previewActionText}>Split Bill</Text>
            </View>
          </View>
        </View>

        {/* ── CONTINUOUS TIMELINE DIVIDER ── */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerHairline} />
          <Text style={styles.dividerLabel}>CURATED PALETTES</Text>
          <View style={styles.dividerHairline} />
        </View>

        {/* ── OPEN EDITORIAL PRESET LEDGER (No Div / Anti Card Soup) ── */}
        <View style={styles.presetList}>
          {presets.map((preset, index) => {
            const isSelected = activePresetId === preset.id;
            const isLast = index === presets.length - 1;

            return (
              <TouchableOpacity
                key={preset.id}
                style={[
                  styles.presetRow,
                  !isLast && styles.presetRowBorder,
                  isSelected && styles.presetRowActive,
                ]}
                onPress={() => handleSelectPreset(preset.id)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Select ${preset.name} accent`}
              >
                {/* Visual Color Node Swatch */}
                <View style={styles.swatchContainer}>
                  <View
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: preset.primary },
                      isSelected && {
                        borderColor: preset.primary,
                        borderWidth: 3,
                        shadowColor: preset.primary,
                        shadowOpacity: 0.6,
                        shadowRadius: 8,
                        elevation: 4,
                      },
                    ]}
                  >
                    {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                  </View>
                </View>

                {/* Preset Details */}
                <View style={styles.presetInfo}>
                  <View style={styles.presetNameRow}>
                    <Text style={[styles.presetName, isSelected && { color: preset.primary }]}>
                      {preset.name}
                    </Text>
                    <View style={[styles.tagPill, isSelected && { backgroundColor: preset.primaryMuted }]}>
                      <Text style={[styles.tagText, isSelected && { color: preset.primary }]}>
                        {preset.tag}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.presetDescription} numberOfLines={2}>
                    {preset.description}
                  </Text>
                </View>

                {/* Right Selection Indicator */}
                <View style={styles.selectionIndicator}>
                  {isSelected ? (
                    <View style={[styles.activeRadio, { borderColor: preset.primary }]}>
                      <View style={[styles.activeRadioInner, { backgroundColor: preset.primary }]} />
                    </View>
                  ) : (
                    <View style={styles.inactiveRadio} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── CUSTOM HEX COLOR INPUT (Open Editorial Row) ── */}
        <View style={styles.customSection}>
          <View style={styles.customHeaderRow}>
            <Palette size={16} color={THEME.colors.textSecondary} />
            <Text style={styles.customSectionTitle}>CUSTOM HEX ACCENT</Text>
          </View>
          <Text style={styles.customSubtitle}>
            Fine-tune SplitIt with any 6-digit hex color code to personalize your dark workspace.
          </Text>

          <View style={styles.customInputRow}>
            <View style={styles.hexInputWrap}>
              <Text style={styles.hashPrefix}>#</Text>
              <TextInput
                style={styles.hexInput}
                value={hexInput.replace('#', '')}
                onChangeText={(text) => setHexInput(text.toUpperCase())}
                placeholder="00E5FF"
                placeholderTextColor={THEME.colors.textMuted}
                maxLength={6}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.applyButton,
                {
                  backgroundColor:
                    hexInput.replace('#', '').length === 6
                      ? currentAccent.primary
                      : THEME.colors.surfaceElevated,
                },
              ]}
              onPress={handleApplyCustomHex}
              disabled={hexInput.replace('#', '').length !== 6}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.applyButtonText,
                  hexInput.replace('#', '').length === 6 && { color: '#09090B' },
                ]}
              >
                Apply
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── FOOTER NOTE ── */}
        <View style={styles.footerNoteWrap}>
          <Sparkles size={14} color={THEME.colors.textMuted} />
          <Text style={styles.footerNoteText}>
            Accent changes apply instantaneously across headers, balances, buttons, and native navigation.
          </Text>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.colors.hairline,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: THEME.typography.size.title,
    fontWeight: THEME.typography.weight.bold,
    color: THEME.colors.text,
    letterSpacing: -0.3,
  },
  resetHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // Hero Atmospheric Preview
  heroSection: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 10,
  },
  logoAtmosphereWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  ambientGlow: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: THEME.typography.weight.bold,
    color: THEME.colors.text,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: THEME.typography.size.caption,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
    marginBottom: 20,
  },

  // Live UI Preview Strip
  previewStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    flexWrap: 'wrap',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  previewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  previewPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  previewPillText: {
    fontSize: 11,
    fontWeight: THEME.typography.weight.semibold,
  },
  previewAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  previewCurrency: {
    fontSize: 14,
    fontWeight: THEME.typography.weight.bold,
    marginRight: 2,
  },
  previewAmountNumber: {
    fontSize: 18,
    fontWeight: THEME.typography.weight.bold,
    color: THEME.colors.text,
    letterSpacing: -0.5,
  },
  previewAmountCents: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    fontWeight: THEME.typography.weight.medium,
  },
  previewActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  previewActionText: {
    fontSize: 12,
    fontWeight: THEME.typography.weight.bold,
    color: '#09090B',
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 12,
  },
  dividerHairline: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: THEME.colors.hairline,
  },
  dividerLabel: {
    fontSize: 11,
    fontWeight: THEME.typography.weight.bold,
    color: THEME.colors.textMuted,
    letterSpacing: 1.2,
  },

  // Open Editorial Presets List (No Div)
  presetList: {
    marginVertical: 4,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  presetRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.colors.hairline,
  },
  presetRowActive: {
    // Subtle open highlight
  },
  swatchContainer: {
    marginRight: 14,
  },
  colorSwatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetInfo: {
    flex: 1,
  },
  presetNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  presetName: {
    fontSize: THEME.typography.size.body,
    fontWeight: THEME.typography.weight.bold,
    color: THEME.colors.text,
    letterSpacing: -0.2,
  },
  tagPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: THEME.colors.surfacePill,
  },
  tagText: {
    fontSize: 10,
    fontWeight: THEME.typography.weight.medium,
    color: THEME.colors.textMuted,
  },
  presetDescription: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    lineHeight: 16,
  },
  selectionIndicator: {
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  inactiveRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: THEME.colors.borderSubtle,
  },

  // Custom Hex Section
  customSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.colors.hairline,
  },
  customHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  customSectionTitle: {
    fontSize: 11,
    fontWeight: THEME.typography.weight.bold,
    color: THEME.colors.textMuted,
    letterSpacing: 1.2,
  },
  customSubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginBottom: 14,
    lineHeight: 17,
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hexInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
  },
  hashPrefix: {
    fontSize: 16,
    fontWeight: THEME.typography.weight.bold,
    color: THEME.colors.textMuted,
    marginRight: 6,
  },
  hexInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: THEME.typography.weight.bold,
    color: THEME.colors.text,
    letterSpacing: 1,
  },
  applyButton: {
    paddingHorizontal: 20,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 13,
    fontWeight: THEME.typography.weight.bold,
    color: THEME.colors.textSecondary,
  },

  // Footer Note
  footerNoteWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 32,
    paddingHorizontal: 16,
  },
  footerNoteText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
});
