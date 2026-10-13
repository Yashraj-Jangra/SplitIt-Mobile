import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, FileText, AlertTriangle } from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { haptics } from '../../src/services/haptics.service';

export default function TermsOfServiceScreen() {
  const router = useRouter();

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
        <Text style={styles.headerTitle} numberOfLines={1}>Terms of Service</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.badgeRow}>
          <FileText size={20} color={THEME.colors.primary} />
          <Text style={styles.badgeText}>Effective Date: October 2026</Text>
        </View>

        <Text style={styles.heading}>SplitIt Terms of Use</Text>
        <Text style={styles.paragraph}>
          By accessing or using the SplitIt mobile application, you agree to be bound by these Terms of Service.
        </Text>

        <View style={styles.disclaimerCard}>
          <AlertTriangle size={20} color={THEME.colors.warning} />
          <Text style={styles.disclaimerText}>
            <Text style={styles.bold}>Non-Escrow Utility Notice:</Text> SplitIt is an expense ledger, calculation engine, and group budgeting tool. SplitIt does not hold user funds, act as an escrow agent, or process banking transactions directly.
          </Text>
        </View>

        <Text style={styles.subheading}>1. Peer-to-Peer Payments & UPI</Text>
        <Text style={styles.paragraph}>
          SplitIt facilitates settlement reconciliation by launching certified third-party UPI applications (Google Pay, PhonePe, Paytm, BHIM, CRED) via standard NPCI URI schemes. All financial transactions take place strictly between your bank accounts through certified payment apps.
        </Text>

        <Text style={styles.subheading}>2. Acceptable Use</Text>
        <Text style={styles.paragraph}>
          You agree to use SplitIt solely for lawful personal or shared group expense recording. Automated scraping, reverse engineering, or exploiting backend APIs is strictly prohibited.
        </Text>

        <Text style={styles.subheading}>3. Limitation of Liability</Text>
        <Text style={styles.paragraph}>
          SplitIt provides mathematical split algorithms and AI suggestions on an &quot;as-is&quot; basis. While our calculations are rigorously tested, users are advised to verify large financial settlements prior to payment confirmation.
        </Text>
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
    gap: 14,
    paddingBottom: 36,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: THEME.radius.sm,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  heading: {
    fontSize: 22,
    fontWeight: '900',
    color: THEME.colors.text,
    marginTop: 6,
  },
  disclaimerCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
    marginTop: 4,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: THEME.colors.warningLight,
    lineHeight: 18,
  },
  subheading: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.text,
    marginTop: 10,
  },
  paragraph: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    lineHeight: 22,
  },
  bold: {
    fontWeight: '700',
    color: THEME.colors.text,
  },
});
