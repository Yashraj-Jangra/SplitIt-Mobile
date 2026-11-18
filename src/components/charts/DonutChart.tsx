import React, { useCallback } from 'react';
import { View, StyleSheet, GestureResponderEvent } from 'react-native';
import Svg, { G, Circle, Text as SvgText } from 'react-native-svg';
import { THEME } from '../../constants/theme';
import { haptics } from '../../services/haptics.service';

export interface DonutSlice {
  id: string;
  label: string;
  value: number;
  color: string;
  percentage?: number;
}

export interface DonutChartProps {
  slices: DonutSlice[];
  size?: number;
  strokeWidth?: number;
  centerValue?: string;
  centerLabel?: string;
  selectedSliceId?: string | null;
  onSelectSlice?: (slice: DonutSlice | null) => void;
  onScrubbingChange?: (isScrubbing: boolean) => void;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  slices,
  size = 130,
  strokeWidth = 18,
  centerValue,
  centerLabel,
  selectedSliceId,
  onSelectSlice,
  onScrubbingChange,
}) => {
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const validSlices = slices.filter((s) => s.value > 0);
  const totalValue = validSlices.reduce((sum, s) => sum + s.value, 0);

  // If no data, render an empty ring
  if (totalValue === 0 || validSlices.length === 0) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size} pointerEvents="none">
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <SvgText
            x={center}
            y={center - 2}
            textAnchor="middle"
            alignmentBaseline="central"
            fill={THEME.colors.textMuted}
            fontSize="11"
            fontWeight="600"
          >
            No Spend
          </SvgText>
        </Svg>
      </View>
    );
  }

  // Calculate angles & dash arrays for each slice
  let accumulatedPercent = 0;
  const renderedSlices = validSlices.map((slice) => {
    const fraction = slice.value / totalValue;
    const startFraction = accumulatedPercent;
    const endFraction = accumulatedPercent + fraction;
    const strokeDash = fraction * circumference;
    const strokeOffset = -accumulatedPercent * circumference;
    accumulatedPercent += fraction;

    const isSelected = selectedSliceId === slice.id;

    return {
      ...slice,
      fraction,
      startFraction,
      endFraction,
      strokeDash,
      strokeOffset,
      isSelected,
    };
  });

  const handleTouch = useCallback(
    (e: GestureResponderEvent, isGrant = false) => {
      if (validSlices.length === 0) return;
      const { locationX, locationY } = e.nativeEvent;
      const dx = locationX - center;
      const dy = locationY - center;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Dead center tap toggles/deselects
      if (distance < radius - strokeWidth) {
        if (isGrant && selectedSliceId) {
          haptics.chartScrub();
          onSelectSlice?.(null);
        }
        return;
      }

      // Calculate angle from 12 o'clock clockwise in [0, 2π)
      let angle = Math.atan2(dy, dx) + Math.PI / 2;
      if (angle < 0) {
        angle += 2 * Math.PI;
      }
      const fraction = angle / (2 * Math.PI);

      const targetSlice = renderedSlices.find(
        (s) => fraction >= s.startFraction && fraction < s.endFraction
      );

      if (targetSlice && targetSlice.id !== selectedSliceId) {
        haptics.chartScrub();
        onSelectSlice?.(targetSlice);
      } else if (isGrant && targetSlice && targetSlice.id === selectedSliceId) {
        haptics.chartScrub();
        onSelectSlice?.(null);
      }
    },
    [validSlices, center, radius, strokeWidth, selectedSliceId, onSelectSlice, renderedSlices]
  );

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onStartShouldSetResponderCapture={() => true}
      onMoveShouldSetResponderCapture={() => true}
      onResponderGrant={(e) => {
        onScrubbingChange?.(true);
        handleTouch(e, true);
      }}
      onResponderMove={(e) => handleTouch(e, false)}
      onResponderRelease={() => {
        onScrubbingChange?.(false);
      }}
      onResponderTerminate={() => {
        onScrubbingChange?.(false);
      }}
      onResponderTerminationRequest={() => false}
    >
      <Svg width={size} height={size} pointerEvents="none">
        {/* Background track circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="rgba(255, 255, 255, 0.04)"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Rotated group so arcs begin at 12 o'clock */}
        <G rotation="-90" origin={`${center}, ${center}`}>
          {renderedSlices.map((slice) => (
            <Circle
              key={slice.id}
              cx={center}
              cy={center}
              r={radius}
              stroke={slice.color}
              strokeWidth={slice.isSelected ? strokeWidth + 3 : strokeWidth}
              strokeDasharray={`${slice.strokeDash} ${circumference}`}
              strokeDashoffset={slice.strokeOffset}
              strokeLinecap="butt"
              fill="none"
            />
          ))}
        </G>

        {/* Center Labels */}
        {centerValue && (
          <SvgText
            x={center}
            y={centerLabel ? center - 6 : center}
            textAnchor="middle"
            alignmentBaseline="central"
            fill={THEME.colors.text}
            fontSize={centerValue.length > 7 ? '12' : '14'}
            fontWeight="800"
          >
            {centerValue}
          </SvgText>
        )}

        {centerLabel && (
          <SvgText
            x={center}
            y={center + 11}
            textAnchor="middle"
            alignmentBaseline="central"
            fill={THEME.colors.textMuted}
            fontSize="9"
            fontWeight="700"
            letterSpacing={0.4}
          >
            {centerLabel.toUpperCase()}
          </SvgText>
        )}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
