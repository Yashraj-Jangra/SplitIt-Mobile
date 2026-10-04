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
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setPayerType(initialPayerType);
      setSelectedSingleId(initialSinglePayerId || currentUserId || members[0]?.id || '');
      setErrorMessage(null);

      const amountsMap: Record<string, string> = {};
      if (initialMultiPayers && initialMultiPayers.length > 0) {
        initialMultiPayers.forEach((p) => {
          if (p.amount > 0) {
            amountsMap[p.userId] = String(p.amount);
          }
        });
      } else if (initialPayerType === 'multiple') {
        const primaryId = initialSinglePayerId || currentUserId || members[0]?.id;
        if (primaryId && totalAmount > 0) {
          amountsMap[primaryId] = totalAmount.toFixed(2);
        }
      }
      setPayerAmounts(amountsMap);

      const targetIdx = initialPayerType === 'multiple' ? 1 : 0;
      tabUnderlineAnim.setValue(targetIdx);

      setTimeout(() => {
        horizontalScrollRef.current?.scrollTo({ x: targetIdx * width, animated: false });
      }, 50);
    }
  }, [visible, initialPayerType, initialSinglePayerId, initialMultiPayers, members, currentUserId, totalAmount, width]);

  const sumOfPaid = useMemo(() => {
    return Object.values(payerAmounts).reduce((acc, val) => {
      const parsed = parseFloat(val);
      return acc + (isNaN(parsed) ? 0 : parsed);
    }, 0);
  }, [payerAmounts]);

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
    setPayerAmounts((prev) => ({
      ...prev,
      [userId]: cleaned,
    }));
  };

  const handleQuickAssignAll = (userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPayerAmounts({
      [userId]: totalAmount.toFixed(2),
    });
    setErrorMessage(null);
  };

  const handleSplitPaidEqually = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (members.length === 0 || totalAmount <= 0) return;
    const n = members.length;
    const baseShare = Math.floor((totalAmount / n) * 100) / 100;
    const rem = parseFloat((totalAmount - baseShare * n).toFixed(2));
    const extraPennies = Math.round(rem * 100);

    const newMap: Record<string, string> = {};
    members.forEach((m, idx) => {
      const share = idx < extraPennies ? baseShare + 0.01 : baseShare;
      newMap[m.id] = share.toFixed(2);
    });
    setPayerAmounts(newMap);
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
              <ArrowLeft size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <Text style={styles.appBarTitle}>Who paid?</Text>

            <TouchableOpacity onPress={handleConfirm} style={styles.navActionBtn} activeOpacity={0.7}>
              <Check size={24} color="#FFFFFF" strokeWidth={2.5} />
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
                          <Check size={18} color="#1CC29F" strokeWidth={2.5} />
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
                  <Sparkles size={12} color="#1CC29F" />
                  <Text style={styles.splitEquallyText}>Split paid equally</Text>
                </TouchableOpacity>

                <Text style={styles.totalRequiredText}>
                  Total: ₹{totalAmount.toFixed(2)}
                </Text>
              </View>

              <ScrollView
                style={styles.verticalList}
                contentContainerStyle={styles.verticalListContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
              >
                {members.map((m) => {
                  const val = payerAmounts[m.id] || '';
                  const numVal = parseFloat(val) || 0;
                  const pct = totalAmount > 0 ? ((numVal / totalAmount) * 100).toFixed(1) : '0';
                  const isCurrentUser = currentUserId === m.id;

                  return (
                    <View key={m.id} style={styles.multiPayerRow}>
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
                        {numVal > 0 ? (
                          <Text style={styles.livePctText}>{pct}% of total</Text>
                        ) : (
                          <Text style={styles.memberSublineMuted}>Didn't pay</Text>
                        )}
                      </View>

                      <View style={styles.inputActionWrap}>
                        <TouchableOpacity
                          style={styles.quickAllChip}
                          onPress={() => handleQuickAssignAll(m.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.quickAllText}>All</Text>
                        </TouchableOpacity>

                        <View style={styles.currencyUnderlineBox}>
                          <Text style={styles.currencyPrefix}>₹</Text>
                          <TextInput
                            style={styles.currencyTextInput}
                            placeholder="0.00"
                            placeholderTextColor="#6B7280"
                            keyboardType="decimal-pad"
                            value={val}
                            onChangeText={(t) => handleAmountChange(m.id, t)}
                          />
                        </View>
                      </View>
                    </View>
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
                  <AlertCircle size={13} color="#F43F5E" />
                  <Text style={styles.errorStripText}>{errorMessage}</Text>
                </View>
              )}

              <View style={styles.bottomStatRow}>
                <View>
                  <Text style={styles.bottomMainStat}>
                    ₹{sumOfPaid.toFixed(2)} of ₹{totalAmount.toFixed(2)}
                  </Text>
                  <Text
                    style={[
                      styles.bottomSubStat,
                      isBalanced ? styles.textMint : styles.textWarning,
                    ]}
                  >
                    {isBalanced
                      ? 'Balanced'
                      : remaining > 0
                      ? `₹${remaining.toFixed(2)} left to allocate`
                      : `₹${Math.abs(remaining).toFixed(2)} over total`}
                  </Text>
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
    backgroundColor: '#18191B',
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
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tabUnderline: {
    height: 3,
    backgroundColor: '#FFFFFF',
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
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  memberRowSelected: {
    backgroundColor: 'rgba(28, 194, 159, 0.05)',
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
  memberSubline: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  memberSublineMuted: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  livePctText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1CC29F',
    marginTop: 2,
  },
  checkIndicator: {
    paddingRight: 6,
  },
  multiHelperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
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
    color: '#1CC29F',
  },
  totalRequiredText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  multiPayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  quickAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  currencyUnderlineBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: '#1CC29F',
    minWidth: 85,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  currencyPrefix: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1CC29F',
    marginRight: 4,
  },
  currencyTextInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    padding: 0,
    textAlign: 'right',
  },
  bottomBar: {
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
    marginBottom: 8,
  },
  errorStripText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F43F5E',
  },
  bottomStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomMainStat: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bottomSubStat: {
    fontSize: 12,
    marginTop: 2,
  },
  textMint: {
    color: '#1CC29F',
    fontWeight: '600',
  },
  textWarning: {
    color: '#F59E0B',
    fontWeight: '600',
  },
  confirmMultipleBtn: {
    backgroundColor: '#1CC29F',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  confirmBtnDisabled: {
    backgroundColor: '#2A2B2E',
    opacity: 0.5,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
});
