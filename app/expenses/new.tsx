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
  ArrowLeft,
  Check,
  Receipt,
  Camera,
  Sparkles,
  Calendar,
  FileText,
  Users,
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

  // Payment & Split Modal State
  const [payerType, setPayerType] = useState<'single' | 'multiple'>('single');
  const [singlePayerId, setSinglePayerId] = useState<string>('u1');
  const [multiPayers, setMultiPayers] = useState<MultiPayerEntry[]>([]);
  const [splitMode, setSplitMode] = useState<SplitType>('equally');

  const [currentUserId, setCurrentUserId] = useState<string>('u1');
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(params.groupId || '');

  // Sub-modal triggers
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showPayerModal, setShowPayerModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');

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
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Splitwise App Bar: ← Back | Add expense | ✓ Save */}
        <View style={styles.appBar}>
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              router.back();
            }}
            style={styles.navBtn}
            activeOpacity={0.7}
          >
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.appBarTitle}>Add expense</Text>

          <TouchableOpacity
            onPress={handleSave}
            style={styles.navBtn}
            disabled={isSaving}
            activeOpacity={0.7}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#1CC29F" />
            ) : (
              <Check size={24} color="#FFFFFF" strokeWidth={2.5} />
            )}
          </TouchableOpacity>
        </View>

        {/* Scrollable Form Body (Compact & Fits tightly in Viewport) */}
        <ScrollView
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Recipient Row: With you and: [ 💚 All of College ] */}
          <View style={styles.recipientRow}>
            <Text style={styles.recipientPrefix}>With you and:</Text>
            <View style={styles.recipientPill}>
              <View style={styles.recipientIconCircle}>
                <Users size={12} color="#1CC29F" />
              </View>
              <Text style={styles.recipientPillText} numberOfLines={1}>
                {activeGroup?.name ? `All of ${activeGroup.name}` : 'All of Group'}
              </Text>
            </View>
          </View>

          {/* Description Input Row with Receipt Icon Box */}
          <View style={styles.inputRow}>
            <View style={styles.inputIconBox}>
              <Receipt size={22} color="#9CA3AF" />
            </View>
            <View style={styles.descriptionUnderlineWrap}>
              <TextInput
                style={styles.descriptionInput}
                value={description}
                onChangeText={setDescription}
                placeholder="Enter a description"
                placeholderTextColor="#6B7280"
                autoCapitalize="sentences"
              />
            </View>
          </View>

          {/* Amount Input Row with Currency Box & Green Underline */}
          <View style={styles.inputRow}>
            <View style={styles.inputIconBox}>
              <Text style={styles.currencyIconBoxText}>₹</Text>
            </View>
            <View style={styles.amountUnderlineWrap}>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor="#6B7280"
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>
          </View>

          {/* AI Category Suggestion Chip */}
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
              <Sparkles size={12} color="#1CC29F" />
              <Text style={styles.aiSuggestionText}>
                Category: <Text style={{ fontWeight: '700', color: '#FFFFFF' }}>{predictedCategory.sub}</Text> • Tap to apply
              </Text>
            </TouchableOpacity>
          )}

          {/* Conversational Sentence: Paid by [ you ] and split [ equally ] */}
          <View style={styles.conversationalBlock}>
            <View style={styles.conversationalRow}>
              <Text style={styles.conversationalText}>Paid by </Text>
              <TouchableOpacity
                style={styles.sentenceChip}
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowPayerModal(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.sentenceChipText}>{paidByText}</Text>
              </TouchableOpacity>

              <Text style={styles.conversationalText}> and split </Text>

              <TouchableOpacity
                style={styles.sentenceChip}
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowSplitModal(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.sentenceChipText}>{splitText}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.netShareSummaryText}>({summarySubtext})</Text>
          </View>

          {/* Collapsible Notes Field */}
          {showNotes && (
            <View style={styles.notesBox}>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add extra details, bill numbers..."
                placeholderTextColor="#6B7280"
                multiline
              />
            </View>
          )}
        </ScrollView>

        {/* Keyboard-Anchored Accessory Toolbar (Direct Splitwise Match) */}
        <View style={styles.keyboardAccessoryToolbar}>
          {/* Left: Group Tag */}
          <View style={styles.toolbarGroupBadge}>
            <Users size={15} color="#F97316" />
            <Text style={styles.toolbarGroupName} numberOfLines={1}>
              {activeGroup?.name || 'Group'}
            </Text>
          </View>

          {/* Right Action Icons: Category, Date, Camera, Notes */}
          <View style={styles.toolbarIconsRow}>
            <TouchableOpacity
              style={styles.toolbarActionBtn}
              onPress={() => {
                Haptics.selectionAsync();
                setShowCategoryModal(true);
              }}
              activeOpacity={0.7}
            >
              <CategoryIcon subCategory={category} masterCategory={masterCategory} size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolbarActionBtn} activeOpacity={0.7}>
              <Calendar size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolbarActionBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/ai/scanner');
              }}
              activeOpacity={0.7}
            >
              <Camera size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toolbarActionBtn, showNotes && styles.toolbarActionBtnActive]}
              onPress={() => setShowNotes(!showNotes)}
              activeOpacity={0.7}
            >
              <FileText size={18} color={showNotes ? '#1CC29F' : '#9CA3AF'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* SUB-MODAL 1: PAYER SELECTOR */}
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

        {/* SUB-MODAL 2: ADJUST SPLIT SELECTOR */}
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

        {/* SUB-MODAL 3: CATEGORY PICKER */}
        <Modal visible={showCategoryModal} transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowCategoryModal(false)}
          >
            <View style={[styles.sheetContainer, { maxHeight: '75%' }]}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Choose Category</Text>

              <View style={styles.sheetSearchBox}>
                <Search size={15} color="#9CA3AF" />
                <TextInput
                  style={styles.sheetSearchInput}
                  placeholder="Search categories..."
                  placeholderTextColor="#6B7280"
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
                          <CategoryIcon masterCategory={master} size={16} color="#1CC29F" />
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
                                  color={isSelected ? '#1CC29F' : '#9CA3AF'}
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
    backgroundColor: '#18191B', // Splitwise Authentic Dark Canvas
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  navBtn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  formContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  recipientPrefix: {
    fontSize: 14,
    color: '#9CA3AF',
    marginRight: 8,
  },
  recipientPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#222427',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  recipientIconCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(28, 194, 159, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  inputIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#222427',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyIconBoxText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  descriptionUnderlineWrap: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
    paddingBottom: 6,
  },
  descriptionInput: {
    fontSize: 17,
    fontWeight: '500',
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  amountUnderlineWrap: {
    flex: 1,
    borderBottomWidth: 2,
    borderBottomColor: '#1CC29F', // Signature Splitwise Mint Underline
    paddingBottom: 4,
  },
  amountInput: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  aiSuggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(28, 194, 159, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(28, 194, 159, 0.25)',
    alignSelf: 'flex-start',
  },
  aiSuggestionText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  conversationalBlock: {
    marginTop: 10,
    alignItems: 'center',
    gap: 6,
  },
  conversationalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  conversationalText: {
    fontSize: 15,
    color: '#9CA3AF',
  },
  sentenceChip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    backgroundColor: '#222427',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 4,
  },
  sentenceChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  netShareSummaryText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  notesBox: {
    marginTop: 6,
    backgroundColor: '#222427',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  notesInput: {
    fontSize: 14,
    color: '#FFFFFF',
    minHeight: 50,
  },
  keyboardAccessoryToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#18191B',
  },
  toolbarGroupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolbarGroupName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    maxWidth: 140,
  },
  toolbarIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  toolbarActionBtn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarActionBtnActive: {
    backgroundColor: 'rgba(28, 194, 159, 0.15)',
    borderRadius: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#222427',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  sheetSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#18191B',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 14,
  },
  sheetSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    padding: 0,
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  categoryGroupTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
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
    backgroundColor: '#18191B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  categoryChoiceActive: {
    borderColor: '#1CC29F',
    backgroundColor: 'rgba(28, 194, 159, 0.12)',
  },
  categoryChoiceText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  categoryChoiceTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
