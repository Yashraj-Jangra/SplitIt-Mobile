import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  Easing,
  Dimensions,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  X,
  Check,
  Camera,
  Sparkles,
  Calendar,
  FileText,
  ChevronDown,
  Search,
  Star,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import {
  calculateSplitAmounts,
  validateSplit,
  MasterCategory,
  SplitType,
} from '@splitit/core';
import { groupService, GroupListItem } from '../../src/services/group.service';
import { expenseService } from '../../src/services/expense.service';
import { authService } from '../../src/services/auth.service';
import { settingsService } from '../../src/services/settings.service';
import { CategoryIcon } from '../../src/utils/category-icons';
import { PayerSelectModal, MultiPayerEntry } from '../../src/components/expenses/PayerSelectModal';
import { SplitOptionsModal, SplitParticipantItem } from '../../src/components/expenses/SplitOptionsModal';
import { useNetwork } from '../../src/contexts/network.context';
import * as Haptics from 'expo-haptics';

interface FormSnapshot {
  amount: string;
  description: string;
  category: string;
  masterCategory: string;
  notes: string;
  date: string;
  groupId: string;
  payerType: 'single' | 'multiple';
  singlePayerId: string;
  multiPayers: MultiPayerEntry[];
  splitMode: SplitType;
  participants: SplitParticipantItem[];
}

