import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { haptics } from '../../services/haptics.service';
import {
  Plus,
  Handshake,
  UserPlus,
  Pencil,
  Wallet,
  Bot,
  Trash2,
  UserMinus,
  RotateCcw,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  History as HistoryIcon,
} from 'lucide-react-native';
import { parseComplexChange, ParsedChange } from '@splitit/core';
import { HistoryEventItem, groupService } from '../../services/group.service';
import { authService, AuthUser } from '../../services/auth.service';
import { useAuth } from '../../contexts/auth.context';
import { THEME } from '../../constants/theme';

import { ActivityTabSkeleton, ActivityRowSkeleton } from '../skeletons/GroupTabSkeleton';

interface GroupHistoryTabProps {
  groupId: string;
  history?: HistoryEventItem[];
  loading?: boolean;
  visibleCount?: number;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  onViewExpense?: (expenseId: string) => void;
  onRefresh?: () => void;
}

function formatRelativeTime(dateInput: string | Date | number): string {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'Recently';
  const now = Date.now();
  const diffMs = now - date.getTime();
  if (diffMs < 0) return 'Just now';
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function formatExactDate(dateInput: string | Date | number): string {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatExpenseDate(dateInput: any): string | null {
  if (!dateInput) return null;
  const d = dateInput.toDate && typeof dateInput.toDate === 'function'
    ? dateInput.toDate()
    : new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function renderEventIcon(event: HistoryEventItem) {
  const isAi = event.eventType === 'budget_updated' && Boolean(event.data?.aiInitiated);
  if (isAi) {
    return <Bot size={15} color={THEME.colors.ai} />;
  }

  switch (event.eventType) {
    case 'expense_created':
    case 'group_created':
      return <Plus size={15} color={THEME.colors.success} />;
    case 'settlement_created':
      return <Handshake size={15} color={THEME.colors.success} />;
    case 'member_added':
      return <UserPlus size={15} color={THEME.colors.success} />;
    case 'expense_updated':
    case 'settlement_updated':
    case 'group_updated':
      return <Pencil size={15} color={THEME.colors.info} />;
    case 'budget_updated':
      return <Wallet size={15} color={THEME.colors.success} />;
    case 'expense_deleted':
    case 'settlement_deleted':
      return <Trash2 size={15} color={THEME.colors.critical} />;
    case 'member_removed':
      return <UserMinus size={15} color={THEME.colors.critical} />;
    case 'expense_restored':
    case 'settlement_restored':
      return <RotateCcw size={15} color={THEME.colors.palette.purple} />;
    default:
      return <Clock size={15} color={THEME.colors.textSecondary} />;
  }
}

function ComplexChangeDetailRow({ change }: { change: ParsedChange }) {
  switch (change.type) {
    case 'changed':
      return (
        <View style={styles.complexChangedRow}>
          <Text style={styles.complexName}>{change.name}: </Text>
          <Text style={styles.diffFromStrikethrough}>{change.from}</Text>
          <ArrowRight size={11} color={THEME.colors.textMuted} />
          <Text style={styles.diffToGreen}>{change.to}</Text>
        </View>
      );
    case 'added':
      return (
        <View style={styles.complexActionRow}>
          <UserPlus size={12} color={THEME.colors.success} />
          <Text style={styles.addedText}>
            Added <Text style={styles.complexName}>{change.name}</Text> ({change.detail})
          </Text>
        </View>
      );
    case 'removed':
      return (
        <View style={styles.complexActionRow}>
          <UserMinus size={12} color={THEME.colors.critical} />
          <Text style={styles.removedText}>
            Removed <Text style={styles.complexName}>{change.name}</Text> ({change.detail})
          </Text>
        </View>
      );
    default:
      return (
        <View style={styles.complexActionRow}>
          <ArrowRight size={11} color={THEME.colors.textMuted} />
          <Text style={styles.unknownText}>{change.text}</Text>
        </View>
      );
  }
}

interface AccordionChangeItemProps {
  change: any;
}

const AccordionChangeItem = React.memo(function AccordionChangeItem({
  change,
}: AccordionChangeItemProps) {
  if (change.type === 'added') {
    return (
      <View style={styles.changeActionRow}>
        <Plus size={12} color={THEME.colors.success} />
        <Text style={styles.changeAddedText}>
          Added <Text style={styles.changeFieldLabel}>{change.field}:</Text>{' '}
          {change.to}
        </Text>
      </View>
    );
  }

  if (change.type === 'removed') {
    return (
      <View style={styles.changeActionRow}>
        <Trash2 size={12} color={THEME.colors.critical} />
        <Text style={styles.changeRemovedText}>
          Removed <Text style={styles.changeFieldLabel}>{change.field}:</Text>{' '}
          was {change.from}
        </Text>
      </View>
    );
  }

  const isComplex =
    (change.field === 'Payers' || change.field === 'Split') &&
    Boolean(change.from);
  const parsedChanges: ParsedChange[] = useMemo(() => {
    return isComplex ? parseComplexChange(change.from) : [];
  }, [isComplex, change.from]);

  return (
    <View style={styles.changeItemBlock}>
      <Text style={styles.changeFieldLabel}>{change.field}:</Text>
      {isComplex ? (
        <View style={styles.complexNestedBlock}>
          {parsedChanges.map((p, pIdx) => (
            <ComplexChangeDetailRow key={pIdx} change={p} />
          ))}
        </View>
      ) : change.to ? (
        <View style={styles.simpleDiffRow}>
          <Text style={styles.diffFromStrikethrough}>{change.from}</Text>
          <ArrowRight size={11} color={THEME.colors.textMuted} />
          <Text style={styles.diffToGreen}>{change.to}</Text>
        </View>
      ) : (
        <Text style={styles.simpleFromOnly}>{change.from}</Text>
      )}
    </View>
  );
});

interface HistoryEventRowProps {
  event: HistoryEventItem;
  isLast: boolean;
  isDeleted: boolean;
  isAdmin: boolean;
  isExpanded: boolean;
  isItemRestoring: boolean;
  isItemDeleting: boolean;
  onToggleAccordion: (eventId: string) => void;
  onRestore: (event: HistoryEventItem) => void;
  onDelete: (event: HistoryEventItem) => void;
  onNavigateToExpense: (expenseId: string) => void;
}

const HistoryEventRow = React.memo(function HistoryEventRow({
  event,
  isLast,
  isDeleted,
  isAdmin,
  isExpanded,
  isItemRestoring,
  isItemDeleting,
  onToggleAccordion,
  onRestore,
  onDelete,
  onNavigateToExpense,
}: HistoryEventRowProps) {
  const isAiBudget =
    event.eventType === 'budget_updated' && Boolean(event.data?.aiInitiated);

  const expenseDate =
    event.data?.date && event.eventType.startsWith('expense_')
      ? formatExpenseDate(event.data.date)
      : null;

  let viewableExpenseId: string | null = null;
  if (
    (event.eventType === 'expense_created' || event.eventType === 'expense_updated') &&
    event.data?.expenseId
  ) {
    viewableExpenseId = event.data.expenseId;
  } else if (event.eventType === 'expense_restored' && event.data?.newExpenseId) {
    viewableExpenseId = event.data.newExpenseId;
  }
  if (isDeleted) {
    viewableExpenseId = null;
  }

  const canRestore =
    (event.eventType === 'expense_deleted' || event.eventType === 'settlement_deleted') &&
    !event.restored;

  const canDelete = isAdmin;

  const isUpdateWithDetails =
    (event.eventType === 'expense_updated' ||
      event.eventType === 'group_updated' ||
      event.eventType === 'settlement_updated' ||
      event.eventType === 'budget_updated') &&
    event.data?.changes &&
    event.data.changes.length > 0;

  return (
    <View style={[styles.eventRow, !isLast && styles.eventRowBorder]}>
      {/* Main Row Content */}
      <View style={styles.mainRow}>
        {/* Left Event Icon */}
        <View style={styles.iconSlot}>{renderEventIcon(event)}</View>

        {/* Middle Text Column */}
        <View style={styles.infoCol}>
          <View style={styles.descriptionRow}>
            <Text
              style={[
                styles.eventDescriptionText,
                isDeleted && styles.strikethroughText,
              ]}
            >
              {event.description}
              {expenseDate && (
                <Text style={styles.expenseDateSuffix}> (for {expenseDate})</Text>
              )}
            </Text>

            {isAiBudget && (
              <View style={styles.aiBadgePill}>
                <Bot size={10} color={THEME.colors.aiLight} />
                <Text style={styles.aiBadgeText}>SplitIt AI</Text>
              </View>
            )}
          </View>

          {/* Timestamp Subtitle */}
          <Text style={styles.timestampText}>
            {formatRelativeTime(event.timestamp)}
            <Text style={styles.exactTimeSuffix}>
              {' '}({formatExactDate(event.timestamp)})
            </Text>
          </Text>
        </View>

        {/* Right Action Buttons */}
        <View style={styles.actionButtonsRow}>
          {/* Take There / View Expense Button */}
          {viewableExpenseId && (
            <TouchableOpacity
              style={styles.iconActionBtn}
              onPress={() => onNavigateToExpense(viewableExpenseId!)}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              activeOpacity={0.7}
            >
              <ArrowRight size={15} color={THEME.colors.textSecondary} />
            </TouchableOpacity>
          )}

          {/* Restore Button */}
          {canRestore && (
            <TouchableOpacity
              style={styles.restoreActionBtn}
              onPress={() => onRestore(event)}
              disabled={isItemRestoring}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              activeOpacity={0.7}
            >
              {isItemRestoring ? (
                <ActivityIndicator size="small" color={THEME.colors.palette.purple} />
              ) : (
                <RotateCcw size={14} color={THEME.colors.palette.purple} />
              )}
            </TouchableOpacity>
          )}

          {/* Delete Button (Strictly Admin Only) */}
          {canDelete && (
            <TouchableOpacity
              style={styles.deleteActionBtn}
              onPress={() => onDelete(event)}
              disabled={isItemDeleting}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              activeOpacity={0.7}
            >
              {isItemDeleting ? (
                <ActivityIndicator size="small" color={THEME.colors.critical} />
              ) : (
                <Trash2 size={14} color={THEME.colors.critical} />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Granular Accordion Details */}
      {isUpdateWithDetails && (
        <View style={styles.detailsContainer}>
          <TouchableOpacity
            style={styles.accordionToggleBtn}
            onPress={() => onToggleAccordion(event.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.accordionToggleText}>
              Show details ({event.data.changes.length} change
              {event.data.changes.length > 1 ? 's' : ''})
            </Text>
            {isExpanded ? (
              <ChevronUp size={12} color={THEME.colors.textSecondary} />
            ) : (
              <ChevronDown size={12} color={THEME.colors.textSecondary} />
            )}
          </TouchableOpacity>

          {isExpanded && (
            <View style={styles.accordionContent}>
              {/* Budget Unchanged Banner */}
              {event.eventType === 'budget_updated' &&
                event.data?.monthlyBudgetUnchanged && (
                  <View style={styles.budgetUnchangedBanner}>
                    <CheckCircle2 size={13} color={THEME.colors.success} />
                    <Text style={styles.budgetUnchangedBannerText}>
                      Total monthly budget was not changed (₹
                      {(event.data?.currentMonthlyLimit || 0).toLocaleString('en-IN')})
                    </Text>
                  </View>
                )}

              {/* Budget Disabled Banner */}
              {event.eventType === 'budget_updated' &&
                event.data?.newStatus === 'disabled' && (
                  <View style={styles.budgetDisabledBanner}>
                    <AlertTriangle size={13} color={THEME.colors.warning} />
                    <Text style={styles.budgetDisabledBannerText}>
                      Group budget tracking has been disabled.
                    </Text>
                  </View>
                )}

              {/* Changes List */}
              <View style={styles.changesList}>
                {event.data.changes.map((change: any, chIdx: number) => (
                  <AccordionChangeItem key={chIdx} change={change} />
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
});

export function GroupHistoryTab({
  groupId,
  history = [],
  loading = false,
  visibleCount,
  isLoadingMore = false,
  onLoadMore,
  onViewExpense,
  onRefresh,
}: GroupHistoryTabProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => user || authService.getInMemoryUser());
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (user) {
      setCurrentUser(user);
    } else {
      authService.getCachedUser().then((u) => {
        if (u) setCurrentUser(u);
      });
    }
  }, [user]);

  const isAdmin = currentUser?.role === 'admin';

  // Compute set of currently deleted expense IDs (not restored)
  const deletedExpenseIds = useMemo(() => {
    const deletedIds = new Set<string>();
    history.forEach((event) => {
      if (event.eventType === 'expense_deleted' && event.data?.expenseId && !event.restored) {
        deletedIds.add(event.data.expenseId);
      }
    });
    return deletedIds;
  }, [history]);

  const toggleAccordion = useCallback((eventId: string) => {
    haptics.tap();
    setExpandedEvents((prev) => ({
      ...prev,
      [eventId]: !prev[eventId],
    }));
  }, []);

  const handleRestore = useCallback(async (event: HistoryEventItem) => {
    try {
      setRestoringId(event.id);
      haptics.confirm();

      if (event.eventType === 'expense_deleted') {
        await groupService.restoreExpense(event.id, currentUser?.id || 'u1');
        haptics.saveSuccess();
        Alert.alert('Expense Restored', 'The expense has been successfully restored.');
      } else if (event.eventType === 'settlement_deleted') {
        await groupService.restoreSettlement(event.id, currentUser?.id || 'u1');
        haptics.saveSuccess();
        Alert.alert('Settlement Restored', 'The settlement has been successfully restored.');
      }
      onRefresh?.();
    } catch (err: any) {
      Alert.alert('Restore Failed', err.message || 'Could not restore the item.');
    } finally {
      setRestoringId(null);
    }
  }, [currentUser?.id, onRefresh]);

  const handleDelete = useCallback((event: HistoryEventItem) => {
    if (!isAdmin) {
      Alert.alert('Unauthorized', 'Only administrators can delete history audit records.');
      return;
    }

    haptics.destructive();
    Alert.alert(
      'Delete History Event?',
      'This is for admin use only. This action is permanent and will remove this event from the audit trail. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(event.id);
              await groupService.deleteHistoryEvent(event.id);
              haptics.saveSuccess();
              Alert.alert('Deleted', 'History event has been permanently deleted.');
              onRefresh?.();
            } catch (err: any) {
              Alert.alert('Delete Failed', err.message || 'Could not delete history event.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  }, [isAdmin, onRefresh]);

  const handleNavigateToExpense = useCallback((expenseId: string) => {
    haptics.tap();
    if (onViewExpense) {
      onViewExpense(expenseId);
    } else {
      router.push({
        pathname: '/expenses/[id]',
        params: { id: expenseId, groupId },
      });
    }
  }, [onViewExpense, router, groupId]);

  const visibleEvents = useMemo(
    () => history.slice(0, visibleCount ?? history.length),
    [history, visibleCount]
  );
  const hasMore = (visibleCount ?? history.length) < history.length;
  const remainingCount = Math.max(0, history.length - (visibleCount ?? history.length));

  return (
    <View style={styles.cardContainer}>
      {/* Header matching website Group History card header */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderTitleRow}>
          <HistoryIcon size={18} color={THEME.colors.success} />
          <Text style={styles.cardTitle}>Audit Logs</Text>
        </View>
        <Text style={styles.cardDescription}>
          An audit log of all activities within this group.
        </Text>
      </View>

      {/* Hairline Divided Minimal List */}
      <View style={styles.listContainer}>
        {loading && history.length === 0 ? (
          <ActivityTabSkeleton />
        ) : history.length === 0 ? (
          <View style={styles.emptyContainer}>
            <HistoryIcon size={36} color={THEME.colors.textMuted} />
            <Text style={styles.emptyTitle}>No logs recorded yet for this group.</Text>
          </View>
        ) : (
          <>
            {visibleEvents.map((event, index) => {
              const isLast = index === visibleEvents.length - 1 && !isLoadingMore && !hasMore;
              const isDeleted =
                (event.eventType === 'expense_created' || event.eventType === 'expense_updated') &&
                Boolean(event.data?.expenseId && deletedExpenseIds.has(event.data.expenseId));

              return (
                <HistoryEventRow
                  key={event.id || index}
                  event={event}
                  isLast={isLast}
                  isDeleted={isDeleted}
                  isAdmin={isAdmin}
                  isExpanded={Boolean(expandedEvents[event.id])}
                  isItemRestoring={restoringId === event.id}
                  isItemDeleting={deletingId === event.id}
                  onToggleAccordion={toggleAccordion}
                  onRestore={handleRestore}
                  onDelete={handleDelete}
                  onNavigateToExpense={handleNavigateToExpense}
                />
              );
            })}

            {isLoadingMore && (
              <View style={styles.progressiveLoaderContainer}>
                <ActivityRowSkeleton count={2} />
              </View>
            )}

            {!isLoadingMore && hasMore && onLoadMore && (
              <TouchableOpacity
                style={styles.loadMoreButton}
                onPress={onLoadMore}
                activeOpacity={0.7}
              >
                <Clock size={14} color={THEME.colors.primary} />
                <Text style={styles.loadMoreButtonText}>
                  Load older activity ({remainingCount} remaining)
                </Text>
              </TouchableOpacity>
            )}

            {!hasMore && history.length > 10 && (
              <View style={styles.endOfListFooter}>
                <Text style={styles.endOfListText}>
                  All {history.length} activity events loaded
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    overflow: 'hidden',
    marginBottom: THEME.spacing.xl,
  },
  cardHeader: {
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: THEME.spacing.lg,
    paddingBottom: THEME.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.colors.hairline,
    gap: 3,
  },
  cardHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  cardTitle: {
    fontSize: THEME.typography.size.subtitle,
    fontWeight: THEME.typography.weight.bold,
    color: THEME.colors.text,
    letterSpacing: -0.2,
  },
  cardDescription: {
    fontSize: THEME.typography.size.caption,
    color: THEME.colors.textSecondary,
  },
  listContainer: {
    paddingVertical: 2,
  },
  emptyContainer: {
    paddingVertical: 36,
    paddingHorizontal: THEME.spacing.xl,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  eventRow: {
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: 13,
  },
  eventRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.colors.hairline,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
  },
  iconSlot: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: {
    flex: 1,
    gap: 3,
  },
  descriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  eventDescriptionText: {
    fontSize: 13,
    fontWeight: THEME.typography.weight.semibold,
    color: THEME.colors.text,
    lineHeight: 18,
  },
  strikethroughText: {
    textDecorationLine: 'line-through',
    color: THEME.colors.textMuted,
  },
  expenseDateSuffix: {
    fontSize: 11,
    fontWeight: THEME.typography.weight.normal,
    color: THEME.colors.textSecondary,
  },
  aiBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.aiMuted,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    borderWidth: 1,
    borderRadius: THEME.radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  aiBadgeText: {
    fontSize: 9,
    fontWeight: THEME.typography.weight.bold,
    color: THEME.colors.aiLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timestampText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  exactTimeSuffix: {
    color: THEME.colors.textMuted,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconActionBtn: {
    width: 30,
    height: 30,
    borderRadius: THEME.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.skeleton.surface,
  },
  restoreActionBtn: {
    width: 30,
    height: 30,
    borderRadius: THEME.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.aiMuted,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.25)',
  },
  deleteActionBtn: {
    width: 30,
    height: 30,
    borderRadius: THEME.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.dangerMuted,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
  },
  detailsContainer: {
    marginTop: 6,
    paddingLeft: 36,
  },
  accordionToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
  },
  accordionToggleText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  accordionContent: {
    marginTop: 6,
    gap: 8,
  },
  budgetUnchangedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.successMuted,
    borderWidth: 1,
    borderColor: THEME.colors.successBorder,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: THEME.radius.sm,
  },
  budgetUnchangedBannerText: {
    fontSize: 11,
    fontWeight: THEME.typography.weight.semibold,
    color: THEME.colors.success,
    flex: 1,
  },
  budgetDisabledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.warningMuted,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: THEME.radius.sm,
  },
  budgetDisabledBannerText: {
    fontSize: 11,
    fontWeight: THEME.typography.weight.medium,
    color: THEME.colors.warning,
    flex: 1,
  },
  changesList: {
    gap: 6,
  },
  changeActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  changeAddedText: {
    fontSize: 11,
    color: THEME.colors.success,
  },
  changeRemovedText: {
    fontSize: 11,
    color: THEME.colors.critical,
  },
  changeItemBlock: {
    gap: 3,
  },
  changeFieldLabel: {
    fontSize: 11,
    fontWeight: THEME.typography.weight.bold,
    color: THEME.colors.text,
  },
  simpleDiffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  diffFromStrikethrough: {
    fontSize: 11,
    color: THEME.colors.critical,
    textDecorationLine: 'line-through',
  },
  diffToGreen: {
    fontSize: 11,
    fontWeight: THEME.typography.weight.bold,
    color: THEME.colors.success,
  },
  simpleFromOnly: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  complexNestedBlock: {
    borderLeftWidth: 2,
    borderLeftColor: THEME.colors.hairlineLight,
    paddingLeft: 8,
    marginLeft: 2,
    gap: 4,
    marginTop: 2,
  },
  complexChangedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  complexName: {
    fontSize: 11,
    fontWeight: THEME.typography.weight.semibold,
    color: THEME.colors.textSecondary,
  },
  complexActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addedText: {
    fontSize: 11,
    color: THEME.colors.success,
  },
  removedText: {
    fontSize: 11,
    color: THEME.colors.critical,
  },
  unknownText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  progressiveLoaderContainer: {
    paddingVertical: 10,
  },
  endOfListFooter: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endOfListText: {
    fontSize: 11,
    fontWeight: THEME.typography.weight.semibold,
    color: THEME.colors.textMuted,
    letterSpacing: 0.3,
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginVertical: 10,
    marginHorizontal: 12,
    borderRadius: THEME.radius.lg,
    backgroundColor: THEME.colors.skeleton.surface,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  loadMoreButtonText: {
    fontSize: 12,
    fontWeight: THEME.typography.weight.semibold,
    color: THEME.colors.primary,
  },
});
