import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  TextInput,
  Image,
  Pressable,
  GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withSpring,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { QuantumSpinner } from '../../src/components/brand/QuantumLogo';
import { PressableScale } from '../../src/components/common/PressableScale';
import { haptics } from '../../src/services/haptics.service';
import {
  X,
  Zap,
  ZapOff,
  Image as ImageIcon,
  Sparkles,
  Camera,
  Check,
  RotateCcw,
  Receipt,
  ShieldCheck,
  Calendar,
  ArrowRight,
  Grid3x3,
  CheckCircle2,
  Pencil,
  AlertCircle,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import {
  aiService,
  ScannedReceiptResult,
  ReceiptScanError,
} from '../../src/services/ai.service';
import { EmbeddedPhotoPickerSheet } from '../../src/components/media';
import { useCurrency } from '../../src/contexts/currency.context';
import { useAppTheme } from '../../src/contexts/theme.context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const VIEWFINDER_WIDTH = Math.round(Math.min(SCREEN_WIDTH * 0.82, 330));
const VIEWFINDER_HEIGHT = Math.round(VIEWFINDER_WIDTH * 1.38);

export default function ReceiptScannerScreen() {
  const router = useRouter();
  const { currentAccent } = useAppTheme();
  const { currencySymbol } = useCurrency();
  const [permission, requestPermission] = useCameraPermissions();

  const cameraRef = useRef<CameraView>(null);

  // Pro camera states
  const [facing, setFacing] = useState<CameraType>('back');
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('Initializing Vision Scanner...');
  const [scanResult, setScanResult] = useState<ScannedReceiptResult | null>(null);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [merchantInput, setMerchantInput] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [isPhotoPickerSheetVisible, setIsPhotoPickerSheetVisible] = useState(false);
  const [detailedError, setDetailedError] = useState<{
    title: string;
    message: string;
    code?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);

  // Animations
  const scanLineY = useSharedValue(0);
  const shutterFlashOpacity = useSharedValue(0);
  const focusScale = useSharedValue(1.35);
  const focusOpacity = useSharedValue(0);

  // Dynamic laser sweep worklet
  useEffect(() => {
    if (!scanResult && !isProcessing) {
      scanLineY.value = withRepeat(
        withSequence(
          withTiming(VIEWFINDER_HEIGHT - 6, {
            duration: 2200,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(0, {
            duration: 2200,
            easing: Easing.inOut(Easing.quad),
          })
        ),
        -1,
        true
      );
    } else {
      cancelAnimation(scanLineY);
    }

    return () => {
      cancelAnimation(scanLineY);
    };
  }, [scanResult, isProcessing, scanLineY]);

  const animatedScanLineStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ translateY: scanLineY.value }],
    };
  });

  const animatedFlashStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: shutterFlashOpacity.value,
    };
  });

  const animatedFocusStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ scale: focusScale.value }],
      opacity: focusOpacity.value,
    };
  });

  const triggerShutterFlash = () => {
    shutterFlashOpacity.value = withSequence(
      withTiming(0.85, { duration: 35 }),
      withTiming(0, { duration: 160 })
    );
  };

  const handleTapToFocus = (event: GestureResponderEvent) => {
    if (isProcessing || scanResult) return;
    const { locationX, locationY } = event.nativeEvent;
    setFocusPoint({ x: locationX, y: locationY });
    haptics.tick();

    focusScale.value = 1.35;
    focusScale.value = withSpring(1.0, { damping: 14, stiffness: 220 });
    focusOpacity.value = 1;
    focusOpacity.value = withSequence(
      withTiming(1, { duration: 800 }),
      withTiming(0, { duration: 350 })
    );
  };

  const handleProcessImage = async (uri: string) => {
    if (isProcessing) return;
    setDetailedError(null);
    setErrorMessage(null);
    setScanResult(null);
    setCapturedImageUri(uri);
    setIsProcessing(true);
    setProcessingStage('Optimizing receipt geometry & clarity...');

    const stageTimer1 = setTimeout(() => {
      setProcessingStage('Uploading receipt to SplitIt secure cloud...');
    }, 700);

    const stageTimer2 = setTimeout(() => {
      setProcessingStage('Extracting merchant, totals & tax items...');
    }, 1800);

    try {
      const result = await aiService.scanReceipt(uri);
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);

      haptics.saveSuccess();
      setScanResult(result);
      setMerchantInput(result.merchant || result.description);
      setAmountInput(result.amount > 0 ? result.amount.toFixed(2) : '');
    } catch (err: any) {
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      haptics.error();

      if (err instanceof ReceiptScanError) {
        if (err.code === 'NETWORK_ERROR') {
          setDetailedError({
            title: 'Network Offline',
            message: err.message,
            code: err.code,
          });
        } else if (err.code === 'UNAUTHORIZED') {
          setDetailedError({
            title: 'Sign In Required',
            message: err.message,
            code: err.code,
          });
        } else if (err.code === 'OCR_PARSE_FAILED') {
          setDetailedError({
            title: 'Receipt Not Legible',
            message: err.message,
            code: err.code,
          });
        } else {
          setDetailedError({
            title: 'Upload Failed',
            message: err.message,
            code: err.code,
          });
        }
      } else {
        setDetailedError({
          title: 'Scanning Failed',
          message:
            err?.message ||
            'SplitIt Vision was unable to parse this receipt. Please retry with a clear photo in good lighting.',
          code: 'UNKNOWN_ERROR',
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCapture = async () => {
    if (isProcessing || scanResult) return;
    setDetailedError(null);
    setErrorMessage(null);
    haptics.confirm();
    triggerShutterFlash();

    try {
      if (cameraRef.current) {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.9,
          skipProcessing: false,
        });

        if (photo?.uri) {
          await handleProcessImage(photo.uri);
        } else {
          throw new Error('Camera capture failed');
        }
      }
    } catch (err: any) {
      haptics.error();
      setDetailedError({
        title: 'Camera Error',
        message: err?.message || 'Camera shutter failed to capture photo frame.',
      });
    }
  };

  const handlePickFromGallery = () => {
    if (isProcessing) return;
    haptics.tap();
    setDetailedError(null);
    setIsPhotoPickerSheetVisible(true);
  };

  const handleToggleTorch = useCallback(() => {
    haptics.tick();
    setIsTorchOn((prev) => !prev);
  }, []);

  const handleToggleGrid = useCallback(() => {
    haptics.tick();
    setShowGrid((prev) => !prev);
  }, []);

  const handleToggleFacing = useCallback(() => {
    haptics.tap();
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  }, []);

  const handleSetZoom = useCallback((level: number) => {
    haptics.tick();
    setZoomLevel(level);
  }, []);

  const handleRetake = () => {
    haptics.tap();
    setScanResult(null);
    setCapturedImageUri(null);
    setMerchantInput('');
    setAmountInput('');
    setDetailedError(null);
    setErrorMessage(null);
  };

  const handleApplyResult = () => {
    if (!scanResult) return;
    haptics.confirm();
    const finalDescription = merchantInput.trim() || scanResult.merchant || scanResult.description;
    const parsedAmt = parseFloat(amountInput);
    const finalAmount = !isNaN(parsedAmt) && parsedAmt >= 0 ? parsedAmt : scanResult.amount || 0;

    router.replace({
      pathname: '/expenses/new',
      params: {
        amount: String(finalAmount),
        description: finalDescription,
        category: scanResult.category.sub,
        ...(capturedImageUri || scanResult.imageUrl
          ? { receiptImageUrl: capturedImageUri || scanResult.imageUrl }
          : {}),
      },
    });
  };

  // Flagship Permission Request Screen
  if (!permission || !permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.circleButton}
            onPress={() => {
              haptics.tap();
              router.back();
            }}
            accessibilityRole="button"
            accessibilityLabel="Close camera"
          >
            <X size={20} color={THEME.colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.permissionContent}>
          <View style={[styles.permissionIconBadge, { borderColor: `${currentAccent.primary}35` }]}>
            <View style={[styles.permissionIconInner, { backgroundColor: `${currentAccent.primary}18` }]}>
              <Camera size={44} color={currentAccent.primary} />
            </View>
          </View>

          <Text style={styles.permissionTitle}>Receipt Camera</Text>
          <Text style={styles.permissionDesc}>
            SplitIt uses on-device document vision to parse merchant names, totals, taxes, and dates
            with optical precision.
          </Text>

          <View style={styles.permissionFeaturesList}>
            <View style={styles.permissionFeatureItem}>
              <CheckCircle2 size={16} color={THEME.colors.success} />
              <Text style={styles.permissionFeatureText}>Instant Total & Tax Extraction</Text>
            </View>
            <View style={styles.permissionFeatureItem}>
              <CheckCircle2 size={16} color={THEME.colors.success} />
              <Text style={styles.permissionFeatureText}>Smart Category Auto-Tagging</Text>
            </View>
            <View style={styles.permissionFeatureItem}>
              <CheckCircle2 size={16} color={THEME.colors.success} />
              <Text style={styles.permissionFeatureText}>High-Resolution Edge Detection</Text>
            </View>
          </View>

          <PressableScale
            style={[styles.primaryPermButton, { backgroundColor: currentAccent.primary }]}
            onPress={() => requestPermission()}
            hapticFeedback="confirm"
            accessibilityRole="button"
            accessibilityLabel="Enable Camera Access"
          >
            <Text style={styles.primaryPermButtonText}>Enable Camera Access</Text>
          </PressableScale>

          <PressableScale
            style={styles.secondaryPermButton}
            onPress={handlePickFromGallery}
            hapticFeedback="tap"
            accessibilityRole="button"
            accessibilityLabel="Choose from Gallery"
          >
            <ImageIcon size={18} color={THEME.colors.textSecondary} />
            <Text style={styles.secondaryPermButtonText}>Choose from Photos</Text>
          </PressableScale>
        </View>

        {/* Embedded Photo Picker Bottom Sheet for Permission Screen */}
        <EmbeddedPhotoPickerSheet
          visible={isPhotoPickerSheetVisible}
          onClose={() => setIsPhotoPickerSheetVisible(false)}
          onSelectImage={(uri) => {
            handleProcessImage(uri);
          }}
          onLaunchCamera={() => {
            setIsPhotoPickerSheetVisible(false);
            requestPermission();
          }}
          maxSelectionLimit={1}
          orderedSelection={false}
        />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Live Optical Viewfinder */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        enableTorch={isTorchOn}
        zoom={zoomLevel}
        autofocus="on"
        animateShutter={true}
      />

      {/* Optical Mask Layer Framing Document Cutout */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={styles.maskContainer}>
          {/* Top Mask */}
          <View style={styles.topMask}>
            {/* Live Guidance Banner */}
            {!scanResult && !isProcessing && (
              <View style={styles.guidancePill}>
                <View style={styles.statusDot} />
                <Text style={styles.guidanceText}>ALIGN RECEIPT EDGES WITHIN FRAME</Text>
              </View>
            )}

            {errorMessage && (
              <View style={styles.errorBanner}>
                <AlertCircle size={14} color={THEME.colors.danger} />
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            )}
          </View>

          {/* Center Aperture Row */}
          <View style={styles.centerMaskRow}>
            <View style={styles.sideMask} />

            {/* Transparent Viewfinder Aperture */}
            <Pressable
              style={styles.viewfinderAperture}
              onPress={handleTapToFocus}
              accessibilityRole="imagebutton"
              accessibilityLabel="Viewfinder. Tap anywhere to focus"
            >
              {/* Corner Framing Brackets */}
              <View style={[styles.cornerBracket, styles.topLeft, { borderColor: currentAccent.primary }]} />
              <View style={[styles.cornerBracket, styles.topRight, { borderColor: currentAccent.primary }]} />
              <View style={[styles.cornerBracket, styles.bottomLeft, { borderColor: currentAccent.primary }]} />
              <View style={[styles.cornerBracket, styles.bottomRight, { borderColor: currentAccent.primary }]} />

              {/* Edge HUD Ticks */}
              <View style={styles.edgeTickTop} />
              <View style={styles.edgeTickBottom} />
              <View style={styles.edgeTickLeft} />
              <View style={styles.edgeTickRight} />

              {/* Center Crosshair Target */}
              <View style={styles.centerCrosshair}>
                <View style={styles.crosshairDot} />
              </View>

              {/* Toggleable 3x3 Composition Grid */}
              {showGrid && (
                <View style={styles.gridOverlay} pointerEvents="none">
                  <View style={[styles.gridLineV, { left: '33.33%' }]} />
                  <View style={[styles.gridLineV, { left: '66.66%' }]} />
                  <View style={[styles.gridLineH, { top: '33.33%' }]} />
                  <View style={[styles.gridLineH, { top: '66.66%' }]} />
                </View>
              )}

              {/* Dynamic Laser Scanning Line */}
              {!scanResult && !isProcessing && (
                <Animated.View
                  pointerEvents="none"
                  style={[styles.scanLineContainer, animatedScanLineStyle]}
                >
                  <View
                    style={[
                      styles.scanLine,
                      {
                        backgroundColor: currentAccent.primary,
                        shadowColor: currentAccent.primary,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.scanBeamGlow,
                      { backgroundColor: `${currentAccent.primary}20` },
                    ]}
                  />
                </Animated.View>
              )}

              {/* Interactive Tap-to-Focus Reticle */}
              {focusPoint && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.focusRing,
                    {
                      left: focusPoint.x - 30,
                      top: focusPoint.y - 30,
                      borderColor: currentAccent.primary,
                    },
                    animatedFocusStyle,
                  ]}
                >
                  <View style={[styles.focusTick, styles.focusTickTop, { backgroundColor: currentAccent.primary }]} />
                  <View style={[styles.focusTick, styles.focusTickBottom, { backgroundColor: currentAccent.primary }]} />
                  <View style={[styles.focusTick, styles.focusTickLeft, { backgroundColor: currentAccent.primary }]} />
                  <View style={[styles.focusTick, styles.focusTickRight, { backgroundColor: currentAccent.primary }]} />
                  <View style={[styles.focusDot, { backgroundColor: currentAccent.primary }]} />
                </Animated.View>
              )}
            </Pressable>

            <View style={styles.sideMask} />
          </View>

          {/* Bottom Mask */}
          <View style={styles.bottomMask} />
        </View>
      </View>

      {/* Foreground UI Controls & Overlays */}
      <SafeAreaView style={styles.foregroundOverlay} edges={['top', 'bottom']} pointerEvents="box-none">
        {/* Top Navigation & Mode HUD Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.circleButton}
            onPress={() => {
              haptics.tap();
              router.back();
            }}
            accessibilityRole="button"
            accessibilityLabel="Exit receipt scanner"
          >
            <X size={20} color={THEME.colors.text} />
          </TouchableOpacity>

          <View style={styles.modeBadge}>
            <Sparkles size={13} color={THEME.colors.aiLight} />
            <Text style={styles.modeBadgeText}>SPLITIT VISION OCR</Text>
          </View>

          <View style={styles.topActionGroup}>
            <TouchableOpacity
              style={[
                styles.smallCircleButton,
                showGrid && [styles.buttonActive, { borderColor: currentAccent.primary, backgroundColor: `${currentAccent.primary}25` }],
              ]}
              onPress={handleToggleGrid}
              accessibilityRole="button"
              accessibilityLabel="Toggle composition grid"
            >
              <Grid3x3 size={17} color={showGrid ? currentAccent.primary : THEME.colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.smallCircleButton,
                isTorchOn && [styles.buttonActive, { borderColor: currentAccent.primary, backgroundColor: `${currentAccent.primary}25` }],
              ]}
              onPress={handleToggleTorch}
              accessibilityRole="button"
              accessibilityLabel="Toggle camera torch"
            >
              {isTorchOn ? (
                <Zap size={17} color={currentAccent.primary} />
              ) : (
                <ZapOff size={17} color={THEME.colors.text} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Viewfinder Center Area Spacer */}
        <View style={styles.flexSpacer} pointerEvents="none" />

        {/* Vision Inspection Studio Sheet (When Scanned) */}
        {scanResult ? (
          <View style={[styles.studioSheet, { borderColor: `${currentAccent.primary}40` }]}>
            <View style={styles.sheetHandle} />

            {/* Header Status Row */}
            <View style={styles.studioHeaderRow}>
              <View style={styles.studioStatusPill}>
                <CheckCircle2 size={13} color={THEME.colors.success} />
                <Text style={styles.studioStatusText}>VISION PARSED</Text>
              </View>
              <View style={styles.studioAccuracyPill}>
                <ShieldCheck size={13} color={currentAccent.primary} />
                <Text style={[styles.studioAccuracyText, { color: currentAccent.primary }]}>
                  Verified Ledger
                </Text>
              </View>
            </View>

            {/* Thumbnail + Editable Merchant Row */}
            <View style={styles.studioDetailsRow}>
              <View style={styles.thumbnailContainer}>
                {capturedImageUri ? (
                  <Image source={{ uri: capturedImageUri }} style={styles.receiptThumbnail} />
                ) : (
                  <View style={[styles.receiptThumbnailPlaceholder, { backgroundColor: `${currentAccent.primary}18` }]}>
                    <Receipt size={24} color={currentAccent.primary} />
                  </View>
                )}
              </View>

              <View style={styles.studioInfoColumn}>
                <Text style={styles.fieldLabel}>MERCHANT / TITLE</Text>
                <View style={styles.merchantInputRow}>
                  <TextInput
                    style={styles.merchantTextInput}
                    value={merchantInput}
                    onChangeText={setMerchantInput}
                    placeholder="Receipt Merchant"
                    placeholderTextColor={THEME.colors.textMuted}
                    maxLength={40}
                  />
                  <Pencil size={13} color={THEME.colors.textMuted} style={styles.pencilIcon} />
                </View>

                <View style={styles.dateRow}>
                  <Calendar size={12} color={THEME.colors.textSecondary} />
                  <Text style={styles.dateText}>{scanResult.date || 'Today'}</Text>
                </View>
              </View>
            </View>

            {/* Financial Amount & Category Box */}
            <View style={styles.financialCard}>
              <View style={styles.amountColumn}>
                <Text style={styles.fieldLabel}>TOTAL AMOUNT</Text>
                <View style={styles.amountInputRow}>
                  <Text style={[styles.currencyPrefix, { color: currentAccent.primary }]}>
                    {currencySymbol}
                  </Text>
                  <TextInput
                    style={[styles.amountTextInput, { color: currentAccent.primary }]}
                    value={amountInput}
                    onChangeText={setAmountInput}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={THEME.colors.textMuted}
                  />
                  <Pencil size={12} color={THEME.colors.textMuted} style={styles.pencilIcon} />
                </View>
                {parseFloat(amountInput) <= 0 || !amountInput ? (
                  <Text style={styles.amountWarningText}>Amount not found — tap to set</Text>
                ) : (
                  <Text style={styles.amountSubtext}>Includes taxes & line items</Text>
                )}
              </View>

              <View style={styles.categoryColumn}>
                <Text style={styles.fieldLabel}>CATEGORY</Text>
                <View style={styles.categoryPill}>
                  <Sparkles size={11} color={THEME.colors.aiLight} />
                  <Text style={styles.categoryPillText} numberOfLines={1}>
                    {scanResult.category.sub}
                  </Text>
                </View>
                <Text style={styles.masterCategoryText} numberOfLines={1}>
                  {scanResult.category.master}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.studioActionRow}>
              <TouchableOpacity
                style={styles.retakeButton}
                onPress={handleRetake}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Retake Receipt Photo"
              >
                <RotateCcw size={16} color={THEME.colors.textSecondary} />
                <Text style={styles.retakeButtonText}>Retake</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.applyButton, { backgroundColor: currentAccent.primary }]}
                onPress={handleApplyResult}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Use In Expense"
              >
                <Text style={styles.applyButtonText}>Use in Expense</Text>
                <ArrowRight size={17} color={THEME.colors.primaryForeground} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Live Bottom Controls Deck */
          <View style={styles.bottomControlsDeck}>
            {/* Zoom Selector Ladder */}
            <View style={styles.zoomLadderContainer}>
              <View style={styles.zoomLadderPill}>
                <TouchableOpacity
                  style={[styles.zoomSegment, zoomLevel === 0 && styles.zoomSegmentActive]}
                  onPress={() => handleSetZoom(0)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="1x Standard Zoom"
                >
                  <Text style={[styles.zoomSegmentText, zoomLevel === 0 && styles.zoomSegmentTextActive]}>
                    1x
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.zoomSegment, zoomLevel === 0.08 && styles.zoomSegmentActive]}
                  onPress={() => handleSetZoom(0.08)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="2x Telephoto Zoom"
                >
                  <Text style={[styles.zoomSegmentText, zoomLevel === 0.08 && styles.zoomSegmentTextActive]}>
                    2x
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Main Shutter Deck */}
            <View style={styles.shutterDeckRow}>
              {/* Left Action: Gallery Import */}
              <TouchableOpacity
                style={styles.deckSideButton}
                onPress={handlePickFromGallery}
                disabled={isProcessing}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Import Receipt Photo from Gallery"
              >
                <View style={styles.deckSideIconBadge}>
                  <ImageIcon size={21} color={THEME.colors.text} />
                </View>
                <Text style={styles.deckSideLabel}>Photos</Text>
              </TouchableOpacity>

              {/* Center: Flagship Mechanical Shutter Button */}
              <PressableScale
                style={[styles.shutterOuterRing, isProcessing && styles.shutterDisabled]}
                onPress={handleCapture}
                disabled={isProcessing}
                activeScale={0.88}
                hapticFeedback="none"
                accessibilityRole="button"
                accessibilityLabel="Capture Receipt Photo"
              >
                <View
                  style={[
                    styles.shutterInnerCircle,
                    { backgroundColor: currentAccent.primary },
                  ]}
                />
              </PressableScale>

              {/* Right Action: Camera Facing Toggle */}
              <TouchableOpacity
                style={styles.deckSideButton}
                onPress={handleToggleFacing}
                disabled={isProcessing}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Flip camera facing"
              >
                <View style={styles.deckSideIconBadge}>
                  <RotateCcw size={20} color={THEME.colors.text} />
                </View>
                <Text style={styles.deckSideLabel}>Flip</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Real Error Diagnostic Floating Card */}
        {detailedError && !isProcessing && (
          <View style={styles.errorCardContainer}>
            <View style={styles.errorCard}>
              <View style={styles.errorCardHeader}>
                <View style={styles.errorIconBadge}>
                  <AlertCircle size={18} color={THEME.colors.danger} />
                </View>
                <View style={styles.errorTextColumn}>
                  <Text style={styles.errorCardTitle}>{detailedError.title}</Text>
                  <Text style={styles.errorCardDesc}>{detailedError.message}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setDetailedError(null)}
                  style={styles.errorCloseButton}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss error"
                >
                  <X size={15} color={THEME.colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.errorActionsRow}>
                <TouchableOpacity
                  style={[
                    styles.errorActionPill,
                    { backgroundColor: `${currentAccent.primary}20`, borderColor: `${currentAccent.primary}45` },
                  ]}
                  onPress={() => {
                    setDetailedError(null);
                    if (capturedImageUri) {
                      handleProcessImage(capturedImageUri);
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Retry receipt scan"
                >
                  <RotateCcw size={13} color={currentAccent.primary} />
                  <Text style={[styles.errorActionPillText, { color: currentAccent.primary }]}>Retry</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.errorActionPill}
                  onPress={() => {
                    setDetailedError(null);
                    setIsPhotoPickerSheetVisible(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Choose photo from gallery"
                >
                  <ImageIcon size={13} color={THEME.colors.text} />
                  <Text style={styles.errorActionPillText}>Choose Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.errorActionPill}
                  onPress={() => {
                    setDetailedError(null);
                    router.replace('/expenses/new');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Enter expense manually"
                >
                  <ArrowRight size={13} color={THEME.colors.textMuted} />
                  <Text style={[styles.errorActionPillText, { color: THEME.colors.textMuted }]}>Manual</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>

      {/* AI Vision Processing HUD Overlay */}
      {isProcessing && (
        <View style={styles.processingOverlay} pointerEvents="auto">
          <View style={styles.processingCard}>
            <View style={[styles.processingSpinnerBadge, { borderColor: `${currentAccent.primary}45` }]}>
              <QuantumSpinner size={28} color={currentAccent.primary} />
            </View>
            <Text style={styles.processingTitle}>SplitIt Vision Engine</Text>
            <Text style={styles.processingStageText}>{processingStage}</Text>
            <View style={styles.processingProgressTrack}>
              <View style={[styles.processingProgressFill, { backgroundColor: currentAccent.primary }]} />
            </View>
            <Text style={styles.processingSecurityText}>Encrypted & Processed in Real-Time</Text>
          </View>
        </View>
      )}

      {/* Embedded Photo Picker Bottom Sheet for Viewfinder Screen */}
      <EmbeddedPhotoPickerSheet
        visible={isPhotoPickerSheetVisible}
        onClose={() => setIsPhotoPickerSheetVisible(false)}
        onSelectImage={(uri) => {
          handleProcessImage(uri);
        }}
        onLaunchCamera={() => {
          setIsPhotoPickerSheetVisible(false);
        }}
        maxSelectionLimit={1}
        orderedSelection={false}
      />

      {/* Optical Shutter Flash Overlay */}
      <Animated.View pointerEvents="none" style={[styles.shutterFlashOverlay, animatedFlashStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.palette.black,
  },
  maskContainer: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'column',
  },
  topMask: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.60)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 16,
  },
  centerMaskRow: {
    height: VIEWFINDER_HEIGHT,
    flexDirection: 'row',
  },
  sideMask: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.60)',
  },
  viewfinderAperture: {
    width: VIEWFINDER_WIDTH,
    height: VIEWFINDER_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 20,
  },
  bottomMask: {
    flex: 1.25,
    backgroundColor: 'rgba(0, 0, 0, 0.60)',
  },
  guidancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(19, 20, 23, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.palette.emerald,
  },
  guidanceText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.text,
    letterSpacing: 0.8,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    marginTop: 8,
  },
  errorBannerText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  cornerBracket: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: THEME.colors.primary,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3.5,
    borderLeftWidth: 3.5,
    borderTopLeftRadius: 18,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3.5,
    borderRightWidth: 3.5,
    borderTopRightRadius: 18,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3.5,
    borderLeftWidth: 3.5,
    borderBottomLeftRadius: 18,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3.5,
    borderRightWidth: 3.5,
    borderBottomRightRadius: 18,
  },
  edgeTickTop: {
    position: 'absolute',
    top: 0,
    left: '50%',
    marginLeft: -4,
    width: 8,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  edgeTickBottom: {
    position: 'absolute',
    bottom: 0,
    left: '50%',
    marginLeft: -4,
    width: 8,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  edgeTickLeft: {
    position: 'absolute',
    left: 0,
    top: '50%',
    marginTop: -4,
    width: 2,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  edgeTickRight: {
    position: 'absolute',
    right: 0,
    top: '50%',
    marginTop: -4,
    width: 2,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  centerCrosshair: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -8,
    marginLeft: -8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crosshairDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFill,
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 0.8,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0.8,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  scanLineContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  scanLine: {
    height: 2.5,
    width: '100%',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 4,
  },
  scanBeamGlow: {
    height: 32,
    width: '100%',
  },
  focusRing: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusTick: {
    position: 'absolute',
  },
  focusTickTop: {
    top: -5,
    width: 6,
    height: 1.5,
  },
  focusTickBottom: {
    bottom: -5,
    width: 6,
    height: 1.5,
  },
  focusTickLeft: {
    left: -5,
    width: 1.5,
    height: 6,
  },
  focusTickRight: {
    right: -5,
    width: 1.5,
    height: 6,
  },
  focusDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  foregroundOverlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(24, 24, 27, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  topActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smallCircleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(24, 24, 27, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  buttonActive: {
    borderWidth: 1.5,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(139, 92, 246, 0.22)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.4)',
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.aiLight,
    letterSpacing: 1,
  },
  flexSpacer: {
    flex: 1,
  },
  bottomControlsDeck: {
    paddingBottom: 24,
    gap: 16,
  },
  zoomLadderContainer: {
    alignItems: 'center',
  },
  zoomLadderPill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(19, 20, 23, 0.85)',
    padding: 3,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    gap: 2,
  },
  zoomSegment: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: THEME.radius.full,
  },
  zoomSegmentActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  zoomSegmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textMuted,
  },
  zoomSegmentTextActive: {
    color: THEME.colors.text,
  },
  shutterDeckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 28,
  },
  deckSideButton: {
    alignItems: 'center',
    gap: 6,
    width: 60,
  },
  deckSideIconBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(24, 24, 27, 0.80)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  deckSideLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  shutterOuterRing: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 4.5,
    borderColor: THEME.colors.palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    shadowColor: THEME.colors.palette.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  shutterDisabled: {
    opacity: 0.45,
  },
  shutterInnerCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
  },
  studioSheet: {
    backgroundColor: THEME.colors.surface,
    marginHorizontal: 14,
    marginBottom: 16,
    borderRadius: THEME.radius['2xl'],
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 14,
    shadowColor: THEME.colors.palette.black,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 12,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
  },
  studioHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  studioStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.28)',
  },
  studioStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.success,
    letterSpacing: 0.5,
  },
  studioAccuracyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
  },
  studioAccuracyText: {
    fontSize: 11,
    fontWeight: '700',
  },
  studioDetailsRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  thumbnailContainer: {
    width: 62,
    height: 80,
    borderRadius: THEME.radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: THEME.colors.surfaceSubtle,
  },
  receiptThumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  receiptThumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studioInfoColumn: {
    flex: 1,
    gap: 4,
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
  },
  merchantInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
    paddingBottom: 2,
  },
  merchantTextInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: THEME.colors.text,
    paddingVertical: 0,
  },
  pencilIcon: {
    marginLeft: 6,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  dateText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
  },
  financialCard: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountColumn: {
    gap: 2,
  },
  amountDisplay: {
    fontSize: 26,
    fontWeight: '900',
  },
  amountSubtext: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  categoryColumn: {
    alignItems: 'flex-end',
    gap: 4,
    maxWidth: 130,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(139, 92, 246, 0.16)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.aiLight,
  },
  masterCategoryText: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  studioActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  retakeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.colors.surfaceElevated,
    paddingVertical: 13,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  retakeButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  applyButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: THEME.radius.md,
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.primaryForeground,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(9, 10, 14, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  processingCard: {
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 24,
    paddingVertical: 26,
    borderRadius: THEME.radius.xl,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    width: '100%',
    maxWidth: 320,
    shadowColor: THEME.colors.palette.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 10,
  },
  processingSpinnerBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 4,
  },
  processingTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  processingStageText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  processingProgressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  processingProgressFill: {
    width: '75%',
    height: '100%',
    borderRadius: 2,
  },
  processingSecurityText: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  shutterFlashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: THEME.colors.palette.white,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  permissionContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  permissionIconBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 6,
  },
  permissionIconInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -0.5,
  },
  permissionDesc: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionFeaturesList: {
    width: '100%',
    backgroundColor: THEME.colors.surface,
    padding: 16,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: 12,
    marginVertical: 4,
  },
  permissionFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  permissionFeatureText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  primaryPermButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: THEME.radius.md,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryPermButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.primaryForeground,
  },
  secondaryPermButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.surface,
    width: '100%',
    paddingVertical: 13,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  secondaryPermButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  errorCardContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  errorCard: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: THEME.radius.lg,
    padding: 14,
    gap: 12,
  },
  errorCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  errorIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  errorTextColumn: {
    flex: 1,
  },
  errorCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  errorCardDesc: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
    lineHeight: 17,
    marginTop: 2,
  },
  errorCloseButton: {
    padding: 4,
  },
  errorActionsRow: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    paddingTop: 10,
  },
  errorActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  errorActionPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  currencyPrefix: {
    fontSize: 26,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  amountTextInput: {
    fontSize: 26,
    fontWeight: '900',
    padding: 0,
    margin: 0,
    minWidth: 90,
    fontVariant: ['tabular-nums'],
  },
  amountWarningText: {
    fontSize: 10,
    color: THEME.colors.danger,
    fontWeight: '600',
    marginTop: 2,
  },
});
