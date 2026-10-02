import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Users,
  Plus,
  Search,
  X,
  Clock,
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  ChevronRight,
  Sparkles,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { groupService, GroupListItem } from '../../src/services/group.service';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type SortOption = 'last_usage' | 'name_asc' | 'owed_desc' | 'owes_desc';

export default function GroupsScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'active' | 'archived'>('active');
  const [sortBy, setSortBy] = useState<SortOption>('last_usage');
  const [showSortModal, setShowSortModal] = useState(false);

  const loadGroups = async () => {
    try {
      const data = await groupService.getUserGroups();
      setGroups(data);
    } catch (e) {
      console.warn('Failed to fetch groups:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadGroups();
  };

  const filteredAndSortedGroups = useMemo(() => {
    return groups
      .filter((g) => {
        const matchesFilter = filter === 'active' ? !g.archived : g.archived;
        const matchesSearch =
          searchQuery.trim() === '' ||
          g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (g.description && g.description.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesFilter && matchesSearch;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'name_asc':
            return a.name.localeCompare(b.name);
          case 'owed_desc':
            return (b.userNetBalance || 0) - (a.userNetBalance || 0);
          case 'owes_desc':
            return (a.userNetBalance || 0) - (b.userNetBalance || 0);
          case 'last_usage':
          default:
            return 0;
        }
      });
  }, [groups, filter, searchQuery, sortBy]);

  const getSortLabel = () => {
    switch (sortBy) {
      case 'name_asc':
        return 'Name (A-Z)';
      case 'owed_desc':
        return 'Owed: High to Low';
      case 'owes_desc':
        return 'Owes: High to Low';
      default:
        return 'Last Activity';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My Groups</Text>
          <Text style={styles.subtitle}>Manage your shared expense groups</Text>
        </View>
        <TouchableOpacity
          style={styles.newGroupButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/groups/new');
          }}
          activeOpacity={0.8}
        >
          <Plus size={16} color="#09090B" strokeWidth={2.5} />
          <Text style={styles.newGroupText}>Create</Text>
        </TouchableOpacity>
      </View>

      {/* Search & Sort Controls Bar */}
      <View style={styles.controlsBar}>
        <View style={styles.searchContainer}>
          <Search size={16} color={THEME.colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search groups..."
            placeholderTextColor={THEME.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
              <X size={14} color={THEME.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => {
            Haptics.selectionAsync();
            const order: SortOption[] = ['last_usage', 'name_asc', 'owed_desc', 'owes_desc'];
            const nextIndex = (order.indexOf(sortBy) + 1) % order.length;
            setSortBy(order[nextIndex]);
          }}
          activeOpacity={0.7}
        >
          {sortBy === 'last_usage' && <Clock size={16} color={THEME.colors.primary} />}
          {sortBy === 'name_asc' && <ArrowDownAZ size={16} color={THEME.colors.primary} />}
          {sortBy === 'owed_desc' && <ArrowDownWideNarrow size={16} color="#10B981" />}
          {sortBy === 'owes_desc' && <ArrowUpWideNarrow size={16} color="#F43F5E" />}
          <Text style={styles.sortButtonText}>{getSortLabel()}</Text>
        </TouchableOpacity>
      </View>

      {/* Segmented Filter Pills */}
      <View style={styles.segmentedContainer}>
        <TouchableOpacity
          style={[styles.segmentTab, filter === 'active' && styles.segmentTabActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setFilter('active');
          }}
        >
          <Text style={[styles.segmentLabel, filter === 'active' && styles.segmentLabelActive]}>
            Active Groups ({groups.filter((g) => !g.archived).length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentTab, filter === 'archived' && styles.segmentTabActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setFilter('archived');
          }}
        >
          <Text style={[styles.segmentLabel, filter === 'archived' && styles.segmentLabelActive]}>
            Archived ({groups.filter((g) => g.archived).length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Group Cards List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
          <Text style={styles.loadingText}>Loading groups...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={THEME.colors.primary}
            />
          }
        >
          {filteredAndSortedGroups.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <View style={styles.emptyIconCircle}>
                <Users size={32} color={THEME.colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No groups found' : 'No groups yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? `No groups match "${searchQuery}". Try a different keyword.`
                  : 'Groups are where you split rent, trips, or dining bills with friends and roommates.'}
              </Text>
              {!searchQuery && (
                <TouchableOpacity
                  style={styles.emptyCreateButton}
                  onPress={() => router.push('/groups/new')}
                >
                  <Plus size={16} color="#09090B" />
                  <Text style={styles.emptyCreateText}>Create Your First Group</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredAndSortedGroups.map((group) => {
              const net = group.userNetBalance;
              const isOwed = net > 0.01;
              const isDebtor = net < -0.01;
              const isSettled = !isOwed && !isDebtor;

              return (
                <TouchableOpacity
                  key={group.id}
                  style={styles.groupCard}
                  activeOpacity={0.9}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push(`/groups/${group.id}`);
                  }}
                >
                  {/* Full Cover Background Image */}
                  <Image
                    source={{
                      uri:
                        group.coverImageUrl ||
                        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1200&auto=format&fit=crop',
                    }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />

                  {/* Dark Multi-layer Gradient Overlay */}
                  <View style={styles.cardGradientTop} />
                  <View style={styles.cardGradientBottom} />

                  {/* Top Header Badge Row */}
                  <View style={styles.cardTopRow}>
                    <View style={styles.categoryIconBadge}>
                      <Users size={16} color="#FFFFFF" />
                    </View>

                    {/* Net Balance Badge Pill */}
                    <View
                      style={[
                        styles.netBalancePill,
                        isOwed && styles.netBalanceOwed,
                        isDebtor && styles.netBalanceOwes,
                        isSettled && styles.netBalanceSettled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.netBalanceText,
                          isOwed && styles.netBalanceTextOwed,
                          isDebtor && styles.netBalanceTextOwes,
                        ]}
                      >
                        {isOwed && `You're owed ₹${net.toFixed(2)}`}
                        {isDebtor && `You owe ₹${Math.abs(net).toFixed(2)}`}
                        {isSettled && 'Settled up'}
                      </Text>
                    </View>
                  </View>

                  {/* Bottom Content Row */}
                  <View style={styles.cardBottomSection}>
                    <Text style={styles.cardGroupName} numberOfLines={1}>
                      {group.name}
                    </Text>

                    {group.description ? (
                      <Text style={styles.cardDescription} numberOfLines={1}>
                        {group.description}
                      </Text>
                    ) : null}

                    <View style={styles.cardMetaRow}>
                      {/* Overlapping Member Avatars */}
                      <View style={styles.avatarStack}>
                        {group.members.slice(0, 4).map((member, i) => (
                          <View
                            key={member.id || i}
                            style={[styles.memberAvatarContainer, { marginLeft: i > 0 ? -10 : 0 }]}
                          >
                            {member.avatarUrl ? (
                              <Image source={{ uri: member.avatarUrl }} style={styles.memberAvatar} />
                            ) : (
                              <View style={styles.memberAvatarFallback}>
                                <Text style={styles.avatarFallbackText}>
                                  {member.name.slice(0, 1).toUpperCase()}
                                </Text>
                              </View>
                            )}
                          </View>
                        ))}
                        {group.membersCount > 4 && (
                          <View style={[styles.memberAvatarContainer, styles.overflowAvatar, { marginLeft: -10 }]}>
                            <Text style={styles.overflowAvatarText}>+{group.membersCount - 4}</Text>
                          </View>
                        )}
                      </View>

                      {/* Total Spent Glass Pill */}
                      <View style={styles.totalSpentBadge}>
                        <Text style={styles.totalSpentText}>
                          ₹{group.totalExpenses.toLocaleString('en-IN')} spent
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
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
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  newGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: THEME.radius.md,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  newGroupText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#09090B',
  },
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: THEME.colors.text,
    fontSize: 13,
  },
  clearSearchBtn: {
    padding: 4,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  segmentedContainer: {
    flexDirection: 'row',
    marginHorizontal: 18,
    marginBottom: 14,
    backgroundColor: THEME.colors.surface,
    padding: 3,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: THEME.radius.sm,
  },
  segmentTabActive: {
    backgroundColor: THEME.colors.surfaceElevated,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  segmentLabelActive: {
    color: THEME.colors.text,
    fontWeight: '800',
  },
  scrollList: {
    paddingHorizontal: 18,
    paddingBottom: 24,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  groupCard: {
    width: '100%',
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'space-between',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  cardGradientTop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  cardGradientBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
    backgroundColor: 'rgba(5, 5, 5, 0.88)',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  categoryIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  netBalancePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  netBalanceOwed: {
    backgroundColor: 'rgba(16, 185, 129, 0.88)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  netBalanceOwes: {
    backgroundColor: 'rgba(244, 63, 94, 0.88)',
    borderColor: 'rgba(244, 63, 94, 0.4)',
  },
  netBalanceSettled: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  netBalanceText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FAFAFA',
  },
  netBalanceTextOwed: {
    color: '#FFFFFF',
  },
  netBalanceTextOwes: {
    color: '#FFFFFF',
  },
  cardBottomSection: {
    zIndex: 10,
    gap: 6,
  },
  cardGroupName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  cardDescription: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatarContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#000000',
    overflow: 'hidden',
    backgroundColor: '#27272A',
  },
  memberAvatar: {
    width: '100%',
    height: '100%',
  },
  memberAvatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3F3F46',
  },
  avatarFallbackText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  overflowAvatar: {
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowAvatarText: {
    color: '#A1A1AA',
    fontSize: 9,
    fontWeight: '800',
  },
  totalSpentBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  totalSpentText: {
    color: '#FAFAFA',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    backgroundColor: THEME.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderStyle: 'dashed',
    marginTop: 20,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  emptyCreateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: THEME.radius.md,
  },
  emptyCreateText: {
    color: '#09090B',
    fontSize: 13,
    fontWeight: '800',
  },
});
