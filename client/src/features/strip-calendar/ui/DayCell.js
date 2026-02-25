import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStripCalendarStore } from '../store/stripCalendarStore';

const EMPTY_SUMMARY = Object.freeze({
  date: null,
  hasTodo: false,
  uniqueCategoryColors: [],
  dotCount: 0,
  maxDots: 3,
  overflowCount: 0,
});

function DayCell({ day, onPress }) {
  const date = day?.date || null;
  const summary = useStripCalendarStore((state) => state.summariesByDate?.[date]) || EMPTY_SUMMARY;
  const dotColors = (summary.uniqueCategoryColors || EMPTY_SUMMARY.uniqueCategoryColors).slice(0, 3);
  const overflow = (summary.dotCount || 0) > 3;
  const isEvenMonth = (day.month + 1) % 2 === 0;

  return (
    <Pressable
      style={[styles.cell, isEvenMonth ? styles.evenMonthCell : styles.oddMonthCell]}
      onPress={() => onPress(date)}
    >
      {day.monthLabel ? <Text style={styles.monthLabel}>{day.monthLabel}</Text> : <View style={styles.monthPlaceholder} />}

      <View style={[styles.dateContainer, day.isSelected && styles.selectedDateContainer]}>
        <Text
          style={[
            styles.dateText,
            day.isSelected && styles.selectedDateText,
            day.isToday && styles.todayText,
          ]}
        >
          {day.dayNumber}
        </Text>
      </View>

      <View style={styles.dotRow}>
        {dotColors.map((color) => (
          <View key={`${day.date}-${color}`} style={[styles.dot, { backgroundColor: color }]} />
        ))}
        {overflow ? <Text style={styles.overflowText}>+</Text> : null}
      </View>
    </Pressable>
  );
}

export default React.memo(DayCell);

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 3,
  },
  oddMonthCell: {
    backgroundColor: '#FFFFFF',
  },
  evenMonthCell: {
    backgroundColor: '#F8FAFC',
  },
  monthLabel: {
    fontSize: 10,
    color: '#6B7280',
    lineHeight: 12,
    minHeight: 12,
  },
  monthPlaceholder: {
    minHeight: 12,
  },
  dateContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  selectedDateContainer: {
    backgroundColor: '#2563EB',
  },
  dateText: {
    fontSize: 15,
    color: '#111827',
  },
  selectedDateText: {
    color: '#FFFFFF',
  },
  todayText: {
    fontWeight: '700',
  },
  dotRow: {
    minHeight: 10,
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  overflowText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#374151',
    lineHeight: 10,
  },
});
