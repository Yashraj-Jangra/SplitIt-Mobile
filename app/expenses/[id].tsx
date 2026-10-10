import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  Camera,
  Trash2,
  Pencil,
  Send,
  Check,
  X,
  ArrowRight,
  UserPlus,
  UserMinus,
  MessageSquare,
  ImageIcon,
  AlertCircle,
  RefreshCw,
  RotateCcw,
  Plus,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { THEME } from '../../src/constants/theme';
import { expenseService, ExpenseDetailModel, deduplicateExpenseLogs } from '../../src/services/expense.service';
import { groupService } from '../../src/services/group.service';
import { authService } from '../../src/services/auth.service';
import { settingsService } from '../../src/services/settings.service';
import { CategoryIcon, getCategoryColor } from '../../src/utils/category-icons';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import {
  areParticipantsValid,
} from '@splitit/core';
import * as Haptics from 'expo-haptics';
import { useNetwork } from '../../src/contexts/network.context';
import { SplitBreakdownSkeleton } from '../../src/components/skeletons/SplitBreakdownSkeleton';

export default function ExpenseDetailScreen() {
  const router = useRouter();
  const { requireOnline } = useNetwork();
  const params = useLocalSearchParams<{
    id: string;
    groupId?: string;
    title?: string;
    amount?: string;
    paidByName?: string;
    date?: string;
    category?: string;
  }>();

  const expenseId = Array.isArray(params.id) ? params.id[0] : params.id;
  const rawGroupId = Array.isArray(params.groupId) ? params.groupId[0] : (params.groupId || '');
  const [groupId, setGroupId] = useState(rawGroupId);
  const inMem = expenseService.getInMemoryExpenseDetails(expenseId);
  const [hasSplitLoaded, setHasSplitLoaded] = useState(() => areParticipantsValid(inMem?.participants));
  const [loadError, setLoadError] = useState<string | null>(null);

  const [expense, setExpense] = useState<ExpenseDetailModel | null>(() => {
    if (inMem) return inMem;
    if (params.title && params.amount) {
      const parsedAmt = parseFloat(params.amount) || 0;
      return {
        id: expenseId,
        groupId: rawGroupId,
        groupName: 'Group Expense',
        title: params.title,
        amount: parsedAmt,
        currency: 'INR',
        date: params.date || 'Today',
        rawDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        category: {
          master: settingsService.getMasterCategory(params.category || 'Other'),
          sub: params.category || 'Other',
        },
        splitType: 'equally',
        paidById: 'payer',
        paidByName: params.paidByName || 'Member',
        payers: [
          {
            userId: 'payer',
            name: params.paidByName || 'Member',
            amount: parsedAmt,
          },
        ],
        participants: [], // No bogus 100% owe participant! Avoid flashing "You owe full amount"
        creator: {
          id: 'creator',
          name: params.paidByName || 'Member',
        },
        logs: [],
      };
    }
    return null;
  });

  const [loading, setLoading] = useState(!inMem && !params.title);
  const [commentInput, setCommentInput] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);

  // Group Members & Auth User
  const [groupMembers, setGroupMembers] = useState<{ id: string; name: string; avatarUrl?: string }[]>([]);
  const [currentUserId, setCurrentUserId] = useState('u1');

  // Receipt Modal State
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  const fetchExpense = async () => {
    try {
      setLoadError(null);
      const data = await expenseService.getExpenseDetails(expenseId, groupId || undefined);
      if (!data) {
        if (!expense && !params.title) {
          setLoadError('Expense could not be found or loaded.');
        }
        return;
      }
      setExpense(data);
      if (areParticipantsValid(data.participants)) {
        setHasSplitLoaded(true);
      }
      const targetGId = data.groupId || groupId;
      if (targetGId) {
        if (!groupId) setGroupId(targetGId);
        groupService
          .getGroupDetails(targetGId)
          .then((g) => {
            if (g?.members) setGroupMembers(g.members);
          })
          .catch(() => {});
      }
    } catch (err: any) {
      if (!expense && !params.title) {
        setLoadError(err?.message || 'Failed to load expense details.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    authService.getCachedUser().then((u) => {
      if (u?.id) setCurrentUserId(u.id);
    });
  }, []);


  useEffect(() => {
    let active = true;
    // 0ms Fast Tick: Hydrate offline split record immediately
    expenseService.getCachedExpenseDetails(expenseId).then((cached) => {
      if (!active) return;
      if (cached) {
        setExpense(cached);
        if (areParticipantsValid(cached.participants)) {
          setHasSplitLoaded(true);
        }
        setLoading(false);
      }
      fetchExpense();
    });
    return () => {
      active = false;
    };
  }, [expenseId, groupId]);

  useFocusEffect(
    useCallback(() => {
      fetchExpense();
    }, [expenseId, groupId])
  );

  const handleDelete = () => {
    if (!requireOnline('delete an expense')) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Delete Expense',
      `Are you sure you want to delete "${expense?.title || params.title || 'this expense'}"? All group balances will be recalculated.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            const amt = expense?.amount || parseFloat(params.amount || '0') || 0;
            const targetGroupId = expense?.groupId || groupId;
            await expenseService.deleteExpense(expenseId, targetGroupId, amt);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          },
        },
      ]
    );
  };

  const handleOpenEdit = () => {
    if (!requireOnline('edit this expense')) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/expenses/new',
      params: {
        expenseId,
        groupId: expense?.groupId || groupId,
      },
    });
  };

  const handleSendComment = async () => {
    if (!requireOnline('post comments')) return;
    const text = commentInput.trim();
    if (!text || isSendingComment) return;

    setIsSendingComment(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const newLog = await expenseService.addExpenseComment(expenseId, text);
    setExpense((prev) => (prev ? { ...prev, logs: [...prev.logs, newLog] } : prev));
    setCommentInput('');
    setIsSendingComment(false);

    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 200);
  };

  const handleReceiptAction = async () => {
    Haptics.selectionAsync();
    if (expense?.receiptImageUrl) {
      setIsReceiptModalOpen(true);
    } else {
      Alert.alert(
        'Attach Receipt',
        'Upload a receipt photo for this expense',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Choose from Gallery',
            onPress: async () => {
              const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.8,
              });
              if (!res.canceled && res.assets?.[0]?.uri) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setExpense((prev) => (prev ? { ...prev, receiptImageUrl: res.assets[0].uri } : prev));
                Alert.alert('Receipt Attached', 'Receipt image has been saved to this expense.');
              }
            },
          },
        ]
      );
    }
  };



  const title = expense?.title || params.title || 'Expense';
  const amount = expense?.amount || parseFloat(params.amount || '0') || 0;
  const currencySymbol = '₹';
  const primaryPayerName =
    expense?.paidByName && expense.paidByName !== 'undefined'
      ? expense.paidByName
      : params.paidByName && params.paidByName !== 'undefined'
      ? params.paidByName
      : 'Member';
  const creatorName =
    expense?.creator?.name && expense.creator.name !== 'undefined'
      ? expense.creator.name
      : primaryPayerName;
  const dateFormatted = expense?.date || params.date || 'Today';
  const participants = expense?.participants || [];
  const rawLogs = expense?.logs || [];
  const logs = useMemo(() => deduplicateExpenseLogs(rawLogs), [rawLogs]);

  const payersList = useMemo(() => {
    if (expense?.payers && expense.payers.length > 0) {
      return expense.payers.map((p) => {
        const member = groupMembers.find((m) => m.id === p.userId);
        const participant = participants.find((part) => part.userId === p.userId);
        const resolvedName =
          p.name && p.name !== 'undefined'
            ? p.name
            : member?.name && member.name !== 'undefined'
            ? member.name
            : participant?.name && participant.name !== 'undefined'
            ? participant.name
            : p.userId === expense?.paidById && primaryPayerName && primaryPayerName !== 'undefined'
            ? primaryPayerName
            : 'Member';
        const resolvedAvatar =
          p.avatarUrl ||
          member?.avatarUrl ||
          participant?.avatarUrl ||
          (p.userId === expense?.paidById ? expense?.paidByAvatar : undefined);
        return {
          ...p,
          name: resolvedName,
          avatarUrl: resolvedAvatar,
          amount: Number(p.amount || 0),
        };
      });
    }
    return [
      {
        userId: expense?.paidById || 'payer',
        name: primaryPayerName || 'Member',
        avatarUrl: expense?.paidByAvatar,
        amount: amount,
      },
    ];
  }, [expense, primaryPayerName, amount, groupMembers, participants]);

  const payersMap = useMemo(() => {
    const map: Record<string, number> = {};
    payersList.forEach((p) => {
      map[p.userId] = (map[p.userId] || 0) + Number(p.amount || 0);
    });
    return map;
  }, [payersList]);

  const categoryColor = useMemo(
    () => getCategoryColor(expense?.category?.master, expense?.category?.sub),
    [expense?.category]
  );

  const amountParts = useMemo(() => {
    const fixed = Number(amount || 0).toFixed(2);
    const [whole, decimal] = fixed.split('.');
    return { whole, decimal: decimal || '00' };
  }, [amount]);

  if (loading && !expense) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.colors.primary} />
      </SafeAreaView>
    );
  }

  if (!loading && !expense && loadError) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.pinnedHeader}>
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              router.back();
            }}
            style={styles.frostedIconButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={20} color={THEME.colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorStateContainer}>
          <AlertCircle size={44} color={THEME.colors.negative} />
          <Text style={styles.errorTitle}>Unable to Load Expense</Text>
          <Text style={styles.errorMessage}>{loadError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setLoading(true);
              fetchExpense();
            }}
          >
            <RefreshCw size={15} color={THEME.colors.primaryForeground} style={{ marginRight: 8 }} />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* ── 1. PINNED FIXED NAVIGATION BAR (Never scrolls away) ── */}
      <View style={styles.pinnedHeader}>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          style={styles.frostedIconButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={20} color={THEME.colors.text} />
        </TouchableOpacity>

        <View style={styles.navGroupBadge}>
          <Text style={styles.navGroupText} numberOfLines={1}>
            {expense?.groupName || 'Expense Details'}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleReceiptAction}
            style={styles.frostedIconButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Receipt photo"
          >
            <Camera size={18} color={expense?.receiptImageUrl ? THEME.colors.success : THEME.colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDelete}
            style={styles.frostedIconButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Delete expense"
          >
            <Trash2 size={18} color={THEME.colors.critical} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleOpenEdit}
            style={styles.frostedIconButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Edit expense"
          >
            <Pencil size={18} color={THEME.colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 2. SCROLLABLE CONTENT BODY ── */}
      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Hero Section: Ambient Glow & Category Squircle Beside Title & Large Amount */}
          <View style={styles.heroSection}>
            {/* Ambient Category Radial Glow */}
            <View style={styles.heroGlowCanvas} pointerEvents="none">
              <Svg width="100%" height={160}>
                <Defs>
                  <RadialGradient id="categoryHeroGlow" cx="50%" cy="30%" r="70%">
                    <Stop offset="0%" stopColor={categoryColor} stopOpacity="0.22" />
                    <Stop offset="50%" stopColor={categoryColor} stopOpacity="0.06" />
                    <Stop offset="100%" stopColor={THEME.colors.background} stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Rect width="100%" height={160} fill="url(#categoryHeroGlow)" />
              </Svg>
            </View>

            {/* Category Squircle beside Title & Category Sub-label */}
            <View style={styles.heroIdentityRow}>
              <View
                style={[
                  styles.categorySquircle,
                  {
                    backgroundColor: `${categoryColor}18`,
                    borderColor: `${categoryColor}40`,
                  },
                ]}
              >
                <CategoryIcon
                  subCategory={expense?.category?.sub}
                  masterCategory={expense?.category?.master}
                  size={26}
                  color={categoryColor}
                />
              </View>

              <View style={styles.heroTitleCol}>
                <View style={styles.categoryBreadcrumb}>
                  <View style={[styles.categoryColorDot, { backgroundColor: categoryColor }]} />
                  <Text style={[styles.categoryLabelText, { color: categoryColor }]}>
                    {expense?.category?.sub || expense?.category?.master || 'Other'}
                  </Text>
                  <Text style={styles.metaDividerDot}>•</Text>
                  <Text style={styles.metaTimeText}>{dateFormatted}</Text>
                </View>

                <Text style={styles.heroTitleText} numberOfLines={2}>
                  {title}
                </Text>
              </View>
            </View>

            {/* High-Impact Centered Amount Display */}
            <View style={styles.heroAmountBlock}>
              <View style={styles.heroAmountRow}>
                <Text style={[styles.heroCurrencySymbol, { color: categoryColor }]}>
                  {currencySymbol}
                </Text>
                <Text style={styles.heroAmountWhole}>{amountParts.whole}</Text>
                <Text style={styles.heroAmountDecimal}>.{amountParts.decimal}</Text>
              </View>

              <Text style={styles.creatorMetaText}>Added by {creatorName}</Text>
            </View>

            {/* Editorial Quote Notes */}
            {expense?.notes ? (
              <View style={[styles.editorialNotesBlock, { borderLeftColor: categoryColor }]}>
                <Text style={styles.editorialNotesText}>{`"${expense.notes}"`}</Text>
              </View>
            ) : null}

            {/* Quick Receipt Attached Banner */}
            {expense?.receiptImageUrl ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleReceiptAction}
                style={styles.receiptAttachedBanner}
              >
                <View style={styles.receiptAttachedLeft}>
                  <View style={styles.receiptIconPill}>
                    <ImageIcon size={15} color={THEME.colors.success} />
                  </View>
                  <View>
                    <Text style={styles.receiptAttachedTitle}>Receipt Photo Attached</Text>
                    <Text style={styles.receiptAttachedSubtitle}>Tap to inspect full resolution</Text>
                  </View>
                </View>
                <ArrowRight size={15} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* ── 3. Settlement & Split (Structured Payer vs Payees) ── */}
          <View style={styles.ledgerSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>SETTLEMENT & SPLIT</Text>
              <View style={styles.splitTypeBadge}>
                <Text style={styles.splitTypeText}>
                  {expense?.splitType ? expense.splitType.replace('_', ' ') : 'equally'}
                </Text>
              </View>
            </View>

            <View style={styles.structuredLedgerContainer}>
              {/* A. PAID BY CARD */}
              <View style={styles.paidByCard}>
                <View style={styles.subHeaderRow}>
                  <Text style={styles.subHeaderLabel}>PAID BY</Text>
                  <Text style={styles.subHeaderPaidTotal}>
                    {currencySymbol}{amount.toFixed(2)}
                  </Text>
                </View>

                {payersList.map((payerItem, pIdx) => {
                  const isUserPayer = payerItem.userId === currentUserId;
                  const payerPercent = amount > 0 ? Math.round((payerItem.amount / amount) * 100) : 100;

                  return (
                    <View key={payerItem.userId || pIdx} style={styles.payerRowItem}>
                      <View style={styles.payerAvatarWrap}>
                        <View style={[styles.payerAvatarRing, { borderColor: THEME.colors.success }]}>
                          {payerItem.avatarUrl ? (
                            <Image source={{ uri: payerItem.avatarUrl }} style={styles.avatarImg} />
                          ) : (
                            <Text style={[styles.avatarInitial, { color: THEME.colors.success }]}>
                              {(payerItem.name || 'M').charAt(0).toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <View style={styles.payerCheckBadge}>
                          <Check size={8} color={THEME.colors.primaryForeground} strokeWidth={3} />
                        </View>
                      </View>

                      <View style={styles.payerTextCol}>
                        <View style={styles.nameBadgeRow}>
                          <Text style={styles.payerNameText}>{payerItem.name || 'Member'}</Text>
                          {isUserPayer && (
                            <View style={styles.youBadge}>
                              <Text style={styles.youBadgeText}>YOU</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.payerSubText}>
                          {payersList.length > 1
                            ? `Contributed ${payerPercent}% of bill`
                            : 'Paid full amount out of pocket'}
                        </Text>
                      </View>

                      {/* NO DIV / PURE GREEN TEXT */}
                      <Text style={styles.paidGreenText}>
                        PAID {currencySymbol}{Number(payerItem.amount || 0).toFixed(2)}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* B. CONTINUOUS STEM FLOW DIVIDER */}
              <View style={styles.flowStemDividerRow}>
                <View style={styles.flowStemLine} />
                <View style={styles.flowStemPill}>
                  <Text style={styles.flowStemText}>
                    SPLIT FOR {participants.length} {participants.length === 1 ? 'MEMBER' : 'MEMBERS'}
                  </Text>
                </View>
                <View style={styles.flowStemLine} />
              </View>

              {/* C. SPLIT BREAKDOWN (Who owes what) */}
              {!hasSplitLoaded || !areParticipantsValid(participants) ? (
                <View style={styles.splitSkeletonBlock}>
                  <View style={styles.splitLoadingNotice}>
                    <ActivityIndicator size="small" color={THEME.colors.primary} style={{ marginRight: 8 }} />
                    <Text style={styles.splitLoadingNoticeText}>Loading split breakdown...</Text>
                  </View>
                  <SplitBreakdownSkeleton count={3} />
                </View>
              ) : (
                <View style={styles.participantsTimelineList}>
                  {participants.map((p, index) => {
                    const isLast = index === participants.length - 1;
                    const isUser = p.isCurrentUser || p.userId === currentUserId;
                    const paidAmount = payersMap[p.userId] ?? (p.userId === expense?.paidById ? amount : 0);
                    const share = Number(p.amountOwed || 0);
                    const netBalance = paidAmount - share;

                    return (
                      <View key={p.userId || index} style={styles.timelineParticipantRow}>
                        {/* Continuous Stem Line Column */}
                        <View style={styles.stemColumn}>
                          <View style={isLast ? styles.stemLineLast : styles.stemLineFull} />
                          <View
                            style={[
                              styles.stemNodeDot,
                              netBalance > 0.01
                                ? styles.nodeDotGreen
                                : isUser
                                ? styles.nodeDotUser
                                : styles.nodeDotNeutral,
                            ]}
                          />
                        </View>

                        {/* Content Row */}
                        <View style={[styles.timelineContentRow, !isLast && styles.contentRowBorder]}>
                          <View style={[styles.participantAvatar, isUser && styles.participantAvatarUser]}>
                            {p.avatarUrl ? (
                              <Image source={{ uri: p.avatarUrl }} style={styles.avatarImg} />
                            ) : (
                              <Text style={[styles.participantAvatarInitial, isUser && { color: THEME.colors.primary }]}>
                                {(p.name || 'M').charAt(0).toUpperCase()}
                              </Text>
                            )}
                          </View>

                          <View style={styles.memberInfoCol}>
                            <View style={styles.nameBadgeRow}>
                              <Text style={[styles.memberNameText, isUser && styles.memberNameUser]}>
                                {p.name || 'Member'}
                              </Text>
                              {isUser && (
                                <View style={styles.youBadge}>
                                  <Text style={styles.youBadgeText}>YOU</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.memberSubText}>
                              Share: {currencySymbol}{share.toFixed(2)}
                            </Text>
                          </View>

                          {/* Pure colored typography (NO DIV, NO NAME REPEATED) */}
                          {netBalance > 0.01 ? (
                            <Text style={styles.getsBackGreenText}>
                              Gets back {currencySymbol}{netBalance.toFixed(2)}
                            </Text>
                          ) : netBalance < -0.01 ? (
                            <Text style={isUser ? styles.youOweRedText : styles.otherOwesWhiteText}>
                              {isUser ? 'You owe ' : 'Owes '}{currencySymbol}{Math.abs(netBalance).toFixed(2)}
                            </Text>
                          ) : (
                            <Text style={styles.settledMutedText}>Settled</Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>

          {/* Activity & History Section */}
          <View style={styles.historySection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>ACTIVITY & AUDIT LOGS</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>
                  {logs.length} {logs.length === 1 ? 'event' : 'events'}
                </Text>
              </View>
            </View>

            <View style={styles.logsList}>
              {logs.map((log, index) => {
                const isLast = index === logs.length - 1;
                const isCreated = log.type === 'expense_created';
                const isComment = log.type === 'comment';
                const isDeleted = log.type === 'expense_deleted';
                const isRestored = log.type === 'expense_restored';

                return (
                  <View key={log.id || index} style={[styles.logRow, !isLast && styles.logRowBorder]}>
                    <View style={styles.logHeaderRow}>
                      <View style={styles.logBadgeContainer}>
                        {isCreated && (
                          <View style={[styles.logTypePill, styles.pillCreated]}>
                            <Plus size={10} color={THEME.colors.success} />
                            <Text style={[styles.logTypePillText, { color: THEME.colors.success }]}>Created</Text>
                          </View>
                        )}
                        {isComment && (
                          <View style={[styles.logTypePill, styles.pillComment]}>
                            <MessageSquare size={10} color={THEME.colors.infoLight} />
                            <Text style={[styles.logTypePillText, { color: THEME.colors.infoLight }]}>Comment</Text>
                          </View>
                        )}
                        {isDeleted && (
                          <View style={[styles.logTypePill, styles.pillDeleted]}>
                            <Trash2 size={10} color={THEME.colors.critical} />
                            <Text style={[styles.logTypePillText, { color: THEME.colors.critical }]}>Deleted</Text>
                          </View>
                        )}
                        {isRestored && (
                          <View style={[styles.logTypePill, styles.pillRestored]}>
                            <RotateCcw size={10} color={THEME.colors.notification.announcement} />
                            <Text style={[styles.logTypePillText, { color: THEME.colors.notification.announcement }]}>Restored</Text>
                          </View>
                        )}
                        {!isCreated && !isComment && !isDeleted && !isRestored && (
                          <View style={[styles.logTypePill, styles.pillUpdated]}>
                            <Pencil size={10} color={THEME.colors.info} />
                            <Text style={[styles.logTypePillText, { color: THEME.colors.info }]}>Updated</Text>
                          </View>
                        )}
                      </View>

                      <Text style={styles.logTimeText}>{log.timestamp || log.timeAgo}</Text>
                    </View>

                    <Text style={styles.logActorLine}>
                      by <Text style={styles.logActorName}>{log.actorName}</Text>
                    </Text>

                    {/* Comment Body */}
                    {isComment && log.commentText ? (
                      <View style={styles.commentBubble}>
                        <Text style={styles.commentBodyText}>{log.commentText}</Text>
                      </View>
                    ) : null}

                    {/* Granular Changes */}
                    {log.changes && log.changes.length > 0 ? (
                      <View style={styles.changesList}>
                        {log.changes.map((ch, chIdx) => (
                          <View key={chIdx} style={styles.changeItemRow}>
                            <Text style={styles.changeFieldLabel}>{ch.field}:</Text>
                            {ch.type === 'changed' ? (
                              <View style={styles.changeDiffRow}>
                                <Text style={styles.changeFrom}>{ch.from}</Text>
                                <ArrowRight size={10} color={THEME.colors.textMuted} />
                                <Text style={styles.changeTo}>{ch.to}</Text>
                              </View>
                            ) : ch.type === 'added' ? (
                              <View style={styles.changeActionRow}>
                                <UserPlus size={10} color={THEME.colors.success} />
                                <Text style={styles.changeAddedText}>Added {ch.detail}</Text>
                              </View>
                            ) : ch.type === 'removed' ? (
                              <View style={styles.changeActionRow}>
                                <UserMinus size={10} color={THEME.colors.critical} />
                                <Text style={styles.changeRemovedText}>Removed {ch.detail}</Text>
                              </View>
                            ) : (
                              <Text style={styles.changeGeneric}>{ch.from}</Text>
                            )}
                          </View>
                        ))}
                      </View>
                    ) : log.description && !isComment ? (
                      <Text style={styles.logDescriptionText}>{log.description}</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Bottom Docked "Add a comment" Bar */}
        <View style={styles.bottomCommentDock}>
          <View style={styles.commentInputContainer}>
            <TextInput
              style={styles.commentTextInput}
              placeholder="Add a comment..."
              placeholderTextColor={THEME.colors.textMuted}
              value={commentInput}
              onChangeText={setCommentInput}
              onSubmitEditing={handleSendComment}
              returnKeyType="send"
            />
            <TouchableOpacity
              onPress={handleSendComment}
              disabled={isSendingComment || !commentInput.trim()}
              style={[
                styles.sendButton,
                (!commentInput.trim() || isSendingComment) && styles.sendButtonDisabled,
              ]}
            >
              {isSendingComment ? (
                <ActivityIndicator size="small" color={THEME.colors.success} />
              ) : (
                <Send size={16} color={commentInput.trim() ? THEME.colors.success : THEME.colors.textMuted} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>



      {/* Receipt Viewer Modal */}
      <Modal
        visible={isReceiptModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setIsReceiptModalOpen(false)}
      >
        <View style={styles.receiptViewerBackdrop}>
          <SafeAreaView style={styles.receiptViewerSafeArea}>
            <View style={styles.receiptViewerHeader}>
              <Text style={styles.receiptViewerTitle}>Attached Receipt</Text>
              <TouchableOpacity
                onPress={() => setIsReceiptModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <X size={22} color={THEME.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.receiptImageContainer}>
              {expense?.receiptImageUrl ? (
                <Image
                  source={{ uri: expense.receiptImageUrl }}
                  style={styles.fullReceiptImage}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.noReceiptText}>No receipt image available.</Text>
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexOne: {
    flex: 1,
  },

  // Fixed Pinned Header
  pinnedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: THEME.colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    zIndex: 10,
  },
  frostedIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navGroupBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    maxWidth: 200,
  },
  navGroupText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.text,
    letterSpacing: 0.2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  // Scroll Content
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 22,
  },

  // Hero Section
  heroSection: {
    gap: 14,
    position: 'relative',
    paddingTop: 4,
  },
  heroGlowCanvas: {
    position: 'absolute',
    top: -20,
    left: -18,
    right: -18,
    height: 180,
  },
  heroIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  categorySquircle: {
    width: 54,
    height: 54,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitleCol: {
    flex: 1,
    gap: 4,
  },
  categoryBreadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryColorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  categoryLabelText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  metaDividerDot: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  metaTimeText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  heroTitleText: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.3,
    lineHeight: 28,
  },

  // High-Impact Amount Block
  heroAmountBlock: {
    alignItems: 'center',
    paddingVertical: 10,
    gap: 4,
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  heroCurrencySymbol: {
    fontSize: 26,
    fontWeight: '800',
    marginRight: 2,
  },
  heroAmountWhole: {
    fontSize: 42,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -1.2,
  },
  heroAmountDecimal: {
    fontSize: 22,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  creatorMetaText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },

  // Editorial Notes Block
  editorialNotesBlock: {
    borderLeftWidth: 3,
    paddingLeft: 14,
    paddingVertical: 4,
    marginTop: 2,
  },
  editorialNotesText: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    lineHeight: 19,
    fontStyle: 'italic',
  },

  // Quick Receipt Attached Banner
  receiptAttachedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: THEME.radius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  receiptAttachedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  receiptIconPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptAttachedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  receiptAttachedSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },

  // Settlement & Split (Structured)
  ledgerSection: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  splitTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: THEME.radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  splitTypeText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    textTransform: 'capitalize',
  },

  structuredLedgerContainer: {
    gap: 0,
  },

  // Paid By Card
  paidByCard: {
    borderRadius: THEME.radius.md,
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.18)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  subHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(16, 185, 129, 0.15)',
    paddingBottom: 6,
  },
  subHeaderLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.success,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  subHeaderPaidTotal: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.success,
  },
  payerRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  payerAvatarWrap: {
    position: 'relative',
  },
  payerAvatarRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surfaceElevated,
    overflow: 'hidden',
  },
  payerCheckBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: THEME.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: THEME.colors.background,
  },
  payerTextCol: {
    flex: 1,
    gap: 2,
  },
  payerNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  payerSubText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  paidGreenText: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.success,
    letterSpacing: 0.2,
  },

  // Connecting Stem Divider
  flowStemDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  flowStemLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  flowStemPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: THEME.radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  flowStemText: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
  },

  // Participants Timeline
  participantsTimelineList: {
    gap: 0,
  },
  timelineParticipantRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  stemColumn: {
    width: 22,
    alignItems: 'center',
    position: 'relative',
  },
  stemLineFull: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    left: 10,
  },
  stemLineLast: {
    position: 'absolute',
    top: 0,
    height: 24,
    width: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    left: 10,
  },
  stemNodeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 18,
    zIndex: 2,
    borderWidth: 1.5,
    borderColor: THEME.colors.background,
  },
  nodeDotGreen: {
    backgroundColor: THEME.colors.success,
  },
  nodeDotUser: {
    backgroundColor: THEME.colors.primary,
  },
  nodeDotNeutral: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  timelineContentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 8,
    gap: 12,
  },
  contentRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  participantAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  participantAvatarUser: {
    borderWidth: 1.5,
    borderColor: THEME.colors.primary,
  },
  participantAvatarInitial: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  memberInfoCol: {
    flex: 1,
    gap: 2,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  memberNameUser: {
    fontWeight: '700',
    color: THEME.colors.text,
  },
  youBadge: {
    backgroundColor: 'rgba(28, 194, 159, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  youBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.primary,
    letterSpacing: 0.5,
  },
  memberSubText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },

  // Pure Colored Status Text (NO DIVS, NO REPEATING NAMES)
  getsBackGreenText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.success,
  },
  youOweRedText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.dangerLight,
  },
  otherOwesWhiteText: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.text,
  },
  settledMutedText: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textMuted,
  },

  splitSkeletonBlock: {
    paddingVertical: 10,
    paddingLeft: 6,
  },
  splitLoadingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingLeft: 4,
  },
  splitLoadingNoticeText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: '800',
  },
  errorStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.text,
    marginTop: 8,
  },
  errorMessage: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: THEME.radius.md,
    marginTop: 8,
  },
  retryButtonText: {
    color: THEME.colors.primaryForeground,
    fontWeight: '700',
    fontSize: 13,
  },

  // Activity & History Section
  historySection: {
    gap: 10,
    marginTop: 8,
  },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: THEME.radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textMuted,
  },
  logsList: {
    gap: 0,
  },
  logRow: {
    paddingVertical: 12,
    gap: 4,
  },
  logRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  logHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: THEME.radius.full,
  },
  pillCreated: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  pillUpdated: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  pillComment: {
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
  },
  pillDeleted: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  pillRestored: {
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
  },
  logTypePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  logTimeText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  logActorLine: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
  logActorName: {
    fontWeight: '700',
    color: THEME.colors.text,
  },
  logDescriptionText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    lineHeight: 17,
  },
  commentBubble: {
    backgroundColor: 'rgba(96, 165, 250, 0.08)',
    borderLeftWidth: 2.5,
    borderLeftColor: THEME.colors.infoLight,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  commentBodyText: {
    fontSize: 13,
    color: THEME.colors.text,
    lineHeight: 18,
  },
  changesList: {
    gap: 4,
    marginTop: 4,
    paddingTop: 4,
  },
  changeItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  changeFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  changeDiffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  changeFrom: {
    fontSize: 11,
    color: THEME.colors.critical,
    textDecorationLine: 'line-through',
  },
  changeTo: {
    fontSize: 11,
    color: THEME.colors.success,
    fontWeight: '700',
  },
  changeActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  changeAddedText: {
    fontSize: 11,
    color: THEME.colors.success,
    fontWeight: '600',
  },
  changeRemovedText: {
    fontSize: 11,
    color: THEME.colors.critical,
    fontWeight: '600',
  },
  changeGeneric: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },

  // Bottom Floating "Add a comment" Bar
  bottomCommentDock: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: THEME.colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.full,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  commentTextInput: {
    flex: 1,
    height: 40,
    fontSize: 14,
    color: THEME.colors.text,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },


  // Edit Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 16,
  },
  modalInputGroup: {
    gap: 6,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 1.1,
  },
  modalRowGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalSelectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalSelectTriggerText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.success,
    flex: 1,
    marginRight: 4,
  },
  modalInput: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: THEME.colors.text,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalInputMulti: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  categoryPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  catPillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: THEME.colors.success,
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  catPillTextActive: {
    color: THEME.colors.success,
    fontWeight: '700',
  },
  catMasterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  catMasterPillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: THEME.colors.success,
  },
  catMasterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  catMasterPillTextActive: {
    color: THEME.colors.success,
    fontWeight: '700',
  },
  modalSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.success,
    paddingVertical: 14,
    borderRadius: THEME.radius.md,
    marginTop: 10,
  },
  modalSaveButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.primaryForeground,
  },

  // Receipt Viewer Modal
  receiptViewerBackdrop: {
    flex: 1,
    backgroundColor: THEME.colors.palette.black,
  },
  receiptViewerSafeArea: {
    flex: 1,
  },
  receiptViewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  receiptViewerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  receiptImageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  fullReceiptImage: {
    width: '100%',
    height: '100%',
  },
  noReceiptText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
  },
});
