import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Receipt,
  Search,
  X,
  Handshake,
  ArrowRight,
  Filter,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { QuantumSpinner } from '../../src/components/brand/QuantumLogo';
import { expenseService, UserTransactionItem } from '../../src/services/expense.service';
import { settlementService, GroupSettlementItem } from '../../src/services/settlement.service';
import { groupService, GroupListItem } from '../../src/services/group.service';
import { balanceService } from '../../src/services/balance.service';
import { storageService, STORAGE_KEYS } from '../../src/services/storage.service';
import { demoService } from '../../src/services/demo.service';
import { MockDataBanner } from '../../src/components/common/MockDataBanner';
import { useAuth } from '../../src/contexts/auth.context';
import { useCurrency } from '../../src/contexts/currency.context';
import { ExpenseImpactCol } from '../../src/components/expenses/ExpenseImpactCol';
import { CategoryIcon } from '../../src/utils/category-icons';
import { haptics } from '../../src/services/haptics.service';
import { appEventEmitter } from '../../src/services/event-emitter';

export type ActivityEntry =
  | { type: 'expense'; id: string; date: string; rawDate: string; data: UserTransactionItem }
  | { type: 'settlement'; id: string; date: string; rawDate: string; data: GroupSettlementItem };

export default function ActivityScreen() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { formatCurrency } = useCurrency();

  const [expenses, setExpenses] = useState<UserTransactionItem[]>(() =>
    expenseService.getInMemoryUserExpenses()
  );
  const [settlements, setSettlements] = useState<GroupSettlementItem[]>([]);
  const [loading, setLoading] = useState(
    () => expenseService.getInMemoryUserExpenses().length === 0
  );
  const [refreshing, setRefreshing] = useState(false);
  const [isDemoDismissed, setIsDemoDismissed] = useState(() =>
    demoService.isDemoDismissedSync(authUser?.id)
  );

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'expenses' | 'settlements'>('all');
  const [groups, setGroups] = useState<GroupListItem[]>(() => groupService.getInMemoryGroups());
  const [roleFilter, setRoleFilter] = useState<'all' | 'paid_by_me' | 'split_with_me'>('all');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');

  const isDemoActive =
    !isDemoDismissed &&
    !demoService.isDemoDismissedSync(authUser?.id) &&
    expenses.some((t) => t.id.startsWith('demo_'));

  const handleDismissDemo = async () => {
    haptics.saveSuccess();
    const uid = authUser?.id || '';
    setIsDemoDismissed(true);
    await demoService.dismissDemoMode(uid);
    groupService.clearCache();
    expenseService.clearCache();
    balanceService.clearCache();
    await storageService.setItem(STORAGE_KEYS.GROUPS(uid), []);
    await storageService.setItem(STORAGE_KEYS.USER_TRANSACTIONS(uid), []);
    await storageService.setItem(STORAGE_KEYS.USER_SETTLEMENTS(uid), []);
    await storageService.setItem(STORAGE_KEYS.BALANCE_SUMMARY(uid), null);
    setExpenses([]);
    setSettlements([]);
    await loadData(true);
  };

  const loadData = async (forceRefresh = false) => {
    try {
      const [expData, setttData, grpData] = await Promise.all([
        expenseService.getUserExpenses(50, { forceRefresh }),
        settlementService.getUserSettlements({ forceRefresh }),
        groupService.getUserGroups({ forceRefresh }),
      ]);
      setExpenses(expData || []);
      setSettlements(setttData || []);
      setGroups(grpData || []);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const uid = authUser?.id || '';
    if (uid) {
      setIsDemoDismissed(demoService.isDemoDismissedSync(uid));
    }
    expenseService.getCachedUserExpenses(uid).then((cached) => {
      if (cached && cached.length > 0) {
        setExpenses(cached);
        setLoading(false);
      }
    });
    settlementService.getUserSettlements().then((cachedSet) => {
      if (cachedSet && cachedSet.length > 0) {
        setSettlements(cachedSet);
      }
    });
    loadData(false);
  }, [authUser]);

  // Screen focus: background refresh when navigating to Activity screen
  useFocusEffect(
    useCallback(() => {
      loadData(false);
    }, [])
  );

  // Global event listener: auto re-fetch activity when any expense/settlement/group changes
  useEffect(() => {
    const unsubscribe = appEventEmitter.on('data-changed', () => {
      loadData(true);
    });
    return unsubscribe;
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    haptics.tap();
    loadData(true);
  };

  // Combine and sort unified activity feed
  const unifiedActivity: ActivityEntry[] = useMemo(() => {
    const expEntries: ActivityEntry[] = expenses.map((e) => ({
      type: 'expense' as const,
      id: `exp_${e.id}`,
      date: e.date,
      rawDate: e.rawDate || e.date,
      data: e,
    }));

    const setEntries: ActivityEntry[] = settlements.map((s) => ({
      type: 'settlement' as const,
      id: `stl_${s.id}`,
      date: s.date,
      rawDate: s.rawDate || s.date,
      data: s,
    }));

    const combined = [...expEntries, ...setEntries];
    return combined.sort((a, b) => {
      const timeA = new Date(a.rawDate).getTime() || 0;
      const timeB = new Date(b.rawDate).getTime() || 0;
      return timeB - timeA;
    });
  }, [expenses, settlements]);

  // Filter by search query and segmented filter
  const filteredActivity = useMemo(() => {
    let result = unifiedActivity;

    if (activeFilter === 'expenses') {
      result = result.filter((item) => item.type === 'expense');
    } else if (activeFilter === 'settlements') {
      result = result.filter((item) => item.type === 'settlement');
    }

    if (selectedGroupId !== 'all') {
      result = result.filter((item) => item.data.groupId === selectedGroupId);
    }

    const currentUserId = authUser?.id || '';
    if (roleFilter === 'paid_by_me') {
      result = result.filter((item) => {
        if (item.type === 'expense') {
          return item.data.yourImpact === 'get' || item.data.paidByName === 'You';
        }
        return item.data.payerId === currentUserId || item.data.payerName === 'You';
      });
    } else if (roleFilter === 'split_with_me') {
      result = result.filter((item) => {
        if (item.type === 'expense') {
          return item.data.yourImpact === 'owe';
        }
        return item.data.payeeId === currentUserId || item.data.payeeName === 'You';
      });
    }

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((item) => {
        if (item.type === 'expense') {
          const exp = item.data;
          const title = (exp.title || '').toLowerCase();
          const payer = (exp.paidByName || '').toLowerCase();
          const grp = (exp.groupName || '').toLowerCase();
          const cat = (exp.category || '').toLowerCase();
          const amt = String(exp.amount || '');
          return (
            title.includes(query) ||
            payer.includes(query) ||
            grp.includes(query) ||
            cat.includes(query) ||
            amt.includes(query)
          );
        } else {
          const stl = item.data;
          const payer = (stl.payerName || '').toLowerCase();
          const payee = (stl.payeeName || '').toLowerCase();
          const grp = (stl.groupName || '').toLowerCase();
          const notes = (stl.notes || '').toLowerCase();
          const amt = String(stl.amount || '');
          return (
            payer.includes(query) ||
            payee.includes(query) ||
            grp.includes(query) ||
            notes.includes(query) ||
            amt.includes(query) ||
            'settlement'.includes(query)
          );
        }
      });
    }

    return result;
  }, [unifiedActivity, activeFilter, searchQuery, selectedGroupId, roleFilter, authUser?.id]);

  // Group by Month & Year (e.g., "October 2026")
  const groupedActivity = useMemo(() => {
    const groupsMap = new Map<string, ActivityEntry[]>();

    filteredActivity.forEach((entry) => {
      const parsedDate = new Date(entry.rawDate);
      let monthLabel = 'Recent';
      if (!isNaN(parsedDate.getTime())) {
        monthLabel = parsedDate.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        });
      }

      if (!groupsMap.has(monthLabel)) {
        groupsMap.set(monthLabel, []);
      }
      groupsMap.get(monthLabel)!.push(entry);
    });

    return Array.from(groupsMap.entries()).map(([month, items]) => ({
      month,
      items,
    }));
  }, [filteredActivity]);

  const expenseCount = useMemo(
    () => unifiedActivity.filter((i) => i.type === 'expense').length,
    [unifiedActivity]
  );
  const settlementCount = useMemo(
    () => unifiedActivity.filter((i) => i.type === 'settlement').length,
    [unifiedActivity]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
        <Text style={styles.subtitle}>Recent transactions & settlements ledger</Text>
      </View>

      {/* Sleek Search Bar */}
      <View style={styles.searchBarWrapper}>
        <View style={styles.searchBar}>
          <Search size={15} color={THEME.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search activity..."
            placeholderTextColor={THEME.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            returnKeyType="search"
            numberOfLines={1}
            multiline={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                haptics.tap();
                setSearchQuery('');
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={15} color={THEME.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Compact Combined Segmented Filter Track (Right-Aligned) */}
      <View style={styles.filterPillsRow}>
        <View style={styles.segmentedTrack}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeFilter === 'all' && styles.segmentBtnActive]}
            activeOpacity={0.7}
            onPress={() => {
              haptics.tap();
              setActiveFilter('all');
            }}
          >
            <Text
              style={[styles.segmentText, activeFilter === 'all' && styles.segmentTextActive]}
            >
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeFilter === 'expenses' && styles.segmentBtnActive]}
            activeOpacity={0.7}
            onPress={() => {
              haptics.tap();
              setActiveFilter('expenses');
            }}
          >
            <Text
              style={[
                styles.segmentText,
                activeFilter === 'expenses' && styles.segmentTextActive,
              ]}
            >
              Expenses
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeFilter === 'settlements' && styles.segmentBtnActive]}
            activeOpacity={0.7}
            onPress={() => {
              haptics.tap();
              setActiveFilter('settlements');
            }}
          >
            <Text
              style={[
                styles.segmentText,
                activeFilter === 'settlements' && styles.segmentTextActive,
              ]}
            >
              Settlements
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Secondary Multi-Facet Filter (Roles & Circles) */}
      <View style={styles.subFilterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subFilterScroll}
        >
          <TouchableOpacity
            style={[styles.subPill, roleFilter === 'all' && styles.subPillActive]}
            onPress={() => {
              haptics.tick();
              setRoleFilter('all');
            }}
          >
            <Text style={[styles.subPillText, roleFilter === 'all' && styles.subPillTextActive]}>
              All Roles
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.subPill, roleFilter === 'paid_by_me' && styles.subPillActive]}
            onPress={() => {
              haptics.tick();
              setRoleFilter('paid_by_me');
            }}
          >
            <Text style={[styles.subPillText, roleFilter === 'paid_by_me' && styles.subPillTextActive]}>
              Paid by me
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.subPill, roleFilter === 'split_with_me' && styles.subPillActive]}
            onPress={() => {
              haptics.tick();
              setRoleFilter('split_with_me');
            }}
          >
            <Text style={[styles.subPillText, roleFilter === 'split_with_me' && styles.subPillTextActive]}>
              Split with me
            </Text>
          </TouchableOpacity>

          {groups.length > 0 && <View style={styles.pillDivider} />}

          {groups.length > 0 && (
            <TouchableOpacity
              style={[styles.subPill, selectedGroupId === 'all' && styles.subPillActive]}
              onPress={() => {
                haptics.tick();
                setSelectedGroupId('all');
              }}
            >
              <Text style={[styles.subPillText, selectedGroupId === 'all' && styles.subPillTextActive]}>
                All Circles
              </Text>
            </TouchableOpacity>
          )}

          {groups.map((g) => (
            <TouchableOpacity
              key={g.id}
              style={[styles.subPill, selectedGroupId === g.id && styles.subPillActive]}
              onPress={() => {
                haptics.tick();
                setSelectedGroupId(selectedGroupId === g.id ? 'all' : g.id);
              }}
            >
              <Text
                style={[styles.subPillText, selectedGroupId === g.id && styles.subPillTextActive]}
                numberOfLines={1}
              >
                {g.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={THEME.colors.primary}
          />
        }
      >
        {isDemoActive && (
          <MockDataBanner
            onRemove={handleDismissDemo}
            onCreateGroup={() => {
              haptics.tap();
              router.push('/groups/new');
            }}
          />
        )}

        {loading && unifiedActivity.length === 0 ? (
          <View style={styles.loadingBox}>
            <QuantumSpinner size={28} color={THEME.colors.primary} />
          </View>
        ) : groupedActivity.length > 0 ? (
          groupedActivity.map((group) => (
            <View key={group.month} style={styles.sectionWrap}>
              <Text style={styles.sectionTitle}>{group.month}</Text>
              <View style={styles.ledgerCard}>
                {group.items.map((entry, index) => {
                  const isLast = index === group.items.length - 1;

                  if (entry.type === 'expense') {
                    const tx = entry.data;
                    const isGet = tx.yourImpact === 'get';
                    const isOwe = tx.yourImpact === 'owe';

                    return (
                      <TouchableOpacity
                        key={entry.id}
                        style={[styles.ledgerRow, !isLast && styles.ledgerRowBorder]}
                        activeOpacity={0.7}
                        onPress={() => {
                          haptics.tap();
                          router.push({
                            pathname: '/expenses/[id]',
                            params: {
                              id: tx.id,
                              groupId: tx.groupId,
                              title: tx.title,
                              amount: String(tx.amount),
                              paidByName: tx.paidByName,
                              date: tx.date,
                              category: tx.category,
                            },
                          });
                        }}
                      >
                        <View style={styles.iconCircle}>
                          <CategoryIcon
                            subCategory={tx.category}
                            masterCategory={tx.masterCategory}
                            size={18}
                            color={
                              isGet
                                ? THEME.colors.primary
                                : isOwe
                                ? THEME.colors.negative
                                : THEME.colors.textSecondary
                            }
                          />
                        </View>

                        <View style={styles.details}>
                          <Text style={styles.activityTitle} numberOfLines={1}>
                            {tx.title}
                          </Text>
                          <Text style={styles.activitySubtitle} numberOfLines={1}>
                            {tx.paidByName} • {tx.groupName}
                          </Text>
                          <Text style={styles.activityTime}>{tx.date}</Text>
                        </View>

                        <ExpenseImpactCol expense={tx} currentUserId={authUser?.id} />
                      </TouchableOpacity>
                    );
                  }

                  // Settlement Entry
                  const stl = entry.data;
                  return (
                    <TouchableOpacity
                      key={entry.id}
                      style={[styles.ledgerRow, !isLast && styles.ledgerRowBorder]}
                      activeOpacity={0.7}
                      onPress={() => {
                        haptics.tap();
                        router.push({
                          pathname: '/settlements/[id]',
                          params: {
                            id: stl.id,
                            groupId: stl.groupId,
                          },
                        });
                      }}
                    >
                      <View style={[styles.iconCircle, styles.settleIconCircle]}>
                        <Handshake size={18} color={THEME.colors.primary} />
                      </View>

                      <View style={styles.details}>
                        <View style={styles.settleTitleRow}>
                          <Text style={styles.activityTitle} numberOfLines={1}>
                            Payment Recorded
                          </Text>
                          <View style={styles.settledBadge}>
                            <Text style={styles.settledBadgeText}>Settled</Text>
                          </View>
                        </View>
                        <Text style={styles.activitySubtitle} numberOfLines={1}>
                          {stl.payerName} paid {stl.payeeName}
                          {stl.groupName ? ` • ${stl.groupName}` : ''}
                        </Text>
                        <Text style={styles.activityTime}>{stl.date}</Text>
                      </View>

                      <View style={styles.amountCol}>
                        <Text style={styles.settleAmountText}>
                          {formatCurrency(stl.amount, { decimals: 2 })}
                        </Text>
                        <Text style={styles.settleSub}>via {stl.method || 'UPI'}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Receipt size={32} color={THEME.colors.textMuted} />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No matching records' : 'No activity yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Try searching for a different keyword or member.'
                : 'Shared expenses and settlements will appear here automatically.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  searchBarWrapper: {
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: THEME.colors.text,
    fontSize: 13,
    padding: 0,
    paddingVertical: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  filterPillsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  segmentedTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 20,
    padding: 2.5,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  segmentBtn: {
    paddingHorizontal: 11,
    paddingVertical: 4.5,
    borderRadius: 16,
  },
  segmentBtnActive: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  segmentText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: THEME.colors.primary,
    fontWeight: '700',
  },
  subFilterRow: {
    marginBottom: 12,
  },
  subFilterScroll: {
    paddingHorizontal: 16,
    gap: 6,
    alignItems: 'center',
  },
  subPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  subPillActive: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderColor: THEME.colors.info,
  },
  subPillText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },
  subPillTextActive: {
    color: THEME.colors.info,
    fontWeight: '700',
  },
  pillDivider: {
    width: 1,
    height: 16,
    backgroundColor: THEME.colors.hairline,
    marginHorizontal: 4,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 36,
  },
  loadingBox: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  sectionWrap: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  ledgerCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    overflow: 'hidden',
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  ledgerRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  settleIconCircle: {
    backgroundColor: 'rgba(52, 211, 153, 0.08)',
    borderColor: 'rgba(52, 211, 153, 0.25)',
  },
  details: {
    flex: 1,
    marginRight: 10,
  },
  settleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  settledBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  settledBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  activitySubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  activityTime: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  amountCol: {
    alignItems: 'flex-end',
  },
  settleAmountText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  settleSub: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  emptyContainer: {
    paddingVertical: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.text,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
});
