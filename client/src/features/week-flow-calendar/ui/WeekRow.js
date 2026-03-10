import React from 'react';
import { StyleSheet, View } from 'react-native';

import { WEEK_ROW_HEIGHT } from '../utils/weekFlowConstants';
import DayCell from './DayCell';

function isDateInWeek(dateYmd, weekStartYmd, weekEndYmd) {
  if (!dateYmd || !weekStartYmd || !weekEndYmd) return false;
  return dateYmd >= weekStartYmd && dateYmd <= weekEndYmd;
}

function WeekRow({ weekStart, days, selectedDate, todayDate, onDayPress }) {
  return (
    <View style={styles.row}>
      {days.map((day) => (
        <DayCell
          key={day.date}
          date={day.date}
          dayNumber={day.dayNumber}
          monthLabel={day.monthLabel}
          isEvenMonth={day.isEvenMonth}
          isSelected={day.date === selectedDate}
          isToday={day.date === todayDate}
          onPress={onDayPress}
        />
      ))}
    </View>
  );
}

function areEqual(prev, next) {
  if (prev.weekStart !== next.weekStart) return false;
  if (prev.days !== next.days) return false;
  if (prev.onDayPress !== next.onDayPress) return false;

  const weekEnd = prev.days?.[prev.days.length - 1]?.date || null;
  const weekStart = prev.weekStart;

  if (prev.todayDate !== next.todayDate) {
    const hadToday = isDateInWeek(prev.todayDate, weekStart, weekEnd);
    const hasToday = isDateInWeek(next.todayDate, weekStart, weekEnd);
    if (hadToday || hasToday) return false;
  }

  if (prev.selectedDate !== next.selectedDate) {
    const hadSelected = isDateInWeek(prev.selectedDate, weekStart, weekEnd);
    const hasSelected = isDateInWeek(next.selectedDate, weekStart, weekEnd);
    if (hadSelected || hasSelected) return false;
  }

  return true;
}

export default React.memo(WeekRow, areEqual);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    height: WEEK_ROW_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
});

