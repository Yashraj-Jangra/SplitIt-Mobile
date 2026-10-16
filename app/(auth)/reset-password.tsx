import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Lock, Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { QuantumLogo } from '../../src/components/brand/QuantumLogo';
import { authService } from '../../src/services/auth.service';
import { haptics } from '../../src/services/haptics.service';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string; error?: string }>();
  const token = typeof params.token === 'string' ? params.token : Array.isArray(params.token) ? params.token[0] : '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(params.error === 'INVALID_TOKEN' ? 'Your recovery link is invalid or expired.' : null);

  const handleSubmit = async () => {
    if (!token) {
      haptics.error();
      setError('Invalid or missing recovery token. Please request a new link.');
      return;
    }

    if (newPassword.length < 6) {
      haptics.error();
      setError('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      haptics.error();
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setLoading(true);
    haptics.tap();

    try {
      const res = await authService.resetPassword(token, newPassword);
      if (res.success) {
        haptics.saveSuccess();
        setSubmitted(true);
      } else {
        haptics.error();
        setError(res.error || 'Failed to reset password. Link may be expired.');
      }
    } catch (err: any) {
      haptics.error();
      setError(err?.message || 'Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Bar with Back Button */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => {
                haptics.tap();
                router.replace('/(auth)/login');
              }}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Back to login"
            >
              <ArrowLeft size={20} color={THEME.colors.text} />
            </TouchableOpacity>
          </View>

          {/* Logo & Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <QuantumLogo size={52} />
            </View>
            <Text style={styles.title}>Set New Password</Text>
            <Text style={styles.subtitle}>
              {submitted
                ? 'Your password has been successfully updated.'
                : 'Create a new, strong password for your account.'}
            </Text>
          </View>

          {/* Body */}
          {submitted ? (
            <View style={styles.successCard}>
              <View style={styles.successIconBox}>
                <CheckCircle2 size={36} color={THEME.colors.success} />
              </View>
              <Text style={styles.successTitle}>Password Updated</Text>
              <Text style={styles.successBody}>
                You can now log in using your new password.
              </Text>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  haptics.tap();
                  router.replace('/(auth)/login');
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryButtonText}>Sign In Now</Text>
                <ArrowRight size={18} color={THEME.colors.primaryForeground} />
              </TouchableOpacity>
            </View>
          ) : !token ? (
            <View style={styles.formCard}>
              <View style={styles.errorContainer}>
                <AlertCircle size={16} color={THEME.colors.critical} />
                <Text style={styles.errorText}>No recovery token found. Please request a new recovery link.</Text>
              </View>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  haptics.tap();
                  router.replace('/(auth)/forgot-password');
                }}
              >
                <Text style={styles.primaryButtonText}>Request Reset Link</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.formCard}>
              {error && (
                <View style={styles.errorContainer}>
                  <AlertCircle size={16} color={THEME.colors.critical} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Text style={styles.inputLabel}>New Password</Text>
              <View style={styles.inputContainer}>
                <Lock size={18} color={THEME.colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="At least 6 characters"
                  placeholderTextColor={THEME.colors.textMuted}
                  value={newPassword}
                  onChangeText={(t) => {
                    setNewPassword(t);
                    if (error) setError(null);
                  }}
                  secureTextEntry={!showPassword}
                  returnKeyType="next"
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => {
                    haptics.tap();
                    setShowPassword(!showPassword);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {showPassword ? (
                    <EyeOff size={18} color={THEME.colors.textMuted} />
                  ) : (
                    <Eye size={18} color={THEME.colors.textMuted} />
                  )}
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Confirm New Password</Text>
              <View style={styles.inputContainer}>
                <Lock size={18} color={THEME.colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Repeat your new password"
                  placeholderTextColor={THEME.colors.textMuted}
                  value={confirmPassword}
                  onChangeText={(t) => {
                    setConfirmPassword(t);
                    if (error) setError(null);
                  }}
                  secureTextEntry={!showConfirmPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => {
                    haptics.tap();
                    setShowConfirmPassword(!showConfirmPassword);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} color={THEME.colors.textMuted} />
                  ) : (
                    <Eye size={18} color={THEME.colors.textMuted} />
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Update password"
              >
                {loading ? (
                  <ActivityIndicator size="small" color={THEME.colors.primaryForeground} />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>Update Password</Text>
                    <ArrowRight size={18} color={THEME.colors.primaryForeground} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  topBar: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 32,
  },
  logoContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: THEME.colors.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  formCard: {
    gap: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.critical,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: THEME.radius.md,
    gap: 8,
  },
  errorText: {
    color: THEME.colors.critical,
    fontSize: 13,
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text,
    marginBottom: -8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.lg,
    paddingHorizontal: 14,
    height: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: THEME.colors.text,
    fontSize: 15,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.radius.lg,
    height: 50,
    gap: 8,
    marginTop: 8,
  },
  primaryButtonText: {
    color: THEME.colors.primaryForeground,
    fontSize: 15,
    fontWeight: '600',
  },
  successCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  successIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  successBody: {
    fontSize: 14,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
