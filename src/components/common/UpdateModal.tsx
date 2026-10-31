import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  Platform,
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

type UpdateStep = 'IDLE' | 'DOWNLOADING' | 'INSTALLING' | 'ERROR';

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

  // Animated progress bar width
  const progressAnim = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setStep('IDLE');
      setProgress({ percentage: 0, totalBytes: updateInfo?.apkSize || 0, writtenBytes: 0 });
      setErrorMessage(null);
      progressAnim.value = 0;
    }
  }, [visible, updateInfo, progressAnim]);

  const handleStartUpdate = useCallback(async () => {
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
      maxHeight="86%"
      title="Update Available"
      subtitle={`SplitIt v${updateInfo.latestVersion}`}
      showCloseButton={step !== 'DOWNLOADING'}
    >
      <View style={styles.container}>
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

        {/* Dynamic State View */}
        {step === 'DOWNLOADING' && (
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Downloading package...</Text>
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
        )}

        {step === 'INSTALLING' && (
          <View style={styles.installingCard}>
            <ActivityIndicator size="small" color={THEME.colors.primary} />
            <View style={styles.installingTextCol}>
              <Text style={styles.installingTitle}>Opening Android Installer...</Text>
              <Text style={styles.installingSub}>
                Confirm the prompt on your screen to complete update.
              </Text>
            </View>
          </View>
        )}

        {step === 'ERROR' && (
          <View style={styles.errorCard}>
            <AlertCircle size={18} color={THEME.colors.danger} />
            <Text style={styles.errorText}>
              {errorMessage || 'Failed to download update.'}
            </Text>
          </View>
        )}

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
          {step === 'DOWNLOADING' ? (
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
          ) : step === 'INSTALLING' ? (
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
          ) : (
            <>
              {updateInfo.downloadUrl && Platform.OS === 'android' ? (
                <TouchableOpacity
                  style={styles.primaryActionButton}
                  onPress={handleStartUpdate}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Download and install update"
                >
                  <Download size={18} color={THEME.colors.primaryForeground} />
                  <Text style={styles.primaryActionText}>
                    {step === 'ERROR' ? 'Retry Update' : 'Update & Install'}
                  </Text>
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
            </>
          )}
        </View>
      </View>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 16,
  },
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
  progressContainer: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.border,
    gap: 8,
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
  installingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 14,
    padding: 14,
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
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.colors.dangerMuted,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.danger,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: THEME.colors.dangerLight,
    fontWeight: '500',
  },
  notesSection: {
    gap: 8,
  },
  notesSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
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

