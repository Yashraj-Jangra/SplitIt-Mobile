import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X, Copy, Check, ShieldCheck, ArrowRight } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { THEME } from '../../src/constants/theme';
import { buildUpiUrl, copyToClipboard } from '../../src/utils/upi';
import { settlementService } from '../../src/services/settlement.service';
import * as Haptics from 'expo-haptics';

export default function UpiQrModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    groupId?: string;
    payeeName?: string;
    upiId?: string;
    amount?: string;
    notes?: string;
  }>();

  const payeeName = params.payeeName || 'Rohit Sharma';
  const upiId = params.upiId || 'rohit@okhdfc';
  const amount = parseFloat(params.amount || '1900') || 1900;
  const notes = params.notes || 'SplitIt Settlement';

  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const upiUrl = buildUpiUrl({
    upiId,
    payeeName,
    amount,
    notes,
  });

  const handleCopy = async () => {
    const success = await copyToClipboard(upiId);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleConfirmPaid = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);

    const res = await settlementService.recordSettlement({
      groupId: params.groupId || 'default',
      payerId: 'u1',
      payerName: 'You',
      payeeId: 'u2',
      payeeName,
      amount,
      method: 'upi',
      notes,
    });
    setLoading(false);

    if (res.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Dismiss back to group detail
      router.dismissAll();
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
        <Text style={styles.headerTitle}>Scan UPI QR</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Recipient & Amount Info */}
        <View style={styles.payeeSection}>
          <Text style={styles.payeeLabel}>PAYING TO</Text>
          <Text style={styles.payeeName}>{payeeName}</Text>
          <Text style={styles.amountDisplay}>₹{amount.toLocaleString()}</Text>
        </View>

        {/* High-Contrast QR Code Card */}
        <View style={styles.qrCardContainer}>
          <View style={styles.qrWhiteBox}>
            <QRCode
              value={upiUrl}
              size={210}
              color="#000000"
              backgroundColor="#FFFFFF"
            />
          </View>
          <Text style={styles.qrInstruction}>
            Scan with Google Pay, PhonePe, Paytm, or any UPI app
          </Text>
        </View>

        {/* UPI ID Pill with 1-Tap Copy */}
        <View style={styles.upiPillRow}>
          <View style={styles.upiTextContainer}>
            <Text style={styles.upiPillLabel}>UPI ID</Text>
            <Text style={styles.upiPillValue} numberOfLines={1}>
              {upiId}
            </Text>
          </View>
          <TouchableOpacity style={styles.copyButton} onPress={handleCopy} activeOpacity={0.8}>
            {copied ? (
              <>
                <Check size={14} color={THEME.colors.primary} />
                <Text style={[styles.copyButtonText, { color: THEME.colors.primary }]}>Copied</Text>
              </>
            ) : (
              <>
                <Copy size={14} color={THEME.colors.text} />
                <Text style={styles.copyButtonText}>Copy ID</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimerBox}>
          <ShieldCheck size={15} color={THEME.colors.textMuted} />
          <Text style={styles.disclaimerText}>
            Direct peer-to-peer settlement. Funds transfer immediately between linked bank accounts.
          </Text>
        </View>

        {/* Primary Confirmation Action */}
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleConfirmPaid}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#09090B" />
          ) : (
            <>
              <Text style={styles.confirmButtonText}>I Have Paid ₹{amount.toLocaleString()}</Text>
              <ArrowRight size={18} color="#09090B" />
            </>
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
    padding: 24,
    alignItems: 'center',
    gap: 20,
  },
  payeeSection: {
    alignItems: 'center',
  },
  payeeLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: THEME.colors.textMuted,
    marginBottom: 2,
  },
  payeeName: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  amountDisplay: {
    fontSize: 32,
    fontWeight: '900',
    color: THEME.colors.primary,
    marginTop: 4,
  },
  qrCardContainer: {
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    padding: 20,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    width: '100%',
  },
  qrWhiteBox: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: THEME.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrInstruction: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 16,
  },
  upiPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: '100%',
  },
  upiTextContainer: {
    flex: 1,
  },
  upiPillLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: THEME.colors.textMuted,
  },
  upiPillValue: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
    marginTop: 1,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.sm,
  },
  copyButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.surfaceSubtle,
    padding: 12,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    width: '100%',
  },
  disclaimerText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    flex: 1,
    lineHeight: 15,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    paddingVertical: 14,
    borderRadius: THEME.radius.md,
    width: '100%',
    marginTop: 4,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#09090B',
  },
});
