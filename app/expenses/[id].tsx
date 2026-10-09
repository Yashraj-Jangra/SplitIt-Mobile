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
  Utensils,
  Car,
  ShoppingBag,
  Coffee,
  Sparkles,
  Home,
  Plane,
  Heart,
  Send,
  Check,
  X,
  User,
  Users,
  ChevronDown,
  Calendar,
  Clock,
  ArrowRight,
  UserPlus,
  UserMinus,
  MessageSquare,
  FileText,
  ImageIcon,
  AlertCircle,
  RefreshCw,
  RotateCcw,
  Plus,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { THEME } from '../../src/constants/theme';
import { expenseService, ExpenseDetailModel, ExpenseHistoryLog, deduplicateExpenseLogs } from '../../src/services/expense.service';
import { groupService } from '../../src/services/group.service';
import { authService } from '../../src/services/auth.service';
import { settingsService } from '../../src/services/settings.service';
import { CategoryIcon, getCategoryColor } from '../../src/utils/category-icons';
import { ExpenseAbstractHeader } from '../../src/components/expenses/ExpenseAbstractHeader';
import {
  MasterCategory,
  areParticipantsValid,
  formatParticipantOwedText,
  formatPayerText,
} from '@splitit/core';
import * as Haptics from 'expo-haptics';
import { useNetwork } from '../../src/contexts/network.context';
import { SplitBreakdownSkeleton } from '../../src/components/skeletons/SplitBreakdownSkeleton';

