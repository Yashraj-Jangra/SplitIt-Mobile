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
import { ArrowLeft, Check, AlertCircle, Sparkles } from 'lucide-react-native';
import { calculateEqualAmounts } from '@splitit/core';
import { THEME } from '../../constants/theme';
import * as Haptics from 'expo-haptics';

export interface PayerMember {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface MultiPayerEntry {
  userId: string;
  amount: number;
}

interface PayerSelectModalProps {
  visible: boolean;
  onClose: () => void;
  members: PayerMember[];
  currentUserId?: string;
  totalAmount: number;
  initialPayerType?: 'single' | 'multiple';
  initialSinglePayerId?: string;
  initialMultiPayers?: MultiPayerEntry[];
  onConfirm: (result: {
    payerType: 'single' | 'multiple';
    singlePayerId: string;
    multiPayers: MultiPayerEntry[];
  }) => void;
}

const PAYER_TABS = [
  { type: 'single' as const, label: 'Single person' },
  { type: 'multiple' as const, label: 'Multiple people' },
];

export function PayerSelectModal({
  visible,
  onClose,
  members,
  currentUserId,
  totalAmount,
  initialPayerType = 'single',
  initialSinglePayerId,
  initialMultiPayers = [],
  onConfirm,
}: PayerSelectModalProps) {
  const { width } = useWindowDimensions();
  const horizontalScrollRef = useRef<ScrollView>(null);
  const tabUnderlineAnim = useRef(new Animated.Value(0)).current;

  const [payerType, setPayerType] = useState<'single' | 'multiple'>(initialPayerType);
  const [selectedSingleId, setSelectedSingleId] = useState<string>(
    initialSinglePayerId || currentUserId || members[0]?.id || ''
  );
  const [selectedPayers, setSelectedPayers] = useState<Record<string, boolean>>({});
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setPayerType(initialPayerType);
      setSelectedSingleId(initialSinglePayerId || currentUserId || members[0]?.id || '');
      setErrorMessage(null);

      const selMap: Record<string, boolean> = {};
      const amountsMap: Record<string, string> = {};

      if (initialMultiPayers && initialMultiPayers.length > 0) {
        const hasAnyPaid = initialMultiPayers.some((p) => p.amount > 0);
        members.forEach((m) => {
          const entry = initialMultiPayers.find((p) => p.userId === m.id);
          if (entry && entry.amount > 0) {
            selMap[m.id] = true;
            amountsMap[m.id] = String(entry.amount);
          } else {
            selMap[m.id] = !hasAnyPaid;
            amountsMap[m.id] = '';
          }
        });
      } else {
        // By default, select all members in multiple mode
        members.forEach((m) => {
          selMap[m.id] = true;
        });
        if (initialPayerType === 'multiple') {
          const primaryId = initialSinglePayerId || currentUserId || members[0]?.id;
          if (primaryId && totalAmount > 0) {
            amountsMap[primaryId] = totalAmount.toFixed(2);
          }
        }
      }

      setSelectedPayers(selMap);
      setPayerAmounts(amountsMap);

      const targetIdx = initialPayerType === 'multiple' ? 1 : 0;
      tabUnderlineAnim.setValue(targetIdx);

      setTimeout(() => {
        horizontalScrollRef.current?.scrollTo({ x: targetIdx * width, animated: false });
      }, 50);
    }
  }, [visible, initialPayerType, initialSinglePayerId, initialMultiPayers, members, currentUserId, totalAmount, width]);

  const selectedPayersCount = useMemo(
    () => members.filter((m) => selectedPayers[m.id]).length,
    [members, selectedPayers]
  );

  const sumOfPaid = useMemo(() => {
    return Object.entries(payerAmounts).reduce((acc, [userId, val]) => {
      if (!selectedPayers[userId]) return acc;
      const parsed = parseFloat(val);
      return acc + (isNaN(parsed) ? 0 : parsed);
    }, 0);
  }, [payerAmounts, selectedPayers]);

  const remaining = useMemo(() => {
    return parseFloat((totalAmount - sumOfPaid).toFixed(2));
  }, [totalAmount, sumOfPaid]);

  const isBalanced = useMemo(() => {
    return Math.abs(remaining) <= 0.01 && sumOfPaid > 0;
  }, [remaining, sumOfPaid]);

  const handleSelectSingle = (id: string) => {
    Haptics.selectionAsync();
    setSelectedSingleId(id);
    onConfirm({
      payerType: 'single',
      singlePayerId: id,
      multiPayers: [{ userId: id, amount: totalAmount }],
    });
    onClose();
  };

  const toggleSelectPayer = (userId: string) => {
    Haptics.selectionAsync();
    setSelectedPayers((prev) => {
      const nextVal = !prev[userId];
      const nextPayers = { ...prev, [userId]: nextVal };
      if (!nextVal) {
        setPayerAmounts((oldAmounts) => {
          const nextAmounts = { ...oldAmounts };
          delete nextAmounts[userId];
          return nextAmounts;
        });
      }
      return nextPayers;
    });
    setErrorMessage(null);
  };

  const handleToggleAllPayers = () => {
    Haptics.selectionAsync();
    const shouldSelectAll = selectedPayersCount < members.length;
    const nextPayers: Record<string, boolean> = {};
    members.forEach((m) => {
      nextPayers[m.id] = shouldSelectAll;
    });
    setSelectedPayers(nextPayers);
    if (!shouldSelectAll) {
      setPayerAmounts({});
    }
    setErrorMessage(null);
  };

  const handleModeTabPress = (type: 'single' | 'multiple') => {
    Haptics.selectionAsync();
    setPayerType(type);
    setErrorMessage(null);
    const idx = type === 'multiple' ? 1 : 0;
    Animated.spring(tabUnderlineAnim, {
      toValue: idx,
      useNativeDriver: false,
      friction: 8,
      tension: 65,
    }).start();
    horizontalScrollRef.current?.scrollTo({ x: idx * width, animated: true });
  };

  const handleHorizontalScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(offsetX / width);
    const targetType = pageIndex === 1 ? 'multiple' : 'single';
    if (targetType !== payerType) {
      Haptics.selectionAsync();
      setPayerType(targetType);
      setErrorMessage(null);
      Animated.spring(tabUnderlineAnim, {
        toValue: pageIndex,
        useNativeDriver: false,
        friction: 8,
        tension: 65,
      }).start();
    }
  };

  const handleAmountChange = (userId: string, text: string) => {
    setErrorMessage(null);
    let cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    if (parts.length === 2 && parts[1].length > 2) {
      cleaned = `${parts[0]}.${parts[1].slice(0, 2)}`;
    }
    setSelectedPayers((prev) => ({ ...prev, [userId]: true }));
    setPayerAmounts((prev) => ({
      ...prev,
      [userId]: cleaned,
    }));
  };

  const handleQuickAssignAll = (userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPayers((prev) => ({ ...prev, [userId]: true }));
    setPayerAmounts({
      [userId]: totalAmount.toFixed(2),
    });
    setErrorMessage(null);
  };

  const handleSplitPaidEqually = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (members.length === 0 || totalAmount <= 0) return;

    let targetMembers = members.filter((m) => selectedPayers[m.id]);
    if (targetMembers.length === 0) {
      targetMembers = members;
      const allSelected: Record<string, boolean> = {};
      members.forEach((m) => (allSelected[m.id] = true));
      setSelectedPayers(allSelected);
    }

    const userIdx = currentUserId ? targetMembers.findIndex((m) => m.id === currentUserId) : -1;
    const preferredIdx = userIdx >= 0 ? userIdx : 0;
    const equalAmounts = calculateEqualAmounts(totalAmount, targetMembers.length, preferredIdx);
    const newMap: Record<string, string> = {};
    targetMembers.forEach((m, idx) => {
      newMap[m.id] = equalAmounts[idx].toFixed(2);
    });

    setPayerAmounts(newMap);
    setErrorMessage(null);
  };

  const handleAutoBalancePayer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const activePayers = members.filter((m) => selectedPayers[m.id]);
    if (activePayers.length === 0) return;
    const lastPayer = activePayers[activePayers.length - 1];
    const curVal = parseFloat(payerAmounts[lastPayer.id] || '0') || 0;
    const adjusted = Math.max(0, parseFloat((curVal + remaining).toFixed(2)));
    setPayerAmounts((prev) => ({
      ...prev,
      [lastPayer.id]: adjusted.toFixed(2),
    }));
    setErrorMessage(null);
  };

  const handleConfirm = () => {
    if (payerType === 'single') {
      onConfirm({
        payerType: 'single',
        singlePayerId: selectedSingleId,
        multiPayers: [{ userId: selectedSingleId, amount: totalAmount }],
      });
      onClose();
      return;
    }

    if (!isBalanced) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (remaining > 0) {
        setErrorMessage(`₹${remaining.toFixed(2)} left to allocate.`);
      } else {
        setErrorMessage(`₹${Math.abs(remaining).toFixed(2)} over total expense amount.`);
      }
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const entries: MultiPayerEntry[] = members
      .filter((m) => selectedPayers[m.id])
      .map((m) => ({
        userId: m.id,
        amount: parseFloat(payerAmounts[m.id] || '0') || 0,
      }))
      .filter((p) => p.amount > 0);

    onConfirm({
      payerType: 'multiple',
      singlePayerId: entries[0]?.userId || selectedSingleId,
      multiPayers: entries,
    });
    onClose();
  };

  const tabWidth = width / 2;
  const underlineTranslateX = tabUnderlineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, tabWidth],
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
          {/* Top Bar: ← Back | Who paid? | ✓ Confirm */}
          <View style={styles.appBar}>
            <TouchableOpacity onPress={onClose} style={styles.navActionBtn} activeOpacity={0.7}>
              <ArrowLeft size={22} color={THEME.colors.text} />
            </TouchableOpacity>

            <Text style={styles.appBarTitle} numberOfLines={1}>Who paid?</Text>

            <TouchableOpacity onPress={handleConfirm} style={styles.navActionBtn} activeOpacity={0.7}>
              <Check size={24} color={THEME.colors.text} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          {/* Underline Tab Bar */}
          <View style={styles.tabBarContainer}>
            <View style={styles.tabRow}>
              {PAYER_TABS.map((tab) => {
                const isActive = payerType === tab.type;
                return (
                  <TouchableOpacity
                    key={tab.type}
                    style={styles.tabButton}
                    onPress={() => handleModeTabPress(tab.type)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Animated.View
              style={[
                styles.tabUnderline,
                {
                  width: tabWidth - 40,
                  transform: [{ translateX: underlineTranslateX }],
                  marginHorizontal: 20,
                },
              ]}
            />
          </View>

          {/* Horizontal Paging Screen */}
          <ScrollView
            ref={horizontalScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleHorizontalScrollEnd}
            style={styles.horizontalScroll}
          >
            {/* Page 0: Single Person List */}
            <View style={{ width, flex: 1 }}>
              <ScrollView
                style={styles.verticalList}
                contentContainerStyle={styles.verticalListContent}
                showsVerticalScrollIndicator={false}
              >
                {members.map((m) => {
                  const isSelected = selectedSingleId === m.id;
                  const isCurrentUser = currentUserId === m.id;

                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.memberRow, isSelected && styles.memberRowSelected]}
                      onPress={() => handleSelectSingle(m.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.avatarWrap}>
                        {m.avatarUrl ? (
                          <Image source={{ uri: m.avatarUrl }} style={styles.avatarImg} />
                        ) : (
                          <View style={styles.avatarFallback}>
                            <Text style={styles.avatarInitial}>
                              {m.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName} numberOfLines={1}>
                          {m.name}
                          {isCurrentUser ? ' (You)' : ''}
                        </Text>
                        <Text style={styles.memberSubline}>
                          {isSelected ? `Paid full ₹${totalAmount.toFixed(2)}` : 'Tap to select'}
                        </Text>
                      </View>

                      {isSelected && (
                        <View style={styles.checkIndicator}>
                          <Check size={18} color={THEME.colors.primary} strokeWidth={2.5} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Page 1: Multiple People Matrix */}
            <View style={{ width, flex: 1 }}>
              {/* Quick Helper Shortcut */}
              <View style={styles.multiHelperRow}>
                <TouchableOpacity
                  style={styles.splitEquallyChip}
                  onPress={handleSplitPaidEqually}
                  activeOpacity={0.7}
                >
                  <Sparkles size={12} color={THEME.colors.primary} />
                  <Text style={styles.splitEquallyText}>Split paid equally</Text>
                </TouchableOpacity>

                <View style={styles.multiHelperRight}>
                  <Text style={styles.totalRequiredText}>
                    Total: ₹{totalAmount.toFixed(2)}
                  </Text>

                  {/* All [✓] Quick Toggle for Payers */}
                  <TouchableOpacity
                    style={styles.allToggleBtn}
                    onPress={handleToggleAllPayers}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.allToggleLabel}>All</Text>
                    <View
                      style={[
                        styles.squareCheckboxSmall,
                        selectedPayersCount === members.length && styles.squareCheckboxChecked,
                      ]}
                    >
                      {selectedPayersCount === members.length && (
                        <Check size={11} color={THEME.colors.text} strokeWidth={3} />
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView
                style={styles.verticalList}
                contentContainerStyle={styles.verticalListContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
              >
                {members.map((m) => {
                  const isSelected = !!selectedPayers[m.id];
                  const val = isSelected ? (payerAmounts[m.id] || '') : '';
                  const numVal = parseFloat(val) || 0;
                  const pct = totalAmount > 0 ? ((numVal / totalAmount) * 100).toFixed(1) : '0';
                  const isCurrentUser = currentUserId === m.id;

                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[
                        styles.multiPayerRow,
                        !isSelected && styles.multiPayerRowUnselected,
                      ]}
                      onPress={() => toggleSelectPayer(m.id)}
                      activeOpacity={0.7}
                    >
                      {/* Selection Checkbox on the Left */}
                      <TouchableOpacity
                        style={[
                          styles.squareCheckbox,
                          isSelected && styles.squareCheckboxChecked,
                        ]}
                        onPress={() => toggleSelectPayer(m.id)}
                        activeOpacity={0.7}
                      >
                        {isSelected && <Check size={13} color={THEME.colors.text} strokeWidth={3} />}
                      </TouchableOpacity>

                      {/* Avatar */}
                      <View style={styles.avatarWrap}>
                        {m.avatarUrl ? (
                          <Image source={{ uri: m.avatarUrl }} style={styles.avatarImg} />
                        ) : (
                          <View style={styles.avatarFallback}>
                            <Text style={styles.avatarInitial}>
                              {m.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Member Info */}
                      <View style={styles.memberInfo}>
                        <Text
                          style={[styles.memberName, !isSelected && styles.memberNameMuted]}
                          numberOfLines={1}
                        >
                          {m.name}
                          {isCurrentUser ? ' (You)' : ''}
                        </Text>
                        {isSelected ? (
                          numVal > 0 ? (
                            <Text style={styles.livePctText}>{pct}% of total</Text>
                          ) : (
                            <Text style={styles.memberSubline}>Enter amount</Text>
                          )
                        ) : (
                          <Text style={styles.memberSublineMuted}>Didn't pay</Text>
                        )}
                      </View>

                      {/* Input Action Wrap (Right) */}
                      <View
                        style={styles.inputActionWrap}
                        pointerEvents={isSelected ? 'auto' : 'none'}
                      >
                        <TouchableOpacity
                          style={[styles.quickAllChip, !isSelected && styles.quickAllChipDisabled]}
                          onPress={() => handleQuickAssignAll(m.id)}
                          disabled={!isSelected}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.quickAllText, !isSelected && styles.quickAllTextDisabled]}>
                            All
                          </Text>
                        </TouchableOpacity>

                        <View
                          style={[
                            styles.currencyUnderlineBox,
                            !isSelected && styles.currencyUnderlineBoxLocked,
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
                              styles.currencyTextInput,
                              !isSelected && styles.currencyTextInputLocked,
                            ]}
                            placeholder="0.00"
                            placeholderTextColor={THEME.colors.textMuted}
                            keyboardType="decimal-pad"
                            returnKeyType="done"
                            value={isSelected ? val : '0.00'}
                            editable={isSelected}
                            onChangeText={(t) => handleAmountChange(m.id, t)}
                          />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </ScrollView>

          {/* Bottom Dock (For Multiple People Mode) */}
          {payerType === 'multiple' && (
            <View style={styles.bottomBar}>
              {errorMessage && (
                <View style={styles.errorStrip}>
                  <AlertCircle size={13} color={THEME.colors.negative} />
                  <Text style={styles.errorStripText}>{errorMessage}</Text>
                </View>
              )}

              <View style={styles.bottomStatRow}>
                <View>
                  <Text style={styles.bottomMainStat}>
                    ₹{sumOfPaid.toFixed(2)} of ₹{totalAmount.toFixed(2)}
                  </Text>
                  {isBalanced ? (
                    <Text style={[styles.bottomSubStat, styles.textMint]}>
                      Balanced
                    </Text>
                  ) : (
                    <TouchableOpacity onPress={handleAutoBalancePayer} activeOpacity={0.7}>
                      <Text style={[styles.bottomSubStat, styles.textWarning]}>
                        {remaining > 0
                          ? `₹${remaining.toFixed(2)} left · Tap to balance`
                          : `₹${Math.abs(remaining).toFixed(2)} over · Tap to balance`}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.confirmMultipleBtn, !isBalanced && styles.confirmBtnDisabled]}
                  onPress={handleConfirm}
                  activeOpacity={0.85}
                >
                  <Text style={styles.confirmBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  navActionBtn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarTitle: {
    flex: 1,
    marginLeft: 12,
    fontSize: 18,
    fontWeight: '700',
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
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  tabLabelActive: {
    color: THEME.colors.text,
    fontWeight: '700',
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginVertical: 3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  memberRowSelected: {
    backgroundColor: 'rgba(28, 194, 159, 0.06)',
    borderColor: 'rgba(28, 194, 159, 0.25)',
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    backgroundColor: THEME.colors.surfacePill,
    marginRight: 12,
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
    fontWeight: '700',
    color: THEME.colors.text,
  },
  memberInfo: {
    flex: 1,
    marginRight: 10,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
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
  memberSublineMuted: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  livePctText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primary,
    marginTop: 2,
  },
  checkIndicator: {
    paddingRight: 6,
  },
  multiHelperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  splitEquallyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(28, 194, 159, 0.1)',
  },
  splitEquallyText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.primary,
  },
  multiHelperRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  totalRequiredText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  allToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: THEME.colors.hairline,
  },
  allToggleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  squareCheckboxSmall: {
    width: 17,
    height: 17,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: THEME.colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  multiPayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginVertical: 3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  multiPayerRowUnselected: {
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
    marginRight: 12,
  },
  squareCheckboxChecked: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  inputActionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickAllChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: THEME.colors.hairlineLight,
  },
  quickAllChipDisabled: {
    opacity: 0.3,
  },
  quickAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  quickAllTextDisabled: {
    color: THEME.colors.textMuted,
  },
  currencyUnderlineBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: THEME.colors.primary,
    minWidth: 85,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  currencyUnderlineBoxLocked: {
    borderBottomColor: THEME.colors.hairlineLight,
    opacity: 0.5,
  },
  currencyPrefix: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.primary,
    marginRight: 4,
  },
  currencyPrefixLocked: {
    color: THEME.colors.textMuted,
  },
  currencyTextInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.text,
    padding: 0,
    textAlign: 'right',
  },
  currencyTextInputLocked: {
    color: THEME.colors.textMuted,
  },
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
    backgroundColor: THEME.colors.background,
    paddingHorizontal: 20,
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
    fontWeight: '600',
    color: THEME.colors.negative,
  },
  bottomStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomMainStat: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  bottomSubStat: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  textMint: {
    color: THEME.colors.primary,
  },
  textWarning: {
    color: THEME.colors.warning,
  },
  confirmMultipleBtn: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 10,
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.palette.black,
  },
});
