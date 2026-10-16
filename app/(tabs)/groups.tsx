import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QuantumSpinner } from '../../src/components/brand/QuantumLogo';
import {
  Users,
  Plus,
  Search,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  ArrowDownAZ,
  ArrowUpAZ,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Check,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { groupService, GroupListItem } from '../../src/services/group.service';
import { expenseService } from '../../src/services/expense.service';
import { balanceService } from '../../src/services/balance.service';
import { storageService, STORAGE_KEYS } from '../../src/services/storage.service';
import { demoService } from '../../src/services/demo.service';
import { MockDataBanner } from '../../src/components/common/MockDataBanner';
import { BottomSheetModal } from '../../src/components/common/BottomSheetModal';
import { useAuth } from '../../src/contexts/auth.context';
import { useRouter, useFocusEffect } from 'expo-router';
import { settingsService, FALLBACK_GROUP_COVER_IMAGES } from '../../src/services/settings.service';
import { haptics } from '../../src/services/haptics.service';
import { useCurrency } from '../../src/contexts/currency.context';
import { useAppTheme } from '../../src/contexts/theme.context';
import { appEventEmitter } from '../../src/services/event-emitter';

type FilterType = 'all' | 'owed' | 'owe' | 'archived';

export type SortOptionType =
  | 'last_usage'
  | 'name_asc'
  | 'name_desc'
  | 'owed_desc'
  | 'owed_asc'
  | 'owes_desc'
  | 'owes_asc';

interface SortOptionItem {
  id: SortOptionType;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  iconColor?: string;
}

const SORT_OPTIONS: SortOptionItem[] = [
  {
    id: 'last_usage',
    label: 'Last Activity',
    description: 'Recently updated or active circles first',
    icon: Clock,
  },
  {
    id: 'name_asc',
    label: 'Name (A–Z)',
    description: 'Alphabetical order from A to Z',
    icon: ArrowDownAZ,
  },
  {
    id: 'name_desc',
    label: 'Name (Z–A)',
    description: 'Reverse alphabetical from Z to A',
    icon: ArrowUpAZ,
  },
  {
    id: 'owed_desc',
    label: 'Owed: High to Low',
    description: 'Circles where you are owed the most',
    icon: ArrowDownWideNarrow,
    iconColor: THEME.colors.primary,
  },
  {
    id: 'owed_asc',
    label: 'Owed: Low to High',
    description: 'Circles where you are owed the least',
    icon: ArrowUpNarrowWide,
    iconColor: THEME.colors.primary,
  },
  {
    id: 'owes_desc',
    label: 'Owes: High to Low',
    description: 'Circles where you owe the most',
    icon: ArrowDownWideNarrow,
    iconColor: THEME.colors.negative,
  },
  {
    id: 'owes_asc',
    label: 'Owes: Low to High',
    description: 'Circles where you owe the least',
    icon: ArrowUpNarrowWide,
    iconColor: THEME.colors.negative,
  },
];

export default function GroupsScreen() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { currencySymbol } = useCurrency();
  const { currentAccent } = useAppTheme();
  const [groups, setGroups] = useState<GroupListItem[]>(() => groupService.getInMemoryGroups());
  const [loading, setLoading] = useState(() => groupService.getInMemoryGroups().length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortOptionType>('last_usage');
  const [showSortModal, setShowSortModal] = useState(false);
  const [isDemoDismissed, setIsDemoDismissed] = useState(() => demoService.isDemoDismissedSync(authUser?.id));

  const isDemoActive =
    !isDemoDismissed &&
    !demoService.isDemoDismissedSync(authUser?.id) &&
    groups.some((g) => g.id.startsWith('demo_'));

  const handleDismissDemo = async () => {
    haptics.saveSuccess();
    const uid = authUser?.id || '';
    setIsDemoDismissed(true);
    await demoService.dismissDemoMode(uid);
    groupService.clearCache();
    expenseService.clearCache();
    balanceService.clearCache();
    await storageService.setItem(STORAGE_KEYS.GROUPS(uid), []);
    await storageService.setItem(STORAGE_KEYS.USER_TRANSACTIONS(uid), []);
    await storageService.setItem(STORAGE_KEYS.BALANCE_SUMMARY(uid), null);
    setGroups([]);
    await loadGroups(true);
  };

  const loadGroups = async (forceRefresh = false) => {
    try {
      const data = await groupService.getUserGroups({ forceRefresh });
      setGroups(data || []);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (!authUser) {
      setGroups([]);
      setLoading(false);
      return;
    }

    const uid = authUser?.id || '';
    if (uid) {
      setIsDemoDismissed(demoService.isDemoDismissedSync(uid));
    }

    storageService.getItem<SortOptionType>(STORAGE_KEYS.GROUPS_SORT_PREFERENCE).then((saved) => {
      if (isMounted && saved && SORT_OPTIONS.some((opt) => opt.id === saved)) {
        setSortBy(saved);
      }
    });

    groupService.getCachedUserGroups(uid).then((cached) => {
      if (isMounted && cached && cached.length > 0) {
        setGroups(cached);
        setLoading(false);
      }
    });

    (async () => {
      try {
        const data = await groupService.getUserGroups({ forceRefresh: false });
        if (isMounted) {
          setGroups(data || []);
        }
      } catch {
        // Fallback
      } finally {
        if (isMounted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [authUser]);

  // Screen focus: background refresh when navigating back to Groups tab
  useFocusEffect(
    useCallback(() => {
      if (!authUser) return;
      loadGroups(false);
    }, [authUser])
  );

  // Global event listener: re-fetch groups whenever groups/expenses/settlements change
  useEffect(() => {
    const unsubscribe = appEventEmitter.on('data-changed', (event) => {
      if (event?.type === 'auth_logout' || !authUser) {
        setGroups([]);
        return;
      }
      loadGroups(true);
    });
    return unsubscribe;
  }, [authUser]);

  const onRefresh = () => {
    setRefreshing(true);
    haptics.tap();
    loadGroups(true);
  };

  const handleSortChange = async (newSort: SortOptionType) => {
    haptics.tap();
    setSortBy(newSort);
    setShowSortModal(false);
    try {
      await storageService.setItem(STORAGE_KEYS.GROUPS_SORT_PREFERENCE, newSort);
    } catch {
      // Non-blocking offline storage
    }
  };

  const renderSortIcon = (type: SortOptionType, size = 18) => {
    switch (type) {
      case 'name_asc':
        return <ArrowDownAZ size={size} color={THEME.colors.text} strokeWidth={2.2} />;
      case 'name_desc':
        return <ArrowUpAZ size={size} color={THEME.colors.text} strokeWidth={2.2} />;
      case 'owed_desc':
        return <ArrowDownWideNarrow size={size} color={currentAccent.primary} strokeWidth={2.2} />;
      case 'owed_asc':
        return <ArrowUpNarrowWide size={size} color={currentAccent.primary} strokeWidth={2.2} />;
      case 'owes_desc':
        return <ArrowDownWideNarrow size={size} color={THEME.colors.negative} strokeWidth={2.2} />;
      case 'owes_asc':
        return <ArrowUpNarrowWide size={size} color={THEME.colors.negative} strokeWidth={2.2} />;
      case 'last_usage':
      default:
        return <Clock size={size} color={THEME.colors.textMuted} strokeWidth={2.2} />;
    }
  };

  const filteredGroups = useMemo(() => {
    const filtered = groups.filter((g) => {
      // Filter tab
      if (activeFilter === 'archived' && !g.archived) return false;
      if (activeFilter !== 'archived' && g.archived) return false;
      if (activeFilter === 'owed' && g.userNetBalance <= 0) return false;
      if (activeFilter === 'owe' && g.userNetBalance >= 0) return false;

      // Search keyword
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        g.name.toLowerCase().includes(q) ||
        (g.description && g.description.toLowerCase().includes(q))
      );
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        case 'name_desc':
          return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
        case 'owed_desc':
          return (b.userNetBalance || 0) - (a.userNetBalance || 0);
        case 'owed_asc':
          return (a.userNetBalance || 0) - (b.userNetBalance || 0);
        case 'owes_desc':
          return (a.userNetBalance || 0) - (b.userNetBalance || 0);
        case 'owes_asc':
          return (b.userNetBalance || 0) - (a.userNetBalance || 0);
        case 'last_usage':
        default: {
          const timeA = a.updatedAt
            ? new Date(a.updatedAt).getTime()
            : a.createdAt
            ? new Date(a.createdAt).getTime()
            : 0;
          const timeB = b.updatedAt
            ? new Date(b.updatedAt).getTime()
            : b.createdAt
            ? new Date(b.createdAt).getTime()
            : 0;
          if (timeA !== timeB) {
            return timeB - timeA;
          }
          return a.name.localeCompare(b.name);
        }
      }
    });
  }, [groups, activeFilter, searchQuery, sortBy]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Editorial Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Groups</Text>
          <Text style={styles.subtitle}>{groups.length} active circles</Text>
        </View>

        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: currentAccent.primary, shadowColor: currentAccent.primary }]}
          onPress={() => {
            haptics.tap();
            router.push('/groups/new');
          }}
          activeOpacity={0.8}
        >
          <Plus size={18} color={THEME.colors.primaryForeground} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {/* Spotlight Search & Sort Row */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Search size={16} color={THEME.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search groups..."
            placeholderTextColor={THEME.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            returnKeyType="search"
            numberOfLines={1}
            multiline={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                haptics.tap();
                setSearchQuery('');
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Clear search"
              accessibilityRole="button"
            >
              <X size={15} color={THEME.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.sortTriggerBtn,
            sortBy !== 'last_usage' && styles.sortTriggerBtnActive,
          ]}
          onPress={() => {
            haptics.tap();
            setShowSortModal(true);
          }}
          activeOpacity={0.7}
          accessibilityLabel={`Sort groups. Currently sorted by ${
            SORT_OPTIONS.find((s) => s.id === sortBy)?.label || 'Last Activity'
          }`}
          accessibilityRole="button"
        >
          {renderSortIcon(sortBy, 19)}
          {sortBy !== 'last_usage' && <View style={[styles.sortActiveIndicator, { backgroundColor: currentAccent.primary }]} />}
        </TouchableOpacity>
      </View>

      {/* Filter Horizontal Pill Strip */}
      <View style={styles.filterPillsRow}>
        {[
          { id: 'all', label: 'All' },
          { id: 'owed', label: 'You are owed' },
          { id: 'owe', label: 'You owe' },
          { id: 'archived', label: 'Archived' },
        ].map((pill) => {
          const isActive = activeFilter === pill.id;
          return (
            <TouchableOpacity
              key={pill.id}
              style={[
                styles.filterPill,
                isActive && {
                  backgroundColor: currentAccent.primaryMuted,
                  borderColor: currentAccent.borderFocus,
                },
              ]}
              activeOpacity={0.7}
              onPress={() => {
                haptics.tap();
                setActiveFilter(pill.id as FilterType);
              }}
            >
              <Text
                style={[
                  styles.filterPillText,
                  isActive && { color: currentAccent.primary, fontWeight: '700' },
                ]}
              >
                {pill.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Main Groups List */}
      {loading && groups.length === 0 ? (
        <View style={styles.loadingContainer}>
          <QuantumSpinner size={36} color={THEME.colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={currentAccent.primary}
            />
          }
        >
          {isDemoActive && (
            <MockDataBanner
              onRemove={handleDismissDemo}
              onCreateGroup={() => {
                haptics.tap();
                router.push('/groups/new');
              }}
            />
          )}

          {filteredGroups.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Users size={30} color={THEME.colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No matching groups' : 'No groups here'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? `No groups found for "${searchQuery}".`
                  : 'Create a group to start splitting expenses with friends.'}
              </Text>
              {!searchQuery && (
                <TouchableOpacity
                  style={[styles.emptyCtaBtn, { backgroundColor: currentAccent.primary }]}
                  onPress={() => router.push('/groups/new')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyCtaText}>Create Group</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredGroups.map((group) => {
              const isOwed = group.userNetBalance > 0.01;
              const isOwe = group.userNetBalance < -0.01;

              return (
                <TouchableOpacity
                  key={group.id}
                  style={styles.cinematicCard}
                  activeOpacity={0.9}
                  onPress={() => {
                    haptics.tap();
                    router.push(`/groups/${group.id}`);
                  }}
                >
                  {/* Photo Cover Backdrop */}
                  <Image
                    source={{
                      uri:
                        group.coverImageUrl ||
                        settingsService.getCachedGroupCoverImages()[0] ||
                        FALLBACK_GROUP_COVER_IMAGES[0],
                    }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />

                  {/* Directional Vignette Gradient Overlay */}
                  <View style={styles.cardGradient} />

                  {/* Top Floating Glass Badge */}
                  <View style={styles.cardTopRow}>
                    <View
                      style={[
                        styles.balanceGlassPill,
                        isOwed && {
                          backgroundColor: currentAccent.primaryMuted,
                          borderColor: currentAccent.borderFocus,
                        },
                        isOwe && styles.balancePillOwe,
                      ]}
                    >
                      {isOwed ? (
                        <ArrowDownLeft size={11} color={currentAccent.primary} />
                      ) : isOwe ? (
                        <ArrowUpRight size={11} color={THEME.colors.negative} />
                      ) : null}
                      <Text
                        style={[
                          styles.balancePillText,
                          isOwed && { color: currentAccent.primary },
                          isOwe && { color: THEME.colors.negative },
                        ]}
                      >
                        {isOwed
                          ? `+${currencySymbol}${group.userNetBalance.toLocaleString('en-IN')}`
                          : isOwe
                          ? `-${currencySymbol}${Math.abs(group.userNetBalance).toLocaleString('en-IN')}`
                          : 'Settled'}
                      </Text>
                    </View>
                  </View>

                  {/* Bottom Content Area */}
                  <View style={styles.cardBottomArea}>
                    <Text style={styles.groupNameText} numberOfLines={1}>
                      {group.name}
                    </Text>

                    {group.description ? (
                      <Text style={styles.groupDescText} numberOfLines={1}>
                        {group.description}
                      </Text>
                    ) : null}

                    <View style={styles.cardFooterRow}>
                      {/* Avatar Circles Stack */}
                      <View style={styles.avatarStack}>
                        {(group.members || []).slice(0, 4).map((member, i) => (
                          <View
                            key={member.id || i}
                            style={[styles.memberAvatarCircle, { marginLeft: i > 0 ? -8 : 0 }]}
                          >
                            {member.avatarUrl ? (
                              <Image source={{ uri: member.avatarUrl }} style={styles.memberAvatarImg} />
                            ) : (
                              <Text style={styles.avatarInitial}>
                                {(member.name || 'M').charAt(0).toUpperCase()}
                              </Text>
                            )}
                          </View>
                        ))}
                        {(group.membersCount || 0) > 4 && (
                          <View style={[styles.memberAvatarCircle, styles.overflowCircle, { marginLeft: -8 }]}>
                            <Text style={styles.overflowText}>+{group.membersCount - 4}</Text>
                          </View>
                        )}
                      </View>

                      {/* Total Spent Stat */}
                      <Text style={styles.totalSpentText}>
                        {currencySymbol}{(group.totalExpenses || 0).toLocaleString('en-IN')} spent
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Sort Groups Bottom Sheet Modal */}
      <BottomSheetModal
        visible={showSortModal}
        onClose={() => setShowSortModal(false)}
        title="Sort Groups"
        subtitle="Choose how your circles are ordered"
        maxHeight="70%"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sortOptionsList}
        >
          {SORT_OPTIONS.map((option) => {
            const isSelected = sortBy === option.id;
            const IconComponent = option.icon;
            const iconColor =
              option.iconColor || (isSelected ? THEME.colors.text : THEME.colors.textMuted);

            return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.sortOptionRow,
                  isSelected && styles.sortOptionRowActive,
                ]}
                activeOpacity={0.7}
                onPress={() => handleSortChange(option.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${option.label}, ${option.description}`}
              >
                <View
                  style={[
                    styles.sortOptionIconBox,
                    isSelected && styles.sortOptionIconBoxActive,
                  ]}
                >
                  <IconComponent
                    size={18}
                    color={iconColor}
                    strokeWidth={isSelected ? 2.5 : 2}
                  />
                </View>

                <View style={styles.sortOptionContent}>
                  <Text
                    style={[
                      styles.sortOptionLabel,
                      isSelected && styles.sortOptionLabelActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text style={styles.sortOptionDesc} numberOfLines={1}>
                    {option.description}
                  </Text>
                </View>

                {isSelected && (
                  <View style={styles.checkIconWrap}>
                    <Check size={16} color={currentAccent.primary} strokeWidth={2.5} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </BottomSheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    fontWeight: '500',
    marginTop: 2,
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },

  // Spotlight Search & Sort Row
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  sortTriggerBtn: {
    width: 44,
    height: 44,
    borderRadius: THEME.radius.lg,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  sortTriggerBtnActive: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderColor: THEME.colors.hairlineLight,
  },
  sortActiveIndicator: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.primary,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: THEME.colors.text,
    paddingVertical: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },

  // Filter Pills
  filterPillsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  filterPillActive: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderColor: THEME.colors.hairlineLight,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  filterPillTextActive: {
    color: THEME.colors.text,
    fontWeight: '700',
  },

  // Scroll List
  scrollList: {
    paddingHorizontal: 12,
    paddingBottom: 36,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Cinematic Cards
  cinematicCard: {
    height: 190,
    borderRadius: THEME.radius['2xl'],
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'space-between',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: THEME.colors.surface,
  },
  cardGradient: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.50)',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  balanceGlassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  balancePillOwed: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  balancePillOwe: {
    backgroundColor: 'rgba(244, 63, 94, 0.16)',
    borderColor: 'rgba(244, 63, 94, 0.35)',
  },
  balancePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.textMuted,
  },

  // Bottom Content
  cardBottomArea: {
    gap: 4,
  },
  groupNameText: {
    fontSize: 19,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.4,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  groupDescText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
    lineHeight: 16,
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatarCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: THEME.colors.palette.black,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  overflowCircle: {
    backgroundColor: THEME.colors.surfaceSubtle,
  },
  overflowText: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.textMuted,
  },
  totalSpentText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.65)',
  },

  // Empty State
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  emptyCtaBtn: {
    marginTop: 8,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: THEME.radius.lg,
  },
  emptyCtaText: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.primaryForeground,
  },

  // Sort Modal & Bottom Sheet
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: THEME.radius['2xl'],
    borderTopRightRadius: THEME.radius['2xl'],
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 36,
    maxHeight: '75%',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: THEME.colors.hairlineLight,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortOptionsList: {
    gap: 8,
    paddingBottom: 8,
  },
  sortOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: THEME.colors.surfaceSubtle,
  },
  sortOptionRowActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  sortOptionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  sortOptionIconBoxActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  sortOptionContent: {
    flex: 1,
    gap: 2,
  },
  sortOptionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  sortOptionLabelActive: {
    color: THEME.colors.primary,
  },
  sortOptionDesc: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  checkIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
