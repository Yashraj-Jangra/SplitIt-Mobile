import React, { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, ViewStyle, StyleProp, TouchableOpacity } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle, Text as SvgText } from 'react-native-svg';
import { TrendingUp } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { useCurrency } from '../../contexts/currency.context';

export interface BalanceHistoryGraphProps {
  data: Array<{ date: string; balance: number }>;
  domain: [number, number];
  gradientOffset: number; // 0 (all negative) to 1 (all positive)
  minBalance: number;
  maxBalance: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
  hasNoBalance?: boolean;
  onPress?: () => void;
}

/**
 * Generates a smooth cubic Bezier path string from an array of 2D coordinates.
 */
function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];

    const cp1x = p0.x + (p1.x - p0.x) / 2;
    const cp1y = p0.y;
    const cp2x = p0.x + (p1.x - p0.x) / 2;
    const cp2y = p1.y;

    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }

  return path;
}

export const BalanceHistoryGraph: React.FC<BalanceHistoryGraphProps> = ({
  data,
  domain,
  gradientOffset,
  minBalance,
  maxBalance,
  height = 75,
  style,
  hasNoBalance,
  onPress,
}) => {
  const { currencySymbol } = useCurrency();
  const [layoutWidth, setLayoutWidth] = useState<number>(340);

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0 && Math.abs(width - layoutWidth) > 1) {
      setLayoutWidth(width);
    }
  };

  const ptsCount = data.length;
  const isZeroBalance =
    Boolean(hasNoBalance) ||
    ptsCount === 0 ||
    (Math.abs(minBalance) < 0.01 && Math.abs(maxBalance) < 0.01) ||
    data.every((item) => Math.abs(item.balance) < 0.01);

  const w = layoutWidth;
  const h = height;

  if (isZeroBalance) {
    const emptyView = (
      <View style={[styles.emptyContainer, { height }, style]} onLayout={handleLayout}>
        <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Line
            x1="0"
            y1={Math.round(h / 2)}
            x2={w}
            y2={Math.round(h / 2)}
            stroke={THEME.colors.hairlineLight}
            strokeDasharray="4 6"
            strokeWidth={1}
          />
        </Svg>
        <View style={styles.emptyContent}>
          <View style={styles.emptyBadgeRow}>
            <TrendingUp size={13} color={THEME.colors.primary} strokeWidth={2.2} />
            <Text style={styles.emptyTitle}>No balance yet</Text>
          </View>
          <Text style={styles.emptySubtitle}>
            Start adding expenses to track your balance
          </Text>
        </View>
      </View>
    );

    if (onPress) {
      return (
        <TouchableOpacity activeOpacity={0.75} onPress={onPress}>
          {emptyView}
        </TouchableOpacity>
      );
    }

    return emptyView;
  }

  const [minDomain, maxDomain] = domain;
  const domainSpan = maxDomain - minDomain || 1;

  // Map data items to screen coordinates with slight padding so peak/trough never clips
  const topPadding = 8;
  const bottomPadding = 8;
  const usableHeight = Math.max(10, h - topPadding - bottomPadding);

  const points = data.map((item, index) => {
    const x = (index / Math.max(1, ptsCount - 1)) * w;
    const normalizedY = (item.balance - minDomain) / domainSpan;
    const y = topPadding + usableHeight * (1 - normalizedY);
    return { x, y, balance: item.balance };
  });

  const zeroNormalized = (0 - minDomain) / domainSpan;
  const zeroY = topPadding + usableHeight * (1 - zeroNormalized);
  const crossesZero = minBalance < -0.01 && maxBalance > 0.01;

  const lineCurve = buildSmoothPath(points);
  const areaPath = `${lineCurve} L ${w.toFixed(1)} ${h.toFixed(1)} L 0 ${h.toFixed(1)} Z`;

  const lastPoint = points[points.length - 1] || { x: w, y: h / 2, balance: 0 };
  const lastBalance = lastPoint.balance;

  // Clamp offset between 0 and 1
  const safeOffset = Math.max(0, Math.min(1, gradientOffset));
  const offsetPct = Math.round(safeOffset * 100);

  return (
    <View style={[styles.container, { height }, style]} onLayout={handleLayout} pointerEvents="none">
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <Defs>
          {/* Fill Gradient: Soft fintech ambient glow */}
          <LinearGradient id="balanceAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop
              offset="0%"
              stopColor={crossesZero || minBalance >= 0 ? THEME.colors.primary : THEME.colors.negative}
              stopOpacity={crossesZero || minBalance >= 0 ? 0.24 : 0.04}
            />
            <Stop
              offset={`${crossesZero ? Math.max(0, offsetPct - 8) : 50}%`}
              stopColor={crossesZero || minBalance >= 0 ? THEME.colors.primary : THEME.colors.negative}
              stopOpacity={0.06}
            />
            <Stop
              offset={`${crossesZero ? Math.min(100, offsetPct + 8) : 50}%`}
              stopColor={crossesZero || maxBalance <= 0 ? THEME.colors.negative : THEME.colors.primary}
              stopOpacity={0.06}
            />
            <Stop
              offset="100%"
              stopColor={crossesZero || maxBalance <= 0 ? THEME.colors.negative : THEME.colors.primary}
              stopOpacity={crossesZero || maxBalance <= 0 ? 0.24 : 0.02}
            />
          </LinearGradient>

          {/* Stroke Gradient: Crisp, high-contrast dynamic curve */}
          <LinearGradient id="balanceStrokeGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop
              offset="0%"
              stopColor={crossesZero || minBalance >= 0 ? THEME.colors.primary : THEME.colors.negative}
              stopOpacity={0.9}
            />
            <Stop
              offset={`${crossesZero ? Math.max(0, offsetPct - 3) : 50}%`}
              stopColor={crossesZero || minBalance >= 0 ? THEME.colors.primary : THEME.colors.negative}
              stopOpacity={0.9}
            />
            <Stop
              offset={`${crossesZero ? Math.min(100, offsetPct + 3) : 50}%`}
              stopColor={crossesZero || maxBalance <= 0 ? THEME.colors.negative : THEME.colors.primary}
              stopOpacity={0.9}
            />
            <Stop
              offset="100%"
              stopColor={crossesZero || maxBalance <= 0 ? THEME.colors.negative : THEME.colors.primary}
              stopOpacity={0.9}
            />
          </LinearGradient>
        </Defs>

        {/* Zero Axis Reference Line (Only if domain spans across positive and negative) */}
        {crossesZero && (
          <>
            <Line
              x1="0"
              y1={zeroY}
              x2={w}
              y2={zeroY}
              stroke="rgba(255, 255, 255, 0.10)"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
            <SvgText
              x={w - 18}
              y={zeroY - 4}
              fill="rgba(255, 255, 255, 0.3)"
              fontSize={8}
              fontWeight="600"
            >
              {currencySymbol}0
            </SvgText>
          </>
        )}

        {/* Soft Background Area Fill */}
        <Path d={areaPath} fill="url(#balanceAreaGrad)" />

        {/* Crisp Leading Stroke */}
        <Path
          d={lineCurve}
          fill="none"
          stroke="url(#balanceStrokeGrad)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Current Endpoint Indicator */}
        <Circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={5.5}
          fill={lastBalance >= 0 ? 'rgba(28, 194, 159, 0.25)' : 'rgba(244, 63, 94, 0.25)'}
        />
        <Circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={2.5}
          fill={lastBalance >= 0 ? THEME.colors.primary : THEME.colors.negative}
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
  emptyContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  emptyContent: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: THEME.radius.sm,
    gap: 2,
  },
  emptyBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: THEME.colors.textMuted,
  },
});
