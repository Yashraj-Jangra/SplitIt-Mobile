import React, { useState, useEffect, useMemo } from 'react';
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
  Users,
  ChevronDown,
  Search,
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
import * as Haptics from 'expo-haptics';

export default function NewExpenseModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    amount?: string;
    description?: string;
    category?: string;
    groupId?: string;
  }>();

  const [categories, setCategories] = useState<Record<string, MasterCategory>>(() =>
    settingsService.getCachedExpenseCategories()
  );

  // Form State
  const [amount, setAmount] = useState(params.amount || '');
  const [description, setDescription] = useState(params.description || '');
  const [category, setCategory] = useState(params.category || 'Dining Out');
  const [masterCategory, setMasterCategory] = useState(() =>
    settingsService.getMasterCategory(params.category || 'Dining Out') || 'Food and Drink'
  );
  const [date, setDate] = useState('Today');
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [userOverriddenCategory, setUserOverriddenCategory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Group State
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(params.groupId || '');

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

  // Load user groups and participants dynamically
  useEffect(() => {
    const init = async () => {
      try {
        const user = await authService.getCachedUser();
        const curId = user?.id || 'u1';
        setCurrentUserId(curId);
        setSinglePayerId(curId);

        const allGroups = await groupService.getUserGroups();
        setGroups(allGroups);

        const targetGroupId = params.groupId || allGroups[0]?.id || '';
        setSelectedGroupId(targetGroupId);

        if (targetGroupId) {
          const groupDetails = await groupService.getGroupDetails(targetGroupId);
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
        }
      } catch {
        // Keep default state
      }
    };
    init();
  }, [params.groupId]);

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
    if (description.trim().length >= 3 && !userOverriddenCategory) {
      const predicted = settingsService.classifyExpense(description, categories);
      if (predicted && predicted.sub) {
        setCategory(predicted.sub);
        setMasterCategory(predicted.master);
      }
    }
  }, [description, userOverriddenCategory, categories]);

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
      const results = calculateSplitAmounts(numAmount, inputs, splitMode);
      const breakdown: Record<string, number> = {};
      results.forEach((r) => {
        breakdown[r.userId] = r.amountOwed;
      });
      return breakdown;
    } catch {
      const share = numAmount / Math.max(1, selectedParticipants.length);
      return Object.fromEntries(selectedParticipants.map((p) => [p.id, share]));
    }
  }, [numAmount, selectedParticipants.length, participants, splitMode]);

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

  const handleToggleParticipant = (id: string) => {
    Haptics.selectionAsync();
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p))
    );
  };

  const handleSelectGroup = async (groupId: string) => {
    setSelectedGroupId(groupId);
    setShowGroupModal(false);
    Haptics.selectionAsync();
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
      // Keep state
    }
  };

  const handleSave = async () => {
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
      Alert.alert('Group Missing', 'Please select a valid group for this expense.');
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

      const res = await expenseService.createExpense({
        groupId: selectedGroupId,
        amount: numAmount,
        description: description.trim(),
        category,
        masterCategory,
        splitType: splitMode,
        notes: notes.trim() || undefined,
        date: new Date().toISOString(),
        payers: payersPayload,
        participants: participantsPayload,
      });

      if (res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', res.error || 'Failed to record expense.');
      }
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', e.message || 'An unexpected error occurred.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Sleek Top Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              router.back();
            }}
            style={styles.closeBtn}
            activeOpacity={0.7}
          >
            <X size={20} color={THEME.colors.textSecondary} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Add Expense</Text>

          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/ai/scanner');
            }}
            style={styles.scanBtn}
            activeOpacity={0.8}
          >
            <Camera size={15} color={THEME.colors.primary} />
            <Text style={styles.scanBtnText}>Scan</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Centered Amount Hero Block */}
          <View style={styles.amountHeroBlock}>
            <View style={styles.amountDisplayRow}>
              <Text style={styles.currencyPrefix}>₹</Text>
              <TextInput
                style={styles.amountBigInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor={THEME.colors.textMuted}
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>

            {/* Description Input */}
            <TextInput
              style={styles.descriptionInput}
              value={description}
              onChangeText={setDescription}
              placeholder="What was this for?"
              placeholderTextColor={THEME.colors.textMuted}
              autoCapitalize="sentences"
            />

            {/* Smart AI Category Suggestion Chip */}
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
                <Sparkles size={12} color={THEME.colors.aiLight} />
                <Text style={styles.aiSuggestionText}>
                  Suggestion: <Text style={{ fontWeight: '800', color: '#FFFFFF' }}>{predictedCategory.sub}</Text>
                </Text>
                <Text style={styles.aiApplyLabel}>Tap to apply</Text>
              </TouchableOpacity>
            )}
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
                        <Check size={9} color="#000000" strokeWidth={3} />
                      </View>
                    )}
                  </View>
                  <Text style={[styles.memberNameText, member.selected && styles.memberNameActive]} numberOfLines={1}>
                    {member.name.split(' ')[0]}
                  </Text>
                  {numAmount > 0 && member.selected && (
                    <Text style={styles.memberShareText}>
                      ₹{(splitBreakdown[member.id] || 0).toFixed(0)}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Inline Action Pills: Group, Category, Date, Notes */}
          <View style={styles.metaPillsRow}>
            <TouchableOpacity
              style={styles.metaPill}
              onPress={() => {
                Haptics.selectionAsync();
                setShowGroupModal(true);
              }}
              activeOpacity={0.7}
            >
              <Users size={14} color={THEME.colors.primary} />
              <Text style={styles.metaPillText} numberOfLines={1}>
                {activeGroup?.name || 'Group'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.metaPill}
              onPress={() => {
                Haptics.selectionAsync();
                setShowCategoryModal(true);
              }}
              activeOpacity={0.7}
            >
              <CategoryIcon subCategory={category} masterCategory={masterCategory} size={14} color={THEME.colors.primary} />
              <Text style={styles.metaPillText} numberOfLines={1}>
                {category}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.metaPill} activeOpacity={0.7}>
              <Calendar size={14} color={THEME.colors.textSecondary} />
              <Text style={styles.metaPillText}>{date}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.metaPill}
              onPress={() => setShowNotes(!showNotes)}
              activeOpacity={0.7}
            >
              <FileText size={14} color={notes ? THEME.colors.primary : THEME.colors.textSecondary} />
              <Text style={styles.metaPillText}>{notes ? 'Notes added' : 'Add note'}</Text>
            </TouchableOpacity>
          </View>

          {/* Collapsible Notes Field */}
          {showNotes && (
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add extra details, bill numbers, or links..."
              placeholderTextColor={THEME.colors.textMuted}
              multiline
            />
          )}
        </ScrollView>

        {/* Floating Bottom Sticky Action Button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[
              styles.recordBtn,
              (!description.trim() || numAmount <= 0 || isSaving) && styles.recordBtnDisabled,
            ]}
            onPress={handleSave}
            disabled={!description.trim() || numAmount <= 0 || isSaving}
            activeOpacity={0.85}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <>
                <Check size={18} color="#000000" strokeWidth={2.5} />
                <Text style={styles.recordBtnText}>
                  {numAmount > 0 ? `Record ₹${numAmount.toLocaleString('en-IN')} Expense` : 'Enter Amount to Save'}
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
          initialSplitType={splitMode}
          participants={participants}
          onConfirm={(result) => {
            setSplitMode(result.splitType);
            setParticipants(result.participants);
          }}
        />

        {/* MODAL 3: GROUP PICKER SHEET */}
        <Modal visible={showGroupModal} transparent animationType="slide">
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowGroupModal(false)}
          >
            <View style={[styles.sheetContainer, { maxHeight: '75%' }]}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Choose Group</Text>

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
                          <Text style={[styles.groupNameText, isSelected && styles.groupNameTextActive]}>
                            {grp.name}
                          </Text>
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
                      if (sub.toLowerCase().includes(q)) return true;
                      const kw = masterCategoryData.subCategories[sub]?.keywords || [];
                      return kw.some((k) => k.toLowerCase().includes(q));
                    });
                  })
                  .map(([master, masterCategoryData]) => {
                    const q = categorySearch.toLowerCase().trim();
                    const subNames = Object.keys(masterCategoryData.subCategories || {}).filter((sub) => {
                      if (!q || master.toLowerCase().includes(q)) return true;
                      if (sub.toLowerCase().includes(q)) return true;
                      const kw = masterCategoryData.subCategories[sub]?.keywords || [];
                      return kw.some((k) => k.toLowerCase().includes(q));
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    paddingBottom: 14,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.colors.text,
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
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
    gap: 20,
  },

  // Centered Amount Hero Block
  amountHeroBlock: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  amountDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  currencyPrefix: {
    fontSize: 32,
    fontWeight: '700',
    color: THEME.colors.primary,
    marginTop: 4,
  },
  amountBigInput: {
    fontSize: 50,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -1,
    minWidth: 80,
    textAlign: 'center',
    paddingVertical: 0,
  },
  descriptionInput: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.colors.text,
    textAlign: 'center',
    marginTop: 8,
    width: '100%',
    paddingVertical: 6,
  },
  aiSuggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.aiMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  aiSuggestionText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  aiApplyLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.primary,
    marginLeft: 4,
  },

  // Conversational Natural-Language Sentence Dock
  sentenceDockContainer: {
    alignItems: 'center',
    gap: 6,
  },
  sentenceDock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  sentenceText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
  },
  sentenceTriggerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(28, 194, 159, 0.25)',
  },
  sentenceTriggerText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  sentenceSubtext: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },

  // Participant Avatar Rings
  sectionContainer: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  sectionCountText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  avatarRingsScroll: {
    gap: 14,
    paddingVertical: 4,
  },
  memberRingCard: {
    alignItems: 'center',
    width: 68,
    gap: 6,
  },
  memberRingInactive: {
    opacity: 0.45,
  },
  avatarRingCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    padding: 2,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRingActive: {
    borderWidth: 2,
    borderColor: THEME.colors.primary,
  },
  avatarRingMuted: {
    borderWidth: 1.5,
    borderColor: THEME.colors.hairline,
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  checkBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
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
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  memberNameActive: {
    color: THEME.colors.text,
    fontWeight: '700',
  },
  memberShareText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.primary,
  },

  // Meta Pills Row
  metaPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    maxWidth: '48%',
  },
  metaPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  notesInput: {
    backgroundColor: THEME.colors.surface,
    padding: 12,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    color: THEME.colors.text,
    fontSize: 13,
    minHeight: 70,
    textAlignVertical: 'top',
  },

  // Bottom Sticky Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: THEME.colors.background,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    paddingVertical: 14,
    borderRadius: THEME.radius.lg,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  recordBtnDisabled: {
    opacity: 0.45,
    backgroundColor: THEME.colors.surfaceElevated,
  },
  recordBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000000',
  },

  // Modal Sheets
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 12,
    borderWidth: 1,
    borderColor: THEME.colors.hairlineLight,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.text,
    marginBottom: 6,
  },
  sheetSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.surfaceSubtle,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    marginBottom: 8,
  },
  sheetSearchInput: {
    flex: 1,
    fontSize: 13,
    color: THEME.colors.text,
    paddingVertical: 0,
  },
  sheetGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: THEME.radius.md,
  },
  sheetGroupRowActive: {
    backgroundColor: THEME.colors.surfaceElevated,
  },
  groupAvatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
    color: THEME.colors.text,
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
    fontWeight: '700',
  },
  groupMetaText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  categoryGroupTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  categoryChoiceActive: {
    backgroundColor: THEME.colors.primaryMuted,
    borderColor: THEME.colors.primary,
  },
  categoryChoiceText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  categoryChoiceTextActive: {
    color: THEME.colors.primary,
    fontWeight: '700',
  },
});
