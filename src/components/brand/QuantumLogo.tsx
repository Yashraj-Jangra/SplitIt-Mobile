import React from 'react';
import { View, Image, StyleSheet, ImageStyle, StyleProp } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { THEME } from '../../constants/theme';

interface QuantumLogoProps {
  size?: number;
  color?: string;
  style?: StyleProp<any>;
}

/**
 * SplitIt Quantum Atomic Logo (Vector Component)
 * Exact mathematical arc replica matching website's Icons.Logo & Icons.AppLogo
 */
export function QuantumLogo({
  size = 36,
  color = THEME.colors.primary,
  style,
}: QuantumLogoProps) {
  // Radius of the main arc circle is ~47.5, circumference is ~298.45
  // Dash array of 0.2 / 0.8 translates to ~59.69 on / 238.76 off
  const dashOn = 60;
  const dashOff = 239;
  const dashOffset1 = 45;
  const dashOffset2 = -45;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <Path
          d="M50 2.5C23.79 2.5 2.5 23.79 2.5 50C2.5 76.21 23.79 97.5 50 97.5C76.21 97.5 97.5 76.21 97.5 50"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${dashOn} ${dashOff}`}
          strokeDashoffset={dashOffset1}
        />
        <Path
          d="M50 2.5C76.21 2.5 97.5 23.79 97.5 50C97.5 76.21 76.21 97.5 50 97.5"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${dashOn} ${dashOff}`}
          strokeDashoffset={dashOffset2}
        />
        <Circle cx={50} cy={50} r={10} fill={color} opacity={0.4} />
        <Circle cx={50} cy={50} r={5} fill={color} />
      </Svg>
    </View>
  );
}

/**
 * SplitIt Official High-Resolution Brand Icon
 * Using official 512px raster render from the website
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
