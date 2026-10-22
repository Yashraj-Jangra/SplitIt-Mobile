import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Handshake, ArrowRight } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { useAppTheme } from '../../contexts/theme.context';
import { useCurrency } from '../../contexts/currency.context';

export interface ActivitySettlementItemData {
  id: string;
  payerName?: string;
  payeeName?: string;
  payerId?: string;
  payeeId?: string;
  amount: number | string;
  date: string;
  method?: string;
  notes?: string;
  groupName?: string;
  groupId?: string;
}

export interface ActivitySettlementRowProps {
  settlement: ActivitySettlementItemData;
  currentUserId?: string;
  isLast?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export const ActivitySettlementRow = React.memo(function ActivitySettlementRow({
  settlement,
  currentUserId,
  isLast = false,
  onPress,
  style,
}: ActivitySettlementRowProps) {
  const { currentAccent } = useAppTheme();
  const { formatCurrency } = useCurrency();

  const isPayerViewer =
    Boolean(currentUserId && settlement.payerId === currentUserId) ||
    settlement.payerName === 'You';
  const isPayeeViewer =
    Boolean(currentUserId && settlement.payeeId === currentUserId) ||
    settlement.payeeName === 'You';

  const payerText = isPayerViewer ? 'You' : settlement.payerName || 'Member';
  const payeeText = isPayeeViewer ? 'You' : settlement.payeeName || 'Member';

  return (
    <TouchableOpacity
      style={[styles.row, !isLast && styles.rowBorder, style]}
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Settlement from ${payerText} to ${payeeText}`}
    >
      {/* Theme-based Handshake Glyph Node */}
      <View
        style={[
          styles.glyphNode,
          {
            backgroundColor: currentAccent.primaryMuted,
            borderColor: currentAccent.borderFocus,
          },
        ]}
      >
        <Handshake size={19} color={currentAccent.primary} />
      </View>

      {/* Center Details: Payer ➔ Payee, Subtitle, Date */}
      <View style={styles.centerCol}>
        <View style={styles.transferRow}>
          <Text
            style={[styles.partyName, isPayerViewer && styles.viewerHighlight]}
            numberOfLines={1}
          >
            {payerText}
          </Text>
          <ArrowRight
            size={12}
            color={THEME.colors.textMuted}
            style={styles.arrowIcon}
          />
          <Text
            style={[styles.partyName, isPayeeViewer && styles.viewerHighlight]}
            numberOfLines={1}
          >
            {payeeText}
          </Text>
        </View>

        <Text style={styles.itemSubtitle} numberOfLines={1}>
          Settlement{settlement.groupName ? ` • ${settlement.groupName}` : ''}
        </Text>
        <Text style={styles.itemDate}>{settlement.date}</Text>
      </View>

      {/* Right Column: Accent Amount & Settled Status */}
      <View style={styles.amountCol}>
        <Text style={[styles.amountText, { color: currentAccent.primary }]}>
          {formatCurrency(Number(settlement.amount || 0), { decimals: 2 })}
        </Text>
        <Text style={[styles.statusText, { color: currentAccent.primary }]}>
          Settled
        </Text>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.colors.hairline,
  },
  glyphNode: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  centerCol: {
    flex: 1,
    gap: 2,
    marginRight: 10,
  },
  transferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  partyName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: THEME.colors.text,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  viewerHighlight: {
    fontWeight: '800',
  },
  arrowIcon: {
    alignSelf: 'center',
  },
  itemSubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
  },
  itemDate: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  amountCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
  },
  amountText: {
    fontSize: 15.5,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
