import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Users, Plus, ChevronRight } from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

export default function GroupsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<'active' | 'archived'>('active');

  const groups = [
    { id: '1', name: 'Goa Trip 🏖️', members: 4, balance: 3400, type: 'positive' },
    { id: '2', name: 'Apartment Flatmates 🏠', members: 3, balance: -1250, type: 'negative' },
    { id: '3', name: 'Weekend Treks ⛰️', members: 6, balance: 0, type: 'settled' },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Groups</Text>
        <TouchableOpacity
          style={styles.newGroupButton}
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
        >
          <Plus size={16} color="#FFFFFF" />
          <Text style={styles.newGroupText}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Segmented Filter */}
      <View style={styles.segmentedFilter}>
        <TouchableOpacity
          style={[styles.segment, filter === 'active' && styles.segmentActive]}
          onPress={() => setFilter('active')}
        >
          <Text style={[styles.segmentText, filter === 'active' && styles.segmentTextActive]}>
            Active Groups
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, filter === 'archived' && styles.segmentActive]}
          onPress={() => setFilter('archived')}
        >
          <Text style={[styles.segmentText, filter === 'archived' && styles.segmentTextActive]}>
            Archived
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.listContent}>
        {groups.map((group) => (
          <TouchableOpacity
            key={group.id}
            style={styles.groupCard}
            onPress={() => {
              Haptics.selectionAsync();
              router.push(`/groups/${group.id}`);
            }}
          >
            <View style={styles.groupAvatar}>
              <Users size={20} color={THEME.colors.primaryLight} />
            </View>
            <View style={styles.groupDetails}>
              <Text style={styles.groupName}>{group.name}</Text>
              <Text style={styles.groupSubtitle}>{group.members} members</Text>
            </View>
            <View style={styles.balanceContainer}>
              {group.type === 'positive' && (
                <Text style={[styles.balanceAmount, { color: THEME.colors.primary }]}>
                  +₹{group.balance}
                </Text>
              )}
              {group.type === 'negative' && (
                <Text style={[styles.balanceAmount, { color: THEME.colors.negative }]}>
                  -₹{Math.abs(group.balance)}
                </Text>
              )}
              {group.type === 'settled' && (
                <Text style={[styles.balanceAmount, { color: THEME.colors.textMuted }]}>
                  Settled
                </Text>
              )}
              <ChevronRight size={16} color={THEME.colors.textMuted} />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
    paddingVertical: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: THEME.colors.text,
  },
  newGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.sm,
  },
  newGroupText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#09090B',
  },
  segmentedFilter: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: THEME.colors.surface,
    padding: 3,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: THEME.radius.sm,
  },
  segmentActive: {
    backgroundColor: THEME.colors.surfaceElevated,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  segmentTextActive: {
    color: THEME.colors.text,
  },
  listContent: {
    paddingHorizontal: 20,
    gap: 10,
    paddingBottom: 24,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    padding: 14,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  groupAvatar: {
    width: 44,
    height: 44,
    borderRadius: THEME.radius.md,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  groupDetails: {
    flex: 1,
  },
  groupName: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.text,
    marginBottom: 3,
  },
  groupSubtitle: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  balanceAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
});
