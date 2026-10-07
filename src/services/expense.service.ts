import { authService, API_BASE_URL } from './auth.service';
import { parseComplexChange, ParsedChange } from '@splitit/core';
import { groupService } from './group.service';
import { settingsService } from './settings.service';
import { storageService, STORAGE_KEYS } from './storage.service';

export interface CreateExpensePayload {
  groupId: string;
  amount: number;
  description: string;
  category: string;
  masterCategory?: string;
  splitType: 'equally' | 'unequally' | 'by_shares' | 'by_percentage' | 'shares' | 'percentage';
  date?: string;
  notes?: string;
  payers: Array<{ userId: string; amount: number }>;
  participants: Array<{ userId: string; amountOwed: number; share?: number }>;
}

export interface UserTransactionItem {
  id: string;
  title: string;
  groupName: string;
  groupId: string;
  amount: number;
  yourShare: number;
  yourImpact: 'get' | 'owe' | 'none';
  userShareStatus?: 'lent' | 'owe' | 'no_balance' | 'not_involved';
  netAmount?: number;
  currency?: string;
  payers?: any[];
  participants?: any[];
  date: string;
  category: string;
  masterCategory: string;
  paidByName: string;
}

export interface ExpenseHistoryLog {
  id: string;
  type: 'expense_created' | 'expense_updated' | 'expense_deleted' | 'expense_restored' | 'comment';
  actorName: string;
  actorAvatar?: string;
  timestamp: string;
  timeAgo: string;
  description?: string;
  commentText?: string;
  changes?: Array<{
    field: string;
    from: string;
    to: string;
    type?: 'changed' | 'added' | 'removed' | 'unknown';
    detail?: string;
  }>;
}

export interface ExpenseDetailModel {
  id: string;
  groupId: string;
  groupName?: string;
  title: string;
  amount: number;
  currency: string;
  date: string;
  rawDate: string;
  createdAt?: string;
  category: {
    master: string;
    sub: string;
  };
  splitType: string;
  notes?: string;
  receiptImageUrl?: string;
  paidById: string;
  paidByName: string;
  paidByAvatar?: string;
  payers: Array<{
    userId: string;
    name: string;
    avatarUrl?: string;
    amount: number;
  }>;
  participants: Array<{
    userId: string;
    name: string;
    avatarUrl?: string;
    amountOwed: number;
    isCurrentUser: boolean;
  }>;
  creator: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  logs: ExpenseHistoryLog[];
}

const _commentsCache = new Map<string, ExpenseHistoryLog[]>();
let _cachedUserExpenses: UserTransactionItem[] = [];
const _cachedExpenseDetailsMap = new Map<string, ExpenseDetailModel>();

/**
 * Deduplicate expense history audit logs.
 * Guarantees exactly one 'expense_created' log is retained (preferring the authoritative backend log over synthetic fallbacks)
 * and eliminates duplicate log IDs.
 */
export function deduplicateExpenseLogs(logs: ExpenseHistoryLog[]): ExpenseHistoryLog[] {
  if (!logs || logs.length === 0) return [];

  const hasRealCreatedLog = logs.some(
    (l) => l.type === 'expense_created' && !l.id?.startsWith('created_') && !l.id?.startsWith('log_init_')
  );

  const seenIds = new Set<string>();
  let seenCreated = false;

  return logs.filter((log) => {
    if (log.id) {
      if (seenIds.has(log.id)) return false;
      seenIds.add(log.id);
    }

    if (log.type === 'expense_created') {
      if (hasRealCreatedLog && (log.id?.startsWith('created_') || log.id?.startsWith('log_init_'))) {
        return false;
      }
      if (seenCreated) {
        return false;
      }
      seenCreated = true;
    }

    return true;
  });
}

