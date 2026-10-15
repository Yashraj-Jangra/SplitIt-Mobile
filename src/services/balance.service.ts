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

export interface ObligationUser {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  upiId?: string;
  email?: string;
}

export interface SharedGroupBalance {
  groupId: string;
  groupName: string;
  amount: number;
}

export interface ObligationItem {
  user: ObligationUser;
  amount: number; // positive number
  sharedGroups: SharedGroupBalance[];
}

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
  obligations?: {
    owedToYou: ObligationItem[];
    youOwe: ObligationItem[];
  };
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
          } else {
            groupBalancesArrays.push([]);
          }
        });
      }

      // User profile cache across all groups and balances
      const userProfileMap = new Map<string, ObligationUser>();
      // Track shared group obligations: userKey -> map of groupId -> amount
      const userSharedGroupsMap = new Map<string, Map<string, { groupName: string; amount: number }>>();

      // Seed profiles from group member rosters
      groups.forEach((g) => {
        (g.members || []).forEach((m: any) => {
          const mId = m.id || m.uid;
          if (mId && !userProfileMap.has(mId)) {
            userProfileMap.set(mId, {
              id: mId,
              name: m.name || 'Member',
              avatarUrl: m.avatarUrl,
              email: m.email,
              upiId: m.upiId,
            });
          }
        });
      });

      // 1. Calculate P2P balances across all groups via simplifyDebts
      const userP2PBalanceMap = new Map<string, number>();

      groupBalancesArrays.forEach((groupBalances, gIdx) => {
        const currentGroup = groups[gIdx];
        const gId = currentGroup?.id || `g_${gIdx}`;
        const gName = currentGroup?.name || 'Group';

        // Collect profiles from group balances payload
        groupBalances.forEach((b: any) => {
          const bUser = b.user;
          const uId = bUser?.uid || bUser?.id;
          if (uId && !userProfileMap.has(uId)) {
            userProfileMap.set(uId, {
              id: uId,
              name: bUser.name || `${bUser.firstName || ''} ${bUser.lastName || ''}`.trim() || 'Member',
              firstName: bUser.firstName,
              lastName: bUser.lastName,
              avatarUrl: bUser.avatarUrl,
              email: bUser.email,
              upiId: bUser.upiId,
            });
          }
        });

        const debtInputs = groupBalances.map((b: any) => ({
          user: { uid: b.user?.uid || b.user?.id || 'm' },
          netBalance: Number(b.netBalance) || 0,
        }));
        const simplified = simplifyDebts(debtInputs);

        simplified.forEach((s) => {
          const fromId = s.from.uid;
          const toId = s.to.uid;

          if (fromId === currentUserId) {
            // User owes toId
            userP2PBalanceMap.set(toId, (userP2PBalanceMap.get(toId) || 0) - s.amount);
            
            let groupMap = userSharedGroupsMap.get(toId);
            if (!groupMap) {
              groupMap = new Map();
              userSharedGroupsMap.set(toId, groupMap);
            }
            const existingGroupAmt = groupMap.get(gId)?.amount || 0;
            groupMap.set(gId, { groupName: gName, amount: existingGroupAmt - s.amount });
          } else if (toId === currentUserId) {
            // fromId owes user
            userP2PBalanceMap.set(fromId, (userP2PBalanceMap.get(fromId) || 0) + s.amount);

            let groupMap = userSharedGroupsMap.get(fromId);
            if (!groupMap) {
              groupMap = new Map();
              userSharedGroupsMap.set(fromId, groupMap);
            }
            const existingGroupAmt = groupMap.get(gId)?.amount || 0;
            groupMap.set(gId, { groupName: gName, amount: existingGroupAmt + s.amount });
          }
        });
      });

      let calculatedTotalOwed = 0;
      let calculatedTotalOwe = 0;
      const owedToYouList: ObligationItem[] = [];
      const youOweList: ObligationItem[] = [];

      for (const [otherUid, net] of userP2PBalanceMap.entries()) {
        const userProf = userProfileMap.get(otherUid) || {
          id: otherUid,
          name: 'Member',
        };

        const groupMap = userSharedGroupsMap.get(otherUid);
        const sharedGroups: SharedGroupBalance[] = [];
        if (groupMap) {
          groupMap.forEach((val, groupId) => {
            if (Math.abs(val.amount) > 0.01) {
              sharedGroups.push({
                groupId,
                groupName: val.groupName,
                amount: parseFloat(Math.abs(val.amount).toFixed(2)),
              });
            }
          });
          sharedGroups.sort((a, b) => b.amount - a.amount);
        }

        if (net > 0.01) {
          const amt = parseFloat(net.toFixed(2));
          calculatedTotalOwed += amt;
          owedToYouList.push({
            user: userProf,
            amount: amt,
            sharedGroups,
          });
        } else if (net < -0.01) {
          const amt = parseFloat(Math.abs(net).toFixed(2));
          calculatedTotalOwe += amt;
          youOweList.push({
            user: userProf,
            amount: amt,
            sharedGroups,
          });
        }
      }

      owedToYouList.sort((a, b) => b.amount - a.amount);
      youOweList.sort((a, b) => b.amount - a.amount);

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
        obligations: {
          owedToYou: owedToYouList,
          youOwe: youOweList,
        },
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
        obligations: {
          owedToYou: [],
          youOwe: [],
        },
      };
    }
  },
};
