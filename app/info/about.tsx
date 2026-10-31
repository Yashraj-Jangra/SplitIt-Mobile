import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import {
  ArrowLeft,
  Shield,
  FileText,
  Trash2,
  ChevronRight,
  Cpu,
  Zap,
  Lock,
  Layers,
  Heart,
  RefreshCw,
  CheckCircle2,
  Sparkles,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { QuantumLogo } from '../../src/components/brand/QuantumLogo';
import { haptics } from '../../src/services/haptics.service';
import { updateService, type UpdateInfo } from '../../src/services/update.service';
import { UpdateModal } from '../../src/components/common/UpdateModal';

export default function AboutScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);

  const currentVersion = Constants.expoConfig?.version || '1.3.0';
  const buildCode = Constants.expoConfig?.android?.versionCode || '6';

  const handleNav = (path: string) => {
    haptics.tap();
    router.push(path as any);
  };

  const handleCheckForUpdates = useCallback(async () => {
    haptics.tap();
    setChecking(true);
    setStatusText(null);
    try {
      const info = await updateService.checkForUpdate(true);
      setUpdateInfo(info);
      if (info.available) {
        haptics.saveSuccess();
        setModalVisible(true);
        setStatusText(`Update available: v${info.latestVersion}`);
      } else {
        haptics.tap();
        setStatusText(`You're up to date (v${currentVersion})`);
      }
    } catch {
      haptics.warning();
      setStatusText('Unable to reach GitHub. Check your internet connection.');
    } finally {
      setChecking(false);
    }
  }, [currentVersion]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Pinned Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          style={styles.headerButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Back to previous screen"
        >
          <ArrowLeft size={20} color={THEME.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About SplitIt</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Hero Card */}
        <View style={styles.heroCard}>
          <QuantumLogo size={64} />
          <Text style={styles.brandTitle}>SplitIt Mobile</Text>
          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>
              Version {currentVersion} (Build {buildCode})
            </Text>
          </View>
          <Text style={styles.brandSubtitle}>
            Next-generation shared expense engine with AI OCR, instant settlement parity, and zero-lag financial coordination.
          </Text>
        </View>

        {/* Software Updates Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>SOFTWARE UPDATES</Text>

          <View style={styles.updateRow}>
            <View style={styles.updateIconWrap}>
              {statusText?.includes('up to date') ? (
                <CheckCircle2 size={18} color={THEME.colors.success} />
              ) : statusText?.includes('Update available') ? (
                <Sparkles size={18} color={THEME.colors.primary} />
              ) : (
                <RefreshCw size={18} color={THEME.colors.primary} />
              )}
            </View>

            <View style={styles.updateInfo}>
              <Text style={styles.updateTitle}>SplitIt Release Channel</Text>
              <Text style={styles.updateDesc}>
                {statusText || `Installed version v${currentVersion} via GitHub Releases`}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.checkButton, checking && styles.checkButtonDisabled]}
              onPress={handleCheckForUpdates}
              disabled={checking}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Check for app updates"
            >
              {checking ? (
                <ActivityIndicator size="small" color={THEME.colors.primaryForeground} />
              ) : (
                <Text style={styles.checkButtonText}>Check Now</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Engineering Highlights */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>ARCHITECTURE & STACK</Text>

          <View style={styles.techRow}>
            <View style={styles.techIconWrap}>
              <Cpu size={16} color={THEME.colors.primary} />
            </View>
            <View style={styles.techInfo}>
              <Text style={styles.techTitle}>Expo SDK 58 & React Native 0.84</Text>
              <Text style={styles.techDesc}>Modern declarative architecture with continuous native generation</Text>
            </View>
          </View>

          <View style={styles.techRow}>
            <View style={styles.techIconWrap}>
              <Zap size={16} color={THEME.colors.warning} />
            </View>
            <View style={styles.techInfo}>
              <Text style={styles.techTitle}>0ms In-Memory Caching Engine</Text>
              <Text style={styles.techDesc}>Instantaneous screen transitions without network layout shifts</Text>
            </View>
          </View>

          <View style={styles.techRow}>
            <View style={styles.techIconWrap}>
              <Layers size={16} color={THEME.colors.info} />
            </View>
            <View style={styles.techInfo}>
              <Text style={styles.techTitle}>@splitit/core Calculation Matrix</Text>
              <Text style={styles.techDesc}>Greedy min-cash-flow graph settlement algorithms with 100% web parity</Text>
            </View>
          </View>

          <View style={styles.techRow}>
            <View style={styles.techIconWrap}>
              <Lock size={16} color={THEME.colors.success} />
            </View>
            <View style={styles.techInfo}>
              <Text style={styles.techTitle}>Privacy-First Data Isolation</Text>
              <Text style={styles.techDesc}>Zero tracking, zero ad cookies, and full user-controlled data erasure</Text>
            </View>
          </View>
        </View>

        {/* Legal & Compliance Links */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>LEGAL & COMPLIANCE</Text>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => handleNav('/legal/privacy')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="View Privacy Policy"
          >
            <Shield size={18} color={THEME.colors.textMuted} />
            <Text style={styles.linkText}>Privacy Policy</Text>
            <ChevronRight size={16} color={THEME.colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.linkDivider} />

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => handleNav('/legal/terms')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="View Terms of Service"
          >
            <FileText size={18} color={THEME.colors.textMuted} />
            <Text style={styles.linkText}>Terms of Service</Text>
            <ChevronRight size={16} color={THEME.colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.linkDivider} />

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => handleNav('/legal/delete-account')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="View Account Data and Deletion instructions"
          >
            <Trash2 size={18} color={THEME.colors.danger} />
            <Text style={[styles.linkText, { color: THEME.colors.danger }]}>
              Account Data & Deletion
            </Text>
            <ChevronRight size={16} color={THEME.colors.danger} />
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Crafted with precision for group living</Text>
            <Heart size={12} color={THEME.colors.primary} />
          </View>
          <Text style={styles.copyrightText}>© 2026 SplitIt Inc. All rights reserved.</Text>
        </View>
      </ScrollView>

      {/* In-App Update Modal */}
      <UpdateModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
    gap: 12,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  heroCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    gap: 10,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -0.4,
  },
  versionBadge: {
    backgroundColor: THEME.colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.xs,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  versionText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  brandSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 300,
    marginTop: 4,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
  },
  updateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  updateIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.border,
  },
  updateInfo: {
    flex: 1,
    gap: 2,
  },
  updateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  updateDesc: {
    fontSize: 11,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
    lineHeight: 15,
  },
  checkButton: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkButtonDisabled: {
    opacity: 0.6,
  },
  checkButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primaryForeground,
  },
  techRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  techIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  techInfo: {
    flex: 1,
    gap: 2,
  },
  techTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  techDesc: {
    fontSize: 11,
    fontWeight: '500',
    color: THEME.colors.textMuted,
    lineHeight: 16,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  linkText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  linkDivider: {
    height: 1,
    backgroundColor: THEME.colors.hairline,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textMuted,
  },
  copyrightText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
});
