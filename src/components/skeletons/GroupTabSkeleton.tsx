import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { THEME } from '../../constants/theme';

export function useSkeletonPulse() {
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

  return pulseAnim;
}

export function ExpensesTabSkeleton({ count = 4 }: { count?: number }) {
  const pulse = useSkeletonPulse();

  return (
    <View style={styles.ledgerStream}>
      {Array.from({ length: count }).map((_, index) => {
        const isLast = index === count - 1;
        return (
          <View key={index} style={[styles.ledgerRow, !isLast && styles.rowBorder]}>
            <Animated.View style={[styles.categoryGlyph, { opacity: pulse }]} />
            <View style={styles.ledgerDetails}>
              <Animated.View style={[styles.titleLine, { opacity: pulse }]} />
              <Animated.View style={[styles.subLine, { opacity: pulse }]} />
            </View>
            <View style={styles.impactCol}>
              <Animated.View style={[styles.amountLine, { opacity: pulse }]} />
              <Animated.View style={[styles.impactBadgeLine, { opacity: pulse }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function BalancesTabSkeleton() {
  const pulse = useSkeletonPulse();

  return (
    <View style={styles.tabSectionGap}>
      {/* Header Row Skeleton with Switch */}
      <View style={styles.balancesHeaderSkeleton}>
        <Animated.View style={[styles.balancesTitleSkeleton, { opacity: pulse }]} />
        <Animated.View style={[styles.switchSkeleton, { opacity: pulse }]} />
      </View>

      {/* Member Balances Rows Skeleton */}
      <View style={styles.balancesListSkeleton}>
        {[1, 2, 3, 4].map((idx) => (
          <View
            key={idx}
            style={[styles.balanceMemberRowSkeleton, idx < 4 && styles.balanceRowBorderSkeleton]}
          >
            <View style={styles.balanceMemberLeftSkeleton}>
              <Animated.View style={[styles.avatarCircle, { opacity: pulse }]} />
              <Animated.View style={[styles.standingNameLine, { opacity: pulse }]} />
            </View>
            <Animated.View style={[styles.standingAmountLine, { opacity: pulse }]} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function BudgetTabSkeleton() {
  const pulse = useSkeletonPulse();

  return (
    <View style={styles.tabSectionGap}>
      {/* Pacing Ring Card */}
      <View style={styles.budgetCard}>
        <View style={styles.ringPlaceholder}>
          <Animated.View style={[styles.ringInnerContent, { opacity: pulse }]}>
            <View style={styles.ringPercentLine} />
            <View style={styles.ringSubLine} />
          </Animated.View>
        </View>
        <Animated.View style={[styles.allowancePillLine, { opacity: pulse }]} />
      </View>

      {/* Category Allocations Card */}
      <View style={styles.categoryAllocationsCard}>
        <Animated.View style={[styles.sectionTitleLine, { opacity: pulse }]} />
        {[1, 2, 3].map((idx) => (
          <View key={idx} style={styles.catRow}>
            <View style={styles.catLabelRow}>
              <Animated.View style={[styles.catNameLine, { opacity: pulse }]} />
              <Animated.View style={[styles.catNumbersLine, { opacity: pulse }]} />
            </View>
            <View style={styles.catBarBackground}>
              <Animated.View
                style={[
                  styles.catBarFill,
                  { width: `${40 + idx * 20}%`, opacity: pulse },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export function ActivityTabSkeleton() {
  const pulse = useSkeletonPulse();

  return (
    <View style={styles.activityCard}>
      <View style={styles.activityHeader}>
        <View style={styles.activityHeaderTitleRow}>
          <Animated.View style={[styles.iconSquareSmall, { opacity: pulse }]} />
          <Animated.View style={[styles.activityTitleLine, { opacity: pulse }]} />
        </View>
        <Animated.View style={[styles.activityDescLine, { opacity: pulse }]} />
      </View>

      <View style={styles.activityList}>
        {[1, 2, 3, 4].map((idx) => {
          const isLast = idx === 4;
          return (
            <View key={idx} style={[styles.activityRow, !isLast && styles.rowBorder]}>
              <Animated.View style={[styles.activityIconCircle, { opacity: pulse }]} />
              <View style={styles.activityTextCol}>
                <Animated.View style={[styles.activityEventLine, { opacity: pulse }]} />
                <Animated.View style={[styles.activityTimeLine, { opacity: pulse }]} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function ActivityRowSkeleton({ count = 2 }: { count?: number }) {
  const pulse = useSkeletonPulse();

  return (
    <View style={styles.activityList}>
      {Array.from({ length: count }).map((_, idx) => {
        const isLast = idx === count - 1;
        return (
          <View key={idx} style={[styles.activityRow, !isLast && styles.rowBorder]}>
            <Animated.View style={[styles.activityIconCircle, { opacity: pulse }]} />
            <View style={styles.activityTextCol}>
              <Animated.View style={[styles.activityEventLine, { opacity: pulse }]} />
              <Animated.View style={[styles.activityTimeLine, { opacity: pulse }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function GroupTabSkeleton({
  tab,
}: {
  tab: 'expenses' | 'balances' | 'budget' | 'activity';
}) {
  switch (tab) {
    case 'expenses':
      return <ExpensesTabSkeleton count={4} />;
    case 'balances':
      return <BalancesTabSkeleton />;
    case 'budget':
      return <BudgetTabSkeleton />;
    case 'activity':
      return <ActivityTabSkeleton />;
    default:
      return <ExpensesTabSkeleton count={4} />;
  }
}

const styles = StyleSheet.create({
  tabSectionGap: {
    gap: 14,
  },
  ledgerStream: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    paddingHorizontal: 12,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  categoryGlyph: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  ledgerDetails: {
    flex: 1,
  },
  titleLine: {
    width: 140,
    height: 14,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  subLine: {
    width: 95,
    height: 10,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginTop: 6,
  },
  impactCol: {
    alignItems: 'flex-end',
  },
  amountLine: {
    width: 58,
    height: 14,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  impactBadgeLine: {
    width: 44,
    height: 10,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginTop: 6,
  },

  // Balances
  balancesHeaderSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  balancesTitleSkeleton: {
    width: 120,
    height: 16,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  switchSkeleton: {
    width: 80,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  balancesListSkeleton: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  balanceMemberRowSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  balanceRowBorderSkeleton: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.07)',
  },
  balanceMemberLeftSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
  },
  standingNameLine: {
    width: 100,
    height: 13,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
  },
  standingAmountLine: {
    width: 60,
    height: 14,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
  },
  iconSquareSmall: {
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  sectionTitleLine: {
    width: 120,
    height: 10,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 4,
  },

  // Budget
  budgetCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    padding: 22,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    alignItems: 'center',
  },
  ringPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInnerContent: {
    alignItems: 'center',
    gap: 6,
  },
  ringPercentLine: {
    width: 46,
    height: 20,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  ringSubLine: {
    width: 56,
    height: 8,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  allowancePillLine: {
    width: 180,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginTop: 16,
  },
  categoryAllocationsCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    gap: 14,
  },
  catRow: {
    gap: 6,
  },
  catLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catNameLine: {
    width: 80,
    height: 12,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
  },
  catNumbersLine: {
    width: 90,
    height: 10,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  catBarBackground: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  catBarFill: {
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 3,
  },

  // Activity
  activityCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    padding: 16,
  },
  activityHeader: {
    marginBottom: 14,
  },
  activityHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  activityTitleLine: {
    width: 105,
    height: 14,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  activityDescLine: {
    width: 190,
    height: 10,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  activityList: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  activityIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  activityTextCol: {
    flex: 1,
    gap: 5,
  },
  activityEventLine: {
    width: '78%',
    height: 12,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
  },
  activityTimeLine: {
    width: 50,
    height: 9,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
});
