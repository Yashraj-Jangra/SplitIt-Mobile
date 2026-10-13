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
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  User,
  Mail,
  QrCode,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  Check,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/auth.context';
import { authService } from '../../src/services/auth.service';
import * as Haptics from 'expo-haptics';

export default function AccountSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, updateUserProfile } = useAuth();

  const nameParts = (user?.name || '').trim().split(' ');

  // Profile Form States initialized lazily
  const [firstName, setFirstName] = useState(() => user?.firstName || nameParts[0] || '');
  const [lastName, setLastName] = useState(() => user?.lastName || nameParts.slice(1).join(' ') || '');
  const [username, setUsername] = useState(() => user?.username || (user?.email ? user.email.split('@')[0] : ''));
  const [mobileNumber, setMobileNumber] = useState(() => user?.mobileNumber || '');
  const [countryCode, setCountryCode] = useState(() => user?.countryCode || '+91');
  const [avatarUrl, setAvatarUrl] = useState(() => user?.avatarUrl || '');
  const [upiId, setUpiId] = useState(() => user?.upiId || (user?.email ? `${user.email.split('@')[0]}@okaxis` : ''));
  const [imageError, setImageError] = useState(false);

  // Password Form States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Loading States
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  const handleSaveProfile = async () => {
    if (!firstName.trim()) {
      Alert.alert('Validation Error', 'First name is required.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSavingProfile(true);

    try {
      const updated = await updateUserProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim().toLowerCase(),
        mobileNumber: mobileNumber.trim(),
        countryCode: countryCode.trim(),
        avatarUrl: avatarUrl.trim() || undefined,
        upiId: upiId.trim(),
      });

      if (updated) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Saved', 'Your profile and payment details have been updated.');
      } else {
        Alert.alert('Update Failed', 'Could not save profile changes. Please try again.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

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
    setIsUpdatingPassword(true);

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
      setIsUpdatingPassword(false);
    }
  };

  const handleOpenQrPreview = () => {
    Haptics.selectionAsync();
    const effectiveName = `${firstName} ${lastName}`.trim() || user?.name || 'You';
    const effectiveUpi = upiId.trim() || (user?.email ? `${user.email.split('@')[0]}@okaxis` : 'yashraj@okaxis');
    router.push(
      `/settle/qr?amount=0&name=${encodeURIComponent(effectiveName)}&upiId=${encodeURIComponent(effectiveUpi)}`
    );
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
        <Text style={styles.headerTitle}>Account & Security</Text>
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
          {/* Avatar Hero Banner */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarCircle}>
              {avatarUrl && !imageError ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.avatarImage}
                  onError={() => setImageError(true)}
                />
              ) : (
                <Text style={styles.avatarText}>{initials}</Text>
              )}
            </View>
            <Text style={styles.avatarSubtext}>
              {avatarUrl && !imageError ? 'Custom Avatar Photo' : 'Initials Placeholder'}
            </Text>
          </View>

          {/* ── CARD 1: PERSONAL INFORMATION ── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconBox}>
                <User size={16} color={THEME.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Personal Information</Text>
                <Text style={styles.cardSubtitle}>Your public profile across groups</Text>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>AVATAR IMAGE URL</Text>
              <TextInput
                style={styles.input}
                value={avatarUrl}
                onChangeText={(text) => {
                  setAvatarUrl(text);
                  setImageError(false);
                }}
                placeholder="https://images.com/your-avatar.jpg"
                placeholderTextColor={THEME.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.rowFields}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>FIRST NAME *</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First Name"
                  placeholderTextColor={THEME.colors.textMuted}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>LAST NAME</Text>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last Name"
                  placeholderTextColor={THEME.colors.textMuted}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>USERNAME</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="username"
                placeholderTextColor={THEME.colors.textMuted}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>ACCOUNT EMAIL</Text>
              <View style={styles.readonlyInputRow}>
                <Mail size={15} color={THEME.colors.textMuted} />
                <Text style={styles.readonlyInputText}>{user?.email || 'user@example.com'}</Text>
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedBadgeText}>VERIFIED</Text>
                </View>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>MOBILE PHONE NUMBER</Text>
              <View style={styles.phoneInputRow}>
                <TextInput
                  style={styles.countryCodeInput}
                  value={countryCode}
                  onChangeText={setCountryCode}
                  placeholder="+91"
                  placeholderTextColor={THEME.colors.textMuted}
                  keyboardType="phone-pad"
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={mobileNumber}
                  onChangeText={setMobileNumber}
                  placeholder="9876543210"
                  placeholderTextColor={THEME.colors.textMuted}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* Save Profile Button */}
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSaveProfile}
              disabled={isSavingProfile}
              activeOpacity={0.8}
            >
              {isSavingProfile ? (
                <ActivityIndicator size="small" color={THEME.colors.primaryForeground} />
              ) : (
                <>
                  <Check size={16} color={THEME.colors.primaryForeground} strokeWidth={2.5} />
                  <Text style={styles.saveBtnText}>Save Profile Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* ── CARD 2: UPI & PAYMENT PREFERENCES ── */}
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
              />
            </View>

            {/* Quick Suffix Suggestions */}
            <View style={styles.suggestionRow}>
              {['@okaxis', '@okhdfc', '@paytm', '@ybl'].map((suffix) => (
                <TouchableOpacity
                  key={suffix}
                  style={styles.suffixPill}
                  onPress={() => {
                    Haptics.selectionAsync();
                    const prefix = upiId.includes('@') ? upiId.split('@')[0] : upiId || (user?.email ? user.email.split('@')[0] : 'user');
                    setUpiId(`${prefix}${suffix}`);
                  }}
                >
                  <Text style={styles.suffixText}>{suffix}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.cardActionRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleOpenQrPreview}
                activeOpacity={0.7}
              >
                <QrCode size={15} color={THEME.colors.text} />
                <Text style={styles.secondaryBtnText}>Preview QR Code</Text>
                <ExternalLink size={13} color={THEME.colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveSmallBtn}
                onPress={handleSaveProfile}
                disabled={isSavingProfile}
                activeOpacity={0.8}
              >
                <Text style={styles.saveSmallBtnText}>Save VPA</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── CARD 3: SECURITY & PASSWORD ── */}
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
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="••••••••"
                  placeholderTextColor={THEME.colors.textMuted}
                  secureTextEntry={!showCurrentPw}
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
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="••••••••"
                  placeholderTextColor={THEME.colors.textMuted}
                  secureTextEntry={!showNewPw}
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
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="••••••••"
                  placeholderTextColor={THEME.colors.textMuted}
                  secureTextEntry={!showConfirmPw}
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
              style={styles.saveBtn}
              onPress={handleUpdatePassword}
              disabled={isUpdatingPassword}
              activeOpacity={0.8}
            >
              {isUpdatingPassword ? (
                <ActivityIndicator size="small" color={THEME.colors.primaryForeground} />
              ) : (
                <>
                  <Lock size={16} color={THEME.colors.primaryForeground} strokeWidth={2.5} />
                  <Text style={styles.saveBtnText}>Update Password</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* ── CARD 4: DANGER ZONE (MOVED HERE AS REQUESTED) ── */}
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

            <Text style={styles.dangerWarningText}>
              Permanently delete your user profile, wipe settled transactions, and dissociate your email. This action cannot be undone.
            </Text>

            <TouchableOpacity
              style={styles.deleteAccountBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                router.push('/legal/delete-account');
              }}
              activeOpacity={0.8}
            >
              <Trash2 size={16} color={THEME.colors.negative} strokeWidth={2.2} />
              <Text style={styles.deleteAccountText}>Delete Account</Text>
            </TouchableOpacity>
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
    paddingTop: 16,
    gap: 16,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 2.5,
    borderColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 8,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '900',
    color: THEME.colors.text,
  },
  avatarSubtext: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
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
  rowFields: {
    flexDirection: 'row',
    gap: 10,
  },
  readonlyInputRow: {
    height: 44,
    backgroundColor: THEME.colors.surfaceElevated + '80',
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  readonlyInputText: {
    flex: 1,
    color: THEME.colors.textMuted,
    fontSize: 13,
  },
  verifiedBadge: {
    backgroundColor: THEME.colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  verifiedBadgeText: {
    color: THEME.colors.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  countryCodeInput: {
    height: 44,
    width: 60,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    color: THEME.colors.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  saveBtn: {
    height: 46,
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  saveBtnText: {
    color: THEME.colors.primaryForeground,
    fontSize: 13,
    fontWeight: '700',
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
  cardActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  secondaryBtn: {
    flex: 1,
    height: 42,
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
  secondaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  saveSmallBtn: {
    height: 42,
    paddingHorizontal: 16,
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveSmallBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primaryForeground,
  },
  passwordInputContainer: {
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
  dangerWarningText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    lineHeight: 18,
  },
  deleteAccountBtn: {
    height: 46,
    backgroundColor: THEME.colors.negative + '15',
    borderWidth: 1,
    borderColor: THEME.colors.negative + '50',
    borderRadius: THEME.radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  deleteAccountText: {
    color: THEME.colors.negative,
    fontSize: 13,
    fontWeight: '700',
  },
});
