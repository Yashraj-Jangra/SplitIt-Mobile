import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Receipt,
  Utensils,
  Car,
  Home,
  Zap,
  Heart,
  ShoppingBag,
  Plane,
  Wallet,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { expenseService, UserTransactionItem } from '../../src/services/expense.service';
import * as Haptics from 'expo-haptics';

const CATEGORY_ICONS: Record<string, any> = {
  'Food and Drink': Utensils,
  'Transportation': Car,
  'Home': Home,
  'Utilities': Zap,
  'Personal Care': Heart,
  'Shopping': ShoppingBag,
  'Travel': Plane,
  'Other': Wallet,
};

export default function ActivityScreen() {
  const [transactions, setTransactions] = useState<UserTransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const data = await expenseService.getUserExpenses(30);
      setTransactions(data);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadData();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
        <Text style={styles.subtitle}>Recent transactions & group changes</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={THEME.colors.primary}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={THEME.colors.primary} />
          </View>
        ) : transactions.length > 0 ? (
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <View style={styles.ledgerCard}>
              {transactions.map((tx, index) => {
                const IconComponent = CATEGORY_ICONS[tx.masterCategory] || Receipt;
                const isLast = index === transactions.length - 1;
                const isGet = tx.yourImpact === 'get';
                const isOwe = tx.yourImpact === 'owe';

                return (
                  <View
                    key={tx.id}
                    style={[styles.ledgerRow, !isLast && styles.ledgerRowBorder]}
                  >
                    <View style={styles.iconCircle}>
                      <IconComponent
                        size={16}
                        color={
                          isGet
                            ? THEME.colors.primary
                            : isOwe
                            ? THEME.colors.negative
                            : THEME.colors.textSecondary
                        }
                      />
                    </View>

                    <View style={styles.details}>
                      <Text style={styles.activityTitle} numberOfLines={1}>
                        {tx.title}
                      </Text>
                      <Text style={styles.activitySubtitle} numberOfLines={1}>
                        {tx.paidByName} • {tx.groupName}
                      </Text>
                      <Text style={styles.activityTime}>{tx.date}</Text>
                    </View>

                    <View style={styles.amountCol}>
                      <Text
                        style={[
                          styles.amountText,
                          isGet && { color: THEME.colors.primary },
                          isOwe && { color: THEME.colors.negative },
                        ]}
                      >
                        {isGet
                          ? `+₹${tx.yourShare || tx.amount}`
                          : isOwe
                          ? `-₹${tx.yourShare || tx.amount}`
                          : `₹${tx.amount}`}
                      </Text>
                      <Text style={styles.impactSub}>
                        {isGet ? 'you get' : isOwe ? 'you owe' : 'split'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Receipt size={32} color={THEME.colors.textMuted} />
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.emptySubtitle}>
              Shared expenses and updates will appear here automatically.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 32,
  },
  loadingBox: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  sectionWrap: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  ledgerCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    overflow: 'hidden',
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  ledgerRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  details: {
    flex: 1,
    marginRight: 12,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  activitySubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
  activityTime: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  amountCol: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  impactSub: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  emptyContainer: {
    paddingVertical: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.text,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
});