export default function ExpenseDetailScreen() {
  const router = useRouter();
  const { isOnline, requireOnline } = useNetwork();
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

  // Categories State
  const [categories, setCategories] = useState<Record<string, MasterCategory>>(() =>
    settingsService.getCachedExpenseCategories()
  );

  // Group Members & Auth User
  const [groupMembers, setGroupMembers] = useState<Array<{ id: string; name: string; avatarUrl?: string }>>([]);
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
    let mounted = true;
    settingsService.getExpenseCategories().then((cats) => {
      if (mounted) setCategories(cats);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    // 0ms Fast Tick: Hydrate offline split record immediately
    expenseService.getCachedExpenseDetails(expenseId).then((cached) => {
      if (cached) {
        setExpense(cached);
        if (areParticipantsValid(cached.participants)) {
          setHasSplitLoaded(true);
        }
        setLoading(false);
      }
    });
    fetchExpense();
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
        <View style={styles.headerNav}>
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

  const primaryPayer = expense?.payers?.[0] || {
    userId: expense?.paidById || 'payer',
    name: primaryPayerName,
    avatarUrl: expense?.paidByAvatar,
    amount: amount,
  };

  const categoryColor = useMemo(
    () => getCategoryColor(expense?.category?.master, expense?.category?.sub),
    [expense?.category]
  );

  const amountParts = useMemo(() => {
    const fixed = Number(amount || 0).toFixed(2);
    const [whole, decimal] = fixed.split('.');
    return { whole, decimal: decimal || '00' };
  }, [amount]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
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
          {/* ── 1. Top Generative Vector Abstract Header (Scrolls Naturally With Page) ── */}
          <ExpenseAbstractHeader categoryColor={categoryColor} height={140}>
            <View style={styles.headerNav}>
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
                  {expense?.groupName || 'Expense'}
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
          </ExpenseAbstractHeader>

          {/* ── 2. Screen Body Content ── */}
          <View style={styles.scrollBody}>
            {/* Hero Section: Category Squircle beside Title & High-Impact Amount */}
            <View style={styles.heroSection}>
              <View style={styles.heroSideRow}>
                {/* Category Squircle Icon Badge */}
                <View style={[styles.categorySquircle, { backgroundColor: `${categoryColor}15`, borderColor: `${categoryColor}35` }]}>
                  <CategoryIcon
                    subCategory={expense?.category?.sub}
                    masterCategory={expense?.category?.master}
                    size={26}
                    color={categoryColor}
                  />
                </View>

                {/* Title, Amount & Metadata Column */}
                <View style={styles.heroContentCol}>
                  <View style={styles.categoryMetaRow}>
                    <View style={[styles.categoryColorDot, { backgroundColor: categoryColor }]} />
                    <Text style={[styles.categoryLabelText, { color: categoryColor }]}>
                      {expense?.category?.sub || expense?.category?.master || 'Other'}
                    </Text>
                    <Text style={styles.metaDividerDot}>•</Text>
                    <Text style={styles.metaTimeText}>{dateFormatted}</Text>
                  </View>

                  <Text style={styles.heroTitle} numberOfLines={2}>
                    {title}
                  </Text>

                  {/* High-Impact Amount */}
                  <View style={styles.heroAmountRow}>
                    <Text style={[styles.heroCurrencySymbol, { color: categoryColor }]}>
                      {currencySymbol}
                    </Text>
                    <Text style={styles.heroAmountWhole}>{amountParts.whole}</Text>
                    <Text style={styles.heroAmountDecimal}>.{amountParts.decimal}</Text>
                  </View>

                  <Text style={styles.creatorMetaText}>Added by {creatorName}</Text>
                </View>
              </View>

              {/* Editorial Quote Notes (No Div Design) */}
              {expense?.notes ? (
                <View style={[styles.editorialNotesBlock, { borderLeftColor: categoryColor }]}>
                  <Text style={styles.editorialNotesText}>"{expense.notes}"</Text>
                </View>
              ) : null}
            </View>

            {/* Quick Receipt Attached Banner (if attached) */}
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

            {/* ── 3. Settlement & Split Flow (Connecting Stem Lines & Pure Colored Text) ── */}
            <View style={styles.ledgerSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>SETTLEMENT & SPLIT</Text>
                <View style={styles.splitTypeBadge}>
                  <Text style={styles.splitTypeText}>
                    {expense?.splitType ? expense.splitType.replace('_', ' ') : 'equally'}
                  </Text>
                </View>
              </View>

              {/* Continuous Timeline Ledger Container */}
              <View style={styles.timelineLedgerContainer}>
                {/* Payer Primary Ledger Row */}
                <View style={styles.timelineRow}>
                  {/* Stem Line Column */}
                  <View style={styles.stemColumn}>
                    <View style={styles.stemLineDown} />
                    <View style={styles.payerNodeDot}>
                      <Check size={8} color={THEME.colors.primaryForeground} strokeWidth={3} />
                    </View>
                  </View>

                  {/* Payer Info & Unboxed Green Status Text */}
                  <View style={[styles.timelineContentRow, styles.contentRowBorder]}>
                    <View style={[styles.avatarRing, { borderColor: `${categoryColor}55` }]}>
                      {expense?.paidByAvatar ? (
                        <Image source={{ uri: expense.paidByAvatar }} style={styles.avatarImg} />
                      ) : (
                        <Text style={[styles.avatarInitial, { color: categoryColor }]}>
                          {primaryPayerName.charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={styles.memberInfoCol}>
                      <Text style={styles.memberNameText}>{primaryPayerName}</Text>
                      <Text style={styles.memberSubText}>
                        {expense?.payers && expense.payers.length > 1
                          ? `Paid by ${expense.payers.length} people`
                          : 'Paid full amount'}
                      </Text>
                    </View>
                    {/* NO DIV / PURE GREEN TEXT */}
                    <Text style={styles.paidColoredText}>
                      PAID {currencySymbol}{amount.toFixed(2)}
                    </Text>
                  </View>
                </View>

                {/* Multi-Payers Sub-List (if multiple payers) */}
                {expense?.payers && expense.payers.length > 1 ? (
                  <View style={styles.multiPayersSubList}>
                    {expense.payers.map((p, idx) => (
                      <View key={p.userId || idx} style={styles.multiPayerRow}>
                        <Text style={styles.multiPayerName}>{p.name}</Text>
                        <Text style={styles.multiPayerAmount}>
                          {currencySymbol}{Number(p.amount || 0).toFixed(2)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Participants Flow connected by Continuous Stem */}
                {!hasSplitLoaded || !areParticipantsValid(participants) ? (
                  <View style={styles.splitSkeletonBlock}>
                    <View style={styles.splitLoadingNotice}>
                      <ActivityIndicator size="small" color={THEME.colors.primary} style={{ marginRight: 8 }} />
                      <Text style={styles.splitLoadingNoticeText}>Loading split breakdown...</Text>
                    </View>
                    <SplitBreakdownSkeleton count={3} />
                  </View>
                ) : (
                  participants.map((p, index) => {
                    const isLast = index === participants.length - 1;
                    const isUser = p.isCurrentUser || p.userId === currentUserId;
                    const owedText = formatParticipantOwedText(p, currencySymbol, groupMembers, currentUserId);
                    const isPayer = p.userId === (expense?.paidById || primaryPayer.userId);
                    const userOwes = isUser && Number(p.amountOwed || 0) > 0 && !isPayer;
                    const userGetsBack = isUser && isPayer;

                    return (
                      <View key={p.userId || index} style={styles.timelineRow}>
                        {/* Stem Line Column */}
                        <View style={styles.stemColumn}>
                          <View style={isLast ? styles.stemLineLast : styles.stemLineFull} />
                          <View
                            style={[
                              styles.participantNodeDot,
                              isUser ? styles.nodeDotUser : styles.nodeDotNeutral,
                            ]}
                          />
                        </View>

                        {/* Participant Content & Unboxed Colored Status Text */}
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
                                {p.name}
                              </Text>
                              {isUser && (
                                <View style={styles.youBadge}>
                                  <Text style={styles.youBadgeText}>YOU</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.memberSubText}>
                              Share: {currencySymbol}{Number(p.amountOwed || 0).toFixed(2)}
                            </Text>
                          </View>

                          {/* NO DIV / PURE COLORED TEXT: Red, Green, or White */}
                          {userOwes ? (
                            <Text style={styles.owesColoredText}>
                              You owe {currencySymbol}{Number(p.amountOwed || 0).toFixed(2)}
                            </Text>
                          ) : userGetsBack ? (
                            <Text style={styles.getsBackColoredText}>
                              {owedText}
                            </Text>
                          ) : (
                            <Text style={styles.memberStatusColoredText}>
                              {owedText}
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })
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

  // Abstract Vector Header & Nav Bar
  headerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    height: 52,
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
    paddingVertical: 5,
    borderRadius: THEME.radius.full,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
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

  // Scroll Content & Body
  scrollContent: {
    paddingBottom: 40,
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 22,
  },

  // Hero Section - Clean High-Impact Typography & Category Squircle
  heroSection: {
    gap: 12,
  },
  heroSideRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  categorySquircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  heroContentCol: {
    flex: 1,
    gap: 3,
  },
  categoryMetaRow: {
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
    fontWeight: '700',
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
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  heroCurrencySymbol: {
    fontSize: 22,
    fontWeight: '800',
    marginRight: 2,
  },
  heroAmountWhole: {
    fontSize: 34,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.8,
  },
  heroAmountDecimal: {
    fontSize: 20,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  creatorMetaText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    fontWeight: '500',
    marginTop: 2,
  },
  editorialNotesBlock: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    paddingVertical: 4,
    marginTop: 6,
    marginLeft: 2,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
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

  // Open Editorial Ledger (Zero Div / Box Design)
  ledgerSection: {
    gap: 14,
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

  // Continuous Connecting Stem Line Ledger
  timelineLedgerContainer: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  stemColumn: {
    width: 24,
    alignItems: 'center',
    position: 'relative',
  },
  stemLineDown: {
    position: 'absolute',
    top: 28,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    left: 11,
  },
  stemLineFull: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    left: 11,
  },
  stemLineLast: {
    position: 'absolute',
    top: 0,
    height: 28,
    width: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    left: 11,
  },
  payerNodeDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: THEME.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    zIndex: 2,
    borderWidth: 2,
    borderColor: THEME.colors.background,
  },
  participantNodeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 22,
    zIndex: 2,
    borderWidth: 2,
    borderColor: THEME.colors.background,
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
    paddingVertical: 12,
    paddingLeft: 8,
    gap: 12,
  },
  contentRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  avatarRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surfaceElevated,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: '800',
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

  // Pure Colored Typography (NO DIV DESIGN)
  paidColoredText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.success,
    letterSpacing: 0.2,
  },
  owesColoredText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.dangerLight,
  },
  getsBackColoredText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.success,
  },
  memberStatusColoredText: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.text,
  },

  multiPayersSubList: {
    paddingLeft: 44,
    gap: 6,
    paddingBottom: 6,
  },
  multiPayerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  multiPayerName: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  multiPayerAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
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
    borderWidth: 1,
    borderColor: THEME.colors.primary,
  },
  participantAvatarInitial: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
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
