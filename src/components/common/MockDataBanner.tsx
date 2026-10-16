import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Sparkles, Trash2, Plus, X } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { useAppTheme } from '../../contexts/theme.context';
import { QuantumSpinner } from '../brand/QuantumLogo';
import { haptics } from '../../services/haptics.service';

interface MockDataBannerProps {
  onRemove: () => void | Promise<void>;
  onCreateGroup?: () => void;
  style?: object;
}

export function MockDataBanner({ onRemove, onCreateGroup, style }: MockDataBannerProps) {
  const { currentAccent } = useAppTheme();
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemove = async () => {
    if (isRemoving) return;
    try {
      setIsRemoving(true);
      haptics.saveSuccess();
      await onRemove();
    } finally {
      setIsRemoving(false);
    }
  };

  const handleCreateGroup = () => {
    haptics.tap();
    onCreateGroup?.();
  };

  return (
    <View
      style={[styles.container, style]}
      accessibilityRole="alert"
      accessibilityLabel="Sample preview data notice"
    >
      {/* Subtle Glowing Brand Accent Bar */}
      <View style={[styles.topAccent, { backgroundColor: currentAccent.primary }]} />

      <View style={styles.innerContent}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <View style={styles.badgeRow}>
            <View style={[styles.iconCircle, { backgroundColor: currentAccent.primaryMuted }]}>
              <Sparkles size={11} color={currentAccent.primary} />
            </View>
            <Text style={[styles.badgeLabel, { color: currentAccent.primary }]}>SAMPLE PREVIEW MODE</Text>
          </View>

          <TouchableOpacity
            onPress={handleRemove}
            style={styles.closeBtn}
            accessibilityLabel="Remove sample preview data"
            accessibilityRole="button"
            activeOpacity={0.7}
            disabled={isRemoving}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {isRemoving ? (
              <QuantumSpinner size={15} color={currentAccent.primary} />
            ) : (
              <X size={15} color={THEME.colors.textMuted} />
            )}
          </TouchableOpacity>
        </View>

        {/* Headline & Description */}
        <Text style={styles.title}>Exploring with Sample Data</Text>
        <Text style={styles.description}>
          Interact with sample circles & debts to test calculations. Create your first group to start fresh, or clear preview data anytime.
        </Text>

        {/* Action Controls */}
        <View style={styles.actionsRow}>
          {onCreateGroup && (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: currentAccent.primary }]}
              onPress={handleCreateGroup}
              activeOpacity={0.85}
              accessibilityLabel="Create a group to start fresh"
              accessibilityRole="button"
            >
              <Plus size={14} color={THEME.colors.primaryForeground} strokeWidth={2.5} />
              <Text style={styles.primaryBtnText}>Create Group</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleRemove}
            activeOpacity={0.75}
            accessibilityLabel="Clear sample data"
            accessibilityRole="button"
            disabled={isRemoving}
          >
            {isRemoving ? (
              <QuantumSpinner size={15} color={THEME.colors.textSecondary} />
            ) : (
              <>
                <Trash2 size={13} color={THEME.colors.textSecondary} strokeWidth={2} />
                <Text style={styles.secondaryBtnText}>Clear Sample Data</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius['2xl'],
    borderWidth: 1,
    borderColor: THEME.colors.hairlineLight,
    overflow: 'hidden',
    marginBottom: THEME.spacing.lg,
  },
  topAccent: {
    height: 2,
    backgroundColor: THEME.colors.primary,
    opacity: 0.8,
  },
  innerContent: {
    padding: 16,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: THEME.colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.primary,
    letterSpacing: 1.1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: THEME.colors.surfaceElevated,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  description: {
    fontSize: 12,
    lineHeight: 18,
    color: THEME.colors.textSecondary,
    fontWeight: '400',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  primaryBtn: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.colors.primary,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: THEME.radius.lg,
    minHeight: 44,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.primaryForeground,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairlineLight,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.lg,
    minHeight: 44,
  },
  secondaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
});
