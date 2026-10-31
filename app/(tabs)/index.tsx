import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  Plus,
  Sparkles,
  Bell,
  Handshake,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp,
  TrendingDown,
  Utensils,
  Car,
  ShoppingBag,
  Palmtree,
  Home,
  X,
  BarChart3,
  ScanLine,
  Search,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { groupService, GroupListItem } from '../../src/services/group.service';
import { authService, AuthUser } from '../../src/services/auth.service';
import { expenseService, UserTransactionItem } from '../../src/services/expense.service';
import { settlementService, GroupSettlementItem } from '../../src/services/settlement.service';
import { balanceService, UserBalanceSummary } from '../../src/services/balance.service';
import { demoService } from '../../src/services/demo.service';
import { storageService, STORAGE_KEYS } from '../../src/services/storage.service';
import { MockDataBanner } from '../../src/components/common/MockDataBanner';
import { QuantumLogo } from '../../src/components/brand/QuantumLogo';
import { ActivityExpenseRow, ActivitySettlementRow } from '../../src/components/activity';
import { BalanceHistoryGraph, BalanceHistoryGraphHandle } from '../../src/components/dashboard/BalanceHistoryGraph';
import { BalanceSkeleton } from '../../src/components/skeletons/BalanceSkeleton';
import { TransactionRowSkeleton } from '../../src/components/skeletons/TransactionRowSkeleton';
import { UniversalSearchModal } from '../../src/components/search/UniversalSearchModal';
import { useNetwork } from '../../src/contexts/network.context';
import { useAuth } from '../../src/contexts/auth.context';
import { useCurrency } from '../../src/contexts/currency.context';
import { useAppTheme } from '../../src/contexts/theme.context';
import { haptics } from '../../src/services/haptics.service';
import { appEventEmitter } from '../../src/services/event-emitter';
import { ObligationsModal } from '../../src/components/dashboard/ObligationsModal';
import { sortGroups, GroupSortOption } from '../../src/utils/group-sort';
import { notificationService } from '../../src/services/notification.service';
import { updateService, type UpdateInfo } from '../../src/services/update.service';
import { UpdateModal } from '../../src/components/common/UpdateModal';

interface HomeActivityEntry {
  type: 'expense' | 'settlement';
  id: string;
  date: string;
  rawDate: string;
  expenseData?: UserTransactionItem;
  settlementData?: GroupSettlementItem;
}

