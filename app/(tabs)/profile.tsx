import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  User,
  QrCode,
  ShieldCheck,
  Sliders,
  Bell,
  HelpCircle,
  Sparkles,
  Shield,
  FileText,
  LogOut,
  ChevronRight,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/auth.context';
import { storageService } from '../../src/services/storage.service';
import { BrandLogoImage } from '../../src/components/brand/QuantumLogo';
import * as Haptics from 'expo-haptics';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, refreshUser } = useAuth();
  const [imageError, setImageError] = useState(false);
  const [currencyCode, setCurrencyCode] = useState('INR');

  // Refresh user and currency on focus
  useFocusEffect(
    useCallback(() => {
      refreshUser();
      setImageError(false);
      storageService.getCurrencyPreference().then(setCurrencyCode);
    }, [refreshUser])
  );

  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  const effectiveUpi = user?.upiId || (user?.email ? `${user.email.split('@')[0]}@okaxis` : 'yashraj@okaxis');
  const effectiveName = user?.name || 'You';

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  const accountItems = [
    {
      icon: User,
      title: 'Account Information',
      subtitle: user?.username ? `@${user.username} • Personal details` : 'Name, username, phone & email',
      onPress: () => router.push('/settings/account'),
    },
    {
      icon: QrCode,
      title: 'UPI & Payment QR',
      subtitle: effectiveUpi,
      onPress: () =>
        router.push(
          `/settle/qr?amount=0&name=${encodeURIComponent(effectiveName)}&upiId=${encodeURIComponent(effectiveUpi)}`
        ),
    },
    {
      icon: ShieldCheck,
      title: 'Security & Password',
      subtitle: 'Manage password & credentials',
      onPress: () => router.push('/settings/account'),
    },
  ];

  const preferenceItems = [
    {
      icon: Sliders,
      title: 'App Preferences',
      subtitle: `Currency (${currencyCode}) • Haptics & defaults`,
      onPress: () => router.push('/settings/preferences'),
    },
    {
      icon: Bell,
      title: 'Notifications',
      subtitle: 'Push delivery & quiet hours',
      onPress: () => router.push('/notifications/preferences'),
    },
  ];

  const supportAndLegalItems = [
    {
      icon: HelpCircle,
      title: 'Support Desk',
      subtitle: 'Tickets, FAQs & help center',
      onPress: () => router.push('/support'),
    },
    {
      icon: Sparkles,
      title: 'AI Financial Assistant',
      subtitle: 'Smart expense insights & suggestions',
      onPress: () => router.push('/ai/chat'),
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* User Profile Hero Header (Enlarged Avatar, Preserving Aesthetic) */}
        <View style={styles.userHeroSection}>
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
          <Text style={styles.userName}>{user?.name || 'Yashraj Jangra'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'jangrayash1505@gmail.com'}</Text>

          {/* Active UPI ID Pill */}
          <TouchableOpacity
            style={styles.upiPill}
            onPress={() => router.push('/settings/account')}
            activeOpacity={0.7}
          >
            <QrCode size={12} color={THEME.colors.primary} />
            <Text style={styles.upiPillText}>{effectiveUpi}</Text>
          </TouchableOpacity>
        </View>

        {/* ── GROUP 1: ACCOUNT & SECURITY ── */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeaderTitle}>ACCOUNT & SECURITY</Text>
          <View style={styles.settingsGroupCard}>
            {accountItems.map((item, index) => {
              const IconComponent = item.icon;
              const isLast = index === accountItems.length - 1;

              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.itemRow, !isLast && styles.itemRowBorder]}
                  onPress={() => {
                    Haptics.selectionAsync();
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

        {/* ── GROUP 2: PREFERENCES & ALERTS ── */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeaderTitle}>PREFERENCES & ALERTS</Text>
          <View style={styles.settingsGroupCard}>
            {preferenceItems.map((item, index) => {
              const IconComponent = item.icon;
              const isLast = index === preferenceItems.length - 1;

              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.itemRow, !isLast && styles.itemRowBorder]}
                  onPress={() => {
                    Haptics.selectionAsync();
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

        {/* ── GROUP 3: SUPPORT & LEGAL ── */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeaderTitle}>SUPPORT & LEGAL</Text>
          <View style={styles.settingsGroupCard}>
            {supportAndLegalItems.map((item, index) => {
              const IconComponent = item.icon;
              const isLast = index === supportAndLegalItems.length - 1;

              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.itemRow, !isLast && styles.itemRowBorder]}
                  onPress={() => {
                    Haptics.selectionAsync();
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

        {/* ── GROUP 4: SESSION (LOG OUT ONLY) ── */}
        <View style={styles.dangerSection}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <LogOut size={16} color={THEME.colors.textSecondary} />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        {/* Brand Identity Footer */}
        <View style={styles.brandFooter}>
          <BrandLogoImage size={28} />
          <Text style={styles.brandFooterTitle}>SplitIt</Text>
          <Text style={styles.brandFooterTagline}>Shared expenses, settled simply.</Text>
          <Text style={styles.brandFooterVersion}>v1.0.0 • Mobile & Web Synchronized</Text>
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
  userHeroSection: {
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
  sectionContainer: {
    gap: 8,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.6,
    paddingHorizontal: 4,
  },
  settingsGroupCard: {
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
  dangerSection: {
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
  brandFooter: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  brandFooterTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.3,
    marginTop: 4,
  },
  brandFooterTagline: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  brandFooterVersion: {
    fontSize: 10,
    color: THEME.colors.textMuted + '80',
    marginTop: 2,
  },
});
