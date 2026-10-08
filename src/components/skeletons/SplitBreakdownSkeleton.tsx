import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { THEME } from '../../constants/theme';

export function SplitBreakdownSkeleton({ count = 3 }: { count?: number }) {
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
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.row}>
          <Animated.View style={[styles.avatar, { opacity: pulseAnim }]} />
          <View style={styles.textCol}>
            <Animated.View style={[styles.nameLine, { opacity: pulseAnim }]} />
            <Animated.View style={[styles.subLine, { opacity: pulseAnim }]} />
          </View>
          <Animated.View style={[styles.amountPill, { opacity: pulseAnim }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: THEME.spacing.xs,
    gap: THEME.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: THEME.spacing.xs + 2,
    paddingHorizontal: THEME.spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.skeleton.highlight,
  },
  textCol: {
    flex: 1,
    marginLeft: THEME.spacing.md,
    gap: THEME.spacing.xs + 2,
  },
  nameLine: {
    width: '45%',
    height: 13,
    borderRadius: THEME.radius.xs,
    backgroundColor: THEME.colors.skeleton.highlight,
  },
  subLine: {
    width: '30%',
    height: 10,
    borderRadius: THEME.radius.xs - 1,
    backgroundColor: THEME.colors.skeleton.base,
  },
  amountPill: {
    width: 64,
    height: 20,
    borderRadius: THEME.radius.md - 2,
    backgroundColor: THEME.colors.skeleton.highlight,
  },
});
