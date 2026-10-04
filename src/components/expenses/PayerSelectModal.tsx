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
import { X, Check, Users, User, AlertCircle, Sparkles, MoveHorizontal } from 'lucide-react-native';
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

const PAYER_MODES: Array<{ type: 'single' | 'multiple'; label: string; hint: string }> = [
  { type: 'single', label: 'Single Person', hint: 'One member paid the entire bill' },
  { type: 'multiple', label: 'Multiple People', hint: 'Shared payment across multiple contributors' },
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

  const [payerType, setPayerType] = useState<'single' | 'multiple'>(initialPayerType);
  const [selectedSingleId, setSelectedSingleId] = useState<string>(
    initialSinglePayerId || currentUserId || members[0]?.id || ''
  );
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync initial state when modal opens
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
      setTimeout(() => {
        horizontalScrollRef.current?.scrollTo({ x: targetIdx * width, animated: false });
      }, 60);
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
    }
  };

  // Strict .2f amount input handler
  const handleAmountChange = (userId: string, text: string) => {
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
    const remainder = parseFloat((totalAmount - baseShare * n).toFixed(2));
    const extraPennies = Math.round(remainder * 100);

    const newMap: Record<string, string> = {};
    members.forEach((m, idx) => {
      const share = idx < extraPennies ? baseShare + 0.01 : baseShare;
      newMap[m.id] = share.toFixed(2);
    });
    setPayerAmounts(newMap);
    setErrorMessage(null);
  };

  const handleClearAll = () => {
    Haptics.selectionAsync();
    setPayerAmounts({});
    setErrorMessage(null);
  };

  const handleConfirmMultiple = () => {
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

  const activeModeInfo = payerType === 'multiple' ? PAYER_MODES[1] : PAYER_MODES[0];

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
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Who paid?</Text>
              <Text style={styles.subtitle}>
                Total expense: <Text style={styles.boldText}>₹{totalAmount.toFixed(2)}</Text>
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={18} color={THEME.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Segmented Mode Selector: Single vs Multiple */}
          <View style={styles.modeTabs}>
            <TouchableOpacity
              style={[styles.modeTab, payerType === 'single' && styles.modeTabActive]}
              onPress={() => handleModeTabPress('single')}
              activeOpacity={0.8}
            >
              <User
                size={15}
                color={payerType === 'single' ? THEME.colors.primary : THEME.colors.textMuted}
              />
              <Text style={[styles.modeTabText, payerType === 'single' && styles.modeTabTextActive]}>
                Single Person
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeTab, payerType === 'multiple' && styles.modeTabActive]}
              onPress={() => handleModeTabPress('multiple')}
              activeOpacity={0.8}
            >
              <Users
                size={15}
                color={payerType === 'multiple' ? THEME.colors.primary : THEME.colors.textMuted}
              />
              <Text style={[styles.modeTabText, payerType === 'multiple' && styles.modeTabTextActive]}>
                Multiple People
              </Text>
            </TouchableOpacity>
          </View>

          {/* Mode Hint & Swipe Strip */}
          <View style={styles.hintStrip}>
            <Text style={styles.hintText}>{activeModeInfo.hint}</Text>
            <View style={styles.swipeHintWrap}>
              <MoveHorizontal size={12} color={THEME.colors.textMuted} />
              <Text style={styles.swipeHintText}>Swipe page</Text>
            </View>
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
            {/* Page 0: SINGLE PERSON PICKER */}
            <View style={{ width, flex: 1 }}>
              <ScrollView
                style={styles.verticalList}
                contentContainerStyle={styles.verticalListContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
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
                            <Text style={styles.avatarInitial}>{m.name.charAt(0).toUpperCase()}</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.memberInfo}>
                        <Text
                          style={[styles.memberName, isSelected && styles.memberNameSelected]}
                          numberOfLines={1}
                        >
                          {m.name}
                          {isCurrentUser ? ' (You)' : ''}
                        </Text>
                        <Text style={styles.memberSubtitle}>
                          {isSelected ? `Paid full ₹${totalAmount.toFixed(2)}` : 'Tap to select'}
                        </Text>
                      </View>

                      <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                        {isSelected && <Check size={14} color="#000000" strokeWidth={3} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Page 1: MULTIPLE PEOPLE MATRIX */}
            <View style={{ width, flex: 1 }}>
              {/* Quick Helper Toolbar */}
              <View style={styles.multiHelperRow}>
                <TouchableOpacity
                  style={styles.helperChip}
                  onPress={handleSplitPaidEqually}
                  activeOpacity={0.7}
                >
                  <Sparkles size={12} color={THEME.colors.primary} />
                  <Text style={styles.helperChipText}>Split paid equally</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.helperChip}
                  onPress={handleClearAll}
                  activeOpacity={0.7}
                >
                  <Text style={styles.helperChipTextMuted}>Clear all</Text>
                </TouchableOpacity>
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
                  const pctOfTotal = totalAmount > 0 ? ((numVal / totalAmount) * 100).toFixed(1) : '0';
                  const isCurrentUser = currentUserId === m.id;

                  return (
                    <View key={m.id} style={styles.multiPayerRow}>
                      <View style={styles.avatarWrap}>
                        {m.avatarUrl ? (
                          <Image source={{ uri: m.avatarUrl }} style={styles.avatarImg} />
                        ) : (
                          <View style={styles.avatarFallback}>
                            <Text style={styles.avatarInitial}>{m.name.charAt(0).toUpperCase()}</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName} numberOfLines={1}>
                          {m.name}
                          {isCurrentUser ? ' (You)' : ''}
                        </Text>
                        {numVal > 0 ? (
                          <Text style={styles.livePctText}>{pctOfTotal}% of total</Text>
                        ) : (
                          <Text style={styles.memberSubtitle}>Didn't pay</Text>
                        )}
                      </View>

                      <View style={styles.inputAndQuickAction}>
                        <TouchableOpacity
                          style={styles.quickAllBtn}
                          onPress={() => handleQuickAssignAll(m.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.quickAllText}>All</Text>
                        </TouchableOpacity>

                        <View style={styles.currencyInputBox}>
                          <Text style={styles.currencyPrefix}>₹</Text>
                          <TextInput
                            style={styles.currencyInput}
                            placeholder="0.00"
                            placeholderTextColor={THEME.colors.textMuted}
                            keyboardType="decimal-pad"
                            value={val}
                            onChangeText={(text) => handleAmountChange(m.id, text)}
                          />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </ScrollView>

          {/* Bottom Dock (Always Visible for Multiple Mode) */}
          {payerType === 'multiple' && (
            <View style={styles.bottomDock}>
              {errorMessage && (
                <View style={styles.errorBanner}>
                  <AlertCircle size={14} color={THEME.colors.negative} />
                  <Text style={styles.errorBannerText}>{errorMessage}</Text>
                </View>
              )}

              <View style={styles.summaryRow}>
                <View>
                  <Text style={styles.summaryLabel}>TOTAL PAID</Text>
                  <Text style={styles.summaryAmount}>₹{sumOfPaid.toFixed(2)}</Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.summaryLabel}>STATUS</Text>
                  {isBalanced ? (
                    <View style={styles.statusBadgeGreen}>
                      <Check size={12} color={THEME.colors.primary} strokeWidth={3} />
                      <Text style={styles.statusTextGreen}>Balanced</Text>
                    </View>
                  ) : remaining > 0 ? (
                    <Text style={[styles.statusText, styles.textUnder]}>
                      ₹{remaining.toFixed(2)} left
                    </Text>
                  ) : (
                    <Text style={[styles.statusText, styles.textOver]}>
                      ₹{Math.abs(remaining).toFixed(2)} over
                    </Text>
                  )}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.confirmBtn, !isBalanced && styles.confirmBtnDisabled]}
                onPress={handleConfirmMultiple}
                activeOpacity={0.85}
              >
                <Check size={16} color="#000000" strokeWidth={2.5} />
                <Text style={styles.confirmBtnText}>
                  {isBalanced
                    ? `Confirm Payers (₹${totalAmount.toFixed(2)})`
                    : 'Balance Total to Confirm'}
                </Text>
              </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    borderRadius: THEME.radius.md,
  },
  modeTabActive: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textMuted,
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
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: THEME.radius.lg,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  memberRowSelected: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    backgroundColor: '#27272A',
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
    backgroundColor: THEME.colors.surface,
  },
  avatarInitial: {
    fontSize: 14,
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
  memberNameSelected: {
    color: THEME.colors.text,
  },
  memberSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  livePctText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.primary,
    marginTop: 2,
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: THEME.colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.primary,
  },
  multiHelperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  helperChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  helperChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.primary,
  },
  helperChipTextMuted: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  multiPayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.lg,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  inputAndQuickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickAllBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  quickAllText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  currencyInputBox: {
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
  currencyPrefix: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginRight: 4,
  },
  currencyInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
    paddingVertical: 0,
    textAlign: 'right',
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
