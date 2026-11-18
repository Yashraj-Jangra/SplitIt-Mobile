import { useCallback, useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { haptics } from '../services/haptics.service';

export interface UseSafeBackOptions {
  /**
   * The fallback route to replace to if there is no previous screen in the stack
   * (e.g. cold-start notification launch or deep link). Default: '/(tabs)/groups'.
   */
  fallbackRoute?: string;
  /**
   * Optional callback to execute before navigating back.
   * If it returns false, navigation is cancelled.
   */
  onBeforeBack?: () => boolean | void;
  /**
   * Whether to automatically register Android hardware back press listener.
   * Default: true.
   */
  listenHardwareBack?: boolean;
}

/**
 * Production-grade state-aware back navigation hook.
 *
 * Guarantees seamless back behavior in all cases:
 * 1. Checks `router.canGoBack()` — pops stack if history exists.
 * 2. If stack is empty (cold-start / notification deep link), gracefully replaces to `fallbackRoute`.
 * 3. Throttles rapid multi-taps within 500ms to eliminate stack stutter or multi-popping.
 * 4. Synchronizes Android hardware/gesture back press with the identical state-aware logic.
 */
export function useSafeBack(options: UseSafeBackOptions = {}) {
  const {
    fallbackRoute = '/(tabs)/groups',
    onBeforeBack,
    listenHardwareBack = true,
  } = options;

  const router = useRouter();
  const isBackingRef = useRef(false);

  const handleBack = useCallback(() => {
    if (isBackingRef.current) return;
    isBackingRef.current = true;
    setTimeout(() => {
      isBackingRef.current = false;
    }, 500);

    if (onBeforeBack) {
      const shouldProceed = onBeforeBack();
      if (shouldProceed === false) {
        isBackingRef.current = false;
        return;
      }
    }

    try {
      haptics.tap();
    } catch {
      // Ignore haptics error on unmounted context
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallbackRoute as any);
    }
  }, [router, fallbackRoute, onBeforeBack]);

  useEffect(() => {
    if (!listenHardwareBack) return;

    const onBackPress = () => {
      handleBack();
      return true; // Prevent default Android activity exit
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => {
      backSub.remove();
    };
  }, [listenHardwareBack, handleBack]);

  return {
    handleBack,
    canGoBack: router.canGoBack(),
  };
}
