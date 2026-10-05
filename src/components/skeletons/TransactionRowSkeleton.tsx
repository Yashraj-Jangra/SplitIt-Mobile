import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

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
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#374151',
  },
  midCol: {
    flex: 1,
    marginLeft: 12,
    gap: 6,
  },
  titleLine: {
    width: '55%',
    height: 14,
    borderRadius: 6,
    backgroundColor: '#374151',
  },
  subLine: {
    width: '35%',
    height: 11,
    borderRadius: 5,
    backgroundColor: '#2D3748',
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  amountLine: {
    width: 60,
    height: 14,
    borderRadius: 6,
    backgroundColor: '#374151',
  },
  statusLine: {
    width: 44,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2D3748',
  },
});
