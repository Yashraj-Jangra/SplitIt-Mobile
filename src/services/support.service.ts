import { authService, API_BASE_URL } from './auth.service';
import { getActiveCurrencySymbol } from '../contexts/currency.context';

export type TicketCategory = 'general' | 'bug' | 'feature' | 'billing' | 'account';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface TicketMessage {
  message: string;
  sentAt: string;
  sentBy: {
    uid: string;
    firstName?: string;
    name?: string;
    email?: string;
  };
}

export interface SupportTicketItem {
  id: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: TicketCategory;
}

const FAQS: FaqItem[] = [
  {
    id: 'faq-1',
    category: 'general',
    question: 'How does mathematical debt simplification work?',
    answer:
      'SplitIt uses graph simplification algorithms to eliminate circular and redundant debts. For example, if Ananya owes Rohit ₹500 and Rohit owes Aman ₹500, SplitIt simplifies this so Ananya settles directly with Aman in one single payment.',
  },
  {
    id: 'faq-2',
    category: 'billing',
    question: 'Can I settle directly via PhonePe, Google Pay, or Paytm?',
    answer:
      'Yes! SplitIt generates certified NPCI-compliant UPI QR codes and deep links. When you tap "Pay via UPI", SplitIt opens your installed UPI banking apps (Google Pay, PhonePe, Paytm, BHIM) with pre-filled recipient VPA and exact amount.',
  },
  {
    id: 'faq-3',
    category: 'feature',
    question: 'How do group monthly budgets and flexible pools work?',
    answer:
      'Group admins can define an overall monthly limit and allocate specific caps to categories like Food, Travel, or Lodging. Any unallocated amount becomes the "flexible pool", automatically accommodating unexpected shared expenses.',
  },
  {
    id: 'faq-4',
    category: 'account',
    question: 'Can I export group expense reports as CSV or PDF?',
    answer:
      'Yes. Go to any group, tap the settings gear icon in the top right, and select "Export CSV". You will receive a clean tabular ledger of all expenses, dates, payers, and participant splits.',
  },
  {
    id: 'faq-5',
    category: 'billing',
    question: 'Are there any hidden fees or transaction cuts on settlements?',
    answer:
      'SplitIt is 100% free and peer-to-peer. All settlements execute directly over the UPI network between your bank accounts without intermediate wallet holding or platform fees.',
  },
];

let _cachedTickets: SupportTicketItem[] = [];

