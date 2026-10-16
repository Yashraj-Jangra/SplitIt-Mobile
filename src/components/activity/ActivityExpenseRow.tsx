import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { THEME } from '../../constants/theme';
import { CategoryIcon } from '../../utils/category-icons';
import { ExpenseImpactCol } from '../expenses/ExpenseImpactCol';

export interface ActivityExpenseItemData {
  id: string;
  title: string;
  amount: number | string;
  paidByName?: string;
  date: string;
  category?: any;
  masterCategory?: string;
  groupName?: string;
  groupId?: string;
  yourImpact?: 'get' | 'owe' | 'none';
  [key: string]: any;
}

export interface ActivityExpenseRowProps {
  expense: ActivityExpenseItemData;
  currentUserId?: string;
  isLast?: boolean;
  onPress: () => void;
}

export const ActivityExpenseRow = React.memo(function ActivityExpenseRow({
  expense,
  currentUserId,
  isLast = false,
  onPress,
}: ActivityExpenseRowProps) {
  const subCat =
    typeof expense.category === 'string'
      ? expense.category
      : expense.category?.sub;
  const masterCat = expense.masterCategory || expense.category?.master;

  return (
    <TouchableOpacity
      style={[styles.row, !isLast && styles.rowBorder]}
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Expense: ${expense.title}`}
    >
      {/* Neutral Category Glyph Node */}
      <View style={styles.iconNode}>
        <CategoryIcon
          subCategory={subCat}
          masterCategory={masterCat}
          size={18}
          color={THEME.colors.textSecondary}
        />
      </View>

      {/* Center Details */}
      <View style={styles.detailsCol}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {expense.title}
        </Text>
        <Text style={styles.itemSubtitle} numberOfLines={1}>
          {expense.paidByName || 'Member'}
          {expense.groupName ? ` • ${expense.groupName}` : ''}
        </Text>
        <Text style={styles.itemDate}>{expense.date}</Text>
      </View>

      {/* Right Column: Expense Impact */}
      <ExpenseImpactCol expense={expense} currentUserId={currentUserId} />
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.colors.hairline,
  },
  iconNode: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  detailsCol: {
    flex: 1,
    marginRight: 10,
    gap: 2,
  },
  itemTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  itemSubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
  },
  itemDate: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
});
