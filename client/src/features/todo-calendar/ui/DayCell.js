import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

/**
 * DayCell Component
 * 
 * 개별 날짜 셀을 렌더링합니다.
 * 다른 달 날짜는 빈 공간으로 표시합니다.
 * 
 * @param {Object} props
 * @param {Object} props.day - DayObject
 * @param {number} props.day.date - 날짜 숫자 (1~31)
 * @param {string} props.day.dateString - 날짜 문자열 (YYYY-MM-DD)
 * @param {boolean} props.day.isCurrentMonth - 현재 월 여부
 * @param {boolean} props.day.isToday - 오늘 날짜 여부 (Phase 2에서 시각적 하이라이트 구현)
 * 
 * Requirements: 4.3, 4.4
 */
function DayCell({ day }) {
  return (
    <View style={styles.cell}>
      {day.isCurrentMonth && (
        <Text style={styles.dateText}>{day.date}</Text>
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
});
