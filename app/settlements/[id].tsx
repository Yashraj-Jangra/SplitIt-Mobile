import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  type ScrollViewInstance,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { QuantumSpinner } from '../../src/components/brand/QuantumLogo';
import { KeyboardStickyBottomBar } from '../../src/components/common/KeyboardStickyBottomBar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  Trash2,
  ArrowRight,
  Send,
  Plus,
  MessageSquare,
  RotateCcw,
  Pencil,
  CheckCircle2,
  Wallet,
  ShieldCheck,
} from 'lucide-react-native';
import { THEME } from '../../src/constants/theme';
import { settlementService, SettlementDetailModel } from '../../src/services/settlement.service';
import { EditSettlementModal } from '../../src/components/settlements/EditSettlementModal';
import { authService } from '../../src/services/auth.service';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { haptics } from '../../src/services/haptics.service';
import { useNetwork } from '../../src/contexts/network.context';
import { useAuth } from '../../src/contexts/auth.context';
import { useCurrency, getActiveCurrencySymbol } from '../../src/contexts/currency.context';
import { useAppTheme } from '../../src/contexts/theme.context';

export default function SettlementDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { requireOnline } = useNetwork();
  const { user } = useAuth();
  const { currencySymbol } = useCurrency();
  const { currentAccent } = useAppTheme();
  const params = useLocalSearchParams<{
    id: string;
    groupId?: string;
    amount?: string;
    payerName?: string;
    payeeName?: string;
    payerId?: string;
    payeeId?: string;
    date?: string;
    method?: string;
    notes?: string;
  }>();

  const settlementId = Array.isArray(params.id) ? params.id[0] : params.id;
  const rawGroupId = Array.isArray(params.groupId) ? params.groupId[0] : (params.groupId || '');
  const [groupId, setGroupId] = useState(rawGroupId);
  const [showEditModal, setShowEditModal] = useState(false);

  const [settlement, setSettlement] = useState<SettlementDetailModel | null>(() => {
    const inMem = settlementService.getInMemorySettlementDetails(settlementId);
    if (inMem) return inMem;
    const parsedAmt = Math.round((parseFloat(params.amount || '0') || 0) * 100) / 100;
    return {
      id: settlementId,
      groupId: rawGroupId,
      groupName: 'Settlement',
      amount: parsedAmt,
      currency: 'INR',
      date: params.date || 'Today',
      rawDate: new Date().toISOString(),
      method: params.method || 'cash',
      notes: params.notes || undefined,
      payer: {
        id: params.payerId || 'payer',
        name: params.payerName || 'Member',
      },
      payee: {
        id: params.payeeId || 'payee',
        name: params.payeeName || 'Member',
      },
      recordedBy: {
        id: params.payerId || 'payer',
        name: params.payerName || 'Member',
      },
      logs: [
        {
          id: `init_${settlementId}`,
          type: 'settlement_created',
          actorName: params.payerName || 'Member',
          timestamp: params.date || 'Today',
          timeAgo: 'Recorded',
          description: `Settlement recorded: ${params.payerName || 'Member'} paid ${params.payeeName || 'Member'} ${getActiveCurrencySymbol()}${parsedAmt.toFixed(2)}.`,
        },
      ],
    };
  });

  const [cachedUserId, setCachedUserId] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);
  const scrollViewRef = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    if (!user?.id) {
      authService.getCachedUser().then((u) => {
        if (u?.id) setCachedUserId(u.id);
      });
    }
  }, [user?.id]);

  const currentUserId = user?.id || cachedUserId || 'u1';

  const fetchSettlement = useCallback(async () => {
    try {
      const data = await settlementService.getSettlementDetails(settlementId, groupId || undefined);
      if (data) {
        setSettlement(data);
        if (data.groupId && !groupId) {
          setGroupId(data.groupId);
        }
      }
    } catch {
      // Handled gracefully
    }
  }, [settlementId, groupId]);

  useEffect(() => {
    let active = true;
    settlementService.getCachedSettlementDetails(settlementId).then((cached) => {
      if (!active) return;
      if (cached) {
        setSettlement(cached);
      }
      fetchSettlement();
    });
    return () => {
      active = false;
    };
  }, [settlementId, fetchSettlement]);

  useFocusEffect(
    useCallback(() => {
      fetchSettlement();
    }, [fetchSettlement])
  );

  const handleDelete = () => {
    if (!requireOnline('delete a settlement')) return;
    haptics.warning();
    Alert.alert(
      'Delete Settlement',
      'Are you sure you want to delete this settlement? All group balances will be recalculated.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const targetGroupId = settlement?.groupId || groupId;
            const res = await settlementService.deleteSettlement(settlementId, targetGroupId);
            if (res.success) {
              haptics.destructive();
              router.back();
            } else {
              haptics.error();
              Alert.alert('Error', res.error || 'Failed to delete settlement.');
            }
          },
        },
      ]
    );
  };

  const handleSendComment = async () => {
    if (!requireOnline('post comments')) return;
    const text = commentInput.trim();
    if (!text || isSendingComment) return;

    setIsSendingComment(true);
    haptics.confirm();

    const newLog = await settlementService.addSettlementComment(settlementId, text);
    setSettlement((prev) => (prev ? { ...prev, logs: [...prev.logs, newLog] } : prev));
    setCommentInput('');
    setIsSendingComment(false);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 200);
  };

  const rawAmount = Math.round((settlement?.amount || parseFloat(params.amount || '0') || 0) * 100) / 100;
  const amountStr = rawAmount.toFixed(2);
  const [whole, decimal] = amountStr.split('.');
  const amountParts = { whole: Number(whole).toLocaleString('en-IN'), decimal };

  const isPayerViewer = settlement?.payer?.id === currentUserId || settlement?.payer?.name === 'You';
  const isPayeeViewer = settlement?.payee?.id === currentUserId || settlement?.payee?.name === 'You';

  const viewerName = useMemo(() => {
    if (user?.name && user.name !== 'You' && user.name !== 'undefined') {
      return user.name;
    }
    return 'You';
  }, [user?.name]);

  const payerDisplayName = isPayerViewer
    ? (settlement?.payer?.name && settlement.payer.name !== 'You'
        ? settlement.payer.name
        : (viewerName !== 'You' ? viewerName : 'You'))
    : settlement?.payer?.name || params.payerName || 'Member';

  const payeeDisplayName = isPayeeViewer
    ? (settlement?.payee?.name && settlement.payee.name !== 'You'
        ? settlement.payee.name
        : (viewerName !== 'You' ? viewerName : 'You'))
    : settlement?.payee?.name || params.payeeName || 'Member';

  const logs = settlement?.logs || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── 1. PINNED FIXED NAVIGATION BAR ── */}
      <View style={styles.pinnedHeader}>
        <TouchableOpacity
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          style={styles.frostedIconButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={20} color={THEME.colors.text} />
        </TouchableOpacity>

        <View style={styles.navGroupBadge}>
          <Text style={styles.navGroupText} numberOfLines={1}>
            {settlement?.groupName || 'Settlement Details'}
          </Text>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            onPress={() => {
              haptics.tap();
              setShowEditModal(true);
            }}
            style={styles.frostedIconButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Edit settlement"
          >
            <Pencil size={18} color={THEME.colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDelete}
            style={styles.frostedIconButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Delete settlement"
          >
            <Trash2 size={18} color={THEME.colors.critical} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 2. SCROLLABLE CONTENT BODY ── */}
      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Ambient Glow Canvas */}
          <View style={styles.heroSection}>
            <View style={styles.heroGlowCanvas} pointerEvents="none">
              <Svg width="100%" height={160}>
                <Defs>
                  <RadialGradient id="settlementDetailGlow" cx="50%" cy="30%" r="70%">
                    <Stop offset="0%" stopColor={THEME.colors.palette.emerald} stopOpacity="0.22" />
                    <Stop offset="50%" stopColor={THEME.colors.palette.emerald} stopOpacity="0.06" />
                    <Stop offset="100%" stopColor={THEME.colors.background} stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Rect width="100%" height={160} fill="url(#settlementDetailGlow)" />
              </Svg>
            </View>

            {/* ── Transfer Visual: Avatars & Center Arrow (Perfect Center Alignment) ── */}
            <View style={styles.transferVisualContainer}>
              <View style={styles.transferAvatarsRow}>
                {/* Payer Avatar (Left) */}
                <View style={styles.avatarColumn}>
                  <View style={styles.avatarCircle}>
                    {settlement?.payer?.avatarUrl ? (
                      <Image source={{ uri: settlement.payer.avatarUrl }} style={styles.avatarImg} />
                    ) : (
                      <Text style={styles.avatarInitial}>
                        {(payerDisplayName || 'M').charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Big Sleek Center Arrow (Locked to vertical & horizontal center of avatars) */}
                <View style={styles.bigArrowContainer}>
                  <ArrowRight size={24} color={THEME.colors.palette.emerald} strokeWidth={2.4} />
                </View>

                {/* Receiver Avatar (Right) */}
                <View style={styles.avatarColumn}>
                  <View style={styles.avatarCircle}>
                    {settlement?.payee?.avatarUrl ? (
                      <Image source={{ uri: settlement.payee.avatarUrl }} style={styles.avatarImg} />
                    ) : (
                      <Text style={styles.avatarInitial}>
                        {(payeeDisplayName || 'M').charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              {/* Names and Role Subtext Row (Symmetrically positioned under respective avatars) */}
              <View style={styles.transferNamesRow}>
                <View style={styles.partyNameCol}>
                  <View style={styles.partyNameWrap}>
                    <Text style={styles.partyNameText} numberOfLines={1}>
                      {payerDisplayName}
                    </Text>
                    {isPayerViewer && (
                      <View style={styles.youPill}>
                        <Text style={styles.youPillText}>YOU</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.partyRoleSubtext}>Payer</Text>
                </View>

                {/* Spacer mirroring the center arrow width */}
                <View style={styles.arrowSpacer} />

                <View style={styles.partyNameCol}>
                  <View style={styles.partyNameWrap}>
                    <Text style={styles.partyNameText} numberOfLines={1}>
                      {payeeDisplayName}
                    </Text>
                    {isPayeeViewer && (
                      <View style={styles.youPill}>
                        <Text style={styles.youPillText}>YOU</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.partyRoleSubtext}>Recipient</Text>
                </View>
              </View>
            </View>

            {/* High-Impact Centered Amount Display */}
            <View style={styles.heroAmountBlock}>
              <View style={styles.heroAmountRow}>
                <Text style={[styles.heroCurrencySymbol, { color: THEME.colors.palette.emerald }]}>{currencySymbol}</Text>
                <Text style={styles.heroAmountWhole}>{amountParts.whole}</Text>
                <Text style={styles.heroAmountDecimal}>.{amountParts.decimal}</Text>
              </View>

              <View style={styles.statusPill}>
                <CheckCircle2 size={12} color={THEME.colors.palette.emerald} />
                <Text style={styles.statusPillText}>Payment Settled</Text>
                <Text style={styles.statusPillDot}>•</Text>
                <Text style={styles.statusPillDate}>{settlement?.date || params.date || 'Today'}</Text>
              </View>
            </View>

            {/* Editorial Quote Notes */}
            {settlement?.notes ? (
              <View style={[styles.editorialNotesBlock, { borderLeftColor: THEME.colors.palette.emerald }]}>
                <Text style={styles.editorialNotesText}>{`"${settlement.notes}"`}</Text>
              </View>
            ) : null}
          </View>

          {/* ── 3. Settlement Details Section (Clean No-Div Hairline Grid) ── */}
          <View style={styles.detailsSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>SETTLEMENT DETAILS</Text>
            </View>

            <View style={styles.detailsList}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Payment Method</Text>
                <View style={styles.detailValueRow}>
                  <Wallet size={13} color={THEME.colors.palette.emerald} style={{ marginRight: 5 }} />
                  <Text style={styles.detailValueText}>
                    {settlement?.method?.toUpperCase() || (params.method || 'CASH').toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Date Recorded</Text>
                <Text style={styles.detailValueText}>{settlement?.date || params.date || 'Today'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Group</Text>
                <Text style={styles.detailValueText}>{settlement?.groupName || 'Settlement'}</Text>
              </View>

              <View style={[styles.detailRow, styles.detailRowLast]}>
                <Text style={styles.detailLabel}>Status</Text>
                <View style={styles.detailValueRow}>
                  <ShieldCheck size={13} color={currentAccent.primary} style={{ marginRight: 5 }} />
                  <Text style={[styles.detailValueText, { color: currentAccent.primary }]}>Recorded & Verified</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ── 4. Activity & Audit Logs Section ── */}
          <View style={styles.historySection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>ACTIVITY & AUDIT LOGS</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>
                  {logs.length} {logs.length === 1 ? 'event' : 'events'}
                </Text>
              </View>
            </View>

            <View style={styles.logsList}>
              {logs.map((log, index) => {
                const isLast = index === logs.length - 1;
                const isCreated = log.type === 'expense_created' || log.type === 'settlement_created';
                const isComment = log.type === 'comment';
                const isDeleted = log.type === 'settlement_deleted';
                const isRestored = log.type === 'settlement_restored';

                return (
                  <View key={log.id || index} style={[styles.logRow, !isLast && styles.logRowBorder]}>
                    <View style={styles.logHeaderRow}>
                      <View style={styles.logBadgeContainer}>
                        {isCreated && (
                          <View style={[styles.logTypePill, styles.pillCreated]}>
                            <Plus size={10} color={THEME.colors.success} />
                            <Text style={[styles.logTypePillText, { color: THEME.colors.success }]}>Created</Text>
                          </View>
                        )}
                        {isComment && (
                          <View style={[styles.logTypePill, styles.pillComment]}>
                            <MessageSquare size={10} color={THEME.colors.infoLight} />
                            <Text style={[styles.logTypePillText, { color: THEME.colors.infoLight }]}>Comment</Text>
                          </View>
                        )}
                        {isDeleted && (
                          <View style={[styles.logTypePill, styles.pillDeleted]}>
                            <Trash2 size={10} color={THEME.colors.critical} />
                            <Text style={[styles.logTypePillText, { color: THEME.colors.critical }]}>Deleted</Text>
                          </View>
                        )}
                        {isRestored && (
                          <View style={[styles.logTypePill, styles.pillRestored]}>
                            <RotateCcw size={10} color={THEME.colors.notification.announcement} />
                            <Text style={[styles.logTypePillText, { color: THEME.colors.notification.announcement }]}>Restored</Text>
                          </View>
                        )}
                        {!isCreated && !isComment && !isDeleted && !isRestored && (
                          <View style={[styles.logTypePill, styles.pillUpdated]}>
                            <Pencil size={10} color={THEME.colors.info} />
                            <Text style={[styles.logTypePillText, { color: THEME.colors.info }]}>Updated</Text>
                          </View>
                        )}
                      </View>

                      <Text style={styles.logTimeText}>{log.timestamp || log.timeAgo}</Text>
                    </View>

                    <Text style={styles.logActorLine}>
                      by <Text style={styles.logActorName}>{log.actorName}</Text>
                    </Text>

                    {/* Comment Body */}
                    {isComment && log.commentText ? (
                      <View style={styles.commentBubble}>
                        <Text style={styles.commentBodyText}>{log.commentText}</Text>
                      </View>
                    ) : null}

                    {log.description && !isComment ? (
                      <Text style={styles.logDescriptionText}>{log.description}</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Bottom Docked Comment Bar */}
        <KeyboardStickyBottomBar
          insideKeyboardAvoidingView
          bordered
          idlePaddingBottom={10}
          keyboardPaddingBottom={8}
          style={styles.bottomCommentDock}
        >
          <View style={styles.commentInputContainer}>
            <TextInput
              style={styles.commentTextInput}
              placeholder="Add a comment..."
              placeholderTextColor={THEME.colors.textMuted}
              value={commentInput}
              onChangeText={setCommentInput}
              onSubmitEditing={handleSendComment}
              returnKeyType="send"
            />
            <TouchableOpacity
              onPress={handleSendComment}
              disabled={isSendingComment || !commentInput.trim()}
              style={[
                styles.sendButton,
                (!commentInput.trim() || isSendingComment) && styles.sendButtonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Send comment"
            >
              {isSendingComment ? (
                <QuantumSpinner size={16} color={THEME.colors.success} />
              ) : (
                <Send size={16} color={commentInput.trim() ? THEME.colors.success : THEME.colors.textMuted} />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardStickyBottomBar>
      </KeyboardAvoidingView>

      <EditSettlementModal
        visible={showEditModal}
        settlement={settlement}
        onClose={() => setShowEditModal(false)}
        onSuccess={(updated) => {
          setSettlement((prev) => (prev ? { ...prev, ...updated } : null));
          fetchSettlement();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  flexOne: {
    flex: 1,
  },
  pinnedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: THEME.colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    zIndex: 10,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  frostedIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navGroupBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  navGroupText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    letterSpacing: -0.2,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroSection: {
    position: 'relative',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
  },
  heroGlowCanvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 160,
  },
  transferVisualContainer: {
    width: '100%',
    paddingVertical: 10,
    alignItems: 'center',
  },
  transferAvatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  avatarColumn: {
    flex: 1,
    alignItems: 'center',
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  bigArrowContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  transferNamesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 8,
  },
  partyNameCol: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  arrowSpacer: {
    width: 44,
    marginHorizontal: 12,
  },
  partyNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
    maxWidth: '100%',
  },
  partyNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.text,
    letterSpacing: -0.2,
  },
  partyViewerText: {
    fontWeight: '700',
  },
  youPill: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  youPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: THEME.colors.palette.emerald,
    letterSpacing: 0.3,
  },
  partyRoleSubtext: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  heroAmountBlock: {
    alignItems: 'center',
    marginTop: 14,
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heroCurrencySymbol: {
    fontSize: 24,
    fontWeight: '700',
    marginRight: 4,
  },
  heroAmountWhole: {
    fontSize: 38,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.8,
  },
  heroAmountDecimal: {
    fontSize: 22,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.palette.emerald,
    marginLeft: 5,
  },
  statusPillDot: {
    fontSize: 10,
    color: THEME.colors.palette.emerald,
    marginHorizontal: 5,
    opacity: 0.6,
  },
  statusPillDate: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  editorialNotesBlock: {
    marginTop: 16,
    borderLeftWidth: 2,
    paddingLeft: 12,
    paddingVertical: 4,
    maxWidth: '90%',
  },
  editorialNotesText: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    fontStyle: 'italic',
  },
  detailsSection: {
    marginTop: 10,
    paddingHorizontal: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  detailsList: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  detailValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailValueText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  historySection: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  countBadgeText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },
  logsList: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  logRow: {
    paddingVertical: 12,
  },
  logRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  logHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  logBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  pillCreated: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  pillComment: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  pillDeleted: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  pillRestored: {
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
  },
  pillUpdated: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  logTypePillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  logTimeText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  logActorLine: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginBottom: 4,
  },
  logActorName: {
    color: THEME.colors.text,
    fontWeight: '600',
  },
  commentBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  commentBodyText: {
    fontSize: 13,
    color: THEME.colors.text,
    lineHeight: 18,
  },
  logDescriptionText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    lineHeight: 16,
  },
  bottomCommentDock: {
    paddingHorizontal: 16,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  commentTextInput: {
    flex: 1,
    fontSize: 14,
    color: THEME.colors.text,
    paddingVertical: 4,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
