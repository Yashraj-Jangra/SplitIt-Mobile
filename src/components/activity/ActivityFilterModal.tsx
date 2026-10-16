import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  Receipt,
  Handshake,
  Layers,
  Users,
  UserCheck,
  ArrowDownLeft,
  Check,
  RotateCcw,
} from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { BottomSheetModal } from '../common/BottomSheetModal';
import { GroupListItem } from '../../services/group.service';
import { useAppTheme } from '../../contexts/theme.context';
import { haptics } from '../../services/haptics.service';

export interface ActivityFilterModalProps {
  visible: boolean;
  onClose: () => void;
  activeFilter: 'all' | 'expenses' | 'settlements';
  onSelectActiveFilter: (val: 'all' | 'expenses' | 'settlements') => void;
  roleFilter: 'all' | 'paid_by_me' | 'split_with_me';
  onSelectRoleFilter: (val: 'all' | 'paid_by_me' | 'split_with_me') => void;
  selectedGroupId: string;
  onSelectGroup: (groupId: string) => void;
  groups: GroupListItem[];
  filteredCount: number;
  onResetAll: () => void;
}

export const ActivityFilterModal = React.memo(function ActivityFilterModal({
  visible,
  onClose,
  activeFilter,
  onSelectActiveFilter,
  roleFilter,
  onSelectRoleFilter,
  selectedGroupId,
  onSelectGroup,
  groups,
  filteredCount,
  onResetAll,
}: ActivityFilterModalProps) {
  const { currentAccent } = useAppTheme();

  const hasActiveFilters =
    activeFilter !== 'all' || roleFilter !== 'all' || selectedGroupId !== 'all';

  const resetHeaderRight = hasActiveFilters ? (
    <TouchableOpacity
      style={styles.resetBtn}
      onPress={() => {
        haptics.tick();
        onResetAll();
      }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="Reset all filters"
    >
      <RotateCcw size={12} color={currentAccent.primary} />
      <Text style={[styles.resetBtnText, { color: currentAccent.primary }]}>
        Reset
      </Text>
    </TouchableOpacity>
  ) : undefined;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Filter Activity"
      subtitle="Refine transactions by type, role, and circles"
      headerRight={resetHeaderRight}
      maxHeight="86%"
    >
      <ScrollView
        style={styles.modalScroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1: Transaction Type */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionOverline}>TRANSACTION TYPE</Text>
          <View style={styles.chipGrid}>
            <TouchableOpacity
              style={[
                styles.filterChip,
                activeFilter === 'all' && [
                  styles.filterChipActive,
                  {
                    backgroundColor: currentAccent.primaryMuted,
                    borderColor: currentAccent.primary,
                  },
                ],
              ]}
              onPress={() => {
                haptics.tap();
                onSelectActiveFilter('all');
              }}
              activeOpacity={0.7}
            >
              <Layers
                size={16}
                color={
                  activeFilter === 'all'
                    ? currentAccent.primary
                    : THEME.colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.chipText,
                  activeFilter === 'all' && [
                    styles.chipTextActive,
                    { color: currentAccent.primary },
                  ],
                ]}
              >
                All Activity
              </Text>
              {activeFilter === 'all' && (
                <Check size={14} color={currentAccent.primary} style={styles.checkIcon} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                activeFilter === 'expenses' && [
                  styles.filterChipActive,
                  {
                    backgroundColor: currentAccent.primaryMuted,
                    borderColor: currentAccent.primary,
                  },
                ],
              ]}
              onPress={() => {
                haptics.tap();
                onSelectActiveFilter('expenses');
              }}
              activeOpacity={0.7}
            >
              <Receipt
                size={16}
                color={
                  activeFilter === 'expenses'
                    ? currentAccent.primary
                    : THEME.colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.chipText,
                  activeFilter === 'expenses' && [
                    styles.chipTextActive,
                    { color: currentAccent.primary },
                  ],
                ]}
              >
                Expenses
              </Text>
              {activeFilter === 'expenses' && (
                <Check size={14} color={currentAccent.primary} style={styles.checkIcon} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                activeFilter === 'settlements' && [
                  styles.filterChipActive,
                  {
                    backgroundColor: currentAccent.primaryMuted,
                    borderColor: currentAccent.primary,
                  },
                ],
              ]}
              onPress={() => {
                haptics.tap();
                onSelectActiveFilter('settlements');
              }}
              activeOpacity={0.7}
            >
              <Handshake
                size={16}
                color={
                  activeFilter === 'settlements'
                    ? currentAccent.primary
                    : THEME.colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.chipText,
                  activeFilter === 'settlements' && [
                    styles.chipTextActive,
                    { color: currentAccent.primary },
                  ],
                ]}
              >
                Settlements
              </Text>
              {activeFilter === 'settlements' && (
                <Check size={14} color={currentAccent.primary} style={styles.checkIcon} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Section 2: Your Role */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionOverline}>YOUR ROLE</Text>
          <View style={styles.chipGrid}>
            <TouchableOpacity
              style={[
                styles.filterChip,
                roleFilter === 'all' && [
                  styles.filterChipActive,
                  {
                    backgroundColor: currentAccent.primaryMuted,
                    borderColor: currentAccent.primary,
                  },
                ],
              ]}
              onPress={() => {
                haptics.tap();
                onSelectRoleFilter('all');
              }}
              activeOpacity={0.7}
            >
              <Users
                size={16}
                color={
                  roleFilter === 'all'
                    ? currentAccent.primary
                    : THEME.colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.chipText,
                  roleFilter === 'all' && [
                    styles.chipTextActive,
                    { color: currentAccent.primary },
                  ],
                ]}
              >
                All Roles
              </Text>
              {roleFilter === 'all' && (
                <Check size={14} color={currentAccent.primary} style={styles.checkIcon} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                roleFilter === 'paid_by_me' && [
                  styles.filterChipActive,
                  {
                    backgroundColor: currentAccent.primaryMuted,
                    borderColor: currentAccent.primary,
                  },
                ],
              ]}
              onPress={() => {
                haptics.tap();
                onSelectRoleFilter('paid_by_me');
              }}
              activeOpacity={0.7}
            >
              <UserCheck
                size={16}
                color={
                  roleFilter === 'paid_by_me'
                    ? currentAccent.primary
                    : THEME.colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.chipText,
                  roleFilter === 'paid_by_me' && [
                    styles.chipTextActive,
                    { color: currentAccent.primary },
                  ],
                ]}
              >
                Paid by me
              </Text>
              {roleFilter === 'paid_by_me' && (
                <Check size={14} color={currentAccent.primary} style={styles.checkIcon} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                roleFilter === 'split_with_me' && [
                  styles.filterChipActive,
                  {
                    backgroundColor: currentAccent.primaryMuted,
                    borderColor: currentAccent.primary,
                  },
                ],
              ]}
              onPress={() => {
                haptics.tap();
                onSelectRoleFilter('split_with_me');
              }}
              activeOpacity={0.7}
            >
              <ArrowDownLeft
                size={16}
                color={
                  roleFilter === 'split_with_me'
                    ? currentAccent.primary
                    : THEME.colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.chipText,
                  roleFilter === 'split_with_me' && [
                    styles.chipTextActive,
                    { color: currentAccent.primary },
                  ],
                ]}
              >
                Split with me
              </Text>
              {roleFilter === 'split_with_me' && (
                <Check size={14} color={currentAccent.primary} style={styles.checkIcon} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Section 3: Circles / Groups */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionOverline}>CIRCLES & GROUPS</Text>
          <View style={styles.chipGrid}>
            <TouchableOpacity
              style={[
                styles.filterChip,
                selectedGroupId === 'all' && [
                  styles.filterChipActive,
                  {
                    backgroundColor: currentAccent.primaryMuted,
                    borderColor: currentAccent.primary,
                  },
                ],
              ]}
              onPress={() => {
                haptics.tap();
                onSelectGroup('all');
              }}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.circleInitialNode,
                  { backgroundColor: THEME.colors.surfaceElevated },
                ]}
              >
                <Text style={styles.circleInitialText}>∞</Text>
              </View>
              <Text
                style={[
                  styles.chipText,
                  selectedGroupId === 'all' && [
                    styles.chipTextActive,
                    { color: currentAccent.primary },
                  ],
                ]}
              >
                All Circles
              </Text>
              {selectedGroupId === 'all' && (
                <Check size={14} color={currentAccent.primary} style={styles.checkIcon} />
              )}
            </TouchableOpacity>

            {groups.map((group) => {
              const isSelected = selectedGroupId === group.id;
              const initials = (group.name || 'C')
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();

              return (
                <TouchableOpacity
                  key={group.id}
                  style={[
                    styles.filterChip,
                    isSelected && [
                      styles.filterChipActive,
                      {
                        backgroundColor: currentAccent.primaryMuted,
                        borderColor: currentAccent.primary,
                      },
                    ],
                  ]}
                  onPress={() => {
                    haptics.tap();
                    onSelectGroup(isSelected ? 'all' : group.id);
                  }}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.circleInitialNode,
                      {
                        backgroundColor: isSelected
                          ? currentAccent.primary
                          : THEME.colors.surfaceElevated,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.circleInitialText,
                        isSelected && { color: THEME.colors.palette.white },
                      ]}
                    >
                      {initials}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.chipText,
                      isSelected && [
                        styles.chipTextActive,
                        { color: currentAccent.primary },
                      ],
                    ]}
                    numberOfLines={1}
                  >
                    {group.name}
                  </Text>
                  {isSelected && (
                    <Check
                      size={14}
                      color={currentAccent.primary}
                      style={styles.checkIcon}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 16 }} />
      </ScrollView>

      {/* Floating Apply Footer */}
      <View style={styles.footerContainer}>
        <TouchableOpacity
          style={[styles.applyBtn, { backgroundColor: currentAccent.primary }]}
          onPress={() => {
            haptics.saveSuccess();
            onClose();
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.applyBtnText}>
            Show {filteredCount} {filteredCount === 1 ? 'Result' : 'Results'}
          </Text>
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalScroll: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    gap: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  sectionBlock: {
    gap: 10,
  },
  sectionOverline: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
  },
  chipGrid: {
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: THEME.radius.lg,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  filterChipActive: {
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.text,
    flex: 1,
  },
  chipTextActive: {
    fontWeight: '700',
  },
  checkIcon: {
    marginLeft: 'auto',
  },
  circleInitialNode: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleInitialText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
  },
  footerContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.colors.hairline,
    backgroundColor: THEME.colors.surface,
  },
  applyBtn: {
    height: 48,
    borderRadius: THEME.radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  applyBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.palette.white,
    letterSpacing: 0.2,
  },
});
