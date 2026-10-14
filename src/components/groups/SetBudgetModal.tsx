import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import {
  X,
  Sliders,
  Bell,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Trash2,
  Check,
  Zap,
} from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { groupService, GroupBudget } from '../../services/group.service';
import { haptics } from '../../services/haptics.service';
import { MASTER_CATEGORY_ICONS } from '../../utils/category-icons';
import { CURRENCY_SYMBOL } from '../../utils/budget-utils';

interface SetBudgetModalProps {
  visible: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  initialBudget?: GroupBudget;
  onSuccess: () => void;
}

const QUICK_PRESETS = [10000, 25000, 50000, 100000];

interface MasterCategoryDef {
  key: string;
  name: string;
  color: string;
}

const MASTER_CATEGORIES: MasterCategoryDef[] = [
  { key: 'Food and Drink', name: 'Food & Drink', color: THEME.colors.categories.food },
  { key: 'Transportation', name: 'Transportation', color: THEME.colors.categories.transportation },
  { key: 'Housing', name: 'Housing', color: THEME.colors.categories.housing },
  { key: 'Utilities', name: 'Utilities', color: THEME.colors.categories.utilities },
  { key: 'Entertainment', name: 'Entertainment', color: THEME.colors.categories.entertainment },
  { key: 'Shopping', name: 'Shopping', color: THEME.colors.categories.shopping },
  { key: 'Health and Wellness', name: 'Health & Wellness', color: THEME.colors.categories.health },
  { key: 'Personal Care', name: 'Personal Care', color: THEME.colors.categories.personal },
  { key: 'Education', name: 'Education', color: THEME.colors.categories.education },
  { key: 'Gifts and Donations', name: 'Gifts & Donations', color: THEME.colors.categories.gifts },
  { key: 'Travel', name: 'Travel', color: THEME.colors.categories.travel },
  { key: 'Other', name: 'Miscellaneous', color: THEME.colors.categories.other },
];

