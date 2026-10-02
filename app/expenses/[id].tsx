import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  X,
  Trash2,
  Receipt,
  Utensils,
  Car,
  ShoppingBag,
  Sparkles,
  User,
  Handshake,
  Calendar,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import * as Haptics from 'expo-haptics';

export default function ExpenseDetailModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    title?: string;
    amount?: string;
    paidByName?: string;
    date?: string;
    category?: string;
  }>();

  const title = params.title || 'Dinner at Social';
  const amount = parseFloat(params.amount || '1200') || 1200;
  const paidByName = params.paidByName || 'You';
  const date = params.date || 'Today, 8:30 PM';
  const category = params.category || 'Dining Out';

  const sharePerPerson = (amount / 3).toFixed(2);

  const handleDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Delete Expense',
      `Are you sure you want to delete "${title}"? This will recalculate all group balances.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          },
        },
      ]
    );
  };

  const handleSettleUp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/settle/new',
      params: { amount: sharePerPerson },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          style={styles.closeButton}
        >
          <X size={20} color={THEME.colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Expense Details</Text>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
          <Trash2 size={18} color={THEME.colors.negative} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero Amount Display */}
        <View style={styles.heroCard}>
          <View style={styles.categoryBadge}>
            <Utensils size={16} color={THEME.colors.primary} />
            <Text style={styles.categoryText}>{category}</Text>
          </View>
          <Text style={styles.heroAmount}>₹{amount.toFixed(2)}</Text>
          <Text style={styles.heroTitle}>{title}</Text>
          <View style={styles.dateRow}>
            <Calendar size={13} color={THEME.colors.textMuted} />
            <Text style={styles.dateText}>{date}</Text>
          </View>
        </View>

        {/* Paid By Card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>PAID BY</Text>
          <View style={styles.paidByRow}>
            <View style={styles.payerAvatar}>
              <User size={18} color={THEME.colors.primary} />
            </View>
            <View style={styles.payerDetails}>
              <Text style={styles.payerName}>{paidByName}</Text>
              <Text style={styles.payerSub}>Paid the full total (₹{amount.toFixed(2)})</Text>
            </View>
          </View>
        </View>

        {/* Split Breakdown */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>SPLIT BREAKDOWN (EQUAL SPLIT)</Text>
          <View style={styles.splitRow}>
            <Text style={styles.splitUser}>You</Text>
            <Text style={styles.splitAmount}>₹{sharePerPerson}</Text>
          </View>
          <View style={[styles.splitRow, styles.borderTop]}>
            <Text style={styles.splitUser}>Rohit Sharma</Text>
            <Text style={styles.splitAmount}>₹{sharePerPerson}</Text>
          </View>
          <View style={[styles.splitRow, styles.borderTop]}>
            <Text style={styles.splitUser}>Priya Patel</Text>
            <Text style={styles.splitAmount}>₹{sharePerPerson}</Text>
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity style={styles.settleButton} onPress={handleSettleUp}>
          <Handshake size={18} color="#09090B" />
          <Text style={styles.settleButtonText}>Settle Your Share (₹{sharePerPerson})</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  closeButton: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  deleteButton: {
    padding: 6,
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 16,
    paddingBottom: 36,
  },
  heroCard: {
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 20,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    gap: 10,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  heroAmount: {
    fontSize: 42,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -1,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.text,
    textAlign: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  dateText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: 12,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: THEME.colors.textMuted,
  },
  paidByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  payerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payerDetails: {
    flex: 1,
  },
  payerName: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  payerSub: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  splitUser: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  splitAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  settleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    paddingVertical: 14,
    borderRadius: THEME.radius.md,
    marginTop: 6,
  },
  settleButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#09090B',
  },
});
