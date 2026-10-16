import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { THEME } from '../../constants/theme';
import { groupService, GroupListItem } from '../../services/group.service';
import { expenseService, UserTransactionItem } from '../../services/expense.service';
import { settlementService, GroupSettlementItem } from '../../services/settlement.service';
import { useCurrency } from '../../contexts/currency.context';
import { useAppTheme } from '../../contexts/theme.context';
import { haptics } from '../../services/haptics.service';
import {
  Search,
  X,
  Users,
  Receipt,
  ArrowRightLeft,
  ArrowRight,
  ChevronRight,
  Handshake,
  Utensils,
  ShoppingBag,
  Car,
  Zap,
  Sparkles,
  ArrowLeft,
  Clock,
} from 'lucide-react-native';

interface UniversalSearchModalProps {
  visible: boolean;
  onClose: () => void;
}

type SearchCategory = 'all' | 'groups' | 'expenses' | 'settlements' | 'friends';

interface SearchResultItem {
  id: string;
  type: 'group' | 'expense' | 'settlement' | 'friend';
  title: string;
  subtitle: string;
  amount?: number;
  date?: string;
  groupId?: string;
  groupName?: string;
  avatarUrl?: string;
  category?: string;
  paidByName?: string;
  yourShare?: number;
  yourImpact?: 'get' | 'owe' | 'none';
  payerName?: string;
  payeeName?: string;
  membersCount?: number;
  userNetBalance?: number;
  mutualGroups?: string[];
}

