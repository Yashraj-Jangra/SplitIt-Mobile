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

      const initialIdx = MODES.findIndex((m) => m.type === normalizedInitialType);
      const targetIdx = initialIdx >= 0 ? initialIdx : 0;

      tabUnderlineAnim.setValue(targetIdx);

      setTimeout(() => {
        horizontalScrollRef.current?.scrollTo({ x: targetIdx * width, animated: false });
      }, 50);
    }
  }, [visible, initialSplitType, initialParticipants, totalAmount, width]);

  const selectedCount = useMemo(() => items.filter((p) => p.selected).length, [items]);

  // Real-time calculation of owed amounts
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

  // Mode calculations
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

  const handleToggleAll = () => {
    Haptics.selectionAsync();
    const shouldSelectAll = selectedCount < items.length;
    setItems((prev) => prev.map((p) => ({ ...p, selected: shouldSelectAll })));
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
    if (pageIndex >= 0 && pageIndex < MODES.length) {
      const targetMode = MODES[pageIndex].type;
      if (targetMode !== splitType) {
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
    if (parts.length === 2 && parts[1].length > 2) {
      cleaned = `${parts[0]}.${parts[1].slice(0, 2)}`;
    }
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
              <ArrowLeft size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <Text style={styles.appBarTitle}>Adjust split</Text>

            <TouchableOpacity onPress={handleConfirm} style={styles.navActionBtn} activeOpacity={0.7}>
              <Check size={24} color="#FFFFFF" strokeWidth={2.5} />
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
                          style={[
                            styles.participantRow,
                            !isSelected && styles.participantRowUnselected,
                          ]}
                        >
                          {/* Avatar */}
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

                          {/* Member Name & Live Calculations */}
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
                              mode.type === 'unequally' ? (
                                <Text style={styles.memberSubline}>
                                  {liveExactPct}% of total
                                </Text>
                              ) : mode.type === 'by_percentage' ? (
                                <Text style={styles.memberSublineHighlight}>
                                  = ₹{livePctPrice.toFixed(2)}
                                </Text>
                              ) : mode.type === 'by_shares' ? (
                                <Text style={styles.memberSublineHighlight}>
                                  = ₹{liveSharePrice.toFixed(2)} ({liveSharePct}%)
                                </Text>
                              ) : null
                            ) : (
                              <Text style={styles.memberSublineMuted}>Excluded</Text>
                            )}
                          </View>

                          {/* Mode-Specific Right Control */}
                          {mode.type === 'equally' ? (
                            /* Splitwise Green Square Checkbox */
                            <TouchableOpacity
                              style={[
                                styles.squareCheckbox,
                                isSelected && styles.squareCheckboxChecked,
                              ]}
                              onPress={() => toggleSelectMember(p.id)}
                              activeOpacity={0.7}
                            >
                              {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                            </TouchableOpacity>
                          ) : isSelected ? (
                            <View style={styles.inputWrap}>
                              {mode.type === 'unequally' && (
                                <View style={styles.exactInputBox}>
                                  <Text style={styles.currencyPrefix}>₹</Text>
                                  <TextInput
                                    style={styles.cleanTextInput}
                                    placeholder="0.00"
                                    placeholderTextColor="#6B7280"
                                    keyboardType="decimal-pad"
                                    value={exactInputs[p.id] || ''}
                                    onChangeText={(t) => handleExactChange(p.id, t)}
                                  />
                                </View>
                              )}

                              {mode.type === 'by_percentage' && (
                                <View style={styles.exactInputBox}>
                                  <TextInput
                                    style={styles.cleanTextInput}
                                    placeholder="0.00"
                                    placeholderTextColor="#6B7280"
                                    keyboardType="decimal-pad"
                                    value={percentageInputs[p.id] || ''}
                                    onChangeText={(t) => handlePercentageChange(p.id, t)}
                                  />
                                  <Text style={styles.percentSuffix}>%</Text>
                                </View>
                              )}

                              {mode.type === 'by_shares' && (
                                <View style={styles.stepperWrap}>
                                  <TouchableOpacity
                                    style={styles.stepperActionBtn}
                                    onPress={() => {
                                      Haptics.selectionAsync();
                                      const cur = sharesInputs[p.id] || 1;
                                      setSharesInputs((prev) => ({
                                        ...prev,
                                        [p.id]: Math.max(1, cur - 1),
                                      }));
                                    }}
                                  >
                                    <Minus size={13} color="#FFFFFF" />
                                  </TouchableOpacity>

                                  <Text style={styles.stepperCountText}>
                                    {sharesInputs[p.id] || 1}
                                  </Text>

                                  <TouchableOpacity
                                    style={styles.stepperActionBtn}
                                    onPress={() => {
                                      Haptics.selectionAsync();
                                      const cur = sharesInputs[p.id] || 1;
                                      setSharesInputs((prev) => ({
                                        ...prev,
                                        [p.id]: cur + 1,
                                      }));
                                    }}
                                  >
                                    <Plus size={13} color="#FFFFFF" />
                                  </TouchableOpacity>
                                </View>
                              )}
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.squareCheckbox}
                              onPress={() => toggleSelectMember(p.id)}
                              activeOpacity={0.7}
                            />
                          )}
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              );
            })}
          </ScrollView>

          {/* Bottom Dock: Live Stats & All Toggle (Direct Splitwise Parity) */}
          <View style={styles.splitwiseBottomBar}>
            {errorMessage && (
              <View style={styles.errorStrip}>
                <AlertCircle size={13} color="#F43F5E" />
                <Text style={styles.errorStripText}>{errorMessage}</Text>
              </View>
            )}

            <View style={styles.bottomBarRow}>
              {/* Left Column: Calculation */}
              <View style={styles.bottomStatLeft}>
                {splitType === 'equally' ? (
                  <>
                    <Text style={styles.bottomMainStat}>
                      ₹{(selectedCount > 0 ? totalAmount / selectedCount : 0).toFixed(2)}/person
                    </Text>
                    <Text style={styles.bottomSubStat}>
                      ({selectedCount} {selectedCount === 1 ? 'person' : 'people'})
                    </Text>
                  </>
                ) : splitType === 'unequally' ? (
                  <>
                    <Text style={styles.bottomMainStat}>
                      ₹{exactSum.toFixed(2)} of ₹{totalAmount.toFixed(2)}
                    </Text>
                    <Text
                      style={[
                        styles.bottomSubStat,
                        isModeBalanced ? styles.textMint : styles.textWarning,
                      ]}
                    >
                      {isModeBalanced
                        ? 'Balanced'
                        : exactRemaining > 0
                        ? `₹${exactRemaining.toFixed(2)} left`
                        : `₹${Math.abs(exactRemaining).toFixed(2)} over`}
                    </Text>
                  </>
                ) : splitType === 'by_percentage' ? (
                  <>
                    <Text style={styles.bottomMainStat}>{percentageSum.toFixed(2)}% of 100%</Text>
                    <Text
                      style={[
                        styles.bottomSubStat,
                        isModeBalanced ? styles.textMint : styles.textWarning,
                      ]}
                    >
                      {isModeBalanced
                        ? '100% Allocated'
                        : percentageRemaining > 0
                        ? `${percentageRemaining.toFixed(2)}% left`
                        : `${Math.abs(percentageRemaining).toFixed(2)}% over`}
                    </Text>
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
                    <Check size={14} color="#FFFFFF" strokeWidth={3} />
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
    backgroundColor: '#18191B', // Splitwise Authentic Dark Canvas
  },
  keyboardContainer: {
    flex: 1,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  navActionBtn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  tabBarContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tabUnderline: {
    height: 3,
    backgroundColor: '#FFFFFF', // Clean White Splitwise Underline
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  modeHeaderBanner: {
    marginBottom: 20,
  },
  modeBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  modeBannerSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 18,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  participantRowUnselected: {
    opacity: 0.45,
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#2A2B2E',
    marginRight: 14,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A2B2E',
  },
  avatarInitial: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  memberNameMuted: {
    color: '#9CA3AF',
  },
  memberSubline: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  memberSublineHighlight: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1CC29F',
    marginTop: 2,
  },
  memberSublineMuted: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  squareCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  squareCheckboxChecked: {
    backgroundColor: '#1CC29F',
    borderColor: '#1CC29F',
  },
  inputWrap: {
    marginLeft: 12,
  },
  exactInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: '#1CC29F',
    paddingHorizontal: 4,
    paddingVertical: 4,
    minWidth: 85,
  },
  currencyPrefix: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1CC29F',
    marginRight: 4,
  },
  percentSuffix: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1CC29F',
    marginLeft: 4,
  },
  cleanTextInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    padding: 0,
    textAlign: 'right',
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222427',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    height: 34,
    paddingHorizontal: 4,
    gap: 8,
  },
  stepperActionBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperCountText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    minWidth: 18,
    textAlign: 'center',
  },
  splitwiseBottomBar: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#18191B',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  errorStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  errorStripText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F43F5E',
  },
  bottomBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomStatLeft: {
    flex: 1,
  },
  bottomMainStat: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  bottomSubStat: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  bottomDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 16,
  },
  allToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  allToggleLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  textMint: {
    color: '#1CC29F',
    fontWeight: '600',
  },
  textWarning: {
    color: '#F59E0B',
    fontWeight: '600',
  },
});
