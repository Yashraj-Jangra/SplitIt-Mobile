import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  RotateCw,
  TrendingUp,
  TrendingDown,
  Calendar as CalendarIcon,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Users,
  Zap,
  Award,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { useAppTheme } from '../../src/contexts/theme.context';
import { expenseService, UserTransactionItem } from '../../src/services/expense.service';
import { groupService, GroupListItem } from '../../src/services/group.service';
import { useCurrency } from '../../src/contexts/currency.context';
import { CategoryIcon, getCategoryColor } from '../../src/utils/category-icons';
import { haptics } from '../../src/services/haptics.service';
import { appEventEmitter } from '../../src/services/event-emitter';
import {
  DateRangePickerModal,
  DateRange,
} from '../../src/components/common/DateRangePickerModal';
import { SpendingTimelineChart, TimelineDataPoint } from '../../src/components/charts';

type DatePreset = 'this_month' | 'last_30' | 'last_90' | 'all' | 'custom';

const getPresetRange = (preset: DatePreset): DateRange => {
  const now = new Date();
  if (preset === 'this_month') {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0),
      to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
    };
  }
  if (preset === 'last_30') {
    const from = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    from.setHours(0, 0, 0, 0);
    return {
      from,
      to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
    };
  }
  if (preset === 'last_90') {
    const from = new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000);
    from.setHours(0, 0, 0, 0);
    return {
      from,
      to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
    };
  }
  return { from: null, to: null };
};

