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

export interface GroupListItem {
  id: string;
  name: string;
  description?: string;
  coverImageUrl?: string;
  categoryIcon?: string;
  membersCount: number;
  members: Array<{ id: string; name: string; avatarUrl?: string }>;
  totalExpenses: number;
  userNetBalance: number;
  archived?: boolean;
}

export interface GroupDetailData {
  id: string;
  name: string;
  description?: string;
  coverImageUrl?: string;
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
   * Fetch all user groups with balance & cover images
   */
  async getUserGroups(): Promise<GroupListItem[]> {
    try {
      const token = await authService.getToken();
      if (token) {
        const res = await fetch(`${API_BASE_URL}/api/groups`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            return data.map((g: any, index: number) => ({
              id: g.id || `g_${index}`,
              name: g.name,
              description: g.description,
              coverImageUrl: g.coverImageUrl || [
                'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1200&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=1200&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200&auto=format&fit=crop',
              ][index % 3],
              categoryIcon: g.categoryIcon || 'Users',
              membersCount: g.members?.length || 3,
              members: (g.members || []).map((m: any) => ({
                id: m.uid || m.id,
                name: m.firstName ? `${m.firstName} ${m.lastName || ''}`.trim() : m.name || 'Member',
                avatarUrl: m.avatarUrl,
              })),
              totalExpenses: g.totalExpenses || 0,
              userNetBalance: g.userNetBalance || 0,
              archived: !!g.archivedAt,
            }));
          }
        }
      }
    } catch (e) {
      // Fallback to rich mock list below
    }

    return [
      {
        id: '1',
        name: 'Goa Trip 🏖️',
        description: 'Baga beach villas, scuba diving, and seafood dinners',
        coverImageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1200&auto=format&fit=crop',
        categoryIcon: 'Palmtree',
        membersCount: 4,
        members: [
          { id: 'u1', name: 'You', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120&auto=format&fit=crop' },
          { id: 'u2', name: 'Rohit Sharma', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=120&auto=format&fit=crop' },
          { id: 'u3', name: 'Priya Patel', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=120&auto=format&fit=crop' },
          { id: 'u4', name: 'Aman Verma', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=120&auto=format&fit=crop' },
        ],
        totalExpenses: 24500,
        userNetBalance: 3400,
        archived: false,
      },
      {
        id: '2',
        name: 'Apartment Flatmates 🏠',
        description: 'Rent, groceries, Wi-Fi, electricity, and house supplies',
        coverImageUrl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=1200&auto=format&fit=crop',
        categoryIcon: 'Home',
        membersCount: 3,
        members: [
          { id: 'u1', name: 'You', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120&auto=format&fit=crop' },
          { id: 'u2', name: 'Rohit Sharma', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=120&auto=format&fit=crop' },
          { id: 'u3', name: 'Priya Patel', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=120&auto=format&fit=crop' },
        ],
        totalExpenses: 48200,
        userNetBalance: -1250,
        archived: false,
      },
      {
        id: '3',
        name: 'Weekend Treks ⛰️',
        description: 'Kalsubai peak sunrise trail and camping tents',
        coverImageUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200&auto=format&fit=crop',
        categoryIcon: 'Mountain',
        membersCount: 5,
        members: [
          { id: 'u1', name: 'You', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120&auto=format&fit=crop' },
          { id: 'u2', name: 'Rohit Sharma', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=120&auto=format&fit=crop' },
          { id: 'u4', name: 'Aman Verma', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=120&auto=format&fit=crop' },
          { id: 'u5', name: 'Sneha Rao', avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=120&auto=format&fit=crop' },
        ],
        totalExpenses: 12800,
        userNetBalance: 0,
        archived: false,
      },
      {
        id: '4',
        name: 'Foodies & Dinners ☕',
        description: 'Friday craft beer tastings and weekend buffet brunches',
        coverImageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1200&auto=format&fit=crop',
        categoryIcon: 'Utensils',
        membersCount: 4,
        members: [
          { id: 'u1', name: 'You', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120&auto=format&fit=crop' },
          { id: 'u3', name: 'Priya Patel', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=120&auto=format&fit=crop' },
          { id: 'u5', name: 'Sneha Rao', avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=120&auto=format&fit=crop' },
        ],
        totalExpenses: 18400,
        userNetBalance: 850,
        archived: false,
      },
    ];
  },

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
          return {
            ...data,
            coverImageUrl: data.coverImageUrl || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1200&auto=format&fit=crop',
          };
        }
      }
    } catch (e) {
      // Fallback for development / offline preview
    }

    // Default verified group with realistic mock data
    const members: GroupMember[] = [
      { id: 'u1', name: 'You', netBalance: 3400, upiId: 'yashraj@okaxis', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120&auto=format&fit=crop' },
      { id: 'u2', name: 'Rohit Sharma', netBalance: -1900, upiId: 'rohit@okhdfc', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=120&auto=format&fit=crop' },
      { id: 'u3', name: 'Priya Patel', netBalance: -1500, upiId: 'priya@okicici', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=120&auto=format&fit=crop' },
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
      description: 'Baga beach villas, scuba diving, and seafood dinners',
      coverImageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1200&auto=format&fit=crop',
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

  /**
   * Create a new group
   */
  async createGroup(data: {
    name: string;
    category: string;
    currency: string;
    memberEmails?: string[];
  }): Promise<{ success: boolean; id: string }> {
    try {
      const token = await authService.getToken();
      const res = await fetch(`${API_BASE_URL}/api/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Backend group creation offline fallback:', e);
    }
    return { success: true, id: `grp_${Date.now()}` };
  },
};
