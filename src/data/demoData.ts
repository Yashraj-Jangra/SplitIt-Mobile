import { GroupListItem, GroupDetailData, GroupMember } from '../services/group.service';
import { UserTransactionItem, ExpenseDetailModel } from '../services/expense.service';
import { UserBalanceSummary } from '../services/balance.service';
import { getActiveCurrencySymbol } from '../contexts/currency.context';

export const DEMO_USER_ID = 'demo_user_viewer';

export const DEMO_MEMBERS: Record<string, GroupMember> = {
  you: {
    id: DEMO_USER_ID,
    name: 'You',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120&auto=format&fit=crop',
    upiId: 'you@okhdfcbank',
    netBalance: 0,
  },
  aryan: {
    id: 'demo_user_aryan',
    name: 'Aryan Mehta',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=120&auto=format&fit=crop',
    upiId: 'aryan.mehta@oksbi',
    netBalance: 0,
  },
  tanya: {
    id: 'demo_user_tanya',
    name: 'Tanya Sen',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=120&auto=format&fit=crop',
    upiId: 'tanya.sen@paytm',
    netBalance: 0,
  },
  kabir: {
    id: 'demo_user_kabir',
    name: 'Kabir Joshi',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=120&auto=format&fit=crop',
    upiId: 'kabirj@icici',
    netBalance: 0,
  },
  rohan: {
    id: 'demo_user_rohan',
    name: 'Rohan Roy',
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=120&auto=format&fit=crop',
    upiId: 'rohan.roy@ybl',
    netBalance: 0,
  },
};

export function getDemoGroups(userName?: string): GroupListItem[] {
  const viewerName = userName ? `${userName} (You)` : 'You';

  return [
    {
      id: 'demo_grp_flat',
      name: 'Flat 302 Flatmates 🏡',
      description: 'Monthly rent, high-speed Wi-Fi, electricity & groceries',
      coverImageUrl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=1200&auto=format&fit=crop',
      categoryIcon: 'Home',
      membersCount: 3,
      members: [
        { id: DEMO_USER_ID, name: viewerName, avatarUrl: DEMO_MEMBERS.you.avatarUrl },
        { id: DEMO_MEMBERS.aryan.id, name: DEMO_MEMBERS.aryan.name, avatarUrl: DEMO_MEMBERS.aryan.avatarUrl },
        { id: DEMO_MEMBERS.tanya.id, name: DEMO_MEMBERS.tanya.name, avatarUrl: DEMO_MEMBERS.tanya.avatarUrl },
      ],
      totalExpenses: 5549,
      userNetBalance: 999.34,
      archived: false,
      updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    },
    {
      id: 'demo_grp_goa',
      name: 'Goa Weekend Getaway 🌊',
      description: 'Beachside villa, sunset seafood dinner, scooters & water sports',
      coverImageUrl: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?q=80&w=1200&auto=format&fit=crop',
      categoryIcon: 'Plane',
      membersCount: 4,
      members: [
        { id: DEMO_USER_ID, name: viewerName, avatarUrl: DEMO_MEMBERS.you.avatarUrl },
        { id: DEMO_MEMBERS.kabir.id, name: DEMO_MEMBERS.kabir.name, avatarUrl: DEMO_MEMBERS.kabir.avatarUrl },
        { id: DEMO_MEMBERS.tanya.id, name: DEMO_MEMBERS.tanya.name, avatarUrl: DEMO_MEMBERS.tanya.avatarUrl },
        { id: DEMO_MEMBERS.rohan.id, name: DEMO_MEMBERS.rohan.name, avatarUrl: DEMO_MEMBERS.rohan.avatarUrl },
      ],
      totalExpenses: 24000,
      userNetBalance: -1200,
      archived: false,
      updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      createdAt: new Date(Date.now() - 86400000 * 45).toISOString(),
    },
  ];
}

