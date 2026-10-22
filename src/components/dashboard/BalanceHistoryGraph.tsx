import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  LayoutChangeEvent,
  ViewStyle,
  StyleProp,
  TouchableOpacity,
  GestureResponderEvent,
} from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle } from 'react-native-svg';
import { TrendingUp, X } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { useCurrency } from '../../contexts/currency.context';
import { haptics } from '../../services/haptics.service';

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
  onSelectPoint?: (point: { date: string; balance: number } | null) => void;
  onScrubbingChange?: (isScrubbing: boolean) => void;
}

export interface BalanceHistoryGraphHandle {
  deselect: () => void;
  isSelected: boolean;
}

// Fixed Financial Colors (Independent of user-selected theme accent)
const GRAPH_GREEN = THEME.colors.success; // Canonical financial Emerald Green
const GRAPH_ROSE = THEME.colors.negative; // Clean Rose Red for negative balance

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

export const BalanceHistoryGraph = forwardRef<
  BalanceHistoryGraphHandle,
  BalanceHistoryGraphProps
>(function BalanceHistoryGraph(
  {
    data,
    domain,
    gradientOffset,
    minBalance,
    maxBalance,
    height = 75,
    style,
    hasNoBalance,
    onPress,
    onSelectPoint,
    onScrubbingChange,
  },
  ref
) {
  const { formatCurrency } = useCurrency();
  const [layoutWidth, setLayoutWidth] = useState<number>(340);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetAutoDismiss = useCallback(() => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
    }
    autoDismissTimerRef.current = setTimeout(() => {
      setSelectedIndex(null);
      onSelectPoint?.(null);
      onScrubbingChange?.(false);
    }, 7000);
  }, [onSelectPoint, onScrubbingChange]);

  useEffect(() => {
    return () => {
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
      }
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      deselect: () => {
        onScrubbingChange?.(false);
        if (selectedIndex !== null) {
          setSelectedIndex(null);
          onSelectPoint?.(null);
          if (autoDismissTimerRef.current) {
            clearTimeout(autoDismissTimerRef.current);
          }
        }
      },
      isSelected: selectedIndex !== null,
    }),
    [selectedIndex, onSelectPoint, onScrubbingChange]
  );

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
            <TrendingUp size={13} color={GRAPH_GREEN} strokeWidth={2.2} />
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

  // Symmetrical horizontal insets prevent the first/last circles (r=8 with outer glow) from being clipped by the card edge
  const horizontalPadding = 12;
  const topPadding = 8;
  const bottomPadding = 8;
  const usableWidth = Math.max(10, w - horizontalPadding * 2);
  const usableHeight = Math.max(10, h - topPadding - bottomPadding);

  const points = data.map((item, index) => {
    const x = horizontalPadding + (index / Math.max(1, ptsCount - 1)) * usableWidth;
    const normalizedY = (item.balance - minDomain) / domainSpan;
    const y = topPadding + usableHeight * (1 - normalizedY);
    return { x, y, balance: item.balance };
  });

  const zeroNormalized = (0 - minDomain) / domainSpan;
  const zeroY = topPadding + usableHeight * (1 - zeroNormalized);
  const crossesZero = minBalance < -0.01 && maxBalance > 0.01;

  const lineCurve = buildSmoothPath(points);
  const firstPointX = points[0]?.x ?? horizontalPadding;
  const lastPointX = points[points.length - 1]?.x ?? (w - horizontalPadding);
  const areaPath = `${lineCurve} L ${lastPointX.toFixed(1)} ${h.toFixed(1)} L ${firstPointX.toFixed(1)} ${h.toFixed(1)} Z`;

  const lastPoint = points[points.length - 1] || { x: w - horizontalPadding, y: h / 2, balance: 0 };
  const lastBalance = lastPoint.balance;

  // Selected point details
  const activeIndex = selectedIndex !== null && selectedIndex >= 0 && selectedIndex < points.length ? selectedIndex : null;
  const activePoint = activeIndex !== null ? points[activeIndex] : null;
  const activeData = activeIndex !== null ? data[activeIndex] : null;

  // Clamp offset between 0 and 1
  const safeOffset = Math.max(0, Math.min(1, gradientOffset));
  const offsetPct = Math.round(safeOffset * 100);

  // Exact nearest-point detection on touch/drag
  const updateSelectionFromX = (touchX: number, isGrant = false) => {
    if (!points.length) return;

    let closestIdx = 0;
    let minDistance = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dist = Math.abs(points[i].x - touchX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = i;
      }
    }

    if (closestIdx !== selectedIndex) {
      haptics.chartScrub();
      setSelectedIndex(closestIdx);
      onSelectPoint?.(data[closestIdx]);
      resetAutoDismiss();
    } else if (isGrant && selectedIndex !== null) {
      setSelectedIndex(null);
      onSelectPoint?.(null);
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
      }
    }
  };

  const handleGrant = (evt: GestureResponderEvent) => {
    onScrubbingChange?.(true);
    updateSelectionFromX(evt.nativeEvent.locationX, true);
  };

  const handleMove = (evt: GestureResponderEvent) => {
    updateSelectionFromX(evt.nativeEvent.locationX, false);
  };

  const handleRelease = () => {
    onScrubbingChange?.(false);
  };

  const handleTerminate = () => {
    onScrubbingChange?.(false);
  };

  return (
    <View
      style={[styles.container, { height }, style]}
      onLayout={handleLayout}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onStartShouldSetResponderCapture={() => true}
      onMoveShouldSetResponderCapture={() => true}
      onResponderGrant={handleGrant}
      onResponderMove={handleMove}
      onResponderRelease={handleRelease}
      onResponderTerminate={handleTerminate}
      onResponderTerminationRequest={() => false}
    >
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} pointerEvents="none">
        <Defs>
          {/* Fill Gradient: Fixed green & rose fintech ambient glow */}
          <LinearGradient id="balanceAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop
              offset="0%"
              stopColor={crossesZero || minBalance >= 0 ? GRAPH_GREEN : GRAPH_ROSE}
              stopOpacity={crossesZero || minBalance >= 0 ? 0.24 : 0.04}
            />
            <Stop
              offset={`${crossesZero ? Math.max(0, offsetPct - 8) : 50}%`}
              stopColor={crossesZero || minBalance >= 0 ? GRAPH_GREEN : GRAPH_ROSE}
              stopOpacity={0.06}
            />
            <Stop
              offset={`${crossesZero ? Math.min(100, offsetPct + 8) : 50}%`}
              stopColor={crossesZero || maxBalance <= 0 ? GRAPH_ROSE : GRAPH_GREEN}
              stopOpacity={0.06}
            />
            <Stop
              offset="100%"
              stopColor={crossesZero || maxBalance <= 0 ? GRAPH_ROSE : GRAPH_GREEN}
              stopOpacity={crossesZero || maxBalance <= 0 ? 0.24 : 0.02}
            />
          </LinearGradient>

          {/* Stroke Gradient: Fixed green & rose crisp curve */}
          <LinearGradient id="balanceStrokeGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop
              offset="0%"
              stopColor={crossesZero || minBalance >= 0 ? GRAPH_GREEN : GRAPH_ROSE}
              stopOpacity={0.95}
            />
            <Stop
              offset={`${crossesZero ? Math.max(0, offsetPct - 3) : 50}%`}
              stopColor={crossesZero || minBalance >= 0 ? GRAPH_GREEN : GRAPH_ROSE}
              stopOpacity={0.95}
            />
            <Stop
              offset={`${crossesZero ? Math.min(100, offsetPct + 3) : 50}%`}
              stopColor={crossesZero || maxBalance <= 0 ? GRAPH_ROSE : GRAPH_GREEN}
              stopOpacity={0.95}
            />
            <Stop
              offset="100%"
              stopColor={crossesZero || maxBalance <= 0 ? GRAPH_ROSE : GRAPH_GREEN}
              stopOpacity={0.95}
            />
          </LinearGradient>
        </Defs>

        {/* Zero Axis Reference Line */}
        {crossesZero && (
          <Line
            x1="0"
            y1={zeroY}
            x2={w}
            y2={zeroY}
            stroke="rgba(255, 255, 255, 0.09)"
            strokeDasharray="3 3"
            strokeWidth={1}
          />
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

        {/* Interactive Vertical Cursor Guide Line */}
        {activePoint && (
          <Line
            x1={activePoint.x}
            y1={0}
            x2={activePoint.x}
            y2={h}
            stroke="rgba(255, 255, 255, 0.38)"
            strokeDasharray="2 3"
            strokeWidth={1.2}
          />
        )}

        {/* Point Indicators (Zero Edge Clipping Guaranteed via horizontalPadding) */}
        {activePoint ? (
          <>
            <Circle
              cx={activePoint.x}
              cy={activePoint.y}
              r={8}
              fill={activePoint.balance >= 0 ? GRAPH_GREEN : GRAPH_ROSE}
              fillOpacity={0.25}
            />
            <Circle
              cx={activePoint.x}
              cy={activePoint.y}
              r={5}
              fill={activePoint.balance >= 0 ? GRAPH_GREEN : GRAPH_ROSE}
              fillOpacity={0.45}
            />
            <Circle
              cx={activePoint.x}
              cy={activePoint.y}
              r={3.5}
              fill={activePoint.balance >= 0 ? GRAPH_GREEN : GRAPH_ROSE}
              stroke="#FFFFFF"
              strokeWidth={1.5}
            />
          </>
        ) : (
          <>
            <Circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r={6}
              fill={lastBalance >= 0 ? GRAPH_GREEN : GRAPH_ROSE}
              fillOpacity={0.25}
            />
            <Circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r={3}
              fill={lastBalance >= 0 ? GRAPH_GREEN : GRAPH_ROSE}
              stroke="#FFFFFF"
              strokeWidth={1}
            />
          </>
        )}
      </Svg>

      {/* Sleek Minimal Floating Tooltip Capsule */}
      {activePoint && activeData && (
        <View
          style={[
            styles.tooltipPill,
            {
              left: Math.max(8, Math.min(w - 158, activePoint.x - 75)),
              ...(activePoint.y >= 36 ? { top: 4 } : { bottom: 4 }),
            },
          ]}
          pointerEvents="box-none"
        >
          <View
            style={[
              styles.tooltipIndicatorDot,
              { backgroundColor: activePoint.balance >= 0 ? GRAPH_GREEN : GRAPH_ROSE },
            ]}
          />
          <Text style={styles.tooltipDateText}>{activeData.date}</Text>
          <View style={styles.tooltipSep} />
          <Text
            style={[
              styles.tooltipBalanceText,
              { color: activePoint.balance >= 0 ? GRAPH_GREEN : GRAPH_ROSE },
            ]}
          >
            {formatCurrency(activePoint.balance, { showSign: true, decimals: 2 })}
          </Text>
          <TouchableOpacity
            onPress={() => {
              haptics.tap();
              setSelectedIndex(null);
              onSelectPoint?.(null);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.tooltipCloseBtn}
            accessibilityLabel="Dismiss balance point"
            accessibilityRole="button"
          >
            <X size={10} color={THEME.colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
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
  tooltipPill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 20, 24, 0.96)',
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: THEME.colors.hairlineLight,
    paddingHorizontal: 9,
    paddingVertical: 5,
    gap: 6,
    shadowColor: THEME.colors.palette.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 100,
  },
  tooltipIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tooltipDateText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.1,
  },
  tooltipSep: {
    width: 1,
    height: 10,
    backgroundColor: THEME.colors.hairlineLight,
  },
  tooltipBalanceText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  tooltipCloseBtn: {
    padding: 2,
    marginLeft: 2,
  },
});
