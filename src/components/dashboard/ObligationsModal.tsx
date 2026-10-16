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
  Users,
  ArrowRight,
} from 'lucide-react-native';
import { THEME } from '../../constants/theme';
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
  const { formatCurrency, currencySymbol } = useCurrency();
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
        {/* Total Summary Strip */}
        <View style={styles.summaryBox}>
          <View>
            <Text style={styles.summaryLabel}>
              {isOwed ? 'TOTAL RECEIVABLE' : 'TOTAL PAYABLE'}
            </Text>
            <Text
              style={[
                styles.summaryAmount,
                { color: isOwed ? THEME.colors.primary : THEME.colors.negative },
              ]}
            >
              {formatCurrency(totalAmount, { decimals: 2 })}
            </Text>
          </View>

          {isOwed && obligations.length > 1 && (
            <TouchableOpacity
              style={styles.remindAllBtn}
              activeOpacity={0.8}
              onPress={handleRemindAll}
              disabled={isRemindingAll}
            >
              {isRemindingAll ? (
                <QuantumSpinner size={16} color={THEME.colors.background} />
              ) : (
                <>
                  <Send size={13} color={THEME.colors.background} />
                  <Text style={styles.remindAllText}>Remind All</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Obligations List */}
        {obligations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <ShieldCheck size={32} color={THEME.colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>All Settled Up!</Text>
            <Text style={styles.emptySubtitle}>
              {isOwed
                ? 'Nobody owes you anything right now.'
                : 'You have zero outstanding debts across all groups.'}
            </Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {obligations.map((item, index) => {
              const isReminding = remindingUserIds.has(item.user.id);
              const isReminded = remindedUserIds.has(item.user.id);
              const isLast = index === obligations.length - 1;

              return (
                <View
                  key={item.user.id}
                  style={[styles.itemCard, !isLast && styles.itemCardBorder]}
                >
                  <View style={styles.itemHeaderRow}>
                    {/* User Avatar */}
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

                    {/* Name & Details */}
                    <View style={styles.userDetails}>
                      <Text style={styles.userName} numberOfLines={1}>
                        {item.user.name}
                      </Text>
                      {item.user.upiId ? (
                        <Text style={styles.userSub} numberOfLines={1}>
                          UPI: {item.user.upiId}
                        </Text>
                      ) : item.user.email ? (
                        <Text style={styles.userSub} numberOfLines={1}>
                          {item.user.email}
                        </Text>
                      ) : null}
                    </View>

                    {/* Amount & Main Action */}
                    <View style={styles.actionCol}>
                      <Text
                        style={[
                          styles.amountText,
                          { color: isOwed ? THEME.colors.primary : THEME.colors.negative },
                        ]}
                      >
                        {formatCurrency(item.amount, { decimals: 2 })}
                      </Text>

                      {isOwed ? (
                        <TouchableOpacity
                          style={[
                            styles.actionBtn,
                            isReminded && styles.actionBtnDone,
                          ]}
                          activeOpacity={0.7}
                          onPress={() => handleSendReminder(item)}
                          disabled={isReminding || isReminded}
                        >
                          {isReminding ? (
                            <QuantumSpinner size={14} color={THEME.colors.text} />
                          ) : isReminded ? (
                            <>
                              <CheckCircle2 size={12} color={THEME.colors.primary} />
                              <Text style={styles.actionBtnTextDone}>Sent</Text>
                            </>
                          ) : (
                            <>
                              <Bell size={12} color={THEME.colors.text} />
                              <Text style={styles.actionBtnText}>Remind</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.actionBtnSettle}
                          activeOpacity={0.8}
                          onPress={() => handleSettleUp(item)}
                        >
                          <Text style={styles.actionBtnSettleText}>Settle Up</Text>
                          <ChevronRight size={13} color={THEME.colors.background} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Shared Groups Breakdown Pills */}
                  {item.sharedGroups.length > 0 && (
                    <View style={styles.groupsRow}>
                      {item.sharedGroups.map((sg) => (
                        <TouchableOpacity
                          key={sg.groupId}
                          style={styles.groupPill}
                          activeOpacity={0.7}
                          onPress={() => {
                            if (!isOwed) {
                              handleSettleUp(item, sg);
                            }
                          }}
                        >
                          <Text style={styles.groupPillName} numberOfLines={1}>
                            {sg.groupName}
                          </Text>
                          <Text style={styles.groupPillAmount}>
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  summaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  summaryAmount: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: -0.5,
  },
  remindAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  remindAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.background,
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
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
  listContainer: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    overflow: 'hidden',
  },
  itemCard: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  itemCardBorder: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarImg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 12,
  },
  avatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  userDetails: {
    flex: 1,
    marginRight: 10,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  userSub: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  actionCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  amountText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  actionBtnDone: {
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  actionBtnTextDone: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.primary,
  },
  actionBtnSettle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  actionBtnSettleText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.background,
  },
  groupsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    paddingLeft: 54,
  },
  groupPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  groupPillName: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
    maxWidth: 120,
  },
  groupPillAmount: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.text,
  },
});
