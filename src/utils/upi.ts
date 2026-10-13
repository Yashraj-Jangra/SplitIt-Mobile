import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { haptics } from '../services/haptics.service';

export interface UpiPaymentParams {
  upiId: string;
  payeeName: string;
  amount: number;
  notes?: string;
}

/**
 * Builds standard UPI deep link string.
 * Format: upi://pay?pa={upiId}&pn={payeeName}&am={amount}&cu=INR&tn={notes}
 */
export function buildUpiUrl(params: UpiPaymentParams): string {
  const { upiId, payeeName, amount, notes = 'SplitIt Settlement' } = params;
  const encodedName = encodeURIComponent(payeeName.trim());
  const encodedNotes = encodeURIComponent(notes.trim());
  const formattedAmount = amount.toFixed(2);

  return `upi://pay?pa=${upiId.trim()}&pn=${encodedName}&am=${formattedAmount}&cu=INR&tn=${encodedNotes}`;
}

/**
 * Attempts to launch installed UPI payment apps via native intent.
 * Returns true if an app opened, or false if no handler is installed.
 */
export async function launchUpiPayment(params: UpiPaymentParams): Promise<boolean> {
  const url = buildUpiUrl(params);
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return true;
    }
  } catch {
    // Fall through to direct open attempt
  }

  // Fallback direct open without canOpenURL check
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copies UPI ID to device clipboard and triggers tactile haptic feedback.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    haptics.saveSuccess();
    return true;
  } catch {
    return false;
  }
}
