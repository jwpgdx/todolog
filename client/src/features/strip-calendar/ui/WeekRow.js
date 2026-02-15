import React from 'react';
import { StyleSheet, View } from 'react-native';
import dayjs from 'dayjs';
import DayCell from './DayCell';
import { DEBUG_STRIP_CALENDAR_WEEK_BANDING, WEEK_ROW_HEIGHT } from '../utils/stripCalendarConstants';

function getWeekBandColor(weekStart) {
  if (!DEBUG_STRIP_CALENDAR_WEEK_BANDING) return '#FFFFFF';

  const epochSunday = dayjs('1970-01-04');
  const weekNumber = Math.floor(dayjs(weekStart).diff(epochSunday, 'day') / 7);
  return Math.abs(weekNumber) % 2 === 0 ? '#FFFFFF' : '#F3F4F6';
}

function WeekRow({ weekDays, getSummaryByDate, onDayPress, weekStart }) {
  return (
    <View style={[styles.row, { backgroundColor: getWeekBandColor(weekStart) }]}>
      {weekDays.map((day) => (
        <DayCell
          key={day.date}
          day={day}
          summary={getSummaryByDate(day.date)}
          onPress={onDayPress}
        />
      ))}
    </View>
  );
}

export default React.memo(WeekRow);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    height: WEEK_ROW_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
});
