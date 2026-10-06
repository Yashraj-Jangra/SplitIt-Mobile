import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, UserPlus, Archive, Trash2, Check } from 'lucide-react-native';
import { THEME } from '../../../src/constants/theme';
import { groupService } from '../../../src/services/group.service';
import * as Haptics from 'expo-haptics';

export default function GroupSettingsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const targetId = Array.isArray(id) ? id[0] : (id || '1');
  const inMem = groupService.getInMemoryGroupDetail(targetId);
  const [groupName, setGroupName] = useState(() => inMem?.name || '');
  const [members, setMembers] = useState<Array<{ id: string; name: string; email?: string }>>(() =>
    inMem?.members?.map((m) => ({
      id: m.id,
      name: m.name,
      email: `${m.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
    })) || []
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    groupService.getGroupDetails(targetId).then((g) => {
      if (g) {
        setGroupName(g.name);
        setMembers(
          g.members.map((m) => ({
            id: m.id,
            name: m.name,
            email: `${m.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
          }))
        );
      }
    });
  }, [targetId]);

  const handleSave = async () => {
    if (!groupName.trim() || isSaving) return;
    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await groupService.updateGroup(targetId, { name: groupName.trim() });
    setIsSaving(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const handleArchive = () => {
    if (isArchiving) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Archive Group',
      `Are you sure you want to archive "${groupName}"? It will be moved to archived groups.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'default',
          onPress: async () => {
            setIsArchiving(true);
            await groupService.archiveGroup(targetId);
            setIsArchiving(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.replace('/(tabs)/groups');
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    if (isDeleting) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Delete Group Permanently',
      `Are you sure you want to permanently delete "${groupName}" and all associated expenses? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            await groupService.deleteGroup(targetId);
            setIsDeleting(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.replace('/(tabs)/groups');
          },
        },
      ]
    );
  };

  const handleInvite = () => {
    Haptics.selectionAsync();
    if (typeof (Alert as any).prompt === 'function') {
      (Alert as any).prompt(
        'Invite Member',
        'Enter email address of the person you want to invite:',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Invite',
            onPress: (email?: string) => {
              if (email && email.trim()) {
                const trimmed = email.trim();
                setMembers((prev) => [
                  ...prev,
                  {
                    id: `inv_${Date.now()}`,
                    name: trimmed.split('@')[0],
                    email: trimmed,
                  },
                ]);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            },
          },
        ],
        'plain-text'
      );
    } else {
      Alert.alert('Invite Link Ready', 'Group invite link copied to your clipboard!');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          style={styles.iconButton}
        >
          <ArrowLeft size={20} color={THEME.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Group Settings</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          style={[styles.saveButton, isSaving && { opacity: 0.6 }]}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#09090B" />
          ) : (
            <Check size={18} color="#09090B" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Group Name Field */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>GROUP NAME</Text>
          <TextInput
            style={styles.textInput}
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Group Name"
            placeholderTextColor={THEME.colors.textMuted}
          />
        </View>

        {/* Member Management */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>MEMBERS ({members.length})</Text>
            <TouchableOpacity
              style={styles.addMemberButton}
              onPress={handleInvite}
            >
              <UserPlus size={14} color={THEME.colors.primary} />
              <Text style={styles.addMemberText}>Invite</Text>
            </TouchableOpacity>
          </View>

          {members.map((m, index) => (
            <View key={m.id} style={[styles.memberRow, index > 0 && styles.rowBorder]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{m.name.charAt(0)}</Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{m.name}</Text>
                <Text style={styles.memberEmail}>{m.email}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Danger Zone */}
        <View style={styles.dangerGroup}>
          <TouchableOpacity
            style={[styles.dangerRow, isArchiving && { opacity: 0.6 }]}
            onPress={handleArchive}
            disabled={isArchiving}
          >
            {isArchiving ? (
              <ActivityIndicator size="small" color={THEME.colors.textSecondary} />
            ) : (
              <>
                <Archive size={16} color={THEME.colors.textSecondary} />
                <Text style={styles.dangerText}>Archive Group</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dangerRow, styles.deleteRow, isDeleting && { opacity: 0.6 }]}
            onPress={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={THEME.colors.negative} />
            ) : (
              <>
                <Trash2 size={16} color={THEME.colors.negative} />
                <Text style={[styles.dangerText, { color: THEME.colors.negative }]}>
                  Delete Group Permanently
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  iconButton: {
    padding: 6,
  },
  headerTitle: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.text,
    textAlign: 'left',
  },
  saveButton: {
    backgroundColor: THEME.colors.primary,
    padding: 6,
    borderRadius: THEME.radius.sm,
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 20,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: THEME.colors.textMuted,
  },
  textInput: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: THEME.colors.text,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  sectionCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: THEME.colors.textMuted,
  },
  addMemberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addMemberText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  memberEmail: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  dangerGroup: {
    gap: 10,
    marginTop: 8,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.surface,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  deleteRow: {
    borderColor: 'rgba(244, 63, 94, 0.2)',
    backgroundColor: 'rgba(244, 63, 94, 0.05)',
  },
  dangerText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
});
