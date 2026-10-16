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
  RotateCcw,
  Check,
  ArrowRight,
} from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { useAppTheme } from '../../contexts/theme.context';
import { haptics } from '../../services/haptics.service';
import { BottomSheetModal } from './BottomSheetModal';

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
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);
    const startOfCurrentYear = new Date(today.getFullYear(), 0, 1);

    return [
      { id: 'all', label: 'All Time', from: null, to: null },
      { id: 'thisMonth', label: 'This Month', from: startOfCurrentMonth, to: today },
      { id: '30d', label: 'Last 30 Days', from: thirtyDaysAgo, to: today },
      { id: '90d', label: 'Last 90 Days', from: ninetyDaysAgo, to: today },
      { id: 'year', label: 'This Year', from: startOfCurrentYear, to: today },
    ];
  }, []);

  const handleSelectDay = (year: number, month: number, day: number) => {
    const selected = new Date(year, month, day);
    if (minDate && selected < minDate) return;
    if (maxDate && selected > maxDate) return;

    haptics.tap();

    if (activeTarget === 'from') {
      setTempFrom(selected);
      if (tempTo && selected > tempTo) {
        setTempTo(null);
      }
      setActiveTarget('to');
    } else {
      if (tempFrom && selected < tempFrom) {
        setTempFrom(selected);
        setTempTo(null);
      } else {
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

    // Trailing days
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

    // Leading days
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
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={tempFrom && tempTo ? `${formatDateLabel(tempFrom)} - ${formatDateLabel(tempTo)}` : 'Custom Date Range'}
      maxHeight="88%"
    >
      <View style={styles.container}>
        {/* Quick Presets Strip */}
        <View style={styles.presetsWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsContent}>
            {presets.map((p) => {
              const active =
                (!tempFrom && !tempTo && !p.from && !p.to) ||
                (isSameDay(tempFrom, p.from) && isSameDay(tempTo, p.to));

              return (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.presetPill,
                    active && [styles.presetPillActive, { backgroundColor: `${currentAccent.primary}18`, borderColor: currentAccent.primary }],
                  ]}
                  onPress={() => {
                    haptics.tap();
                    setTempFrom(p.from);
                    setTempTo(p.to);
                    if (p.from) {
                      setViewingYear(p.from.getFullYear());
                      setViewingMonth(p.from.getMonth());
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.presetPillText, active && [styles.presetPillTextActive, { color: currentAccent.primary }]]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* From / To Target Selector Row */}
        <View style={styles.rangeSelectorRow}>
          <TouchableOpacity
            style={[
              styles.rangePill,
              activeTarget === 'from' && [styles.rangePillActive, { borderColor: currentAccent.primary, backgroundColor: `${currentAccent.primary}12` }],
            ]}
            onPress={() => {
              haptics.tap();
              setActiveTarget('from');
              if (tempFrom) {
                setViewingYear(tempFrom.getFullYear());
                setViewingMonth(tempFrom.getMonth());
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.rangePillLabel}>FROM</Text>
            <Text style={[styles.rangePillValue, activeTarget === 'from' && { color: currentAccent.primary }]} numberOfLines={1}>
              {formatDateLabel(tempFrom)}
            </Text>
          </TouchableOpacity>

          <View style={styles.rangeArrowWrap}>
            <ArrowRight size={14} color={THEME.colors.textMuted} />
          </View>

          <TouchableOpacity
            style={[
              styles.rangePill,
              activeTarget === 'to' && [styles.rangePillActive, { borderColor: currentAccent.primary, backgroundColor: `${currentAccent.primary}12` }],
            ]}
            onPress={() => {
              haptics.tap();
              setActiveTarget('to');
              if (tempTo) {
                setViewingYear(tempTo.getFullYear());
                setViewingMonth(tempTo.getMonth());
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.rangePillLabel}>TO</Text>
            <Text style={[styles.rangePillValue, activeTarget === 'to' && { color: currentAccent.primary }]} numberOfLines={1}>
              {formatDateLabel(tempTo)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Calendar Frame */}
        <View style={styles.calendarCard}>
          {/* Month & Year Navigation Header */}
          <View style={styles.navHeader}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.navArrowBtn} activeOpacity={0.7}>
              <ChevronLeft size={18} color={THEME.colors.text} />
            </TouchableOpacity>

            <Text style={styles.monthYearTitle}>
              {MONTH_NAMES[viewingMonth]} <Text style={styles.yearTitle}>{viewingYear}</Text>
            </Text>

            <TouchableOpacity onPress={handleNextMonth} style={styles.navArrowBtn} activeOpacity={0.7}>
              <ChevronRight size={18} color={THEME.colors.text} />
            </TouchableOpacity>
          </View>

          {/* Days of Week Header */}
          <View style={styles.dayOfWeekRow}>
            {DAYS_OF_WEEK.map((d, i) => (
              <View key={i} style={styles.dayOfWeekCell}>
                <Text style={styles.dayOfWeekText}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Calendar Day Grid */}
          <View style={styles.weeksContainer}>
            {calendarWeeks.map((week, wIdx) => (
              <View key={wIdx} style={styles.weekRow}>
                {week.map((cell, dIdx) => {
                  const { day, month, year, isCurrentMonth, isToday, isFrom, isTo, isInRange, disabled } = cell;
                  const isSelectedEndpoint = isFrom || isTo;

                  return (
                    <TouchableOpacity
                      key={`${year}-${month}-${day}-${dIdx}`}
                      style={[
                        styles.dayCellTouch,
                        isInRange && [styles.dayCellInRange, { backgroundColor: `${currentAccent.primary}14` }],
                      ]}
                      onPress={() => handleSelectDay(year, month, day)}
                      disabled={disabled}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.dayBubble,
                          isSelectedEndpoint && [
                            styles.dayBubbleSelected,
                            { backgroundColor: currentAccent.primary, shadowColor: currentAccent.primary },
                          ],
                          !isSelectedEndpoint && isToday && [
                            styles.dayBubbleToday,
                            { borderColor: `${currentAccent.primary}70` },
                          ],
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            !isCurrentMonth && styles.dayTextAdjacent,
                            !isSelectedEndpoint && isToday && { color: currentAccent.primary, fontWeight: '700' },
                            isSelectedEndpoint && styles.dayTextSelected,
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

        {/* Action Footer */}
        <View style={styles.footerRow}>
          <TouchableOpacity style={styles.clearBtn} onPress={handleClear} activeOpacity={0.7}>
            <RotateCcw size={13} color={THEME.colors.textMuted} />
            <Text style={styles.clearBtnText}>All Time</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.applyBtn, { backgroundColor: currentAccent.primary, shadowColor: currentAccent.primary }]}
            onPress={handleApply}
            activeOpacity={0.8}
          >
            <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.applyBtnText}>Apply Range</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 16,
  },
  presetsWrapper: {
    marginBottom: 12,
  },
  presetsContent: {
    gap: 8,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  presetPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
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
  rangeSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  rangePill: {
    flex: 1,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  rangePillActive: {
    borderWidth: 1.5,
  },
  rangePillLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 0.5,
  },
  rangePillValue: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
    marginTop: 2,
  },
  rangeArrowWrap: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  navArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthYearTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.text,
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
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
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
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellInRange: {
    borderRadius: 0,
  },
  dayBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBubbleSelected: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  dayBubbleToday: {
    borderWidth: 1.5,
  },
  dayText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  dayTextAdjacent: {
    color: THEME.colors.textMuted,
    opacity: 0.35,
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dayTextDisabled: {
    opacity: 0.2,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.colors.hairline,
    gap: 12,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: THEME.colors.surfaceElevated,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  applyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  applyBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
