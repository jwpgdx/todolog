import React from 'react';
import { View, StyleSheet } from 'react-native';
import DayCell from './DayCell';

/**
 * WeekRow Component
 * 
 * 주 단위 행 렌더링 (7개 DayCell)
 * 
 * @param {Object} props
 * @param {Array<DayObject>} props.week - 7개 날짜 객체 배열
 * @param {Object} props.todosByDate - 날짜별 Todo 맵 { 'YYYY-MM-DD': [todo, ...] }
 * @param {Object} props.completions - Completion 맵 { 'todoId_date': completion }
 * 
 * DayObject 구조:
 * {
 *   date: number,           // 1~31
 *   dateString: string,     // "2025-01-28" (unique key)
 *   isCurrentMonth: boolean,
 *   isToday: boolean
 * }
 */
function WeekRow({ week, todosByDate, completions }) {
  return (
    <View style={styles.row}>
      {week.map((day) => (
        <DayCell
          key={day.dateString}
          day={day}
          todos={todosByDate?.[day.dateString] || []}
          completions={completions}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    width: '100%',
  },
});

// React.memo로 최적화 - week 배열이 변경되지 않으면 리렌더링 방지
export default React.memo(WeekRow);
