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
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { QuantumSpinner } from '../../src/components/brand/QuantumLogo';
import { KeyboardStickyBottomBar } from '../../src/components/common/KeyboardStickyBottomBar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  Camera,
  Trash2,
  Pencil,
  Send,
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
import { haptics } from '../../src/services/haptics.service';
import { useNetwork } from '../../src/contexts/network.context';
import { useAuth } from '../../src/contexts/auth.context';
import { useCurrency } from '../../src/contexts/currency.context';
import { useAppTheme } from '../../src/contexts/theme.context';
import { SplitBreakdownSkeleton } from '../../src/components/skeletons/SplitBreakdownSkeleton';

export default function ExpenseDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { requireOnline } = useNetwork();
  const { user } = useAuth();
  const { currentAccent } = useAppTheme();
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
  const [cachedUserId, setCachedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      authService.getCachedUser().then((u) => {
        if (u?.id) setCachedUserId(u.id);
      });
    }
  }, [user?.id]);

  const currentUserId = user?.id || cachedUserId || 'u1';

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
    haptics.warning();
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
            const success = await expenseService.deleteExpense(expenseId, targetGroupId, amt);
            if (success) {
              haptics.saveSuccess();
              router.back();
            } else {
              haptics.error();
              Alert.alert('Error', 'Failed to delete expense. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleOpenEdit = () => {
    if (!requireOnline('edit this expense')) return;
    haptics.tap();
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
    haptics.tap();

    const newLog = await expenseService.addExpenseComment(expenseId, text);
    setExpense((prev) => (prev ? { ...prev, logs: [...prev.logs, newLog] } : prev));
    setCommentInput('');
    setIsSendingComment(false);

    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 200);
  };

  const persistReceipt = async (url?: string) => {
    if (!expense) return;
    try {
      const targetGId = expense.groupId || groupId;
      const res = await expenseService.updateExpense(expenseId, {
        groupId: targetGId,
        amount: expense.amount,
        oldAmount: expense.amount,
        description: expense.title,
        category: expense.category.sub,
        masterCategory: expense.category.master,
        notes: expense.notes,
        receiptImageUrl: url,
        splitType: expense.splitType,
        date: expense.rawDate || expense.date,
        payers: (expense.payers || []).map((p) => ({ userId: p.userId, amount: p.amount })),
        participants: (expense.participants || []).map((p) => ({ userId: p.userId, amountOwed: p.amountOwed })),
      });
      if (res.success) {
        setExpense((prev) => (prev ? { ...prev, receiptImageUrl: url } : prev));
        haptics.saveSuccess();
        Alert.alert(
          'Receipt Updated',
          url ? 'Receipt image has been saved to this expense.' : 'Receipt has been removed.'
        );
      } else {
        haptics.error();
        Alert.alert('Update Failed', res.error || 'Failed to update receipt on server.');
      }
    } catch {
      haptics.error();
      Alert.alert('Error', 'Could not save receipt image.');
    }
  };

  const promptPickReceipt = () => {
    Alert.alert('Attach Receipt', 'Choose receipt photo source', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Take Photo',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert('Permission Required', 'Camera permission is required to capture receipt photos.');
            return;
          }
          const res = await ImagePicker.launchCameraAsync({
            quality: 0.82,
          });
          if (!res.canceled && res.assets?.[0]?.uri) {
            const localUri = res.assets[0].uri;
            setExpense((prev) => (prev ? { ...prev, receiptImageUrl: localUri } : prev));
            const uploadedUrl = await expenseService.uploadReceiptImage(localUri);
            await persistReceipt(uploadedUrl || localUri);
          }
        },
      },
      {
        text: 'Choose from Gallery',
        onPress: async () => {
          const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.82,
          });
          if (!res.canceled && res.assets?.[0]?.uri) {
            const localUri = res.assets[0].uri;
            setExpense((prev) => (prev ? { ...prev, receiptImageUrl: localUri } : prev));
            const uploadedUrl = await expenseService.uploadReceiptImage(localUri);
            await persistReceipt(uploadedUrl || localUri);
          }
        },
      },
    ]);
  };

  const handleReceiptAction = async () => {
    haptics.tap();
    if (expense?.receiptImageUrl) {
      Alert.alert(
        'Attached Receipt',
        'Would you like to view, replace, or remove the receipt?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'View Fullscreen', onPress: () => setIsReceiptModalOpen(true) },
          { text: 'Replace Photo', onPress: promptPickReceipt },
          {
            text: 'Remove Receipt',
            style: 'destructive',
            onPress: () => persistReceipt(undefined),
          },
        ]
      );
    } else {
      promptPickReceipt();
    }
  };



  const title = expense?.title || params.title || 'Expense';
  const amount = expense?.amount || parseFloat(params.amount || '0') || 0;
  const { currencySymbol } = useCurrency();

  const viewerName = useMemo(() => {
    if (user?.name && user.name !== 'You' && user.name !== 'undefined') {
      return user.name;
    }
    const groupMember = groupMembers.find((m) => m.id === currentUserId);
    if (groupMember?.name && groupMember.name !== 'You' && groupMember.name !== 'undefined') {
      return groupMember.name;
    }
    return 'You';
  }, [user?.name, groupMembers, currentUserId]);

  const primaryPayerName =
    expense?.paidByName && expense.paidByName !== 'undefined' && expense.paidByName !== 'You'
      ? expense.paidByName
      : expense?.paidById === currentUserId && viewerName !== 'You'
      ? viewerName
      : expense?.paidByName && expense.paidByName !== 'undefined'
      ? expense.paidByName
      : params.paidByName && params.paidByName !== 'undefined' && params.paidByName !== 'You'
      ? params.paidByName
      : 'Member';

  const creatorName =
    expense?.creator?.name && expense.creator.name !== 'undefined' && expense.creator.name !== 'You'
      ? expense.creator.name
      : expense?.creator?.id === currentUserId && viewerName !== 'You'
      ? viewerName
      : primaryPayerName;

  const dateFormatted = expense?.date || params.date || 'Today';
  const participants = useMemo(() => expense?.participants || [], [expense?.participants]);
  const logs = useMemo(() => deduplicateExpenseLogs(expense?.logs || []), [expense?.logs]);

  const payersList = useMemo(() => {
    if (expense?.payers && expense.payers.length > 0) {
      return expense.payers.map((p) => {
        const isCurrent = p.userId === currentUserId;
        const member = groupMembers.find((m) => m.id === p.userId);
        const participant = participants.find((part) => part.userId === p.userId);
        let resolvedName =
          p.name && p.name !== 'undefined'
            ? p.name
            : member?.name && member.name !== 'undefined'
            ? member.name
            : participant?.name && participant.name !== 'undefined'
            ? participant.name
            : p.userId === expense?.paidById && primaryPayerName && primaryPayerName !== 'undefined'
            ? primaryPayerName
            : 'Member';
        if (isCurrent && (resolvedName === 'You' || resolvedName === 'Member') && viewerName !== 'You') {
          resolvedName = viewerName;
        }
        const resolvedAvatar =
          p.avatarUrl ||
          member?.avatarUrl ||
          participant?.avatarUrl ||
          (p.userId === expense?.paidById ? expense?.paidByAvatar : undefined) ||
          (isCurrent ? user?.avatarUrl : undefined);
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
        avatarUrl: expense?.paidByAvatar || (expense?.paidById === currentUserId ? user?.avatarUrl : undefined),
        amount: amount,
      },
    ];
  }, [expense, primaryPayerName, amount, groupMembers, participants, currentUserId, viewerName, user?.avatarUrl]);

  const payersMap = useMemo(() => {
    const map: Record<string, number> = {};
    payersList.forEach((p) => {
      map[p.userId] = (map[p.userId] || 0) + Number(p.amount || 0);
    });
    return map;
  }, [payersList]);

  const splitMembers = useMemo(() => {
    const memberMap = new Map<
      string,
      {
        userId: string;
        name: string;
        avatarUrl?: string;
        isCurrentUser: boolean;
        paidAmount: number;
        owedAmount: number;
      }
    >();

    participants.forEach((p) => {
      const isCurrent = p.isCurrentUser || p.userId === currentUserId;
      const groupMember = groupMembers.find((m) => m.id === p.userId);
      const paid = payersMap[p.userId] ?? (p.userId === expense?.paidById ? amount : 0);

      let resolvedName = p.name && p.name !== 'undefined' ? p.name : 'Member';
      if (isCurrent) {
        if (resolvedName === 'You' || resolvedName === 'Member') {
          if (viewerName && viewerName !== 'You') {
            resolvedName = viewerName;
          }
        }
      } else if (resolvedName === 'Member' && groupMember?.name) {
        resolvedName = groupMember.name;
      }

      const resolvedAvatar = p.avatarUrl || groupMember?.avatarUrl || (isCurrent ? user?.avatarUrl : undefined);

      memberMap.set(p.userId, {
        userId: p.userId,
        name: resolvedName,
        avatarUrl: resolvedAvatar,
        isCurrentUser: isCurrent,
        paidAmount: paid,
        owedAmount: Number(p.amountOwed || 0),
      });
    });

    payersList.forEach((payer) => {
      const isCurrent = payer.userId === currentUserId;
      const groupMember = groupMembers.find((m) => m.id === payer.userId);

      let resolvedName = payer.name && payer.name !== 'undefined' ? payer.name : 'Member';
      if (isCurrent) {
        if (resolvedName === 'You' || resolvedName === 'Member') {
          if (viewerName && viewerName !== 'You') {
            resolvedName = viewerName;
          }
        }
      } else if (resolvedName === 'Member' && groupMember?.name) {
        resolvedName = groupMember.name;
      }

      const resolvedAvatar = payer.avatarUrl || groupMember?.avatarUrl || (isCurrent ? user?.avatarUrl : undefined);

      if (!memberMap.has(payer.userId)) {
        memberMap.set(payer.userId, {
          userId: payer.userId,
          name: resolvedName,
          avatarUrl: resolvedAvatar,
          isCurrentUser: isCurrent,
          paidAmount: Number(payer.amount || 0),
          owedAmount: 0,
        });
      } else {
        const existing = memberMap.get(payer.userId)!;
        existing.paidAmount = Number(payer.amount || existing.paidAmount || 0);
        if (existing.name === 'You' && resolvedName !== 'You') {
          existing.name = resolvedName;
        }
        if (!existing.avatarUrl && resolvedAvatar) {
          existing.avatarUrl = resolvedAvatar;
        }
      }
    });

    const list = Array.from(memberMap.values());
    return list.sort((a, b) => {
      if (a.paidAmount > 0 && b.paidAmount === 0) return -1;
      if (b.paidAmount > 0 && a.paidAmount === 0) return 1;
      return 0;
    });
  }, [participants, payersList, payersMap, expense?.paidById, amount, currentUserId, viewerName, groupMembers, user?.avatarUrl]);

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
        <QuantumSpinner size={40} color={currentAccent.primary} />
      </SafeAreaView>
    );
  }

  if (!loading && !expense && loadError) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.pinnedHeader}>
          <TouchableOpacity
            onPress={() => {
              haptics.tap();
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
            style={[styles.retryButton, { backgroundColor: currentAccent.primary }]}
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
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── 1. PINNED FIXED NAVIGATION BAR (Never scrolls away) ── */}
      <View style={styles.pinnedHeader}>
        <TouchableOpacity
          onPress={() => {
            haptics.tap();
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
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}
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

          {/* ── 3. Combined Financial Split (Minimal No-Div Design) ── */}
          <View style={styles.ledgerSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>FINANCIAL SPLIT</Text>
              <View style={styles.splitTypeBadge}>
                <Text style={styles.splitTypeText}>
                  {expense?.splitType ? expense.splitType.replace('_', ' ') : 'equally'}
                </Text>
              </View>
            </View>

            {!hasSplitLoaded || !areParticipantsValid(participants) ? (
              <View style={styles.splitSkeletonBlock}>
                <View style={styles.splitLoadingNotice}>
                  <QuantumSpinner size={16} color={currentAccent.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.splitLoadingNoticeText}>Loading split breakdown...</Text>
                </View>
                <SplitBreakdownSkeleton count={3} />
              </View>
            ) : (
              <View style={styles.splitMembersList}>
                {splitMembers.map((member, index) => {
                  const isLast = index === splitMembers.length - 1;
                  const isViewer = member.isCurrentUser || member.userId === currentUserId;
                  const displayName = isViewer && member.name === 'You' && viewerName !== 'You' ? viewerName : member.name;

                  return (
                    <View
                      key={member.userId || index}
                      style={[styles.splitMemberRow, !isLast && styles.splitMemberRowBorder]}
                    >
                      <View style={styles.memberLeftCol}>
                        <View style={styles.splitAvatar}>
                          {member.avatarUrl ? (
                            <Image source={{ uri: member.avatarUrl }} style={styles.avatarImg} />
                          ) : (
                            <Text style={styles.splitAvatarInitial}>
                              {(displayName || 'M').charAt(0).toUpperCase()}
                            </Text>
                          )}
                        </View>

                        <View style={styles.memberNameWrap}>
                          <View style={styles.nameBadgeRow}>
                            <Text
                              style={[
                                styles.splitMemberName,
                                isViewer && styles.splitMemberNameUser,
                              ]}
                            >
                              {displayName}
                            </Text>
                            {isViewer && (
                              <View style={styles.youBadge}>
                                <Text style={[styles.youBadgeText, { color: currentAccent.primary }]}>YOU</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>

                      <View style={styles.memberRightCol}>
                        {member.paidAmount > 0 && (
                          <Text style={styles.splitPaidText}>
                            paid {currencySymbol}{member.paidAmount.toFixed(2)}
                          </Text>
                        )}
                        <Text style={styles.splitOwesText}>
                          owes {currencySymbol}{member.owedAmount.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
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
        <KeyboardStickyBottomBar
          insideKeyboardAvoidingView
          bordered
          idlePaddingBottom={10}
          keyboardPaddingBottom={8}
          style={styles.bottomCommentDock}
        >
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
                <QuantumSpinner size={16} color={THEME.colors.success} />
              ) : (
                <Send size={16} color={commentInput.trim() ? THEME.colors.success : THEME.colors.textMuted} />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardStickyBottomBar>
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

  // Financial Split Section (Minimal No-Div Design)
  ledgerSection: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
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

  splitMembersList: {
    gap: 0,
  },
  splitMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  splitMemberRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  memberLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  splitAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  splitAvatarInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  memberNameWrap: {
    gap: 2,
    flex: 1,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  splitMemberName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  splitMemberNameUser: {
    fontWeight: '700',
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
  memberRightCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  splitPaidText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.success,
    letterSpacing: 0.1,
  },
  splitOwesText: {
    fontSize: 14,
    fontWeight: '600',
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
