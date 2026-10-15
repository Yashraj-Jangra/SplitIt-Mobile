import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, QrCode, Check, ExternalLink } from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/auth.context';
import { haptics } from '../../src/services/haptics.service';

const UPI_SUFFIXES = ['@okaxis', '@okhdfc', '@paytm', '@ybl', '@ibl'];

export default function PaymentSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, updateUserProfile, refreshUser } = useAuth();

  const [upiId, setUpiId] = useState(
    () => user?.upiId || (user?.email ? `${user.email.split('@')[0]}@okaxis` : '')
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (user?.upiId) {
      setUpiId(user.upiId);
    } else if (user?.email && !upiId) {
      setUpiId(`${user.email.split('@')[0]}@okaxis`);
    }
  }, [user?.upiId, user?.email]);

  const handleSuffixPick = (suffix: string) => {
    haptics.tap();
    const prefix = upiId.includes('@') ? upiId.split('@')[0] : upiId || (user?.email ? user.email.split('@')[0] : 'user');
    setUpiId(`${prefix}${suffix}`);
  };

  const handleSave = async () => {
    const trimmed = upiId.trim();
    if (!trimmed) {
      Alert.alert('Validation', 'Please enter your UPI ID before saving.');
      return;
    }
    if (!trimmed.includes('@')) {
      Alert.alert('Validation', 'UPI ID must include an @ symbol (e.g. username@okaxis).');
      return;
    }

    haptics.confirm();
    setIsSaving(true);
    try {
      const updated = await updateUserProfile({ upiId: trimmed });
      if (updated) {
        haptics.saveSuccess();
        Alert.alert('Saved', 'Your UPI ID has been updated.');
      } else {
        Alert.alert('Failed', 'Could not save UPI ID. Please try again.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update UPI ID.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreviewQr = () => {
    haptics.tap();
    router.push('/settings/my-qr');
  };

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
        <Text style={styles.headerTitle}>UPI & Payment</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* ── CARD: UPI / VPA ── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconBox}>
                <QrCode size={16} color={THEME.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>UPI & Quick Settlement</Text>
                <Text style={styles.cardSubtitle}>Your VPA address for instant settlements</Text>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>DEFAULT UPI ID (VPA)</Text>
              <TextInput
                style={styles.input}
                value={upiId}
                onChangeText={setUpiId}
                placeholder="e.g. username@okaxis or 9876543210@paytm"
                placeholderTextColor={THEME.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
            </View>

            {/* Quick Suffix Suggestions */}
            <View style={styles.suggestionRow}>
              {UPI_SUFFIXES.map((suffix) => (
                <TouchableOpacity
                  key={suffix}
                  style={styles.suffixPill}
                  onPress={() => handleSuffixPick(suffix)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suffixText}>{suffix}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Actions Row */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.previewBtn}
                onPress={handlePreviewQr}
                activeOpacity={0.7}
              >
                <QrCode size={15} color={THEME.colors.text} />
                <Text style={styles.previewBtnText}>Preview My QR</Text>
                <ExternalLink size={12} color={THEME.colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                disabled={isSaving}
                activeOpacity={0.8}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={THEME.colors.primaryForeground} />
                ) : (
                  <>
                    <Check size={15} color={THEME.colors.primaryForeground} strokeWidth={2.5} />
                    <Text style={styles.saveBtnText}>Save UPI ID</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Info Note */}
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              Your UPI VPA is used by other SplitIt members to send you money when settling group debts. It appears on your payment QR code.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 16,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    padding: 16,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  cardIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  cardSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  formGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.5,
  },
  input: {
    height: 44,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    paddingHorizontal: 12,
    color: THEME.colors.text,
    fontSize: 14,
  },
  suggestionRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  suffixPill: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
  },
  suffixText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  previewBtn: {
    flex: 1,
    height: 44,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  previewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 18,
    height: 44,
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.radius.md,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.primaryForeground,
  },
  infoCard: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    padding: 14,
  },
  infoText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    lineHeight: 18,
  },
});
