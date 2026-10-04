import React, { useState, useEffect, useMemo } from 'react';
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
} from 'react-native';
import { X, Check, AlertCircle, Sparkles, Plus, Minus } from 'lucide-react-native';
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

export function SplitOptionsModal({
  visible,
  onClose,
  totalAmount,
  currentUserId,
  initialSplitType = 'equally',
  participants: initialParticipants,
  onConfirm,
}: SplitOptionsModalProps) {
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
        exactMap[p.id] = p.exactAmount ? String(p.exactAmount) : p.selected ? String(defaultEqualShare.toFixed(2)) : '0';
        pctMap[p.id] = p.percentage ? String(p.percentage) : p.selected ? String(defaultEqualPct.toFixed(2)) : '0';
        sharesMap[p.id] = p.shares && p.shares > 0 ? p.shares : 1;
      });

      setExactInputs(exactMap);
      setPercentageInputs(pctMap);
      setSharesInputs(sharesMap);
    }
  }, [visible, initialSplitType, initialParticipants, totalAmount]);

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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.sheetHandle} />
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Choose split options</Text>
              <Text style={styles.subtitle}>
                Total amount: <Text style={styles.boldText}>₹{totalAmount.toFixed(2)}</Text>
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={18} color={THEME.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* 4-Segmented Split Mode Bar */}
          <View style={styles.modeTabs}>
            <TouchableOpacity
              style={[styles.modeTab, splitType === 'equally' && styles.modeTabActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setSplitType('equally');
                setErrorMessage(null);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.modeTabSymbol, splitType === 'equally' && styles.modeTabSymbolActive]}>=</Text>
              <Text style={[styles.modeTabText, splitType === 'equally' && styles.modeTabTextActive]}>Equally</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeTab, splitType === 'unequally' && styles.modeTabActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setSplitType('unequally');
                setErrorMessage(null);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.modeTabSymbol, splitType === 'unequally' && styles.modeTabSymbolActive]}>1.23</Text>
              <Text style={[styles.modeTabText, splitType === 'unequally' && styles.modeTabTextActive]}>Exact</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeTab, splitType === 'by_percentage' && styles.modeTabActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setSplitType('by_percentage');
                setErrorMessage(null);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.modeTabSymbol, splitType === 'by_percentage' && styles.modeTabSymbolActive]}>%</Text>
              <Text style={[styles.modeTabText, splitType === 'by_percentage' && styles.modeTabTextActive]}>Percent</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeTab, splitType === 'by_shares' && styles.modeTabActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setSplitType('by_shares');
                setErrorMessage(null);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.modeTabSymbol, splitType === 'by_shares' && styles.modeTabSymbolActive]}>+/-</Text>
              <Text style={[styles.modeTabText, splitType === 'by_shares' && styles.modeTabTextActive]}>Shares</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Helper Toolbar */}
          <View style={styles.helperRow}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
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

          {/* Participant Rows */}
          <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
            {items.map((p) => {
              const isSelected = p.selected;
              const isCurrentUser = currentUserId === p.id;
              const currentOwed = splitBreakdown[p.id] || 0;

              return (
                <View
                  key={p.id}
                  style={[styles.participantRow, !isSelected && styles.participantRowUnselected]}
                >
                  {/* Inclusion Checkbox */}
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

                  {/* Name */}
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, !isSelected && styles.textMuted]} numberOfLines={1}>
                      {p.name}
                      {isCurrentUser ? ' (You)' : ''}
                    </Text>
                    {isSelected && splitType !== 'equally' && (
                      <Text style={styles.calculatedShareText}>
                        Owes ₹{currentOwed.toFixed(2)}
                      </Text>
                    )}
                  </View>

                  {/* MODE-SPECIFIC INPUT CONTROLS */}
                  {isSelected && (
                    <View style={styles.inputControlWrap}>
                      {/* EQUALLY: Read-only badge */}
                      {splitType === 'equally' && (
                        <View style={styles.equalBadge}>
                          <Text style={styles.equalBadgeText}>₹{currentOwed.toFixed(2)}</Text>
                        </View>
                      )}

                      {/* UNEQUALLY: Exact Amount Input */}
                      {splitType === 'unequally' && (
                        <View style={styles.amountInputBox}>
                          <Text style={styles.inputPrefix}>₹</Text>
                          <TextInput
                            style={styles.amountInput}
                            placeholder="0.00"
                            placeholderTextColor={THEME.colors.textMuted}
                            keyboardType="decimal-pad"
                            value={exactInputs[p.id] || ''}
                            onChangeText={(text) => {
                              setErrorMessage(null);
                              const cleaned = text.replace(/[^0-9.]/g, '');
                              setExactInputs((prev) => ({ ...prev, [p.id]: cleaned }));
                            }}
                          />
                        </View>
                      )}

                      {/* BY PERCENTAGE: % Input */}
                      {splitType === 'by_percentage' && (
                        <View style={styles.amountInputBox}>
                          <TextInput
                            style={styles.amountInput}
                            placeholder="0"
                            placeholderTextColor={THEME.colors.textMuted}
                            keyboardType="decimal-pad"
                            value={percentageInputs[p.id] || ''}
                            onChangeText={(text) => {
                              setErrorMessage(null);
                              const cleaned = text.replace(/[^0-9.]/g, '');
                              setPercentageInputs((prev) => ({ ...prev, [p.id]: cleaned }));
                            }}
                          />
                          <Text style={styles.inputSuffix}>%</Text>
                        </View>
                      )}

                      {/* BY SHARES: Stepper (- / +) and Share Count */}
                      {splitType === 'by_shares' && (
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
            })}
          </ScrollView>

          {/* Bottom Summary & Confirmation Dock */}
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
                  {splitType === 'by_percentage' ? 'TOTAL PERCENT' : splitType === 'by_shares' ? 'TOTAL SHARES' : 'TOTAL SPLIT'}
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
                    <Check size={12} color="#10B981" strokeWidth={3} />
                    <Text style={styles.statusTextGreen}>Split Equally</Text>
                  </View>
                ) : splitType === 'unequally' ? (
                  isModeBalanced ? (
                    <View style={styles.statusBadgeGreen}>
                      <Check size={12} color="#10B981" strokeWidth={3} />
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
                      <Check size={12} color="#10B981" strokeWidth={3} />
                      <Text style={styles.statusTextGreen}>100% Allocated</Text>
                    </View>
                  ) : (
                    <Text style={[styles.statusText, percentageRemaining > 0 ? styles.textUnder : styles.textOver]}>
                      {percentageRemaining > 0 ? `${percentageRemaining.toFixed(2)}% left` : `${Math.abs(percentageRemaining).toFixed(2)}% over`}
                    </Text>
                  )
                ) : (
                  <View style={styles.statusBadgeGreen}>
                    <Check size={12} color="#10B981" strokeWidth={3} />
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.3,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: THEME.colors.background,
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
    paddingVertical: 7,
    borderRadius: THEME.radius.md,
  },
  modeTabActive: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
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
  helperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  resetChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.colors.primary,
  },
  listContainer: {
    paddingHorizontal: 16,
    maxHeight: 330,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.lg,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    marginBottom: 8,
  },
  participantRowUnselected: {
    opacity: 0.45,
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
    backgroundColor: THEME.colors.surfaceElevated,
  },
  avatarInitial: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  memberInfo: {
    flex: 1,
    marginRight: 8,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  calculatedShareText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.primary,
    marginTop: 2,
  },
  textMuted: {
    color: THEME.colors.textMuted,
  },
  inputControlWrap: {
    alignItems: 'flex-end',
  },
  equalBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
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
    borderColor: THEME.colors.hairline,
    paddingHorizontal: 10,
    width: 104,
    height: 38,
  },
  inputPrefix: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    marginRight: 4,
  },
  inputSuffix: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    marginLeft: 4,
  },
  amountInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
    paddingVertical: 0,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.background,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    height: 38,
    paddingHorizontal: 4,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    width: 36,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  bottomDock: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: THEME.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  errorBannerText: {
    fontSize: 12,
    color: THEME.colors.negative,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
  },
  summaryAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.text,
    marginTop: 2,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  textUnder: {
    color: THEME.colors.negative,
  },
  textOver: {
    color: THEME.colors.negative,
  },
  statusBadgeGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  statusTextGreen: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10B981',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.radius.lg,
    height: 44,
  },
  confirmBtnDisabled: {
    opacity: 0.45,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
  },
});
