import React, { useState, useEffect, useRef } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  Calendar,
  Clock,
  ArrowRight,
  UserPlus,
  UserMinus,
  MessageSquare,
  FileText,
  ImageIcon,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { THEME } from '../../src/constants/theme';
import { expenseService, ExpenseDetailModel, ExpenseHistoryLog } from '../../src/services/expense.service';
import * as Haptics from 'expo-haptics';

export default function ExpenseDetailScreen() {
  const router = useRouter();
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

  const [expense, setExpense] = useState<ExpenseDetailModel | null>(() => {
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
          master: params.category || 'General',
          sub: params.category || 'General',
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
        participants: [
          {
            userId: 'participant',
            name: 'You',
            amountOwed: parsedAmt,
            isCurrentUser: true,
          },
        ],
        creator: {
          id: 'creator',
          name: params.paidByName || 'Member',
        },
        logs: [],
      };
    }
    return null;
  });

  const [loading, setLoading] = useState(!params.title);
  const [commentInput, setCommentInput] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(params.title || '');
  const [editAmount, setEditAmount] = useState(params.amount || '');
  const [editCategory, setEditCategory] = useState(params.category || 'General');
  const [editNotes, setEditNotes] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Receipt Modal State
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  const fetchExpense = async () => {
    try {
      const data = await expenseService.getExpenseDetails(expenseId, groupId || undefined);
      setExpense(data);
      if (data.groupId && !groupId) {
        setGroupId(data.groupId);
      }
      setEditTitle(data.title);
      setEditAmount(String(data.amount));
      setEditCategory(data.category.sub || data.category.master || 'General');
      setEditNotes(data.notes || '');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpense();
  }, [expenseId, groupId]);

  const handleDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Delete Expense',
      `Are you sure you want to delete "${expense?.title || params.title || 'this expense'}"? All group balances will be recalculated.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (expense) {
      setEditTitle(expense.title);
      setEditAmount(String(expense.amount));
      setEditCategory(expense.category.sub || 'Dining Out');
      setEditNotes(expense.notes || '');
    }
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim() || !editAmount.trim() || isSavingEdit) return;
    const newAmt = parseFloat(editAmount);
    if (isNaN(newAmt) || newAmt <= 0) return;

    setIsSavingEdit(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const oldAmt = expense?.amount || newAmt;
    const targetGroupId = expense?.groupId || groupId;
    const res = await expenseService.updateExpense(expenseId, {
      groupId: targetGroupId,
      amount: newAmt,
      oldAmount: oldAmt,
      description: editTitle.trim(),
      category: editCategory,
      notes: editNotes.trim(),
    });

    setIsSavingEdit(false);
    if (res.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsEditModalOpen(false);
      fetchExpense();
    } else {
      Alert.alert('Update Failed', res.error || 'Could not update expense.');
    }
  };

  const handleSendComment = async () => {
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

  const renderCategoryIcon = (categoryName: string, size = 26, color = '#09090B') => {
    const lower = categoryName.toLowerCase();
    if (lower.includes('dinner') || lower.includes('food') || lower.includes('lunch') || lower.includes('drink')) {
      return <Utensils size={size} color={color} />;
    }
    if (lower.includes('car') || lower.includes('taxi') || lower.includes('cab') || lower.includes('uber')) {
      return <Car size={size} color={color} />;
    }
    if (lower.includes('coffee') || lower.includes('cafe')) {
      return <Coffee size={size} color={color} />;
    }
    if (lower.includes('flight') || lower.includes('plane') || lower.includes('travel')) {
      return <Plane size={size} color={color} />;
    }
    if (lower.includes('home') || lower.includes('rent')) {
      return <Home size={size} color={color} />;
    }
    if (lower.includes('shopping') || lower.includes('groceries')) {
      return <ShoppingBag size={size} color={color} />;
    }
    return <Utensils size={size} color={color} />;
  };

  if (loading && !expense) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.colors.primary} />
      </SafeAreaView>
    );
  }

  const title = expense?.title || params.title || 'Dinner';
  const amount = expense?.amount || parseFloat(params.amount || '450') || 450;
  const currencySymbol = '₹';
  const creatorName = expense?.creator.name || 'Bhuvansh K.';
  const dateFormatted = expense?.date || params.date || '3 Mar 2026';
  const primaryPayerName = expense?.paidByName || params.paidByName || 'MOHIT Y.';
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
            {renderCategoryIcon(expense?.category.sub || title, 26, '#09090B')}
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
            <View style={styles.payerRow}>
              <View style={styles.payerAvatar}>
                {expense?.paidByAvatar ? (
                  <Image source={{ uri: expense.paidByAvatar }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarInitial}>{primaryPayerName.charAt(0)}</Text>
                )}
              </View>
              <Text style={styles.payerLabel}>
                {primaryPayerName} paid {currencySymbol}{amount.toFixed(2)}
              </Text>
            </View>

            {/* Tree Branch Container */}
            <View style={styles.treeBranchesWrapper}>
              {participants.map((p, index) => {
                const isLast = index === participants.length - 1;
                const owedText = p.isCurrentUser
                  ? `You owe ${currencySymbol}${p.amountOwed.toFixed(2)}`
                  : `${p.name} owes ${currencySymbol}${p.amountOwed.toFixed(2)}`;

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
                          p.isCurrentUser && styles.branchTextSelf,
                        ]}
                      >
                        {owedText}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Activity & History Audit Logs Section */}
          <View style={styles.logsSection}>
            <Text style={styles.logsSectionHeader}>ACTIVITY & AUDIT LOGS</Text>

            <View style={styles.logsList}>
              {logs.map((log, index) => {
                const isCreated = log.type === 'expense_created';
                const isComment = log.type === 'comment';
                const isDeleted = log.type === 'expense_deleted';
                const isRestored = log.type === 'expense_restored';

                return (
                  <View key={log.id || index} style={styles.logCard}>
                    <View style={styles.logHeaderRow}>
                      <View style={styles.logBadgeContainer}>
                        {isCreated && (
                          <View style={[styles.logTypePill, styles.pillCreated]}>
                            <Sparkles size={11} color="#10B981" />
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
                            <Trash2 size={11} color="#F43F5E" />
                            <Text style={[styles.logTypePillText, { color: '#F43F5E' }]}>Deleted</Text>
                          </View>
                        )}
                        {isRestored && (
                          <View style={[styles.logTypePill, styles.pillRestored]}>
                            <Sparkles size={11} color="#A855F7" />
                            <Text style={[styles.logTypePillText, { color: '#A855F7' }]}>Restored</Text>
                          </View>
                        )}
                        {!isCreated && !isComment && !isDeleted && !isRestored && (
                          <View style={[styles.logTypePill, styles.pillUpdated]}>
                            <Pencil size={11} color="#38BDF8" />
                            <Text style={[styles.logTypePillText, { color: '#38BDF8' }]}>Updated</Text>
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
                                <UserMinus size={11} color="#F43F5E" />
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

      {/* Edit Expense Modal */}
      <Modal
        visible={isEditModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Expense</Text>
              <TouchableOpacity
                onPress={() => setIsEditModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color={THEME.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>TITLE</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder="Expense description"
                  placeholderTextColor={THEME.colors.textMuted}
                />
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>AMOUNT (₹)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editAmount}
                  onChangeText={setEditAmount}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor={THEME.colors.textMuted}
                />
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>CATEGORY</Text>
                <View style={styles.categoryPills}>
                  {['Dining Out', 'Groceries', 'Taxi', 'Rent', 'Flights', 'General'].map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setEditCategory(cat);
                      }}
                      style={[
                        styles.catPill,
                        editCategory === cat && styles.catPillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.catPillText,
                          editCategory === cat && styles.catPillTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>NOTES (OPTIONAL)</Text>
                <TextInput
                  style={[styles.modalInput, styles.modalInputMulti]}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  placeholder="Add notes..."
                  placeholderTextColor={THEME.colors.textMuted}
                  multiline
                />
              </View>

              <TouchableOpacity
                onPress={handleSaveEdit}
                disabled={isSavingEdit}
                style={[styles.modalSaveButton, isSavingEdit && { opacity: 0.6 }]}
              >
                {isSavingEdit ? (
                  <ActivityIndicator size="small" color="#09090B" />
                ) : (
                  <>
                    <Check size={18} color="#09090B" />
                    <Text style={styles.modalSaveButtonText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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

  // Activity & Audit Logs Section
  logsSection: {
    marginTop: 10,
    gap: 12,
  },
  logsSectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 1.2,
  },
  logsList: {
    gap: 10,
  },
  logCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 12,
    gap: 6,
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
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  pillComment: {
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
  },
  pillDeleted: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
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
    color: '#F43F5E',
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
    color: '#F43F5E',
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
