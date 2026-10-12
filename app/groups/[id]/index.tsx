import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Dimensions,
  LayoutChangeEvent,
  Switch,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  Settings,
  Plus,
  Search,
  Zap,
  Utensils,
  Sparkles,
  Receipt,
  Bot,
  Handshake,
  CheckCircle2,
  Calendar,
  ArrowRight,
  ArrowLeftRight,
} from 'lucide-react-native';
import { THEME } from '../../../src/constants/theme';
import { groupService, GroupDetailData, GroupExpense } from '../../../src/services/group.service';
import { GroupSettlementItem } from '../../../src/services/settlement.service';
import { useAuth } from '../../../src/contexts/auth.context';
import { BudgetPacingRing } from '../../../src/components/budget/BudgetPacingRing';
import { ExpenseImpactCol } from '../../../src/components/expenses/ExpenseImpactCol';
import { CategoryIcon } from '../../../src/utils/category-icons';
import { TransactionRowSkeleton } from '../../../src/components/skeletons/TransactionRowSkeleton';
import {
  ExpensesTabSkeleton,
  BalancesTabSkeleton,
  BudgetTabSkeleton,
} from '../../../src/components/skeletons/GroupTabSkeleton';
import { GroupHistoryTab } from '../../../src/components/groups/GroupHistoryTab';
import * as Haptics from 'expo-haptics';

const TABS = ['expenses', 'balances', 'budget', 'activity'] as const;
type TabType = typeof TABS[number];

const TAB_LABELS: Record<TabType, string> = {
  expenses: 'Activity',
  balances: 'Balances',
  budget: 'Budget',
  activity: 'Logs',
};

const PAGE_SIZE = 15;

type GroupActivityStreamItem =
  | { type: 'expense'; id: string; date: string; rawDate: string; data: GroupExpense }
  | { type: 'settlement'; id: string; date: string; rawDate: string; data: GroupSettlementItem };

