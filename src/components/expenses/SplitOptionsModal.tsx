import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Check, AlertCircle, Sparkles, Plus, Minus, MoveHorizontal } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { calculateSplitAmounts, validateSplit, SplitType } from '@splitit/core';
import * as Haptics from 'expo-haptics';

export interface SplitParticipantItem {
  id: string;
  name: string;
  avatarUrl?: string;
  selected: boolean;
  shares?: number;
  percentage?: number;
  exactAmount?: number;
}

interface SplitOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  totalAmount: number;
  currentUserId?: string;
  initialSplitType?: 'equally' | 'unequally' | 'by_shares' | 'by_percentage' | 'shares' | 'percentage';
  participants: SplitParticipantItem[];
  onConfirm: (result: {
    splitType: 'equally' | 'unequally' | 'by_shares' | 'by_percentage';
    participants: SplitParticipantItem[];
    splitBreakdown: Record<string, number>;
  }) => void;
}

const MODES: Array<{ type: SplitType; label: string; symbol: string; hint: string }> = [
  { type: 'equally', label: 'Equally', symbol: '=', hint: 'Evenly split across all selected members' },
  { type: 'unequally', label: 'Exact', symbol: '1.23', hint: 'Specify exact amounts for each member' },
  { type: 'by_percentage', label: 'Percent', symbol: '%', hint: 'Allocate precise percentage shares (max 2 decimals)' },
  { type: 'by_shares', label: 'Shares', symbol: '+/-', hint: 'Split by weighted shares (e.g., 2 shares, 1 share)' },
];