export default function NewExpenseModal() {
  const router = useRouter();
  const { requireOnline } = useNetwork();
  const params = useLocalSearchParams<{
    amount?: string;
    description?: string;
    category?: string;
    groupId?: string;
    expenseId?: string;
    origin?: string;
    fabX?: string;
    fabY?: string;
  }>();

  const isEditMode = Boolean(params.expenseId);
  const isFromFab = params.origin === 'fab' || (Boolean(params.groupId) && !params.expenseId);

  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
  const screenCenterX = SCREEN_WIDTH / 2;
  const screenCenterY = SCREEN_HEIGHT / 2;
  const fabCenterX = params.fabX ? parseFloat(params.fabX) : (SCREEN_WIDTH - 46);
  const fabCenterY = params.fabY ? parseFloat(params.fabY) : (SCREEN_HEIGHT - 64);
  const deltaX = fabCenterX - screenCenterX;
  const deltaY = fabCenterY - screenCenterY;

  const startScaleX = 52 / SCREEN_WIDTH;
  const startScaleY = 52 / SCREEN_HEIGHT;

  const expandAnim = useRef(new Animated.Value(0)).current;
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    Animated.spring(expandAnim, {
      toValue: 1,
      damping: 24,
      stiffness: 240,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    Haptics.selectionAsync();
    Animated.timing(expandAnim, {
      toValue: 0,
      duration: 220,
      easing: Easing.bezier(0.32, 0, 0.67, 0),
      useNativeDriver: true,
    }).start(() => {
      router.back();
    });
  }, [isClosing]);

  useEffect(() => {
    const onBackPress = () => {
      handleClose();
      return true;
    };
    const backSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backSub.remove();
  }, [handleClose]);

  // Backdrop opacity
  const backdropOpacity = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.65],
  });

  // Container scale and translation
  const containerScaleX = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [isFromFab ? startScaleX : 0.94, 1],
  });

  const containerScaleY = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [isFromFab ? startScaleY : 0.94, 1],
  });

  const containerTranslateX = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [isFromFab ? deltaX : 0, 0],
  });

  const containerTranslateY = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [isFromFab ? deltaY : (SCREEN_HEIGHT * 0.12), 0],
  });

  const containerOpacity = expandAnim.interpolate({
    inputRange: [0, 0.05, 1],
    outputRange: [0, 1, 1],
  });

  // Content fade and gentle slide
  const contentOpacity = expandAnim.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0.2, 1],
  });

  const contentTranslateY = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 0],
  });

  // Emerald flash overlay that fades out as card expands
  const emeraldAuraOpacity = expandAnim.interpolate({
    inputRange: [0, 0.25, 0.7, 1],
    outputRange: [0.85, 0.4, 0, 0],
  });
  const expenseId = params.expenseId;
  const oldAmountRef = React.useRef<number>(0);
  const [initialSnapshot, setInitialSnapshot] = useState<FormSnapshot | null>(null);
  const [isLoadingExisting, setIsLoadingExisting] = useState<boolean>(isEditMode);

  const [categories, setCategories] = useState<Record<string, MasterCategory>>(() =>
    settingsService.getCachedExpenseCategories()
  );

  // Form State
  const initialCategory = useMemo(() => {
    if (!params.category) return 'Other';
    if (params.category.toLowerCase() === 'others') return 'Other';
    return params.category;
  }, [params.category]);

  const [amount, setAmount] = useState(params.amount || '');
  const [description, setDescription] = useState(params.description || '');
  const [category, setCategory] = useState(initialCategory);
  const [masterCategory, setMasterCategory] = useState(() =>
    settingsService.getMasterCategory(initialCategory) || 'Uncategorized'
  );

  const [expenseDate, setExpenseDate] = useState<Date>(new Date());
  const [showDateModal, setShowDateModal] = useState(false);

  const [notes, setNotes] = useState('');
  const [showNotesInput, setShowNotesInput] = useState(false);

  const [userOverriddenCategory, setUserOverriddenCategory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Group State & Default Group
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(params.groupId || '');
  const [defaultGroupId, setDefaultGroupIdState] = useState<string | null>(null);
  const [isDefaultGroupChecked, setIsDefaultGroupChecked] = useState(false);

  // Current User State
  const [currentUserId, setCurrentUserId] = useState<string>('u1');

  // Payer & Split Mode State
  const [payerType, setPayerType] = useState<'single' | 'multiple'>('single');
  const [singlePayerId, setSinglePayerId] = useState<string>('u1');
  const [multiPayers, setMultiPayers] = useState<MultiPayerEntry[]>([]);
  const [splitMode, setSplitMode] = useState<SplitType>('equally');

  // Modals State
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showPayerModal, setShowPayerModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');

  // Participants State
  const [participants, setParticipants] = useState<SplitParticipantItem[]>([]);

  const loadGroupMembers = async (groupId: string) => {
    try {
      const groupDetails = await groupService.getGroupDetails(groupId);
      if (groupDetails?.members?.length > 0) {
        setParticipants(
          groupDetails.members.map((m) => ({
            id: m.id,
            name: m.name,
            avatarUrl:
              m.avatarUrl ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120&auto=format&fit=crop',
            selected: true,
            shares: 1,
            percentage: 0,
            exactAmount: 0,
          }))
        );
      }
    } catch {
      // Keep default state
    }
  };

  // Load user groups and participants dynamically + edit mode hydration
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        const user = await authService.getCachedUser();
        const curId = user?.id || 'u1';
        if (isMounted) {
          setCurrentUserId(curId);
          setSinglePayerId(curId);
        }

        const allGroups = await groupService.getUserGroups();
        if (isMounted) setGroups(allGroups);

        if (isEditMode && expenseId) {
          setIsLoadingExisting(true);
          // Try fast cache hydration first
          const cached = await expenseService.getCachedExpenseDetails(expenseId);
          let exp = cached;
          if (!exp) {
            exp = await expenseService.getExpenseDetails(expenseId, params.groupId);
          }

          if (exp && isMounted) {
            const targetGroupId = exp.groupId || params.groupId || '';
            setSelectedGroupId(targetGroupId);
            oldAmountRef.current = exp.amount;
            setAmount(String(exp.amount));
            setDescription(exp.title);
            setNotes(exp.notes || '');
            if (exp.notes) setShowNotesInput(true);

            if (exp.rawDate || exp.date) {
              const parsedDate = new Date(exp.rawDate || exp.date);
              if (!isNaN(parsedDate.getTime())) setExpenseDate(parsedDate);
            }

            const rawSub = exp.category?.sub || 'Other';
            const subCat = rawSub.toLowerCase() === 'others' ? 'Other' : rawSub;
            const masterCat =
              exp.category?.master || settingsService.getMasterCategory(subCat) || 'Uncategorized';
            setCategory(subCat);
            setMasterCategory(masterCat);
            setUserOverriddenCategory(true);

            // Fetch group details for group members
            let groupMemberList: Array<{ id: string; name: string; avatarUrl?: string }> = [];
            if (targetGroupId) {
              try {
                const gDetails = await groupService.getGroupDetails(targetGroupId);
                if (gDetails?.members?.length) groupMemberList = gDetails.members;
              } catch {
                // Ignore group load error
              }
            }

            if (groupMemberList.length === 0 && exp.participants?.length > 0) {
              groupMemberList = exp.participants.map((p) => ({
                id: p.userId,
                name: p.name,
                avatarUrl: p.avatarUrl,
              }));
            }

            const normSplit: SplitType =
              exp.splitType === 'shares'
                ? 'by_shares'
                : exp.splitType === 'percentage'
                ? 'by_percentage'
                : (exp.splitType as SplitType) || 'equally';
            setSplitMode(normSplit);

            const mappedParticipants: SplitParticipantItem[] = groupMemberList.map((m) => {
              const matched = exp.participants.find((p) => p.userId === m.id);
              return {
                id: m.id,
                name: m.name,
                avatarUrl:
                  m.avatarUrl ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120&auto=format&fit=crop',
                selected: !!matched,
                shares: 1,
                percentage: 0,
                exactAmount: matched?.amountOwed || 0,
              };
            });
            setParticipants(mappedParticipants);

            let pType: 'single' | 'multiple' = 'single';
            let sPayerId = curId;
            let mPayers: MultiPayerEntry[] = [];

            if (exp.payers && exp.payers.length > 1) {
              pType = 'multiple';
              sPayerId = exp.payers[0]?.userId || curId;
              mPayers = exp.payers.map((p) => ({ userId: p.userId, amount: p.amount }));
            } else if (exp.payers && exp.payers.length === 1) {
              pType = 'single';
              sPayerId = exp.payers[0].userId;
              mPayers = [{ userId: exp.payers[0].userId, amount: exp.amount }];
            } else {
              pType = 'single';
              sPayerId = exp.paidById || curId;
              mPayers = [];
            }

            setPayerType(pType);
            setSinglePayerId(sPayerId);
            setMultiPayers(mPayers);

            setInitialSnapshot({
              amount: String(exp.amount),
              description: exp.title,
              category: subCat,
              masterCategory: masterCat,
              notes: exp.notes || '',
              date: (exp.rawDate || exp.date)
                ? new Date(exp.rawDate || exp.date).toDateString()
                : new Date().toDateString(),
              groupId: targetGroupId,
              payerType: pType,
              singlePayerId: sPayerId,
              multiPayers: mPayers.map((p) => ({ ...p })),
              splitMode: normSplit,
              participants: mappedParticipants.map((p) => ({ ...p })),
            });
          }
          setIsLoadingExisting(false);
        } else {
          // Normal Create Mode initialization
          const savedDefault = await groupService.getDefaultGroupId();
          if (isMounted) setDefaultGroupIdState(savedDefault);

          let targetGroupId = params.groupId;
          if (!targetGroupId && savedDefault && allGroups.some((g) => g.id === savedDefault)) {
            targetGroupId = savedDefault;
          }

          if (targetGroupId) {
            if (isMounted) setSelectedGroupId(targetGroupId);
            await loadGroupMembers(targetGroupId);
          } else if (allGroups.length > 0) {
            if (isMounted) setShowGroupModal(true);
          }
        }
      } catch (err) {
        if (isMounted) setIsLoadingExisting(false);
      }
    };
    init();
    return () => {
      isMounted = false;
    };
  }, [expenseId, params.groupId]);

  // Fetch dynamic categories from website settings on mount
  useEffect(() => {
    let mounted = true;
    settingsService.getExpenseCategories().then((cats) => {
      if (mounted) setCategories(cats);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // AI Classification on description change using active categories
  useEffect(() => {
    if (!userOverriddenCategory) {
      if (description.trim().length >= 3) {
        const predicted = settingsService.classifyExpense(description, categories);
        if (predicted && predicted.sub) {
          setCategory(predicted.sub);
          setMasterCategory(predicted.master);
        }
      } else if (description.trim().length === 0) {
        setCategory(initialCategory);
        setMasterCategory(settingsService.getMasterCategory(initialCategory) || 'Uncategorized');
      }
    }
  }, [description, userOverriddenCategory, categories, initialCategory]);

  const predictedCategory = useMemo(() => {
    if (description.trim().length >= 3) {
      return settingsService.classifyExpense(description, categories);
    }
    return null;
  }, [description, categories]);

  const selectedParticipants = useMemo(
    () => participants.filter((p) => p.selected),
    [participants]
  );

  const numAmount = parseFloat(amount) || 0;

  // Split calculation via @splitit/core
  const splitBreakdown = useMemo<Record<string, number>>(() => {
    if (numAmount <= 0 || selectedParticipants.length === 0) return {};

    try {
      const inputs = participants.map((p) => ({
        userId: p.id,
        selected: p.selected,
        shares: p.shares || 1,
        percentage: p.percentage || 0,
        amountOwed: p.exactAmount || 0,
      }));
      const effectivePayerId = payerType === 'single' ? singlePayerId : currentUserId;
      const results = calculateSplitAmounts(numAmount, inputs, splitMode, effectivePayerId);
      const breakdown: Record<string, number> = {};
      results.forEach((r) => {
        breakdown[r.userId] = r.amountOwed;
      });
      return breakdown;
    } catch {
      const share = numAmount / Math.max(1, selectedParticipants.length);
      return Object.fromEntries(selectedParticipants.map((p) => [p.id, share]));
    }
  }, [numAmount, selectedParticipants.length, participants, splitMode, payerType, singlePayerId, currentUserId]);

  const paidByText = useMemo(() => {
    if (payerType === 'single') {
      if (singlePayerId === currentUserId) return 'you';
      const payer = participants.find((p) => p.id === singlePayerId);
      return payer ? payer.name.split(' ')[0] : 'someone';
    }
    const activePayers = multiPayers.filter((p) => p.amount > 0);
    if (activePayers.length === 0) return 'no one';
    if (activePayers.length === 1) {
      if (activePayers[0].userId === currentUserId) return 'you';
      const payer = participants.find((p) => p.id === activePayers[0].userId);
      return payer ? payer.name.split(' ')[0] : 'someone';
    }
    return 'multiple people';
  }, [payerType, singlePayerId, multiPayers, currentUserId, participants]);

  const splitText = useMemo(() => {
    switch (splitMode) {
      case 'equally':
        return 'equally';
      case 'unequally':
        return 'unequally';
      case 'by_percentage':
        return 'by percentage';
      case 'by_shares':
        return 'by shares';
      default:
        return 'equally';
    }
  }, [splitMode]);

  const summarySubtext = useMemo(() => {
    if (numAmount <= 0) return 'Enter an amount to see your share.';
    if (selectedParticipants.length === 0) return 'Select a person to split.';

    const userPaid =
      payerType === 'single'
        ? singlePayerId === currentUserId
          ? numAmount
          : 0
        : multiPayers.find((p) => p.userId === currentUserId)?.amount || 0;

    const userOwed = splitBreakdown[currentUserId] || 0;
    const net = userPaid - userOwed;

    if (Math.abs(net) < 0.01) return 'You are all square.';
    if (net > 0) return `You get back ₹${net.toFixed(2)}`;
    return `You owe ₹${Math.abs(net).toFixed(2)}`;
  }, [numAmount, selectedParticipants.length, payerType, singlePayerId, currentUserId, multiPayers, splitBreakdown]);

  const activeGroup = useMemo(() => {
    return groups.find((g) => g.id === selectedGroupId) || groups[0];
  }, [groups, selectedGroupId]);

  const dateDisplayLabel = useMemo(() => {
    const today = new Date();
    const isToday =
      expenseDate.getDate() === today.getDate() &&
      expenseDate.getMonth() === today.getMonth() &&
      expenseDate.getFullYear() === today.getFullYear();
    if (isToday) return 'Today';

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const isYesterday =
      expenseDate.getDate() === yesterday.getDate() &&
      expenseDate.getMonth() === yesterday.getMonth() &&
      expenseDate.getFullYear() === yesterday.getFullYear();
    if (isYesterday) return 'Yesterday';

    return expenseDate.toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
    });
  }, [expenseDate]);

  const handleToggleParticipant = (id: string) => {
    Haptics.selectionAsync();
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p))
    );
  };

  const handleSelectGroup = async (groupId: string) => {
    Haptics.selectionAsync();
    setSelectedGroupId(groupId);

    if (isDefaultGroupChecked && !isEditMode) {
      await groupService.setDefaultGroupId(groupId);
      setDefaultGroupIdState(groupId);
    }

    await loadGroupMembers(groupId);
    setShowGroupModal(false);
  };

  const hasChanges = useMemo(() => {
    if (!isEditMode) return true;
    if (!initialSnapshot) return false;

    if (amount.trim() !== initialSnapshot.amount.trim()) return true;
    if (description.trim() !== initialSnapshot.description.trim()) return true;
    if (category !== initialSnapshot.category) return true;
    if (masterCategory !== initialSnapshot.masterCategory) return true;
    if (notes.trim() !== initialSnapshot.notes.trim()) return true;
    if (expenseDate.toDateString() !== initialSnapshot.date) return true;
    if (selectedGroupId !== initialSnapshot.groupId) return true;
    if (payerType !== initialSnapshot.payerType) return true;
    if (splitMode !== initialSnapshot.splitMode) return true;

    if (payerType === 'single') {
      if (singlePayerId !== initialSnapshot.singlePayerId) return true;
    } else {
      const curActive = multiPayers.filter((p) => (p.amount || 0) > 0);
      const initActive = initialSnapshot.multiPayers.filter((p) => (p.amount || 0) > 0);
      if (curActive.length !== initActive.length) return true;
      for (const cp of curActive) {
        const ip = initActive.find((p) => p.userId === cp.userId);
        if (!ip || Math.abs((ip.amount || 0) - (cp.amount || 0)) > 0.01) return true;
      }
    }

    if (participants.length !== initialSnapshot.participants.length) return true;
    for (const cp of participants) {
      const ip = initialSnapshot.participants.find((p) => p.id === cp.id);
      if (!ip) return true;
      if (cp.selected !== ip.selected) return true;
      if (cp.selected) {
        if (splitMode === 'unequally' && Math.abs((cp.exactAmount || 0) - (ip.exactAmount || 0)) > 0.01) return true;
        if (splitMode === 'by_percentage' && Math.abs((cp.percentage || 0) - (ip.percentage || 0)) > 0.01) return true;
        if (splitMode === 'by_shares' && (cp.shares || 1) !== (ip.shares || 1)) return true;
      }
    }

    return false;
  }, [
    isEditMode,
    initialSnapshot,
    amount,
    description,
    category,
    masterCategory,
    notes,
    expenseDate,
    selectedGroupId,
    payerType,
    singlePayerId,
    multiPayers,
    splitMode,
    participants,
  ]);

  const handleSave = async () => {
    if (!requireOnline(isEditMode ? 'edit this expense' : 'create an expense')) return;
    if (!description.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Missing Description', 'Please enter a description for this expense.');
      return;
    }

    if (numAmount <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Invalid Amount', 'Please enter a valid expense amount.');
      return;
    }

    if (!selectedGroupId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setShowGroupModal(true);
      return;
    }

    if (selectedParticipants.length === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('No Participants', 'Please select at least one person to split with.');
      return;
    }

    const validation = validateSplit({
      totalAmount: numAmount,
      splitType: splitMode,
      participants: selectedParticipants.map((p) => ({
        userId: p.id,
        selected: p.selected,
        shares: p.shares || 1,
        percentage: p.percentage || 0,
        amountOwed: splitBreakdown[p.id] || 0,
      })),
      multiPayerAmounts: payerType === 'multiple' ? multiPayers.map((p) => p.amount || 0) : undefined,
    });

    if (validation) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (validation.field === 'payers') {
        Alert.alert(
          'Unbalanced Payers',
          `The total paid (₹${validation.totalPaid.toFixed(2)}) must equal the expense amount (₹${validation.totalAmount.toFixed(2)}).`
        );
      } else if (validation.field === 'participants') {
        if (validation.kind === 'amounts') {
          Alert.alert(
            'Unbalanced Split',
            `The total owed (₹${validation.totalOwed.toFixed(2)}) must equal the expense amount (₹${validation.totalAmount.toFixed(2)}).`
          );
        } else if (validation.kind === 'percentage') {
          Alert.alert(
            'Invalid Percentage',
            `The sum of percentages (${validation.totalPercentage.toFixed(2)}%) must equal 100%.`
          );
        }
      }
      return;
    }

    setIsSaving(true);
    try {
      const payersPayload =
        payerType === 'single'
          ? [{ userId: singlePayerId, amount: numAmount }]
          : multiPayers.filter((p) => p.amount > 0).map((p) => ({ userId: p.userId, amount: p.amount }));

      const participantsPayload = selectedParticipants.map((p) => ({
        userId: p.id,
        amountOwed: splitBreakdown[p.id] || 0,
        share: p.shares || 1,
      }));

      if (isEditMode && expenseId) {
        const res = await expenseService.updateExpense(expenseId, {
          groupId: selectedGroupId,
          amount: numAmount,
          oldAmount: oldAmountRef.current,
          description: description.trim(),
          category,
          masterCategory,
          splitType: splitMode,
          notes: notes.trim() || undefined,
          date: expenseDate.toISOString(),
          payers: payersPayload,
          participants: participantsPayload,
        });

        if (res.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          handleClose();
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('Error', res.error || 'Failed to update expense.');
        }
      } else {
        const res = await expenseService.createExpense({
          groupId: selectedGroupId,
          amount: numAmount,
          description: description.trim(),
          category,
          masterCategory,
          splitType: splitMode,
          notes: notes.trim() || undefined,
          date: expenseDate.toISOString(),
          payers: payersPayload,
          participants: participantsPayload,
        });

        if (res.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          handleClose();
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('Error', res.error || 'Failed to record expense.');
        }
      }
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', e.message || 'An unexpected error occurred.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingExisting) {
    return (
      <View style={styles.rootWrapper}>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={THEME.colors.primary} />
            <Text style={styles.loadingText}>Loading expense details...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.rootWrapper}>
      {/* Semi-transparent dark backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />

      {/* Morphing container that expands from the + button */}
      <Animated.View
        style={[
          styles.expandingContainer,
          {
            opacity: containerOpacity,
            transform: [
              { translateX: containerTranslateX },
              { translateY: containerTranslateY },
              { scaleX: containerScaleX },
              { scaleY: containerScaleY },
            ],
          },
        ]}
      >
        {/* Emerald flash overlay that fades out during launch */}
        {isFromFab && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.emeraldFlashOverlay,
              { opacity: emeraldAuraOpacity },
            ]}
          />
        )}

        <SafeAreaView style={styles.innerSafeArea} edges={['top', 'bottom']}>
          <Animated.View
            style={[
              styles.contentWrap,
              {
                opacity: contentOpacity,
                transform: [{ translateY: contentTranslateY }],
              },
            ]}
          >
            <KeyboardAvoidingView
              style={styles.keyboardContainer}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              {/* Sleek Minimal Header */}
              <View style={styles.header}>
                <TouchableOpacity
                  onPress={handleClose}
                  style={styles.closeBtn}
                  activeOpacity={0.7}
                >
                  <X size={20} color={THEME.colors.textSecondary} />
                </TouchableOpacity>

          {/* Group display in header */}
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>
              {isEditMode ? 'Edit expense' : 'Add an expense'}
            </Text>
            {activeGroup ? (
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowGroupModal(true);
                }}
                activeOpacity={0.7}
                style={styles.headerGroupBadge}
              >
                <Text style={styles.headerGroupText} numberOfLines={1}>
                  in <Text style={styles.headerGroupNameHighlight}>{activeGroup.name}</Text>
                </Text>
                <ChevronDown size={11} color={THEME.colors.primary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowGroupModal(true);
                }}
                activeOpacity={0.7}
                style={styles.headerGroupBadge}
              >
                <Text style={styles.headerGroupPromptText}>Select group ▾</Text>
              </TouchableOpacity>
            )}
          </View>

          {!isEditMode && (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/ai/scanner');
              }}
              style={styles.scanBtn}
              activeOpacity={0.8}
            >
              <Camera size={14} color={THEME.colors.primary} />
              <Text style={styles.scanBtnText}>Scan</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Scrollable Form Body */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Details Block: Category Left + Underline Inputs Right */}
          <View style={styles.detailsHeroRow}>
            {/* Left: Category Icon Box + Name below */}
            <TouchableOpacity
              style={styles.categoryIconBtn}
              onPress={() => {
                Haptics.selectionAsync();
                setShowCategoryModal(true);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.categoryIconBox}>
                <CategoryIcon
                  subCategory={category}
                  masterCategory={masterCategory}
                  size={28}
                  color={THEME.colors.primary}
                />
              </View>
              <Text style={styles.categoryNameLabel} numberOfLines={1}>
                {category}
              </Text>
            </TouchableOpacity>

            {/* Right: Description & Amount Underline Fields */}
            <View style={styles.detailsInputsCol}>
              {/* Description Input with Underline */}
              <View style={styles.descriptionUnderlineRow}>
                <TextInput
                  style={styles.descriptionUnderlineInput}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Description"
                  placeholderTextColor={THEME.colors.textMuted}
                  autoCapitalize="sentences"
                  returnKeyType="next"
                />
              </View>

              {/* AI Category Suggestion Chip if predicted */}
              {predictedCategory && predictedCategory.sub !== category && (
                <TouchableOpacity
                  style={styles.aiSuggestionChip}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setCategory(predictedCategory.sub);
                    setMasterCategory(predictedCategory.master);
                    setUserOverriddenCategory(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Sparkles size={11} color={THEME.colors.aiLight} />
                  <Text style={styles.aiSuggestionText}>
                    Category: <Text style={{ fontWeight: '700', color: THEME.colors.text }}>{predictedCategory.sub}</Text>
                  </Text>
                  <Text style={styles.aiApplyLabel}>Apply</Text>
                </TouchableOpacity>
              )}

              {/* Amount Input with Currency Symbol and Underline */}
              <View style={styles.amountUnderlineRow}>
                <Text style={styles.currencyPrefix}>₹</Text>
                <TextInput
                  style={styles.amountUnderlineInput}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  placeholderTextColor={THEME.colors.textMuted}
                  keyboardType="decimal-pad"
                  autoFocus
                />
              </View>
            </View>
          </View>

          {/* Conversational Natural-Language Sentence Dock */}
          <View style={styles.sentenceDockContainer}>
            <View style={styles.sentenceDock}>
              <Text style={styles.sentenceText}>Paid by </Text>
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowPayerModal(true);
                }}
                style={styles.sentenceTriggerPill}
                activeOpacity={0.7}
              >
                <Text style={styles.sentenceTriggerText}>{paidByText}</Text>
                <ChevronDown size={13} color={THEME.colors.primary} />
              </TouchableOpacity>

              <Text style={styles.sentenceText}> and split </Text>

              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowSplitModal(true);
                }}
                style={styles.sentenceTriggerPill}
                activeOpacity={0.7}
              >
                <Text style={styles.sentenceTriggerText}>{splitText}</Text>
                <ChevronDown size={13} color={THEME.colors.primary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sentenceSubtext}>({summarySubtext})</Text>
          </View>

          {/* Member Participant Rings ("Split with") */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Split with</Text>
              <Text style={styles.sectionCountText}>
                {selectedParticipants.length} of {participants.length} included
              </Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarRingsScroll}>
              {participants.map((member) => (
                <TouchableOpacity
                  key={member.id}
                  style={[styles.memberRingCard, !member.selected && styles.memberRingInactive]}
                  onPress={() => handleToggleParticipant(member.id)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.avatarRingCircle,
                      member.selected ? styles.avatarRingActive : styles.avatarRingMuted,
                    ]}
                  >
                    <Image source={{ uri: member.avatarUrl }} style={styles.avatarImg} />
                    {member.selected && (
                      <View style={styles.checkBadge}>
                        <Check size={9} color={THEME.colors.primaryForeground} strokeWidth={3} />
                      </View>
                    )}
                  </View>
                  <Text style={[styles.memberNameText, member.selected && styles.memberNameActive]} numberOfLines={1}>
                    {member.name.split(' ')[0]}
                  </Text>
                  {numAmount > 0 && member.selected && (
                    <Text style={styles.memberShareText}>
                      ₹{(splitBreakdown[member.id] || 0).toFixed(2)}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </ScrollView>

        {/* Keyboard-Anchored Accessory Toolbar (Date & Notes stay above keyboard always) */}
        <View style={styles.anchoredToolbar}>
          {/* Accessory Pills Row: Date & Add Note */}
          <View style={styles.accessoryPillsRow}>
            <TouchableOpacity
              style={[styles.accessoryPill, showDateModal && styles.accessoryPillActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setShowDateModal(true);
              }}
              activeOpacity={0.7}
            >
              <Calendar size={13} color={THEME.colors.textSecondary} />
              <Text style={styles.accessoryPillText}>{dateDisplayLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.accessoryPill, (showNotesInput || notes) && styles.accessoryPillActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setShowNotesInput((prev) => !prev);
              }}
              activeOpacity={0.7}
            >
              <FileText size={13} color={notes ? THEME.colors.primary : THEME.colors.textSecondary} />
              <Text style={styles.accessoryPillText}>
                {notes ? (notes.length > 16 ? `${notes.slice(0, 16)}...` : notes) : 'Add note'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Expandable Inline Note Input (Docked Above Keyboard) */}
          {showNotesInput && (
            <View style={styles.inlineNoteContainer}>
              <TextInput
                style={styles.inlineNoteInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add extra details, bill numbers, or links..."
                placeholderTextColor={THEME.colors.textMuted}
                multiline
                autoFocus
              />
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowNotesInput(false);
                }}
                style={styles.inlineNoteDoneBtn}
                activeOpacity={0.7}
              >
                <Check size={14} color={THEME.colors.primary} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Floating Bottom Sticky Action Button */}
        <View style={styles.bottomBar}>
          {isEditMode && !hasChanges && (
            <View style={styles.unchangedPillWrap}>
              <View style={styles.unchangedDot} />
              <Text style={styles.unchangedPillText}>Expense details unchanged</Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.recordBtn,
              (!description.trim() || numAmount <= 0 || isSaving) && styles.recordBtnDisabled,
              isEditMode && !hasChanges && styles.recordBtnUnchanged,
            ]}
            onPress={handleSave}
            disabled={!description.trim() || numAmount <= 0 || isSaving || (isEditMode && !hasChanges)}
            activeOpacity={0.85}
          >
            {isSaving ? (
              <ActivityIndicator
                size="small"
                color={isEditMode && !hasChanges ? THEME.colors.textMuted : THEME.colors.primaryForeground}
              />
            ) : (
              <>
                <Check
                  size={18}
                  color={isEditMode && !hasChanges ? THEME.colors.textMuted : THEME.colors.primaryForeground}
                  strokeWidth={2.5}
                />
                <Text
                  style={[
                    styles.recordBtnText,
                    isEditMode && !hasChanges && styles.recordBtnTextUnchanged,
                  ]}
                >
                  {isEditMode
                    ? !hasChanges
                      ? 'No changes to save'
                      : numAmount > 0
                      ? `Save Changes (₹${numAmount.toLocaleString('en-IN')})`
                      : 'Save Changes'
                    : numAmount > 0
                    ? `Record ₹${numAmount.toLocaleString('en-IN')} Expense`
                    : 'Enter Amount to Save'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* MODAL 1: PAYER SELECTOR */}
        <PayerSelectModal
          visible={showPayerModal}
          onClose={() => setShowPayerModal(false)}
          members={participants.map((p) => ({
            id: p.id,
            name: p.name,
            avatarUrl: p.avatarUrl,
          }))}
          currentUserId={currentUserId}
          totalAmount={numAmount}
          initialPayerType={payerType}
          initialSinglePayerId={singlePayerId}
          initialMultiPayers={multiPayers}
          onConfirm={(result) => {
            setPayerType(result.payerType);
            setSinglePayerId(result.singlePayerId);
            setMultiPayers(result.multiPayers);
          }}
        />

        {/* MODAL 2: SPLIT OPTIONS SELECTOR */}
        <SplitOptionsModal
          visible={showSplitModal}
          onClose={() => setShowSplitModal(false)}
          totalAmount={numAmount}
          currentUserId={currentUserId}
          payerId={payerType === 'single' ? singlePayerId : currentUserId}
          initialSplitType={splitMode}
          participants={participants}
          onConfirm={(result) => {
            setSplitMode(result.splitType);
            setParticipants(result.participants);
          }}
        />

        {/* MODAL 3: GROUP PICKER SHEET (WITH DEFAULT TOGGLE) */}
        <Modal visible={showGroupModal} transparent animationType="slide">
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => {
              if (selectedGroupId) {
                setShowGroupModal(false);
              }
            }}
          >
            <View style={[styles.sheetContainer, { maxHeight: '80%' }]}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Choose Group</Text>
              <Text style={styles.sheetSubtitle}>
                Select which group this expense will be added to
              </Text>

              {/* Set as Default Toggle Card */}
              <TouchableOpacity
                style={styles.defaultToggleCard}
                onPress={() => {
                  Haptics.selectionAsync();
                  setIsDefaultGroupChecked((prev) => !prev);
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.defaultCheckbox, isDefaultGroupChecked && styles.defaultCheckboxActive]}>
                  {isDefaultGroupChecked && <Check size={12} color={THEME.colors.primaryForeground} strokeWidth={3} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.defaultToggleTitle}>Set as default group</Text>
                  <Text style={styles.defaultToggleSub}>Auto-select when adding from homescreen</Text>
                </View>
                <Star
                  size={18}
                  color={isDefaultGroupChecked ? THEME.colors.primary : THEME.colors.textMuted}
                  fill={isDefaultGroupChecked ? THEME.colors.primary : 'transparent'}
                />
              </TouchableOpacity>

              <View style={styles.sheetSearchBox}>
                <Search size={15} color={THEME.colors.textMuted} />
                <TextInput
                  style={styles.sheetSearchInput}
                  placeholder="Search your groups..."
                  placeholderTextColor={THEME.colors.textMuted}
                  value={groupSearch}
                  onChangeText={setGroupSearch}
                />
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {groups
                  .filter((g) => g.name.toLowerCase().includes(groupSearch.toLowerCase()))
                  .map((grp) => {
                    const isSelected = grp.id === selectedGroupId;
                    const isDefault = grp.id === defaultGroupId;
                    return (
                      <TouchableOpacity
                        key={grp.id}
                        style={[styles.sheetGroupRow, isSelected && styles.sheetGroupRowActive]}
                        onPress={() => handleSelectGroup(grp.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.groupAvatarWrap}>
                          {grp.coverImageUrl ? (
                            <Image source={{ uri: grp.coverImageUrl }} style={styles.groupAvatarImg} />
                          ) : (
                            <Text style={styles.groupAvatarInitial}>{grp.name.charAt(0)}</Text>
                          )}
                        </View>
                        <View style={styles.groupInfoCol}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.groupNameText, isSelected && styles.groupNameTextActive]}>
                              {grp.name}
                            </Text>
                            {isDefault && (
                              <View style={styles.defaultBadge}>
                                <Star size={9} color={THEME.colors.primary} fill={THEME.colors.primary} />
                                <Text style={styles.defaultBadgeText}>Default</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.groupMetaText}>{grp.membersCount || 0} members</Text>
                        </View>
                        {isSelected && <Check size={18} color={THEME.colors.primary} strokeWidth={2.5} />}
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* MODAL 4: CATEGORY PICKER SHEET */}
        <Modal visible={showCategoryModal} transparent animationType="slide">
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowCategoryModal(false)}
          >
            <View style={[styles.sheetContainer, { maxHeight: '75%' }]}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Choose Category</Text>

              <View style={styles.sheetSearchBox}>
                <Search size={15} color={THEME.colors.textMuted} />
                <TextInput
                  style={styles.sheetSearchInput}
                  placeholder="Search categories..."
                  placeholderTextColor={THEME.colors.textMuted}
                  value={categorySearch}
                  onChangeText={setCategorySearch}
                />
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {Object.entries(categories)
                  .filter(([master, masterCategoryData]) => {
                    if (!categorySearch.trim()) return true;
                    const q = categorySearch.toLowerCase().trim();
                    if (master.toLowerCase().includes(q)) return true;
                    const subNames = Object.keys(masterCategoryData.subCategories || {});
                    return subNames.some((sub) => {
                      const lowerSub = sub.toLowerCase();
                      if (lowerSub.includes(q) || (lowerSub === 'other' && q.startsWith('other'))) return true;
                      const kw = masterCategoryData.subCategories[sub]?.keywords || [];
                      return kw.some((k) => k.toLowerCase().includes(q) || q.includes(k.toLowerCase()));
                    });
                  })
                  .map(([master, masterCategoryData]) => {
                    const q = categorySearch.toLowerCase().trim();
                    const subNames = Object.keys(masterCategoryData.subCategories || {}).filter((sub) => {
                      if (!q || master.toLowerCase().includes(q)) return true;
                      const lowerSub = sub.toLowerCase();
                      if (lowerSub.includes(q) || (lowerSub === 'other' && q.startsWith('other'))) return true;
                      const kw = masterCategoryData.subCategories[sub]?.keywords || [];
                      return kw.some((k) => k.toLowerCase().includes(q) || q.includes(k.toLowerCase()));
                    });

                    if (subNames.length === 0) return null;

                    return (
                      <View key={master} style={{ marginBottom: 16 }}>
                        <View style={styles.categoryHeaderRow}>
                          <CategoryIcon masterCategory={master} size={16} color={THEME.colors.primary} />
                          <Text style={styles.categoryGroupTitle}>{master}</Text>
                        </View>
                        <View style={styles.categoryPillsWrap}>
                          {subNames.map((sub) => {
                            const isSelected = category === sub;
                            return (
                              <TouchableOpacity
                                key={sub}
                                style={[styles.categoryChoicePill, isSelected && styles.categoryChoiceActive]}
                                onPress={() => {
                                  Haptics.selectionAsync();
                                  setUserOverriddenCategory(true);
                                  setCategory(sub);
                                  setMasterCategory(master);
                                  setShowCategoryModal(false);
                                }}
                              >
                                <CategoryIcon
                                  subCategory={sub}
                                  masterCategory={master}
                                  size={13}
                                  color={isSelected ? THEME.colors.primary : THEME.colors.textMuted}
                                />
                                <Text style={[styles.categoryChoiceText, isSelected && styles.categoryChoiceTextActive]}>
                                  {sub}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* MODAL 5: DATE PICKER SHEET */}
        <Modal visible={showDateModal} transparent animationType="slide">
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowDateModal(false)}
          >
            <View style={[styles.sheetContainer, { maxHeight: '60%' }]}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Expense Date</Text>

              <View style={{ marginTop: 12 }}>
                {[
                  { label: 'Today', date: new Date() },
                  { label: 'Yesterday', date: new Date(Date.now() - 86400000) },
                  { label: '2 days ago', date: new Date(Date.now() - 2 * 86400000) },
                  { label: '3 days ago', date: new Date(Date.now() - 3 * 86400000) },
                  { label: '1 week ago', date: new Date(Date.now() - 7 * 86400000) },
                ].map((item) => {
                  const isSelected =
                    expenseDate.getDate() === item.date.getDate() &&
                    expenseDate.getMonth() === item.date.getMonth() &&
                    expenseDate.getFullYear() === item.date.getFullYear();

                  return (
                    <TouchableOpacity
                      key={item.label}
                      style={[styles.dateChoiceRow, isSelected && styles.dateChoiceRowActive]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setExpenseDate(item.date);
                        setShowDateModal(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.dateChoiceLabel, isSelected && styles.dateChoiceLabelActive]}>
                        {item.label}
                      </Text>
                      <Text style={styles.dateChoiceSub}>
                        {item.date.toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          weekday: 'short',
                        })}
                      </Text>
                      {isSelected && <Check size={16} color={THEME.colors.primary} strokeWidth={2.5} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
            </KeyboardAvoidingView>
          </Animated.View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  rootWrapper: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: THEME.colors.palette.black,
  },
  expandingContainer: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    overflow: 'hidden',
    borderRadius: Platform.OS === 'ios' ? 36 : 24,
  },
  emeraldFlashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: THEME.colors.primary,
    zIndex: 99,
  },
  innerSafeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  contentWrap: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 12,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.colors.text,
    textAlign: 'left',
  },
  headerGroupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: THEME.colors.surfaceElevated,
  },
  headerGroupText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  headerGroupNameHighlight: {
    color: THEME.colors.text,
    fontWeight: '600',
  },
  headerGroupPromptText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.primary,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  scanBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },

  /* Hero Details Row */
  detailsHeroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 16,
  },
  categoryIconBtn: {
    alignItems: 'center',
    width: 68,
  },
  categoryIconBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryNameLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
    maxWidth: 68,
  },
  detailsInputsCol: {
    flex: 1,
    justifyContent: 'center',
  },
  descriptionUnderlineRow: {
    borderBottomWidth: 1.5,
    borderBottomColor: THEME.colors.hairline,
    paddingBottom: 4,
  },
  descriptionUnderlineInput: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.colors.text,
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  amountUnderlineRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    borderBottomWidth: 1.5,
    borderBottomColor: THEME.colors.hairline,
    marginTop: 14,
    paddingBottom: 4,
  },
  currencyPrefix: {
    fontSize: 32,
    fontWeight: '700',
    color: THEME.colors.primary,
    marginRight: 4,
    lineHeight: 38,
  },
  amountUnderlineInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '700',
    color: THEME.colors.text,
    paddingVertical: 0,
    paddingHorizontal: 0,
    lineHeight: 38,
  },

  aiSuggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  aiSuggestionText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  aiApplyLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.aiLight,
    textTransform: 'uppercase',
  },

  /* Sentence Dock */
  sentenceDockContainer: {
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 16,
  },
  sentenceDock: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  sentenceText: {
    fontSize: 15,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
  },
  sentenceTriggerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: THEME.colors.surfaceElevated,
    marginHorizontal: 2,
    marginVertical: 2,
  },
  sentenceTriggerText: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  sentenceSubtext: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    marginTop: 4,
  },

  /* Participant Rings Section */
  sectionContainer: {
    marginTop: 12,
    paddingHorizontal: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  sectionCountText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  avatarRingsScroll: {
    gap: 14,
    paddingRight: 16,
  },
  memberRingCard: {
    alignItems: 'center',
    width: 62,
  },
  memberRingInactive: {
    opacity: 0.4,
  },
  avatarRingCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    padding: 2,
    borderWidth: 2,
    position: 'relative',
  },
  avatarRingActive: {
    borderColor: THEME.colors.primary,
  },
  avatarRingMuted: {
    borderColor: 'transparent',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  checkBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 17,
    height: 17,
    borderRadius: 4,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: THEME.colors.background,
  },
  memberNameText: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  memberNameActive: {
    color: THEME.colors.text,
    fontWeight: '600',
  },
  memberShareText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.primary,
    marginTop: 2,
  },

  /* Anchored Toolbar (Date & Notes) */
  anchoredToolbar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: THEME.colors.background,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.surface,
    gap: 8,
  },
  accessoryPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accessoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  accessoryPillActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.surface,
  },
  accessoryPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
  },
  inlineNoteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  inlineNoteInput: {
    flex: 1,
    fontSize: 13,
    color: THEME.colors.text,
    paddingVertical: 4,
    maxHeight: 60,
  },
  inlineNoteDoneBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Bottom Sticky Action Bar */
  bottomBar: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 4 : 12,
    backgroundColor: THEME.colors.background,
  },
  recordBtn: {
    height: 50,
    borderRadius: THEME.radius.xl,
    backgroundColor: THEME.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerRightPlaceholder: {
    width: 36,
    height: 36,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: THEME.colors.textMuted,
  },
  recordBtnDisabled: {
    backgroundColor: THEME.colors.surfaceElevated,
    opacity: 0.5,
  },
  recordBtnUnchanged: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    opacity: 0.8,
  },
  recordBtnTextUnchanged: {
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },
  unchangedPillWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
  },
  unchangedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.textMuted,
  },
  unchangedPillText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  recordBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.primaryForeground,
  },

  /* Modal Sheets Shared */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: THEME.colors.hairline,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.text,
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    marginBottom: 14,
  },
  sheetSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  sheetSearchInput: {
    flex: 1,
    fontSize: 14,
    color: THEME.colors.text,
    paddingVertical: 0,
  },

  /* Default Toggle Card */
  defaultToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  defaultCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: THEME.colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultCheckboxActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  defaultToggleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  defaultToggleSub: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },

  /* Group Sheet Rows */
  sheetGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 12,
  },
  sheetGroupRowActive: {
    backgroundColor: THEME.colors.surfaceElevated,
  },
  groupAvatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  groupAvatarImg: {
    width: '100%',
    height: '100%',
  },
  groupAvatarInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  groupInfoCol: {
    flex: 1,
  },
  groupNameText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  groupNameTextActive: {
    color: THEME.colors.primary,
  },
  groupMetaText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(28, 194, 159, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.primary,
  },

  /* Category Sheet Rows */
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    marginTop: 4,
  },
  categoryGroupTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChoicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  categoryChoiceActive: {
    backgroundColor: 'rgba(28, 194, 159, 0.15)',
    borderColor: THEME.colors.primary,
  },
  categoryChoiceText: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  categoryChoiceTextActive: {
    color: THEME.colors.primary,
    fontWeight: '600',
  },

  /* Date Sheet Rows */
  dateChoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  dateChoiceRowActive: {
    backgroundColor: THEME.colors.surfaceElevated,
  },
  dateChoiceLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.text,
    flex: 1,
  },
  dateChoiceLabelActive: {
    color: THEME.colors.primary,
  },
  dateChoiceSub: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    marginRight: 10,
  },
});
