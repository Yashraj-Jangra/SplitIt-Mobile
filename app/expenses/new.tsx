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

// Category icons map
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
  const [userOverriddenCategory, setUserOverriddenCategory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Payer & Split Mode State
  const [payerType, setPayerType] = useState<'single' | 'multiple'>('single');
  const [singlePayerId, setSinglePayerId] = useState('u1');
  const [splitMode, setSplitMode] = useState<'equally' | 'unequally' | 'shares' | 'percentage'>('equally');

  // Modals State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showPayerModal, setShowPayerModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');

  // Participants
  const [participants, setParticipants] = useState<Participant[]>([
    {
      id: 'u1',
      name: 'You',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120&auto=format&fit=crop',
      selected: true,
      shares: 1,
      percentage: 33.33,
    },
    {
      id: 'u2',
      name: 'Rohit Sharma',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=120&auto=format&fit=crop',
      selected: true,
      shares: 1,
      percentage: 33.33,
    },
    {
      id: 'u3',
      name: 'Priya Patel',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=120&auto=format&fit=crop',
      selected: true,
      shares: 1,
      percentage: 33.34,
    },
  ]);

  // Parameters hydration
  useEffect(() => {
    if (params.amount) setAmount(params.amount);
    if (params.description) setDescription(params.description);
    if (params.category) setCategory(params.category);
  }, [params.amount, params.description, params.category]);

  // Real-time AI classification from @splitit/core
  const predictedCategory = useMemo(() => {
    if (!description.trim()) return null;
    return classifyExpense(description, defaultExpenseCategories);
  }, [description]);

  // Auto-apply AI suggestion if user hasn't explicitly selected one
  useEffect(() => {
    if (predictedCategory && !userOverriddenCategory) {
      setCategory(predictedCategory.sub);
      setMasterCategory(predictedCategory.master);
    }
  }, [predictedCategory, userOverriddenCategory]);

  // Toggle participant
  const toggleParticipant = (id: string) => {
    Haptics.selectionAsync();
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p))
    );
  };

  // Live split calculation using @splitit/core
  const numAmount = parseFloat(amount) || 0;
  const selectedParticipants = participants.filter((p) => p.selected);

  const splitBreakdown = useMemo(() => {
    if (numAmount <= 0 || selectedParticipants.length === 0) return {};
    const coreSplitType =
      splitMode === 'shares'
        ? 'by_shares'
        : splitMode === 'percentage'
        ? 'by_percentage'
        : splitMode;

    const results = calculateSplitAmounts(
      numAmount,
      selectedParticipants.map((p) => ({
        userId: p.id,
        selected: true,
        shares: p.shares || 1,
        percentage: p.percentage || 100 / selectedParticipants.length,
      })),
      coreSplitType
    );

    return Object.fromEntries(results.map((r) => [r.userId, r.amountOwed]));
  }, [numAmount, selectedParticipants, splitMode]);

  // Dynamic summary sentence
  const payerName = singlePayerId === 'u1' ? 'you' : participants.find((p) => p.id === singlePayerId)?.name || 'Member';
  const splitText = splitMode.replace('_', ' ');

  const summarySubtitle = useMemo(() => {
    if (numAmount <= 0) return 'Enter an amount to see your share.';
    if (selectedParticipants.length === 0) return 'Select at least one participant to split with.';

    const youPaid = singlePayerId === 'u1' ? numAmount : 0;
    const youOwe = splitBreakdown['u1'] || 0;
    const net = youPaid - youOwe;

    if (Math.abs(net) < 0.01) return 'You are all square.';
    if (net > 0) return `You get back ₹${net.toFixed(2)}`;
    return `You owe ₹${Math.abs(net).toFixed(2)}`;
  }, [numAmount, selectedParticipants, singlePayerId, splitBreakdown]);

  const CategoryIconComponent = CATEGORY_ICONS[masterCategory] || Wallet;

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
    }, 400);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              router.back();
            }}
            style={styles.headerCloseBtn}
          >
            <X size={20} color={THEME.colors.textSecondary} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Add an expense</Text>

          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/ai/scanner');
              }}
              style={styles.scanButton}
              activeOpacity={0.8}
            >
              <Camera size={15} color={THEME.colors.primary} />
              <Text style={styles.scanButtonText}>Scan</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              style={styles.saveHeaderBtn}
              activeOpacity={0.8}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#09090B" />
              ) : (
                <Check size={18} color="#09090B" strokeWidth={2.5} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Main Hero Form Block: Category Tile on Left, Inputs on Right */}
          <View style={styles.heroRow}>
            {/* Category Square Tile */}
            <TouchableOpacity
              style={styles.categoryTile}
              onPress={() => {
                Haptics.selectionAsync();
                setShowCategoryModal(true);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.categoryIconCircle}>
                <CategoryIconComponent size={24} color={THEME.colors.primaryLight} />
              </View>
              <Text style={styles.categoryTileLabel} numberOfLines={1}>
                {category}
              </Text>
            </TouchableOpacity>

            {/* Description & Hero Amount Column */}
            <View style={styles.inputsColumn}>
              {/* Description Input */}
              <TextInput
                style={styles.descriptionInput}
                value={description}
                onChangeText={setDescription}
                placeholder="Description"
                placeholderTextColor={THEME.colors.textMuted}
                autoCapitalize="sentences"
                returnKeyType="next"
              />

              {/* AI Category Suggestion Pill */}
              {predictedCategory && predictedCategory.sub !== category && (
                <TouchableOpacity
                  style={styles.aiPill}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setCategory(predictedCategory.sub);
                    setMasterCategory(predictedCategory.master);
                    setUserOverriddenCategory(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Sparkles size={12} color={THEME.colors.aiLight} />
                  <Text style={styles.aiPillText}>
                    Category: <Text style={{ fontWeight: '800', color: '#FFFFFF' }}>{predictedCategory.sub}</Text>
                  </Text>
                </TouchableOpacity>
              )}

              {/* Clamped Hero Amount Input */}
              <View style={styles.amountInputRow}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput
                  style={styles.amountHeroInput}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  placeholderTextColor={THEME.colors.textMuted}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          {/* Interactive Summary Row */}
          <View style={styles.summaryCard}>
            <View style={styles.summarySentenceRow}>
              <Text style={styles.summarySentence}>Paid by </Text>
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowPayerModal(true);
                }}
                style={styles.summaryLinkBtn}
              >
                <Text style={styles.summaryLinkText}>{payerName}</Text>
              </TouchableOpacity>
              <Text style={styles.summarySentence}> and split </Text>
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowSplitModal(true);
                }}
                style={styles.summaryLinkBtn}
              >
                <Text style={styles.summaryLinkText}>{splitText}</Text>
              </TouchableOpacity>
              <Text style={styles.summarySentence}>.</Text>
            </View>
            <Text style={styles.summarySubtitle}>({summarySubtitle})</Text>
          </View>

          {/* "Split with" Horizontal Participant Avatar Selector */}
          <View style={styles.participantsSection}>
            <Text style={styles.sectionTitle}>SPLIT WITH</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.avatarScrollRow}
            >
              {participants.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.participantItem, !p.selected && styles.participantItemUnselected]}
                  onPress={() => toggleParticipant(p.id)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.avatarBorderRing,
                      p.selected && styles.avatarBorderRingActive,
                    ]}
                  >
                    <Image source={{ uri: p.avatarUrl }} style={styles.avatarImg} />
                    {p.selected && (
                      <View style={styles.checkBadge}>
                        <Check size={9} color="#09090B" strokeWidth={3} />
                      </View>
                    )}
                  </View>
                  <Text style={[styles.avatarNameText, !p.selected && styles.avatarNameTextDimmed]} numberOfLines={1}>
                    {p.name.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Date & Notes Inputs */}
          <View style={styles.metaInputsRow}>
            {/* Date Button */}
            <TouchableOpacity style={styles.metaBtn} activeOpacity={0.8}>
              <Calendar size={16} color={THEME.colors.textMuted} />
              <Text style={styles.metaBtnText}>{date}</Text>
            </TouchableOpacity>

            {/* Notes Input */}
            <View style={styles.notesContainer}>
              <FileText size={16} color={THEME.colors.textMuted} style={{ marginRight: 6 }} />
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add notes..."
                placeholderTextColor={THEME.colors.textMuted}
              />
            </View>
          </View>

          {/* Live Split Breakdown Card (Calculated with @splitit/core) */}
          <View style={styles.splitBreakdownCard}>
            <View style={styles.breakdownHeader}>
              <Text style={styles.breakdownTitle}>SPLIT BREAKDOWN</Text>
              <Text style={styles.breakdownSub}>Calculated via @splitit/core</Text>
            </View>

            {selectedParticipants.map((p) => {
              const share = splitBreakdown[p.id] || 0;
              return (
                <View key={p.id} style={styles.breakdownRow}>
                  <View style={styles.breakdownUserRow}>
                    <Image source={{ uri: p.avatarUrl }} style={styles.breakdownAvatar} />
                    <Text style={styles.breakdownUserName}>{p.name}</Text>
                  </View>
                  <Text style={styles.breakdownAmount}>₹{share.toFixed(2)}</Text>
                </View>
              );
            })}
          </View>

          {/* Bottom Action Buttons */}
          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              activeOpacity={0.8}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#09090B" />
              ) : (
                <>
                  <Check size={18} color="#09090B" strokeWidth={2.5} />
                  <Text style={styles.saveBtnText}>Save Expense</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* MODAL 1: CATEGORY SELECTION SHEET */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <X size={20} color={THEME.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Category Search */}
            <View style={styles.categorySearchBox}>
              <Search size={16} color={THEME.colors.textMuted} />
              <TextInput
                style={styles.categorySearchInput}
                placeholder="Search categories..."
                placeholderTextColor={THEME.colors.textMuted}
                value={categorySearch}
                onChangeText={setCategorySearch}
              />
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              {Object.entries(defaultExpenseCategories)
                .filter(([master, details]) => {
                  if (!categorySearch.trim()) return true;
                  const search = categorySearch.toLowerCase();
                  return (
                    master.toLowerCase().includes(search) ||
                    Object.keys(details.subCategories).some((s) => s.toLowerCase().includes(search))
                  );
                })
                .map(([master, details]) => (
                  <View key={master} style={styles.categoryGroup}>
                    <Text style={styles.categoryGroupTitle}>{master}</Text>
                    <View style={styles.categoryGrid}>
                      {Object.keys(details.subCategories).map((sub) => {
                        const IconComponent = CATEGORY_ICONS[master] || Wallet;
                        const isSelected = category === sub;
                        return (
                          <TouchableOpacity
                            key={sub}
                            style={[styles.categoryOption, isSelected && styles.categoryOptionActive]}
                            onPress={() => {
                              Haptics.selectionAsync();
                              setCategory(sub);
                              setMasterCategory(master);
                              setUserOverriddenCategory(true);
                              setShowCategoryModal(false);
                            }}
                          >
                            <IconComponent
                              size={16}
                              color={isSelected ? THEME.colors.primary : THEME.colors.textSecondary}
                            />
                            <Text
                              style={[
                                styles.categoryOptionText,
                                isSelected && styles.categoryOptionTextActive,
                              ]}
                            >
                              {sub}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: PAYER SELECTION SHEET */}
      <Modal
        visible={showPayerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPayerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Who Paid for this?</Text>
              <TouchableOpacity onPress={() => setShowPayerModal(false)}>
                <X size={20} color={THEME.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {participants.map((p) => {
                const isSelected = singlePayerId === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.payerOptionRow, isSelected && styles.payerOptionRowActive]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSinglePayerId(p.id);
                      setShowPayerModal(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Image source={{ uri: p.avatarUrl }} style={styles.payerAvatar} />
                      <Text style={styles.payerOptionName}>{p.name}</Text>
                    </View>
                    {isSelected && <Check size={18} color={THEME.colors.primary} strokeWidth={2.5} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: SPLIT METHOD SHEET */}
      <Modal
        visible={showSplitModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSplitModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Split Method</Text>
              <TouchableOpacity onPress={() => setShowSplitModal(false)}>
                <X size={20} color={THEME.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 8, paddingBottom: 16 }}>
              {[
                { id: 'equally', title: 'Equally', desc: 'Split the total expense evenly among everyone' },
                { id: 'unequally', title: 'Unequally', desc: 'Specify exact unequal amounts per person' },
                { id: 'shares', title: 'By Shares', desc: 'Assign relative weight portions (e.g. 1 share, 2 shares)' },
                { id: 'percentage', title: 'By Percentage', desc: 'Split by custom percentage (must sum to 100%)' },
              ].map((item) => {
                const isSelected = splitMode === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.splitModeCard, isSelected && styles.splitModeCardActive]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSplitMode(item.id as any);
                      setShowSplitModal(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.splitModeTitle, isSelected && { color: THEME.colors.primary }]}>
                        {item.title}
                      </Text>
                      <Text style={styles.splitModeDesc}>{item.desc}</Text>
                    </View>
                    {isSelected && <Check size={18} color={THEME.colors.primary} strokeWidth={2.5} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  headerCloseBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  scanButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  saveHeaderBtn: {
    backgroundColor: THEME.colors.primary,
    padding: 7,
    borderRadius: THEME.radius.md,
  },
  content: {
    padding: 18,
    gap: 18,
    paddingBottom: 40,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  categoryTile: {
    width: 68,
    height: 76,
    backgroundColor: THEME.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    gap: 4,
  },
  categoryIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTileLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  inputsColumn: {
    flex: 1,
    gap: 8,
  },
  descriptionInput: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.text,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    paddingVertical: 4,
  },
  aiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
  },
  aiPillText: {
    fontSize: 11,
    color: THEME.colors.aiLight,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    borderBottomWidth: 2,
    borderBottomColor: THEME.colors.borderFocus,
    paddingVertical: 2,
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: '900',
    color: THEME.colors.textMuted,
    marginRight: 6,
  },
  amountHeroInput: {
    flex: 1,
    fontSize: 36,
    fontWeight: '900',
    color: THEME.colors.text,
    padding: 0,
  },
  summaryCard: {
    backgroundColor: THEME.colors.surface,
    padding: 14,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: 4,
  },
  summarySentenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  summarySentence: {
    fontSize: 14,
    color: THEME.colors.text,
  },
  summaryLinkBtn: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.primary,
    paddingBottom: 1,
  },
  summaryLinkText: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.primary,
  },
  summarySubtitle: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  participantsSection: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: THEME.colors.textMuted,
  },
  avatarScrollRow: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 4,
  },
  participantItem: {
    alignItems: 'center',
    gap: 6,
  },
  participantItemUnselected: {
    opacity: 0.35,
  },
  avatarBorderRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 2,
    position: 'relative',
  },
  avatarBorderRingActive: {
    borderColor: THEME.colors.primary,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  checkBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: THEME.colors.background,
  },
  avatarNameText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  avatarNameTextDimmed: {
    color: THEME.colors.textMuted,
  },
  metaInputsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metaBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  metaBtnText: {
    fontSize: 13,
    color: THEME.colors.text,
    fontWeight: '600',
  },
  notesContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  notesInput: {
    flex: 1,
    height: '100%',
    color: THEME.colors.text,
    fontSize: 13,
  },
  splitBreakdownCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 14,
    gap: 10,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    paddingBottom: 8,
  },
  breakdownTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: THEME.colors.textMuted,
  },
  breakdownSub: {
    fontSize: 10,
    color: THEME.colors.textMuted,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  breakdownUserName: {
    fontSize: 13,
    color: THEME.colors.text,
    fontWeight: '600',
  },
  breakdownAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  saveBtn: {
    flex: 2,
    height: 44,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#09090B',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  categorySearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  categorySearchInput: {
    flex: 1,
    color: THEME.colors.text,
    fontSize: 13,
  },
  categoryGroup: {
    marginBottom: 14,
  },
  categoryGroupTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: THEME.colors.textMuted,
    marginBottom: 8,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  categoryOptionActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  categoryOptionText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  categoryOptionTextActive: {
    color: THEME.colors.primaryLight,
    fontWeight: '700',
  },
  payerOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  payerOptionRowActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  payerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  payerOptionName: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  splitModeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.surfaceElevated,
    padding: 14,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  splitModeCardActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  splitModeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  splitModeDesc: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
});