export function getDemoGroupDetails(groupId: string, userName?: string): GroupDetailData | null {
  const viewerName = userName || 'You';

  if (groupId === 'demo_grp_flat') {
    const members: GroupMember[] = [
      { ...DEMO_MEMBERS.you, name: viewerName, netBalance: 999.34 },
      { ...DEMO_MEMBERS.aryan, netBalance: -500 },
      { ...DEMO_MEMBERS.tanya, netBalance: -499.34 },
    ];

    return {
      id: 'demo_grp_flat',
      name: 'Flat 302 Flatmates 🏡',
      description: 'Monthly rent, high-speed Wi-Fi, electricity & groceries',
      coverImageUrl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=1200&auto=format&fit=crop',
      categoryIcon: 'Home',
      currency: 'INR',
      totalGroupSpend: 5549,
      yourNetBalance: 999.34,
      members,
      simplifiedDebts: [
        {
          fromUserId: DEMO_MEMBERS.aryan.id,
          fromName: DEMO_MEMBERS.aryan.name,
          toUserId: DEMO_USER_ID,
          toName: viewerName,
          amount: 500,
          currency: 'INR',
        },
        {
          fromUserId: DEMO_MEMBERS.tanya.id,
          fromName: DEMO_MEMBERS.tanya.name,
          toUserId: DEMO_USER_ID,
          toName: viewerName,
          amount: 499.34,
          currency: 'INR',
        },
      ],
      expenses: [
        {
          id: 'demo_exp_wifi',
          title: 'High-Speed Fiber Wi-Fi (1 Gbps)',
          amount: 1499,
          currency: 'INR',
          paidById: DEMO_USER_ID,
          paidByName: viewerName,
          date: 'Yesterday, 8:30 PM',
          rawDate: new Date(Date.now() - 86400000).toISOString(),
          category: { master: 'Utilities', sub: 'Internet' },
          yourShare: 499.66,
          yourImpact: 'get',
          userShareStatus: 'lent',
          netAmount: 999.34,
        },
        {
          id: 'demo_exp_groceries',
          title: 'Weekly Organic Groceries & Milk',
          amount: 2850,
          currency: 'INR',
          paidById: DEMO_MEMBERS.tanya.id,
          paidByName: DEMO_MEMBERS.tanya.name,
          date: '3 days ago',
          rawDate: new Date(Date.now() - 86400000 * 3).toISOString(),
          category: { master: 'Food and Drink', sub: 'Groceries' },
          yourShare: 950,
          yourImpact: 'owe',
          userShareStatus: 'owe',
          netAmount: -950,
        },
        {
          id: 'demo_exp_cleaning',
          title: 'House Deep Cleaning & Supplies',
          amount: 1200,
          currency: 'INR',
          paidById: DEMO_MEMBERS.aryan.id,
          paidByName: DEMO_MEMBERS.aryan.name,
          date: '5 days ago',
          rawDate: new Date(Date.now() - 86400000 * 5).toISOString(),
          category: { master: 'Housing', sub: 'Maintenance' },
          yourShare: 400,
          yourImpact: 'owe',
          userShareStatus: 'owe',
          netAmount: -400,
        },
      ],
      settlements: [
        {
          id: 'demo_stl_flat_1',
          groupId: 'demo_grp_flat',
          amount: 1200,
          currency: 'INR',
          date: '10 Oct',
          rawDate: new Date(Date.now() - 86400000 * 5).toISOString(),
          payerId: DEMO_MEMBERS.aryan.id,
          payerName: DEMO_MEMBERS.aryan.name,
          payerAvatarUrl: DEMO_MEMBERS.aryan.avatarUrl,
          payeeId: DEMO_MEMBERS.tanya.id,
          payeeName: DEMO_MEMBERS.tanya.name,
          payeeAvatarUrl: DEMO_MEMBERS.tanya.avatarUrl,
          notes: 'Settled for groceries and household fund via UPI',
          method: 'upi',
        },
      ],
      budget: {
        monthlyLimit: 35000,
        totalMonthlyLimit: 35000,
        enabled: true,
        categoryLimits: {
          'Utilities': 5000,
          'Food and Drink': 18000,
          'Housing': 8000,
        },
      },
      activities: [
        {
          id: 'demo_act_1',
          type: 'expense_created',
          actorName: viewerName,
          description: 'Added "High-Speed Fiber Wi-Fi (1 Gbps)"',
          timeAgo: '1d ago',
        },
      ],
      history: [
        {
          id: 'demo_h_1',
          groupId: 'demo_grp_flat',
          eventType: 'expense_created',
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          actor: { uid: DEMO_USER_ID, name: viewerName },
          description: `Added "High-Speed Fiber Wi-Fi (1 Gbps)" (${getActiveCurrencySymbol()}1,499.00)`,
        },
        {
          id: 'demo_h_2',
          groupId: 'demo_grp_flat',
          eventType: 'settlement_created',
          timestamp: new Date(Date.now() - 86400000 * 5).toISOString(),
          actor: { uid: DEMO_MEMBERS.aryan.id, name: DEMO_MEMBERS.aryan.name },
          description: `Aryan settled ${getActiveCurrencySymbol()}1,200.00 with Tanya via UPI`,
        },
      ],
    };
  }

  if (groupId === 'demo_grp_goa') {
    const members: GroupMember[] = [
      { ...DEMO_MEMBERS.you, name: viewerName, netBalance: -1200 },
      { ...DEMO_MEMBERS.kabir, netBalance: 2400 },
      { ...DEMO_MEMBERS.tanya, netBalance: -600 },
      { ...DEMO_MEMBERS.rohan, netBalance: -600 },
    ];

    return {
      id: 'demo_grp_goa',
      name: 'Goa Weekend Getaway 🌊',
      description: 'Beachside villa, sunset seafood dinner, scooters & water sports',
      coverImageUrl: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?q=80&w=1200&auto=format&fit=crop',
      categoryIcon: 'Plane',
      currency: 'INR',
      totalGroupSpend: 24000,
      yourNetBalance: -1200,
      members,
      simplifiedDebts: [
        {
          fromUserId: DEMO_USER_ID,
          fromName: viewerName,
          toUserId: DEMO_MEMBERS.kabir.id,
          toName: DEMO_MEMBERS.kabir.name,
          amount: 1200,
          currency: 'INR',
        },
        {
          fromUserId: DEMO_MEMBERS.tanya.id,
          fromName: DEMO_MEMBERS.tanya.name,
          toUserId: DEMO_MEMBERS.kabir.id,
          toName: DEMO_MEMBERS.kabir.name,
          amount: 600,
          currency: 'INR',
        },
        {
          fromUserId: DEMO_MEMBERS.rohan.id,
          fromName: DEMO_MEMBERS.rohan.name,
          toUserId: DEMO_MEMBERS.kabir.id,
          toName: DEMO_MEMBERS.kabir.name,
          amount: 600,
          currency: 'INR',
        },
      ],
      expenses: [
        {
          id: 'demo_exp_shack',
          title: 'Sunset Beach Shack Seafood Dinner',
          amount: 4800,
          currency: 'INR',
          paidById: DEMO_USER_ID,
          paidByName: viewerName,
          date: 'Last Saturday, 9:15 PM',
          rawDate: new Date(Date.now() - 86400000 * 5).toISOString(),
          category: { master: 'Food and Drink', sub: 'Dining Out' },
          yourShare: 1200,
          yourImpact: 'get',
          userShareStatus: 'lent',
          netAmount: 3600,
        },
        {
          id: 'demo_exp_villa',
          title: 'Beachside Villa Airbnb (2 Nights)',
          amount: 16000,
          currency: 'INR',
          paidById: DEMO_MEMBERS.kabir.id,
          paidByName: DEMO_MEMBERS.kabir.name,
          date: 'Last weekend',
          rawDate: new Date(Date.now() - 86400000 * 6).toISOString(),
          category: { master: 'Travel', sub: 'Accommodation' },
          yourShare: 4000,
          yourImpact: 'owe',
          userShareStatus: 'owe',
          netAmount: -4000,
        },
        {
          id: 'demo_exp_scooters',
          title: 'Activa Scooter Rentals (4 Days)',
          amount: 3200,
          currency: 'INR',
          paidById: DEMO_MEMBERS.rohan.id,
          paidByName: DEMO_MEMBERS.rohan.name,
          date: 'Last Friday',
          rawDate: new Date(Date.now() - 86400000 * 7).toISOString(),
          category: { master: 'Transportation', sub: 'Rental' },
          yourShare: 800,
          yourImpact: 'owe',
          userShareStatus: 'owe',
          netAmount: -800,
        },
      ],
      settlements: [],
      budget: {
        monthlyLimit: 30000,
        totalMonthlyLimit: 30000,
        enabled: true,
      },
      activities: [
        {
          id: 'demo_act_goa_1',
          type: 'expense_created',
          actorName: DEMO_MEMBERS.kabir.name,
          description: 'Added "Beachside Villa 3-Night Stay"',
          timeAgo: '3d ago',
        },
      ],
      history: [
        {
          id: 'demo_h_goa_1',
          groupId: 'demo_grp_goa',
          eventType: 'expense_created',
          timestamp: new Date(Date.now() - 86400000 * 5).toISOString(),
          actor: { uid: DEMO_USER_ID, name: viewerName },
          description: `Added "Sunset Beach Shack Seafood Dinner" (${getActiveCurrencySymbol()}4,800.00)`,
        },
      ],
    };
  }

  return null;
}

