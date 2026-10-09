import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  Keyboard,
  Alert,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  TrendingDown,
  Info,
  Copy,
  Check,
  Square,
  Scale,
  Receipt,
  ShieldCheck,
  Calculator,
  Database,
  Cpu,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { THEME } from '../../src/constants/theme';
import { aiService, BudgetActionProposal } from '../../src/services/ai.service';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  proposal?: BudgetActionProposal;
  statusLabel?: string;
}

// ── Rich Markdown & Financial Entity Renderer ───────────────────────────────
function FormattedInlineText({ text }: { text: string }) {
  const parts: Array<{ type: 'text' | 'bold' | 'currency'; content: string }> = [];
  const regex = /(\*\*[^*]+\*\*|₹[0-9,]+(?:\.[0-9]{2})?)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push({
        type: 'text',
        content: text.substring(lastIdx, match.index),
      });
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push({
        type: 'bold',
        content: token.slice(2, -2),
      });
    } else if (token.startsWith('₹')) {
      parts.push({
        type: 'currency',
        content: token,
      });
    }
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < text.length) {
    parts.push({
      type: 'text',
      content: text.substring(lastIdx),
    });
  }

  return (
    <Text style={styles.messageText}>
      {parts.map((p, i) => {
        if (p.type === 'bold') {
          return (
            <Text key={i} style={styles.boldText}>
              {p.content}
            </Text>
          );
        }
        if (p.type === 'currency') {
          return (
            <Text key={i} style={styles.currencyHighlight}>
              {p.content}
            </Text>
          );
        }
        return <Text key={i}>{p.content}</Text>;
      })}
    </Text>
  );
}

function RichMessageContent({ text, isStreaming }: { text: string; isStreaming?: boolean }) {
  const paragraphs = text.split('\n');

  return (
    <View style={styles.richContentContainer}>
      {paragraphs.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <View key={idx} style={styles.paragraphSpacer} />;
        }

        if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const bulletContent = trimmed.replace(/^[•\-\*]\s*/, '');
          return (
            <View key={idx} style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <View style={styles.bulletTextContainer}>
                <FormattedInlineText text={bulletContent} />
              </View>
            </View>
          );
        }

        if (trimmed.startsWith('### ') || trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
          const headingContent = trimmed.replace(/^#+\s*/, '');
          return (
            <Text key={idx} style={styles.messageHeading}>
              {headingContent}
            </Text>
          );
        }

        return (
          <View key={idx} style={styles.paragraphRow}>
            <FormattedInlineText text={line} />
          </View>
        );
      })}
      {isStreaming && <Text style={styles.typewriterCursor}>▋</Text>}
    </View>
  );
}