export const expenseService = {
  /**
   * Synchronous accessor for in-memory cached user transactions (prevents back-navigation blanking).
   */
  getInMemoryUserExpenses(): UserTransactionItem[] {
    return _cachedUserExpenses;
  },

  /**
   * Synchronous accessor for in-memory cached expense details by ID.
   */
  getInMemoryExpenseDetails(expenseId: string): ExpenseDetailModel | null {
    return _cachedExpenseDetailsMap.get(expenseId) || null;
  },

  /**
   * Fast tick lookup of recent transactions from persistent offline storage (0ms cold boot).
   */
  async getCachedUserExpenses(): Promise<UserTransactionItem[]> {
    if (_cachedUserExpenses.length > 0) return _cachedUserExpenses;
    try {
      const cached = await storageService.getItem<UserTransactionItem[]>(STORAGE_KEYS.USER_TRANSACTIONS);
      if (cached && cached.length > 0) {
        _cachedUserExpenses = cached;
        return cached;
      }
      return [];
    } catch {
      return [];
    }
  },

  /**
   * Fast tick lookup of an expense's cached details and split record from persistent offline storage.
   */
  async getCachedExpenseDetails(expenseId: string): Promise<ExpenseDetailModel | null> {
    if (_cachedExpenseDetailsMap.has(expenseId)) {
      const cached = _cachedExpenseDetailsMap.get(expenseId)!;
      if (cached.logs) {
        cached.logs = deduplicateExpenseLogs(cached.logs);
      }
      return cached;
    }
    try {
      const fromStorage = await storageService.getItem<ExpenseDetailModel>(STORAGE_KEYS.EXPENSE_DETAIL(expenseId));
      if (fromStorage) {
        if (fromStorage.logs) {
          fromStorage.logs = deduplicateExpenseLogs(fromStorage.logs);
        }
        _cachedExpenseDetailsMap.set(expenseId, fromStorage);
        return fromStorage;
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Fetch recent expenses for the authenticated user across all groups.
   */
  async getUserExpenses(limit: number = 20): Promise<UserTransactionItem[]> {
    try {
      const token = await authService.getToken();
      const currentUser = await authService.getCachedUser();
      const currentUserId = currentUser?.id || '';

      if (!token) {
        const cached = await storageService.getItem<UserTransactionItem[]>(STORAGE_KEYS.USER_TRANSACTIONS);
        return cached || [];
      }

      const res = await fetch(`${API_BASE_URL}/api/expenses`, {
        headers: {
          'Accept': 'application/json',
          Authorization: `Bearer ${token}`,
          Cookie: `better-auth.session_token=${token}`,
        },
      });

      if (!res.ok) {
        const cached = await storageService.getItem<UserTransactionItem[]>(STORAGE_KEYS.USER_TRANSACTIONS);
        return cached || [];
      }

      const raw = await res.json();
      if (!Array.isArray(raw)) {
        const cached = await storageService.getItem<UserTransactionItem[]>(STORAGE_KEYS.USER_TRANSACTIONS);
        return cached || [];
      }

      let groupNameMap = new Map<string, string>();
      try {
        const userGroups = await groupService.getUserGroups();
        groupNameMap = new Map(userGroups.map((g) => [g.id, g.name]));
      } catch {
        // Safe ignore
      }

      const mapped: UserTransactionItem[] = raw.slice(0, limit).map((e: any) => {
        const firstPayer = e.payers?.[0];
        const payerId = firstPayer?.user?.uid || firstPayer?.userId || e.expenseCreatorId || '';
        const payerName = payerId === currentUserId
          ? 'You'
          : (firstPayer?.user?.firstName
              ? `${firstPayer.user.firstName} ${firstPayer.user.lastName || ''}`.trim()
              : firstPayer?.user?.name || e.expenseCreator?.firstName || 'Member');

        const myParticipants = (e.participants || []).filter(
          (p: any) => (p.user?.uid || p.userId || p.id) === currentUserId
        );
        const myPayers = (e.payers || []).filter(
          (p: any) => (p.user?.uid || p.userId || p.id) === currentUserId
        );

        const myPaid = myPayers.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
        const myOwed = myParticipants.reduce((sum: number, p: any) => sum + (Number(p.amountOwed) || 0), 0);
        const isPayer = myPayers.length > 0 || myPaid > 0;
        const isParticipant = myParticipants.length > 0;

        const net = myPaid - myOwed;
        let yourShare = 0;
        let yourImpact: 'get' | 'owe' | 'none' = 'none';
        let userShareStatus: 'lent' | 'owe' | 'no_balance' | 'not_involved' = 'not_involved';

        if (net > 0.01) {
          yourShare = net;
          yourImpact = 'get';
          userShareStatus = 'lent';
        } else if (net < -0.01) {
          yourShare = Math.abs(net);
          yourImpact = 'owe';
          userShareStatus = 'owe';
        } else if (isPayer || isParticipant) {
          yourShare = 0;
          yourImpact = 'none';
          userShareStatus = 'no_balance';
        } else {
          yourShare = 0;
          yourImpact = 'none';
          userShareStatus = 'not_involved';
        }

        const rawDate = e.date ? new Date(e.date) : new Date();
        const formattedDate = rawDate.toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric',
        });

        const subCategory = typeof e.category === 'string' ? e.category : e.category?.sub || 'Other';
        const masterCategory =
          e.masterCategory ||
          (typeof e.category === 'object' ? e.category?.master : undefined) ||
          settingsService.getMasterCategory(subCategory) ||
          'Uncategorized';

        return {
          id: e.id,
          title: e.description || e.title || 'Expense',
          groupName: e.groupName || groupNameMap.get(e.groupId) || 'Group',
          groupId: e.groupId || '',
          amount: Number(e.amount || 0),
          yourShare,
          yourImpact,
          userShareStatus,
          netAmount: net,
          currency: e.currency || 'INR',
          payers: e.payers,
          participants: e.participants,
          date: formattedDate,
          category: subCategory,
          masterCategory,
          paidByName: payerName,
        };
      });

      // Persist user transactions for instant offline rendering
      _cachedUserExpenses = mapped;
      await storageService.setItem(STORAGE_KEYS.USER_TRANSACTIONS, mapped);

      // Pre-warm individual expense detail caches if payers and participants exist
      for (const item of mapped) {
        if (item.payers && item.participants && item.payers.length > 0) {
          const existing = await storageService.getItem<ExpenseDetailModel>(STORAGE_KEYS.EXPENSE_DETAIL(item.id));
          if (!existing) {
            await storageService.setItem(STORAGE_KEYS.EXPENSE_DETAIL(item.id), {
              id: item.id,
              groupId: item.groupId,
              groupName: item.groupName,
              title: item.title,
              amount: item.amount,
              currency: item.currency || 'INR',
              date: item.date,
              rawDate: new Date().toISOString(),
              category: {
                master: item.masterCategory,
                sub: item.category,
              },
              splitType: 'equally',
              paidById: item.payers[0]?.user?.uid || item.payers[0]?.userId || '',
              paidByName: item.paidByName,
              payers: item.payers.map((p: any) => ({
                userId: p.user?.uid || p.userId || '',
                name: (p.user?.uid || p.userId) === currentUserId ? 'You' : (p.user?.firstName ? `${p.user.firstName} ${p.user.lastName || ''}`.trim() : p.user?.name || 'Member'),
                avatarUrl: p.user?.avatarUrl,
                amount: Number(p.amount || 0),
              })),
              participants: item.participants.map((p: any) => ({
                userId: p.user?.uid || p.userId || '',
                name: (p.user?.uid || p.userId) === currentUserId ? 'You' : (p.user?.firstName ? `${p.user.firstName} ${p.user.lastName || ''}`.trim() : p.user?.name || 'Member'),
                avatarUrl: p.user?.avatarUrl,
                amountOwed: Number(p.amountOwed || 0),
                isCurrentUser: (p.user?.uid || p.userId) === currentUserId,
              })),
              creator: {
                id: item.payers[0]?.user?.uid || item.payers[0]?.userId || '',
                name: item.paidByName,
              },
              logs: [],
            });
          }
        }
      }

      return mapped;
    } catch {
      const cached = await storageService.getItem<UserTransactionItem[]>(STORAGE_KEYS.USER_TRANSACTIONS);
      return cached || [];
    }
  },

  /**
   * Fetch complete expense details including payers, participant breakdown tree, receipt, and audit logs.
   */
  async getExpenseDetails(expenseId: string, groupId?: string): Promise<ExpenseDetailModel> {
    const token = await authService.getToken();
    const currentUser = await authService.getCachedUser();
    const currentUserId = currentUser?.id || 'u1';

    try {
      if (token) {
        const headers: Record<string, string> = {
          'Accept': 'application/json',
          Authorization: `Bearer ${token}`,
          Cookie: `better-auth.session_token=${token}`,
        };

        const expenseUrl = groupId
          ? `${API_BASE_URL}/api/expenses/${expenseId}?groupId=${groupId}`
          : `${API_BASE_URL}/api/expenses/${expenseId}`;

        const expenseRes = await fetch(expenseUrl, { headers });

        if (expenseRes.ok) {
          const e = await expenseRes.json();
          const targetGroupId = e.groupId || groupId;

          let historyList: any[] = [];
          if (targetGroupId) {
            try {
              const historyRes = await fetch(
                `${API_BASE_URL}/api/history?groupId=${targetGroupId}&expenseId=${expenseId}`,
                { headers }
              );
              if (historyRes.ok) {
                historyList = await historyRes.json();
              }
            } catch {
              // History fetch is optional
            }
          }

          const payers = (e.payers || []).map((p: any) => {
            const uid = p.user?.uid || p.user?.id || p.userId || p.id || 'u';
            const rawName = p.name || p.user?.name || (p.user?.firstName ? `${p.user.firstName} ${p.user.lastName || ''}`.trim() : undefined);
            const name = uid === currentUserId
              ? 'You'
              : (rawName && rawName !== 'undefined' ? rawName : 'Member');
            return {
              userId: uid,
              name,
              avatarUrl: p.user?.avatarUrl || p.avatarUrl,
              amount: typeof p.amount === 'number' && !isNaN(p.amount) ? p.amount : Number(p.amount || 0),
            };
          });

          const primaryPayer = payers[0] || {
            userId: e.expenseCreatorId || currentUserId,
            name: e.expenseCreator?.firstName
              ? `${e.expenseCreator.firstName} ${e.expenseCreator.lastName || ''}`.trim()
              : (e.paidByName && e.paidByName !== 'undefined' ? e.paidByName : 'You'),
            avatarUrl: e.expenseCreator?.avatarUrl,
            amount: Number(e.amount || 0),
          };

          const participants = (e.participants || []).map((p: any) => {
            const uid = p.user?.uid || p.user?.id || p.userId || p.id || 'u';
            const rawName = p.name || p.user?.name || (p.user?.firstName ? `${p.user.firstName} ${p.user.lastName || ''}`.trim() : undefined);
            const name = uid === currentUserId
              ? 'You'
              : (rawName && rawName !== 'undefined' ? rawName : 'Member');
            return {
              userId: uid,
              name,
              avatarUrl: p.user?.avatarUrl || p.avatarUrl,
              amountOwed: typeof p.amountOwed === 'number' && !isNaN(p.amountOwed) ? p.amountOwed : Number(p.amountOwed || 0),
              isCurrentUser: uid === currentUserId,
            };
          });

          // Parse history audit logs
          const parsedLogs: ExpenseHistoryLog[] = (Array.isArray(historyList) ? historyList : []).map((h: any) => {
            const rawChanges = h.data?.changes || [];
            const changesList: any[] = [];

            for (const ch of rawChanges) {
              const isComplex = (ch.field === 'Payers' || ch.field === 'Split') && ch.from;
              if (isComplex) {
                const parsed = parseComplexChange(ch.from);
                for (const p of parsed) {
                  changesList.push({
                    field: ch.field,
                    from: (p as any).from || '',
                    to: (p as any).to || '',
                    type: p.type,
                    detail: (p as any).detail || '',
                  });
                }
              } else {
                changesList.push({
                  field: ch.field,
                  from: String(ch.from || ''),
                  to: String(ch.to || ''),
                  type: 'changed',
                });
              }
            }

            const rawTs = h.createdAt || h.timestamp ? new Date(h.createdAt || h.timestamp) : new Date();
            return {
              id: h.id || `log_${Math.random()}`,
              type: h.type || h.eventType || 'expense_updated',
              actorName: h.actor?.firstName
                ? `${h.actor.firstName} ${h.actor.lastName || ''}`.trim()
                : h.actor?.name || 'Member',
              actorAvatar: h.actor?.avatarUrl,
              timestamp: rawTs.toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }),
              timeAgo: rawTs.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
              description: h.description,
              changes: changesList,
            };
          });

          // Add creator log only if not already present in parsed history logs
          const hasCreatedLog = parsedLogs.some((l) => l.type === 'expense_created');
          if (!hasCreatedLog) {
            const createdDate = e.createdAt ? new Date(e.createdAt) : (e.date ? new Date(e.date) : new Date());
            parsedLogs.push({
              id: `created_${e.id}`,
              type: 'expense_created',
              actorName: e.expenseCreator?.firstName
                ? `${e.expenseCreator.firstName} ${e.expenseCreator.lastName || ''}`.trim()
                : 'You',
              actorAvatar: e.expenseCreator?.avatarUrl,
              timestamp: createdDate.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }),
              timeAgo: createdDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
              description: `Created this expense for ₹${Number(e.amount || 0).toFixed(2)}`,
            });
          }

          // Append any in-session comments and deduplicate logs
          const comments = _commentsCache.get(expenseId) || [];
          const allLogs = deduplicateExpenseLogs([...parsedLogs, ...comments]);

          // Resolve group name if not on expense object
          let resolvedGroupName = e.groupName;
          if (!resolvedGroupName && targetGroupId) {
            try {
              const allGroups = await groupService.getUserGroups();
              const matchedGroup = allGroups.find((g) => g.id === targetGroupId);
              if (matchedGroup) {
                resolvedGroupName = matchedGroup.name;
              }
            } catch {
              // Ignore
            }
          }

          const dateObj = e.date ? new Date(e.date) : new Date();
          const subCategory = typeof e.category === 'string' ? e.category : e.category?.sub || 'Other';
          const masterCategory =
            e.masterCategory ||
            (typeof e.category === 'object' ? e.category?.master : undefined) ||
            settingsService.getMasterCategory(subCategory) ||
            'Uncategorized';

          const detailResult: ExpenseDetailModel = {
            id: e.id,
            groupId: targetGroupId || '',
            groupName: resolvedGroupName || 'Group',
            title: e.description || e.title || 'Expense',
            amount: Number(e.amount || 0),
            currency: 'INR',
            date: dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
            rawDate: dateObj.toISOString(),
            createdAt: e.createdAt,
            category: {
              master: masterCategory,
              sub: subCategory,
            },
            splitType: e.splitType || 'equally',
            notes: e.notes || undefined,
            receiptImageUrl: e.receiptImageUrl || undefined,
            paidById: primaryPayer.userId,
            paidByName: primaryPayer.name,
            paidByAvatar: primaryPayer.avatarUrl,
            payers,
            participants,
            creator: {
              id: e.expenseCreatorId || currentUserId,
              name: e.expenseCreator?.firstName
                ? `${e.expenseCreator.firstName} ${e.expenseCreator.lastName || ''}`.trim()
                : 'You',
              avatarUrl: e.expenseCreator?.avatarUrl,
            },
            logs: allLogs,
          };

          // Cache expense detail offline and in-memory
          _cachedExpenseDetailsMap.set(expenseId, detailResult);
          await storageService.setItem(STORAGE_KEYS.EXPENSE_DETAIL(expenseId), detailResult);

          return detailResult;
        }
      }
    } catch {
      // Offline fallback
    }

    // Check offline storage before falling back to defaults
    const cachedExpense = await storageService.getItem<ExpenseDetailModel>(STORAGE_KEYS.EXPENSE_DETAIL(expenseId));
    if (cachedExpense) {
      if (cachedExpense.logs) {
        cachedExpense.logs = deduplicateExpenseLogs(cachedExpense.logs);
      }
      _cachedExpenseDetailsMap.set(expenseId, cachedExpense);
      return cachedExpense;
    }

    // Dynamic Group-Aware Fallback: Look up from cached group details
    if (groupId) {
      try {
        const groupDetails = await groupService.getGroupDetails(groupId);
        const matchedExpense = groupDetails.expenses?.find((x) => x.id === expenseId);
        if (matchedExpense) {
          const defaultAmount = matchedExpense.amount;
          const numMembers = Math.max(1, groupDetails.members.length);
          const share = Math.round(defaultAmount / numMembers);
          const comments = _commentsCache.get(expenseId) || [];

          const matchedResult: ExpenseDetailModel = {
            id: expenseId,
            groupId,
            groupName: groupDetails.name,
            title: matchedExpense.title,
            amount: defaultAmount,
            currency: 'INR',
            date: matchedExpense.date,
            rawDate: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            category: matchedExpense.category,
            splitType: 'equally',
            notes: undefined,
            receiptImageUrl: undefined,
            paidById: matchedExpense.paidById,
            paidByName: matchedExpense.paidByName,
            paidByAvatar: groupDetails.members.find((m) => m.id === matchedExpense.paidById)?.avatarUrl,
            payers: [
              {
                userId: matchedExpense.paidById || 'payer',
                name: matchedExpense.paidByName && matchedExpense.paidByName !== 'undefined' ? matchedExpense.paidByName : 'Member',
                avatarUrl: groupDetails.members?.find((m) => m.id === matchedExpense.paidById)?.avatarUrl,
                amount: typeof defaultAmount === 'number' && !isNaN(defaultAmount) ? defaultAmount : 0,
              },
            ],
            participants: (groupDetails.members || []).map((m) => {
              const mName = m.name && m.name !== 'undefined' ? m.name : (m.id === currentUserId ? 'You' : 'Member');
              return {
                userId: m.id,
                name: mName,
                avatarUrl: m.avatarUrl,
                amountOwed: share,
                isCurrentUser: m.id === currentUserId,
              };
            }),
            creator: {
              id: matchedExpense.paidById,
              name: matchedExpense.paidByName,
              avatarUrl: groupDetails.members.find((m) => m.id === matchedExpense.paidById)?.avatarUrl,
            },
            logs: [
              {
                id: `log_init_${expenseId}`,
                type: 'expense_created',
                actorName: matchedExpense.paidByName,
                timestamp: matchedExpense.date,
                timeAgo: matchedExpense.date,
                description: `Created expense "${matchedExpense.title}" in ${groupDetails.name}`,
              },
              ...comments,
            ],
          };
          _cachedExpenseDetailsMap.set(expenseId, matchedResult);
          return matchedResult;
        }
      } catch {
        // Fall through
      }
    }

    // Dynamic Generic Fallback (never hardcode fake "Dinner 450 MOHIT Y." records)
    const defaultAmount = 0;
    const comments = _commentsCache.get(expenseId) || [];

    const genericFallback: ExpenseDetailModel = {
      id: expenseId,
      groupId: groupId || '',
      groupName: 'Group Expense',
      title: 'Expense Details',
      amount: defaultAmount,
      currency: 'INR',
      date: 'Today',
      rawDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      category: {
        master: 'Uncategorized',
        sub: 'Other',
      },
      splitType: 'equally',
      notes: undefined,
      receiptImageUrl: undefined,
      paidById: currentUserId,
      paidByName: 'You',
      payers: [
        {
          userId: currentUserId,
          name: 'You',
          amount: defaultAmount,
        },
      ],
      participants: [
        {
          userId: currentUserId,
          name: 'You',
          amountOwed: defaultAmount,
          isCurrentUser: true,
        },
      ],
      creator: {
        id: currentUserId,
        name: 'You',
      },
      logs: [
        {
          id: `log_init_${expenseId}`,
          type: 'expense_created',
          actorName: 'You',
          timestamp: 'Today',
          timeAgo: 'Just now',
          description: 'Recorded expense',
        },
        ...comments,
      ],
    };

    _cachedExpenseDetailsMap.set(expenseId, genericFallback);
    return genericFallback;
  },

  /**
   * Update an existing expense.
   */
  async updateExpense(
    expenseId: string,
    payload: {
      groupId: string;
      amount: number;
      oldAmount?: number;
      description: string;
      category?: string;
      masterCategory?: string;
      notes?: string;
      date?: string;
      splitType?: string;
      payers?: Array<{ userId: string; amount: number }>;
      participants?: Array<{ userId: string; amountOwed: number; share?: number }>;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const token = await authService.getToken();
      if (!token) return { success: false, error: 'User is not authenticated' };

      const resolvedMasterCategory =
        payload.masterCategory ||
        (payload.category ? settingsService.getMasterCategory(payload.category) : undefined);

      const normalizedSplitType =
        payload.splitType === 'shares'
          ? 'by_shares'
          : payload.splitType === 'percentage'
          ? 'by_percentage'
          : payload.splitType;

      const bodyPayload = {
        ...payload,
        ...(normalizedSplitType ? { splitType: normalizedSplitType } : {}),
        masterCategory: resolvedMasterCategory,
      };

      const res = await fetch(`${API_BASE_URL}/api/expenses/${expenseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          Authorization: `Bearer ${token}`,
          Cookie: `better-auth.session_token=${token}`,
        },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || `HTTP ${res.status}` };
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to update expense' };
    }
  },

  /**
   * Add a comment to an expense log timeline.
   */
  async addExpenseComment(expenseId: string, commentText: string): Promise<ExpenseHistoryLog> {
    const currentUser = await authService.getCachedUser();
    const now = new Date();

    const newLog: ExpenseHistoryLog = {
      id: `comment_${Date.now()}`,
      type: 'comment',
      actorName: currentUser?.name || 'You',
      actorAvatar: currentUser?.avatarUrl,
      timestamp: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }),
      timeAgo: 'Just now',
      commentText: commentText.trim(),
    };

    const existing = _commentsCache.get(expenseId) || [];
    existing.push(newLog);
    _commentsCache.set(expenseId, existing);

    return newLog;
  },

  /**
   * Create an expense on the backend.
   */
  async createExpense(payload: CreateExpensePayload): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const token = await authService.getToken();
      if (!token) return { success: false, error: 'User is not authenticated' };

      const resolvedMasterCategory =
        payload.masterCategory || settingsService.getMasterCategory(payload.category);

      const normalizedSplitType =
        payload.splitType === 'shares'
          ? 'by_shares'
          : payload.splitType === 'percentage'
          ? 'by_percentage'
          : payload.splitType;

      const bodyPayload = {
        ...payload,
        splitType: normalizedSplitType,
        masterCategory: resolvedMasterCategory,
      };

      const res = await fetch(`${API_BASE_URL}/api/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          Authorization: `Bearer ${token}`,
          Cookie: `better-auth.session_token=${token}`,
        },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || `Error: ${res.status}` };
      }

      return { success: true, id: data.id };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error creating expense' };
    }
  },

  /**
   * Delete an expense from a group.
   */
  async deleteExpense(expenseId: string, groupId: string, amount: number): Promise<boolean> {
    try {
      const token = await authService.getToken();
      if (!token) return false;

      const res = await fetch(`${API_BASE_URL}/api/expenses/${expenseId}?groupId=${groupId}&amount=${amount}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          Authorization: `Bearer ${token}`,
          Cookie: `better-auth.session_token=${token}`,
        },
      });

      return res.ok;
    } catch {
      return false;
    }
  },
};
