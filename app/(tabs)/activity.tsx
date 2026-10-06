import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Receipt } from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { expenseService, UserTransactionItem } from '../../src/services/expense.service';
import { ExpenseImpactCol } from '../../src/components/expenses/ExpenseImpactCol';
import { CategoryIcon } from '../../src/utils/category-icons';
import * as Haptics from 'expo-haptics';

export default function ActivityScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<UserTransactionItem[]>(() => expenseService.getInMemoryUserExpenses());
  const [loading, setLoading] = useState(() => expenseService.getInMemoryUserExpenses().length === 0);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const data = await expenseService.getUserExpenses(30);
      if (data && data.length > 0) {
        setTransactions(data);
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (transactions.length === 0) {
      expenseService.getCachedUserExpenses().then((cached) => {
        if (cached && cached.length > 0) {
          setTransactions(cached);
          setLoading(false);
        }
      });
    }
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
        {loading && transactions.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={THEME.colors.primary} />
          </View>
        ) : transactions.length > 0 ? (
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <View style={styles.ledgerCard}>
              {transactions.map((tx, index) => {
                const isLast = index === transactions.length - 1;
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
                    <View style={styles.iconCircle}>
                      <CategoryIcon
                        subCategory={tx.category}
                        masterCategory={tx.masterCategory}
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

                    <ExpenseImpactCol expense={tx} />
                  </TouchableOpacity>
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
