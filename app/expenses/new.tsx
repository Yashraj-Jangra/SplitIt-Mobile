import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, Check, Camera, Sparkles } from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { calculateSplitAmounts, classifyExpense, defaultExpenseCategories } from '@splitit/core';
import * as Haptics from 'expo-haptics';

export default function NewExpenseModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ amount?: string; description?: string; category?: string }>();

  const [amount, setAmount] = useState(params.amount || '1200');
  const [description, setDescription] = useState(params.description || 'Dinner at Social');
  const [splitMode, setSplitMode] = useState<'equally' | 'unequally' | 'shares' | 'percentage'>('equally');

  useEffect(() => {
    if (params.amount) setAmount(params.amount);
    if (params.description) setDescription(params.description);
  }, [params.amount, params.description]);

  const participants = [
    { id: 'u1', name: 'You' },
    { id: 'u2', name: 'Rohit' },
    { id: 'u3', name: 'Priya' },
  ];

  // Live split calculation via @splitit/core
  const numAmount = parseFloat(amount) || 0;
  const coreSplitType = splitMode === 'shares' ? 'by_shares' : splitMode === 'percentage' ? 'by_percentage' : splitMode;
  const splitResults = calculateSplitAmounts(
    numAmount,
    participants.map((p) => ({ userId: p.id, selected: true })),
    coreSplitType
  );
  const splitAmounts: Record<string, number> = Object.fromEntries(
    splitResults.map((r) => [r.userId, r.amountOwed])
  );

  // Real-time local category classification via @splitit/core
  const predictedCategory = classifyExpense(description, defaultExpenseCategories);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Modal Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          style={styles.closeButton}
        >
          <X size={20} color={THEME.colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Expense</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/ai/scanner');
            }}
            style={styles.scanButton}
          >
            <Camera size={16} color={THEME.colors.primary} />
            <Text style={styles.scanButtonText}>Scan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            }}
            style={styles.saveButton}
          >
            <Check size={20} color="#09090B" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Hero Amount Input */}
        <View style={styles.amountContainer}>
          <Text style={styles.currencySymbol}>₹</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={THEME.colors.textMuted}
          />
        </View>

        {/* Description Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>DESCRIPTION</Text>
          <TextInput
            style={styles.textInput}
            value={description}
            onChangeText={setDescription}
            placeholder="What was this expense for?"
            placeholderTextColor={THEME.colors.textMuted}
          />
        </View>

        {/* AI Suggested Category Pill */}
        <View style={styles.aiPill}>
          <Sparkles size={14} color={THEME.colors.aiLight} />
          <Text style={styles.aiPillText}>
            Suggested: <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{predictedCategory.sub}</Text> ({predictedCategory.master})
          </Text>
        </View>

        {/* Split Mode Selector */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>SPLIT METHOD</Text>
          <View style={styles.modeRow}>
            {(['equally', 'unequally', 'shares', 'percentage'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.modeButton, splitMode === mode && styles.modeButtonActive]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSplitMode(mode);
                }}
              >
                <Text style={[styles.modeText, splitMode === mode && styles.modeTextActive]}>
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Live Calculation Preview via @splitit/core */}
        <View style={styles.splitPreviewCard}>
          <Text style={styles.previewTitle}>SPLIT BREAKDOWN (@splitit/core)</Text>
          {participants.map((p) => {
            const share = splitAmounts[p.id] || 0;
            return (
              <View key={p.id} style={styles.participantRow}>
                <Text style={styles.participantName}>{p.name}</Text>
                <Text style={styles.participantShare}>₹{share.toFixed(2)}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  closeButton: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  scanButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  saveButton: {
    backgroundColor: THEME.colors.primary,
    padding: 6,
    borderRadius: THEME.radius.sm,
  },
  content: {
    padding: 20,
    gap: 18,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  currencySymbol: {
    fontSize: 36,
    fontWeight: '900',
    color: THEME.colors.primary,
    marginRight: 4,
  },
  amountInput: {
    fontSize: 48,
    fontWeight: '900',
    color: THEME.colors.text,
    minWidth: 120,
    textAlign: 'center',
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: THEME.colors.textMuted,
  },
  textInput: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: THEME.colors.text,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  aiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: THEME.radius.sm,
  },
  aiPillText: {
    fontSize: 12,
    color: THEME.colors.aiLight,
  },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surface,
    padding: 3,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: THEME.radius.sm,
  },
  modeButtonActive: {
    backgroundColor: THEME.colors.surfaceElevated,
  },
  modeText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  modeTextActive: {
    color: THEME.colors.text,
  },
  splitPreviewCard: {
    backgroundColor: THEME.colors.surface,
    padding: 16,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: 10,
  },
  previewTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: THEME.colors.textMuted,
    marginBottom: 4,
  },
  participantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  participantName: {
    fontSize: 14,
    color: THEME.colors.text,
    fontWeight: '600',
  },
  participantShare: {
    fontSize: 14,
    color: THEME.colors.primary,
    fontWeight: '800',
  },
});
