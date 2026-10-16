import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {
  Calendar as CalendarIcon,
  ChevronDown,
  TrendingUp,
  PieChart as PieChartIcon,
  Users,
  Award,
  Sparkles,
  Layers,
} from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { useAppTheme } from '../../contexts/theme.context';
import { useCurrency } from '../../contexts/currency.context';
import { haptics } from '../../services/haptics.service';
import { GroupDetailData, GroupExpense, GroupMember } from '../../services/group.service';
import { CategoryIcon, getCategoryColor } from '../../utils/category-icons';
import { DateRangePickerModal, DateRange } from '../common/DateRangePickerModal';
import { DonutChart, DonutSlice } from '../charts/DonutChart';
import { SpendingTimelineChart, TimelineDataPoint } from '../charts/SpendingTimelineChart';

interface GroupAnalysisTabProps {
  group: GroupDetailData | null;
  expenses: GroupExpense[];
  members: GroupMember[];
}

const CHART_PALETTE = [
  THEME.colors.palette.emerald,
  THEME.colors.palette.blue,
  THEME.colors.palette.purple,
  THEME.colors.palette.amber,
  THEME.colors.palette.cyan,
  THEME.colors.palette.pink,
  THEME.colors.palette.orange,
  THEME.colors.palette.indigo,
  THEME.colors.palette.teal,
  THEME.colors.palette.rose,
  THEME.colors.palette.slate,
];

