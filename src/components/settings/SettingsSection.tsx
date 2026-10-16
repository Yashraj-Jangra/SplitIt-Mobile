import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../../constants/theme';

export interface SettingsSectionProps {
  title?: string;
  children: React.ReactNode;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({ title, children }) => {
  return (
    <View style={styles.section}>
      {Boolean(title) && <Text style={styles.overline}>{title}</Text>}
      <View style={styles.card}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  overline: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
    paddingHorizontal: 2,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    overflow: 'hidden',
  },
});
