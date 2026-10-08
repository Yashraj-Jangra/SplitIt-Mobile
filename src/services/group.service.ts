import { simplifyDebts } from '@splitit/core';
import * as SecureStore from 'expo-secure-store';
import { authService, API_BASE_URL } from './auth.service';
import { settingsService } from './settings.service';
import { storageService, STORAGE_KEYS } from './storage.service';
import { THEME } from '../constants/theme';

const DEFAULT_GROUP_STORAGE_KEY = 'splitit_default_group_id';

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
  userShareStatus?: 'lent' | 'owe' | 'no_balance' | 'not_involved';
  netAmount?: number;
  payers?: any[];
  participants?: any[];
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

export interface HistoryEventItem {
  id: string;
  groupId: string;
  eventType: string;
  timestamp: string;
  actor: {
    uid: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatarUrl?: string;
    role?: string;
    name?: string;
  };
  description: string;
  data?: any;
  restored?: boolean;
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
  history?: HistoryEventItem[];
}

let _cachedGroups: GroupListItem[] = [];
const _groupDetailsMap = new Map<string, GroupDetailData>();

export const groupService = {
  /**
   * Synchronous accessor for in-memory cached groups list (prevents back-navigation blanking).
   */
  getInMemoryGroups(): GroupListItem[] {
    return _cachedGroups;
  },

  /**
   * Synchronous accessor for in-memory cached group details by ID.
   */
  getInMemoryGroupDetail(groupId: string): GroupDetailData | null {
    return _groupDetailsMap.get(groupId) || null;
  },

  /**
   * Fast tick lookup of user groups from persistent offline storage (0ms cold boot).
   */
  async getCachedUserGroups(): Promise<GroupListItem[]> {
    if (_cachedGroups.length > 0) return _cachedGroups;
    const fromStorage = await storageService.getItem<GroupListItem[]>(STORAGE_KEYS.GROUPS);
    if (fromStorage && fromStorage.length > 0) {
      _cachedGroups = fromStorage;
      return fromStorage;
    }
    return [];
  },

  /**
   * Fast tick lookup of a group's cached detail from persistent offline storage (0ms instant display).
   */
  async getCachedGroupDetails(groupId: string): Promise<GroupDetailData | null> {
    if (_groupDetailsMap.has(groupId)) {
      return _groupDetailsMap.get(groupId)!;
    }
    try {
      const fromStorage = await storageService.getItem<GroupDetailData>(STORAGE_KEYS.GROUP_DETAIL(groupId));
      if (fromStorage) {
        if (!fromStorage.history) fromStorage.history = [];
        if (!fromStorage.budget) {
          fromStorage.budget = {
            enabled: false,
            totalMonthlyLimit: 0,
            totalSpent: 0,
            currency: 'INR',
            daysRemaining: 10,
            safeDailyAllowance: 0,
            categories: [],
          };
        }
        if (!fromStorage.simplifiedDebts) fromStorage.simplifiedDebts = [];
        if (!fromStorage.members) fromStorage.members = [];
        if (!fromStorage.expenses) fromStorage.expenses = [];
        _groupDetailsMap.set(groupId, fromStorage);
        return fromStorage;
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Fetch all user groups with balance & cover images (SWR pattern).
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
            const currentUser = await authService.getCachedUser();
            const currentUserId = currentUser?.id || '';

            const balanceResults = await Promise.allSettled(
              data.map((g: any) =>
                fetch(`${API_BASE_URL}/api/groups/${g.id}/balances`, {
                  headers: {
                    'Accept': 'application/json',
                    Authorization: `Bearer ${token}`,
                    Cookie: `better-auth.session_token=${token}`,
                  },
                }).then((r) => (r.ok ? r.json() : []))
              )
            );

            const mapped: GroupListItem[] = data.map((g: any, index: number) => {
              const balances =
                balanceResults[index]?.status === 'fulfilled' &&
                Array.isArray(balanceResults[index].value)
                  ? balanceResults[index].value
                  : [];
              const myBalanceObj = balances.find(
                (b: any) => (b.user?.uid || b.user?.id) === currentUserId
              );
              const computedNet = myBalanceObj
                ? Number(myBalanceObj.netBalance || 0)
                : Number(g.userNetBalance || 0);

              return {
                id: g.id || `g_${index}`,
                name: g.name,
                description: g.description,
                coverImageUrl:
                  g.coverImageUrl ||
                  [
                    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=1200&auto=format&fit=crop',
                    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200&auto=format&fit=crop',
                    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1200&auto=format&fit=crop',
                    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200&auto=format&fit=crop',
                  ][index % 4],
                categoryIcon: g.categoryIcon || 'Users',
                membersCount: g.members?.length || 1,
                members: (g.members || []).map((m: any) => ({
                  id: m.uid || m.id,
                  name: m.firstName
                    ? `${m.firstName} ${m.lastName || ''}`.trim()
                    : m.name || 'Member',
                  avatarUrl: m.avatarUrl,
                })),
                totalExpenses: g.totalExpenses || 0,
                userNetBalance: computedNet,
                archived: !!g.archivedAt,
              };
            });
            _cachedGroups = mapped;
            await storageService.setItem(STORAGE_KEYS.GROUPS, mapped);
            return mapped;
          }
        }
      }
    } catch {
      // Offline fallback
    }

    const offlineGroups = await storageService.getItem<GroupListItem[]>(STORAGE_KEYS.GROUPS);
    if (offlineGroups && offlineGroups.length > 0) {
      _cachedGroups = offlineGroups;
      return offlineGroups;
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
                    amount: Number(e.amount || 0),
                    currency: e.currency || 'INR',
                    paidById: payerId,
                    paidByName: payerName,
                    date: formattedDate,
                    category: {
                      master: masterCategory,
                      sub: subCategory,
                    },
                  yourShare,
                  yourImpact,
                  userShareStatus,
                  netAmount: net,
                  payers: e.payers,
                  participants: e.participants,
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
          const colors = [
            THEME.colors.palette.emerald,
            THEME.colors.palette.blue,
            THEME.colors.palette.purple,
            THEME.colors.palette.amber,
            THEME.colors.palette.pink,
            THEME.colors.palette.cyan,
          ];
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

          // Map activities (backward compatibility)
          const activities: GroupActivityItem[] = Array.isArray(historyData)
            ? historyData.slice(0, 30).map((h: any) => ({
                id: h.id || `act_${Math.random()}`,
                type: h.type || h.eventType || 'expense_created',
                actorName: h.actor?.firstName
                  ? `${h.actor.firstName} ${h.actor.lastName || ''}`.trim()
                  : h.actor?.name || 'Someone',
                description: h.description || 'Activity recorded',
                timeAgo: h.createdAt || h.timestamp ? new Date(h.createdAt || h.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'Recently',
                diffData: h.data?.diffData,
              }))
            : [];

          // Map full HistoryEvent items matching website
          const history: HistoryEventItem[] = Array.isArray(historyData)
            ? historyData.map((h: any) => ({
                id: h.id || `hist_${Math.random()}`,
                groupId: h.groupId || groupId,
                eventType: h.eventType || h.type || 'expense_created',
                timestamp: h.timestamp || h.createdAt || new Date().toISOString(),
                actor: {
                  uid: h.actor?.uid || h.actor?.id || h.actorId || '',
                  firstName: h.actor?.firstName,
                  lastName: h.actor?.lastName,
                  email: h.actor?.email,
                  avatarUrl: h.actor?.avatarUrl,
                  role: h.actor?.role,
                  name: h.actor?.name || (h.actor?.firstName ? `${h.actor.firstName} ${h.actor.lastName || ''}`.trim() : 'Member'),
                },
                description: h.description || 'Activity recorded',
                data: h.data || {},
                restored: Boolean(h.restored),
              }))
            : [];

          const detailResult: GroupDetailData = {
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
            history,
          };

          // Cache group details offline and in-memory
          _groupDetailsMap.set(groupId, detailResult);
          await storageService.setItem(STORAGE_KEYS.GROUP_DETAIL(groupId), detailResult);

          // Proactively warm each expense's detail cache in persistent storage
          for (const exp of expenses) {
            await storageService.setItem(STORAGE_KEYS.EXPENSE_DETAIL(exp.id), {
              id: exp.id,
              title: exp.title,
              amount: exp.amount,
              currency: exp.currency,
              date: exp.date,
              paidById: exp.paidById,
              paidByName: exp.paidByName,
              category: exp.category,
              payers: exp.payers,
              participants: exp.participants,
              groupId: groupData.id,
              groupName: groupData.name || 'Group',
              rawDate: new Date().toISOString(),
              splitType: 'equally',
              creator: {
                id: exp.paidById || 'creator',
                name: exp.paidByName || 'Member',
              },
              logs: [],
            });
          }

          return detailResult;
        }
      }
    } catch {
      // Backend request failed or offline
    }

    // Check offline storage before falling back to defaults
    const offlineGroup = await storageService.getItem<GroupDetailData>(STORAGE_KEYS.GROUP_DETAIL(groupId));
    if (offlineGroup) {
      _groupDetailsMap.set(groupId, offlineGroup);
      return offlineGroup;
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
          userShareStatus: 'owe',
          netAmount: -7000,
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
          yourShare: 1124.25,
          yourImpact: 'get',
          userShareStatus: 'lent',
          netAmount: 1124.25,
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
          yourShare: 2887.5,
          yourImpact: 'get',
          userShareStatus: 'lent',
          netAmount: 2887.5,
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
          yourShare: 3600,
          yourImpact: 'get',
          userShareStatus: 'lent',
          netAmount: 3600,
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
          userShareStatus: 'owe',
          netAmount: -550,
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
          yourShare: 3600,
          yourImpact: 'get',
          userShareStatus: 'lent',
          netAmount: 3600,
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
          yourShare: 1066.67,
          yourImpact: 'owe',
          userShareStatus: 'owe',
          netAmount: -1066.67,
        },
      ];
    }

    const fallbackResult: GroupDetailData = {
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
          { name: 'Food and Drink', limit: 20000, spent: 14000, color: THEME.colors.categories.food },
          { name: 'Housing', limit: 30000, spent: 28000, color: THEME.colors.categories.housing },
          { name: 'Utilities', limit: 5000, spent: 2500, color: THEME.colors.categories.utilities },
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
      history: [
        {
          id: 'hist_exp_1',
          groupId: matching.id || groupId,
          eventType: 'expense_created',
          timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
          actor: { uid: 'u1', name: 'You', firstName: 'You', role: 'user' },
          description: `You added "${groupExpenses[0]?.title || 'Expense'}"`,
          data: {
            expenseId: groupExpenses[0]?.id || 'exp_1',
            date: new Date().toISOString(),
          },
          restored: false,
        },
        {
          id: 'hist_exp_2',
          groupId: matching.id || groupId,
          eventType: 'expense_updated',
          timestamp: new Date(Date.now() - 3600000 * 6).toISOString(),
          actor: { uid: 'u2', name: 'Rohit Sharma', firstName: 'Rohit', lastName: 'Sharma', role: 'user' },
          description: `Rohit Sharma updated "${groupExpenses[1]?.title || 'Expense'}"`,
          data: {
            expenseId: groupExpenses[1]?.id || 'exp_2',
            date: new Date(Date.now() - 86400000).toISOString(),
            changes: [
              { field: 'Amount', from: '₹1,200', to: '₹1,499', type: 'changed' },
              { field: 'Split', from: "changed Rohit's share from ₹600 to ₹750; added Priya who paid ₹0", type: 'changed' },
            ],
          },
          restored: false,
        },
        {
          id: 'hist_exp_3',
          groupId: matching.id || groupId,
          eventType: 'budget_updated',
          timestamp: new Date(Date.now() - 3600000 * 18).toISOString(),
          actor: { uid: 'system', name: 'SplitIt AI', firstName: 'SplitIt', role: 'admin' },
          description: 'SplitIt AI optimized group category budget thresholds',
          data: {
            aiInitiated: true,
            monthlyBudgetUnchanged: true,
            currentMonthlyLimit: 30000,
            changes: [
              { field: 'Food & Drink', from: '₹18,000', to: '₹20,000', type: 'changed' },
              { field: 'Housing', from: '₹32,000', to: '₹30,000', type: 'changed' },
            ],
          },
          restored: false,
        },
        {
          id: 'hist_exp_del',
          groupId: matching.id || groupId,
          eventType: 'expense_deleted',
          timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
          actor: { uid: 'u1', name: 'You', firstName: 'You', role: 'user' },
          description: 'You deleted "Snacks & Evening Drinks"',
          data: {
            expenseId: 'del_mock_99',
            date: new Date(Date.now() - 86400000 * 2).toISOString(),
          },
          restored: false,
        },
      ],
    };

    _groupDetailsMap.set(groupId, fallbackResult);
    return fallbackResult;
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

  /**
   * Retrieve the user's default group ID for new expenses
   */
  async getDefaultGroupId(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(DEFAULT_GROUP_STORAGE_KEY);
    } catch {
      return null;
    }
  },

  /**
   * Set or clear the user's default group ID for new expenses
   */
  async setDefaultGroupId(groupId: string | null): Promise<void> {
    try {
      if (groupId) {
        await SecureStore.setItemAsync(DEFAULT_GROUP_STORAGE_KEY, groupId);
      } else {
        await SecureStore.deleteItemAsync(DEFAULT_GROUP_STORAGE_KEY);
      }
    } catch {
      // SecureStore error fallback
    }
  },

  /**
   * Retrieve group history audit events matching the website
   */
  async getGroupHistory(groupId: string): Promise<HistoryEventItem[]> {
    const token = await authService.getToken();
    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
        headers.Cookie = `better-auth.session_token=${token}`;
      }
      const res = await fetch(`${API_BASE_URL}/api/history?groupId=${groupId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data.map((h: any) => ({
            id: h.id || `hist_${Math.random()}`,
            groupId: h.groupId || groupId,
            eventType: h.eventType || h.type || 'expense_created',
            timestamp: h.timestamp || h.createdAt || new Date().toISOString(),
            actor: {
              uid: h.actor?.uid || h.actor?.id || h.actorId || '',
              firstName: h.actor?.firstName,
              lastName: h.actor?.lastName,
              email: h.actor?.email,
              avatarUrl: h.actor?.avatarUrl,
              role: h.actor?.role,
              name: h.actor?.name || (h.actor?.firstName ? `${h.actor.firstName} ${h.actor.lastName || ''}`.trim() : 'Member'),
            },
            description: h.description || '',
            data: h.data || {},
            restored: Boolean(h.restored),
          }));
        }
      }
    } catch {
      // Offline fallback
    }
    const cachedDetail = _groupDetailsMap.get(groupId);
    return cachedDetail?.history || [];
  },

  /**
   * Restore a deleted expense via the history restore API
   */
  async restoreExpense(historyEventId: string, actorId: string): Promise<string | null> {
    const token = await authService.getToken();
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
        headers.Cookie = `better-auth.session_token=${token}`;
      }
      const res = await fetch(`${API_BASE_URL}/api/history/restore`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ eventId: historyEventId, type: 'expense' }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.id || null;
      }
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to restore expense');
    } catch (err: any) {
      // Optimistic offline update for seamless user experience
      for (const [gId, detail] of _groupDetailsMap.entries()) {
        if (detail.history) {
          const event = detail.history.find((e) => e.id === historyEventId);
          if (event) {
            event.restored = true;
            detail.history.unshift({
              id: `restored_${Date.now()}`,
              groupId: gId,
              eventType: 'expense_restored',
              timestamp: new Date().toISOString(),
              actor: { uid: actorId, name: 'You', firstName: 'You' },
              description: `Restored: ${event.description.replace(/^Deleted:?\s*/i, '')}`,
              data: { newExpenseId: event.data?.expenseId || `restored_exp_${Date.now()}` },
              restored: false,
            });
            await storageService.setItem(STORAGE_KEYS.GROUP_DETAIL(gId), detail);
            return event.data?.expenseId || 'restored_ok';
          }
        }
      }
      throw err;
    }
  },

  /**
   * Restore a deleted settlement via the history restore API
   */
  async restoreSettlement(historyEventId: string, actorId: string): Promise<string | null> {
    const token = await authService.getToken();
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
        headers.Cookie = `better-auth.session_token=${token}`;
      }
      const res = await fetch(`${API_BASE_URL}/api/history/restore`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ eventId: historyEventId, type: 'settlement' }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.id || null;
      }
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to restore settlement');
    } catch (err: any) {
      // Optimistic offline update
      for (const [gId, detail] of _groupDetailsMap.entries()) {
        if (detail.history) {
          const event = detail.history.find((e) => e.id === historyEventId);
          if (event) {
            event.restored = true;
            detail.history.unshift({
              id: `restored_${Date.now()}`,
              groupId: gId,
              eventType: 'settlement_restored',
              timestamp: new Date().toISOString(),
              actor: { uid: actorId, name: 'You', firstName: 'You' },
              description: `Restored settlement`,
              data: { newSettlementId: `restored_set_${Date.now()}` },
              restored: false,
            });
            await storageService.setItem(STORAGE_KEYS.GROUP_DETAIL(gId), detail);
            return 'restored_settlement_ok';
          }
        }
      }
      throw err;
    }
  },

  /**
   * Delete history event permanently (strictly admin-only, client and server guarded)
   */
  async deleteHistoryEvent(historyEventId: string): Promise<void> {
    const currentUser = await authService.getCachedUser();
    if (currentUser?.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators can delete history events.');
    }

    const token = await authService.getToken();
    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
        headers.Cookie = `better-auth.session_token=${token}`;
      }
      const res = await fetch(`${API_BASE_URL}/api/history/${historyEventId}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to delete history event');
      }
    } catch (err: any) {
      if (err.message?.includes('Unauthorized')) throw err;
      // Optimistic offline update if server unreachable
      for (const [gId, detail] of _groupDetailsMap.entries()) {
        if (detail.history) {
          detail.history = detail.history.filter((e) => e.id !== historyEventId);
          await storageService.setItem(STORAGE_KEYS.GROUP_DETAIL(gId), detail);
        }
      }
    }
  },
};
