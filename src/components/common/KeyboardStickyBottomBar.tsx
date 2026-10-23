import React, { ReactNode } from 'react';
import {
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Platform,
  Animated,
} from 'react-native';
import { THEME } from '../../constants/theme';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';

export interface KeyboardStickyBottomBarProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * If true, this component is nested inside a parent KeyboardAvoidingView.
   * It will only dynamically collapse bottom insets to prevent the iOS 34px void.
   * If false, it manages its own upward translation or padding when keyboard appears.
   * Default: true.
   */
  insideKeyboardAvoidingView?: boolean;
  /**
   * Minimum bottom padding when keyboard is deployed (default: 8).
   */
  keyboardPaddingBottom?: number;
  /**
   * Minimum bottom padding when keyboard is closed (default: 12).
   */
  idlePaddingBottom?: number;
  /**
   * Top border hairline separator (default: false).
   */
  bordered?: boolean;
  /**
   * Optional custom background color (default: THEME.colors.background).
   */
  backgroundColor?: string;
  /**
   * Optional accessibility label.
   */
  accessibilityLabel?: string;
}

/**
 * Standardized sticky bottom dock for primary action buttons, accessory toolbars,
 * and comment bars. Eliminates the iOS 34px floating gap and ensures Android parity.
 */
export const KeyboardStickyBottomBar: React.FC<KeyboardStickyBottomBarProps> = ({
  children,
  style,
  insideKeyboardAvoidingView = true,
  keyboardPaddingBottom = 8,
  idlePaddingBottom = 12,
  bordered = false,
  backgroundColor = THEME.colors.background,
  accessibilityLabel,
}) => {
  const { isKeyboardOpen, bottomInsetCompensation, keyboardHeight } = useKeyboardHeight({
    minKeyboardPadding: keyboardPaddingBottom,
  });

  const effectiveBottomPadding = isKeyboardOpen
    ? keyboardPaddingBottom
    : Math.max(bottomInsetCompensation, idlePaddingBottom);

  // If standalone on Android or not inside a KeyboardAvoidingView:
  // Apply additional bottom clearance equal to keyboardHeight on Android when edge-to-edge
  const standaloneAndroidOffset =
    !insideKeyboardAvoidingView && Platform.OS === 'android' && isKeyboardOpen
      ? keyboardHeight
      : 0;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.container,
        {
          backgroundColor,
          paddingBottom: effectiveBottomPadding + standaloneAndroidOffset,
        },
        bordered && styles.topBorder,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  topBorder: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
  },
});
