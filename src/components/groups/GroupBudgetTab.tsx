import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import {
  ChevronLeft,
  ChevronRight,
  Sliders,
  Target,
  Plus,
  Users,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { useAppTheme } from '../../contexts/theme.context';
import { GroupDetailData, GroupExpense } from '../../services/group.service';
import { haptics } from '../../services/haptics.service';
import {
  calculateGroupBudgetStats,
  GroupBudgetStats,
  CategorySpend,
  TopSpender,
  CURRENCY_SYMBOL,
} from '../../utils/budget-utils';
import { MASTER_CATEGORY_ICONS, MASTER_CATEGORY_COLORS } from '../../utils/category-icons';
import { SetBudgetModal } from './SetBudgetModal';

interface GroupBudgetTabProps {
  group: GroupDetailData;
  expenses: GroupExpense[];
  onBudgetUpdated: () => void;
}

export const GroupBudgetTab: React.FC<GroupBudgetTabProps> = ({
  group,
  expenses,
  onBudgetUpdated,
}) => {
  const { currentAccent } = useAppTheme();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  const stats: GroupBudgetStats = useMemo(() => {
    return calculateGroupBudgetStats(group, expenses, selectedDate);
  }, [group, expenses, selectedDate]);

  const isArchived = Boolean(group.archived || group.archivedAt);

  const handlePrevMonth = useCallback(() => {
    haptics.tap();
    setSelectedDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    haptics.tap();
    setSelectedDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  }, []);

  const handleResetToCurrentMonth = useCallback(() => {
    haptics.tap();
    setSelectedDate(new Date());
  }, []);

  const now = new Date();
  const isCurrentMonth =
    selectedDate.getFullYear() === now.getFullYear() &&
    selectedDate.getMonth() === now.getMonth();

  // Helper for recommendation icon
  const renderSuggestionIcon = (type: string) => {
    switch (type) {
      case 'danger':
        return <TrendingDown size={16} color={THEME.colors.negative} />;
      case 'warning':
        return <AlertTriangle size={16} color={THEME.colors.warning} />;
      case 'success':
        return <TrendingUp size={16} color={THEME.colors.success} />;
      default:
        return <ShieldCheck size={16} color={currentAccent.primary} />;
    }
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'healthy':
        return {
          pillBg: 'rgba(16, 185, 129, 0.14)',
          pillBorder: 'rgba(16, 185, 129, 0.35)',
          pillText: THEME.colors.successLight,
          label: 'On Track',
          barColor: THEME.colors.success,
        };
      case 'caution':
        return {
          pillBg: 'rgba(245, 158, 11, 0.14)',
          pillBorder: 'rgba(245, 158, 11, 0.35)',
          pillText: THEME.colors.warningLight,
          label: 'Caution (75%)',
          barColor: THEME.colors.warning,
        };
      case 'warning':
        return {
          pillBg: 'rgba(249, 115, 22, 0.14)',
          pillBorder: 'rgba(249, 115, 22, 0.35)',
          pillText: '#FB923C',
          label: 'Warning (90%)',
          barColor: '#F97316',
        };
      case 'overbudget':
        return {
          pillBg: 'rgba(244, 63, 94, 0.14)',
          pillBorder: 'rgba(244, 63, 94, 0.35)',
          pillText: THEME.colors.negativeLight,
          label: 'Over Budget',
          barColor: THEME.colors.negative,
        };
      default:
        return {
          pillBg: 'rgba(255, 255, 255, 0.08)',
          pillBorder: THEME.colors.border,
          pillText: THEME.colors.textMuted,
          label: 'No Budget',
          barColor: currentAccent.primary,
        };
    }
  };

  const statusStyle = getStatusStyles(stats.status);

  return (
    <View style={styles.container}>
      {/* Month Selector Bar */}
      <View style={styles.monthSelectorBar}>
        <View style={styles.monthControls}>
          <TouchableOpacity
            style={styles.monthNavBtn}
            onPress={handlePrevMonth}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeft size={18} color={THEME.colors.text} />
          </TouchableOpacity>

          <Text style={styles.monthTitle}>
            {stats.monthName} {stats.year}
          </Text>

          <TouchableOpacity
            style={styles.monthNavBtn}
            onPress={handleNextMonth}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronRight size={18} color={THEME.colors.text} />
          </TouchableOpacity>

          {!isCurrentMonth && (
            <TouchableOpacity
              style={styles.todayPillBtn}
              onPress={handleResetToCurrentMonth}
              activeOpacity={0.7}
            >
              <Text style={styles.todayPillText}>Today</Text>
            </TouchableOpacity>
          )}
        </View>

        {!isArchived && (
          <TouchableOpacity
            style={styles.setBudgetBtn}
            onPress={() => {
              haptics.tap();
              setModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <Sliders size={13} color={currentAccent.primary} />
            <Text style={[styles.setBudgetBtnText, { color: currentAccent.primary }]}>
              {stats.hasBudget ? 'Edit Budget' : 'Set Budget'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* STATE 1: No Budget Configured */}
      {!stats.isEnabled || stats.monthlyLimit === 0 ? (
        <View style={styles.emptyBudgetCard}>
          <View style={[styles.emptyIconCircle, { backgroundColor: currentAccent.primaryMuted }]}>
            <Target size={28} color={currentAccent.primary} />
          </View>
          <Text style={styles.emptyCardTitle}>No Monthly Budget Set</Text>
          <Text style={styles.emptyCardDescription}>
            Set a monthly spending limit for {group.name} to track shared expenditures, safe daily burn rates, and pacing recommendations.
          </Text>

          {!isArchived ? (
            <TouchableOpacity
              style={[styles.emptyCtaBtn, { backgroundColor: currentAccent.primary }]}
              onPress={() => {
                haptics.confirm();
                setModalVisible(true);
              }}
              activeOpacity={0.85}
            >
              <Plus size={15} color={THEME.colors.primaryForeground} strokeWidth={2.5} />
              <Text style={styles.emptyCtaText}>
                Set {stats.monthName} Budget
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.emptyCtaBtn, { backgroundColor: THEME.colors.surfaceSubtle, borderWidth: 1, borderColor: THEME.colors.border }]}>
              <Text style={[styles.emptyCtaText, { color: THEME.colors.textMuted }]}>
                Group is Archived
              </Text>
            </View>
          )}
        </View>
      ) : (
        <>
          {/* STATE 2: Unified Hero Centerpiece Card */}
          <View style={styles.heroCard}>
            <View style={styles.heroTopSection}>
              {/* Header: Status Pill & Days Left */}
              <View style={styles.heroStatusRow}>
                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor: statusStyle.pillBg,
                      borderColor: statusStyle.pillBorder,
                    },
                  ]}
                >
                  <Text style={[styles.statusPillText, { color: statusStyle.pillText }]}>
                    {statusStyle.label}
                  </Text>
                </View>

                <Text style={styles.daysLeftText}>
                  {stats.daysRemaining} {stats.daysRemaining === 1 ? 'day' : 'days'} left in {stats.monthName}
                </Text>
              </View>

              {/* Main Focal Point: Big Remaining Balance */}
              <View style={styles.balanceSection}>
                <Text style={styles.balanceLabel}>
                  {stats.remainingBudget >= 0 ? 'REMAINING BALANCE' : 'OVER LIMIT BY'}
                </Text>

                <View style={styles.balanceAmountRow}>
                  <Text
                    style={[
                      styles.balanceAmountText,
                      stats.remainingBudget < 0 && styles.balanceAmountOverlimit,
                    ]}
                  >
                    {CURRENCY_SYMBOL}{Math.abs(stats.remainingBudget).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </Text>

                  <Text style={styles.balanceBudgetSubtext}>
                    of {CURRENCY_SYMBOL}{stats.monthlyLimit.toLocaleString('en-IN')} budget
                  </Text>
                </View>
              </View>

              {/* Smooth Progress Bar */}
              <View style={styles.progressBarSection}>
                <View style={styles.progressLabelsRow}>
                  <Text style={styles.progressLabel}>
                    {stats.percentageUsed.toFixed(0)}% spent
                  </Text>
                  <Text style={styles.progressLabel}>
                    {Math.max(0, 100 - stats.percentageUsed).toFixed(0)}% available
                  </Text>
                </View>

                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${Math.min(100, Math.max(0, stats.percentageUsed))}%`,
                        backgroundColor: statusStyle.barColor,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>

            {/* Bottom 3-Column Stats Ribbon */}
            <View style={styles.statsRibbon}>
              <View style={styles.ribbonCol}>
                <Text style={styles.ribbonLabel}>Spent So Far</Text>
                <Text style={styles.ribbonValue}>
                  {CURRENCY_SYMBOL}{stats.totalSpentThisMonth.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </Text>
              </View>

              <View style={styles.ribbonDivider} />

              <View style={styles.ribbonCol}>
                <Text style={styles.ribbonLabel}>Safe Daily Burn</Text>
                <View style={styles.ribbonValueRow}>
                  <Text style={styles.ribbonValue}>
                    {CURRENCY_SYMBOL}{stats.dailySafeLimit.toFixed(0)}
                  </Text>
                  <Text style={styles.ribbonValueUnit}>/day</Text>
                </View>
              </View>

              <View style={styles.ribbonDivider} />

              <View style={styles.ribbonCol}>
                <Text style={styles.ribbonLabel}>Projected Finish</Text>
                <Text
                  style={[
                    styles.ribbonValue,
                    stats.projectedVariance > 0 && styles.ribbonValueWarning,
                  ]}
                >
                  {CURRENCY_SYMBOL}{stats.projectedMonthEndSpend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </Text>
              </View>
            </View>
          </View>

          {/* Smart Pacing Recommendation Banner */}
          {stats.suggestions.length > 0 && (
            <View
              style={[
                styles.suggestionBanner,
                stats.suggestions[0].type === 'danger' && styles.suggestionDanger,
                stats.suggestions[0].type === 'warning' && styles.suggestionWarning,
                stats.suggestions[0].type === 'success' && styles.suggestionSuccess,
                stats.suggestions[0].type === 'info' && styles.suggestionInfo,
              ]}
            >
              <View
                style={[
                  styles.suggestionIconWrap,
                  stats.suggestions[0].type === 'danger' && styles.suggestionIconDanger,
                  stats.suggestions[0].type === 'warning' && styles.suggestionIconWarning,
                  stats.suggestions[0].type === 'success' && styles.suggestionIconSuccess,
                  stats.suggestions[0].type === 'info' && styles.suggestionIconInfo,
                ]}
              >
                {renderSuggestionIcon(stats.suggestions[0].type)}
              </View>

              <View style={styles.suggestionTextCol}>
                <View style={styles.suggestionTitleRow}>
                  <Text style={styles.suggestionTitle}>{stats.suggestions[0].title}</Text>
                  {stats.suggestions[0].tag && (
                    <View style={styles.suggestionTagPill}>
                      <Text style={styles.suggestionTagText}>{stats.suggestions[0].tag}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.suggestionDescription}>
                  {stats.suggestions[0].description}
                </Text>
              </View>
            </View>
          )}

          {/* Category Breakdown Card */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Category Breakdown</Text>
              <Text style={styles.sectionBadge}>
                {stats.categoryBreakdowns.length} {stats.categoryBreakdowns.length === 1 ? 'Category' : 'Categories'}
              </Text>
            </View>

            {stats.categoryBreakdowns.length === 0 ? (
              <View style={styles.emptySectionContent}>
                <Text style={styles.emptySectionText}>
                  No categorized expenses in {stats.monthName}.
                </Text>
              </View>
            ) : (
              <View style={styles.categoriesList}>
                {stats.categoryBreakdowns.map((cat: CategorySpend) => {
                  const IconComp = MASTER_CATEGORY_ICONS[cat.category] || Target;
                  const catColor = MASTER_CATEGORY_COLORS[cat.category] || THEME.colors.primary;

                  return (
                    <View key={cat.category} style={styles.categoryItem}>
                      <View style={styles.categoryItemHeader}>
                        <View style={styles.categoryLeft}>
                          <View
                            style={[
                              styles.categoryItemIconWrap,
                              { backgroundColor: `${catColor}18` },
                            ]}
                          >
                            <IconComp size={15} color={catColor} />
                          </View>

                          <View style={styles.categoryNameCol}>
                            <Text style={styles.categoryItemName} numberOfLines={1}>
                              {cat.category}
                            </Text>
                            <Text style={styles.categoryExpenseCount}>
                              {cat.expenseCount} {cat.expenseCount === 1 ? 'expense' : 'expenses'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.categoryRight}>
                          {cat.allocatedLimit ? (
                            <Text style={styles.categoryCapText}>
                              Cap: {CURRENCY_SYMBOL}{cat.allocatedLimit.toLocaleString('en-IN')}
                            </Text>
                          ) : null}

                          <View style={styles.categoryAmountRow}>
                            <Text
                              style={[
                                styles.categoryAmountText,
                                cat.isOverLimit && styles.categoryAmountOverLimit,
                              ]}
                            >
                              {CURRENCY_SYMBOL}{cat.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </Text>
                            <Text style={styles.categoryPercentText}>
                              {cat.percentageOfSpend.toFixed(0)}%
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Mini Progress Bar */}
                      <View style={styles.categoryProgressTrack}>
                        <View
                          style={[
                            styles.categoryProgressFill,
                            {
                              width: `${Math.min(100, Math.max(0, cat.percentageOfSpend))}%`,
                              backgroundColor: cat.isOverLimit ? THEME.colors.negative : catColor,
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

          {/* Top Payers Card */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderLeft}>
                <Users size={16} color={currentAccent.primary} />
                <Text style={styles.sectionTitle}>Top Payers</Text>
              </View>
              <Text style={styles.sectionBadge}>
                {stats.topSpenders.length} {stats.topSpenders.length === 1 ? 'Payer' : 'Payers'}
              </Text>
            </View>

            {stats.topSpenders.length === 0 ? (
              <View style={styles.emptySectionContent}>
                <Text style={styles.emptySectionText}>
                  No payments recorded in {stats.monthName}.
                </Text>
              </View>
            ) : (
              <View style={styles.topPayersList}>
                {stats.topSpenders.map((spender: TopSpender, idx: number) => {
                  const initials = spender.name
                    ? spender.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)
                    : 'M';

                  return (
                    <View key={spender.userId || idx} style={styles.payerRow}>
                      <View style={styles.payerLeft}>
                        <View style={styles.payerRankBadge}>
                          <Text style={styles.payerRankText}>{idx + 1}</Text>
                        </View>

                        <View style={[styles.payerAvatarWrap, { backgroundColor: currentAccent.primaryMuted }]}>
                          {spender.avatarUrl ? (
                            <Image source={{ uri: spender.avatarUrl }} style={styles.payerAvatarImg} />
                          ) : (
                            <Text style={[styles.payerAvatarInitial, { color: currentAccent.primary }]}>{initials}</Text>
                          )}
                        </View>

                        <Text style={styles.payerName} numberOfLines={1}>
                          {spender.name}
                        </Text>
                      </View>

                      <View style={styles.payerRight}>
                        <Text style={styles.payerAmount}>
                          {CURRENCY_SYMBOL}{spender.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </Text>
                        <Text style={styles.payerPercent}>
                          {spender.percentage.toFixed(0)}%
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </>
      )}

      {/* Set/Edit Budget Modal */}
      {!isArchived && (
        <SetBudgetModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          groupId={group.id}
          groupName={group.name}
          initialBudget={group.budget}
          onSuccess={() => {
            onBudgetUpdated();
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingTop: 4,
  },
  monthSelectorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  monthControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  monthNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.text,
    paddingHorizontal: 4,
  },
  todayPillBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    marginLeft: 4,
  },
  todayPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  setBudgetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  setBudgetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  emptyBudgetCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: THEME.colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.colors.text,
    marginBottom: 6,
  },
  emptyCardDescription: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 290,
    marginBottom: 20,
  },
  emptyCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: THEME.colors.primary,
  },
  emptyCtaText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.primaryForeground,
  },
  heroCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    overflow: 'hidden',
  },
  heroTopSection: {
    padding: 18,
    gap: 16,
  },
  heroStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  daysLeftText: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
  },
  balanceSection: {
    gap: 2,
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
  },
  balanceAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 2,
  },
  balanceAmountText: {
    fontSize: 34,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.5,
  },
  balanceAmountOverlimit: {
    color: THEME.colors.negative,
  },
  balanceBudgetSubtext: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
  },
  progressBarSection: {
    gap: 6,
  },
  progressLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  statsRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  ribbonCol: {
    flex: 1,
    alignItems: 'center',
  },
  ribbonLabel: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
    marginBottom: 3,
  },
  ribbonValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  ribbonValue: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  ribbonValueUnit: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    marginLeft: 2,
  },
  ribbonValueWarning: {
    color: '#FB923C',
  },
  ribbonDivider: {
    width: 1,
    height: 24,
    backgroundColor: THEME.colors.hairline,
  },
  suggestionBanner: {
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
  },
  suggestionDanger: {
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
    borderColor: 'rgba(244, 63, 94, 0.28)',
  },
  suggestionWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.28)',
  },
  suggestionSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.28)',
  },
  suggestionInfo: {
    backgroundColor: 'rgba(28, 194, 159, 0.08)',
    borderColor: 'rgba(28, 194, 159, 0.28)',
  },
  suggestionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionIconDanger: {
    backgroundColor: 'rgba(244, 63, 94, 0.18)',
  },
  suggestionIconWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
  },
  suggestionIconSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
  },
  suggestionIconInfo: {
    backgroundColor: 'rgba(28, 194, 159, 0.18)',
  },
  suggestionTextCol: {
    flex: 1,
    gap: 3,
  },
  suggestionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  suggestionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
    flex: 1,
  },
  suggestionTagPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  suggestionTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  suggestionDescription: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    lineHeight: 17,
  },
  sectionCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  sectionBadge: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  emptySectionContent: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptySectionText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  categoriesList: {
    gap: 12,
  },
  categoryItem: {
    gap: 6,
  },
  categoryItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  categoryItemIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryNameCol: {
    flex: 1,
  },
  categoryItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  categoryExpenseCount: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  categoryRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  categoryCapText: {
    fontSize: 10,
    color: THEME.colors.textMuted,
  },
  categoryAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  categoryAmountText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  categoryAmountOverLimit: {
    color: THEME.colors.negative,
  },
  categoryPercentText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    width: 30,
    textAlign: 'right',
  },
  categoryProgressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  categoryProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  topPayersList: {
    gap: 8,
  },
  payerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 12,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  payerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  payerRankBadge: {
    width: 18,
    alignItems: 'center',
  },
  payerRankText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textMuted,
  },
  payerAvatarWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: THEME.colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  payerAvatarImg: {
    width: 30,
    height: 30,
  },
  payerAvatarInitial: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.primaryLight,
  },
  payerName: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text,
    flex: 1,
  },
  payerRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  payerAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.successLight,
  },
  payerPercent: {
    fontSize: 10,
    color: THEME.colors.textMuted,
  },
});
