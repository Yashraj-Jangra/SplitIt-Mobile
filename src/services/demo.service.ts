import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getDemoGroups,
  getDemoGroupDetails,
  getDemoExpenses,
  getDemoExpenseDetails,
  getDemoBalanceSummary,
} from '../data/demoData';
import { GroupListItem, GroupDetailData } from './group.service';
import { UserTransactionItem, ExpenseDetailModel } from './expense.service';
import { UserBalanceSummary } from './balance.service';

const DEMO_DISMISSED_KEY_PREFIX = 'splitit_demo_mode_dismissed_v1_';

let _inMemoryDismissedUserIds = new Set<string>();

function getStorageKey(userId?: string): string {
  const sanitized = userId && userId.trim() ? userId.trim() : 'guest';
  return `${DEMO_DISMISSED_KEY_PREFIX}${sanitized}`;
}

export const demoService = {
  /**
   * Check if demo mode is active for the current user.
   * Returns true ONLY if the user has never dismissed demo mode.
   * If dismissed or user has real data, this immediately returns false.
   */
  async isDemoModeActive(userId?: string): Promise<boolean> {
    const key = getStorageKey(userId);
    if (_inMemoryDismissedUserIds.has(key)) {
      return false;
    }

    try {
      const val = await AsyncStorage.getItem(key);
      if (val === 'true') {
        _inMemoryDismissedUserIds.add(key);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Synchronous check for in-memory status to prevent UI flickering.
   */
  isDemoDismissedSync(userId?: string): boolean {
    const key = getStorageKey(userId);
    return _inMemoryDismissedUserIds.has(key);
  },

  /**
   * Permanently dismisses demo mode for the given user on this device.
   * Stored strictly client-side in AsyncStorage. Never sent to the server.
   */
  async dismissDemoMode(userId?: string): Promise<void> {
    const key = getStorageKey(userId);
    _inMemoryDismissedUserIds.add(key);
    try {
      await AsyncStorage.setItem(key, 'true');
    } catch {
      // Safe fallback
    }
  },

  /**
   * Re-arms demo mode for testing if explicitly required.
   */
  async resetDemoMode(userId?: string): Promise<void> {
    const key = getStorageKey(userId);
    _inMemoryDismissedUserIds.delete(key);
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Safe fallback
    }
  },

  /**
   * Preload dismissed status into memory for instant synchronous checks.
   */
  async preloadDismissedState(userId?: string): Promise<boolean> {
    const key = getStorageKey(userId);
    try {
      const val = await AsyncStorage.getItem(key);
      if (val === 'true') {
        _inMemoryDismissedUserIds.add(key);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  getDemoGroups(userName?: string): GroupListItem[] {
    return getDemoGroups(userName);
  },

  getDemoGroupDetails(groupId: string, userName?: string): GroupDetailData | null {
    return getDemoGroupDetails(groupId, userName);
  },

  getDemoExpenses(userName?: string): UserTransactionItem[] {
    return getDemoExpenses(userName);
  },

  getDemoExpenseDetails(expenseId: string, userName?: string): ExpenseDetailModel | null {
    return getDemoExpenseDetails(expenseId, userName);
  },

  getDemoBalanceSummary(): UserBalanceSummary {
    return getDemoBalanceSummary();
  },

  clearCache(): void {
    _inMemoryDismissedUserIds.clear();
  },
};
