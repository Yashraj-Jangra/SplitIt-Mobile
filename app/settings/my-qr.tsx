import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Copy,
  Check,
  Share2,
  QrCode,
  ArrowRight,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { THEME } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/auth.context';
import { buildUpiUrl, copyToClipboard } from '../../src/utils/upi';
import { haptics } from '../../src/services/haptics.service';
import { BRAND_QR_BADGE } from '../../src/components/brand/QuantumLogo';

export default function MyQrScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser, isLoading } = useAuth();
  const qrRef = useRef<any>(null);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const defaultUpi = user?.email ? `${user.email.split('@')[0]}@okaxis` : '';
  const upiId = user?.upiId?.trim() || defaultUpi;
  const displayName = user?.name || (user?.email ? user.email.split('@')[0] : 'You');
  const hasUpi = Boolean(upiId && upiId.includes('@'));

  const upiUrl = hasUpi
    ? buildUpiUrl({ upiId, payeeName: displayName, amount: 0, notes: 'SplitIt payment' })
    : '';

  const initials = displayName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleCopy = async () => {
    if (!hasUpi) return;
    const success = await copyToClipboard(upiId);
    if (success) {
      haptics.saveSuccess();
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleShare = async () => {
    if (!hasUpi) return;
    haptics.tap();
    try {
      await Share.share({
        message: `Pay me via UPI: ${upiId}\n\nSend money to ${displayName} on SplitIt.`,
        title: `${displayName}'s UPI Payment QR`,
      });
    } catch {
      // User cancelled share — no-op
    }
  };

  if (isLoading && !user) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              haptics.tap();
              router.back();
            }}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={20} color={THEME.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Payment QR</Text>
        </View>
        <View style={[styles.content, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Pinned Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={20} color={THEME.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Payment QR</Text>
      </View>

      <View style={[styles.content, { paddingBottom: 32 + insets.bottom }]}>
        {/* User Identity */}
        <View style={styles.identitySection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.displayName}>{displayName}</Text>
          <Text style={styles.instructionLabel}>
            {hasUpi ? 'Show this code to receive UPI payments' : 'Set up your UPI ID to receive payments'}
          </Text>
        </View>

        {hasUpi ? (
          <>
            {/* QR Code Card */}
            <View style={styles.qrCard}>
              <View style={styles.qrWhiteBox}>
                <QRCode
                  ref={qrRef}
                  value={upiUrl}
                  size={220}
                  color={THEME.colors.palette.black}
                  backgroundColor={THEME.colors.palette.white}
                  logo={BRAND_QR_BADGE}
                  logoSize={46}
                  logoBackgroundColor={THEME.colors.background}
                  logoBorderRadius={23}
                />
              </View>
              <Text style={styles.qrSubLabel}>
                Scan with Google Pay, PhonePe, Paytm, or any UPI app
              </Text>
            </View>

            {/* UPI ID Copy Row */}
            <View style={styles.upiRow}>
              <View style={styles.upiTextBlock}>
                <Text style={styles.upiRowLabel}>UPI ID</Text>
                <Text style={styles.upiRowValue} numberOfLines={1}>
                  {upiId}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={handleCopy}
                activeOpacity={0.8}
              >
                {copied ? (
                  <>
                    <Check size={14} color={THEME.colors.primary} />
                    <Text style={[styles.copyBtnText, { color: THEME.colors.primary }]}>
                      Copied
                    </Text>
                  </>
                ) : (
                  <>
                    <Copy size={14} color={THEME.colors.text} />
                    <Text style={styles.copyBtnText}>Copy</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Share Button */}
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <Share2 size={16} color={THEME.colors.primaryForeground} />
              <Text style={styles.shareBtnText}>Share UPI Details</Text>
            </TouchableOpacity>
          </>
        ) : (
          /* Empty State — no UPI configured */
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconBox}>
              <QrCode size={32} color={THEME.colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No UPI ID Configured</Text>
            <Text style={styles.emptySubtitle}>
              Add your UPI VPA address in Payment Settings so others can scan and pay you instantly.
            </Text>
            <TouchableOpacity
              style={styles.setupBtn}
              onPress={() => router.push('/settings/payment')}
              activeOpacity={0.8}
            >
              <Text style={styles.setupBtnText}>Set Up UPI ID</Text>
              <ArrowRight size={14} color={THEME.colors.primaryForeground} />
            </TouchableOpacity>
          </View>
        )}

        {/* Edit UPI shortcut */}
        {hasUpi && (
          <TouchableOpacity
            style={styles.editLink}
            onPress={() => router.push('/settings/payment')}
            activeOpacity={0.7}
          >
            <Text style={styles.editLinkText}>Edit UPI ID in Payment Settings</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.3,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    alignItems: 'center',
    gap: 20,
  },
  identitySection: {
    alignItems: 'center',
    gap: 6,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 2.5,
    borderColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '900',
    color: THEME.colors.text,
  },
  displayName: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.3,
  },
  instructionLabel: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    textAlign: 'center',
  },
  qrCard: {
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    padding: 20,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    width: '100%',
    gap: 14,
  },
  qrWhiteBox: {
    backgroundColor: THEME.colors.palette.white,
    padding: 16,
    borderRadius: THEME.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrSubLabel: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
  upiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: '100%',
    gap: 12,
  },
  upiTextBlock: {
    flex: 1,
  },
  upiRowLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: THEME.colors.textMuted,
    marginBottom: 2,
  },
  upiRowValue: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.radius.md,
    height: 48,
    width: '100%',
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.primaryForeground,
  },
  editLink: {
    paddingVertical: 8,
  },
  editLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
    textDecorationLine: 'underline',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    padding: 28,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    width: '100%',
    gap: 10,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  setupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: THEME.radius.md,
    marginTop: 4,
  },
  setupBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.primaryForeground,
  },
});
