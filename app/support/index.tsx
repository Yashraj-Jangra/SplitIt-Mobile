import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Plus,
  HelpCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  MessageSquare,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { supportService, SupportTicketItem } from '../../src/services/support.service';
import * as Haptics from 'expo-haptics';

export default function SupportTicketsScreen() {
  const router = useRouter();
  const [tickets, setTickets] = useState<SupportTicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTickets = async () => {
    const list = await supportService.getTickets();
    setTickets(list);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadTickets();
  };

  const getStatusBadge = (status: SupportTicketItem['status']) => {
    switch (status) {
      case 'resolved':
        return {
          label: 'Resolved',
          color: THEME.colors.primary,
          bg: 'rgba(16, 185, 129, 0.12)',
          icon: CheckCircle2,
        };
      case 'in_progress':
        return {
          label: 'In Progress',
          color: '#3B82F6',
          bg: 'rgba(59, 130, 246, 0.12)',
          icon: Clock,
        };
      case 'closed':
        return {
          label: 'Closed',
          color: THEME.colors.textMuted,
          bg: THEME.colors.surfaceElevated,
          icon: CheckCircle2,
        };
      default:
        return {
          label: 'Open',
          color: '#F59E0B',
          bg: 'rgba(245, 158, 11, 0.12)',
          icon: AlertCircle,
        };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          style={styles.headerButton}
        >
          <ArrowLeft size={20} color={THEME.colors.text} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Customer Support</Text>

        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/support/new');
          }}
          style={styles.newButton}
        >
          <Plus size={16} color="#09090B" />
          <Text style={styles.newButtonText}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Hero Guidance Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroIconBadge}>
          <HelpCircle size={22} color={THEME.colors.primary} />
        </View>
        <View style={styles.heroTextContainer}>
          <Text style={styles.heroTitle}>How can we assist you?</Text>
          <Text style={styles.heroSubtitle}>
            Our engineering team typically resolves ticket requests within 2–4 hours.
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={THEME.colors.primary}
            />
          }
        >
          <Text style={styles.sectionHeader}>YOUR TICKETS</Text>

          {tickets.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MessageSquare size={36} color={THEME.colors.textMuted} />
              <Text style={styles.emptyTitle}>No support tickets</Text>
              <Text style={styles.emptySubtitle}>
                Have a question or encounter a bug? Tap "New" above to submit a ticket.
              </Text>
            </View>
          ) : (
            tickets.map((t) => {
              const badge = getStatusBadge(t.status);
              const BadgeIcon = badge.icon;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={styles.ticketCard}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push({
                      pathname: '/support/[id]',
                      params: { id: t.id },
                    });
                  }}
                  activeOpacity={0.75}
                >
                  <View style={styles.ticketHeaderRow}>
                    <Text style={styles.ticketId}>#{t.id}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                      <BadgeIcon size={12} color={badge.color} />
                      <Text style={[styles.statusBadgeText, { color: badge.color }]}>
                        {badge.label}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.ticketSubject} numberOfLines={1}>
                    {t.subject}
                  </Text>

                  <View style={styles.ticketFooterRow}>
                    <Text style={styles.categoryTag}>{t.category.toUpperCase()}</Text>
                    <View style={styles.messagesCountRow}>
                      <MessageSquare size={13} color={THEME.colors.textMuted} />
                      <Text style={styles.messagesCountText}>
                        {t.messages.length} message{t.messages.length === 1 ? '' : 's'}
                      </Text>
                      <ChevronRight size={14} color={THEME.colors.textMuted} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
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
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surface,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: THEME.radius.sm,
  },
  newButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#09090B',
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: THEME.colors.surface,
    marginHorizontal: 12,
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  heroIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextContainer: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.text,
    marginBottom: 2,
  },
  heroSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    lineHeight: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
    paddingBottom: 28,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: THEME.colors.textMuted,
    marginBottom: 4,
    paddingLeft: 4,
  },
  ticketCard: {
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: 10,
  },
  ticketHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketId: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.textMuted,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.full,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  ticketSubject: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  ticketFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  categoryTag: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: THEME.colors.textSecondary,
    backgroundColor: THEME.colors.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  messagesCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  messagesCountText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 18,
  },
});
