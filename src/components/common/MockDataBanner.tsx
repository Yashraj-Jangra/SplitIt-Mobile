import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Sparkles, Trash2, Plus, X } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { haptics } from '../../services/haptics.service';

interface MockDataBannerProps {
  onRemove: () => void | Promise<void>;
  onCreateGroup?: () => void;
  style?: object;
}

export function MockDataBanner({ onRemove, onCreateGroup, style }: MockDataBannerProps) {
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
      accessibilityLabel="Sample mock data notice banner"
    >
      {/* Eyebrow & Dismiss Icon */}
      <View style={styles.headerRow}>
        <View style={styles.badge}>
          <Sparkles size={13} color={THEME.colors.warningLight} strokeWidth={2.2} />
          <Text style={styles.badgeText}>SAMPLE PREVIEW DATA</Text>
        </View>

        <TouchableOpacity
          onPress={handleRemove}
          style={styles.closeBtn}
          accessibilityLabel="Remove sample mock data"
          accessibilityRole="button"
          activeOpacity={0.7}
          disabled={isRemoving}
        >
          {isRemoving ? (
            <ActivityIndicator size="small" color={THEME.colors.warningLight} />
          ) : (
            <X size={16} color={THEME.colors.textMuted} />
          )}
        </TouchableOpacity>
      </View>

      {/* Descriptive notice */}
      <Text style={styles.description}>
        This is interactive sample data showing how SplitIt calculates debts, tracks splits, and simplifies balances. Remove it anytime to start fresh, or begin by making your first group.
      </Text>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={handleRemove}
          activeOpacity={0.8}
          accessibilityLabel="Remove mock data and continue using app"
          accessibilityRole="button"
          disabled={isRemoving}
        >
          <Trash2 size={13} color={THEME.colors.textSecondary} strokeWidth={2} />
          <Text style={styles.removeBtnText}>
            {isRemoving ? 'Removing…' : 'Remove Mock Data'}
          </Text>
        </TouchableOpacity>

        {onCreateGroup && (
          <TouchableOpacity
            style={styles.createBtn}
            onPress={handleCreateGroup}
            activeOpacity={0.85}
            accessibilityLabel="Create your first group"
            accessibilityRole="button"
          >
            <Plus size={14} color={THEME.colors.primaryForeground} strokeWidth={2.5} />
            <Text style={styles.createBtnText}>Create a Group</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.22)',
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: THEME.spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  badgeText: {
    color: THEME.colors.warningLight,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -10,
    marginTop: -10,
  },
  description: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: THEME.spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  removeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.colors.surfaceElevated,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    minHeight: 44,
  },
  removeBtnText: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  createBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.md,
    minHeight: 44,
  },
  createBtnText: {
    color: THEME.colors.primaryForeground,
    fontSize: 12,
    fontWeight: '700',
  },
});
