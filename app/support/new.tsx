import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  type TextInputInstance,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { QuantumSpinner } from '../../src/components/brand/QuantumLogo';
import {
  X,
  Send,
  HelpCircle,
  CreditCard,
  Bug,
  Sparkles,
  Shield,
  Clock,
  Cpu,
  Check,
  AlertCircle,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { supportService, TicketCategory } from '../../src/services/support.service';
import { useAppTheme } from '../../src/contexts/theme.context';
import { haptics } from '../../src/services/haptics.service';

interface CategoryOption {
  key: TicketCategory;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  color: string;
}

const CATEGORIES: CategoryOption[] = [
  {
    key: 'billing',
    label: 'Billing & UPI',
    description: 'UPI QR scans, bank settlements, payment sync',
    icon: CreditCard,
    color: THEME.colors.primary,
  },
  {
    key: 'bug',
    label: 'Report a Bug',
    description: 'Unexpected calculation errors or crashes',
    icon: Bug,
    color: THEME.colors.negative,
  },
  {
    key: 'feature',
    label: 'Feature Request',
    description: 'Ideas, missing tools, workflow enhancements',
    icon: Sparkles,
    color: THEME.colors.ai,
  },
  {
    key: 'account',
    label: 'Account Help',
    description: 'Sessions, passkeys, profile data, QR codes',
    icon: Shield,
    color: THEME.colors.info,
  },
  {
    key: 'general',
    label: 'General Inquiry',
    description: 'Questions about SplitIt or group sharing rules',
    icon: HelpCircle,
    color: THEME.colors.textMuted,
  },
];

export default function NewSupportTicketModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentAccent } = useAppTheme();
  const messageInputRef = useRef<TextInputInstance>(null);

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<TicketCategory>('billing');
  const [message, setMessage] = useState('');
  const [attachDiagnostics, setAttachDiagnostics] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const selectedCategoryMeta =
    CATEGORIES.find((c) => c.key === category) || CATEGORIES[0];

  const handleSubmit = async () => {
    if (!subject.trim()) {
      setErrorMsg('Please provide a short descriptive subject for your ticket.');
      haptics.warning();
      return;
    }

    if (subject.trim().length < 5) {
      setErrorMsg('Subject must be at least 5 characters.');
      haptics.warning();
      return;
    }

    if (!message.trim() || message.trim().length < 15) {
      setErrorMsg('Please provide more context in the message (at least 15 characters).');
      haptics.warning();
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    haptics.confirm();

    const appVersion = Constants.expoConfig?.version || '1.1.0';
    const fullMessage = attachDiagnostics
      ? `${message.trim()}\n\n─── System Diagnostics ───\n• Client: SplitIt Mobile v${appVersion}\n• Platform: ${
          Platform.OS
        } (${Platform.Version})\n• Timestamp: ${new Date().toISOString()}`
      : message.trim();

    const result = await supportService.createTicket(subject.trim(), category, fullMessage);

    setIsSubmitting(false);
    if (result.success && result.ticketId) {
      haptics.settleSuccess();
      router.replace({
        pathname: '/support/[id]',
        params: { id: result.ticketId },
      });
    } else {
      setErrorMsg('Failed to submit ticket. Please check your network connection.');
      haptics.error();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          style={styles.closeButton}
          accessibilityLabel="Close new ticket modal"
          accessibilityRole="button"
        >
          <X size={18} color={THEME.colors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerTitle}>New Support Ticket</Text>
          <Text style={styles.headerSubtitle}>Direct channel to our engineering desk</Text>
        </View>

        <View style={styles.headerPlaceholder} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 16) + 80 },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {/* Error Banner */}
          {errorMsg ? (
            <View style={styles.errorBanner}>
              <AlertCircle size={16} color={THEME.colors.negative} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* SLA Expectation Banner */}
          <View style={styles.slaBanner}>
            <Clock size={14} color={currentAccent.primary} />
            <Text style={styles.slaText}>
              Typical reply within <Text style={styles.slaTextBold}>2–4 hours</Text>. You will receive updates directly in this thread.
            </Text>
          </View>

          {/* Category Picker Card Grid */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>SELECT TOPIC / CATEGORY</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.key;
                const IconComponent = cat.icon;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[
                      styles.categoryCard,
                      isSelected && [styles.categoryCardSelected, { borderColor: currentAccent.primary }],
                    ]}
                    onPress={() => {
                      haptics.tap();
                      setCategory(cat.key);
                    }}
                    activeOpacity={0.75}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${cat.label}: ${cat.description}`}
                  >
                    <View style={styles.categoryCardTop}>
                      <View
                        style={[
                          styles.categoryIconWrap,
                          isSelected && { backgroundColor: `${currentAccent.primary}20` },
                        ]}
                      >
                        <IconComponent
                          size={16}
                          color={isSelected ? currentAccent.primary : (cat.key === 'billing' ? currentAccent.primary : cat.color)}
                          strokeWidth={2.2}
                        />
                      </View>
                      {isSelected ? (
                        <View style={styles.checkPill}>
                          <Check size={11} color={currentAccent.primary} strokeWidth={3} />
                        </View>
                      ) : null}
                    </View>

                    <Text
                      style={[
                        styles.categoryCardTitle,
                        isSelected && [styles.categoryCardTitleSelected, { color: currentAccent.primary }],
                      ]}
                    >
                      {cat.label}
                    </Text>
                    <Text style={styles.categoryCardDesc} numberOfLines={2}>
                      {cat.description}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Subject Field */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>SUBJECT</Text>
              <Text style={styles.charCount}>{subject.length}/100</Text>
            </View>
            <View style={styles.textInputWrap}>
              <TextInput
                style={styles.textInput}
                value={subject}
                onChangeText={(text) => {
                  if (text.length <= 100) setSubject(text);
                }}
                placeholder="Brief summary of the issue or question..."
                placeholderTextColor={THEME.colors.textMuted}
                returnKeyType="next"
                onSubmitEditing={() => messageInputRef.current?.focus()}
              />
            </View>
          </View>

          {/* Detailed Message Field */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>DETAILS & STEPS TO REPRODUCE</Text>
              <Text style={styles.charCount}>{message.length}/2000</Text>
            </View>
            <View style={[styles.textInputWrap, styles.textAreaWrap]}>
              <TextInput
                ref={messageInputRef}
                style={[styles.textInput, styles.textArea]}
                value={message}
                onChangeText={setMessage}
                placeholder={`Provide specifics so our team can resolve this immediately:\n• What happened?\n• Group or user involved (if any)\n• Relevant transaction amount or UPI reference`}
                placeholderTextColor={THEME.colors.textMuted}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Diagnostics Card */}
          <View style={styles.diagnosticsCard}>
            <View style={styles.diagIconBadge}>
              <Cpu size={18} color={currentAccent.primary} />
            </View>
            <View style={styles.diagContent}>
              <Text style={styles.diagTitle}>Attach System Diagnostics</Text>
              <Text style={styles.diagSub}>
                Includes SplitIt v{Constants.expoConfig?.version || '1.1.0'}, {Platform.OS} version, and network status to help engineers trace bugs quickly.
              </Text>
            </View>
            <Switch
              value={attachDiagnostics}
              onValueChange={(val) => {
                haptics.toggleSwitch();
                setAttachDiagnostics(val);
              }}
              trackColor={{
                false: THEME.colors.surfaceElevated,
                true: currentAccent.primary,
              }}
              thumbColor={THEME.colors.surface}
            />
          </View>
        </ScrollView>

        {/* Docked Sticky Bottom Submission Bar */}
        <View
          style={[
            styles.bottomStickyBar,
            { paddingBottom: Math.max(insets.bottom, 12) + 4 },
          ]}
        >
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: currentAccent.primary, shadowColor: currentAccent.primary }, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.8}
            accessibilityLabel="Submit support ticket"
            accessibilityRole="button"
          >
            {isSubmitting ? (
              <QuantumSpinner size={18} color={THEME.colors.primaryForeground} />
            ) : (
              <>
                <Send size={16} color={THEME.colors.primaryForeground} strokeWidth={2.4} />
                <Text style={styles.submitButtonText}>
                  Submit to {selectedCategoryMeta.label}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  headerTitleGroup: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  headerPlaceholder: {
    width: 36,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 18,
  },

  // Error Banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderRadius: THEME.radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: THEME.colors.negative,
    fontWeight: '600',
    lineHeight: 16,
  },

  // SLA Banner
  slaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  slaText: {
    flex: 1,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    lineHeight: 16,
  },
  slaTextBold: {
    fontWeight: '700',
    color: THEME.colors.primary,
  },

  // Input Groups
  inputGroup: {
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: THEME.colors.textMuted,
  },
  charCount: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },
  textInputWrap: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textAreaWrap: {
    minHeight: 140,
    paddingVertical: 12,
  },
  textInput: {
    fontSize: 14,
    color: THEME.colors.text,
    padding: 0,
  },
  textArea: {
    minHeight: 120,
    lineHeight: 20,
  },

  // Category Grid
  categoryGrid: {
    gap: 8,
  },
  categoryCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    gap: 4,
  },
  categoryCardSelected: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  categoryCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  categoryIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkPill: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  categoryCardTitleSelected: {
    color: THEME.colors.primary,
    fontWeight: '800',
  },
  categoryCardDesc: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    lineHeight: 15,
  },

  // Diagnostics Card
  diagnosticsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  diagIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diagContent: {
    flex: 1,
    gap: 2,
  },
  diagTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  diagSub: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    lineHeight: 15,
  },

  // Docked Bottom Bar
  bottomStickyBar: {
    backgroundColor: THEME.colors.background,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    height: 48,
    borderRadius: THEME.radius.full,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.primaryForeground,
    letterSpacing: -0.2,
  },
});
