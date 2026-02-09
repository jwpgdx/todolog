import React, { useCallback, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from "react-native";
import { useDateStore } from '../store/dateStore';
import { useTodos } from '../hooks/queries/useTodos';
import { useToggleCompletion } from '../hooks/queries/useToggleCompletion';
import { useDeleteTodo } from '../hooks/queries/useDeleteTodo';
import { useTodoFormStore } from '../store/todoFormStore';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

import DailyTodoList from '../features/todo/list/DailyTodoList';

// ⚠️ [2026-02-06] UltimateCalendar 임시 비활성화
// 이유: SQLite/서버 동기화/카테고리 색상 동기화 이슈 해결 후 재활성화
// 복구 방법: 아래 주석 해제
// import UltimateCalendar from '../components/ui/ultimate-calendar/UltimateCalendar';

/**
 * TodoScreen
 * 메인 투두 리스트 화면
 */
export default function TodoScreen({ navigation }) {
  // 1. 상태 및 데이터 훅
  const { currentDate, setCurrentDate } = useDateStore();
  const { data: todos, isLoading } = useTodos(currentDate);
  const { mutate: toggleCompletion } = useToggleCompletion();
  const { mutate: deleteTodo } = useDeleteTodo();
  const { openDetail } = useTodoFormStore();
  const { t, i18n } = useTranslation();

  // 🔧 Stale closure 방지: currentDate를 ref로 관리
  const currentDateRef = useRef(currentDate);
  currentDateRef.current = currentDate;

  // 날짜 포맷
  const dateObj = dayjs(currentDate);
  const isToday = dateObj.isSame(dayjs(), 'day');
  const dateTitle = dateObj.locale(i18n.language).format(t('date.header_fmt'));
  const dayOfWeek = dateObj.locale(i18n.language).format('ddd'); // 요일 (월, 화, 수...)

  // 2. 핸들러
  // 🔧 currentDate 대신 currentDateRef.current 사용하여 항상 최신 값 참조
  const handleToggleComplete = useCallback((todoId) => {
    const actualDate = currentDateRef.current;  // 항상 최신 날짜

    console.log('🎯 [TodoScreen] 체크박스 클릭:', {
      todoId: todoId.slice(-8),
      actualDate,
      화면날짜: actualDate
    });

    const todo = todos.find(t => t._id === todoId);
    if (!todo) {
      console.error('❌ [TodoScreen] Todo를 찾을 수 없음:', todoId);
      return;
    }

    console.log('🎯 [TodoScreen] 토글 요청:', {
      todoId: todoId.slice(-8),
      title: todo.title,
      isRecurring: !!todo.recurrence,
      startDate: todo.startDate,
      endDate: todo.endDate,
      전달할date: actualDate
    });

    toggleCompletion({
      todoId,
      date: actualDate,  // ref.current 사용
      currentCompleted: todo.completed,
      todo
    });
  }, [todos, toggleCompletion]);  // currentDate 제거 (ref 사용)

  const handleEdit = useCallback((todo) => {
    console.log('✏️ [TodoScreen] 수정 버튼 클릭:', todo._id);
    openDetail(todo);
  }, [openDetail]);

  const handleDelete = useCallback((todo) => {
    console.log('🗑️ [TodoScreen] 삭제 버튼 클릭:', todo._id);
    deleteTodo(todo);
  }, [deleteTodo]);

  // 날짜 네비게이션
  const handlePrevDay = useCallback(() => {
    const prevDate = dateObj.subtract(1, 'day').format('YYYY-MM-DD');
    console.log('📆 [TodoScreen] 날짜 이동: ◀️', currentDate, '→', prevDate);
    setCurrentDate(prevDate);
  }, [dateObj, currentDate, setCurrentDate]);

  const handleNextDay = useCallback(() => {
    const nextDate = dateObj.add(1, 'day').format('YYYY-MM-DD');
    console.log('📆 [TodoScreen] 날짜 이동: ▶️', currentDate, '→', nextDate);
    setCurrentDate(nextDate);
  }, [dateObj, currentDate, setCurrentDate]);

  const handleToday = useCallback(() => {
    const today = dayjs().format('YYYY-MM-DD');
    console.log('📆 [TodoScreen] 오늘로 이동:', currentDate, '→', today);
    setCurrentDate(today);
  }, [currentDate, setCurrentDate]);

  return (
    <SafeAreaView style={styles.container}>
      {/* ⚠️ [2026-02-06] UltimateCalendar 임시 비활성화 */}
      {/* 이유: SQLite/서버 동기화/카테고리 색상 동기화 이슈 */}
      {/* 복구 방법: 아래 주석 해제 */}
      {/* <UltimateCalendar /> */}

      {/* 임시 날짜 네비게이션 헤더 */}
      <View style={styles.dateHeader}>
        <TouchableOpacity onPress={handlePrevDay} style={styles.arrowButton}>
          <Text style={styles.arrowText}>‹</Text>
        </TouchableOpacity>

        <View style={styles.dateCenter}>
          <Text style={styles.dateTitle}>{dateTitle}</Text>
          <Text style={styles.dayOfWeek}>{dayOfWeek}</Text>
          {!isToday && (
            <TouchableOpacity onPress={handleToday} style={styles.todayButton}>
              <Text style={styles.todayText}>{t('calendar.today')}</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={handleNextDay} style={styles.arrowButton}>
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* 투두 리스트 (정렬/완료 기능 포함) */}
      <DailyTodoList
        date={currentDate}
        todos={todos}
        isLoading={isLoading}
        onToggleComplete={handleToggleComplete}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  arrowButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: {
    fontSize: 28,
    color: '#007AFF',
    fontWeight: '300',
  },
  dateCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  dateTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  dayOfWeek: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  todayButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#007AFF',
  },
  todayText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
});
