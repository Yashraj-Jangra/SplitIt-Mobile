import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { THEME } from '../../constants/theme';
import { GroupDetailData, GroupExpense, GroupMember } from '../../services/group.service';
import { useCurrency } from '../../contexts/currency.context';
import { CategoryIcon, getCategoryColor } from '../../utils/category-icons';
import { TrendingUp, Users, PieChart, Calendar, Award } from 'lucide-react-native';

interface GroupAnalysisTabProps {
  group: GroupDetailData | null;
  expenses: GroupExpense[];
  members: GroupMember[];
}

export const GroupAnalysisTab: React.FC<GroupAnalysisTabProps> = ({
  group,
  expenses,
  members,
}) => {
  const { formatCurrency } = useCurrency();

  const stats = useMemo(() => {
    const validExpenses = expenses || [];
    const totalSpend = validExpenses.reduce((acc, exp) => acc + (Number(exp.amount) || 0), 0);
    const memberCount = Math.max(members.length, 1);
    const avgPerMember = totalSpend / memberCount;

    // Member Contribution Breakdown
    const memberPaidMap: Record<string, { member: GroupMember; paid: number }> = {};
    members.forEach((m) => {
      memberPaidMap[m.id] = { member: m, paid: 0 };
    });

    validExpenses.forEach((exp) => {
      if (Array.isArray(exp.payers) && exp.payers.length > 0) {
        exp.payers.forEach((p) => {
          if (memberPaidMap[p.userId]) {
            memberPaidMap[p.userId].paid += Number(p.amount) || 0;
          }
        });
      } else if (exp.paidById && memberPaidMap[exp.paidById]) {
        memberPaidMap[exp.paidById].paid += Number(exp.amount) || 0;
      }
    });

    const memberContributions = Object.values(memberPaidMap)
      .map(({ member, paid }) => ({
        member,
        paid,
        percentage: totalSpend > 0 ? (paid / totalSpend) * 100 : 0,
      }))
      .sort((a, b) => b.paid - a.paid);

    // Category Distribution Breakdown
    const categoryMap: Record<string, { count: number; total: number; masterCategory?: string }> = {};
    validExpenses.forEach((exp) => {
      const catKey = typeof exp.category === 'object' && exp.category !== null
        ? (exp.category as any).sub || 'other'
        : String(exp.category || 'other');
      const masterCat = typeof exp.category === 'object' && exp.category !== null
        ? (exp.category as any).master
        : (exp as any).masterCategory;

      if (!categoryMap[catKey]) {
        categoryMap[catKey] = { count: 0, total: 0, masterCategory: masterCat };
      }
      categoryMap[catKey].count += 1;
      categoryMap[catKey].total += Number(exp.amount) || 0;
    });

    const categories = Object.entries(categoryMap)
      .map(([subCategory, data]) => ({
        subCategory,
        masterCategory: data.masterCategory,
        count: data.count,
        total: data.total,
        percentage: totalSpend > 0 ? (data.total / totalSpend) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Monthly Velocity Breakdown (Last 4 months)
    const monthMap: Record<string, number> = {};
    validExpenses.forEach((exp) => {
      const d = exp.rawDate ? new Date(exp.rawDate) : new Date(exp.date);
      if (!isNaN(d.getTime())) {
        const monthKey = d.toLocaleString('en-US', { month: 'short' });
        monthMap[monthKey] = (monthMap[monthKey] || 0) + (Number(exp.amount) || 0);
      }
    });

    const monthlyTrends = Object.entries(monthMap).map(([month, total]) => ({
      month,
      total,
    }));

    const maxMonthlySpend = Math.max(...monthlyTrends.map((m) => m.total), 1);

    return {
      totalSpend,
      avgPerMember,
      expenseCount: validExpenses.length,
      topCategory: categories[0]?.subCategory || 'N/A',
      memberContributions,
      categories,
      monthlyTrends,
      maxMonthlySpend,
    };
  }, [expenses, members]);

  return (
    <View style={styles.container}>
      {/* ── 3-NODE METRICS RIBBON (NO-DIV OPEN EDITORIAL) ── */}
      <View style={styles.metricsRibbonContainer}>
        <View style={styles.metricNode}>
          <Text style={styles.metricNodeLabel}>TOTAL SPENT</Text>
          <Text style={styles.metricNodeValue} numberOfLines={1}>
            {formatCurrency(stats.totalSpend, { decimals: 0 })}
          </Text>
        </View>

        <View style={styles.nodeHairline} />

        <View style={styles.metricNode}>
          <Text style={styles.metricNodeLabel}>AVG / MEMBER</Text>
          <Text style={styles.metricNodeValue} numberOfLines={1}>
            {formatCurrency(stats.avgPerMember, { decimals: 0 })}
          </Text>
        </View>

        <View style={styles.nodeHairline} />

        <View style={styles.metricNode}>
          <Text style={styles.metricNodeLabel}>TOP SPEND</Text>
          <Text style={[styles.metricNodeValue, styles.topSpendValue]} numberOfLines={1}>
            {stats.topCategory.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* ── MEMBER SPENDING SHARE (OPEN LEDGER) ── */}
      <View style={styles.editorialSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>MEMBER SPENDING SHARE</Text>
          {stats.memberContributions.length > 0 && (
            <Text style={styles.sectionCount}>
              {stats.memberContributions.length} {stats.memberContributions.length === 1 ? 'member' : 'members'}
            </Text>
          )}
        </View>

        <View style={styles.openLedger}>
          {stats.memberContributions.length === 0 ? (
            <View style={styles.emptyStateBox}>
              <Text style={styles.emptyText}>No spending recorded by members yet</Text>
            </View>
          ) : (
            stats.memberContributions.map((item, index) => {
              const isLast = index === stats.memberContributions.length - 1;
              return (
                <View
                  key={item.member.id}
                  style={[styles.ledgerRow, !isLast && styles.ledgerRowBorder]}
                >
                  <View style={styles.ledgerRowContent}>
                    <View style={styles.memberAvatar}>
                      {item.member.avatarUrl ? (
                        <Image source={{ uri: item.member.avatarUrl }} style={styles.avatarImg} />
                      ) : (
                        <Text style={styles.avatarText}>
                          {(item.member.name || 'M').charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>

                    <View style={styles.ledgerInfo}>
                      <Text style={styles.ledgerName} numberOfLines={1}>
                        {item.member.name}
                      </Text>
                      <View style={styles.hairlineBarTrack}>
                        <View
                          style={[
                            styles.hairlineBarFill,
                            {
                              width: `${Math.min(Math.max(item.percentage, 3), 100)}%`,
                              backgroundColor: THEME.colors.primary,
                            },
                          ]}
                        />
                      </View>
                    </View>

                    <View style={styles.ledgerFigures}>
                      <Text style={styles.ledgerAmount}>
                        {formatCurrency(item.paid, { decimals: 0 })}
                      </Text>
                      <Text style={styles.ledgerPercent}>
                        {item.percentage.toFixed(1)}%
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>

      {/* ── CATEGORY DISTRIBUTION (OPEN LEDGER) ── */}
      <View style={styles.editorialSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>CATEGORY ALLOCATION</Text>
          {stats.categories.length > 0 && (
            <Text style={styles.sectionCount}>
              {stats.categories.length} {stats.categories.length === 1 ? 'category' : 'categories'}
            </Text>
          )}
        </View>

        <View style={styles.openLedger}>
          {stats.categories.length === 0 ? (
            <View style={styles.emptyStateBox}>
              <Text style={styles.emptyText}>No categorized expenses recorded yet</Text>
            </View>
          ) : (
            stats.categories.map((cat, index) => {
              const catColor = getCategoryColor(cat.masterCategory, cat.subCategory);
              const isLast = index === stats.categories.length - 1;
              return (
                <View
                  key={cat.subCategory}
                  style={[styles.ledgerRow, !isLast && styles.ledgerRowBorder]}
                >
                  <View style={styles.ledgerRowContent}>
                    <View style={[styles.categoryGlyph, { backgroundColor: THEME.colors.surfaceElevated }]}>
                      <CategoryIcon
                        subCategory={cat.subCategory}
                        masterCategory={cat.masterCategory}
                        size={15}
                        color={catColor}
                      />
                    </View>

                    <View style={styles.ledgerInfo}>
                      <Text style={styles.ledgerName} numberOfLines={1}>
                        {cat.subCategory.charAt(0).toUpperCase() + cat.subCategory.slice(1)}
                      </Text>
                      <View style={styles.hairlineBarTrack}>
                        <View
                          style={[
                            styles.hairlineBarFill,
                            {
                              width: `${Math.min(Math.max(cat.percentage, 3), 100)}%`,
                              backgroundColor: catColor,
                            },
                          ]}
                        />
                      </View>
                    </View>

                    <View style={styles.ledgerFigures}>
                      <Text style={styles.ledgerAmount}>
                        {formatCurrency(cat.total, { decimals: 0 })}
                      </Text>
                      <Text style={styles.ledgerPercent}>
                        {cat.percentage.toFixed(1)}%
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>

      {/* ── MONTHLY SPENDING VELOCITY (OPEN VISUALIZER) ── */}
      {stats.monthlyTrends.length > 0 && (
        <View style={styles.editorialSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>SPENDING VELOCITY</Text>
            <Text style={styles.sectionCount}>
              {stats.monthlyTrends.length} {stats.monthlyTrends.length === 1 ? 'month' : 'months'}
            </Text>
          </View>

          <View style={styles.velocityChartContainer}>
            <View style={styles.velocityBarsRow}>
              {stats.monthlyTrends.map((m, index) => {
                const heightPct = Math.round((m.total / (stats.maxMonthlySpend || 1)) * 100);
                const isCurrent = index === stats.monthlyTrends.length - 1;
                return (
                  <View key={m.month} style={styles.velocityCol}>
                    <Text style={[styles.velocityAmount, isCurrent && styles.velocityAmountActive]}>
                      {formatCurrency(m.total, { decimals: 0 })}
                    </Text>
                    <View style={styles.velocityTrack}>
                      <View
                        style={[
                          styles.velocityBarFill,
                          {
                            height: `${Math.max(heightPct, 6)}%`,
                            backgroundColor: isCurrent
                              ? THEME.colors.primary
                              : THEME.colors.surfacePill,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.velocityMonth, isCurrent && styles.velocityMonthActive]}>
                      {m.month}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.chartBaseline} />
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 0,
    paddingTop: 6,
    paddingBottom: 40,
    gap: 16,
  },
  metricsRibbonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
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
    fontSize: 13.5,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  topSpendValue: {
    color: THEME.colors.primary,
  },
  nodeHairline: {
    width: 1,
    height: 24,
    backgroundColor: THEME.colors.hairline,
  },
  editorialSection: {
    gap: 8,
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
    paddingVertical: 11,
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
  memberAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.text,
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
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '500',
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
    height: 110,
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
    height: 68,
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
});

