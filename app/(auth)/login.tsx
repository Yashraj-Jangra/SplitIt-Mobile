import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/auth.context';
import * as Haptics from 'expo-haptics';

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithEmail, signInWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailLogin = async () => {
    if (!email.trim() || !password) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Please enter your email and password');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    setError(null);

    const res = await signInWithEmail(email, password);
    setLoading(false);

    if (res.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(res.error || 'Failed to sign in. Please verify your credentials.');
    }
  };

  const handleGoogleLogin = async () => {
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
          {/* Hero Illustration */}
          <View style={styles.heroImageContainer}>
            <Image
              source={require('../../assets/illustrations/login-hero.jpg')}
              style={styles.heroImage}
              resizeMode="cover"
            />
            <View style={styles.imageOverlay} />
          </View>

          {/* Brand Header */}
          <View style={styles.header}>
            <Text style={styles.brandTitle}>SplitIt</Text>
            <Text style={styles.brandSubtitle}>
              Shared expenses, settled simply.
            </Text>
          </View>

          {/* Error Banner */}
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Social Auth Buttons */}
          <View style={styles.socialSection}>
            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleLogin}
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
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={styles.appleButton}
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                activeOpacity={0.8}
              >
                <Text style={styles.appleButtonText}> Sign in with Apple</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with email</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email / Password Form */}
          <View style={styles.form}>
            {/* Email Field */}
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
                autoCorrect={false}
              />
            </View>

            {/* Password Field */}
            <View style={styles.inputContainer}>
              <Lock size={18} color={THEME.colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
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

            {/* Sign In Primary Action */}
            <TouchableOpacity
              style={styles.signInButton}
              onPress={handleEmailLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#09090B" />
              ) : (
                <>
                  <Text style={styles.signInButtonText}>Sign In</Text>
                  <ArrowRight size={18} color="#09090B" />
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Switch to Signup */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(auth)/signup');
              }}
            >
              <Text style={styles.footerLink}> Sign Up</Text>
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
    paddingBottom: 32,
  },
  heroImageContainer: {
    width: '100%',
    height: 220,
    borderRadius: THEME.radius.lg,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: 'rgba(9, 9, 11, 0.25)',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 4,
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
  socialSection: {
    gap: 10,
    marginBottom: 20,
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
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 13,
    borderRadius: THEME.radius.md,
  },
  appleButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
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
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.primary,
    paddingVertical: 14,
    borderRadius: THEME.radius.md,
    gap: 8,
    marginTop: 4,
  },
  signInButtonText: {
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
