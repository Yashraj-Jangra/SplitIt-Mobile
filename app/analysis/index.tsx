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
    };
  }, [expenses]);

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
        {/* KPI Hero Card */}
        <View style={styles.kpiHeroCard}>
          <View style={styles.kpiHeroHeader}>
            <View style={styles.heroBadgeRow}>
              <View style={styles.sparkleBadge}>
                <Sparkles size={12} color={THEME.colors.primary} />
                <Text style={styles.sparkleBadgeText}>This Month</Text>
              </View>
              {analytics.lastMonthTotal > 0 && (
                <View
                  style={[
                    styles.diffBadge,
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
                      styles.diffBadgeText,
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
          </View>

          {/* Sub-Metrics Row */}
          <View style={styles.subMetricsRow}>
            <View style={styles.subMetricCol}>
              <Text style={styles.subMetricLabel}>Daily Burn Rate</Text>
              <Text style={styles.subMetricValue}>
                {formatCurrency(analytics.dailyBurnRate)}
                <Text style={styles.subMetricUnit}> / day</Text>
              </Text>
            </View>

            <View style={styles.subMetricDivider} />

            <View style={styles.subMetricCol}>
              <Text style={styles.subMetricLabel}>Last Month Spend</Text>
              <Text style={styles.subMetricValue}>
                {formatCurrency(analytics.lastMonthTotal)}
              </Text>
            </View>
          </View>
        </View>

        {/* 3-Month Spending Velocity */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <TrendingUp size={16} color={THEME.colors.primary} />
            <Text style={styles.cardTitle}>3-Month Spending Velocity</Text>
          </View>

          <View style={styles.velocityRow}>
            {analytics.velocity.map((item, index) => {
              const heightPercent = Math.max(
                (item.amount / analytics.maxVelocity) * 100,
                8
              );
              const isCurrent = index === analytics.velocity.length - 1;
              return (
                <View key={item.label} style={styles.velocityCol}>
                  <Text style={styles.velocityAmount}>
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
                            : THEME.colors.surfaceElevated,
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
        </View>

        {/* Category Allocation Breakdown */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <PieChart size={16} color={THEME.colors.info} />
            <Text style={styles.cardTitle}>Category Allocation</Text>
          </View>

          {analytics.rankedCategories.length === 0 ? (
            <Text style={styles.emptyText}>No expenses recorded yet</Text>
          ) : (
            <View style={styles.breakdownList}>
              {analytics.rankedCategories.slice(0, 5).map((item) => {
                const catColor = getCategoryColor(item.masterCategory, item.category);
                return (
                  <View key={item.category} style={styles.breakdownItem}>
                    <View style={styles.breakdownItemHeader}>
                      <View style={styles.breakdownLeft}>
                        <View style={[styles.catIconWrap, { backgroundColor: THEME.colors.surfaceElevated }]}>
                          <CategoryIcon
                            subCategory={item.category}
                            masterCategory={item.masterCategory}
                            size={16}
                            color={catColor}
                          />
                        </View>
                        <Text style={styles.breakdownName} numberOfLines={1}>
                          {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                        </Text>
                      </View>
                      <View style={styles.breakdownRight}>
                        <Text style={styles.breakdownAmount}>
                          {formatCurrency(item.total)}
                        </Text>
                        <Text style={styles.breakdownPercent}>
                          {item.percentage.toFixed(1)}%
                        </Text>
                      </View>
                    </View>

                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.max(item.percentage, 3)}%`,
                            backgroundColor: catColor,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Circle Allocation Breakdown */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Users size={16} color={THEME.colors.warning} />
            <Text style={styles.cardTitle}>Circle Allocation</Text>
          </View>

          {analytics.rankedGroups.length === 0 ? (
            <Text style={styles.emptyText}>No group spending found</Text>
          ) : (
            <View style={styles.breakdownList}>
              {analytics.rankedGroups.slice(0, 5).map((group) => (
                <View key={group.groupId} style={styles.breakdownItem}>
                  <View style={styles.breakdownItemHeader}>
                    <Text style={styles.breakdownName} numberOfLines={1}>
                      {group.groupName}
                    </Text>
                    <View style={styles.breakdownRight}>
                      <Text style={styles.breakdownAmount}>
                        {formatCurrency(group.total)}
                      </Text>
                      <Text style={styles.breakdownPercent}>
                        {group.percentage.toFixed(1)}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${Math.max(group.percentage, 3)}%`,
                          backgroundColor: THEME.colors.warning,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
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
    padding: 16,
    gap: 16,
  },
  kpiHeroCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    gap: 16,
  },
  kpiHeroHeader: {
    gap: 8,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sparkleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.xs,
  },
  sparkleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  diffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.xs,
  },
  diffBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -0.6,
  },
  subMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
  },
  subMetricCol: {
    flex: 1,
  },
  subMetricLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: THEME.colors.textMuted,
    marginBottom: 4,
  },
  subMetricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  subMetricUnit: {
    fontSize: 11,
    fontWeight: '500',
    color: THEME.colors.textMuted,
  },
  subMetricDivider: {
    width: 1,
    height: 28,
    backgroundColor: THEME.colors.hairline,
    marginHorizontal: 16,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  velocityRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 130,
    paddingTop: 10,
  },
  velocityCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  velocityAmount: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  velocityTrack: {
    width: 32,
    height: 80,
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
  breakdownList: {
    gap: 14,
  },
  breakdownItem: {
    gap: 6,
  },
  breakdownItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  catIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownName: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
    flex: 1,
  },
  breakdownRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  breakdownPercent: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
    minWidth: 36,
    textAlign: 'right',
  },
  barTrack: {
    height: 5,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  emptyText: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
