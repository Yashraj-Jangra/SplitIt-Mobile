import React from 'react';
import { View, Text, Image, StyleSheet, ImageStyle, TextStyle, ViewStyle, StyleProp } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { THEME } from '../../constants/theme';

interface QuantumLogoProps {
  size?: number;
  color?: string;
  glowColor?: string;
  useGradient?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * SplitIt Quantum Atomic Logo (Vector Component)
 * Exact mathematical arc replica matching website's Icons.Logo & Icons.AppLogo
 * Rendered with hardware acceleration via react-native-svg.
 */
export function QuantumLogo({
  size = 32,
  color = THEME.colors.primary,
  glowColor,
  useGradient = false,
  style,
}: QuantumLogoProps) {
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        {/* Orbit Arc 1: Top-left & Bottom-right arc segments (exact 1:1 replica of web Icons.Logo) */}
        <Path
          d="M50 2.5C23.79 2.5 2.5 23.79 2.5 50C2.5 76.21 23.79 97.5 50 97.5C76.21 97.5 97.5 76.21 97.5 50"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="44.77 179.07"
          strokeDashoffset={33.58}
        />

        {/* Orbit Arc 2: Top-right arc segment (exact 1:1 replica of web Icons.Logo) */}
        <Path
          d="M50 2.5C76.21 2.5 97.5 23.79 97.5 50C97.5 76.21 76.21 97.5 50 97.5"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="29.85 119.38"
          strokeDashoffset={-22.38}
        />

        {/* Nucleus Core: 10px radius with 50% opacity, 5px radius solid (exact web Icons.Logo) */}
        <Circle cx={50} cy={50} r={10} fill={color} opacity={0.5} />
        <Circle cx={50} cy={50} r={5} fill={color} />
      </Svg>
    </View>
  );
}

/**
 * SplitIt Branded Wordmark (Logo + "SplitIt" Typography)
 */
export function BrandWordmark({
  size = 32,
  textSize = 22,
  showTagline = false,
  style,
}: {
  size?: number;
  textSize?: number;
  showTagline?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.wordmarkRow, style]}>
      <QuantumLogo size={size} />
      <View style={styles.textColumn}>
        <Text style={[styles.wordmarkTitle, { fontSize: textSize }]}>SplitIt</Text>
        {showTagline && <Text style={styles.wordmarkTagline}>Shared expenses, settled simply</Text>}
      </View>
    </View>
  );
}

/**
 * SplitIt Official High-Resolution Brand Icon (Raster fallback)
 * Uses the newly generated vibrant teal 512px raster asset.
 */
export function BrandLogoImage({
  size = 40,
  style,
}: {
  size?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={require('../../../assets/brand/logo-512.png')}
      style={[{ width: size, height: size, resizeMode: 'contain' }, style]}
    />
  );
}

/**
 * Circular brand emblem badge image for embedding inside UPI QR codes
 */
export const BRAND_QR_BADGE = require('../../../assets/brand/logo-badge.png');

const styles = StyleSheet.create({
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textColumn: {
    justifyContent: 'center',
  },
  wordmarkTitle: {
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -0.6,
  },
  wordmarkTagline: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
});
