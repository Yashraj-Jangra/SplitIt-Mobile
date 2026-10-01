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
  const [notes, setNotes] = useState('SplitIt Goa Trip settlement');
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
        // Fallback to QR code if no UPI app answered the intent
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

      // Prompt to record settlement after returning from external UPI app
      Alert.alert(
        'Payment Initiated',
        `Did you complete the payment of ₹${numAmount} to ${creditorName}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes, Record Payment',
            onPress: async () => {
              await recordSettlement(numAmount, 'upi');
            },
          },
        ]
      );
      return;
    }

    // Cash / Bank Transfer
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await recordSettlement(numAmount, 'cash');
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          style={styles.closeButton}
        >
          <X size={20} color={THEME.colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settle Balance</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Transfer Participants Card */}
        <View style={styles.partiesCard}>
          <View style={styles.partyCol}>
            <View style={styles.partyAvatar}>
              <Text style={styles.partyAvatarText}>{debtorName.charAt(0)}</Text>
            </View>
            <Text style={styles.partyName}>{debtorName}</Text>
            <Text style={styles.partyRole}>Payer</Text>
          </View>

          <View style={styles.arrowContainer}>
            <ArrowRight size={22} color={THEME.colors.primary} />
          </View>

          <View style={styles.partyCol}>
            <View style={[styles.partyAvatar, { backgroundColor: THEME.colors.surfaceElevated }]}>
              <Text style={styles.partyAvatarText}>{creditorName.charAt(0)}</Text>
            </View>
            <Text style={styles.partyName}>{creditorName}</Text>
            <Text style={styles.partyRole}>Recipient</Text>
          </View>
        </View>

        {/* Amount Input */}
        <View style={styles.amountSection}>
          <Text style={styles.amountLabel}>SETTLEMENT AMOUNT</Text>
          <View style={styles.amountInputRow}>
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
        <View style={styles.methodSection}>
          <Text style={styles.sectionLabel}>CHOOSE SETTLEMENT METHOD</Text>

          {/* Option 1: UPI App Intent */}
          <TouchableOpacity
            style={[styles.methodCard, method === 'upi_app' && styles.methodCardActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setMethod('upi_app');
            }}
          >
            <View style={[styles.methodIconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
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
          >
            <View style={[styles.methodIconBadge, { backgroundColor: 'rgba(139, 92, 246, 0.12)' }]}>
              <QrCode size={18} color={THEME.colors.aiLight} />
            </View>
            <View style={styles.methodDetails}>
              <Text style={styles.methodTitle}>Scan High-Contrast QR</Text>
              <Text style={styles.methodSubtitle}>Display scannable QR on screen or copy UPI ID</Text>
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
          >
            <View style={[styles.methodIconBadge, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}>
              <Banknote size={18} color={THEME.colors.textSecondary} />
            </View>
            <View style={styles.methodDetails}>
              <Text style={styles.methodTitle}>Record Cash / Offline Payment</Text>
              <Text style={styles.methodSubtitle}>Settle balance without digital payment intent</Text>
            </View>
            <View style={[styles.radioCircle, method === 'cash' && styles.radioCircleActive]} />
          </TouchableOpacity>
        </View>

        {/* Security / Disclaimer Callout */}
        <View style={styles.securityCallout}>
          <ShieldCheck size={16} color={THEME.colors.textMuted} />
          <Text style={styles.securityText}>
            SplitIt does not intermediate or hold funds. Payments are routed directly to recipient's bank via UPI.
          </Text>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={styles.primaryActionButton}
          onPress={handleAction}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#09090B" />
          ) : (
            <Text style={styles.primaryActionText}>
              {method === 'upi_app'
                ? 'Launch UPI Payment'
                : method === 'qr'
                ? 'View High-Contrast QR Code'
                : 'Confirm & Record Payment'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  closeButton: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  content: {
    padding: 20,
    gap: 20,
  },
  partiesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.surface,
    padding: 20,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  partyCol: {
    alignItems: 'center',
    flex: 1,
  },
  partyAvatar: {
    width: 50,
    height: 50,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  partyAvatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#09090B',
  },
  partyName: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
    textAlign: 'center',
  },
  partyRole: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  arrowContainer: {
    paddingHorizontal: 10,
  },
  amountSection: {
    alignItems: 'center',
    gap: 8,
  },
  amountLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: THEME.colors.textMuted,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencySymbol: {
    fontSize: 36,
    fontWeight: '900',
    color: THEME.colors.primary,
    marginRight: 4,
  },
  amountInput: {
    fontSize: 44,
    fontWeight: '900',
    color: THEME.colors.text,
    minWidth: 100,
    textAlign: 'center',
  },
  methodSection: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: THEME.colors.textMuted,
    marginBottom: 4,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    padding: 16,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: 12,
  },
  methodCardActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  methodIconBadge: {
    width: 38,
    height: 38,
    borderRadius: THEME.radius.sm,
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
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: THEME.colors.textMuted,
  },
  radioCircleActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.primary,
  },
  securityCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.surfaceSubtle,
    padding: 12,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  securityText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    flex: 1,
    lineHeight: 16,
  },
  primaryActionButton: {
    backgroundColor: THEME.colors.primary,
    paddingVertical: 14,
    borderRadius: THEME.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#09090B',
  },
});
