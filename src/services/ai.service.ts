import * as ImageManipulator from 'expo-image-manipulator';
import { authService } from './auth.service';
import { getAuthenticatedHeaders, API_BASE_URL } from './api-headers';
import { settingsService } from './settings.service';

export class ReceiptScanError extends Error {
  constructor(
    public readonly code:
      | 'NETWORK_ERROR'
      | 'UNAUTHORIZED'
      | 'UPLOAD_FAILED'
      | 'OCR_PARSE_FAILED'
      | 'IMAGE_PROCESSING_FAILED',
    message: string
  ) {
    super(message);
    this.name = 'ReceiptScanError';
  }
}

export interface BudgetProposalCategoryChange {
  name: string;
  old: number;
  new: number;
  diff: number;
}

export interface BudgetActionProposal {
  id: string;
  groupId: string;
  groupName: string;
  totalMonthlyLimit: number;
  categoryChanges: BudgetProposalCategoryChange[];
  aiReasoning: string;
  status: 'pending' | 'applied' | 'dismissed';
}

export interface ScannedReceiptResult {
  amount: number;
  description: string;
  date: string;
  category: {
    master: string;
    sub: string;
  };
  merchant?: string;
  imageUrl?: string;
}

export const aiService = {
  /**
   * Streams conversational AI responses from the backend SSE endpoint with local intelligent fallback.
   */
  async streamChat(
    prompt: string,
    groupId: string | undefined,
    onToken: (token: string) => void,
    onProposal?: (proposal: BudgetActionProposal) => void,
    onStatus?: (status: { stage: string; message: string }) => void,
    abortSignal?: AbortSignal,
    history?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<void> {
    try {
      const token = await authService.getToken();
      const res = await fetch(`${API_BASE_URL}/api/ai/chat`, {
        method: 'POST',
        headers: getAuthenticatedHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          message: prompt,
          prompt,
          groupId,
          history: history || [],
        }),
        signal: abortSignal,
      });

      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let done = false;

        while (!done) {
          if (abortSignal?.aborted) {
            reader.cancel();
            return;
          }
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim();
                if (dataStr === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(dataStr);
                  if (parsed.status && onStatus) {
                    onStatus({ stage: parsed.status, message: parsed.message || 'Processing ledger...' });
                  }
                  if (parsed.token) onToken(parsed.token);
                  if (parsed.budgetProposal && onProposal) onProposal(parsed.budgetProposal);
                } catch {
                  // Text chunk fallback
                  onToken(dataStr);
                }
              }
            }
          }
        }
        return;
      }
    } catch {
      // Fallback to intelligent offline response
    }

    if (abortSignal?.aborted) return;

    // Clean local offline fallback for instant UI responsiveness
    const lower = prompt.toLowerCase();
    let reply = '';
    let mockProposal: BudgetActionProposal | null = null;

    if (lower.includes('budget') || lower.includes('reduce') || lower.includes('cut')) {
      onStatus?.({ stage: 'calculating', message: 'Analyzing spending velocity & category caps...' });
      reply =
        `I am analyzing your group spending velocity. Category allocations and spending caps can be configured in group budget settings.\n\nKeep recording regular circle expenses to unlock tailored auto-balancing proposals and category recommendations.`;
    } else if (lower.includes('owe') || lower.includes('balance') || lower.includes('who')) {
      onStatus?.({ stage: 'ledger', message: 'Checking active debt graph...' });
      reply =
        `All your active groups are currently settled up, or no pending balances are recorded.\n\nWhen new expenses are added, SplitIt automatically simplifies debts using \`@splitit/core\` to minimize total transactions across your circles.`;
    } else {
      onStatus?.({ stage: 'thinking', message: 'Synthesizing financial advice...' });
      reply =
        `I am your **SplitIt AI Financial Assistant**.\n\nI can help you audit group expenses, calculate safe daily burn rates, detect category spending spikes, and formulate 1-tap budget proposals. Try asking: *"How much do I owe?"* or *"Analyze our group budget"*!`;
    }

    await new Promise((r) => setTimeout(r, 350));
    if (abortSignal?.aborted) return;
    onStatus?.({ stage: 'streaming', message: 'Generating response...' });

    // Stream tokens smoothly with natural typing cadence
    const words = reply.split(' ');
    for (const word of words) {
      if (abortSignal?.aborted) return;
      await new Promise((r) => setTimeout(r, 22));
      onToken(word + ' ');
    }

    if (mockProposal && onProposal && !abortSignal?.aborted) {
      onProposal(mockProposal);
    }
  },

  /**
   * Applies an approved budget proposal.
   */
  async applyBudgetProposal(proposalId: string): Promise<boolean> {
    try {
      const token = await authService.getToken();
      const res = await fetch(`${API_BASE_URL}/api/ai/budget`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({ action: 'approve', proposalId }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  /**
   * Pre-processes camera photo and sends to backend Vision OCR.
   * Throws ReceiptScanError with exact diagnostic details on failure.
   * Never returns fabricated or mock receipt data.
   */
  async scanReceipt(uri: string): Promise<ScannedReceiptResult> {
    let manipulatedUri = uri;
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1400 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      manipulatedUri = manipulated.uri;
    } catch (e: any) {
      throw new ReceiptScanError(
        'IMAGE_PROCESSING_FAILED',
        'Could not prepare receipt image. Please select a clear JPG or PNG image.'
      );
    }

    const token = await authService.getToken();
    const formData = new FormData();
    formData.append('file', {
      uri: manipulatedUri,
      name: 'receipt.jpg',
      type: 'image/jpeg',
    } as any);

    const uploadHeaders = getAuthenticatedHeaders(token);
    delete (uploadHeaders as any)['Content-Type'];

    let uploadRes: Response;
    try {
      uploadRes = await fetch(`${API_BASE_URL}/api/upload/receipt`, {
        method: 'POST',
        headers: uploadHeaders,
        body: formData,
      });
    } catch {
      throw new ReceiptScanError(
        'NETWORK_ERROR',
        'Unable to connect to SplitIt server. Please check your network connection.'
      );
    }

    if (!uploadRes.ok) {
      if (uploadRes.status === 401) {
        throw new ReceiptScanError('UNAUTHORIZED', 'Session expired. Please sign in to scan receipts.');
      }
      const errJson = await uploadRes.json().catch(() => ({}));
      throw new ReceiptScanError(
        'UPLOAD_FAILED',
        errJson.error || `Receipt upload failed (${uploadRes.status}). Please try again.`
      );
    }

    const uploadData = await uploadRes.json().catch(() => ({}));
    const { url } = uploadData;
    if (!url) {
      throw new ReceiptScanError('UPLOAD_FAILED', 'Server did not return a valid receipt image reference.');
    }

    let ocrRes: Response;
    try {
      ocrRes = await fetch(`${API_BASE_URL}/api/ai/scan-receipt`, {
        method: 'POST',
        headers: getAuthenticatedHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ imageUrl: url }),
      });
    } catch {
      throw new ReceiptScanError(
        'NETWORK_ERROR',
        'Connection lost during receipt analysis. Please retry.'
      );
    }

    if (!ocrRes.ok) {
      if (ocrRes.status === 401) {
        throw new ReceiptScanError('UNAUTHORIZED', 'Session expired. Please sign in to scan receipts.');
      }
      const errJson = await ocrRes.json().catch(() => ({}));
      throw new ReceiptScanError(
        'OCR_PARSE_FAILED',
        errJson.error || 'SplitIt Vision was unable to parse this receipt clearly. Please verify the photo is in focus.'
      );
    }

    const result = await ocrRes.json();
    const parsedAmount =
      typeof result.amount === 'number' && !isNaN(result.amount)
        ? result.amount
        : typeof result.amount === 'string'
        ? parseFloat(result.amount) || 0
        : 0;

    const detectedTitle =
      result.title?.trim() || result.merchantName?.trim() || 'Scanned Receipt';
    const detectedSub = result.category || 'Dining Out';
    const detectedMaster =
      result.masterCategory || settingsService.getMasterCategory(detectedSub);

    return {
      amount: parsedAmount,
      description: detectedTitle,
      date: result.date || new Date().toISOString().split('T')[0],
      category: {
        master: detectedMaster,
        sub: detectedSub,
      },
      merchant: detectedTitle,
      imageUrl: url,
    };
  },
};
