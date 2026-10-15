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
  size = 36,
  color = THEME.colors.primary,
  glowColor = THEME.colors.primaryLight,
  useGradient = false,
  style,
}: QuantumLogoProps) {
  // Radius of the main arc circle is ~47.5, circumference is ~298.45
  // Dash array of 0.2 / 0.8 translates to ~59.69 on / 238.76 off
  const dashOn = 60;
  const dashOff = 239;
  const dashOffset1 = 45;
  const dashOffset2 = -45;
  const gradientId = `splitit_teal_${Math.round(size)}`;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        {useGradient && (
          <Defs>
            <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={glowColor} stopOpacity="1" />
              <Stop offset="60%" stopColor={color} stopOpacity="1" />
              <Stop offset="100%" stopColor={THEME.colors.success} stopOpacity="0.9" />
            </LinearGradient>
          </Defs>
        )}

        {/* Orbit Arc 1 */}
        <Path
          d="M50 2.5C23.79 2.5 2.5 23.79 2.5 50C2.5 76.21 23.79 97.5 50 97.5C76.21 97.5 97.5 76.21 97.5 50"
          stroke={useGradient ? `url(#${gradientId})` : color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${dashOn} ${dashOff}`}
          strokeDashoffset={dashOffset1}
        />

        {/* Orbit Arc 2 */}
        <Path
          d="M50 2.5C76.21 2.5 97.5 23.79 97.5 50C97.5 76.21 76.21 97.5 50 97.5"
          stroke={useGradient ? `url(#${gradientId})` : color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${dashOn} ${dashOff}`}
          strokeDashoffset={dashOffset2}
        />

        {/* Nucleus Core (clean solid center matching website) */}
        {useGradient ? (
          <>
            <Circle cx={50} cy={50} r={13} fill={color} opacity={0.2} />
            <Circle cx={50} cy={50} r={8.5} fill={color} opacity={0.5} />
            <Circle cx={50} cy={50} r={4.5} fill={glowColor} />
          </>
        ) : (
          <>
            <Circle cx={50} cy={50} r={10} fill={color} opacity={0.5} />
            <Circle cx={50} cy={50} r={5} fill={color} />
          </>
        )}
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