export const UniversalSearchModal: React.FC<UniversalSearchModalProps> = ({
  visible,
  onClose,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { formatCurrency } = useCurrency();
  const { currentAccent } = useAppTheme();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SearchCategory>('all');

  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [expenses, setExpenses] = useState<UserTransactionItem[]>([]);
  const [settlements, setSettlements] = useState<GroupSettlementItem[]>([]);

  useEffect(() => {
    if (visible) {
      setGroups(groupService.getInMemoryGroups());
      setExpenses(expenseService.getInMemoryUserExpenses());
      settlementService.getUserSettlements().then(setSettlements).catch(() => {});
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      setQuery('');
      setSelectedCategory('all');
    }
  }, [visible]);

  // Aggregate mutual friends from groups
  const friends = useMemo(() => {
    const friendMap = new Map<string, { id: string; name: string; avatarUrl?: string; groups: string[] }>();
    groups.forEach((g) => {
      (g.members || []).forEach((m) => {
        if (!friendMap.has(m.id)) {
          friendMap.set(m.id, { id: m.id, name: m.name, avatarUrl: m.avatarUrl, groups: [g.name] });
        } else {
          const existing = friendMap.get(m.id)!;
          if (!existing.groups.includes(g.name)) {
            existing.groups.push(g.name);
          }
        }
      });
    });
    return Array.from(friendMap.values());
  }, [groups]);

  // Search Results Filtering
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const items: SearchResultItem[] = [];

    // 1. Groups / Circles
    if (selectedCategory === 'all' || selectedCategory === 'groups') {
      groups.forEach((g) => {
        if (
          g.name.toLowerCase().includes(q) ||
          (g.description && g.description.toLowerCase().includes(q))
        ) {
          items.push({
            id: g.id,
            type: 'group',
            title: g.name,
            subtitle: g.description || `${g.membersCount || g.members?.length || 0} members`,
            membersCount: g.membersCount || g.members?.length || 0,
            userNetBalance: g.userNetBalance || 0,
            avatarUrl: g.coverImageUrl,
          });
        }
      });
    }

    // 2. Expenses
    if (selectedCategory === 'all' || selectedCategory === 'expenses') {
      expenses.forEach((e) => {
        if (
          e.title.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.groupName.toLowerCase().includes(q) ||
          (e.paidByName && e.paidByName.toLowerCase().includes(q))
        ) {
          items.push({
            id: e.id,
            type: 'expense',
            title: e.title,
            subtitle: `${e.groupName} · ${e.category}`,
            amount: e.amount,
            date: e.date,
            groupId: e.groupId,
            groupName: e.groupName,
            category: e.category,
            paidByName: e.paidByName,
            yourShare: e.yourShare,
            yourImpact: e.yourImpact,
          });
        }
      });
    }

    // 3. Settlements
    if (selectedCategory === 'all' || selectedCategory === 'settlements') {
      settlements.forEach((s) => {
        if (
          s.payerName.toLowerCase().includes(q) ||
          s.payeeName.toLowerCase().includes(q) ||
          (s.notes && s.notes.toLowerCase().includes(q))
        ) {
          items.push({
            id: s.id,
            type: 'settlement',
            title: `${s.payerName} → ${s.payeeName}`,
            subtitle: s.notes || 'Settlement payment',
            amount: s.amount,
            date: s.date,
            groupId: s.groupId,
            payerName: s.payerName,
            payeeName: s.payeeName,
          });
        }
      });
    }

    // 4. Friends
    if (selectedCategory === 'all' || selectedCategory === 'friends') {
      friends.forEach((f) => {
        if (f.name.toLowerCase().includes(q)) {
          items.push({
            id: f.id,
            type: 'friend',
            title: f.name,
            subtitle: f.groups.length > 0 ? `In ${f.groups.join(', ')}` : 'Mutual Circle Member',
            avatarUrl: f.avatarUrl,
            mutualGroups: f.groups,
          });
        }
      });
    }

    return items;
  }, [query, selectedCategory, groups, expenses, settlements, friends]);

  // Counts per Category for Filter Strip Badges
  const counts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return {
        all: 0,
        groups: groups.length,
        expenses: expenses.length,
        settlements: settlements.length,
        friends: friends.length,
      };
    }
    const gCount = groups.filter(
      (g) => g.name.toLowerCase().includes(q) || (g.description && g.description.toLowerCase().includes(q))
    ).length;
    const eCount = expenses.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.groupName.toLowerCase().includes(q) ||
        (e.paidByName && e.paidByName.toLowerCase().includes(q))
    ).length;
    const sCount = settlements.filter(
      (s) =>
        s.payerName.toLowerCase().includes(q) ||
        s.payeeName.toLowerCase().includes(q) ||
        (s.notes && s.notes.toLowerCase().includes(q))
    ).length;
    const fCount = friends.filter((f) => f.name.toLowerCase().includes(q)).length;

    return {
      all: gCount + eCount + sCount + fCount,
      groups: gCount,
      expenses: eCount,
      settlements: sCount,
      friends: fCount,
    };
  }, [query, groups, expenses, settlements, friends]);

  const handleSelectItem = (item: SearchResultItem) => {
    haptics.tap();
    onClose();

    if (item.type === 'group') {
      router.push({
        pathname: '/groups/[id]',
        params: { id: item.id },
      });
    } else if (item.type === 'expense') {
      router.push({
        pathname: '/expenses/[id]',
        params: { id: item.id, groupId: item.groupId },
      });
    } else if (item.type === 'settlement') {
      router.push({
        pathname: '/settlements/[id]',
        params: { id: item.id, groupId: item.groupId },
      });
    }
  };

  const CATEGORIES: Array<{ id: SearchCategory; label: string; count: number }> = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'groups', label: 'Circles', count: counts.groups },
    { id: 'expenses', label: 'Expenses', count: counts.expenses },
    { id: 'settlements', label: 'Settlements', count: counts.settlements },
    { id: 'friends', label: 'People', count: counts.friends },
  ];

  // Grouped results for the 'all' tab
  const groupedResults = useMemo(() => {
    return {
      groups: results.filter((i) => i.type === 'group'),
      expenses: results.filter((i) => i.type === 'expense'),
      settlements: results.filter((i) => i.type === 'settlement'),
      friends: results.filter((i) => i.type === 'friend'),
    };
  }, [results]);

  const SUGGESTED_TAGS = ['Dinner', 'Groceries', 'Trip', 'Rent', 'Coffee', 'Settled'];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Pinned Flagship Search Bar */}
        <View style={styles.searchHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              haptics.tap();
              onClose();
            }}
            activeOpacity={0.7}
            accessibilityLabel="Close search"
          >
            <ArrowLeft size={20} color={THEME.colors.text} />
          </TouchableOpacity>

          <View
            style={[
              styles.searchInputWrap,
              query.length > 0 && { borderColor: `${currentAccent.primary}60` },
            ]}
          >
            <Search
              size={18}
              color={query.length > 0 ? currentAccent.primary : THEME.colors.textMuted}
            />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search circles, expenses, people..."
              placeholderTextColor={THEME.colors.textMuted}
              returnKeyType="search"
              clearButtonMode="never"
              numberOfLines={1}
              multiline={false}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  haptics.tap();
                  setQuery('');
                }}
                style={styles.clearBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Clear search input"
              >
                <X size={15} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => {
              haptics.tap();
              onClose();
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.doneBtnText, { color: currentAccent.primary }]}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Strip */}
        <View style={styles.filterStripContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterStripContent}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.filterPill,
                    isSelected && [
                      styles.filterPillActive,
                      {
                        backgroundColor: currentAccent.primary,
                        borderColor: currentAccent.primary,
                      },
                    ],
                  ]}
                  onPress={() => {
                    haptics.tick();
                    setSelectedCategory(cat.id);
                  }}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      isSelected && styles.filterPillTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                  {query.trim().length > 0 && cat.count > 0 && (
                    <View
                      style={[
                        styles.filterBadge,
                        isSelected
                          ? { backgroundColor: 'rgba(0, 0, 0, 0.22)' }
                          : { backgroundColor: THEME.colors.surfaceElevated },
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterBadgeText,
                          isSelected
                            ? { color: THEME.colors.primaryForeground }
                            : { color: THEME.colors.textSecondary },
                        ]}
                      >
                        {cat.count}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Results Stream — Full-Width Open Editorial Layout */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {query.trim().length === 0 ? (
            /* Empty / Exploration State */
            <View style={styles.explorationContainer}>
              {/* Quick Jump: Top Circles */}
              {groups.length > 0 && (
                <View style={styles.exploreSection}>
                  <Text style={styles.exploreSectionTitle}>RECENT CIRCLES</Text>
                  <View style={styles.exploreCirclesList}>
                    {groups.slice(0, 4).map((g) => {
                      const initials = g.name
                        .split(' ')
                        .map((w) => w[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();
                      return (
                        <TouchableOpacity
                          key={g.id}
                          style={styles.openItemRow}
                          onPress={() => {
                            haptics.tap();
                            onClose();
                            router.push({ pathname: '/groups/[id]', params: { id: g.id } });
                          }}
                          activeOpacity={0.7}
                        >
                          {g.coverImageUrl ? (
                            <Image source={{ uri: g.coverImageUrl }} style={styles.groupCoverThumb} />
                          ) : (
                            <View
                              style={[
                                styles.groupInitialBadge,
                                {
                                  backgroundColor: `${currentAccent.primary}18`,
                                  borderColor: `${currentAccent.primary}40`,
                                },
                              ]}
                            >
                              <Text style={[styles.groupInitialText, { color: currentAccent.primary }]}>
                                {initials}
                              </Text>
                            </View>
                          )}
                          <View style={styles.itemMainContent}>
                            <Text style={styles.circleItemTitle} numberOfLines={1}>
                              {g.name}
                            </Text>
                            <Text style={styles.itemMetaSubtitle} numberOfLines={1}>
                              {g.membersCount || g.members?.length || 0} members · Circle
                            </Text>
                          </View>
                          <ChevronRight size={16} color={THEME.colors.textMuted} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Suggested Search Query Tags */}
              <View style={styles.exploreSection}>
                <Text style={styles.exploreSectionTitle}>SUGGESTED SEARCHES</Text>
                <View style={styles.suggestedTagsWrap}>
                  {SUGGESTED_TAGS.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={styles.suggestedTagChip}
                      onPress={() => {
                        haptics.tap();
                        setQuery(tag);
                      }}
                      activeOpacity={0.7}
                    >
                      <Sparkles size={13} color={currentAccent.primary} />
                      <Text style={styles.suggestedTagText}>{tag}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          ) : results.length === 0 ? (
            /* No Results Found State */
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconCircle}>
                <Search size={32} color={THEME.colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No matches found</Text>
              <Text style={styles.emptySubtitle}>
                No results for &ldquo;{query}&rdquo;. Try another name, category, or keyword.
              </Text>
              <TouchableOpacity
                style={[styles.clearSearchBtn, { borderColor: `${currentAccent.primary}50` }]}
                onPress={() => {
                  haptics.tap();
                  setQuery('');
                }}
              >
                <Text style={[styles.clearSearchBtnText, { color: currentAccent.primary }]}>
                  Clear Search
                </Text>
              </TouchableOpacity>
            </View>
          ) : selectedCategory === 'all' ? (
            /* Grouped Sections by Type */
            <View style={styles.groupedList}>
              {/* 1. Circles Group */}
              {groupedResults.groups.length > 0 && (
                <View style={styles.resultGroupSection}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionHeaderTitle}>CIRCLES</Text>
                    <Text style={styles.sectionHeaderCount}>{groupedResults.groups.length}</Text>
                  </View>
                  {groupedResults.groups.map((item) => (
                    <CircleResultRow
                      key={`g_${item.id}`}
                      item={item}
                      currentAccent={currentAccent}
                      onPress={() => handleSelectItem(item)}
                    />
                  ))}
                </View>
              )}

              {/* 2. Expenses Group */}
              {groupedResults.expenses.length > 0 && (
                <View style={styles.resultGroupSection}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionHeaderTitle}>EXPENSES</Text>
                    <Text style={styles.sectionHeaderCount}>{groupedResults.expenses.length}</Text>
                  </View>
                  {groupedResults.expenses.map((item) => (
                    <ExpenseResultRow
                      key={`e_${item.id}`}
                      item={item}
                      formatCurrency={formatCurrency}
                      currentAccent={currentAccent}
                      onPress={() => handleSelectItem(item)}
                    />
                  ))}
                </View>
              )}

              {/* 3. Settlements Group */}
              {groupedResults.settlements.length > 0 && (
                <View style={styles.resultGroupSection}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionHeaderTitle}>SETTLEMENTS</Text>
                    <Text style={styles.sectionHeaderCount}>{groupedResults.settlements.length}</Text>
                  </View>
                  {groupedResults.settlements.map((item) => (
                    <SettlementResultRow
                      key={`s_${item.id}`}
                      item={item}
                      formatCurrency={formatCurrency}
                      currentAccent={currentAccent}
                      onPress={() => handleSelectItem(item)}
                    />
                  ))}
                </View>
              )}

              {/* 4. Friends Group */}
              {groupedResults.friends.length > 0 && (
                <View style={styles.resultGroupSection}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionHeaderTitle}>PEOPLE</Text>
                    <Text style={styles.sectionHeaderCount}>{groupedResults.friends.length}</Text>
                  </View>
                  {groupedResults.friends.map((item) => (
                    <FriendResultRow
                      key={`f_${item.id}`}
                      item={item}
                      currentAccent={currentAccent}
                      onPress={() => handleSelectItem(item)}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : (
            /* Filtered Flat Results Stream */
            <View style={styles.flatList}>
              {results.map((item) => {
                if (item.type === 'group') {
                  return (
                    <CircleResultRow
                      key={`g_${item.id}`}
                      item={item}
                      currentAccent={currentAccent}
                      onPress={() => handleSelectItem(item)}
                    />
                  );
                }
                if (item.type === 'expense') {
                  return (
                    <ExpenseResultRow
                      key={`e_${item.id}`}
                      item={item}
                      formatCurrency={formatCurrency}
                      currentAccent={currentAccent}
                      onPress={() => handleSelectItem(item)}
                    />
                  );
                }
                if (item.type === 'settlement') {
                  return (
                    <SettlementResultRow
                      key={`s_${item.id}`}
                      item={item}
                      formatCurrency={formatCurrency}
                      currentAccent={currentAccent}
                      onPress={() => handleSelectItem(item)}
                    />
                  );
                }
                return (
                  <FriendResultRow
                    key={`f_${item.id}`}
                    item={item}
                    currentAccent={currentAccent}
                    onPress={() => handleSelectItem(item)}
                  />
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// ── BESPOKE TYPE-SPECIFIC ROW RENDERERS (NO-DIV DESIGN) ──────────────────────

function CircleResultRow({
  item,
  currentAccent,
  onPress,
}: {
  item: SearchResultItem;
  currentAccent: any;
  onPress: () => void;
}) {
  const initials = item.title
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const netBal = item.userNetBalance || 0;

  return (
    <TouchableOpacity style={styles.openItemRow} onPress={onPress} activeOpacity={0.7}>
      {item.avatarUrl ? (
        <Image source={{ uri: item.avatarUrl }} style={styles.groupCoverThumb} />
      ) : (
        <View
          style={[
            styles.groupInitialBadge,
            {
              backgroundColor: `${currentAccent.primary}18`,
              borderColor: `${currentAccent.primary}40`,
            },
          ]}
        >
          <Text style={[styles.groupInitialText, { color: currentAccent.primary }]}>
            {initials}
          </Text>
        </View>
      )}

      <View style={styles.itemMainContent}>
        <View style={styles.itemTitleRow}>
          <Text style={styles.circleItemTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.circleTypePill}>
            <Text style={styles.circleTypePillText}>CIRCLE</Text>
          </View>
        </View>

        <Text style={styles.itemMetaSubtitle} numberOfLines={1}>
          {item.membersCount} members
          {item.subtitle && item.subtitle !== item.title ? ` · ${item.subtitle}` : ''}
        </Text>
      </View>

      {netBal !== 0 ? (
        <View style={styles.groupBalanceBlock}>
          <Text
            style={[
              styles.groupBalanceValue,
              { color: netBal > 0 ? THEME.colors.success : THEME.colors.negative },
            ]}
          >
            {netBal > 0 ? `+₹${netBal.toLocaleString()}` : `-₹${Math.abs(netBal).toLocaleString()}`}
          </Text>
          <Text style={styles.groupBalanceLabel}>
            {netBal > 0 ? 'owed to you' : 'you owe'}
          </Text>
        </View>
      ) : (
        <ChevronRight size={16} color={THEME.colors.textMuted} />
      )}
    </TouchableOpacity>
  );
}

function ExpenseResultRow({
  item,
  formatCurrency,
  currentAccent,
  onPress,
}: {
  item: SearchResultItem;
  formatCurrency: (val: number) => string;
  currentAccent: any;
  onPress: () => void;
}) {
  const cat = (item.category || '').toLowerCase();
  let CatIcon = Receipt;
  let catColor = currentAccent.primary;

  if (cat.includes('food') || cat.includes('din') || cat.includes('meal') || cat.includes('snack')) {
    CatIcon = Utensils;
    catColor = THEME.colors.warning;
  } else if (cat.includes('grocer') || cat.includes('shop') || cat.includes('market')) {
    CatIcon = ShoppingBag;
    catColor = THEME.colors.ai;
  } else if (cat.includes('trip') || cat.includes('travel') || cat.includes('flight') || cat.includes('cab')) {
    CatIcon = Car;
    catColor = THEME.colors.info;
  } else if (cat.includes('bill') || cat.includes('util') || cat.includes('recharge')) {
    CatIcon = Zap;
    catColor = THEME.colors.notification.expense;
  }

  return (
    <TouchableOpacity style={styles.openItemRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.expenseCategoryNode, { backgroundColor: `${catColor}18` }]}>
        <CatIcon size={18} color={catColor} />
      </View>

      <View style={styles.itemMainContent}>
        <Text style={styles.expenseItemTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={styles.expenseSubRow}>
          <Text style={styles.expenseGroupText} numberOfLines={1}>
            {item.groupName}
          </Text>
          {item.date && (
            <>
              <Text style={styles.dotSeparator}>·</Text>
              <Text style={styles.expenseDateText}>{item.date}</Text>
            </>
          )}
          {item.paidByName && (
            <>
              <Text style={styles.dotSeparator}>·</Text>
              <Text style={styles.expensePayerText} numberOfLines={1}>
                by {item.paidByName}
              </Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.expenseAmountBlock}>
        <Text style={styles.expenseTotalAmount}>
          {item.amount !== undefined ? formatCurrency(item.amount) : ''}
        </Text>
        {item.yourImpact && item.yourShare !== undefined && item.yourImpact !== 'none' && (
          <Text
            style={[
              styles.expenseShareText,
              { color: item.yourImpact === 'get' ? THEME.colors.success : THEME.colors.negativeLight },
            ]}
          >
            {item.yourImpact === 'get'
              ? `+${formatCurrency(item.yourShare)}`
              : `-${formatCurrency(item.yourShare)}`}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function SettlementResultRow({
  item,
  formatCurrency,
  currentAccent,
  onPress,
}: {
  item: SearchResultItem;
  formatCurrency: (val: number) => string;
  currentAccent: any;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.openItemRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.settlementIconNode, { backgroundColor: 'rgba(16, 185, 129, 0.14)' }]}>
        <Handshake size={18} color={THEME.colors.success} />
      </View>

      <View style={styles.itemMainContent}>
        <View style={styles.settlementFlowRow}>
          <Text style={styles.settlementPayer} numberOfLines={1}>
            {item.payerName}
          </Text>
          <ArrowRight size={12} color={currentAccent.primary} style={{ marginHorizontal: 4 }} />
          <Text style={styles.settlementPayee} numberOfLines={1}>
            {item.payeeName}
          </Text>
        </View>

        <View style={styles.expenseSubRow}>
          <View style={styles.settledBadge}>
            <Text style={styles.settledBadgeText}>SETTLED</Text>
          </View>
          {item.date && (
            <>
              <Text style={styles.dotSeparator}>·</Text>
              <Text style={styles.expenseDateText}>{item.date}</Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.settlementAmountBlock}>
        <Text style={[styles.settlementAmount, { color: THEME.colors.success }]}>
          {item.amount !== undefined ? formatCurrency(item.amount) : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function FriendResultRow({
  item,
  currentAccent,
  onPress,
}: {
  item: SearchResultItem;
  currentAccent: any;
  onPress: () => void;
}) {
  const initials = item.title
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <TouchableOpacity style={styles.openItemRow} onPress={onPress} activeOpacity={0.7}>
      {item.avatarUrl ? (
        <Image source={{ uri: item.avatarUrl }} style={styles.friendAvatarImg} />
      ) : (
        <View style={[styles.friendAvatarFallback, { borderColor: `${currentAccent.primary}40` }]}>
          <Text style={styles.friendInitialText}>{initials}</Text>
        </View>
      )}

      <View style={styles.itemMainContent}>
        <Text style={styles.friendName} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.friendMeta} numberOfLines={1}>
          {item.subtitle || 'Mutual Circle Member'}
        </Text>
      </View>

      <View
        style={[
          styles.friendActionPill,
          {
            borderColor: `${currentAccent.primary}35`,
            backgroundColor: `${currentAccent.primary}10`,
          },
        ]}
      >
        <Text style={[styles.friendActionText, { color: currentAccent.primary }]}>View</Text>
        <ChevronRight size={12} color={currentAccent.primary} />
      </View>
    </TouchableOpacity>
  );
}

// ── STYLES (OPEN EDITORIAL & NO-DIV SPECIFICATION) ──────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.colors.hairline,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.full,
    paddingHorizontal: 14,
    height: 42,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: THEME.colors.text,
    padding: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  clearBtn: {
    padding: 4,
  },
  doneBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  doneBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  filterStripContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.colors.hairline,
    paddingVertical: 10,
  },
  filterStripContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  filterPillActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  filterPillTextActive: {
    color: THEME.colors.primaryForeground,
    fontWeight: '800',
  },
  filterBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: THEME.radius.full,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 36,
  },
  // Open Editorial Items (No-Div Layout)
  openItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.colors.hairline,
    backgroundColor: THEME.colors.background,
  },
  itemMainContent: {
    flex: 1,
    gap: 3,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemMetaSubtitle: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  dotSeparator: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  // 1. Circle Row Styles
  groupCoverThumb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  groupInitialBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupInitialText: {
    fontSize: 16,
    fontWeight: '900',
  },
  circleItemTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.3,
  },
  circleTypePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: THEME.radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  circleTypePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.6,
  },
  groupBalanceBlock: {
    alignItems: 'flex-end',
    gap: 2,
  },
  groupBalanceValue: {
    fontSize: 14,
    fontWeight: '900',
  },
  groupBalanceLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  // 2. Expense Row Styles
  expenseCategoryNode: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  expenseSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  expenseGroupText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    maxWidth: 120,
  },
  expenseDateText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  expensePayerText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '500',
    maxWidth: 80,
  },
  expenseAmountBlock: {
    alignItems: 'flex-end',
    gap: 2,
  },
  expenseTotalAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: THEME.colors.text,
  },
  expenseShareText: {
    fontSize: 11,
    fontWeight: '800',
  },
  // 3. Settlement Row Styles
  settlementIconNode: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settlementFlowRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settlementPayer: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  settlementPayee: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  settledBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: THEME.radius.sm,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  settledBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.success,
    letterSpacing: 0.5,
  },
  settlementAmountBlock: {
    alignItems: 'flex-end',
  },
  settlementAmount: {
    fontSize: 16,
    fontWeight: '900',
  },
  // 4. Friend Row Styles
  friendAvatarImg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  friendAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendInitialText: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  friendName: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  friendMeta: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  friendActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
  },
  friendActionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // Sections & Exploration Styles
  groupedList: {
    gap: 16,
    paddingTop: 8,
  },
  resultGroupSection: {
    gap: 0,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
  },
  sectionHeaderCount: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
  },
  flatList: {
    paddingTop: 4,
  },
  explorationContainer: {
    paddingTop: 16,
    gap: 24,
  },
  exploreSection: {
    gap: 10,
  },
  exploreSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
    paddingHorizontal: 16,
  },
  exploreCirclesList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.colors.hairline,
  },
  suggestedTagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
  },
  suggestedTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  suggestedTagText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  emptySubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  clearSearchBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  clearSearchBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
