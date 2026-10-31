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
  ArrowUpCircle,
  Download,
  ExternalLink,
  AlertCircle,
  X,
  CheckCircle2,
  HardDrive,
  ShieldCheck,
  Settings,
  ArrowRight,
  ChevronRight,
  Lock,
} from 'lucide-react-native';
import { BottomSheetModal } from './BottomSheetModal';
import { AiMarkdownView } from '../ai/AiMarkdownView';
import { THEME } from '../../constants/theme';
import { useAppTheme } from '../../contexts/theme.context';
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
  const { currentAccent } = useAppTheme();
  const [step, setStep] = useState<UpdateStep>('IDLE');
  const [progress, setProgress] = useState<DownloadProgress>({
    percentage: 0,
    totalBytes: 0,
    writtenBytes: 0,
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tracks if user went to Android settings to authorize package install
  const waitingForSettingsReturnRef = useRef(false);

  // Cancellation and lock tracking
  const isCancelledRef = useRef(false);
  const [isCancelling, setIsCancelling] = useState(false);

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
      isCancelledRef.current = false;
      setIsCancelling(false);
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

    isCancelledRef.current = false;
    setIsCancelling(false);
    haptics.confirm();
    setStep('DOWNLOADING');
    setErrorMessage(null);
    progressAnim.value = 0;

    try {
      await updateService.downloadAndInstallUpdate(
        updateInfo.downloadUrl,
        (p) => {
          if (isCancelledRef.current) return;
          setProgress(p);
          progressAnim.value = withTiming(p.percentage, {
            duration: 100,
            easing: Easing.linear,
          });
        }
      );

      if (isCancelledRef.current) return;

      // Installer opened
      setStep('INSTALLING');
      haptics.saveSuccess();
    } catch (err: unknown) {
      if (isCancelledRef.current) return;
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
        executeDownloadAndInstall();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [executeDownloadAndInstall]);

  // Zero-Residue safe cancellation handler
  const handleCancel = useCallback(async () => {
    if (isCancelling) return;
    isCancelledRef.current = true;
    setIsCancelling(true);
    haptics.tap();

    try {
      await updateService.cancelDownload();
    } catch {
      // Defensive
    } finally {
      progressAnim.value = 0;
      setProgress({ percentage: 0, totalBytes: updateInfo?.apkSize || 0, writtenBytes: 0 });
      setIsCancelling(false);
      setStep('IDLE');
    }
  }, [isCancelling, updateInfo, progressAnim]);

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

  const isUpdating = step === 'DOWNLOADING' || step === 'INSTALLING';

  return (
    <BottomSheetModal
      visible={visible}
      onClose={isUpdating ? handleCancel : onClose}
      maxHeight={step === 'PERMISSION_GUIDE' ? '88%' : '88%'}
      title={
        step === 'PERMISSION_GUIDE'
          ? 'Install Authorization'
          : isUpdating
          ? 'Updating SplitIt'
          : 'Update Available'
      }
      subtitle={
        step === 'PERMISSION_GUIDE'
          ? 'One-time permission for direct updates'
          : isUpdating
          ? 'Download in progress'
          : `SplitIt v${updateInfo.latestVersion}`
      }
      showCloseButton={!isUpdating}
      showHandle={!isUpdating}
      dismissible={!isUpdating}
    >
      <View style={styles.container}>
        {/* ── STEP 1: OPEN EDITORIAL PERMISSION GUIDE (NO-DIV DESIGN) ── */}
        {step === 'PERMISSION_GUIDE' && (
          <View style={styles.guideWrapper}>
            <View style={styles.guideHeader}>
              <View
                style={[
                  styles.guideIconWrap,
                  {
                    backgroundColor: currentAccent.primaryMuted,
                    borderColor: currentAccent.borderFocus,
                  },
                ]}
              >
                <ShieldCheck size={24} color={currentAccent.primary} />
              </View>
              <View style={styles.guideHeaderTextCol}>
                <Text style={styles.guideHeaderSub}>
                  Android requires permission to install APK packages outside Google Play. Authorize SplitIt to enable seamless in-app updates.
                </Text>
              </View>
            </View>

            <View style={styles.hairlineDivider} />

            {/* Connecting Timeline Nodes (No Div / Editorial Stem Lines) */}
            <View style={styles.timelineList}>
              <View style={styles.timelineItem}>
                <View style={styles.nodeColumn}>
                  <View
                    style={[
                      styles.nodeCircle,
                      {
                        backgroundColor: currentAccent.primaryMuted,
                        borderColor: currentAccent.primary,
                      },
                    ]}
                  >
                    <Text style={[styles.nodeNumber, { color: currentAccent.primary }]}>1</Text>
                  </View>
                  <View style={styles.nodeStem} />
                </View>
                <View style={styles.timelineTextCol}>
                  <Text style={styles.timelineTitle}>Open System Settings</Text>
                  <Text style={styles.timelineDesc}>
                    Tap below to go to Android's app install permissions.
                  </Text>
                </View>
              </View>

              <View style={styles.timelineItem}>
                <View style={styles.nodeColumn}>
                  <View
                    style={[
                      styles.nodeCircle,
                      {
                        backgroundColor: currentAccent.primaryMuted,
                        borderColor: currentAccent.primary,
                      },
                    ]}
                  >
                    <Text style={[styles.nodeNumber, { color: currentAccent.primary }]}>2</Text>
                  </View>
                  <View style={styles.nodeStem} />
                </View>
                <View style={styles.timelineTextCol}>
                  <Text style={styles.timelineTitle}>Turn on "Allow from this source"</Text>
                  <Text style={styles.timelineDesc}>
                    Toggle the switch on for SplitIt.
                  </Text>
                </View>
              </View>

              <View style={styles.timelineItem}>
                <View style={styles.nodeColumn}>
                  <View
                    style={[
                      styles.nodeCircle,
                      {
                        backgroundColor: currentAccent.primaryMuted,
                        borderColor: currentAccent.primary,
                      },
                    ]}
                  >
                    <Text style={[styles.nodeNumber, { color: currentAccent.primary }]}>3</Text>
                  </View>
                </View>
                <View style={styles.timelineTextCol}>
                  <Text style={styles.timelineTitle}>Return & Install</Text>
                  <Text style={styles.timelineDesc}>
                    Press Back to return to SplitIt — the update begins immediately.
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.hairlineDivider} />

            {/* Action Bar */}
            <View style={styles.actionsCol}>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: currentAccent.primary }]}
                onPress={handleOpenSettings}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Open Android System Settings for SplitIt install permission"
              >
                <Settings size={18} color={THEME.colors.primaryForeground} />
                <Text style={styles.primaryBtnText}>Open System Settings</Text>
              </TouchableOpacity>

              <View style={styles.secondaryRow}>
                <TouchableOpacity
                  style={styles.secondaryTextBtn}
                  onPress={handleSkipGuideAndProceed}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="I already allowed this, proceed with update"
                >
                  <Text style={styles.secondaryTextBtnText}>Already Allowed / Continue</Text>
                  <ArrowRight size={13} color={THEME.colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryTextBtn}
                  onPress={handleBrowserFallback}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Download update via browser instead"
                >
                  <ExternalLink size={13} color={THEME.colors.textMuted} />
                  <Text style={[styles.secondaryTextBtnText, { color: THEME.colors.textMuted }]}>
                    Download via Browser
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ── STEP 2: IDLE OVERVIEW (WIDE EDITORIAL LAYOUT) ── */}
        {step === 'IDLE' && (
          <View style={styles.idleWrapper}>
            {/* Version Meta Bar */}
            <View style={styles.versionBar}>
              <View style={styles.versionPillsRow}>
                <View style={styles.versionCurrentPill}>
                  <Text style={styles.versionCurrentLabel}>Installed</Text>
                  <Text style={styles.versionCurrentVal}>v{updateInfo.currentVersion}</Text>
                </View>

                <ArrowRight size={12} color={THEME.colors.textMuted} />

                <View
                  style={[
                    styles.versionNewPill,
                    {
                      backgroundColor: currentAccent.primaryMuted,
                      borderColor: currentAccent.borderFocus,
                    },
                  ]}
                >
                  <ArrowUpCircle size={13} color={currentAccent.primary} />
                  <Text style={[styles.versionNewVal, { color: currentAccent.primary }]}>
                    v{updateInfo.latestVersion}
                  </Text>
                </View>
              </View>

              <View style={styles.metaBadgeRow}>
                <HardDrive size={12} color={THEME.colors.textMuted} />
                <Text style={styles.metaBadgeText}>
                  {updateInfo.apkSize > 0 ? formatBytes(updateInfo.apkSize) : 'Direct APK'}
                </Text>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaBadgeText}>{formatDate(updateInfo.publishedAt)}</Text>
              </View>
            </View>

            <View style={styles.hairlineDivider} />

            {/* Release Changelog Section */}
            <View style={styles.notesSection}>
              <View style={styles.notesHeaderRow}>
                <Text style={styles.notesSectionLabel}>WHAT'S NEW IN V{updateInfo.latestVersion}</Text>
              </View>

              <ScrollView
                style={styles.notesScroll}
                contentContainerStyle={styles.notesContent}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                {updateInfo.releaseNotes.trim() ? (
                  <AiMarkdownView content={updateInfo.releaseNotes} />
                ) : (
                  <Text style={styles.emptyNotes}>Performance improvements and bug fixes.</Text>
                )}
              </ScrollView>
            </View>

            <View style={styles.hairlineDivider} />

            {/* Footer Action Controls */}
            <View style={styles.actionsCol}>
              {updateInfo.downloadUrl && Platform.OS === 'android' ? (
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: currentAccent.primary }]}
                  onPress={handleStartUpdate}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Download and install update"
                >
                  <Download size={18} color={THEME.colors.primaryForeground} />
                  <Text style={styles.primaryBtnText}>
                    Update to v{updateInfo.latestVersion}
                  </Text>
                </TouchableOpacity>
              ) : null}

              <View style={styles.secondaryRow}>
                <TouchableOpacity
                  style={styles.secondaryTextBtn}
                  onPress={handleBrowserFallback}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="View release on GitHub"
                >
                  <ExternalLink size={13} color={THEME.colors.textSecondary} />
                  <Text style={styles.secondaryTextBtnText}>View on GitHub</Text>
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
          </View>
        )}

        {/* ── STEP 3: DOWNLOADING PROGRESS (LOCKED EDITORIAL VIEW) ── */}
        {step === 'DOWNLOADING' && (
          <View style={styles.downloadWrapper}>
            {/* Lock / Active Status Pill */}
            <View style={styles.downloadStatusRow}>
              <View
                style={[
                  styles.downloadLockPill,
                  {
                    backgroundColor: currentAccent.primaryMuted,
                    borderColor: currentAccent.borderFocus,
                  },
                ]}
              >
                <Lock size={11} color={currentAccent.primary} />
                <Text style={[styles.downloadLockPillText, { color: currentAccent.primary }]}>
                  DOWNLOADING · LOCKED
                </Text>
              </View>

              <Text style={[styles.downloadPercentage, { color: currentAccent.primary }]}>
                {Math.round(progress.percentage * 100)}%
              </Text>
            </View>

            {/* Version Meta Headline */}
            <View style={styles.downloadHeadlineCol}>
              <Text style={styles.downloadTitle}>
                SplitIt v{updateInfo.latestVersion}
              </Text>
              <Text style={styles.downloadSubtitle}>
                {formatBytes(progress.writtenBytes)} of{' '}
                {formatBytes(progress.totalBytes || updateInfo.apkSize)}
              </Text>
            </View>

            {/* Hardware-Accelerated Glowing Progress Track */}
            <View style={styles.progressBarTrack}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  { backgroundColor: currentAccent.primary },
                  progressStyle,
                ]}
              />
            </View>

            {/* Reassurance Note */}
            <View style={styles.downloadNoticeRow}>
              <Text style={styles.downloadNoticeText}>
                Please stay on this screen while the update package downloads.
              </Text>
            </View>

            <View style={styles.hairlineDivider} />

            {/* Cancel Action */}
            <TouchableOpacity
              style={styles.cancelDownloadBtn}
              onPress={handleCancel}
              disabled={isCancelling}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Cancel update download"
            >
              {isCancelling ? (
                <>
                  <ActivityIndicator size="small" color={THEME.colors.textSecondary} />
                  <Text style={styles.cancelDownloadText}>Cancelling & cleaning up...</Text>
                </>
              ) : (
                <>
                  <X size={15} color={THEME.colors.textSecondary} />
                  <Text style={styles.cancelDownloadText}>Cancel Download</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 4: INSTALLING / PACKAGE LAUNCH (LOCKED) ── */}
        {step === 'INSTALLING' && (
          <View style={styles.installWrapper}>
            <View style={styles.installRow}>
              <ActivityIndicator size="small" color={currentAccent.primary} />
              <View style={styles.installTextCol}>
                <Text style={styles.installTitle}>Opening Android Installer...</Text>
                <Text style={styles.installSubtitle}>
                  Confirm the prompt on your screen to complete installation.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: currentAccent.primary, marginTop: 8 }]}
              onPress={onClose}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <CheckCircle2 size={16} color={THEME.colors.primaryForeground} />
              <Text style={styles.primaryBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 5: ERROR STATE WITH SETTINGS RECOVERY ── */}
        {step === 'ERROR' && (
          <View style={styles.errorWrapper}>
            <View style={styles.errorBanner}>
              <AlertCircle size={20} color={THEME.colors.danger} />
              <View style={styles.errorTextCol}>
                <Text style={styles.errorTitle}>Installation Interrupted</Text>
                <Text style={styles.errorSubtitle}>
                  {errorMessage || 'Failed to complete update installation.'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.errorSettingsBtn}
              onPress={handleOpenSettings}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Open settings to allow SplitIt installs"
            >
              <Settings size={15} color={currentAccent.primary} />
              <Text style={[styles.errorSettingsText, { color: currentAccent.primary }]}>
                Authorize SplitIt in Install Unknown Apps Settings
              </Text>
              <ChevronRight size={14} color={currentAccent.primary} />
            </TouchableOpacity>

            <View style={styles.actionsCol}>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: currentAccent.primary }]}
                onPress={executeDownloadAndInstall}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Retry downloading update"
              >
                <Download size={18} color={THEME.colors.primaryForeground} />
                <Text style={styles.primaryBtnText}>Retry Update</Text>
              </TouchableOpacity>

              <View style={styles.secondaryRow}>
                <TouchableOpacity
                  style={styles.secondaryTextBtn}
                  onPress={handleBrowserFallback}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Download APK via web browser"
                >
                  <ExternalLink size={13} color={THEME.colors.textSecondary} />
                  <Text style={styles.secondaryTextBtnText}>Download via Browser</Text>
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
    paddingHorizontal: 0,
    paddingBottom: 8,
    gap: 12,
  },
  hairlineDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: THEME.colors.hairline,
    marginVertical: 4,
  },

  /* ── PERMISSION GUIDE ── */
  guideWrapper: {
    gap: 12,
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 4,
  },
  guideIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  guideHeaderTextCol: {
    flex: 1,
    gap: 2,
  },
  guideHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.text,
    letterSpacing: -0.2,
  },
  guideHeaderSub: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    lineHeight: 17,
  },
  timelineList: {
    paddingVertical: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  nodeColumn: {
    alignItems: 'center',
    width: 26,
  },
  nodeCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  nodeNumber: {
    fontSize: 11,
    fontWeight: '700',
  },
  nodeStem: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: THEME.colors.hairlineLight,
    marginVertical: 2,
  },
  timelineTextCol: {
    flex: 1,
    paddingTop: 2,
    gap: 2,
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  timelineDesc: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    lineHeight: 16,
  },

  /* ── IDLE / OVERVIEW ── */
  idleWrapper: {
    gap: 12,
  },
  versionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  versionPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  versionCurrentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.border,
  },
  versionCurrentLabel: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  versionCurrentVal: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  versionNewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 5,
    borderWidth: 1,
  },
  versionNewVal: {
    fontSize: 12,
    fontWeight: '700',
  },
  metaBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaBadgeText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  metaDot: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  notesSection: {
    gap: 6,
  },
  notesHeaderRow: {
    paddingVertical: 2,
  },
  notesSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
  },
  notesScroll: {
    maxHeight: 260,
  },
  notesContent: {
    paddingVertical: 6,
  },
  emptyNotes: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: 12,
  },

  /* ── DOWNLOADING (LOCKED) ── */
  downloadWrapper: {
    gap: 14,
    paddingVertical: 8,
  },
  downloadStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  downloadLockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  downloadLockPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  downloadPercentage: {
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  downloadHeadlineCol: {
    gap: 2,
  },
  downloadTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  downloadSubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.border,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  downloadNoticeRow: {
    paddingVertical: 2,
  },
  downloadNoticeText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    lineHeight: 16,
  },
  cancelDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  cancelDownloadText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },

  /* ── INSTALLING ── */
  installWrapper: {
    gap: 14,
    paddingVertical: 12,
  },
  installRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  installTextCol: {
    flex: 1,
    gap: 2,
  },
  installTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  installSubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    lineHeight: 16,
  },

  /* ── ERROR ── */
  errorWrapper: {
    gap: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 6,
  },
  errorTextCol: {
    flex: 1,
    gap: 2,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.danger,
  },
  errorSubtitle: {
    fontSize: 12,
    color: THEME.colors.dangerLight,
    lineHeight: 16,
  },
  errorSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  errorSettingsText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },

  /* ── COMMON ACTIONS ── */
  actionsCol: {
    gap: 8,
    marginTop: 4,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.primaryForeground,
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  secondaryTextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 10,
    minHeight: 44,
  },
  secondaryTextBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
  },
  laterButton: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  laterButtonText: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
});
