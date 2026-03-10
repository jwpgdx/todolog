import React, { useCallback, useRef } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
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
export default function TodoScreen() {
  const router = useRouter();
  const { currentDate } = useDateStore();
  const { data: todos, isLoading } = useTodos(currentDate);
  const { mutate: toggleCompletion } = useToggleCompletion();
  const { mutate: deleteTodo } = useDeleteTodo();
  const { openDetail } = useTodoFormStore();

  const currentDateRef = useRef(currentDate);
  currentDateRef.current = currentDate;

  const handleToggleComplete = useCallback((todoId) => {
    const actualDate = currentDateRef.current;

    console.log('🎯 [TodoScreen] 체크박스 클릭:', {
      todoId: todoId.slice(-8),
      actualDate,
      화면날짜: actualDate,
    });

    const todo = (todos || []).find((item) => item._id === todoId);
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
      전달할date: actualDate,
    });

    toggleCompletion({
      todoId,
      date: actualDate,
      currentCompleted: todo.completed,
      todo,
    });
  }, [todos, toggleCompletion]);

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
      <View style={styles.testEntryRow}>
        <TouchableOpacity
          onPress={() => router.push('/test/form-sheet')}
          activeOpacity={0.85}
          style={styles.devButton}
        >
          <Text style={styles.devButtonText}>Form Sheet Test</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/test/page-sheet')}
          activeOpacity={0.85}
          style={styles.devButton}
        >
          <Text style={styles.devButtonText}>Page Sheet Test</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/test/modals')}
          activeOpacity={0.85}
          style={styles.devButton}
        >
          <Text style={styles.devButtonText}>Modals Test</Text>
        </TouchableOpacity>
      </View>
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
  testEntryRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  devButton: {
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  devButtonText: {
    color: 'white',
    fontWeight: '700',
  },
});
