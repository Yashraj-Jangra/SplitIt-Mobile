/**
 * haptics.context.tsx
 *
 * Provides the on/off enabled state for the haptics engine.
 * ─────────────────────────────────────────────────────────────────────────────
 * • Loads the persisted preference once on mount.
 * • Injects a mutable ref into haptics.service so call sites read it
 *   synchronously — zero AsyncStorage overhead per haptic call.
 * • setEnabled() updates the ref immediately AND persists to storage,
 *   so the toggle in Settings takes effect on the very next haptic call.
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { storageService } from '../services/storage.service';
import { setHapticsEnabled } from '../services/haptics.service';

interface HapticsContextValue {
  enabled: boolean;
  setEnabled: (val: boolean) => Promise<void>;
}

const HapticsContext = createContext<HapticsContextValue>({
  enabled: true,
  setEnabled: async () => {},
});

export function HapticsProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(true);

  useEffect(() => {
    // Load persisted preference on mount
    storageService.getHapticsPreference().then((val) => {
      setHapticsEnabled(val);
      setEnabledState(val);
    });
  }, []);

  const setEnabled = useCallback(async (val: boolean) => {
    // 1. Update module state instantly — all in-flight haptic calls feel the change immediately
    setHapticsEnabled(val);
    // 2. Update React state so the Settings toggle re-renders
    setEnabledState(val);
    // 3. Persist in background
    await storageService.setHapticsPreference(val);
  }, []);

  const value = useMemo(() => ({ enabled, setEnabled }), [enabled, setEnabled]);

  return (
    <HapticsContext.Provider value={value}>
      {children}
    </HapticsContext.Provider>
  );
}

/** Hook for reading haptics enabled state (e.g. in Settings toggle). */
export function useHaptics(): HapticsContextValue {
  return useContext(HapticsContext);
}
