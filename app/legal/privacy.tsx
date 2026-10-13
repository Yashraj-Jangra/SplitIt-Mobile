import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { haptics } from '../../src/services/haptics.service';

export default function PrivacyPolicyScreen() {
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
        <Text style={styles.headerTitle} numberOfLines={1}>Privacy Policy</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.badgeRow}>
          <ShieldCheck size={20} color={THEME.colors.primary} />
          <Text style={styles.badgeText}>Last updated: October 2026</Text>
        </View>

        <Text style={styles.heading}>Your Privacy at SplitIt</Text>
        <Text style={styles.paragraph}>
          SplitIt is designed from the ground up to respect user privacy. We do not sell, rent, or monetize your personal financial data to advertisers or third-party data brokers.
        </Text>

        <Text style={styles.subheading}>1. Data We Collect</Text>
        <Text style={styles.paragraph}>
          • <Text style={styles.bold}>Account Credentials:</Text> Your name, email address, and profile picture (via Google OAuth or direct signup) to identify you within your shared expense groups.{'\n'}
          • <Text style={styles.bold}>Group & Expense Data:</Text> Bill totals, split breakdowns, dates, and category tags.{'\n'}
          • <Text style={styles.bold}>Camera & Photos:</Text> Used strictly on-demand for MiniMax Vision receipt scanning. Uploaded receipt images are stored privately in encrypted object storage and never shared.{'\n'}
          • <Text style={styles.bold}>Device & Push Tokens:</Text> Expo push notification tokens to deliver real-time group updates and budget velocity warnings.
        </Text>

        <Text style={styles.subheading}>2. App Store Privacy Nutrition Compliance</Text>
        <Text style={styles.paragraph}>
          In compliance with Apple and Google Play privacy guidelines, we declare zero tracking across external apps or websites. All collected identifiers are directly tied to your app functionality.
        </Text>

        <Text style={styles.subheading}>3. Data Retention & Deletion</Text>
        <Text style={styles.paragraph}>
          You retain 100% control over your data. You can delete your account and associated personal profiles at any time via Settings → Delete Account, which completely purges your records from our database.
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
