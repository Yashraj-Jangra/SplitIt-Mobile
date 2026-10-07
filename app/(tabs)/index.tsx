import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
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
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { groupService, GroupListItem } from '../../src/services/group.service';
import { authService, AuthUser } from '../../src/services/auth.service';
import { expenseService, UserTransactionItem } from '../../src/services/expense.service';
import { balanceService, UserBalanceSummary } from '../../src/services/balance.service';
import { BrandLogoImage } from '../../src/components/brand/QuantumLogo';
import { ExpenseImpactCol } from '../../src/components/expenses/ExpenseImpactCol';
import { CategoryIcon } from '../../src/utils/category-icons';
import { BalanceHistoryGraph } from '../../src/components/dashboard/BalanceHistoryGraph';
import { BalanceSkeleton } from '../../src/components/skeletons/BalanceSkeleton';
import { TransactionRowSkeleton } from '../../src/components/skeletons/TransactionRowSkeleton';
import { useNetwork } from '../../src/contexts/network.context';
import { useAuth } from '../../src/contexts/auth.context';
import * as Haptics from 'expo-haptics';

export default function HomeScreen() {
  const router = useRouter();
  const { isOnline, requireOnline } = useNetwork();
  const { user: authUser } = useAuth();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => authUser || authService.getInMemoryUser());
  const [groups, setGroups] = useState<GroupListItem[]>(() => groupService.getInMemoryGroups());
  const [recentTransactions, setRecentTransactions] = useState<UserTransactionItem[]>(() => expenseService.getInMemoryUserExpenses());
  const [balanceSummary, setBalanceSummary] = useState<UserBalanceSummary | null>(() => balanceService.getInMemoryUserBalanceSummary());
  const [loading, setLoading] = useState(() => {
    return (
      groupService.getInMemoryGroups().length === 0 &&
      expenseService.getInMemoryUserExpenses().length === 0 &&
      !balanceService.getInMemoryUserBalanceSummary()
    );
  });
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const user = await authService.getCachedUser();
      setCurrentUser(user);
      const [groupList, txList, summary] = await Promise.all([
        groupService.getUserGroups(),
        expenseService.getUserExpenses(10),
        balanceService.getUserBalanceSummary(),
      ]);
      setGroups(groupList);
      setRecentTransactions(txList);
      setBalanceSummary(summary);
    } catch {
      // Fallback gracefully
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (authUser && !currentUser) setCurrentUser(authUser);
    // 0ms Fast Tick: Hydrate immediately from persistent offline storage
    Promise.all([
      authService.getCachedUser(),
      groupService.getCachedUserGroups(),
      expenseService.getCachedUserExpenses(),
      balanceService.getCachedUserBalanceSummary(),
    ]).then(([cachedUser, cachedGroups, cachedTx, cachedSummary]) => {
      if (cachedUser) setCurrentUser(cachedUser);
      if (cachedGroups && cachedGroups.length > 0) setGroups(cachedGroups);
      if (cachedTx && cachedTx.length > 0) setRecentTransactions(cachedTx);
      if (cachedSummary) setBalanceSummary(cachedSummary);
      if ((cachedGroups && cachedGroups.length > 0) || (cachedTx && cachedTx.length > 0) || cachedSummary) {
        setLoading(false);
      }
    });
    loadData();
  }, [authUser]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleAddExpense = () => {
    if (!requireOnline('create an expense')) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/expenses/new');
  };

  const handleSettleUp = () => {
    if (!requireOnline('record settlements')) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.colors.primary} />}
      >
        {/* Minimalist Header with Official Branding */}
        <View style={styles.header}>
          <View style={styles.brandHeaderLeft}>
            <BrandLogoImage size={34} />
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.brandTitleText}>SplitIt</Text>
              <Text style={styles.greetingText}>
                {getGreeting()}, {currentUser?.name?.split(' ')[0] || 'Friend'}
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.aiPill}
              activeOpacity={0.8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/ai/chat');
              }}
            >
              <Sparkles size={14} color={THEME.colors.aiLight} />
              <Text style={styles.aiPillText}>AI</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconCircle}
              activeOpacity={0.7}
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/notifications');
              }}
            >
              <Bell size={18} color={THEME.colors.text} />
              <View style={styles.bellDot} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Modern Fintech Balance Widget with Dedicated Non-Overlapping Sparkline Track */}
        {loading && !balanceSummary ? (
          <BalanceSkeleton />
        ) : (
          <View style={styles.balanceWidget}>
            {/* TIER 1: Hero Metrics Header */}
            <View style={styles.widgetHeader}>
              <View style={styles.widgetEyebrowRow}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        netBalance > 0.01
                          ? THEME.colors.primary
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
                      <TrendingUp size={11} color={THEME.colors.primary} />
                    ) : (
                      <TrendingDown size={11} color={THEME.colors.negative} />
                    )}
                    <Text
                      style={[
                        styles.widgetTrendText,
                        {
                          color:
                            balanceSummary.trendPercentage >= 0
                              ? THEME.colors.primary
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
                    netBalance > 0.01 && { color: THEME.colors.primary },
                    netBalance < -0.01 && { color: THEME.colors.negative },
                  ]}
                >
                  {netBalance > 0.01
                    ? `+₹${netBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : netBalance < -0.01
                    ? `-₹${Math.abs(netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '₹0.00'}
                </Text>
                <Text style={styles.widgetSubtitle}>
                  {netBalance > 0.01
                    ? 'Overall you are owed money'
                    : netBalance < -0.01
                    ? 'Overall you owe money'
                    : 'All settled up • No outstanding balance'}
                </Text>
              </View>
            </View>

            {/* TIER 2: Dedicated In-Flow Sparkline Track (Zero Overlap Guaranteed!) */}
            {balanceSummary && (
              <View style={styles.graphTrack}>
                <BalanceHistoryGraph
                  data={balanceSummary.chartData}
                  domain={balanceSummary.domain}
                  gradientOffset={balanceSummary.gradientOffset}
                  minBalance={balanceSummary.minBalance}
                  maxBalance={balanceSummary.maxBalance}
                  height={75}
                />
              </View>
            )}

            {/* TIER 3: Unboxed Stat Breakdown Footer */}
            <View style={styles.widgetFooter}>
              <View style={styles.statColumn}>
                <View style={styles.statLabelRow}>
                  <ArrowDownLeft size={12} color={THEME.colors.primary} strokeWidth={2.5} />
                  <Text style={styles.statLabel}>Owed to you</Text>
                </View>
                <Text style={[styles.statValue, { color: THEME.colors.primary }]}>
                  ₹{totalOwed.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statColumn}>
                <View style={styles.statLabelRow}>
                  <ArrowUpRight size={12} color={THEME.colors.negative} strokeWidth={2.5} />
                  <Text style={styles.statLabel}>You owe</Text>
                </View>
                <Text style={[styles.statValue, { color: THEME.colors.negative }]}>
                  ₹{totalOwe.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Tactile Action Dock */}
        <View style={styles.actionDock}>
          <TouchableOpacity
            style={styles.primaryActionBtn}
            onPress={handleAddExpense}
            activeOpacity={0.85}
          >
            <Plus size={18} color="#000000" strokeWidth={2.5} />
            <Text style={styles.primaryActionText}>Add Expense</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryActionBtn}
            onPress={handleSettleUp}
            activeOpacity={0.85}
          >
            <Handshake size={18} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.secondaryActionText}>Settle Up</Text>
          </TouchableOpacity>
        </View>

        {/* Active Groups Pebble Strip */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Groups</Text>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
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
            {groups.slice(0, 5).map((group) => {
              const isOwed = group.userNetBalance > 0;
              const isOwe = group.userNetBalance < 0;

              return (
                <TouchableOpacity
                  key={group.id}
                  style={styles.groupPebble}
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.selectionAsync();
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
                      isOwed && { color: THEME.colors.primary },
                      isOwe && { color: THEME.colors.negative },
                    ]}
                  >
                    {isOwed
                      ? `+₹${group.userNetBalance.toLocaleString('en-IN')}`
                      : isOwe
                      ? `-₹${Math.abs(group.userNetBalance).toLocaleString('en-IN')}`
                      : 'Settled'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Ambient AI Intelligence Capsule */}
        <TouchableOpacity
          style={styles.aiInsightCard}
          activeOpacity={0.8}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/ai/chat');
          }}
        >
          <View style={styles.aiInsightIconWrap}>
            <Sparkles size={16} color={THEME.colors.aiLight} />
          </View>
          <View style={styles.aiInsightContent}>
            <Text style={styles.aiInsightEyebrow}>SMART INSIGHT</Text>
            <Text style={styles.aiInsightBody}>
              Your spending is <Text style={{ color: THEME.colors.primaryLight, fontWeight: '700' }}>8% lower</Text> than last month. Group budgets are balanced.
            </Text>
          </View>
          <ChevronRight size={16} color={THEME.colors.textMuted} />
        </TouchableOpacity>

        {/* Recent Splits Ledger (Apple Wallet Style Continuous Stream) */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
          </View>

          <View style={styles.ledgerStream}>
            {recentTransactions.length > 0 ? (
              recentTransactions.map((tx, index) => {
                const isLast = index === recentTransactions.length - 1;
                const isGet = tx.yourImpact === 'get';
                const isOwe = tx.yourImpact === 'owe';

                return (
                  <TouchableOpacity
                    key={tx.id}
                    style={[styles.ledgerRow, !isLast && styles.ledgerRowBorder]}
                    activeOpacity={0.7}
                    onPress={() => {
                      Haptics.selectionAsync();
                      router.push({
                        pathname: '/expenses/[id]',
                        params: {
                          id: tx.id,
                          groupId: tx.groupId,
                          title: tx.title,
                          amount: String(tx.amount),
                          paidByName: tx.paidByName,
                          date: tx.date,
                          category: tx.category,
                        },
                      });
                    }}
                  >
                    <View style={styles.ledgerIconCircle}>
                      <CategoryIcon subCategory={tx.category} masterCategory={tx.masterCategory} size={16} color={THEME.colors.textSecondary} />
                    </View>

                    <View style={styles.ledgerInfo}>
                      <Text style={styles.ledgerTitle} numberOfLines={1}>
                        {tx.title}
                      </Text>
                      <Text style={styles.ledgerSubline}>
                        {tx.groupName} • {tx.date}
                      </Text>
                    </View>

                    <ExpenseImpactCol expense={tx} currentUserId={currentUser?.id} />
                  </TouchableOpacity>
                );
              })
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
    gap: 24,
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
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
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
    flex: 1,
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
    color: '#000000',
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
    backgroundColor: '#0D0A14',
    padding: 14,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.22)',
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
    paddingHorizontal: 12,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  ledgerRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  ledgerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ledgerInfo: {
    flex: 1,
  },
  ledgerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  ledgerSubline: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  ledgerAmountCol: {
    alignItems: 'flex-end',
  },
  ledgerAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  ledgerImpactLabel: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
});