export default function HomeScreen() {
  const router = useRouter();
  const { isOnline, requireOnline } = useNetwork();
  const { user: authUser } = useAuth();
  const { formatCurrency, currencySymbol } = useCurrency();
  const { currentAccent } = useAppTheme();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => authUser || authService.getInMemoryUser());
  const [groups, setGroups] = useState<GroupListItem[]>(() => groupService.getInMemoryGroups());
  const [groupSortBy, setGroupSortBy] = useState<GroupSortOption>('last_usage');
  const [unreadNotificationCount, setUnreadNotificationCount] = useState<number>(() =>
    notificationService.getUnreadCount()
  );
  const [recentTransactions, setRecentTransactions] = useState<UserTransactionItem[]>(() => expenseService.getInMemoryUserExpenses());
  const [settlements, setSettlements] = useState<GroupSettlementItem[]>(() => []);
  const [balanceSummary, setBalanceSummary] = useState<UserBalanceSummary | null>(() => balanceService.getInMemoryUserBalanceSummary());
  const [obligationsType, setObligationsType] = useState<'owed' | 'owes' | null>(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const balanceGraphRef = useRef<BalanceHistoryGraphHandle>(null);
  const [isGraphActive, setIsGraphActive] = useState(false);
  const [isScrubbingGraph, setIsScrubbingGraph] = useState(false);
  const [loading, setLoading] = useState(() => {
    return (
      groupService.getInMemoryGroups().length === 0 &&
      expenseService.getInMemoryUserExpenses().length === 0 &&
      !balanceService.getInMemoryUserBalanceSummary()
    );
  });
  const [refreshing, setRefreshing] = useState(false);
  const [isDemoDismissed, setIsDemoDismissed] = useState(() => demoService.isDemoDismissedSync(currentUser?.id || authUser?.id));
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Background update check (reads from 4h cache or performs silent check)
  useEffect(() => {
    updateService
      .checkForUpdate(false)
      .then((info) => {
        if (info.available) {
          setUpdateInfo(info);
        }
      })
      .catch(() => {});
  }, []);

  // Surface interactive sample data indicator
  const isDemoActive =
    !isDemoDismissed &&
    !demoService.isDemoDismissedSync(currentUser?.id || authUser?.id) &&
    (groups.some((g) => g.id.startsWith('demo_')) || recentTransactions.some((t) => t.id.startsWith('demo_')));

  const handleDismissDemo = async () => {
    haptics.saveSuccess();
    const uid = currentUser?.id || authUser?.id || '';
    setIsDemoDismissed(true);
    await demoService.dismissDemoMode(uid);
    groupService.clearCache();
    expenseService.clearCache();
    balanceService.clearCache();
    await storageService.setItem(STORAGE_KEYS.GROUPS(uid), []);
    await storageService.setItem(STORAGE_KEYS.USER_TRANSACTIONS(uid), []);
    await storageService.setItem(STORAGE_KEYS.USER_SETTLEMENTS(uid), []);
    await storageService.setItem(STORAGE_KEYS.BALANCE_SUMMARY(uid), null);
    setGroups([]);
    setRecentTransactions([]);
    setSettlements([]);
    setBalanceSummary(null);
    await loadData(true);
  };

  const loadData = async (forceRefresh = false) => {
    try {
      const user = await authService.getCachedUser();
      setCurrentUser(user);
      const [groupList, txList, setList, summary] = await Promise.all([
        groupService.getUserGroups({ forceRefresh }),
        expenseService.getUserExpenses(20, { forceRefresh }),
        settlementService.getUserSettlements({ forceRefresh }),
        balanceService.getUserBalanceSummary({ forceRefresh }),
      ]);
      setGroups(groupList);
      setRecentTransactions(txList);
      setSettlements(setList || []);
      setBalanceSummary(summary);
    } catch {
      // Fallback gracefully
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refreshNotificationCount = useCallback(async () => {
    try {
      const count = await notificationService.fetchUnreadCount();
      setUnreadNotificationCount(count);
    } catch {
      // Safe fallback
    }
  }, []);

  useEffect(() => {
    if (!authUser) {
      setCurrentUser(null);
      setGroups([]);
      setRecentTransactions([]);
      setSettlements([]);
      setBalanceSummary(null);
      setUnreadNotificationCount(0);
      return;
    }

    if (authUser && !currentUser) setCurrentUser(authUser);
    const activeUid = authUser?.id || currentUser?.id || '';
    if (activeUid) {
      setIsDemoDismissed(demoService.isDemoDismissedSync(activeUid));
    }
    // 0ms Fast Tick: Hydrate immediately from persistent offline storage scoped to current user
    Promise.all([
      authService.getCachedUser(),
      groupService.getCachedUserGroups(activeUid),
      expenseService.getCachedUserExpenses(activeUid),
      settlementService.getUserSettlements(),
      balanceService.getCachedUserBalanceSummary(activeUid),
    ]).then(([cachedUser, cachedGroups, cachedTx, cachedSet, cachedSummary]) => {
      if (cachedUser) setCurrentUser(cachedUser);
      if (cachedGroups && cachedGroups.length > 0) setGroups(cachedGroups);
      if (cachedTx && cachedTx.length > 0) setRecentTransactions(cachedTx);
      if (cachedSet && cachedSet.length > 0) setSettlements(cachedSet);
      if (cachedSummary) setBalanceSummary(cachedSummary);
      if (
        (cachedGroups && cachedGroups.length > 0) ||
        (cachedTx && cachedTx.length > 0) ||
        (cachedSet && cachedSet.length > 0) ||
        cachedSummary
      ) {
        setLoading(false);
      }
    });

    storageService.getItem<GroupSortOption>(STORAGE_KEYS.GROUPS_SORT_PREFERENCE).then((saved) => {
      if (saved) setGroupSortBy(saved);
    });

    refreshNotificationCount();
    loadData(false);
  }, [authUser, refreshNotificationCount]);

  const lastFetchRef = useRef<number>(Date.now());

  // Screen focus: background SWR refresh when returning to HomeScreen from any modal/flow
  useFocusEffect(
    useCallback(() => {
      if (!authUser) return;
      storageService.getItem<GroupSortOption>(STORAGE_KEYS.GROUPS_SORT_PREFERENCE).then((saved) => {
        if (saved) setGroupSortBy(saved);
      });
      const now = Date.now();
      if (now - lastFetchRef.current < 2500) return;
      lastFetchRef.current = now;
      requestAnimationFrame(() => {
        refreshNotificationCount();
        loadData(true);
      });
    }, [authUser, refreshNotificationCount])
  );

  // Global event listener: automatic re-sync when expense, group, or settlement is added/changed
  useEffect(() => {
    const unsubscribe = appEventEmitter.on('data-changed', (event) => {
      if (event?.type === 'auth_logout' || !authUser) {
        setCurrentUser(null);
        setGroups([]);
        setRecentTransactions([]);
        setSettlements([]);
        setBalanceSummary(null);
        setUnreadNotificationCount(0);
        return;
      }
      if (event?.type === 'notifications_updated') {
        refreshNotificationCount();
        return;
      }
      storageService.getItem<GroupSortOption>(STORAGE_KEYS.GROUPS_SORT_PREFERENCE).then((saved) => {
        if (saved) setGroupSortBy(saved);
      });
      refreshNotificationCount();
      loadData(true);
    });
    return unsubscribe;
  }, [authUser, refreshNotificationCount]);

  const onRefresh = () => {
    haptics.tap();
    setRefreshing(true);
    loadData(true);
  };

  const handleAddExpense = () => {
    if (!requireOnline('create an expense')) return;
    haptics.tap();
    router.push('/expenses/new');
  };

  const handleSettleUp = () => {
    if (!requireOnline('record settlements')) return;
    haptics.tap();
    router.push('/settle/new');
  };

  // Compute aggregate numbers from real groups and P2P balance summary
  const totalOwed = balanceSummary?.totalOwed ?? groups.reduce((acc, g) => acc + (g.userNetBalance > 0 ? g.userNetBalance : 0), 0);
  const totalOwe = balanceSummary?.totalOwe ?? Math.abs(groups.reduce((acc, g) => acc + (g.userNetBalance < 0 ? g.userNetBalance : 0), 0));
  const netBalance = balanceSummary?.netBalance ?? (totalOwed - totalOwe);

  // Time-aware greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Sorted and filtered active groups for Home dashboard (max 5, matching Groups tab sort)
  const displayedHomeGroups = useMemo(() => {
    const active = groups.filter((g) => !g.archived);
    return sortGroups(active, groupSortBy).slice(0, 5);
  }, [groups, groupSortBy]);

  // Unified recent activities (Expenses & Settlements, last 10 entries)
  const recentActivities: HomeActivityEntry[] = useMemo(() => {
    const expEntries: HomeActivityEntry[] = recentTransactions.map((e) => ({
      type: 'expense',
      id: `exp_${e.id}`,
      date: e.date,
      rawDate: e.rawDate || e.date,
      expenseData: e,
    }));

    const setEntries: HomeActivityEntry[] = settlements.map((s) => ({
      type: 'settlement',
      id: `stl_${s.id}`,
      date: s.date,
      rawDate: s.rawDate || s.date,
      settlementData: s,
    }));

    const combined = [...expEntries, ...setEntries];
    combined.sort((a, b) => {
      const timeA = new Date(a.rawDate).getTime() || 0;
      const timeB = new Date(b.rawDate).getTime() || 0;
      return timeB - timeA;
    });

    return combined.slice(0, 10);
  }, [recentTransactions, settlements]);

  const totalActivityCount = recentTransactions.length + settlements.length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isScrubbingGraph}
        onScrollBeginDrag={() => balanceGraphRef.current?.deselect()}
        onStartShouldSetResponder={() => isGraphActive && !isScrubbingGraph}
        onResponderGrant={() => {
          if (isGraphActive && !isScrubbingGraph) balanceGraphRef.current?.deselect();
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={currentAccent.primary} />}
      >
        {/* Minimalist Header with Official Branding */}
        <View style={styles.header}>
          <View style={styles.brandHeaderLeft}>
            <QuantumLogo size={36} />
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.brandTitleText}>SplitIt</Text>
              <Text style={styles.greetingText}>
                {getGreeting()}, {currentUser?.name?.split(' ')[0] || 'Friend'}
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.iconCircle}
              activeOpacity={0.7}
              onPress={() => {
                haptics.tap();
                setShowSearchModal(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Search"
            >
              <Search size={17} color={THEME.colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconCircle}
              activeOpacity={0.7}
              onPress={() => {
                haptics.tap();
                router.push('/ai/chat');
              }}
              accessibilityRole="button"
              accessibilityLabel="AI Financial Assistant"
            >
              <Sparkles size={17} color={THEME.colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconCircle}
              activeOpacity={0.7}
              onPress={() => {
                haptics.tap();
                router.push('/analysis');
              }}
              accessibilityRole="button"
              accessibilityLabel="Personal Analytics"
            >
              <BarChart3 size={17} color={THEME.colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconCircle}
              activeOpacity={0.7}
              onPress={() => {
                haptics.tap();
                router.push('/notifications');
              }}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <Bell size={18} color={THEME.colors.text} />
              {unreadNotificationCount > 0 ? (
                <View style={[styles.bellDot, { backgroundColor: currentAccent.primary }]} />
              ) : null}
            </TouchableOpacity>
          </View>
        </View>

        {/* Interactive Startup Guide / Demo Mode Notice Banner */}
        {isDemoActive && (
          <MockDataBanner
            onRemove={handleDismissDemo}
            onCreateGroup={() => router.push('/groups/new')}
          />
        )}

        {/* In-App Release Update Alert Banner */}
        {updateInfo?.available && (
          <TouchableOpacity
            style={styles.updateBanner}
            onPress={() => {
              haptics.tap();
              setShowUpdateModal(true);
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Update available: version ${updateInfo.latestVersion}`}
          >
            <View style={styles.updateBannerIconWrap}>
              <Sparkles size={16} color={currentAccent.primary} />
            </View>
            <View style={styles.updateBannerTextCol}>
              <Text style={styles.updateBannerTitle}>
                SplitIt v{updateInfo.latestVersion} Available
              </Text>
              <Text style={styles.updateBannerSubtitle}>
                Tap to review changelog & install
              </Text>
            </View>
            <View style={[styles.updateBannerActionBtn, { backgroundColor: currentAccent.primary }]}>
              <Text style={styles.updateBannerActionText}>Update</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Modern Fintech Balance Widget with Dedicated Non-Overlapping Sparkline Track */}
        {loading && !balanceSummary ? (
          <BalanceSkeleton />
        ) : (
          <View style={styles.balanceWidget}>
            {/* TIER 1: Hero Metrics Header */}
            <TouchableOpacity
              style={styles.widgetHeader}
              activeOpacity={1}
              onPress={() => {
                if (isGraphActive) balanceGraphRef.current?.deselect();
              }}
            >
              <View style={styles.widgetEyebrowRow}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        netBalance > 0.01
                          ? THEME.colors.success
                          : netBalance < -0.01
                          ? THEME.colors.negative
                          : THEME.colors.textMuted,
                    },
                  ]}
                />
                <Text style={styles.widgetEyebrow}>TOTAL BALANCE</Text>

                {balanceSummary && Math.abs(balanceSummary.trendPercentage) > 0 && (
                  <View style={styles.widgetTrendInline}>
                    <Text style={styles.widgetTrendSeparator}>·</Text>
                    {balanceSummary.trendPercentage >= 0 ? (
                      <TrendingUp size={11} color={THEME.colors.success} />
                    ) : (
                      <TrendingDown size={11} color={THEME.colors.negative} />
                    )}
                    <Text
                      style={[
                        styles.widgetTrendText,
                        {
                          color:
                            balanceSummary.trendPercentage >= 0
                              ? THEME.colors.success
                              : THEME.colors.negative,
                        },
                      ]}
                    >
                      {Math.abs(balanceSummary.trendPercentage).toFixed(0)}% (30d)
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.widgetAmountBlock}>
                <Text
                  style={[
                    styles.widgetNumber,
                    netBalance > 0.01 && { color: THEME.colors.success },
                    netBalance < -0.01 && { color: THEME.colors.negative },
                  ]}
                >
                  {formatCurrency(netBalance, { showSign: true, decimals: 2 })}
                </Text>
                <Text style={styles.widgetSubtitle}>
                  {netBalance > 0.01
                    ? 'Overall you are owed money'
                    : netBalance < -0.01
                    ? 'Overall you owe money'
                    : 'All settled up • No outstanding balance'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* TIER 2: Dedicated In-Flow Sparkline Track (Zero Overlap Guaranteed!) */}
            {balanceSummary && (
              <View style={styles.graphTrack}>
                <BalanceHistoryGraph
                  ref={balanceGraphRef}
                  data={balanceSummary.chartData}
                  domain={balanceSummary.domain}
                  gradientOffset={balanceSummary.gradientOffset}
                  minBalance={balanceSummary.minBalance}
                  maxBalance={balanceSummary.maxBalance}
                  height={75}
                  hasNoBalance={
                    Math.abs(netBalance) < 0.01 &&
                    totalOwed < 0.01 &&
                    totalOwe < 0.01
                  }
                  onSelectPoint={(point) => setIsGraphActive(Boolean(point))}
                  onScrubbingChange={setIsScrubbingGraph}
                  onPress={() => {
                    haptics.tap();
                    router.push('/expenses/new');
                  }}
                />
              </View>
            )}

            {/* TIER 3: Interactive Stat Breakdown Footer with Obligations Drilldown */}
            <View style={styles.widgetFooter}>
              <TouchableOpacity
                style={styles.statColumn}
                activeOpacity={0.7}
                onPress={() => {
                  if (isGraphActive) {
                    balanceGraphRef.current?.deselect();
                    return;
                  }
                  haptics.tap();
                  setObligationsType('owed');
                }}
              >
                <View style={styles.statLabelRow}>
                  <ArrowDownLeft
                    size={12}
                    color={totalOwed > 0.009 ? THEME.colors.success : THEME.colors.textMuted}
                    strokeWidth={2.5}
                  />
                  <Text style={styles.statLabel}>Owed to you</Text>
                  <ChevronRight size={11} color={THEME.colors.textMuted} />
                </View>
                <Text
                  style={[
                    styles.statValue,
                    { color: totalOwed > 0.009 ? THEME.colors.success : THEME.colors.textMuted },
                  ]}
                >
                  {formatCurrency(totalOwed, { decimals: 2 })}
                </Text>
              </TouchableOpacity>

              <View style={styles.statDivider} />

              <TouchableOpacity
                style={styles.statColumn}
                activeOpacity={0.7}
                onPress={() => {
                  if (isGraphActive) {
                    balanceGraphRef.current?.deselect();
                    return;
                  }
                  haptics.tap();
                  setObligationsType('owes');
                }}
              >
                <View style={styles.statLabelRow}>
                  <ArrowUpRight
                    size={12}
                    color={totalOwe > 0.009 ? THEME.colors.negative : THEME.colors.textMuted}
                    strokeWidth={2.5}
                  />
                  <Text style={styles.statLabel}>You owe</Text>
                  <ChevronRight size={11} color={THEME.colors.textMuted} />
                </View>
                <Text
                  style={[
                    styles.statValue,
                    { color: totalOwe > 0.009 ? THEME.colors.negative : THEME.colors.textMuted },
                  ]}
                >
                  {formatCurrency(totalOwe, { decimals: 2 })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Tactile Action Dock */}
        <View style={styles.actionDock}>
          <TouchableOpacity
            style={[styles.primaryActionBtn, { backgroundColor: currentAccent.primary, shadowColor: currentAccent.primary }]}
            onPress={handleAddExpense}
            activeOpacity={0.85}
          >
            <Plus size={18} color={THEME.colors.primaryForeground} strokeWidth={2.5} />
            <Text style={styles.primaryActionText}>Add Expense</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryActionBtn}
            onPress={handleSettleUp}
            activeOpacity={0.85}
          >
            <Handshake size={18} color={THEME.colors.text} strokeWidth={2} />
            <Text style={styles.secondaryActionText}>Settle Up</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tertiaryActionBtn}
            onPress={() => {
              haptics.tap();
              router.push('/ai/scanner');
            }}
            activeOpacity={0.85}
          >
            <ScanLine size={18} color={THEME.colors.text} strokeWidth={2} />
            <Text style={styles.secondaryActionText}>Scan</Text>
          </TouchableOpacity>
        </View>

        {/* Active Groups Pebble Strip */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Groups</Text>
            <TouchableOpacity
              onPress={() => {
                haptics.tap();
                router.push('/(tabs)/groups');
              }}
              style={styles.seeAllBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.seeAllText}>See all</Text>
              <ChevronRight size={14} color={THEME.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pebblesScroll}>
            {displayedHomeGroups.length > 0 ? (
              displayedHomeGroups.map((group) => {
                const isOwed = group.userNetBalance > 0;
                const isOwe = group.userNetBalance < 0;

                return (
                  <TouchableOpacity
                    key={group.id}
                    style={styles.groupPebble}
                    activeOpacity={0.8}
                    onPress={() => {
                      haptics.tap();
                      router.push(`/groups/${group.id}`);
                    }}
                  >
                    <View style={styles.pebbleIconBox}>
                      {group.coverImageUrl ? (
                        <Image source={{ uri: group.coverImageUrl }} style={styles.pebbleCoverImage} />
                      ) : (
                        <View style={styles.pebbleInitialBox}>
                          <Text style={styles.pebbleInitialText}>{group.name.charAt(0)}</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.pebbleTitle} numberOfLines={1}>
                      {group.name}
                    </Text>

                    <Text
                      style={[
                        styles.pebbleBalance,
                        isOwed && { color: THEME.colors.success },
                        isOwe && { color: THEME.colors.negative },
                        !isOwed && !isOwe && { color: THEME.colors.textMuted },
                      ]}
                    >
                      {isOwed || isOwe
                        ? formatCurrency(group.userNetBalance, { showSign: true, decimals: 0 })
                        : 'Settled'}
                    </Text>
                  </TouchableOpacity>
                );
              })
            ) : (
              <TouchableOpacity
                style={styles.emptyGroupCard}
                activeOpacity={0.8}
                onPress={() => {
                  haptics.tap();
                  router.push('/groups/new');
                }}
              >
                <View style={styles.emptyGroupIconCircle}>
                  <Plus size={18} color={currentAccent.primary} />
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.emptyGroupTitle}>No groups yet</Text>
                  <Text style={styles.emptyGroupSubtitle}>Create a circle to start splitting</Text>
                </View>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* Recent Splits & Activities Ledger (Last 10 Activities) */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            {totalActivityCount > 10 && (
              <TouchableOpacity
                onPress={() => {
                  haptics.tap();
                  router.push('/(tabs)/activity');
                }}
                style={styles.seeAllBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.seeAllText}>View all</Text>
                <ChevronRight size={14} color={THEME.colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.ledgerStream}>
            {recentActivities.length > 0 ? (
              <>
                {recentActivities.map((item, index) => {
                  const isLast = index === recentActivities.length - 1;

                  if (item.type === 'expense' && item.expenseData) {
                    const tx = item.expenseData;
                    return (
                      <ActivityExpenseRow
                        key={item.id}
                        expense={tx}
                        currentUserId={currentUser?.id}
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
                              category: tx.category || '',
                            },
                          });
                        }}
                      />
                    );
                  }

                  if (item.type === 'settlement' && item.settlementData) {
                    const stl = item.settlementData;
                    return (
                      <ActivitySettlementRow
                        key={item.id}
                        settlement={stl}
                        currentUserId={currentUser?.id}
                        isLast={isLast}
                        onPress={() => {
                          haptics.tap();
                          router.push({
                            pathname: '/settlements/[id]',
                            params: {
                              id: stl.id,
                              groupId: stl.groupId,
                              amount: String(stl.amount),
                              payerName: stl.payerName,
                              payeeName: stl.payeeName,
                              date: stl.date,
                              method: stl.method || 'cash',
                              notes: stl.notes || '',
                            },
                          });
                        }}
                      />
                    );
                  }

                  return null;
                })}

                <TouchableOpacity
                  style={styles.viewAllActivityBtn}
                  onPress={() => {
                    haptics.tap();
                    router.push('/(tabs)/activity');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.viewAllActivityText, { color: currentAccent.primary }]}>View all activity</Text>
                  <ChevronRight size={14} color={currentAccent.primary} />
                </TouchableOpacity>
              </>
            ) : loading ? (
              <TransactionRowSkeleton count={5} />
            ) : (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Text style={{ color: THEME.colors.textMuted, fontSize: 13 }}>No recent transactions recorded yet</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {obligationsType && (
        <ObligationsModal
          visible={Boolean(obligationsType)}
          onClose={() => setObligationsType(null)}
          type={obligationsType}
          obligations={
            obligationsType === 'owed'
              ? balanceSummary?.obligations?.owedToYou || []
              : balanceSummary?.obligations?.youOwe || []
          }
          totalAmount={obligationsType === 'owed' ? totalOwed : totalOwe}
        />
      )}

      <UniversalSearchModal
        visible={showSearchModal}
        onClose={() => setShowSearchModal(false)}
      />

      <UpdateModal
        visible={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        updateInfo={updateInfo}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 16,
  },
  updateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.borderFocus,
    gap: 12,
  },
  updateBannerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: THEME.colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.border,
  },
  updateBannerTextCol: {
    flex: 1,
    gap: 2,
  },
  updateBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  updateBannerSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
  },
  updateBannerActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateBannerActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primaryForeground,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  brandHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitleText: {
    fontSize: 20,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -0.4,
  },
  greetingText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
    letterSpacing: 0.1,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.colors.aiMuted,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.24)',
  },
  aiPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.aiLight,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    position: 'relative',
  },
  bellDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.primary,
  },

  // Modern Fintech Balance Widget (Zero-Overlap 3-Tier Architecture)
  balanceWidget: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius['2xl'],
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    overflow: 'hidden',
    marginVertical: 4,
  },
  widgetHeader: {
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 2,
    gap: 8,
  },
  widgetEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  widgetEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: THEME.colors.textMuted,
  },
  widgetTrendInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  widgetTrendSeparator: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginHorizontal: 1,
  },
  widgetTrendText: {
    fontSize: 11,
    fontWeight: '700',
  },
  widgetAmountBlock: {
    paddingVertical: 2,
  },
  widgetNumber: {
    fontSize: 38,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -1.4,
    lineHeight: 44,
  },
  widgetSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
    marginTop: 3,
  },
  graphTrack: {
    height: 75,
    width: '100%',
    marginVertical: 4,
  },
  widgetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
    backgroundColor: THEME.colors.surfaceSubtle,
  },
  statColumn: {
    flex: 1,
    gap: 4,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statLabel: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: THEME.colors.hairline,
    marginHorizontal: 16,
  },

  // Action Dock
  actionDock: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryActionBtn: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    paddingVertical: 14,
    borderRadius: THEME.radius.lg,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.primaryForeground,
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.surfaceElevated,
    paddingVertical: 14,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.hairlineLight,
  },
  secondaryActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  tertiaryActionBtn: {
    flex: 0.8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.colors.surfaceElevated,
    paddingVertical: 14,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.hairlineLight,
  },

  // Sections
  sectionContainer: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.3,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },

  // Pebbles Horizontal Scroll
  pebblesScroll: {
    gap: 12,
    paddingRight: 8,
  },
  groupPebble: {
    width: 130,
    backgroundColor: THEME.colors.surface,
    padding: 12,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    gap: 8,
  },
  pebbleIconBox: {
    width: 44,
    height: 44,
    borderRadius: THEME.radius.md,
    overflow: 'hidden',
    backgroundColor: THEME.colors.surfaceElevated,
  },
  pebbleCoverImage: {
    width: '100%',
    height: '100%',
  },
  pebbleInitialBox: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surfaceElevated,
  },
  pebbleInitialText: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  pebbleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  pebbleBalance: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.textMuted,
  },

  // Ambient AI Insight Card
  aiInsightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: THEME.colors.aiSurface,
    padding: 14,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.aiBorder,
  },
  aiInsightIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.aiMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiInsightContent: {
    flex: 1,
  },
  aiInsightEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: THEME.colors.aiLight,
    marginBottom: 2,
  },
  aiInsightBody: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    lineHeight: 17,
  },

  // Ledger Stream
  ledgerStream: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    overflow: 'hidden',
  },
  viewAllActivityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
  },
  viewAllActivityText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  // Startup Guide Banner
  demoBanner: {
    backgroundColor: THEME.colors.successSubtle,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.successBorder,
    padding: 16,
    marginVertical: 8,
    gap: 12,
  },
  demoBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  demoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.successMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: THEME.colors.successBorder,
  },
  demoBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: THEME.colors.primary,
  },
  demoDismissIconBtn: {
    padding: 4,
  },
  demoBannerDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: THEME.colors.textSecondary,
    fontWeight: '400',
  },
  demoActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 2,
  },
  demoDismissBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoDismissBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  demoAddExpenseBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  demoAddExpenseBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primaryForeground,
  },

  // Empty Group Card
  emptyGroupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    borderRadius: THEME.radius.xl,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginRight: 12,
    width: 240,
  },
  emptyGroupIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.successMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.successBorder,
  },
  emptyGroupTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  emptyGroupSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
});