import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
} from 'react-native';
import { Search, Check, RotateCcw } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { GroupListItem } from '../../services/group.service';
import { BottomSheetModal } from './BottomSheetModal';
import { haptics } from '../../services/haptics.service';

export interface GroupPickerModalProps {
  visible: boolean;
  onClose: () => void;
  groups: GroupListItem[];
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string | null) => void | Promise<void>;
  title?: string;
  subtitle?: string;
  allowNoneOption?: boolean;
  noneOptionLabel?: string;
  noneOptionSubtitle?: string;
}

export const GroupPickerModal: React.FC<GroupPickerModalProps> = ({
  visible,
  onClose,
  groups,
  selectedGroupId,
  onSelectGroup,
  title = 'Choose Group',
  subtitle = 'Select which group to use',
  allowNoneOption = false,
  noneOptionLabel = 'None (Auto-pick most recent)',
  noneOptionSubtitle = 'Automatically uses whichever circle you visited last',
}) => {
  const [search, setSearch] = useState('');

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, search]);

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
      {groups.length > 5 && (
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

        {filteredGroups.map((grp) => {
          const isSelected = selectedGroupId === grp.id;

          return (
            <TouchableOpacity
              key={grp.id}
              style={[styles.row, isSelected && styles.rowActive]}
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
                <Text style={[styles.name, isSelected && styles.nameActive]} numberOfLines={1}>
                  {grp.name}
                </Text>
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
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 12,
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
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  nameActive: {
    color: THEME.colors.primary,
  },
  metaText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
});
