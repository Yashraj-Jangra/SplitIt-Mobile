import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Settings,
  Plus,
  Search,
  ArrowRight,
  Zap,
  Utensils,
  Car,
  ShoppingBag,
  Sparkles,
  Receipt,
  Bot,
  Handshake,
  CheckCircle2,
} from 'lucide-react-native';
import { THEME } from '../../../src/constants/theme';
import { groupService, GroupDetailData } from '../../../src/services/group.service';
import { BudgetPacingRing } from '../../../src/components/budget/BudgetPacingRing';
import * as Haptics from 'expo-haptics';

export default function GroupDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [group, setGroup] = useState<GroupDetailData | null>(null);
  const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'budget' | 'activity'>('expenses');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadGroup = async () => {
      setLoading(true);
      const data = await groupService.getGroupDetails(id || 'default');
      setGroup(data);
      setLoading(false);
    };
    loadGroup();
  }, [id]);

  const handleTabChange = (tab: 'expenses' | 'balances' | 'budget' | 'activity') => {
    Haptics.selectionAsync();
    setActiveTab(tab);
  };

  const handleAddExpense = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/expenses/new');
  };

  if (loading || !group) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Filtered expenses
  const filteredExpenses = group.expenses.filter((exp) => {
    const matchesSearch = exp.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      categoryFilter === 'all' || exp.category.master.toLowerCase().includes(categoryFilter.toLowerCase());
    return matchesSearch && matchesCategory;
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          style={styles.iconButton}
        >
          <ArrowLeft size={20} color={THEME.colors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {group.name}
          </Text>
          <View style={styles.balanceBadge}>
            <Text
              style={[
                styles.balanceBadgeText,
                { color: group.yourNetBalance >= 0 ? THEME.colors.primary : THEME.colors.negative },
              ]}
            >
              {group.yourNetBalance >= 0 ? `+₹${group.yourNetBalance} (You get)` : `-₹${Math.abs(group.yourNetBalance)} (You owe)`}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            router.push(`/groups/${id}/settings`);
          }}
          style={styles.iconButton}
        >
          <Settings size={20} color={THEME.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Segmented Tab Navigation */}
      <View style={styles.segmentedTabBar}>
        {(['expenses', 'balances', 'budget', 'activity'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
            onPress={() => handleTabChange(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* TAB 1: EXPENSES */}
        {activeTab === 'expenses' && (
          <View style={styles.tabSection}>
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Search size={16} color={THEME.colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search expenses..."
                placeholderTextColor={THEME.colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* Category Filter Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {[
                { id: 'all', label: 'All' },
                { id: 'food', label: 'Food & Drink' },
                { id: 'transport', label: 'Transport' },
                { id: 'groceries', label: 'Groceries' },
              ].map((pill) => (
                <TouchableOpacity
                  key={pill.id}
                  style={[styles.filterPill, categoryFilter === pill.id && styles.filterPillActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setCategoryFilter(pill.id);
                  }}
                >
                  <Text style={[styles.filterPillText, categoryFilter === pill.id && styles.filterPillTextActive]}>
                    {pill.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Expense Rows */}
            <View style={styles.expensesList}>
              {filteredExpenses.map((exp) => (
                <View key={exp.id} style={styles.expenseCard}>
                  <View style={styles.categoryIconBadge}>
                    <Utensils size={18} color={THEME.colors.primaryLight} />
                  </View>
                  <View style={styles.expenseDetails}>
                    <Text style={styles.expenseTitle}>{exp.title}</Text>
                    <Text style={styles.expenseSubtitle}>
                      {exp.paidByName} paid ₹{exp.amount} • {exp.date}
                    </Text>
                  </View>
                  <View style={styles.impactContainer}>
                    {exp.yourImpact === 'get' ? (
                      <View style={styles.impactRight}>
                        <Text style={[styles.impactAmount, { color: THEME.colors.primary }]}>
                          +₹{exp.yourShare}
                        </Text>
                        <Text style={styles.impactLabel}>you get</Text>
                      </View>
                    ) : (
                      <View style={styles.impactRight}>
                        <Text style={[styles.impactAmount, { color: THEME.colors.negative }]}>
                          -₹{exp.yourShare}
                        </Text>
                        <Text style={styles.impactLabel}>you owe</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* TAB 2: BALANCES & SIMPLIFIED DEBTS */}
        {activeTab === 'balances' && (
          <View style={styles.tabSection}>
            <View style={styles.simplifiedHeaderCard}>
              <Sparkles size={16} color={THEME.colors.primary} />
              <Text style={styles.simplifiedHeaderText}>
                Simplified Debts: Convoluted circular debts collapsed into minimum payments using{' '}
                <Text style={{ fontWeight: '700', color: THEME.colors.text }}>@splitit/core</Text>.
              </Text>
            </View>

            {/* Debt Cards */}
            <View style={styles.debtsList}>
              {group.simplifiedDebts.map((debt, index) => (
                <View key={index} style={styles.debtCard}>
                  <View style={styles.debtInfoRow}>
                    <View style={styles.debtAvatar}>
                      <Text style={styles.avatarLetter}>{debt.fromName.charAt(0)}</Text>
                    </View>
                    <View style={styles.debtTextCol}>
                      <Text style={styles.debtPrimaryText}>
                        <Text style={{ fontWeight: '800' }}>{debt.fromName}</Text> owes{' '}
                        <Text style={{ fontWeight: '800' }}>{debt.toName}</Text>
                      </Text>
                      <Text style={styles.debtAmount}>₹{debt.amount.toLocaleString()}</Text>
                    </View>
                    {debt.toName === 'You' && (
                      <TouchableOpacity
                        style={styles.settleButton}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      >
                        <Zap size={14} color="#09090B" />
                        <Text style={styles.settleButtonText}>Settle</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>

            {/* Member Standings */}
            <View style={styles.standingsCard}>
              <Text style={styles.sectionHeaderTitle}>MEMBER STANDINGS</Text>
              {group.members.map((m) => (
                <View key={m.id} style={styles.standingRow}>
                  <Text style={styles.standingName}>{m.name}</Text>
                  <Text
                    style={[
                      styles.standingAmount,
                      { color: m.netBalance >= 0 ? THEME.colors.primary : THEME.colors.negative },
                    ]}
                  >
                    {m.netBalance >= 0 ? `+₹${m.netBalance}` : `-₹${Math.abs(m.netBalance)}`}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* TAB 3: BUDGET & PACING */}
        {activeTab === 'budget' && (
          <View style={styles.tabSection}>
            <View style={styles.budgetCard}>
              <BudgetPacingRing
                totalSpent={group.budget.totalSpent}
                totalLimit={group.budget.totalMonthlyLimit}
                daysRemaining={group.budget.daysRemaining}
                safeDailyAllowance={group.budget.safeDailyAllowance}
              />
            </View>

            {/* Category Allocations */}
            <View style={styles.categoryAllocationsCard}>
              <Text style={styles.sectionHeaderTitle}>CATEGORY BREAKDOWN</Text>
              {group.budget.categories.map((cat, idx) => {
                const percent = Math.min(100, Math.round((cat.spent / cat.limit) * 100));
                return (
                  <View key={idx} style={styles.catRow}>
                    <View style={styles.catLabelRow}>
                      <Text style={styles.catName}>{cat.name}</Text>
                      <Text style={styles.catNumbers}>
                        ₹{cat.spent.toLocaleString()} / ₹{cat.limit.toLocaleString()} ({percent}%)
                      </Text>
                    </View>
                    <View style={styles.catBarBackground}>
                      <View style={[styles.catBarFill, { width: `${percent}%`, backgroundColor: cat.color }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* TAB 4: ACTIVITY AUDIT FEED */}
        {activeTab === 'activity' && (
          <View style={styles.tabSection}>
            {group.activities.map((act) => (
              <View key={act.id} style={styles.activityCard}>
                <View style={styles.activityIconBadge}>
                  {act.type === 'budget_updated' ? (
                    <Bot size={18} color={THEME.colors.aiLight} />
                  ) : act.type === 'settlement' ? (
                    <Handshake size={18} color={THEME.colors.primary} />
                  ) : (
                    <Receipt size={18} color={THEME.colors.textSecondary} />
                  )}
                </View>
                <View style={styles.activityDetails}>
                  <Text style={styles.activityDescription}>
                    <Text style={{ fontWeight: '800' }}>{act.actorName}</Text> {act.description}
                  </Text>
                  <Text style={styles.activityTime}>{act.timeAgo}</Text>

                  {/* Granular Budget Diff Box */}
                  {act.diffData && (
                    <View style={styles.diffBox}>
                      {act.diffData.monthlyBudgetUnchanged && (
                        <View style={styles.diffUnchangedRow}>
                          <CheckCircle2 size={13} color={THEME.colors.primary} />
                          <Text style={styles.diffUnchangedText}>
                            Total monthly budget was not changed (₹35,000)
                          </Text>
                        </View>
                      )}
                      {act.diffData.categoryChanges?.map((ch, i) => (
                        <Text key={i} style={styles.diffChangeText}>
                          • {ch.name}:{' '}
                          <Text style={{ textDecorationLine: 'line-through', color: THEME.colors.textMuted }}>
                            ₹{ch.old.toLocaleString()}
                          </Text>{' '}
                          ➔{' '}
                          <Text style={{ color: THEME.colors.primary, fontWeight: '700' }}>
                            ₹{ch.new.toLocaleString()}
                          </Text>
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Floating Add Expense Action Button */}
      {activeTab === 'expenses' && (
        <TouchableOpacity style={styles.fab} onPress={handleAddExpense}>
          <Plus size={22} color="#09090B" />
        </TouchableOpacity>
      )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  iconButton: {
    padding: 8,
  },
  headerTitleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  balanceBadge: {
    marginTop: 2,
  },
  balanceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  segmentedTabBar: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surface,
    marginHorizontal: 16,
    marginVertical: 10,
    padding: 3,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: THEME.radius.sm,
  },
  tabButtonActive: {
    backgroundColor: THEME.colors.surfaceElevated,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  tabTextActive: {
    color: THEME.colors.text,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  tabSection: {
    gap: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    height: 42,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: THEME.colors.text,
    fontSize: 14,
  },
  filterRow: {
    gap: 8,
    paddingVertical: 4,
  },
  filterPill: {
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  filterPillActive: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderColor: THEME.colors.borderFocus,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  filterPillTextActive: {
    color: THEME.colors.text,
  },
  expensesList: {
    gap: 10,
  },
  expenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    padding: 14,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: 12,
  },
  categoryIconBadge: {
    width: 40,
    height: 40,
    borderRadius: THEME.radius.sm,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseDetails: {
    flex: 1,
  },
  expenseTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  expenseSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  impactContainer: {
    alignItems: 'flex-end',
  },
  impactRight: {
    alignItems: 'flex-end',
  },
  impactAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  impactLabel: {
    fontSize: 10,
    color: THEME.colors.textMuted,
  },
  simplifiedHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    padding: 12,
    borderRadius: THEME.radius.md,
  },
  simplifiedHeaderText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    flex: 1,
  },
  debtsList: {
    gap: 10,
  },
  debtCard: {
    backgroundColor: THEME.colors.surface,
    padding: 14,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  debtInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  debtAvatar: {
    width: 38,
    height: 38,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  debtTextCol: {
    flex: 1,
  },
  debtPrimaryText: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  debtAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: THEME.colors.text,
    marginTop: 2,
  },
  settleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: THEME.radius.sm,
  },
  settleButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#09090B',
  },
  standingsCard: {
    backgroundColor: THEME.colors.surface,
    padding: 16,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: 10,
  },
  sectionHeaderTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: THEME.colors.textMuted,
    marginBottom: 4,
  },
  standingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  standingName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  standingAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  budgetCard: {
    backgroundColor: THEME.colors.surface,
    padding: 20,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  categoryAllocationsCard: {
    backgroundColor: THEME.colors.surface,
    padding: 16,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
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
    height: 6,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  catBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  activityCard: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surface,
    padding: 14,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: 12,
  },
  activityIconBadge: {
    width: 36,
    height: 36,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityDetails: {
    flex: 1,
  },
  activityDescription: {
    fontSize: 13,
    color: THEME.colors.text,
  },
  activityTime: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  diffBox: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.sm,
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
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
});
