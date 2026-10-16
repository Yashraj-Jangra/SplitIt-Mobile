import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  Keyboard,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  UserCheck,
  ChevronRight,
  TrendingUp,
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
  avatarUrl?: string;
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
    const friendMap = new Map<string, { id: string; name: string; avatarUrl?: string }>();
    groups.forEach((g) => {
      (g.members || []).forEach((m) => {
        if (!friendMap.has(m.id)) {
          friendMap.set(m.id, { id: m.id, name: m.name, avatarUrl: m.avatarUrl });
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

    // 1. Groups
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
            subtitle: `${g.membersCount || g.members?.length || 0} members · Circle`,
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
          e.groupName.toLowerCase().includes(q)
        ) {
          items.push({
            id: e.id,
            type: 'expense',
            title: e.title,
            subtitle: `${e.groupName} · ${e.category}`,
            amount: e.amount,
            date: e.date,
            groupId: e.groupId,
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
            subtitle: 'Mutual Circle Member',
            avatarUrl: f.avatarUrl,
          });
        }
      });
    }

    return items;
  }, [query, selectedCategory, groups, expenses, settlements, friends]);

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

  const CATEGORIES: Array<{ id: SearchCategory; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'groups', label: 'Circles' },
    { id: 'expenses', label: 'Expenses' },
    { id: 'settlements', label: 'Settlements' },
    { id: 'friends', label: 'People' },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: Platform.OS === 'android' ? insets.top : 12 }]}>
        {/* Search Header */}
        <View style={styles.searchHeader}>
          <View style={styles.searchInputWrap}>
            <Search size={18} color={THEME.colors.textMuted} />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search..."
              placeholderTextColor={THEME.colors.textMuted}
              returnKeyType="search"
              clearButtonMode="while-editing"
              numberOfLines={1}
              multiline={false}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => setQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={16} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => {
              haptics.tap();
              onClose();
            }}
          >
            <Text style={[styles.cancelBtnText, { color: currentAccent.primary }]}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Category Pills Strip */}
        <View style={styles.filterStrip}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.filterPill,
                  isSelected && [styles.filterPillActive, { backgroundColor: currentAccent.primary, borderColor: currentAccent.primary }],
                ]}
                onPress={() => {
                  haptics.tick();
                  setSelectedCategory(cat.id);
                }}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    isSelected && styles.filterPillTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Results Stream */}
        <FlatList
          data={results}
          keyExtractor={(item) => `${item.type}_${item.id}`}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => {
            let IconComp: any = Receipt;
            let iconColor: string = THEME.colors.info;

            if (item.type === 'group') {
              IconComp = Users;
              iconColor = THEME.colors.warning;
            } else if (item.type === 'settlement') {
              IconComp = ArrowRightLeft;
              iconColor = THEME.colors.success;
            } else if (item.type === 'friend') {
              IconComp = UserCheck;
              iconColor = currentAccent.primary;
            }

            return (
              <TouchableOpacity
                style={styles.resultRow}
                onPress={() => handleSelectItem(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconWrap, { backgroundColor: THEME.colors.surfaceElevated }]}>
                  <IconComp size={16} color={iconColor} />
                </View>

                <View style={styles.resultInfo}>
                  <Text style={styles.resultTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.resultSubtitle} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                </View>

                {item.amount !== undefined && (
                  <Text style={styles.resultAmount}>
                    {formatCurrency(item.amount)}
                  </Text>
                )}

                <ChevronRight size={16} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            query.trim().length > 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>No matching results</Text>
                <Text style={styles.emptySubtitle}>
                  Try searching with a different name or keyword
                </Text>
              </View>
            ) : (
              <View style={styles.emptyWrap}>
                <Search size={32} color={THEME.colors.surfaceElevated} />
                <Text style={styles.emptyTitle}>Universal Search</Text>
                <Text style={styles.emptySubtitle}>
                  Search across all your groups, expenses, and settlements
                </Text>
              </View>
            )
          }
        />
      </View>
    </Modal>
  );
};

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
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: THEME.colors.text,
    padding: 0,
    paddingVertical: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  filterStrip: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  filterPillActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  filterPillTextActive: {
    color: THEME.colors.primaryForeground,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    gap: 8,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInfo: {
    flex: 1,
    gap: 3,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  resultSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textMuted,
  },
  resultAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.text,
    marginRight: 4,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  emptySubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textMuted,
    textAlign: 'center',
    maxWidth: 240,
  },
});
