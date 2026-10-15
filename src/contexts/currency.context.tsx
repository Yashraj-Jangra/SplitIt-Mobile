import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { storageService, STORAGE_KEYS } from '../services/storage.service';

export interface CurrencyItem {
  code: string;
  symbol: string;
  name: string;
  flag: string;
}

export const PRESET_CURRENCIES: CurrencyItem[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳' },
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', flag: '🇦🇪' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', flag: '🇸🇬' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', flag: '🇨🇭' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', flag: '🇧🇷' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira', flag: '🇹🇷' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', flag: '🇹🇭' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', flag: '🇰🇷' },
];

export interface StoredCurrencyPreference {
  code: string;
  symbol: string;
  isCustom?: boolean;
}

let _cachedCurrencySymbol = '₹';
let _cachedCurrencyCode = 'INR';

/**
 * Synchronous accessor for the current currency symbol.
 * Usable outside React components (services, utilities, background formatters).
 */
export function getActiveCurrencySymbol(): string {
  return _cachedCurrencySymbol;
}

export function getActiveCurrencyCode(): string {
  return _cachedCurrencyCode;
}

/**
 * Format any number into formatted currency string with sign handling.
 */
export function formatCurrencyAmount(
  amount: number | string | null | undefined,
  symbolOverride?: string,
  options?: {
    showSign?: boolean;
    decimals?: number;
    useGrouping?: boolean;
  }
): string {
  const sym = symbolOverride ?? _cachedCurrencySymbol;
  const num = typeof amount === 'string' ? parseFloat(amount) || 0 : typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  const isNegative = num < -0.0001;
  const isPositive = num > 0.0001;
  const abs = Math.abs(num);

  const decimals = options?.decimals ?? (Number.isInteger(abs) ? 0 : 2);
  const useGrouping = options?.useGrouping ?? true;

  const formattedNum = useGrouping
    ? abs.toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : abs.toFixed(decimals);

  if (options?.showSign) {
    if (isNegative) return `-${sym}${formattedNum}`;
    if (isPositive) return `+${sym}${formattedNum}`;
    return `${sym}${formattedNum}`;
  }

  return isNegative ? `-${sym}${formattedNum}` : `${sym}${formattedNum}`;
}

export interface CurrencyContextValue {
  currencyCode: string;
  currencySymbol: string;
  isCustom: boolean;
  setCurrency: (code: string, customSymbol?: string) => Promise<void>;
  formatCurrency: (
    amount: number | string | null | undefined,
    options?: {
      showSign?: boolean;
      decimals?: number;
      useGrouping?: boolean;
    }
  ) => string;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currencyCode: 'INR',
  currencySymbol: '₹',
  isCustom: false,
  setCurrency: async () => {},
  formatCurrency: (amt, opts) => formatCurrencyAmount(amt, '₹', opts),
});

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currencyCode, setCurrencyCode] = useState<string>(_cachedCurrencyCode);
  const [currencySymbol, setCurrencySymbol] = useState<string>(_cachedCurrencySymbol);
  const [isCustom, setIsCustom] = useState<boolean>(false);

  useEffect(() => {
    async function loadCurrency() {
      try {
        const stored = await storageService.getItem<StoredCurrencyPreference | string>(
          STORAGE_KEYS.CURRENCY_PREFERENCE
        );
        if (!stored) return;

        if (typeof stored === 'object' && stored.symbol) {
          _cachedCurrencyCode = stored.code || 'CUSTOM';
          _cachedCurrencySymbol = stored.symbol || '₹';
          setCurrencyCode(_cachedCurrencyCode);
          setCurrencySymbol(_cachedCurrencySymbol);
          setIsCustom(Boolean(stored.isCustom));
        } else if (typeof stored === 'string') {
          // Check if stored is a known preset code
          const found = PRESET_CURRENCIES.find((c) => c.code === stored.toUpperCase());
          if (found) {
            _cachedCurrencyCode = found.code;
            _cachedCurrencySymbol = found.symbol;
            setCurrencyCode(found.code);
            setCurrencySymbol(found.symbol);
            setIsCustom(false);
          } else {
            // Treat as raw symbol or custom code
            _cachedCurrencyCode = 'CUSTOM';
            _cachedCurrencySymbol = stored;
            setCurrencyCode('CUSTOM');
            setCurrencySymbol(stored);
            setIsCustom(true);
          }
        }
      } catch {
        // Safe fallback
      }
    }
    loadCurrency();
  }, []);

  const setCurrency = useCallback(async (code: string, customSymbol?: string) => {
    let resolvedCode = code;
    let resolvedSymbol = customSymbol || '₹';
    let custom = false;

    if (code === 'CUSTOM' && customSymbol) {
      resolvedCode = 'CUSTOM';
      resolvedSymbol = customSymbol.trim() || '₹';
      custom = true;
    } else {
      const match = PRESET_CURRENCIES.find((c) => c.code === code.toUpperCase());
      if (match) {
        resolvedCode = match.code;
        resolvedSymbol = match.symbol;
        custom = false;
      } else if (customSymbol) {
        resolvedCode = 'CUSTOM';
        resolvedSymbol = customSymbol.trim();
        custom = true;
      }
    }

    _cachedCurrencyCode = resolvedCode;
    _cachedCurrencySymbol = resolvedSymbol;
    setCurrencyCode(resolvedCode);
    setCurrencySymbol(resolvedSymbol);
    setIsCustom(custom);

    await storageService.setItem(STORAGE_KEYS.CURRENCY_PREFERENCE, {
      code: resolvedCode,
      symbol: resolvedSymbol,
      isCustom: custom,
    });
  }, []);

  const formatCurrency = useCallback(
    (
      amount: number | string | null | undefined,
      options?: {
        showSign?: boolean;
        decimals?: number;
        useGrouping?: boolean;
      }
    ) => {
      return formatCurrencyAmount(amount, currencySymbol, options);
    },
    [currencySymbol]
  );

  const value = useMemo(
    () => ({
      currencyCode,
      currencySymbol,
      isCustom,
      setCurrency,
      formatCurrency,
    }),
    [currencyCode, currencySymbol, isCustom, setCurrency, formatCurrency]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};

export function useCurrency(): CurrencyContextValue {
  return useContext(CurrencyContext);
}