export function getDemoExpenses(userName?: string): UserTransactionItem[] {
  const viewerName = userName || 'You';

  return [
    {
      id: 'demo_exp_wifi',
      title: 'High-Speed Fiber Wi-Fi (1 Gbps)',
      amount: 1499,
      paidByName: viewerName,
      date: 'Yesterday',
      groupName: 'Flat 302 Flatmates 🏡',
      groupId: 'demo_grp_flat',
      category: 'Internet',
      masterCategory: 'Utilities',
      yourShare: 999.34,
      yourImpact: 'get',
      userShareStatus: 'lent',
    },
    {
      id: 'demo_exp_shack',
      title: 'Sunset Beach Shack Seafood Dinner',
      amount: 4800,
      paidByName: viewerName,
      date: 'Oct 11',
      groupName: 'Goa Weekend Getaway 🌊',
      groupId: 'demo_grp_goa',
      category: 'Dining Out',
      masterCategory: 'Food and Drink',
      yourShare: 3600,
      yourImpact: 'get',
      userShareStatus: 'lent',
    },
    {
      id: 'demo_exp_groceries',
      title: 'Weekly Organic Groceries & Milk',
      amount: 2850,
      paidByName: 'Tanya Sen',
      date: 'Oct 12',
      groupName: 'Flat 302 Flatmates 🏡',
      groupId: 'demo_grp_flat',
      category: 'Groceries',
      masterCategory: 'Food and Drink',
      yourShare: 950,
      yourImpact: 'owe',
      userShareStatus: 'owe',
    },
    {
      id: 'demo_exp_villa',
      title: 'Beachside Villa Airbnb (2 Nights)',
      amount: 16000,
      paidByName: 'Kabir Joshi',
      date: 'Oct 09',
      groupName: 'Goa Weekend Getaway 🌊',
      groupId: 'demo_grp_goa',
      category: 'Accommodation',
      masterCategory: 'Travel',
      yourShare: 4000,
      yourImpact: 'owe',
      userShareStatus: 'owe',
    },
  ];
}

