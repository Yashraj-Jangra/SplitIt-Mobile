import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheEnvelope<T> {
  data: T;
  timestamp: number;
  ttlMs?: number;
}

export const STORAGE_KEYS = {
  GROUPS: (userId?: string) => (userId ? `splitit_cache_groups_${userId}` : 'splitit_cache_groups'),
  GROUP_DETAIL: (id: string, userId?: string) => (userId ? `splitit_cache_group_detail_${userId}_${id}` : `splitit_cache_group_detail_${id}`),
  USER_TRANSACTIONS: (userId?: string) => (userId ? `splitit_cache_user_transactions_${userId}` : 'splitit_cache_user_transactions'),
  USER_SETTLEMENTS: (userId?: string) => (userId ? `splitit_cache_user_settlements_${userId}` : 'splitit_cache_user_settlements'),
  EXPENSE_DETAIL: (id: string, userId?: string) => (userId ? `splitit_cache_expense_detail_${userId}_${id}` : `splitit_cache_expense_detail_${id}`),
  SETTLEMENT_DETAIL: (id: string, userId?: string) => (userId ? `splitit_cache_settlement_detail_${userId}_${id}` : `splitit_cache_settlement_detail_${id}`),
  BALANCE_SUMMARY: (userId?: string) => (userId ? `splitit_cache_balance_summary_${userId}` : 'splitit_cache_balance_summary'),
  CATEGORIES: 'splitit_cache_expense_categories',
  DEFAULT_GROUP: (userId?: string) => (userId ? `splitit_default_group_id_${userId}` : 'splitit_default_group_id'),
  CURRENCY_PREFERENCE: 'splitit_pref_currency',
  HAPTICS_PREFERENCE: 'splitit_pref_haptics',
  GROUPS_SORT_PREFERENCE: 'splitit_pref_groups_sort',
  ACCENT_COLOR_PREFERENCE: 'splitit_pref_accent_color',
} as const;

export const storageService = {
  /**
   * Retrieve a typed item from persistent offline storage.
   * Handles JSON parsing and optional TTL expiration.
   */
  async getItem<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return null;

      try {
        const envelope: CacheEnvelope<T> = JSON.parse(raw);
        if (!envelope || envelope.data === undefined) {
          // Fallback for non-enveloped raw JSON
          return envelope as unknown as T;
        }

        if (envelope.ttlMs && Date.now() - envelope.timestamp > envelope.ttlMs) {
          // Expired in cache, remove silently
          AsyncStorage.removeItem(key).catch(() => {});
          return null;
        }

        return envelope.data;
      } catch {
        // Fallback for non-JSON unquoted plain strings (e.g. raw ID or legacy string)
        return raw as unknown as T;
      }
    } catch {
      return null;
    }
  },

  /**
   * Persist a typed item to offline storage.
   * Envelopes with write timestamp for SWR freshness checks.
   */
  async setItem<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    try {
      const envelope: CacheEnvelope<T> = {
        data: value,
        timestamp: Date.now(),
        ttlMs,
      };
      await AsyncStorage.setItem(key, JSON.stringify(envelope));
    } catch {
      // Storage write error - safe fallback
    }
  },

  /**
   * Delete an item from storage.
   */
  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Safe ignore
    }
  },

  /**
   * Clear all keys matching a prefix (e.g. for user logout or cache wipe).
   */
  async clearPrefix(prefix: string): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const targetKeys = allKeys.filter((k) => k.startsWith(prefix));
      if (targetKeys.length > 0) {
        await AsyncStorage.multiRemove(targetKeys);
      }
    } catch {
      // Safe ignore
    }
  },

  /**
   * Complete clean sweep of all user-specific data from persistent offline storage.
   * Invoked on logout, account switch, or auth token invalidation.
   * Safely preserves:
   * 1. Global device preferences (currency, haptics, group sort).
   * 2. Per-user demo mode dismissed markers (so returning users don't see mock data again).
   */
  async clearAllUserData(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const keysToRemove = allKeys.filter((k) => {
        // Preserve device preferences
        if (k.startsWith('splitit_pref_')) return false;
        // Preserve demo dismissal flags so returning users never see mock data again
        if (k.startsWith('splitit_demo_mode_dismissed_v1_')) return false;
        // Target all user-specific caches, search histories, default groups, and session artifacts
        return (
          k.startsWith('splitit_cache_') ||
          k.startsWith('splitit_default_group_') ||
          k.startsWith('splitit_ai_') ||
          k.startsWith('splitit_search_') ||
          k.startsWith('splitit_user_')
        );
      });

      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
      }
    } catch {
      // Safe ignore
    }
  },

  async getCurrencyPreference(): Promise<{ code: string; symbol: string; isCustom?: boolean }> {
    const val = await this.getItem<any>(STORAGE_KEYS.CURRENCY_PREFERENCE);
    if (!val) return { code: 'INR', symbol: '₹', isCustom: false };
    if (typeof val === 'string') {
      const symbols: Record<string, string> = {
        INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$', CAD: 'C$', AED: 'AED',
        SGD: 'S$', CHF: 'CHF', BRL: 'R$', TRY: '₺', THB: '฿', KRW: '₩',
      };
      const symbol = symbols[val.toUpperCase()] || val;
      return { code: val, symbol, isCustom: !symbols[val.toUpperCase()] };
    }
    return val;
  },

  async setCurrencyPreference(currency: { code: string; symbol: string; isCustom?: boolean } | string): Promise<void> {
    await this.setItem(STORAGE_KEYS.CURRENCY_PREFERENCE, currency);
  },

  async getHapticsPreference(): Promise<boolean> {
    const val = await this.getItem<boolean>(STORAGE_KEYS.HAPTICS_PREFERENCE);
    return val !== false;
  },

  async setHapticsPreference(enabled: boolean): Promise<void> {
    await this.setItem(STORAGE_KEYS.HAPTICS_PREFERENCE, enabled);
  },
};
