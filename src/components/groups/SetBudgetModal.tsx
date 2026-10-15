import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  LayoutAnimation,
  UIManager,
  Keyboard,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  Sparkles,
  Info,
  PieChart,
} from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { groupService, GroupBudget } from '../../services/group.service';
import { haptics } from '../../services/haptics.service';
import { MASTER_CATEGORY_ICONS } from '../../utils/category-icons';
import { useCurrency } from '../../contexts/currency.context';

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

const triggerLayoutTransition = () => {
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
};

const SetBudgetContent: React.FC<SetBudgetModalProps> = ({
  visible,
  onClose,
  groupId,
  groupName,
  initialBudget,
  onSuccess,
}) => {
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get('window').height;
  const { currencySymbol } = useCurrency();
  const CURRENCY_SYMBOL = currencySymbol;

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

  // Compute category allocations sum and individual percentages
  const currentTotal = monthlyLimitNum;
  const categoryAllocations = useMemo(() => {
    const list: { cat: MasterCategoryDef; amount: number; pctOfTotal: number }[] = [];
    let sum = 0;
    const total = monthlyLimitNum;

    MASTER_CATEGORIES.forEach((cat) => {
      const val = parseInt((categoryLimits[cat.key] || '').replace(/[^0-9]/g, ''), 10) || 0;
      if (val > 0) {
        sum += val;
        list.push({
          cat,
          amount: val,
          pctOfTotal: total > 0 ? (val / total) * 100 : 0,
        });
      }
    });

    return {
      list,
      sum,
      isOverTotal: total > 0 && sum > total,
      diff: sum - total,
    };
  }, [categoryLimits, monthlyLimitNum]);

  // Flexible Pool calculations
  const unallocatedAmount = Math.max(0, currentTotal - categoryAllocations.sum);
  const unallocatedPct = currentTotal > 0 ? (unallocatedAmount / currentTotal) * 100 : 0;
  const showDistributionGraph =
    categoryAllocations.list.length > 0 || isCategoryExpanded || categoryAllocations.isOverTotal;

  // Auto-fill monthly limit if it was 0 and user enters category caps
  const prevCategorySumRef = useRef(categoryAllocations.sum);
  useEffect(() => {
    if (monthlyLimitNum === 0 && categoryAllocations.sum > 0 && prevCategorySumRef.current !== categoryAllocations.sum) {
      triggerLayoutTransition();
      setMonthlyLimitStr(String(categoryAllocations.sum));
    }
    prevCategorySumRef.current = categoryAllocations.sum;
  }, [categoryAllocations.sum, monthlyLimitNum]);

  const handlePresetSelect = (preset: number) => {
    haptics.tap();
    triggerLayoutTransition();
    setMonthlyLimitStr(String(preset));
  };

  const handleCategoryLimitChange = (key: string, val: string) => {
    triggerLayoutTransition();
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
      triggerLayoutTransition();
      setMonthlyLimitStr(String(categoryAllocations.sum));
    }
  };

  const handleClearAllCategories = () => {
    haptics.tick();
    triggerLayoutTransition();
    setCategoryLimits({});
  };

  const handleSave = async () => {
    if (monthlyLimitNum < 100) {
      haptics.warning();
      Alert.alert('Invalid Budget', `Please enter a monthly limit of at least ${currencySymbol}100.`);
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

  const hasExistingBudget = Boolean(
    initialBudget && (initialBudget.monthlyLimit > 0 || (initialBudget.totalMonthlyLimit ?? 0) > 0)
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        {/* Tap outside backdrop to dismiss */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => {
            Keyboard.dismiss();
            haptics.tap();
            onClose();
          }}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}
          keyboardVerticalOffset={0}
        >
          <View
            style={[
              styles.sheetContainer,
              {
                maxHeight: screenHeight * 0.9,
                paddingBottom: Math.max(insets.bottom, 16) + 12,
              },
            ]}
          >
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
                <View style={{ flex: 1 }}>
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
              style={[styles.scrollBody, { maxHeight: screenHeight * 0.54 }]}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {/* SECTION: Hero Amount Input */}
              <View style={styles.inputSection}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionLabel}>TOTAL MONTHLY LIMIT</Text>
                  {categoryAllocations.sum > 0 && categoryAllocations.sum !== monthlyLimitNum && (
                    <TouchableOpacity
                      style={styles.quickSumBtn}
                      onPress={handleAutoSumToTotal}
                      activeOpacity={0.7}
                    >
                      <Sparkles size={12} color={THEME.colors.primaryLight} />
                      <Text style={styles.quickSumBtnText}>
                        Sum ({CURRENCY_SYMBOL}{categoryAllocations.sum.toLocaleString('en-IN')})
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.amountInputRow}>
                  <Text style={styles.currencyPrefix}>{CURRENCY_SYMBOL}</Text>
                  <TextInput
                    style={styles.heroAmountInput}
                    value={monthlyLimitStr}
                    onChangeText={(val) => {
                      triggerLayoutTransition();
                      setMonthlyLimitStr(val.replace(/[^0-9]/g, ''));
                    }}
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

              {/* SECTION: Live Budget Allocation Bar & Flexible Pool */}
              {showDistributionGraph && (
                <View style={styles.meterContainer}>
                  <View style={styles.meterHeader}>
                    <Text style={styles.meterTitle}>Budget Allocation</Text>
                    <Text
                      style={[
                        styles.meterSubtitle,
                        categoryAllocations.isOverTotal && styles.meterSubtitleError,
                      ]}
                    >
                      {categoryAllocations.isOverTotal
                        ? `Over by ${CURRENCY_SYMBOL}${categoryAllocations.diff.toLocaleString('en-IN')}`
                        : `${CURRENCY_SYMBOL}${categoryAllocations.sum.toLocaleString('en-IN')} capped • ${CURRENCY_SYMBOL}${unallocatedAmount.toLocaleString('en-IN')} flexible pool`}
                    </Text>
                  </View>

                  {/* Multi-segmented Live Track */}
                  <View style={styles.meterTrack}>
                    {categoryAllocations.isOverTotal ? (
                      <View style={styles.meterOverBar} />
                    ) : (
                      <>
                        {categoryAllocations.list.map((item, index) => {
                          const isFirst = index === 0;
                          const isLast =
                            index === categoryAllocations.list.length - 1 && unallocatedAmount <= 0;
                          return (
                            <View
                              key={item.cat.key}
                              style={[
                                styles.meterSegment,
                                {
                                  flex: item.amount,
                                  backgroundColor: item.cat.color,
                                  borderTopLeftRadius: isFirst ? 4 : 0,
                                  borderBottomLeftRadius: isFirst ? 4 : 0,
                                  borderTopRightRadius: isLast ? 4 : 0,
                                  borderBottomRightRadius: isLast ? 4 : 0,
                                },
                              ]}
                            />
                          );
                        })}
                        {unallocatedAmount > 0 && currentTotal > 0 && (
                          <View
                            style={[
                              styles.meterSegment,
                              styles.meterFlexibleSegment,
                              {
                                flex: unallocatedAmount,
                                borderTopLeftRadius: categoryAllocations.list.length === 0 ? 4 : 0,
                                borderBottomLeftRadius: categoryAllocations.list.length === 0 ? 4 : 0,
                                borderTopRightRadius: 4,
                                borderBottomRightRadius: 4,
                              },
                            ]}
                          />
                        )}
                      </>
                    )}
                  </View>

                  {/* Over Total Error Notice with 1-tap Sync */}
                  {categoryAllocations.isOverTotal && (
                    <View style={styles.meterWarningBanner}>
                      <View style={styles.meterWarningLeft}>
                        <AlertTriangle size={14} color={THEME.colors.negative} />
                        <Text style={styles.meterWarningText}>
                          Category caps exceed monthly limit.
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.meterSyncBtn}
                        onPress={handleAutoSumToTotal}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.meterSyncBtnText}>
                          Sync to {CURRENCY_SYMBOL}{categoryAllocations.sum.toLocaleString('en-IN')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Category Legend & Flexible Pool indicator */}
                  {categoryAllocations.list.length > 0 && !categoryAllocations.isOverTotal && (
                    <View style={styles.legendContainer}>
                      {categoryAllocations.list.map((item) => (
                        <View key={item.cat.key} style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: item.cat.color }]} />
                          <Text style={styles.legendLabel} numberOfLines={1}>{item.cat.name}</Text>
                          <Text style={styles.legendPct}>({item.pctOfTotal.toFixed(0)}%)</Text>
                        </View>
                      ))}
                      {unallocatedAmount > 0 && currentTotal > 0 && (
                        <View style={[styles.legendItem, styles.legendFlexibleItem]}>
                          <View style={[styles.legendDot, styles.legendFlexibleDot]} />
                          <Text style={styles.legendFlexibleLabel}>
                            Flexible Pool ({unallocatedPct.toFixed(0)}%)
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Micro Explainer Note */}
                  <View style={styles.meterNoteRow}>
                    <Info size={13} color={THEME.colors.textMuted} style={{ marginTop: 1 }} />
                    <Text style={styles.meterNoteText}>
                      Category caps are optional. Any unallocated amount stays in your{' '}
                      <Text style={styles.meterNoteBold}>flexible group pool</Text> for other expenses.
                    </Text>
                  </View>
                </View>
              )}

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
                    triggerLayoutTransition();
                    setIsCategoryExpanded(!isCategoryExpanded);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.categoryAccordionLeft}>
                    <PieChart size={16} color={THEME.colors.primary} />
                    <View style={styles.categoryTitleWrap}>
                      <View style={styles.categoryTitleRow}>
                        <Text style={styles.sectionLabelInline}>CATEGORY CAPS (OPTIONAL)</Text>
                        {categoryAllocations.list.length > 0 && (
                          <View
                            style={[
                              styles.categoryCountBadge,
                              categoryAllocations.isOverTotal && styles.categoryCountBadgeError,
                            ]}
                          >
                            <Text
                              style={[
                                styles.categoryCountBadgeText,
                                categoryAllocations.isOverTotal && styles.categoryCountBadgeTextError,
                              ]}
                            >
                              {categoryAllocations.list.length} active
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.categoryAccordionSubtext} numberOfLines={1}>
                        {categoryAllocations.list.length > 0
                          ? `${CURRENCY_SYMBOL}${categoryAllocations.sum.toLocaleString('en-IN')} capped • ${CURRENCY_SYMBOL}${unallocatedAmount.toLocaleString('en-IN')} flexible pool`
                          : 'Optional caps per category • All expenses share the budget'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.categoryAccordionRight}>
                    {isCategoryExpanded ? (
                      <ChevronUp size={18} color={THEME.colors.textSecondary} />
                    ) : (
                      <ChevronDown size={18} color={THEME.colors.textSecondary} />
                    )}
                  </View>
                </TouchableOpacity>

                {isCategoryExpanded && (
                  <View style={styles.categoryListContent}>
                    {categoryAllocations.list.length > 0 && (
                      <View style={styles.clearAllRow}>
                        <Text style={styles.categorySubtext}>
                          {categoryAllocations.list.length} of {MASTER_CATEGORIES.length} allocated
                        </Text>
                        <TouchableOpacity
                          onPress={handleClearAllCategories}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.clearAllText}>Clear All</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    <View style={styles.categoryGrid}>
                      {MASTER_CATEGORIES.map((cat) => {
                        const IconComponent = MASTER_CATEGORY_ICONS[cat.key] || Zap;
                        const currentVal = categoryLimits[cat.key] || '';
                        const numVal = parseInt(currentVal.replace(/[^0-9]/g, ''), 10) || 0;
                        const pct = currentTotal > 0 && numVal > 0 ? (numVal / currentTotal) * 100 : 0;

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
                              <View style={styles.categoryTextCol}>
                                <Text style={styles.categoryNameText} numberOfLines={1}>
                                  {cat.name}
                                </Text>
                                {pct > 0 ? (
                                  <Text style={styles.categoryPctText}>
                                    {pct.toFixed(0)}% of budget
                                  </Text>
                                ) : (
                                  <Text style={styles.categoryNoCapText}>No cap</Text>
                                )}
                              </View>
                            </View>

                            <View style={styles.categoryAmountCol}>
                              <Text style={styles.categoryInputPrefix}>{CURRENCY_SYMBOL}</Text>
                              <TextInput
                                style={styles.categoryTextInput}
                                value={currentVal}
                                onChangeText={(val) => handleCategoryLimitChange(cat.key, val)}
                                placeholder="0"
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
                style={[
                  styles.saveBtn,
                  (isSaving || categoryAllocations.isOverTotal) && styles.saveBtnDisabled,
                ]}
                onPress={handleSave}
                disabled={isSaving || categoryAllocations.isOverTotal}
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
    justifyContent: 'flex-end',
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  sheetContainer: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderBottomWidth: 0,
    width: '100%',
    marginBottom: 0,
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
    flexShrink: 1,
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
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
  },
  quickSumBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: THEME.colors.primaryMuted,
  },
  quickSumBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.primaryLight,
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

  /* Budget Allocation Live Meter */
  meterContainer: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: 10,
  },
  meterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meterTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  meterSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  meterSubtitleError: {
    color: THEME.colors.negativeLight,
    fontWeight: '700',
  },
  meterTrack: {
    height: 8,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  meterSegment: {
    height: '100%',
  },
  meterFlexibleSegment: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  meterOverBar: {
    width: '100%',
    height: '100%',
    backgroundColor: THEME.colors.negative,
  },
  meterWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 9,
    borderRadius: 10,
    backgroundColor: THEME.colors.negativeMuted,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  meterWarningLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  meterWarningText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.negativeLight,
  },
  meterSyncBtn: {
    backgroundColor: THEME.colors.negative,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  meterSyncBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    paddingTop: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
  },
  legendPct: {
    fontSize: 9,
    color: THEME.colors.textMuted,
  },
  legendFlexibleItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  legendFlexibleDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  legendFlexibleLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  meterNoteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
  },
  meterNoteText: {
    fontSize: 10.5,
    color: THEME.colors.textMuted,
    lineHeight: 15,
    flex: 1,
  },
  meterNoteBold: {
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },

  /* Alerts Section */
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

  /* Category Caps Accordion */
  categoryAccordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryAccordionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  categoryTitleWrap: {
    flex: 1,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryAccordionSubtext: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  categoryAccordionRight: {
    paddingLeft: 8,
  },
  categoryCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    backgroundColor: THEME.colors.primaryMuted,
  },
  categoryCountBadgeError: {
    backgroundColor: THEME.colors.negativeMuted,
  },
  categoryCountBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.primaryLight,
  },
  categoryCountBadgeTextError: {
    color: THEME.colors.negativeLight,
  },
  categoryListContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
  },
  clearAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  categorySubtext: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  clearAllText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    textDecorationLine: 'underline',
  },
  categoryGrid: {
    gap: 8,
  },
  categoryInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
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
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTextCol: {
    flex: 1,
  },
  categoryNameText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  categoryPctText: {
    fontSize: 10,
    fontWeight: '500',
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  categoryNoCapText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.25)',
    marginTop: 1,
  },
  categoryAmountCol: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 95,
    backgroundColor: THEME.colors.surface,
    borderRadius: 7,
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
    opacity: 0.5,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.primaryForeground,
  },
});
