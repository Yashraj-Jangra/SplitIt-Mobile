import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import {
  User,
  Shield,
  Sliders,
  Bell,
  HelpCircle,
  Sparkles,
  FileText,
  LogOut,
  ChevronRight,
  CreditCard,
  Info,
  Palette,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/auth.context';
import { useCurrency } from '../../src/contexts/currency.context';
import { useAppTheme } from '../../src/contexts/theme.context';
import { storageService } from '../../src/services/storage.service';
import { QuantumLogo } from '../../src/components/brand/QuantumLogo';
import { haptics } from '../../src/services/haptics.service';
import { updateService, type UpdateInfo } from '../../src/services/update.service';
import { UpdateModal } from '../../src/components/common/UpdateModal';

interface SettingsItem {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  onPress: () => void;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, refreshUser } = useAuth();
  const { currencyCode, currencySymbol, isCustom } = useCurrency();
  const { currentAccent } = useAppTheme();
  const [imageError, setImageError] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateModalVisible, setUpdateModalVisible] = useState(false);

  const appVersion = Constants.expoConfig?.version || '1.2.1';

  const handleCheckForUpdates = useCallback(async () => {
    if (checkingUpdate) return;
    haptics.tap();
    setCheckingUpdate(true);
    try {
      const info = await updateService.checkForUpdate(true);
      setUpdateInfo(info);
      if (info.available) {
        haptics.saveSuccess();
        setUpdateModalVisible(true);
      } else {
        haptics.tap();
        Alert.alert('Up to Date', `SplitIt v${appVersion} is the latest version available.`);
      }
    } catch {
      haptics.warning();
      Alert.alert(
        'Check Failed',
        'Unable to check for updates right now. Please check your network connection.'
      );
    } finally {
      setCheckingUpdate(false);
    }
  }, [checkingUpdate, appVersion]);

  useFocusEffect(
    useCallback(() => {
      refreshUser();
      setImageError(false);
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
          try {
            await signOut();
          } catch {
            // Safe fallback
          } finally {
            router.replace('/(auth)/login');
          }
        },
      },
    ]);
  };

  const effectiveUpi = user?.upiId?.trim() || '';
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
      subtitle: effectiveUpi ? effectiveUpi : 'Not configured · Tap to set up',
      onPress: () => router.push('/settings/payment'),
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
      icon: Palette,
      title: 'Appearance',
      subtitle: `${currentAccent.name} · Accent color & visual themes`,
      onPress: () => router.push('/settings/appearance'),
    },
    {
      icon: Sliders,
      title: 'App Preferences',
      subtitle: `Currency (${currencySymbol} ${isCustom ? 'Custom' : currencyCode}) · Haptics & defaults`,
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
      icon: Sparkles,
      title: 'Check for Updates',
      subtitle: checkingUpdate
        ? 'Checking GitHub Releases...'
        : `SplitIt v${appVersion} · Tap to check updates`,
      onPress: handleCheckForUpdates,
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
    {
      icon: Info,
      title: 'About SplitIt',
      subtitle: `Version ${appVersion} · Architecture & credits`,
      onPress: () => router.push('/info/about'),
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
          <TouchableOpacity
            style={[styles.avatarCircle, { borderColor: currentAccent.primary }]}
            onPress={() => {
              haptics.tap();
              router.push('/settings/account');
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Edit account information"
          >
            {user?.avatarUrl && !imageError ? (
              <Image
                source={{ uri: user.avatarUrl }}
                style={styles.avatarImage}
                onError={() => setImageError(true)}
              />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>{effectiveName}</Text>
            {user?.username ? (
              <Text style={styles.userHandle} numberOfLines={1}>@{user.username}</Text>
            ) : null}
            <Text style={styles.userEmail} numberOfLines={1}>{user?.email || ''}</Text>
          </View>
        </View>

        {renderSection('ACCOUNT', accountItems)}
        {renderSection('SECURITY', securityItems)}
        {renderSection('PREFERENCES', preferenceItems)}
        {renderSection('TOOLS', toolsItems)}
        {renderSection('SUPPORT & LEGAL', supportItems)}

        {/* Log Out */}
        <View style={styles.logoutSection}>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Log out of SplitIt"
          >
            <LogOut size={16} color={THEME.colors.danger} />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        {/* Brand Footer */}
        <View style={styles.brandFooter}>
          <QuantumLogo size={60} />
          <Text style={styles.brandTitle}>SplitIt</Text>
          <Text style={styles.brandTagline}>Shared expenses, settled simply.</Text>
          <Text style={styles.brandVersion}>v{appVersion} · Mobile & Web Synchronized</Text>
        </View>
      </ScrollView>

      {/* In-App Update Modal */}
      <UpdateModal
        visible={updateModalVisible}
        onClose={() => setUpdateModalVisible(false)}
        updateInfo={updateInfo}
      />
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 16,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 2,
    borderColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '900',
    color: THEME.colors.text,
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  userName: {
    fontSize: 24,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -0.6,
  },
  userHandle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  userEmail: {
    fontSize: 12.5,
    color: THEME.colors.textMuted,
    fontWeight: '500',
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
    marginTop: 6,
    marginBottom: 8,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.dangerMuted,
    paddingVertical: 14,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.danger + '33',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.danger,
  },
  // Brand footer
  brandFooter: {
    alignItems: 'center',
    paddingVertical: 26,
    gap: 6,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -0.5,
    marginTop: 6,
  },
  brandTagline: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.textMuted,
  },
  brandVersion: {
    fontSize: 11,
    color: THEME.colors.textMuted + '80',
    marginTop: 2,
  },
});
