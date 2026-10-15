import { authService, API_BASE_URL } from './auth.service';
import { storageService, STORAGE_KEYS } from './storage.service';
import { groupService } from './group.service';
import { expenseService, ExpenseHistoryLog } from './expense.service';
import { balanceService } from './balance.service';
import { getActiveCurrencySymbol } from '../contexts/currency.context';
import { appEventEmitter } from './event-emitter';

export interface RecordSettlementParams {
  groupId: string;
  payerId: string;
  payerName: string;
  payeeId: string;
  payeeName: string;
  amount: number;
  method: 'upi' | 'cash' | 'bank_transfer';
  notes?: string;
}

export interface GroupSettlementItem {
  id: string;
  groupId: string;
  groupName?: string;
  amount: number;
  currency?: string;
  date: string;
  rawDate: string;
  payerId: string;
  payerName: string;
  payerAvatarUrl?: string;
  payeeId: string;
  payeeName: string;
  payeeAvatarUrl?: string;
  notes?: string;
  method?: string;
  createdAt?: string;
}

export interface SettlementDetailModel {
  id: string;
  groupId: string;
  groupName?: string;
  amount: number;
  currency: string;
  date: string;
  rawDate: string;
  createdAt?: string;
  method?: string;
  notes?: string;
  payer: {
    id: string;
    name: string;
    avatarUrl?: string;
    upiId?: string;
  };
  payee: {
    id: string;
    name: string;
    avatarUrl?: string;
    upiId?: string;
  };
  recordedBy?: {
    id: string;
    name: string;
  };
  logs: ExpenseHistoryLog[];
}

const _cachedSettlementDetailsMap = new Map<string, SettlementDetailModel>();
const _settlementCommentsCache = new Map<string, ExpenseHistoryLog[]>();

