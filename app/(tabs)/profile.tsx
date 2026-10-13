import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  User,
  QrCode,
  Shield,
  Sliders,
  Bell,
  HelpCircle,
  Sparkles,
  FileText,
  LogOut,
  ChevronRight,
  CreditCard,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/auth.context';
import { storageService } from '../../src/services/storage.service';
import { BrandLogoImage } from '../../src/components/brand/QuantumLogo';
import { haptics } from '../../src/services/haptics.service';

interface SettingsItem {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  onPress: () => void;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, refreshUser } = useAuth();
  const [imageError, setImageError] = useState(false);
  const [currencyCode, setCurrencyCode] = useState('INR');

  useFocusEffect(
    useCallback(() => {
      refreshUser();
      setImageError(false);
      storageService.getCurrencyPreference().then(setCurrencyCode);
    }, [refreshUser])
  );

  const handleLogout = () => {
    haptics.tap();
    Alert.alert('Log Out', 'Are you sure you want to log out of SplitIt?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const effectiveUpi = user?.upiId || (user?.email ? `${user.email.split('@')[0]}@okaxis` : '–');
  const effectiveName = user?.name || 'You';

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  // ── Section: Account ──
  const accountItems: SettingsItem[] = [
    {
      icon: User,
      title: 'Account Information',
      subtitle: user?.username ? `@${user.username} · Name, phone & email` : 'Name, username, phone & email',
      onPress: () => router.push('/settings/account'),
    },
    {
      icon: CreditCard,
      title: 'UPI & Payment',
      subtitle: effectiveUpi !== '–' ? effectiveUpi : 'Configure your VPA address',
      onPress: () => router.push('/settings/payment'),
    },
    {
      icon: QrCode,
      title: 'My Payment QR',
      subtitle: 'Show your QR code to receive money',
      onPress: () => router.push('/settings/my-qr'),
    },
  ];

  // ── Section: Security ──
  const securityItems: SettingsItem[] = [
    {
      icon: Shield,
      title: 'Security & Password',
      subtitle: 'Change password · Danger zone',
      onPress: () => router.push('/settings/security'),
    },
  ];

  // ── Section: Preferences ──
  const preferenceItems: SettingsItem[] = [
    {
      icon: Sliders,
      title: 'App Preferences',
      subtitle: `Currency (${currencyCode}) · Haptics & defaults`,
      onPress: () => router.push('/settings/preferences'),
    },
    {
      icon: Bell,
      title: 'Notifications',
      subtitle: 'Push delivery & quiet hours',
      onPress: () => router.push('/notifications/preferences'),
    },
  ];

  // ── Section: Tools ──
  const toolsItems: SettingsItem[] = [
    {
      icon: Sparkles,
      title: 'AI Financial Assistant',
      subtitle: 'Smart expense insights & suggestions',
      onPress: () => router.push('/ai/chat'),
    },
  ];

  // ── Section: Support & Legal ──
  const supportItems: SettingsItem[] = [
    {
      icon: HelpCircle,
      title: 'Support Desk',
      subtitle: 'Tickets, FAQs & help center',
      onPress: () => router.push('/support'),
    },
    {
      icon: Shield,
      title: 'Privacy Policy',
      subtitle: 'Zero tracking & data protection',
      onPress: () => router.push('/legal/privacy'),
    },
    {
      icon: FileText,
      title: 'Terms of Service',
      subtitle: 'App Store terms & acceptable use',
      onPress: () => router.push('/legal/terms'),
    },
  ];

  const renderSection = (title: string, items: SettingsItem[]) => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.groupCard}>
        {items.map((item, index) => {
          const IconComponent = item.icon;
          const isLast = index === items.length - 1;
          return (
            <TouchableOpacity
              key={item.title}
              style={[styles.itemRow, !isLast && styles.itemRowBorder]}
              onPress={() => {
                haptics.tap();
                item.onPress();
              }}
              activeOpacity={0.7}
            >
              <View style={styles.itemIconCircle}>
                <IconComponent size={16} color={THEME.colors.textSecondary} />
              </View>
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
              </View>
              <ChevronRight size={15} color={THEME.colors.textMuted} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* User Profile Hero */}
        <View style={styles.userHero}>
          <View style={styles.avatarCircle}>
            {user?.avatarUrl && !imageError ? (
              <Image
                source={{ uri: user.avatarUrl }}
                style={styles.avatarImage}
                onError={() => setImageError(true)}
              />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </View>
          <Text style={styles.userName}>{effectiveName}</Text>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>

          <TouchableOpacity
            style={styles.upiPill}
            onPress={() => router.push('/settings/payment')}
            activeOpacity={0.7}
          >
            <QrCode size={12} color={THEME.colors.primary} />
            <Text style={styles.upiPillText}>{effectiveUpi}</Text>
          </TouchableOpacity>
        </View>

        {renderSection('ACCOUNT', accountItems)}
        {renderSection('SECURITY', securityItems)}
        {renderSection('PREFERENCES', preferenceItems)}
        {renderSection('TOOLS', toolsItems)}
        {renderSection('SUPPORT & LEGAL', supportItems)}

        {/* Log Out */}
        <View style={styles.logoutSection}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <LogOut size={16} color={THEME.colors.textSecondary} />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        {/* Brand Footer */}
        <View style={styles.brandFooter}>
          <BrandLogoImage size={28} />
          <Text style={styles.brandTitle}>SplitIt</Text>
          <Text style={styles.brandTagline}>Shared expenses, settled simply.</Text>
          <Text style={styles.brandVersion}>v1.0.0 · Mobile & Web Synchronized</Text>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -0.8,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 36,
    gap: 20,
  },
  // Hero
  userHero: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 2.5,
    borderColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 12,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '900',
    color: THEME.colors.text,
  },
  userName: {
    fontSize: 19,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.3,
  },
  userEmail: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  upiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
    marginTop: 8,
  },
  upiPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  // Sections
  sectionContainer: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.6,
    paddingHorizontal: 4,
  },
  groupCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    paddingHorizontal: 14,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  itemIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  itemSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  // Log Out
  logoutSection: {
    marginTop: 4,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.surface,
    paddingVertical: 14,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  // Brand footer
  brandFooter: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.3,
    marginTop: 4,
  },
  brandTagline: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  brandVersion: {
    fontSize: 10,
    color: THEME.colors.textMuted + '80',
    marginTop: 2,
  },
});
