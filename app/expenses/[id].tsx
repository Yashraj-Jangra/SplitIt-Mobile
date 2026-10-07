import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  Camera,
  Trash2,
  Pencil,
  Utensils,
  Car,
  ShoppingBag,
  Coffee,
  Sparkles,
  Home,
  Plane,
  Heart,
  Send,
  Check,
  X,
  User,
  Users,
  ChevronDown,
  Calendar,
  Clock,
  ArrowRight,
  UserPlus,
  UserMinus,
  MessageSquare,
  FileText,
  ImageIcon,
  AlertCircle,
  RefreshCw,
  RotateCcw,
  Plus,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { THEME } from '../../src/constants/theme';
import { expenseService, ExpenseDetailModel, ExpenseHistoryLog } from '../../src/services/expense.service';
import { groupService } from '../../src/services/group.service';
import { authService } from '../../src/services/auth.service';
import { settingsService } from '../../src/services/settings.service';
import { CategoryIcon } from '../../src/utils/category-icons';
import {
  MasterCategory,
  areParticipantsValid,
  formatParticipantOwedText,
  formatPayerText,
} from '@splitit/core';
import * as Haptics from 'expo-haptics';
import { useNetwork } from '../../src/contexts/network.context';
import { SplitBreakdownSkeleton } from '../../src/components/skeletons/SplitBreakdownSkeleton';

