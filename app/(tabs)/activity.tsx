import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Receipt, Handshake, Bot, Sparkles } from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';

interface ActivityItem {
  id: string;
  icon: any;
  iconColor: string;
  title: string;
  subtitle: string;
  time: string;
  amount?: string;
  type?: 'positive' | 'negative';
  badge?: string;
}

export default function ActivityScreen() {
  const sections: Array<{ title: string; items: ActivityItem[] }> = [
    {
      title: 'Today',
      items: [
        {
          id: '1',
          icon: Receipt,
          iconColor: THEME.colors.primary,
          title: 'Dinner at Social',
          subtitle: 'You paid ₹1,200 in Apartment Flatmates 🏠',
          time: '2 hours ago',
          amount: '+₹800',
          type: 'positive',
        },
      ],
    },
    {
      title: 'Yesterday',
      items: [
        {
          id: '2',
          icon: Bot,
          iconColor: THEME.colors.aiLight,
          title: 'AI Budget Optimized',
          subtitle: 'Auto-balanced categories for October (₹25k cap)',
          time: '18 hours ago',
          badge: 'AI Smart',
        },
      ],
    },
    {
      title: 'Earlier this week',
      items: [
        {
          id: '3',
          icon: Handshake,
          iconColor: THEME.colors.primary,
          title: 'Settled with Rohit Sharma',
          subtitle: 'Received ₹450 via UPI in Apartment Flatmates',
          time: '3 days ago',
          amount: '+₹450',
          type: 'positive',
        },
        {
          id: '4',
          icon: Receipt,
          iconColor: THEME.colors.negative,
          title: 'Camping Equipment Rental',
          subtitle: 'Rohit paid ₹2,400 in Weekend Treks ⛰️',
          time: '4 days ago',
          amount: '-₹800',
          type: 'negative',
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
        <Text style={styles.subtitle}>Recent transactions & group changes</Text>
      </View>

      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {sections.map((section) => (
          <View key={section.title} style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>{section.title}</Text>

            <View style={styles.ledgerCard}>
              {section.items.map((item, index) => {
                const IconComponent = item.icon;
                const isLast = index === section.items.length - 1;

                return (
                  <View key={item.id} style={[styles.ledgerRow, !isLast && styles.ledgerRowBorder]}>
                    <View style={styles.iconCircle}>
                      <IconComponent size={16} color={item.iconColor} />
                    </View>

                    <View style={styles.details}>
                      <Text style={styles.activityTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.activitySubtitle} numberOfLines={1}>
                        {item.subtitle}
                      </Text>
                      <Text style={styles.activityTime}>{item.time}</Text>
                    </View>

                    {item.amount && (
                      <View style={styles.amountCol}>
                        <Text
                          style={[
                            styles.amountText,
                            item.type === 'positive' && { color: THEME.colors.primary },
                            item.type === 'negative' && { color: THEME.colors.negative },
                          ]}
                        >
                          {item.amount}
                        </Text>
                      </View>
                    )}

                    {item.badge && (
                      <View style={styles.badgePill}>
                        <Text style={styles.badgeText}>{item.badge}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ))}
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
    fontSize: 28,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 36,
    gap: 20,
  },
  sectionWrap: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: THEME.colors.textMuted,
    textTransform: 'uppercase',
  },
  ledgerCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    paddingHorizontal: 12,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  ledgerRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  activitySubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  activityTime: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    marginTop: 3,
  },
  amountCol: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 14,
    fontWeight: '800',
  },
  badgePill: {
    backgroundColor: THEME.colors.aiMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.aiLight,
  },
});
