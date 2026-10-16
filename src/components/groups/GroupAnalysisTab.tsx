import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { THEME } from '../../constants/theme';
import { GroupDetailData, GroupExpense, GroupMember } from '../../services/group.service';
import { useCurrency } from '../../contexts/currency.context';
import { CategoryIcon } from '../../utils/category-icons';
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
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* ── KPI HIGHLIGHT STRIP ── */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <View style={styles.kpiIconWrap}>
            <TrendingUp size={16} color={THEME.colors.primary} />
          </View>
          <Text style={styles.kpiLabel}>TOTAL SPENT</Text>
          <Text style={styles.kpiValue} numberOfLines={1}>
            {formatCurrency(stats.totalSpend, { decimals: 0 })}
          </Text>
        </View>

        <View style={styles.kpiCard}>
          <View style={styles.kpiIconWrap}>
            <Users size={16} color={THEME.colors.info} />
          </View>
          <Text style={styles.kpiLabel}>AVG PER MEMBER</Text>
          <Text style={styles.kpiValue} numberOfLines={1}>
            {formatCurrency(stats.avgPerMember, { decimals: 0 })}
          </Text>
        </View>

        <View style={styles.kpiCard}>
          <View style={styles.kpiIconWrap}>
            <Award size={16} color={THEME.colors.warning} />
          </View>
          <Text style={styles.kpiLabel}>TOP SPEND</Text>
          <Text style={styles.kpiValue} numberOfLines={1}>
            {stats.topCategory.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* ── MEMBER SPENDING SHARE ── */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Users size={16} color={THEME.colors.primary} />
          <Text style={styles.sectionTitle}>Member Spending Share</Text>
        </View>
        <Text style={styles.sectionSubtitle}>Who paid for group expenses and in what proportions</Text>

        <View style={styles.memberList}>
          {stats.memberContributions.length === 0 ? (
            <Text style={styles.emptyText}>No spending recorded by members</Text>
          ) : (
            stats.memberContributions.map((item) => (
              <View key={item.member.id} style={styles.memberRow}>
                <View style={styles.memberAvatar}>
                  {item.member.avatarUrl ? (
                    <Image source={{ uri: item.member.avatarUrl }} style={styles.avatarImg} />
                  ) : (
                    <Text style={styles.avatarText}>
                      {(item.member.name || 'M').charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>

                <View style={styles.memberInfo}>
                  <View style={styles.memberNameRow}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {item.member.name}
                    </Text>
                    <Text style={styles.memberAmount}>
                      {formatCurrency(item.paid, { decimals: 0 })}
                    </Text>
                  </View>

                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${Math.min(Math.max(item.percentage, 4), 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.memberPercentage}>
                    {item.percentage.toFixed(1)}% of total
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </View>

      {/* ── CATEGORY DISTRIBUTION ── */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <PieChart size={16} color={THEME.colors.info} />
          <Text style={styles.sectionTitle}>Category Allocation</Text>
        </View>
        <Text style={styles.sectionSubtitle}>Where this circle's funds were allocated</Text>

        <View style={styles.categoryList}>
          {stats.categories.length === 0 ? (
            <Text style={styles.emptyText}>No categorized expenses recorded</Text>
          ) : (
            stats.categories.map((cat) => (
              <View key={cat.subCategory} style={styles.categoryRow}>
                <View style={styles.catIconWrap}>
                  <CategoryIcon
                    subCategory={cat.subCategory}
                    masterCategory={cat.masterCategory}
                    size={18}
                    color={THEME.colors.textSecondary}
                  />
                </View>

                <View style={styles.catInfo}>
                  <View style={styles.catNameRow}>
                    <Text style={styles.catName} numberOfLines={1}>
                      {cat.subCategory.charAt(0).toUpperCase() + cat.subCategory.slice(1)}
                    </Text>
                    <Text style={styles.catAmount}>
                      {formatCurrency(cat.total, { decimals: 0 })}
                    </Text>
                  </View>

                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.catProgressBarFill,
                        { width: `${Math.min(Math.max(cat.percentage, 4), 100)}%` },
                      ]}
                    />
                  </View>
                  <View style={styles.catMetaRow}>
                    <Text style={styles.catMeta}>
                      {cat.count} {cat.count === 1 ? 'expense' : 'expenses'}
                    </Text>
                    <Text style={styles.catMeta}>{cat.percentage.toFixed(1)}%</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </View>

      {/* ── MONTHLY SPENDING VELOCITY ── */}
      {stats.monthlyTrends.length > 0 && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Calendar size={16} color={THEME.colors.warning} />
            <Text style={styles.sectionTitle}>Monthly Spend Velocity</Text>
          </View>
          <Text style={styles.sectionSubtitle}>Total spending pace by month</Text>

          <View style={styles.monthlyVelocityRow}>
            {stats.monthlyTrends.map((m) => {
              const heightPct = Math.round((m.total / stats.maxMonthlySpend) * 100);
              return (
                <View key={m.month} style={styles.monthColumn}>
                  <Text style={styles.monthAmountText}>
                    {formatCurrency(m.total, { decimals: 0 })}
                  </Text>
                  <View style={styles.monthBarTrack}>
                    <View style={[styles.monthBarFill, { height: `${Math.max(heightPct, 8)}%` }]} />
                  </View>
                  <Text style={styles.monthLabel}>{m.month}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 14,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    gap: 4,
  },
  kpiIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: THEME.colors.textMuted,
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.3,
  },
  sectionCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: -6,
  },
  memberList: {
    gap: 14,
    marginTop: 4,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  memberInfo: {
    flex: 1,
    gap: 4,
  },
  memberNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberName: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
    flex: 1,
  },
  memberAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: THEME.colors.primary,
    borderRadius: 3,
  },
  memberPercentage: {
    fontSize: 11,
    fontWeight: '500',
    color: THEME.colors.textMuted,
  },
  categoryList: {
    gap: 14,
    marginTop: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  catIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catInfo: {
    flex: 1,
    gap: 4,
  },
  catNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catName: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
    flex: 1,
  },
  catAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  catProgressBarFill: {
    height: '100%',
    backgroundColor: THEME.colors.info,
    borderRadius: 3,
  },
  catMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catMeta: {
    fontSize: 11,
    fontWeight: '500',
    color: THEME.colors.textMuted,
  },
  monthlyVelocityRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 120,
    paddingTop: 10,
  },
  monthColumn: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  monthAmountText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  monthBarTrack: {
    width: 28,
    height: 70,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.radius.xs,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  monthBarFill: {
    width: '100%',
    backgroundColor: THEME.colors.warning,
    borderRadius: THEME.radius.xs,
  },
  monthLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  emptyText: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
