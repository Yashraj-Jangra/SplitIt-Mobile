import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { QuantumSpinner } from '../../../src/components/brand/QuantumLogo';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  UserPlus,
  Archive,
  RotateCcw,
  Trash2,
  Check,
  Search,
  X,
  Sliders,
  DollarSign,
  Lock,
  UserMinus,
} from 'lucide-react-native';
import { THEME } from '../../../src/constants/theme';
import { groupService, GroupDetailData, GroupMember, RegisteredUser } from '../../../src/services/group.service';
import { authService, AuthUser } from '../../../src/services/auth.service';
import { settingsService, FALLBACK_GROUP_COVER_IMAGES } from '../../../src/services/settings.service';
import { useAppTheme } from '../../../src/contexts/theme.context';
import { haptics } from '../../../src/services/haptics.service';
import { BottomSheetModal } from '../../../src/components/common/BottomSheetModal';
import { SetBudgetModal } from '../../../src/components/groups/SetBudgetModal';

export default function GroupSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentAccent } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const targetId = Array.isArray(id) ? id[0] : (id || '1');

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [group, setGroup] = useState<GroupDetailData | null>(() =>
    groupService.getInMemoryGroupDetail(targetId)
  );
  const [groupName, setGroupName] = useState(() => group?.name || '');
  const [groupDescription, setGroupDescription] = useState(() => group?.description || '');
  const [coverOptions, setCoverOptions] = useState<string[]>(() =>
    settingsService.getCachedGroupCoverImages()
  );
  const [selectedCover, setSelectedCover] = useState<string>(
    () =>
      group?.coverImageUrl ||
      settingsService.getCachedGroupCoverImages()[0] ||
      FALLBACK_GROUP_COVER_IMAGES[0]
  );
  const [isLoading, setIsLoading] = useState(!group);
  const [isSaving, setIsSaving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modals state
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);

  // Add Member state
  const [allUsers, setAllUsers] = useState<RegisteredUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNewMembers, setSelectedNewMembers] = useState<RegisteredUser[]>([]);
  const [isSubmittingMembers, setIsSubmittingMembers] = useState(false);

  const refreshGroup = useCallback(async () => {
    const data = await groupService.getGroupDetails(targetId, { forceRefresh: true });
    if (data) {
      setGroup(data);
      setGroupName(data.name);
      setGroupDescription(data.description || '');
      setSelectedCover(
        data.coverImageUrl ||
          settingsService.getCachedGroupCoverImages()[0] ||
          FALLBACK_GROUP_COVER_IMAGES[0]
      );
    }
  }, [targetId]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const user = await authService.getCachedUser();
      if (isMounted) setCurrentUser(user);

      // Load admin-configured group covers from site settings
      try {
        const dynamicCovers = await settingsService.getGroupCoverImages();
        if (isMounted && dynamicCovers.length > 0) {
          setCoverOptions(dynamicCovers);
        }
      } catch {
        // Fallback provided
      }

      const data = await groupService.getGroupDetails(targetId);
      if (isMounted && data) {
        setGroup(data);
        setGroupName(data.name);
        setGroupDescription(data.description || '');
        setSelectedCover(
          data.coverImageUrl ||
            settingsService.getCachedGroupCoverImages()[0] ||
            FALLBACK_GROUP_COVER_IMAGES[0]
        );
        setIsLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [targetId]);

  // Load registered users when Add Member sheet opens
  useEffect(() => {
    if (isAddMemberOpen && allUsers.length === 0) {
      setLoadingUsers(true);
      groupService
        .getAllRegisteredUsers()
        .then((users) => {
          setAllUsers(users);
        })
        .finally(() => {
          setLoadingUsers(false);
        });
    }
    if (!isAddMemberOpen) {
      setSearchTerm('');
      setSelectedNewMembers([]);
    }
  }, [isAddMemberOpen, allUsers.length]);

  const isCreator = useMemo(() => {
    if (!currentUser || !group) return false;
    return (
      currentUser.id === group.createdById ||
      group.members.some((m) => m.id === currentUser.id && m.isCreator)
    );
  }, [currentUser, group]);

  const isArchived = Boolean(group?.archived || group?.archivedAt);
  const isSettled = useMemo(() => {
    if (!group?.members) return true;
    return group.members.every((m) => Math.abs(m.netBalance || 0) < 0.01);
  }, [group?.members]);

  const existingMemberIds = useMemo(() => {
    return new Set(group?.members.map((m) => m.id) || []);
  }, [group?.members]);

  const memberSearchResults = useMemo(() => {
    const trimmed = searchTerm.trim().toLowerCase();
    if (trimmed.length < 1) return [];
    const selectedIds = new Set(selectedNewMembers.map((m) => m.id));

    return allUsers
      .filter((u) => {
        if (existingMemberIds.has(u.id) || selectedIds.has(u.id)) return false;
        return (
          u.name.toLowerCase().includes(trimmed) ||
          u.username.toLowerCase().includes(trimmed) ||
          u.email.toLowerCase().includes(trimmed)
        );
      })
      .slice(0, 6);
  }, [searchTerm, allUsers, existingMemberIds, selectedNewMembers]);

  const handleSelectNewMember = (user: RegisteredUser) => {
    haptics.tap();
    setSelectedNewMembers((prev) => [...prev, user]);
    setSearchTerm('');
  };

  const handleRemoveNewMember = (userId: string) => {
    haptics.tap();
    setSelectedNewMembers((prev) => prev.filter((m) => m.id !== userId));
  };

  const handleAddMembersSubmit = async () => {
    if (selectedNewMembers.length === 0) return;
    setIsSubmittingMembers(true);
    haptics.confirm();
    try {
      await groupService.addMembersToGroup(
        targetId,
        selectedNewMembers.map((m) => m.id)
      );
      haptics.saveSuccess();
      setIsAddMemberOpen(false);
      await refreshGroup();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add members.');
      haptics.warning();
    } finally {
      setIsSubmittingMembers(false);
    }
  };

  const handleSave = async () => {
    if (!groupName.trim() || isSaving || isArchived) return;
    if (groupName.trim().length < 3) {
      Alert.alert('Invalid Name', 'Group name must be at least 3 characters.');
      return;
    }
    setIsSaving(true);
    haptics.confirm();
    try {
      await groupService.updateGroup(targetId, {
        name: groupName.trim(),
        description: groupDescription.trim(),
        coverImageUrl: selectedCover,
      });
      haptics.saveSuccess();
      await refreshGroup();
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveMember = (member: GroupMember) => {
    if (member.isCreator || member.id === group?.createdById) {
      Alert.alert('Cannot Remove', 'The group creator cannot be removed from the group.');
      return;
    }
    if (Math.abs(member.netBalance || 0) >= 0.01) {
      Alert.alert(
        'Cannot Remove Member',
        `All debts must be settled before removing ${member.name}. Member has an unsettled balance of ₹${Math.abs(member.netBalance).toLocaleString('en-IN')}.`
      );
      return;
    }

    Alert.alert(
      `Remove ${member.name}?`,
      'Are you sure you want to remove this member? They will lose access to this group.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              haptics.warning();
              await groupService.removeMemberFromGroup(targetId, member.id);
              haptics.saveSuccess();
              await refreshGroup();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to remove member.');
            }
          },
        },
      ]
    );
  };

  const handleArchive = () => {
    if (!isSettled) {
      Alert.alert(
        'Cannot Archive Group',
        'All debts must be settled before you can archive the group.'
      );
      return;
    }
    if (!isCreator) {
      Alert.alert(
        'Action Not Allowed',
        `Only the group creator can archive this group.`
      );
      return;
    }

    Alert.alert(
      'Archive Group',
      `Are you sure you want to archive "${groupName}"? It will become read-only.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'default',
          onPress: async () => {
            setIsArchiving(true);
            try {
              await groupService.archiveGroup(targetId);
              haptics.saveSuccess();
              router.replace('/(tabs)/groups');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to archive group.');
            } finally {
              setIsArchiving(false);
            }
          },
        },
      ]
    );
  };

  const handleRestore = () => {
    if (!isCreator) {
      Alert.alert('Action Not Allowed', 'Only the group creator can restore this group.');
      return;
    }

    Alert.alert(
      'Restore Group',
      `Restore "${groupName}" to active status?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'default',
          onPress: async () => {
            setIsArchiving(true);
            try {
              await groupService.restoreGroup(targetId);
              haptics.saveSuccess();
              await refreshGroup();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to restore group.');
            } finally {
              setIsArchiving(false);
            }
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    if (!isCreator) {
      Alert.alert('Action Not Allowed', 'Only the group creator can permanently delete this group.');
      return;
    }

    Alert.alert(
      'Delete Group Permanently',
      `Are you sure you want to permanently delete "${groupName}" and all associated expenses and records? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await groupService.deleteGroup(targetId);
              haptics.saveSuccess();
              router.replace('/(tabs)/groups');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete group.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.loadingContainer}>
          <QuantumSpinner size={36} color={currentAccent.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          style={styles.iconButton}
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <ArrowLeft size={20} color={THEME.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Group Settings
        </Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving || isArchived || !isCreator}
          style={[
            styles.saveButton,
            { backgroundColor: currentAccent.primary },
            (isSaving || isArchived || !isCreator) && { opacity: 0.5 },
          ]}
          accessibilityLabel="Save Changes"
          accessibilityRole="button"
        >
          {isSaving ? (
            <QuantumSpinner size={18} color={THEME.colors.primaryForeground} />
          ) : (
            <Check size={18} color={THEME.colors.primaryForeground} />
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={0}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Archived Banner if applicable */}
          {isArchived && (
            <View style={styles.archivedBanner}>
              <Lock size={16} color={THEME.colors.warning} />
              <Text style={styles.archivedBannerText}>
                This group is archived and is in read-only mode.
              </Text>
            </View>
          )}

          {/* General Settings Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>GENERAL SETTINGS</Text>
              <Text style={styles.cardSubtitle}>
                Update group name and purpose description.
              </Text>
            </View>

            <View style={styles.inputField}>
              <Text style={styles.fieldLabel}>GROUP NAME</Text>
              <TextInput
                style={styles.textInput}
                value={groupName}
                onChangeText={setGroupName}
                placeholder="Group Name"
                placeholderTextColor={THEME.colors.textMuted}
                editable={!isArchived && isCreator}
                maxLength={50}
              />
            </View>

            <View style={styles.inputField}>
              <Text style={styles.fieldLabel}>DESCRIPTION (OPTIONAL)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={groupDescription}
                onChangeText={setGroupDescription}
                placeholder="A brief description of this group's purpose"
                placeholderTextColor={THEME.colors.textMuted}
                editable={!isArchived && isCreator}
                multiline
                numberOfLines={3}
                maxLength={200}
              />
            </View>

            {/* Cover Image Selector */}
            <View style={styles.inputField}>
              <View style={styles.coverHeaderRow}>
                <Text style={styles.fieldLabel}>COVER IMAGE</Text>
                <Text style={styles.coverSubtitle}>Admin Presets</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.coverRow}
              >
                {coverOptions.map((url, idx) => {
                  const isSelected = selectedCover === url;
                  return (
                    <TouchableOpacity
                      key={`${url}-${idx}`}
                      style={[styles.coverCard, isSelected && [styles.coverCardSelected, { borderColor: currentAccent.primary }]]}
                      onPress={() => {
                        if (!isArchived && isCreator) {
                          haptics.tap();
                          setSelectedCover(url);
                        }
                      }}
                      disabled={isArchived || !isCreator}
                      activeOpacity={0.8}
                      accessibilityLabel={`Cover option ${idx + 1}`}
                      accessibilityRole="button"
                    >
                      <Image source={{ uri: url }} style={styles.coverImage} />
                      {isSelected && (
                        <View style={[styles.coverCheckBadge, { backgroundColor: currentAccent.primary }]}>
                          <Check size={12} color="#FFFFFF" strokeWidth={3} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {isCreator && !isArchived && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: currentAccent.primary }, isSaving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <QuantumSpinner size={18} color={THEME.colors.primaryForeground} />
                ) : (
                  <Text style={styles.actionBtnText}>Save Details</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Monthly Budget Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.budgetHeaderRow}>
                <View style={styles.budgetHeaderInfo}>
                  <Text style={styles.cardTitle}>MONTHLY BUDGET</Text>
                  <Text style={styles.cardSubtitle}>
                    Configure spending targets and alert thresholds for this group.
                  </Text>
                </View>
                {group?.budget?.enabled && (
                  <View style={[styles.budgetPill, { backgroundColor: currentAccent.primaryMuted, borderColor: currentAccent.borderFocus }]}>
                    <Text style={[styles.budgetPillText, { color: currentAccent.primary }]}>
                      ₹{Number(group.budget.monthlyLimit).toLocaleString('en-IN')}/mo
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <Text style={styles.bodyDescription}>
              {group?.budget?.enabled
                ? `Budget tracking is active with a monthly target of ₹${Number(
                    group.budget.monthlyLimit
                  ).toLocaleString('en-IN')}.`
                : 'No budget target is currently active for this group.'}
            </Text>

            <TouchableOpacity
              style={styles.outlineBtn}
              onPress={() => {
                haptics.tap();
                setIsBudgetModalOpen(true);
              }}
              disabled={!isCreator || isArchived}
            >
              <Sliders size={15} color={currentAccent.primary} />
              <Text style={[styles.outlineBtnText, { color: currentAccent.primary }]}>
                {group?.budget?.enabled ? 'Modify Budget' : 'Configure Budget'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Members Management Card */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.cardTitle}>
                  GROUP MEMBERS ({group?.members.length || 0})
                </Text>
                <Text style={styles.cardSubtitle}>
                  People sharing expenses in this group.
                </Text>
              </View>
              {isCreator && !isArchived && (
                <TouchableOpacity
                  style={[styles.addMemberBtn, { backgroundColor: currentAccent.primaryMuted, borderColor: currentAccent.borderFocus }]}
                  onPress={() => {
                    haptics.tap();
                    setIsAddMemberOpen(true);
                  }}
                >
                  <UserPlus size={14} color={currentAccent.primary} />
                  <Text style={[styles.addMemberBtnText, { color: currentAccent.primary }]}>Add Member</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.membersList}>
              {group?.members.map((m, idx) => {
                const isViewer = m.id === currentUser?.id;
                const canRemove =
                  isCreator && !m.isCreator && m.id !== group.createdById && !isArchived;

                return (
                  <View
                    key={m.id}
                    style={[styles.memberRow, idx > 0 && styles.memberRowBorder]}
                  >
                    {m.avatarUrl ? (
                      <Image source={{ uri: m.avatarUrl }} style={styles.memberAvatar} />
                    ) : (
                      <View style={styles.memberAvatarPlaceholder}>
                        <Text style={styles.memberAvatarText}>
                          {m.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <View style={styles.memberInfo}>
                      <View style={styles.memberNameRow}>
                        <Text style={styles.memberName} numberOfLines={1}>
                          {m.name}
                        </Text>
                        {m.isCreator && (
                          <View style={[styles.creatorTag, { backgroundColor: currentAccent.primaryMuted }]}>
                            <Text style={[styles.creatorTagText, { color: currentAccent.primary }]}>Creator</Text>
                          </View>
                        )}
                        {isViewer && !m.isCreator && (
                          <View style={styles.youTag}>
                            <Text style={styles.youTagText}>You</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.memberEmail} numberOfLines={1}>
                        {m.email || 'Group Member'}
                      </Text>
                    </View>

                    {/* Net balance display */}
                    <View style={styles.memberBalanceContainer}>
                      <Text
                        style={[
                          styles.memberBalanceText,
                          m.netBalance > 0.01 && styles.positiveBalance,
                          m.netBalance < -0.01 && styles.negativeBalance,
                        ]}
                      >
                        {m.netBalance > 0.01
                          ? `+₹${m.netBalance.toLocaleString('en-IN')}`
                          : m.netBalance < -0.01
                          ? `-₹${Math.abs(m.netBalance).toLocaleString('en-IN')}`
                          : 'Settled'}
                      </Text>
                    </View>

                    {/* Remove Action */}
                    {canRemove && (
                      <TouchableOpacity
                        style={styles.removeActionBtn}
                        onPress={() => handleRemoveMember(m)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <UserMinus size={16} color={THEME.colors.negative} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Danger Zone */}
          <View style={[styles.card, styles.dangerCard]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: THEME.colors.negative }]}>
                DANGER ZONE
              </Text>
              <Text style={styles.cardSubtitle}>
                These actions affect the visibility and accessibility of this group.
              </Text>
            </View>

            {/* Archive or Restore */}
            <View style={styles.dangerActionBlock}>
              <View style={styles.dangerActionInfo}>
                <Text style={styles.dangerActionTitle}>
                  {isArchived ? 'Restore Group' : 'Archive Group'}
                </Text>
                <Text style={styles.dangerActionDesc}>
                  {isArchived
                    ? 'Restore this group to active state and resume adding expenses.'
                    : 'Archiving makes the group read-only. All debts must be settled first.'}
                </Text>
              </View>

              {isArchived ? (
                <TouchableOpacity
                  style={[styles.outlineBtn, styles.restoreBtn, { borderColor: currentAccent.primary }]}
                  onPress={handleRestore}
                  disabled={!isCreator || isArchiving}
                >
                  <RotateCcw size={15} color={currentAccent.primary} />
                  <Text style={[styles.restoreBtnText, { color: currentAccent.primary }]}>Restore Group</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.dangerBtn,
                    (!isSettled || !isCreator || isArchiving) && { opacity: 0.5 },
                  ]}
                  onPress={handleArchive}
                  disabled={!isSettled || !isCreator || isArchiving}
                >
                  <Archive size={15} color={THEME.colors.negative} />
                  <Text style={styles.dangerBtnText}>Archive Group</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Permanent Deletion */}
            {isCreator && (
              <View style={[styles.dangerActionBlock, styles.dangerBorder]}>
                <View style={styles.dangerActionInfo}>
                  <Text style={[styles.dangerActionTitle, { color: THEME.colors.negative }]}>
                    Delete Group Permanently
                  </Text>
                  <Text style={styles.dangerActionDesc}>
                    Permanently delete this group and all its expenses, settlements, and history. This cannot be undone.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.dangerBtn, styles.deleteSolidBtn, isDeleting && { opacity: 0.6 }]}
                  onPress={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <QuantumSpinner size={15} color={THEME.colors.negative} />
                  ) : (
                    <>
                      <Trash2 size={15} color={THEME.colors.negative} />
                      <Text style={styles.dangerBtnText}>Delete Group</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Set Monthly Budget Modal */}
      {group && (
        <SetBudgetModal
          visible={isBudgetModalOpen}
          onClose={() => setIsBudgetModalOpen(false)}
          groupId={targetId}
          groupName={group.name}
          initialBudget={group.budget}
          onSuccess={() => {
            setIsBudgetModalOpen(false);
            refreshGroup();
          }}
        />
      )}

      {/* Add Member Bottom Sheet Modal */}
      <BottomSheetModal
        visible={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        title="Add Members"
        subtitle={`Select registered users to add to "${group?.name || 'Group'}"`}
        maxHeight="85%"
      >
        <View style={styles.sheetContent}>
          {/* Selected chips */}
          {selectedNewMembers.length > 0 && (
            <View style={styles.sheetChipsRow}>
              {selectedNewMembers.map((m) => (
                <View key={m.id} style={styles.sheetChip}>
                  <Text style={styles.sheetChipText}>{m.name}</Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveNewMember(m.id)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <X size={12} color={THEME.colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Search Input */}
          <View style={styles.searchBar}>
            <Search size={16} color={THEME.colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Search by name, @username, or email..."
              placeholderTextColor={THEME.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {loadingUsers && (
              <QuantumSpinner size={16} color={THEME.colors.textMuted} />
            )}
            {!!searchTerm && !loadingUsers && (
              <TouchableOpacity onPress={() => setSearchTerm('')}>
                <X size={16} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Search Results */}
          <ScrollView
            style={styles.sheetResultsList}
            keyboardShouldPersistTaps="handled"
          >
            {memberSearchResults.map((user) => (
              <TouchableOpacity
                key={user.id}
                style={styles.userResultRow}
                onPress={() => handleSelectNewMember(user)}
              >
                {user.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={styles.resultAvatar} />
                ) : (
                  <View style={styles.resultAvatarPlaceholder}>
                    <Text style={styles.resultAvatarText}>
                      {user.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.resultUserInfo}>
                  <Text style={styles.resultUserName}>{user.name}</Text>
                  <Text style={styles.resultUserEmail}>
                    {user.username ? `@${user.username} • ` : ''}
                    {user.email}
                  </Text>
                </View>
                <View style={styles.addMemberBadge}>
                  <Text style={styles.addMemberBadgeText}>Select</Text>
                </View>
              </TouchableOpacity>
            ))}

            {searchTerm.trim().length > 0 && memberSearchResults.length === 0 && !loadingUsers && (
              <View style={styles.noResultsBox}>
                <Text style={styles.noResultsText}>
                  No users found matching "{searchTerm}"
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.actionBtn,
              { backgroundColor: currentAccent.primary },
              (selectedNewMembers.length === 0 || isSubmittingMembers) && {
                opacity: 0.5,
              },
            ]}
            onPress={handleAddMembersSubmit}
            disabled={selectedNewMembers.length === 0 || isSubmittingMembers}
          >
            {isSubmittingMembers ? (
              <QuantumSpinner size={18} color={THEME.colors.primaryForeground} />
            ) : (
              <Text style={styles.actionBtnText}>
                Add {selectedNewMembers.length > 0 ? `${selectedNewMembers.length} ` : ''}Member
                {selectedNewMembers.length > 1 ? 's' : ''}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </BottomSheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.sm,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 20,
  },
  archivedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
    borderRadius: THEME.radius.md,
    padding: 12,
  },
  archivedBannerText: {
    fontSize: 13,
    color: THEME.colors.warning,
    fontWeight: '600',
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 16,
    gap: 14,
  },
  cardHeader: {
    gap: 4,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: THEME.colors.textMuted,
  },
  cardSubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  bodyDescription: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    lineHeight: 18,
  },
  inputField: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: THEME.colors.textMuted,
  },
  textInput: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: THEME.colors.text,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  actionBtn: {
    backgroundColor: THEME.colors.primary,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  actionBtnText: {
    color: THEME.colors.primaryForeground,
    fontSize: 13,
    fontWeight: '700',
  },
  budgetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetHeaderInfo: {
    flex: 1,
    gap: 4,
  },
  budgetPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  budgetPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingVertical: 10,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.surfaceElevated,
  },
  outlineBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  addMemberBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  membersList: {
    gap: 0,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  memberRowBorder: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: THEME.radius.sm,
  },
  memberAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberName: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  creatorTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  creatorTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: THEME.colors.primary,
    textTransform: 'uppercase',
  },
  youTag: {
    backgroundColor: THEME.colors.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  youTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    textTransform: 'uppercase',
  },
  memberEmail: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  memberBalanceContainer: {
    alignItems: 'flex-end',
  },
  memberBalanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  positiveBalance: {
    color: THEME.colors.success,
  },
  negativeBalance: {
    color: THEME.colors.negative,
  },
  removeActionBtn: {
    padding: 6,
    marginLeft: 4,
  },
  dangerCard: {
    borderColor: 'rgba(244, 63, 94, 0.25)',
  },
  dangerActionBlock: {
    gap: 8,
  },
  dangerBorder: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    paddingTop: 12,
  },
  dangerActionInfo: {
    gap: 3,
  },
  dangerActionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  dangerActionDesc: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    lineHeight: 16,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
    paddingVertical: 10,
    borderRadius: THEME.radius.md,
    marginTop: 4,
  },
  deleteSolidBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
  },
  dangerBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.negative,
  },
  restoreBtn: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  restoreBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  sheetContent: {
    gap: 14,
    paddingBottom: 20,
  },
  sheetChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sheetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  sheetChipText: {
    fontSize: 12,
    color: THEME.colors.text,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: THEME.colors.text,
    padding: 0,
  },
  sheetResultsList: {
    maxHeight: 220,
  },
  userResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  resultAvatar: {
    width: 34,
    height: 34,
    borderRadius: THEME.radius.sm,
  },
  resultAvatarPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  resultUserInfo: {
    flex: 1,
  },
  resultUserName: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  resultUserEmail: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  addMemberBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  addMemberBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  noResultsBox: {
    padding: 16,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  coverHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  coverSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  coverRow: {
    gap: 10,
    paddingVertical: 4,
  },
  coverCard: {
    width: 100,
    height: 60,
    borderRadius: THEME.radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    backgroundColor: THEME.colors.surfaceElevated,
  },
  coverCardSelected: {
    borderColor: THEME.colors.primary,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverCheckBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
