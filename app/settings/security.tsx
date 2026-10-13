import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Lock,
  Eye,
  EyeOff,
  ShieldAlert,
  Trash2,
  Check,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { authService } from '../../src/services/auth.service';
import * as Haptics from 'expo-haptics';

export default function SecuritySettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdatePassword = async () => {
    if (!currentPassword) {
      Alert.alert('Validation Error', 'Please enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Validation Error', 'New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Validation Error', 'New passwords do not match.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsUpdating(true);
    try {
      const res = await authService.changePassword(currentPassword, newPassword);
      if (res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success', 'Your password has been changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        Alert.alert('Update Failed', res.error || 'Failed to update password.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update password.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Pinned Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={20} color={THEME.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Security</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* ── CARD: CHANGE PASSWORD ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconBox}>
              <Lock size={16} color={THEME.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Security & Credentials</Text>
              <Text style={styles.cardSubtitle}>Manage your account login password</Text>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>CURRENT PASSWORD</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="••••••••"
                placeholderTextColor={THEME.colors.textMuted}
                secureTextEntry={!showCurrentPw}
                returnKeyType="next"
              />
              <TouchableOpacity
                onPress={() => setShowCurrentPw(!showCurrentPw)}
                style={styles.eyeBtn}
              >
                {showCurrentPw ? (
                  <EyeOff size={16} color={THEME.colors.textMuted} />
                ) : (
                  <Eye size={16} color={THEME.colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>NEW PASSWORD (MIN. 6 CHARACTERS)</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="••••••••"
                placeholderTextColor={THEME.colors.textMuted}
                secureTextEntry={!showNewPw}
                returnKeyType="next"
              />
              <TouchableOpacity
                onPress={() => setShowNewPw(!showNewPw)}
                style={styles.eyeBtn}
              >
                {showNewPw ? (
                  <EyeOff size={16} color={THEME.colors.textMuted} />
                ) : (
                  <Eye size={16} color={THEME.colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>CONFIRM NEW PASSWORD</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••"
                placeholderTextColor={THEME.colors.textMuted}
                secureTextEntry={!showConfirmPw}
                returnKeyType="done"
                onSubmitEditing={handleUpdatePassword}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPw(!showConfirmPw)}
                style={styles.eyeBtn}
              >
                {showConfirmPw ? (
                  <EyeOff size={16} color={THEME.colors.textMuted} />
                ) : (
                  <Eye size={16} color={THEME.colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.updateBtn}
            onPress={handleUpdatePassword}
            disabled={isUpdating}
            activeOpacity={0.8}
          >
            {isUpdating ? (
              <ActivityIndicator size="small" color={THEME.colors.primaryForeground} />
            ) : (
              <>
                <Check size={16} color={THEME.colors.primaryForeground} strokeWidth={2.5} />
                <Text style={styles.updateBtnText}>Update Password</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── DANGER ZONE ── */}
        <View style={styles.dangerCard}>
          <View style={styles.dangerHeader}>
            <View style={styles.dangerIconBox}>
              <ShieldAlert size={17} color={THEME.colors.negative} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.dangerTitle}>Danger Zone</Text>
              <Text style={styles.dangerSubtitle}>Irreversible account actions</Text>
            </View>
          </View>

          <Text style={styles.dangerWarning}>
            Permanently delete your user profile, wipe settled transactions, and dissociate your email. This action cannot be undone.
          </Text>

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              router.push('/legal/delete-account');
            }}
            activeOpacity={0.8}
          >
            <Trash2 size={16} color={THEME.colors.negative} strokeWidth={2.2} />
            <Text style={styles.deleteBtnText}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  passwordRow: {
    height: 44,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  passwordInput: {
    flex: 1,
    color: THEME.colors.text,
    fontSize: 14,
  },
  eyeBtn: {
    padding: 6,
  },
  updateBtn: {
    height: 46,
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 2,
  },
  updateBtnText: {
    color: THEME.colors.primaryForeground,
    fontSize: 13,
    fontWeight: '700',
  },
  dangerCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.negative + '40',
    padding: 16,
    gap: 12,
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  dangerIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: THEME.colors.negative + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.negative,
  },
  dangerSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  dangerWarning: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    lineHeight: 18,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.negative + '14',
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.negative + '30',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.negative,
  },
});
