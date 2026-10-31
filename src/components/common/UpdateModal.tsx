import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  Platform,
  AppState,
  type AppStateStatus,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {
  Sparkles,
  Download,
  ExternalLink,
  AlertCircle,
  X,
  CheckCircle2,
  HardDrive,
  ShieldCheck,
  Settings,
  ArrowRight,
  Lock,
  ChevronRight,
} from 'lucide-react-native';
import { BottomSheetModal } from './BottomSheetModal';
import { AiMarkdownView } from '../ai/AiMarkdownView';
import { THEME } from '../../constants/theme';
import { haptics } from '../../services/haptics.service';
import { updateService, type UpdateInfo, type DownloadProgress } from '../../services/update.service';

export interface UpdateModalProps {
  visible: boolean;
  onClose: () => void;
  updateInfo: UpdateInfo | null;
}

type UpdateStep = 'IDLE' | 'PERMISSION_GUIDE' | 'DOWNLOADING' | 'INSTALLING' | 'ERROR';

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export const UpdateModal = React.memo(function UpdateModal({
  visible,
  onClose,
  updateInfo,
}: UpdateModalProps) {
  const [step, setStep] = useState<UpdateStep>('IDLE');
  const [progress, setProgress] = useState<DownloadProgress>({
    percentage: 0,
    totalBytes: 0,
    writtenBytes: 0,
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tracks if user went to Android settings to authorize package install
  const waitingForSettingsReturnRef = useRef(false);

  // Animated progress bar width
  const progressAnim = useSharedValue(0);

  // Reset state when modal is opened
  useEffect(() => {
    if (visible) {
      setStep('IDLE');
      setProgress({ percentage: 0, totalBytes: updateInfo?.apkSize || 0, writtenBytes: 0 });
      setErrorMessage(null);
      progressAnim.value = 0;
      waitingForSettingsReturnRef.current = false;
    }
  }, [visible, updateInfo, progressAnim]);

  // Core download & installation execution
  const executeDownloadAndInstall = useCallback(async () => {
    if (!updateInfo?.downloadUrl) {
      if (updateInfo?.browserUrl) {
        Linking.openURL(updateInfo.browserUrl);
      }
      return;
    }

    haptics.confirm();
    setStep('DOWNLOADING');
    setErrorMessage(null);
    progressAnim.value = 0;

    try {
      await updateService.downloadAndInstallUpdate(
        updateInfo.downloadUrl,
        (p) => {
          setProgress(p);
          progressAnim.value = withTiming(p.percentage, {
            duration: 100,
            easing: Easing.linear,
          });
        }
      );

      // Installer opened
      setStep('INSTALLING');
      haptics.saveSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Update installation failed.';
      setErrorMessage(msg);
      setStep('ERROR');
      haptics.warning();
    }
  }, [updateInfo, progressAnim]);

  // Handle user tapping "Update & Install" from IDLE view
  const handleStartUpdate = useCallback(async () => {
    if (Platform.OS !== 'android') {
      if (updateInfo?.browserUrl) {
        Linking.openURL(updateInfo.browserUrl);
      }
      return;
    }

    // Check if permission explanation has already been acknowledged
    const hasSeenGuide = await updateService.isPermissionGuideAcknowledged();
    if (!hasSeenGuide) {
      haptics.tap();
      setStep('PERMISSION_GUIDE');
      return;
    }

    await executeDownloadAndInstall();
  }, [updateInfo, executeDownloadAndInstall]);

  // Open Android System Settings for SplitIt's "Install unknown apps"
  const handleOpenSettings = useCallback(async () => {
    haptics.confirm();
    waitingForSettingsReturnRef.current = true;
    await updateService.setPermissionGuideAcknowledged(true);
    await updateService.openInstallPermissionSettings();
  }, []);

  // Skip permission guide and proceed directly
  const handleSkipGuideAndProceed = useCallback(async () => {
    haptics.tap();
    await updateService.setPermissionGuideAcknowledged(true);
    await executeDownloadAndInstall();
  }, [executeDownloadAndInstall]);

  // Listen for AppState transition back to active (user returning from Android Settings)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active' && waitingForSettingsReturnRef.current) {
        waitingForSettingsReturnRef.current = false;
        haptics.saveSuccess();
        // User returned from Settings, immediately proceed to download & install
        executeDownloadAndInstall();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [executeDownloadAndInstall]);

  const handleCancel = useCallback(async () => {
    haptics.tap();
    await updateService.cancelDownload();
    setStep('IDLE');
  }, []);

  const handleBrowserFallback = useCallback(() => {
    haptics.tap();
    if (updateInfo?.browserUrl) {
      Linking.openURL(updateInfo.browserUrl);
    }
  }, [updateInfo]);

  const progressStyle = useAnimatedStyle(() => {
    return {
      width: `${Math.round(progressAnim.value * 100)}%`,
    };
  });

  if (!updateInfo) return null;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={step === 'DOWNLOADING' ? handleCancel : onClose}
      maxHeight={step === 'PERMISSION_GUIDE' ? '92%' : '86%'}
      title={step === 'PERMISSION_GUIDE' ? 'Install Authorization' : 'Update Available'}
      subtitle={`SplitIt v${updateInfo.latestVersion}`}
      showCloseButton={step !== 'DOWNLOADING'}
    >
      <View style={styles.container}>
        {/* ── STEP 1: PERMISSION & TRUST GUIDE ── */}
        {step === 'PERMISSION_GUIDE' && (
          <View style={styles.guideContainer}>
            {/* Trust Hero Card */}
            <View style={styles.trustHeroCard}>
              <View style={styles.shieldIconRing}>
                <ShieldCheck size={28} color={THEME.colors.primary} />
              </View>
              <Text style={styles.trustHeroTitle}>One-Time Installation Permission</Text>
              <Text style={styles.trustHeroSubtitle}>
                Android requires authorization to let SplitIt install updates directly from our official repository.
              </Text>
            </View>

            {/* Verification Guarantee Badges */}
            <View style={styles.guaranteeBox}>
              <View style={styles.guaranteeRow}>
                <CheckCircle2 size={15} color={THEME.colors.success} style={styles.guaranteeIcon} />
                <View style={styles.guaranteeTextCol}>
                  <Text style={styles.guaranteeTitle}>Official Open-Source Release</Text>
                  <Text style={styles.guaranteeSub}>
                    Directly from github.com/Yashraj-Jangra/SplitIt-Mobile
                  </Text>
                </View>
              </View>

              <View style={styles.guaranteeDivider} />

              <View style={styles.guaranteeRow}>
                <Lock size={15} color={THEME.colors.info} style={styles.guaranteeIcon} />
                <View style={styles.guaranteeTextCol}>
                  <Text style={styles.guaranteeTitle}>Cryptographically Signed APK</Text>
                  <Text style={styles.guaranteeSub}>
                    Verified against original SplitIt keystore signatures
                  </Text>
                </View>
              </View>

              <View style={styles.guaranteeDivider} />

              <View style={styles.guaranteeRow}>
                <HardDrive size={15} color={THEME.colors.warning} style={styles.guaranteeIcon} />
                <View style={styles.guaranteeTextCol}>
                  <Text style={styles.guaranteeTitle}>Zero Residue Guarantee</Text>
                  <Text style={styles.guaranteeSub}>
                    Downloaded files are automatically deleted after installation
                  </Text>
                </View>
              </View>
            </View>

            {/* Quick 3-Step Walkthrough */}
            <View style={styles.stepsCard}>
              <Text style={styles.stepsHeader}>HOW TO ENABLE (10 SECONDS):</Text>
              
              <View style={styles.stepItem}>
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <Text style={styles.stepItemText}>
                  Tap <Text style={styles.stepHighlight}>"Open System Settings"</Text> below.
                </Text>
              </View>

              <View style={styles.stepItem}>
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <Text style={styles.stepItemText}>
                  Switch ON <Text style={styles.stepHighlight}>"Allow from this source"</Text> for SplitIt.
                </Text>
              </View>

              <View style={styles.stepItem}>
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <Text style={styles.stepItemText}>
                  Press <Text style={styles.stepHighlight}>Back</Text> to return and start the installation immediately.
                </Text>
              </View>
            </View>

            {/* Guide Actions */}
            <View style={styles.guideActionCol}>
              <TouchableOpacity
                style={styles.openSettingsButton}
                onPress={handleOpenSettings}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Open Android System Settings for SplitIt install permission"
              >
                <Settings size={18} color={THEME.colors.primaryForeground} />
                <Text style={styles.openSettingsButtonText}>Open System Settings</Text>
              </TouchableOpacity>

              <View style={styles.guideSecondaryRow}>
                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={handleSkipGuideAndProceed}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="I already allowed this, proceed with update"
                >
                  <Text style={styles.skipButtonText}>Already Enabled / Proceed</Text>
                  <ArrowRight size={13} color={THEME.colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.guideBrowserBtn}
                  onPress={handleBrowserFallback}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Download update via browser instead"
                >
                  <ExternalLink size={13} color={THEME.colors.textMuted} />
                  <Text style={styles.guideBrowserText}>Download via Browser</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ── STEP 2: IDLE OVERVIEW WITH TRUST BADGES ── */}
        {step === 'IDLE' && (
          <>
            {/* Version Comparison Header */}
            <View style={styles.headerCard}>
              <View style={styles.badgeRow}>
                <View style={styles.versionPillCurrent}>
                  <Text style={styles.versionLabel}>Current</Text>
                  <Text style={styles.versionVal}>v{updateInfo.currentVersion}</Text>
                </View>

                <View style={styles.arrowContainer}>
                  <Text style={styles.arrowText}>→</Text>
                </View>

                <View style={styles.versionPillNew}>
                  <Sparkles size={13} color={THEME.colors.primary} style={styles.pillIcon} />
                  <Text style={styles.versionLabelNew}>Latest</Text>
                  <Text style={styles.versionValNew}>v{updateInfo.latestVersion}</Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.releaseName} numberOfLines={1}>
                  {updateInfo.releaseName}
                </Text>
                <View style={styles.metaRight}>
                  <HardDrive size={12} color={THEME.colors.textMuted} />
                  <Text style={styles.sizeText}>
                    {updateInfo.apkSize > 0 ? formatBytes(updateInfo.apkSize) : 'Direct APK'}
                  </Text>
                  <Text style={styles.dateDot}>•</Text>
                  <Text style={styles.dateText}>{formatDate(updateInfo.publishedAt)}</Text>
                </View>
              </View>
            </View>

            {/* Provenance & Security Pill */}
            <View style={styles.securityTrustCard}>
              <View style={styles.securityTrustRow}>
                <ShieldCheck size={14} color={THEME.colors.primary} />
                <Text style={styles.securityTrustText}>
                  Verified GitHub Release • Auto-purged after install
                </Text>
              </View>
            </View>

            {/* Release Notes */}
            <View style={styles.notesSection}>
              <Text style={styles.notesSectionTitle}>What's New</Text>
              <ScrollView
                style={styles.notesScroll}
                contentContainerStyle={styles.notesContent}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                {updateInfo.releaseNotes.trim() ? (
                  <AiMarkdownView content={updateInfo.releaseNotes} />
                ) : (
                  <Text style={styles.emptyNotes}>Bug fixes and performance improvements.</Text>
                )}
              </ScrollView>
            </View>

            {/* Footer Actions */}
            <View style={styles.footer}>
              {updateInfo.downloadUrl && Platform.OS === 'android' ? (
                <TouchableOpacity
                  style={styles.primaryActionButton}
                  onPress={handleStartUpdate}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Download and install update"
                >
                  <Download size={18} color={THEME.colors.primaryForeground} />
                  <Text style={styles.primaryActionText}>Update & Install</Text>
                </TouchableOpacity>
              ) : null}

              <View style={styles.secondaryActionsRow}>
                <TouchableOpacity
                  style={styles.browserButton}
                  onPress={handleBrowserFallback}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Download APK via web browser"
                >
                  <ExternalLink size={14} color={THEME.colors.textSecondary} />
                  <Text style={styles.browserButtonText}>Download via Browser</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.laterButton}
                  onPress={onClose}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss update for now"
                >
                  <Text style={styles.laterButtonText}>Later</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* ── STEP 3: DOWNLOADING PROGRESS ── */}
        {step === 'DOWNLOADING' && (
          <View style={styles.progressSection}>
            <View style={styles.progressContainer}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>Downloading update package...</Text>
                <Text style={styles.progressPercent}>
                  {Math.round(progress.percentage * 100)}%
                </Text>
              </View>

              <View style={styles.progressBarTrack}>
                <Animated.View style={[styles.progressBarFill, progressStyle]} />
              </View>

              <View style={styles.progressDetailsRow}>
                <Text style={styles.progressBytes}>
                  {formatBytes(progress.writtenBytes)} / {formatBytes(progress.totalBytes || updateInfo.apkSize)}
                </Text>
                <Text style={styles.zeroResidueHint}>Auto-cleaned after install</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Cancel update download"
            >
              <X size={16} color={THEME.colors.textSecondary} />
              <Text style={styles.cancelButtonText}>Cancel Download</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 4: INSTALLING / PACKAGE LAUNCH ── */}
        {step === 'INSTALLING' && (
          <View style={styles.installingSection}>
            <View style={styles.installingCard}>
              <ActivityIndicator size="small" color={THEME.colors.primary} />
              <View style={styles.installingTextCol}>
                <Text style={styles.installingTitle}>Opening Android Installer...</Text>
                <Text style={styles.installingSub}>
                  Confirm the prompt on your screen to complete the update.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.doneButton}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close installer dialog"
            >
              <CheckCircle2 size={16} color={THEME.colors.primaryForeground} />
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 5: ERROR STATE WITH SETTINGS RECOVERY ── */}
        {step === 'ERROR' && (
          <View style={styles.errorSection}>
            <View style={styles.errorCard}>
              <AlertCircle size={20} color={THEME.colors.danger} />
              <View style={styles.errorTextCol}>
                <Text style={styles.errorTitle}>Installation Interrupted</Text>
                <Text style={styles.errorText}>
                  {errorMessage || 'Failed to complete update installation.'}
                </Text>
              </View>
            </View>

            <View style={styles.errorRecoveryCard}>
              <Text style={styles.errorRecoveryTitle}>Did Android block the install?</Text>
              <Text style={styles.errorRecoverySub}>
                If Android prompted "For your security, your phone is not allowed to install unknown apps", authorize SplitIt in Settings.
              </Text>

              <TouchableOpacity
                style={styles.errorSettingsBtn}
                onPress={handleOpenSettings}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Open settings to allow SplitIt installs"
              >
                <Settings size={16} color={THEME.colors.primary} />
                <Text style={styles.errorSettingsBtnText}>Open Install Permissions</Text>
                <ChevronRight size={14} color={THEME.colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.primaryActionButton}
                onPress={executeDownloadAndInstall}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Retry downloading update"
              >
                <Download size={18} color={THEME.colors.primaryForeground} />
                <Text style={styles.primaryActionText}>Retry Update</Text>
              </TouchableOpacity>

              <View style={styles.secondaryActionsRow}>
                <TouchableOpacity
                  style={styles.browserButton}
                  onPress={handleBrowserFallback}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Download APK via web browser"
                >
                  <ExternalLink size={14} color={THEME.colors.textSecondary} />
                  <Text style={styles.browserButtonText}>Download via Browser</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.laterButton}
                  onPress={onClose}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss update"
                >
                  <Text style={styles.laterButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 14,
  },

  /* ── PERMISSION GUIDE STYLES ── */
  guideContainer: {
    gap: 14,
  },
  trustHeroCard: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    textAlign: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.border,
    gap: 8,
  },
  shieldIconRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: THEME.colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.borderFocus,
    marginBottom: 4,
  },
  trustHeroTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.text,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  trustHeroSubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  guaranteeBox: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.border,
    gap: 10,
  },
  guaranteeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  guaranteeIcon: {
    marginTop: 2,
  },
  guaranteeTextCol: {
    flex: 1,
    gap: 1,
  },
  guaranteeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  guaranteeSub: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    lineHeight: 15,
  },
  guaranteeDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: THEME.colors.hairline,
  },
  stepsCard: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.border,
    gap: 10,
  },
  stepsHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepNumberBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: THEME.colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.borderFocus,
  },
  stepNumberText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  stepItemText: {
    flex: 1,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    lineHeight: 17,
  },
  stepHighlight: {
    color: THEME.colors.text,
    fontWeight: '700',
  },
  guideActionCol: {
    gap: 10,
    marginTop: 4,
  },
  openSettingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.primary,
    height: 48,
    borderRadius: 12,
    gap: 8,
  },
  openSettingsButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.primaryForeground,
  },
  guideSecondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 10,
    minHeight: 44,
  },
  skipButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  guideBrowserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 10,
    minHeight: 44,
  },
  guideBrowserText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },

  /* ── OVERVIEW & HEADER STYLES ── */
  headerCard: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.border,
    gap: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  versionPillCurrent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.border,
  },
  versionLabel: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  versionVal: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  arrowContainer: {
    paddingHorizontal: 2,
  },
  arrowText: {
    color: THEME.colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  versionPillNew: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 5,
    borderWidth: 1,
    borderColor: THEME.colors.borderFocus,
  },
  pillIcon: {
    marginRight: 1,
  },
  versionLabelNew: {
    fontSize: 11,
    color: THEME.colors.primaryLight,
    fontWeight: '500',
  },
  versionValNew: {
    fontSize: 12,
    color: THEME.colors.primary,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  releaseName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.text,
    flex: 1,
    marginRight: 8,
  },
  metaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sizeText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
  },
  dateDot: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  dateText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  securityTrustCard: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.border,
  },
  securityTrustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  securityTrustText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  progressSection: {
    gap: 14,
    paddingVertical: 12,
  },
  progressContainer: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.border,
    gap: 10,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.border,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: THEME.colors.primary,
    borderRadius: 3,
  },
  progressDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressBytes: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
  },
  zeroResidueHint: {
    fontSize: 11,
    color: THEME.colors.successLight,
    fontWeight: '500',
  },
  installingSection: {
    gap: 14,
    paddingVertical: 12,
  },
  installingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.borderFocus,
  },
  installingTextCol: {
    flex: 1,
    gap: 2,
  },
  installingTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  installingSub: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    lineHeight: 16,
  },
  errorSection: {
    gap: 12,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: THEME.colors.dangerMuted,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.danger,
  },
  errorTextCol: {
    flex: 1,
    gap: 2,
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.danger,
  },
  errorText: {
    fontSize: 11,
    color: THEME.colors.dangerLight,
    fontWeight: '500',
    lineHeight: 15,
  },
  errorRecoveryCard: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.border,
    gap: 8,
  },
  errorRecoveryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  errorRecoverySub: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    lineHeight: 16,
  },
  errorSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: THEME.colors.primaryMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.borderFocus,
    marginTop: 2,
  },
  errorSettingsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  notesSection: {
    gap: 8,
  },
  notesSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesScroll: {
    maxHeight: 180,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.border,
  },
  notesContent: {
    padding: 14,
  },
  emptyNotes: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    fontStyle: 'italic',
  },
  footer: {
    gap: 10,
    marginTop: 4,
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.primary,
    height: 48,
    borderRadius: 12,
    gap: 8,
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.primaryForeground,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  browserButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    minHeight: 44,
  },
  browserButtonText: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
  },
  laterButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: 'center',
  },
  laterButtonText: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surfaceElevated,
    height: 48,
    borderRadius: 12,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.border,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.primary,
    height: 48,
    borderRadius: 12,
    gap: 8,
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.primaryForeground,
  },
});
