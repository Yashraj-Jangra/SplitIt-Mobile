import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Receipt, Handshake, Bot, Wallet } from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';

export default function ActivityScreen() {
  const activities = [
    {
      id: '1',
      icon: Receipt,
      iconColor: THEME.colors.primary,
      iconBg: 'rgba(16, 185, 129, 0.12)',
      title: 'Dinner at Social',
      subtitle: 'You paid ₹1,200 in Goa Trip',
      time: '2 hours ago',
      badge: 'Expense',
    },
    {
      id: '2',
      icon: Bot,
      iconColor: THEME.colors.aiLight,
      iconBg: 'rgba(139, 92, 246, 0.15)',
      title: 'AI Budget Proposal Applied',
      subtitle: 'SplitIt AI balanced categories (₹25k limit)',
      time: 'Yesterday',
      badge: 'AI Budget',
    },
    {
      id: '3',
      icon: Handshake,
      iconColor: THEME.colors.primary,
      iconBg: 'rgba(16, 185, 129, 0.12)',
      title: 'Settlement via UPI',
      subtitle: 'Rohit settled ₹450 with you',
      time: '2 days ago',
      badge: 'Settlement',
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity Feed</Text>
      </View>

      <ScrollView contentContainerStyle={styles.listContent}>
        {activities.map((item) => {
          const IconComponent = item.icon;
          return (
            <View key={item.id} style={styles.activityCard}>
              <View style={[styles.avatar, { backgroundColor: item.iconBg }]}>
                <IconComponent size={20} color={item.iconColor} />
              </View>
              <View style={styles.details}>
                <View style={styles.titleRow}>
                  <Text style={styles.activityTitle}>{item.title}</Text>
                  <Text style={styles.badge}>{item.badge}</Text>
                </View>
                <Text style={styles.activitySubtitle}>{item.subtitle}</Text>
                <Text style={styles.activityTime}>{item.time}</Text>
              </View>
            </View>
          );
        })}
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
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: THEME.colors.text,
  },
  listContent: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 24,
  },
  activityCard: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surface,
    padding: 14,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: THEME.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  badge: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    backgroundColor: THEME.colors.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activitySubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 10,
    color: THEME.colors.textMuted,
  },
});
