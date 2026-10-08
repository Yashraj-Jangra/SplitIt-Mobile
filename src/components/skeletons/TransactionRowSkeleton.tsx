import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { THEME } from '../../constants/theme';

export function TransactionRowSkeleton({ count = 3 }: { count?: number }) {
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
          <Animated.View style={[styles.iconBox, { opacity: pulseAnim }]} />
          <View style={styles.midCol}>
            <Animated.View style={[styles.titleLine, { opacity: pulseAnim }]} />
            <Animated.View style={[styles.subLine, { opacity: pulseAnim }]} />
          </View>
          <View style={styles.rightCol}>
            <Animated.View style={[styles.amountLine, { opacity: pulseAnim }]} />
            <Animated.View style={[styles.statusLine, { opacity: pulseAnim }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: THEME.spacing.sm + 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: THEME.spacing.sm + 2,
    paddingHorizontal: THEME.spacing.md,
    borderRadius: THEME.radius.lg - 2,
    backgroundColor: THEME.colors.skeleton.surface,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.skeleton.highlight,
  },
  midCol: {
    flex: 1,
    marginLeft: THEME.spacing.md,
    gap: THEME.spacing.xs + 2,
  },
  titleLine: {
    width: '55%',
    height: 14,
    borderRadius: THEME.radius.xs,
    backgroundColor: THEME.colors.skeleton.highlight,
  },
  subLine: {
    width: '35%',
    height: 11,
    borderRadius: THEME.radius.xs - 1,
    backgroundColor: THEME.colors.skeleton.base,
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: THEME.spacing.xs + 2,
  },
  amountLine: {
    width: 60,
    height: 14,
    borderRadius: THEME.radius.xs,
    backgroundColor: THEME.colors.skeleton.highlight,
  },
  statusLine: {
    width: 44,
    height: 10,
    borderRadius: THEME.radius.xs - 1,
    backgroundColor: THEME.colors.skeleton.base,
  },
});
