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
  Alert,
  Switch,
  LayoutAnimation,
  UIManager,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  X,
  Sliders,
  Bell,
  ChevronDown,
  ChevronUp,
  Trash2,
  Check,
  Zap,
  Sparkles,
  Info,
  PieChart,
} from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { QuantumSpinner } from '../brand/QuantumLogo';
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
  const { currencySymbol } = useCurrency();
  const CURRENCY_SYMBOL = currencySymbol;

  const initialLimit = Number(initialBudget?.monthlyLimit ?? initialBudget?.totalMonthlyLimit ?? 25000);
  const [monthlyLimitStr, setMonthlyLimitStr] = useState<string>(initialLimit > 0 ? String(initialLimit) : '25000');

  const defaultThresholds = initialBudget?.alertThresholds || [75, 90, 100];
  const [threshold75, setThreshold75] = useState<boolean>(defaultThresholds.includes(75));
  const [threshold90, setThreshold90] = useState<boolean>(defaultThresholds.includes(90));
  const [threshold100, setThreshold100] = useState<boolean>(defaultThresholds.includes(100));

  // Automated Alerts Accordion (Always closed by default per specification)
  const [isAlertsExpanded, setIsAlertsExpanded] = useState<boolean>(false);

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

  const activeAlertsCount = [threshold75, threshold90, threshold100].filter(Boolean).length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.fullScreenSafe} edges={['top', 'bottom']}>
        {/* Pinned Editorial Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              haptics.tap();
              onClose();
            }}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <ArrowLeft size={20} color={THEME.colors.text} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              {hasExistingBudget ? 'Edit Monthly Budget' : 'Set Monthly Budget'}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {groupName}
            </Text>
          </View>

          {hasExistingBudget ? (
            <TouchableOpacity
              onPress={handleDisableBudget}
              style={styles.deleteHeaderBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Disable budget"
              disabled={isSaving}
            >
              <Trash2 size={18} color={THEME.colors.negative} />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerPlaceholder} />
          )}
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* ── SECTION: OPEN EDITORIAL HERO AMOUNT (NO-DIV) ── */}
            <View style={styles.heroAmountSection}>
              <View style={styles.heroAmountHeader}>
                <Text style={styles.sectionOverline}>TOTAL MONTHLY LIMIT</Text>
                {categoryAllocations.sum > 0 && categoryAllocations.sum !== monthlyLimitNum && (
                  <TouchableOpacity
                    style={styles.quickSumBtn}
                    onPress={handleAutoSumToTotal}
                    activeOpacity={0.7}
                  >
                    <Sparkles size={11} color={THEME.colors.primary} />
                    <Text style={styles.quickSumBtnText}>
                      Sync Sum ({CURRENCY_SYMBOL}{categoryAllocations.sum.toLocaleString('en-IN')})
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Amount Input Row with clean baseline */}
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

            {/* ── SECTION: LIVE BUDGET ALLOCATION TRACKER ── */}
            {showDistributionGraph && (
              <View style={styles.allocationCard}>
                <View style={styles.allocationHeader}>
                  <Text style={styles.allocationTitle}>Live Budget Allocation</Text>
                  <Text
                    style={[
                      styles.allocationSubtitle,
                      categoryAllocations.isOverTotal && styles.allocationSubtitleError,
                    ]}
                  >
                    {categoryAllocations.isOverTotal
                      ? `Over by ${CURRENCY_SYMBOL}${categoryAllocations.diff.toLocaleString('en-IN')}`
                      : `${CURRENCY_SYMBOL}${categoryAllocations.sum.toLocaleString('en-IN')} capped • ${CURRENCY_SYMBOL}${unallocatedAmount.toLocaleString('en-IN')} flexible`}
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
                              borderTopRightRadius: 4,
                              borderBottomRightRadius: 4,
                              borderTopLeftRadius: categoryAllocations.list.length === 0 ? 4 : 0,
                              borderBottomLeftRadius: categoryAllocations.list.length === 0 ? 4 : 0,
                            },
                          ]}
                        />
                      )}
                    </>
                  )}
                </View>

                {/* Legend Chips */}
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

                <View style={styles.meterNoteRow}>
                  <Info size={13} color={THEME.colors.textMuted} style={{ marginTop: 1 }} />
                  <Text style={styles.meterNoteText}>
                    Category caps are optional. Uncapped spend automatically pulls from your flexible pool.
                  </Text>
                </View>
              </View>
            )}

            {/* ── SECTION: CATEGORY CAPS (COLLAPSIBLE) ── */}
            <View style={styles.accordionCard}>
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => {
                  haptics.tap();
                  triggerLayoutTransition();
                  setIsCategoryExpanded(!isCategoryExpanded);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.accordionLeft}>
                  <View style={styles.accordionIconWrap}>
                    <PieChart size={16} color={THEME.colors.primary} />
                  </View>
                  <View style={styles.accordionTitleCol}>
                    <View style={styles.accordionTitleRow}>
                      <Text style={styles.accordionTitle}>CATEGORY CAPS</Text>
                      {categoryAllocations.list.length > 0 && (
                        <View
                          style={[
                            styles.countBadge,
                            categoryAllocations.isOverTotal && styles.countBadgeError,
                          ]}
                        >
                          <Text
                            style={[
                              styles.countBadgeText,
                              categoryAllocations.isOverTotal && styles.countBadgeTextError,
                            ]}
                          >
                            {categoryAllocations.list.length} active
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.accordionSubtitle} numberOfLines={1}>
                      {categoryAllocations.list.length > 0
                        ? `${CURRENCY_SYMBOL}${categoryAllocations.sum.toLocaleString('en-IN')} allocated`
                        : 'Optional spend limits per category'}
                    </Text>
                  </View>
                </View>

                {isCategoryExpanded ? (
                  <ChevronUp size={18} color={THEME.colors.textSecondary} />
                ) : (
                  <ChevronDown size={18} color={THEME.colors.textSecondary} />
                )}
              </TouchableOpacity>

              {isCategoryExpanded && (
                <View style={styles.accordionBody}>
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
                    {MASTER_CATEGORIES.map((cat, idx) => {
                      const IconComponent = MASTER_CATEGORY_ICONS[cat.key] || Zap;
                      const currentVal = categoryLimits[cat.key] || '';
                      const numVal = parseInt(currentVal.replace(/[^0-9]/g, ''), 10) || 0;
                      const pct = currentTotal > 0 && numVal > 0 ? (numVal / currentTotal) * 100 : 0;
                      const isLast = idx === MASTER_CATEGORIES.length - 1;

                      return (
                        <View
                          key={cat.key}
                          style={[styles.categoryInputRow, !isLast && styles.categoryRowBorder]}
                        >
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
                                  {pct.toFixed(0)}% of limit
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

            {/* ── SECTION: AUTOMATED ALERTS (CLICK TO EXPAND, CLOSED BY DEFAULT) ── */}
            <View style={styles.accordionCard}>
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => {
                  haptics.tap();
                  triggerLayoutTransition();
                  setIsAlertsExpanded(!isAlertsExpanded);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.accordionLeft}>
                  <View style={styles.accordionIconWrap}>
                    <Bell size={16} color={THEME.colors.primary} />
                  </View>
                  <View style={styles.accordionTitleCol}>
                    <View style={styles.accordionTitleRow}>
                      <Text style={styles.accordionTitle}>AUTOMATED ALERTS</Text>
                      {activeAlertsCount > 0 && (
                        <View style={styles.countBadge}>
                          <Text style={styles.countBadgeText}>{activeAlertsCount} active</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.accordionSubtitle} numberOfLines={1}>
                      {activeAlertsCount > 0
                        ? 'Threshold pacing alerts enabled'
                        : 'Instant pacing notifications'}
                    </Text>
                  </View>
                </View>

                {isAlertsExpanded ? (
                  <ChevronUp size={18} color={THEME.colors.textSecondary} />
                ) : (
                  <ChevronDown size={18} color={THEME.colors.textSecondary} />
                )}
              </TouchableOpacity>

              {isAlertsExpanded && (
                <View style={styles.accordionBody}>
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
                      trackColor={{ false: THEME.colors.surfaceElevated, true: THEME.colors.primary }}
                      thumbColor={THEME.colors.text}
                    />
                  </View>

                  {/* 90% High Burn */}
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
                      trackColor={{ false: THEME.colors.surfaceElevated, true: THEME.colors.primary }}
                      thumbColor={THEME.colors.text}
                    />
                  </View>

                  {/* 100% Over Budget */}
                  <View style={[styles.thresholdRow, styles.thresholdRowBorder]}>
                    <View style={styles.thresholdInfo}>
                      <View style={[styles.thresholdDot, { backgroundColor: THEME.colors.negative }]} />
                      <View>
                        <Text style={styles.thresholdTitle}>100% Over Budget</Text>
                        <Text style={styles.thresholdDesc}>Alert when monthly limit is completely exhausted</Text>
                      </View>
                    </View>
                    <Switch
                      value={threshold100}
                      onValueChange={(val) => {
                        haptics.tick();
                        setThreshold100(val);
                      }}
                      trackColor={{ false: THEME.colors.surfaceElevated, true: THEME.colors.primary }}
                      thumbColor={THEME.colors.text}
                    />
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Pinned Bottom Footer Action */}
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
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
                <QuantumSpinner size={18} color={THEME.colors.primaryForeground} />
              ) : (
                <>
                  <Check size={16} color={THEME.colors.primaryForeground} strokeWidth={2.5} />
                  <Text style={styles.saveBtnText}>Save Budget</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

export const SetBudgetModal: React.FC<SetBudgetModalProps> = (props) => {
  if (!props.visible) return null;
  return <SetBudgetContent {...props} />;
};

const styles = StyleSheet.create({
  fullScreenSafe: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  deleteHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  headerPlaceholder: {
    width: 36,
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 18,
  },

  /* ── HERO AMOUNT INPUT (NO-DIV) ── */
  heroAmountSection: {
    gap: 10,
  },
  heroAmountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionOverline: {
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
    color: THEME.colors.primary,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    borderBottomWidth: 1.5,
    borderBottomColor: THEME.colors.hairline,
    paddingBottom: 6,
    marginTop: 4,
  },
  currencyPrefix: {
    fontSize: 30,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    marginRight: 6,
  },
  heroAmountInput: {
    flex: 1,
    fontSize: 36,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -0.8,
    padding: 0,
    includeFontPadding: false,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  presetChipActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textMuted,
  },
  presetChipTextActive: {
    color: THEME.colors.primaryForeground,
    fontWeight: '800',
  },

  /* ── LIVE ALLOCATION CARD ── */
  allocationCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    gap: 12,
  },
  allocationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  allocationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  allocationSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  allocationSubtitleError: {
    color: THEME.colors.negative,
    fontWeight: '700',
  },
  meterTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.surfaceElevated,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  meterSegment: {
    height: '100%',
  },
  meterFlexibleSegment: {
    backgroundColor: THEME.colors.hairline,
  },
  meterOverBar: {
    flex: 1,
    backgroundColor: THEME.colors.negative,
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.colors.surfaceElevated,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.text,
    maxWidth: 90,
  },
  legendPct: {
    fontSize: 10,
    color: THEME.colors.textMuted,
  },
  legendFlexibleItem: {
    backgroundColor: THEME.colors.surfaceElevated,
  },
  legendFlexibleDot: {
    backgroundColor: THEME.colors.textMuted,
  },
  legendFlexibleLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  meterNoteRow: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 2,
  },
  meterNoteText: {
    flex: 1,
    fontSize: 11,
    color: THEME.colors.textMuted,
    lineHeight: 15,
  },

  /* ── ACCORDION CARD (SINGLE-LAYER) ── */
  accordionCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  accordionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  accordionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accordionTitleCol: {
    flex: 1,
  },
  accordionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  accordionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: 0.5,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    backgroundColor: THEME.colors.primaryMuted,
  },
  countBadgeError: {
    backgroundColor: THEME.colors.negativeMuted,
  },
  countBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  countBadgeTextError: {
    color: THEME.colors.negative,
  },
  accordionSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  accordionBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.colors.hairline,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  /* ── CATEGORY CAPS LIST ── */
  clearAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  categorySubtext: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  clearAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.negative,
  },
  categoryGrid: {
    gap: 0,
  },
  categoryInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 12,
  },
  categoryRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.colors.hairline,
  },
  categoryLabelCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  categoryIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTextCol: {
    flex: 1,
  },
  categoryNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  categoryPctText: {
    fontSize: 11,
    color: THEME.colors.primary,
    fontWeight: '600',
  },
  categoryNoCapText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  categoryAmountCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    minWidth: 96,
    justifyContent: 'flex-end',
  },
  categoryInputPrefix: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textMuted,
  },
  categoryTextInput: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
    padding: 0,
    minWidth: 40,
    textAlign: 'right',
  },

  /* ── THRESHOLDS LIST ── */
  thresholdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
  },
  thresholdRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
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
    fontWeight: '700',
    color: THEME.colors.text,
  },
  thresholdDesc: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },

  /* ── PINNED FOOTER ── */
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
    backgroundColor: THEME.colors.surface,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    backgroundColor: THEME.colors.primary,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.primaryForeground,
  },
});
