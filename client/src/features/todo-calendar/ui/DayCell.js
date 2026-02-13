import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

/**
 * DayCell Component
 * 
 * 개별 날짜 셀을 렌더링합니다.
 * 다른 달 날짜는 빈 공간으로 표시합니다.
 * Phase 2: Todo dot 표시 추가
 * 
 * @param {Object} props
 * @param {Object} props.day - DayObject
 * @param {number} props.day.date - 날짜 숫자 (1~31)
 * @param {string} props.day.dateString - 날짜 문자열 (YYYY-MM-DD)
 * @param {boolean} props.day.isCurrentMonth - 현재 월 여부
 * @param {boolean} props.day.isToday - 오늘 날짜 여부 (Phase 3에서 시각적 하이라이트 구현)
 * @param {Array} props.todos - 해당 날짜의 Todo 배열
 * @param {Object} props.completions - Completion 맵 (향후 완료율 표시용)
 * 
 * Requirements: 4.3, 4.4, 9.2, 9.4, 9.5
 */
function DayCell({ day, todos = [], completions }) {
  // Phase 1.5: 다른 월 날짜는 빈 공간으로 표시
  if (!day.isCurrentMonth) {
    return <View style={styles.cell} />;
  }

  // Phase 2: Todo dot 표시
  const hasTodos = todos && todos.length > 0;
  const dotColor = todos?.length === 1 ? todos[0].categoryColor : '#333';

  return (
    <View style={styles.cell}>
      <Text style={styles.dateText}>{day.date}</Text>
      {hasTodos && (
        <View style={[styles.todoDot, { backgroundColor: dotColor }]} />
      )}
    </View>
  );
}

// React.memo로 최적화 - day 객체가 변경되지 않으면 리렌더링 방지
export default React.memo(DayCell);

const styles = StyleSheet.create({
  cell: {
    width: SCREEN_WIDTH / 7,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    color: '#333',
  },
  todoDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
});
