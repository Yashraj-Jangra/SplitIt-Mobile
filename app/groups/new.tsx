import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, Check, Users, Plus, Trash2, Sparkles } from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { groupService } from '../../src/services/group.service';
import * as Haptics from 'expo-haptics';

export default function NewGroupModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'trip' | 'home' | 'couple' | 'other'>('trip');
  const [currency, setCurrency] = useState<'INR' | 'USD' | 'EUR' | 'GBP'>('INR');
  const [memberInput, setMemberInput] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const categoryTypes = [
    { key: 'trip', label: 'Trip 🏖️' },
    { key: 'home', label: 'Home 🏠' },
    { key: 'couple', label: 'Couple 💑' },
    { key: 'other', label: 'Other 👥' },
  ] as const;

  const currencyOptions = [
    { code: 'INR', symbol: '₹' },
    { code: 'USD', symbol: '$' },
    { code: 'EUR', symbol: '€' },
    { code: 'GBP', symbol: '£' },
  ] as const;

  const handleAddMember = () => {
    const trimmed = memberInput.trim();
    if (!trimmed) return;
    Haptics.selectionAsync();
    setMembers((prev) => [...prev, trimmed]);
    setMemberInput('');
  };

  const handleRemoveMember = (index: number) => {
    Haptics.selectionAsync();
    setMembers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setErrorMsg('Please enter a group name.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const res = await groupService.createGroup({
      name: name.trim(),
      category,
      currency,
      memberEmails: members,
    });

    setIsSubmitting(false);
    if (res.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/groups/${res.id}`);
    } else {
      setErrorMsg('Could not create group. Please check connection.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          style={styles.closeButton}
        >
          <X size={20} color={THEME.colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Create New Group</Text>
        <TouchableOpacity
          onPress={handleCreate}
          disabled={isSubmitting}
          style={[styles.saveButton, isSubmitting && { opacity: 0.6 }]}
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
              onChangeText={setName}
              placeholder="e.g. Apartment Flatmates 🏠"
              placeholderTextColor={THEME.colors.textMuted}
              returnKeyType="done"
            />
          </View>

          {/* Type Selector */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>TYPE</Text>
            <View style={styles.pillRow}>
              {categoryTypes.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.pillButton,
                    category === item.key && styles.pillButtonActive,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setCategory(item.key);
                  }}
                >
                  <Text
                    style={[
                      styles.pillText,
                      category === item.key && styles.pillTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Currency Selector */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>CURRENCY</Text>
            <View style={styles.pillRow}>
              {currencyOptions.map((item) => (
                <TouchableOpacity
                  key={item.code}
                  style={[
                    styles.pillButton,
                    currency === item.code && styles.pillButtonActive,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setCurrency(item.code);
                  }}
                >
                  <Text
                    style={[
                      styles.pillText,
                      currency === item.code && styles.pillTextActive,
                    ]}
                  >
                    {item.symbol} {item.code}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Members Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>INVITE MEMBERS (BY EMAIL OR USERNAME)</Text>
            <View style={styles.addMemberRow}>
              <TextInput
                style={styles.memberInput}
                value={memberInput}
                onChangeText={setMemberInput}
                placeholder="friend@email.com"
                placeholderTextColor={THEME.colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="done"
                onSubmitEditing={handleAddMember}
              />
              <TouchableOpacity style={styles.addBtn} onPress={handleAddMember}>
                <Plus size={18} color={THEME.colors.primaryForeground} />
              </TouchableOpacity>
            </View>

            <View style={styles.membersList}>
              <View style={styles.memberBadge}>
                <Text style={styles.memberBadgeText}>You (Organizer)</Text>
              </View>
              {members.map((m, index) => (
                <View key={index} style={styles.memberBadge}>
                  <Text style={styles.memberBadgeText}>{m}</Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveMember(index)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={12} color={THEME.colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.aiTip}>
            <Sparkles size={16} color={THEME.colors.aiLight} />
            <Text style={styles.aiTipText}>
              SplitIt AI will automatically track budget pacing and suggest debt simplifications once expenses are added.
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
    paddingHorizontal: 12,
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
    padding: 6,
    borderRadius: THEME.radius.sm,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 18,
  },
  errorBanner: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
    padding: 12,
    borderRadius: THEME.radius.sm,
  },
  errorText: {
    color: THEME.colors.negative,
    fontSize: 13,
    fontWeight: '600',
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
  heroInput: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.text,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  pillRow: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surface,
    padding: 4,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: 4,
  },
  pillButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: THEME.radius.sm,
  },
  pillButtonActive: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  pillTextActive: {
    color: THEME.colors.text,
    fontWeight: '700',
  },
  addMemberRow: {
    flexDirection: 'row',
    gap: 8,
  },
  memberInput: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: THEME.colors.text,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  membersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
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
  memberBadgeText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  aiTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  aiTipText: {
    flex: 1,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    lineHeight: 17,
  },
});
