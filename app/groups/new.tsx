import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, Check, Users, Search, Sparkles, CheckCircle2 } from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { groupService, RegisteredUser } from '../../src/services/group.service';
import { authService, AuthUser } from '../../src/services/auth.service';
import { settingsService } from '../../src/services/settings.service';
import { haptics } from '../../src/services/haptics.service';

export default function NewGroupModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverOptions, setCoverOptions] = useState<string[]>(() =>
    settingsService.getCachedGroupCoverImages()
  );
  const [selectedCover, setSelectedCover] = useState<string>(
    () => settingsService.getCachedGroupCoverImages()[0] || ''
  );
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const [allUsers, setAllUsers] = useState<RegisteredUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<RegisteredUser[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const user = await authService.getCachedUser();
      if (isMounted) setCurrentUser(user);

      // Fetch admin-configured group covers from website settings
      try {
        const dynamicCovers = await settingsService.getGroupCoverImages();
        if (isMounted && dynamicCovers.length > 0) {
          setCoverOptions(dynamicCovers);
          setSelectedCover((prev) => (dynamicCovers.includes(prev) ? prev : dynamicCovers[0]));
        }
      } catch {
        // Fallback provided by cached / default
      }

      setLoadingUsers(true);
      try {
        const users = await groupService.getAllRegisteredUsers();
        if (isMounted) setAllUsers(users);
      } finally {
        if (isMounted) setLoadingUsers(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const searchResults = useMemo(() => {
    const trimmed = searchTerm.trim().toLowerCase();
    if (!trimmed) return [];
    const currentId = currentUser?.id || '';
    const selectedIds = new Set(selectedMembers.map((m) => m.id));

    return allUsers
      .filter((u) => {
        if (u.id === currentId || selectedIds.has(u.id)) return false;
        const matchesName = u.name.toLowerCase().includes(trimmed);
        const matchesUsername = u.username.toLowerCase().includes(trimmed);
        const matchesEmail = u.email.toLowerCase().includes(trimmed);
        return matchesName || matchesUsername || matchesEmail;
      })
      .slice(0, 6);
  }, [searchTerm, allUsers, selectedMembers, currentUser]);

  const handleSelectMember = (user: RegisteredUser) => {
    haptics.tap();
    setSelectedMembers((prev) => [...prev, user]);
    setSearchTerm('');
  };

  const handleRemoveMember = (userId: string) => {
    haptics.tap();
    setSelectedMembers((prev) => prev.filter((m) => m.id !== userId));
  };

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg('Please enter a group name.');
      haptics.warning();
      return;
    }
    if (trimmedName.length < 3) {
      setErrorMsg('Group name must be at least 3 characters.');
      haptics.warning();
      return;
    }
    if (trimmedName.length > 50) {
      setErrorMsg('Group name must be less than 50 characters.');
      haptics.warning();
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    haptics.confirm();

    const res = await groupService.createGroup({
      name: trimmedName,
      description: description.trim(),
      memberIds: selectedMembers.map((m) => m.id),
      coverImageUrl: selectedCover,
    });

    setIsSubmitting(false);
    if (res.success && res.id) {
      haptics.groupCreated();
      router.replace(`/groups/${res.id}`);
    } else {
      setErrorMsg(res.error || 'Could not create group. Please check your connection.');
      haptics.warning();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          style={styles.closeButton}
          accessibilityLabel="Cancel"
          accessibilityRole="button"
        >
          <X size={20} color={THEME.colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Create New Group
        </Text>
        <TouchableOpacity
          onPress={handleCreate}
          disabled={isSubmitting}
          style={[styles.saveButton, isSubmitting && { opacity: 0.6 }]}
          accessibilityLabel="Create Group"
          accessibilityRole="button"
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={THEME.colors.primaryForeground} />
          ) : (
            <Check size={20} color={THEME.colors.primaryForeground} />
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 32 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {errorMsg ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Group Name Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>GROUP NAME</Text>
            <TextInput
              style={styles.heroInput}
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (errorMsg) setErrorMsg('');
              }}
              placeholder="e.g. Weekend Trip, Apartment Bills"
              placeholderTextColor={THEME.colors.textMuted}
              returnKeyType="next"
              maxLength={50}
            />
          </View>

          {/* Group Description Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>DESCRIPTION (OPTIONAL)</Text>
            <TextInput
              style={styles.descriptionInput}
              value={description}
              onChangeText={setDescription}
              placeholder="A brief description of this group's purpose"
              placeholderTextColor={THEME.colors.textMuted}
              multiline
              numberOfLines={3}
              maxLength={200}
            />
          </View>

          {/* Cover Image Selector */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>COVER IMAGE</Text>
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
                    style={[styles.coverCard, isSelected && styles.coverCardSelected]}
                    onPress={() => {
                      haptics.tap();
                      setSelectedCover(url);
                    }}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: url }} style={styles.coverImage} />
                    {isSelected && (
                      <View style={styles.coverCheckBadge}>
                        <CheckCircle2 size={16} color={THEME.colors.primary} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Members Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>ADD MEMBERS</Text>

            {/* Selected Members Chips */}
            <View style={styles.membersList}>
              <View style={[styles.memberBadge, styles.creatorBadge]}>
                <View style={styles.miniAvatar}>
                  <Text style={styles.miniAvatarText}>
                    {(currentUser?.name || 'Y').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.memberBadgeText}>
                  {currentUser?.name || 'You'} (Creator)
                </Text>
              </View>

              {selectedMembers.map((m) => (
                <View key={m.id} style={styles.memberBadge}>
                  {m.avatarUrl ? (
                    <Image source={{ uri: m.avatarUrl }} style={styles.miniAvatarImage} />
                  ) : (
                    <View style={styles.miniAvatar}>
                      <Text style={styles.miniAvatarText}>
                        {m.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.memberBadgeText}>{m.name}</Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveMember(m.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.removeChipBtn}
                  >
                    <X size={12} color={THEME.colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Search Input */}
            <View style={styles.searchBar}>
              <Search size={16} color={THEME.colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Search registered users by name or email..."
                placeholderTextColor={THEME.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {loadingUsers && (
                <ActivityIndicator size="small" color={THEME.colors.textMuted} />
              )}
              {!!searchTerm && !loadingUsers && (
                <TouchableOpacity onPress={() => setSearchTerm('')}>
                  <X size={16} color={THEME.colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Search Suggestions Dropdown */}
            {searchResults.length > 0 && (
              <View style={styles.dropdownContainer}>
                {searchResults.map((user, idx) => (
                  <TouchableOpacity
                    key={user.id}
                    style={[
                      styles.userResultRow,
                      idx > 0 && styles.userResultBorder,
                    ]}
                    onPress={() => handleSelectMember(user)}
                    activeOpacity={0.7}
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
                      <Text style={styles.resultUserName} numberOfLines={1}>
                        {user.name}
                      </Text>
                      <Text style={styles.resultUserEmail} numberOfLines={1}>
                        {user.username ? `@${user.username} • ` : ''}{user.email}
                      </Text>
                    </View>
                    <View style={styles.addMemberPlus}>
                      <Text style={styles.addMemberPlusText}>Add</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {searchTerm.trim().length > 0 && searchResults.length === 0 && !loadingUsers && (
              <View style={styles.noResultsBox}>
                <Text style={styles.noResultsText}>
                  No matching registered users found for "{searchTerm}"
                </Text>
              </View>
            )}
          </View>

          <View style={styles.aiTip}>
            <Sparkles size={16} color={THEME.colors.aiLight} />
            <Text style={styles.aiTipText}>
              SplitIt AI will automatically track group spending pacing and calculate debt simplifications across all members.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  closeButton: {
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 20,
  },
  errorBanner: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
    padding: 12,
    borderRadius: THEME.radius.md,
  },
  errorText: {
    color: THEME.colors.negative,
    fontSize: 13,
    fontWeight: '600',
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: THEME.colors.textMuted,
  },
  heroInput: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '600',
    color: THEME.colors.text,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  descriptionInput: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: THEME.colors.text,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    minHeight: 76,
    textAlignVertical: 'top',
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
    backgroundColor: THEME.colors.background,
    borderRadius: THEME.radius.full,
  },
  membersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
  },
  creatorBadge: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  miniAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  miniAvatarImage: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  memberBadgeText: {
    fontSize: 12,
    color: THEME.colors.text,
    fontWeight: '600',
  },
  removeChipBtn: {
    marginLeft: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: THEME.colors.text,
    padding: 0,
  },
  dropdownContainer: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    overflow: 'hidden',
    marginTop: 4,
  },
  userResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  userResultBorder: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  resultAvatar: {
    width: 36,
    height: 36,
    borderRadius: THEME.radius.sm,
  },
  resultAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultAvatarText: {
    fontSize: 14,
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
    marginTop: 2,
  },
  addMemberPlus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  addMemberPlusText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  noResultsBox: {
    padding: 12,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  aiTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  aiTipText: {
    flex: 1,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    lineHeight: 18,
  },
});
