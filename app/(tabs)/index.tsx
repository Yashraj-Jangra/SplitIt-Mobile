import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Sparkles, Bell, Handshake, ChevronRight, ArrowUpRight, ArrowDownLeft, Utensils, Car, ShoppingBag, Palmtree, Home } from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { groupService, GroupListItem } from '../../src/services/group.service';
import { authService, AuthUser } from '../../src/services/auth.service';
import * as Haptics from 'expo-haptics';

export default function HomeScreen() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const user = await authService.getCachedUser();
        setCurrentUser(user);
        const groupList = await groupService.getUserGroups();
        setGroups(groupList);
      } catch {
        // Fallback gracefully
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleAddExpense = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/expenses/new');
  };

  const handleSettleUp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/settle/new');
  };

  // Compute aggregate numbers from real groups or curated demo fallback
  const totalOwed = groups.reduce((acc, g) => acc + (g.userNetBalance > 0 ? g.userNetBalance : 0), 0) || 18500;
  const totalOwe = Math.abs(groups.reduce((acc, g) => acc + (g.userNetBalance < 0 ? g.userNetBalance : 0), 0)) || 4250;
  const netBalance = totalOwed - totalOwe;

  // Time-aware greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Minimalist Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greetingText}>{getGreeting()}</Text>
            <Text style={styles.userNameText}>{currentUser?.name || 'Yashraj'}</Text>
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

        {/* Open Canvas Hero Balance (Borderless & Confident) */}
        <View style={styles.heroSection}>
          <Text style={styles.heroEyebrow}>TOTAL BALANCE</Text>
          <Text style={styles.heroNumber}>
            {netBalance >= 0 ? `+₹${netBalance.toLocaleString('en-IN')}` : `-₹${Math.abs(netBalance).toLocaleString('en-IN')}`}
          </Text>

          <View style={styles.heroBreakdownRow}>
            <View style={styles.heroStatItem}>
              <ArrowDownLeft size={13} color={THEME.colors.primary} />
              <Text style={styles.heroStatLabel}>Owed to you</Text>
              <Text style={[styles.heroStatValue, { color: THEME.colors.primary }]}>
                ₹{totalOwed.toLocaleString('en-IN')}
              </Text>
            </View>

            <View style={styles.heroStatDivider} />

            <View style={styles.heroStatItem}>
              <ArrowUpRight size={13} color={THEME.colors.negative} />
              <Text style={styles.heroStatLabel}>You owe</Text>
              <Text style={[styles.heroStatValue, { color: THEME.colors.negative }]}>
                ₹{totalOwe.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
        </View>

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
            {[
              {
                id: 'tx_1',
                title: 'Dinner at Social',
                group: 'Apartment Flatmates 🏠',
                time: 'Today',
                amount: 1400,
                type: 'get',
                icon: Utensils,
              },
              {
                id: 'tx_2',
                title: 'High-speed Fiber Internet',
                group: 'Apartment Flatmates 🏠',
                time: 'Yesterday',
                amount: 800,
                type: 'owe',
                icon: Car,
              },
              {
                id: 'tx_3',
                title: 'Supermarket Groceries',
                group: 'Apartment Flatmates 🏠',
                time: '04 Oct',
                amount: 600,
                type: 'get',
                icon: ShoppingBag,
              },
            ].map((tx, index, arr) => {
              const IconComp = tx.icon;
              const isLast = index === arr.length - 1;

              return (
                <View key={tx.id} style={[styles.ledgerRow, !isLast && styles.ledgerRowBorder]}>
                  <View style={styles.ledgerIconCircle}>
                    <IconComp size={16} color={THEME.colors.textSecondary} />
                  </View>

                  <View style={styles.ledgerInfo}>
                    <Text style={styles.ledgerTitle} numberOfLines={1}>
                      {tx.title}
                    </Text>
                    <Text style={styles.ledgerSubline}>
                      {tx.group} • {tx.time}
                    </Text>
                  </View>

                  <View style={styles.ledgerAmountCol}>
                    <Text
                      style={[
                        styles.ledgerAmount,
                        tx.type === 'get' ? { color: THEME.colors.primary } : { color: THEME.colors.negative },
                      ]}
                    >
                      {tx.type === 'get' ? `+₹${tx.amount}` : `-₹${tx.amount}`}
                    </Text>
                    <Text style={styles.ledgerImpactLabel}>
                      {tx.type === 'get' ? 'you get' : 'you owe'}
                    </Text>
                  </View>
                </View>
              );
            })}
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
  greetingText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
    letterSpacing: 0.2,
  },
  userNameText: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.4,
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

  // Hero Balance Section (Open Canvas)
  heroSection: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: THEME.colors.textMuted,
    marginBottom: 6,
  },
  heroNumber: {
    fontSize: 42,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -1.2,
    marginBottom: 16,
  },
  heroBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  heroStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroStatLabel: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
  },
  heroStatValue: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  heroStatDivider: {
    width: 1,
    height: 12,
    backgroundColor: THEME.colors.hairlineLight,
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
