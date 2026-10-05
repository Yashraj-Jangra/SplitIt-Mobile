import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

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
    paddingVertical: 4,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#374151',
  },
  textCol: {
    flex: 1,
    marginLeft: 12,
    gap: 6,
  },
  nameLine: {
    width: '45%',
    height: 13,
    borderRadius: 6,
    backgroundColor: '#374151',
  },
  subLine: {
    width: '30%',
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2D3748',
  },
  amountPill: {
    width: 64,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#374151',
  },
});
