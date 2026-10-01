import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Sparkles, ArrowUpRight, ArrowDownLeft, ShieldCheck } from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import * as Haptics from 'expo-haptics';

export default function HomeScreen() {
  const router = useRouter();

  const handleAddExpense = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/expenses/new');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSubtitle}>WELCOME BACK</Text>
            <Text style={styles.headerTitle}>SplitIt</Text>
          </View>
          <TouchableOpacity
            style={styles.aiButton}
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          >
            <Sparkles size={18} color={THEME.colors.aiLight} />
            <Text style={styles.aiButtonText}>AI Insights</Text>
          </TouchableOpacity>
        </View>

        {/* Hero Balance Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>NET BALANCE</Text>
          <Text style={styles.heroAmount}>+₹14,250.00</Text>
          <View style={styles.heroMetricsRow}>
            <View style={styles.metricPill}>
              <ArrowDownLeft size={14} color={THEME.colors.primary} />
              <Text style={styles.metricLabel}>You are owed</Text>
              <Text style={[styles.metricValue, { color: THEME.colors.primary }]}>₹18,500</Text>
            </View>
            <View style={styles.metricPill}>
              <ArrowUpRight size={14} color={THEME.colors.negative} />
              <Text style={styles.metricLabel}>You owe</Text>
              <Text style={[styles.metricValue, { color: THEME.colors.negative }]}>₹4,250</Text>
            </View>
          </View>
        </View>

        {/* AI Velocity Insight Capsule */}
        <View style={styles.insightCapsule}>
          <Sparkles size={16} color={THEME.colors.ai} />
          <Text style={styles.insightText}>
            Spend velocity is <Text style={styles.insightHighlight}>8% below</Text> your 6-month average.
          </Text>
        </View>

        {/* Minimalist Micro-Visualization: 6-Bar Velocity Sparkline */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>6-Month Velocity</Text>
            <Text style={styles.cardSubtitle}>Monthly Trend</Text>
          </View>
          <View style={styles.sparklineContainer}>
            {[45, 60, 30, 80, 50, 70].map((height, index) => (
              <View key={index} style={styles.sparklineCol}>
                <View
                  style={[
                    styles.sparklineBar,
                    { height: `${height}%` },
                    index === 5 && styles.sparklineBarActive,
                  ]}
                />
                <Text style={styles.sparklineLabel}>
                  {['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'][index]}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Quick Action FAB / Button */}
        <TouchableOpacity style={styles.primaryActionButton} onPress={handleAddExpense}>
          <Plus size={20} color="#FFFFFF" />
          <Text style={styles.primaryActionText}>Add New Expense</Text>
        </TouchableOpacity>
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
    padding: 20,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: THEME.colors.textMuted,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -0.5,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: THEME.radius.full,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  aiButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.aiLight,
  },
  heroCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: THEME.colors.textSecondary,
    marginBottom: 4,
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '900',
    color: THEME.colors.primary,
    letterSpacing: -1,
    marginBottom: 16,
  },
  heroMetricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.surfaceSubtle,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  metricLabel: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 'auto',
  },
  insightCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.20)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
  },
  insightText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    flex: 1,
  },
  insightHighlight: {
    color: THEME.colors.aiLight,
    fontWeight: '700',
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  cardSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  sparklineContainer: {
    flexDirection: 'row',
    height: 80,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  sparklineCol: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    gap: 6,
    width: 36,
  },
  sparklineBar: {
    width: 14,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 4,
  },
  sparklineBarActive: {
    backgroundColor: THEME.colors.primary,
  },
  sparklineLabel: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    paddingVertical: 14,
    borderRadius: THEME.radius.md,
    marginTop: 8,
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#09090B',
  },
});
