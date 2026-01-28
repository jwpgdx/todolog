import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, SafeAreaView } from "react-native";
import dayjs from 'dayjs';
import { useDateStore } from '../store/dateStore';
import { useTodos } from '../hooks/queries/useTodos';
import { useToggleCompletion } from '../hooks/queries/useToggleCompletion';
import { useCalendarEvents } from '../hooks/useCalendarEvents';

import DailyTodoList from '../features/todo/list/DailyTodoList';

import UltimateCalendar from '../components/ui/ultimate-calendar/UltimateCalendar';

/**
 * TodoScreen
 * 메인 투두 리스트 화면
 */
export default function TodoScreen({ navigation }) {
  // 1. 상태 및 데이터 훅
  const { currentDate } = useDateStore();
  const { data: todos, isLoading } = useTodos(currentDate);
  const { mutate: toggleCompletion } = useToggleCompletion();

  // 캘린더 이벤트 (월 기반)
  const currentYear = useMemo(() => dayjs(currentDate).year(), [currentDate]);
  const currentMonth = useMemo(() => dayjs(currentDate).month() + 1, [currentDate]);
  const { eventsByDate } = useCalendarEvents(currentYear, currentMonth);

  // 2. 핸들러
  const handleToggleComplete = useCallback((todoId) => {
    toggleCompletion({ todoId, date: currentDate });
  }, [currentDate, toggleCompletion]);

  return (
    <SafeAreaView style={styles.container}>
      {/* 주간/월간 캘린더 */}
      <UltimateCalendar eventsByDate={eventsByDate} />


      {/* 투두 리스트 (정렬/완료 기능 포함) */}
      <DailyTodoList
        date={currentDate}
        todos={todos}
        isLoading={isLoading}
        onToggleComplete={handleToggleComplete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
});
