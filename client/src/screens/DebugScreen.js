import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useToggleCompletion } from '../hooks/queries/useToggleCompletion';
import { useTodos } from '../hooks/queries/useTodos';
import NetInfo from '@react-native-community/netinfo';
// SQLite
import { initDatabase, getDbStats, resetDatabase } from '../db/database';
import {
  getTodosByDate as sqliteGetTodosByDate,
  getTodosByMonth as sqliteGetTodosByMonth,
  getAllTodos as sqliteGetAllTodos,
  getTodoCount,
} from '../db/todoService';
import {
  getCompletionsByDate as sqliteGetCompletionsByDate,
  toggleCompletion as sqliteToggleCompletion,
  getCompletionStats,
  getCompletionCount,
} from '../db/completionService';
import {
  getPendingChanges as sqliteGetPendingChanges,
  addPendingChange,
  clearPendingChanges as sqliteClearPendingChanges,
  getPendingChangesCount,
} from '../db/pendingService';
import {
  getAllCategories as sqliteGetAllCategories,
  getCategoryCount,
} from '../db/categoryService';

export default function DebugScreen() {
  const [logs, setLogs] = useState([]);
  const [selectedDate, setSelectedDate] = useState('2026-02-01');
  const queryClient = useQueryClient();
  const toggleCompletionMutation = useToggleCompletion();
  const { data: todos = [], refetch: refetchTodos } = useTodos(selectedDate);

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 100));
  };

  // ========== 기본 상태 확인 ==========

  const checkDbStatus = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🔍 SQLite DB 상태 확인');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const netInfo = await NetInfo.fetch();
      addLog(`🌐 네트워크: ${netInfo.isConnected ? '✅ 온라인' : '❌ 오프라인'} (${netInfo.type})`);
      addLog('');

      const stats = await getDbStats();
      addLog('📊 SQLite 통계:');
      addLog(`  - Todos: ${stats.todos}개`);
      addLog(`  - Completions: ${stats.completions}개`);
      addLog(`  - Categories: ${stats.categories}개`);
      addLog(`  - Pending: ${stats.pending}개`);
      addLog('');

      const cachedTodos = queryClient.getQueryData(['todos', 'all']);
      const cachedCategories = queryClient.getQueryData(['categories']);
      addLog('💾 React Query 캐시:');
      addLog(`  - Todos: ${cachedTodos?.length || 0}개`);
      addLog(`  - Categories: ${cachedCategories?.length || 0}개`);
    } catch (error) {
      addLog(`❌ 오류: ${error.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // ========== Completion 토글 테스트 ==========

  const checkCurrentTodos = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🔍 현재 Todo 상세 확인');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const netInfo = await NetInfo.fetch();
      addLog(`🌐 네트워크: ${netInfo.isConnected ? '✅ 온라인' : '❌ 오프라인'}`);
      addLog(`📅 날짜: ${selectedDate}`);
      addLog(`📊 Todo 개수: ${todos.length}개`);
      addLog('');

      if (todos.length === 0) {
        addLog('⚠️ Todo가 없습니다');
        addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        return;
      }

      const completions = await sqliteGetCompletionsByDate(selectedDate);
      addLog(`💾 SQLite Completions: ${Object.keys(completions).length}개`);
      addLog('');

      todos.forEach((todo, index) => {
        const key = `${todo._id}_${selectedDate}`;
        const hasCompletion = !!completions[key];

        addLog(`[${index + 1}] ${todo.title}`);
        addLog(`    _id: ${todo._id.slice(-8)}`);
        addLog(`    completed (UI): ${todo.completed ? '✅' : '⬜'}`);
        addLog(`    SQLite: ${hasCompletion ? '✅' : '⬜'}`);

        if (todo.completed !== hasCompletion) {
          addLog(`    ⚠️ 불일치 발견!`);
        }
        addLog('');
      });
    } catch (error) {
      addLog(`❌ 오류: ${error.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  const testToggleCompletion = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🔄 Completion 토글 테스트');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (todos.length === 0) {
      addLog('❌ Todo가 없습니다');
      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return;
    }

    const todo = todos[0];
    const date = selectedDate;

    addLog(`📌 Todo: ${todo.title}`);
    addLog(`📅 Date: ${date}`);
    addLog(`🔄 현재 상태: ${todo.completed ? '✅ 완료' : '⬜ 미완료'}`);
    addLog('');

    try {
      addLog('━━━ Step 1: 토글 전 상태 ━━━');
      const beforeCompletions = await sqliteGetCompletionsByDate(date);
      const key = `${todo._id}_${date}`;
      const beforeState = !!beforeCompletions[key];
      addLog(`SQLite: ${beforeState ? '✅ 완료' : '⬜ 미완료'}`);
      addLog('');

      addLog('━━━ Step 2: 토글 실행 ━━━');
      await toggleCompletionMutation.mutateAsync({
        todoId: todo._id,
        date: date,
        currentCompleted: todo.completed,
      });
      addLog('✅ 토글 완료');
      addLog('');

      addLog('━━━ Step 3: 토글 후 상태 ━━━');
      const afterCompletions = await sqliteGetCompletionsByDate(date);
      const afterState = !!afterCompletions[key];
      addLog(`SQLite: ${afterState ? '✅ 완료' : '⬜ 미완료'}`);

      const pending = await sqliteGetPendingChanges();
      const todoPending = pending.filter(p => p.todoId === todo._id && p.date === date);
      addLog(`Pending: ${todoPending.length}개`);
      if (todoPending.length > 0) {
        todoPending.forEach(p => addLog(`  - ${p.type}`));
      }
      addLog('');

      addLog('━━━ Step 4: UI 재조회 ━━━');
      await refetchTodos();
      const updatedTodos = queryClient.getQueryData(['todos', date]) || [];
      const updatedTodo = updatedTodos.find(t => t._id === todo._id);
      if (updatedTodo) {
        addLog(`UI: ${updatedTodo.completed ? '✅ 완료' : '⬜ 미완료'}`);
      } else {
        addLog('⚠️ Todo를 찾을 수 없습니다');
      }

      addLog('');
      addLog('🎉 토글 테스트 완료!');
    } catch (error) {
      addLog(`❌ 토글 실패: ${error.message}`);
      console.error('Toggle error:', error);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  const checkPendingChanges = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('⏳ Pending Changes 확인');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const pending = await sqliteGetPendingChanges();
      const completionPending = pending.filter(p =>
        p.type === 'createCompletion' || p.type === 'deleteCompletion'
      );

      addLog(`⏳ 전체 Pending: ${pending.length}개`);
      addLog(`✅ Completion Pending: ${completionPending.length}개`);
      addLog('');

      if (completionPending.length === 0) {
        addLog('✅ Completion Pending 없음');
      } else {
        addLog('📋 Completion Pending:');
        completionPending.forEach((p, index) => {
          addLog(`  [${index + 1}] ${p.type}`);
          addLog(`      todoId: ${p.todoId?.slice(-8)}`);
          addLog(`      date: ${p.date || 'null'}`);
          addLog(`      created: ${new Date(p.createdAt).toLocaleString()}`);
          addLog('');
        });
      }
    } catch (error) {
      addLog(`❌ 오류: ${error.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // ========== SQLite 조회 테스트 ==========

  const sqlite_TodosByDate = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog(`📋 날짜별 Todo 조회: ${selectedDate}`);
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const todos = await sqliteGetTodosByDate(selectedDate);
      addLog(`📊 결과: ${todos.length}개`);
      addLog('');

      if (todos.length === 0) {
        addLog('⚠️ 해당 날짜에 Todo가 없습니다');
      } else {
        todos.forEach((todo, i) => {
          addLog(`[${i + 1}] ${todo.title}`);
          addLog(`    ID: ${todo._id.slice(-8)}`);
          addLog(`    카테고리: ${todo.category?.name || '없음'} (${todo.category?.color || '-'})`);
        });
      }
    } catch (error) {
      addLog(`❌ 오류: ${error.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  const sqlite_AllTodos = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('📋 전체 Todo 조회');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const todos = await sqliteGetAllTodos();
      const count = await getTodoCount();
      addLog(`📊 총 ${count}개`);
      addLog('');

      todos.slice(0, 10).forEach((todo, i) => {
        addLog(`[${i + 1}] ${todo.title}`);
        addLog(`    날짜: ${todo.date || `${todo.startDate} ~ ${todo.endDate}`}`);
      });

      if (todos.length > 10) {
        addLog(`  ... 외 ${todos.length - 10}개`);
      }
    } catch (error) {
      addLog(`❌ 오류: ${error.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  const sqlite_CompletionsByDate = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog(`✅ 날짜별 Completion: ${selectedDate}`);
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const completions = await sqliteGetCompletionsByDate(selectedDate);
      const count = Object.keys(completions).length;
      addLog(`📊 결과: ${count}개`);
      addLog('');

      if (count === 0) {
        addLog('⚠️ 해당 날짜에 완료된 Todo가 없습니다');
      } else {
        Object.entries(completions).forEach(([key, comp]) => {
          addLog(`- ${key}`);
          addLog(`  completedAt: ${new Date(comp.completedAt).toLocaleString()}`);
        });
      }
    } catch (error) {
      addLog(`❌ 오류: ${error.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  const sqlite_CategoryList = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('📂 Categories 목록');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const categories = await sqliteGetAllCategories();
      const count = await getCategoryCount();

      addLog(`📊 총 ${count}개`);
      addLog('');

      categories.forEach((cat, i) => {
        addLog(`[${i + 1}] ${cat.name}`);
        addLog(`    ID: ${cat._id.slice(-8)}`);
        addLog(`    색상: ${cat.color}`);
        addLog(`    순서: ${cat.order}`);
      });
    } catch (error) {
      addLog(`❌ 오류: ${error.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // ========== 위험한 작업 ==========

  const clearCache = () => {
    queryClient.clear();
    addLog(`🗑️ React Query 캐시 클리어 완료`);
    addLog(`💡 앱을 재시작하여 초기 로딩 테스트`);
  };

  const clearPending = async () => {
    const confirmClear = () => {
      return new Promise((resolve) => {
        if (Platform.OS === 'web') {
          const confirmed = window.confirm('⚠️ Pending Changes를 삭제하시겠습니까?');
          resolve(confirmed);
        } else {
          Alert.alert(
            '⚠️ Pending 삭제',
            'Pending Changes를 삭제하시겠습니까?',
            [
              { text: '취소', style: 'cancel', onPress: () => resolve(false) },
              { text: '삭제', style: 'destructive', onPress: () => resolve(true) }
            ]
          );
        }
      });
    };

    const confirmed = await confirmClear();
    if (!confirmed) {
      addLog('❌ 삭제 취소됨');
      return;
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🗑️ Pending Changes 삭제');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      await sqliteClearPendingChanges();
      addLog('✅ 삭제 완료!');

      const count = await getPendingChangesCount();
      addLog(`📊 현재 Pending: ${count}개`);
    } catch (error) {
      addLog(`❌ 오류: ${error.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  const resetDb = async () => {
    const confirmReset = () => {
      return new Promise((resolve) => {
        if (Platform.OS === 'web') {
          const confirmed = window.confirm(
            '⚠️ SQLite 데이터를 전체 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다!'
          );
          resolve(confirmed);
        } else {
          Alert.alert(
            '⚠️ SQLite 전체 삭제',
            'SQLite 데이터를 전체 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다!',
            [
              { text: '취소', style: 'cancel', onPress: () => resolve(false) },
              { text: '삭제', style: 'destructive', onPress: () => resolve(true) }
            ]
          );
        }
      });
    };

    const confirmed = await confirmReset();
    if (!confirmed) {
      addLog('❌ 삭제 취소됨');
      return;
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🗑️ SQLite 전체 초기화');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      await resetDatabase();
      addLog('✅ SQLite 전체 초기화 완료');

      const stats = await getDbStats();
      addLog('');
      addLog('📊 현재 상태:');
      addLog(`  - Todos: ${stats.todos}개`);
      addLog(`  - Completions: ${stats.completions}개`);
      addLog(`  - Categories: ${stats.categories}개`);
    } catch (error) {
      addLog(`❌ 초기화 실패: ${error.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔧 Debug Screen (SQLite)</Text>

      <View style={styles.dateSelector}>
        <Text style={styles.dateLabel}>테스트 날짜:</Text>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => {
            const dates = ['2026-02-01', '2026-02-05', '2026-02-06', '2026-02-07'];
            const currentIndex = dates.indexOf(selectedDate);
            const nextIndex = (currentIndex + 1) % dates.length;
            setSelectedDate(dates[nextIndex]);
            addLog(`📅 날짜 변경: ${dates[nextIndex]}`);
          }}
        >
          <Text style={styles.dateButtonText}>{selectedDate}</Text>
        </TouchableOpacity>
        <Text style={styles.todoCount}>({todos.length}개)</Text>
      </View>

      <ScrollView style={styles.buttonContainer}>
        <Text style={styles.sectionTitle}>📊 기본 상태 확인</Text>

        <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={checkDbStatus}>
          <Text style={styles.buttonText}>🔍 DB 상태 확인</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={checkCurrentTodos}>
          <Text style={styles.buttonText}>🔍 현재 Todo 상세 확인</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>✅ Completion 토글 테스트</Text>

        <TouchableOpacity style={[styles.button, styles.actionButton]} onPress={testToggleCompletion}>
          <Text style={styles.buttonText}>🔄 Completion 토글 테스트</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.testButton]} onPress={checkPendingChanges}>
          <Text style={styles.buttonText}>⏳ Pending Changes 확인</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>🗄️ SQLite 조회</Text>

        <TouchableOpacity style={[styles.button, styles.sqliteButton]} onPress={sqlite_TodosByDate}>
          <Text style={styles.buttonText}>📋 날짜별 Todo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.sqliteButton]} onPress={sqlite_AllTodos}>
          <Text style={styles.buttonText}>📋 전체 Todo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.sqliteButton]} onPress={sqlite_CompletionsByDate}>
          <Text style={styles.buttonText}>✅ 날짜별 Completion</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.sqliteButton]} onPress={sqlite_CategoryList}>
          <Text style={styles.buttonText}>📂 Categories</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>⚠️ 위험한 작업</Text>

        <TouchableOpacity style={[styles.button, styles.warningButton]} onPress={clearCache}>
          <Text style={styles.buttonText}>🗑️ 캐시 클리어</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.warningButton]} onPress={clearPending}>
          <Text style={styles.buttonText}>🗑️ Pending 삭제</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={resetDb}>
          <Text style={styles.buttonText}>🗑️ SQLite 전체 초기화</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.logContainer}>
        <Text style={styles.logTitle}>📋 로그</Text>
        <ScrollView style={styles.logScroll}>
          {logs.map((log, index) => (
            <Text key={index} style={styles.logText}>{log}</Text>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  dateLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginRight: 8,
  },
  dateButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 8,
  },
  dateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  todoCount: {
    fontSize: 14,
    color: '#6b7280',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 8,
    marginBottom: 8,
  },
  buttonContainer: {
    flex: 1,
    marginBottom: 16,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
  },
  testButton: {
    backgroundColor: '#8b5cf6',
  },
  actionButton: {
    backgroundColor: '#10b981',
  },
  warningButton: {
    backgroundColor: '#f59e0b',
  },
  dangerButton: {
    backgroundColor: '#ef4444',
  },
  sqliteButton: {
    backgroundColor: '#0891b2',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#d1d5db',
    marginVertical: 16,
  },
  logContainer: {
    height: 300,
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
  },
  logTitle: {
    color: '#f3f4f6',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  logScroll: {
    flex: 1,
  },
  logText: {
    color: '#d1d5db',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
});
