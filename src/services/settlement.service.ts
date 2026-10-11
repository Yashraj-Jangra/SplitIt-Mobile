import { authService, API_BASE_URL } from './auth.service';

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

export const settlementService = {
  async recordSettlement(params: RecordSettlementParams): Promise<{ success: boolean; error?: string }> {
    try {
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
          amount: params.amount,
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
          return { success: true };
        }
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.error || 'Failed to record settlement' };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error while recording settlement' };
    }

    return { success: true };
  },
};
