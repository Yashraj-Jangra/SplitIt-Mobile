import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { QuantumSpinner } from '../brand/QuantumLogo';
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Send,
  ArrowRight,
} from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { useAppTheme } from '../../contexts/theme.context';
import { BottomSheetModal } from '../common/BottomSheetModal';
import { ObligationItem, SharedGroupBalance } from '../../services/balance.service';
import { notificationService } from '../../services/notification.service';
import { useCurrency } from '../../contexts/currency.context';
import { haptics } from '../../services/haptics.service';

export interface ObligationsModalProps {
  visible: boolean;
  onClose: () => void;
  type: 'owed' | 'owes';
  obligations: ObligationItem[];
  totalAmount: number;
}

export function ObligationsModal({
  visible,
  onClose,
  type,
  obligations,
  totalAmount,
}: ObligationsModalProps) {
  const router = useRouter();
  const { formatCurrency } = useCurrency();
  const { currentAccent } = useAppTheme();
  const [remindingUserIds, setRemindingUserIds] = useState<Set<string>>(new Set());
  const [remindedUserIds, setRemindedUserIds] = useState<Set<string>>(new Set());
  const [isRemindingAll, setIsRemindingAll] = useState(false);

  const isOwed = type === 'owed';
  const title = isOwed ? 'Owed to You' : 'You Owe';
  const subtitle = isOwed
    ? `From ${obligations.length} ${obligations.length === 1 ? 'person' : 'people'}`
    : `To ${obligations.length} ${obligations.length === 1 ? 'person' : 'people'}`;

  const handleSendReminder = async (obligation: ObligationItem) => {
    const userId = obligation.user.id;
    if (remindingUserIds.has(userId) || remindedUserIds.has(userId)) return;

    haptics.tap();
    setRemindingUserIds((prev) => new Set(prev).add(userId));

    try {
      const topGroup = obligation.sharedGroups[0];
      const res = await notificationService.sendPaymentReminder({
        debtorId: userId,
        amount: obligation.amount,
        groupName: topGroup?.groupName,
        groupId: topGroup?.groupId,
        sendEmail: true,
      });

      if (res.success) {
        haptics.saveSuccess();
        setRemindedUserIds((prev) => new Set(prev).add(userId));
      } else {
        haptics.error();
        Alert.alert('Reminder Notice', res.error || 'Could not send reminder. Please try again.');
      }
    } catch {
      haptics.error();
      Alert.alert('Reminder Notice', 'Network connection error.');
    } finally {
      setRemindingUserIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleRemindAll = async () => {
    if (isRemindingAll || obligations.length === 0) return;
    haptics.confirm();
    setIsRemindingAll(true);

    try {
      let sentCount = 0;
      for (const item of obligations) {
        const topGroup = item.sharedGroups[0];
        const res = await notificationService.sendPaymentReminder({
          debtorId: item.user.id,
          amount: item.amount,
          groupName: topGroup?.groupName,
          groupId: topGroup?.groupId,
          sendEmail: true,
        });
        if (res.success) {
          sentCount++;
          setRemindedUserIds((prev) => new Set(prev).add(item.user.id));
        }
      }

      haptics.saveSuccess();
      Alert.alert('Reminders Sent', `Sent payment reminders to ${sentCount} people.`);
    } catch {
      haptics.error();
      Alert.alert('Notice', 'Failed to send all reminders.');
    } finally {
      setIsRemindingAll(false);
    }
  };

  const handleSettleUp = (obligation: ObligationItem, specificGroup?: SharedGroupBalance) => {
    haptics.tap();
    onClose();

    const targetGroupId = specificGroup?.groupId || obligation.sharedGroups[0]?.groupId;
    const targetAmount = specificGroup?.amount || obligation.amount;

    router.push({
      pathname: '/settle/new',
      params: {
        payeeId: obligation.user.id,
        payeeName: obligation.user.name,
        groupId: targetGroupId,
        amount: String(targetAmount),
      },
    });
  };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      maxHeight="86%"
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Open Editorial Hero Net Total (No Outer Box Card) */}
        <View style={styles.heroSection}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroEyebrow}>
              {isOwed ? 'TOTAL RECEIVABLE' : 'TOTAL PAYABLE'}
            </Text>
            <Text
              style={[
                styles.heroAmount,
                {
                  color: isOwed
                    ? totalAmount > 0.009
                      ? THEME.colors.success
                      : THEME.colors.textMuted
                    : totalAmount > 0.009
                    ? THEME.colors.negative
                    : THEME.colors.textMuted,
                },
              ]}
            >
              {formatCurrency(totalAmount, { decimals: 2 })}
            </Text>
          </View>

          {isOwed && obligations.length > 1 && (
            <TouchableOpacity
              style={[styles.remindAllPill, { backgroundColor: currentAccent.primary }]}
              activeOpacity={0.8}
              onPress={handleRemindAll}
              disabled={isRemindingAll}
              accessibilityRole="button"
              accessibilityLabel="Remind all people"
            >
              {isRemindingAll ? (
                <QuantumSpinner size={13} color={THEME.colors.primaryForeground} />
              ) : (
                <>
                  <Send size={12} color={THEME.colors.primaryForeground} />
                  <Text style={styles.remindAllText}>Remind All ({obligations.length})</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.hairlineDivider} />

        {/* Obligations Ledger Rows (Anti-Card Soup: No Outer Container Box) */}
        {obligations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: currentAccent.primaryMuted }]}>
              <ShieldCheck size={32} color={currentAccent.primary} />
            </View>
            <Text style={styles.emptyTitle}>All Settled Up!</Text>
            <Text style={styles.emptySubtitle}>
              {isOwed
                ? 'Nobody owes you anything right now.'
                : 'You have zero outstanding debts across all groups.'}
            </Text>
          </View>
        ) : (
          <View style={styles.ledgerContainer}>
            {obligations.map((item) => {
              const isReminding = remindingUserIds.has(item.user.id);
              const isReminded = remindedUserIds.has(item.user.id);

              return (
                <View key={item.user.id} style={styles.ledgerRow}>
                  {/* Main Identity & Impact Line */}
                  <View style={styles.rowMain}>
                    {/* Avatar Node with Status Node Dot */}
                    <View style={styles.avatarWrap}>
                      {item.user.avatarUrl ? (
                        <Image
                          source={{ uri: item.user.avatarUrl }}
                          style={styles.avatarImg}
                        />
                      ) : (
                        <View style={styles.avatarFallback}>
                          <Text style={styles.avatarText}>
                            {getInitials(item.user.name)}
                          </Text>
                        </View>
                      )}
                      <View
                        style={[
                          styles.avatarStatusNode,
                          { backgroundColor: isOwed ? THEME.colors.success : THEME.colors.negative },
                        ]}
                      />
                    </View>

                    {/* Name & UPI / Details */}
                    <View style={styles.userCol}>
                      <Text style={styles.userName} numberOfLines={1}>
                        {item.user.name}
                      </Text>
                      <Text style={styles.userSub} numberOfLines={1}>
                        {item.user.upiId
                          ? `UPI: ${item.user.upiId}`
                          : item.user.email
                          ? item.user.email
                          : `${item.sharedGroups.length} shared group${item.sharedGroups.length === 1 ? '' : 's'}`}
                      </Text>
                    </View>

                    {/* Amount & Direct Action */}
                    <View style={styles.actionCol}>
                      <Text
                        style={[
                          styles.amountValue,
                          { color: isOwed ? THEME.colors.success : THEME.colors.negative },
                        ]}
                      >
                        {formatCurrency(item.amount, { decimals: 2 })}
                      </Text>

                      {isOwed ? (
                        <TouchableOpacity
                          style={[
                            styles.remindBtn,
                            isReminded && styles.remindBtnDone,
                            isReminded && {
                              backgroundColor: currentAccent.primaryMuted,
                              borderColor: currentAccent.borderFocus,
                            },
                          ]}
                          activeOpacity={0.7}
                          onPress={() => handleSendReminder(item)}
                          disabled={isReminding || isReminded}
                          accessibilityRole="button"
                          accessibilityLabel={`Remind ${item.user.name}`}
                        >
                          {isReminding ? (
                            <QuantumSpinner size={12} color={THEME.colors.text} />
                          ) : isReminded ? (
                            <>
                              <CheckCircle2 size={11} color={currentAccent.primary} />
                              <Text style={[styles.remindBtnTextDone, { color: currentAccent.primary }]}>Sent</Text>
                            </>
                          ) : (
                            <>
                              <Bell size={11} color={THEME.colors.text} />
                              <Text style={styles.remindBtnText}>Remind</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.settleBtn, { backgroundColor: currentAccent.primary }]}
                          activeOpacity={0.8}
                          onPress={() => handleSettleUp(item)}
                          accessibilityRole="button"
                          accessibilityLabel={`Settle up with ${item.user.name}`}
                        >
                          <Text style={styles.settleBtnText}>Settle</Text>
                          <ChevronRight size={12} color={THEME.colors.primaryForeground} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Visual Connecting Stem with Shared Group Breakdown */}
                  {item.sharedGroups.length > 0 && (
                    <View style={styles.stemContainer}>
                      {item.sharedGroups.map((sg) => (
                        <TouchableOpacity
                          key={sg.groupId}
                          style={styles.stemRow}
                          activeOpacity={isOwed ? 1 : 0.7}
                          onPress={() => {
                            if (!isOwed) {
                              handleSettleUp(item, sg);
                            }
                          }}
                          disabled={isOwed}
                        >
                          <View style={styles.stemDot} />
                          <Text style={styles.stemGroupName} numberOfLines={1}>
                            {sg.groupName}
                          </Text>
                          <Text style={styles.stemAmount}>
                            {formatCurrency(sg.amount, { decimals: 0 })}
                          </Text>
                          {!isOwed && (
                            <ArrowRight size={10} color={THEME.colors.textMuted} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  // Universal Width: 0 horizontal padding here preserves standard 16px screen padding from BottomSheetModal
  scrollContent: {
    paddingHorizontal: 0,
    paddingBottom: 32,
  },
  // Open Editorial Hero Total
  heroSection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  heroLeft: {
    gap: 3,
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 38,
  },
  remindAllPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: THEME.radius.full,
    marginBottom: 4,
  },
  remindAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primaryForeground,
  },
  hairlineDivider: {
    height: 1,
    backgroundColor: THEME.colors.hairline,
    marginTop: 8,
    marginBottom: 4,
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 196, 204, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  // Open Ledger Rows
  ledgerContainer: {
    width: '100%',
  },
  ledgerRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.colors.hairline,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    position: 'relative',
    width: 40,
    height: 40,
    marginRight: 12,
  },
  avatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairlineLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  avatarStatusNode: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: THEME.colors.surface,
  },
  userCol: {
    flex: 1,
    marginRight: 8,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.text,
    letterSpacing: -0.2,
  },
  userSub: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  actionCol: {
    alignItems: 'flex-end',
    gap: 5,
  },
  amountValue: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  remindBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairlineLight,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: THEME.radius.full,
  },
  remindBtnDone: {
    backgroundColor: THEME.colors.successMuted,
    borderColor: THEME.colors.successBorder,
  },
  remindBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  remindBtnTextDone: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  settleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: THEME.radius.full,
  },
  settleBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.primaryForeground,
  },
  // Visual Stem Lines for Shared Groups
  stemContainer: {
    marginLeft: 19,
    paddingLeft: 18,
    borderLeftWidth: 1,
    borderLeftColor: THEME.colors.hairline,
    marginTop: 8,
    gap: 6,
  },
  stemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  stemDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: THEME.colors.textMuted,
  },
  stemGroupName: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
    maxWidth: 160,
  },
  stemAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.text,
  },
});

