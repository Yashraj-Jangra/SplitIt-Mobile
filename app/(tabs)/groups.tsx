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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Users,
  Plus,
  Search,
  X,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { groupService, GroupListItem } from '../../src/services/group.service';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

type FilterType = 'all' | 'owed' | 'owe' | 'archived';

export default function GroupsScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const loadGroups = async () => {
    try {
      const data = await groupService.getUserGroups();
      setGroups(data);
    } catch {
      // Fallback
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

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
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
  }, [groups, activeFilter, searchQuery]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Editorial Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Groups</Text>
          <Text style={styles.subtitle}>{groups.length} active circles</Text>
        </View>

        <TouchableOpacity
          style={styles.createButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/groups/new');
          }}
          activeOpacity={0.8}
        >
          <Plus size={18} color="#000000" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {/* Spotlight Search Input */}
      <View style={styles.searchBar}>
        <Search size={16} color={THEME.colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search trips, flatmates, dinners..."
          placeholderTextColor={THEME.colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              setSearchQuery('');
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={15} color={THEME.colors.textMuted} />
          </TouchableOpacity>
        )}
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
              style={[styles.filterPill, isActive && styles.filterPillActive]}
              activeOpacity={0.7}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveFilter(pill.id as FilterType);
              }}
            >
              <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                {pill.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Main Groups List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
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
                  style={styles.emptyCtaBtn}
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
                    Haptics.selectionAsync();
                    router.push(`/groups/${group.id}`);
                  }}
                >
                  {/* Photo Cover Backdrop */}
                  <Image
                    source={{
                      uri:
                        group.coverImageUrl ||
                        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1200&auto=format&fit=crop',
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
                        isOwed && styles.balancePillOwed,
                        isOwe && styles.balancePillOwe,
                      ]}
                    >
                      {isOwed ? (
                        <ArrowDownLeft size={11} color={THEME.colors.primary} />
                      ) : isOwe ? (
                        <ArrowUpRight size={11} color={THEME.colors.negative} />
                      ) : null}
                      <Text
                        style={[
                          styles.balancePillText,
                          isOwed && { color: THEME.colors.primary },
                          isOwe && { color: THEME.colors.negative },
                        ]}
                      >
                        {isOwed
                          ? `+₹${group.userNetBalance.toLocaleString('en-IN')}`
                          : isOwe
                          ? `-₹${Math.abs(group.userNetBalance).toLocaleString('en-IN')}`
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
                        ₹{(group.totalExpenses || 0).toLocaleString('en-IN')} spent
                      </Text>
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
    paddingHorizontal: 20,
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

  // Spotlight Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.colors.surface,
    marginHorizontal: 20,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: THEME.colors.text,
    paddingVertical: 0,
  },

  // Filter Pills
  filterPillsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
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
    paddingHorizontal: 20,
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
    color: '#FFFFFF',
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
    borderColor: '#000000',
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
    color: '#000000',
  },
});
