import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutChangeEvent,
  GestureResponderEvent,
} from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle } from 'react-native-svg';
import { THEME } from '../../constants/theme';
import { useAppTheme } from '../../contexts/theme.context';
import { useCurrency } from '../../contexts/currency.context';
import { haptics } from '../../services/haptics.service';

export interface TimelineDataPoint {
  label: string;
  amount: number;
  fullDate?: string;
}

export interface SpendingTimelineChartProps {
  data: TimelineDataPoint[];
  frequency: 'daily' | 'weekly' | 'monthly';
  onChangeFrequency: (freq: 'daily' | 'weekly' | 'monthly') => void;
  height?: number;
  title?: string;
  onScrubbingChange?: (isScrubbing: boolean) => void;
}

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

export const SpendingTimelineChart: React.FC<SpendingTimelineChartProps> = ({
  data,
  frequency,
  onChangeFrequency,
  height = 175,
  title = 'SPENDING OVER TIME',
  onScrubbingChange,
}) => {
  const { currentAccent } = useAppTheme();
  const { formatCurrency } = useCurrency();
  const [chartWidth, setChartWidth] = useState<number>(340);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setChartWidth(w);
  }, []);

  const totalSpend = useMemo(() => {
    return data.reduce((sum, d) => sum + d.amount, 0);
  }, [data]);

  const maxAmount = useMemo(() => {
    const max = Math.max(...data.map((d) => d.amount), 0);
    return max > 0 ? max : 1;
  }, [data]);

  // Chart bounds & padding
  const paddingLeft = 14;
  const paddingRight = 14;
  const paddingTop = 24;
  const paddingBottom = 30;
  const plotWidth = Math.max(chartWidth - paddingLeft - paddingRight, 10);
  const plotHeight = Math.max(height - paddingTop - paddingBottom, 10);

  // Map data to SVG coordinates
  const coordinates = useMemo(() => {
    if (data.length === 0) return [];

    const stepX = data.length > 1 ? plotWidth / (data.length - 1) : 0;

    return data.map((d, index) => {
      const x = paddingLeft + (data.length === 1 ? plotWidth / 2 : index * stepX);
      const normalizedY = d.amount / maxAmount;
      const y = paddingTop + plotHeight - normalizedY * plotHeight;
      return { x, y, data: d };
    });
  }, [data, plotWidth, plotHeight, maxAmount, paddingLeft, paddingTop]);

  const strokePath = useMemo(() => {
    if (coordinates.length === 0) return '';
    return buildSmoothPath(coordinates);
  }, [coordinates]);

  const areaPath = useMemo(() => {
    if (coordinates.length === 0) return '';
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    const baselineY = paddingTop + plotHeight;

    const smoothLine = buildSmoothPath(coordinates);
    return `${smoothLine} L ${last.x.toFixed(1)} ${baselineY} L ${first.x.toFixed(1)} ${baselineY} Z`;
  }, [coordinates, paddingTop, plotHeight]);

  // Touch Scrubber Handler
  const handleTouch = useCallback(
    (e: GestureResponderEvent) => {
      if (coordinates.length === 0) return;
      const touchX = e.nativeEvent.locationX;

      let closestIdx = 0;
      let minDistance = Infinity;

      coordinates.forEach((pt, idx) => {
        const dist = Math.abs(pt.x - touchX);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = idx;
        }
      });

      if (closestIdx !== selectedIndex) {
        haptics.tap();
        setSelectedIndex(closestIdx);
      }
    },
    [coordinates, selectedIndex]
  );

  const selectedPoint = selectedIndex !== null && coordinates[selectedIndex] ? coordinates[selectedIndex] : null;

  return (
    <View style={styles.container}>
      {/* Chart Section Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionTotal}>
            {formatCurrency(selectedPoint ? selectedPoint.data.amount : totalSpend, { decimals: 0 })}
            <Text style={styles.sectionSub}>
              {selectedPoint ? ` on ${selectedPoint.data.fullDate || selectedPoint.data.label}` : ' in period'}
            </Text>
          </Text>
        </View>

        {/* Frequency Toggle Pills */}
        <View style={styles.freqPillTrack}>
          <TouchableOpacity
            style={[styles.freqPill, frequency === 'daily' && [styles.freqPillActive, { backgroundColor: currentAccent.primary }]]}
            onPress={() => {
              haptics.tap();
              setSelectedIndex(null);
              onChangeFrequency('daily');
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.freqText, frequency === 'daily' && styles.freqTextActive]}>Days</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.freqPill, frequency === 'weekly' && [styles.freqPillActive, { backgroundColor: currentAccent.primary }]]}
            onPress={() => {
              haptics.tap();
              setSelectedIndex(null);
              onChangeFrequency('weekly');
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.freqText, frequency === 'weekly' && styles.freqTextActive]}>Weeks</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.freqPill, frequency === 'monthly' && [styles.freqPillActive, { backgroundColor: currentAccent.primary }]]}
            onPress={() => {
              haptics.tap();
              setSelectedIndex(null);
              onChangeFrequency('monthly');
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.freqText, frequency === 'monthly' && styles.freqTextActive]}>Months</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* SVG Canvas Area */}
      <View
        style={[styles.chartCanvasWrap, { height }]}
        onLayout={onLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onStartShouldSetResponderCapture={() => true}
        onMoveShouldSetResponderCapture={() => true}
        onResponderGrant={(e) => {
          onScrubbingChange?.(true);
          handleTouch(e);
        }}
        onResponderMove={handleTouch}
        onResponderRelease={() => {
          onScrubbingChange?.(false);
          setTimeout(() => setSelectedIndex(null), 3500);
        }}
        onResponderTerminate={() => {
          onScrubbingChange?.(false);
          setSelectedIndex(null);
        }}
        onResponderTerminationRequest={() => false}
      >
        {coordinates.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No spending timeline in selected range</Text>
          </View>
        ) : (
          <Svg width={chartWidth} height={height}>
            <Defs>
              <LinearGradient id="spendingGradient" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={currentAccent.primary} stopOpacity={0.35} />
                <Stop offset="80%" stopColor={currentAccent.primary} stopOpacity={0.03} />
                <Stop offset="100%" stopColor={currentAccent.primary} stopOpacity={0.0} />
              </LinearGradient>
            </Defs>

            {/* Horizontal Guide Lines */}
            <Line
              x1={paddingLeft}
              y1={paddingTop}
              x2={chartWidth - paddingRight}
              y2={paddingTop}
              stroke="rgba(255, 255, 255, 0.05)"
              strokeDasharray="4 4"
            />
            <Line
              x1={paddingLeft}
              y1={paddingTop + plotHeight / 2}
              x2={chartWidth - paddingRight}
              y2={paddingTop + plotHeight / 2}
              stroke="rgba(255, 255, 255, 0.05)"
              strokeDasharray="4 4"
            />
            <Line
              x1={paddingLeft}
              y1={paddingTop + plotHeight}
              x2={chartWidth - paddingRight}
              y2={paddingTop + plotHeight}
              stroke="rgba(255, 255, 255, 0.08)"
            />

            {/* Gradient Fill under curve */}
            {areaPath ? <Path d={areaPath} fill="url(#spendingGradient)" /> : null}

            {/* Main Bezier Stroke */}
            {strokePath ? (
              <Path
                d={strokePath}
                fill="none"
                stroke={currentAccent.primary}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}

            {/* Scrubber vertical line & indicator dot */}
            {selectedPoint && (
              <>
                <Line
                  x1={selectedPoint.x}
                  y1={paddingTop}
                  x2={selectedPoint.x}
                  y2={paddingTop + plotHeight}
                  stroke={currentAccent.primary}
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                />
                <Circle
                  cx={selectedPoint.x}
                  cy={selectedPoint.y}
                  r={5}
                  fill="#FFFFFF"
                  stroke={currentAccent.primary}
                  strokeWidth={2.5}
                />
              </>
            )}
          </Svg>
        )}

        {/* X-Axis Date Labels Row */}
        {coordinates.length > 0 && (
          <View style={styles.xAxisRow}>
            {coordinates
              .filter((_, i) => {
                if (coordinates.length <= 5) return true;
                const step = Math.ceil(coordinates.length / 5);
                return i % step === 0 || i === coordinates.length - 1;
              })
              .map((pt, i) => (
                <Text key={i} style={styles.xAxisLabel} numberOfLines={1}>
                  {pt.data.label}
                </Text>
              ))}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    paddingVertical: 14,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.6,
  },
  sectionTotal: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -0.4,
    marginTop: 2,
  },
  sectionSub: {
    fontSize: 11,
    fontWeight: '500',
    color: THEME.colors.textMuted,
  },
  freqPillTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 16,
    padding: 2,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  freqPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 14,
  },
  freqPillActive: {},
  freqText: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  freqTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  chartCanvasWrap: {
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
  },
  xAxisRow: {
    position: 'absolute',
    bottom: 2,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  xAxisLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textMuted,
  },
});
