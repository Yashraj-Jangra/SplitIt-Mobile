import React, { useState, useRef } from 'react';
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
import { X, Send, HelpCircle } from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { supportService, TicketCategory } from '../../src/services/support.service';
import { haptics } from '../../src/services/haptics.service';

export default function NewSupportTicketModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const messageInputRef = useRef<TextInput>(null);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<TicketCategory>('general');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const categories: { key: TicketCategory; label: string }[] = [
    { key: 'general', label: 'General' },
    { key: 'billing', label: 'Billing / UPI' },
    { key: 'bug', label: 'Report Bug' },
    { key: 'feature', label: 'Feature Request' },
    { key: 'account', label: 'Account Help' },
  ];

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      setErrorMsg('Please enter both subject and message details.');
      haptics.warning();
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    haptics.confirm();

    const result = await supportService.createTicket(subject, category, message);

    setIsSubmitting(false);
    if (result.success) {
      haptics.saveSuccess();
      router.back();
    } else {
      setErrorMsg('Failed to submit ticket. Please check connection.');
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
        >
          <X size={20} color={THEME.colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>New Support Ticket</Text>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitting}
          style={[styles.submitButton, isSubmitting && { opacity: 0.6 }]}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={THEME.colors.primaryForeground} />
          ) : (
            <Send size={18} color={THEME.colors.primaryForeground} />
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

          {/* Category Selector Chips */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>CATEGORY</Text>
            <View style={styles.categoryRow}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.categoryChip,
                    category === cat.key && styles.categoryChipActive,
                  ]}
                  onPress={() => {
                    haptics.tap();
                    setCategory(cat.key);
                  }}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      category === cat.key && styles.categoryChipTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Subject Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>SUBJECT</Text>
            <TextInput
              style={styles.textInput}
              value={subject}
              onChangeText={setSubject}
              placeholder="e.g. Issue settling expense with Google Pay"
              placeholderTextColor={THEME.colors.textMuted}
              returnKeyType="next"
              onSubmitEditing={() => messageInputRef.current?.focus()}
            />
          </View>

          {/* Detailed Message Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>MESSAGE / DESCRIPTION</Text>
            <TextInput
              ref={messageInputRef}
              style={[styles.textInput, styles.textArea]}
              value={message}
              onChangeText={setMessage}
              placeholder="Describe what occurred, including group names or transaction amounts..."
              placeholderTextColor={THEME.colors.textMuted}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.infoCapsule}>
            <HelpCircle size={16} color={THEME.colors.primary} />
            <Text style={styles.infoText}>
              Device metadata and app version will be automatically attached to help resolve your ticket quickly.
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
  submitButton: {
    backgroundColor: THEME.colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
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
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  categoryChipActive: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderColor: THEME.colors.primary,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  categoryChipTextActive: {
    color: THEME.colors.primary,
    fontWeight: '800',
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
  textArea: {
    height: 140,
    paddingTop: 12,
  },
  infoCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.18)',
  },
  infoText: {
    flex: 1,
    fontSize: 11,
    color: THEME.colors.textSecondary,
    lineHeight: 16,
  },
});
