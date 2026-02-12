import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import CalendarList from '../features/todo-calendar/ui/CalendarList';

/**
 * TodoCalendarScreen
 * 
 * 새로운 월별 무한 스크롤 캘린더 화면
 * Phase 1 (Infinite Scroll Calendar) 구현 완료
 * 
 * Features:
 * - 월별 무한 스크롤 (±12개월 버퍼)
 * - 6주 고정 레이아웃
 * - Settings 연동 (startDayOfWeek, language)
 * - 60fps 성능 유지
 * 
 * Related:
 * - CalendarList: FlashList 기반 무한 스크롤
 * - MonthSection: 월 단위 렌더링
 * - useInfiniteCalendar: 무한 스크롤 로직
 * - calendarStore: 월 메타데이터 관리
 */
export default function TodoCalendarScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <CalendarList />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
