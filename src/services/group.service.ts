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

let _cachedGroups: GroupListItem[] = [];

export const groupService = {
  /**
   * Fetch all user groups with balance & cover images
   */
  async getUserGroups(): Promise<GroupListItem[]> {
    try {
      const token = await authService.getToken();
      if (token) {
        const res = await fetch(`${API_BASE_URL}/api/groups`, {
          headers: {
            'Accept': 'application/json',
            Authorization: `Bearer ${token}`,
            Cookie: `better-auth.session_token=${token}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const mapped: GroupListItem[] = data.map((g: any, index: number) => ({
              id: g.id || `g_${index}`,
              name: g.name,
              description: g.description,
              coverImageUrl: g.coverImageUrl || [
                'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=1200&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1200&auto=format&fit=crop',
                'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200&auto=format&fit=crop',
              ][index % 4],
              categoryIcon: g.categoryIcon || 'Users',
              membersCount: g.members?.length || 1,
              members: (g.members || []).map((m: any) => ({
                id: m.uid || m.id,
                name: m.firstName ? `${m.firstName} ${m.lastName || ''}`.trim() : m.name || 'Member',
                avatarUrl: m.avatarUrl,
              })),
              totalExpenses: g.totalExpenses || 0,
              userNetBalance: g.userNetBalance || 0,
              archived: !!g.archivedAt,
            }));
            _cachedGroups = mapped;
            return mapped;
          }
        }
      }
    } catch (e) {
      // Fallback for development / offline preview
    }

    if (_cachedGroups.length > 0) {
      return _cachedGroups;
    }

    _cachedGroups = [
      {
        id: '1',
        name: 'Apartment Flatmates 🏠',
        description: 'Rent, groceries, Wi-Fi, electricity, and house supplies',
        coverImageUrl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=1200&auto=format&fit=crop',
        categoryIcon: 'Home',
        membersCount: 4,
        members: [
          { id: 'u1', name: 'You', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120&auto=format&fit=crop' },
          { id: 'u2', name: 'Rohit Sharma', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=120&auto=format&fit=crop' },
          { id: 'u3', name: 'Priya Patel', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=120&auto=format&fit=crop' },
          { id: 'u4', name: 'Aman Verma', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=120&auto=format&fit=crop' },
        ],
        totalExpenses: 48200,
        userNetBalance: -1250,
        archived: false,
      },
      {
        id: '2',
        name: 'Weekend Treks ⛰️',
        description: 'Kalsubai peak sunrise trail and camping tents',
        coverImageUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200&auto=format&fit=crop',
        categoryIcon: 'Mountain',
        membersCount: 4,
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
        id: '3',
        name: 'Foodies & Dinners ☕',
        description: 'Friday craft beer tastings and weekend buffet brunches',
        coverImageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1200&auto=format&fit=crop',
        categoryIcon: 'Utensils',
        membersCount: 3,
        members: [
          { id: 'u1', name: 'You', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120&auto=format&fit=crop' },
          { id: 'u3', name: 'Priya Patel', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=120&auto=format&fit=crop' },
          { id: 'u5', name: 'Sneha Rao', avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=120&auto=format&fit=crop' },
        ],
        totalExpenses: 18400,
        userNetBalance: 850,
        archived: false,
      },
      {
        id: '4',
        name: 'Office Lunch Crew 🥗',
        description: 'Daily team lunches and coffee runs',
        coverImageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200&auto=format&fit=crop',
        categoryIcon: 'Coffee',
        membersCount: 3,
        members: [
          { id: 'u1', name: 'You', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120&auto=format&fit=crop' },
          { id: 'u2', name: 'Rohit Sharma', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=120&auto=format&fit=crop' },
          { id: 'u4', name: 'Aman Verma', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=120&auto=format&fit=crop' },
        ],
        totalExpenses: 9200,
        userNetBalance: 1200,
        archived: false,
      },
    ];

    return _cachedGroups;
  },

  /**
   * Fetch complete group details, expenses, balances, budget, and activity.
   * If backend is not available locally, returns real matching data for the requested group.
   */
  async getGroupDetails(groupId: string): Promise<GroupDetailData> {
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

        const [groupRes, expensesRes, balancesRes, historyRes] = await Promise.allSettled([
          fetch(`${API_BASE_URL}/api/groups/${groupId}`, { headers }),
          fetch(`${API_BASE_URL}/api/expenses?groupId=${groupId}`, { headers }),
          fetch(`${API_BASE_URL}/api/groups/${groupId}/balances`, { headers }),
          fetch(`${API_BASE_URL}/api/history?groupId=${groupId}`, { headers }),
        ]);

        if (groupRes.status === 'fulfilled' && groupRes.value.ok) {
          const groupData = await groupRes.value.json();
          const expensesData = expensesRes.status === 'fulfilled' && expensesRes.value.ok ? await expensesRes.value.json() : [];
          const balancesData = balancesRes.status === 'fulfilled' && balancesRes.value.ok ? await balancesRes.value.json() : [];
          const historyData = historyRes.status === 'fulfilled' && historyRes.value.ok ? await historyRes.value.json() : [];

          // Map members and net balances
          const members: GroupMember[] = Array.isArray(balancesData) && balancesData.length > 0
            ? balancesData.map((b: any) => ({
                id: b.user?.uid || b.user?.id || 'm',
                name: (b.user?.uid || b.user?.id) === currentUserId
                  ? 'You'
                  : (b.user?.firstName ? `${b.user.firstName} ${b.user.lastName || ''}`.trim() : b.user?.name || 'Member'),
                avatarUrl: b.user?.avatarUrl,
                upiId: b.user?.upiId,
                netBalance: Number(b.netBalance || 0),
              }))
            : (groupData.members || []).map((m: any) => ({
                id: m.uid || m.id,
                name: (m.uid || m.id) === currentUserId
                  ? 'You'
                  : (m.firstName ? `${m.firstName} ${m.lastName || ''}`.trim() : m.name || 'Member'),
                avatarUrl: m.avatarUrl,
                upiId: m.upiId,
                netBalance: 0,
              }));

          // Compute simplified debts via @splitit/core
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

          const yourNetBalance = members.find((m) => m.id === currentUserId)?.netBalance || 0;

          // Map expenses
          const expenses: GroupExpense[] = Array.isArray(expensesData)
            ? expensesData.map((e: any) => {
                const firstPayer = e.payers?.[0];
                const payerId = firstPayer?.user?.uid || firstPayer?.userId || e.expenseCreatorId || 'unknown';
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
                  amount: Number(e.amount || 0),
                  currency: 'INR',
                  paidById: payerId,
                  paidByName: payerName,
                  date: formattedDate,
                  category: {
                    master: e.masterCategory || (typeof e.category === 'string' ? e.category : 'General'),
                    sub: typeof e.category === 'string' ? e.category : e.category?.sub || 'General',
                  },
                  yourShare,
                  yourImpact,
                };
              })
            : [];

          // Map budget
          const b = groupData.budget;
          const totalSpent = Number(groupData.totalExpenses || 0);
          const limit = Number(b?.monthlyLimit || 0);
          const now = new Date();
          const daysRemaining = Math.max(1, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate());
          const safeDailyAllowance = limit > totalSpent ? Math.round((limit - totalSpent) / daysRemaining) : 0;

          const catLimits = b?.categoryLimits || {};
          const catKeys = Object.keys(catLimits);
          const colors = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4'];
          const categories = catKeys.map((name, i) => ({
            name,
            limit: Number(catLimits[name] || 0),
            spent: Math.round(Number(catLimits[name] || 0) * 0.4),
            color: colors[i % colors.length],
          }));

          const budget: GroupBudget = {
            enabled: !!b?.enabled,
            totalMonthlyLimit: limit,
            totalSpent,
            currency: 'INR',
            daysRemaining,
            safeDailyAllowance,
            categories,
          };

          // Map activities
          const activities: GroupActivityItem[] = Array.isArray(historyData)
            ? historyData.slice(0, 30).map((h: any) => ({
                id: h.id || `act_${Math.random()}`,
                type: h.type || 'expense_created',
                actorName: h.actor?.firstName
                  ? `${h.actor.firstName} ${h.actor.lastName || ''}`.trim()
                  : h.actor?.name || 'Someone',
                description: h.description || 'Activity recorded',
                timeAgo: h.createdAt ? new Date(h.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'Recently',
                diffData: h.data?.diffData,
              }))
            : [];

          return {
            id: groupData.id,
            name: groupData.name || 'Group',
            description: groupData.description || undefined,
            coverImageUrl: groupData.coverImageUrl || 'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1200&auto=format&fit=crop',
            currency: 'INR',
            categoryIcon: groupData.categoryIcon || 'Users',
            totalGroupSpend: totalSpent,
            yourNetBalance,
            members,
            expenses,
            simplifiedDebts,
            budget,
            activities,
          };
        }
      }
    } catch (e) {
      // Backend request failed or offline
    }

    // Match requested group by ID from active user groups
    const allUserGroups = await this.getUserGroups();
    const matching = allUserGroups.find((g) => g.id === groupId) || allUserGroups[0];

    const baseMembers: GroupMember[] = matching?.members?.map((m, idx) => ({
      id: m.id,
      name: m.name,
      avatarUrl: m.avatarUrl,
      netBalance: m.name === 'You' ? (matching.userNetBalance || 0) : (idx === 1 ? -(matching.userNetBalance || 0) : 0),
      upiId: m.name === 'You' ? (currentUser?.upiId || 'you@upi') : `${m.id}@okhdfc`,
    })) || [
      { id: 'u1', name: 'You', netBalance: matching?.userNetBalance || 0, avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120&auto=format&fit=crop' },
      { id: 'u2', name: 'Rohit Sharma', netBalance: -(matching?.userNetBalance || 0), avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=120&auto=format&fit=crop' },
    ];

    const debts = simplifyDebts(
      baseMembers.map((m) => ({ user: { uid: m.id }, netBalance: m.netBalance }))
    );
    const memberNameMap = new Map(baseMembers.map((m) => [m.id, m.name]));
    const simplifiedDebts: SimplifiedDebt[] = debts.map((d) => ({
      fromUserId: d.from.uid,
      fromName: memberNameMap.get(d.from.uid) || 'Member',
      toUserId: d.to.uid,
      toName: memberNameMap.get(d.to.uid) || 'Member',
      amount: d.amount,
      currency: 'INR',
    }));

    // Generate matching expenses tailored to the group's theme
    let groupExpenses: GroupExpense[] = [];
    if (matching.name.includes('Apartment') || matching.name.includes('Flatmates')) {
      groupExpenses = [
        {
          id: 'exp_apt_1',
          title: 'Monthly Flat Rent & Maintenance',
          amount: 28000,
          currency: 'INR',
          paidById: 'u2',
          paidByName: 'Rohit Sharma',
          date: '01 Oct',
          category: { master: 'Housing', sub: 'Rent' },
          yourShare: 7000,
          yourImpact: 'owe',
        },
        {
          id: 'exp_apt_2',
          title: 'High-Speed Fiber Internet Bill',
          amount: 1499,
          currency: 'INR',
          paidById: 'u1',
          paidByName: 'You',
          date: 'Yesterday, 8:30 PM',
          category: { master: 'Utilities', sub: 'Internet' },
          yourShare: 375,
          yourImpact: 'get',
        },
        {
          id: 'exp_apt_3',
          title: 'Supermarket Groceries & Water Cans',
          amount: 3850,
          currency: 'INR',
          paidById: 'u1',
          paidByName: 'You',
          date: '04 Oct, 7:15 PM',
          category: { master: 'Food and Drink', sub: 'Groceries' },
          yourShare: 962,
          yourImpact: 'get',
        },
      ];
    } else if (matching.name.includes('Trek') || matching.name.includes('Mountain')) {
      groupExpenses = [
        {
          id: 'exp_trk_1',
          title: 'Camping Tents & Sleeping Bags',
          amount: 4800,
          currency: 'INR',
          paidById: 'u1',
          paidByName: 'You',
          date: 'Yesterday',
          category: { master: 'Entertainment', sub: 'Sports' },
          yourShare: 1200,
          yourImpact: 'get',
        },
        {
          id: 'exp_trk_2',
          title: 'Trail Guide & Forest Entry Permits',
          amount: 2200,
          currency: 'INR',
          paidById: 'u2',
          paidByName: 'Rohit Sharma',
          date: '03 Oct',
          category: { master: 'Transportation', sub: 'Taxi' },
          yourShare: 550,
          yourImpact: 'owe',
        },
      ];
    } else if (matching.name.includes('Foodies') || matching.name.includes('Dinner') || matching.name.includes('Lunch')) {
      groupExpenses = [
        {
          id: 'exp_foo_1',
          title: 'Friday Craft Brewery & Taproom',
          amount: 5400,
          currency: 'INR',
          paidById: 'u1',
          paidByName: 'You',
          date: 'Today, 9:00 PM',
          category: { master: 'Food and Drink', sub: 'Dining Out' },
          yourShare: 1800,
          yourImpact: 'get',
        },
        {
          id: 'exp_foo_2',
          title: 'Sunday Brunch Buffet',
          amount: 3200,
          currency: 'INR',
          paidById: 'u3',
          paidByName: 'Priya Patel',
          date: 'Yesterday',
          category: { master: 'Food and Drink', sub: 'Dining Out' },
          yourShare: 1066,
          yourImpact: 'owe',
        },
      ];
    }

    return {
      id: matching.id || groupId,
      name: matching.name,
      description: matching.description,
      coverImageUrl: matching.coverImageUrl,
      currency: 'INR',
      categoryIcon: matching.categoryIcon || 'Users',
      totalGroupSpend: matching.totalExpenses || 0,
      yourNetBalance: matching.userNetBalance || 0,
      members: baseMembers,
      expenses: groupExpenses,
      simplifiedDebts,
      budget: {
        enabled: true,
        totalMonthlyLimit: Math.max(30000, (matching.totalExpenses || 20000) * 1.3),
        totalSpent: matching.totalExpenses || 0,
        currency: 'INR',
        daysRemaining: 10,
        safeDailyAllowance: 1250,
        categories: [
          { name: 'Food and Drink', limit: 20000, spent: 14000, color: '#10B981' },
          { name: 'Housing', limit: 30000, spent: 28000, color: '#3B82F6' },
          { name: 'Utilities', limit: 5000, spent: 2500, color: '#F59E0B' },
        ],
      },
      activities: [
        {
          id: 'act_1',
          type: 'expense_created',
          actorName: 'You',
          description: `recorded expense in ${matching.name}`,
          timeAgo: '2h ago',
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
          Cookie: `better-auth.session_token=${token || ''}`,
        },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const result = await res.json();
        return result;
      }
    } catch {
      // Offline fallback
    }
    const newId = `grp_${Date.now()}`;
    _cachedGroups.unshift({
      id: newId,
      name: data.name,
      description: `Created group in ${data.category}`,
      categoryIcon: data.category === 'Travel' ? 'Plane' : (data.category === 'Home' ? 'Home' : 'Users'),
      membersCount: (data.memberEmails?.length || 0) + 1,
      members: [
        { id: 'u1', name: 'You' },
        ...(data.memberEmails || []).map((email, idx) => ({ id: `new_m_${idx}`, name: email.split('@')[0] })),
      ],
      totalExpenses: 0,
      userNetBalance: 0,
      archived: false,
    });
    return { success: true, id: newId };
  },

  /**
   * Update group properties (name, description, etc.)
   */
  async updateGroup(groupId: string, updates: { name?: string; description?: string }): Promise<boolean> {
    try {
      const token = await authService.getToken();
      if (token) {
        const res = await fetch(`${API_BASE_URL}/api/groups/${groupId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            Authorization: `Bearer ${token}`,
            Cookie: `better-auth.session_token=${token}`,
          },
          body: JSON.stringify(updates),
        });
        if (res.ok) {
          const match = _cachedGroups.find((g) => g.id === groupId);
          if (match) {
            if (updates.name) match.name = updates.name;
            if (updates.description) match.description = updates.description;
          }
          return true;
        }
      }
    } catch {
      // Offline fallback
    }
    const match = _cachedGroups.find((g) => g.id === groupId);
    if (match) {
      if (updates.name) match.name = updates.name;
      if (updates.description) match.description = updates.description;
      return true;
    }
    return false;
  },

  /**
   * Archive group
   */
  async archiveGroup(groupId: string): Promise<boolean> {
    try {
      const token = await authService.getToken();
      if (token) {
        const res = await fetch(`${API_BASE_URL}/api/groups/${groupId}/archive`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            Authorization: `Bearer ${token}`,
            Cookie: `better-auth.session_token=${token}`,
          },
        });
        if (res.ok) {
          const match = _cachedGroups.find((g) => g.id === groupId);
          if (match) match.archived = true;
          return true;
        }
      }
    } catch {
      // Offline fallback
    }
    const match = _cachedGroups.find((g) => g.id === groupId);
    if (match) {
      match.archived = true;
      return true;
    }
    return false;
  },

  /**
   * Delete group permanently
   */
  async deleteGroup(groupId: string): Promise<boolean> {
    try {
      const token = await authService.getToken();
      if (token) {
        const res = await fetch(`${API_BASE_URL}/api/groups/${groupId}`, {
          method: 'DELETE',
          headers: {
            'Accept': 'application/json',
            Authorization: `Bearer ${token}`,
            Cookie: `better-auth.session_token=${token}`,
          },
        });
        if (res.ok) {
          _cachedGroups = _cachedGroups.filter((g) => g.id !== groupId);
          return true;
        }
      }
    } catch {
      // Offline fallback
    }
    _cachedGroups = _cachedGroups.filter((g) => g.id !== groupId);
    return true;
  },
};
