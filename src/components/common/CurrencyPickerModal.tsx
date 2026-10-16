import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Search, Check, Sparkles } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { PRESET_CURRENCIES } from '../../contexts/currency.context';
import { BottomSheetModal } from './BottomSheetModal';
import { haptics } from '../../services/haptics.service';

export interface CurrencyPickerModalProps {
  visible: boolean;
  onClose: () => void;
  currentCode: string;
  currentSymbol: string;
  isCustom?: boolean;
  onSelectCurrency: (code: string) => void | Promise<void>;
  onApplyCustomSymbol: (symbol: string) => void | Promise<void>;
}

export const CurrencyPickerModal: React.FC<CurrencyPickerModalProps> = ({
  visible,
  onClose,
  currentCode,
  currentSymbol,
  isCustom = false,
  onSelectCurrency,
  onApplyCustomSymbol,
}) => {
  const [search, setSearch] = useState('');
  const [customInput, setCustomInput] = useState(isCustom ? currentSymbol : '');

  const filteredCurrencies = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return PRESET_CURRENCIES;
    return PRESET_CURRENCIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q)
    );
  }, [search]);

  const handleSelect = async (code: string) => {
    haptics.tap();
    await onSelectCurrency(code);
    onClose();
    setSearch('');
  };

  const handleApplyCustom = async () => {
    const trimmed = customInput.trim();
    if (!trimmed) {
      Alert.alert('Invalid Logo', 'Please enter a currency symbol or logo (e.g. Rs., kr, ₿).');
      return;
    }
    haptics.saveSuccess();
    await onApplyCustomSymbol(trimmed);
    onClose();
    setSearch('');
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={() => {
        onClose();
        setSearch('');
      }}
      title="Select Currency"
      subtitle="Single-currency model · Changes display logo without converting values"
      maxHeight="86%"
    >
      {/* Search Input (Wide, direct on sheet canvas) */}
      <View style={styles.searchBox}>
        <Search size={15} color={THEME.colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search currency code or name..."
          placeholderTextColor={THEME.colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          multiline={false}
          numberOfLines={1}
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
        {/* Preset Currencies (Wide rows, No div box soup, matching group selector) */}
        {filteredCurrencies.map((item) => {
          const isSelected = !isCustom && currentCode === item.code;

          return (
            <TouchableOpacity
              key={item.code}
              style={[styles.row, isSelected && styles.rowActive]}
              onPress={() => handleSelect(item.code)}
              activeOpacity={0.7}
            >
              <Text style={styles.flag}>{item.flag}</Text>
              <View style={styles.infoCol}>
                <Text style={[styles.name, isSelected && styles.nameActive]}>
                  {item.name}
                </Text>
                <Text style={styles.code}>
                  {item.code} · {item.symbol}
                </Text>
              </View>
              {isSelected && (
                <Check size={18} color={THEME.colors.primary} strokeWidth={2.5} />
              )}
            </TouchableOpacity>
          );
        })}

        {/* ── CUSTOM CURRENCY SECTION AT BOTTOM (No-Div Open Editorial) ── */}
        <View style={styles.customSection}>
          <View style={styles.customHeader}>
            <Sparkles size={13} color={THEME.colors.primary} />
            <Text style={styles.customOverline}>CUSTOM CURRENCY LOGO</Text>
          </View>
          <Text style={styles.customDesc}>
            Enter any sign, cryptocurrency, or fiat abbreviation (e.g. Rs., kr, Rp, ₿, CHF)
          </Text>

          <View style={styles.customInputRow}>
            <TextInput
              style={styles.customTextInput}
              value={customInput}
              onChangeText={setCustomInput}
              placeholder="e.g. Rs., kr, ₿"
              placeholderTextColor={THEME.colors.textMuted}
              maxLength={8}
              autoCapitalize="none"
              numberOfLines={1}
              multiline={false}
            />
            <TouchableOpacity
              style={styles.customApplyBtn}
              onPress={handleApplyCustom}
              activeOpacity={0.8}
            >
              <Text style={styles.customApplyBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>

          {isCustom && (
            <View style={styles.activeBadge}>
              <Check size={12} color={THEME.colors.success} strokeWidth={2.5} />
              <Text style={styles.activeBadgeText}>
                Active logo: "{currentSymbol}"
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: THEME.colors.text,
    paddingVertical: 0,
  },
  listContent: {
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 12,
  },
  rowActive: {
    backgroundColor: THEME.colors.surfaceElevated,
  },
  flag: {
    fontSize: 22,
    width: 32,
    textAlign: 'center',
  },
  infoCol: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  nameActive: {
    color: THEME.colors.primary,
  },
  code: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  customSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
    paddingHorizontal: 4,
    gap: 8,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customOverline: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.primary,
    letterSpacing: 0.6,
  },
  customDesc: {
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
    height: 42,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  customApplyBtn: {
    height: 42,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customApplyBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.primaryForeground,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  activeBadgeText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: THEME.colors.success,
  },
});