export const GroupAnalysisTab: React.FC<GroupAnalysisTabProps> = ({
  group,
  expenses,
  members,
}) => {
  const { currentAccent } = useAppTheme();
  const { formatCurrency } = useCurrency();

  // Time Frame Filter State
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [expandedCategories, setExpandedCategories] = useState(false);
  const [selectedMemberSlice, setSelectedMemberSlice] = useState<string | null>(null);

  // Filter expenses by date range
  const filteredExpenses = useMemo(() => {
    const list = expenses || [];
    if (!dateRange.from && !dateRange.to) return list;

    return list.filter((exp) => {
      const d = exp.rawDate ? new Date(exp.rawDate) : new Date(exp.date);
      if (isNaN(d.getTime())) return true;

      if (dateRange.from) {
        const fromMidnight = new Date(
          dateRange.from.getFullYear(),
          dateRange.from.getMonth(),
          dateRange.from.getDate()
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

  // Compute Aggregates & Breakdowns
  const stats = useMemo(() => {
    const validExpenses = filteredExpenses;
    const totalSpend = validExpenses.reduce((acc, exp) => acc + (Number(exp.amount) || 0), 0);
    const memberCount = Math.max(members.length, 1);
    const avgPerMember = totalSpend / memberCount;

    // 1. Members Spending Share (What each member consumed / owed)
    const memberShareMap: Record<string, { member: GroupMember; share: number }> = {};
    members.forEach((m) => {
      memberShareMap[m.id] = { member: m, share: 0 };
    });

    validExpenses.forEach((exp) => {
      const expAmt = Number(exp.amount) || 0;
      if (expAmt <= 0) return;

      if (Array.isArray(exp.participants) && exp.participants.length > 0) {
        exp.participants.forEach((p: any) => {
          const pUid = p.user?.uid || p.user?.id || p.userId || p.id;
          const pOwed = Number(p.amountOwed ?? p.amount ?? p.share) || 0;
          if (pUid && memberShareMap[pUid]) {
            memberShareMap[pUid].share += pOwed;
          } else {
            const found = members.find(
              (m) =>
                m.name.toLowerCase() === (p.user?.name || p.name || '').toLowerCase() ||
                m.name.toLowerCase() === (p.user?.firstName || '').toLowerCase()
            );
            if (found && memberShareMap[found.id]) {
              memberShareMap[found.id].share += pOwed;
            }
          }
        });
      } else {
        // Equal split fallback if no participants array
        const perMember = expAmt / memberCount;
        members.forEach((m) => {
          if (memberShareMap[m.id]) {
            memberShareMap[m.id].share += perMember;
          }
        });
      }
    });

    // Fallback if all participants summed to 0 but expenses exist
    let totalCalculatedShare = Object.values(memberShareMap).reduce((acc, m) => acc + m.share, 0);
    if (totalCalculatedShare === 0 && totalSpend > 0) {
      const perMember = totalSpend / memberCount;
      members.forEach((m) => {
        if (memberShareMap[m.id]) memberShareMap[m.id].share = perMember;
      });
      totalCalculatedShare = totalSpend;
    }

    const memberShares = Object.values(memberShareMap)
      .map(({ member, share }, idx) => {
        const percentage = totalCalculatedShare > 0 ? (share / totalCalculatedShare) * 100 : 0;
        return {
          id: member.id,
          label: member.name,
          value: share,
          share,
          percentage,
          color: CHART_PALETTE[idx % CHART_PALETTE.length],
          avatarUrl: member.avatarUrl,
        };
      })
      .filter((m) => m.share > 0)
      .sort((a, b) => b.share - a.share);

    // 2. Category Distribution Breakdown
    const categoryMap: Record<string, { count: number; total: number; masterCategory?: string }> = {};
    validExpenses.forEach((exp) => {
      const catKey =
        typeof exp.category === 'object' && exp.category !== null
          ? (exp.category as any).sub || 'other'
          : String(exp.category || 'other');
      const masterCat =
        typeof exp.category === 'object' && exp.category !== null
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

    // 3. Spending Over Time Data
    const timelineMap: Record<string, { amount: number; fullDate: string }> = {};

    validExpenses.forEach((exp) => {
      const d = exp.rawDate ? new Date(exp.rawDate) : new Date(exp.date);
      if (isNaN(d.getTime())) return;

      let key = '';
      let displayLabel = '';
      let fullDateStr = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });

      if (frequency === 'daily') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        displayLabel = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      } else if (frequency === 'weekly') {
        const firstDayOfWeek = new Date(d);
        firstDayOfWeek.setDate(d.getDate() - d.getDay());
        key = `${firstDayOfWeek.getFullYear()}-W${Math.ceil(firstDayOfWeek.getDate() / 7)}`;
        displayLabel = firstDayOfWeek.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
        fullDateStr = `Week of ${displayLabel}`;
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        displayLabel = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
        fullDateStr = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      }

      if (!timelineMap[key]) {
        timelineMap[key] = { amount: 0, fullDate: fullDateStr };
      }
      timelineMap[key].amount += Number(exp.amount) || 0;
    });

    const timelineData: TimelineDataPoint[] = Object.entries(timelineMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, val], i, arr) => {
        const parts = val.fullDate.split(' ');
        const shortLabel = parts.length > 1 ? `${parts[0]} ${parts[1]}` : val.fullDate;
        return {
          label: shortLabel,
          amount: val.amount,
          fullDate: val.fullDate,
        };
      });

    return {
      totalSpend,
      avgPerMember,
      expenseCount: validExpenses.length,
      topCategory: categories[0]?.subCategory || 'N/A',
      memberShares,
      categories,
      timelineData,
    };
  }, [filteredExpenses, members, frequency]);

  // Date range label
  const rangeDisplayLabel = useMemo(() => {
    if (!dateRange.from && !dateRange.to) return 'All Time';
    const fmt = (d: Date) => d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    if (dateRange.from && dateRange.to) {
      return `${fmt(dateRange.from)} - ${fmt(dateRange.to)}`;
    }
    if (dateRange.from) return `From ${fmt(dateRange.from)}`;
    return `Until ${fmt(dateRange.to!)}`;
  }, [dateRange]);

  const visibleCategories = expandedCategories ? stats.categories : stats.categories.slice(0, 4);

  return (
    <View style={styles.container}>
      {/* ── TIME FRAME FILTER BAR (POPUP TRIGGER) ── */}
      <View style={styles.timeFrameBar}>
        <TouchableOpacity
          style={[
            styles.timeFrameBtn,
            (dateRange.from || dateRange.to) && [
              styles.timeFrameBtnActive,
              { backgroundColor: `${currentAccent.primary}15`, borderColor: currentAccent.primary },
            ],
          ]}
          onPress={() => {
            haptics.tap();
            setShowDatePickerModal(true);
          }}
          activeOpacity={0.7}
        >
          <CalendarIcon
            size={14}
            color={dateRange.from || dateRange.to ? currentAccent.primary : THEME.colors.textMuted}
          />
          <Text
            style={[
              styles.timeFrameText,
              (dateRange.from || dateRange.to) && { color: currentAccent.primary, fontWeight: '800' },
            ]}
          >
            {rangeDisplayLabel}
          </Text>
          <ChevronDown
            size={13}
            color={dateRange.from || dateRange.to ? currentAccent.primary : THEME.colors.textMuted}
          />
        </TouchableOpacity>

        {/* Quick Shortcut Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timePresetsContent}>
          <TouchableOpacity
            style={[styles.quickPresetPill, !dateRange.from && !dateRange.to && styles.quickPresetPillActive]}
            onPress={() => {
              haptics.tap();
              setDateRange({ from: null, to: null });
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.quickPresetText, !dateRange.from && !dateRange.to && { color: currentAccent.primary }]}>
              All Time
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickPresetPill}
            onPress={() => {
              haptics.tap();
              const now = new Date();
              setDateRange({
                from: new Date(now.getFullYear(), now.getMonth(), 1),
                to: now,
              });
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.quickPresetText}>This Month</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickPresetPill}
            onPress={() => {
              haptics.tap();
              const now = new Date();
              setDateRange({
                from: new Date(Date.now() - 30 * 86400000),
                to: now,
              });
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.quickPresetText}>Last 30D</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

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
          <Text style={styles.metricNodeLabel}>TOP CATEGORY</Text>
          <Text style={[styles.metricNodeValue, styles.topSpendValue]} numberOfLines={1}>
            {stats.topCategory.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* ── SPENDING OVER TIME CHART (IMPORTED FROM SITE) ── */}
      <View style={styles.sectionWrap}>
        <SpendingTimelineChart
          data={stats.timelineData}
          frequency={frequency}
          onChangeFrequency={setFrequency}
          height={165}
          title="SPENDING OVER TIME"
        />
      </View>

      {/* ── MEMBERS SPENDING SHARE (DONUT + SCROLLABLE MEMBER LIST) ── */}
      <View style={styles.editorialSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>MEMBER SPENDING SHARE</Text>
          {stats.memberShares.length > 0 && (
            <Text style={styles.sectionCount}>
              {stats.memberShares.length} {stats.memberShares.length === 1 ? 'member' : 'members'}
            </Text>
          )}
        </View>

        <View style={styles.donutCardContainer}>
          {stats.memberShares.length === 0 ? (
            <View style={styles.emptyStateBox}>
              <Text style={styles.emptyText}>No spending recorded by members yet</Text>
            </View>
          ) : (
            <View style={styles.donutLayoutRow}>
              {/* Left: Donut Chart */}
              <View style={styles.donutLeftCol}>
                <DonutChart
                  slices={stats.memberShares}
                  size={135}
                  strokeWidth={17}
                  centerValue={formatCurrency(stats.totalSpend, { decimals: 0 })}
                  centerLabel="Total"
                  selectedSliceId={selectedMemberSlice}
                  onSelectSlice={(s) => setSelectedMemberSlice(s ? s.id : null)}
                />
              </View>

              {/* Right: Scrollable Member Legend (Max Height = Donut Height: 135px) */}
              <View style={styles.donutRightCol}>
                <ScrollView
                  style={styles.membersScrollView}
                  contentContainerStyle={styles.membersScrollContent}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  {stats.memberShares.map((m) => {
                    const isSelected = selectedMemberSlice === m.id;
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[
                          styles.memberLegendRow,
                          isSelected && [
                            styles.memberLegendRowActive,
                            { backgroundColor: `${m.color}15`, borderColor: m.color },
                          ],
                        ]}
                        onPress={() => {
                          haptics.tap();
                          setSelectedMemberSlice(isSelected ? null : m.id);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.memberLegendDot, { backgroundColor: m.color }]} />

                        <View style={styles.memberLegendInfo}>
                          <Text style={styles.memberLegendName} numberOfLines={1}>
                            {m.label}
                          </Text>
                          <Text style={styles.memberLegendAmount}>
                            {formatCurrency(m.share, { decimals: 0 })}
                          </Text>
                        </View>

                        <Text style={[styles.memberLegendPercent, { color: m.color }]}>
                          {m.percentage.toFixed(0)}%
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* ── CATEGORY & ALLOCATIONS (SHOW TOP 4, CLICK TO EXPAND ALWAYS) ── */}
      <View style={styles.editorialSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>CATEGORY ALLOCATION</Text>
          {stats.categories.length > 0 && (
            <Text style={styles.sectionCount}>
              {stats.categories.length} {stats.categories.length === 1 ? 'category' : 'categories'}
            </Text>
          )}
        </View>

        <View style={styles.categoriesContainer}>
          {stats.categories.length === 0 ? (
            <View style={styles.emptyStateBox}>
              <Text style={styles.emptyText}>No categorized expenses in this period</Text>
            </View>
          ) : (
            <>
              {visibleCategories.map((cat, index) => {
                const catColor = getCategoryColor(cat.masterCategory, cat.subCategory);
                const isLast = index === visibleCategories.length - 1;

                return (
                  <View key={cat.subCategory} style={[styles.categoryRow, !isLast && styles.categoryRowBorder]}>
                    <View style={[styles.categoryGlyph, { backgroundColor: THEME.colors.surfaceElevated }]}>
                      <CategoryIcon
                        subCategory={cat.subCategory}
                        masterCategory={cat.masterCategory}
                        size={16}
                        color={catColor}
                      />
                    </View>

                    <View style={styles.categoryInfo}>
                      <View style={styles.categoryTitleRow}>
                        <Text style={styles.categoryName} numberOfLines={1}>
                          {cat.subCategory.charAt(0).toUpperCase() + cat.subCategory.slice(1)}
                        </Text>
                        <Text style={styles.categoryAmount}>{formatCurrency(cat.total, { decimals: 0 })}</Text>
                      </View>

                      {/* Hairline meter bar */}
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

                      <View style={styles.categorySubRow}>
                        <Text style={styles.categoryCount}>
                          {cat.count} {cat.count === 1 ? 'expense' : 'expenses'}
                        </Text>
                        <Text style={styles.categoryPercent}>{cat.percentage.toFixed(1)}%</Text>
                      </View>
                    </View>
                  </View>
                );
              })}

              {/* Expand / Collapse Button if > 4 Categories */}
              {stats.categories.length > 4 && (
                <TouchableOpacity
                  style={styles.expandCategoriesBtn}
                  onPress={() => {
                    haptics.tap();
                    setExpandedCategories((prev) => !prev);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.expandCategoriesText, { color: currentAccent.primary }]}>
                    {expandedCategories ? 'Show top 4 categories' : `Show all ${stats.categories.length} categories`}
                  </Text>
                  <ChevronDown
                    size={14}
                    color={currentAccent.primary}
                    style={{ transform: [{ rotate: expandedCategories ? '180deg' : '0deg' }] }}
                  />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>

      {/* Date Range Picker Modal */}
      <DateRangePickerModal
        visible={showDatePickerModal}
        onClose={() => setShowDatePickerModal(false)}
        range={dateRange}
        onApplyRange={(newRange) => setDateRange(newRange)}
        title="Analysis Date Range"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 36,
  },

  /* Time Frame Bar */
  timeFrameBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  timeFrameBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  timeFrameBtnActive: {
    borderWidth: 1.5,
  },
  timeFrameText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  timePresetsContent: {
    gap: 6,
    alignItems: 'center',
  },
  quickPresetPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  quickPresetPillActive: {
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  quickPresetText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },

  /* Metrics Ribbon */
  metricsRibbonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  metricNode: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  nodeHairline: {
    width: 1,
    height: 28,
    backgroundColor: THEME.colors.hairline,
  },
  metricNodeLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  metricNodeValue: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.3,
  },
  topSpendValue: {
    color: THEME.colors.palette.emerald,
    fontSize: 13,
  },

  sectionWrap: {
    marginBottom: 16,
  },

  /* Editorial Sections */
  editorialSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.7,
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },

  /* Donut Card */
  donutCardContainer: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    padding: 14,
  },
  donutLayoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  donutLeftCol: {
    width: 135,
    height: 135,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutRightCol: {
    flex: 1,
    height: 135,
  },
  membersScrollView: {
    maxHeight: 135,
  },
  membersScrollContent: {
    gap: 6,
    paddingRight: 4,
  },
  memberLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  memberLegendRowActive: {},
  memberLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  memberLegendInfo: {
    flex: 1,
  },
  memberLegendName: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  memberLegendAmount: {
    fontSize: 11,
    fontWeight: '500',
    color: THEME.colors.textMuted,
  },
  memberLegendPercent: {
    fontSize: 12,
    fontWeight: '800',
  },

  /* Categories Container */
  categoriesContainer: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    overflow: 'hidden',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  categoryRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.colors.hairline,
  },
  categoryGlyph: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  categoryAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  hairlineBarTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  hairlineBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  categorySubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryCount: {
    fontSize: 10,
    fontWeight: '500',
    color: THEME.colors.textMuted,
  },
  categoryPercent: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  expandCategoriesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.colors.hairline,
  },
  expandCategoriesText: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* Empty state */
  emptyStateBox: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textMuted,
  },
});
