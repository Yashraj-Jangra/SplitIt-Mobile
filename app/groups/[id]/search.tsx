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
  Sparkles,
  ArrowLeft,
  ChevronRight,
  Handshake,
  ArrowRight,
} from 'lucide-react-native';
import { THEME } from '../../../src/constants/theme';
import { groupService, GroupDetailData, GroupExpense } from '../../../src/services/group.service';
import { GroupSettlementItem } from '../../../src/services/settlement.service';
import { useAuth } from '../../../src/contexts/auth.context';
import { useCurrency } from '../../../src/contexts/currency.context';
import { ExpenseImpactCol } from '../../../src/components/expenses/ExpenseImpactCol';
import { CategoryIcon } from '../../../src/utils/category-icons';
import { haptics } from '../../../src/services/haptics.service';

type SearchFilterType = 'all' | 'expenses' | 'settlements';

type GroupSearchItem =
  | {
      type: 'expense';
      id: string;
      date: string;
      rawDate: string;
      data: GroupExpense;
    }
  | {
      type: 'settlement';
      id: string;
      date: string;
      rawDate: string;
      data: GroupSettlementItem;
    };

function getTimelineTimestamp(rawDate?: string, dateStr?: string): number {
  if (rawDate) {
    const rawParsed = new Date(rawDate).getTime();
    if (!isNaN(rawParsed) && rawParsed > 0) return rawParsed;
  }
  if (dateStr) {
    const lower = dateStr.trim().toLowerCase();
    const now = new Date();
    if (lower.startsWith('today')) {
      const timePart = dateStr.split(',')[1]?.trim();
      if (timePart) {
        const timeParsed = new Date(`${now.toDateString()} ${timePart}`).getTime();
        if (!isNaN(timeParsed) && timeParsed > 0) return timeParsed;
      }
      return now.getTime();
    }
    if (lower.startsWith('yesterday')) {
      const yest = new Date(Date.now() - 86400000);
      const timePart = dateStr.split(',')[1]?.trim();
      if (timePart) {
        const timeParsed = new Date(`${yest.toDateString()} ${timePart}`).getTime();
        if (!isNaN(timeParsed) && timeParsed > 0) return timeParsed;
      }
      return yest.getTime();
    }
    const currentYear = new Date().getFullYear();
    const withYear = new Date(`${dateStr} ${currentYear}`).getTime();
    if (!isNaN(withYear) && withYear > 0) return withYear;

    const direct = new Date(dateStr).getTime();
    if (!isNaN(direct) && direct > 0) return direct;
  }
  return 0;
}