function getTimelineTimestamp(rawDate?: string, dateStr?: string): number {
  if (rawDate) {
    const parsed = new Date(rawDate).getTime();
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  if (dateStr) {
    const lower = dateStr.toLowerCase().trim();
    if (lower.startsWith('today')) {
      const now = new Date();
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

export default function GroupDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const targetId = Array.isArray(id) ? id[0] : (id || '1');

  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, 24);

  const HEADER_MIN_HEIGHT = topInset + 54;
  const HEADER_MAX_HEIGHT = topInset + 180;
  const SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

  const { user } = useAuth();
  const currentUserId = user?.id || 'u1';
  const [group, setGroup] = useState<GroupDetailData | null>(() => groupService.getInMemoryGroupDetail(targetId));
  const [activeTab, setActiveTab] = useState<TabType>('expenses');
  const [visitedTabs, setVisitedTabs] = useState<Record<TabType, boolean>>({
    expenses: true,
    balances: false,
    budget: false,
    activity: false,
  });
  const [isSimplified, setIsSimplified] = useState(false);
  const [loading, setLoading] = useState(!group);
  const [refreshing, setRefreshing] = useState(false);
  const [statStripHeight, setStatStripHeight] = useState(58);

  // Progressive infinite scroll for expense and activity records
  const [visibleExpenseCount, setVisibleExpenseCount] = useState(PAGE_SIZE);
  const [isLoadingMoreExpenses, setIsLoadingMoreExpenses] = useState(false);
  const [visibleActivityCount, setVisibleActivityCount] = useState(PAGE_SIZE);
  const [isLoadingMoreActivities, setIsLoadingMoreActivities] = useState(false);

  const initialTabBarWidth = Dimensions.get('window').width - 20;
  const [tabBarWidth, setTabBarWidth] = useState(initialTabBarWidth);

  const scrollViewRef = useRef<any>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Smooth Tab Transitions
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;
  const tabContentAnim = useRef(new Animated.Value(1)).current;
  const fabAnim = useRef(new Animated.Value(1)).current;
  const fabPressAnim = useRef(new Animated.Value(0)).current;
  const fabButtonRef = useRef<any>(null);
  const fabCoordsRef = useRef({
    x: Dimensions.get('window').width - 46,
    y: Dimensions.get('window').height - 64,
  });

  const stickyThreshold = SCROLL_DISTANCE + statStripHeight;

  const scrollToTop = () => {
    if (scrollViewRef.current?.scrollTo) {
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
  };

  const loadGroup = async () => {
    try {
      const data = await groupService.getGroupDetails(targetId);
      if (data) {
        setGroup(data);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // 0ms instant sync if in-memory cache has this targetId
    const inMem = groupService.getInMemoryGroupDetail(targetId);
    if (inMem) {
      setGroup(inMem);
      setLoading(false);
    } else {
      setGroup(null);
      setLoading(true);
    }

    setVisitedTabs({
      expenses: true,
      balances: false,
      budget: false,
      activity: false,
    });
    setActiveTab('expenses');
    tabIndicatorAnim.setValue(0);
    tabContentAnim.setValue(1);
    setVisibleExpenseCount(PAGE_SIZE);
    setVisibleActivityCount(PAGE_SIZE);

    // 0ms fast tick: hydrate from persistent offline storage
    groupService.getCachedGroupDetails(targetId).then((cached) => {
      if (cached) {
        setGroup(cached);
        setLoading(false);
      }
    });
    loadGroup();
  }, [targetId]);

  const onRefresh = () => {
    setRefreshing(true);
    setVisibleExpenseCount(PAGE_SIZE);
    setVisibleActivityCount(PAGE_SIZE);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadGroup();
  };

  const handleTabChange = (tab: TabType) => {
    if (tab === activeTab) return;
    Haptics.selectionAsync();
    const tabIndex = TABS.indexOf(tab);

    // 1. Snappy native spring sliding indicator pill
    Animated.spring(tabIndicatorAnim, {
      toValue: tabIndex,
      useNativeDriver: true,
      damping: 26,
      stiffness: 340,
      mass: 0.6,
    }).start();

    // 2. Snappy micro-transition: reset to 0.4 and animate to 1
    // The previous tab is immediately hidden via display: 'none', preventing any ghosting of the old tab
    tabContentAnim.setValue(0.4);
    Animated.timing(tabContentAnim, {
      toValue: 1,
      duration: 140,
      useNativeDriver: true,
    }).start();

    // 3. Fast spring scale & fade for Add Expense FAB
    Animated.spring(fabAnim, {
      toValue: tab === 'expenses' ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 80,
    }).start();

    setVisitedTabs((prev) => (prev[tab] ? prev : { ...prev, [tab]: true }));
    setActiveTab(tab);
  };

  const onFabLayout = () => {
    fabButtonRef.current?.measureInWindow?.((x: number, y: number, width: number, height: number) => {
      if (width > 0 && height > 0) {
        fabCoordsRef.current = {
          x: x + width / 2,
          y: y + height / 2,
        };
      }
    });
  };

  const handleAddExpense = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Spring trigger on FAB: slight scale pulse & 45deg rotation
    Animated.spring(fabPressAnim, {
      toValue: 1,
      tension: 100,
      friction: 6,
      useNativeDriver: true,
    }).start();

    const targetId = Array.isArray(id) ? id[0] : (id || '');
    router.push({
      pathname: '/expenses/new',
      params: {
        groupId: targetId,
        origin: 'fab',
        fabX: Math.round(fabCoordsRef.current.x).toString(),
        fabY: Math.round(fabCoordsRef.current.y).toString(),
      },
    });
  };

  useFocusEffect(
    useCallback(() => {
      // Smoothly reset FAB press animation when returning
      Animated.spring(fabPressAnim, {
        toValue: 0,
        tension: 80,
        friction: 7,
        useNativeDriver: true,
      }).start();
      loadGroup();
    }, [targetId])
  );

  const onTabBarLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && Math.abs(w - tabBarWidth) > 1) {
      setTabBarWidth(w);
    }
  };

  const renderTabBar = () => {
    const innerWidth = Math.max(0, tabBarWidth - 6);
    const singleTabWidth = innerWidth > 0 ? innerWidth / 4 : 0;

    return (
      <View
        style={styles.segmentedTabBar}
        onLayout={onTabBarLayout}
      >
        {/* Smooth Sliding Pill Indicator (pointerEvents="none" prevents blocking taps) */}
        {singleTabWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.activeTabPill,
              {
                width: singleTabWidth,
                transform: [
                  {
                    translateX: tabIndicatorAnim.interpolate({
                      inputRange: [0, 1, 2, 3],
                      outputRange: [0, singleTabWidth, singleTabWidth * 2, singleTabWidth * 3],
                    }),
                  },
                ],
              },
            ]}
          />
        )}

        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={styles.tabButton}
            onPress={() => handleTabChange(tab)}
            delayPressIn={0}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.tabTextActive,
              ]}
            >
              {TAB_LABELS[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const expenses = group?.expenses || [];
  const members = useMemo(() => group?.members || [], [group?.members]);
  const simplifiedDebts = useMemo(() => group?.simplifiedDebts || [], [group?.simplifiedDebts]);

  const everythingIsSettled = useMemo(
    () => members.length > 0 && members.every((m) => Math.abs(m.netBalance || 0) < 0.01),
    [members]
  );

  const sortedBalances = useMemo(() => {
    return [...members].sort((a, b) => {
      const getStatus = (balance: number) => {
        if (balance > 0.01) return 0; // Owed / Gets back
        if (balance < -0.01) return 2; // Owes
        return 1; // Settled
      };

      const statusA = getStatus(a.netBalance || 0);
      const statusB = getStatus(b.netBalance || 0);

      if (statusA !== statusB) {
        return statusA - statusB;
      }

      if (statusA === 0) {
        return (b.netBalance || 0) - (a.netBalance || 0);
      }
      if (statusA === 2) {
        return (a.netBalance || 0) - (b.netBalance || 0);
      }

      return (a.name || '').localeCompare(b.name || '');
    });
  }, [members]);

  const getMemberDisplayName = useCallback(
    (memberId: string, rawName: string) => {
      const isViewer = memberId === currentUserId;
      if (isViewer) {
        if (user?.name && user.name !== 'You' && user.name !== 'undefined') {
          return user.name;
        }
      }
      return rawName && rawName !== 'undefined' ? rawName : 'Member';
    },
    [currentUserId, user?.name]
  );
  const budget = group?.budget || {
    enabled: false,
    totalMonthlyLimit: 0,
    totalSpent: 0,
    currency: 'INR',
    daysRemaining: 10,
    safeDailyAllowance: 0,
    categories: [],
  };
  const activities = group?.activities || [];
  const totalGroupSpend = group?.totalGroupSpend || 0;
  const yourNetBalance = group?.yourNetBalance || 0;

  const activityStream: GroupActivityStreamItem[] = useMemo(() => {
    const expItems: GroupActivityStreamItem[] = (group?.expenses || []).map((e) => ({
      type: 'expense' as const,
      id: `exp_${e.id}`,
      date: e.date,
      rawDate: e.rawDate || (e as any).rawDate || e.date,
      data: e,
    }));

    const setItems: GroupActivityStreamItem[] = (group?.settlements || []).map((s) => ({
      type: 'settlement' as const,
      id: `stl_${s.id}`,
      date: s.date,
      rawDate: s.rawDate || s.date,
      data: s,
    }));

    const combined = [...expItems, ...setItems];
    return combined.sort((a, b) => {
      const timeA = getTimelineTimestamp(a.rawDate, a.date);
      const timeB = getTimelineTimestamp(b.rawDate, b.date);
      if (timeA !== timeB) {
        return timeB - timeA;
      }
      return b.id.localeCompare(a.id);
    });
  }, [group?.expenses, group?.settlements]);

  // Progressive infinite scroll data & loader (Called unconditionally before any early returns)
  const visibleActivities = useMemo(
    () => activityStream.slice(0, visibleExpenseCount),
    [activityStream, visibleExpenseCount]
  );

  const loadMoreExpenses = useCallback(() => {
    if (isLoadingMoreExpenses || visibleExpenseCount >= activityStream.length) return;
    setIsLoadingMoreExpenses(true);
    setTimeout(() => {
      setVisibleExpenseCount((prev) => Math.min(activityStream.length, prev + PAGE_SIZE));
      setIsLoadingMoreExpenses(false);
    }, 180);
  }, [isLoadingMoreExpenses, visibleExpenseCount, activityStream.length]);

  const loadMoreActivities = useCallback(() => {
    const totalActivities = group?.history?.length || 0;
    if (isLoadingMoreActivities || visibleActivityCount >= totalActivities) return;
    setIsLoadingMoreActivities(true);
    setTimeout(() => {
      setVisibleActivityCount((prev) => Math.min(totalActivities, prev + PAGE_SIZE));
      setIsLoadingMoreActivities(false);
    }, 180);
  }, [isLoadingMoreActivities, visibleActivityCount, group?.history?.length]);

  const handleScroll = useCallback(
    (event: any) => {
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      if (
        contentSize.height > 0 &&
        layoutMeasurement.height + contentOffset.y >= contentSize.height - 350
      ) {
        if (activeTab === 'expenses') {
          loadMoreExpenses();
        } else if (activeTab === 'activity') {
          loadMoreActivities();
        }
      }
    },
    [activeTab, loadMoreExpenses, loadMoreActivities]
  );

  // Header Animations (100% Native Driver Hardware Accelerated)
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, SCROLL_DISTANCE],
    outputRange: [0, -SCROLL_DISTANCE],
    extrapolate: 'clamp',
  });

  const imageScale = scrollY.interpolate({
    inputRange: [-150, 0],
    outputRange: [1.3, 1],
    extrapolateRight: 'clamp',
  });

  const imageTranslateY = scrollY.interpolate({
    inputRange: [-150, 0, SCROLL_DISTANCE],
    outputRange: [-75, 0, SCROLL_DISTANCE * 0.5],
    extrapolate: 'clamp',
  });

  const vignetteOpacity = scrollY.interpolate({
    inputRange: [0, SCROLL_DISTANCE],
    outputRange: [0.48, 0.82],
    extrapolate: 'clamp',
  });

  const collapsedTitleOpacity = scrollY.interpolate({
    inputRange: [SCROLL_DISTANCE * 0.5, SCROLL_DISTANCE],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const collapsedTitleTranslateY = scrollY.interpolate({
    inputRange: [0, SCROLL_DISTANCE * 0.5, SCROLL_DISTANCE],
    outputRange: [-30, -30, 0],
    extrapolate: 'clamp',
  });

  const expandedContentOpacity = scrollY.interpolate({
    inputRange: [0, SCROLL_DISTANCE * 0.55],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const expandedContentTranslateY = scrollY.interpolate({
    inputRange: [0, SCROLL_DISTANCE * 0.55, SCROLL_DISTANCE],
    outputRange: [0, -20, -300],
    extrapolate: 'clamp',
  });

  // Seamless docking handoff for fixed tab bar (activates at exact threshold alignment)
  const stickyTabOpacity = scrollY.interpolate({
    inputRange: [Math.max(0, stickyThreshold - 8), stickyThreshold],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const stickyTabTranslateY = scrollY.interpolate({
    inputRange: [0, Math.max(0, stickyThreshold - 1), stickyThreshold],
    outputRange: [-200, -200, 0],
    extrapolate: 'clamp',
  });

  if (!group) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
          <Text style={styles.loadingText}>Loading circle...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <StatusBar style="light" />

      {/* Scrollable Content Stream (Rendered first so floating overlays sit on top of touch hierarchy) */}
      <Animated.ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            useNativeDriver: true,
            listener: handleScroll,
          }
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={THEME.colors.primary}
            progressViewOffset={HEADER_MAX_HEIGHT}
          />
        }
      >
        {/* Spacer for Collapsing Header */}
        <View style={{ height: HEADER_MAX_HEIGHT }} />

        {/* Minimalist 4-Stat Strip (Clean Typographic Row, No Rigid Box) */}
        <View
          style={styles.statStrip}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h && Math.abs(h - statStripHeight) > 1) {
              setStatStripHeight(h);
            }
          }}
        >
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>SPENT</Text>
            <Text style={styles.statValue}>₹{totalGroupSpend.toLocaleString('en-IN')}</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCol}>
            <Text style={styles.statLabel}>YOUR NET</Text>
            <Text
              style={[
                styles.statValue,
                { color: yourNetBalance >= 0 ? THEME.colors.primary : THEME.colors.negative },
              ]}
            >
              {yourNetBalance >= 0 ? `+₹${yourNetBalance}` : `-₹${Math.abs(yourNetBalance)}`}
            </Text>
          </View>

          <View style={styles.statDivider} />

          <TouchableOpacity
            style={styles.statCol}
            onPress={() => handleTabChange('budget')}
            activeOpacity={0.7}
          >
            <Text style={styles.statLabel}>BUDGET</Text>
            <Text
              style={[
                styles.statValue,
                { color: budget.enabled ? THEME.colors.primaryLight : THEME.colors.textMuted },
              ]}
            >
              {budget.enabled && budget.totalMonthlyLimit > 0
                ? `${Math.round(((budget.totalSpent || 0) / budget.totalMonthlyLimit) * 100)}%`
                : '+ Set'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* In-Flow Native Tab Bar (Scrolls with 100% native lockstep with stat strip & content — zero lag) */}
        <View style={styles.tabBarInFlowContainer}>
          {renderTabBar()}
        </View>

        {/* Smooth Animated Tab Content Stream */}
        <Animated.View
          style={[
            styles.tabSectionWrapper,
            {
              opacity: tabContentAnim,
              transform: [
                {
                  translateY: tabContentAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [6, 0],
                  }),
                },
              ],
            },
          ]}
        >
        {/* TAB 1: EXPENSES & SETTLEMENTS (ACTIVITY STREAM) */}
        {visitedTabs.expenses && (
          <View style={[styles.tabSection, activeTab !== 'expenses' && styles.tabHidden]}>
            {loading && activityStream.length === 0 ? (
              <ExpensesTabSkeleton count={4} />
            ) : (
              <View style={styles.ledgerStream}>
                {activityStream.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Receipt size={32} color={THEME.colors.textMuted} />
                    <Text style={styles.emptyTitle}>No activity recorded</Text>
                    <Text style={styles.emptySubtitle}>
                      Tap "+ Add" to record your first expense or settlement in this group!
                    </Text>
                  </View>
                ) : (
                  <>
                    {visibleActivities.map((entry, index) => {
                      const isLast =
                        index === visibleActivities.length - 1 &&
                        visibleExpenseCount >= activityStream.length &&
                        !isLoadingMoreExpenses;

                      if (entry.type === 'expense') {
                        const exp = entry.data;
                        return (
                          <TouchableOpacity
                            key={entry.id}
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
                                size={16}
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

                      // Settlement row: no front icon, person -> person amount, "You" if viewer
                      const set = entry.data;
                      const isPayerViewer = set.payerId === currentUserId || set.payerName === 'You';
                      const isPayeeViewer = set.payeeId === currentUserId || set.payeeName === 'You';
                      const payerText = isPayerViewer ? 'You' : set.payerName;
                      const payeeText = isPayeeViewer ? 'You' : set.payeeName;

                      return (
                        <TouchableOpacity
                          key={entry.id}
                          style={[styles.settlementRow, !isLast && styles.settlementRowBorder]}
                          onPress={() => {
                            Haptics.selectionAsync();
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
                          <View style={styles.settlementLeftCol}>
                            <View style={styles.settlementTransferRow}>
                              <Text
                                style={[
                                  styles.settlementPartyName,
                                  isPayerViewer && styles.settlementViewerHighlight,
                                ]}
                                numberOfLines={1}
                              >
                                {payerText}
                              </Text>
                              <ArrowRight size={13} color={THEME.colors.textMuted} style={styles.settlementArrowIcon} />
                              <Text
                                style={[
                                  styles.settlementPartyName,
                                  isPayeeViewer && styles.settlementViewerHighlight,
                                ]}
                                numberOfLines={1}
                              >
                                {payeeText}
                              </Text>
                            </View>

                            <Text style={styles.settlementSubtitle}>
                              Settlement • {set.date}
                            </Text>
                          </View>

                          <View style={styles.settlementAmountCol}>
                            <Text style={styles.settlementAmountText}>
                              ₹{Number(set.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Text>
                            <Text style={styles.settlementStatusText}>Settled</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}

                    {/* Progressive Loading Shimmer Indicator */}
                    {isLoadingMoreExpenses && (
                      <View style={styles.progressiveLoaderContainer}>
                        <TransactionRowSkeleton count={2} />
                      </View>
                    )}

                    {/* End of list completion footer */}
                    {activityStream.length > PAGE_SIZE &&
                      visibleExpenseCount >= activityStream.length &&
                      !isLoadingMoreExpenses && (
                        <View style={styles.endOfListFooter}>
                          <Text style={styles.endOfListText}>
                            • All {activityStream.length} activities loaded •
                          </Text>
                        </View>
                      )}
                  </>
                )}
              </View>
            )}
          </View>
        )}

        {/* TAB 2: BALANCES & SIMPLIFIED DEBTS */}
        {visitedTabs.balances && (
          <View style={[styles.tabSection, activeTab !== 'balances' && styles.tabHidden]}>
            {loading && members.length === 0 ? (
              <BalancesTabSkeleton />
            ) : (
              <>
                {/* 1. Header with Switch (matches website) */}
                <View style={styles.balancesHeaderRow}>
                  <View style={styles.balancesTitleRow}>
                    <ArrowLeftRight size={17} color={THEME.colors.primary} />
                    <Text style={styles.balancesSectionTitle}>Group Balances</Text>
                  </View>
                  {!everythingIsSettled && members.length > 0 && (
                    <View style={styles.switchRow}>
                      <Text style={styles.switchLabel}>Simplify Debts</Text>
                      <Switch
                        value={isSimplified}
                        onValueChange={(val) => {
                          Haptics.selectionAsync();
                          setIsSimplified(val);
                        }}
                        trackColor={{
                          false: 'rgba(255, 255, 255, 0.12)',
                          true: THEME.colors.primary,
                        }}
                        thumbColor={THEME.colors.palette.white}
                        style={styles.switchControl}
                      />
                    </View>
                  )}
                </View>

                {/* 2. Empty or Settled States */}
                {members.length === 0 ? (
                  <View style={styles.settledStateContainer}>
                    <Handshake size={32} color={THEME.colors.primary} />
                    <Text style={styles.settledTitle}>No balances to show</Text>
                    <Text style={styles.settledSubtitle}>Add expenses to track balances between members.</Text>
                  </View>
                ) : everythingIsSettled ? (
                  <View style={styles.settledStateContainer}>
                    <View style={styles.settledIconWrap}>
                      <CheckCircle2 size={36} color={THEME.colors.success} />
                    </View>
                    <Text style={styles.settledTitle}>All debts are settled!</Text>
                    <Text style={styles.settledSubtitle}>Everyone is balanced in this group.</Text>
                  </View>
                ) : isSimplified ? (
                  /* 3. SIMPLIFIED DEBTS FORM (Website-style simplified settlement plan) */
                  <View style={styles.simplifiedPlanList}>
                    {simplifiedDebts.length === 0 ? (
                      <View style={styles.settledStateContainer}>
                        <View style={styles.settledIconWrap}>
                          <CheckCircle2 size={36} color={THEME.colors.success} />
                        </View>
                        <Text style={styles.settledTitle}>All debts are settled!</Text>
                        <Text style={styles.settledSubtitle}>Everyone is balanced in this group.</Text>
                      </View>
                    ) : (
                      simplifiedDebts.map((debt, index) => {
                        const fromMember = members.find((m) => m.id === debt.fromUserId);
                        const toMember = members.find((m) => m.id === debt.toUserId);
                        const isFromViewer = debt.fromUserId === currentUserId;
                        const isToViewer = debt.toUserId === currentUserId;
                        const fromDisplayName = getMemberDisplayName(debt.fromUserId, debt.fromName);
                        const toDisplayName = getMemberDisplayName(debt.toUserId, debt.toName);
                        const fromAvatar = fromMember?.avatarUrl;
                        const toAvatar = toMember?.avatarUrl;

                        return (
                          <View key={index} style={styles.simplifiedTransferCard}>
                            <View style={styles.transferFlowRow}>
                              {/* Debtor (From) */}
                              <View style={styles.transferPartyCol}>
                                <View style={styles.balanceAvatar}>
                                  {fromAvatar ? (
                                    <Image source={{ uri: fromAvatar }} style={styles.avatarImg} />
                                  ) : (
                                    <Text style={styles.balanceAvatarInitial}>
                                      {(fromDisplayName || 'M').charAt(0).toUpperCase()}
                                    </Text>
                                  )}
                                </View>
                                <View style={styles.transferNameBadge}>
                                  <Text style={styles.transferNameText} numberOfLines={1}>
                                    {fromDisplayName}
                                  </Text>
                                  {isFromViewer && (
                                    <View style={styles.youBadge}>
                                      <Text style={styles.youBadgeText}>YOU</Text>
                                    </View>
                                  )}
                                </View>
                              </View>

                              {/* Center Arrow & Amount */}
                              <View style={styles.transferCenterCol}>
                                <Text style={styles.transferCenterAmount}>
                                  ₹{debt.amount.toFixed(2)}
                                </Text>
                                <View style={styles.transferArrowPill}>
                                  <ArrowRight size={13} color={THEME.colors.primary} />
                                </View>
                              </View>

                              {/* Creditor (To) */}
                              <View style={[styles.transferPartyCol, styles.transferPartyColRight]}>
                                <View style={[styles.transferNameBadge, styles.transferNameBadgeRight]}>
                                  <Text style={styles.transferNameText} numberOfLines={1}>
                                    {toDisplayName}
                                  </Text>
                                  {isToViewer && (
                                    <View style={styles.youBadge}>
                                      <Text style={styles.youBadgeText}>YOU</Text>
                                    </View>
                                  )}
                                </View>
                                <View style={styles.balanceAvatar}>
                                  {toAvatar ? (
                                    <Image source={{ uri: toAvatar }} style={styles.avatarImg} />
                                  ) : (
                                    <Text style={styles.balanceAvatarInitial}>
                                      {(toDisplayName || 'M').charAt(0).toUpperCase()}
                                    </Text>
                                  )}
                                </View>
                              </View>

                              {/* Settle Action */}
                              <TouchableOpacity
                                style={styles.settleButton}
                                activeOpacity={0.8}
                                onPress={() => {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  router.push({
                                    pathname: '/settle/new',
                                    params: {
                                      groupId: group?.id || targetId,
                                      debtorId: debt.fromUserId,
                                      debtorName: fromDisplayName,
                                      creditorId: debt.toUserId,
                                      creditorName: toDisplayName,
                                      amount: debt.amount.toString(),
                                      upiId: toMember?.upiId || 'rohit@okhdfc',
                                    },
                                  });
                                }}
                              >
                                <Zap size={11} color={THEME.colors.primaryForeground} strokeWidth={2.5} />
                                <Text style={styles.settleButtonText}>Settle</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                ) : (
                  /* 4. NORMAL FORM (Individual member net balances) */
                  <View style={styles.normalBalancesList}>
                    {sortedBalances.map((m, index) => {
                      const isLast = index === sortedBalances.length - 1;
                      const isViewer = m.id === currentUserId;
                      const displayName = getMemberDisplayName(m.id, m.name);
                      const isOwed = (m.netBalance || 0) > 0.01;
                      const isDebtor = (m.netBalance || 0) < -0.01;
                      const isSettled = !isOwed && !isDebtor;

                      return (
                        <View
                          key={m.id || index}
                          style={[styles.balanceMemberRow, !isLast && styles.balanceMemberRowBorder]}
                        >
                          <View style={styles.balanceMemberLeft}>
                            <View style={styles.balanceAvatar}>
                              {m.avatarUrl ? (
                                <Image source={{ uri: m.avatarUrl }} style={styles.avatarImg} />
                              ) : (
                                <Text style={styles.balanceAvatarInitial}>
                                  {(displayName || 'M').charAt(0).toUpperCase()}
                                </Text>
                              )}
                            </View>

                            <View style={styles.balanceMemberNameWrap}>
                              <Text
                                style={[
                                  styles.balanceMemberName,
                                  isViewer && styles.balanceMemberNameUser,
                                ]}
                                numberOfLines={1}
                              >
                                {displayName}
                              </Text>
                              {isViewer && (
                                <View style={styles.youBadge}>
                                  <Text style={styles.youBadgeText}>YOU</Text>
                                </View>
                              )}
                            </View>
                          </View>

                          <View style={styles.balanceRightCol}>
                            {isOwed && (
                              <Text style={styles.balanceOwedText}>
                                is owed ₹{(m.netBalance || 0).toFixed(2)}
                              </Text>
                            )}
                            {isDebtor && (
                              <Text style={styles.balanceDebtorText}>
                                owes ₹{Math.abs(m.netBalance || 0).toFixed(2)}
                              </Text>
                            )}
                            {isSettled && (
                              <Text style={styles.balanceSettledText}>
                                settled up
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* TAB 3: BUDGET & PACING */}
        {visitedTabs.budget && (
          <View style={[styles.tabSection, activeTab !== 'budget' && styles.tabHidden]}>
            {loading && !budget.totalMonthlyLimit && budget.totalSpent === 0 ? (
              <BudgetTabSkeleton />
            ) : (
              <>
                <View style={styles.budgetCard}>
                  <BudgetPacingRing
                    totalSpent={budget.totalSpent || 0}
                    totalLimit={budget.totalMonthlyLimit || 0}
                    daysRemaining={budget.daysRemaining || 0}
                    safeDailyAllowance={budget.safeDailyAllowance || 0}
                  />
                </View>

                {/* Category Allocations */}
                <View style={styles.categoryAllocationsCard}>
                  <Text style={styles.sectionHeaderTitle}>CATEGORY BREAKDOWN</Text>
                  {(budget.categories || []).length === 0 ? (
                    <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, color: THEME.colors.textMuted }}>No category limits configured</Text>
                    </View>
                  ) : (
                    budget.categories.map((cat, idx) => {
                      const limit = cat.limit || 1;
                      const spent = cat.spent || 0;
                      const percent = Math.min(100, Math.round((spent / limit) * 100));
                      return (
                        <View key={idx} style={styles.catRow}>
                          <View style={styles.catLabelRow}>
                            <Text style={styles.catName}>{cat.name}</Text>
                            <Text style={styles.catNumbers}>
                              ₹{spent.toLocaleString()} / ₹{limit.toLocaleString()} ({percent}%)
                            </Text>
                          </View>
                          <View style={styles.catBarBackground}>
                            <View style={[styles.catBarFill, { width: `${percent}%`, backgroundColor: cat.color || THEME.colors.primary }]} />
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              </>
            )}
          </View>
        )}

        {/* TAB 4: ACTIVITY AUDIT FEED */}
        {visitedTabs.activity && (
          <View style={[styles.tabSection, activeTab !== 'activity' && styles.tabHidden]}>
            <GroupHistoryTab
              groupId={targetId}
              history={group?.history}
              loading={loading && (!group?.history || group.history.length === 0)}
              visibleCount={visibleActivityCount}
              isLoadingMore={isLoadingMoreActivities}
              onLoadMore={loadMoreActivities}
              onRefresh={loadGroup}
              onViewExpense={(expenseId) => {
                router.push({
                  pathname: '/expenses/[id]',
                  params: { id: expenseId, groupId: targetId },
                });
              }}
            />
          </View>
        )}
        </Animated.View>
      </Animated.ScrollView>

      {/* Cinematic Collapsing Header (Hardware accelerated native driver) */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.collapsingHeader,
          {
            height: HEADER_MAX_HEIGHT,
            paddingTop: topInset,
            transform: [{ translateY: headerTranslateY }],
          },
        ]}
      >
        <Animated.Image
          source={{
            uri:
              group.coverImageUrl ||
              'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1200&auto=format&fit=crop',
          }}
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [{ scale: imageScale }, { translateY: imageTranslateY }],
            },
          ]}
          resizeMode="cover"
        />
        <Animated.View style={[styles.heroVignette, { opacity: vignetteOpacity }]} />

        {/* Hero Expanded Title & Floating Actions */}
        <Animated.View
          style={[
            styles.heroBottomBar,
            {
              opacity: expandedContentOpacity,
              transform: [{ translateY: expandedContentTranslateY }],
            },
          ]}
        >
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.heroGroupTitle} numberOfLines={1}>
              {group.name}
            </Text>
            {group.description ? (
              <Text style={styles.heroGroupDescription} numberOfLines={1}>
                {group.description}
              </Text>
            ) : null}
          </View>

          <View style={styles.heroActionButtons}>
            <TouchableOpacity
              style={styles.heroAddBtn}
              onPress={handleAddExpense}
              activeOpacity={0.85}
            >
              <Plus size={14} color={THEME.colors.primaryForeground} strokeWidth={2.5} />
              <Text style={styles.heroAddBtnText}>Add</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.heroSettleBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({
                  pathname: '/settle/new',
                  params: { groupId: group.id, defaultDebtorId: 'u2', defaultCreditorId: 'u1' },
                });
              }}
              activeOpacity={0.85}
            >
              <Handshake size={14} color={THEME.colors.text} />
              <Text style={styles.heroSettleBtnText}>Settle</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Floating Glass Top Bar (Pinned at topInset, sits above collapsingHeader) */}
      <View style={[styles.heroTopBarFixed, { top: topInset }]}>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          style={styles.heroGlassBtn}
          activeOpacity={0.8}
        >
          <ArrowLeft size={18} color={THEME.colors.text} />
        </TouchableOpacity>

        {/* Left-Aligned Collapsed Title */}
        <Animated.View
          style={[
            styles.collapsedTitleWrap,
            {
              opacity: collapsedTitleOpacity,
              transform: [{ translateY: collapsedTitleTranslateY }],
            },
          ]}
        >
          <TouchableOpacity onPress={scrollToTop} activeOpacity={0.7} style={styles.collapsedTitleTouch}>
            <Text style={styles.collapsedTitleText} numberOfLines={1}>
              {group.name}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.heroTopBarActions}>
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              const targetId = Array.isArray(id) ? id[0] : (id || group.id);
              router.push(`/groups/${targetId}/search`);
            }}
            style={styles.heroGlassBtn}
            activeOpacity={0.8}
          >
            <Search size={17} color={THEME.colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({
                pathname: '/ai/chat',
                params: { groupId: group.id, groupName: group.name },
              });
            }}
            style={[styles.heroGlassBtn, { backgroundColor: 'rgba(139, 92, 246, 0.45)' }]}
            activeOpacity={0.8}
          >
            <Sparkles size={16} color={THEME.colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              router.push(`/groups/${id}/settings`);
            }}
            style={styles.heroGlassBtn}
            activeOpacity={0.8}
          >
            <Settings size={18} color={THEME.colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Fixed Docked Tab Bar (Pinned flush at HEADER_MIN_HEIGHT when scrolled past threshold) */}
      <Animated.View
        style={[
          styles.fixedTabBarContainer,
          {
            top: HEADER_MIN_HEIGHT,
            opacity: stickyTabOpacity,
            transform: [{ translateY: stickyTabTranslateY }],
          },
        ]}
      >
        {renderTabBar()}
      </Animated.View>

      {/* Floating Add Expense Action Button (Smooth spring fade & scale + app-launch burst) */}
      <Animated.View
        pointerEvents={activeTab === 'expenses' ? 'auto' : 'none'}
        style={[
          styles.fabContainer,
          {
            opacity: fabAnim,
            transform: [{ scale: fabAnim }],
          },
        ]}
      >
        {/* Expanding emerald pulse aura on tap */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.fabPulseRing,
            {
              transform: [
                {
                  scale: fabPressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 2.2],
                  }),
                },
              ],
              opacity: fabPressAnim.interpolate({
                inputRange: [0, 0.2, 1],
                outputRange: [0, 0.45, 0],
              }),
            },
          ]}
        />
        <TouchableOpacity
          ref={fabButtonRef}
          onLayout={onFabLayout}
          style={styles.fab}
          onPress={handleAddExpense}
          activeOpacity={0.85}
        >
          <Animated.View
            style={{
              transform: [
                {
                  rotate: fabPressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '45deg'],
                  }),
                },
                {
                  scale: fabPressAnim.interpolate({
                    inputRange: [0, 0.4, 1],
                    outputRange: [1, 0.88, 1.05],
                  }),
                },
              ],
            }}
          >
            <Plus size={22} color={THEME.colors.primaryForeground} strokeWidth={2.5} />
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textMuted,
    letterSpacing: 0.3,
  },

  // Collapsing Hero Header
  collapsingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 8,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: THEME.colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
  },
  heroVignette: {
    ...StyleSheet.absoluteFill,
    backgroundColor: THEME.colors.palette.black,
  },
  heroTopBarFixed: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 110,
    elevation: 10,
  },
  heroTopBar: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  collapsedTitleWrap: {
    flex: 1,
    paddingLeft: 10,
    paddingRight: 8,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  collapsedTitleTouch: {
    maxWidth: '100%',
    alignSelf: 'flex-start',
  },
  collapsedTitleText: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.2,
    textAlign: 'left',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroTopBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroGlassBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.60)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    zIndex: 10,
  },
  heroGroupTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -0.4,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroGroupDescription: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: THEME.radius.lg,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  heroAddBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.primaryForeground,
  },
  heroSettleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: THEME.radius.lg,
  },
  heroSettleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.text,
  },

  // Minimalist Stat Strip (Borderless Typographic Row)
  statStrip: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statDivider: {
    width: 1,
    height: 18,
    backgroundColor: THEME.colors.hairlineLight,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: THEME.colors.textMuted,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '900',
    color: THEME.colors.text,
  },

  // In-Flow & Fixed Docked Tab Bar (100% Identical Styling & Sub-pixel Alignment)
  tabBarInFlowContainer: {
    backgroundColor: THEME.colors.background,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 10,
  },
  fixedTabBarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 90,
    elevation: 6,
    backgroundColor: THEME.colors.background,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 10,
    shadowColor: THEME.colors.palette.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  segmentedTabBar: {
    position: 'relative',
    flexDirection: 'row',
    backgroundColor: THEME.colors.surface,
    padding: 3,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  activeTabPill: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairlineLight,
    shadowColor: THEME.colors.palette.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
    zIndex: 1,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: THEME.radius.md,
    zIndex: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  tabTextActive: {
    color: THEME.colors.text,
    fontWeight: '700',
  },

  // Tab Content Stream
  tabSectionWrapper: {
    width: '100%',
    paddingHorizontal: 10,
  },

  // Content Scroll
  scrollContent: {
    paddingBottom: 100,
  },
  tabSection: {
    gap: 14,
  },
  tabHidden: {
    display: 'none',
  },

  // Ledger Stream
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
    paddingVertical: 14,
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
  },
  ledgerExpenseTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  ledgerExpenseSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  ledgerImpactCol: {
    alignItems: 'flex-end',
  },
  ledgerImpactAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  ledgerImpactLabel: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },

  // Settlement Activity Row
  settlementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    minHeight: 58,
  },
  settlementRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  settlementLeftCol: {
    flex: 1,
    marginRight: 12,
  },
  settlementTransferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 3,
  },
  settlementPartyName: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
    letterSpacing: -0.2,
  },
  settlementViewerHighlight: {
    color: THEME.colors.primary,
  },
  settlementArrowIcon: {
    marginHorizontal: 1,
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
    letterSpacing: 0.4,
  },

  // Balances Tab & Redesigned Header
  balancesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 2,
    marginBottom: 2,
  },
  balancesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balancesSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.text,
    letterSpacing: -0.2,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  switchControl: {
    transform: Platform.OS === 'ios' ? [{ scaleX: 0.82 }, { scaleY: 0.82 }] : [],
  },

  // Normal Balances List (No-div Minimalist Layout)
  normalBalancesList: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  balanceMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  balanceMemberRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.07)',
  },
  balanceMemberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  balanceAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  balanceAvatarInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  balanceMemberNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  balanceMemberName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  balanceMemberNameUser: {
    fontWeight: '700',
  },
  youBadge: {
    backgroundColor: 'rgba(28, 194, 159, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  youBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.primary,
    letterSpacing: 0.5,
  },
  balanceRightCol: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  balanceOwedText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.success,
  },
  balanceDebtorText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.negative,
  },
  balanceSettledText: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.textMuted,
  },

  // Simplified Settlement Plan
  simplifiedPlanList: {
    gap: 8,
  },
  simplifiedTransferCard: {
    backgroundColor: THEME.colors.surface,
    padding: 12,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  transferFlowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  transferPartyCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  transferPartyColRight: {
    justifyContent: 'flex-end',
  },
  transferNameBadge: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  transferNameBadgeRight: {
    justifyContent: 'flex-end',
  },
  transferNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  transferCenterCol: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    minWidth: 62,
  },
  transferCenterAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.text,
    marginBottom: 2,
  },
  transferArrowPill: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  settleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: THEME.radius.md,
    marginLeft: 4,
  },
  settleButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.primaryForeground,
  },

  // Empty / Settled States
  settledStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    gap: 6,
  },
  settledIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  settledTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.text,
    textAlign: 'center',
  },
  settledSubtitle: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    textAlign: 'center',
  },

  // Budget Tab
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: THEME.colors.textMuted,
    marginBottom: 4,
  },
  budgetCard: {
    backgroundColor: THEME.colors.surface,
    padding: 20,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  categoryAllocationsCard: {
    backgroundColor: THEME.colors.surface,
    padding: 16,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    gap: 12,
  },
  catRow: {
    gap: 6,
  },
  catLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  catName: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  catNumbers: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  catBarBackground: {
    height: 5,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  catBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Activity Tab
  activityCard: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surface,
    padding: 14,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    gap: 12,
  },
  activityIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityDetails: {
    flex: 1,
  },
  activityDescription: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    lineHeight: 18,
  },
  activityTime: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 4,
  },
  diffBox: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    borderRadius: THEME.radius.md,
    padding: 10,
    marginTop: 8,
    gap: 4,
  },
  diffUnchangedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  diffUnchangedText: {
    fontSize: 11,
    color: THEME.colors.primary,
    fontWeight: '700',
  },
  diffChangeText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },

  // Empty Container
  emptyContainer: {
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
    marginTop: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    textAlign: 'center',
  },

  // Progressive Loading & Completion
  progressiveLoaderContainer: {
    paddingVertical: 8,
  },
  endOfListFooter: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endOfListText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
    letterSpacing: 0.3,
  },

  // FAB
  fabContainer: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    zIndex: 95,
    elevation: 10,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  fabPulseRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 26,
    backgroundColor: THEME.colors.primary,
    zIndex: -1,
  },
});
