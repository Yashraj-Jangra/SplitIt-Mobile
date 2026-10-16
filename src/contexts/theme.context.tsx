import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { storageService, STORAGE_KEYS } from '../services/storage.service';
import { THEME, setRuntimeAccent } from '../constants/theme';
import { haptics } from '../services/haptics.service';

export interface AccentPreset {
  id: string;
  name: string;
  primary: string;
  primaryLight: string;
  primaryMuted: string;
  borderFocus: string;
  tag: string;
  description: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  {
    id: 'teal',
    name: 'SplitIt Teal',
    primary: '#00C4CC',
    primaryLight: '#33D6DC',
    primaryMuted: 'rgba(0, 196, 204, 0.14)',
    borderFocus: 'rgba(0, 196, 204, 0.45)',
    tag: 'Canonical Web',
    description: 'Vibrant cyan teal matching the official web platform',
  },
  {
    id: 'emerald',
    name: 'Mint Emerald',
    primary: '#10B981',
    primaryLight: '#34D399',
    primaryMuted: 'rgba(16, 185, 129, 0.14)',
    borderFocus: 'rgba(16, 185, 129, 0.45)',
    tag: 'Splitwise Mint',
    description: 'Classic emerald green finance accent for clean balance contrast',
  },
  {
    id: 'violet',
    name: 'Electric Violet',
    primary: '#8B5CF6',
    primaryLight: '#A78BFA',
    primaryMuted: 'rgba(139, 92, 246, 0.14)',
    borderFocus: 'rgba(139, 92, 246, 0.45)',
    tag: 'Cyber Neon',
    description: 'Deep synthetic ultraviolet glow with rich cyberpunk aura',
  },
  {
    id: 'amber',
    name: 'Solar Amber',
    primary: '#F59E0B',
    primaryLight: '#FCD34D',
    primaryMuted: 'rgba(245, 158, 11, 0.14)',
    borderFocus: 'rgba(245, 158, 11, 0.45)',
    tag: 'Warm Gold',
    description: 'Warm goldenrod amber radiating energy across ledgers',
  },
  {
    id: 'blue',
    name: 'Cobalt Blue',
    primary: '#3B82F6',
    primaryLight: '#60A5FA',
    primaryMuted: 'rgba(59, 130, 246, 0.14)',
    borderFocus: 'rgba(59, 130, 246, 0.45)',
    tag: 'Royal Blue',
    description: 'Crisp corporate royal blue engineered for clarity',
  },
  {
    id: 'rose',
    name: 'Coral Rose',
    primary: '#F43F5E',
    primaryLight: '#FB7185',
    primaryMuted: 'rgba(244, 63, 94, 0.14)',
    borderFocus: 'rgba(244, 63, 94, 0.45)',
    tag: 'High Voltage',
    description: 'Punchy vivid coral rose for bold financial statements',
  },
  {
    id: 'magenta',
    name: 'Neon Magenta',
    primary: '#EC4899',
    primaryLight: '#F472B6',
    primaryMuted: 'rgba(236, 72, 153, 0.14)',
    borderFocus: 'rgba(236, 72, 153, 0.45)',
    tag: 'Electric Pop',
    description: 'High-chroma magenta pink with brilliant night luminance',
  },
  {
    id: 'lime',
    name: 'Acid Lime',
    primary: '#84CC16',
    primaryLight: '#A3E635',
    primaryMuted: 'rgba(132, 204, 22, 0.14)',
    borderFocus: 'rgba(132, 204, 22, 0.45)',
    tag: 'Hyper Green',
    description: 'Sharp high-voltage acid lime for unmistakable visibility',
  },
];

export const DEFAULT_ACCENT_ID = 'teal';

