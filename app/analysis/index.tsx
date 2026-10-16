import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '../../src/constants/theme';
import { expenseService, UserTransactionItem } from '../../src/services/expense.service';
import { groupService, GroupListItem } from '../../src/services/group.service';
import { useCurrency } from '../../src/contexts/currency.context';
import { CategoryIcon, getCategoryColor } from '../../src/utils/category-icons';
import { haptics } from '../../src/services/haptics.service';
import {
  ArrowLeft,
  RotateCw,
  TrendingUp,
  TrendingDown,
  PieChart,
  Users,
  Calendar,
  Sparkles,
  Lightbulb,
} from 'lucide-react-native';

export default function AnalysisScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { formatCurrency } = useCurrency();

  const [expenses, setExpenses] = useState<UserTransactionItem[]>(() =>
    expenseService.getInMemoryUserExpenses()
  );
  const [groups, setGroups] = useState<GroupListItem[]>(() =>
    groupService.getInMemoryGroups()
  );
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (force = false) => {
    try {
      const [fetchedExpenses, fetchedGroups] = await Promise.all([
        expenseService.getUserExpenses(100, { forceRefresh: force }),
        groupService.getUserGroups({ forceRefresh: force }),
      ]);
      setExpenses(fetchedExpenses);
      setGroups(fetchedGroups);
    } catch {
      // Fallback cleanly to in-memory state
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  const onRefresh = useCallback(() => {
    haptics.tap();
    setRefreshing(true);
    loadData(true);
  }, [loadData]);

  // Compute Personal Analytics synchronously
  const analytics = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastMonthYear = lastMonthDate.getFullYear();

    const twoMonthsAgoDate = new Date(currentYear, currentMonth - 2, 1);
    const twoMonthsAgo = twoMonthsAgoDate.getMonth();
    const twoMonthsAgoYear = twoMonthsAgoDate.getFullYear();

    let thisMonthTotal = 0;
    let lastMonthTotal = 0;
    let twoMonthsAgoTotal = 0;

    const categoryMap: Record<
      string,
      { count: number; total: number; masterCategory: string }
    > = {};
    const groupSpendMap: Record<
      string,
      { groupName: string; count: number; total: number }
    > = {};

    expenses.forEach((item) => {
      const d = item.rawDate ? new Date(item.rawDate) : new Date(item.date);
      const userShare = Math.abs(Number(item.yourShare ?? item.amount) || 0);

      if (!isNaN(d.getTime())) {
        const itemMonth = d.getMonth();
        const itemYear = d.getFullYear();

        if (itemMonth === currentMonth && itemYear === currentYear) {
          thisMonthTotal += userShare;
        } else if (itemMonth === lastMonth && itemYear === lastMonthYear) {
          lastMonthTotal += userShare;
        } else if (itemMonth === twoMonthsAgo && itemYear === twoMonthsAgoYear) {
          twoMonthsAgoTotal += userShare;
        }
      }

      // Group allocation
      const gId = item.groupId || 'personal';
      const gName = item.groupName || 'Direct Expenses';
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
    });

    // % diff vs last month
    let percentChange = 0;
    if (lastMonthTotal > 0) {
      percentChange = ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100;
    }

    // Daily burn rate (current day of month)
    const dayOfMonth = Math.max(now.getDate(), 1);
    const dailyBurnRate = thisMonthTotal / dayOfMonth;

    // Categories ranked
    const totalAllExpenses = Object.values(categoryMap).reduce(
      (sum, c) => sum + c.total,
      0
    );
    const rankedCategories = Object.entries(categoryMap)
      .map(([cat, val]) => ({
        category: cat,
        masterCategory: val.masterCategory,
        count: val.count,
        total: val.total,
        percentage:
          totalAllExpenses > 0 ? (val.total / totalAllExpenses) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Groups ranked
    const rankedGroups = Object.entries(groupSpendMap)
      .map(([id, val]) => ({
        groupId: id,
        groupName: val.groupName,
        count: val.count,
        total: val.total,
        percentage:
          totalAllExpenses > 0 ? (val.total / totalAllExpenses) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // 3-month velocity
    const monthFormatter = (date: Date) =>
      date.toLocaleString('en-US', { month: 'short' });
    const velocity = [
      {
        label: monthFormatter(twoMonthsAgoDate),
        amount: twoMonthsAgoTotal,
      },
      {
        label: monthFormatter(lastMonthDate),
        amount: lastMonthTotal,
      },
      {
        label: monthFormatter(now),
        amount: thisMonthTotal,
      },
    ];
    const maxVelocity = Math.max(...velocity.map((v) => v.amount), 1);

    const averageExpense =
      expenses.length > 0 ? totalAllExpenses / expenses.length : 0;

    return {
      thisMonthTotal,
      lastMonthTotal,
      percentChange,
      dailyBurnRate,
      rankedCategories,
      rankedGroups,
      velocity,
      maxVelocity,
      totalAllExpenses,
      averageExpense,
    };
  }, [expenses]);

  const insight = useMemo(() => {
    if (analytics.rankedCategories.length > 0 && analytics.percentChange <= 0 && analytics.lastMonthTotal > 0) {
      return `Spending is down ${Math.abs(analytics.percentChange).toFixed(1)}% compared to last month. Top category is ${analytics.rankedCategories[0].category} at ${analytics.rankedCategories[0].percentage.toFixed(0)}% of total.`;
    } else if (analytics.rankedCategories.length > 0 && analytics.percentChange > 0 && analytics.lastMonthTotal > 0) {
      return `Spending is up ${analytics.percentChange.toFixed(1)}% vs last month. ${analytics.rankedCategories[0].category.charAt(0).toUpperCase() + analytics.rankedCategories[0].category.slice(1)} accounts for the largest share at ${analytics.rankedCategories[0].percentage.toFixed(0)}%.`;
    } else if (analytics.rankedCategories.length > 0) {
      return `Your top spending category is ${analytics.rankedCategories[0].category.charAt(0).toUpperCase() + analytics.rankedCategories[0].category.slice(1)}, representing ${analytics.rankedCategories[0].percentage.toFixed(0)}% of your expenses.`;
    }
    return 'Keep tracking your daily expenses to unlock automated spending velocity insights and budget allocations.';
  }, [analytics]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Pinned Top Navigation Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Refresh"
        >
          <RotateCw size={18} color={THEME.colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={THEME.colors.primary}
            colors={[THEME.colors.primary]}
          />
        }
      >
        {/* Open Editorial Financial Health Hero */}
        <View style={styles.heroSection}>
          <View style={styles.heroMetaRow}>
            <View style={styles.periodPill}>
              <Sparkles size={11} color={THEME.colors.primary} />
              <Text style={styles.periodPillText}>THIS MONTH</Text>
            </View>
            {analytics.lastMonthTotal > 0 && (
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
                  {Math.abs(analytics.percentChange).toFixed(1)}% vs last month
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.heroAmount}>
            {formatCurrency(analytics.thisMonthTotal)}
          </Text>

          {/* 3-Node Metrics Ribbon */}
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
              <Text style={styles.metricNodeLabel}>LAST MONTH</Text>
              <Text style={styles.metricNodeValue} numberOfLines={1}>
                {formatCurrency(analytics.lastMonthTotal)}
              </Text>
            </View>

            <View style={styles.nodeHairline} />

            <View style={styles.metricNode}>
              <Text style={styles.metricNodeLabel}>AVG / EXPENSE</Text>
              <Text style={styles.metricNodeValue} numberOfLines={1}>
                {formatCurrency(analytics.averageExpense)}
              </Text>
            </View>
          </View>
        </View>

        {/* Smart Financial Takeaway */}
        <View style={styles.insightBanner}>
          <View style={styles.insightAccentBar} />
          <View style={styles.insightBody}>
            <Lightbulb size={15} color={THEME.colors.primary} style={styles.insightIcon} />
            <Text style={styles.insightText}>{insight}</Text>
          </View>
        </View>

        {/* 3-Month Spending Velocity */}
        <View style={styles.editorialSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>SPENDING VELOCITY (3 MO)</Text>
          </View>

          <View style={styles.velocityChartContainer}>
            <View style={styles.velocityBarsRow}>
              {analytics.velocity.map((item, index) => {
                const heightPercent = Math.max(
                  (item.amount / (analytics.maxVelocity || 1)) * 100,
                  6
                );
                const isCurrent = index === analytics.velocity.length - 1;
                return (
                  <View key={item.label} style={styles.velocityCol}>
                    <Text style={[styles.velocityAmount, isCurrent && styles.velocityAmountActive]}>
                      {formatCurrency(item.amount)}
                    </Text>
                    <View style={styles.velocityTrack}>
                      <View
                        style={[
                          styles.velocityBarFill,
                          {
                            height: `${heightPercent}%`,
                            backgroundColor: isCurrent
                              ? THEME.colors.primary
                              : THEME.colors.surfacePill,
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.velocityMonth,
                        isCurrent && styles.velocityMonthActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.chartBaseline} />
          </View>
        </View>

        {/* Category Allocation Ledger */}
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
              <Text style={styles.emptyText}>No expenses recorded yet</Text>
            </View>
          ) : (
            <View style={styles.openLedger}>
              {analytics.rankedCategories.slice(0, 6).map((item, index) => {
                const catColor = getCategoryColor(item.masterCategory, item.category);
                const isLast = index === Math.min(analytics.rankedCategories.length, 6) - 1;
                return (
                  <View
                    key={item.category}
                    style={[styles.ledgerRow, !isLast && styles.ledgerRowBorder]}
                  >
                    <View style={styles.ledgerRowContent}>
                      <View style={[styles.categoryGlyph, { backgroundColor: THEME.colors.surfaceElevated }]}>
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
            </View>
          )}
        </View>

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
              {analytics.rankedGroups.slice(0, 6).map((group, index) => {
                const isLast = index === Math.min(analytics.rankedGroups.length, 6) - 1;
                return (
                  <View
                    key={group.groupId}
                    style={[styles.ledgerRow, !isLast && styles.ledgerRowBorder]}
                  >
                    <View style={styles.ledgerRowContent}>
                      <View style={[styles.categoryGlyph, { backgroundColor: THEME.colors.surfaceElevated }]}>
                        <Users size={14} color={THEME.colors.primary} />
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
                                backgroundColor: THEME.colors.primary,
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
    width: 36,
    height: 36,
    borderRadius: 18,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: 4,
    backgroundColor: THEME.colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: THEME.radius.full,
  },
  periodPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.primary,
    letterSpacing: 0.6,
  },
  deltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
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
  insightBanner: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    overflow: 'hidden',
  },
  insightAccentBar: {
    width: 3.5,
    backgroundColor: THEME.colors.primary,
  },
  insightBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    gap: 10,
  },
  insightIcon: {
    marginTop: 1,
  },
  insightText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
    lineHeight: 17,
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
  velocityChartContainer: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  velocityBarsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 120,
    paddingBottom: 8,
  },
  velocityCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  velocityAmount: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  velocityAmountActive: {
    color: THEME.colors.text,
    fontWeight: '800',
  },
  velocityTrack: {
    width: 24,
    height: 72,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.radius.xs,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  velocityBarFill: {
    width: '100%',
    borderRadius: THEME.radius.xs,
  },
  velocityMonth: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  velocityMonthActive: {
    color: THEME.colors.text,
    fontWeight: '800',
  },
  chartBaseline: {
    height: 1,
    backgroundColor: THEME.colors.hairline,
    marginHorizontal: 10,
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
    width: 30,
    height: 30,
    borderRadius: 15,
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

