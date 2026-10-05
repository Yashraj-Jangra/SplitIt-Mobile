import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

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
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#1E232B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    gap: 12,
  },
  labelLine: {
    width: 90,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#374151',
  },
  heroAmount: {
    width: 160,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#374151',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  pill: {
    width: 100,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2D3748',
  },
});
