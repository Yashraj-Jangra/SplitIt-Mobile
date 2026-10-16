import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { X, Banknote, Smartphone, Landmark, Check } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { QuantumSpinner } from '../brand/QuantumLogo';
import { SettlementDetailModel, settlementService } from '../../services/settlement.service';
import { useCurrency } from '../../contexts/currency.context';
import { haptics } from '../../services/haptics.service';

interface EditSettlementModalProps {
  visible: boolean;
  settlement: SettlementDetailModel | null;
  onClose: () => void;
  onSuccess: (updated: { amount: number; method: string; notes?: string }) => void;
}

const PAYMENT_METHODS: Array<{ id: 'cash' | 'upi' | 'bank_transfer'; label: string; icon: any }> = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'upi', label: 'UPI', icon: Smartphone },
  { id: 'bank_transfer', label: 'Bank', icon: Landmark },
];

export const EditSettlementModal: React.FC<EditSettlementModalProps> = ({
  visible,
  settlement,
  onClose,
  onSuccess,
}) => {
  const { currencySymbol } = useCurrency();

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'upi' | 'bank_transfer'>('cash');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settlement && visible) {
      setAmount(settlement.amount ? String(settlement.amount) : '');
      const rawMethod = (settlement.method || 'cash').toLowerCase();
      if (rawMethod === 'upi') setMethod('upi');
      else if (rawMethod === 'bank_transfer' || rawMethod === 'bank') setMethod('bank_transfer');
      else setMethod('cash');
      setNotes(settlement.notes || '');
      setError(null);
    }
  }, [settlement, visible]);

  const handleSave = async () => {
    if (!settlement) return;
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      haptics.error();
      setError('Please enter a valid amount greater than 0');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      haptics.tap();

      const result = await settlementService.updateSettlement(settlement.id, {
        groupId: settlement.groupId,
        amount: parsedAmount,
        method,
        notes: notes.trim() || undefined,
        date: settlement.rawDate || new Date().toISOString(),
      });

      if (result.success) {
        haptics.settleSuccess();
        onSuccess({
          amount: parsedAmount,
          method,
          notes: notes.trim() || undefined,
        });
        onClose();
      } else {
        haptics.error();
        setError(result.error || 'Failed to update settlement');
      }
    } catch (err: any) {
      haptics.error();
      setError(err?.message || 'Network error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.avoidingWrap}
          >
            <View style={styles.modalCard}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Edit Settlement</Text>
                  <Text style={styles.modalSubtitle}>Update amount or payment details</Text>
                </View>

                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => {
                    haptics.tap();
                    onClose();
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={18} color={THEME.colors.textMuted} />
                </TouchableOpacity>
              </View>

              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Amount Input */}
              <View style={styles.amountContainer}>
                <Text style={styles.currencyPrefix}>{currencySymbol}</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={(val) => {
                    setError(null);
                    setAmount(val);
                  }}
                  placeholder="0.00"
                  placeholderTextColor={THEME.colors.textMuted}
                  keyboardType="decimal-pad"
                  autoFocus
                  maxLength={10}
                />
              </View>

              {/* Payment Method Selector */}
              <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>PAYMENT METHOD</Text>
                <View style={styles.methodRow}>
                  {PAYMENT_METHODS.map((item) => {
                    const isSelected = method === item.id;
                    const IconComp = item.icon;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.methodPill,
                          isSelected && styles.methodPillActive,
                        ]}
                        onPress={() => {
                          haptics.tick();
                          setMethod(item.id);
                        }}
                      >
                        <IconComp
                          size={15}
                          color={isSelected ? THEME.colors.primaryForeground : THEME.colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.methodPillText,
                            isSelected && styles.methodPillTextActive,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Notes Input */}
              <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>NOTE (OPTIONAL)</Text>
                <TextInput
                  style={styles.notesInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Reference number, note, etc."
                  placeholderTextColor={THEME.colors.textMuted}
                  maxLength={100}
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    haptics.tap();
                    onClose();
                  }}
                  disabled={submitting}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveBtn, submitting && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={submitting}
                >
                  {submitting ? (
                    <QuantumSpinner size={18} color={THEME.colors.primaryForeground} />
                  ) : (
                    <>
                      <Check size={16} color={THEME.colors.primaryForeground} strokeWidth={2.5} />
                      <Text style={styles.saveBtnText}>Save Changes</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  avoidingWrap: {
    width: '100%',
    maxWidth: 400,
  },
  modalCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    padding: 22,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    gap: 18,
    shadowColor: THEME.colors.palette.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  modalSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    backgroundColor: THEME.colors.dangerMuted,
    borderRadius: THEME.radius.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: THEME.colors.danger,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.danger,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  currencyPrefix: {
    fontSize: 26,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    marginRight: 6,
  },
  amountInput: {
    fontSize: 34,
    fontWeight: '900',
    color: THEME.colors.text,
    letterSpacing: -0.5,
    minWidth: 100,
  },
  fieldSection: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  methodPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  methodPillActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  methodPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textMuted,
  },
  methodPillTextActive: {
    color: THEME.colors.primaryForeground,
  },
  notesInput: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: THEME.colors.text,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surfaceElevated,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textMuted,
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.primary,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.primaryForeground,
  },
});
