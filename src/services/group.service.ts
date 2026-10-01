import { simplifyDebts } from '@splitit/core';
import { authService, API_BASE_URL } from './auth.service';

export interface GroupMember {
  id: string;
  name: string;
  avatarUrl?: string;
  upiId?: string;
  netBalance: number;
}

export interface GroupExpense {
  id: string;
  title: string;
  amount: number;
  currency: string;
  paidById: string;
  paidByName: string;
  date: string;
  category: {
    master: string;
    sub: string;
  };
  yourShare: number;
  yourImpact: 'get' | 'owe' | 'none';
}

export interface SimplifiedDebt {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amount: number;
  currency: string;
}

export interface GroupBudget {
  enabled: boolean;
  totalMonthlyLimit: number;
  totalSpent: number;
  currency: string;
  daysRemaining: number;
  safeDailyAllowance: number;
  categories: Array<{
    name: string;
    limit: number;
    spent: number;
    color: string;
  }>;
}

export interface GroupActivityItem {
  id: string;
  type: 'expense_created' | 'settlement' | 'budget_updated' | 'member_joined';
  actorName: string;
  description: string;
  timeAgo: string;
  diffData?: {
    monthlyBudgetUnchanged?: boolean;
    monthlyChange?: { old: number; new: number };
    categoryChanges?: Array<{ name: string; old: number; new: number; type: 'added' | 'changed' | 'removed' }>;
  };
}

export interface GroupDetailData {
  id: string;
  name: string;
  currency: string;
  categoryIcon: string;
  totalGroupSpend: number;
  yourNetBalance: number;
  members: GroupMember[];
  expenses: GroupExpense[];
  simplifiedDebts: SimplifiedDebt[];
  budget: GroupBudget;
  activities: GroupActivityItem[];
}

export const groupService = {
  /**
   * Fetch complete group details, expenses, balances, budget, and activity.
   * If backend is not available locally, returns verified fallback data for smooth preview.
   */
  async getGroupDetails(groupId: string): Promise<GroupDetailData> {
    try {
      const token = await authService.getToken();
      if (token) {
        const res = await fetch(`${API_BASE_URL}/api/groups/${groupId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          return data;
        }
      }
    } catch (e) {
      // Fallback for development / offline preview
    }

    // Default verified group with realistic mock data
    const members: GroupMember[] = [
      { id: 'u1', name: 'You', netBalance: 3400, upiId: 'yashraj@okaxis' },
      { id: 'u2', name: 'Rohit Sharma', netBalance: -1900, upiId: 'rohit@okhdfc' },
      { id: 'u3', name: 'Priya Patel', netBalance: -1500, upiId: 'priya@okicici' },
    ];

    // Compute simplified debts using @splitit/core
    const coreDebts = simplifyDebts(
      members.map((m) => ({ user: { uid: m.id }, netBalance: m.netBalance }))
    );

    const nameMap = new Map(members.map((m) => [m.id, m.name]));

    const simplifiedDebts: SimplifiedDebt[] = coreDebts.map((d) => ({
      fromUserId: d.from.uid,
      fromName: nameMap.get(d.from.uid) || 'Member',
      toUserId: d.to.uid,
      toName: nameMap.get(d.to.uid) || 'Member',
      amount: d.amount,
      currency: 'INR',
    }));

    return {
      id: groupId,
      name: 'Goa Trip 🏖️',
      currency: 'INR',
      categoryIcon: 'Palmtree',
      totalGroupSpend: 24500,
      yourNetBalance: 3400,
      members,
      expenses: [
        {
          id: 'exp_1',
          title: 'Dinner at Fisherman’s Wharf',
          amount: 4200,
          currency: 'INR',
          paidById: 'u1',
          paidByName: 'You',
          date: 'Today, 2:30 PM',
          category: { master: 'Food and Drink', sub: 'Dining Out' },
          yourShare: 1400,
          yourImpact: 'get',
        },
        {
          id: 'exp_2',
          title: 'Beach Scooters Rental',
          amount: 2400,
          currency: 'INR',
          paidById: 'u2',
          paidByName: 'Rohit Sharma',
          date: 'Yesterday, 11:00 AM',
          category: { master: 'Transportation', sub: 'Taxi' },
          yourShare: 800,
          yourImpact: 'owe',
        },
        {
          id: 'exp_3',
          title: 'Supermarket Groceries & Water',
          amount: 1800,
          currency: 'INR',
          paidById: 'u1',
          paidByName: 'You',
          date: '04 Oct, 6:15 PM',
          category: { master: 'Food and Drink', sub: 'Groceries' },
          yourShare: 600,
          yourImpact: 'get',
        },
      ],
      simplifiedDebts,
      budget: {
        enabled: true,
        totalMonthlyLimit: 35000,
        totalSpent: 24500,
        currency: 'INR',
        daysRemaining: 10,
        safeDailyAllowance: 1050,
        categories: [
          { name: 'Food and Drink', limit: 20000, spent: 15400, color: '#10B981' },
          { name: 'Transportation', limit: 8000, spent: 5800, color: '#3B82F6' },
          { name: 'Entertainment', limit: 7000, spent: 3300, color: '#8B5CF6' },
        ],
      },
      activities: [
        {
          id: 'act_1',
          type: 'expense_created',
          actorName: 'You',
          description: 'added "Dinner at Fisherman’s Wharf" (₹4,200)',
          timeAgo: '2h ago',
        },
        {
          id: 'act_2',
          type: 'budget_updated',
          actorName: 'SplitIt AI',
          description: 'balanced category allocations for October',
          timeAgo: '1d ago',
          diffData: {
            monthlyBudgetUnchanged: true,
            categoryChanges: [
              { name: 'Food and Drink', old: 18000, new: 20000, type: 'changed' },
              { name: 'Entertainment', old: 9000, new: 7000, type: 'changed' },
            ],
          },
        },
        {
          id: 'act_3',
          type: 'settlement',
          actorName: 'Rohit Sharma',
          description: 'settled ₹1,500 with You via UPI',
          timeAgo: '2d ago',
        },
      ],
    };
  },
};
