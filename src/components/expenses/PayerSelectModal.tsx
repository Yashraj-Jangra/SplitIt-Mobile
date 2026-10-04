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
import { X, Check, Users, User, AlertCircle, Sparkles } from 'lucide-react-native';
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
        // Default first payer or current user to total
        const primaryId = initialSinglePayerId || currentUserId || members[0]?.id;
        if (primaryId && totalAmount > 0) {
          amountsMap[primaryId] = String(totalAmount);
        }
      }
      setPayerAmounts(amountsMap);
    }
  }, [visible, initialPayerType, initialSinglePayerId, initialMultiPayers, members, currentUserId, totalAmount]);

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

  const handleAmountChange = (userId: string, text: string) => {
    setErrorMessage(null);
    const cleaned = text.replace(/[^0-9.]/g, '');
    setPayerAmounts((prev) => ({
      ...prev,
      [userId]: cleaned,
    }));
  };

  const handleQuickAssignAll = (userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPayerAmounts({
      [userId]: String(totalAmount.toFixed(2)),
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
      newMap[m.id] = String(share.toFixed(2));
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
              onPress={() => {
                Haptics.selectionAsync();
                setPayerType('single');
                setErrorMessage(null);
              }}
              activeOpacity={0.8}
            >
              <User size={15} color={payerType === 'single' ? THEME.colors.primary : THEME.colors.textMuted} />
              <Text style={[styles.modeTabText, payerType === 'single' && styles.modeTabTextActive]}>
                Single Person
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeTab, payerType === 'multiple' && styles.modeTabActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setPayerType('multiple');
                setErrorMessage(null);
              }}
              activeOpacity={0.8}
            >
              <Users size={15} color={payerType === 'multiple' ? THEME.colors.primary : THEME.colors.textMuted} />
              <Text style={[styles.modeTabText, payerType === 'multiple' && styles.modeTabTextActive]}>
                Multiple People
              </Text>
            </TouchableOpacity>
          </View>

          {/* SINGLE PERSON LIST */}
          {payerType === 'single' ? (
            <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
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
                      <Text style={[styles.memberName, isSelected && styles.memberNameSelected]} numberOfLines={1}>
                        {m.name}
                        {isCurrentUser ? ' (You)' : ''}
                      </Text>
                      <Text style={styles.memberSubtitle}>
                        {isSelected ? 'Pays full ₹' + totalAmount.toFixed(2) : 'Tap to select'}
                      </Text>
                    </View>

                    <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                      {isSelected && <Check size={14} color="#000000" strokeWidth={3} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            /* MULTIPLE PEOPLE LIST */
            <View style={{ flex: 1 }}>
              {/* Quick helper toolbar */}
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

              <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
                {members.map((m) => {
                  const val = payerAmounts[m.id] || '';
                  const numVal = parseFloat(val) || 0;
                  const isCurrentUser = currentUserId === m.id;

                  return (
                    <View key={m.id} style={styles.multiRow}>
                      <View style={styles.avatarWrap}>
                        {m.avatarUrl ? (
                          <Image source={{ uri: m.avatarUrl }} style={styles.avatarImg} />
                        ) : (
                          <View style={styles.avatarFallback}>
                            <Text style={styles.avatarInitial}>{m.name.charAt(0).toUpperCase()}</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.multiMemberInfo}>
                        <Text style={styles.memberName} numberOfLines={1}>
                          {m.name}
                          {isCurrentUser ? ' (You)' : ''}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleQuickAssignAll(m.id)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Text style={styles.assignAllText}>Paid all</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Currency Input Field */}
                      <View style={[styles.inputBox, numVal > 0 && styles.inputBoxActive]}>
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
                  );
                })}
              </ScrollView>

              {/* Bottom Multi-Payer Summary & Confirm Dock */}
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
                        <Check size={12} color="#10B981" strokeWidth={3} />
                        <Text style={styles.statusTextGreen}>Balanced</Text>
                      </View>
                    ) : (
                      <Text style={[styles.statusText, remaining > 0 ? styles.textUnder : styles.textOver]}>
                        {remaining > 0 ? `₹${remaining.toFixed(2)} left` : `₹${Math.abs(remaining).toFixed(2)} over`}
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
                    {isBalanced ? 'Confirm Payers' : 'Balance Amounts to Confirm'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
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
    maxHeight: '85%',
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
    marginBottom: 12,
    backgroundColor: THEME.colors.background,
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
    gap: 6,
    paddingVertical: 9,
    borderRadius: THEME.radius.md,
  },
  modeTabActive: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
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
  listContainer: {
    paddingHorizontal: 16,
    maxHeight: 320,
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
    marginBottom: 8,
  },
  memberRowSelected: {
    borderColor: THEME.colors.primary,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
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
    backgroundColor: THEME.colors.surfaceElevated,
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
    fontWeight: '600',
    color: THEME.colors.text,
  },
  memberNameSelected: {
    color: THEME.colors.primary,
    fontWeight: '700',
  },
  memberSubtitle: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
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
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  helperChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    fontWeight: '500',
    color: THEME.colors.textMuted,
  },
  multiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.lg,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    marginBottom: 8,
  },
  multiMemberInfo: {
    flex: 1,
    marginRight: 10,
  },
  assignAllText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.primary,
    marginTop: 2,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.background,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    paddingHorizontal: 10,
    width: 110,
    height: 38,
  },
  inputBoxActive: {
    borderColor: THEME.colors.primary,
  },
  currencyPrefix: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    marginRight: 4,
  },
  currencyInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
    paddingVertical: 0,
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
