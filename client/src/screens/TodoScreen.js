import React, { useCallback, useRef } from 'react';
import { StyleSheet, SafeAreaView } from "react-native";
import { useDateStore } from '../store/dateStore';
import { useTodos } from '../hooks/queries/useTodos';
import { useToggleCompletion } from '../hooks/queries/useToggleCompletion';
import { useDeleteTodo } from '../hooks/queries/useDeleteTodo';
import { useTodoFormStore } from '../store/todoFormStore';

import DailyTodoList from '../features/todo/list/DailyTodoList';

/**
 * TodoScreen
 * 메인 투두 리스트 화면
 */
export default function TodoScreen({ navigation }) {
  // 1. 상태 및 데이터 훅
  const { currentDate } = useDateStore();
  const { data: todos, isLoading } = useTodos(currentDate);
  const { mutate: toggleCompletion } = useToggleCompletion();
  const { mutate: deleteTodo } = useDeleteTodo();
  const { openDetail } = useTodoFormStore();

  // 🔧 Stale closure 방지: currentDate를 ref로 관리
  const currentDateRef = useRef(currentDate);
  currentDateRef.current = currentDate;

  // 2. 핸들러
  // 🔧 currentDate 대신 currentDateRef.current 사용하여 항상 최신 값 참조
  const handleToggleComplete = useCallback((todoId) => {
    const actualDate = currentDateRef.current;  // 항상 최신 날짜

    console.log('🎯 [TodoScreen] 체크박스 클릭:', {
      todoId: todoId.slice(-8),
      actualDate,
      화면날짜: actualDate
    });

    const todo = (todos || []).find(t => t._id === todoId);
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

  return (
    <SafeAreaView style={styles.container}>
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
});