export const supportService = {
  /**
   * Synchronous accessor for in-memory cached tickets (prevents screen blanking).
   */
  getInMemoryTickets(): SupportTicketItem[] {
    return _cachedTickets;
  },

  /**
   * Fetch curated frequently asked questions
   */
  getFaqs(): FaqItem[] {
    const sym = getActiveCurrencySymbol();
    return FAQS.map((faq) => {
      if (faq.id === 'faq-1') {
        return {
          ...faq,
          answer: `SplitIt uses graph simplification algorithms to eliminate circular and redundant debts. For example, if Ananya owes Rohit ${sym}500 and Rohit owes Aman ${sym}500, SplitIt simplifies this so Ananya settles directly with Aman in one single payment.`,
        };
      }
      return faq;
    });
  },

  /**
   * Fetch all support tickets for the current authenticated user
   */
  async getTickets(): Promise<SupportTicketItem[]> {
    try {
      const token = await authService.getToken();
      if (token) {
        const res = await fetch(`${API_BASE_URL}/api/support`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Cookie: `better-auth.session_token=${token}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            _cachedTickets = data;
            return data;
          }
        }
      }
    } catch {
      // Offline fallback to demo tickets
    }

    if (_cachedTickets.length > 0) return _cachedTickets;

    // High quality offline demo tickets
    _cachedTickets = [
      {
        id: 'SP-104',
        subject: 'UPI QR Scanner Verification',
        category: 'billing',
        status: 'resolved',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
        messages: [
          {
            message: 'Is my high-contrast UPI QR code valid for PhonePe and Google Pay?',
            sentAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
            sentBy: { uid: 'u1', firstName: 'You', email: 'user@splitit.app' },
          },
          {
            message:
              'Yes! SplitIt generates universal NPCI-compliant UPI QR codes compatible with all certified banking apps in India.',
            sentAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
            sentBy: { uid: 'admin_1', firstName: 'SplitIt Support', email: 'support@splitit.app' },
          },
        ],
      },
      {
        id: 'SP-108',
        subject: 'Exporting Group CSV Reports',
        category: 'feature',
        status: 'open',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
        messages: [
          {
            message: 'Would love an option to export our group expenses summary as a CSV file.',
            sentAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
            sentBy: { uid: 'u1', firstName: 'You', email: 'user@splitit.app' },
          },
        ],
      },
    ];

    return _cachedTickets;
  },

  /**
   * Fetch single ticket by ID
   */
  async getTicketById(ticketId: string): Promise<SupportTicketItem | null> {
    const list = await this.getTickets();
    return list.find((t) => t.id === ticketId) || null;
  },

  /**
   * Submit a new support ticket
   */
  async createTicket(
    subject: string,
    category: TicketCategory,
    message: string
  ): Promise<{ success: boolean; ticketId?: string }> {
    let createdId = `SP-${Math.floor(100 + Math.random() * 900)}`;

    try {
      const token = await authService.getToken();
      if (token) {
        const res = await fetch(`${API_BASE_URL}/api/support/ticket`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            Cookie: `better-auth.session_token=${token}`,
          },
          body: JSON.stringify({ subject, category, message }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.ticketId) {
            createdId = json.ticketId;
          }
        }
      }
    } catch {
      // Offline fallback
    }

    // Optimistic cache update
    const newTicket: SupportTicketItem = {
      id: createdId,
      subject,
      category,
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [
        {
          message,
          sentAt: new Date().toISOString(),
          sentBy: { uid: 'u1', firstName: 'You', email: 'user@splitit.app' },
        },
      ],
    };

    _cachedTickets = [newTicket, ..._cachedTickets.filter((t) => t.id !== createdId)];
    return { success: true, ticketId: createdId };
  },

  /**
   * Post a reply to an existing support ticket
   */
  async replyToTicket(ticketId: string, replyMessage: string): Promise<boolean> {
    try {
      const token = await authService.getToken();
      if (token) {
        await fetch(`${API_BASE_URL}/api/support/reply`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            Cookie: `better-auth.session_token=${token}`,
          },
          body: JSON.stringify({ ticketId, replyMessage }),
        });
      }
    } catch {
      // Offline fallback
    }

    // Optimistic cache update
    _cachedTickets = _cachedTickets.map((t) => {
      if (t.id === ticketId) {
        return {
          ...t,
          updatedAt: new Date().toISOString(),
          messages: [
            ...t.messages,
            {
              message: replyMessage,
              sentAt: new Date().toISOString(),
              sentBy: { uid: 'u1', firstName: 'You', email: 'user@splitit.app' },
            },
          ],
        };
      }
      return t;
    });

    return true;
  },

  /**
   * Mark ticket as resolved
   */
  async resolveTicket(ticketId: string): Promise<boolean> {
    _cachedTickets = _cachedTickets.map((t) =>
      t.id === ticketId ? { ...t, status: 'resolved' as TicketStatus, updatedAt: new Date().toISOString() } : t
    );
    return true;
  },

  /**
   * Reopen a closed or resolved ticket
   */
  async reopenTicket(ticketId: string): Promise<boolean> {
    _cachedTickets = _cachedTickets.map((t) =>
      t.id === ticketId ? { ...t, status: 'open' as TicketStatus, updatedAt: new Date().toISOString() } : t
    );
    return true;
  },

  clearCache(): void {
    _cachedTickets = [];
  },
};