interface ThemeContextValue {
  activePresetId: string;
  currentAccent: AccentPreset;
  presets: AccentPreset[];
  setAccentPreset: (id: string) => Promise<void>;
  setCustomAccentColor: (hex: string) => Promise<void>;
  resetToDefault: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(0, 196, 204, ${alpha})`;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [activePresetId, setActivePresetId] = useState<string>(DEFAULT_ACCENT_ID);
  const [customPreset, setCustomPreset] = useState<AccentPreset | null>(null);

  // Load saved preference on mount
  useEffect(() => {
    async function loadAccent() {
      const saved = await storageService.getItem<{ id: string; hex?: string } | string>(
        STORAGE_KEYS.ACCENT_COLOR_PREFERENCE
      );

      if (typeof saved === 'string') {
        const found = ACCENT_PRESETS.find((p) => p.id === saved);
        if (found) {
          setActivePresetId(saved);
          setRuntimeAccent(found);
        }
      } else if (saved && typeof saved === 'object') {
        if (saved.id === 'custom' && saved.hex) {
          const custom: AccentPreset = {
            id: 'custom',
            name: 'Custom Accent',
            primary: saved.hex,
            primaryLight: saved.hex,
            primaryMuted: hexToRgba(saved.hex, 0.14),
            borderFocus: hexToRgba(saved.hex, 0.45),
            tag: 'User Custom',
            description: `Custom configured palette (${saved.hex})`,
          };
          setCustomPreset(custom);
          setActivePresetId('custom');
          setRuntimeAccent(custom);
        } else if (saved.id) {
          const found = ACCENT_PRESETS.find((p) => p.id === saved.id);
          if (found) {
            setActivePresetId(saved.id);
            setRuntimeAccent(found);
          }
        }
      }
    }
    loadAccent();
  }, []);

  const currentAccent = useMemo<AccentPreset>(() => {
    if (activePresetId === 'custom' && customPreset) {
      return customPreset;
    }
    const found = ACCENT_PRESETS.find((p) => p.id === activePresetId);
    return found || ACCENT_PRESETS[0];
  }, [activePresetId, customPreset]);

  const setAccentPreset = useCallback(async (id: string) => {
    const target = ACCENT_PRESETS.find((p) => p.id === id);
    if (!target) return;

    haptics.tap();
    setActivePresetId(id);
    setRuntimeAccent(target);
    await storageService.setItem(STORAGE_KEYS.ACCENT_COLOR_PREFERENCE, { id });
  }, []);

  const setCustomAccentColor = useCallback(async (rawHex: string) => {
    let clean = rawHex.trim();
    if (!clean.startsWith('#')) clean = `#${clean}`;
    if (!/^#[0-9A-Fa-f]{6}$/.test(clean)) return;

    const custom: AccentPreset = {
      id: 'custom',
      name: 'Custom Accent',
      primary: clean,
      primaryLight: clean,
      primaryMuted: hexToRgba(clean, 0.14),
      borderFocus: hexToRgba(clean, 0.45),
      tag: 'User Custom',
      description: `Custom configured palette (${clean})`,
    };

    haptics.saveSuccess();
    setCustomPreset(custom);
    setActivePresetId('custom');
    setRuntimeAccent(custom);
    await storageService.setItem(STORAGE_KEYS.ACCENT_COLOR_PREFERENCE, { id: 'custom', hex: clean });
  }, []);

  const resetToDefault = useCallback(async () => {
    haptics.tap();
    const defaultPreset = ACCENT_PRESETS[0];
    setActivePresetId(DEFAULT_ACCENT_ID);
    setCustomPreset(null);
    setRuntimeAccent(defaultPreset);
    await storageService.setItem(STORAGE_KEYS.ACCENT_COLOR_PREFERENCE, { id: DEFAULT_ACCENT_ID });
  }, []);

  const contextValue = useMemo<ThemeContextValue>(
    () => ({
      activePresetId,
      currentAccent,
      presets: ACCENT_PRESETS,
      setAccentPreset,
      setCustomAccentColor,
      resetToDefault,
    }),
    [activePresetId, currentAccent, setAccentPreset, setCustomAccentColor, resetToDefault]
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback if rendered outside provider
    return {
      activePresetId: DEFAULT_ACCENT_ID,
      currentAccent: ACCENT_PRESETS[0],
      presets: ACCENT_PRESETS,
      setAccentPreset: async () => {},
      setCustomAccentColor: async () => {},
      resetToDefault: async () => {},
    };
  }
  return ctx;
}