export function SplitOptionsModal({
  visible,
  onClose,
  totalAmount,
  currentUserId,
  initialSplitType = 'equally',
  participants: initialParticipants,
  onConfirm,
}: SplitOptionsModalProps) {
  const { width } = useWindowDimensions();
  const horizontalScrollRef = useRef<ScrollView>(null);

  // Normalize legacy 'shares' / 'percentage' to 'by_shares' / 'by_percentage'
  const normalizedInitialType: SplitType =
    initialSplitType === 'shares'
      ? 'by_shares'
      : initialSplitType === 'percentage'
      ? 'by_percentage'
      : (initialSplitType as SplitType) || 'equally';

  const [splitType, setSplitType] = useState<SplitType>(normalizedInitialType);
  const [items, setItems] = useState<SplitParticipantItem[]>([]);
  const [exactInputs, setExactInputs] = useState<Record<string, string>>({});
  const [percentageInputs, setPercentageInputs] = useState<Record<string, string>>({});
  const [sharesInputs, setSharesInputs] = useState<Record<string, number>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize modal state on open
  useEffect(() => {
    if (visible) {
      setSplitType(normalizedInitialType);
      setErrorMessage(null);

      const cloned = initialParticipants.map((p) => ({
        ...p,
        selected: p.selected !== undefined ? p.selected : true,
        shares: p.shares && p.shares > 0 ? p.shares : 1,
        percentage: p.percentage || 0,
        exactAmount: p.exactAmount || 0,
      }));
      setItems(cloned);

      const exactMap: Record<string, string> = {};
      const pctMap: Record<string, string> = {};
      const sharesMap: Record<string, number> = {};

      const selectedCount = Math.max(1, cloned.filter((p) => p.selected).length);
      const defaultEqualShare = totalAmount / selectedCount;
      const defaultEqualPct = 100 / selectedCount;

      cloned.forEach((p) => {
        exactMap[p.id] = p.exactAmount ? String(p.exactAmount) : p.selected ? defaultEqualShare.toFixed(2) : '0';
        pctMap[p.id] = p.percentage ? String(p.percentage) : p.selected ? defaultEqualPct.toFixed(2) : '0';
        sharesMap[p.id] = p.shares && p.shares > 0 ? p.shares : 1;
      });

      setExactInputs(exactMap);
      setPercentageInputs(pctMap);
      setSharesInputs(sharesMap);

      // Scroll to initial page
      const initialIdx = MODES.findIndex((m) => m.type === normalizedInitialType);
      if (initialIdx >= 0) {
        setTimeout(() => {
          horizontalScrollRef.current?.scrollTo({ x: initialIdx * width, animated: false });
        }, 60);
      }
    }
  }, [visible, initialSplitType, initialParticipants, totalAmount, width]);

  const selectedCount = useMemo(() => items.filter((p) => p.selected).length, [items]);

  // Real-time calculation of owed amounts per participant via @splitit/core
  const splitBreakdown = useMemo<Record<string, number>>(() => {
    if (totalAmount <= 0 || selectedCount === 0) {
      return Object.fromEntries(items.map((p) => [p.id, 0]));
    }

    try {
      const inputs = items.map((p) => ({
        userId: p.id,
        selected: p.selected,
        shares: sharesInputs[p.id] || 1,
        percentage: parseFloat(percentageInputs[p.id] || '0') || 0,
        amountOwed: parseFloat(exactInputs[p.id] || '0') || 0,
      }));

      const results = calculateSplitAmounts(totalAmount, inputs, splitType);
      const breakdown: Record<string, number> = {};
      results.forEach((r) => {
        breakdown[r.userId] = r.amountOwed;
      });
      return breakdown;
    } catch {
      return {};
    }
  }, [totalAmount, selectedCount, items, splitType, sharesInputs, percentageInputs, exactInputs]);

  // Mode-specific sums and balances
  const exactSum = useMemo(() => {
    return items
      .filter((p) => p.selected)
      .reduce((sum, p) => sum + (parseFloat(exactInputs[p.id] || '0') || 0), 0);
  }, [items, exactInputs]);

  const exactRemaining = useMemo(() => {
    return parseFloat((totalAmount - exactSum).toFixed(2));
  }, [totalAmount, exactSum]);

  const percentageSum = useMemo(() => {
    return items
      .filter((p) => p.selected)
      .reduce((sum, p) => sum + (parseFloat(percentageInputs[p.id] || '0') || 0), 0);
  }, [items, percentageInputs]);

  const percentageRemaining = useMemo(() => {
    return parseFloat((100 - percentageSum).toFixed(2));
  }, [percentageSum]);

  const totalShares = useMemo(() => {
    return items
      .filter((p) => p.selected)
      .reduce((sum, p) => sum + (sharesInputs[p.id] || 0), 0);
  }, [items, sharesInputs]);

  const isModeBalanced = useMemo(() => {
    if (selectedCount === 0) return false;
    if (splitType === 'equally') return true;
    if (splitType === 'unequally') return Math.abs(exactRemaining) <= 0.01;
    if (splitType === 'by_percentage') return Math.abs(percentageRemaining) <= 0.01;
    if (splitType === 'by_shares') return totalShares > 0;
    return true;
  }, [selectedCount, splitType, exactRemaining, percentageRemaining, totalShares]);

  const toggleSelectMember = (id: string) => {
    Haptics.selectionAsync();
    setItems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p))
    );
    setErrorMessage(null);
  };

  const handleSelectAll = (select: boolean) => {
    Haptics.selectionAsync();
    setItems((prev) => prev.map((p) => ({ ...p, selected: select })));
    setErrorMessage(null);
  };

  const handleResetToEqual = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const n = Math.max(1, selectedCount);
    const equalShare = totalAmount / n;
    const equalPct = 100 / n;

    const newExact: Record<string, string> = {};
    const newPct: Record<string, string> = {};
    const newShares: Record<string, number> = {};

    items.forEach((p) => {
      newExact[p.id] = p.selected ? equalShare.toFixed(2) : '0';
      newPct[p.id] = p.selected ? equalPct.toFixed(2) : '0';
      newShares[p.id] = 1;
    });

    setExactInputs(newExact);
    setPercentageInputs(newPct);
    setSharesInputs(newShares);
    setErrorMessage(null);
  };

  const handleTabPress = (type: SplitType) => {
    Haptics.selectionAsync();
    setSplitType(type);
    setErrorMessage(null);
    const idx = MODES.findIndex((m) => m.type === type);
    if (idx >= 0) {
      horizontalScrollRef.current?.scrollTo({ x: idx * width, animated: true });
    }
  };

  const handleHorizontalScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(offsetX / width);
    if (pageIndex >= 0 && pageIndex < MODES.length) {
      const targetMode = MODES[pageIndex].type;
      if (targetMode !== splitType) {
        Haptics.selectionAsync();
        setSplitType(targetMode);
        setErrorMessage(null);
      }
    }
  };

  // Strict .2f percentage input handler
  const handlePercentageChange = (id: string, text: string) => {
    setErrorMessage(null);
    let cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    // Limit to max 2 decimal places
    if (parts.length === 2 && parts[1].length > 2) {
      cleaned = `${parts[0]}.${parts[1].slice(0, 2)}`;
    }
    // Limit to 100%
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num > 100) {
      cleaned = '100';
    }
    setPercentageInputs((prev) => ({ ...prev, [id]: cleaned }));
  };

  // Strict .2f exact input handler
  const handleExactChange = (id: string, text: string) => {
    setErrorMessage(null);
    let cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    if (parts.length === 2 && parts[1].length > 2) {
      cleaned = `${parts[0]}.${parts[1].slice(0, 2)}`;
    }
    setExactInputs((prev) => ({ ...prev, [id]: cleaned }));
  };

  const handleConfirm = () => {
    if (selectedCount === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage('Select at least one member to split with.');
      return;
    }

    const validation = validateSplit({
      totalAmount,
      splitType,
      participants: items.map((p) => ({
        userId: p.id,
        selected: p.selected,
        shares: sharesInputs[p.id] || 1,
        percentage: parseFloat(percentageInputs[p.id] || '0') || 0,
        amountOwed: parseFloat(exactInputs[p.id] || '0') || 0,
      })),
    });

    if (validation) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (validation.field === 'participants') {
        if (validation.kind === 'amounts') {
          setErrorMessage(
            `Sum of amounts (₹${validation.totalOwed.toFixed(2)}) must equal ₹${validation.totalAmount.toFixed(2)}.`
          );
        } else if (validation.kind === 'percentage') {
          setErrorMessage(
            `Sum of percentages (${validation.totalPercentage.toFixed(2)}%) must equal 100%.`
          );
        }
      }
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const updatedParticipants = items.map((p) => ({
      ...p,
      shares: sharesInputs[p.id] || 1,
      percentage: parseFloat(percentageInputs[p.id] || '0') || 0,
      exactAmount: splitBreakdown[p.id] || 0,
    }));

    onConfirm({
      splitType,
      participants: updatedParticipants,
      splitBreakdown,
    });
    onClose();
  };

  // Render rows for a specific split mode
  const renderParticipantRows = (mode: SplitType) => {
    const perShareAmount = totalShares > 0 ? totalAmount / totalShares : 0;
    const equalShare = selectedCount > 0 ? totalAmount / selectedCount : 0;

    return items.map((p) => {
      const isSelected = p.selected;
      const isCurrentUser = currentUserId === p.id;
      const currentOwed = splitBreakdown[p.id] || 0;

      // Mode-specific live calculations
      const userPct = parseFloat(percentageInputs[p.id] || '0') || 0;
      const livePctPrice = (totalAmount * userPct) / 100;

      const userShares = sharesInputs[p.id] || 1;
      const liveSharePrice = userShares * perShareAmount;
      const liveSharePct = totalShares > 0 ? ((userShares / totalShares) * 100).toFixed(1) : '0';

      const userExact = parseFloat(exactInputs[p.id] || '0') || 0;
      const liveExactPct = totalAmount > 0 ? ((userExact / totalAmount) * 100).toFixed(1) : '0';

      return (
        <View
          key={p.id}
          style={[styles.participantRow, !isSelected && styles.participantRowUnselected]}
        >
          {/* Checkbox */}
          <TouchableOpacity
            style={[styles.checkbox, isSelected && styles.checkboxActive]}
            onPress={() => toggleSelectMember(p.id)}
            activeOpacity={0.7}
          >
            {isSelected && <Check size={12} color="#000000" strokeWidth={3} />}
          </TouchableOpacity>

          {/* Avatar */}
          <View style={styles.avatarWrap}>
            {p.avatarUrl ? (
              <Image source={{ uri: p.avatarUrl }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{p.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>

          {/* Member Details & Live Subtext */}
          <View style={styles.memberInfo}>
            <Text style={[styles.memberName, !isSelected && styles.textMuted]} numberOfLines={1}>
              {p.name}
              {isCurrentUser ? ' (You)' : ''}
            </Text>

            {isSelected ? (
              mode === 'equally' ? (
                <Text style={styles.calculatedShareText}>
                  Equal share • ₹{equalShare.toFixed(2)}
                </Text>
              ) : mode === 'unequally' ? (
                <Text style={styles.calculatedShareText}>
                  {liveExactPct}% of total
                </Text>
              ) : mode === 'by_percentage' ? (
                <Text style={styles.calculatedShareTextHighlight}>
                  = ₹{livePctPrice.toFixed(2)}
                </Text>
              ) : (
                <Text style={styles.calculatedShareTextHighlight}>
                  = ₹{liveSharePrice.toFixed(2)} ({liveSharePct}%)
                </Text>
              )
            ) : (
              <Text style={styles.excludedText}>Excluded from split</Text>
            )}
          </View>

          {/* Mode-Specific Input Controls */}
          {isSelected && (
            <View style={styles.inputControlWrap}>
              {/* EQUALLY: Read-only badge */}
              {mode === 'equally' && (
                <View style={styles.equalBadge}>
                  <Text style={styles.equalBadgeText}>₹{currentOwed.toFixed(2)}</Text>
                </View>
              )}

              {/* UNEQUALLY: Exact Amount Input (.2f) */}
              {mode === 'unequally' && (
                <View style={styles.amountInputBox}>
                  <Text style={styles.inputPrefix}>₹</Text>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="0.00"
                    placeholderTextColor={THEME.colors.textMuted}
                    keyboardType="decimal-pad"
                    value={exactInputs[p.id] || ''}
                    onChangeText={(text) => handleExactChange(p.id, text)}
                  />
                </View>
              )}

              {/* BY PERCENTAGE: % Input (.2f limit) */}
              {mode === 'by_percentage' && (
                <View style={styles.amountInputBox}>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="0.00"
                    placeholderTextColor={THEME.colors.textMuted}
                    keyboardType="decimal-pad"
                    value={percentageInputs[p.id] || ''}
                    onChangeText={(text) => handlePercentageChange(p.id, text)}
                  />
                  <Text style={styles.inputSuffix}>%</Text>
                </View>
              )}

              {/* BY SHARES: Stepper (- / +) */}
              {mode === 'by_shares' && (
                <View style={styles.stepperContainer}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => {
                      Haptics.selectionAsync();
                      const currentVal = sharesInputs[p.id] || 1;
                      const newVal = Math.max(1, currentVal - 1);
                      setSharesInputs((prev) => ({ ...prev, [p.id]: newVal }));
                    }}
                  >
                    <Minus size={13} color={THEME.colors.text} />
                  </TouchableOpacity>

                  <Text style={styles.stepperValue}>
                    {sharesInputs[p.id] || 1}
                  </Text>

                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => {
                      Haptics.selectionAsync();
                      const currentVal = sharesInputs[p.id] || 1;
                      setSharesInputs((prev) => ({ ...prev, [p.id]: currentVal + 1 }));
                    }}
                  >
                    <Plus size={13} color={THEME.colors.text} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      );
    });
  };

  const activeModeInfo = MODES.find((m) => m.type === splitType) || MODES[0];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.fullScreen} edges={['top', 'bottom', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Top Header Bar */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Split options</Text>
              <Text style={styles.subtitle}>
                Total expense: <Text style={styles.boldText}>₹{totalAmount.toFixed(2)}</Text>
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={18} color={THEME.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* 4-Segmented Split Mode Bar */}
          <View style={styles.modeTabs}>
            {MODES.map((mode) => {
              const isActive = splitType === mode.type;
              return (
                <TouchableOpacity
                  key={mode.type}
                  style={[styles.modeTab, isActive && styles.modeTabActive]}
                  onPress={() => handleTabPress(mode.type)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.modeTabSymbol, isActive && styles.modeTabSymbolActive]}>
                    {mode.symbol}
                  </Text>
                  <Text style={[styles.modeTabText, isActive && styles.modeTabTextActive]}>
                    {mode.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Mode Hint & Swipe Indicator Strip */}
          <View style={styles.hintStrip}>
            <Text style={styles.hintText}>{activeModeInfo.hint}</Text>
            <View style={styles.swipeHintWrap}>
              <MoveHorizontal size={12} color={THEME.colors.textMuted} />
              <Text style={styles.swipeHintText}>Swipe page</Text>
            </View>
          </View>

          {/* Quick Helper Toolbar */}
          <View style={styles.helperRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity
                onPress={() => handleSelectAll(selectedCount < items.length)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={styles.helperActionText}>
                  {selectedCount < items.length ? 'Select all' : 'Deselect all'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.helperCountText}>
                ({selectedCount} of {items.length} included)
              </Text>
            </View>

            {splitType !== 'equally' && (
              <TouchableOpacity
                style={styles.resetChip}
                onPress={handleResetToEqual}
                activeOpacity={0.7}
              >
                <Sparkles size={11} color={THEME.colors.primary} />
                <Text style={styles.resetChipText}>Reset to equal</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Horizontal Paging Screen for Split Modes */}
          <ScrollView
            ref={horizontalScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleHorizontalScrollEnd}
            style={styles.horizontalScroll}
          >
            {MODES.map((mode) => (
              <View key={mode.type} style={{ width, flex: 1 }}>
                <ScrollView
                  style={styles.verticalList}
                  contentContainerStyle={styles.verticalListContent}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  showsVerticalScrollIndicator={false}
                >
                  {renderParticipantRows(mode.type)}
                </ScrollView>
              </View>
            ))}
          </ScrollView>

          {/* Bottom Summary & Confirmation Dock (Always Visible) */}
          <View style={styles.bottomDock}>
            {errorMessage && (
              <View style={styles.errorBanner}>
                <AlertCircle size={14} color={THEME.colors.negative} />
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            )}

            <View style={styles.summaryRow}>
              {/* Left Column: Total or Shares */}
              <View>
                <Text style={styles.summaryLabel}>
                  {splitType === 'by_percentage'
                    ? 'TOTAL PERCENT'
                    : splitType === 'by_shares'
                    ? 'TOTAL SHARES'
                    : 'TOTAL SPLIT'}
                </Text>
                <Text style={styles.summaryAmount}>
                  {splitType === 'by_percentage'
                    ? `${percentageSum.toFixed(2)}%`
                    : splitType === 'by_shares'
                    ? `${totalShares} ${totalShares === 1 ? 'share' : 'shares'}`
                    : `₹${(splitType === 'unequally' ? exactSum : totalAmount).toFixed(2)}`}
                </Text>
              </View>

              {/* Right Column: Status */}
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.summaryLabel}>STATUS</Text>
                {splitType === 'equally' ? (
                  <View style={styles.statusBadgeGreen}>
                    <Check size={12} color={THEME.colors.primary} strokeWidth={3} />
                    <Text style={styles.statusTextGreen}>Split Equally</Text>
                  </View>
                ) : splitType === 'unequally' ? (
                  isModeBalanced ? (
                    <View style={styles.statusBadgeGreen}>
                      <Check size={12} color={THEME.colors.primary} strokeWidth={3} />
                      <Text style={styles.statusTextGreen}>Balanced</Text>
                    </View>
                  ) : (
                    <Text style={[styles.statusText, exactRemaining > 0 ? styles.textUnder : styles.textOver]}>
                      {exactRemaining > 0 ? `₹${exactRemaining.toFixed(2)} left` : `₹${Math.abs(exactRemaining).toFixed(2)} over`}
                    </Text>
                  )
                ) : splitType === 'by_percentage' ? (
                  isModeBalanced ? (
                    <View style={styles.statusBadgeGreen}>
                      <Check size={12} color={THEME.colors.primary} strokeWidth={3} />
                      <Text style={styles.statusTextGreen}>100% Allocated</Text>
                    </View>
                  ) : (
                    <Text style={[styles.statusText, percentageRemaining > 0 ? styles.textUnder : styles.textOver]}>
                      {percentageRemaining > 0 ? `${percentageRemaining.toFixed(2)}% left` : `${Math.abs(percentageRemaining).toFixed(2)}% over`}
                    </Text>
                  )
                ) : (
                  <View style={styles.statusBadgeGreen}>
                    <Check size={12} color={THEME.colors.primary} strokeWidth={3} />
                    <Text style={styles.statusTextGreen}>
                      {totalShares > 0 ? `₹${(totalAmount / totalShares).toFixed(2)}/share` : '0 shares'}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.confirmBtn, !isModeBalanced && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              activeOpacity={0.85}
            >
              <Check size={16} color="#000000" strokeWidth={2.5} />
              <Text style={styles.confirmBtnText}>
                {isModeBalanced ? `Confirm Split (₹${totalAmount.toFixed(2)})` : 'Balance Split to Confirm'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  boldText: {
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  modeTabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 6,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 3,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: THEME.radius.md,
  },
  modeTabActive: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  modeTabSymbol: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textMuted,
  },
  modeTabSymbolActive: {
    color: THEME.colors.primary,
  },
  modeTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  modeTabTextActive: {
    color: THEME.colors.text,
    fontWeight: '700',
  },
  hintStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  hintText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    flex: 1,
  },
  swipeHintWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    opacity: 0.6,
  },
  swipeHintText: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  helperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  helperActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  helperCountText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  resetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  resetChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.primary,
  },
  horizontalScroll: {
    flex: 1,
  },
  verticalList: {
    flex: 1,
  },
  verticalListContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 8,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.lg,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  participantRowUnselected: {
    opacity: 0.4,
    backgroundColor: 'transparent',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: THEME.colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.primary,
  },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#27272A',
    marginRight: 10,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surface,
  },
  avatarInitial: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  textMuted: {
    color: THEME.colors.textMuted,
  },
  calculatedShareText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  calculatedShareTextHighlight: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primary,
    marginTop: 2,
  },
  excludedText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  inputControlWrap: {
    marginLeft: 10,
  },
  equalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  equalBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  amountInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.background,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.hairlineLight,
    paddingHorizontal: 8,
    width: 100,
    height: 38,
  },
  inputPrefix: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginRight: 4,
  },
  inputSuffix: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.primary,
    marginLeft: 4,
  },
  amountInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
    paddingVertical: 0,
    textAlign: 'right',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.background,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.hairlineLight,
    height: 38,
    paddingHorizontal: 4,
    gap: 6,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.text,
    minWidth: 20,
    textAlign: 'center',
  },
  bottomDock: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: THEME.colors.surface,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
    gap: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.negativeMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
  },
  errorBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.negative,
    flex: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: THEME.colors.textMuted,
    marginBottom: 2,
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.colors.text,
  },
  statusBadgeGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  statusTextGreen: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
  },
  textUnder: {
    color: THEME.colors.warning,
  },
  textOver: {
    color: THEME.colors.negative,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    height: 48,
    borderRadius: THEME.radius.lg,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  confirmBtnDisabled: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    shadowOpacity: 0,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000000',
  },
});
