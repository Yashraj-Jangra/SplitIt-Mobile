import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  X,
  Send,
  Sparkles,
  Bot,
  User,
  CheckCircle2,
  Trash2,
  ArrowRight,
  TrendingUp,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { aiService, BudgetActionProposal } from '../../src/services/ai.service';
import * as Haptics from 'expo-haptics';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  proposal?: BudgetActionProposal;
}

export default function AiChatModal() {
  const router = useRouter();
  const { groupId, groupName } = useLocalSearchParams<{ groupId?: string; groupName?: string }>();

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Hello! I am your **SplitIt AI Financial Assistant**.\n\nI have real-time context on your groups, spending velocity, debts, and budgets. How can I help you today?`,
    },
  ]);
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const quickPrompts = [
    'How much do I owe?',
    'Suggest budget cuts for Apartment Flatmates',
    'What was our largest expense this month?',
  ];

  const handleSend = async (promptToSend?: string) => {
    const text = (promptToSend || input).trim();
    if (!text || isStreaming) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput('');

    const userMsgId = `msg_${Date.now()}`;
    const assistantMsgId = `msg_${Date.now() + 1}`;

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, sender: 'user', text },
      { id: assistantMsgId, sender: 'assistant', text: '' },
    ]);

    setIsStreaming(true);

    try {
      await aiService.streamChat(
        text,
        groupId,
        (token) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, text: m.text + token } : m))
          );
        },
        (proposal) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, proposal } : m))
          );
        }
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleApplyProposal = async (proposalId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await aiService.applyBudgetProposal(proposalId);

    setMessages((prev) =>
      prev.map((m) =>
        m.proposal?.id === proposalId
          ? {
              ...m,
              proposal: { ...m.proposal, status: 'applied' },
            }
          : m
      )
    );
  };

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

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

        <View style={styles.headerTitleContainer}>
          <View style={styles.titleRow}>
            <Sparkles size={16} color={THEME.colors.aiLight} />
            <Text style={styles.headerTitle}>SplitIt AI Assistant</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            {groupName ? `Scoped to ${groupName}` : 'Financial RAG Grounding'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setMessages([
              {
                id: 'welcome_reset',
                sender: 'assistant',
                text: 'Chat history cleared. How can I assist your finances?',
              },
            ]);
          }}
          style={styles.closeButton}
        >
          <Trash2 size={18} color={THEME.colors.textMuted} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.chatArea}
        keyboardVerticalOffset={10}
      >
        {/* Messages Feed */}
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.messageRow,
                msg.sender === 'user' ? styles.messageRowUser : styles.messageRowAssistant,
              ]}
            >
              {msg.sender === 'assistant' && (
                <View style={styles.assistantAvatar}>
                  <Bot size={16} color={THEME.colors.aiLight} />
                </View>
              )}

              <View
                style={[
                  styles.messageBubble,
                  msg.sender === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
                ]}
              >
                <Text style={styles.messageText}>{msg.text}</Text>

                {/* Interactive Budget Proposal Card */}
                {msg.proposal && (
                  <View style={styles.proposalCard}>
                    <View style={styles.proposalHeader}>
                      <TrendingUp size={16} color={THEME.colors.primary} />
                      <Text style={styles.proposalTitle}>AI Budget Proposal</Text>
                    </View>

                    <Text style={styles.proposalReasoning}>{msg.proposal.aiReasoning}</Text>

                    <View style={styles.changesList}>
                      {msg.proposal.categoryChanges.map((ch, idx) => (
                        <View key={idx} style={styles.changeItem}>
                          <Text style={styles.changeCategory}>{ch.name}</Text>
                          <Text style={styles.changeValues}>
                            <Text style={styles.strikeText}>₹{ch.old.toLocaleString()}</Text> ➔{' '}
                            <Text
                              style={{
                                color: ch.diff >= 0 ? THEME.colors.primary : THEME.colors.negative,
                                fontWeight: '700',
                              }}
                            >
                              ₹{ch.new.toLocaleString()} ({ch.diff >= 0 ? `+₹${ch.diff}` : `-₹${Math.abs(ch.diff)}`})
                            </Text>
                          </Text>
                        </View>
                      ))}
                    </View>

                    {msg.proposal.status === 'applied' ? (
                      <View style={styles.appliedBanner}>
                        <CheckCircle2 size={15} color={THEME.colors.primary} />
                        <Text style={styles.appliedText}>Proposal Approved & Applied</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.applyButton}
                        onPress={() => handleApplyProposal(msg.proposal!.id)}
                      >
                        <Text style={styles.applyButtonText}>Approve & Apply to Group</Text>
                        <ArrowRight size={15} color="#09090B" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>
          ))}

          {isStreaming && (
            <View style={styles.streamingIndicator}>
              <ActivityIndicator size="small" color={THEME.colors.aiLight} />
              <Text style={styles.streamingText}>Thinking & crunching analytics...</Text>
            </View>
          )}
        </ScrollView>

        {/* Quick Suggestion Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsRow}
        >
          {quickPrompts.map((prompt, i) => (
            <TouchableOpacity
              key={i}
              style={styles.promptPill}
              onPress={() => handleSend(prompt)}
              disabled={isStreaming}
            >
              <Text style={styles.promptPillText}>{prompt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.inputField}
            placeholder="Ask about spending, debts, budgets..."
            placeholderTextColor={THEME.colors.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || isStreaming) && styles.sendButtonDisabled]}
            onPress={() => handleSend()}
            disabled={!input.trim() || isStreaming}
          >
            <Send size={16} color={input.trim() ? '#09090B' : THEME.colors.textMuted} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  closeButton: {
    padding: 6,
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  chatArea: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 14,
  },
  messageRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
  },
  assistantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
  },
  bubbleUser: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    color: THEME.colors.text,
    lineHeight: 20,
  },
  proposalCard: {
    marginTop: 12,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.sm,
    padding: 12,
    gap: 8,
  },
  proposalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  proposalTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: 0.5,
  },
  proposalReasoning: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    lineHeight: 16,
  },
  changesList: {
    gap: 6,
    marginTop: 4,
  },
  changeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  changeCategory: {
    fontSize: 12,
    color: THEME.colors.text,
    fontWeight: '600',
  },
  changeValues: {
    fontSize: 12,
  },
  strikeText: {
    textDecorationLine: 'line-through',
    color: THEME.colors.textMuted,
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.colors.primary,
    paddingVertical: 10,
    borderRadius: THEME.radius.sm,
    marginTop: 6,
  },
  applyButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#09090B',
  },
  appliedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingVertical: 8,
    borderRadius: THEME.radius.sm,
    marginTop: 6,
  },
  appliedText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  streamingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 36,
  },
  streamingText: {
    fontSize: 12,
    color: THEME.colors.aiLight,
  },
  pillsRow: {
    paddingHorizontal: 12,
    gap: 8,
    paddingVertical: 8,
  },
  promptPill: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: THEME.radius.full,
  },
  promptPillText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
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
  inputField: {
    flex: 1,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: THEME.colors.text,
    maxHeight: 90,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: THEME.colors.surfaceElevated,
  },
});
