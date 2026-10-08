import React from 'react';
import { View, StyleSheet, Dimensions, StyleProp, ViewStyle } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Path,
  Circle,
  Ellipse,
  G,
} from 'react-native-svg';
import { THEME } from '../../constants/theme';

interface ExpenseAbstractHeaderProps {
  categoryColor: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Modern generative abstract vector header for Expense Details.
 * Uses harmonious bezier contours, ambient category glow, and geometric orbital rings.
 */
export const ExpenseAbstractHeader: React.FC<ExpenseAbstractHeaderProps> = ({
  categoryColor = THEME.colors.primary,
  height = 230,
  style,
  children,
}) => {
  const svgWidth = 400;
  const svgHeight = height;

  return (
    <View style={[styles.container, { height }, style]}>
      {/* Background SVG Canvas */}
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={StyleSheet.absoluteFill}
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          {/* Base Obsidian Charcoal Gradient */}
          <LinearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={THEME.colors.surfaceSubtle} stopOpacity="1" />
            <Stop offset="50%" stopColor={THEME.colors.background} stopOpacity="1" />
            <Stop offset="100%" stopColor={THEME.colors.background} stopOpacity="1" />
          </LinearGradient>

          {/* Dynamic Ambient Category Glow */}
          <RadialGradient id="glowGrad" cx="50%" cy="40%" r="65%">
            <Stop offset="0%" stopColor={categoryColor} stopOpacity="0.36" />
            <Stop offset="35%" stopColor={categoryColor} stopOpacity="0.14" />
            <Stop offset="75%" stopColor={categoryColor} stopOpacity="0.03" />
            <Stop offset="100%" stopColor={THEME.colors.background} stopOpacity="0" />
          </RadialGradient>

          {/* Wave Gradient 1 - Category Tinted */}
          <LinearGradient id="waveGradCategory" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor={categoryColor} stopOpacity="0.04" />
            <Stop offset="25%" stopColor={categoryColor} stopOpacity="0.4" />
            <Stop offset="75%" stopColor={categoryColor} stopOpacity="0.5" />
            <Stop offset="100%" stopColor={categoryColor} stopOpacity="0.04" />
          </LinearGradient>

          {/* Wave Gradient 2 - Silver Light Tinted */}
          <LinearGradient id="waveGradSilver" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor={THEME.colors.palette.white} stopOpacity="0.02" />
            <Stop offset="40%" stopColor={THEME.colors.palette.white} stopOpacity="0.22" />
            <Stop offset="70%" stopColor={THEME.colors.palette.white} stopOpacity="0.18" />
            <Stop offset="100%" stopColor={THEME.colors.palette.white} stopOpacity="0.02" />
          </LinearGradient>

          {/* Seamless Bottom Vignette Fade into Screen Canvas */}
          <LinearGradient id="bottomVignette" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={THEME.colors.background} stopOpacity="0" />
            <Stop offset="65%" stopColor={THEME.colors.background} stopOpacity="0.5" />
            <Stop offset="100%" stopColor={THEME.colors.background} stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {/* 1. Base Layer */}
        <Rect width={svgWidth} height={svgHeight} fill="url(#bgGrad)" />

        {/* 2. Ambient Radiant Aura */}
        <Rect width={svgWidth} height={svgHeight} fill="url(#glowGrad)" />

        {/* 3. Abstract Topographic Bezier Contours */}
        <G opacity="0.9">
          {/* Top subtle curve */}
          <Path
            d="M -30 35 C 70 5, 140 75, 230 40 C 310 10, 370 60, 430 30"
            fill="none"
            stroke="url(#waveGradCategory)"
            strokeWidth="1.2"
          />

          {/* Upper wave */}
          <Path
            d="M -20 65 C 60 30, 150 105, 240 70 C 320 35, 380 95, 430 60"
            fill="none"
            stroke="url(#waveGradSilver)"
            strokeWidth="1.0"
            strokeDasharray="5 4"
          />

          {/* Mid contour flowing near badge */}
          <Path
            d="M -30 105 C 50 70, 130 135, 220 95 C 300 60, 360 120, 430 85"
            fill="none"
            stroke="url(#waveGradCategory)"
            strokeWidth="1.4"
          />

          {/* Secondary dotted wave */}
          <Path
            d="M -20 145 C 80 110, 160 170, 260 125 C 335 85, 385 145, 430 115"
            fill="none"
            stroke="url(#waveGradSilver)"
            strokeWidth="0.8"
            strokeDasharray="3 6"
          />

          {/* Lower deep curve */}
          <Path
            d="M -30 185 C 70 145, 150 205, 245 160 C 325 125, 385 175, 430 145"
            fill="none"
            stroke="url(#waveGradCategory)"
            strokeWidth="1.0"
            opacity="0.45"
          />
        </G>

        {/* 4. Concentric Abstract Orbital Rings */}
        <G opacity="0.85">
          <Ellipse
            cx="200"
            cy="115"
            rx="56"
            ry="48"
            fill="none"
            stroke={categoryColor}
            strokeWidth="1.2"
            opacity="0.32"
          />
          <Ellipse
            cx="200"
            cy="115"
            rx="92"
            ry="78"
            fill="none"
            stroke={categoryColor}
            strokeWidth="0.8"
            strokeDasharray="6 6"
            opacity="0.22"
          />
          <Ellipse
            cx="200"
            cy="115"
            rx="140"
            ry="112"
            fill="none"
            stroke={THEME.colors.palette.white}
            strokeWidth="0.6"
            strokeDasharray="4 8"
            opacity="0.12"
          />
          <Ellipse
            cx="200"
            cy="115"
            rx="190"
            ry="145"
            fill="none"
            stroke={categoryColor}
            strokeWidth="0.5"
            opacity="0.08"
          />
        </G>

        {/* 5. Constellation Ambient Micro-Nodes */}
        <G>
          <Circle cx="64" cy="42" r="2.2" fill={categoryColor} opacity="0.65" />
          <Circle cx="145" cy="112" r="1.8" fill={categoryColor} opacity="0.75" />
          <Circle cx="255" cy="74" r="2.0" fill={THEME.colors.palette.white} opacity="0.8" />
          <Circle cx="330" cy="40" r="2.4" fill={categoryColor} opacity="0.55" />
          <Circle cx="100" cy="142" r="1.5" fill={THEME.colors.palette.white} opacity="0.45" />
          <Circle cx="295" cy="158" r="2.2" fill={categoryColor} opacity="0.5" />
          <Circle cx="365" cy="105" r="1.6" fill={THEME.colors.palette.white} opacity="0.35" />
          <Circle cx="30" cy="180" r="1.8" fill={categoryColor} opacity="0.4" />
        </G>

        {/* 6. Seamless Bottom Vignette Fade */}
        <Rect y={height - 75} width={svgWidth} height={75} fill="url(#bottomVignette)" />
      </Svg>

      {/* Foreground Content (Nav buttons, Category Emblem) */}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
});
