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
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Check, AlertCircle, Plus, Minus } from 'lucide-react-native';
import {
  calculateSplitAmounts,
  validateSplit,
  calculateEqualPercentages,
  calculateEqualAmounts,
  calculateSplitPercentages,
  calculateSharesPercentages,
  calculateAmountsPercentages,
  SplitType,
} from '@splitit/core';
import { THEME } from '../../constants/theme';
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
  payerId?: string;
  initialSplitType?: 'equally' | 'unequally' | 'by_shares' | 'by_percentage' | 'shares' | 'percentage';
  participants: SplitParticipantItem[];
  onConfirm: (result: {
    splitType: 'equally' | 'unequally' | 'by_shares' | 'by_percentage';
    participants: SplitParticipantItem[];
    splitBreakdown: Record<string, number>;
  }) => void;
}

const MODES: Array<{ type: SplitType; label: string; title: string; subtitle: string }> = [
  {
    type: 'equally',
    label: 'Equally',
    title: 'Split equally',
    subtitle: 'Select which people owe an equal share.',
  },
  {
    type: 'unequally',
    label: 'Unequally',
    title: 'Split by exact amounts',
    subtitle: 'Specify exactly how much each person owes.',
  },
  {
    type: 'by_percentage',
    label: 'By percentages',
    title: 'Split by percentages',
    subtitle: 'Enter percentage shares for each person.',
  },
  {
    type: 'by_shares',
    label: 'By shares',
    title: 'Split by shares',
    subtitle: 'Assign weighted shares to each member.',
  },
];

