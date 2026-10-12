import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheEnvelope<T> {
  data: T;
  timestamp: number;
  ttlMs?: number;
}

export const STORAGE_KEYS = {
  GROUPS: 'splitit_cache_groups',
  GROUP_DETAIL: (id: string) => `splitit_cache_group_detail_${id}`,
  USER_TRANSACTIONS: 'splitit_cache_user_transactions',
  EXPENSE_DETAIL: (id: string) => `splitit_cache_expense_detail_${id}`,
  SETTLEMENT_DETAIL: (id: string) => `splitit_cache_settlement_detail_${id}`,
  BALANCE_SUMMARY: 'splitit_cache_balance_summary',
  CATEGORIES: 'splitit_cache_expense_categories',
  DEFAULT_GROUP: 'splitit_default_group_id',
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
};
