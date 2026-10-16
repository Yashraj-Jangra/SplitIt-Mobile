import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
} from 'react-native';
import { Search, Check, RotateCcw, Star } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { GroupListItem, groupService } from '../../services/group.service';
import { BottomSheetModal } from './BottomSheetModal';
import { haptics } from '../../services/haptics.service';

export interface GroupPickerModalProps {
  visible: boolean;
  onClose: () => void;
  groups?: GroupListItem[];
  selectedGroupId: string | null;
  defaultGroupId?: string | null;
  onSelectGroup: (groupId: string | null) => void | Promise<void>;
  title?: string;
  subtitle?: string;
  allowNoneOption?: boolean;
  noneOptionLabel?: string;
  noneOptionSubtitle?: string;
  showDefaultToggle?: boolean;
  isDefaultChecked?: boolean;
  onToggleDefault?: () => void;
}

export const GroupPickerModal: React.FC<GroupPickerModalProps> = ({
  visible,
  onClose,
  groups: propGroups,
  selectedGroupId,
  defaultGroupId,
  onSelectGroup,
  title = 'Choose Group',
  subtitle = 'Select which group to use',
  allowNoneOption = false,
  noneOptionLabel = 'None (Auto-pick most recent)',
  noneOptionSubtitle = 'Automatically uses whichever circle you visited last',
  showDefaultToggle = false,
  isDefaultChecked = false,
  onToggleDefault,
}) => {
  const [search, setSearch] = useState('');
  const [internalGroups, setInternalGroups] = useState<GroupListItem[]>(propGroups || []);

  useEffect(() => {
    if (propGroups && propGroups.length > 0) {
      setInternalGroups(propGroups);
    } else if (visible) {
      // Dynamic fallback to in-memory or cached user groups
      const mem = groupService.getInMemoryGroups();
      if (mem.length > 0) {
        setInternalGroups(mem);
      } else {
        groupService
          .getUserGroups({ skipBalances: true })
          .then((fetched) => {
            if (fetched && fetched.length > 0) {
              setInternalGroups(fetched);
            }
          })
          .catch(() => {});
      }
    }
  }, [propGroups, visible]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return internalGroups;
    return internalGroups.filter((g) => g.name.toLowerCase().includes(q));
  }, [internalGroups, search]);

  const handleSelect = async (id: string | null) => {
    haptics.tap();
    await onSelectGroup(id);
    onClose();
    setSearch('');
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={() => {
        onClose();
        setSearch('');
      }}
      title={title}
      subtitle={subtitle}
      maxHeight="82%"
    >
      {/* Optional "Set as Default" toggle row (for new expense/settle flows) */}
      {showDefaultToggle && (
        <TouchableOpacity
          style={styles.defaultToggleRow}
          onPress={() => {
            haptics.tap();
            onToggleDefault?.();
          }}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.defaultToggleTitle}>Set as default group</Text>
            <Text style={styles.defaultToggleSub}>Auto-select when recording from homescreen</Text>
          </View>
          <Star
            size={18}
            color={isDefaultChecked ? THEME.colors.primary : THEME.colors.textMuted}
            fill={isDefaultChecked ? THEME.colors.primary : 'transparent'}
          />
        </TouchableOpacity>
      )}

      {/* Search Input when 3 or more groups */}
      {internalGroups.length >= 3 && (
        <View style={styles.searchBox}>
          <Search size={15} color={THEME.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your groups..."
            placeholderTextColor={THEME.colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            multiline={false}
            numberOfLines={1}
          />
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
        {/* Optional "None / Auto-pick" option (for settings screen) */}
        {allowNoneOption && (
          <TouchableOpacity
            style={[styles.row, !selectedGroupId && styles.rowActive]}
            onPress={() => handleSelect(null)}
            activeOpacity={0.7}
          >
            <View style={styles.noneGlyph}>
              <RotateCcw size={16} color={THEME.colors.textSecondary} />
            </View>
            <View style={styles.infoCol}>
              <Text style={[styles.name, !selectedGroupId && styles.nameActive]}>
                {noneOptionLabel}
              </Text>
              <Text style={styles.metaText}>{noneOptionSubtitle}</Text>
            </View>
            {!selectedGroupId && (
              <Check size={18} color={THEME.colors.primary} strokeWidth={2.5} />
            )}
          </TouchableOpacity>
        )}

        {filteredGroups.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No groups found</Text>
          </View>
        )}

        {filteredGroups.map((grp, index) => {
          const isSelected = selectedGroupId === grp.id;
          const isDefault = defaultGroupId === grp.id;
          const isLast = index === filteredGroups.length - 1;

          return (
            <TouchableOpacity
              key={grp.id}
              style={[
                styles.row,
                !isLast && styles.rowBorder,
                isSelected && styles.rowActive,
              ]}
              onPress={() => handleSelect(grp.id)}
              activeOpacity={0.7}
            >
              <View style={styles.avatarWrap}>
                {grp.coverImageUrl ? (
                  <Image source={{ uri: grp.coverImageUrl }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarInitial}>{grp.name.charAt(0).toUpperCase()}</Text>
                )}
              </View>
              <View style={styles.infoCol}>
                <View style={styles.nameRow}>
                  <Text style={[styles.name, isSelected && styles.nameActive]} numberOfLines={1}>
                    {grp.name}
                  </Text>
                  {isDefault && (
                    <View style={styles.defaultBadge}>
                      <Star size={9} color={THEME.colors.primary} fill={THEME.colors.primary} />
                      <Text style={styles.defaultBadgeText}>Default</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.metaText}>
                  {grp.membersCount || 0} {grp.membersCount === 1 ? 'member' : 'members'}
                </Text>
              </View>
              {isSelected && (
                <Check size={18} color={THEME.colors.primary} strokeWidth={2.5} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  defaultToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    marginBottom: 12,
  },
  defaultToggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  defaultToggleSub: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: THEME.colors.text,
    paddingVertical: 0,
  },
  listContent: {
    paddingBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.colors.hairline,
  },
  rowActive: {
    backgroundColor: THEME.colors.surfaceElevated,
  },
  noneGlyph: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  infoCol: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  nameActive: {
    color: THEME.colors.primary,
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: THEME.colors.primaryMuted,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  metaText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  emptyWrap: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: THEME.colors.textMuted,
  },
});
