import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { useAppTheme } from '../../contexts/theme.context';
import { haptics } from '../../services/haptics.service';

export interface SettingsRowProps {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  iconColor?: string;
  iconBg?: string;
  title: string;
  subtitle?: string;
  value?: React.ReactNode;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  isLast?: boolean;
  disabled?: boolean;
}

export const SettingsRow: React.FC<SettingsRowProps> = ({
  icon: IconComponent,
  iconColor,
  iconBg = THEME.colors.surfaceElevated,
  title,
  subtitle,
  value,
  onPress,
  rightElement,
  isLast = false,
  disabled = false,
}) => {
  const { currentAccent } = useAppTheme();
  const effectiveIconColor = iconColor ?? currentAccent.primary;

  const content = (
    <View style={[styles.row, !isLast && styles.rowBorder]}>
      <View style={[styles.iconGlyph, { backgroundColor: iconBg }]}>
        <IconComponent size={16} color={effectiveIconColor} />
      </View>
      <View style={styles.infoCol}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {Boolean(subtitle) && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      <View style={styles.rightCol}>
        {rightElement ? (
          rightElement
        ) : (
          <>
            {typeof value === 'string' ? (
              <View style={styles.valuePill}>
                <Text style={[styles.valueText, { color: currentAccent.primary }]} numberOfLines={1}>
                  {value}
                </Text>
              </View>
            ) : (
              value
            )}
            {Boolean(onPress) && <ChevronRight size={15} color={THEME.colors.textMuted} />}
          </>
        )}
      </View>
    </View>
  );

  if (onPress && !disabled) {
    return (
      <TouchableOpacity
        onPress={() => {
          haptics.tap();
          onPress();
        }}
        activeOpacity={0.7}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  iconGlyph: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11.5,
    fontWeight: '500',
    color: THEME.colors.textMuted,
  },
  rightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  valuePill: {
    backgroundColor: THEME.colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    maxWidth: 130,
  },
  valueText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
});
