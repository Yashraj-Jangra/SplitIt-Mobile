import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  type ScrollViewInstance,
  TextInput,
  TouchableOpacity,
  Platform,
  Alert,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { QuantumSpinner } from '../../src/components/brand/QuantumLogo';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { KeyboardStickyBottomBar } from '../../src/components/common/KeyboardStickyBottomBar';
import {
  ArrowLeft,
  Send,
  Headphones,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  CreditCard,
  Bug,
  Sparkles,
  Shield,
  RotateCcw,
  Check,
  CheckCheck,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import {
  supportService,
  SupportTicketItem,
  TicketMessage,
  TicketCategory,
} from '../../src/services/support.service';
import { useAppTheme } from '../../src/contexts/theme.context';
import { haptics } from '../../src/services/haptics.service';

export default function TicketThreadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentAccent } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [ticket, setTicket] = useState<SupportTicketItem | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const scrollViewRef = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const onShow = () => {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 60);
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    return () => {
      showSub.remove();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const tickets = await supportService.getTickets();
      const match = tickets.find((t) => t.id === id) || tickets[0] || null;
      if (isMounted) {
        setTicket(match);
        setLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleSendReply = async () => {
    const text = replyText.trim();
    if (!text || isSending || !ticket) return;

    haptics.confirm();
    setIsSending(true);

    const newMsg: TicketMessage = {
      message: text,
      sentAt: new Date().toISOString(),
      sentBy: { uid: 'u1', firstName: 'You', email: 'user@splitit.app' },
    };

    setTicket((prev) =>
      prev ? { ...prev, messages: [...prev.messages, newMsg] } : null
    );
    setReplyText('');

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 120);

    await supportService.replyToTicket(ticket.id, text);
    setIsSending(false);
  };

  const handleToggleResolve = async () => {
    if (!ticket) return;

    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      // Reopen
      haptics.confirm();
      await supportService.reopenTicket(ticket.id);
      setTicket((prev) => (prev ? { ...prev, status: 'open' } : null));
    } else {
      // Mark as resolved
      Alert.alert(
        'Resolve Ticket?',
        'Marking this ticket as resolved indicates your question or issue has been addressed. You can reopen it anytime.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Mark Resolved',
            style: 'default',
            onPress: async () => {
              haptics.settleSuccess();
              await supportService.resolveTicket(ticket.id);
              setTicket((prev) => (prev ? { ...prev, status: 'resolved' } : null));
            },
          },
        ]
      );
    }
  };

  const formatMessageTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatTicketDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const getCategoryMeta = (category?: TicketCategory) => {
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

  const getStatusMeta = (status: SupportTicketItem['status']) => {
    switch (status) {
      case 'resolved':
        return {
          label: 'RESOLVED',
          color: currentAccent.primary,
          bg: `${currentAccent.primary}20`,
          border: `${currentAccent.primary}48`,
          icon: CheckCircle2,
        };
      case 'in_progress':
        return {
          label: 'IN PROGRESS',
          color: THEME.colors.info,
          bg: 'rgba(59, 130, 246, 0.12)',
          border: 'rgba(59, 130, 246, 0.3)',
          icon: Clock,
        };
      case 'closed':
        return {
          label: 'CLOSED',
          color: THEME.colors.textMuted,
          bg: THEME.colors.surfaceElevated,
          border: THEME.colors.hairline,
          icon: CheckCircle2,
        };
      default:
        return {
          label: 'OPEN',
          color: THEME.colors.warning,
          bg: 'rgba(245, 158, 11, 0.12)',
          border: 'rgba(245, 158, 11, 0.3)',
          icon: AlertCircle,
        };
    }
  };

  if (loading || !ticket) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <QuantumSpinner size={36} color={currentAccent.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const catMeta = getCategoryMeta(ticket.category);
  const CatIcon = catMeta.icon;
  const statusMeta = getStatusMeta(ticket.status);
  const StatusIcon = statusMeta.icon;
  const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          style={styles.headerButton}
          accessibilityLabel="Go back to tickets"
          accessibilityRole="button"
        >
          <ArrowLeft size={19} color={THEME.colors.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {ticket.subject}
          </Text>
          <View style={styles.headerSubRow}>
            <Text style={styles.headerIdText}>#{ticket.id}</Text>
            <Text style={styles.headerDot}>•</Text>
            <CatIcon size={11} color={catMeta.color} />
            <Text style={[styles.headerCatText, { color: catMeta.color }]}>
              {catMeta.label}
            </Text>
          </View>
        </View>

        {/* Status Pill / Action */}
        <TouchableOpacity
          style={[
            styles.statusPill,
            { backgroundColor: statusMeta.bg, borderColor: statusMeta.border },
          ]}
          onPress={handleToggleResolve}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Ticket status is ${statusMeta.label}. Tap to change.`}
        >
          <StatusIcon size={11} color={statusMeta.color} strokeWidth={2.4} />
          <Text style={[styles.statusPillText, { color: statusMeta.color }]}>
            {statusMeta.label}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollFlex}
        contentContainerStyle={[
          styles.messagesContent,
          { paddingBottom: isResolved ? 32 : 16 },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
      >
          {/* Thread Overview Card */}
          <View style={styles.overviewCard}>
            <View style={styles.overviewTopRow}>
              <View style={styles.overviewBadgeRow}>
                <View style={styles.idChip}>
                  <Text style={styles.idChipText}>#{ticket.id}</Text>
                </View>
                <View
                  style={[
                    styles.catChip,
                    { backgroundColor: 'rgba(16, 185, 129, 0.08)' },
                  ]}
                >
                  <CatIcon size={12} color={catMeta.color} />
                  <Text style={[styles.catChipText, { color: catMeta.color }]}>
                    {catMeta.label}
                  </Text>
                </View>
              </View>

              <Text style={styles.overviewDateText}>
                {formatTicketDate(ticket.createdAt)}
              </Text>
            </View>

            <Text style={styles.overviewSubject}>{ticket.subject}</Text>

            <View style={styles.overviewDivider} />

            <View style={styles.overviewAssigneeRow}>
              <View style={styles.staffPulseWrap}>
                <View style={styles.staffPulseDot} />
              </View>
              <Text style={styles.overviewAssigneeText}>
                Assigned to SplitIt Support Engineering Desk
              </Text>
            </View>
          </View>

          {/* Date Separator */}
          <View style={styles.dateSeparatorRow}>
            <View style={styles.dateLine} />
            <Text style={styles.dateText}>Ticket Conversation</Text>
            <View style={styles.dateLine} />
          </View>

          {/* Message Bubbles */}
          {ticket.messages.map((msg, index) => {
            const isUser = msg.sentBy.uid === 'u1';
            return (
              <View
                key={index}
                style={[
                  styles.messageRow,
                  isUser ? styles.userMessageRow : styles.agentMessageRow,
                ]}
              >
                {!isUser && (
                  <View style={styles.agentAvatar}>
                    <Headphones size={13} color={currentAccent.primary} />
                  </View>
                )}

                <View
                  style={[
                    styles.messageBubble,
                    isUser ? styles.userBubble : styles.agentBubble,
                  ]}
                >
                  <View style={styles.bubbleHeaderRow}>
                    <Text style={[styles.senderName, isUser && styles.userSenderName]}>
                      {isUser ? 'You' : 'SplitIt Support Team'}
                    </Text>
                    {!isUser && (
                      <View style={styles.staffBadge}>
                        <Text style={styles.staffBadgeText}>STAFF</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.messageBody}>{msg.message}</Text>

                  <View style={styles.bubbleFooterRow}>
                    <Text style={styles.messageTimeText}>
                      {formatMessageTime(msg.sentAt)}
                    </Text>
                    {isUser && (
                      <CheckCheck size={13} color={currentAccent.primary} strokeWidth={2} />
                    )}
                  </View>
                </View>
              </View>
            );
          })}

          {/* Resolved Card (when closed or resolved) */}
          {isResolved && (
            <View style={styles.resolvedBannerCard}>
              <View style={styles.resolvedCheckCircle}>
                <Check size={20} color={currentAccent.primary} strokeWidth={3} />
              </View>
              <Text style={styles.resolvedTitle}>This ticket has been resolved</Text>
              <Text style={styles.resolvedDesc}>
                If you have further questions or need additional assistance, you can reopen this thread anytime.
              </Text>
              <TouchableOpacity
                style={styles.reopenButton}
                onPress={handleToggleResolve}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Reopen this ticket"
              >
                <RotateCcw size={14} color={THEME.colors.text} />
                <Text style={styles.reopenButtonText}>Reopen Conversation</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Reply Input Bar (Visible when active) */}
        {!isResolved ? (
          <KeyboardStickyBottomBar
            insideKeyboardAvoidingView
            bordered
            idlePaddingBottom={12}
            keyboardPaddingBottom={10}
            style={styles.inputBar}
          >
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                value={replyText}
                onChangeText={setReplyText}
                placeholder="Type your reply to support..."
                placeholderTextColor={THEME.colors.textMuted}
                multiline
                maxLength={2000}
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 60);
                }}
              />
            </View>
            <TouchableOpacity
              style={[
                styles.sendButton,
                { backgroundColor: currentAccent.primary, shadowColor: currentAccent.primary },
                (!replyText.trim() || isSending) && styles.sendButtonDisabled,
              ]}
              onPress={handleSendReply}
              disabled={!replyText.trim() || isSending}
              activeOpacity={0.8}
              accessibilityLabel="Send reply to support ticket"
              accessibilityRole="button"
            >
              {isSending ? (
                <QuantumSpinner size={16} color={THEME.colors.primaryForeground} />
              ) : (
                <Send size={16} color={THEME.colors.primaryForeground} strokeWidth={2.4} />
              )}
            </TouchableOpacity>
          </KeyboardStickyBottomBar>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  scrollFlex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
    gap: 12,
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
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.3,
  },
  headerSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  headerIdText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },
  headerDot: {
    fontSize: 10,
    color: THEME.colors.textMuted,
  },
  headerCatText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Thread Content
  messagesContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 14,
  },

  // Overview Card
  overviewCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    gap: 8,
  },
  overviewTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overviewBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  idChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: THEME.radius.xs,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  idChipText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '800',
    color: THEME.colors.textSecondary,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: THEME.radius.full,
  },
  catChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  overviewDateText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  overviewSubject: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  overviewDivider: {
    height: 1,
    backgroundColor: THEME.colors.hairline,
    marginVertical: 2,
  },
  overviewAssigneeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  staffPulseWrap: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.primary,
  },
  staffPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.primary,
  },
  overviewAssigneeText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },

  // Date Separator
  dateSeparatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: THEME.colors.hairline,
  },
  dateText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: THEME.colors.textMuted,
    textTransform: 'uppercase',
  },

  // Messages
  messageRow: {
    flexDirection: 'row',
    gap: 8,
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  agentMessageRow: {
    justifyContent: 'flex-start',
  },
  agentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: THEME.radius.xl,
    gap: 4,
  },
  userBubble: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.28)',
    borderBottomRightRadius: THEME.radius.xs,
  },
  agentBubble: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    borderBottomLeftRadius: THEME.radius.xs,
  },
  bubbleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  senderName: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
  },
  userSenderName: {
    color: THEME.colors.primary,
  },
  staffBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: THEME.radius.xs,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  staffBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: THEME.colors.primary,
    letterSpacing: 0.5,
  },
  messageBody: {
    fontSize: 13,
    color: THEME.colors.text,
    lineHeight: 19,
  },
  bubbleFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 2,
  },
  messageTimeText: {
    fontSize: 10,
    color: THEME.colors.textMuted,
  },

  // Resolved Card
  resolvedBannerCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius['2xl'],
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  resolvedCheckCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  resolvedTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  resolvedDesc: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 16,
  },
  reopenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairlineLight,
  },
  reopenButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.text,
  },

  // Input Bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
  },
  inputContainer: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    minHeight: 44,
    maxHeight: 100,
  },
  textInput: {
    fontSize: 13,
    color: THEME.colors.text,
    padding: 0,
    lineHeight: 18,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
