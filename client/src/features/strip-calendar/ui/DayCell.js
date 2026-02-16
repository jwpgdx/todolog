import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

function DayCell({ day, summary, onPress }) {
  const dotColors = summary.uniqueCategoryColors.slice(0, 3);
  const overflow = summary.dotCount > 3;
  const isEvenMonth = (day.month + 1) % 2 === 0;

  return (
    <Pressable
      style={[styles.cell, isEvenMonth ? styles.evenMonthCell : styles.oddMonthCell]}
      onPress={() => onPress(day.date)}
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