export const settlementService = {
  getInMemorySettlementDetails(settlementId: string): SettlementDetailModel | null {
    return _cachedSettlementDetailsMap.get(settlementId) || null;
  },

  async getCachedSettlementDetails(settlementId: string, userId?: string): Promise<SettlementDetailModel | null> {
    if (_cachedSettlementDetailsMap.has(settlementId)) {
      return _cachedSettlementDetailsMap.get(settlementId)!;
    }
    const resolvedUserId = userId || (await authService.getCachedUser())?.id || '';
    const fromStorage = await storageService.getItem<SettlementDetailModel>(
      STORAGE_KEYS.SETTLEMENT_DETAIL(settlementId, resolvedUserId)
    );
    if (fromStorage) {
      _cachedSettlementDetailsMap.set(settlementId, fromStorage);
      return fromStorage;
    }
    return null;
  },

  /**
   * Fetch all global settlements involving the current user across groups
   */
  async getUserSettlements(options?: { forceRefresh?: boolean }): Promise<GroupSettlementItem[]> {
    const currentUser = await authService.getCachedUser();
    const currentUserId = currentUser?.id || 'u1';

    if (!options?.forceRefresh) {
      const fromStorage = await storageService.getItem<GroupSettlementItem[]>(
        STORAGE_KEYS.USER_SETTLEMENTS(currentUserId)
      );
      if (fromStorage && Array.isArray(fromStorage) && fromStorage.length > 0) {
        return fromStorage;
      }
    }

    try {
      const token = await authService.getToken();
      if (token) {
        const res = await fetch(`${API_BASE_URL}/api/settlements`, {
          headers: {
            'Accept': 'application/json',
            Authorization: `Bearer ${token}`,
            Cookie: `better-auth.session_token=${token}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const userGroups = await groupService.getUserGroups();
            const groupNameMap = new Map(userGroups.map((g) => [g.id, g.name]));

            const normalized: GroupSettlementItem[] = data.map((s: any) => {
              const payerId = s.paidBy?.uid || s.paidBy?.id || s.paidById || s.payerId || '';
              const payeeId = s.paidTo?.uid || s.paidTo?.id || s.paidToId || s.payeeId || '';
              const payerName =
                payerId === currentUserId
                  ? 'You'
                  : s.paidBy?.firstName
                  ? `${s.paidBy.firstName} ${s.paidBy.lastName || ''}`.trim()
                  : s.paidBy?.name || s.payerName || 'Member';
              const payeeName =
                payeeId === currentUserId
                  ? 'You'
                  : s.paidTo?.firstName
                  ? `${s.paidTo.firstName} ${s.paidTo.lastName || ''}`.trim()
                  : s.paidTo?.name || s.payeeName || 'Member';

              const rawDate = s.date ? new Date(s.date) : new Date();
              const formattedDate = rawDate.toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
              });

              const resolvedGroupId = s.groupId || '';
              const resolvedGroupName = s.group?.name || groupNameMap.get(resolvedGroupId) || 'Group Settlement';

              return {
                id: s.id,
                groupId: resolvedGroupId,
                groupName: resolvedGroupName,
                amount: Number(s.amount || 0),
                currency: s.currency || 'INR',
                date: formattedDate,
                rawDate: rawDate.toISOString(),
                payerId,
                payerName,
                payerAvatarUrl: s.paidBy?.avatarUrl,
                payeeId,
                payeeName,
                payeeAvatarUrl: s.paidTo?.avatarUrl,
                notes: s.notes,
                method: s.method,
              };
            });

            await storageService.setItem(STORAGE_KEYS.USER_SETTLEMENTS(currentUserId), normalized);
            return normalized;
          }
        }
      }
    } catch {
      // Fallback to storage
      const cached = await storageService.getItem<GroupSettlementItem[]>(
        STORAGE_KEYS.USER_SETTLEMENTS(currentUserId)
      );
      if (cached) return cached;
    }
    return [];
  },

  async getSettlementsByGroupId(groupId: string): Promise<GroupSettlementItem[]> {
    try {
      const token = await authService.getToken();
      const currentUser = await authService.getCachedUser();
      const currentUserId = currentUser?.id || 'u1';

      if (token) {
        const res = await fetch(`${API_BASE_URL}/api/settlements?groupId=${groupId}`, {
          headers: {
            'Accept': 'application/json',
            Authorization: `Bearer ${token}`,
            Cookie: `better-auth.session_token=${token}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            return data.map((s: any) => {
              const payerId = s.paidBy?.uid || s.paidBy?.id || s.paidById || s.payerId || '';
              const payeeId = s.paidTo?.uid || s.paidTo?.id || s.paidToId || s.payeeId || '';
              const payerName =
                payerId === currentUserId
                  ? 'You'
                  : s.paidBy?.firstName
                  ? `${s.paidBy.firstName} ${s.paidBy.lastName || ''}`.trim()
                  : s.paidBy?.name || s.payerName || 'Member';
              const payeeName =
                payeeId === currentUserId
                  ? 'You'
                  : s.paidTo?.firstName
                  ? `${s.paidTo.firstName} ${s.paidTo.lastName || ''}`.trim()
                  : s.paidTo?.name || s.payeeName || 'Member';

              const rawDate = s.date ? new Date(s.date) : new Date();
              const formattedDate = rawDate.toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
              });

              return {
                id: s.id,
                groupId: s.groupId || groupId,
                amount: Number(s.amount || 0),
                currency: s.currency || 'INR',
                date: formattedDate,
                rawDate: rawDate.toISOString(),
                payerId,
                payerName,
                payerAvatarUrl: s.paidBy?.avatarUrl,
                payeeId,
                payeeName,
                payeeAvatarUrl: s.paidTo?.avatarUrl,
                notes: s.notes || undefined,
                method: s.method || 'cash',
                createdAt: s.createdAt,
              };
            });
          }
        }
      }
    } catch {
      // Offline fallback
    }
    return [];
  },

  async getSettlementDetails(settlementId: string, groupId?: string, options?: { forceRefresh?: boolean }): Promise<SettlementDetailModel | null> {
    if (!options?.forceRefresh && _cachedSettlementDetailsMap.has(settlementId)) {
      return _cachedSettlementDetailsMap.get(settlementId)!;
    }

    const currentUser = await authService.getCachedUser();
    const currentUserId = currentUser?.id || 'u1';
    const fromStorage = !options?.forceRefresh
      ? await storageService.getItem<SettlementDetailModel>(
          STORAGE_KEYS.SETTLEMENT_DETAIL(settlementId, currentUserId)
        )
      : null;
    if (fromStorage) {
      _cachedSettlementDetailsMap.set(settlementId, fromStorage);
    }

    const token = await authService.getToken();

    try {
      if (token) {
        const headers = {
          'Accept': 'application/json',
          Authorization: `Bearer ${token}`,
          Cookie: `better-auth.session_token=${token}`,
        };

        const settlementsUrl = groupId
          ? `${API_BASE_URL}/api/settlements?groupId=${groupId}`
          : `${API_BASE_URL}/api/settlements?all=true`;

        const res = await fetch(settlementsUrl, { headers });
        if (res.ok) {
          const list = await res.json();
          const found = Array.isArray(list) ? list.find((s: any) => s.id === settlementId) : null;
          if (found) {
            const targetGId = found.groupId || groupId;
            let groupName = 'Group Settlement';
            if (targetGId) {
              const groupData = await groupService.getCachedGroupDetails(targetGId);
              if (groupData?.name) groupName = groupData.name;
            }

            let historyList: any[] = [];
            if (targetGId) {
              try {
                const hRes = await fetch(`${API_BASE_URL}/api/history?groupId=${targetGId}`, { headers });
                if (hRes.ok) {
                  historyList = await hRes.json();
                }
              } catch {
                // Ignore history error
              }
            }

            const rawDate = found.date ? new Date(found.date) : new Date();
            const payerId = found.paidBy?.uid || found.paidBy?.id || found.paidById || '';
            const payeeId = found.paidTo?.uid || found.paidTo?.id || found.paidToId || '';

            const payerName =
              payerId === currentUserId
                ? 'You'
                : found.paidBy?.firstName
                ? `${found.paidBy.firstName} ${found.paidBy.lastName || ''}`.trim()
                : found.paidBy?.name || 'Member';

            const payeeName =
              payeeId === currentUserId
                ? 'You'
                : found.paidTo?.firstName
                ? `${found.paidTo.firstName} ${found.paidTo.lastName || ''}`.trim()
                : found.paidTo?.name || 'Member';

            const relevantHistory = historyList.filter((h: any) => {
              return (
                h.data?.settlementId === settlementId ||
                h.data?.newSettlementId === settlementId ||
                (h.eventType && h.eventType.startsWith('settlement_') && h.description?.includes(settlementId))
              );
            });

            const logs: ExpenseHistoryLog[] = relevantHistory.map((h: any) => ({
              id: h.id,
              type: h.eventType,
              actorName: h.actor?.firstName
                ? `${h.actor.firstName} ${h.actor.lastName || ''}`.trim()
                : h.actor?.name || 'Member',
              actorAvatar: h.actor?.avatarUrl,
              timestamp: new Date(h.timestamp).toLocaleString('en-IN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }),
              timeAgo: 'Just now',
              description: h.description,
            }));

            if (logs.length === 0) {
              logs.push({
                id: `log_init_${settlementId}`,
                type: 'expense_created',
                actorName: payerName,
                timestamp: rawDate.toLocaleDateString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                }),
                timeAgo: 'Recorded',
                description: `Settlement recorded: ${payerName} paid ${payeeName} ${getActiveCurrencySymbol()}${Number(found.amount || 0).toFixed(2)}.`,
              });
            }

            const comments = _settlementCommentsCache.get(settlementId) || [];
            const combinedLogs = [...logs, ...comments];

            const detail: SettlementDetailModel = {
              id: found.id,
              groupId: targetGId,
              groupName,
              amount: Number(found.amount || 0),
              currency: 'INR',
              date: rawDate.toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }),
              rawDate: rawDate.toISOString(),
              createdAt: found.createdAt,
              method: found.method || 'cash',
              notes: found.notes || undefined,
              payer: {
                id: payerId,
                name: payerName,
                avatarUrl: found.paidBy?.avatarUrl,
                upiId: found.paidBy?.upiId,
              },
              payee: {
                id: payeeId,
                name: payeeName,
                avatarUrl: found.paidTo?.avatarUrl,
                upiId: found.paidTo?.upiId,
              },
              recordedBy: {
                id: payerId,
                name: payerName,
              },
              logs: combinedLogs,
            };

            _cachedSettlementDetailsMap.set(settlementId, detail);
            await storageService.setItem(STORAGE_KEYS.SETTLEMENT_DETAIL(settlementId, currentUserId), detail);
            return detail;
          }
        }
      }
    } catch {
      // Network error, fall back to storage
    }

    return fromStorage;
  },

  async deleteSettlement(settlementId: string, groupId: string): Promise<{ success: boolean; error?: string }> {
    const cachedDetail = _cachedSettlementDetailsMap.get(settlementId);
    const currentUser = await authService.getCachedUser();
    const currentUserId = currentUser?.id || '';
    try {
      const token = await authService.getToken();
      if (token) {
        const res = await fetch(`${API_BASE_URL}/api/settlements/${settlementId}?groupId=${groupId}`, {
          method: 'DELETE',
          headers: {
            'Accept': 'application/json',
            Authorization: `Bearer ${token}`,
            Cookie: `better-auth.session_token=${token}`,
          },
        });
        if (res.ok) {
          _cachedSettlementDetailsMap.delete(settlementId);
          await storageService.removeItem(STORAGE_KEYS.SETTLEMENT_DETAIL(settlementId, currentUserId));
          if (cachedDetail) {
            await groupService.removeRecordedSettlement(
              settlementId,
              groupId,
              cachedDetail.amount,
              cachedDetail.payer.id,
              cachedDetail.payee.id
            );
          }
          expenseService.clearCache();
          groupService.invalidateCache(groupId);
          balanceService.clearCache();
          appEventEmitter.emit('data-changed', { groupId, type: 'settlement_deleted' });
          return { success: true };
        }
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.error || 'Failed to delete settlement' };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error' };
    }
    _cachedSettlementDetailsMap.delete(settlementId);
    await storageService.removeItem(STORAGE_KEYS.SETTLEMENT_DETAIL(settlementId, currentUserId));
    if (cachedDetail) {
      await groupService.removeRecordedSettlement(
        settlementId,
        groupId,
        cachedDetail.amount,
        cachedDetail.payer.id,
        cachedDetail.payee.id
      );
    }
    expenseService.clearCache();
    groupService.invalidateCache(groupId);
    balanceService.clearCache();
    appEventEmitter.emit('data-changed', { groupId, type: 'settlement_deleted' });
    return { success: true };
  },

  async addSettlementComment(settlementId: string, commentText: string): Promise<ExpenseHistoryLog> {
    const currentUser = await authService.getCachedUser();
    const userName = currentUser?.name || 'You';
    const newLog: ExpenseHistoryLog = {
      id: `com_${Date.now()}`,
      type: 'comment',
      actorName: userName,
      actorAvatar: currentUser?.avatarUrl,
      timestamp: 'Just now',
      timeAgo: 'Just now',
      commentText,
    };
    const existing = _settlementCommentsCache.get(settlementId) || [];
    _settlementCommentsCache.set(settlementId, [...existing, newLog]);
    return newLog;
  },

  async recordSettlement(params: RecordSettlementParams): Promise<{ success: boolean; error?: string; settlementId?: string }> {
    try {
      const exactAmount = Math.round(Number(params.amount) * 100) / 100;
      const token = await authService.getToken();
      if (token) {
        const payload = {
          groupId: params.groupId,
          paidById: params.payerId,
          paidToId: params.payeeId,
          payerId: params.payerId,
          payerName: params.payerName,
          payeeId: params.payeeId,
          payeeName: params.payeeName,
          amount: exactAmount,
          method: params.method || 'cash',
          notes: params.notes,
        };

        const res = await fetch(`${API_BASE_URL}/api/settlements`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            Cookie: `better-auth.session_token=${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const resData = await res.json().catch(() => ({}));
          const settlementId = resData.id || `stl_${Date.now()}`;
          const rawDate = new Date();

          // 1. Pre-warm local settlement detail cache with exact amount
          const detailModel: SettlementDetailModel = {
            id: settlementId,
            groupId: params.groupId,
            groupName: 'Settlement',
            amount: exactAmount,
            currency: 'INR',
            date: 'Today',
            rawDate: rawDate.toISOString(),
            createdAt: rawDate.toISOString(),
            method: params.method || 'cash',
            notes: params.notes || undefined,
            payer: {
              id: params.payerId,
              name: params.payerName,
            },
            payee: {
              id: params.payeeId,
              name: params.payeeName,
            },
            recordedBy: {
              id: params.payerId,
              name: params.payerName,
            },
            logs: [
              {
                id: `log_init_${settlementId}`,
                type: 'expense_created',
                actorName: params.payerName,
                timestamp: 'Today',
                timeAgo: 'Just now',
                description: `Settlement recorded: ${params.payerName} paid ${params.payeeName} ${getActiveCurrencySymbol()}${exactAmount.toFixed(2)}.`,
              },
            ],
          };
          _cachedSettlementDetailsMap.set(settlementId, detailModel);
          const currentUserId = (await authService.getCachedUser())?.id || '';
          await storageService.setItem(STORAGE_KEYS.SETTLEMENT_DETAIL(settlementId, currentUserId), detailModel);

          // 2. Pre-warm and update local group activity and balances with exact amount
          await groupService.applyRecordedSettlement({
            id: settlementId,
            groupId: params.groupId,
            amount: exactAmount,
            currency: 'INR',
            date: 'Today',
            rawDate: rawDate.toISOString(),
            payerId: params.payerId,
            payerName: params.payerName,
            payeeId: params.payeeId,
            payeeName: params.payeeName,
            method: params.method || 'cash',
            notes: params.notes,
            createdAt: rawDate.toISOString(),
          });

          expenseService.clearCache();
          groupService.invalidateCache(params.groupId);
          balanceService.clearCache();
          appEventEmitter.emit('data-changed', { groupId: params.groupId, type: 'settlement_recorded' });

          return { success: true, settlementId };
        }
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.error || 'Failed to record settlement' };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error while recording settlement' };
    }

    expenseService.clearCache();
    groupService.invalidateCache(params.groupId);
    balanceService.clearCache();
    appEventEmitter.emit('data-changed', { groupId: params.groupId, type: 'settlement_recorded' });
    return { success: true };
  },

  clearCache(): void {
    _cachedSettlementDetailsMap.clear();
    _settlementCommentsCache.clear();
  },
};
