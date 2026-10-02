import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { QrCode, Bell, HelpCircle, Shield, LogOut, Trash2, ChevronRight } from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/auth.context';
import * as Haptics from 'expo-haptics';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

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

  const profileItems = [
    {
      icon: QrCode,
      title: 'UPI & Payment QR',
      subtitle: user?.email ? `${user.email.split('@')[0]}@okaxis` : 'yashraj@okaxis',
      onPress: () =>
        router.push(
          `/settle/qr?amount=0&name=${encodeURIComponent(user?.name || 'You')}&upiId=${user?.email ? `${user.email.split('@')[0]}@okaxis` : 'yashraj@okaxis'}`
        ),
    },
    {
      icon: Bell,
      title: 'Notifications',
      subtitle: 'Push delivery & quiet hours',
      onPress: () => router.push('/notifications/preferences'),
    },
    {
      icon: HelpCircle,
      title: 'Support Desk',
      subtitle: 'Tickets & help center',
      onPress: () => router.push('/support'),
    },
    {
      icon: Shield,
      title: 'Privacy & Legal',
      subtitle: 'Zero tracking & App Store terms',
      onPress: () => router.push('/legal/privacy'),
    },
  ];

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'YJ';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* User Profile Header (Open Canvas) */}
        <View style={styles.userHeroSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.userName}>{user?.name || 'Yashraj Jangra'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'jangrayash1505@gmail.com'}</Text>
        </View>

        {/* Grouped Settings Stream */}
        <View style={styles.settingsGroupCard}>
          {profileItems.map((item, index) => {
            const IconComponent = item.icon;
            const isLast = index === profileItems.length - 1;

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

        {/* Action Triggers: Log Out / Delete Account */}
        <View style={styles.dangerSection}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <LogOut size={16} color={THEME.colors.textSecondary} />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/legal/delete-account');
            }}
            activeOpacity={0.8}
          >
            <Trash2 size={15} color={THEME.colors.negative} />
            <Text style={styles.deleteText}>Delete Account</Text>
          </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -0.8,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 36,
    gap: 24,
  },
  userHeroSection: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 2,
    borderColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '900',
    color: THEME.colors.text,
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.3,
  },
  userEmail: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  settingsGroupCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    paddingHorizontal: 16,
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
    gap: 10,
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
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  deleteText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.negative,
  },
});
