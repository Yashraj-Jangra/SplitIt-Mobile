import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Check,
  RotateCcw,
} from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { useAppTheme } from '../../contexts/theme.context';
import { haptics } from '../../services/haptics.service';
import { BottomSheetModal } from './BottomSheetModal';

export interface DatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  title?: string;
  maxDate?: Date;
  minDate?: Date;
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

export const DatePickerModal: React.FC<DatePickerModalProps> = ({
  visible,
  onClose,
  selectedDate,
  onSelectDate,
  title = 'Select Date',
  maxDate,
  minDate,
}) => {
  const { currentAccent } = useAppTheme();

  const [tempDate, setTempDate] = useState<Date>(selectedDate || new Date());
  const [viewingYear, setViewingYear] = useState<number>(selectedDate?.getFullYear() || new Date().getFullYear());
  const [viewingMonth, setViewingMonth] = useState<number>(selectedDate?.getMonth() || new Date().getMonth());

  // Reset to incoming selectedDate whenever modal becomes visible
  useEffect(() => {
    if (visible) {
      const initial = selectedDate instanceof Date && !isNaN(selectedDate.getTime()) ? selectedDate : new Date();
      setTempDate(initial);
      setViewingYear(initial.getFullYear());
      setViewingMonth(initial.getMonth());
    }
  }, [visible, selectedDate]);

  // Navigate to previous month
  const handlePrevMonth = useCallback(() => {
    haptics.tap();
    setViewingMonth((prevMonth) => {
      if (prevMonth === 0) {
        setViewingYear((prevYear) => prevYear - 1);
        return 11;
      }
      return prevMonth - 1;
    });
  }, []);

  // Navigate to next month
  const handleNextMonth = useCallback(() => {
    haptics.tap();
    setViewingMonth((prevMonth) => {
      if (prevMonth === 11) {
        setViewingYear((prevYear) => prevYear + 1);
        return 0;
      }
      return prevMonth + 1;
    });
  }, []);

  // Jump to today's month & date
  const handleJumpToToday = useCallback(() => {
    haptics.tap();
    const now = new Date();
    setTempDate(now);
    setViewingYear(now.getFullYear());
    setViewingMonth(now.getMonth());
  }, []);

  // Preset definitions
  const presets = useMemo(() => {
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000);
    const oneWeekAgo = new Date(Date.now() - 7 * 86400000);

    return [
      { id: 'today', label: 'Today', date: today },
      { id: 'yesterday', label: 'Yesterday', date: yesterday },
      { id: '2days', label: '2 days ago', date: twoDaysAgo },
      { id: '1week', label: '1 week ago', date: oneWeekAgo },
    ];
  }, []);

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  // Select a day from current or adjacent month
  const handleSelectDay = (year: number, month: number, day: number) => {
    const target = new Date(year, month, day);
    if (minDate && target < minDate) return;
    if (maxDate && target > maxDate) return;

    haptics.tap();
    setTempDate(target);
    setViewingYear(year);
    setViewingMonth(month);
  };

  // Confirm selection
  const handleConfirm = () => {
    haptics.saveSuccess();
    onSelectDate(tempDate);
    onClose();
  };

  // Compute calendar matrix for the viewing month
  const calendarWeeks = useMemo(() => {
    const firstDayIndex = new Date(viewingYear, viewingMonth, 1).getDay();
    const daysInCurrentMonth = new Date(viewingYear, viewingMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewingYear, viewingMonth, 0).getDate();

    interface CalendarDayCell {
      day: number;
      month: number;
      year: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      disabled: boolean;
    }

    const cells: CalendarDayCell[] = [];
    const today = new Date();

    // 1. Trailing days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonth = viewingMonth === 0 ? 11 : viewingMonth - 1;
      const prevYear = viewingMonth === 0 ? viewingYear - 1 : viewingYear;
      const cellDate = new Date(prevYear, prevMonth, dayNum);

      cells.push({
        day: dayNum,
        month: prevMonth,
        year: prevYear,
        isCurrentMonth: false,
        isToday: isSameDay(cellDate, today),
        isSelected: isSameDay(cellDate, tempDate),
        disabled: Boolean((minDate && cellDate < minDate) || (maxDate && cellDate > maxDate)),
      });
    }

    // 2. Days of current month
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const cellDate = new Date(viewingYear, viewingMonth, d);
      cells.push({
        day: d,
        month: viewingMonth,
        year: viewingYear,
        isCurrentMonth: true,
        isToday: isSameDay(cellDate, today),
        isSelected: isSameDay(cellDate, tempDate),
        disabled: Boolean((minDate && cellDate < minDate) || (maxDate && cellDate > maxDate)),
      });
    }

    // 3. Leading days of next month to complete the row
    const remainder = cells.length % 7;
    if (remainder > 0) {
      const daysToAdd = 7 - remainder;
      for (let nextDay = 1; nextDay <= daysToAdd; nextDay++) {
        const nextMonth = viewingMonth === 11 ? 0 : viewingMonth + 1;
        const nextYear = viewingMonth === 11 ? viewingYear + 1 : viewingYear;
        const cellDate = new Date(nextYear, nextMonth, nextDay);

        cells.push({
          day: nextDay,
          month: nextMonth,
          year: nextYear,
          isCurrentMonth: false,
          isToday: isSameDay(cellDate, today),
          isSelected: isSameDay(cellDate, tempDate),
          disabled: Boolean((minDate && cellDate < minDate) || (maxDate && cellDate > maxDate)),
        });
      }
    }

    // Split cells into 7-day chunks (weeks)
    const weeks: CalendarDayCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }

    return weeks;
  }, [viewingYear, viewingMonth, tempDate, minDate, maxDate]);

  // Formatted selected date preview
  const formattedSelectedPreview = useMemo(() => {
    return tempDate.toLocaleDateString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [tempDate]);

  const isCurrentViewingMonth = useMemo(() => {
    const now = new Date();
    return viewingYear === now.getFullYear() && viewingMonth === now.getMonth();
  }, [viewingYear, viewingMonth]);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={formattedSelectedPreview}
      maxHeight="86%"
    >
      <View style={styles.container}>
        {/* Quick Presets Row */}
        <View style={styles.presetsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetsContent}
          >
            {presets.map((preset) => {
              const active = isSameDay(tempDate, preset.date);
              return (
                <TouchableOpacity
                  key={preset.id}
                  style={[
                    styles.presetPill,
                    active && [
                      styles.presetPillActive,
                      {
                        backgroundColor: `${currentAccent.primary}18`,
                        borderColor: currentAccent.primary,
                      },
                    ],
                  ]}
                  onPress={() => {
                    haptics.tap();
                    setTempDate(preset.date);
                    setViewingYear(preset.date.getFullYear());
                    setViewingMonth(preset.date.getMonth());
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${preset.label}`}
                >
                  <Text
                    style={[
                      styles.presetPillText,
                      active && [styles.presetPillTextActive, { color: currentAccent.primary }],
                    ]}
                  >
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Calendar Frame */}
        <View style={styles.calendarCard}>
          {/* Month & Year Navigation Header */}
          <View style={styles.navHeader}>
            <TouchableOpacity
              onPress={handlePrevMonth}
              style={styles.navArrowBtn}
              activeOpacity={0.7}
              accessibilityLabel="Previous month"
              accessibilityRole="button"
            >
              <ChevronLeft size={18} color={THEME.colors.text} />
            </TouchableOpacity>

            <View style={styles.monthYearTitleWrap}>
              <Text style={styles.monthYearTitle}>
                {MONTH_NAMES[viewingMonth]} <Text style={styles.yearTitle}>{viewingYear}</Text>
              </Text>
            </View>

            <View style={styles.navHeaderRight}>
              {!isCurrentViewingMonth && (
                <TouchableOpacity
                  onPress={handleJumpToToday}
                  style={[styles.todayJumpBtn, { borderColor: `${currentAccent.primary}40` }]}
                  activeOpacity={0.7}
                  accessibilityLabel="Jump to today"
                  accessibilityRole="button"
                >
                  <RotateCcw size={11} color={currentAccent.primary} />
                  <Text style={[styles.todayJumpText, { color: currentAccent.primary }]}>Today</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={handleNextMonth}
                style={styles.navArrowBtn}
                activeOpacity={0.7}
                accessibilityLabel="Next month"
                accessibilityRole="button"
              >
                <ChevronRight size={18} color={THEME.colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Days of Week Row */}
          <View style={styles.dayOfWeekRow}>
            {DAYS_OF_WEEK.map((d, index) => (
              <View key={index} style={styles.dayOfWeekCell}>
                <Text style={styles.dayOfWeekText}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Calendar Day Grid */}
          <View style={styles.weeksContainer}>
            {calendarWeeks.map((week, weekIdx) => (
              <View key={weekIdx} style={styles.weekRow}>
                {week.map((cell, dayIdx) => {
                  const { day, month, year, isCurrentMonth, isToday, isSelected, disabled } = cell;

                  return (
                    <TouchableOpacity
                      key={`${year}-${month}-${day}-${dayIdx}`}
                      style={styles.dayCellTouch}
                      onPress={() => handleSelectDay(year, month, day)}
                      disabled={disabled}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`${day} ${MONTH_NAMES[month]} ${year}${isSelected ? ', selected' : ''}${isToday ? ', today' : ''}`}
                    >
                      <View
                        style={[
                          styles.dayBubble,
                          isSelected && [
                            styles.dayBubbleSelected,
                            {
                              backgroundColor: currentAccent.primary,
                              shadowColor: currentAccent.primary,
                            },
                          ],
                          !isSelected && isToday && [
                            styles.dayBubbleToday,
                            { borderColor: currentAccent.primary },
                          ],
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            !isCurrentMonth && styles.dayTextDimmed,
                            isSelected && styles.dayTextSelected,
                            !isSelected && isToday && [styles.dayTextToday, { color: currentAccent.primary }],
                            disabled && styles.dayTextDisabled,
                          ]}
                        >
                          {day}
                        </Text>
                        {!isSelected && isToday && (
                          <View style={[styles.todayDot, { backgroundColor: currentAccent.primary }]} />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        {/* Action Controls Footer */}
        <View style={styles.footerRow}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => {
              haptics.tap();
              onClose();
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Cancel date selection"
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.confirmBtn,
              {
                backgroundColor: currentAccent.primary,
                shadowColor: currentAccent.primary,
              },
            ]}
            onPress={handleConfirm}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Confirm date: ${formattedSelectedPreview}`}
          >
            <Check size={16} color={THEME.colors.primaryForeground} strokeWidth={2.5} />
            <Text style={styles.confirmBtnText}>Set Date</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
    paddingBottom: 8,
    gap: 12,
  },
  // Presets
  presetsWrapper: {
    marginBottom: 2,
  },
  presetsContent: {
    gap: 8,
    paddingHorizontal: 2,
  },
  presetPill: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
  },
  presetPillActive: {
    borderWidth: 1,
  },
  presetPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  presetPillTextActive: {
    fontWeight: '700',
  },
  // Calendar Card
  calendarCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    padding: 12,
    gap: 10,
  },
  // Month Nav Header
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  navArrowBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthYearTitleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthYearTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: -0.2,
  },
  yearTitle: {
    fontWeight: '500',
    color: THEME.colors.textSecondary,
  },
  navHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  todayJumpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: THEME.radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
  },
  todayJumpText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // Days of Week
  dayOfWeekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  dayOfWeekCell: {
    flex: 1,
    alignItems: 'center',
  },
  dayOfWeekText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Weeks Grid
  weeksContainer: {
    gap: 4,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayCellTouch: {
    flex: 1,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBubbleSelected: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
  },
  dayBubbleToday: {
    borderWidth: 1.5,
  },
  dayText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  dayTextDimmed: {
    color: THEME.colors.textMuted,
    opacity: 0.32,
    fontWeight: '400',
  },
  dayTextSelected: {
    color: THEME.colors.primaryForeground,
    fontWeight: '800',
  },
  dayTextToday: {
    fontWeight: '800',
  },
  dayTextDisabled: {
    opacity: 0.2,
  },
  todayDot: {
    position: 'absolute',
    bottom: 3,
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
  },
  // Footer
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: THEME.radius.lg,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  confirmBtn: {
    flex: 2,
    height: 44,
    borderRadius: THEME.radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  confirmBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: THEME.colors.primaryForeground,
  },
});
