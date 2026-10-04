import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  Search,
  X,
  Receipt,
  Utensils,
  Car,
  ShoppingBag,
  Coffee,
  Sparkles,
  ArrowLeft,
  ChevronRight,
} from 'lucide-react-native';
import { THEME } from '../../../src/constants/theme';
import { groupService, GroupDetailData, GroupExpense } from '../../../src/services/group.service';
import { ExpenseImpactCol } from '../../../src/components/expenses/ExpenseImpactCol';
import * as Haptics from 'expo-haptics';

export default function GroupSearchScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const targetId = Array.isArray(id) ? id[0] : (id || '1');

  const [group, setGroup] = useState<GroupDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    groupService.getGroupDetails(targetId).then((data) => {
      setGroup(data);
      setLoading(false);
    });
  }, [targetId]);

  const expenses = group?.expenses || [];

  const filteredExpenses = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return expenses;

    return expenses.filter((exp) => {
      const titleMatch = (exp.title || '').toLowerCase().includes(trimmed);
      const payerMatch = (exp.paidByName || '').toLowerCase().includes(trimmed);
      const masterCatMatch = (exp.category?.master || '').toLowerCase().includes(trimmed);
      const subCatMatch = (exp.category?.sub || '').toLowerCase().includes(trimmed);
      const amountMatch = String(exp.amount).includes(trimmed);

      return titleMatch || payerMatch || masterCatMatch || subCatMatch || amountMatch;
    });
  }, [expenses, query]);

  const renderCategoryIcon = (category?: { master?: string; sub?: string }) => {
    const text = `${category?.master || ''} ${category?.sub || ''}`.toLowerCase();
    if (text.includes('food') || text.includes('dining') || text.includes('dinner') || text.includes('snack')) {
      return <Utensils size={16} color={THEME.colors.textSecondary} />;
    }
    if (text.includes('coffee') || text.includes('cafe')) {
      return <Coffee size={16} color={THEME.colors.textSecondary} />;
    }
    if (text.includes('travel') || text.includes('transport') || text.includes('cab') || text.includes('taxi')) {
      return <Car size={16} color={THEME.colors.textSecondary} />;
    }
    if (text.includes('shop') || text.includes('grocery') || text.includes('mart')) {
      return <ShoppingBag size={16} color={THEME.colors.textSecondary} />;
    }
    return <Receipt size={16} color={THEME.colors.textSecondary} />;
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Sleek Top Search Bar Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              router.back();
            }}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={20} color={THEME.colors.text} />
          </TouchableOpacity>

          <View style={styles.searchBar}>
            <Search size={16} color={THEME.colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search expenses, payer, category..."
              placeholderTextColor={THEME.colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus={true}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setQuery('');
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={16} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Group Context Badge / Results Count */}
        <View style={styles.metaRow}>
          <Text style={styles.metaGroupText} numberOfLines={1}>
            {group ? group.name : 'Group'}
          </Text>
          <Text style={styles.metaCountText}>
            {query.trim()
              ? `${filteredExpenses.length} result${filteredExpenses.length === 1 ? '' : 's'}`
              : `${expenses.length} total`}
          </Text>
        </View>

        {/* Results Stream */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color={THEME.colors.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {filteredExpenses.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Receipt size={36} color={THEME.colors.textMuted} />
                <Text style={styles.emptyTitle}>No matching expenses</Text>
                <Text style={styles.emptySubtitle}>
                  {query.trim()
                    ? `No expenses found matching "${query.trim()}". Try searching by merchant, payer, or amount.`
                    : 'No expenses have been recorded in this group yet.'}
                </Text>
              </View>
            ) : (
              <View style={styles.ledgerStream}>
                {filteredExpenses.map((exp, index, arr) => {
                  const isLast = index === arr.length - 1;

                  return (
                    <TouchableOpacity
                      key={exp.id}
                      style={[styles.ledgerRow, !isLast && styles.ledgerRowBorder]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        router.push({
                          pathname: '/expenses/[id]',
                          params: {
                            id: exp.id,
                            groupId: targetId,
                            title: exp.title,
                            amount: String(exp.amount),
                            paidByName: exp.paidByName || 'Member',
                            date: exp.date,
                            category: exp.category?.sub || exp.category?.master || 'General',
                          },
                        });
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.categoryGlyph}>
                        {renderCategoryIcon(exp.category)}
                      </View>

                      <View style={styles.ledgerDetails}>
                        <Text style={styles.ledgerExpenseTitle} numberOfLines={1}>
                          {exp.title}
                        </Text>
                        <Text style={styles.ledgerExpenseSubtitle} numberOfLines={1}>
                          {exp.paidByName || 'Member'} paid • {exp.date}
                        </Text>
                      </View>

                      <ExpenseImpactCol expense={exp} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surface,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 14,
    height: 42,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: THEME.colors.text,
    paddingVertical: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  metaGroupText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  metaCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.primary,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 10,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.text,
    marginTop: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  ledgerStream: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    paddingHorizontal: 12,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 12,
  },
  ledgerRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  categoryGlyph: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ledgerDetails: {
    flex: 1,
    gap: 2,
  },
  ledgerExpenseTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  ledgerExpenseSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  ledgerImpactCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  ledgerImpactAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  ledgerImpactLabel: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    textTransform: 'uppercase',
  },
});
