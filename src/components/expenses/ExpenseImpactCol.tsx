import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../../constants/theme';

export interface ExpenseImpactProps {
  amount?: number | string;
  currency?: string;
  yourShare?: number | string;
  yourImpact?: 'get' | 'owe' | 'none';
  userShareStatus?: 'lent' | 'owe' | 'no_balance' | 'not_involved';
  userShareText?: string;
  payers?: Array<any>;
  participants?: Array<any>;
  currentUserId?: string;
  expense?: any;
}

export function getCurrencySymbol(currency?: string): string {
  if (!currency) return '₹';
  if (['₹', '$', '€', '£', '¥'].includes(currency)) return currency;
  switch (currency.toUpperCase()) {
    case 'USD':
      return '$';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    case 'JPY':
      return '¥';
    case 'CAD':
      return 'CA$';
    case 'AUD':
      return 'AU$';
    case 'INR':
    default:
      return '₹';
  }
}

export function formatMoney(amount: number, currencySymbol: string): string {
  const safeNum = Math.abs(Number(amount) || 0);
  const formatted = safeNum.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currencySymbol}${formatted}`;
}

export function formatExpenseAmounts(props: ExpenseImpactProps) {
  const exp = props.expense || {};
  const rawAmount = props.amount ?? exp.amount ?? 0;
  const rawCurrency = props.currency ?? exp.currency ?? 'INR';
  const currencySymbol = getCurrencySymbol(rawCurrency);

  const totalNum = Number(rawAmount) || 0;
  const formattedTotal = `${currencySymbol}${totalNum.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const payers = props.payers ?? exp.payers;
  const participants = props.participants ?? exp.participants;
  const currentUserId = props.currentUserId;

  let net = 0;
  let status: 'lent' | 'owe' | 'no_balance' | 'not_involved' = 'not_involved';

  // 1. Direct payer/participant calculation if raw lists are available
  if (Array.isArray(payers) && Array.isArray(participants) && currentUserId) {
    const isMatchingUser = (item: any) => {
      const uid = item?.user?.uid || item?.user?.id || item?.userId || item?.id;
      return uid === currentUserId;
    };

    const isPayer = payers.some(isMatchingUser);
    const isParticipant = participants.some(isMatchingUser);

    const paid = payers
      .filter(isMatchingUser)
      .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

    const owed = participants
      .filter(isMatchingUser)
      .reduce((sum: number, p: any) => sum + (Number(p.amountOwed) || 0), 0);

    net = paid - owed;

    if (net > 0.01) {
      status = 'lent';
    } else if (net < -0.01) {
      status = 'owe';
    } else if (isPayer || isParticipant) {
      status = 'no_balance';
    } else {
      status = 'not_involved';
    }
  } else if (props.userShareStatus || exp.userShareStatus) {
    status = (props.userShareStatus || exp.userShareStatus) as any;
    net = Number(props.yourShare ?? exp.yourShare) || 0;
  } else if ((props.yourImpact ?? exp.yourImpact) === 'get') {
    const s = Number(props.yourShare ?? exp.yourShare);
    if (!isNaN(s) && s > 0.01) {
      status = 'lent';
      net = s;
    } else {
      status = 'no_balance';
    }
  } else if ((props.yourImpact ?? exp.yourImpact) === 'owe') {
    const s = Number(props.yourShare ?? exp.yourShare);
    if (!isNaN(s) && s > 0.01) {
      status = 'owe';
      net = s;
    } else {
      status = 'no_balance';
    }
  } else {
    // yourImpact === 'none' or unspecified
    const s = Number(props.yourShare ?? exp.yourShare);
    if (!isNaN(s) && s > 0.01) {
      status = 'lent';
      net = s;
    } else if (props.userShareStatus === 'no_balance' || exp.userShareStatus === 'no_balance') {
      status = 'no_balance';
    } else {
      status = 'not_involved';
    }
  }

  let shareText = '';
  let shareColor: string = THEME.colors.textMuted;

  if (props.userShareText) {
    shareText = props.userShareText;
    shareColor = status === 'lent' ? '#22C55E' : status === 'owe' ? '#EF4444' : THEME.colors.textMuted;
  } else if (status === 'lent') {
    shareText = `You lent ${formatMoney(net, currencySymbol)}`;
    shareColor = '#22C55E'; // Website Tailwind text-green-500
  } else if (status === 'owe') {
    shareText = `You owe ${formatMoney(net, currencySymbol)}`;
    shareColor = '#EF4444'; // Website Tailwind text-red-500
  } else if (status === 'no_balance') {
    shareText = 'no balance';
    shareColor = THEME.colors.textMuted;
  } else {
    shareText = 'not involved';
    shareColor = THEME.colors.textMuted;
  }

  return {
    formattedTotal,
    shareText,
    shareColor,
    status,
    currencySymbol,
  };
}

export function ExpenseImpactCol(props: ExpenseImpactProps) {
  const { formattedTotal, shareText, shareColor, status } = formatExpenseAmounts(props);

  return (
    <View style={styles.container}>
      <Text style={styles.totalAmount}>{formattedTotal}</Text>
      <Text
        style={[
          styles.shareText,
          { color: shareColor },
          (status === 'no_balance' || status === 'not_involved') && styles.mutedText,
        ]}
        numberOfLines={1}
      >
        {shareText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 85,
  },
  totalAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    textAlign: 'right',
  },
  shareText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'right',
  },
  mutedText: {
    fontWeight: '500',
    fontSize: 11,
  },
});

