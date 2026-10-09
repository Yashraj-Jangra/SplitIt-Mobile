import React, { Component, ErrorInfo, ReactNode, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { AlertTriangle, RefreshCw, ArrowLeft, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import { THEME } from '../../constants/theme';

export interface ErrorFallbackProps {
  error?: Error | null;
  onRetry?: () => void;
  onBack?: () => void;
  title?: string;
  subtitle?: string;
}

export function ErrorFallbackView({
  error,
  onRetry,
  onBack,
  title = 'Something went wrong',
  subtitle = 'We encountered an unexpected issue. Your data and balances are safe.',
}: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRetry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onRetry) {
      onRetry();
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleCopy = async () => {
    if (!error) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const details = `${error.name}: ${error.message}\n\nStack:\n${error.stack ?? 'No stack trace available'}`;
    await Clipboard.setStringAsync(details);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconCircle}>
          <AlertTriangle size={36} color={THEME.colors.negative} />
        </View>

        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Pressable
              style={styles.detailsToggle}
              onPress={() => setShowDetails(!showDetails)}
              accessibilityRole="button"
              accessibilityLabel="Toggle technical error details"
            >
              <Text style={styles.detailsToggleText}>Technical Details</Text>
              {showDetails ? (
                <ChevronUp size={16} color={THEME.colors.textMuted} />
              ) : (
                <ChevronDown size={16} color={THEME.colors.textMuted} />
              )}
            </Pressable>

            {showDetails ? (
              <View style={styles.detailsContainer}>
                <Text style={styles.errorMessage} numberOfLines={4}>
                  {error.message || 'Unknown runtime error'}
                </Text>
                <Pressable
                  style={styles.copyButton}
                  onPress={handleCopy}
                  accessibilityRole="button"
                  accessibilityLabel="Copy error trace to clipboard"
                  hitSlop={8}
                >
                  {copied ? (
                    <>
                      <Check size={14} color={THEME.colors.primary} />
                      <Text style={[styles.copyText, { color: THEME.colors.primary }]}>Copied</Text>
                    </>
                  ) : (
                    <>
                      <Copy size={14} color={THEME.colors.textMuted} />
                      <Text style={styles.copyText}>Copy error trace</Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.actionsContainer}>
          <Pressable
            style={styles.retryButton}
            onPress={handleRetry}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <RefreshCw size={18} color={THEME.colors.primaryForeground} />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>

          <Pressable
            style={styles.backButton}
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={18} color={THEME.colors.text} />
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((props: { error: Error; resetError: () => void }) => ReactNode);
  onReset?: () => void;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  resetError = (): void => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      if (typeof fallback === 'function') {
        return fallback({ error, resetError: this.resetError });
      }
      if (fallback) {
        return fallback;
      }
      return <ErrorFallbackView error={error} onRetry={this.resetError} />;
    }

    return children;
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.xl,
    paddingVertical: THEME.spacing['2xl'],
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: THEME.colors.negativeLight,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: THEME.spacing.lg,
  },
  title: {
    fontSize: THEME.typography.size.headline,
    fontWeight: THEME.typography.weight.bold,
    color: THEME.colors.text,
    textAlign: 'center',
    marginBottom: THEME.spacing.sm,
  },
  subtitle: {
    fontSize: THEME.typography.size.subtitle,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
    marginBottom: THEME.spacing.xl,
  },
  errorBox: {
    width: '100%',
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.xl,
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  detailsToggleText: {
    fontSize: THEME.typography.size.body,
    color: THEME.colors.textMuted,
    fontWeight: THEME.typography.weight.medium,
  },
  detailsContainer: {
    marginTop: THEME.spacing.sm,
    paddingTop: THEME.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.colors.hairline,
  },
  errorMessage: {
    fontSize: THEME.typography.size.caption,
    color: THEME.colors.negative,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: THEME.spacing.sm,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.surfaceElevated,
  },
  copyText: {
    fontSize: THEME.typography.size.caption,
    color: THEME.colors.textMuted,
  },
  actionsContainer: {
    width: '100%',
    gap: THEME.spacing.md,
  },
  retryButton: {
    height: 48,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  retryButtonText: {
    fontSize: THEME.typography.size.subtitle,
    fontWeight: THEME.typography.weight.semibold,
    color: THEME.colors.primaryForeground,
  },
  backButton: {
    height: 48,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  backButtonText: {
    fontSize: THEME.typography.size.subtitle,
    fontWeight: THEME.typography.weight.medium,
    color: THEME.colors.text,
  },
});
