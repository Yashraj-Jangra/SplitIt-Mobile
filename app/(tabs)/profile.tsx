import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, QrCode, Bell, HelpCircle, Shield, LogOut, Trash2, ChevronRight } from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import * as Haptics from 'expo-haptics';

export default function ProfileScreen() {
  const profileItems = [
    { icon: QrCode, title: 'UPI ID & QR Code', subtitle: 'yashraj@okaxis' },
    { icon: Bell, title: 'Push Notifications', subtitle: 'Configured' },
    { icon: HelpCircle, title: 'Customer Support', subtitle: 'Tickets & Help' },
    { icon: Shield, title: 'Privacy & Terms', subtitle: 'Legal Information' },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Account</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>YJ</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>Yashraj Jangra</Text>
            <Text style={styles.userEmail}>jangrayash1505@gmail.com</Text>
          </View>
        </View>

        {/* Settings Group */}
        <View style={styles.sectionCard}>
          {profileItems.map((item, index) => {
            const IconComponent = item.icon;
            return (
              <TouchableOpacity
                key={index}
                style={[styles.itemRow, index > 0 && styles.itemRowBorder]}
                onPress={() => Haptics.selectionAsync()}
              >
                <IconComponent size={18} color={THEME.colors.textSecondary} />
                <View style={styles.itemContent}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
                </View>
                <ChevronRight size={16} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Logout / Delete Account */}
        <View style={styles.dangerSection}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          >
            <LogOut size={16} color={THEME.colors.textSecondary} />
            <Text style={styles.actionText}>Log Out</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionRow, styles.deleteAccountRow]}
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
          >
            <Trash2 size={16} color={THEME.colors.negative} />
            <Text style={[styles.actionText, { color: THEME.colors.negative }]}>
              Delete Account
            </Text>
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
    paddingVertical: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: THEME.colors.text,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 16,
    paddingBottom: 32,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    padding: 16,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#09090B',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.text,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  sectionCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  itemRowBorder: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  itemSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  dangerSection: {
    gap: 8,
    marginTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.surface,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  deleteAccountRow: {
    borderColor: 'rgba(244, 63, 94, 0.2)',
    backgroundColor: 'rgba(244, 63, 94, 0.05)',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
});
