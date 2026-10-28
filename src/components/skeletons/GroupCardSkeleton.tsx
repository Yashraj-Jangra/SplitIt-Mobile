import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { THEME } from '../../constants/theme';
import { useSkeletonPulse } from './GroupTabSkeleton';

export function GroupCardSkeleton({ count = 3 }: { count?: number }) {
  const pulse = useSkeletonPulse();

  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.card}>
          {/* Top Row: Pill on right */}
          <View style={styles.topRow}>
            <Animated.View style={[styles.pill, { opacity: pulse }]} />
          </View>

          {/* Bottom Area: Title, subtitle, avatars */}
          <View style={styles.bottomArea}>
            <Animated.View style={[styles.titleLine, { opacity: pulse }]} />
            <Animated.View style={[styles.descLine, { opacity: pulse }]} />
            <View style={styles.footerRow}>
              <View style={styles.avatarStack}>
                {[0, 1, 2].map((i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.avatar,
                      { opacity: pulse, marginLeft: i > 0 ? -8 : 0 },
                    ]}
                  />
                ))}
              </View>
              <Animated.View style={[styles.memberCountPill, { opacity: pulse }]} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingTop: 4,
  },
  card: {
    height: 190,
    borderRadius: THEME.radius['2xl'],
    justifyContent: 'space-between',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: THEME.colors.surface,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  pill: {
    width: 84,
    height: 24,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.skeleton.highlight,
  },
  bottomArea: {
    gap: 8,
  },
  titleLine: {
    width: '55%',
    height: 20,
    borderRadius: THEME.radius.xs,
    backgroundColor: THEME.colors.skeleton.highlight,
  },
  descLine: {
    width: '40%',
    height: 13,
    borderRadius: THEME.radius.xs - 1,
    backgroundColor: THEME.colors.skeleton.base,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME.colors.skeleton.highlight,
    borderWidth: 1.5,
    borderColor: THEME.colors.surface,
  },
  memberCountPill: {
    width: 64,
    height: 16,
    borderRadius: THEME.radius.xs,
    backgroundColor: THEME.colors.skeleton.base,
  },
});
