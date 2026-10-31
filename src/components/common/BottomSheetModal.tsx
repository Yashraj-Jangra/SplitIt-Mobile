import React, { useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Keyboard,
  DimensionValue,
  StyleProp,
  ViewStyle,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { haptics } from '../../services/haptics.service';
import { KeyboardAvoidingView, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';

export interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  maxHeight?: DimensionValue;
  containerStyle?: StyleProp<ViewStyle>;
  headerRight?: React.ReactNode;
  showHandle?: boolean;
  showCloseButton?: boolean;
  dismissible?: boolean;
  children: React.ReactNode;
}

export const BottomSheetModal = React.memo(function BottomSheetModal({
  visible,
  onClose,
  title,
  subtitle,
  maxHeight = '82%',
  containerStyle,
  headerRight,
  showHandle = true,
  showCloseButton = true,
  dismissible = true,
  children,
}: BottomSheetModalProps) {
  const insets = useSafeAreaInsets();
  const { progress } = useReanimatedKeyboardAnimation();
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = 0;
    }
  }, [visible, translateY]);

  const handleClose = () => {
    if (!dismissible) return;
    Keyboard.dismiss();
    haptics.tap();
    onClose();
  };

  // Dedicated PanResponder for drag handle (claims immediately on touch start)
  const handlePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => dismissible,
        onMoveShouldSetPanResponder: () => dismissible,
        onPanResponderMove: (_, gestureState) => {
          if (!dismissible) return;
          if (gestureState.dy > 0) {
            translateY.value = gestureState.dy;
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (!dismissible) return;
          if (gestureState.dy > 60 || gestureState.vy > 0.5) {
            Keyboard.dismiss();
            haptics.tap();
            translateY.value = withTiming(600, { duration: 160 }, (finished) => {
              if (finished) {
                runOnJS(onClose)();
              }
            });
          } else {
            translateY.value = withSpring(0, { damping: 24, stiffness: 260 });
          }
        },
        onPanResponderTerminate: () => {
          translateY.value = withSpring(0, { damping: 24, stiffness: 260 });
        },
      }),
    [dismissible, onClose, translateY]
  );

  // PanResponder for header row (only claims on actual downward drag, letting taps reach buttons)
  const headerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (!dismissible) return false;
          return gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2;
        },
        onPanResponderMove: (_, gestureState) => {
          if (!dismissible) return;
          if (gestureState.dy > 0) {
            translateY.value = gestureState.dy;
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (!dismissible) return;
          if (gestureState.dy > 60 || gestureState.vy > 0.5) {
            Keyboard.dismiss();
            haptics.tap();
            translateY.value = withTiming(600, { duration: 160 }, (finished) => {
              if (finished) {
                runOnJS(onClose)();
              }
            });
          } else {
            translateY.value = withSpring(0, { damping: 24, stiffness: 260 });
          }
        },
        onPanResponderTerminate: () => {
          translateY.value = withSpring(0, { damping: 24, stiffness: 260 });
        },
      }),
    [dismissible, onClose, translateY]
  );

  const animatedSheetStyle = useAnimatedStyle(() => {
    const closedPadding = Math.max(insets.bottom, 16) + 12;
    const paddingBottom = interpolate(
      progress.value,
      [0, 1],
      [closedPadding, 12]
    );

    return {
      paddingBottom,
      transform: [{ translateY: Math.max(0, translateY.value) }],
    };
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={dismissible ? handleClose : undefined}
    >
      <View style={styles.modalOverlay}>
        {/* Full-screen backdrop touchable to dismiss */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={dismissible ? handleClose : undefined}
          disabled={!dismissible}
          accessibilityRole={dismissible ? 'button' : 'none'}
          accessibilityLabel={dismissible ? 'Dismiss sheet' : undefined}
        />

        <KeyboardAvoidingView
          behavior="padding"
          keyboardVerticalOffset={0}
          style={styles.keyboardWrap}
        >
          <Animated.View
            style={[
              styles.sheetContainer,
              {
                maxHeight,
              },
              animatedSheetStyle,
              containerStyle,
            ]}
          >
          {/* Top Handle Drag Area */}
          {showHandle && (
            <View {...handlePanResponder.panHandlers} style={styles.handleWrap}>
              <View style={styles.handleBar} />
            </View>
          )}

          {/* Header Row Drag Area */}
          {(title || showCloseButton || headerRight) && (
            <View {...headerPanResponder.panHandlers} style={styles.headerRow}>
              <View style={styles.titleCol}>
                {Boolean(title) && <Text style={styles.sheetTitle}>{title}</Text>}
                {Boolean(subtitle) && <Text style={styles.sheetSubtitle}>{subtitle}</Text>}
              </View>

              <View style={styles.actionsCol}>
                {headerRight}
                {showCloseButton && (
                  <TouchableOpacity
                    onPress={handleClose}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    style={styles.closeBtn}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                  >
                    <X size={18} color={THEME.colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

            {/* Sheet Body Content */}
            <View style={styles.bodyContent}>{children}</View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  keyboardWrap: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.hairline,
    paddingHorizontal: 16,
    paddingTop: 8,
    overflow: 'hidden',
  },
  handleWrap: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: THEME.colors.hairline,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 10,
    gap: 12,
  },
  titleCol: {
    flex: 1,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.text,
    letterSpacing: -0.2,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    marginTop: 2,
    lineHeight: 18,
  },
  actionsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  bodyContent: {
    flexShrink: 1,
  },
});
