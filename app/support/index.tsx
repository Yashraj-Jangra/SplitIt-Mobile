import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { QuantumSpinner } from '../../src/components/brand/QuantumLogo';
import {
  ArrowLeft,
  Plus,
  HelpCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Sparkles,
  CreditCard,
  Bug,
  Shield,
  LifeBuoy,
  Search,
  X,
  XCircle,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import {
  supportService,
  SupportTicketItem,
  TicketCategory,
  FaqItem,
} from '../../src/services/support.service';
import { useAppTheme } from '../../src/contexts/theme.context';
import { haptics } from '../../src/services/haptics.service';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type TicketFilterTab = 'all' | 'open' | 'resolved';

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

export default function SupportTicketsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentAccent } = useAppTheme();
  const [tickets, setTickets] = useState<SupportTicketItem[]>(() =>
    supportService.getInMemoryTickets()
  );
  const [loading, setLoading] = useState(
    () => supportService.getInMemoryTickets().length === 0
  );
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TicketFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);

  const faqs = useMemo(() => supportService.getFaqs(), []);

  const loadTickets = async () => {
    try {
      const list = await supportService.getTickets();
      setTickets(list);
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    supportService.getTickets().then((list) => {
      if (isMounted) {
        setTickets(list);
        setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    haptics.tap();
    loadTickets();
  };

  const toggleFaq = (faqId: string) => {
    haptics.tick();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedFaqId((prev) => (prev === faqId ? null : faqId));
  };

  const getStatusBadge = (status: SupportTicketItem['status']) => {
    switch (status) {
      case 'resolved':
        return {
          label: 'Resolved',
          color: currentAccent.primary,
          bg: `${currentAccent.primary}20`,
          border: `${currentAccent.primary}48`,
          icon: CheckCircle2,
        };
      case 'in_progress':
        return {
          label: 'In Progress',
          color: THEME.colors.info,
          bg: 'rgba(59, 130, 246, 0.12)',
          border: 'rgba(59, 130, 246, 0.28)',
          icon: Clock,
        };
      case 'closed':
        return {
          label: 'Closed',
          color: THEME.colors.textMuted,
          bg: THEME.colors.surfaceElevated,
          border: THEME.colors.hairline,
          icon: XCircle,
        };
      default:
        return {
          label: 'Open',
          color: THEME.colors.warning,
          bg: 'rgba(245, 158, 11, 0.12)',
          border: 'rgba(245, 158, 11, 0.28)',
          icon: AlertCircle,
        };
    }
  };

  const getCategoryMeta = (category: TicketCategory) => {
    switch (category) {
      case 'billing':
        return { label: 'Billing & UPI', icon: CreditCard, color: currentAccent.primary };
      case 'bug':
        return { label: 'Bug Report', icon: Bug, color: THEME.colors.negative };
      case 'feature':
        return { label: 'Feature Request', icon: Sparkles, color: THEME.colors.ai };
      case 'account':
        return { label: 'Account Help', icon: Shield, color: THEME.colors.info };
      default:
        return { label: 'General', icon: HelpCircle, color: THEME.colors.textMuted };
    }
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // Tab filter
      if (activeTab === 'open' && t.status === 'resolved') return false;
      if (activeTab === 'resolved' && t.status !== 'resolved' && t.status !== 'closed')
        return false;

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const hasSubject = t.subject.toLowerCase().includes(q);
      const hasId = t.id.toLowerCase().includes(q);
      const hasMessage = t.messages.some((m) => m.message.toLowerCase().includes(q));
      return hasSubject || hasId || hasMessage;
    });
  }, [tickets, activeTab, searchQuery]);

  const openTicketsCount = useMemo(
    () => tickets.filter((t) => t.status !== 'resolved' && t.status !== 'closed').length,
    [tickets]
  );
  const resolvedTicketsCount = useMemo(
    () => tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length,
    [tickets]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Editorial Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          style={styles.headerButton}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <ArrowLeft size={19} color={THEME.colors.text} />
        </TouchableOpacity>

        <View style={styles.headerTextGroup}>
          <Text style={styles.headerTitle}>Support & Help</Text>
          <Text style={styles.headerSubtitle}>Concierge desk & knowledge base</Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            haptics.tap();
            router.push('/support/new');
          }}
          style={[styles.newButton, { backgroundColor: currentAccent.primary, shadowColor: currentAccent.primary }]}
          activeOpacity={0.8}
          accessibilityLabel="Open new support ticket"
          accessibilityRole="button"
        >
          <Plus size={15} color={THEME.colors.primaryForeground} strokeWidth={2.6} />
          <Text style={styles.newButtonText}>New</Text>
        </TouchableOpacity>
      </View>

      {loading && tickets.length === 0 ? (
        <View style={styles.loadingContainer}>
          <QuantumSpinner size={36} color={currentAccent.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 16) + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={currentAccent.primary}
            />
          }
        >
          {/* Status & Live Concierge Card */}
          <View style={styles.heroCard}>
            <View style={styles.heroStatusRow}>
              <View style={styles.pulseContainer}>
                <View style={[styles.pulseDot, { backgroundColor: currentAccent.primary }]} />
                <View style={styles.pulseRing} />
              </View>
              <Text style={[styles.heroStatusText, { color: currentAccent.primary }]}>
                Support Desk Active • Typical reply &lt; 2h
              </Text>
            </View>

            <Text style={styles.heroTitle}>How can our team help you?</Text>
            <Text style={styles.heroSubtitle}>
              Direct priority channel for payment disputes, group syncing, or feature requests.
            </Text>

            {/* AI Assistant Quick Banner */}
            <TouchableOpacity
              style={styles.aiBannerCard}
              onPress={() => {
                haptics.tap();
                router.push('/ai/chat');
              }}
              activeOpacity={0.8}
              accessibilityLabel="Chat with SplitIt AI Assistant"
              accessibilityRole="button"
            >
              <View style={styles.aiIconBadge}>
                <Sparkles size={18} color={THEME.colors.ai} />
              </View>
              <View style={styles.aiTextContainer}>
                <View style={styles.aiHeaderLine}>
                  <Text style={styles.aiTitle}>Need Instant Answers?</Text>
                  <View style={styles.instantPill}>
                    <Text style={styles.instantPillText}>24/7 AI</Text>
                  </View>
                </View>
                <Text style={styles.aiSubtitle}>
                  Ask SplitIt AI for instant debt math, UPI QR setups, or budget tips.
                </Text>
              </View>
              <ChevronRight size={16} color={THEME.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Interactive FAQ Accordion Section */}
          <View style={styles.faqSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>FREQUENTLY ASKED QUESTIONS</Text>
              <HelpCircle size={13} color={THEME.colors.textMuted} />
            </View>

            <View style={styles.faqListContainer}>
              {faqs.map((faq: FaqItem, idx: number) => {
                const isExpanded = expandedFaqId === faq.id;
                const isLast = idx === faqs.length - 1;
                return (
                  <View
                    key={faq.id}
                    style={[styles.faqItem, !isLast && styles.faqItemBorder]}
                  >
                    <TouchableOpacity
                      style={styles.faqTrigger}
                      onPress={() => toggleFaq(faq.id)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={faq.question}
                      accessibilityState={{ expanded: isExpanded }}
                    >
                      <Text style={styles.faqQuestion}>{faq.question}</Text>
                      <View
                        style={[
                          styles.faqChevronWrap,
                          isExpanded && styles.faqChevronWrapActive,
                        ]}
                      >
                        <ChevronDown
                          size={15}
                          color={isExpanded ? currentAccent.primary : THEME.colors.textMuted}
                        />
                      </View>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.faqAnswerContainer}>
                        <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Tickets Segment */}
          <View style={styles.ticketsSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>YOUR SUPPORT TICKETS</Text>
              <Text style={styles.ticketTotalCount}>{tickets.length} total</Text>
            </View>

            {/* Filter Tabs */}
            <View style={styles.filterTabsRow}>
              <TouchableOpacity
                style={[styles.filterTab, activeTab === 'all' && styles.filterTabActive]}
                onPress={() => {
                  haptics.tap();
                  setActiveTab('all');
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'all' }}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    activeTab === 'all' && styles.filterTabTextActive,
                  ]}
                >
                  All ({tickets.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterTab, activeTab === 'open' && styles.filterTabActive]}
                onPress={() => {
                  haptics.tap();
                  setActiveTab('open');
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'open' }}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    activeTab === 'open' && styles.filterTabTextActive,
                  ]}
                >
                  Active ({openTicketsCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterTab,
                  activeTab === 'resolved' && styles.filterTabActive,
                ]}
                onPress={() => {
                  haptics.tap();
                  setActiveTab('resolved');
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'resolved' }}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    activeTab === 'resolved' && styles.filterTabTextActive,
                  ]}
                >
                  Resolved ({resolvedTicketsCount})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Ticket Search Bar */}
            {tickets.length > 2 && (
              <View style={styles.searchBar}>
                <Search size={15} color={THEME.colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Filter tickets by keyword or ID..."
                  placeholderTextColor={THEME.colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      haptics.tap();
                      setSearchQuery('');
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={14} color={THEME.colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {filteredTickets.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <LifeBuoy size={28} color={currentAccent.primary} />
                </View>
                <Text style={styles.emptyTitle}>
                  {searchQuery ? 'No matching tickets' : 'No support tickets found'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery
                    ? `No tickets match "${searchQuery}". Clear your search query to see all requests.`
                    : 'Everything is running smoothly! If you encounter an issue or have an idea, our team is right here.'}
                </Text>
                {!searchQuery && (
                  <TouchableOpacity
                    style={[styles.emptyCtaButton, { backgroundColor: currentAccent.primary }]}
                    onPress={() => {
                      haptics.tap();
                      router.push('/support/new');
                    }}
                    activeOpacity={0.8}
                  >
                    <Plus size={16} color={THEME.colors.primaryForeground} strokeWidth={2.4} />
                    <Text style={styles.emptyCtaText}>Create Support Ticket</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.ticketsList}>
                {filteredTickets.map((t) => {
                  const badge = getStatusBadge(t.status);
                  const BadgeIcon = badge.icon;
                  const catMeta = getCategoryMeta(t.category);
                  const CatIcon = catMeta.icon;
                  const lastMessage = t.messages[t.messages.length - 1];
                  const lastSender =
                    lastMessage?.sentBy.uid === 'u1'
                      ? 'You'
                      : lastMessage?.sentBy.firstName || 'Support';

                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={styles.ticketCard}
                      onPress={() => {
                        haptics.tap();
                        router.push({
                          pathname: '/support/[id]',
                          params: { id: t.id },
                        });
                      }}
                      activeOpacity={0.78}
                      accessibilityRole="button"
                      accessibilityLabel={`Ticket ${t.id}: ${t.subject}. Status ${badge.label}`}
                    >
                      {/* Ticket Meta Header Row */}
                      <View style={styles.ticketCardHeader}>
                        <View style={styles.ticketMetaLeft}>
                          <View style={styles.idBadge}>
                            <Text style={styles.idBadgeText}>#{t.id}</Text>
                          </View>
                          <View style={styles.categoryBadge}>
                            <CatIcon size={11} color={catMeta.color} />
                            <Text style={[styles.categoryBadgeText, { color: catMeta.color }]}>
                              {catMeta.label}
                            </Text>
                          </View>
                        </View>

                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: badge.bg, borderColor: badge.border },
                          ]}
                        >
                          <BadgeIcon size={11} color={badge.color} strokeWidth={2.2} />
                          <Text style={[styles.statusBadgeText, { color: badge.color }]}>
                            {badge.label}
                          </Text>
                        </View>
                      </View>

                      {/* Subject */}
                      <Text style={styles.ticketSubject} numberOfLines={1}>
                        {t.subject}
                      </Text>

                      {/* Last Message Snippet */}
                      {lastMessage && (
                        <Text style={styles.ticketSnippet} numberOfLines={2}>
                          <Text style={styles.ticketSnippetSender}>{lastSender}: </Text>
                          {lastMessage.message}
                        </Text>
                      )}

                      {/* Footer Info Row */}
                      <View style={styles.ticketFooter}>
                        <View style={styles.ticketTimeWrap}>
                          <Clock size={11} color={THEME.colors.textMuted} />
                          <Text style={styles.ticketTimeText}>
                            {formatRelativeTime(t.updatedAt || t.createdAt)}
                          </Text>
                        </View>

                        <View style={styles.ticketStatsWrap}>
                          <View style={styles.messageCountPill}>
                            <MessageSquare size={11} color={THEME.colors.textMuted} />
                            <Text style={styles.messageCountText}>
                              {t.messages.length} message{t.messages.length === 1 ? '' : 's'}
                            </Text>
                          </View>
                          <ChevronRight size={14} color={THEME.colors.textMuted} />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  headerTextGroup: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '500',
    marginTop: 1,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: THEME.radius.full,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  newButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.primaryForeground,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 20,
  },

  // Hero Card
  heroCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius['2xl'],
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    padding: 16,
    gap: 10,
  },
  heroStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  pulseContainer: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: THEME.colors.primary,
  },
  pulseRing: {
    ...StyleSheet.absoluteFill,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  heroStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.primary,
    letterSpacing: 0.2,
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.4,
    marginTop: 2,
  },
  heroSubtitle: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    lineHeight: 18,
  },

  // AI Assistance Banner
  aiBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.radius.xl,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    marginTop: 4,
  },
  aiIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiTextContainer: {
    flex: 1,
    gap: 2,
  },
  aiHeaderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  instantPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: THEME.radius.full,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
  },
  instantPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.aiLight,
  },
  aiSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    lineHeight: 15,
  },

  // Section Headers
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: THEME.colors.textMuted,
  },
  ticketTotalCount: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },

  // FAQ Accordion
  faqSection: {
    gap: 4,
  },
  faqListContainer: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    overflow: 'hidden',
  },
  faqItem: {
    paddingHorizontal: 14,
  },
  faqItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  faqTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    gap: 10,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
    lineHeight: 18,
  },
  faqChevronWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surfaceElevated,
  },
  faqChevronWrapActive: {
    transform: [{ rotate: '180deg' }],
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  faqAnswerContainer: {
    paddingBottom: 14,
    paddingTop: 2,
  },
  faqAnswerText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    lineHeight: 18,
  },

  // Tickets Section
  ticketsSection: {
    gap: 10,
  },
  filterTabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  filterTabActive: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderColor: THEME.colors.hairlineLight,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  filterTabTextActive: {
    color: THEME.colors.text,
    fontWeight: '800',
  },

  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: THEME.colors.text,
    paddingVertical: 0,
  },

  // Empty State
  emptyContainer: {
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    borderStyle: 'dashed',
    gap: 8,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  emptySubtitle: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    lineHeight: 17,
  },
  emptyCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: THEME.radius.full,
  },
  emptyCtaText: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.primaryForeground,
  },

  // Ticket Cards
  ticketsList: {
    gap: 10,
  },
  ticketCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    gap: 8,
  },
  ticketCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  idBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: THEME.radius.xs,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  idBadgeText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '800',
    color: THEME.colors.textSecondary,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surfaceElevated,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  ticketSubject: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.2,
  },
  ticketSnippet: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    lineHeight: 17,
  },
  ticketSnippetSender: {
    fontWeight: '700',
    color: THEME.colors.text,
  },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
  },
  ticketTimeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ticketTimeText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  ticketStatsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  messageCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  messageCountText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },
});
