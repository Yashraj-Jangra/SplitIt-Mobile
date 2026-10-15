import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { THEME } from '../../constants/theme';
import { Sparkles } from 'lucide-react-native';
import { useCurrency } from '../../contexts/currency.context';

interface BudgetPacingRingProps {
  totalSpent: number;
  totalLimit: number;
  daysRemaining: number;
  safeDailyAllowance: number;
  currency?: string;
}

export const BudgetPacingRing: React.FC<BudgetPacingRingProps> = ({
  totalSpent,
  totalLimit,
  daysRemaining,
  safeDailyAllowance,
  currency: currencyProp,
}) => {
  const { currencySymbol } = useCurrency();
  const currency = currencyProp && currencyProp !== '₹' ? currencyProp : currencySymbol;
  const size = 140;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const percentage = Math.min(100, Math.round((totalSpent / (totalLimit || 1)) * 100));
  const strokeDashoffset = circumference - (circumference * percentage) / 100;

  // Dynamic status color
  const color =
    percentage >= 100
      ? THEME.colors.negative
      : percentage >= 75
      ? THEME.colors.warning
      : THEME.colors.primary;

  return (
    <View style={styles.container}>
      {/* Circular Arc */}
      <View style={styles.ringWrapper}>
        <Svg width={size} height={size}>
          {/* Background Track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Active Progress */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        {/* Inner Counter */}
        <View style={styles.innerContent}>
          <Text style={[styles.percentageText, { color }]}>{percentage}%</Text>
          <Text style={styles.percentageLabel}>BUDGET USED</Text>
        </View>
      </View>

      {/* Spend Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>SPENT</Text>
          <Text style={styles.statValue}>
            {currency}{totalSpent.toLocaleString()}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>MONTHLY LIMIT</Text>
          <Text style={styles.statValue}>
            {currency}{totalLimit.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Safe Burn Rate Capsule */}
      <View style={styles.burnRateCapsule}>
        <Sparkles size={14} color={THEME.colors.primary} />
        <Text style={styles.burnRateText}>
          Safe burn rate:{' '}
          <Text style={styles.burnRateHighlight}>
            {currency}{safeDailyAllowance.toLocaleString()} / day
          </Text>{' '}
          ({daysRemaining} days left)
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 16,
  },
  ringWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 140,
    height: 140,
  },
  innerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentageText: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  percentageLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    paddingVertical: 10,
    paddingHorizontal: 20,
    gap: 20,
    width: '100%',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: THEME.colors.border,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: THEME.colors.textMuted,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  burnRateCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: THEME.radius.md,
    width: '100%',
  },
  burnRateText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    flex: 1,
  },
  burnRateHighlight: {
    color: THEME.colors.primary,
    fontWeight: '700',
  },
});
