import { useState, useEffect, useCallback } from 'react';
import { Keyboard, KeyboardEvent, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface KeyboardInfo {
  keyboardHeight: number;
  isKeyboardOpen: boolean;
  keyboardDuration: number;
  /**
   * Safe area bottom padding that automatically collapses to 0 (or custom min)
   * when the keyboard is deployed, eliminating the 34px floating gap on iOS.
   */
  bottomInsetCompensation: number;
  dismiss: () => void;
}

export interface UseKeyboardHeightOptions {
  /**
   * Minimum bottom padding to retain even when keyboard is deployed (default: 0).
   */
  minKeyboardPadding?: number;
  /**
   * Custom offset to deduct from reported keyboard height if inside a modal with header.
   */
  heightOffset?: number;
}

/**
 * High-performance hook to track software keyboard appearance, height, and insets.
 * Synchronizes iOS and Android lifecycles and eliminates double-padding issues.
 */
export function useKeyboardHeight(options: UseKeyboardHeightOptions = {}): KeyboardInfo {
  const { minKeyboardPadding = 0, heightOffset = 0 } = options;
  const insets = useSafeAreaInsets();

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [keyboardDuration, setKeyboardDuration] = useState(250);

  const dismiss = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => {
      const rawHeight = e.endCoordinates?.height || 0;
      const effectiveHeight = Math.max(0, rawHeight - heightOffset);
      setKeyboardHeight(effectiveHeight);
      setIsKeyboardOpen(true);
      if (e.duration) {
        setKeyboardDuration(e.duration);
      }
    };

    const onHide = (e: KeyboardEvent) => {
      setKeyboardHeight(0);
      setIsKeyboardOpen(false);
      if (e.duration) {
        setKeyboardDuration(e.duration);
      }
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [heightOffset]);

  const bottomInsetCompensation = isKeyboardOpen
    ? minKeyboardPadding
    : Math.max(insets.bottom, minKeyboardPadding);

  return {
    keyboardHeight,
    isKeyboardOpen,
    keyboardDuration,
    bottomInsetCompensation,
    dismiss,
  };
}
