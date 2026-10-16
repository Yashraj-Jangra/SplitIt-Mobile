import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, User, Mail, Check, Camera } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { THEME } from '../../src/constants/theme';
import { QuantumSpinner } from '../../src/components/brand/QuantumLogo';
import { useAuth } from '../../src/contexts/auth.context';
import { authService } from '../../src/services/auth.service';
import { haptics } from '../../src/services/haptics.service';

export default function AccountSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, updateUserProfile } = useAuth();

  const nameParts = (user?.name || '').trim().split(' ');

  const [firstName, setFirstName] = useState(() => user?.firstName || nameParts[0] || '');
  const [lastName, setLastName] = useState(() => user?.lastName || nameParts.slice(1).join(' ') || '');
  const [username, setUsername] = useState(() => user?.username || (user?.email ? user.email.split('@')[0] : ''));
  const [mobileNumber, setMobileNumber] = useState(() => user?.mobileNumber || '');
  const [countryCode, setCountryCode] = useState(() => user?.countryCode || '+91');
  const [avatarUrl, setAvatarUrl] = useState(() => user?.avatarUrl || '');
  const [imageError, setImageError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  const handlePickAvatar = () => {
    Alert.alert('Profile Photo', 'Choose a source for your avatar', [
      {
        text: 'Take Photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Camera access is required to take a photo.');
            return;
          }
          const res = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          });
          if (!res.canceled && res.assets[0]?.uri) {
            await uploadAvatarFile(res.assets[0].uri);
          }
        },
      },
      {
        text: 'Choose from Gallery',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Gallery access is required.');
            return;
          }
          const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          });
          if (!res.canceled && res.assets[0]?.uri) {
            await uploadAvatarFile(res.assets[0].uri);
          }
        },
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]);
  };

  const uploadAvatarFile = async (uri: string) => {
    setIsUploadingAvatar(true);
    haptics.tap();
    try {
      const uploadedUrl = await authService.uploadAvatar(uri);
      if (uploadedUrl) {
        setAvatarUrl(uploadedUrl);
        setImageError(false);
        haptics.saveSuccess();
      } else {
        haptics.error();
        Alert.alert('Upload Failed', 'Failed to upload profile photo. Please try again.');
      }
    } catch {
      haptics.error();
      Alert.alert('Upload Error', 'An unexpected error occurred during photo upload.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!firstName.trim()) {
      Alert.alert('Validation Error', 'First name is required.');
      return;
    }

    haptics.confirm();
    setIsSaving(true);
    try {
      const updated = await updateUserProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim().toLowerCase(),
        mobileNumber: mobileNumber.trim(),
        countryCode: countryCode.trim(),
        avatarUrl: avatarUrl.trim() || undefined,
      });

      if (updated) {
        haptics.saveSuccess();
        Alert.alert('Saved', 'Your profile has been updated.');
      } else {
        Alert.alert('Update Failed', 'Could not save profile changes. Please try again.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
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
        <Text style={styles.headerTitle}>Account Information</Text>
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
            <TouchableOpacity
              onPress={handlePickAvatar}
              disabled={isUploadingAvatar}
              activeOpacity={0.85}
              style={styles.avatarWrapper}
              accessibilityRole="button"
              accessibilityLabel="Change profile picture"
            >
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
                {isUploadingAvatar && (
                  <View style={styles.avatarLoadingOverlay}>
                    <QuantumSpinner size={18} color={THEME.colors.primaryForeground} />
                  </View>
                )}
              </View>
              <View style={styles.cameraBadge}>
                <Camera size={13} color={THEME.colors.primaryForeground} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handlePickAvatar}
              disabled={isUploadingAvatar}
              hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
            >
              <Text style={styles.changePhotoText}>
                {isUploadingAvatar ? 'Uploading Photo...' : 'Change Profile Photo'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── CARD: PERSONAL INFORMATION ── */}
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

            <View style={styles.rowFields}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>FIRST NAME *</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First Name"
                  placeholderTextColor={THEME.colors.textMuted}
                  returnKeyType="next"
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
                  returnKeyType="next"
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
                returnKeyType="next"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>ACCOUNT EMAIL</Text>
              <View style={styles.readonlyRow}>
                <Mail size={15} color={THEME.colors.textMuted} />
                <Text style={styles.readonlyText}>{user?.email || 'user@example.com'}</Text>
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedBadgeText}>VERIFIED</Text>
                </View>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>MOBILE PHONE NUMBER</Text>
              <View style={styles.phoneRow}>
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
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              {isSaving ? (
                <QuantumSpinner size={18} color={THEME.colors.primaryForeground} />
              ) : (
                <>
                  <Check size={16} color={THEME.colors.primaryForeground} strokeWidth={2.5} />
                  <Text style={styles.saveBtnText}>Save Profile Changes</Text>
                </>
              )}
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
  avatarWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  avatarCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 2.5,
    borderColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '900',
    color: THEME.colors.text,
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: THEME.colors.glassDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: THEME.colors.background,
  },
  changePhotoText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.primary,
    marginTop: 4,
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
  readonlyRow: {
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
  readonlyText: {
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
  phoneRow: {
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
});
