import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { User, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/auth.context';
import { QuantumLogo, QuantumSpinner } from '../../src/components/brand/QuantumLogo';
import { GoogleLogo } from '../../src/components/brand/GoogleLogo';
import { haptics } from '../../src/services/haptics.service';

const HERO_IMAGE_HEIGHT = 190;

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

  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);
  const keyboardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(keyboardAnim, {
        toValue: 1,
        duration: e?.duration || 260,
        useNativeDriver: false,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(keyboardAnim, {
        toValue: 0,
        duration: e?.duration || 260,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardAnim]);

  // Graceful sliding collapse interpolations
  const heroHeight = keyboardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [HERO_IMAGE_HEIGHT, 0],
  });

  const heroOpacity = keyboardAnim.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [1, 0.2, 0],
  });

  const heroTranslateY = keyboardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -32],
  });

  const heroMarginBottom = keyboardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

  // Compact brand row when keyboard is open
  const compactHeaderHeight = keyboardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 48],
  });

  const compactHeaderOpacity = keyboardAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !password) {
      haptics.error();
      setError('Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      haptics.error();
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      haptics.error();
      setError('Password must be at least 8 characters long');
      return;
    }

    haptics.confirm();
    setLoading(true);
    setError(null);

    const res = await signUpWithEmail(name, email, password);
    setLoading(false);

    if (res.success) {
      haptics.saveSuccess();
      router.replace('/(tabs)');
    } else {
      haptics.error();
      setError(res.error || 'Failed to create account. Please try again.');
    }
  };

  const handleGoogleSignup = async () => {
    haptics.confirm();
    setGoogleLoading(true);
    setError(null);

    const res = await signInWithGoogle();
    setGoogleLoading(false);

    if (res.success) {
      haptics.saveSuccess();
      router.replace('/(tabs)');
    } else if (res.error && res.error !== 'Google sign-in was canceled') {
      haptics.error();
      setError(res.error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {/* Gracefully Sliding & Collapsing Hero Banner */}
            <Animated.View
              style={[
                styles.heroImageContainer,
                {
                  height: heroHeight,
                  opacity: heroOpacity,
                  marginBottom: heroMarginBottom,
                  transform: [{ translateY: heroTranslateY }],
                },
              ]}
            >
              <Image
                source={{
                  uri: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80',
                }}
                style={styles.heroImage}
                resizeMode="cover"
              />
              <View style={styles.imageOverlay} />
              <View style={styles.heroBrandOverlay}>
                <View style={styles.brandRow}>
                  <QuantumLogo size={40} useGradient={false} color={THEME.colors.primary} />
                  <Text style={styles.brandName}>SplitIt</Text>
                </View>
              </View>
            </Animated.View>

            {/* Compact Brand Header (Fades in when hero slides away) */}
            <Animated.View
              style={[
                styles.compactHeader,
                {
                  height: compactHeaderHeight,
                  opacity: compactHeaderOpacity,
                },
              ]}
            >
              <QuantumLogo size={28} />
              <Text style={styles.compactHeaderTitle}>SplitIt</Text>
            </Animated.View>

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>
                Join SplitIt to split bills effortlessly
              </Text>
            </View>

            {/* Error Banner */}
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Registration Form (Primary Entry) */}
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
                  returnKeyType="next"
                  onSubmitEditing={() => emailInputRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>

              {/* Email */}
              <View style={styles.inputContainer}>
                <Mail size={18} color={THEME.colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  ref={emailInputRef}
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
                  returnKeyType="next"
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>

              {/* Password */}
              <View style={styles.inputContainer}>
                <Lock size={18} color={THEME.colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  ref={passwordInputRef}
                  style={styles.input}
                  placeholder="Password (min. 8 characters)"
                  placeholderTextColor={THEME.colors.textMuted}
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    if (error) setError(null);
                  }}
                  secureTextEntry={!showPassword}
                  returnKeyType="next"
                  onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
                  blurOnSubmit={false}
                />
                <TouchableOpacity
                  onPress={() => {
                    haptics.tap();
                    setShowPassword(!showPassword);
                  }}
                  style={styles.eyeButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
                  ref={confirmPasswordInputRef}
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor={THEME.colors.textMuted}
                  value={confirmPassword}
                  onChangeText={(t) => {
                    setConfirmPassword(t);
                    if (error) setError(null);
                  }}
                  secureTextEntry={!showPassword}
                  returnKeyType="go"
                  onSubmitEditing={handleSignup}
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
                  <QuantumSpinner size={18} color={THEME.colors.primaryForeground} />
                ) : (
                  <>
                    <Text style={styles.submitButtonText}>Create Account</Text>
                    <ArrowRight size={18} color={THEME.colors.primaryForeground} />
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Quick Sign-up (Moved Below Form) */}
            <View style={styles.socialSection}>
              <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleSignup}
                disabled={googleLoading}
                activeOpacity={0.8}
              >
                {googleLoading ? (
                  <QuantumSpinner size={18} color={THEME.colors.text} />
                ) : (
                  <>
                    <GoogleLogo size={20} />
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={styles.appleButton}
                  onPress={() => haptics.tap()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.appleButtonText}> Continue with Apple</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Switch to Login */}
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <TouchableOpacity
                onPress={() => {
                  haptics.tap();
                  router.back();
                }}
              >
                <Text style={styles.footerLink}> Log In</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 36,
  },
  heroImageContainer: {
    width: '100%',
    borderRadius: THEME.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  heroBrandOverlay: {
    ...(StyleSheet.absoluteFill as object),
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    overflow: 'hidden',
    marginBottom: 8,
  },
  compactHeaderTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -0.5,
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
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
  form: {
    gap: 12,
    marginBottom: 20,
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
    marginTop: 4,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.primaryForeground,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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
  socialSection: {
    gap: 10,
    marginBottom: 22,
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
  googleButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.palette.white,
    paddingVertical: 13,
    borderRadius: THEME.radius.md,
  },
  appleButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.palette.black,
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
