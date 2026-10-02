import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X, ArrowRight, Zap, QrCode, Banknote, ShieldCheck } from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { launchUpiPayment } from '../../src/utils/upi';
import { settlementService } from '../../src/services/settlement.service';
import * as Haptics from 'expo-haptics';

export default function SettleUpModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    groupId?: string;
    debtorId?: string;
    debtorName?: string;
    creditorId?: string;
    creditorName?: string;
    amount?: string;
    upiId?: string;
  }>();

  const debtorName = params.debtorName || 'You';
  const creditorName = params.creditorName || 'Rohit Sharma';
  const upiId = params.upiId || 'rohit@okhdfc';
  const defaultAmount = params.amount || '1900';

  const [amount, setAmount] = useState(defaultAmount);
  const [method, setMethod] = useState<'upi_app' | 'qr' | 'cash'>('upi_app');
  const [notes, setNotes] = useState('SplitIt settlement');
  const [loading, setLoading] = useState(false);

  const handleAction = async () => {
    const numAmount = parseFloat(amount) || 0;
    if (numAmount <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Invalid Amount', 'Please enter a settlement amount greater than 0.');
      return;
    }

    if (method === 'qr') {
      Haptics.selectionAsync();
      router.push({
        pathname: '/settle/qr',
        params: {
          payeeName: creditorName,
          upiId,
          amount: numAmount.toString(),
          notes,
        },
      });
      return;
    }

    if (method === 'upi_app') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const launched = await launchUpiPayment({
        upiId,
        payeeName: creditorName,
        amount: numAmount,
        notes,
      });

      if (!launched) {
        Alert.alert(
          'No UPI App Detected',
          'Could not find a supported UPI app on your device. Opening high-contrast QR code instead.',
          [
            {
              text: 'Open QR Code',
              onPress: () => {
                router.push({
                  pathname: '/settle/qr',
                  params: {
                    payeeName: creditorName,
                    upiId,
                    amount: numAmount.toString(),
                    notes,
                  },
                });
              },
            },
          ]
        );
        return;
      }

      Alert.alert(
        'Payment Initiated',
        `Did your payment of ₹${numAmount.toLocaleString('en-IN')} complete successfully in your UPI app?`,
        [
          { text: 'No, Cancel', style: 'cancel' },
          {
            text: 'Yes, Record Payment',
            onPress: () => recordSettlement(numAmount, 'upi'),
          },
        ]
      );
      return;
    }

    if (method === 'cash') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await recordSettlement(numAmount, 'cash');
    }
  };

  const recordSettlement = async (numAmount: number, payMethod: 'upi' | 'cash') => {
    setLoading(true);
    const res = await settlementService.recordSettlement({
      groupId: params.groupId || 'default',
      payerId: params.debtorId || 'u1',
      payerName: debtorName,
      payeeId: params.creditorId || 'u2',
      payeeName: creditorName,
      amount: numAmount,
      method: payMethod,
      notes,
    });
    setLoading(false);

    if (res.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', res.error || 'Failed to record settlement');
    }
  };

  const numAmount = parseFloat(amount) || 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          style={styles.closeBtn}
        >
          <X size={20} color={THEME.colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settle Up</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Transfer Participants Flow */}
        <View style={styles.partiesFlowRow}>
          <View style={styles.partyItem}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{debtorName.charAt(0)}</Text>
            </View>
            <Text style={styles.partyName}>{debtorName}</Text>
            <Text style={styles.partyRole}>Payer</Text>
          </View>

          <View style={styles.arrowCircle}>
            <ArrowRight size={18} color={THEME.colors.primary} />
          </View>

          <View style={styles.partyItem}>
            <View style={[styles.avatarCircle, { backgroundColor: THEME.colors.surfaceElevated }]}>
              <Text style={styles.avatarText}>{creditorName.charAt(0)}</Text>
            </View>
            <Text style={styles.partyName}>{creditorName}</Text>
            <Text style={styles.partyRole}>Recipient</Text>
          </View>
        </View>

        {/* Large Amount Input */}
        <View style={styles.amountBlock}>
          <Text style={styles.amountEyebrow}>SETTLEMENT AMOUNT</Text>
          <View style={styles.amountRow}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={THEME.colors.textMuted}
            />
          </View>
        </View>

        {/* Method Selector */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionLabel}>PAYMENT METHOD</Text>

          {/* Option 1: UPI App Intent */}
          <TouchableOpacity
            style={[styles.methodCard, method === 'upi_app' && styles.methodCardActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setMethod('upi_app');
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.methodIconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.14)' }]}>
              <Zap size={18} color={THEME.colors.primary} />
            </View>
            <View style={styles.methodDetails}>
              <Text style={styles.methodTitle}>Pay via UPI App</Text>
              <Text style={styles.methodSubtitle}>Google Pay, PhonePe, Paytm, CRED</Text>
            </View>
            <View style={[styles.radioCircle, method === 'upi_app' && styles.radioCircleActive]} />
          </TouchableOpacity>

          {/* Option 2: High-Contrast QR Code */}
          <TouchableOpacity
            style={[styles.methodCard, method === 'qr' && styles.methodCardActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setMethod('qr');
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.methodIconBadge, { backgroundColor: 'rgba(139, 92, 246, 0.14)' }]}>
              <QrCode size={18} color={THEME.colors.aiLight} />
            </View>
            <View style={styles.methodDetails}>
              <Text style={styles.methodTitle}>Scan QR Code</Text>
              <Text style={styles.methodSubtitle}>Display high-contrast QR on screen</Text>
            </View>
            <View style={[styles.radioCircle, method === 'qr' && styles.radioCircleActive]} />
          </TouchableOpacity>

          {/* Option 3: Record Cash Payment */}
          <TouchableOpacity
            style={[styles.methodCard, method === 'cash' && styles.methodCardActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setMethod('cash');
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.methodIconBadge, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}>
              <Banknote size={18} color={THEME.colors.textSecondary} />
            </View>
            <View style={styles.methodDetails}>
              <Text style={styles.methodTitle}>Cash / Offline</Text>
              <Text style={styles.methodSubtitle}>Record payment made in cash or outside UPI</Text>
            </View>
            <View style={[styles.radioCircle, method === 'cash' && styles.radioCircleActive]} />
          </TouchableOpacity>
        </View>

        {/* Security / Non-Escrow Callout */}
        <View style={styles.securityCallout}>
          <ShieldCheck size={15} color={THEME.colors.textMuted} />
          <Text style={styles.securityText}>
            Direct P2P settlement: SplitIt does not hold or escrow funds.
          </Text>
        </View>
      </ScrollView>

      {/* Floating Bottom Action */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.actionBtn, (numAmount <= 0 || loading) && styles.actionBtnDisabled]}
          onPress={handleAction}
          disabled={loading || numAmount <= 0}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#000000" />
          ) : (
            <Text style={styles.actionBtnText}>
              {method === 'upi_app'
                ? `Pay ₹${numAmount.toLocaleString('en-IN')} via UPI`
                : method === 'qr'
                ? 'Open QR Code'
                : `Confirm ₹${numAmount.toLocaleString('en-IN')} Payment`}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  content: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 90,
    gap: 22,
  },

  // Parties Row
  partiesFlowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 14,
  },
  partyItem: {
    alignItems: 'center',
    gap: 4,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000000',
  },
  partyName: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  partyRole: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  arrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Amount Block
  amountBlock: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  amountEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.0,
    color: THEME.colors.textMuted,
    marginBottom: 6,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginTop: 4,
  },
  amountInput: {
    fontSize: 48,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -1,
    minWidth: 80,
    textAlign: 'center',
    paddingVertical: 0,
  },

  // Method Cards
  sectionContainer: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: THEME.colors.textMuted,
    marginBottom: 2,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: THEME.colors.surface,
    padding: 14,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  methodCardActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.surfaceElevated,
  },
  methodIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodDetails: {
    flex: 1,
  },
  methodTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  methodSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: THEME.colors.hairlineLight,
  },
  radioCircleActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.primary,
  },

  // Security
  securityCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  securityText: {
    flex: 1,
    fontSize: 11,
    color: THEME.colors.textMuted,
    lineHeight: 15,
  },

  // Bottom Sticky Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.90)',
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
  },
  actionBtn: {
    backgroundColor: THEME.colors.primary,
    paddingVertical: 14,
    borderRadius: THEME.radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  actionBtnDisabled: {
    opacity: 0.45,
    backgroundColor: THEME.colors.surfaceElevated,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000000',
  },
});
