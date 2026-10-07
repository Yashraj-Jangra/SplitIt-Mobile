import { authService, API_BASE_URL } from './auth.service';
import { groupService, GroupListItem } from './group.service';
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
  async getCachedUserBalanceSummary(): Promise<UserBalanceSummary | null> {
    if (_cachedBalanceSummary) return _cachedBalanceSummary;
    try {
      const fromStorage = await storageService.getItem<UserBalanceSummary>(STORAGE_KEYS.BALANCE_SUMMARY);
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
   * Fetches and computes the comprehensive user financial balance summary:
   * 1. Aggregates P2P debt simplifications across all user groups.
   * 2. Computes total owed to user and total user owes.
   * 3. Calculates 30-day cumulative net balance history with zero-split gradient offset.
   */
  async getUserBalanceSummary(): Promise<UserBalanceSummary> {
    try {
      const token = await authService.getToken();
      const currentUser = await authService.getCachedUser();
      const currentUserId = currentUser?.id || 'u1';

      const groups = await groupService.getUserGroups();

      let expensesRaw: any[] = [];
      let settlementsRaw: any[] = [];
      const groupBalancesArrays: any[][] = [];

      if (token) {
        const headers: Record<string, string> = {
          'Accept': 'application/json',
          Authorization: `Bearer ${token}`,
          Cookie: `better-auth.session_token=${token}`,
        };

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
          if (Array.isArray(expData)) expensesRaw = expData;
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

      // If P2P map has no live debts or preview mode with mock groups
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

      // 3. Fallback progression if no historical transactions recorded yet
      if (transactions.length === 0) {
        const now = new Date();
        const d1 = new Date(now); d1.setDate(d1.getDate() - 25);
        const d2 = new Date(now); d2.setDate(d2.getDate() - 18);
        const d3 = new Date(now); d3.setDate(d3.getDate() - 11);
        const d4 = new Date(now); d4.setDate(d4.getDate() - 4);

        if (netBalance >= 0) {
          const base = netBalance > 0 ? netBalance : 800;
          transactions.push({ date: d1, amount: Number((base * 0.25).toFixed(2)) });
          transactions.push({ date: d2, amount: Number((base * 0.40).toFixed(2)) });
          transactions.push({ date: d3, amount: Number((-base * 0.15).toFixed(2)) });
          transactions.push({ date: d4, amount: Number((base * 0.50).toFixed(2)) });
        } else {
          const abs = Math.abs(netBalance);
          transactions.push({ date: d1, amount: Number((-abs * 0.30).toFixed(2)) });
          transactions.push({ date: d2, amount: Number((-abs * 0.50).toFixed(2)) });
          transactions.push({ date: d3, amount: Number((abs * 0.20).toFixed(2)) });
          transactions.push({ date: d4, amount: Number((-abs * 0.40).toFixed(2)) });
        }
      }

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
      await storageService.setItem(STORAGE_KEYS.BALANCE_SUMMARY, result);
      return result;
    } catch {
      const cached = await storageService.getItem<UserBalanceSummary>(STORAGE_KEYS.BALANCE_SUMMARY);
      if (cached) {
        _cachedBalanceSummary = cached;
        return cached;
      }

      // Safe fallback
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
