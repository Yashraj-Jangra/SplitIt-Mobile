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
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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
  User,
  Wallet,
  Utensils,
  Car,
  ShoppingBag,
  Film,
  Home,
  Zap,
  Heart,
  Plane,
  ChevronDown,
  Search,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import {
  calculateSplitAmounts,
  classifyExpense,
  defaultExpenseCategories,
} from '@splitit/core';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CATEGORY_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  'Food and Drink': Utensils,
  'Transportation': Car,
  'Entertainment': Film,
  'Home': Home,
  'Utilities': Zap,
  'Personal Care': Heart,
  'Shopping': ShoppingBag,
  'Travel': Plane,
  'Other': Wallet,
};

interface Participant {
  id: string;
  name: string;
  avatarUrl?: string;
  selected: boolean;
  shares?: number;
  percentage?: number;
  exactAmount?: number;
}

export default function NewExpenseModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    amount?: string;
    description?: string;
    category?: string;
    groupId?: string;
  }>();

  // Form State
  const [amount, setAmount] = useState(params.amount || '');
  const [description, setDescription] = useState(params.description || '');
  const [category, setCategory] = useState(params.category || 'Dining Out');
  const [masterCategory, setMasterCategory] = useState('Food and Drink');
  const [date, setDate] = useState('Today, Oct 6');
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [userOverriddenCategory, setUserOverriddenCategory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Payer & Split Mode State
  const [singlePayerId, setSinglePayerId] = useState('u1');
  const [splitMode, setSplitMode] = useState<'equally' | 'unequally' | 'shares' | 'percentage'>('equally');

  // Modals State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showPayerModal, setShowPayerModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');

  // Participants State
  const [participants, setParticipants] = useState<Participant[]>([
    { id: 'u1', name: 'You', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120&auto=format&fit=crop', selected: true, shares: 1 },
    { id: 'u2', name: 'Rohit Sharma', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=120&auto=format&fit=crop', selected: true, shares: 1 },
    { id: 'u3', name: 'Priya Patel', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=120&auto=format&fit=crop', selected: true, shares: 1 },
    { id: 'u4', name: 'Aman Verma', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=120&auto=format&fit=crop', selected: true, shares: 1 },
  ]);

  // AI Classification on description change
  useEffect(() => {
    if (description.trim().length >= 3 && !userOverriddenCategory) {
      const predicted = classifyExpense(description, defaultExpenseCategories);
      if (predicted && predicted.sub) {
        setCategory(predicted.sub);
        setMasterCategory(predicted.master);
      }
    }
  }, [description, userOverriddenCategory]);

  const predictedCategory = useMemo(() => {
    if (description.trim().length >= 3) {
      return classifyExpense(description, defaultExpenseCategories);
    }
    return null;
  }, [description]);

  const selectedParticipants = useMemo(
    () => participants.filter((p) => p.selected),
    [participants]
  );

  const numAmount = parseFloat(amount) || 0;

  // Split calculation via @splitit/core
  const splitBreakdown = useMemo<Record<string, number>>(() => {
    if (numAmount <= 0 || selectedParticipants.length === 0) return {};

    try {
      const inputs = selectedParticipants.map((p) => ({
        userId: p.id,
        selected: true,
        shares: p.shares || 1,
        percentage: p.percentage || 100 / selectedParticipants.length,
        amountOwed: p.exactAmount || numAmount / selectedParticipants.length,
      }));
      const results = calculateSplitAmounts(numAmount, inputs, splitMode as any);
      const breakdown: Record<string, number> = {};
      results.forEach((r) => {
        breakdown[r.userId] = r.amountOwed;
      });
      return breakdown;
    } catch {
      const share = numAmount / selectedParticipants.length;
      return Object.fromEntries(selectedParticipants.map((p) => [p.id, share]));
    }
  }, [numAmount, selectedParticipants, splitMode]);

  const payerName = singlePayerId === 'u1' ? 'You' : participants.find((p) => p.id === singlePayerId)?.name || 'Someone';

  const handleToggleParticipant = (id: string) => {
    Haptics.selectionAsync();
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p))
    );
  };

  const handleSave = () => {
    if (!description.trim() || numAmount <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setIsSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => {
      setIsSaving(false);
      router.back();
    }, 350);
  };

  const CategoryIconComponent = CATEGORY_ICONS[masterCategory] || Wallet;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Minimalist Top Header */}
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
            <Camera size={16} color={THEME.colors.primary} />
            <Text style={styles.scanBtnText}>Scan</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Revolut / Cash App Style Centered Amount Display */}
          <View style={styles.amountHeroBlock}>
            <View style={styles.amountDisplayRow}>
              <Text style={styles.currencyPrefix}>₹</Text>
              <TextInput
                style={styles.amountBigInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor={THEME.colors.textMuted}
                keyboardType="numeric"
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
              <Text style={styles.sentenceTriggerText}>{payerName}</Text>
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
              <Text style={styles.sentenceTriggerText}>
                {splitMode === 'equally' ? 'Equally' : splitMode.charAt(0).toUpperCase() + splitMode.slice(1)}
              </Text>
              <ChevronDown size={13} color={THEME.colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Member Participant Rings (Tap to Toggle Inclusion) */}
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

          {/* Inline Action Pills: Category, Date, Notes */}
          <View style={styles.metaPillsRow}>
            <TouchableOpacity
              style={styles.metaPill}
              onPress={() => {
                Haptics.selectionAsync();
                setShowCategoryModal(true);
              }}
              activeOpacity={0.7}
            >
              <CategoryIconComponent size={14} color={THEME.colors.textSecondary} />
              <Text style={styles.metaPillText}>{category}</Text>
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
              <FileText size={14} color={THEME.colors.textSecondary} />
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
        <Modal visible={showPayerModal} transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowPayerModal(false)}
          >
            <View style={styles.sheetContainer}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Who paid for this?</Text>
              {participants.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.sheetOptionRow, singlePayerId === p.id && styles.sheetOptionActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSinglePayerId(p.id);
                    setShowPayerModal(false);
                  }}
                >
                  <Image source={{ uri: p.avatarUrl }} style={styles.sheetAvatar} />
                  <Text style={styles.sheetOptionText}>{p.name}</Text>
                  {singlePayerId === p.id && <Check size={18} color={THEME.colors.primary} strokeWidth={2.5} />}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* MODAL 2: SPLIT MODE SELECTOR */}
        <Modal visible={showSplitModal} transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowSplitModal(false)}
          >
            <View style={styles.sheetContainer}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>How to split?</Text>
              {[
                { id: 'equally', title: 'Split Equally', desc: 'Divided evenly between selected friends' },
                { id: 'unequally', title: 'Exact Amounts', desc: 'Specify custom amounts for each member' },
                { id: 'percentage', title: 'By Percentage', desc: 'Split by percent (must equal 100%)' },
                { id: 'shares', title: 'By Shares', desc: 'Assign 1, 2, or custom portions' },
              ].map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.sheetOptionRow, splitMode === m.id && styles.sheetOptionActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSplitMode(m.id as any);
                    setShowSplitModal(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetOptionText}>{m.title}</Text>
                    <Text style={styles.sheetOptionSubtext}>{m.desc}</Text>
                  </View>
                  {splitMode === m.id && <Check size={18} color={THEME.colors.primary} strokeWidth={2.5} />}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* MODAL 3: CATEGORY PICKER */}
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
                {Object.entries(defaultExpenseCategories)
                  .filter(([master]) => !categorySearch || master.toLowerCase().includes(categorySearch.toLowerCase()))
                  .map(([master, masterCategoryData]) => {
                    const IconComp = CATEGORY_ICONS[master] || Wallet;
                    const subNames = Object.keys(masterCategoryData.subCategories || {});
                    return (
                      <View key={master} style={{ marginBottom: 16 }}>
                        <View style={styles.categoryHeaderRow}>
                          <IconComp size={16} color={THEME.colors.primaryLight} />
                          <Text style={styles.categoryGroupTitle}>{master}</Text>
                        </View>
                        <View style={styles.categoryPillsWrap}>
                          {subNames.map((sub) => (
                            <TouchableOpacity
                              key={sub}
                              style={[styles.categoryChoicePill, category === sub && styles.categoryChoiceActive]}
                              onPress={() => {
                                Haptics.selectionAsync();
                                setUserOverriddenCategory(true);
                                setCategory(sub);
                                setMasterCategory(master);
                                setShowCategoryModal(false);
                              }}
                            >
                              <Text style={[styles.categoryChoiceText, category === sub && styles.categoryChoiceTextActive]}>
                                {sub}
                              </Text>
                            </TouchableOpacity>
                          ))}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 14,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  scanBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  content: {
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 90,
    gap: 22,
  },

  // Revolut / Cash App Centered Amount Block
  amountHeroBlock: {
    alignItems: 'center',
    paddingVertical: 12,
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
    color: THEME.colors.textSecondary,
    marginTop: 4,
  },
  amountBigInput: {
    fontSize: 52,
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
    marginTop: 10,
    width: '100%',
    paddingVertical: 8,
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
    color: THEME.colors.aiLight,
    fontWeight: '700',
    marginLeft: 4,
  },

  // Sentence Dock
  sentenceDock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  sentenceText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
  },
  sentenceTriggerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
  },
  sentenceTriggerText: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.primary,
  },

  // Participants
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
    borderRadius: 8.5,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#000000',
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
    color: THEME.colors.primaryLight,
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
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.90)',
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
    borderRadius: THEME.radius.xl,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
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
    backgroundColor: '#121215',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 14,
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
    marginBottom: 8,
  },
  sheetOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.lg,
  },
  sheetOptionActive: {
    backgroundColor: THEME.colors.surfaceElevated,
  },
  sheetAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  sheetOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  sheetOptionSubtext: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  sheetSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.colors.surface,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surface,
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
