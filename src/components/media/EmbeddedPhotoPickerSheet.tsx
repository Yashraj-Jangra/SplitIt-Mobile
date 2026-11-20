import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Platform,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {
  Camera,
  X,
  ChevronUp,
  ChevronDown,
  Image as ImageIcon,
  ShieldCheck,
  Sparkles,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { THEME } from '../../constants/theme';
import { useAppTheme } from '../../contexts/theme.context';
import { haptics } from '../../services/haptics.service';
import {
  EmbeddedPhotoPickerView,
  isEmbeddedPhotoPickerSupported,
} from 'expo-embedded-photo-picker';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_COLLAPSED_HEIGHT = Math.round(SCREEN_HEIGHT * 0.52);
const SHEET_EXPANDED_HEIGHT = Math.round(SCREEN_HEIGHT * 0.88);

export interface EmbeddedPhotoPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectImage: (uri: string) => void;
  onLaunchCamera?: () => void;
  maxSelectionLimit?: number;
  orderedSelection?: boolean;
}

export function EmbeddedPhotoPickerSheet({
  visible,
  onClose,
  onSelectImage,
  onLaunchCamera,
  maxSelectionLimit = 1,
  orderedSelection = false,
}: EmbeddedPhotoPickerSheetProps) {
  const { currentAccent } = useAppTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [selectedUris, setSelectedUris] = useState<string[]>([]);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    setIsSupported(isEmbeddedPhotoPickerSupported());
  }, []);

  const openSheet = useCallback(() => {
    translateY.value = withSpring(0, { damping: 20, stiffness: 220 });
    backdropOpacity.value = withTiming(1, { duration: 240 });
  }, [translateY, backdropOpacity]);

  const closeSheet = useCallback(() => {
    'worklet';
    backdropOpacity.value = withTiming(0, { duration: 180 });
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 220 }, (finished) => {
      if (finished) {
        runOnJS(onClose)();
      }
    });
  }, [backdropOpacity, translateY, onClose]);

  useEffect(() => {
    if (visible) {
      setSelectedUris([]);
      setIsExpanded(false);
      openSheet();
    }
  }, [visible, openSheet]);

  const handleToggleExpand = () => {
    haptics.tick();
    setIsExpanded((prev) => !prev);
  };

  const handleCameraPress = async () => {
    haptics.tap();
    if (onLaunchCamera) {
      onClose();
      onLaunchCamera();
      return;
    }

    try {
      const cameraResult = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.9,
      });

      if (!cameraResult.canceled && cameraResult.assets?.[0]?.uri) {
        haptics.confirm();
        onSelectImage(cameraResult.assets[0].uri);
        onClose();
      }
    } catch {
      haptics.error();
    }
  };

  const handleFallbackGalleryLaunch = async () => {
    haptics.tap();
    try {
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.9,
      });

      if (!pickerResult.canceled && pickerResult.assets?.[0]?.uri) {
        haptics.confirm();
        onSelectImage(pickerResult.assets[0].uri);
        onClose();
      }
    } catch {
      haptics.error();
    }
  };

  const handleUriPermissionGranted = useCallback(
    (event: { nativeEvent: { uris: string[] } }) => {
      const uris = event.nativeEvent?.uris || [];
      if (uris.length > 0) {
        haptics.chartScrub();
        setSelectedUris((prev) => Array.from(new Set([...prev, ...uris])));
        if (maxSelectionLimit === 1) {
          onSelectImage(uris[0]);
          onClose();
        }
      }
    },
    [maxSelectionLimit, onSelectImage, onClose]
  );

  const handleUriPermissionRevoked = useCallback(
    (event: { nativeEvent: { uris: string[] } }) => {
      const revoked = event.nativeEvent?.uris || [];
      if (revoked.length > 0) {
        haptics.tick();
        const revokedSet = new Set(revoked);
        setSelectedUris((prev) => prev.filter((u) => !revokedSet.has(u)));
      }
    },
    []
  );

  const handleSelectionComplete = useCallback(() => {
    haptics.confirm();
    if (selectedUris.length > 0) {
      onSelectImage(selectedUris[0]);
    }
    onClose();
  }, [selectedUris, onSelectImage, onClose]);

  const sheetAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  const backdropAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: backdropOpacity.value,
    };
  });

  if (!visible) return null;

  const currentSheetHeight = isExpanded ? SHEET_EXPANDED_HEIGHT : SHEET_COLLAPSED_HEIGHT;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={closeSheet}>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.backdrop, backdropAnimatedStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheetContainer,
            { height: currentSheetHeight },
            sheetAnimatedStyle,
          ]}
        >
          {/* Header Drag Handle */}
          <TouchableOpacity
            style={styles.handleTouchable}
            activeOpacity={0.8}
            onPress={handleToggleExpand}
            accessibilityRole="button"
            accessibilityLabel={isExpanded ? 'Collapse sheet' : 'Expand sheet'}
          >
            <View style={styles.dragHandle} />
          </TouchableOpacity>

          {/* Header Action Bar */}
          <View style={styles.headerBar}>
            <View style={styles.headerLeft}>
              <TouchableOpacity
                style={styles.iconCircle}
                onPress={() => {
                  haptics.tap();
                  closeSheet();
                }}
                accessibilityRole="button"
                accessibilityLabel="Close photo picker"
              >
                <X size={18} color={THEME.colors.text} />
              </TouchableOpacity>

              <View style={styles.titleColumn}>
                <View style={styles.titleRow}>
                  <Text style={styles.sheetTitle}>Select Receipt</Text>
                  {isSupported ? (
                    <View
                      style={[
                        styles.badgePill,
                        { backgroundColor: `${currentAccent.primary}18`, borderColor: `${currentAccent.primary}35` },
                      ]}
                    >
                      <Sparkles size={11} color={currentAccent.primary} />
                      <Text style={[styles.badgeText, { color: currentAccent.primary }]}>
                        EMBEDDED
                      </Text>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.badgePill,
                        { backgroundColor: `${THEME.colors.surfaceElevated}`, borderColor: THEME.colors.border },
                      ]}
                    >
                      <ShieldCheck size={11} color={THEME.colors.textMuted} />
                      <Text style={[styles.badgeText, { color: THEME.colors.textMuted }]}>
                        SCOPED
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.sheetSubtitle}>
                  {isSupported
                    ? 'Android Embedded Photo Picker'
                    : 'System Scoped Photo Picker'}
                </Text>
              </View>
            </View>

            {/* Header Camera Button */}
            <View style={styles.headerRight}>
              {isSupported && (
                <TouchableOpacity
                  style={styles.expandButton}
                  onPress={handleToggleExpand}
                  accessibilityRole="button"
                  accessibilityLabel="Toggle sheet height"
                >
                  {isExpanded ? (
                    <ChevronDown size={18} color={THEME.colors.textMuted} />
                  ) : (
                    <ChevronUp size={18} color={THEME.colors.textMuted} />
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.cameraHeaderButton,
                  { backgroundColor: `${currentAccent.primary}18`, borderColor: `${currentAccent.primary}45` },
                ]}
                onPress={handleCameraPress}
                accessibilityRole="button"
                accessibilityLabel="Open camera"
              >
                <Camera size={16} color={currentAccent.primary} />
                <Text style={[styles.cameraHeaderText, { color: currentAccent.primary }]}>
                  Camera
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Body Section */}
          <View style={styles.contentArea}>
            {isSupported && Platform.OS === 'android' ? (
              <View style={styles.embeddedPickerWrapper}>
                <EmbeddedPhotoPickerView
                  maxSelectionLimit={maxSelectionLimit}
                  orderedSelection={orderedSelection}
                  accentColor={currentAccent.primary}
                  expanded={isExpanded}
                  onUriPermissionGranted={handleUriPermissionGranted}
                  onUriPermissionRevoked={handleUriPermissionRevoked}
                  onSelectionComplete={handleSelectionComplete}
                  style={styles.embeddedPicker}
                />
              </View>
            ) : (
              /* Fallback for iOS and unsupported Android devices */
              <View style={styles.fallbackContainer}>
                <View style={styles.fallbackGraphicRing}>
                  <ImageIcon size={38} color={currentAccent.primary} />
                </View>

                <Text style={styles.fallbackTitle}>Browse Media Library</Text>
                <Text style={styles.fallbackSubtitle}>
                  Privacy-first photo selection. Only the photos you choose will be shared with SplitIt Vision OCR.
                </Text>

                <View style={styles.fallbackActions}>
                  <TouchableOpacity
                    style={[styles.primaryFallbackButton, { backgroundColor: currentAccent.primary }]}
                    onPress={handleFallbackGalleryLaunch}
                    accessibilityRole="button"
                    accessibilityLabel="Choose photo from library"
                  >
                    <ImageIcon size={18} color="#ffffff" />
                    <Text style={styles.primaryFallbackButtonText}>Choose from Photos</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryFallbackButton}
                    onPress={handleCameraPress}
                    accessibilityRole="button"
                    accessibilityLabel="Take receipt photo"
                  >
                    <Camera size={18} color={THEME.colors.text} />
                    <Text style={styles.secondaryFallbackButtonText}>Take Receipt Photo</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.privacyNoticeRow}>
                  <ShieldCheck size={13} color={THEME.colors.textMuted} />
                  <Text style={styles.privacyNoticeText}>
                    No storage or media permissions required.
                  </Text>
                </View>
              </View>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  sheetContainer: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: THEME.colors.border,
    overflow: 'hidden',
    paddingBottom: 20,
  },
  handleTouchable: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: THEME.colors.border,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleColumn: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: THEME.typography.weight.bold,
    color: THEME.colors.text,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: THEME.typography.weight.bold,
    letterSpacing: 0.5,
  },
  sheetSubtitle: {
    fontSize: 12,
    fontWeight: THEME.typography.weight.normal,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expandButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
  },
  cameraHeaderText: {
    fontSize: 12,
    fontWeight: THEME.typography.weight.semibold,
  },
  contentArea: {
    flex: 1,
  },
  embeddedPickerWrapper: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  embeddedPicker: {
    flex: 1,
  },
  fallbackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  fallbackGraphicRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  fallbackTitle: {
    fontSize: 17,
    fontWeight: THEME.typography.weight.bold,
    color: THEME.colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  fallbackSubtitle: {
    fontSize: 13,
    fontWeight: THEME.typography.weight.normal,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
  },
  fallbackActions: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  primaryFallbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: THEME.radius.md,
  },
  primaryFallbackButtonText: {
    fontSize: 14,
    fontWeight: THEME.typography.weight.semibold,
    color: '#ffffff',
  },
  secondaryFallbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  secondaryFallbackButtonText: {
    fontSize: 14,
    fontWeight: THEME.typography.weight.semibold,
    color: THEME.colors.text,
  },
  privacyNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  privacyNoticeText: {
    fontSize: 11,
    fontWeight: THEME.typography.weight.normal,
    color: THEME.colors.textMuted,
  },
});