// ── Main Flagship AI Chat Screen ────────────────────────────────────────────
export default function AiChatModal() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { groupId, groupName } = useLocalSearchParams<{ groupId?: string; groupName?: string }>();

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Hello! I am your **SplitIt AI Financial Assistant**.\n\nI have real-time ledger grounding on your groups, spending velocity, debts, and budgets with zero math hallucinations. How can I help you today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStage, setStreamStage] = useState<string | null>(null);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [arePillsDismissed, setArePillsDismissed] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [isInfoModalVisible, setIsInfoModalVisible] = useState(false);

  // Dynamic smooth bottom padding animation synchronized with keyboard transitions
  const closedBottomPadding = Math.max(insets.bottom, 12);
  const openBottomPadding = Platform.OS === 'ios' ? 10 : 12;
  const bottomPaddingAnim = useRef(new Animated.Value(closedBottomPadding)).current;

  const scrollViewRef = useRef<ScrollView>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToEndThrottled = useCallback(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 60);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 200);
  }, []);

  // Ensure bottomPaddingAnim stays in sync if safe area insets change while keyboard is closed
  useEffect(() => {
    if (!isKeyboardOpen) {
      bottomPaddingAnim.setValue(closedBottomPadding);
    }
  }, [closedBottomPadding, isKeyboardOpen, bottomPaddingAnim]);

  // Smooth, synchronized Keyboard Listener for both iOS and Android
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onKeyboardShow = (e: any) => {
      const height = e?.endCoordinates?.height || 0;
      setKeyboardHeight(height);
      setIsKeyboardOpen(true);

      const duration = Platform.OS === 'ios' ? (e?.duration || 250) : 160;
      Animated.timing(bottomPaddingAnim, {
        toValue: openBottomPadding,
        duration,
        easing: Platform.OS === 'ios' ? Easing.bezier(0.25, 0.1, 0.25, 1) : Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();

      scrollToEndThrottled();
    };

    const onKeyboardHide = (e: any) => {
      setKeyboardHeight(0);
      setIsKeyboardOpen(false);

      const duration = Platform.OS === 'ios' ? (e?.duration || 250) : 160;
      Animated.timing(bottomPaddingAnim, {
        toValue: closedBottomPadding,
        duration,
        easing: Platform.OS === 'ios' ? Easing.bezier(0.25, 0.1, 0.25, 1) : Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
    };

    const showSub = Keyboard.addListener(showEvent, onKeyboardShow);
    const hideSub = Keyboard.addListener(hideEvent, onKeyboardHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [closedBottomPadding, openBottomPadding, scrollToEndThrottled, bottomPaddingAnim]);

  // Starter Cards for Empty / Welcome State
  const starterCards = useMemo(
    () => [
      {
        id: 'owe',
        title: 'Who owes what?',
        description: 'Audit simplified debt balances across all groups',
        prompt: 'How much do I owe, and who owes me money right now?',
        icon: Scale,
        accentColor: THEME.colors.primary,
        badgeBg: 'rgba(28, 194, 159, 0.12)',
      },
      {
        id: 'budget',
        title: 'Suggest budget cuts',
        description: groupName ? `Optimize caps for ${groupName}` : 'Auto-balance group categories to stay under limit',
        prompt: groupName ? `Suggest budget cuts for ${groupName}` : 'Suggest budget cuts for Apartment Flatmates',
        icon: TrendingDown,
        accentColor: THEME.colors.aiLight,
        badgeBg: 'rgba(139, 92, 246, 0.12)',
      },
      {
        id: 'expenses',
        title: 'Largest expenses',
        description: 'Detect high-ticket transactions & unusual spikes',
        prompt: 'What was our largest expense this month?',
        icon: Receipt,
        accentColor: THEME.colors.warning,
        badgeBg: 'rgba(245, 158, 11, 0.12)',
      },
      {
        id: 'trend',
        title: 'Spending velocity',
        description: 'Analyze burn rate and category breakdown timeline',
        prompt: "What's our spending trend this month vs last month?",
        icon: TrendingUp,
        accentColor: THEME.colors.infoLight,
        badgeBg: 'rgba(56, 189, 248, 0.12)',
      },
    ],
    [groupName]
  );

  // Compact Follow-Up Chips for ongoing conversation
  const followUpChips = useMemo(
    () => [
      { label: 'Who owes what?', icon: Scale, prompt: 'How much do I owe, and who owes me right now?' },
      { label: 'Budget cuts', icon: TrendingDown, prompt: groupName ? `Suggest budget cuts for ${groupName}` : 'Suggest budget cuts for Apartment Flatmates' },
      { label: 'Top expenses', icon: Receipt, prompt: 'What was our largest expense this month?' },
      { label: 'Spending velocity', icon: TrendingUp, prompt: "What's our spending trend this month vs last month?" },
    ],
    [groupName]
  );

  const handleStop = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setStreamStage(null);
  }, []);

  const handleSend = async (promptToSend?: string) => {
    const text = (promptToSend || input).trim();
    if (!text || isStreaming) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput('');

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsgId = `msg_${Date.now()}`;
    const assistantMsgId = `msg_${Date.now() + 1}`;

    const newMessages: ChatMessage[] = [
      ...messages,
      { id: userMsgId, sender: 'user', text, timestamp: timeStr },
      { id: assistantMsgId, sender: 'assistant', text: '', timestamp: timeStr },
    ];
    setMessages(newMessages);

    setIsStreaming(true);
    setStreamStage('Searching ledger & expenses...');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Build history payload for backend
    const historyPayload = newMessages.slice(-6).map((m) => ({
      role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.text,
    }));

    try {
      await aiService.streamChat(
        text,
        groupId,
        (token) => {
          setStreamStage(null);
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, text: m.text + token } : m))
          );
        },
        (proposal) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, proposal } : m))
          );
        },
        (status) => {
          setStreamStage(status.message);
        },
        controller.signal,
        historyPayload
      );
    } catch {
      // Aborted or finished
    } finally {
      setIsStreaming(false);
      setStreamStage(null);
      abortControllerRef.current = null;
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

  const handleCopyMessage = async (msgId: string, text: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear Conversation',
      'Are you sure you want to clear your AI chat history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            handleStop();
            setMessages([
              {
                id: 'welcome_reset',
                sender: 'assistant',
                text: 'Chat history cleared. How can I assist your ledger or budgets today?',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            ]);
            setArePillsDismissed(false);
          },
        },
      ]
    );
  };

  useEffect(() => {
    scrollToEndThrottled();
  }, [messages, isStreaming, scrollToEndThrottled]);

  // Show inline follow-up chips ONLY when conversation is active, input is empty, and keyboard is NOT covering the screen
  const showFollowUpChips =
    messages.length > 1 &&
    input.trim().length === 0 &&
    !isStreaming &&
    !arePillsDismissed &&
    !isKeyboardOpen;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* ── Top Modal Grab Notch ────────────────────────────────────────── */}
      <View style={styles.modalGrabber} />

      {/* ── Flagship Header ────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          style={styles.headerIconButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Close"
        >
          <X size={18} color={THEME.colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <View style={styles.aiGlowDot} />
            <Text style={styles.headerTitle}>SplitIt Financial AI</Text>
          </View>
          <View style={styles.headerStatusRow}>
            <Text style={styles.headerSubtitle}>
              {groupName ? `Scoped to ${groupName}` : 'Zero Math Hallucinations · RAG Ledger'}
            </Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsInfoModalVisible(true);
            }}
            style={styles.headerIconButton}
            accessibilityLabel="Assistant Info"
          >
            <Info size={18} color={THEME.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleClearHistory}
            style={styles.headerIconButton}
            accessibilityLabel="Clear history"
          >
            <Trash2 size={17} color={THEME.colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Keyboard-Adaptive Container ─────────────────────────────────── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={styles.keyboardContainer}
      >
        <View style={styles.innerContentWrapper}>
          {/* ── Messages Feed ─────────────────────────────────────────────── */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesScroll}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
          >
            {/* Welcome State: Expands when keyboard is closed, collapses compactly when keyboard is open */}
            {messages.length <= 1 && (
              isKeyboardOpen ? (
                /* Compact 1-line Starter Bar when Keyboard is Active */
                <View style={styles.compactWelcomeContainer}>
                  <View style={styles.compactWelcomeHeader}>
                    <Sparkles size={14} color={THEME.colors.primary} />
                    <Text style={styles.compactWelcomeTitle}>Quick Financial Prompts</Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.compactChipsRow}
                    keyboardShouldPersistTaps="handled"
                  >
                    {starterCards.map((card) => {
                      const CardIcon = card.icon;
                      return (
                        <TouchableOpacity
                          key={card.id}
                          style={styles.compactStarterChip}
                          onPress={() => handleSend(card.prompt)}
                          activeOpacity={0.75}
                          disabled={isStreaming}
                        >
                          <CardIcon size={12} color={card.accentColor} />
                          <Text style={styles.compactStarterChipText}>{card.title}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : (
                /* Full Flagship Hero Starter Cards Grid when Keyboard is Closed */
                <View style={styles.welcomeHeroContainer}>
                  <View style={styles.heroSparkleBadge}>
                    <Sparkles size={24} color={THEME.colors.primary} />
                  </View>
                  <Text style={styles.heroTitle}>Financial Intelligence</Text>
                  <Text style={styles.heroSubtitle}>
                    Real-time ledger context on your balances, debts, and budgets with zero math hallucinations.
                  </Text>

                  <View style={styles.starterGrid}>
                    {starterCards.map((card) => {
                      const CardIcon = card.icon;
                      return (
                        <TouchableOpacity
                          key={card.id}
                          style={styles.starterCard}
                          onPress={() => handleSend(card.prompt)}
                          activeOpacity={0.75}
                          disabled={isStreaming}
                        >
                          <View style={styles.starterCardHeader}>
                            <View style={[styles.starterIconBadge, { backgroundColor: card.badgeBg }]}>
                              <CardIcon size={16} color={card.accentColor} />
                            </View>
                            <ArrowRight size={14} color={THEME.colors.textMuted} />
                          </View>
                          <Text style={styles.starterCardTitle}>{card.title}</Text>
                          <Text style={styles.starterCardDesc} numberOfLines={2}>
                            {card.description}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )
            )}

            {/* Messages Flow */}
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <View
                  key={msg.id}
                  style={[
                    styles.messageRow,
                    isUser ? styles.messageRowUser : styles.messageRowAssistant,
                  ]}
                >
                  {!isUser && (
                    <View style={styles.assistantAvatar}>
                      <Bot size={15} color={THEME.colors.aiLight} />
                    </View>
                  )}

                  <View
                    style={[
                      styles.messageBubble,
                      isUser ? styles.bubbleUser : styles.bubbleAssistant,
                    ]}
                  >
                    {/* Rich Text Formatter */}
                    <RichMessageContent
                      text={msg.text}
                      isStreaming={isStreaming && msg.id === messages[messages.length - 1]?.id}
                    />

                    {/* Interactive Budget Action Proposal Card */}
                    {msg.proposal && (
                      <View style={styles.proposalCard}>
                        <View style={styles.proposalHeader}>
                          <View style={styles.proposalHeaderIcon}>
                            <TrendingUp size={15} color={THEME.colors.primary} />
                          </View>
                          <View style={styles.proposalHeaderTitles}>
                            <Text style={styles.proposalTitle}>AI Budget Proposal</Text>
                            <Text style={styles.proposalGroupScope}>{msg.proposal.groupName}</Text>
                          </View>
                        </View>

                        <Text style={styles.proposalReasoning}>{msg.proposal.aiReasoning}</Text>

                        <View style={styles.changesList}>
                          {msg.proposal.categoryChanges.map((ch, idx) => (
                            <View key={idx} style={styles.changeItem}>
                              <Text style={styles.changeCategory}>{ch.name}</Text>
                              <View style={styles.changeValues}>
                                <Text style={styles.strikeText}>₹{ch.old.toLocaleString()}</Text>
                                <Text style={styles.arrowSeparator}>➔</Text>
                                <Text
                                  style={[
                                    styles.newAmountText,
                                    { color: ch.diff >= 0 ? THEME.colors.primaryLight : THEME.colors.negativeLight },
                                  ]}
                                >
                                  ₹{ch.new.toLocaleString()}{' '}
                                  <Text style={styles.diffPill}>
                                    ({ch.diff >= 0 ? `+₹${ch.diff}` : `-₹${Math.abs(ch.diff)}`})
                                  </Text>
                                </Text>
                              </View>
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
                            activeOpacity={0.85}
                          >
                            <Text style={styles.applyButtonText}>Approve & Apply to Group Ledger</Text>
                            <ArrowRight size={14} color={THEME.colors.primaryForeground} />
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {/* Message Footer / Copy Action */}
                    <View style={styles.bubbleFooter}>
                      <Text style={styles.timestampText}>{msg.timestamp}</Text>
                      {!isUser && msg.text.trim().length > 0 && (
                        <TouchableOpacity
                          onPress={() => handleCopyMessage(msg.id, msg.text)}
                          style={styles.copyAction}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          {copiedMsgId === msg.id ? (
                            <View style={styles.copiedBadge}>
                              <Check size={11} color={THEME.colors.primary} />
                              <Text style={styles.copiedText}>Copied</Text>
                            </View>
                          ) : (
                            <Copy size={12} color={THEME.colors.textMuted} />
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {isUser && (
                    <View style={styles.userAvatar}>
                      <User size={14} color={THEME.colors.text} />
                    </View>
                  )}
                </View>
              );
            })}

            {/* Thinking / Streaming Indicator */}
            {isStreaming && (
              <View style={styles.thinkingContainer}>
                <View style={styles.thinkingPill}>
                  <ActivityIndicator size="small" color={THEME.colors.aiLight} />
                  <Text style={styles.thinkingText}>
                    {streamStage || 'Analyzing ledger records...'}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* ── Follow-Up Suggestion Chips (Above Input, hidden when typing/keyboard open) ── */}
          {showFollowUpChips && (
            <View style={styles.chipsWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                {followUpChips.map((chip, idx) => {
                  const ChipIcon = chip.icon;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={styles.chipButton}
                      onPress={() => handleSend(chip.prompt)}
                      activeOpacity={0.7}
                    >
                      <ChipIcon size={12} color={THEME.colors.aiLight} />
                      <Text style={styles.chipText}>{chip.label}</Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={styles.chipDismissButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setArePillsDismissed(true);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={12} color={THEME.colors.textMuted} />
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}

          {/* ── Input Bar Capsule ─────────────────────────────────────────── */}
          <Animated.View
            style={[
              styles.inputContainer,
              {
                paddingBottom: bottomPaddingAnim,
              },
            ]}
          >
            <View style={styles.inputCapsule}>
              <TextInput
                style={styles.textInput}
                placeholder="Ask about spending, debts, budgets..."
                placeholderTextColor={THEME.colors.textMuted}
                value={input}
                onChangeText={setInput}
                multiline
                maxLength={800}
                onFocus={() => scrollToEndThrottled()}
              />

              {input.length > 0 && !isStreaming && (
                <TouchableOpacity
                  onPress={() => setInput('')}
                  style={styles.clearInputButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={14} color={THEME.colors.textMuted} />
                </TouchableOpacity>
              )}

              {isStreaming ? (
                <TouchableOpacity
                  style={styles.stopButton}
                  onPress={handleStop}
                  activeOpacity={0.85}
                  accessibilityLabel="Stop generation"
                >
                  <Square size={13} color={THEME.colors.text} fill={THEME.colors.text} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    !input.trim() && styles.sendButtonDisabled,
                  ]}
                  onPress={() => handleSend()}
                  disabled={!input.trim()}
                  activeOpacity={0.85}
                >
                  <Send
                    size={15}
                    color={input.trim() ? THEME.colors.primaryForeground : THEME.colors.textMuted}
                  />
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>

      {/* ── Financial Assistant Info Modal ─────────────────────────────── */}
      <Modal
        visible={isInfoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsInfoModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsInfoModalVisible(false)}
        >
          <View style={styles.infoModalCard}>
            <View style={styles.infoModalHeader}>
              <View style={styles.infoModalIconBadge}>
                <Sparkles size={18} color={THEME.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoModalTitle}>Private Financial Intelligence</Text>
                <Text style={styles.infoModalSubtitle}>RAG Grounded · Zero Math Hallucinations</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsInfoModalVisible(false)}
                style={styles.infoModalCloseButton}
              >
                <X size={18} color={THEME.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.infoList}>
              <View style={styles.infoRow}>
                <Calculator size={16} color={THEME.colors.success} style={styles.infoRowIcon} />
                <View style={styles.infoRowContent}>
                  <Text style={styles.infoRowTitle}>Zero Math Hallucinations</Text>
                  <Text style={styles.infoRowDesc}>
                    Balances, debts, and cuts are computed strictly server-side from your ledger. The AI never guesses numbers.
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Database size={16} color={THEME.colors.infoLight} style={styles.infoRowIcon} />
                <View style={styles.infoRowContent}>
                  <Text style={styles.infoRowTitle}>Semantic Vector Search</Text>
                  <Text style={styles.infoRowDesc}>
                    Transactions are indexed with vectors, retrieving context by financial meaning before answering.
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <ShieldCheck size={16} color={THEME.colors.aiLight} style={styles.infoRowIcon} />
                <View style={styles.infoRowContent}>
                  <Text style={styles.infoRowTitle}>Private by Design</Text>
                  <Text style={styles.infoRowDesc}>
                    Ledger facts never leave your account scope. History is strictly private and never used to train public models.
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Cpu size={16} color={THEME.colors.warning} style={styles.infoRowIcon} />
                <View style={styles.infoRowContent}>
                  <Text style={styles.infoRowTitle}>How It Operates</Text>
                  <Text style={styles.infoRowDesc}>
                    Question ➔ Server calculates ledger facts ➔ Semantic retrieval ➔ AI synthesizes answer ➔ Live SSE stream.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ── Flagship Dark Theme Styles ──────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  modalGrabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: THEME.colors.background,
  },
  headerIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerCenter: {
    flex: 1,
    marginLeft: 12,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiGlowDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: THEME.colors.primary,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.2,
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  headerSubtitle: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  keyboardContainer: {
    flex: 1,
  },
  innerContentWrapper: {
    flex: 1,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 14,
  },
  // Welcome State - Full Grid
  welcomeHeroContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 6,
  },
  heroSparkleBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(28, 194, 159, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(28, 194, 159, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 20,
    maxWidth: 320,
  },
  starterGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  starterCard: {
    width: '48.5%',
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: THEME.radius.lg,
    padding: 12,
  },
  starterCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  starterIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starterCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
    marginBottom: 4,
  },
  starterCardDesc: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    lineHeight: 15,
  },
  // Welcome State - Compact Bar When Keyboard is Active
  compactWelcomeContainer: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
    gap: 6,
  },
  compactWelcomeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactWelcomeTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  compactChipsRow: {
    gap: 6,
    paddingVertical: 2,
  },
  compactStarterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.radius.full,
  },
  compactStarterChipText: {
    fontSize: 11,
    color: THEME.colors.text,
    fontWeight: '600',
  },
  // Messages Flow
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
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
  },
  // User bubble: Sharp edge moved to TOP-RIGHT pointing to user avatar
  bubbleUser: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 18,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  // Assistant bubble: Sharp edge moved to TOP-LEFT pointing to bot avatar
  bubbleAssistant: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.22)',
    borderRadius: 18,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
  },
  // Rich Markdown Text Formatting
  richContentContainer: {
    gap: 4,
  },
  paragraphRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  paragraphSpacer: {
    height: 6,
  },
  messageText: {
    fontSize: 13.5,
    color: THEME.colors.text,
    lineHeight: 20,
  },
  boldText: {
    fontWeight: '800',
    color: THEME.colors.text,
  },
  currencyHighlight: {
    fontWeight: '800',
    color: THEME.colors.primaryLight,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginVertical: 2,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: THEME.colors.aiLight,
    marginTop: 8,
  },
  bulletTextContainer: {
    flex: 1,
  },
  messageHeading: {
    fontSize: 14.5,
    fontWeight: '900',
    color: THEME.colors.text,
    marginTop: 6,
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  typewriterCursor: {
    fontSize: 14,
    color: THEME.colors.aiLight,
    fontWeight: '900',
    marginLeft: 2,
  },
  bubbleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 4,
  },
  timestampText: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  copyAction: {
    padding: 2,
  },
  copiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(28, 194, 159, 0.1)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  copiedText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  // Budget Proposal Card
  proposalCard: {
    marginTop: 10,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: 'rgba(28, 194, 159, 0.25)',
    borderRadius: THEME.radius.md,
    padding: 12,
    gap: 8,
  },
  proposalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  proposalHeaderIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(28, 194, 159, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proposalHeaderTitles: {
    flex: 1,
  },
  proposalTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  proposalGroupScope: {
    fontSize: 10,
    color: THEME.colors.textMuted,
  },
  proposalReasoning: {
    fontSize: 11.5,
    color: THEME.colors.textSecondary,
    lineHeight: 16,
  },
  changesList: {
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: THEME.radius.sm,
    padding: 8,
  },
  changeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  changeCategory: {
    fontSize: 11.5,
    color: THEME.colors.text,
    fontWeight: '600',
  },
  changeValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  strikeText: {
    textDecorationLine: 'line-through',
    color: THEME.colors.textMuted,
    fontSize: 11,
  },
  arrowSeparator: {
    color: THEME.colors.textMuted,
    fontSize: 10,
  },
  newAmountText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  diffPill: {
    fontSize: 10,
    fontWeight: '600',
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.colors.primary,
    paddingVertical: 9,
    borderRadius: THEME.radius.sm,
    marginTop: 4,
  },
  applyButtonText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: THEME.colors.primaryForeground,
  },
  appliedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingVertical: 7,
    borderRadius: THEME.radius.sm,
    marginTop: 4,
  },
  appliedText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  // Thinking Indicator
  thinkingContainer: {
    paddingLeft: 36,
    marginVertical: 4,
  },
  thinkingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  thinkingText: {
    fontSize: 11.5,
    color: THEME.colors.aiLight,
    fontWeight: '500',
  },
  // Follow-Up Chips (Above Input)
  chipsWrapper: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: THEME.colors.background,
  },
  chipsScrollContent: {
    paddingHorizontal: 14,
    gap: 8,
    alignItems: 'center',
  },
  chipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.22)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
  },
  chipText: {
    fontSize: 11.5,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  chipDismissButton: {
    padding: 6,
    marginLeft: 2,
  },
  // Input Bar
  inputContainer: {
    paddingHorizontal: 14,
    paddingTop: 8,
    backgroundColor: THEME.colors.background,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  inputCapsule: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: THEME.colors.text,
    minHeight: 40,
    maxHeight: 110,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
  },
  clearInputButton: {
    padding: 6,
    alignSelf: 'center',
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  sendButtonDisabled: {
    backgroundColor: THEME.colors.surfaceElevated,
  },
  stopButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.critical,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  // Info Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  infoModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 20,
    gap: 16,
  },
  infoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  infoModalIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(28, 194, 159, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoModalTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  infoModalSubtitle: {
    fontSize: 10.5,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  infoModalCloseButton: {
    padding: 4,
  },
  infoList: {
    gap: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoRowIcon: {
    marginTop: 2,
  },
  infoRowContent: {
    flex: 1,
  },
  infoRowTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.text,
    marginBottom: 2,
  },
  infoRowDesc: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    lineHeight: 15,
  },
});
