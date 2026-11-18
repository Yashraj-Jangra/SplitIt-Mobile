import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Check,
  ArrowRight,
  Calendar as CalendarIcon,
} from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { useAppTheme } from '../../contexts/theme.context';
import { haptics } from '../../services/haptics.service';
import { BottomSheetModal } from './BottomSheetModal';
import { PressableScale } from './PressableScale';

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export interface DateRangePickerModalProps {
  visible: boolean;
  onClose: () => void;
  range: DateRange;
  onApplyRange: (range: DateRange) => void;
  title?: string;
  minDate?: Date;
  maxDate?: Date;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const DateRangePickerModal: React.FC<DateRangePickerModalProps> = ({
  visible,
  onClose,
  range,
  onApplyRange,
  title = 'Select Date Range',
  minDate,
  maxDate,
}) => {
  const { currentAccent } = useAppTheme();

  const [tempFrom, setTempFrom] = useState<Date | null>(range.from);
  const [tempTo, setTempTo] = useState<Date | null>(range.to);
  const [activeTarget, setActiveTarget] = useState<'from' | 'to'>('from');

  const initialDate = range.from || range.to || new Date();
  const [viewingYear, setViewingYear] = useState<number>(initialDate.getFullYear());
  const [viewingMonth, setViewingMonth] = useState<number>(initialDate.getMonth());

  useEffect(() => {
    if (visible) {
      setTempFrom(range.from);
      setTempTo(range.to);
      setActiveTarget('from');
      const base = range.from || range.to || new Date();
      setViewingYear(base.getFullYear());
      setViewingMonth(base.getMonth());
    }
  }, [visible, range]);

  const handlePrevMonth = useCallback(() => {
    haptics.tap();
    setViewingMonth((prev) => {
      if (prev === 0) {
        setViewingYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    haptics.tap();
    setViewingMonth((prev) => {
      if (prev === 11) {
        setViewingYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  }, []);

  const isSameDay = (d1: Date | null, d2: Date | null) => {
    if (!d1 || !d2) return false;
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const isBetween = (d: Date, from: Date | null, to: Date | null) => {
    if (!from || !to) return false;
    const time = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const startTime = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
    const endTime = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
    return time > startTime && time < endTime;
  };

  // Presets
  const presets = useMemo(() => {
    const today = new Date();
    const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);
    const startOfCurrentYear = new Date(today.getFullYear(), 0, 1);

    return [
      { id: 'all', label: 'All Time', from: null, to: null },
      { id: 'thisMonth', label: 'This Month', from: startOfCurrentMonth, to: today },
      { id: 'lastMonth', label: 'Last Month', from: startOfLastMonth, to: endOfLastMonth },
      { id: '30d', label: 'Last 30 Days', from: thirtyDaysAgo, to: today },
      { id: '90d', label: 'Last 90 Days', from: ninetyDaysAgo, to: today },
      { id: 'year', label: 'This Year', from: startOfCurrentYear, to: today },
    ];
  }, []);

  // Duration in days calculation
  const selectedDayCount = useMemo(() => {
    if (!tempFrom || !tempTo) return null;
    const start = new Date(tempFrom.getFullYear(), tempFrom.getMonth(), tempFrom.getDate()).getTime();
    const end = new Date(tempTo.getFullYear(), tempTo.getMonth(), tempTo.getDate()).getTime();
    if (end < start) return null;
    return Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
  }, [tempFrom, tempTo]);

  const handleSelectDay = (year: number, month: number, day: number) => {
    const selected = new Date(year, month, day);
    if (minDate && selected < minDate) return;
    if (maxDate && selected > maxDate) return;

    haptics.chartScrub();

    if (activeTarget === 'from') {
      setTempFrom(selected);
      // If end date exists and is earlier than selected start, reset end date
      if (tempTo && selected > tempTo) {
        setTempTo(null);
      }
      setActiveTarget('to');
    } else {
      // In 'to' mode
      if (!tempFrom) {
        setTempFrom(selected);
        setActiveTarget('to');
      } else if (selected < tempFrom) {
        // Selected date is before start date: shift start date to this day
        setTempFrom(selected);
      } else {
        // Normal selection: selected >= tempFrom
        setTempTo(selected);
      }
    }
    setViewingYear(year);
    setViewingMonth(month);
  };

  const handleApply = () => {
    haptics.saveSuccess();
    onApplyRange({ from: tempFrom, to: tempTo });
    onClose();
  };

  const handleClear = () => {
    haptics.tap();
    setTempFrom(null);
    setTempTo(null);
    onApplyRange({ from: null, to: null });
    onClose();
  };

  // Calendar cells calculation
  const calendarWeeks = useMemo(() => {
    const firstDayIndex = new Date(viewingYear, viewingMonth, 1).getDay();
    const daysInCurrentMonth = new Date(viewingYear, viewingMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewingYear, viewingMonth, 0).getDate();

    interface CellData {
      day: number;
      month: number;
      year: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isFrom: boolean;
      isTo: boolean;
      isInRange: boolean;
      disabled: boolean;
    }

    const cells: CellData[] = [];
    const today = new Date();

    // Trailing days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dNum = daysInPrevMonth - i;
      const pMonth = viewingMonth === 0 ? 11 : viewingMonth - 1;
      const pYear = viewingMonth === 0 ? viewingYear - 1 : viewingYear;
      const cellDate = new Date(pYear, pMonth, dNum);

      cells.push({
        day: dNum,
        month: pMonth,
        year: pYear,
        isCurrentMonth: false,
        isToday: isSameDay(cellDate, today),
        isFrom: isSameDay(cellDate, tempFrom),
        isTo: isSameDay(cellDate, tempTo),
        isInRange: isBetween(cellDate, tempFrom, tempTo),
        disabled: Boolean((minDate && cellDate < minDate) || (maxDate && cellDate > maxDate)),
      });
    }

    // Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const cellDate = new Date(viewingYear, viewingMonth, d);
      cells.push({
        day: d,
        month: viewingMonth,
        year: viewingYear,
        isCurrentMonth: true,
        isToday: isSameDay(cellDate, today),
        isFrom: isSameDay(cellDate, tempFrom),
        isTo: isSameDay(cellDate, tempTo),
        isInRange: isBetween(cellDate, tempFrom, tempTo),
        disabled: Boolean((minDate && cellDate < minDate) || (maxDate && cellDate > maxDate)),
      });
    }

    // Leading days from next month
    const remainder = cells.length % 7;
    if (remainder > 0) {
      const daysToAdd = 7 - remainder;
      for (let nextDay = 1; nextDay <= daysToAdd; nextDay++) {
        const nMonth = viewingMonth === 11 ? 0 : viewingMonth + 1;
        const nYear = viewingMonth === 11 ? viewingYear + 1 : viewingYear;
        const cellDate = new Date(nYear, nMonth, nextDay);

        cells.push({
          day: nextDay,
          month: nMonth,
          year: nYear,
          isCurrentMonth: false,
          isToday: isSameDay(cellDate, today),
          isFrom: isSameDay(cellDate, tempFrom),
          isTo: isSameDay(cellDate, tempTo),
          isInRange: isBetween(cellDate, tempFrom, tempTo),
          disabled: Boolean((minDate && cellDate < minDate) || (maxDate && cellDate > maxDate)),
        });
      }
    }

    const weeks: CellData[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
  }, [viewingYear, viewingMonth, tempFrom, tempTo, minDate, maxDate]);

  const formatDateLabel = (d: Date | null) => {
    if (!d) return 'Select';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatShortDate = (d: Date | null) => {
    if (!d) return null;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatWeekday = (d: Date | null) => {
    if (!d) return '';
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const modalSubtitle = useMemo(() => {
    if (tempFrom && tempTo) {
      return `${formatDateLabel(tempFrom)} – ${formatDateLabel(tempTo)}`;
    }
    if (tempFrom) {
      return `From ${formatDateLabel(tempFrom)}`;
    }
    return 'Filter by custom date range';
  }, [tempFrom, tempTo]);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={modalSubtitle}
      maxHeight="92%"
    >
      <View style={styles.modalWrapper}>
        {/* Scrollable Body: Fits all viewports without button truncation */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Quick Presets Strip */}
          <View style={styles.presetsWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.presetsContent}
            >
              {presets.map((p) => {
                const active =
                  (!tempFrom && !tempTo && !p.from && !p.to) ||
                  (isSameDay(tempFrom, p.from) && isSameDay(tempTo, p.to));

                return (
                  <PressableScale
                    key={p.id}
                    style={[
                      styles.presetPill,
                      active && [
                        styles.presetPillActive,
                        {
                          backgroundColor: currentAccent.primaryMuted,
                          borderColor: currentAccent.primary,
                        },
                      ],
                    ]}
                    onPress={() => {
                      haptics.toggleSwitch();
                      setTempFrom(p.from);
                      setTempTo(p.to);
                      if (p.from) {
                        setViewingYear(p.from.getFullYear());
                        setViewingMonth(p.from.getMonth());
                        setActiveTarget('to');
                      } else {
                        const now = new Date();
                        setViewingYear(now.getFullYear());
                        setViewingMonth(now.getMonth());
                        setActiveTarget('from');
                      }
                    }}
                    activeScale={0.95}
                    accessibilityRole="button"
                    accessibilityLabel={`Preset: ${p.label}`}
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[
                        styles.presetPillText,
                        active && [
                          styles.presetPillTextActive,
                          { color: currentAccent.primary },
                        ],
                      ]}
                    >
                      {p.label}
                    </Text>
                  </PressableScale>
                );
              })}
            </ScrollView>
          </View>

          {/* Modern Unified From / To Date Selector Capsule */}
          <View style={styles.rangeCapsuleContainer}>
            {/* START DATE CARD */}
            <PressableScale
              style={[
                styles.rangeSideCard,
                activeTarget === 'from' && [
                  styles.rangeSideActive,
                  {
                    borderColor: currentAccent.primary,
                    backgroundColor: currentAccent.primaryMuted,
                  },
                ],
              ]}
              onPress={() => {
                haptics.toggleSwitch();
                setActiveTarget('from');
                if (tempFrom) {
                  setViewingYear(tempFrom.getFullYear());
                  setViewingMonth(tempFrom.getMonth());
                }
              }}
              activeScale={0.98}
              accessibilityRole="button"
              accessibilityLabel="Select start date"
              accessibilityState={{ selected: activeTarget === 'from' }}
            >
              <View style={styles.rangeSideHeader}>
                <View
                  style={[
                    styles.targetIndicatorDot,
                    activeTarget === 'from' && { backgroundColor: currentAccent.primary },
                  ]}
                />
                <Text
                  style={[
                    styles.rangeSideCaption,
                    activeTarget === 'from' && { color: currentAccent.primary },
                  ]}
                >
                  START DATE
                </Text>
              </View>
              <Text
                style={[
                  styles.rangeSideDateText,
                  !tempFrom && styles.rangeSidePlaceholder,
                  activeTarget === 'from' && tempFrom && { color: currentAccent.primary },
                ]}
                numberOfLines={1}
              >
                {formatShortDate(tempFrom) || 'Choose start'}
              </Text>
              {tempFrom ? (
                <Text style={styles.rangeSideWeekdayText}>{formatWeekday(tempFrom)}</Text>
              ) : (
                <Text style={styles.rangeSideHintText}>Tap calendar</Text>
              )}
            </PressableScale>

            {/* CENTER DURATION BADGE / ARROW ANCHOR */}
            <View style={styles.rangeCenterAnchor}>
              <View
                style={[
                  styles.durationBadge,
                  Boolean(selectedDayCount) && {
                    backgroundColor: currentAccent.primaryMuted,
                    borderColor: currentAccent.borderFocus,
                  },
                ]}
              >
                {selectedDayCount ? (
                  <Text style={[styles.durationBadgeText, { color: currentAccent.primary }]}>
                    {selectedDayCount} {selectedDayCount === 1 ? 'day' : 'days'}
                  </Text>
                ) : (
                  <ArrowRight size={13} color={THEME.colors.textMuted} />
                )}
              </View>
            </View>

            {/* END DATE CARD */}
            <PressableScale
              style={[
                styles.rangeSideCard,
                activeTarget === 'to' && [
                  styles.rangeSideActive,
                  {
                    borderColor: currentAccent.primary,
                    backgroundColor: currentAccent.primaryMuted,
                  },
                ],
              ]}
              onPress={() => {
                haptics.toggleSwitch();
                setActiveTarget('to');
                if (tempTo) {
                  setViewingYear(tempTo.getFullYear());
                  setViewingMonth(tempTo.getMonth());
                }
              }}
              activeScale={0.98}
              accessibilityRole="button"
              accessibilityLabel="Select end date"
              accessibilityState={{ selected: activeTarget === 'to' }}
            >
              <View style={styles.rangeSideHeader}>
                <View
                  style={[
                    styles.targetIndicatorDot,
                    activeTarget === 'to' && { backgroundColor: currentAccent.primary },
                  ]}
                />
                <Text
                  style={[
                    styles.rangeSideCaption,
                    activeTarget === 'to' && { color: currentAccent.primary },
                  ]}
                >
                  END DATE
                </Text>
              </View>
              <Text
                style={[
                  styles.rangeSideDateText,
                  !tempTo && styles.rangeSidePlaceholder,
                  activeTarget === 'to' && tempTo && { color: currentAccent.primary },
                ]}
                numberOfLines={1}
              >
                {formatShortDate(tempTo) || 'Choose end'}
              </Text>
              {tempTo ? (
                <Text style={styles.rangeSideWeekdayText}>{formatWeekday(tempTo)}</Text>
              ) : (
                <Text style={styles.rangeSideHintText}>Tap calendar</Text>
              )}
            </PressableScale>
          </View>

          {/* Modern Calendar Grid Card */}
          <View style={styles.calendarCard}>
            {/* Month & Year Navigation Header */}
            <View style={styles.navHeader}>
              <PressableScale
                onPress={handlePrevMonth}
                style={styles.navArrowBtn}
                activeScale={0.9}
                accessibilityRole="button"
                accessibilityLabel="Previous month"
              >
                <ChevronLeft size={18} color={THEME.colors.text} />
              </PressableScale>

              <View style={styles.monthTitleWrapper}>
                <CalendarIcon size={14} color={currentAccent.primary} style={{ marginRight: 6 }} />
                <Text style={styles.monthYearTitle}>
                  {MONTH_NAMES[viewingMonth]} <Text style={styles.yearTitle}>{viewingYear}</Text>
                </Text>
              </View>

              <PressableScale
                onPress={handleNextMonth}
                style={styles.navArrowBtn}
                activeScale={0.9}
                accessibilityRole="button"
                accessibilityLabel="Next month"
              >
                <ChevronRight size={18} color={THEME.colors.text} />
              </PressableScale>
            </View>

            {/* Days of Week Header */}
            <View style={styles.dayOfWeekRow}>
              {DAYS_OF_WEEK.map((d, i) => (
                <View key={i} style={styles.dayOfWeekCell}>
                  <Text style={styles.dayOfWeekText}>{d}</Text>
                </View>
              ))}
            </View>

            {/* Calendar Day Grid with Continuous Range Ribbon */}
            <View style={styles.weeksContainer}>
              {calendarWeeks.map((week, wIdx) => (
                <View key={wIdx} style={styles.weekRow}>
                  {week.map((cell, dIdx) => {
                    const {
                      day,
                      month,
                      year,
                      isCurrentMonth,
                      isToday,
                      isFrom,
                      isTo,
                      isInRange,
                      disabled,
                    } = cell;
                    const isEndpoint = isFrom || isTo;
                    const isSingleDay = isFrom && isTo;
                    const hasRange = Boolean(tempFrom && tempTo && tempTo > tempFrom);

                    return (
                      <TouchableOpacity
                        key={`${year}-${month}-${day}-${dIdx}`}
                        style={styles.dayCellTouch}
                        onPress={() => handleSelectDay(year, month, day)}
                        disabled={disabled}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={`${day} ${MONTH_NAMES[month]} ${year}${isFrom ? ', start date' : ''}${isTo ? ', end date' : ''}`}
                        accessibilityState={{ selected: isEndpoint || isInRange }}
                      >
                        {/* Continuous Range Pill Ribbon Tracks */}
                        {hasRange && (
                          <>
                            {/* Full width track for days in between */}
                            {isInRange && (
                              <View
                                style={[
                                  styles.rangeTrackFull,
                                  { backgroundColor: `${currentAccent.primary}22` },
                                  dIdx === 0 && styles.rangeTrackRowStart,
                                  dIdx === 6 && styles.rangeTrackRowEnd,
                                ]}
                              />
                            )}
                            {/* Right-half track for start endpoint */}
                            {isFrom && !isSingleDay && (
                              <View
                                style={[
                                  styles.rangeTrackRight,
                                  { backgroundColor: `${currentAccent.primary}22` },
                                  dIdx === 6 && styles.rangeTrackRowEnd,
                                ]}
                              />
                            )}
                            {/* Left-half track for end endpoint */}
                            {isTo && !isSingleDay && (
                              <View
                                style={[
                                  styles.rangeTrackLeft,
                                  { backgroundColor: `${currentAccent.primary}22` },
                                  dIdx === 0 && styles.rangeTrackRowStart,
                                ]}
                              />
                            )}
                          </>
                        )}

                        {/* Day Bubble & Text */}
                        <View
                          style={[
                            styles.dayBubble,
                            isEndpoint && [
                              styles.dayBubbleEndpoint,
                              {
                                backgroundColor: currentAccent.primary,
                                shadowColor: currentAccent.primary,
                              },
                            ],
                            !isEndpoint && isToday && [
                              styles.dayBubbleToday,
                              { borderColor: `${currentAccent.primary}80` },
                            ],
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayText,
                              !isCurrentMonth && !isEndpoint && !isInRange && styles.dayTextAdjacent,
                              !isEndpoint && isInRange && [
                                styles.dayTextInRange,
                                { color: currentAccent.primaryLight || THEME.colors.text },
                              ],
                              !isEndpoint && isToday && {
                                color: currentAccent.primary,
                                fontWeight: '800',
                              },
                              isEndpoint && styles.dayTextEndpoint,
                              disabled && styles.dayTextDisabled,
                            ]}
                          >
                            {day}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Docked Action Footer: Guaranteed 100% visible on all viewports */}
        <View style={styles.dockedFooter}>
          <PressableScale
            style={styles.clearBtn}
            onPress={handleClear}
            activeScale={0.96}
            accessibilityRole="button"
            accessibilityLabel="Reset to all time"
          >
            <RotateCcw size={14} color={THEME.colors.textSecondary} />
            <Text style={styles.clearBtnText}>All Time</Text>
          </PressableScale>

          <PressableScale
            style={[
              styles.applyBtn,
              {
                backgroundColor: currentAccent.primary,
                shadowColor: currentAccent.primary,
              },
            ]}
            onPress={handleApply}
            activeScale={0.96}
            hapticFeedback="confirm"
            accessibilityRole="button"
            accessibilityLabel="Apply date range filter"
          >
            <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.applyBtnText}>
              {selectedDayCount
                ? `Apply Range (${selectedDayCount} ${selectedDayCount === 1 ? 'day' : 'days'})`
                : tempFrom
                ? 'Apply From Date'
                : 'Apply Filter'}
            </Text>
          </PressableScale>
        </View>
      </View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  modalWrapper: {
    maxHeight: '100%',
    flexShrink: 1,
    flexDirection: 'column',
  },
  scrollArea: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  presetsWrapper: {
    marginBottom: 10,
  },
  presetsContent: {
    gap: 8,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  presetPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  presetPillActive: {
    borderWidth: 1.5,
  },
  presetPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  presetPillTextActive: {
    fontWeight: '800',
  },

  /* Modern Range Capsule Container */
  rangeCapsuleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    borderRadius: THEME.radius.xl,
    padding: 6,
    marginBottom: 12,
    gap: 6,
  },
  rangeSideCard: {
    flex: 1,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: THEME.radius.lg,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  rangeSideActive: {
    // dynamically tinted in JSX
  },
  rangeSideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  targetIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.hairline,
  },
  rangeSideCaption: {
    fontSize: 9.5,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.6,
  },
  rangeSideDateText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  rangeSidePlaceholder: {
    color: THEME.colors.textMuted,
    fontWeight: '500',
    fontSize: 12.5,
  },
  rangeSideWeekdayText: {
    fontSize: 10.5,
    fontWeight: '500',
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  rangeSideHintText: {
    fontSize: 10.5,
    fontWeight: '400',
    color: THEME.colors.textMuted,
    opacity: 0.6,
    marginTop: 1,
  },
  rangeCenterAnchor: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },

  /* Calendar Card */
  calendarCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius['2xl'],
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingBottom: 8,
  },
  monthTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navArrowBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthYearTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.2,
  },
  yearTitle: {
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  dayOfWeekRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.colors.hairline,
  },
  dayOfWeekCell: {
    flex: 1,
    alignItems: 'center',
  },
  dayOfWeekText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 0.3,
  },
  weeksContainer: {
    paddingTop: 4,
  },
  weekRow: {
    flexDirection: 'row',
    marginVertical: 1,
  },
  dayCellTouch: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  /* Continuous Range Tracks */
  rangeTrackFull: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 3,
    bottom: 3,
  },
  rangeTrackRight: {
    position: 'absolute',
    left: '50%',
    right: 0,
    top: 3,
    bottom: 3,
  },
  rangeTrackLeft: {
    position: 'absolute',
    left: 0,
    right: '50%',
    top: 3,
    bottom: 3,
  },
  rangeTrackRowStart: {
    borderTopLeftRadius: 15,
    borderBottomLeftRadius: 15,
  },
  rangeTrackRowEnd: {
    borderTopRightRadius: 15,
    borderBottomRightRadius: 15,
  },

  /* Day Bubbles */
  dayBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  dayBubbleEndpoint: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  dayBubbleToday: {
    borderWidth: 1.5,
  },
  dayText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  dayTextAdjacent: {
    color: THEME.colors.textMuted,
    opacity: 0.3,
  },
  dayTextInRange: {
    fontWeight: '700',
  },
  dayTextEndpoint: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dayTextDisabled: {
    opacity: 0.2,
  },

  /* Docked Action Footer */
  dockedFooter: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.colors.hairline,
    gap: 10,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: THEME.radius.lg,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  clearBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  applyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: THEME.radius.lg,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  applyBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
