import React, { ReactNode } from 'react';
import {
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  interpolate,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { THEME } from '../../constants/theme';

export interface KeyboardStickyBottomBarProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * If true, this component is nested inside a parent KeyboardAvoidingView.
   * It dynamically collapses bottom padding to eliminate the safe area gap.
   * If false, it manages its own upward translation at 60/120fps via Reanimated.
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
 * and comment bars. Eliminates the safe area void and guarantees 60/120fps native
 * frame velocity synchronization with the software keyboard on iOS and Android.
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
  const insets = useSafeAreaInsets();
  const { progress, height } = useReanimatedKeyboardAnimation();

  const animatedStyle = useAnimatedStyle(() => {
    const closedPadding = Math.max(insets.bottom, idlePaddingBottom);

    if (insideKeyboardAvoidingView) {
      const dynamicPadding = interpolate(
        progress.value,
        [0, 1],
        [closedPadding, keyboardPaddingBottom]
      );
      return {
        paddingBottom: dynamicPadding,
      };
    } else {
      const offset = (closedPadding - keyboardPaddingBottom) * progress.value;
      return {
        paddingBottom: closedPadding,
        transform: [{ translateY: height.value + offset }],
      };
    }
  }, [insets.bottom, idlePaddingBottom, keyboardPaddingBottom, insideKeyboardAvoidingView]);

  return (
    <Animated.View
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.container,
        {
          backgroundColor,
        },
        bordered && styles.topBorder,
        animatedStyle,
        style,
      ]}
    >
      {children}
    </Animated.View>
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