export function SplitOptionsModal({
  visible,
  onClose,
  totalAmount,
  currentUserId,
  payerId,
  initialSplitType = 'equally',
  participants: initialParticipants,
  onConfirm,
}: SplitOptionsModalProps) {
  const { width } = useWindowDimensions();
  const horizontalScrollRef = useRef<ScrollView>(null);

  // Normalize legacy 'shares' / 'percentage'
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

  const effectivePayerId = payerId || currentUserId;

  // Animated Underline Indicator
  const tabUnderlineAnim = useRef(new Animated.Value(0)).current;

  // Sync state on open
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

      const selectedMembers = cloned.filter((p) => p.selected);
      const selectedCount = Math.max(1, selectedMembers.length);
      const payerIdx = effectivePayerId ? selectedMembers.findIndex((p) => p.id === effectivePayerId) : -1;
      const preferredIdx = payerIdx >= 0 ? payerIdx : 0;
      const equalAmounts = calculateEqualAmounts(totalAmount, selectedCount, preferredIdx);
      const equalPercentages = calculateEqualPercentages(selectedCount, preferredIdx);

      let selIdx = 0;
      cloned.forEach((p) => {
        if (p.selected) {
          exactMap[p.id] = p.exactAmount ? String(Number(p.exactAmount).toFixed(2)) : String(equalAmounts[selIdx].toFixed(2));
          pctMap[p.id] = p.percentage ? String(Number(p.percentage).toFixed(2)) : String(equalPercentages[selIdx].toFixed(2));
          selIdx++;
        } else {
          exactMap[p.id] = '0.00';
          pctMap[p.id] = '0.00';
        }
        sharesMap[p.id] = p.shares && p.shares > 0 ? p.shares : 1;
      });

      setExactInputs(exactMap);
      setPercentageInputs(pctMap);
      setSharesInputs(sharesMap);

      const initialIdx = MODES.findIndex((m) => m.type === normalizedInitialType);
      const targetIdx = initialIdx >= 0 ? initialIdx : 0;

      tabUnderlineAnim.setValue(targetIdx);

      setTimeout(() => {
        horizontalScrollRef.current?.scrollTo({ x: targetIdx * width, animated: false });
      }, 50);
    }
  }, [visible, initialSplitType, initialParticipants, totalAmount, width, effectivePayerId]);

  const selectedCount = useMemo(() => items.filter((p) => p.selected).length, [items]);

  // Real-time calculation of owed amounts (with payer priority)
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

      const results = calculateSplitAmounts(totalAmount, inputs, splitType, effectivePayerId);
      const map: Record<string, number> = {};
      results.forEach((r) => {
        map[r.userId] = r.amountOwed;
      });
      return map;
    } catch {
      const sel = items.filter((p) => p.selected);
      const payerIdx = effectivePayerId ? sel.findIndex((p) => p.id === effectivePayerId) : -1;
      const preferredIdx = payerIdx >= 0 ? payerIdx : 0;
      const eq = calculateEqualAmounts(totalAmount, selectedCount, preferredIdx);
      let idx = 0;
      return Object.fromEntries(items.map((p) => [p.id, p.selected ? eq[idx++] : 0]));
    }
  }, [totalAmount, selectedCount, items, splitType, exactInputs, percentageInputs, sharesInputs, effectivePayerId]);

  // Real-time calculation of allocated percentages (all rounded and reconciled with 2 decimals, summing to 100.00% across all modes)
  const splitPercentages = useMemo<Record<string, number>>(() => {
    if (selectedCount === 0) {
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

      return calculateSplitPercentages(totalAmount, inputs, splitType, effectivePayerId);
    } catch {
      const sel = items.filter((p) => p.selected);
      const payerIdx = effectivePayerId ? sel.findIndex((p) => p.id === effectivePayerId) : -1;
      const preferredIdx = payerIdx >= 0 ? payerIdx : 0;
      const pcts = calculateEqualPercentages(selectedCount, preferredIdx);
      let idx = 0;
      return Object.fromEntries(items.map((p) => [p.id, p.selected ? pcts[idx++] : 0]));
    }
  }, [totalAmount, selectedCount, items, splitType, exactInputs, percentageInputs, sharesInputs, effectivePayerId]);

  // Total exact amounts sum
  const exactSum = useMemo(() => {
    return items.reduce((sum, p) => {
      if (!p.selected) return sum;
      const val = parseFloat(exactInputs[p.id] || '0');
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [items, exactInputs]);

  const exactRemaining = useMemo(() => {
    return parseFloat((totalAmount - exactSum).toFixed(2));
  }, [totalAmount, exactSum]);

  // Total percentages sum
  const percentageSum = useMemo(() => {
    return items.reduce((sum, p) => {
      if (!p.selected) return sum;
      const val = parseFloat(percentageInputs[p.id] || '0');
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [items, percentageInputs]);

  const percentageRemaining = useMemo(() => {
    return parseFloat((100 - percentageSum).toFixed(2));
  }, [percentageSum]);

  // Total shares sum
  const totalShares = useMemo(() => {
    return items.reduce((sum, p) => {
      if (!p.selected) return sum;
      return sum + (sharesInputs[p.id] || 1);
    }, 0);
  }, [items, sharesInputs]);

  // Balanced state indicator
  const isModeBalanced = useMemo(() => {
    if (selectedCount === 0) return false;
    if (splitType === 'equally') return true;
    if (splitType === 'unequally') return Math.abs(exactRemaining) < 0.005;
    if (splitType === 'by_percentage') return Math.abs(percentageRemaining) < 0.005;
    if (splitType === 'by_shares') return totalShares > 0;
    return true;
  }, [selectedCount, splitType, exactRemaining, percentageRemaining, totalShares]);

  const toggleSelectMember = (id: string) => {
    Haptics.selectionAsync();
    setItems((prev) => {
      const updated = prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p));
      const sel = updated.filter((p) => p.selected);
      const sCount = sel.length;
      if (sCount > 0) {
        const payerIdx = effectivePayerId ? sel.findIndex((p) => p.id === effectivePayerId) : -1;
        const preferredIdx = payerIdx >= 0 ? payerIdx : 0;
        const eqAmounts = calculateEqualAmounts(totalAmount, sCount, preferredIdx);
        const eqPcts = calculateEqualPercentages(sCount, preferredIdx);

        setExactInputs((oldExact) => {
          const next = { ...oldExact };
          let idx = 0;
          updated.forEach((p) => {
            next[p.id] = p.selected ? String(eqAmounts[idx++].toFixed(2)) : '0.00';
          });
          return next;
        });

        setPercentageInputs((oldPct) => {
          const next = { ...oldPct };
          let idx = 0;
          updated.forEach((p) => {
            next[p.id] = p.selected ? String(eqPcts[idx++].toFixed(2)) : '0.00';
          });
          return next;
        });
      } else {
        setExactInputs((oldExact) => {
          const next = { ...oldExact };
          updated.forEach((p) => {
            next[p.id] = '0.00';
          });
          return next;
        });
        setPercentageInputs((oldPct) => {
          const next = { ...oldPct };
          updated.forEach((p) => {
            next[p.id] = '0.00';
          });
          return next;
        });
      }
      return updated;
    });
    setErrorMessage(null);
  };

  const handleToggleAll = () => {
    Haptics.selectionAsync();
    const shouldSelectAll = selectedCount < items.length;
    setItems((prev) => {
      const updated = prev.map((p) => ({ ...p, selected: shouldSelectAll }));
      const sCount = shouldSelectAll ? updated.length : 0;
      if (sCount > 0) {
        const payerIdx = effectivePayerId ? updated.findIndex((p) => p.id === effectivePayerId) : -1;
        const preferredIdx = payerIdx >= 0 ? payerIdx : 0;
        const eqAmounts = calculateEqualAmounts(totalAmount, sCount, preferredIdx);
        const eqPcts = calculateEqualPercentages(sCount, preferredIdx);
        const nextExact: Record<string, string> = {};
        const nextPct: Record<string, string> = {};
        let idx = 0;
        updated.forEach((p) => {
          nextExact[p.id] = String(eqAmounts[idx].toFixed(2));
          nextPct[p.id] = String(eqPcts[idx].toFixed(2));
          idx++;
        });
        setExactInputs(nextExact);
        setPercentageInputs(nextPct);
      } else {
        const nextExact: Record<string, string> = {};
        const nextPct: Record<string, string> = {};
        updated.forEach((p) => {
          nextExact[p.id] = '0.00';
          nextPct[p.id] = '0.00';
        });
        setExactInputs(nextExact);
        setPercentageInputs(nextPct);
      }
      return updated;
    });
    setErrorMessage(null);
  };

  const handleAutoBalancePercentage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const selected = items.filter((p) => p.selected);
    if (selected.length === 0) return;
    const lastMember = selected[selected.length - 1];
    const curVal = parseFloat(percentageInputs[lastMember.id] || '0') || 0;
    const adjusted = Math.max(0, parseFloat((curVal + percentageRemaining).toFixed(2)));
    setPercentageInputs((prev) => ({
      ...prev,
      [lastMember.id]: adjusted.toFixed(2),
    }));
    setErrorMessage(null);
  };

  const handleAutoBalanceExact = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const selected = items.filter((p) => p.selected);
    if (selected.length === 0) return;
    const lastMember = selected[selected.length - 1];
    const curVal = parseFloat(exactInputs[lastMember.id] || '0') || 0;
    const adjusted = Math.max(0, parseFloat((curVal + exactRemaining).toFixed(2)));
    setExactInputs((prev) => ({
      ...prev,
      [lastMember.id]: adjusted.toFixed(2),
    }));
    setErrorMessage(null);
  };

  // Tab switching with smooth animated underline
  const handleTabPress = (type: SplitType) => {
    Haptics.selectionAsync();
    setSplitType(type);
    setErrorMessage(null);

    const idx = MODES.findIndex((m) => m.type === type);
    if (idx >= 0) {
      Animated.spring(tabUnderlineAnim, {
        toValue: idx,
        useNativeDriver: false,
        friction: 8,
        tension: 65,
      }).start();

      horizontalScrollRef.current?.scrollTo({ x: idx * width, animated: true });
    }
  };

  const handleHorizontalScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(offsetX / width);
    const targetMode = MODES[pageIndex]?.type;

    if (targetMode && targetMode !== splitType) {
      Haptics.selectionAsync();
      setSplitType(targetMode);
      setErrorMessage(null);

      Animated.spring(tabUnderlineAnim, {
        toValue: pageIndex,
        useNativeDriver: false,
        friction: 8,
        tension: 65,
      }).start();
    }
  };

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

  const handlePercentageChange = (id: string, text: string) => {
    setErrorMessage(null);
    let cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    if (parts.length === 2 && parts[1].length > 2) {
      cleaned = `${parts[0]}.${parts[1].slice(0, 2)}`;
    }
    setPercentageInputs((prev) => ({ ...prev, [id]: cleaned }));
  };

  const handleConfirm = () => {
    if (selectedCount === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage('Please select at least one person to split with.');
      return;
    }

    const payload = items.map((p) => ({
      userId: p.id,
      selected: p.selected,
      shares: sharesInputs[p.id] || 1,
      percentage: parseFloat(percentageInputs[p.id] || '0') || 0,
      amountOwed: parseFloat(exactInputs[p.id] || '0') || 0,
    }));

    const validation = validateSplit({
      totalAmount,
      splitType,
      participants: payload,
    });

    if (validation) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (validation.field === 'participants') {
        if (validation.kind === 'amounts') {
          setErrorMessage(
            `Total allocated (₹${validation.totalOwed.toFixed(2)}) must equal ₹${validation.totalAmount.toFixed(2)}.`
          );
        } else if (validation.kind === 'percentage') {
          setErrorMessage(
            `Percentages sum (${validation.totalPercentage.toFixed(2)}%) must equal 100.00%.`
          );
        }
      } else {
        setErrorMessage('Unbalanced split allocation.');
      }
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const updatedParticipants: SplitParticipantItem[] = items.map((p) => {
      const isSelected = p.selected;
      const amt = isSelected ? (splitBreakdown[p.id] !== undefined ? splitBreakdown[p.id] : 0) : 0;
      const pct = isSelected ? (splitPercentages[p.id] !== undefined ? splitPercentages[p.id] : 0) : 0;
      return {
        ...p,
        shares: sharesInputs[p.id] || 1,
        percentage: parseFloat(pct.toFixed(2)),
        exactAmount: parseFloat(amt.toFixed(2)),
      };
    });

    onConfirm({
      splitType,
      participants: updatedParticipants,
      splitBreakdown,
    });
    onClose();
  };

  // Tab width for underline calculation
  const tabWidth = width / MODES.length;
  const underlineTranslateX = tabUnderlineAnim.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [0, tabWidth, tabWidth * 2, tabWidth * 3],
  });

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
          {/* Splitwise App Bar: ← Back | Adjust split | ✓ Confirm */}
          <View style={styles.appBar}>
            <TouchableOpacity onPress={onClose} style={styles.navActionBtn} activeOpacity={0.7}>
              <ArrowLeft size={22} color={THEME.colors.text} />
            </TouchableOpacity>

            <Text style={styles.appBarTitle} numberOfLines={1}>Adjust split</Text>

            <TouchableOpacity onPress={handleConfirm} style={styles.navActionBtn} activeOpacity={0.7}>
              <Check size={24} color={THEME.colors.text} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          {/* Sleek Underline Tab Bar (Splitwise Pure Text Style) */}
          <View style={styles.tabBarContainer}>
            <View style={styles.tabRow}>
              {MODES.map((mode) => {
                const isActive = splitType === mode.type;
                return (
                  <TouchableOpacity
                    key={mode.type}
                    style={styles.tabButton}
                    onPress={() => handleTabPress(mode.type)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                      {mode.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Smooth Animated Underline */}
            <Animated.View
              style={[
                styles.tabUnderline,
                {
                  width: tabWidth - 24,
                  transform: [{ translateX: underlineTranslateX }],
                  marginHorizontal: 12,
                },
              ]}
            />
          </View>

          {/* Horizontal Paging Content */}
          <ScrollView
            ref={horizontalScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleHorizontalScrollEnd}
            style={styles.horizontalScroll}
          >
            {MODES.map((mode) => {
              const perShareAmount = totalShares > 0 ? totalAmount / totalShares : 0;
              const equalShare = selectedCount > 0 ? totalAmount / selectedCount : 0;

              return (
                <View key={mode.type} style={{ width, flex: 1 }}>
                  <ScrollView
                    style={styles.verticalList}
                    contentContainerStyle={styles.verticalListContent}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    showsVerticalScrollIndicator={false}
                  >
                    {/* Mode Header Banner (Splitwise Style) */}
                    <View style={styles.modeHeaderBanner}>
                      <Text style={styles.modeBannerTitle}>{mode.title}</Text>
                      <Text style={styles.modeBannerSubtitle}>{mode.subtitle}</Text>
                    </View>

                    {/* Participant Rows */}
                    {items.map((p) => {
                      const isSelected = p.selected;
                      const isCurrentUser = currentUserId === p.id;

                      // 1. Equal mode values (exact reconciled amount & percentage)
                      const liveEqualPrice = isSelected
                        ? (splitBreakdown[p.id] !== undefined ? splitBreakdown[p.id] : (selectedCount > 0 ? totalAmount / selectedCount : 0))
                        : 0;
                      const liveEqualPct = isSelected
                        ? (splitPercentages[p.id] !== undefined ? splitPercentages[p.id] : 0)
                        : 0;

                      // 2. Unequal mode values (strict 2-decimal percentage & exact amount)
                      const userExact = parseFloat(exactInputs[p.id] || '0') || 0;
                      const liveExactPct = isSelected
                        ? (splitPercentages[p.id] !== undefined ? splitPercentages[p.id] : (totalAmount > 0 ? (userExact / totalAmount) * 100 : 0))
                        : 0;

                      // 3. Percentage mode values (reconciled price matching 100.00% total)
                      const userPct = parseFloat(percentageInputs[p.id] || '0') || 0;
                      const livePctPrice = isSelected
                        ? (splitBreakdown[p.id] !== undefined ? splitBreakdown[p.id] : (totalAmount * userPct) / 100)
                        : 0;

                      // 4. Shares mode values (reconciled share amount & 2-decimal share percentage summing to 100.00%)
                      const userShares = sharesInputs[p.id] || 1;
                      const liveSharePrice = isSelected
                        ? (splitBreakdown[p.id] !== undefined ? splitBreakdown[p.id] : 0)
                        : 0;
                      const liveSharePct = isSelected
                        ? (splitPercentages[p.id] !== undefined ? splitPercentages[p.id] : 0)
                        : 0;

                      return (
                        <TouchableOpacity
                          key={p.id}
                          style={[
                            styles.participantRow,
                            !isSelected && styles.participantRowUnselected,
                          ]}
                          onPress={() => toggleSelectMember(p.id)}
                          activeOpacity={0.7}
                        >
                          {/* 1. Selection Checkbox on Left across ALL modes */}
                          <TouchableOpacity
                            style={[
                              styles.squareCheckbox,
                              isSelected && styles.squareCheckboxChecked,
                            ]}
                            onPress={() => toggleSelectMember(p.id)}
                            activeOpacity={0.7}
                          >
                            {isSelected && <Check size={13} color={THEME.colors.text} strokeWidth={3} />}
                          </TouchableOpacity>

                          {/* 2. Avatar */}
                          <View style={styles.avatarWrap}>
                            {p.avatarUrl ? (
                              <Image source={{ uri: p.avatarUrl }} style={styles.avatarImg} />
                            ) : (
                              <View style={styles.avatarFallback}>
                                <Text style={styles.avatarInitial}>
                                  {p.name.charAt(0).toUpperCase()}
                                </Text>
                              </View>
                            )}
                          </View>

                          {/* 3. Member Info */}
                          <View style={styles.memberInfo}>
                            <Text
                              style={[styles.memberName, !isSelected && styles.memberNameMuted]}
                              numberOfLines={1}
                            >
                              {p.name}
                              {isCurrentUser ? ' (You)' : ''}
                            </Text>

                            {/* Subtext info for each mode */}
                            {isSelected ? (
                              mode.type === 'equally' ? (
                                <Text style={styles.memberSublineHighlight}>
                                  = ₹{liveEqualPrice.toFixed(2)} ({liveEqualPct.toFixed(2)}%)
                                </Text>
                              ) : mode.type === 'unequally' ? (
                                <Text style={styles.memberSubline}>
                                  {liveExactPct.toFixed(2)}% of total
                                </Text>
                              ) : mode.type === 'by_percentage' ? (
                                <Text style={styles.memberSublineHighlight}>
                                  = ₹{livePctPrice.toFixed(2)}
                                </Text>
                              ) : mode.type === 'by_shares' ? (
                                <Text style={styles.memberSublineHighlight}>
                                  = ₹{liveSharePrice.toFixed(2)} ({liveSharePct.toFixed(2)}%)
                                </Text>
                              ) : null
                            ) : (
                              <Text style={styles.memberSublineMuted}>Excluded</Text>
                            )}
                          </View>

                          {/* 4. Mode-Specific Right Control (ALWAYS rendered, locked when unselected) */}
                          {mode.type === 'equally' ? (
                            <View style={styles.equalRightStatus}>
                              {isSelected ? (
                                <Text style={styles.equalShareText}>₹{liveEqualPrice.toFixed(2)}</Text>
                              ) : (
                                <Text style={styles.equalShareTextMuted}>₹0.00</Text>
                              )}
                            </View>
                          ) : (
                            <View
                              style={styles.inputWrap}
                              pointerEvents={isSelected ? 'auto' : 'none'}
                            >
                              {mode.type === 'unequally' && (
                                <View
                                  style={[
                                    styles.exactInputBox,
                                    !isSelected && styles.exactInputBoxLocked,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.currencyPrefix,
                                      !isSelected && styles.currencyPrefixLocked,
                                    ]}
                                  >
                                    ₹
                                  </Text>
                                  <TextInput
                                    style={[
                                      styles.cleanTextInput,
                                      !isSelected && styles.cleanTextInputLocked,
                                    ]}
                                    placeholder="0.00"
                                    placeholderTextColor={THEME.colors.textMuted}
                                    keyboardType="decimal-pad"
                                    value={isSelected ? (exactInputs[p.id] || '') : '0.00'}
                                    editable={isSelected}
                                    onChangeText={(t) => handleExactChange(p.id, t)}
                                  />
                                </View>
                              )}

                              {mode.type === 'by_percentage' && (
                                <View
                                  style={[
                                    styles.exactInputBox,
                                    !isSelected && styles.exactInputBoxLocked,
                                  ]}
                                >
                                  <TextInput
                                    style={[
                                      styles.cleanTextInput,
                                      !isSelected && styles.cleanTextInputLocked,
                                    ]}
                                    placeholder="0.00"
                                    placeholderTextColor={THEME.colors.textMuted}
                                    keyboardType="decimal-pad"
                                    value={isSelected ? (percentageInputs[p.id] || '') : '0.00'}
                                    editable={isSelected}
                                    onChangeText={(t) => handlePercentageChange(p.id, t)}
                                  />
                                  <Text
                                    style={[
                                      styles.percentSuffix,
                                      !isSelected && styles.percentSuffixLocked,
                                    ]}
                                  >
                                    %
                                  </Text>
                                </View>
                              )}

                              {mode.type === 'by_shares' && (
                                <View
                                  style={[
                                    styles.stepperWrap,
                                    !isSelected && styles.stepperWrapLocked,
                                  ]}
                                >
                                  <TouchableOpacity
                                    style={[
                                      styles.stepperActionBtn,
                                      !isSelected && styles.stepperActionBtnDisabled,
                                    ]}
                                    disabled={!isSelected}
                                    onPress={() => {
                                      Haptics.selectionAsync();
                                      const cur = sharesInputs[p.id] || 1;
                                      setSharesInputs((prev) => ({
                                        ...prev,
                                        [p.id]: Math.max(1, cur - 1),
                                      }));
                                    }}
                                  >
                                    <Minus size={13} color={isSelected ? THEME.colors.text : THEME.colors.textMuted} />
                                  </TouchableOpacity>

                                  <Text
                                    style={[
                                      styles.stepperCountText,
                                      !isSelected && styles.stepperCountTextLocked,
                                    ]}
                                  >
                                    {isSelected ? (sharesInputs[p.id] || 1) : 0}
                                  </Text>

                                  <TouchableOpacity
                                    style={[
                                      styles.stepperActionBtn,
                                      !isSelected && styles.stepperActionBtnDisabled,
                                    ]}
                                    disabled={!isSelected}
                                    onPress={() => {
                                      Haptics.selectionAsync();
                                      const cur = sharesInputs[p.id] || 1;
                                      setSharesInputs((prev) => ({
                                        ...prev,
                                        [p.id]: cur + 1,
                                      }));
                                    }}
                                  >
                                    <Plus size={13} color={isSelected ? THEME.colors.text : THEME.colors.textMuted} />
                                  </TouchableOpacity>
                                </View>
                              )}
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              );
            })}
          </ScrollView>

          {/* Persistent Splitwise Bottom Status Bar */}
          <View style={styles.splitwiseBottomBar}>
            {errorMessage && (
              <View style={styles.errorStrip}>
                <AlertCircle size={13} color={THEME.colors.negative} />
                <Text style={styles.errorStripText}>{errorMessage}</Text>
              </View>
            )}

            <View style={styles.bottomStatRow}>
              {/* Left Column: Live Calculation Stats */}
              <View style={styles.bottomStatsCol}>
                {splitType === 'equally' ? (
                  <>
                    <Text style={styles.bottomMainStat}>
                      ₹{(selectedCount > 0 ? totalAmount / selectedCount : 0).toFixed(2)}/person
                    </Text>
                    <Text style={[styles.bottomSubStat, styles.textMint]}>
                      {selectedCount} of {items.length} people included
                    </Text>
                  </>
                ) : splitType === 'unequally' ? (
                  <>
                    <Text style={styles.bottomMainStat}>
                      ₹{exactSum.toFixed(2)} of ₹{totalAmount.toFixed(2)}
                    </Text>
                    {isModeBalanced ? (
                      <Text style={[styles.bottomSubStat, styles.textMint]}>
                        Balanced
                      </Text>
                    ) : (
                      <TouchableOpacity onPress={handleAutoBalanceExact} activeOpacity={0.7}>
                        <Text style={[styles.bottomSubStat, styles.textWarning]}>
                          {exactRemaining > 0
                            ? `₹${exactRemaining.toFixed(2)} left · Tap to balance`
                            : `₹${Math.abs(exactRemaining).toFixed(2)} over · Tap to balance`}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : splitType === 'by_percentage' ? (
                  <>
                    <Text style={styles.bottomMainStat}>{percentageSum.toFixed(2)}% of 100.00%</Text>
                    {isModeBalanced ? (
                      <Text style={[styles.bottomSubStat, styles.textMint]}>
                        100.00% Allocated
                      </Text>
                    ) : (
                      <TouchableOpacity onPress={handleAutoBalancePercentage} activeOpacity={0.7}>
                        <Text style={[styles.bottomSubStat, styles.textWarning]}>
                          {percentageRemaining > 0
                            ? `${percentageRemaining.toFixed(2)}% left · Tap to balance`
                            : `${Math.abs(percentageRemaining).toFixed(2)}% over · Tap to balance`}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={styles.bottomMainStat}>
                      {totalShares} total {totalShares === 1 ? 'share' : 'shares'}
                    </Text>
                    <Text style={[styles.bottomSubStat, styles.textMint]}>
                      ₹{(totalShares > 0 ? totalAmount / totalShares : 0).toFixed(2)}/share
                    </Text>
                  </>
                )}
              </View>

              {/* Vertical Hairline Divider */}
              <View style={styles.bottomDivider} />

              {/* Right Column: "All [✓]" Quick Toggle */}
              <TouchableOpacity
                style={styles.allToggleBtn}
                onPress={handleToggleAll}
                activeOpacity={0.7}
              >
                <Text style={styles.allToggleLabel}>All</Text>
                <View
                  style={[
                    styles.squareCheckbox,
                    selectedCount === items.length && styles.squareCheckboxChecked,
                  ]}
                >
                  {selectedCount === items.length && (
                    <Check size={14} color={THEME.colors.text} strokeWidth={3} />
                  )}
                </View>
              </TouchableOpacity>
            </View>
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
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.md,
  },
  navActionBtn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarTitle: {
    flex: 1,
    marginLeft: THEME.spacing.md,
    fontSize: THEME.typography.size.title,
    fontWeight: THEME.typography.weight.bold,
    color: THEME.colors.text,
    letterSpacing: -0.2,
    textAlign: 'left',
  },
  tabBarContainer: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
    position: 'relative',
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabButton: {
    flex: 1,
    paddingVertical: THEME.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: THEME.typography.weight.semibold,
    color: THEME.colors.textSecondary,
  },
  tabLabelActive: {
    color: THEME.colors.text,
    fontWeight: THEME.typography.weight.bold,
  },
  tabUnderline: {
    height: 3,
    backgroundColor: THEME.colors.text,
    borderRadius: 1.5,
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
  horizontalScroll: {
    flex: 1,
  },
  verticalList: {
    flex: 1,
  },
  verticalListContent: {
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: THEME.spacing.md,
    paddingBottom: THEME.spacing['2xl'],
  },
  modeHeaderBanner: {
    marginBottom: THEME.spacing.lg,
    paddingHorizontal: 4,
  },
  modeBannerTitle: {
    fontSize: 15,
    fontWeight: THEME.typography.weight.bold,
    color: THEME.colors.text,
    marginBottom: 3,
  },
  modeBannerSubtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    lineHeight: 18,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 10,
    marginVertical: 3,
    borderRadius: THEME.radius.lg - 2,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  participantRowUnselected: {
    opacity: 0.45,
  },
  squareCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: THEME.colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: THEME.spacing.md,
  },
  squareCheckboxChecked: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    backgroundColor: THEME.colors.surfacePill,
    marginRight: THEME.spacing.md,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surfacePill,
  },
  avatarInitial: {
    fontSize: 15,
    fontWeight: THEME.typography.weight.bold,
    color: THEME.colors.text,
  },
  memberInfo: {
    flex: 1,
    marginRight: 10,
  },
  memberName: {
    fontSize: 15,
    fontWeight: THEME.typography.weight.semibold,
    color: THEME.colors.text,
  },
  memberNameMuted: {
    color: THEME.colors.textSecondary,
  },
  memberSubline: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  memberSublineHighlight: {
    fontSize: 12,
    fontWeight: THEME.typography.weight.bold,
    color: THEME.colors.primary,
    marginTop: 2,
  },
  memberSublineMuted: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  equalRightStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  equalShareText: {
    fontSize: 14,
    fontWeight: THEME.typography.weight.bold,
    color: THEME.colors.primary,
  },
  equalShareTextMuted: {
    fontSize: 14,
    fontWeight: THEME.typography.weight.semibold,
    color: THEME.colors.textMuted,
  },
  inputWrap: {
    marginLeft: 8,
  },
  exactInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: THEME.colors.primary,
    paddingHorizontal: 4,
    paddingVertical: 4,
    minWidth: 85,
  },
  exactInputBoxLocked: {
    borderBottomColor: THEME.colors.hairlineLight,
    opacity: 0.5,
  },
  currencyPrefix: {
    fontSize: 14,
    fontWeight: THEME.typography.weight.bold,
    color: THEME.colors.primary,
    marginRight: 4,
  },
  currencyPrefixLocked: {
    color: THEME.colors.textMuted,
  },
  percentSuffix: {
    fontSize: 14,
    fontWeight: THEME.typography.weight.bold,
    color: THEME.colors.primary,
    marginLeft: 4,
  },
  percentSuffixLocked: {
    color: THEME.colors.textMuted,
  },
  cleanTextInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: THEME.typography.weight.bold,
    color: THEME.colors.text,
    padding: 0,
    textAlign: 'right',
  },
  cleanTextInputLocked: {
    color: THEME.colors.textMuted,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.hairlineLight,
    height: 34,
    paddingHorizontal: 4,
    gap: 8,
  },
  stepperWrapLocked: {
    opacity: 0.4,
    borderColor: THEME.colors.hairline,
  },
  stepperActionBtn: {
    width: 26,
    height: 26,
    borderRadius: THEME.radius.xs,
    backgroundColor: THEME.colors.hairlineLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperActionBtnDisabled: {
    backgroundColor: THEME.colors.skeleton.surface,
  },
  stepperCountText: {
    fontSize: 14,
    fontWeight: THEME.typography.weight.bold,
    color: THEME.colors.text,
    minWidth: 18,
    textAlign: 'center',
  },
  stepperCountTextLocked: {
    color: THEME.colors.textMuted,
  },
  splitwiseBottomBar: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
    backgroundColor: THEME.colors.background,
    paddingHorizontal: THEME.spacing.xl,
    paddingVertical: 14,
  },
  errorStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  errorStripText: {
    fontSize: 12,
    fontWeight: THEME.typography.weight.semibold,
    color: THEME.colors.negative,
  },
  bottomStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomStatsCol: {
    flex: 1,
  },
  bottomMainStat: {
    fontSize: 16,
    fontWeight: THEME.typography.weight.bold,
    color: THEME.colors.text,
  },
  bottomSubStat: {
    fontSize: 13,
    fontWeight: THEME.typography.weight.semibold,
    marginTop: 2,
  },
  textMint: {
    color: THEME.colors.primary,
  },
  textWarning: {
    color: THEME.colors.warning,
  },
  bottomDivider: {
    width: 1,
    height: 32,
    backgroundColor: THEME.colors.hairlineLight,
    marginHorizontal: THEME.spacing.lg,
  },
  allToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  allToggleLabel: {
    fontSize: 14,
    fontWeight: THEME.typography.weight.semibold,
    color: THEME.colors.text,
  },
});