export default function GroupSearchScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const targetId = Array.isArray(id) ? id[0] : (id || '1');

  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const currentUserId = user?.id || 'u1';

  const inMem = groupService.getInMemoryGroupDetail(targetId);
  const [group, setGroup] = useState<GroupDetailData | null>(() => inMem);
  const [loading, setLoading] = useState(!inMem);
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<SearchFilterType>('all');

  useEffect(() => {
    groupService.getGroupDetails(targetId).then((data) => {
      if (data) setGroup(data);
      setLoading(false);
    });
  }, [targetId]);

  const allItems: GroupSearchItem[] = useMemo(() => {
    const expItems: GroupSearchItem[] = (group?.expenses || []).map((e) => ({
      type: 'expense' as const,
      id: `exp_${e.id}`,
      date: e.date,
      rawDate: e.rawDate || (e as any).rawDate || e.date,
      data: e,
    }));

    const setItems: GroupSearchItem[] = (group?.settlements || []).map((s) => ({
      type: 'settlement' as const,
      id: `stl_${s.id}`,
      date: s.date,
      rawDate: s.rawDate || s.date,
      data: s,
    }));

    return [...expItems, ...setItems].sort((a, b) => {
      const timeA = getTimelineTimestamp(a.rawDate, a.date);
      const timeB = getTimelineTimestamp(b.rawDate, b.date);
      if (timeA !== timeB) return timeB - timeA;
      return b.id.localeCompare(a.id);
    });
  }, [group?.expenses, group?.settlements]);

  const filteredItems = useMemo(() => {
    let items = allItems;
    if (filterType === 'expenses') {
      items = items.filter((item) => item.type === 'expense');
    } else if (filterType === 'settlements') {
      items = items.filter((item) => item.type === 'settlement');
    }

    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return items;

    return items.filter((item) => {
      if (item.type === 'expense') {
        const exp = item.data;
        const titleMatch = (exp.title || '').toLowerCase().includes(trimmed);
        const payerMatch = (exp.paidByName || '').toLowerCase().includes(trimmed);
        const masterCatMatch = (exp.category?.master || '').toLowerCase().includes(trimmed);
        const subCatMatch = (exp.category?.sub || '').toLowerCase().includes(trimmed);
        const amountMatch = String(exp.amount).includes(trimmed);

        return titleMatch || payerMatch || masterCatMatch || subCatMatch || amountMatch;
      } else {
        const set = item.data;
        const payerMatch = (set.payerName || '').toLowerCase().includes(trimmed);
        const payeeMatch = (set.payeeName || '').toLowerCase().includes(trimmed);
        const notesMatch = (set.notes || '').toLowerCase().includes(trimmed);
        const methodMatch = (set.method || '').toLowerCase().includes(trimmed);
        const amountMatch = String(set.amount).includes(trimmed);
        const keywordMatch = 'settlement'.includes(trimmed) || 'payment'.includes(trimmed);

        return payerMatch || payeeMatch || notesMatch || methodMatch || amountMatch || keywordMatch;
      }
    });
  }, [allItems, filterType, query]);

  const totalExpenseCount = (group?.expenses || []).length;
  const totalSettlementCount = (group?.settlements || []).length;

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
              haptics.tap();
              router.back();
            }}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <ArrowLeft size={20} color={THEME.colors.text} />
          </TouchableOpacity>

          <View style={styles.searchBar}>
            <Search size={16} color={THEME.colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search expenses, payments, members..."
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
                  haptics.tap();
                  setQuery('');
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Clear search"
                accessibilityRole="button"
              >
                <X size={16} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Segmented Filter Pills */}
        <View style={styles.filterPillsRow}>
          <TouchableOpacity
            style={[styles.filterPill, filterType === 'all' && styles.filterPillActive]}
            onPress={() => {
              haptics.tap();
              setFilterType('all');
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterPillText, filterType === 'all' && styles.filterPillTextActive]}>
              All ({allItems.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, filterType === 'expenses' && styles.filterPillActive]}
            onPress={() => {
              haptics.tap();
              setFilterType('expenses');
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterPillText, filterType === 'expenses' && styles.filterPillTextActive]}>
              Expenses ({totalExpenseCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, filterType === 'settlements' && styles.filterPillActive]}
            onPress={() => {
              haptics.tap();
              setFilterType('settlements');
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterPillText, filterType === 'settlements' && styles.filterPillTextActive]}>
              Settlements ({totalSettlementCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Group Context Badge / Results Count */}
        <View style={styles.metaRow}>
          <Text style={styles.metaGroupText} numberOfLines={1}>
            {group ? group.name : 'Group'}
          </Text>
          <Text style={styles.metaCountText}>
            {query.trim()
              ? `${filteredItems.length} result${filteredItems.length === 1 ? '' : 's'}`
              : `${filteredItems.length} item${filteredItems.length === 1 ? '' : 's'}`}
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
            keyboardDismissMode="on-drag"
          >
            {filteredItems.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Receipt size={36} color={THEME.colors.textMuted} />
                <Text style={styles.emptyTitle}>
                  {filterType === 'settlements'
                    ? 'No matching settlements'
                    : filterType === 'expenses'
                    ? 'No matching expenses'
                    : 'No matching records'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {query.trim()
                    ? `No records found matching "${query.trim()}". Try searching by name, merchant, or amount.`
                    : filterType === 'settlements'
                    ? 'No settlements have been recorded in this group yet.'
                    : filterType === 'expenses'
                    ? 'No expenses have been recorded in this group yet.'
                    : 'No activity has been recorded in this group yet.'}
                </Text>
              </View>
            ) : (
              <View style={styles.ledgerStream}>
                {filteredItems.map((item, index, arr) => {
                  const isLast = index === arr.length - 1;

                  if (item.type === 'expense') {
                    const exp = item.data;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.ledgerRow, !isLast && styles.ledgerRowBorder]}
                        onPress={() => {
                          haptics.tap();
                          router.push({
                            pathname: '/expenses/[id]',
                            params: {
                              id: exp.id,
                              groupId: targetId,
                              title: exp.title,
                              amount: String(exp.amount),
                              paidByName: exp.paidByName || 'Member',
                              date: exp.date,
                              category: exp.category?.sub || exp.category?.master || 'Other',
                            },
                          });
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.categoryGlyph}>
                          <CategoryIcon
                            subCategory={exp.category?.sub}
                            masterCategory={exp.category?.master}
                            size={20}
                            color={THEME.colors.textSecondary}
                          />
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
                  }

                  // Settlement row
                  const set = item.data;
                  const isPayerViewer = set.payerId === currentUserId || set.payerName === 'You';
                  const isPayeeViewer = set.payeeId === currentUserId || set.payeeName === 'You';
                  const payerText = isPayerViewer ? 'You' : set.payerName;
                  const payeeText = isPayeeViewer ? 'You' : set.payeeName;

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.settlementRow, !isLast && styles.settlementRowBorder]}
                      onPress={() => {
                        haptics.tap();
                        router.push({
                          pathname: '/settlements/[id]',
                          params: {
                            id: set.id,
                            groupId: targetId,
                            amount: String(set.amount),
                            payerName: set.payerName,
                            payeeName: set.payeeName,
                            payerId: set.payerId,
                            payeeId: set.payeeId,
                            date: set.date,
                            method: set.method || 'cash',
                            notes: set.notes || '',
                          },
                        });
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.settlementGlyph}>
                        <Handshake size={20} color={THEME.colors.palette.emerald} />
                      </View>

                      <View style={styles.settlementLeftCol}>
                        <View style={styles.settlementTransferRow}>
                          <Text style={styles.settlementPartyName} numberOfLines={1}>
                            {payerText}
                          </Text>
                          <ArrowRight
                            size={13}
                            color={THEME.colors.textMuted}
                            style={styles.settlementArrowIcon}
                          />
                          <Text style={styles.settlementPartyName} numberOfLines={1}>
                            {payeeText}
                          </Text>
                        </View>

                        <Text style={styles.settlementSubtitle}>
                          Settlement • {set.date}
                        </Text>
                      </View>

                      <View style={styles.settlementAmountCol}>
                        <Text style={styles.settlementAmountText}>
                          {formatCurrency(Number(set.amount || 0), { decimals: 2 })}
                        </Text>
                        <Text style={styles.settlementStatusText}>SETTLED</Text>
                      </View>
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
  filterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  filterPillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: THEME.colors.textSecondary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  filterPillTextActive: {
    color: THEME.colors.text,
    fontWeight: '700',
  },
  settlementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 12,
  },
  settlementRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  settlementGlyph: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settlementLeftCol: {
    flex: 1,
  },
  settlementTransferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  settlementPartyName: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  settlementArrowIcon: {
    marginHorizontal: 1,
    alignSelf: 'center',
  },
  settlementSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  settlementAmountCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  settlementAmountText: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.palette.emerald,
    letterSpacing: -0.2,
  },
  settlementStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.colors.palette.emerald,
    opacity: 0.85,
    textTransform: 'uppercase',
    marginTop: 2,
  },
});
