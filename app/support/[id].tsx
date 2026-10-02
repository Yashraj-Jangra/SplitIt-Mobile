import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Send,
  Headphones,
  User,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import {
  supportService,
  SupportTicketItem,
  TicketMessage,
} from '../../src/services/support.service';
import * as Haptics from 'expo-haptics';

export default function TicketThreadScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [ticket, setTicket] = useState<SupportTicketItem | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    const load = async () => {
      const tickets = await supportService.getTickets();
      const match = tickets.find((t) => t.id === id) || tickets[0] || null;
      setTicket(match);
      setLoading(false);
    };
    load();
  }, [id]);

  const handleSendReply = async () => {
    const text = replyText.trim();
    if (!text || isSending || !ticket) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    }, 100);

    await supportService.replyToTicket(ticket.id, text);
    setIsSending(false);
  };

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading || !ticket) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
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

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {ticket.subject}
          </Text>
          <Text style={styles.headerSubtitle}>Ticket #{ticket.id}</Text>
        </View>

        <View
          style={[
            styles.statusPill,
            ticket.status === 'resolved' && styles.statusResolved,
          ]}
        >
          <Text
            style={[
              styles.statusPillText,
              ticket.status === 'resolved' && { color: THEME.colors.primary },
            ]}
          >
            {ticket.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {ticket.messages.map((msg, index) => {
            const isUser = msg.sentBy.uid === 'u1';
            return (
              <View
                key={index}
                style={[
                  styles.messageBubbleWrapper,
                  isUser ? styles.userBubbleWrapper : styles.agentBubbleWrapper,
                ]}
              >
                {!isUser && (
                  <View style={styles.agentAvatar}>
                    <Headphones size={13} color={THEME.colors.aiLight} />
                  </View>
                )}

                <View
                  style={[
                    styles.messageBubble,
                    isUser ? styles.userBubble : styles.agentBubble,
                  ]}
                >
                  <Text style={styles.senderLabel}>
                    {isUser ? 'You' : msg.sentBy.firstName || 'SplitIt Support'}
                  </Text>
                  <Text style={styles.messageBody}>{msg.message}</Text>
                  <Text style={styles.messageTimestamp}>
                    {formatMessageTime(msg.sentAt)}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Reply Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={replyText}
            onChangeText={setReplyText}
            placeholder="Type your reply to support..."
            placeholderTextColor={THEME.colors.textMuted}
            multiline
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!replyText.trim() || isSending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendReply}
            disabled={!replyText.trim() || isSending}
          >
            <Send size={18} color="#09090B" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    gap: 12,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surface,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surfaceElevated,
  },
  statusResolved: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesContent: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 14,
    paddingBottom: 24,
  },
  messageBubbleWrapper: {
    flexDirection: 'row',
    gap: 8,
  },
  userBubbleWrapper: {
    justifyContent: 'flex-end',
  },
  agentBubbleWrapper: {
    justifyContent: 'flex-start',
  },
  agentAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  messageBubble: {
    maxWidth: '82%',
    padding: 12,
    borderRadius: THEME.radius.md,
  },
  userBubble: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  agentBubble: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  senderLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    marginBottom: 4,
  },
  messageBody: {
    fontSize: 14,
    color: THEME.colors.text,
    lineHeight: 20,
  },
  messageTimestamp: {
    fontSize: 9,
    color: THEME.colors.textMuted,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: THEME.colors.surface,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: THEME.colors.text,
    maxHeight: 90,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  sendButton: {
    backgroundColor: THEME.colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
