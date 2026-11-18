import React, { useCallback } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { THEME } from '../../constants/theme';
import { haptics } from '../../services/haptics.service';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.38; // 38% width threshold to pop

export interface InteractiveSwipeBackProps {
  children: React.ReactNode;
  enabled?: boolean;
  onBack?: () => void;
  edgeWidth?: number; // Distance in pixels from left edge to activate gesture (default: 36)
}

/**
 * Interactive Swipe-Back Container.
 *
 * Provides smooth, interactive 1:1 edge-swipe gesture navigation:
 * - Tracks finger translation in real-time with responsive spring physics.
 * - Scales down gracefully (1.0 -> 0.94) and rounds corners (0 -> 24px) during drag.
 * - Releases past 38% screen width or with velocity trigger pop navigation.
 * - Releases before threshold smoothly snap back with damping spring.
 */
export function InteractiveSwipeBack({
  children,
  enabled = true,
  onBack,
  edgeWidth = 36,
}: InteractiveSwipeBackProps) {
  const router = useRouter();
  const translateX = useSharedValue(0);
  const isGesturing = useSharedValue(false);

  const triggerBack = useCallback(() => {
    try {
      haptics.tap();
    } catch {}
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    }
  }, [onBack, router]);

  const panGesture = Gesture.Pan()
    .enabled(enabled)
    .manualActivation(true)
    .onTouchesDown((event, stateManager) => {
      const touchX = event.allTouches[0]?.x ?? 0;
      if (touchX <= edgeWidth) {
        stateManager.activate();
      } else {
        stateManager.fail();
      }
    })
    .onStart(() => {
      isGesturing.value = true;
    })
    .onUpdate((event) => {
      // Only drag forward to the right (positive translation)
      if (event.translationX > 0) {
        translateX.value = event.translationX;
      }
    })
    .onEnd((event) => {
      if (event.translationX > SWIPE_THRESHOLD || event.velocityX > 700) {
        // Swiped far enough -> animate off screen and pop
        translateX.value = withTiming(SCREEN_WIDTH, { duration: 180 }, (finished) => {
          if (finished) {
            runOnJS(triggerBack)();
          }
        });
      } else {
        // Snap back to original full-screen position
        translateX.value = withSpring(
          0,
          {
            damping: 22,
            stiffness: 240,
            mass: 0.8,
          },
          () => {
            isGesturing.value = false;
          }
        );
      }
    });

  const animatedContentStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      translateX.value,
      [0, SCREEN_WIDTH],
      [1, 0.94],
      Extrapolation.CLAMP
    );
    const borderRadius = interpolate(
      translateX.value,
      [0, SCREEN_WIDTH * 0.4],
      [0, 24],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { translateX: translateX.value },
        { scale },
      ],
      borderRadius,
      overflow: 'hidden',
    };
  });

  const scrimStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [0, SCREEN_WIDTH],
      [0.35, 0],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      pointerEvents: isGesturing.value ? 'auto' : 'none',
    };
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.scrim, scrimStyle]} />
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.content, animatedContentStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
});
