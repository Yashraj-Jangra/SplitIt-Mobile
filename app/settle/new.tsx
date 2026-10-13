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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  Search,
  Star,
  User,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/auth.context';
import {
  groupService,
  GroupMember,
  GroupDetailData,
  GroupListItem,
} from '../../src/services/group.service';
import { settlementService } from '../../src/services/settlement.service';
import { useNetwork } from '../../src/contexts/network.context';
import { launchUpiPayment } from '../../src/utils/upi';
import { haptics } from '../../src/services/haptics.service';
import { PrimaryActionButton } from '@/components/common/PrimaryActionButton';

/**
 * Sanitizes settlement numeric input with strict max .2f limit.
 * - Replaces commas with dots
 * - Strips all invalid characters
 * - Converts leading dot to '0.'
 * - Enforces strict maximum of 2 decimal places (blocks typing a 3rd decimal place)
 * - Normalizes leading zeros without affecting decimals (e.g. '05' -> '5', but keeps '0' and '0.xx')
 */
export function sanitizeSettlementAmountInput(val: string): string {
  if (!val) return '';
  // 1. Convert commas to dots
  let cleaned = val.replace(/,/g, '.');

  // 2. Strip anything that is not a digit or decimal point
  cleaned = cleaned.replace(/[^0-9.]/g, '');

  // 3. Prepend 0 if starting with a dot (e.g. ".5" -> "0.5")
  if (cleaned.startsWith('.')) {
    cleaned = '0' + cleaned;
  }

  // 4. Handle decimal point and enforce strict maximum of 2 decimal places (.2f)
  const dotIndex = cleaned.indexOf('.');
  if (dotIndex !== -1) {
    const intPart = cleaned.slice(0, dotIndex);
    // Remove any additional dots from the decimal part
    const decPart = cleaned.slice(dotIndex + 1).replace(/\./g, '');
    // Strictly cap to at most 2 decimal digits (typing a 3rd digit is strictly blocked)
    cleaned = `${intPart.slice(0, 10)}.${decPart.slice(0, 2)}`;
  } else {
    // Integer only: limit to 10 digits
    cleaned = cleaned.slice(0, 10);
  }

  // 5. Clean unnecessary leading zeros (e.g. "05" -> "5", but keep "0", "0.xx")
  if (cleaned.startsWith('0') && cleaned.length > 1 && !cleaned.startsWith('0.')) {
    cleaned = cleaned.replace(/^0+/, '') || '0';
  }

  return cleaned;
}

