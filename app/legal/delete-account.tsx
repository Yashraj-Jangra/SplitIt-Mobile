import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Trash2, ShieldAlert } from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { QuantumSpinner } from '../../src/components/brand/QuantumLogo';
import { useAuth } from '../../src/contexts/auth.context';
import { authService, API_BASE_URL } from '../../src/services/auth.service';
import { haptics } from '../../src/services/haptics.service';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isConfirmed = confirmationInput.trim().toUpperCase() === 'DELETE';

  const handleDeleteAccount = async () => {
    if (!isConfirmed || isDeleting) return;

    haptics.warning();

    Alert.alert(
      'Final Confirmation',
      'Are you completely sure you want to permanently delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            setErrorMsg('');
            try {
              const token = await authService.getToken();
              const res = await fetch(`${API_BASE_URL}/api/user/delete-account`, {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${token || ''}`,
                  Cookie: `better-auth.session_token=${token || ''}`,
                },
              });

              if (res.ok) {
                haptics.destructive();
                await signOut();
                router.replace('/(auth)/login');
              } else {
                setErrorMsg('Failed to delete account. Please try again.');
                setIsDeleting(false);
              }
            } catch {
              // Fallback for simulation / offline
              await signOut();
              router.replace('/(auth)/login');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          style={styles.headerButton}
        >
          <ArrowLeft size={20} color={THEME.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Delete Account</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.warningCard}>
            <ShieldAlert size={28} color={THEME.colors.negative} />
            <View style={styles.warningTextContainer}>
              <Text style={styles.warningTitle}>Irreversible Action</Text>
              <Text style={styles.warningSubtitle}>
                Deleting your account permanently removes your identity, profile data, and active sessions.
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>What gets erased:</Text>
          <View style={styles.consequencesCard}>
            <Text style={styles.consequenceItem}>
              • Your user profile, name, avatar, and email records.
            </Text>
            <Text style={styles.consequenceItem}>
              • All active login sessions across Web, Mobile, and Extension.
            </Text>
            <Text style={styles.consequenceItem}>
              • Your registered UPI IDs and push notification device tokens.
            </Text>
            <Text style={styles.consequenceItem}>
              • Group expense records will remain visible to other group members with an unlinked profile reference.
            </Text>
          </View>

          {errorMsg ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{'TYPE "DELETE" TO CONFIRM'}</Text>
            <TextInput
              style={styles.textInput}
              value={confirmationInput}
              onChangeText={setConfirmationInput}
              placeholder="DELETE"
              placeholderTextColor={THEME.colors.textMuted}
              autoCapitalize="characters"
              returnKeyType="done"
            />
          </View>

          <TouchableOpacity
            style={[
              styles.deleteButton,
              (!isConfirmed || isDeleting) && styles.deleteButtonDisabled,
            ]}
            onPress={handleDeleteAccount}
            disabled={!isConfirmed || isDeleting}
          >
            {isDeleting ? (
              <QuantumSpinner size={18} color={THEME.colors.text} />
            ) : (
              <>
                <Trash2 size={18} color={THEME.colors.text} />
                <Text style={styles.deleteButtonText}>Permanently Delete My Account</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surface,
  },
  headerTitle: {
    flex: 1,
    marginLeft: 12,
    fontSize: 17,
    fontWeight: '800',
    color: THEME.colors.text,
    textAlign: 'left',
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 18,
    paddingBottom: 36,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: THEME.radius.lg,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.negative,
    marginBottom: 4,
  },
  warningSubtitle: {
    fontSize: 12,
    color: THEME.colors.negativeLight,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: THEME.colors.textSecondary,
    marginTop: 6,
  },
  consequencesCard: {
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: 10,
  },
  consequenceItem: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    lineHeight: 19,
  },
  errorBanner: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    padding: 12,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.negative,
  },
  errorText: {
    color: THEME.colors.negative,
    fontSize: 13,
    fontWeight: '600',
  },
  inputGroup: {
    gap: 6,
    marginTop: 6,
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
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.negative,
    paddingVertical: 14,
    borderRadius: THEME.radius.md,
    marginTop: 10,
  },
  deleteButtonDisabled: {
    opacity: 0.35,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.text,
  },
});
