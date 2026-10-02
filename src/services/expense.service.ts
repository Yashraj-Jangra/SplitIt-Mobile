import { authService, API_BASE_URL } from './auth.service';
import { GroupExpense } from './group.service';

export interface CreateExpensePayload {
  groupId: string;
  amount: number;
  description: string;
  category: string;
  masterCategory?: string;
  splitType: 'equally' | 'unequally' | 'shares' | 'percentage';
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
  date: string;
  category: string;
  masterCategory: string;
  paidByName: string;
}

export const expenseService = {
  /**
   * Fetch recent expenses for the authenticated user across all groups.
   */
  async getUserExpenses(limit: number = 20): Promise<UserTransactionItem[]> {
    try {
      const token = await authService.getToken();
      const currentUser = await authService.getCachedUser();
      const currentUserId = currentUser?.id || '';

      if (!token) return [];

      const res = await fetch(`${API_BASE_URL}/api/expenses`, {
        headers: {
          'Accept': 'application/json',
          Authorization: `Bearer ${token}`,
          Cookie: `better-auth.session_token=${token}`,
        },
      });

      if (!res.ok) return [];

      const raw = await res.json();
      if (!Array.isArray(raw)) return [];

      const mapped: UserTransactionItem[] = raw.slice(0, limit).map((e: any) => {
        const firstPayer = e.payers?.[0];
        const payerId = firstPayer?.user?.uid || firstPayer?.userId || e.expenseCreatorId || '';
        const payerName = payerId === currentUserId
          ? 'You'
          : (firstPayer?.user?.firstName
              ? `${firstPayer.user.firstName} ${firstPayer.user.lastName || ''}`.trim()
              : firstPayer?.user?.name || e.expenseCreator?.firstName || 'Member');

        const myParticipant = (e.participants || []).find(
          (p: any) => (p.user?.uid || p.userId) === currentUserId
        );
        const myPayer = (e.payers || []).find(
          (p: any) => (p.user?.uid || p.userId) === currentUserId
        );

        let yourShare = 0;
        let yourImpact: 'get' | 'owe' | 'none' = 'none';

        if (myPayer && !myParticipant) {
          yourShare = Number(myPayer.amount || 0);
          yourImpact = 'get';
        } else if (myParticipant && !myPayer) {
          yourShare = Number(myParticipant.amountOwed || 0);
          yourImpact = 'owe';
        } else if (myPayer && myParticipant) {
          const net = Number(myPayer.amount || 0) - Number(myParticipant.amountOwed || 0);
          yourShare = Math.abs(net);
          yourImpact = net >= 0 ? 'get' : 'owe';
        }

        const rawDate = e.date ? new Date(e.date) : new Date();
        const formattedDate = rawDate.toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric',
        });

        return {
          id: e.id,
          title: e.description || e.title || 'Expense',
          groupName: e.groupName || 'Group',
          groupId: e.groupId || '',
          amount: Number(e.amount || 0),
          yourShare,
          yourImpact,
          date: formattedDate,
          category: typeof e.category === 'string' ? e.category : e.category?.sub || 'General',
          masterCategory: e.masterCategory || (typeof e.category === 'string' ? e.category : 'General'),
          paidByName: payerName,
        };
      });

      return mapped;
    } catch {
      return [];
    }
  },

  /**
   * Create an expense on the backend.
   */
  async createExpense(payload: CreateExpensePayload): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const token = await authService.getToken();
      if (!token) return { success: false, error: 'User is not authenticated' };

      const res = await fetch(`${API_BASE_URL}/api/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          Authorization: `Bearer ${token}`,
          Cookie: `better-auth.session_token=${token}`,
        },
        body: JSON.stringify(payload),
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
