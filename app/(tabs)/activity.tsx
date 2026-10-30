import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Receipt,
  Search,
  X,
  Handshake,
  SlidersHorizontal,
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
import { useAppTheme } from '../../src/contexts/theme.context';
import { ExpenseImpactCol } from '../../src/components/expenses/ExpenseImpactCol';
import { CategoryIcon } from '../../src/utils/category-icons';
import { haptics } from '../../src/services/haptics.service';
import { appEventEmitter } from '../../src/services/event-emitter';
import { TransactionRowSkeleton } from '../../src/components/skeletons/TransactionRowSkeleton';
import {
  ActivityFilterModal,
  ActivityExpenseRow,
  ActivitySettlementRow,
} from '../../src/components/activity';

export type ActivityEntry =
  | { type: 'expense'; id: string; date: string; rawDate: string; data: UserTransactionItem }
  | { type: 'settlement'; id: string; date: string; rawDate: string; data: GroupSettlementItem };

export default function ActivityScreen() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { formatCurrency } = useCurrency();
  const { currentAccent } = useAppTheme();

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
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'expenses' | 'settlements'>('all');
  const [groups, setGroups] = useState<GroupListItem[]>(() => groupService.getInMemoryGroups());
  const [roleFilter, setRoleFilter] = useState<'all' | 'paid_by_me' | 'split_with_me'>('all');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

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
    if (!authUser) {
      setExpenses([]);
      setSettlements([]);
      setLoading(false);
      return;
    }

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

  const lastFetchRef = useRef<number>(Date.now());
  // Screen focus: background SWR refresh when navigating to Activity screen
  useFocusEffect(
    useCallback(() => {
      if (!authUser) return;
      const now = Date.now();
      if (now - lastFetchRef.current < 2500) return;
      lastFetchRef.current = now;
      requestAnimationFrame(() => {
        loadData(true);
      });
    }, [authUser])
  );

  // Global event listener: auto re-fetch activity when any expense/settlement/group changes
  useEffect(() => {
    const unsubscribe = appEventEmitter.on('data-changed', (event) => {
      if (event?.type === 'auth_logout' || !authUser) {
        setExpenses([]);
        setSettlements([]);
        return;
      }
      loadData(true);
    });
    return unsubscribe;
  }, [authUser]);

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

  // Filter by search query and segmented filters
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

  // Count active applied filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (activeFilter !== 'all') count++;
    if (roleFilter !== 'all') count++;
    if (selectedGroupId !== 'all') count++;
    return count;
  }, [activeFilter, roleFilter, selectedGroupId]);

  const selectedGroupName = useMemo(() => {
    if (selectedGroupId === 'all') return '';
    return groups.find((g) => g.id === selectedGroupId)?.name || 'Circle';
  }, [groups, selectedGroupId]);

  const handleResetAllFilters = useCallback(() => {
    haptics.tick();
    setActiveFilter('all');
    setRoleFilter('all');
    setSelectedGroupId('all');
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* ── Top Header Section ── */}
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
        <Text style={styles.subtitle}>Recent transactions & settlements ledger</Text>
      </View>

      {/* ── Pinned Top Search Bar ── */}
      <View style={styles.searchBarWrapper}>
        <View
          style={[
            styles.searchBar,
            isSearchFocused && {
              borderColor: currentAccent.borderFocus,
              backgroundColor: THEME.colors.surfaceElevated,
            },
          ]}
        >
          <Search
            size={16}
            color={isSearchFocused ? currentAccent.primary : THEME.colors.textMuted}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search transactions, members, circles..."
            placeholderTextColor={THEME.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="never"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                haptics.tap();
                setSearchQuery('');
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Clear search text"
            >
              <X size={15} color={THEME.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Horizontal Scrollable Filter Strip with Filters Button ── */}
      <View style={styles.filterStripWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterStripScroll}
        >
          {/* 1. All Filters Popup Trigger Button */}
          <TouchableOpacity
            style={[
              styles.filtersTriggerBtn,
              activeFilterCount > 0 && [
                styles.filtersTriggerBtnActive,
                {
                  backgroundColor: currentAccent.primaryMuted,
                  borderColor: currentAccent.primary,
                },
              ],
            ]}
            onPress={() => {
              haptics.tap();
              setIsFilterModalOpen(true);
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Open filters popup"
          >
            <SlidersHorizontal
              size={13}
              color={
                activeFilterCount > 0
                  ? currentAccent.primary
                  : THEME.colors.textSecondary
              }
            />
            <Text
              style={[
                styles.filtersTriggerText,
                activeFilterCount > 0 && [
                  styles.filtersTriggerTextActive,
                  { color: currentAccent.primary },
                ],
              ]}
            >
              Filters
            </Text>
            {activeFilterCount > 0 && (
              <View
                style={[
                  styles.filterCountBadge,
                  { backgroundColor: currentAccent.primary },
                ]}
              >
                <Text style={styles.filterCountBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* 2. Applied Filter Pills (with 'X' in front to remove) */}
          {activeFilter !== 'all' && (
            <TouchableOpacity
              style={[
                styles.appliedPill,
                {
                  backgroundColor: currentAccent.primaryMuted,
                  borderColor: currentAccent.primary,
                },
              ]}
              onPress={() => {
                haptics.tap();
                setActiveFilter('all');
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${activeFilter} filter`}
            >
              <X size={12} color={currentAccent.primary} />
              <Text style={[styles.appliedPillText, { color: currentAccent.primary }]}>
                {activeFilter === 'expenses' ? 'Expenses' : 'Settlements'}
              </Text>
            </TouchableOpacity>
          )}

          {roleFilter !== 'all' && (
            <TouchableOpacity
              style={[
                styles.appliedPill,
                {
                  backgroundColor: currentAccent.primaryMuted,
                  borderColor: currentAccent.primary,
                },
              ]}
              onPress={() => {
                haptics.tap();
                setRoleFilter('all');
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${roleFilter === 'paid_by_me' ? 'Paid by me' : 'Split with me'} filter`}
            >
              <X size={12} color={currentAccent.primary} />
              <Text style={[styles.appliedPillText, { color: currentAccent.primary }]}>
                {roleFilter === 'paid_by_me' ? 'Paid by me' : 'Split with me'}
              </Text>
            </TouchableOpacity>
          )}

          {selectedGroupId !== 'all' && (
            <TouchableOpacity
              style={[
                styles.appliedPill,
                {
                  backgroundColor: currentAccent.primaryMuted,
                  borderColor: currentAccent.primary,
                },
              ]}
              onPress={() => {
                haptics.tap();
                setSelectedGroupId('all');
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${selectedGroupName} circle filter`}
            >
              <X size={12} color={currentAccent.primary} />
              <Text
                style={[styles.appliedPillText, { color: currentAccent.primary }]}
                numberOfLines={1}
              >
                {selectedGroupName}
              </Text>
            </TouchableOpacity>
          )}

          {searchQuery.trim().length > 0 && (
            <TouchableOpacity
              style={[
                styles.appliedPill,
                {
                  backgroundColor: currentAccent.primaryMuted,
                  borderColor: currentAccent.primary,
                },
              ]}
              onPress={() => {
                haptics.tap();
                setSearchQuery('');
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Clear search query"
            >
              <X size={12} color={currentAccent.primary} />
              <Text
                style={[styles.appliedPillText, { color: currentAccent.primary }]}
                numberOfLines={1}
              >
                "{searchQuery.trim()}"
              </Text>
            </TouchableOpacity>
          )}

          {/* Quick filter shortcut pills if not active */}
          {activeFilter === 'all' && (
            <>
              <TouchableOpacity
                style={styles.quickPill}
                onPress={() => {
                  haptics.tap();
                  setActiveFilter('expenses');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.quickPillText}>Expenses</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickPill}
                onPress={() => {
                  haptics.tap();
                  setActiveFilter('settlements');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.quickPillText}>Settlements</Text>
              </TouchableOpacity>
            </>
          )}

          {roleFilter === 'all' && (
            <>
              <TouchableOpacity
                style={styles.quickPill}
                onPress={() => {
                  haptics.tap();
                  setRoleFilter('paid_by_me');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.quickPillText}>Paid by me</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickPill}
                onPress={() => {
                  haptics.tap();
                  setRoleFilter('split_with_me');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.quickPillText}>Split with me</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Clear All action when multiple filters are active */}
          {activeFilterCount > 1 && (
            <TouchableOpacity
              style={styles.clearAllBtn}
              onPress={handleResetAllFilters}
              activeOpacity={0.7}
            >
              <Text style={styles.clearAllText}>Clear all</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* ── Main Activity Feed (Open Editorial No-Div Architecture) ── */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={currentAccent.primary}
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
          <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
            <TransactionRowSkeleton count={7} />
          </View>
        ) : groupedActivity.length > 0 ? (
          groupedActivity.map((group) => (
            <View key={group.month} style={styles.monthSection}>
              {/* Section Header Overline (Open Editorial Style) */}
              <View style={styles.monthHeaderRow}>
                <Text style={styles.monthTitleText}>{group.month.toUpperCase()}</Text>
                <Text style={styles.monthCountText}>
                  {group.items.length} {group.items.length === 1 ? 'record' : 'records'}
                </Text>
              </View>

              {/* Open Editorial List without Card Soup */}
              <View style={styles.openStreamContainer}>
                {group.items.map((entry, index) => {
                  const isLast = index === group.items.length - 1;

                  if (entry.type === 'expense') {
                    const tx = entry.data;
                    return (
                      <ActivityExpenseRow
                        key={entry.id}
                        expense={tx}
                        currentUserId={authUser?.id}
                        isLast={isLast}
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
                      />
                    );
                  }

                  // Settlement Entry
                  const stl = entry.data;
                  return (
                    <ActivitySettlementRow
                      key={entry.id}
                      settlement={stl}
                      currentUserId={authUser?.id}
                      isLast={isLast}
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
                    />
                  );
                })}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Receipt size={32} color={THEME.colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>
              {searchQuery || activeFilterCount > 0
                ? 'No matching records'
                : 'No activity yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery || activeFilterCount > 0
                ? 'Try adjusting your search query or removing active filters.'
                : 'Shared expenses and settlements will appear here automatically.'}
            </Text>

            {activeFilterCount > 0 && (
              <TouchableOpacity
                style={[
                  styles.clearFiltersBtn,
                  { borderColor: currentAccent.borderFocus },
                ]}
                onPress={handleResetAllFilters}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.clearFiltersBtnText,
                    { color: currentAccent.primary },
                  ]}
                >
                  Reset all filters
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Filters Bottom Sheet Modal ── */}
      <ActivityFilterModal
        visible={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        activeFilter={activeFilter}
        onSelectActiveFilter={setActiveFilter}
        roleFilter={roleFilter}
        onSelectRoleFilter={setRoleFilter}
        selectedGroupId={selectedGroupId}
        onSelectGroup={setSelectedGroupId}
        groups={groups}
        filteredCount={filteredActivity.length}
        onResetAll={handleResetAllFilters}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  searchBarWrapper: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.lg,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: THEME.colors.text,
    fontSize: 14,
    padding: 0,
    paddingVertical: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  filterStripWrapper: {
    marginBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.colors.hairline,
    paddingBottom: 6,
  },
  filterStripScroll: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  filtersTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  filtersTriggerBtnActive: {
    borderWidth: 1.5,
  },
  filtersTriggerText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  filtersTriggerTextActive: {
    fontWeight: '800',
  },
  filterCountBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  filterCountBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: THEME.colors.palette.white,
  },
  appliedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    borderWidth: 1.5,
  },
  appliedPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  quickPill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  quickPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  clearAllBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    textDecorationLine: 'underline',
  },
  listContent: {
    paddingBottom: 80,
  },
  loadingBox: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthSection: {
    marginTop: 10,
  },
  monthHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.hairline,
  },
  monthTitleText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
  },
  monthCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
  },
  openStreamContainer: {
    backgroundColor: THEME.colors.background,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 12,
  },
  activityRowBorder: {
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
  settleIconNode: {
    borderWidth: 1.5,
  },
  detailsCol: {
    flex: 1,
    marginRight: 10,
    gap: 2,
  },
  settleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  settledBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: THEME.radius.sm,
  },
  settledBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  settleAmountCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  settleAmountText: {
    fontSize: 15.5,
    fontWeight: '900',
  },
  settleSubText: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },
  clearFiltersBtn: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  clearFiltersBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
