import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { User, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/auth.context';
import * as Haptics from 'expo-haptics';

export default function SignupScreen() {
  const router = useRouter();
  const { signUpWithEmail, signInWithGoogle } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !password) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Password must be at least 8 characters long');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    setError(null);

    const res = await signUpWithEmail(name, email, password);
    setLoading(false);

    if (res.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(res.error || 'Failed to create account. Please try again.');
    }
  };

  const handleGoogleSignup = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setGoogleLoading(true);
    setError(null);

    const res = await signInWithGoogle();
    setGoogleLoading(false);

    if (res.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } else if (res.error && res.error !== 'Google sign-in was canceled') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(res.error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Start splitting and settling expenses seamlessly.
            </Text>
          </View>

          {/* Error Banner */}
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Google Quick Sign-up */}
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignup}
            disabled={googleLoading}
            activeOpacity={0.8}
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <View style={styles.googleIconBadge}>
                  <Text style={styles.googleIconText}>G</Text>
                </View>
                <Text style={styles.googleButtonText}>Sign up with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or register with email</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Registration Form */}
          <View style={styles.form}>
            {/* Name */}
            <View style={styles.inputContainer}>
              <User size={18} color={THEME.colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor={THEME.colors.textMuted}
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  if (error) setError(null);
                }}
              />
            </View>

            {/* Email */}
            <View style={styles.inputContainer}>
              <Mail size={18} color={THEME.colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor={THEME.colors.textMuted}
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (error) setError(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Password */}
            <View style={styles.inputContainer}>
              <Lock size={18} color={THEME.colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password (min. 8 characters)"
                placeholderTextColor={THEME.colors.textMuted}
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  if (error) setError(null);
                }}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowPassword(!showPassword);
                }}
                style={styles.eyeButton}
              >
                {showPassword ? (
                  <EyeOff size={18} color={THEME.colors.textMuted} />
                ) : (
                  <Eye size={18} color={THEME.colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>

            {/* Confirm Password */}
            <View style={styles.inputContainer}>
              <Lock size={18} color={THEME.colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor={THEME.colors.textMuted}
                value={confirmPassword}
                onChangeText={(t) => {
                  setConfirmPassword(t);
                  if (error) setError(null);
                }}
                secureTextEntry={!showPassword}
              />
            </View>

            {/* Submit Action */}
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#09090B" />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>Create Account</Text>
                  <ArrowRight size={18} color="#09090B" />
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Switch to Login */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
            >
              <Text style={styles.footerLink}> Log In</Text>
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
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingVertical: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 6,
  },
  errorBanner: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderRadius: THEME.radius.sm,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 12,
    color: THEME.colors.negative,
    textAlign: 'center',
    fontWeight: '600',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingVertical: 13,
    borderRadius: THEME.radius.md,
    gap: 10,
    marginBottom: 20,
  },
  googleIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#4285F4',
  },
  googleButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: THEME.colors.border,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  form: {
    gap: 12,
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 14,
    color: THEME.colors.text,
  },
  eyeButton: {
    padding: 6,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.primary,
    paddingVertical: 14,
    borderRadius: THEME.radius.md,
    gap: 8,
    marginTop: 8,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#09090B',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: THEME.colors.textMuted,
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
});
