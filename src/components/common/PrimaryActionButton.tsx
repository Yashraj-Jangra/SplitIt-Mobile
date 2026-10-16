import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { Check } from 'lucide-react-native';
import { QuantumSpinner } from '@/components/brand/QuantumLogo';
import { haptics } from '@/services/haptics.service';
import { THEME } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme.context';

export interface PrimaryActionButtonProps {
  /** The text displayed on the button */
  title: string;
  /** Function invoked when the button is tapped */
  onPress: () => void;
  /** Disables user interaction and styles the button as locked/disabled */
  disabled?: boolean;
  /** Shows a loading spinner instead of label and icon */
  loading?: boolean;
  /** Custom icon or icon renderer. Defaults to a Check icon */
  icon?: React.ReactNode | ((props: { color: string; size: number }) => React.ReactNode);
  /** Whether to show an icon at all (defaults to true) */
  showIcon?: boolean;
  /** Variant for different states. 'primary' is default, 'unchanged' for edit mode with no diffs */
  variant?: 'primary' | 'unchanged';
  /** Additional container style overrides */
  style?: StyleProp<ViewStyle>;
  /** Additional text style overrides */
  textStyle?: StyleProp<TextStyle>;
  /** Accessibility label for screen readers */
  accessibilityLabel?: string;
  /** Optional test identifier */
  testID?: string;
}

export function PrimaryActionButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  icon,
  showIcon = true,
  variant = 'primary',
  style,
  textStyle,
  accessibilityLabel,
  testID,
}: PrimaryActionButtonProps) {
  const { currentAccent } = useAppTheme();
  const isLocked = disabled && variant !== 'unchanged';
  const isUnchanged = variant === 'unchanged';
  const isInteractive = !disabled && !loading && !isUnchanged;

  const handlePress = () => {
    if (!isInteractive) return;
    haptics.confirm();
    onPress();
  };

  const iconColor = isLocked || isUnchanged
    ? THEME.colors.textMuted
    : THEME.colors.primaryForeground;

  let renderedIcon: React.ReactNode = null;
  if (showIcon) {
    if (typeof icon === 'function') {
      renderedIcon = icon({ color: iconColor, size: 18 });
    } else if (icon) {
      renderedIcon = icon;
    } else {
      renderedIcon = <Check size={18} color={iconColor} strokeWidth={2.5} />;
    }
  }

  const buttonContainerStyles: StyleProp<ViewStyle> = [
    styles.button,
    !isLocked && !isUnchanged && {
      backgroundColor: currentAccent.primary,
      shadowColor: currentAccent.primary,
    },
    isLocked && styles.buttonDisabled,
    isUnchanged && styles.buttonUnchanged,
    style,
  ];

  const textStyles: StyleProp<TextStyle> = [
    styles.buttonText,
    isLocked && styles.buttonTextDisabled,
    isUnchanged && styles.buttonTextUnchanged,
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={buttonContainerStyles}
      onPress={handlePress}
      disabled={!isInteractive}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: !isInteractive }}
      testID={testID}
    >
      {loading ? (
        <QuantumSpinner size={18} color={iconColor} />
      ) : (
        <>
          {renderedIcon}
          <Text style={textStyles}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: THEME.radius.xl,
    backgroundColor: THEME.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: THEME.spacing.sm,
    paddingHorizontal: THEME.spacing.lg,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    shadowOpacity: 0,
    elevation: 0,
    opacity: 0.85,
  },
  buttonUnchanged: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    shadowOpacity: 0,
    elevation: 0,
    opacity: 0.85,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: THEME.typography.weight.bold,
    color: THEME.colors.primaryForeground,
    letterSpacing: 0.2,
  },
  buttonTextDisabled: {
    color: THEME.colors.textMuted,
    fontWeight: THEME.typography.weight.bold,
  },
  buttonTextUnchanged: {
    color: THEME.colors.textMuted,
    fontWeight: THEME.typography.weight.semibold,
  },
});
