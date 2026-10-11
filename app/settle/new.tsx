import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Image,
  AppState,
  AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  X,
  ArrowRight,
  ArrowLeftRight,
  Check,
  Lock,
  QrCode,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/auth.context';
import { groupService, GroupMember, GroupDetailData } from '../../src/services/group.service';
import { settlementService } from '../../src/services/settlement.service';
import { useNetwork } from '../../src/contexts/network.context';
import { launchUpiPayment } from '../../src/utils/upi';
import * as Haptics from 'expo-haptics';

export default function SettleUpModal() {
  const router = useRouter();
  const { requireOnline } = useNetwork();
  const { user } = useAuth();
  const currentUserId = user?.id || '';
  const currentUserName = user?.name || 'You';

  const params = useLocalSearchParams<{
    groupId?: string;
    debtorId?: string;
    debtorName?: string;
    creditorId?: string;
    creditorName?: string;
    amount?: string;
    upiId?: string;
  }>();

  // 1. Group & Member Real Data
  const [group, setGroup] = useState<GroupDetailData | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoadingGroup, setIsLoadingGroup] = useState(true);

  // 2. Settlement Parties State
  const [payerId, setPayerId] = useState<string>(() => params.debtorId || currentUserId);
  const [receiverId, setReceiverId] = useState<string>(() => params.creditorId || '');

  // 3. User Picker Modal
  const [activePicker, setActivePicker] = useState<'payer' | 'receiver' | null>(null);

  // 4. Form Fields
  const [amount, setAmount] = useState(params.amount || '');
  const [notes, setNotes] = useState('SplitIt settlement');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load real group data and members
  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        let targetGId = params.groupId;
        if (!targetGId) {
          const userGroups = await groupService.getUserGroups();
          if (userGroups && userGroups.length > 0) {
            targetGId = userGroups[0].id;
          }
        }

        if (targetGId) {
          const inMem = groupService.getInMemoryGroupDetail(targetGId);
          if (inMem && active) {
            setGroup(inMem);
            if (inMem.members && inMem.members.length > 0) {
              setMembers(inMem.members);
              setPayerId((prev) => (prev || inMem.members?.find((m) => m.id === currentUserId)?.id || inMem.members?.[0]?.id || ''));
              setReceiverId((prev) => (prev || inMem.members?.find((m) => m.id !== currentUserId)?.id || inMem.members?.[0]?.id || ''));
            }
            setIsLoadingGroup(false);
          }

          const fresh = await groupService.getGroupDetails(targetGId);
          if (fresh && active) {
            setGroup(fresh);
            if (fresh.members && fresh.members.length > 0) {
              setMembers(fresh.members);
              setPayerId((prev) => (prev || fresh.members?.find((m) => m.id === currentUserId)?.id || fresh.members?.[0]?.id || ''));
              setReceiverId((prev) => (prev || fresh.members?.find((m) => m.id !== currentUserId)?.id || fresh.members?.[0]?.id || ''));
            }
          }
        }
      } catch {
        // Handled gracefully
      } finally {
        if (active) setIsLoadingGroup(false);
      }
    };

    loadData();
    return () => {
      active = false;
    };
  }, [params.groupId, currentUserId]);

  // Resolve payer and receiver member records
  const payerMember = useMemo(() => {
    const found = members.find((m) => m.id === payerId);
    if (found) return found;
    if (payerId === currentUserId) {
      return {
        id: currentUserId,
        name: currentUserName,
        avatarUrl: user?.avatarUrl,
        upiId: user?.upiId,
        netBalance: 0,
      };
    }
    return {
      id: payerId || 'payer',
      name: params.debtorName || 'Member',
      avatarUrl: undefined,
      netBalance: 0,
    };
  }, [members, payerId, currentUserId, currentUserName, user?.avatarUrl, user?.upiId, params.debtorName]);

  const receiverMember = useMemo(() => {
    const found = members.find((m) => m.id === receiverId);
    if (found) return found;
    if (receiverId === currentUserId) {
      return {
        id: currentUserId,
        name: currentUserName,
        avatarUrl: user?.avatarUrl,
        upiId: user?.upiId,
        netBalance: 0,
      };
    }
    return {
      id: receiverId || 'receiver',
      name: params.creditorName || 'Member',
      avatarUrl: undefined,
      upiId: params.upiId,
      netBalance: 0,
    };
  }, [members, receiverId, currentUserId, currentUserName, user?.avatarUrl, user?.upiId, params.creditorName, params.upiId]);

  const isPayerViewer = payerMember.id === currentUserId;
  const isReceiverViewer = receiverMember.id === currentUserId;

  const payerDisplayName = isPayerViewer && currentUserName && currentUserName !== 'You'
    ? currentUserName
    : payerMember.name;

  const receiverDisplayName = isReceiverViewer && currentUserName && currentUserName !== 'You'
    ? currentUserName
    : receiverMember.name;

  // Real Receiver UPI VPA configuration
  const receiverUpiId = useMemo(() => {
    const id = receiverMember.upiId?.trim() || (receiverId === params.creditorId ? params.upiId?.trim() : undefined);
    return id && id.includes('@') ? id : undefined;
  }, [receiverMember.upiId, receiverId, params.creditorId, params.upiId]);

  const hasUpiId = Boolean(receiverUpiId);
  const [upiOptOut, setUpiOptOut] = useState(false);
  const payViaUpi = hasUpiId && !upiOptOut;

  // Amount parsing
  const numAmount = parseFloat(amount) || 0;
  const isValidAmount = numAmount > 0;
  const formattedAmount = numAmount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Double arrow swap handler
  const handleSwapParties = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const prevPayer = payerId;
    const prevReceiver = receiverId;
    setPayerId(prevReceiver);
    setReceiverId(prevPayer);
  };

  // Filter members in dropdown picker:
  // When picking payer: do not display currently selected receiver
  // When picking receiver: do not display currently selected payer
  const pickerMembers = useMemo(() => {
    if (activePicker === 'payer') {
      return members.filter((m) => m.id !== receiverId);
    }
    if (activePicker === 'receiver') {
      return members.filter((m) => m.id !== payerId);
    }
    return members;
  }, [members, activePicker, receiverId, payerId]);

  const targetGroupId = group?.id || params.groupId || '';

  // Record settlement callback (declared before AppState effect)
  const performRecordSettlement = useCallback(
    async (amt: number, method: 'upi' | 'cash') => {
      setIsSubmitting(true);
      try {
        const res = await settlementService.recordSettlement({
          groupId: targetGroupId,
          payerId: payerMember.id,
          payerName: payerDisplayName,
          payeeId: receiverMember.id,
          payeeName: receiverDisplayName,
          amount: amt,
          method,
          notes,
        });

        if (res.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (targetGroupId) {
            groupService.getGroupDetails(targetGroupId).catch(() => {});
          }
          router.back();
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('Error', res.error || 'Failed to record settlement.');
        }
      } catch (err: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', err?.message || 'An unexpected error occurred.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [targetGroupId, payerMember.id, payerDisplayName, receiverMember.id, receiverDisplayName, notes, router]
  );

  // AppState Return Detection for Automated UPI Post-Confirmation
  const isWaitingUpiReturn = useRef(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isWaitingUpiReturn.current) {
        isWaitingUpiReturn.current = false;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          'Confirm Payment',
          `Did your UPI payment of ₹${numAmount.toLocaleString('en-IN')} to ${receiverDisplayName} complete successfully?`,
          [
            {
              text: 'No, Cancel',
              style: 'cancel',
            },
            {
              text: 'Yes, Record Payment',
              onPress: () => performRecordSettlement(numAmount, 'upi'),
            },
          ]
        );
      }
    });

    return () => {
      subscription.remove();
    };
  }, [numAmount, receiverDisplayName, performRecordSettlement]);

  const handleSubmit = async () => {
    if (!requireOnline('record settlements')) return;
    if (!isValidAmount) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Invalid Amount', 'Please enter a settlement amount greater than 0.');
      return;
    }

    if (payerId === receiverId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Invalid Settlement', 'Payer and recipient cannot be the same member.');
      return;
    }

    // Launch UPI intent if requested and receiver has VPA
    if (payViaUpi && hasUpiId && receiverUpiId) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      isWaitingUpiReturn.current = true;
      const launched = await launchUpiPayment({
        upiId: receiverUpiId,
        payeeName: receiverDisplayName,
        amount: numAmount,
        notes,
      });

      if (!launched) {
        isWaitingUpiReturn.current = false;
        Alert.alert(
          'No UPI App Detected',
          'Could not find a supported UPI app on your device. Would you like to record this payment manually or display a QR code instead?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Record Manually',
              onPress: () => performRecordSettlement(numAmount, 'cash'),
            },
            {
              text: 'Show QR Code',
              onPress: () => handleOpenQr(),
            },
          ]
        );
      }
      return;
    }

    // Direct manual record
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await performRecordSettlement(numAmount, 'cash');
  };

  const handleOpenQr = () => {
    Haptics.selectionAsync();
    router.push({
      pathname: '/settle/qr',
      params: {
        groupId: group?.id || params.groupId || '',
        payerId: payerMember.id,
        payerName: payerDisplayName,
        payeeId: receiverMember.id,
        payeeName: receiverDisplayName,
        upiId: receiverUpiId || params.upiId || '',
        amount: numAmount > 0 ? numAmount.toString() : '0',
        notes,
      },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* ── Top Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <X size={20} color={THEME.colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Settle Up</Text>
          {group?.name && (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {group.name}
            </Text>
          )}
        </View>

        {/* QR Code Secondary Trigger */}
        <TouchableOpacity
          onPress={handleOpenQr}
          style={styles.headerActionBtn}
          accessibilityRole="button"
          accessibilityLabel="Display QR Code"
        >
          <QrCode size={18} color={THEME.colors.primary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flexOne}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {isLoadingGroup && members.length === 0 ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={THEME.colors.primary} />
              <Text style={styles.loadingText}>Loading group members...</Text>
            </View>
          ) : (
            <>
              {/* ── 1. Avatar -> (Sleek Double-Arrow) -> Avatar Flow ── */}
              <View style={styles.transferFlowCard}>
                {/* Payer (Left) */}
                <TouchableOpacity
                  style={styles.partyTile}
                  activeOpacity={0.75}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setActivePicker('payer');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Select payer, currently ${payerDisplayName}`}
                >
                  <View style={styles.partyAvatarContainer}>
                    <View style={styles.avatarCircle}>
                      {payerMember.avatarUrl ? (
                        <Image source={{ uri: payerMember.avatarUrl }} style={styles.avatarImg} />
                      ) : (
                        <Text style={styles.avatarText}>
                          {(payerDisplayName || 'M').charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.partyRoleBadge}>
                    <Text style={styles.partyRoleText}>PAID BY</Text>
                  </View>

                  <View style={styles.partyNameRow}>
                    <Text style={styles.partyName} numberOfLines={1}>
                      {payerDisplayName}
                    </Text>
                    {isPayerViewer && (
                      <View style={styles.youBadge}>
                        <Text style={styles.youBadgeText}>YOU</Text>
                      </View>
                    )}
                    <ChevronDown size={13} color={THEME.colors.textMuted} />
                  </View>
                </TouchableOpacity>

                {/* Center Sleek Double-Arrow Swap Button */}
                <View style={styles.centerSwapWrap}>
                  <TouchableOpacity
                    style={styles.swapButton}
                    onPress={handleSwapParties}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel="Swap payer and recipient"
                  >
                    <ArrowLeftRight size={15} color={THEME.colors.primary} />
                  </TouchableOpacity>
                  <ArrowRight size={13} color={THEME.colors.textMuted} style={styles.flowDirectionArrow} />
                </View>

                {/* Receiver (Right) */}
                <TouchableOpacity
                  style={styles.partyTile}
                  activeOpacity={0.75}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setActivePicker('receiver');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Select recipient, currently ${receiverDisplayName}`}
                >
                  <View style={styles.partyAvatarContainer}>
                    <View style={styles.avatarCircle}>
                      {receiverMember.avatarUrl ? (
                        <Image source={{ uri: receiverMember.avatarUrl }} style={styles.avatarImg} />
                      ) : (
                        <Text style={styles.avatarText}>
                          {(receiverDisplayName || 'M').charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.partyRoleBadge}>
                    <Text style={styles.partyRoleText}>PAID TO</Text>
                  </View>

                  <View style={styles.partyNameRow}>
                    <Text style={styles.partyName} numberOfLines={1}>
                      {receiverDisplayName}
                    </Text>
                    {isReceiverViewer && (
                      <View style={styles.youBadge}>
                        <Text style={styles.youBadgeText}>YOU</Text>
                      </View>
                    )}
                    <ChevronDown size={13} color={THEME.colors.textMuted} />
                  </View>
                </TouchableOpacity>
              </View>

              {/* ── 2. Hero Amount Input (Matching Add Expense Style) ── */}
              <View style={styles.heroAmountCard}>
                <View style={styles.amountInputRow}>
                  <Text style={styles.currencyPrefix}>₹</Text>
                  <TextInput
                    style={styles.heroAmountInput}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    placeholder="0.00"
                    placeholderTextColor={THEME.colors.textMuted}
                    autoFocus={!params.amount}
                  />
                </View>

                {/* Optional Settlement Note Input */}
                <View style={styles.noteInputRow}>
                  <TextInput
                    style={styles.noteInput}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Add a settlement note..."
                    placeholderTextColor={THEME.colors.textMuted}
                    returnKeyType="done"
                  />
                </View>
              </View>

              {/* ── 3. Dynamic Summary & Short Disclaimer ── */}
              <View style={styles.summaryContainer}>
                <Text style={styles.summarySentence}>
                  <Text style={styles.summaryHighlight}>{payerDisplayName}</Text> is paying{' '}
                  <Text style={styles.summaryAmountHighlight}>
                    ₹{numAmount > 0 ? numAmount.toFixed(2) : '0.00'}
                  </Text>{' '}
                  to <Text style={styles.summaryHighlight}>{receiverDisplayName}</Text>
                </Text>
                <View style={styles.disclaimerRow}>
                  <ShieldCheck size={13} color={THEME.colors.textMuted} />
                  <Text style={styles.disclaimerText}>
                    SplitIt records shared balances between members and does not transfer or escrow funds directly.
                  </Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── 4. Bottom Dock: UPI Checkbox + Single Main Button ── */}
      <View style={styles.bottomDock}>
        {/* UPI App Checkbox Row (Locked if receiver has no VPA) */}
        <TouchableOpacity
          style={[
            styles.upiCheckboxRow,
            !hasUpiId && styles.upiCheckboxRowDisabled,
            payViaUpi && hasUpiId && styles.upiCheckboxRowActive,
          ]}
          onPress={() => {
            if (!hasUpiId) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              Alert.alert(
                'UPI VPA Not Configured',
                `${receiverDisplayName} has not added their UPI ID (VPA) yet. You can still record this settlement manually.`
              );
              return;
            }
            Haptics.selectionAsync();
            setUpiOptOut(!upiOptOut);
          }}
          activeOpacity={0.75}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: payViaUpi && hasUpiId, disabled: !hasUpiId }}
        >
          <View style={styles.upiCheckLeft}>
            <View
              style={[
                styles.checkboxBox,
                payViaUpi && hasUpiId && styles.checkboxBoxChecked,
                !hasUpiId && styles.checkboxBoxLocked,
              ]}
            >
              {payViaUpi && hasUpiId ? (
                <Check size={11} color={THEME.colors.primaryForeground} strokeWidth={3} />
              ) : !hasUpiId ? (
                <Lock size={10} color={THEME.colors.textMuted} />
              ) : null}
            </View>

            <View style={styles.upiTextCol}>
              <View style={styles.upiTitleRow}>
                <Text style={[styles.upiTitleText, !hasUpiId && styles.upiTitleTextDisabled]}>
                  Pay via UPI App on submit
                </Text>
                {hasUpiId ? (
                  <View style={styles.vpaBadge}>
                    <Text style={styles.vpaBadgeText} numberOfLines={1}>
                      {receiverUpiId}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.vpaMissingBadge}>
                    <Text style={styles.vpaMissingText}>VPA Missing</Text>
                  </View>
                )}
              </View>
              <Text style={styles.upiSubText}>
                {hasUpiId
                  ? 'Launches GPay, PhonePe, Paytm, or CRED with exact amount'
                  : `${receiverDisplayName} has not setup their UPI VPA`}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* The ONLY Main Button */}
        <TouchableOpacity
          style={[
            styles.recordMainBtn,
            (!isValidAmount || isSubmitting) && styles.recordMainBtnDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!isValidAmount || isSubmitting}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Record Settlement"
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={THEME.colors.primaryForeground} />
          ) : (
            <Text style={styles.recordMainBtnText}>
              {payViaUpi && hasUpiId ? `Pay ₹${formattedAmount} & Record` : 'Record Settlement'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── 5. User Selection Modal ── */}
      <Modal
        visible={activePicker !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setActivePicker(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdropTap}
            activeOpacity={1}
            onPress={() => setActivePicker(null)}
          />

          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {activePicker === 'payer' ? 'Select Payer (Who Paid)' : 'Select Recipient (Paid To)'}
              </Text>
              <TouchableOpacity
                onPress={() => setActivePicker(null)}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {pickerMembers.length === 0 ? (
                <View style={styles.modalEmptyBox}>
                  <Text style={styles.modalEmptyText}>No other members available</Text>
                </View>
              ) : (
                pickerMembers.map((m, idx) => {
                  const isSelected = activePicker === 'payer' ? m.id === payerId : m.id === receiverId;
                  const isViewer = m.id === currentUserId;
                  const memberName = isViewer && currentUserName && currentUserName !== 'You'
                    ? currentUserName
                    : m.name;
                  const isLast = idx === pickerMembers.length - 1;

                  return (
                    <TouchableOpacity
                      key={m.id || idx}
                      style={[styles.memberOptionRow, !isLast && styles.memberOptionBorder]}
                      activeOpacity={0.7}
                      onPress={() => {
                        Haptics.selectionAsync();
                        if (activePicker === 'payer') {
                          setPayerId(m.id);
                        } else {
                          setReceiverId(m.id);
                        }
                        setActivePicker(null);
                      }}
                    >
                      <View style={styles.memberLeft}>
                        <View style={styles.avatarCircleSmall}>
                          {m.avatarUrl ? (
                            <Image source={{ uri: m.avatarUrl }} style={styles.avatarImg} />
                          ) : (
                            <Text style={styles.avatarSmallText}>
                              {(memberName || 'M').charAt(0).toUpperCase()}
                            </Text>
                          )}
                        </View>

                        <View style={styles.memberNameBox}>
                          <View style={styles.nameBadgeRow}>
                            <Text
                              style={[
                                styles.optionMemberName,
                                isViewer && styles.optionMemberNameUser,
                              ]}
                            >
                              {memberName}
                            </Text>
                            {isViewer && (
                              <View style={styles.youBadge}>
                                <Text style={styles.youBadgeText}>YOU</Text>
                              </View>
                            )}
                          </View>
                          {m.upiId && (
                            <Text style={styles.optionVpaText}>{m.upiId}</Text>
                          )}
                        </View>
                      </View>

                      {isSelected ? (
                        <View style={styles.selectedCheck}>
                          <Check size={14} color={THEME.colors.primaryForeground} strokeWidth={3} />
                        </View>
                      ) : (
                        <View style={styles.unselectedRadio} />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  flexOne: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.07)',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 160,
    gap: 16,
  },

  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: THEME.colors.textMuted,
  },

  /* 1. Transfer Flow Card */
  transferFlowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.surface,
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  partyTile: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  partyAvatarContainer: {
    marginBottom: 4,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  partyRoleBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  partyRoleText: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.5,
  },
  partyNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
    paddingHorizontal: 4,
  },
  partyName: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  youBadge: {
    backgroundColor: 'rgba(28, 194, 159, 0.15)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  youBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: THEME.colors.primary,
    letterSpacing: 0.5,
  },

  centerSwapWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    gap: 4,
  },
  swapButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  flowDirectionArrow: {
    opacity: 0.5,
  },

  /* 2. Hero Amount Card */
  heroAmountCard: {
    backgroundColor: THEME.colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    alignItems: 'center',
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
    paddingBottom: 8,
    width: '100%',
  },
  currencyPrefix: {
    fontSize: 34,
    fontWeight: '700',
    color: THEME.colors.primary,
    marginRight: 4,
    lineHeight: 42,
  },
  heroAmountInput: {
    fontSize: 34,
    fontWeight: '700',
    color: THEME.colors.text,
    minWidth: 120,
    textAlign: 'center',
    paddingVertical: 0,
    lineHeight: 42,
  },
  noteInputRow: {
    width: '100%',
    paddingTop: 10,
  },
  noteInput: {
    fontSize: 12,
    color: THEME.colors.text,
    textAlign: 'center',
    paddingVertical: 4,
  },

  /* 3. Summary & Disclaimer */
  summaryContainer: {
    paddingHorizontal: 4,
    gap: 8,
  },
  summarySentence: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  summaryHighlight: {
    fontWeight: '700',
    color: THEME.colors.text,
  },
  summaryAmountHighlight: {
    fontWeight: '800',
    color: THEME.colors.primary,
  },
  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  disclaimerText: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    lineHeight: 14,
    textAlign: 'center',
    flex: 1,
  },

  /* 4. Bottom Dock */
  bottomDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(19, 20, 23, 0.95)',
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
    gap: 10,
  },
  upiCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  upiCheckboxRowActive: {
    borderColor: 'rgba(28, 194, 159, 0.4)',
    backgroundColor: THEME.colors.surfaceElevated,
  },
  upiCheckboxRowDisabled: {
    opacity: 0.65,
  },
  upiCheckLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  checkboxBoxLocked: {
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  upiTextCol: {
    flex: 1,
  },
  upiTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  upiTitleText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  upiTitleTextDisabled: {
    color: THEME.colors.textMuted,
  },
  vpaBadge: {
    backgroundColor: 'rgba(28, 194, 159, 0.12)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  vpaBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  vpaMissingBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  vpaMissingText: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.dangerLight,
  },
  upiSubText: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },

  recordMainBtn: {
    backgroundColor: THEME.colors.primary,
    paddingVertical: 14,
    borderRadius: THEME.radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  recordMainBtnDisabled: {
    opacity: 0.45,
    backgroundColor: THEME.colors.surfaceElevated,
  },
  recordMainBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.primaryForeground,
  },

  /* 5. User Selection Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  modalBackdropTap: {
    flex: 1,
  },
  modalContainer: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: THEME.radius['2xl'],
    borderTopRightRadius: THEME.radius['2xl'],
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    maxHeight: '65%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalList: {
    paddingHorizontal: 14,
  },
  modalEmptyBox: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  modalEmptyText: {
    fontSize: 13,
    color: THEME.colors.textMuted,
  },
  memberOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  memberOptionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarCircleSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  avatarSmallText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  memberNameBox: {
    gap: 2,
    flex: 1,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  optionMemberName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  optionMemberNameUser: {
    fontWeight: '700',
  },
  optionVpaText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  selectedCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unselectedRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
});