export default function ExpenseDetailScreen() {
  const router = useRouter();
  const { isOnline, requireOnline } = useNetwork();
  const params = useLocalSearchParams<{
    id: string;
    groupId?: string;
    title?: string;
    amount?: string;
    paidByName?: string;
    date?: string;
    category?: string;
  }>();

  const expenseId = Array.isArray(params.id) ? params.id[0] : params.id;
  const rawGroupId = Array.isArray(params.groupId) ? params.groupId[0] : (params.groupId || '');
  const [groupId, setGroupId] = useState(rawGroupId);
  const inMem = expenseService.getInMemoryExpenseDetails(expenseId);
  const [hasSplitLoaded, setHasSplitLoaded] = useState(() => areParticipantsValid(inMem?.participants));
  const [loadError, setLoadError] = useState<string | null>(null);

  const [expense, setExpense] = useState<ExpenseDetailModel | null>(() => {
    if (inMem) return inMem;
    if (params.title && params.amount) {
      const parsedAmt = parseFloat(params.amount) || 0;
      return {
        id: expenseId,
        groupId: rawGroupId,
        groupName: 'Group Expense',
        title: params.title,
        amount: parsedAmt,
        currency: 'INR',
        date: params.date || 'Today',
        rawDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        category: {
          master: settingsService.getMasterCategory(params.category || 'Other'),
          sub: params.category || 'Other',
        },
        splitType: 'equally',
        paidById: 'payer',
        paidByName: params.paidByName || 'Member',
        payers: [
          {
            userId: 'payer',
            name: params.paidByName || 'Member',
            amount: parsedAmt,
          },
        ],
        participants: [], // No bogus 100% owe participant! Avoid flashing "You owe full amount"
        creator: {
          id: 'creator',
          name: params.paidByName || 'Member',
        },
        logs: [],
      };
    }
    return null;
  });

  const [loading, setLoading] = useState(!inMem && !params.title);
  const [commentInput, setCommentInput] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);

  // Categories State
  const [categories, setCategories] = useState<Record<string, MasterCategory>>(() =>
    settingsService.getCachedExpenseCategories()
  );

  // Group Members & Auth User
  const [groupMembers, setGroupMembers] = useState<Array<{ id: string; name: string; avatarUrl?: string }>>([]);
  const [currentUserId, setCurrentUserId] = useState('u1');

  // Receipt Modal State
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  const fetchExpense = async () => {
    try {
      setLoadError(null);
      const data = await expenseService.getExpenseDetails(expenseId, groupId || undefined);
      if (!data) {
        if (!expense && !params.title) {
          setLoadError('Expense could not be found or loaded.');
        }
        return;
      }
      setExpense(data);
      if (areParticipantsValid(data.participants)) {
        setHasSplitLoaded(true);
      }
      const targetGId = data.groupId || groupId;
      if (targetGId) {
        if (!groupId) setGroupId(targetGId);
        groupService
          .getGroupDetails(targetGId)
          .then((g) => {
            if (g?.members) setGroupMembers(g.members);
          })
          .catch(() => {});
      }
    } catch (err: any) {
      if (!expense && !params.title) {
        setLoadError(err?.message || 'Failed to load expense details.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    authService.getCachedUser().then((u) => {
      if (u?.id) setCurrentUserId(u.id);
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    settingsService.getExpenseCategories().then((cats) => {
      if (mounted) setCategories(cats);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    // 0ms Fast Tick: Hydrate offline split record immediately
    expenseService.getCachedExpenseDetails(expenseId).then((cached) => {
      if (cached) {
        setExpense(cached);
        if (areParticipantsValid(cached.participants)) {
          setHasSplitLoaded(true);
        }
        setLoading(false);
      }
    });
    fetchExpense();
  }, [expenseId, groupId]);

  useFocusEffect(
    useCallback(() => {
      fetchExpense();
    }, [expenseId, groupId])
  );

  const handleDelete = () => {
    if (!requireOnline('delete an expense')) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Delete Expense',
      `Are you sure you want to delete "${expense?.title || params.title || 'this expense'}"? All group balances will be recalculated.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            const amt = expense?.amount || parseFloat(params.amount || '0') || 0;
            const targetGroupId = expense?.groupId || groupId;
            await expenseService.deleteExpense(expenseId, targetGroupId, amt);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          },
        },
      ]
    );
  };

  const handleOpenEdit = () => {
    if (!requireOnline('edit this expense')) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/expenses/new',
      params: {
        expenseId,
        groupId: expense?.groupId || groupId,
      },
    });
  };

  const handleSendComment = async () => {
    if (!requireOnline('post comments')) return;
    const text = commentInput.trim();
    if (!text || isSendingComment) return;

    setIsSendingComment(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const newLog = await expenseService.addExpenseComment(expenseId, text);
    setExpense((prev) => (prev ? { ...prev, logs: [...prev.logs, newLog] } : prev));
    setCommentInput('');
    setIsSendingComment(false);

    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 200);
  };

  const handleReceiptAction = async () => {
    Haptics.selectionAsync();
    if (expense?.receiptImageUrl) {
      setIsReceiptModalOpen(true);
    } else {
      Alert.alert(
        'Attach Receipt',
        'Upload a receipt photo for this expense',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Choose from Gallery',
            onPress: async () => {
              const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.8,
              });
              if (!res.canceled && res.assets?.[0]?.uri) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setExpense((prev) => (prev ? { ...prev, receiptImageUrl: res.assets[0].uri } : prev));
                Alert.alert('Receipt Attached', 'Receipt image has been saved to this expense.');
              }
            },
          },
        ]
      );
    }
  };



  if (loading && !expense) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.colors.primary} />
      </SafeAreaView>
    );
  }

  if (!loading && !expense && loadError) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.headerBand}>
          <View style={styles.headerNav}>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                router.back();
              }}
              style={styles.navButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowLeft size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.errorStateContainer}>
          <AlertCircle size={44} color={THEME.colors.negative} />
          <Text style={styles.errorTitle}>Unable to Load Expense</Text>
          <Text style={styles.errorMessage}>{loadError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setLoading(true);
              fetchExpense();
            }}
          >
            <RefreshCw size={15} color="#09090B" style={{ marginRight: 8 }} />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const title = expense?.title || params.title || 'Dinner';
  const amount = expense?.amount || parseFloat(params.amount || '450') || 450;
  const currencySymbol = '₹';
  const primaryPayerName =
    expense?.paidByName && expense.paidByName !== 'undefined'
      ? expense.paidByName
      : params.paidByName && params.paidByName !== 'undefined'
      ? params.paidByName
      : 'Member';
  const creatorName =
    expense?.creator?.name && expense.creator.name !== 'undefined'
      ? expense.creator.name
      : primaryPayerName;
  const dateFormatted = expense?.date || params.date || 'Today';
  const participants = expense?.participants || [];
  const logs = expense?.logs || [];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Top Banner & Header Bar */}
      <View style={styles.headerBand}>
        <View style={styles.headerNav}>
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              router.back();
            }}
            style={styles.navButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleReceiptAction} style={styles.navButton}>
              <Camera size={21} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleDelete} style={styles.navButton}>
              <Trash2 size={21} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleOpenEdit} style={styles.navButton}>
              <Pencil size={21} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Circular Category Badge Overlapping Seam */}
        <View style={styles.categoryBadgeOuter}>
          <View style={styles.categoryBadgeInner}>
            <CategoryIcon
              subCategory={expense?.category?.sub}
              masterCategory={expense?.category?.master}
              size={26}
              color="#09090B"
            />
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Expense Information */}
          <View style={styles.heroSection}>
            <Text style={styles.heroTitle}>{title}</Text>
            <Text style={styles.heroAmount}>
              {currencySymbol}{amount.toFixed(2)}
            </Text>
            <Text style={styles.heroSubtitle}>
              Added by {creatorName} on {dateFormatted}
            </Text>

            <View style={styles.categoryPillRow}>
              <View style={styles.categoryBadgePill}>
                <CategoryIcon
                  subCategory={expense?.category?.sub}
                  masterCategory={expense?.category?.master}
                  size={12}
                  color={THEME.colors.primaryLight}
                />
                <Text style={styles.categoryBadgePillText}>
                  {expense?.category?.sub || 'Other'}
                  {expense?.category?.master && expense?.category?.master !== 'Uncategorized' && expense?.category?.master !== expense?.category?.sub
                    ? ` • ${expense?.category?.master}`
                    : ''}
                </Text>
              </View>
            </View>

            {expense?.notes ? (
              <View style={styles.notesBox}>
                <FileText size={13} color={THEME.colors.textMuted} />
                <Text style={styles.notesText}>{expense.notes}</Text>
              </View>
            ) : null}
          </View>

          {/* Connected Payer & Split Tree */}
          <View style={styles.splitTreeCard}>
            {/* Payer Root Row */}
            {expense?.payers && expense.payers.length > 1 ? (
              <View style={styles.multiPayersBlock}>
                <View style={styles.multiPayersHeader}>
                  <Users size={13} color={THEME.colors.primary} />
                  <Text style={styles.multiPayersHeaderText}>
                    Paid by {expense.payers.length} people
                  </Text>
                </View>
                {expense.payers.map((p, idx) => (
                  <View key={p.userId || idx} style={styles.payerRow}>
                    <View style={styles.payerAvatar}>
                      {p.avatarUrl ? (
                        <Image source={{ uri: p.avatarUrl }} style={styles.avatarImg} />
                      ) : (
                        <Text style={styles.avatarInitial}>{(p.name || 'M').charAt(0)}</Text>
                      )}
                    </View>
                    <Text style={styles.payerLabel}>
                      {formatPayerText(p.name, p.amount, currencySymbol)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.payerRow}>
                <View style={styles.payerAvatar}>
                  {expense?.paidByAvatar ? (
                    <Image source={{ uri: expense.paidByAvatar }} style={styles.avatarImg} />
                  ) : (
                    <Text style={styles.avatarInitial}>{primaryPayerName.charAt(0)}</Text>
                  )}
                </View>
                <Text style={styles.payerLabel}>
                  {formatPayerText(primaryPayerName, amount, currencySymbol)}
                </Text>
              </View>
            )}

            {/* Tree Branch Container */}
            {!hasSplitLoaded || !areParticipantsValid(participants) ? (
              <View style={styles.splitSkeletonBlock}>
                <View style={styles.splitLoadingNotice}>
                  <ActivityIndicator size="small" color={THEME.colors.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.splitLoadingNoticeText}>Loading split...</Text>
                </View>
                <SplitBreakdownSkeleton count={3} />
              </View>
            ) : (
              <View style={styles.treeBranchesWrapper}>
                {participants.map((p, index) => {
                  const isLast = index === participants.length - 1;
                  const owedText = formatParticipantOwedText(p, currencySymbol, groupMembers, currentUserId);

                  return (
                    <View key={p.userId || index} style={styles.treeBranchRow}>
                      {/* Visual Branch Line Connector */}
                      <View style={styles.branchVisual}>
                        <View style={[styles.branchVerticalLine, isLast && styles.branchVerticalHalf]} />
                        <View style={styles.branchHorizontalLine} />
                      </View>

                      {/* Participant Debt Text */}
                      <View style={styles.branchContent}>
                        <Text
                          style={[
                            styles.branchText,
                            (p.isCurrentUser || p.userId === currentUserId) && styles.branchTextSelf,
                          ]}
                        >
                          {owedText}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* History Audit Logs Section - Matching Website Minimal Hairline Style */}
          <View style={styles.logsSection}>
            <View style={styles.historySectionDivider} />
            <Text style={styles.logsSectionHeader}>History</Text>

            <View style={styles.logsList}>
              {logs.map((log, index) => {
                const isLast = index === logs.length - 1;
                const isCreated = log.type === 'expense_created';
                const isComment = log.type === 'comment';
                const isDeleted = log.type === 'expense_deleted';
                const isRestored = log.type === 'expense_restored';

                return (
                  <View key={log.id || index} style={[styles.logRow, !isLast && styles.logRowBorder]}>
                    <View style={styles.logHeaderRow}>
                      <View style={styles.logBadgeContainer}>
                        {isCreated && (
                          <View style={[styles.logTypePill, styles.pillCreated]}>
                            <Plus size={11} color="#10B981" />
                            <Text style={[styles.logTypePillText, { color: '#10B981' }]}>Created</Text>
                          </View>
                        )}
                        {isComment && (
                          <View style={[styles.logTypePill, styles.pillComment]}>
                            <MessageSquare size={11} color="#60A5FA" />
                            <Text style={[styles.logTypePillText, { color: '#60A5FA' }]}>Comment</Text>
                          </View>
                        )}
                        {isDeleted && (
                          <View style={[styles.logTypePill, styles.pillDeleted]}>
                            <Trash2 size={11} color="#EF4444" />
                            <Text style={[styles.logTypePillText, { color: '#EF4444' }]}>Deleted</Text>
                          </View>
                        )}
                        {isRestored && (
                          <View style={[styles.logTypePill, styles.pillRestored]}>
                            <RotateCcw size={11} color="#A855F7" />
                            <Text style={[styles.logTypePillText, { color: '#A855F7' }]}>Restored</Text>
                          </View>
                        )}
                        {!isCreated && !isComment && !isDeleted && !isRestored && (
                          <View style={[styles.logTypePill, styles.pillUpdated]}>
                            <Pencil size={11} color="#3B82F6" />
                            <Text style={[styles.logTypePillText, { color: '#3B82F6' }]}>Updated</Text>
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

                    {/* Parsed Granular Changes */}
                    {log.changes && log.changes.length > 0 ? (
                      <View style={styles.changesList}>
                        {log.changes.map((ch, chIdx) => (
                          <View key={chIdx} style={styles.changeItemRow}>
                            <Text style={styles.changeFieldLabel}>{ch.field}:</Text>
                            {ch.type === 'changed' ? (
                              <View style={styles.changeDiffRow}>
                                <Text style={styles.changeFrom}>{ch.from}</Text>
                                <ArrowRight size={11} color={THEME.colors.textMuted} />
                                <Text style={styles.changeTo}>{ch.to}</Text>
                              </View>
                            ) : ch.type === 'added' ? (
                              <View style={styles.changeActionRow}>
                                <UserPlus size={11} color="#10B981" />
                                <Text style={styles.changeAddedText}>
                                  Added {ch.detail}
                                </Text>
                              </View>
                            ) : ch.type === 'removed' ? (
                              <View style={styles.changeActionRow}>
                                <UserMinus size={11} color="#EF4444" />
                                <Text style={styles.changeRemovedText}>
                                  Removed {ch.detail}
                                </Text>
                              </View>
                            ) : (
                              <Text style={styles.changeGeneric}>{ch.from}</Text>
                            )}
                          </View>
                        ))}
                      </View>
                    ) : log.description && !isComment ? (
                      <Text style={styles.logDescriptionText}>{log.description}</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Bottom Docked "Add a comment" Bar */}
        <View style={styles.bottomCommentDock}>
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
            >
              {isSendingComment ? (
                <ActivityIndicator size="small" color="#10B981" />
              ) : (
                <Send size={18} color={commentInput.trim() ? '#10B981' : THEME.colors.textMuted} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>



      {/* Receipt Viewer Modal */}
      <Modal
        visible={isReceiptModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setIsReceiptModalOpen(false)}
      >
        <View style={styles.receiptViewerBackdrop}>
          <SafeAreaView style={styles.receiptViewerSafeArea}>
            <View style={styles.receiptViewerHeader}>
              <Text style={styles.receiptViewerTitle}>Attached Receipt</Text>
              <TouchableOpacity
                onPress={() => setIsReceiptModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <X size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.receiptImageContainer}>
              {expense?.receiptImageUrl ? (
                <Image
                  source={{ uri: expense.receiptImageUrl }}
                  style={styles.fullReceiptImage}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.noReceiptText}>No receipt image available.</Text>
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121214',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#121214',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexOne: {
    flex: 1,
  },

  // Top Accent Header Band
  headerBand: {
    backgroundColor: '#26332C', // Sage-tinted dark header band matching reference
    paddingTop: 8,
    paddingBottom: 28,
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 44,
  },
  navButton: {
    padding: 6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },

  // Overlapping Category Badge
  categoryBadgeOuter: {
    position: 'absolute',
    bottom: -28,
    left: 24,
    zIndex: 10,
  },
  categoryBadgeInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#121214',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
  },

  // Scroll Content
  scrollContent: {
    paddingTop: 36,
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 20,
  },

  // Hero Section
  heroSection: {
    paddingTop: 4,
    gap: 4,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9CA3AF',
    marginTop: 2,
  },
  categoryPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  categoryBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  categoryBadgePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D1D5DB',
  },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: THEME.radius.md,
    marginTop: 8,
  },
  notesText: {
    flex: 1,
    fontSize: 12,
    color: '#D1D5DB',
    lineHeight: 17,
  },

  // Connected Payer & Split Tree Structure
  splitTreeCard: {
    marginTop: 6,
  },
  multiPayersBlock: {
    gap: 8,
  },
  multiPayersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 4,
  },
  multiPayersHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  payerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  payerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#27272A',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  payerLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F9FAFB',
    letterSpacing: -0.2,
  },

  // Tree Branches
  treeBranchesWrapper: {
    marginLeft: 21, // Centers branch vertical line precisely below avatar center
    paddingTop: 2,
  },
  treeBranchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 38,
  },
  branchVisual: {
    width: 20,
    height: 38,
    position: 'relative',
    justifyContent: 'center',
  },
  branchVerticalLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  branchVerticalHalf: {
    bottom: '50%', // Terminates at horizontal branch for the last participant
  },
  branchHorizontalLine: {
    position: 'absolute',
    left: 0,
    width: 16,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  branchContent: {
    paddingLeft: 10,
    flex: 1,
  },
  branchText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  branchTextSelf: {
    color: '#E5E7EB',
    fontWeight: '700',
  },
  splitSkeletonBlock: {
    paddingVertical: 10,
    paddingLeft: 6,
  },
  splitLoadingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingLeft: 4,
  },
  splitLoadingNoticeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#71717A',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  errorStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
  },
  errorMessage: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: THEME.radius.md,
    marginTop: 8,
  },
  retryButtonText: {
    color: '#09090B',
    fontWeight: '700',
    fontSize: 13,
  },

  // Activity & Audit Logs Section
  logsSection: {
    marginTop: 18,
    gap: 4,
  },
  historySectionDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 6,
  },
  logsSectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 2,
  },
  logsList: {
    gap: 0,
  },
  logRow: {
    paddingVertical: 12,
    gap: 5,
  },
  logRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  logHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.full,
  },
  pillCreated: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  pillUpdated: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  pillComment: {
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
  },
  pillDeleted: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  pillRestored: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
  },
  logTypePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  logTimeText: {
    fontSize: 11,
    color: '#6B7280',
  },
  logActorLine: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  logActorName: {
    fontWeight: '700',
    color: '#E5E7EB',
  },
  logDescriptionText: {
    fontSize: 12,
    color: '#D1D5DB',
  },
  commentBubble: {
    backgroundColor: 'rgba(96, 165, 250, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: '#60A5FA',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 2,
  },
  commentBodyText: {
    fontSize: 13,
    color: '#F3F4F6',
    lineHeight: 18,
  },
  changesList: {
    gap: 4,
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  changeItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  changeFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E5E7EB',
  },
  changeDiffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  changeFrom: {
    fontSize: 11,
    color: '#EF4444',
    textDecorationLine: 'line-through',
  },
  changeTo: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '700',
  },
  changeActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  changeAddedText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
  },
  changeRemovedText: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '600',
  },
  changeGeneric: {
    fontSize: 11,
    color: '#9CA3AF',
  },

  // Bottom Floating "Add a comment" Bar
  bottomCommentDock: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#121214',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C20',
    borderRadius: THEME.radius.full,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  commentTextInput: {
    flex: 1,
    height: 40,
    fontSize: 14,
    color: '#FFFFFF',
  },
  sendButton: {
    padding: 6,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },

  // Edit Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#18181B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 16,
  },
  modalInputGroup: {
    gap: 6,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 1.1,
  },
  modalRowGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalSelectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#27272A',
    borderRadius: THEME.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalSelectTriggerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
    flex: 1,
    marginRight: 4,
  },
  modalInput: {
    backgroundColor: '#27272A',
    borderRadius: THEME.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalInputMulti: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  categoryPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: THEME.radius.full,
    backgroundColor: '#27272A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  catPillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  catPillTextActive: {
    color: '#10B981',
    fontWeight: '700',
  },
  catMasterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  catMasterPillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
  },
  catMasterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  catMasterPillTextActive: {
    color: '#10B981',
    fontWeight: '700',
  },
  modalSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: THEME.radius.md,
    marginTop: 10,
  },
  modalSaveButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#09090B',
  },

  // Receipt Viewer Modal
  receiptViewerBackdrop: {
    flex: 1,
    backgroundColor: '#000000',
  },
  receiptViewerSafeArea: {
    flex: 1,
  },
  receiptViewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  receiptViewerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  receiptImageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  fullReceiptImage: {
    width: '100%',
    height: '100%',
  },
  noReceiptText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});
