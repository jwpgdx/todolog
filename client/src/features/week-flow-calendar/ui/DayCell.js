import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

function DayCell({
  date,
  dayNumber,
  monthLabel,
  isEvenMonth,
  isSelected,
  isToday,
  onPress,
}) {
  const handlePress = useCallback(() => {
    if (!date) return;
    onPress?.(date);
  }, [date, onPress]);

  return (
    <Pressable
      style={[styles.cell, isEvenMonth ? styles.evenMonthCell : styles.oddMonthCell]}
      onPress={handlePress}
    >
      {monthLabel ? <Text style={styles.monthLabel}>{monthLabel}</Text> : <View style={styles.monthPlaceholder} />}

      <View style={[styles.dateContainer, isSelected && styles.selectedDateContainer]}>
        <Text style={[styles.dateText, isSelected && styles.selectedDateText, isToday && styles.todayText]}>
          {dayNumber}
        </Text>
      </View>

      <View style={styles.dotRow} />
    </Pressable>
  );
}

export default React.memo(DayCell);

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  oddMonthCell: {
    backgroundColor: '#FFFFFF',
  },
  evenMonthCell: {
    backgroundColor: '#F8FAFC',
  },
  monthLabel: {
    fontSize: 9,
    color: '#6B7280',
    lineHeight: 10,
    minHeight: 10,
  },
  monthPlaceholder: {
    minHeight: 10,
  },
  dateContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedDateContainer: {
    backgroundColor: '#2563EB',
  },
  dateText: {
    fontSize: 13,
    color: '#111827',
  },
  selectedDateText: {
    color: '#FFFFFF',
  },
  todayText: {
    fontWeight: '700',
  },
  dotRow: {
    minHeight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

