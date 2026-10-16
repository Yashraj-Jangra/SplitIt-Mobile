import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
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
}

export const DonutChart: React.FC<DonutChartProps> = ({
  slices,
  size = 130,
  strokeWidth = 18,
  centerValue,
  centerLabel,
  selectedSliceId,
  onSelectSlice,
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
        <Svg width={size} height={size}>
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
    const strokeDash = fraction * circumference;
    const strokeOffset = -accumulatedPercent * circumference;
    accumulatedPercent += fraction;

    const isSelected = selectedSliceId === slice.id;

    return {
      ...slice,
      fraction,
      strokeDash,
      strokeOffset,
      isSelected,
    };
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
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
              onPress={() => {
                haptics.tap();
                if (onSelectSlice) {
                  onSelectSlice(slice.isSelected ? null : slice);
                }
              }}
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