export function getDemoBalanceSummary(): UserBalanceSummary {
  const netBalance = -200.66;
  const totalOwed = 999.34;
  const totalOwe = 1200.0;

  // 30-day realistic cumulative sparkline data
  const now = Date.now();
  const dayMs = 86400000;
  const values = [0, 0, 0, -400, -1350, -1350, -5350, -1750, -1750, -1750, -200.66, -200.66];
  const chartData = values.map((val, idx) => ({
    date: new Date(now - (values.length - 1 - idx) * dayMs * 2.5).toISOString(),
    balance: val,
  }));

  return {
    netBalance,
    totalOwed,
    totalOwe,
    trendPercentage: -8,
    chartData,
    domain: [-5500, 1500],
    gradientOffset: 0.78,
    minBalance: -5350,
    maxBalance: 999.34,
  };
}

export function getDemoExpenseDetails(expenseId: string, userName?: string): ExpenseDetailModel | null {
  const viewerName = userName || 'You';
  const groups = [getDemoGroupDetails('demo_grp_flat', viewerName), getDemoGroupDetails('demo_grp_goa', viewerName)];
  for (const group of groups) {
    if (!group) continue;
    const exp = group.expenses.find((e) => e.id === expenseId);
    if (exp) {
      const payers = (exp.payers || []).map((p: any) => ({
        userId: p.userId || p.user?.uid || '',
        name: p.name || p.user?.name || 'Member',
        avatarUrl: p.avatarUrl || p.user?.avatarUrl,
        amount: Number(p.amount || 0),
      }));
      const participants = (exp.participants || []).map((p: any) => ({
        userId: p.userId || p.user?.uid || '',
        name: p.name || p.user?.name || 'Member',
        avatarUrl: p.avatarUrl || p.user?.avatarUrl,
        amountOwed: Number(p.amountOwed || 0),
        isCurrentUser: (p.userId || p.user?.uid) === DEMO_USER_ID,
      }));

      return {
        id: exp.id,
        groupId: group.id,
        groupName: group.name,
        title: exp.title,
        amount: exp.amount,
        currency: exp.currency || 'INR',
        date: exp.date,
        rawDate: exp.rawDate || new Date().toISOString(),
        category: exp.category,
        splitType: 'equally',
        notes: 'Interactive sample expense for demonstration.',
        paidById: exp.paidById,
        paidByName: exp.paidByName,
        paidByAvatar: undefined,
        payers: payers.length > 0 ? payers : [{ userId: exp.paidById, name: exp.paidByName, amount: exp.amount }],
        participants: participants.length > 0 ? participants : group.members.map((m) => ({
          userId: m.id,
          name: m.name,
          avatarUrl: m.avatarUrl,
          amountOwed: exp.amount / group.members.length,
          isCurrentUser: m.id === DEMO_USER_ID,
        })),
        creator: {
          id: exp.paidById,
          name: exp.paidByName,
        },
        logs: [
          {
            id: `log_${exp.id}_1`,
            type: 'expense_created',
            actorName: exp.paidByName,
            timestamp: exp.date,
            timeAgo: 'Few days ago',
            description: `Created "${exp.title}"`,
          },
        ],
      };
    }
  }
  return null;
}

