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
import { useRouter } from 'expo-router';
import { ArrowLeft, Mail, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { QuantumLogo } from '../../src/components/brand/QuantumLogo';
import { authService } from '../../src/services/auth.service';
import { haptics } from '../../src/services/haptics.service';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim() || !email.includes('@')) {
      haptics.error();
      setError('Please enter a valid email address');
      return;
    }

    setError(null);
    setLoading(true);
    haptics.tap();

    try {
      const res = await authService.sendPasswordReset(email.trim());
      if (res.success) {
        haptics.saveSuccess();
        setSubmitted(true);
      } else {
        haptics.error();
        setError(res.error || 'Failed to send reset link');
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
                router.back();
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
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              {submitted
                ? "We've dispatched a recovery link to your inbox."
                : "Enter your registered email address and we'll send you a link to reset your password."}
            </Text>
          </View>

          {/* Body */}
          {submitted ? (
            <View style={styles.successCard}>
              <View style={styles.successIconBox}>
                <CheckCircle2 size={36} color={THEME.colors.success} />
              </View>
              <Text style={styles.successTitle}>Recovery Email Sent</Text>
              <Text style={styles.successBody}>
                Instructions to set a new password have been sent to{' '}
                <Text style={styles.highlightText}>{email.trim()}</Text>.
              </Text>
              <Text style={styles.successNote}>
                Didn't see it? Please check your spam or promotions folder. The link expires in 1 hour.
              </Text>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  haptics.tap();
                  router.replace('/(auth)/login');
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryButtonText}>Return to Sign In</Text>
                <ArrowRight size={18} color={THEME.colors.primaryForeground} />
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

              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.inputContainer}>
                <Mail size={18} color={THEME.colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="name@example.com"
                  placeholderTextColor={THEME.colors.textMuted}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (error) setError(null);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  editable={!loading}
                />
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Send recovery link"
              >
                {loading ? (
                  <ActivityIndicator size="small" color={THEME.colors.primaryForeground} />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>Send Recovery Link</Text>
                    <ArrowRight size={18} color={THEME.colors.primaryForeground} />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  haptics.tap();
                  router.back();
                }}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Remember your password? Sign In</Text>
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
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: THEME.colors.textMuted,
    fontSize: 14,
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
  highlightText: {
    color: THEME.colors.text,
    fontWeight: '600',
  },
  successNote: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
});