const SetBudgetContent: React.FC<SetBudgetModalProps> = ({
  visible,
  onClose,
  groupId,
  groupName,
  initialBudget,
  onSuccess,
}) => {
  const initialLimit = Number(initialBudget?.monthlyLimit ?? initialBudget?.totalMonthlyLimit ?? 25000);
  const [monthlyLimitStr, setMonthlyLimitStr] = useState<string>(initialLimit > 0 ? String(initialLimit) : '25000');

  const defaultThresholds = initialBudget?.alertThresholds || [75, 90, 100];
  const [threshold75, setThreshold75] = useState<boolean>(defaultThresholds.includes(75));
  const [threshold90, setThreshold90] = useState<boolean>(defaultThresholds.includes(90));
  const [threshold100, setThreshold100] = useState<boolean>(defaultThresholds.includes(100));

  const initialCatLimits = useMemo(() => {
    const existingCats: Record<string, string> = {};
    if (initialBudget?.categoryLimits) {
      Object.entries(initialBudget.categoryLimits).forEach(([k, v]) => {
        if (Number(v) > 0) {
          existingCats[k] = String(v);
        }
      });
    }
    return existingCats;
  }, [initialBudget]);

  const [categoryLimits, setCategoryLimits] = useState<Record<string, string>>(initialCatLimits);
  const [isCategoryExpanded, setIsCategoryExpanded] = useState<boolean>(
    Object.keys(initialCatLimits).length > 0
  );
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const monthlyLimitNum = useMemo(() => {
    const cleaned = monthlyLimitStr.replace(/[^0-9]/g, '');
    return cleaned ? parseInt(cleaned, 10) : 0;
  }, [monthlyLimitStr]);

  // Compute category allocations sum
  const categoryAllocations = useMemo(() => {
    let sum = 0;
    Object.values(categoryLimits).forEach((val) => {
      const num = parseInt(val.replace(/[^0-9]/g, ''), 10) || 0;
      sum += num;
    });
    return {
      sum,
      isOverTotal: monthlyLimitNum > 0 && sum > monthlyLimitNum,
      diff: sum - monthlyLimitNum,
    };
  }, [categoryLimits, monthlyLimitNum]);

  const handlePresetSelect = (preset: number) => {
    haptics.tap();
    setMonthlyLimitStr(String(preset));
  };

  const handleCategoryLimitChange = (key: string, val: string) => {
    const cleaned = val.replace(/[^0-9]/g, '');
    setCategoryLimits((prev) => {
      const copy = { ...prev };
      if (!cleaned || parseInt(cleaned, 10) === 0) {
        delete copy[key];
      } else {
        copy[key] = cleaned;
      }
      return copy;
    });
  };

  const handleAutoSumToTotal = () => {
    if (categoryAllocations.sum > 0) {
      haptics.confirm();
      setMonthlyLimitStr(String(categoryAllocations.sum));
    }
  };

  const handleSave = async () => {
    if (monthlyLimitNum < 100) {
      haptics.warning();
      Alert.alert('Invalid Budget', 'Please enter a monthly limit of at least ₹100.');
      return;
    }

    if (categoryAllocations.isOverTotal) {
      haptics.warning();
      Alert.alert(
        'Category Allocation Error',
        `Total category caps (${CURRENCY_SYMBOL}${categoryAllocations.sum.toLocaleString('en-IN')}) cannot exceed the monthly limit (${CURRENCY_SYMBOL}${monthlyLimitNum.toLocaleString('en-IN')}).`
      );
      return;
    }

    setIsSaving(true);
    haptics.confirm();

    try {
      const alertThresholds: number[] = [];
      if (threshold75) alertThresholds.push(75);
      if (threshold90) alertThresholds.push(90);
      if (threshold100) alertThresholds.push(100);

      const parsedCategoryLimits: Record<string, number> = {};
      Object.entries(categoryLimits).forEach(([cat, val]) => {
        const num = parseInt(val.replace(/[^0-9]/g, ''), 10) || 0;
        if (num > 0) {
          parsedCategoryLimits[cat] = num;
        }
      });

      const budgetPayload: GroupBudget = {
        monthlyLimit: monthlyLimitNum,
        enabled: true,
        alertThresholds,
        categoryLimits: Object.keys(parsedCategoryLimits).length > 0 ? parsedCategoryLimits : undefined,
        totalMonthlyLimit: monthlyLimitNum,
      };

      await groupService.updateGroupBudget(groupId, budgetPayload);
      haptics.saveSuccess();
      onSuccess();
      onClose();
    } catch (err: any) {
      haptics.error();
      Alert.alert('Error', err?.message || 'Failed to save group budget.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisableBudget = () => {
    haptics.warning();
    Alert.alert(
      'Disable Budget?',
      `Are you sure you want to turn off monthly budget tracking for ${groupName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable Budget',
          style: 'destructive',
          onPress: async () => {
            setIsSaving(true);
            try {
              await groupService.updateGroupBudget(groupId, {
                monthlyLimit: 0,
                enabled: false,
                totalMonthlyLimit: 0,
              });
              haptics.confirm();
              onSuccess();
              onClose();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to disable budget.');
            } finally {
              setIsSaving(false);
            }
          },
        },
      ]
    );
  };

  const hasExistingBudget = Boolean(initialBudget && (initialBudget.monthlyLimit > 0 || (initialBudget.totalMonthlyLimit ?? 0) > 0));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}
        >
          <View style={styles.sheetContainer}>
            {/* Top Drag Handle */}
            <View style={styles.handleWrap}>
              <View style={styles.handleBar} />
            </View>

            {/* Header */}
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <View style={styles.headerIconWrap}>
                  <Sliders size={18} color={THEME.colors.primary} />
                </View>
                <View>
                  <Text style={styles.headerTitle}>
                    {hasExistingBudget ? 'Edit Monthly Budget' : 'Set Monthly Budget'}
                  </Text>
                  <Text style={styles.headerSubtitle} numberOfLines={1}>
                    {groupName}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => {
                  haptics.tap();
                  onClose();
                }}
                style={styles.closeBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={THEME.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scrollBody}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* SECTION: Hero Amount Input */}
              <View style={styles.inputSection}>
                <Text style={styles.sectionLabel}>TOTAL MONTHLY LIMIT</Text>
                <View style={styles.amountInputRow}>
                  <Text style={styles.currencyPrefix}>{CURRENCY_SYMBOL}</Text>
                  <TextInput
                    style={styles.heroAmountInput}
                    value={monthlyLimitStr}
                    onChangeText={(val) => setMonthlyLimitStr(val.replace(/[^0-9]/g, ''))}
                    placeholder="25,000"
                    placeholderTextColor={THEME.colors.textMuted}
                    keyboardType="numeric"
                    selectionColor={THEME.colors.primary}
                    maxLength={9}
                  />
                </View>

                {/* Quick Preset Chips */}
                <View style={styles.presetsRow}>
                  {QUICK_PRESETS.map((preset) => {
                    const isSelected = monthlyLimitNum === preset;
                    return (
                      <TouchableOpacity
                        key={preset}
                        style={[
                          styles.presetChip,
                          isSelected && styles.presetChipActive,
                        ]}
                        onPress={() => handlePresetSelect(preset)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.presetChipText,
                            isSelected && styles.presetChipTextActive,
                          ]}
                        >
                          {CURRENCY_SYMBOL}{(preset / 1000).toFixed(0)}k
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* SECTION: Alert Thresholds */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Bell size={15} color={THEME.colors.primary} />
                  <Text style={styles.sectionLabelInline}>AUTOMATED ALERTS</Text>
                </View>
                <Text style={styles.sectionSubtext}>
                  Instant pacing notifications are dispatched when shared expenses reach these thresholds.
                </Text>

                <View style={styles.thresholdsList}>
                  {/* 75% Caution */}
                  <View style={styles.thresholdRow}>
                    <View style={styles.thresholdInfo}>
                      <View style={[styles.thresholdDot, { backgroundColor: THEME.colors.warning }]} />
                      <View>
                        <Text style={styles.thresholdTitle}>75% Caution Alert</Text>
                        <Text style={styles.thresholdDesc}>Notify group when spend crosses 75%</Text>
                      </View>
                    </View>
                    <Switch
                      value={threshold75}
                      onValueChange={(val) => {
                        haptics.tick();
                        setThreshold75(val);
                      }}
                      trackColor={{ false: 'rgba(255, 255, 255, 0.12)', true: THEME.colors.primary }}
                      thumbColor={THEME.colors.text}
                    />
                  </View>

                  {/* 90% Warning */}
                  <View style={[styles.thresholdRow, styles.thresholdRowBorder]}>
                    <View style={styles.thresholdInfo}>
                      <View style={[styles.thresholdDot, { backgroundColor: THEME.colors.notification.member }]} />
                      <View>
                        <Text style={styles.thresholdTitle}>90% High Burn Alert</Text>
                        <Text style={styles.thresholdDesc}>Urgent warning to preserve daily allowance</Text>
                      </View>
                    </View>
                    <Switch
                      value={threshold90}
                      onValueChange={(val) => {
                        haptics.tick();
                        setThreshold90(val);
                      }}
                      trackColor={{ false: 'rgba(255, 255, 255, 0.12)', true: THEME.colors.primary }}
                      thumbColor={THEME.colors.text}
                    />
                  </View>

                  {/* 100% Overbudget */}
                  <View style={[styles.thresholdRow, styles.thresholdRowBorder]}>
                    <View style={styles.thresholdInfo}>
                      <View style={[styles.thresholdDot, { backgroundColor: THEME.colors.negative }]} />
                      <View>
                        <Text style={styles.thresholdTitle}>100% Over Budget</Text>
                        <Text style={styles.thresholdDesc}>Alert immediately when monthly ceiling breached</Text>
                      </View>
                    </View>
                    <Switch
                      value={threshold100}
                      onValueChange={(val) => {
                        haptics.tick();
                        setThreshold100(val);
                      }}
                      trackColor={{ false: 'rgba(255, 255, 255, 0.12)', true: THEME.colors.primary }}
                      thumbColor={THEME.colors.text}
                    />
                  </View>
                </View>
              </View>

              {/* SECTION: Category Limits (Collapsible) */}
              <View style={styles.sectionCard}>
                <TouchableOpacity
                  style={styles.categoryAccordionHeader}
                  onPress={() => {
                    haptics.tap();
                    setIsCategoryExpanded(!isCategoryExpanded);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.categoryAccordionLeft}>
                    <Zap size={15} color={THEME.colors.primary} />
                    <Text style={styles.sectionLabelInline}>CATEGORY CAPS (OPTIONAL)</Text>
                  </View>

                  <View style={styles.categoryAccordionRight}>
                    {categoryAllocations.sum > 0 && (
                      <View
                        style={[
                          styles.categorySumBadge,
                          categoryAllocations.isOverTotal && styles.categorySumBadgeError,
                        ]}
                      >
                        <Text
                          style={[
                            styles.categorySumBadgeText,
                            categoryAllocations.isOverTotal && styles.categorySumBadgeTextError,
                          ]}
                        >
                          {CURRENCY_SYMBOL}{categoryAllocations.sum.toLocaleString('en-IN')}
                        </Text>
                      </View>
                    )}
                    {isCategoryExpanded ? (
                      <ChevronUp size={18} color={THEME.colors.textSecondary} />
                    ) : (
                      <ChevronDown size={18} color={THEME.colors.textSecondary} />
                    )}
                  </View>
                </TouchableOpacity>

                {isCategoryExpanded && (
                  <View style={styles.categoryListContent}>
                    <Text style={styles.sectionSubtext}>
                      Allocate specific spending ceilings for major categories.
                    </Text>

                    {/* Over-allocation warning banner */}
                    {categoryAllocations.isOverTotal && (
                      <View style={styles.overAllocatedBanner}>
                        <AlertTriangle size={16} color={THEME.colors.negative} style={{ marginTop: 2 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.overAllocatedText}>
                            Categories exceed total by {CURRENCY_SYMBOL}{categoryAllocations.diff.toLocaleString('en-IN')}.
                          </Text>
                          <TouchableOpacity
                            onPress={handleAutoSumToTotal}
                            style={styles.autoAdjustBtn}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.autoAdjustBtnText}>
                              Auto-adjust total to {CURRENCY_SYMBOL}{categoryAllocations.sum.toLocaleString('en-IN')}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    <View style={styles.categoryGrid}>
                      {MASTER_CATEGORIES.map((cat) => {
                        const IconComponent = MASTER_CATEGORY_ICONS[cat.key] || Zap;
                        const currentVal = categoryLimits[cat.key] || '';

                        return (
                          <View key={cat.key} style={styles.categoryInputRow}>
                            <View style={styles.categoryLabelCol}>
                              <View
                                style={[
                                  styles.categoryIconWrap,
                                  { backgroundColor: `${cat.color}20` },
                                ]}
                              >
                                <IconComponent size={14} color={cat.color} />
                              </View>
                              <Text style={styles.categoryNameText} numberOfLines={1}>
                                {cat.name}
                              </Text>
                            </View>

                            <View style={styles.categoryAmountCol}>
                              <Text style={styles.categoryInputPrefix}>{CURRENCY_SYMBOL}</Text>
                              <TextInput
                                style={styles.categoryTextInput}
                                value={currentVal}
                                onChangeText={(val) => handleCategoryLimitChange(cat.key, val)}
                                placeholder="None"
                                placeholderTextColor={THEME.colors.textMuted}
                                keyboardType="numeric"
                                maxLength={7}
                              />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>

              {/* Disable Budget Action */}
              {hasExistingBudget && (
                <TouchableOpacity
                  style={styles.disableBudgetBtn}
                  onPress={handleDisableBudget}
                  activeOpacity={0.7}
                  disabled={isSaving}
                >
                  <Trash2 size={16} color={THEME.colors.negative} />
                  <Text style={styles.disableBudgetText}>Disable Budget Tracking</Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            {/* Footer Buttons */}
            <View style={styles.footerRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  haptics.tap();
                  onClose();
                }}
                disabled={isSaving}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={isSaving}
                activeOpacity={0.8}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={THEME.colors.primaryForeground} />
                ) : (
                  <>
                    <Check size={16} color={THEME.colors.primaryForeground} strokeWidth={2.5} />
                    <Text style={styles.saveBtnText}>Save Budget</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

export const SetBudgetModal: React.FC<SetBudgetModalProps> = (props) => {
  if (!props.visible) return null;
  return <SetBudgetContent {...props} />;
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  keyboardAvoid: {
    width: '100%',
  },
  sheetContainer: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderBottomWidth: 0,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  handleWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: THEME.colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  scrollBody: {
    maxHeight: 520,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 16,
  },
  inputSection: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 6,
  },
  currencyPrefix: {
    fontSize: 28,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    marginRight: 6,
  },
  heroAmountInput: {
    flex: 1,
    fontSize: 34,
    fontWeight: '800',
    color: THEME.colors.text,
    padding: 0,
    margin: 0,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    alignItems: 'center',
  },
  presetChipActive: {
    backgroundColor: THEME.colors.primaryMuted,
    borderColor: THEME.colors.primary,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  presetChipTextActive: {
    color: THEME.colors.primaryLight,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionLabelInline: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
  },
  sectionSubtext: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 4,
    lineHeight: 17,
  },
  thresholdsList: {
    marginTop: 12,
  },
  thresholdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  thresholdRowBorder: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
  },
  thresholdInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  thresholdDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  thresholdTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  thresholdDesc: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  categoryAccordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryAccordionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryAccordionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categorySumBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: THEME.colors.primaryMuted,
  },
  categorySumBadgeError: {
    backgroundColor: THEME.colors.negativeMuted,
  },
  categorySumBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.primaryLight,
  },
  categorySumBadgeTextError: {
    color: THEME.colors.negativeLight,
  },
  categoryListContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
  },
  overAllocatedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: THEME.colors.negativeMuted,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    marginTop: 8,
    marginBottom: 10,
  },
  overAllocatedText: {
    fontSize: 12,
    color: THEME.colors.negativeLight,
    fontWeight: '600',
  },
  autoAdjustBtn: {
    marginTop: 4,
  },
  autoAdjustBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.text,
    textDecorationLine: 'underline',
  },
  categoryGrid: {
    marginTop: 8,
    gap: 8,
  },
  categoryInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  categoryLabelCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  categoryIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryNameText: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.text,
  },
  categoryAmountCol: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 90,
    backgroundColor: THEME.colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 8,
  },
  categoryInputPrefix: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
    marginRight: 2,
  },
  categoryTextInput: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.text,
    paddingVertical: 4,
    paddingHorizontal: 0,
    textAlign: 'right',
  },
  disableBudgetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    backgroundColor: 'rgba(244, 63, 94, 0.06)',
  },
  disableBudgetText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.negative,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: THEME.colors.primary,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.primaryForeground,
  },
});
