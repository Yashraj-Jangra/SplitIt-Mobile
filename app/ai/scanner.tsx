import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
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
  AlertCircle,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { aiService, ScannedReceiptResult } from '../../src/services/ai.service';
import { useCurrency } from '../../src/contexts/currency.context';

const { width } = Dimensions.get('window');
const VIEWFINDER_WIDTH = width * 0.82;
const VIEWFINDER_HEIGHT = VIEWFINDER_WIDTH * 1.35;

export default function ReceiptScannerScreen() {
  const router = useRouter();
  const { currencySymbol } = useCurrency();
  const [permission, requestPermission] = useCameraPermissions();
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<ScannedReceiptResult | null>(null);

  const cameraRef = useRef<CameraView>(null);

  const handleCapture = async () => {
    if (isProcessing) return;
    haptics.confirm();

    try {
      if (cameraRef.current) {
        setIsProcessing(true);
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.85,
          skipProcessing: true,
        });

        if (photo?.uri) {
          const result = await aiService.scanReceipt(photo.uri);
          haptics.saveSuccess();
          setScanResult(result);
        }
      }
    } catch {
      // Fallback preview
      const fallback = await aiService.scanReceipt('');
      setScanResult(fallback);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePickFromGallery = async () => {
    haptics.tap();
    try {
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
      });

      if (!pickerResult.canceled && pickerResult.assets?.[0]?.uri) {
        setIsProcessing(true);
        const result = await aiService.scanReceipt(pickerResult.assets[0].uri);
        haptics.saveSuccess();
        setScanResult(result);
      }
    } catch {
      // Gallery pick cancelled or unhandled
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUseMockReceipt = async () => {
    haptics.tap();
    setIsProcessing(true);
    // Simulate OCR latency
    await new Promise((r) => setTimeout(r, 1200));
    const result = await aiService.scanReceipt('');
    haptics.saveSuccess();
    setScanResult(result);
    setIsProcessing(false);
  };

  const handleApplyResult = () => {
    if (!scanResult) return;
    haptics.confirm();
    router.replace({
      pathname: '/expenses/new',
      params: {
        amount: String(scanResult.amount),
        description: scanResult.description,
        category: scanResult.category.sub,
        ...(scanResult.imageUrl ? { receiptImageUrl: scanResult.imageUrl } : {}),
      },
    });
  };

  const handleRetake = () => {
    haptics.tap();
    setScanResult(null);
  };

  // If camera permission has not yet been granted
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
          >
            <X size={20} color={THEME.colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.permissionContent}>
          <View style={styles.permissionIconBadge}>
            <Camera size={44} color={THEME.colors.primary} />
          </View>
          <Text style={styles.permissionTitle}>Camera Access</Text>
          <Text style={styles.permissionDesc}>
            SplitIt uses MiniMax Vision OCR to automatically parse totals, merchants, and dates
            from physical receipts in under 2 seconds.
          </Text>

          <TouchableOpacity
            style={styles.primaryPermButton}
            onPress={() => requestPermission()}
          >
            <Text style={styles.primaryPermButtonText}>Enable Camera</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryPermButton}
            onPress={handlePickFromGallery}
          >
            <ImageIcon size={18} color={THEME.colors.textSecondary} />
            <Text style={styles.secondaryPermButtonText}>Choose from Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.demoPermButton}
            onPress={handleUseMockReceipt}
          >
            <Sparkles size={16} color={THEME.colors.aiLight} />
            <Text style={styles.demoPermButtonText}>Try Demo Cafe Bodega Receipt</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Live Camera Viewfinder */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={isTorchOn}
      />

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        {/* Top Floating Header */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.circleButton}
            onPress={() => {
              haptics.tap();
              router.back();
            }}
          >
            <X size={20} color={THEME.colors.text} />
          </TouchableOpacity>

          <View style={styles.pillHeader}>
            <Sparkles size={14} color={THEME.colors.aiLight} />
            <Text style={styles.pillHeaderText}>MiniMax Vision OCR</Text>
          </View>

          <TouchableOpacity
            style={[styles.circleButton, isTorchOn && styles.circleButtonActive]}
            onPress={() => {
              haptics.tick();
              setIsTorchOn((prev) => !prev);
            }}
          >
            {isTorchOn ? <Zap size={18} color={THEME.colors.primaryForeground} /> : <ZapOff size={18} color={THEME.colors.text} />}
          </TouchableOpacity>
        </View>

        {/* Viewfinder Target Framing Guides */}
        <View style={styles.viewfinderContainer}>
          <View style={styles.viewfinder}>
            {/* 4 Framing Corner Brackets */}
            <View style={[styles.cornerBracket, styles.topLeft]} />
            <View style={[styles.cornerBracket, styles.topRight]} />
            <View style={[styles.cornerBracket, styles.bottomLeft]} />
            <View style={[styles.cornerBracket, styles.bottomRight]} />

            {isProcessing && (
              <View style={styles.processingBadge}>
                <ActivityIndicator size="small" color={THEME.colors.primary} />
                <Text style={styles.processingBadgeText}>Analyzing with MiniMax AI...</Text>
              </View>
            )}
          </View>

          <Text style={styles.hintText}>
            Align receipt within the frame for instant parsing
          </Text>
        </View>

        {/* Scanned Result Bottom Sheet Card */}
        {scanResult ? (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <View style={styles.resultHeaderLeft}>
                <View style={styles.resultReceiptIcon}>
                  <Receipt size={20} color={THEME.colors.primary} />
                </View>
                <View>
                  <Text style={styles.resultMerchant} numberOfLines={1}>
                    {scanResult.merchant || scanResult.description}
                  </Text>
                  <Text style={styles.resultDate}>{scanResult.date}</Text>
                </View>
              </View>
              <Text style={styles.resultAmount}>{currencySymbol}{scanResult.amount.toFixed(2)}</Text>
            </View>

            <View style={styles.resultCategoryRow}>
              <Sparkles size={13} color={THEME.colors.aiLight} />
              <Text style={styles.resultCategoryText}>
                Category: <Text style={{ color: THEME.colors.text, fontWeight: '700' }}>{scanResult.category.sub}</Text> ({scanResult.category.master})
              </Text>
            </View>

            <View style={styles.resultActionRow}>
              <TouchableOpacity
                style={styles.retakeButton}
                onPress={handleRetake}
              >
                <RotateCcw size={16} color={THEME.colors.textSecondary} />
                <Text style={styles.retakeButtonText}>Retake</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.applyButton}
                onPress={handleApplyResult}
              >
                <Check size={18} color={THEME.colors.primaryForeground} />
                <Text style={styles.applyButtonText}>Use in Expense</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Bottom Camera Controls Bar */
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={styles.galleryButton}
              onPress={handlePickFromGallery}
              disabled={isProcessing}
            >
              <ImageIcon size={22} color={THEME.colors.text} />
              <Text style={styles.galleryButtonText}>Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shutterButton, isProcessing && styles.shutterButtonDisabled]}
              onPress={handleCapture}
              disabled={isProcessing}
              activeOpacity={0.8}
            >
              <View style={styles.shutterInner} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.mockButton}
              onPress={handleUseMockReceipt}
              disabled={isProcessing}
            >
              <Sparkles size={18} color={THEME.colors.aiLight} />
              <Text style={styles.mockButtonText}>Demo</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.palette.black,
  },
  overlay: {
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
  circleButtonActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  pillHeader: {
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
  pillHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.aiLight,
  },
  viewfinderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinder: {
    width: VIEWFINDER_WIDTH,
    height: VIEWFINDER_HEIGHT,
    borderRadius: 20,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cornerBracket: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderColor: THEME.colors.primary,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3.5,
    borderLeftWidth: 3.5,
    borderTopLeftRadius: 16,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3.5,
    borderRightWidth: 3.5,
    borderTopRightRadius: 16,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3.5,
    borderLeftWidth: 3.5,
    borderBottomLeftRadius: 16,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3.5,
    borderRightWidth: 3.5,
    borderBottomRightRadius: 16,
  },
  processingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(9, 9, 11, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
  },
  processingBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  hintText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 18,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  galleryButton: {
    alignItems: 'center',
    gap: 4,
    width: 64,
  },
  galleryButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  shutterButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: THEME.colors.palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  shutterButtonDisabled: {
    opacity: 0.5,
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: THEME.colors.primary,
  },
  mockButton: {
    alignItems: 'center',
    gap: 4,
    width: 64,
  },
  mockButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.aiLight,
  },
  resultCard: {
    backgroundColor: THEME.colors.surface,
    marginHorizontal: 12,
    marginBottom: 16,
    borderRadius: THEME.radius.xl,
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    gap: 14,
    shadowColor: THEME.colors.palette.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  resultReceiptIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultMerchant: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  resultDate: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '500',
    marginTop: 2,
  },
  resultAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: THEME.colors.primary,
  },
  resultCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  resultCategoryText: {
    fontSize: 12,
    color: THEME.colors.aiLight,
  },
  resultActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  retakeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.colors.surfaceElevated,
    paddingVertical: 12,
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
    backgroundColor: THEME.colors.primary,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.primaryForeground,
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
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    marginBottom: 8,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: THEME.colors.text,
  },
  permissionDesc: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  primaryPermButton: {
    backgroundColor: THEME.colors.primary,
    width: '100%',
    paddingVertical: 14,
    borderRadius: THEME.radius.md,
    alignItems: 'center',
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
  demoPermButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  demoPermButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.aiLight,
  },
});