export default function SettleUpModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  // 1. Group & Shared Default Group State
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(params.groupId || '');
  const [defaultGroupId, setDefaultGroupId] = useState<string | null>(null);
  const [isDefaultGroupChecked, setIsDefaultGroupChecked] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');

  const [group, setGroup] = useState<GroupDetailData | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoadingGroup, setIsLoadingGroup] = useState(true);

  // 2. Settlement Parties State
  const [payerId, setPayerId] = useState<string>(() => params.debtorId || currentUserId);
  const [receiverId, setReceiverId] = useState<string>(() => params.creditorId || '');
  const [activePicker, setActivePicker] = useState<'payer' | 'receiver' | null>(null);

  // 3. Amount Field (strict .2f from initial params)
  const [amount, setAmount] = useState(() => (params.amount ? sanitizeSettlementAmountInput(params.amount) : ''));
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 4. Pay via UPI Selection (By default UNSELECTED)
  const [payViaUpi, setPayViaUpi] = useState(false);

  // Load group members & party records for a specific group
  const loadGroupMembersAndParties = useCallback(
    async (gId: string) => {
      try {
        const inMem = groupService.getInMemoryGroupDetail(gId);
        if (inMem) {
          setGroup(inMem);
          if (inMem.members && inMem.members.length > 0) {
            setMembers(inMem.members);
            setPayerId((prev) =>
              prev && inMem.members?.some((m) => m.id === prev)
                ? prev
                : inMem.members?.find((m) => m.id === currentUserId)?.id || inMem.members?.[0]?.id || ''
            );
            setReceiverId((prev) =>
              prev && inMem.members?.some((m) => m.id === prev)
                ? prev
                : inMem.members?.find((m) => m.id !== currentUserId)?.id || inMem.members?.[1]?.id || ''
            );
          }
        }

        const fresh = await groupService.getGroupDetails(gId);
        if (fresh) {
          setGroup(fresh);
          if (fresh.members && fresh.members.length > 0) {
            setMembers(fresh.members);
            setPayerId((prev) =>
              prev && fresh.members?.some((m) => m.id === prev)
                ? prev
                : fresh.members?.find((m) => m.id === currentUserId)?.id || fresh.members?.[0]?.id || ''
            );
            setReceiverId((prev) =>
              prev && fresh.members?.some((m) => m.id === prev)
                ? prev
                : fresh.members?.find((m) => m.id !== currentUserId)?.id || fresh.members?.[1]?.id || ''
            );
          }
        }
      } catch {
        // Handled gracefully
      }
    },
    [currentUserId]
  );

  // Initialization: load all groups, check shared default group, and load active group
  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const [allGroups, savedDefault] = await Promise.all([
          groupService.getUserGroups(),
          groupService.getDefaultGroupId(),
        ]);
        if (active) {
          setGroups(allGroups || []);
          setDefaultGroupId(savedDefault);
          if (savedDefault) {
            setIsDefaultGroupChecked(true);
          }
        }

        let targetGId = params.groupId;
        if (!targetGId && savedDefault && allGroups.some((g) => g.id === savedDefault)) {
          targetGId = savedDefault;
        }
        if (!targetGId && allGroups && allGroups.length > 0) {
          targetGId = allGroups[0].id;
        }

        if (targetGId) {
          if (active) setSelectedGroupId(targetGId);
          await loadGroupMembersAndParties(targetGId);
        }
      } catch {
        // Handled gracefully
      } finally {
        if (active) setIsLoadingGroup(false);
      }
    };

    init();
    return () => {
      active = false;
    };
  }, [params.groupId, loadGroupMembersAndParties]);

  // Handle switching group & syncing shared default group
  const handleSelectGroup = async (gId: string) => {
    haptics.tap();
    setSelectedGroupId(gId);
    setShowGroupModal(false);

    if (isDefaultGroupChecked) {
      await groupService.setDefaultGroupId(gId);
      setDefaultGroupId(gId);
    }

    setIsLoadingGroup(true);
    await loadGroupMembersAndParties(gId);
    setIsLoadingGroup(false);
  };

  // Resolve payer and receiver member records
  const payerMember = useMemo(() => {
    if (!payerId) return null;
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
      id: payerId,
      name: params.debtorName || 'Member',
      avatarUrl: undefined,
      netBalance: 0,
    };
  }, [members, payerId, currentUserId, currentUserName, user?.avatarUrl, user?.upiId, params.debtorName]);

  const receiverMember = useMemo(() => {
    if (!receiverId) return null;
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
      id: receiverId,
      name: params.creditorName || 'Member',
      avatarUrl: undefined,
      upiId: params.upiId,
      netBalance: 0,
    };
  }, [members, receiverId, currentUserId, currentUserName, user?.avatarUrl, user?.upiId, params.creditorName, params.upiId]);

  const isPayerViewer = Boolean(payerMember && payerMember.id === currentUserId);
  const isReceiverViewer = Boolean(receiverMember && receiverMember.id === currentUserId);

  const payerDisplayName = payerMember
    ? (isPayerViewer && currentUserName && currentUserName !== 'You' ? currentUserName : payerMember.name)
    : 'Select payer';

  const receiverDisplayName = receiverMember
    ? (isReceiverViewer && currentUserName && currentUserName !== 'You' ? currentUserName : receiverMember.name)
    : 'Select recipient';

  // Real Receiver UPI VPA configuration
  const receiverUpiId = useMemo(() => {
    if (!receiverMember) return undefined;
    const id = receiverMember.upiId?.trim() || (receiverId === params.creditorId ? params.upiId?.trim() : undefined);
    return id && id.includes('@') ? id : undefined;
  }, [receiverMember, receiverId, params.creditorId, params.upiId]);

  const hasUpiId = Boolean(receiverUpiId);

  // Edge cases for QR and UPI
  const isQrLocked = !receiverId || isReceiverViewer || !hasUpiId;
  const isUpiLocked = !receiverId || isReceiverViewer || !hasUpiId;
  const effectivePayViaUpi = payViaUpi && !isUpiLocked;

  // Amount parsing (Strict .2f numeric match)
  const sanitizedAmount = sanitizeSettlementAmountInput(amount);
  const numAmount = Math.round((parseFloat(sanitizedAmount) || 0) * 100) / 100;
  const isValidAmount = numAmount > 0;
  const isValidParties = Boolean(payerId && receiverId && payerId !== receiverId);
  const isValidSubmit = isValidAmount && isValidParties;
  const formattedAmount = numAmount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Double-arrow swap handler
  const handleSwapParties = () => {
    haptics.keyPress();
    const prevPayer = payerId;
    const prevReceiver = receiverId;
    setPayerId(prevReceiver);
    setReceiverId(prevPayer);
  };

  // Select member handler:
  // Shows all members. If selected party matches the opposite party, deselect opposite party.
  const handleSelectMember = (mId: string) => {
    haptics.keyPress();
    if (activePicker === 'payer') {
      setPayerId(mId);
      if (receiverId === mId) {
        setReceiverId(''); // Deselect receiver if same member selected as payer
      }
    } else if (activePicker === 'receiver') {
      setReceiverId(mId);
      if (payerId === mId) {
        setPayerId(''); // Deselect payer if same member selected as receiver
      }
    }
    setActivePicker(null);
  };

  // QR Code Button Handler with comprehensive edge-case feedback
  const handleQrPress = () => {
    haptics.tap();
    if (!receiverId) {
      haptics.warning();
      Alert.alert('Select Recipient', 'Please select who receives the payment to view their QR code.');
      return;
    }
    if (isReceiverViewer) {
      haptics.warning();
      Alert.alert(
        'Cannot Pay Yourself',
        'You are selected as the recipient. QR payment code is only available when paying another member.'
      );
      return;
    }
    if (!hasUpiId) {
      haptics.warning();
      Alert.alert(
        'UPI VPA Not Configured',
        `${receiverDisplayName} has not added their UPI ID (VPA) yet. QR code cannot be generated.`
      );
      return;
    }
    handleOpenQr();
  };

  const handleOpenQr = () => {
    const exactAmtStr = numAmount > 0 ? (Math.round(numAmount * 100) / 100).toFixed(2) : '0';
    router.push({
      pathname: '/settle/qr',
      params: {
        groupId: selectedGroupId || group?.id || '',
        payerId: payerMember?.id || '',
        payerName: payerDisplayName,
        payeeId: receiverMember?.id || '',
        payeeName: receiverDisplayName,
        upiId: receiverUpiId || '',
        amount: exactAmtStr,
        notes: 'SplitIt settlement',
      },
    });
  };

  // Toggle UPI Checkbox Handler with edge-case feedback
  const handleToggleUpi = () => {
    if (!receiverId) {
      haptics.warning();
      Alert.alert('Select Recipient', 'Please select who receives the payment first.');
      return;
    }
    if (isReceiverViewer) {
      haptics.warning();
      Alert.alert(
        'Cannot Pay Yourself',
        'You are selected as the recipient. You cannot send a UPI payment to yourself. Record this settlement manually instead.'
      );
      return;
    }
    if (!hasUpiId) {
      haptics.warning();
      Alert.alert(
        'UPI VPA Not Configured',
        `${receiverDisplayName} has not added their UPI ID (VPA) yet. You can still record this settlement manually.`
      );
      return;
    }
    haptics.tap();
    setPayViaUpi((prev) => !prev);
  };

  const targetGId = selectedGroupId || group?.id || params.groupId || '';
  const effectivePayerId = payerMember?.id || '';
  const effectiveReceiverId = receiverMember?.id || '';

  // Record settlement callback (Enforces exact value matching with zero float drift)
  const performRecordSettlement = useCallback(
    async (amt: number, method: 'upi' | 'cash') => {
      setIsSubmitting(true);
      const exactAmt = Math.round(amt * 100) / 100;
      try {
        const res = await settlementService.recordSettlement({
          groupId: targetGId,
          payerId: effectivePayerId,
          payerName: payerDisplayName,
          payeeId: effectiveReceiverId,
          payeeName: receiverDisplayName,
          amount: exactAmt,
          method,
          notes: 'SplitIt settlement',
        });

        if (res.success) {
          haptics.settleSuccess();
          if (targetGId) {
            groupService.getGroupDetails(targetGId).catch(() => {});
          }
          router.back();
        } else {
          haptics.error();
          Alert.alert('Error', res.error || 'Failed to record settlement.');
        }
      } catch (err: any) {
        haptics.error();
        Alert.alert('Error', err?.message || 'An unexpected error occurred.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [targetGId, effectivePayerId, payerDisplayName, effectiveReceiverId, receiverDisplayName, router]
  );

  // AppState Return Detection for Automated UPI Post-Confirmation
  const isWaitingUpiReturn = useRef(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isWaitingUpiReturn.current) {
        isWaitingUpiReturn.current = false;
        haptics.warning();
        Alert.alert(
          'Confirm Payment',
          `Did your UPI payment of ₹${numAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} to ${receiverDisplayName} complete successfully?`,
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
      haptics.error();
      Alert.alert('Invalid Amount', 'Please enter a settlement amount greater than 0.');
      return;
    }
    if (!isValidParties) {
      haptics.error();
      Alert.alert('Select Parties', 'Please select both who paid and who receives the payment.');
      return;
    }

    if (effectivePayViaUpi && receiverUpiId) {
      haptics.confirm();
      isWaitingUpiReturn.current = true;
      const launched = await launchUpiPayment({
        upiId: receiverUpiId,
        payeeName: receiverDisplayName,
        amount: numAmount,
        notes: 'SplitIt settlement',
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
    haptics.tap();
    await performRecordSettlement(numAmount, 'cash');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Top Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <X size={20} color={THEME.colors.textSecondary} />
        </TouchableOpacity>

        {/* Center Title + Group Switcher Badge (Website Parity & Shared Default Group) */}
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Settle Up</Text>
          <TouchableOpacity
            onPress={() => {
              haptics.tap();
              setShowGroupModal(true);
            }}
            activeOpacity={0.7}
            style={styles.headerGroupBadge}
            accessibilityRole="button"
            accessibilityLabel={`Current group: ${group?.name || 'Select group'}. Tap to switch.`}
          >
            <Text style={styles.headerGroupText} numberOfLines={1}>
              in <Text style={styles.headerGroupNameHighlight}>{group?.name || 'Select group'}</Text>
            </Text>
            <ChevronDown size={11} color={THEME.colors.primary} />
          </TouchableOpacity>
        </View>

        {/* QR Code Trigger with Edge Cases Handling */}
        <TouchableOpacity
          onPress={handleQrPress}
          style={[styles.headerActionBtn, isQrLocked && styles.headerActionBtnLocked]}
          accessibilityRole="button"
          accessibilityLabel={isQrLocked ? 'QR Code Unavailable' : 'Display QR Code'}
        >
          {isQrLocked ? (
            <Lock size={15} color={THEME.colors.textMuted} />
          ) : (
            <QrCode size={18} color={THEME.colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flexOne}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 160 + insets.bottom }]}
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
              {/* ── 1. Avatar -> (Main Arrow & Double Swap) -> Avatar Flow ── */}
              <View style={styles.transferFlowCard}>
                {/* Payer (Left) */}
                <TouchableOpacity
                  style={styles.partyTile}
                  activeOpacity={0.75}
                  onPress={() => {
                    haptics.tap();
                    setActivePicker('payer');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Select payer, currently ${payerDisplayName}`}
                >
                  <View style={styles.partyAvatarContainer}>
                    {payerMember ? (
                      <View style={styles.avatarCircle}>
                        {payerMember.avatarUrl ? (
                          <Image source={{ uri: payerMember.avatarUrl }} style={styles.avatarImg} />
                        ) : (
                          <Text style={styles.avatarText}>
                            {(payerDisplayName || 'M').charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>
                    ) : (
                      <View style={styles.avatarCirclePlaceholder}>
                        <User size={22} color={THEME.colors.textMuted} />
                      </View>
                    )}
                  </View>

                  <View style={styles.partyRoleBadge}>
                    <Text style={styles.partyRoleText}>PAID BY</Text>
                  </View>

                  <View style={styles.partyNameRow}>
                    <Text
                      style={[styles.partyName, !payerMember && styles.partyNameUnselected]}
                      numberOfLines={1}
                    >
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

                {/* Center Arrows: Main Arrow -> (Bigger, on top) & Double-Arrow Swap (Smaller, below) */}
                <View style={styles.centerArrowsWrap}>
                  <ArrowRight size={22} color={THEME.colors.primary} strokeWidth={2.4} />

                  <TouchableOpacity
                    style={styles.swapButtonSmall}
                    onPress={handleSwapParties}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Swap payer and recipient"
                  >
                    <ArrowLeftRight size={12} color={THEME.colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Receiver (Right) */}
                <TouchableOpacity
                  style={styles.partyTile}
                  activeOpacity={0.75}
                  onPress={() => {
                    haptics.tap();
                    setActivePicker('receiver');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Select recipient, currently ${receiverDisplayName}`}
                >
                  <View style={styles.partyAvatarContainer}>
                    {receiverMember ? (
                      <View style={styles.avatarCircle}>
                        {receiverMember.avatarUrl ? (
                          <Image source={{ uri: receiverMember.avatarUrl }} style={styles.avatarImg} />
                        ) : (
                          <Text style={styles.avatarText}>
                            {(receiverDisplayName || 'M').charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>
                    ) : (
                      <View style={styles.avatarCirclePlaceholder}>
                        <User size={22} color={THEME.colors.textMuted} />
                      </View>
                    )}
                  </View>

                  <View style={styles.partyRoleBadge}>
                    <Text style={styles.partyRoleText}>PAID TO</Text>
                  </View>

                  <View style={styles.partyNameRow}>
                    <Text
                      style={[styles.partyName, !receiverMember && styles.partyNameUnselected]}
                      numberOfLines={1}
                    >
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

              {/* ── 2. Amount Section (No-Div Minimal Underline Design, No Other Text) ── */}
              <View style={styles.amountNoDivContainer}>
                <View style={styles.amountUnderlineRow}>
                  <Text style={styles.currencyPrefix}>₹</Text>
                  <TextInput
                    style={styles.amountUnderlineInput}
                    value={amount}
                    onChangeText={(val) => {
                      const sanitized = sanitizeSettlementAmountInput(val);
                      setAmount(sanitized);
                    }}
                    onBlur={() => {
                      if (amount.endsWith('.')) {
                        setAmount(amount.slice(0, -1));
                      }
                    }}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    placeholder="0.00"
                    placeholderTextColor={THEME.colors.textMuted}
                    autoFocus={!params.amount}
                    accessibilityLabel="Settlement amount"
                  />
                </View>
              </View>

              {/* ── 3. Dynamic Summary & Short Disclaimer ── */}
              <View style={styles.summaryContainer}>
                {isValidParties ? (
                  <Text style={styles.summarySentence}>
                    <Text style={styles.summaryHighlight}>{payerDisplayName}</Text> is paying{' '}
                    <Text style={styles.summaryAmountHighlight}>
                      ₹{numAmount > 0 ? numAmount.toFixed(2) : '0.00'}
                    </Text>{' '}
                    to <Text style={styles.summaryHighlight}>{receiverDisplayName}</Text>
                  </Text>
                ) : (
                  <Text style={styles.summarySentencePrompt}>
                    Select both who paid and who receives the payment to settle up.
                  </Text>
                )}
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
      <View style={[styles.bottomDock, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 14) }]}>
        {/* UPI App Checkbox Row */}
        <TouchableOpacity
          style={[
            styles.upiCheckboxRow,
            isUpiLocked && styles.upiCheckboxRowDisabled,
            effectivePayViaUpi && styles.upiCheckboxRowActive,
          ]}
          onPress={handleToggleUpi}
          activeOpacity={0.75}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: effectivePayViaUpi, disabled: isUpiLocked }}
        >
          <View style={styles.upiCheckLeft}>
            <View
              style={[
                styles.checkboxBox,
                effectivePayViaUpi && styles.checkboxBoxChecked,
                isUpiLocked && styles.checkboxBoxLocked,
              ]}
            >
              {effectivePayViaUpi ? (
                <Check size={11} color={THEME.colors.primaryForeground} strokeWidth={3} />
              ) : isUpiLocked ? (
                <Lock size={10} color={THEME.colors.textMuted} />
              ) : null}
            </View>

            <View style={styles.upiTextCol}>
              <View style={styles.upiTitleRow}>
                <Text style={[styles.upiTitleText, isUpiLocked && styles.upiTitleTextDisabled]}>
                  Pay via UPI App
                </Text>
                {isReceiverViewer ? (
                  <View style={styles.vpaNoticeBadge}>
                    <Text style={styles.vpaNoticeText}>You are recipient</Text>
                  </View>
                ) : !receiverId ? (
                  <View style={styles.vpaNoticeBadge}>
                    <Text style={styles.vpaNoticeText}>No recipient</Text>
                  </View>
                ) : hasUpiId ? (
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
                {isReceiverViewer
                  ? 'Cannot pay yourself via UPI'
                  : !receiverId
                  ? 'Select recipient first'
                  : hasUpiId
                  ? 'Launches GPay, PhonePe, Paytm, or CRED with exact amount'
                  : `${receiverDisplayName} has not setup their UPI VPA`}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* The ONLY Main Button */}
        <PrimaryActionButton
          title={
            numAmount <= 0
              ? 'Enter Amount to Settle'
              : !isValidParties
              ? 'Select Members to Settle'
              : effectivePayViaUpi
              ? `Pay ₹${formattedAmount} & Record`
              : 'Record Settlement'
          }
          onPress={handleSubmit}
          disabled={!isValidSubmit || isSubmitting}
          loading={isSubmitting}
          accessibilityLabel="Record Settlement"
        />
      </View>

      {/* ── 5. User Selection Modal (Shows ALL Members; Auto-Deselects Opposite Party If Same) ── */}
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
              {members.length === 0 ? (
                <View style={styles.modalEmptyBox}>
                  <Text style={styles.modalEmptyText}>No members available</Text>
                </View>
              ) : (
                members.map((m, idx) => {
                  const isSelected = activePicker === 'payer' ? m.id === payerId : m.id === receiverId;
                  const isViewer = m.id === currentUserId;
                  const memberName = isViewer && currentUserName && currentUserName !== 'You'
                    ? currentUserName
                    : m.name;
                  const isLast = idx === members.length - 1;

                  return (
                    <TouchableOpacity
                      key={m.id || idx}
                      style={[styles.memberOptionRow, !isLast && styles.memberOptionBorder]}
                      activeOpacity={0.7}
                      onPress={() => handleSelectMember(m.id)}
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

      {/* ── 6. Group Selection Modal (Website Parity & Shared Default Group) ── */}
      <Modal
        visible={showGroupModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowGroupModal(false)}
      >
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={() => setShowGroupModal(false)}
        >
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select Group</Text>
            <Text style={styles.sheetSubtitle}>
              Select which group this settlement belongs to
            </Text>

            {/* Set as Default Toggle Card */}
            <TouchableOpacity
              style={styles.defaultToggleCard}
              onPress={() => {
                haptics.keyPress();
                setIsDefaultGroupChecked((prev) => !prev);
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.defaultCheckbox, isDefaultGroupChecked && styles.defaultCheckboxActive]}>
                {isDefaultGroupChecked && <Check size={12} color={THEME.colors.primaryForeground} strokeWidth={3} />}
              </View>
              <View style={styles.defaultToggleTextCol}>
                <Text style={styles.defaultToggleTitle}>Set as default group</Text>
                <Text style={styles.defaultToggleSub}>Auto-select when settling from homescreen</Text>
              </View>
              <Star
                size={18}
                color={isDefaultGroupChecked ? THEME.colors.primary : THEME.colors.textMuted}
                fill={isDefaultGroupChecked ? THEME.colors.primary : 'transparent'}
              />
            </TouchableOpacity>

            {/* Search Box */}
            <View style={styles.sheetSearchBox}>
              <Search size={15} color={THEME.colors.textMuted} />
              <TextInput
                style={styles.sheetSearchInput}
                placeholder="Search your groups..."
                placeholderTextColor={THEME.colors.textMuted}
                value={groupSearch}
                onChangeText={setGroupSearch}
              />
            </View>

            {/* Groups List */}
            <ScrollView showsVerticalScrollIndicator={false} style={styles.sheetList}>
              {groups
                .filter((g) => g.name.toLowerCase().includes(groupSearch.toLowerCase()))
                .map((grp) => {
                  const isSelected = grp.id === selectedGroupId;
                  const isDefault = grp.id === defaultGroupId;
                  return (
                    <TouchableOpacity
                      key={grp.id}
                      style={[styles.sheetGroupRow, isSelected && styles.sheetGroupRowActive]}
                      onPress={() => handleSelectGroup(grp.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.groupAvatarWrap}>
                        {grp.coverImageUrl ? (
                          <Image source={{ uri: grp.coverImageUrl }} style={styles.groupAvatarImg} />
                        ) : (
                          <Text style={styles.groupAvatarInitial}>{grp.name.charAt(0)}</Text>
                        )}
                      </View>
                      <View style={styles.groupInfoCol}>
                        <View style={styles.groupNameRow}>
                          <Text style={[styles.groupNameText, isSelected && styles.groupNameTextActive]}>
                            {grp.name}
                          </Text>
                          {isDefault && (
                            <View style={styles.defaultBadge}>
                              <Star size={9} color={THEME.colors.primary} fill={THEME.colors.primary} />
                              <Text style={styles.defaultBadgeText}>Default</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.groupMetaText}>{grp.membersCount || 0} members</Text>
                      </View>
                      {isSelected && <Check size={18} color={THEME.colors.primary} strokeWidth={2.5} />}
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </View>
        </TouchableOpacity>
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
    gap: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  headerGroupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: THEME.radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerGroupText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  headerGroupNameHighlight: {
    fontWeight: '700',
    color: THEME.colors.text,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionBtnLocked: {
    opacity: 0.5,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
  avatarCirclePlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
  partyNameUnselected: {
    color: THEME.colors.textMuted,
    fontStyle: 'italic',
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

  /* Center Arrows: Main Arrow Top, Small Double Arrow Bottom */
  centerArrowsWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 8,
  },
  swapButtonSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },

  /* 2. Amount Section (No-Div Minimal Underline Design) */
  amountNoDivContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountUnderlineRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.16)',
    paddingBottom: 6,
    minWidth: 180,
    maxWidth: '92%',
  },
  currencyPrefix: {
    fontSize: 36,
    fontWeight: '700',
    color: THEME.colors.primary,
    marginRight: 6,
    lineHeight: 44,
  },
  amountUnderlineInput: {
    fontSize: 36,
    fontWeight: '700',
    color: THEME.colors.text,
    minWidth: 100,
    textAlign: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
    lineHeight: 44,
  },

  /* 3. Summary & Disclaimer */
  summaryContainer: {
    paddingHorizontal: 4,
    gap: 8,
    marginTop: 4,
  },
  summarySentence: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  summarySentencePrompt: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
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
  vpaNoticeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  vpaNoticeText: {
    fontSize: 9,
    fontWeight: '700',
    color: THEME.colors.textMuted,
  },
  upiSubText: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },

  /* 5. Member Selection Modal */
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

  /* 6. Group Selection Sheet Modal */
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: THEME.radius['2xl'],
    borderTopRightRadius: THEME.radius['2xl'],
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    maxHeight: '75%',
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.colors.text,
    textAlign: 'center',
  },
  sheetSubtitle: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 12,
  },
  defaultToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: THEME.colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    marginBottom: 12,
  },
  defaultCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultCheckboxActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  defaultToggleTextCol: {
    flex: 1,
  },
  defaultToggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  defaultToggleSub: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  sheetSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    marginBottom: 10,
  },
  sheetSearchInput: {
    flex: 1,
    fontSize: 13,
    color: THEME.colors.text,
    paddingVertical: 0,
  },
  sheetList: {
    maxHeight: 280,
  },
  sheetGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: THEME.radius.md,
  },
  sheetGroupRowActive: {
    backgroundColor: 'rgba(28, 194, 159, 0.08)',
  },
  groupAvatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  groupAvatarImg: {
    width: '100%',
    height: '100%',
  },
  groupAvatarInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  groupInfoCol: {
    flex: 1,
    gap: 2,
  },
  groupNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  groupNameTextActive: {
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(28, 194, 159, 0.12)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.primary,
  },
  groupMetaText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
});
