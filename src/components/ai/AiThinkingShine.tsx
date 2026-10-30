import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
  interpolateColor,
  interpolate,
  SharedValue,
} from 'react-native-reanimated';
import { Sparkles } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { useAppTheme } from '../../contexts/theme.context';

export interface AiThinkingShineProps {
  /** The stage description, e.g. "Analyzing ledger records...", "Searching expenses..." */
  stage?: string | null;
  /** Optional container style override */
  style?: StyleProp<ViewStyle>;
}

interface ShimmerWordProps {
  word: string;
  index: number;
  totalWords: number;
  progress: SharedValue<number>;
}

/**
 * Individual word with smooth 60/120fps UI-thread color interpolation
 * as the shining wave sweeps from left to right across the phrase.
 */
function ShimmerWord({ word, index, totalWords, progress }: ShimmerWordProps) {
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    const pos = totalWords > 1 ? index / (totalWords - 1) : 0.5;
    const dist = Math.abs(progress.value - pos);
    // Smooth bell curve with 0.28 reach
    const intensity = Math.max(0, 1 - dist / 0.28);

    const color = interpolateColor(
      intensity,
      [0, 1],
      ['rgba(255, 255, 255, 0.42)', '#FFFFFF']
    );

    const opacity = interpolate(
      intensity,
      [0, 1],
      [0.7, 1.0]
    );

    return {
      color,
      opacity,
    };
  }, [index, totalWords, progress]);

  return (
    <Animated.Text style={[styles.wordText, animatedStyle]}>
      {word}{' '}
    </Animated.Text>
  );
}

/**
 * Flagship Shining Thinking Component
 * Renders inside the AI assistant response bubble when waiting for initial tokens.
 * Features an organic wave of light traveling across normal-sized message text,
 * paired with a gently pulsating celestial AI emblem.
 */
export function AiThinkingShine({ stage, style }: AiThinkingShineProps) {
  const { currentAccent } = useAppTheme();
  const textToShow = (stage && stage.trim()) || 'Thinking...';

  const words = useMemo(() => {
    return textToShow.split(/\s+/).filter(Boolean);
  }, [textToShow]);

  // Shimmer wave progress cycling smoothly from before first word (-0.25) to past last word (1.25)
  const progress = useSharedValue(-0.25);

  // Subtle breathing pulse for the AI sparkle emblem
  const sparkleScale = useSharedValue(0.92);
  const sparkleOpacity = useSharedValue(0.75);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1.25, {
        duration: 1800,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      }),
      -1,
      false
    );

    sparkleScale.value = withRepeat(
      withTiming(1.12, {
        duration: 900,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );

    sparkleOpacity.value = withRepeat(
      withTiming(1.0, {
        duration: 900,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );

    return () => {
      cancelAnimation(progress);
      cancelAnimation(sparkleScale);
      cancelAnimation(sparkleOpacity);
    };
  }, [progress, sparkleScale, sparkleOpacity]);

  const animatedSparkleStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ scale: sparkleScale.value }],
      opacity: sparkleOpacity.value,
    };
  });

  return (
    <View style={[styles.container, style]}>
      <Animated.View style={[styles.sparkleWrap, animatedSparkleStyle]}>
        <Sparkles size={14} color={THEME.colors.aiLight || currentAccent.primary} />
      </Animated.View>

      <View style={styles.textWrap}>
        {words.map((w, idx) => (
          <ShimmerWord
            key={`${idx}-${w}`}
            word={w}
            index={idx}
            totalWords={words.length}
            progress={progress}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
    minHeight: 24,
  },
  sparkleWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  wordText: {
    fontSize: 13.5,
    lineHeight: 20,
    letterSpacing: 0.1,
    fontWeight: '500',
  },
});
