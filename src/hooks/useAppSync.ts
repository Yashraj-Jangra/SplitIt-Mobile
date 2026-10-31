import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { appEventEmitter } from '../services/event-emitter';
import { updateService } from '../services/update.service';

const RESUME_COOLDOWN_MS = 3000;

/**
 * Global lifecycle hook that coordinates real-time data sync across the app:
 * 1. AppState transitions: Triggers background revalidation when user opens or resumes app.
 * 2. Network transitions: Triggers background revalidation when device recovers from offline mode.
 */
export function useAppSync() {
  const appStateRef = useRef<AppStateStatus>((AppState.currentState as AppStateStatus) || 'active');
  const lastResumeTriggerRef = useRef<number>(Date.now());
  const wasOnlineRef = useRef<boolean>(true);

  // 1. AppState resume & foreground listener
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      // Detect background/inactive -> active transition
      if (
        (prevState === 'background' || prevState === 'inactive') &&
        nextState === 'active'
      ) {
        const now = Date.now();
        if (now - lastResumeTriggerRef.current >= RESUME_COOLDOWN_MS) {
          lastResumeTriggerRef.current = now;
          appEventEmitter.emit('data-changed', { type: 'app_resumed' });
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  // 2. Network connectivity recovery listener (offline -> online)
  useEffect(() => {
    const handleNetworkChange = (state: NetInfoState) => {
      const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      const wasOnline = wasOnlineRef.current;
      wasOnlineRef.current = isOnline;

      if (!wasOnline && isOnline) {
        // Just reconnected to network: trigger auto-sync
        appEventEmitter.emit('data-changed', { type: 'network_reconnected' });
      }
    };

    const unsubscribe = NetInfo.addEventListener(handleNetworkChange);
    return () => {
      unsubscribe();
    };
  }, []);

  // 3. Cold-start sweep: Zero-residue update cache purge
  useEffect(() => {
    updateService.purgeUpdateCache().catch(() => {});
  }, []);
}
