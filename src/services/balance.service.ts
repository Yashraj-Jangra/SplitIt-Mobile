import { authService } from './auth.service';
import { getAuthenticatedHeaders, API_BASE_URL } from './api-headers';
import { demoService } from './demo.service';
import { groupService } from './group.service';
import { storageService, STORAGE_KEYS } from './storage.service';
import {
  simplifyDebts,
  calculateBalanceHistory,
  BalanceTransaction,
  BalanceHistoryCalculation,
} from '@splitit/core';

export interface UserBalanceSummary {
  netBalance: number;
  totalOwed: number; // Owed to you (positive sum of creditor positions)
  totalOwe: number;  // You owe (absolute sum of debtor positions)
  trendPercentage: number;
  chartData: Array<{ date: string; balance: number }>;
  domain: [number, number];
  gradientOffset: number;
  minBalance: number;
  maxBalance: number;
}

let _cachedBalanceSummary: UserBalanceSummary | null = null;

export const balanceService = {
  /**
   * Synchronous accessor for in-memory cached balance summary (prevents back-navigation blanking).
   */
  getInMemoryUserBalanceSummary(): UserBalanceSummary | null {
    return _cachedBalanceSummary;
  },

  /**
   * Fast tick lookup of balance summary from persistent offline storage (0ms cold boot).
   */
  async getCachedUserBalanceSummary(userId?: string): Promise<UserBalanceSummary | null> {
    if (_cachedBalanceSummary) return _cachedBalanceSummary;
    try {
      const resolvedUserId = userId || (await authService.getCachedUser())?.id || '';
      const fromStorage = await storageService.getItem<UserBalanceSummary>(STORAGE_KEYS.BALANCE_SUMMARY(resolvedUserId));
      if (fromStorage) {
        _cachedBalanceSummary = fromStorage;
        return fromStorage;
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Clear in-memory balance summary cache on sign-out or account switch.
   */
  clearCache(): void {
    _cachedBalanceSummary = null;
  },

  /**
   * Fetches and computes the comprehensive user financial balance summary:
   * 1. If in demo mode with sample groups: returns curated demo financial summary.
   * 2. Aggregates P2P debt simplifications across all real user groups.
   * 3. Computes total owed to user and total user owes.
   * 4. Calculates 30-day cumulative net balance history with zero-split gradient offset (flat 0 if empty).
   */
  async getUserBalanceSummary(options?: { forceRefresh?: boolean }): Promise<UserBalanceSummary> {
    if (options?.forceRefresh) {
      _cachedBalanceSummary = null;
    }
    const currentUser = await authService.getCachedUser();
    const currentUserId = currentUser?.id || 'u1';

    try {
      const token = await authService.getToken();

      const groups = await groupService.getUserGroups({ forceRefresh: options?.forceRefresh });

      // Check if user is currently viewing demo mode
      const hasDemoGroups = groups.some((g) => g.id.startsWith('demo_'));
      if (hasDemoGroups) {
        const demoSummary = demoService.getDemoBalanceSummary();
        _cachedBalanceSummary = demoSummary;
        return demoSummary;
      }

      if (groups.length === 0) {
        const isDemoActive = await demoService.isDemoModeActive(currentUserId);
        if (isDemoActive) {
          const demoSummary = demoService.getDemoBalanceSummary();
          _cachedBalanceSummary = demoSummary;
          return demoSummary;
        }
      }

      let expensesRaw: any[] = [];
      let settlementsRaw: any[] = [];
      const groupBalancesArrays: any[][] = [];

      if (token) {
        const headers = getAuthenticatedHeaders(token);

        const [expensesRes, settlementsRes, ...groupBalanceResults] = await Promise.allSettled([
          fetch(`${API_BASE_URL}/api/expenses`, { headers }),
          fetch(`${API_BASE_URL}/api/settlements`, { headers }),
          ...groups.map((g) =>
            fetch(`${API_BASE_URL}/api/groups/${g.id}/balances`, { headers }).then((r) =>
              r.ok ? r.json() : []
            )
          ),
        ]);

        if (expensesRes.status === 'fulfilled' && expensesRes.value.ok) {
          const expData = await expensesRes.value.json().catch(() => []);
          if (Array.isArray(expData)) {
            expensesRaw = expData;
            if (expData.length > 0) {
              await demoService.dismissDemoMode(currentUserId);
            }
          }
        }

        if (settlementsRes.status === 'fulfilled' && settlementsRes.value.ok) {
          const setttData = await settlementsRes.value.json().catch(() => []);
          if (Array.isArray(setttData)) settlementsRaw = setttData;
        }

        groupBalanceResults.forEach((res) => {
          if (res.status === 'fulfilled' && Array.isArray(res.value)) {
            groupBalancesArrays.push(res.value);
          }
        });
      }

      // 1. Calculate P2P balances across all groups via simplifyDebts
      const userP2PBalanceMap = new Map<string, number>();

      groupBalancesArrays.forEach((groupBalances) => {
        const debtInputs = groupBalances.map((b: any) => ({
          user: { uid: b.user?.uid || b.user?.id || 'm' },
          netBalance: Number(b.netBalance) || 0,
        }));
        const simplified = simplifyDebts(debtInputs);

        simplified.forEach((s) => {
          if (s.from.uid === currentUserId) {
            userP2PBalanceMap.set(s.to.uid, (userP2PBalanceMap.get(s.to.uid) || 0) - s.amount);
          } else if (s.to.uid === currentUserId) {
            userP2PBalanceMap.set(s.from.uid, (userP2PBalanceMap.get(s.from.uid) || 0) + s.amount);
          }
        });
      });

      let calculatedTotalOwed = 0;
      let calculatedTotalOwe = 0;

      for (const net of userP2PBalanceMap.values()) {
        if (net > 0.01) calculatedTotalOwed += net;
        else if (net < -0.01) calculatedTotalOwe += Math.abs(net);
      }

      // If P2P map has no live debts, check real group userNetBalance sums
      if (calculatedTotalOwed === 0 && calculatedTotalOwe === 0 && groups.length > 0) {
        calculatedTotalOwed = groups.reduce(
          (acc, g) => acc + (g.userNetBalance > 0 ? g.userNetBalance : 0),
          0
        );
        calculatedTotalOwe = Math.abs(
          groups.reduce((acc, g) => acc + (g.userNetBalance < 0 ? g.userNetBalance : 0), 0)
        );
      }

      const netBalance = parseFloat((calculatedTotalOwed - calculatedTotalOwe).toFixed(2));
      const totalOwed = parseFloat(calculatedTotalOwed.toFixed(2));
      const totalOwe = parseFloat(calculatedTotalOwe.toFixed(2));

      // 2. Consolidate transactions for 30-day cumulative chart
      const transactions: BalanceTransaction[] = [];

      expensesRaw.forEach((e: any) => {
        const myPayers = (e.payers || []).filter(
          (p: any) => (p.user?.uid || p.userId || p.id) === currentUserId
        );
        const myParticipants = (e.participants || []).filter(
          (p: any) => (p.user?.uid || p.userId || p.id) === currentUserId
        );
        const myPaid = myPayers.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
        const myOwed = myParticipants.reduce(
          (s: number, p: any) => s + (Number(p.amountOwed) || 0),
          0
        );
        const net = myPaid - myOwed;
        if (Math.abs(net) > 0.01) {
          transactions.push({ date: e.date || e.createdAt, amount: net });
        }
      });

      settlementsRaw.forEach((s: any) => {
        const paidById = s.paidBy?.uid || s.paidBy?.id || s.payerId;
        const paidToId = s.paidTo?.uid || s.paidTo?.id || s.payeeId;
        const amt = Number(s.amount) || 0;
        if (paidById === currentUserId) {
          transactions.push({ date: s.date || s.createdAt, amount: amt });
        } else if (paidToId === currentUserId) {
          transactions.push({ date: s.date || s.createdAt, amount: -amt });
        }
      });

      // Calculate 30-day balance history strictly from real transactions (no synthetic spikes)
      const history: BalanceHistoryCalculation = calculateBalanceHistory(transactions, 30);

      const result: UserBalanceSummary = {
        netBalance,
        totalOwed,
        totalOwe,
        trendPercentage: history.trendPercentage,
        chartData: history.chartData,
        domain: history.domain,
        gradientOffset: history.gradientOffset,
        minBalance: history.minBalance,
        maxBalance: history.maxBalance,
      };

      _cachedBalanceSummary = result;
      await storageService.setItem(STORAGE_KEYS.BALANCE_SUMMARY(currentUserId), result);
      return result;
    } catch {
      const cached = await storageService.getItem<UserBalanceSummary>(STORAGE_KEYS.BALANCE_SUMMARY(currentUserId));
      if (cached) {
        _cachedBalanceSummary = cached;
        return cached;
      }

      // Safe clean empty fallback
      const defaultHistory = calculateBalanceHistory([], 30);
      return {
        netBalance: 0,
        totalOwed: 0,
        totalOwe: 0,
        trendPercentage: 0,
        chartData: defaultHistory.chartData,
        domain: defaultHistory.domain,
        gradientOffset: defaultHistory.gradientOffset,
        minBalance: defaultHistory.minBalance,
        maxBalance: defaultHistory.maxBalance,
      };
    }
  },
};
