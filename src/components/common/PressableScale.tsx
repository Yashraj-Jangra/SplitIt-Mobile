import React, { ReactNode, useCallback } from 'react';
import {
  Pressable,
  StyleProp,
  ViewStyle,
  GestureResponderEvent,
  Insets,
  AccessibilityRole,
  AccessibilityState,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { THEME } from '../../constants/theme';
import { haptics } from '../../services/haptics.service';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps {
  children: ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  /** Scale factor on touch depression. Default: 0.97 */
  activeScale?: number;
  /** Active opacity on touch depression (optional). */
  activeOpacity?: number;
  /** Haptic feedback on press down. Default: 'tap' */
  hapticFeedback?: 'tap' | 'toggle' | 'confirm' | 'destructive' | 'none';
  disabled?: boolean;
  hitSlop?: Insets | number;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: AccessibilityState;
  testID?: string;
}

/**
 * Flagship hardware-accelerated spring micro-interaction component.
 * Replaces flat TouchableOpacity with fluid, physical spring depression (UI thread worklet).
 */
export const PressableScale: React.FC<PressableScaleProps> = ({
  children,
  onPress,
  onLongPress,
  style,
  activeScale = 0.97,
  activeOpacity,
  hapticFeedback = 'tap',
  disabled = false,
  hitSlop,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  testID,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const handlePressIn = useCallback(
    (e: GestureResponderEvent) => {
      'worklet';
      scale.value = withSpring(activeScale, THEME.animation.spring.press);
      if (activeOpacity !== undefined) {
        opacity.value = withSpring(activeOpacity, THEME.animation.spring.press);
      }
    },
    [activeScale, activeOpacity, scale, opacity]
  );

  const handlePressOut = useCallback(
    (e: GestureResponderEvent) => {
      'worklet';
      scale.value = withSpring(1, THEME.animation.spring.press);
      if (activeOpacity !== undefined) {
        opacity.value = withSpring(1, THEME.animation.spring.press);
      }
    },
    [activeOpacity, scale, opacity]
  );

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      if (disabled) return;
      if (hapticFeedback !== 'none') {
        try {
          if (hapticFeedback === 'tap') haptics.tap();
          else if (hapticFeedback === 'toggle') haptics.toggleSwitch();
          else if (hapticFeedback === 'confirm') haptics.confirm();
          else if (hapticFeedback === 'destructive') haptics.destructive();
        } catch {
          // Ignore haptic errors on unmounted contexts
        }
      }
      onPress?.(e);
    },
    [disabled, hapticFeedback, onPress]
  );

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      ...(activeOpacity !== undefined ? { opacity: opacity.value } : {}),
    };
  });

  return (
    <AnimatedPressable
      testID={testID}
      disabled={disabled}
      onPress={handlePress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={accessibilityState ?? (disabled ? { disabled: true } : undefined)}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
};
