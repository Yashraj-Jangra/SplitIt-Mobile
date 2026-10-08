import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { WifiOff, Check } from 'lucide-react-native';
import { useNetwork } from '../../contexts/network.context';
import { THEME } from '../../constants/theme';

export function OfflineBanner() {
  const { isOnline } = useNetwork();
  const [visible, setVisible] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);

  const translateY = useRef(new Animated.Value(-60)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const prevOnlineRef = useRef(isOnline);

  useEffect(() => {
    const wasOffline = !prevOnlineRef.current;
    prevOnlineRef.current = isOnline;

    if (!isOnline) {
      // Transitioned to Offline
      setVisible(true);
      setJustReconnected(false);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 9,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (wasOffline) {
      // Transitioned from Offline back to Online
      setJustReconnected(true);
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -60,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setVisible(false);
          setJustReconnected(false);
        });
      }, 2500);

      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [isOnline]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View style={[styles.pill, justReconnected && styles.pillOnline]}>
        {justReconnected ? (
          <>
            <Check size={13} color={THEME.colors.success} strokeWidth={2.5} />
            <Text style={[styles.text, styles.textOnline]}>Back online · Syncing</Text>
          </>
        ) : (
          <>
            <WifiOff size={13} color={THEME.colors.critical} strokeWidth={2.2} />
            <Text style={styles.text}>Offline Mode · Read Only</Text>
          </>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.xs + 2,
    paddingHorizontal: THEME.spacing.md - 2,
    paddingVertical: THEME.spacing.xs + 2,
    borderRadius: THEME.radius.xl,
    backgroundColor: THEME.colors.skeleton.card,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    shadowColor: THEME.colors.palette.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  pillOnline: {
    borderColor: THEME.colors.successBorder,
    backgroundColor: THEME.colors.successSubtle,
  },
  text: {
    fontSize: THEME.typography.size.caption,
    fontWeight: THEME.typography.weight.semibold,
    color: THEME.colors.text,
    letterSpacing: -0.2,
  },
  textOnline: {
    color: THEME.colors.successLight,
  },
});