export default function AnalysisScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentAccent } = useAppTheme();
  const { formatCurrency } = useCurrency();

  const [expenses, setExpenses] = useState<UserTransactionItem[]>(() =>
    expenseService.getInMemoryUserExpenses()
  );
  const [groups, setGroups] = useState<GroupListItem[]>(() =>
    groupService.getInMemoryGroups()
  );
  const [refreshing, setRefreshing] = useState(false);

  // Time Frame Filtering
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month');
  const [dateRange, setDateRange] = useState<DateRange>(() => getPresetRange('this_month'));
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);

  // Chart Frequency & Category Expansion
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [expandedCategories, setExpandedCategories] = useState(false);
  const [isScrubbingChart, setIsScrubbingChart] = useState(false);

  const loadData = useCallback(async (force = false) => {
    try {
      const [fetchedExpenses, fetchedGroups] = await Promise.all([
        expenseService.getUserExpenses(150, { forceRefresh: force }),
        groupService.getUserGroups({ forceRefresh: force }),
      ]);
      setExpenses(fetchedExpenses);
      setGroups(fetchedGroups);
    } catch {
      // Fallback cleanly to memory state
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  const lastAnalysisFetchRef = useRef<number>(Date.now());

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastAnalysisFetchRef.current < 2500) return;
      lastAnalysisFetchRef.current = now;
      requestAnimationFrame(() => {
        loadData(true);
      });
    }, [loadData])
  );

  useEffect(() => {
    const unsub = appEventEmitter.on('data-changed', () => {
      loadData(true);
    });
    return unsub;
  }, [loadData]);

  const onRefresh = useCallback(() => {
    haptics.tap();
    setRefreshing(true);
    loadData(true);
  }, [loadData]);

  const handleSelectPreset = (preset: DatePreset) => {
    haptics.tap();
    setDatePreset(preset);
    if (preset !== 'custom') {
      setDateRange(getPresetRange(preset));
    } else {
      setShowDatePickerModal(true);
    }
  };

  // Filter expenses strictly according to the date range
  const currentExpenses = useMemo(() => {
    if (!dateRange.from && !dateRange.to) return expenses;

    return expenses.filter((item) => {
      const d = item.rawDate ? new Date(item.rawDate) : new Date(item.date);
      if (isNaN(d.getTime())) return true;

      if (dateRange.from) {
        const fromMidnight = new Date(
          dateRange.from.getFullYear(),
          dateRange.from.getMonth(),
          dateRange.from.getDate(),
          0,
          0,
          0
        ).getTime();
        if (d.getTime() < fromMidnight) return false;
      }

      if (dateRange.to) {
        const toEndOfDay = new Date(
          dateRange.to.getFullYear(),
          dateRange.to.getMonth(),
          dateRange.to.getDate(),
          23,
          59,
          59,
          999
        ).getTime();
        if (d.getTime() > toEndOfDay) return false;
      }

      return true;
    });
  }, [expenses, dateRange]);

  // Previous Period Expenses for Trend Delta
  const previousPeriodExpenses = useMemo(() => {
    if (!dateRange.from) return [];
    const from = dateRange.from;
    const to = dateRange.to || from;
    const duration = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - duration - 1000);
    const prevTo = new Date(from.getTime() - 1);

    return expenses.filter((item) => {
      const d = item.rawDate ? new Date(item.rawDate) : new Date(item.date);
      if (isNaN(d.getTime())) return false;
      return d.getTime() >= prevFrom.getTime() && d.getTime() <= prevTo.getTime();
    });
  }, [expenses, dateRange]);

  // Aggregate Personal Metrics
  const analytics = useMemo(() => {
    const currentTotal = currentExpenses.reduce(
      (acc, exp) => acc + Math.abs(Number(exp.yourShare ?? exp.amount) || 0),
      0
    );
    const previousTotal = previousPeriodExpenses.reduce(
      (acc, exp) => acc + Math.abs(Number(exp.yourShare ?? exp.amount) || 0),
      0
    );

    let percentChange = 0;
    if (previousTotal > 0) {
      percentChange = ((currentTotal - previousTotal) / previousTotal) * 100;
    } else if (currentTotal > 0 && dateRange.from) {
      percentChange = 100;
    }

    // Days in current selection for daily burn
    let daysInPeriod = 30;
    if (dateRange.from && dateRange.to) {
      daysInPeriod = Math.max(
        1,
        Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1
      );
    } else if (dateRange.from && !dateRange.to) {
      daysInPeriod = 1;
    } else if (currentExpenses.length > 0) {
      const timestamps = currentExpenses
        .map((e) => (e.rawDate ? new Date(e.rawDate).getTime() : new Date(e.date).getTime()))
        .filter((t) => !isNaN(t));
      if (timestamps.length > 0) {
        const minT = Math.min(...timestamps);
        const maxT = Math.max(...timestamps);
        daysInPeriod = Math.max(1, Math.round((maxT - minT) / (1000 * 60 * 60 * 24)) + 1);
      }
    }
    const dailyBurnRate = currentTotal / daysInPeriod;

    // Category breakdown
    const categoryMap: Record<
      string,
      { count: number; total: number; masterCategory: string }
    > = {};
    const groupSpendMap: Record<
      string,
      { groupName: string; count: number; total: number }
    > = {};

    let maxSingleExpense: UserTransactionItem | null = null;
    let maxSingleExpenseAmount = 0;

    for (const item of currentExpenses) {
      const userShare = Math.abs(Number(item.yourShare ?? item.amount) || 0);

      // Track largest single purchase
      if (userShare > maxSingleExpenseAmount) {
        maxSingleExpenseAmount = userShare;
        maxSingleExpense = item;
      }

      // Group breakdown
      const gId = item.groupId || 'personal';
      const gName = item.groupName || 'Direct / Non-Group';
      if (!groupSpendMap[gId]) {
        groupSpendMap[gId] = { groupName: gName, count: 0, total: 0 };
      }
      groupSpendMap[gId].count += 1;
      groupSpendMap[gId].total += userShare;

      // Category breakdown
      const catKey = item.category || 'other';
      if (!categoryMap[catKey]) {
        categoryMap[catKey] = {
          count: 0,
          total: 0,
          masterCategory: item.masterCategory || 'Other',
        };
      }
      categoryMap[catKey].count += 1;
      categoryMap[catKey].total += userShare;
    }

    const rankedCategories = Object.entries(categoryMap)
      .map(([cat, val]) => ({
        category: cat,
        masterCategory: val.masterCategory,
        count: val.count,
        total: val.total,
        percentage: currentTotal > 0 ? (val.total / currentTotal) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const rankedGroups = Object.entries(groupSpendMap)
      .map(([id, val]) => ({
        groupId: id,
        groupName: val.groupName,
        count: val.count,
        total: val.total,
        percentage: currentTotal > 0 ? (val.total / currentTotal) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      currentTotal,
      previousTotal,
      percentChange,
      dailyBurnRate,
      rankedCategories,
      rankedGroups,
      hasSingleExpense: maxSingleExpense !== null,
      maxSingleExpenseTitle: maxSingleExpense?.title || 'Expense',
      maxSingleExpenseAmount,
      totalCount: currentExpenses.length,
    };
  }, [currentExpenses, previousPeriodExpenses, dateRange]);

  // Timeline Data for SpendingTimelineChart
  const timelineData: TimelineDataPoint[] = useMemo(() => {
    const timelineMap: Record<string, { amount: number; fullDate: string }> = {};

    currentExpenses.forEach((item) => {
      const d = item.rawDate ? new Date(item.rawDate) : new Date(item.date);
      if (isNaN(d.getTime())) return;
      const userShare = Math.abs(Number(item.yourShare ?? item.amount) || 0);

      let key = '';
      let fullDateStr = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      if (frequency === 'daily') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
          d.getDate()
        ).padStart(2, '0')}`;
        fullDateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else if (frequency === 'weekly') {
        const firstDayOfWeek = new Date(d);
        firstDayOfWeek.setDate(d.getDate() - d.getDay());
        key = `${firstDayOfWeek.getFullYear()}-W${Math.ceil(firstDayOfWeek.getDate() / 7)}`;
        const weekLabel = firstDayOfWeek.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
        fullDateStr = `Week of ${weekLabel}`;
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        fullDateStr = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }

      if (!timelineMap[key]) {
        timelineMap[key] = { amount: 0, fullDate: fullDateStr };
      }
      timelineMap[key].amount += userShare;
    });

    return Object.entries(timelineMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([_, val]) => ({
        label: val.fullDate,
        amount: val.amount,
        fullDate: val.fullDate,
      }));
  }, [currentExpenses, frequency]);

  // Find Peak Day
  const peakDayInfo = useMemo(() => {
    if (timelineData.length === 0) return null;
    let peak = timelineData[0];
    timelineData.forEach((pt) => {
      if (pt.amount > peak.amount) peak = pt;
    });
    return peak.amount > 0 ? peak : null;
  }, [timelineData]);

  // Visible Categories (Top 4 default with click to expand)
  const visibleCategories = useMemo(() => {
    if (expandedCategories) return analytics.rankedCategories;
    return analytics.rankedCategories.slice(0, 4);
  }, [analytics.rankedCategories, expandedCategories]);

  // Period label for hero
  const periodLabel = useMemo(() => {
    if (datePreset === 'this_month') return 'THIS MONTH';
    if (datePreset === 'last_30') return 'LAST 30 DAYS';
    if (datePreset === 'last_90') return 'LAST 90 DAYS';
    if (datePreset === 'all') return 'ALL TIME';
    if (dateRange.from) {
      const fromStr = `${dateRange.from.getDate()} ${dateRange.from.toLocaleString('en-US', {
        month: 'short',
      })}`;
      const toStr = dateRange.to
        ? `${dateRange.to.getDate()} ${dateRange.to.toLocaleString('en-US', { month: 'short' })}`
        : '';
      return `${fromStr}${toStr ? ` – ${toStr}` : ''}`.toUpperCase();
    }
    return 'ACTIVE WINDOW';
  }, [datePreset, dateRange]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={20} color={THEME.colors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Financial Health</Text>
          <Text style={styles.headerSubtitle}>Spending velocity & allocations</Text>
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRefresh}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Refresh"
        >
          <RotateCw size={17} color={THEME.colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Date Range Preset Selector Bar */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              datePreset === 'this_month' && {
                backgroundColor: currentAccent.primaryMuted,
                borderColor: currentAccent.primary,
              },
            ]}
            onPress={() => handleSelectPreset('this_month')}
            accessibilityRole="button"
            accessibilityLabel="Filter by this month"
          >
            <Text
              style={[
                styles.filterChipText,
                datePreset === 'this_month' && {
                  color: currentAccent.primary,
                  fontWeight: '700',
                },
              ]}
            >
              This Month
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              datePreset === 'last_30' && {
                backgroundColor: currentAccent.primaryMuted,
                borderColor: currentAccent.primary,
              },
            ]}
            onPress={() => handleSelectPreset('last_30')}
            accessibilityRole="button"
            accessibilityLabel="Filter by last 30 days"
          >
            <Text
              style={[
                styles.filterChipText,
                datePreset === 'last_30' && {
                  color: currentAccent.primary,
                  fontWeight: '700',
                },
              ]}
            >
              Last 30D
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              datePreset === 'last_90' && {
                backgroundColor: currentAccent.primaryMuted,
                borderColor: currentAccent.primary,
              },
            ]}
            onPress={() => handleSelectPreset('last_90')}
            accessibilityRole="button"
            accessibilityLabel="Filter by last 90 days"
          >
            <Text
              style={[
                styles.filterChipText,
                datePreset === 'last_90' && {
                  color: currentAccent.primary,
                  fontWeight: '700',
                },
              ]}
            >
              Last 90D
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              datePreset === 'all' && {
                backgroundColor: currentAccent.primaryMuted,
                borderColor: currentAccent.primary,
              },
            ]}
            onPress={() => handleSelectPreset('all')}
            accessibilityRole="button"
            accessibilityLabel="Filter all time"
          >
            <Text
              style={[
                styles.filterChipText,
                datePreset === 'all' && {
                  color: currentAccent.primary,
                  fontWeight: '700',
                },
              ]}
            >
              All Time
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              styles.calendarFilterChip,
              datePreset === 'custom' && {
                backgroundColor: currentAccent.primaryMuted,
                borderColor: currentAccent.primary,
              },
            ]}
            onPress={() => {
              haptics.tap();
              setShowDatePickerModal(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Custom date picker"
          >
            <CalendarIcon
              size={12}
              color={datePreset === 'custom' ? currentAccent.primary : THEME.colors.textMuted}
            />
            <Text
              style={[
                styles.filterChipText,
                datePreset === 'custom' && {
                  color: currentAccent.primary,
                  fontWeight: '700',
                },
              ]}
            >
              {datePreset === 'custom' && dateRange.from
                ? `${dateRange.from.getDate()} ${dateRange.from.toLocaleString('en-US', {
                    month: 'short',
                  })}`
                : 'Custom'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 36 }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isScrubbingChart}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={currentAccent.primary}
            colors={[currentAccent.primary]}
          />
        }
      >
        {/* Open Editorial Financial Hero Card */}
        <View style={styles.heroSection}>
          <View style={styles.heroMetaRow}>
            <View
              style={[
                styles.periodPill,
                { backgroundColor: currentAccent.primaryMuted },
              ]}
            >
              <Sparkles size={11} color={currentAccent.primary} />
              <Text style={[styles.periodPillText, { color: currentAccent.primary }]}>
                {periodLabel}
              </Text>
            </View>

            {analytics.previousTotal > 0 && (
              <View
                style={[
                  styles.deltaPill,
                  {
                    backgroundColor:
                      analytics.percentChange <= 0
                        ? THEME.colors.successMuted
                        : THEME.colors.dangerMuted,
                  },
                ]}
              >
                {analytics.percentChange <= 0 ? (
                  <TrendingDown size={11} color={THEME.colors.success} />
                ) : (
                  <TrendingUp size={11} color={THEME.colors.danger} />
                )}
                <Text
                  style={[
                    styles.deltaPillText,
                    {
                      color:
                        analytics.percentChange <= 0
                          ? THEME.colors.success
                          : THEME.colors.danger,
                    },
                  ]}
                >
                  {Math.abs(analytics.percentChange).toFixed(1)}% vs prev
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.heroAmount}>
            {formatCurrency(analytics.currentTotal)}
          </Text>

          {/* 3-Node Connected Metrics Ribbon */}
          <View style={styles.metricsRibbon}>
            <View style={styles.metricNode}>
              <Text style={styles.metricNodeLabel}>DAILY BURN</Text>
              <Text style={styles.metricNodeValue} numberOfLines={1}>
                {formatCurrency(analytics.dailyBurnRate)}
                <Text style={styles.metricNodeUnit}> /d</Text>
              </Text>
            </View>

            <View style={styles.nodeHairline} />

            <View style={styles.metricNode}>
              <Text style={styles.metricNodeLabel}>TRANSACTIONS</Text>
              <Text style={styles.metricNodeValue} numberOfLines={1}>
                {analytics.totalCount}{' '}
                <Text style={styles.metricNodeUnit}>items</Text>
              </Text>
            </View>

            <View style={styles.nodeHairline} />

            <View style={styles.metricNode}>
              <Text style={styles.metricNodeLabel}>TOP CATEGORY</Text>
              <Text
                style={[styles.metricNodeValue, { color: currentAccent.primary }]}
                numberOfLines={1}
              >
                {analytics.rankedCategories.length > 0
                  ? analytics.rankedCategories[0].category.charAt(0).toUpperCase() +
                    analytics.rankedCategories[0].category.slice(1)
                  : 'None'}
              </Text>
            </View>
          </View>
        </View>

        {/* Spending Timeline Chart (Smooth SVG with Frequency Switch) */}
        <View style={styles.editorialSection}>
          <SpendingTimelineChart
            data={timelineData}
            frequency={frequency}
            onChangeFrequency={setFrequency}
            height={180}
            title="SPENDING OVER TIME"
            onScrubbingChange={setIsScrubbingChart}
          />
        </View>

        {/* Category Allocation Ledger (Top 4 with Always Click to Expand) */}
        <View style={styles.editorialSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>CATEGORY ALLOCATION</Text>
            {analytics.rankedCategories.length > 0 && (
              <Text style={styles.sectionCount}>
                {analytics.rankedCategories.length} categories
              </Text>
            )}
          </View>

          {analytics.rankedCategories.length === 0 ? (
            <View style={styles.emptyStateBox}>
              <Text style={styles.emptyText}>No category expenses recorded in this period</Text>
            </View>
          ) : (
            <View style={styles.openLedger}>
              {visibleCategories.map((item, index) => {
                const catColor = getCategoryColor(item.masterCategory, item.category);
                const isLast =
                  index === visibleCategories.length - 1 &&
                  analytics.rankedCategories.length <= 4;

                return (
                  <View
                    key={item.category}
                    style={[styles.ledgerRow, !isLast && styles.ledgerRowBorder]}
                  >
                    <View style={styles.ledgerRowContent}>
                      <View
                        style={[
                          styles.categoryGlyph,
                          { backgroundColor: THEME.colors.surfaceElevated },
                        ]}
                      >
                        <CategoryIcon
                          subCategory={item.category}
                          masterCategory={item.masterCategory}
                          size={15}
                          color={catColor}
                        />
                      </View>
                      <View style={styles.ledgerInfo}>
                        <Text style={styles.ledgerName} numberOfLines={1}>
                          {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                        </Text>
                        <View style={styles.hairlineBarTrack}>
                          <View
                            style={[
                              styles.hairlineBarFill,
                              {
                                width: `${Math.max(item.percentage, 3)}%`,
                                backgroundColor: catColor,
                              },
                            ]}
                          />
                        </View>
                      </View>
                      <View style={styles.ledgerFigures}>
                        <Text style={styles.ledgerAmount}>
                          {formatCurrency(item.total)}
                        </Text>
                        <Text style={styles.ledgerPercent}>
                          {item.percentage.toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}

              {/* Click to expand always if more than 4 categories exist */}
              {analytics.rankedCategories.length > 4 && (
                <TouchableOpacity
                  style={styles.expandCategoriesButton}
                  onPress={() => {
                    haptics.tap();
                    setExpandedCategories(!expandedCategories);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={
                    expandedCategories ? 'Show top 4 categories' : 'Show all categories'
                  }
                >
                  <Text style={[styles.expandCategoriesText, { color: currentAccent.primary }]}>
                    {expandedCategories
                      ? 'Show top 4 categories'
                      : `Show all ${analytics.rankedCategories.length} categories`}
                  </Text>
                  {expandedCategories ? (
                    <ChevronUp size={14} color={currentAccent.primary} />
                  ) : (
                    <ChevronDown size={14} color={currentAccent.primary} />
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* High-Impact Relevant Financial Insights */}
        {(analytics.hasSingleExpense || peakDayInfo) && (
          <View style={styles.editorialSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>KEY INSIGHTS</Text>
            </View>

            <View style={styles.insightsRow}>
              {analytics.hasSingleExpense && (
                <View style={styles.insightCard}>
                  <View
                    style={[
                      styles.insightIconBadge,
                      { backgroundColor: currentAccent.primaryMuted },
                    ]}
                  >
                    <Award size={14} color={currentAccent.primary} />
                  </View>
                  <View style={styles.insightContent}>
                    <Text style={styles.insightTitle}>LARGEST EXPENSE</Text>
                    <Text style={styles.insightValue} numberOfLines={1}>
                      {analytics.maxSingleExpenseTitle}
                    </Text>
                    <Text style={[styles.insightSub, { color: currentAccent.primary }]}>
                      {formatCurrency(analytics.maxSingleExpenseAmount)}
                    </Text>
                  </View>
                </View>
              )}

              {peakDayInfo && (
                <View style={styles.insightCard}>
                  <View
                    style={[
                      styles.insightIconBadge,
                      { backgroundColor: THEME.colors.warningMuted },
                    ]}
                  >
                    <Zap size={14} color={THEME.colors.warning} />
                  </View>
                  <View style={styles.insightContent}>
                    <Text style={styles.insightTitle}>PEAK SPEND DAY</Text>
                    <Text style={styles.insightValue} numberOfLines={1}>
                      {peakDayInfo.label}
                    </Text>
                    <Text style={[styles.insightSub, { color: THEME.colors.warning }]}>
                      {formatCurrency(peakDayInfo.amount)}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Circle Allocation Ledger */}
        <View style={styles.editorialSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>CIRCLE ALLOCATION</Text>
            {analytics.rankedGroups.length > 0 && (
              <Text style={styles.sectionCount}>
                {analytics.rankedGroups.length} circles
              </Text>
            )}
          </View>

          {analytics.rankedGroups.length === 0 ? (
            <View style={styles.emptyStateBox}>
              <Text style={styles.emptyText}>No circle spending recorded yet</Text>
            </View>
          ) : (
            <View style={styles.openLedger}>
              {analytics.rankedGroups.slice(0, 4).map((group, index) => {
                const isLast =
                  index === Math.min(analytics.rankedGroups.length, 4) - 1;
                return (
                  <View
                    key={group.groupId}
                    style={[styles.ledgerRow, !isLast && styles.ledgerRowBorder]}
                  >
                    <View style={styles.ledgerRowContent}>
                      <View
                        style={[
                          styles.categoryGlyph,
                          { backgroundColor: THEME.colors.surfaceElevated },
                        ]}
                      >
                        <Users size={14} color={currentAccent.primary} />
                      </View>
                      <View style={styles.ledgerInfo}>
                        <Text style={styles.ledgerName} numberOfLines={1}>
                          {group.groupName}
                        </Text>
                        <View style={styles.hairlineBarTrack}>
                          <View
                            style={[
                              styles.hairlineBarFill,
                              {
                                width: `${Math.max(group.percentage, 3)}%`,
                                backgroundColor: currentAccent.primary,
                              },
                            ]}
                          />
                        </View>
                      </View>
                      <View style={styles.ledgerFigures}>
                        <Text style={styles.ledgerAmount}>
                          {formatCurrency(group.total)}
                        </Text>
                        <Text style={styles.ledgerPercent}>
                          {group.percentage.toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Date Range Picker Modal */}
      <DateRangePickerModal
        visible={showDatePickerModal}
        onClose={() => setShowDatePickerModal(false)}
        range={dateRange}
        onApplyRange={(appliedRange) => {
          setDateRange(appliedRange);
          setDatePreset('custom');
          setShowDatePickerModal(false);
        }}
        title="Select Time Frame"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBar: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
    backgroundColor: THEME.colors.background,
  },
  filterScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    minHeight: 32,
    justifyContent: 'center',
  },
  calendarFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 20,
  },
  heroSection: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    gap: 12,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  periodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
  },
  periodPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  deltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: THEME.radius.full,
  },
  deltaPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -0.8,
  },
  metricsRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
  },
  metricNode: {
    flex: 1,
    alignItems: 'center',
  },
  metricNodeLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metricNodeValue: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  metricNodeUnit: {
    fontSize: 10,
    fontWeight: '500',
    color: THEME.colors.textMuted,
  },
  nodeHairline: {
    width: 1,
    height: 24,
    backgroundColor: THEME.colors.hairline,
  },
  editorialSection: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  openLedger: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    overflow: 'hidden',
  },
  ledgerRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  ledgerRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  ledgerRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryGlyph: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ledgerInfo: {
    flex: 1,
    gap: 5,
  },
  ledgerName: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  hairlineBarTrack: {
    height: 3,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  hairlineBarFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  ledgerFigures: {
    alignItems: 'flex-end',
    gap: 2,
    minWidth: 64,
  },
  ledgerAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  ledgerPercent: {
    fontSize: 10.5,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  expandCategoriesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
    backgroundColor: THEME.colors.surfaceElevated,
  },
  expandCategoriesText: {
    fontSize: 12,
    fontWeight: '700',
  },
  insightsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  insightCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  insightIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightContent: {
    flex: 1,
    gap: 1,
  },
  insightTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.6,
  },
  insightValue: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  insightSub: {
    fontSize: 11,
    fontWeight: '800',
  },
  emptyStateBox: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textMuted,
  },
});
