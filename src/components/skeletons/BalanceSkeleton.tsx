import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { THEME } from '../../constants/theme';

export function BalanceSkeleton() {
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.8,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  return (
    <View style={styles.card}>
      <Animated.View style={[styles.labelLine, { opacity: pulseAnim }]} />
      <Animated.View style={[styles.heroAmount, { opacity: pulseAnim }]} />
      <View style={styles.pillRow}>
        <Animated.View style={[styles.pill, { opacity: pulseAnim }]} />
        <Animated.View style={[styles.pill, { opacity: pulseAnim }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: THEME.spacing.xl,
    borderRadius: THEME.radius.xl,
    backgroundColor: THEME.colors.skeleton.card,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    alignItems: 'center',
    gap: THEME.spacing.md,
  },
  labelLine: {
    width: 90,
    height: 12,
    borderRadius: THEME.radius.xs,
    backgroundColor: THEME.colors.skeleton.highlight,
  },
  heroAmount: {
    width: 160,
    height: 38,
    borderRadius: THEME.radius.md - 2,
    backgroundColor: THEME.colors.skeleton.highlight,
  },
  pillRow: {
    flexDirection: 'row',
    gap: THEME.spacing.lg,
    marginTop: THEME.spacing.sm,
  },
  pill: {
    width: 100,
    height: 24,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.skeleton.base,
  },
});
