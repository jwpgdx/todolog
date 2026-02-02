import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { todoAPI } from '../api/todos';
import { useToggleCompletion } from '../hooks/queries/useToggleCompletion';
import { useTodos } from '../hooks/queries/useTodos';
import NetInfo from '@react-native-community/netinfo';
// SQLite
import {
  initDatabase,
  getDatabase,
  getMetadata,
  setMetadata,
  getAllMetadata,
  migrateFromAsyncStorage,
  rollbackMigration,
  simulateMigration,
  getDbStats,
  resetDatabase
} from '../db/database';
import {
  getTodosByDate as sqliteGetTodosByDate,
  getTodosByMonth as sqliteGetTodosByMonth,
  getTodoById,
  getAllTodos as sqliteGetAllTodos,
  upsertTodo,
  deleteTodo as sqliteDeleteTodo,
  getTodoCount,
} from '../db/todoService';
import {
  getCompletionsByDate as sqliteGetCompletionsByDate,
  getCompletionsByMonth as sqliteGetCompletionsByMonth,
  toggleCompletion as sqliteToggleCompletion,
  getAllCompletions as sqliteGetAllCompletions,
  getCompletionStats,
  getCompletionCount,
} from '../db/completionService';
import {
  getPendingChanges as sqliteGetPendingChanges,
  addPendingChange,
  removePendingChange,
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
  const toggleCompletion = useToggleCompletion();
  const { data: todos = [], refetch: refetchTodos } = useTodos(selectedDate);

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 50));
  };

  // 1. 전체 상태 확인
  const checkAllStatus = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🔍 전체 상태 확인 시작');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 네트워크
    const netInfo = await NetInfo.fetch();
    addLog(`🌐 네트워크: ${netInfo.isConnected ? '✅ 온라인' : '❌ 오프라인'} (${netInfo.type})`);
    addLog('');

    // AsyncStorage - Todos
    const localTodos = await loadTodos();
    addLog(`📦 AsyncStorage Todos: ${localTodos.length}개`);
    if (localTodos.length > 0) {
      const sample = localTodos[0];
      addLog(`  샘플: ${sample.title}`);
      addLog(`  카테고리ID: ${sample.categoryId || '없음'}`);
    }
    addLog('');

    // AsyncStorage - Categories
    const localCategories = await loadCategories();
    addLog(`📦 AsyncStorage Categories: ${localCategories.length}개`);
    if (localCategories.length > 0) {
      localCategories.forEach(cat => {
        addLog(`  - ${cat.name}: ${cat.color}`);
      });
    } else {
      addLog(`  ⚠️ 카테고리 없음!`);
    }
    addLog('');

    // React Query 캐시 - Todos
    const cachedTodos = queryClient.getQueryData(['todos', 'all']);
    addLog(`💾 React Query Todos: ${cachedTodos?.length || 0}개`);
    addLog('');

    // React Query 캐시 - Categories
    const cachedCategories = queryClient.getQueryData(['categories']);
    addLog(`💾 React Query Categories: ${cachedCategories?.length || 0}개`);
    if (cachedCategories && cachedCategories.length > 0) {
      cachedCategories.forEach(cat => {
        addLog(`  - ${cat.name}: ${cat.color}`);
      });
    } else {
      addLog(`  ⚠️ 캐시에 카테고리 없음!`);
    }
    addLog('');

    // 색상 매핑 테스트
    if (cachedTodos && cachedTodos.length > 0 && cachedCategories && cachedCategories.length > 0) {
      const categoryColorMap = {};
      cachedCategories.forEach(c => categoryColorMap[c._id] = c.color);

      addLog(`🎨 색상 매핑 테스트:`);
      const sampleTodo = cachedTodos[0];
      const mappedColor = categoryColorMap[sampleTodo.categoryId];
      addLog(`  Todo: ${sampleTodo.title}`);
      addLog(`  카테고리ID: ${sampleTodo.categoryId}`);
      addLog(`  매핑된 색상: ${mappedColor || '❌ 없음 (#808080 fallback)'}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('✅ 전체 상태 확인 완료');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // 2. Categories 캐시 주입 테스트
  const testCategoriesCache = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🧪 Categories 캐시 주입 테스트');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 1. 현재 캐시 확인
    const beforeCache = queryClient.getQueryData(['categories']);
    addLog(`1️⃣ 현재 캐시: ${beforeCache?.length || 0}개`);

    // 2. AsyncStorage에서 로드
    const localCategories = await loadCategories();
    addLog(`2️⃣ AsyncStorage: ${localCategories.length}개`);

    if (localCategories.length === 0) {
      addLog(`⚠️ AsyncStorage에 카테고리 없음!`);
      addLog(`💡 먼저 온라인 상태에서 앱을 실행하여 카테고리를 동기화하세요.`);
      return;
    }

    // 3. 캐시에 주입
    queryClient.setQueryData(['categories'], localCategories);
    addLog(`3️⃣ 캐시 주입 완료`);

    // 4. 주입 후 확인
    const afterCache = queryClient.getQueryData(['categories']);
    addLog(`4️⃣ 주입 후 캐시: ${afterCache?.length || 0}개`);

    if (afterCache && afterCache.length > 0) {
      addLog(`✅ 성공! 카테고리 목록:`);
      afterCache.forEach(cat => {
        addLog(`  - ${cat.name}: ${cat.color}`);
      });
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // 3. useCalendarDynamicEvents 시뮬레이션
  const testEventColorMapping = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🎨 이벤트 색상 매핑 테스트');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const todos = queryClient.getQueryData(['todos', 'all']);
    const categories = queryClient.getQueryData(['categories']);

    addLog(`1️⃣ Todos: ${todos?.length || 0}개`);
    addLog(`2️⃣ Categories: ${categories?.length || 0}개`);

    // Guard Clause 체크
    if (!todos || !categories || categories.length === 0) {
      addLog(`❌ Guard Clause 실패!`);
      addLog(`  - todos: ${todos ? '✅' : '❌'}`);
      addLog(`  - categories: ${categories ? '✅' : '❌'}`);
      addLog(`  - categories.length > 0: ${categories?.length > 0 ? '✅' : '❌'}`);
      addLog(`💡 이 상태에서는 빈 객체 {} 반환 → 회색 dot`);
      return;
    }

    addLog(`✅ Guard Clause 통과`);
    addLog('');

    // 색상 매핑
    const categoryColorMap = {};
    categories.forEach(c => categoryColorMap[c._id] = c.color);

    addLog(`3️⃣ 색상 맵 생성:`);
    Object.entries(categoryColorMap).forEach(([id, color]) => {
      const cat = categories.find(c => c._id === id);
      addLog(`  ${cat?.name}: ${color}`);
    });
    addLog('');

    // 샘플 이벤트 매핑
    if (todos.length > 0) {
      addLog(`4️⃣ 샘플 이벤트 매핑 (최대 5개):`);
      todos.slice(0, 5).forEach(todo => {
        const color = categoryColorMap[todo.categoryId] || '#808080';
        const cat = categories.find(c => c._id === todo.categoryId);
        addLog(`  ${todo.title}`);
        addLog(`    카테고리: ${cat?.name || '없음'}`);
        addLog(`    색상: ${color} ${color === '#808080' ? '❌ 회색!' : '✅'}`);
      });
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // 4. 캐시 클리어 (테스트용)
  const clearCache = () => {
    queryClient.clear();
    addLog(`🗑️ React Query 캐시 클리어 완료`);
    addLog(`💡 앱을 재시작하여 초기 로딩 테스트`);
  };

  // 5. Categories 캐시 강제 주입
  const forceInjectCategories = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('💉 Categories 강제 주입');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const localCategories = await loadCategories();

    if (localCategories.length === 0) {
      addLog(`❌ AsyncStorage에 카테고리 없음`);
      addLog(`💡 온라인 상태에서 먼저 동기화 필요`);
      return;
    }

    queryClient.setQueryData(['categories'], localCategories);
    addLog(`✅ 강제 주입 완료: ${localCategories.length}개`);
    addLog(`💡 UltimateCalendar로 이동하여 색상 확인`);

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // 6. categoryId null인 Todos 확인
  const checkNullCategoryTodos = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🔍 categoryId null 확인');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const todos = queryClient.getQueryData(['todos', 'all']) || [];
    const nullCategoryTodos = todos.filter(t => !t.categoryId || t.categoryId === null);

    addLog(`📊 전체 Todos: ${todos.length}개`);
    addLog(`❌ categoryId null: ${nullCategoryTodos.length}개`);
    addLog('');

    if (nullCategoryTodos.length > 0) {
      addLog(`⚠️ categoryId가 null인 Todos:`);
      nullCategoryTodos.slice(0, 10).forEach(todo => {
        addLog(`  - ${todo.title}`);
        addLog(`    ID: ${todo._id}`);
        addLog(`    categoryId: ${todo.categoryId}`);
      });
      addLog('');
      addLog(`💡 해결 방법:`);
      addLog(`  1. 앱에서 해당 일정을 수정하여 카테고리 설정`);
      addLog(`  2. 또는 서버 DB에서 직접 수정`);
    } else {
      addLog(`✅ 모든 Todos에 categoryId 있음`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // 6-2. categoryId 타입 상세 확인
  const checkCategoryIdType = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🔍 categoryId 타입 상세 확인');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const todos = queryClient.getQueryData(['todos', 'all']) || [];

    addLog(`📊 전체 Todos: ${todos.length}개`);
    addLog('');

    todos.forEach((todo, index) => {
      const categoryId = todo.categoryId;
      const categoryIdType = typeof categoryId;
      const isObject = categoryIdType === 'object' && categoryId !== null;

      addLog(`[${index + 1}] ${todo.title}`);
      addLog(`    categoryId: ${JSON.stringify(categoryId)}`);
      addLog(`    타입: ${categoryIdType}`);
      addLog(`    객체 여부: ${isObject ? '❌ 객체!' : '✅ 문자열'}`);

      if (isObject) {
        addLog(`    객체 내용:`);
        addLog(`      _id: ${categoryId._id}`);
        addLog(`      name: ${categoryId.name}`);
        addLog(`      color: ${categoryId.color}`);
      }
      addLog('');
    });

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // 6-3. categoryId 객체 → 문자열 변환
  const fixCategoryIdObjects = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🔧 categoryId 객체 → 문자열 변환');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const todos = queryClient.getQueryData(['todos', 'all']) || [];

    if (todos.length === 0) {
      addLog('⚠️ Todo가 없습니다');
      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return;
    }

    let fixedCount = 0;
    const fixedTodos = todos.map(todo => {
      const categoryId = todo.categoryId;
      const isObject = typeof categoryId === 'object' && categoryId !== null;

      if (isObject) {
        fixedCount++;
        addLog(`✅ 수정: ${todo.title}`);
        addLog(`   ${JSON.stringify(categoryId)} → ${categoryId._id}`);
        return {
          ...todo,
          categoryId: categoryId._id
        };
      }

      return todo;
    });

    addLog('');
    addLog(`📊 수정 완료: ${fixedCount}/${todos.length}개`);

    if (fixedCount > 0) {
      // React Query 캐시 업데이트
      queryClient.setQueryData(['todos', 'all'], fixedTodos);
      addLog('💾 React Query 캐시 업데이트 완료');

      // AsyncStorage 업데이트
      await saveTodos(fixedTodos);
      addLog('📦 AsyncStorage 업데이트 완료');

      addLog('');
      addLog('🎉 categoryId 수정 완료!');
      addLog('💡 이제 캘린더에서 색상이 정상적으로 표시됩니다');
    } else {
      addLog('');
      addLog('✅ 수정할 Todo가 없습니다 (모두 정상)');
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // 6-4. Completion 캐시 vs AsyncStorage 비교
  const checkCompletionCache = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🔬 Completion 캐시 vs AsyncStorage 비교');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // React Query 캐시
    const cachedCompletions = queryClient.getQueryData(['completions']) || {};
    addLog(`💾 React Query 캐시: ${Object.keys(cachedCompletions).length}개`);

    // AsyncStorage
    const storageCompletions = await loadCompletions();
    addLog(`📦 AsyncStorage: ${Object.keys(storageCompletions).length}개`);
    addLog('');

    // 차이점 확인
    const cacheKeys = new Set(Object.keys(cachedCompletions));
    const storageKeys = new Set(Object.keys(storageCompletions));

    const onlyInCache = [...cacheKeys].filter(k => !storageKeys.has(k));
    const onlyInStorage = [...storageKeys].filter(k => !cacheKeys.has(k));

    if (onlyInCache.length > 0) {
      addLog(`⚠️ 캐시에만 있음 (${onlyInCache.length}개):`);
      onlyInCache.slice(0, 5).forEach(key => {
        addLog(`  - ${key}`);
      });
      addLog('');
    }

    if (onlyInStorage.length > 0) {
      addLog(`⚠️ AsyncStorage에만 있음 (${onlyInStorage.length}개):`);
      onlyInStorage.slice(0, 5).forEach(key => {
        addLog(`  - ${key}`);
      });
      addLog('');
    }

    if (onlyInCache.length === 0 && onlyInStorage.length === 0) {
      addLog('✅ 캐시와 AsyncStorage가 동일합니다');
      addLog('');

      // 샘플 출력
      if (Object.keys(cachedCompletions).length > 0) {
        addLog('📋 샘플 (최대 5개):');
        Object.keys(cachedCompletions).slice(0, 5).forEach(key => {
          addLog(`  - ${key}`);
        });
      }
    } else {
      addLog('❌ 캐시와 AsyncStorage가 다릅니다!');
      addLog('💡 "🔧 Completion 캐시 동기화" 버튼을 눌러 수정하세요');
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // 6-5. Completion 캐시 동기화 (AsyncStorage → 캐시)
  const syncCompletionCache = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🔧 Completion 캐시 동기화');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const storageCompletions = await loadCompletions();
    addLog(`📦 AsyncStorage: ${Object.keys(storageCompletions).length}개`);

    queryClient.setQueryData(['completions'], storageCompletions);
    addLog(`💾 React Query 캐시 업데이트 완료`);

    // 캐시 무효화하여 UI 재렌더링
    queryClient.invalidateQueries(['todos']);
    addLog(`🔄 Todo 캐시 무효화 완료`);

    addLog('');
    addLog('🎉 Completion 캐시 동기화 완료!');
    addLog('💡 이제 완료 상태가 정상적으로 표시됩니다');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // 6-6. 특정 Todo 상세 확인
  const checkSpecificTodo = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🔍 특정 Todo 상세 확인');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const todoId = '697f68253375012bec71e2d9';
    const dates = ['2026-02-05', '2026-02-06', '2026-02-07'];

    addLog(`📌 Todo ID: ${todoId}`);
    addLog('');

    // 캐시에서 Todo 찾기
    const allTodos = queryClient.getQueryData(['todos', 'all']) || [];
    const todo = allTodos.find(t => t._id === todoId);

    if (!todo) {
      addLog('❌ Todo를 찾을 수 없습니다');
      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return;
    }

    addLog(`📝 Todo: ${todo.title}`);
    addLog(`   카테고리: ${todo.categoryId}`);
    addLog(`   반복: ${todo.recurrence || '없음'}`);
    addLog('');

    // Completion 캐시 확인
    const completions = queryClient.getQueryData(['completions']) || {};

    addLog('✅ Completion 상태:');
    dates.forEach(date => {
      const key = `${todoId}_${date}`;
      const hasCompletion = !!completions[key];
      addLog(`   ${date}: ${hasCompletion ? '✅ 완료' : '⬜ 미완료'}`);
      if (hasCompletion) {
        addLog(`      completedAt: ${completions[key].completedAt}`);
      }
    });
    addLog('');

    // AsyncStorage 확인
    const storageCompletions = await loadCompletions();
    addLog('📦 AsyncStorage Completion:');
    dates.forEach(date => {
      const key = `${todoId}_${date}`;
      const hasCompletion = !!storageCompletions[key];
      addLog(`   ${date}: ${hasCompletion ? '✅ 완료' : '⬜ 미완료'}`);
    });
    addLog('');

    // Pending Changes 확인
    const pending = await getPendingChanges();
    const todoPending = pending.filter(p => p.todoId === todoId);
    addLog(`⏳ Pending Changes: ${todoPending.length}개`);
    if (todoPending.length > 0) {
      todoPending.forEach(p => {
        addLog(`   ${p.type}: ${p.date}`);
      });
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // 6-7. 오프라인 완료 취소 시뮬레이션
  const simulateOfflineToggle = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🧪 오프라인 완료 취소 시뮬레이션');
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

    // Step 1: 현재 상태 확인
    addLog('━━━ Step 1: 현재 상태 확인 ━━━');
    const completionsBefore = queryClient.getQueryData(['completions']) || {};
    const keyBefore = `${todo._id}_${date}`;
    addLog(`캐시: ${!!completionsBefore[keyBefore] ? '✅ 완료' : '⬜ 미완료'}`);

    const storageBefore = await loadCompletions();
    addLog(`AsyncStorage: ${!!storageBefore[keyBefore] ? '✅ 완료' : '⬜ 미완료'}`);
    addLog('');

    // Step 2: 토글 실행
    addLog('━━━ Step 2: 토글 실행 ━━━');
    try {
      await toggleCompletion.mutateAsync({
        todoId: todo._id,
        date: date,
        currentCompleted: todo.completed,
      });
      addLog('✅ 토글 완료');
    } catch (error) {
      addLog(`❌ 토글 실패: ${error.message}`);
      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return;
    }
    addLog('');

    // Step 3: 토글 후 상태 확인
    addLog('━━━ Step 3: 토글 후 상태 확인 ━━━');
    const completionsAfter = queryClient.getQueryData(['completions']) || {};
    addLog(`캐시: ${!!completionsAfter[keyBefore] ? '✅ 완료' : '⬜ 미완료'}`);

    const storageAfter = await loadCompletions();
    addLog(`AsyncStorage: ${!!storageAfter[keyBefore] ? '✅ 완료' : '⬜ 미완료'}`);

    const pending = await getPendingChanges();
    const todoPending = pending.filter(p => p.todoId === todo._id && p.date === date);
    addLog(`Pending: ${todoPending.length}개`);
    if (todoPending.length > 0) {
      todoPending.forEach(p => addLog(`  - ${p.type}`));
    }
    addLog('');

    // Step 4: UI 상태 확인
    addLog('━━━ Step 4: UI 상태 확인 ━━━');
    await refetchTodos();
    const updatedTodos = queryClient.getQueryData(['todos', date]) || [];
    const updatedTodo = updatedTodos.find(t => t._id === todo._id);
    if (updatedTodo) {
      addLog(`UI: ${updatedTodo.completed ? '✅ 완료' : '⬜ 미완료'}`);
    } else {
      addLog('⚠️ Todo를 찾을 수 없습니다');
    }

    addLog('');
    addLog('🎉 시뮬레이션 완료!');
    addLog('💡 위 로그를 확인하여 각 단계의 상태를 검증하세요');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // 6-8. 현재 Todo 상세 확인
  const checkCurrentTodos = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🔍 현재 Todo 상세 확인');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

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

    // Completion 캐시
    const completions = queryClient.getQueryData(['completions']) || {};
    addLog(`💾 Completion 캐시: ${Object.keys(completions).length}개`);
    addLog('');

    // 각 Todo 상세 정보
    todos.forEach((todo, index) => {
      const key = `${todo._id}_${selectedDate}`;
      const hasCompletion = !!completions[key];

      addLog(`[${index + 1}] ${todo.title}`);
      addLog(`    _id: ${todo._id}`);
      addLog(`    completed (Todo 객체): ${todo.completed ? '✅' : '⬜'}`);
      addLog(`    Completion 캐시: ${hasCompletion ? '✅' : '⬜'}`);

      if (todo.completed !== hasCompletion) {
        addLog(`    ⚠️ 불일치 발견!`);
      }
      addLog('');
    });

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // 7. 전체 일정 삭제
  const deleteAllTodos = async () => {
    const confirmDelete = () => {
      return new Promise((resolve) => {
        if (Platform.OS === 'web') {
          const confirmed = window.confirm('⚠️ 모든 일정을 삭제하시겠습니까?\n\n서버와 로컬 저장소의 모든 일정이 삭제됩니다.\n이 작업은 되돌릴 수 없습니다!');
          resolve(confirmed);
        } else {
          Alert.alert(
            '⚠️ 전체 일정 삭제',
            '모든 일정을 삭제하시겠습니까?\n\n서버와 로컬 저장소의 모든 일정이 삭제됩니다.\n이 작업은 되돌릴 수 없습니다!',
            [
              { text: '취소', style: 'cancel', onPress: () => resolve(false) },
              { text: '삭제', style: 'destructive', onPress: () => resolve(true) }
            ]
          );
        }
      });
    };

    const confirmed = await confirmDelete();
    if (!confirmed) {
      addLog('❌ 삭제 취소됨');
      return;
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🗑️ 전체 일정 삭제 시작');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // 1. 네트워크 확인
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        addLog('⚠️ 오프라인 상태 - 서버 삭제 불가');
        addLog('💡 로컬 저장소만 삭제됩니다');
      }

      // 2. 현재 Todos 가져오기
      const todos = queryClient.getQueryData(['todos', 'all']) || [];
      addLog(`📊 삭제할 일정: ${todos.length}개`);

      if (todos.length === 0) {
        addLog('⚠️ 삭제할 일정 없음');
        addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        return;
      }

      // 3. 서버에서 삭제 (온라인일 때만)
      if (netInfo.isConnected) {
        addLog('🌐 서버에서 삭제 중...');
        let successCount = 0;
        let failCount = 0;

        for (const todo of todos) {
          try {
            await todoAPI.deleteTodo(todo._id);
            successCount++;
          } catch (error) {
            failCount++;
            addLog(`  ❌ 실패: ${todo.title} (${error.message})`);
          }
        }

        addLog(`✅ 서버 삭제 완료: ${successCount}개 성공, ${failCount}개 실패`);
      }

      // 4. 로컬 저장소 삭제
      addLog('📦 로컬 저장소 삭제 중...');
      await saveTodos([]);
      addLog('✅ 로컬 저장소 삭제 완료');

      // 5. React Query 캐시 삭제
      addLog('💾 캐시 삭제 중...');
      queryClient.setQueryData(['todos', 'all'], []);
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      addLog('✅ 캐시 삭제 완료');

      addLog('');
      addLog('🎉 전체 일정 삭제 완료!');
      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } catch (error) {
      addLog(`❌ 삭제 실패: ${error.message}`);
      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
  };

  // ========== 오프라인 UI 테스트 ==========

  // 8. 오프라인 UI 테스트 - Step 1: 로컬 상태 확인
  const offlineTest1_CheckLocalState = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('📝 [STEP 1] 로컬 상태 확인');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 네트워크 상태
    const netInfo = await NetInfo.fetch();
    addLog(`🌐 네트워크: ${netInfo.isConnected ? '✅ 온라인' : '❌ 오프라인'}`);
    addLog('');

    // Todos
    const localTodos = await loadTodos();
    const cachedTodos = queryClient.getQueryData(['todos', 'all']);
    addLog(`📦 AsyncStorage Todos: ${localTodos.length}개`);
    addLog(`💾 React Query Todos: ${cachedTodos?.length || 0}개`);
    addLog('');

    // Completions
    const completions = await loadCompletions();
    addLog(`✅ 로컬 Completions: ${Object.keys(completions).length}개`);
    if (Object.keys(completions).length > 0) {
      Object.entries(completions).slice(0, 3).forEach(([key, comp]) => {
        addLog(`  - ${key}`);
      });
    }
    addLog('');

    // Pending Changes
    const pending = await getPendingChanges();
    const completionPending = pending.filter(p =>
      p.type === 'createCompletion' || p.type === 'deleteCompletion'
    );
    addLog(`⏳ Pending Changes: ${completionPending.length}개`);
    if (completionPending.length > 0) {
      completionPending.forEach(p => {
        addLog(`  - ${p.type}: ${p.todoId?.slice(-8)}`);
      });
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // 9. 오프라인 UI 테스트 - Step 2: 첫 번째 Todo 토글
  const offlineTest2_ToggleFirstTodo = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('📝 [STEP 2] 첫 번째 Todo 토글');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (todos.length === 0) {
      addLog('❌ Todo가 없습니다');
      addLog('💡 먼저 일정을 추가하세요');
      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return;
    }

    const todo = todos[0];
    addLog(`📌 Todo: ${todo.title}`);
    addLog(`   ID: ${todo._id}`);
    addLog(`   현재 상태: ${todo.completed ? '✅ 완료' : '⬜ 미완료'}`);
    addLog('');

    try {
      addLog('🔄 토글 시작...');
      await toggleCompletion.mutateAsync({
        todoId: todo._id,
        date: selectedDate,
        currentCompleted: todo.completed,
      });

      addLog('✅ 토글 완료');
      addLog('💡 UI가 즉시 반영되었는지 확인하세요');
    } catch (error) {
      addLog(`❌ 토글 실패: ${error.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // 10. 오프라인 UI 테스트 - Step 3: 캐시 무효화 후 재조회
  const offlineTest3_InvalidateAndRefetch = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('📝 [STEP 3] 캐시 무효화 후 재조회');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    addLog('🗑️ 캐시 무효화 중...');
    queryClient.invalidateQueries(['todos']);
    addLog('✅ 캐시 무효화 완료');
    addLog('');

    addLog('🔄 재조회 중...');
    await refetchTodos();
    addLog('✅ 재조회 완료');
    addLog('');

    addLog('💡 완료 상태가 유지되는지 확인하세요');
    addLog('   - 온라인: 서버에서 completed 필드 포함');
    addLog('   - 오프라인: 로컬 Completion 병합');

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // 11. 오프라인 UI 테스트 - Step 4: 로컬 Completion 상세 확인
  const offlineTest4_CheckCompletionDetail = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('📝 [STEP 4] 로컬 Completion 상세 확인');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const completions = await loadCompletions();
    addLog(`✅ 로컬 Completions: ${Object.keys(completions).length}개`);
    addLog('');

    if (Object.keys(completions).length === 0) {
      addLog('⚠️ 로컬 Completion 없음');
      addLog('💡 Step 2를 먼저 실행하세요');
    } else {
      addLog('📋 Completion 목록:');
      Object.entries(completions).forEach(([key, comp]) => {
        addLog(`  Key: ${key}`);
        addLog(`    todoId: ${comp.todoId}`);
        addLog(`    date: ${comp.date || 'null'}`);
        addLog(`    completedAt: ${new Date(comp.completedAt).toLocaleString()}`);
        addLog('');
      });
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // 12. 오프라인 UI 테스트 - Step 5: Pending Changes 확인
  const offlineTest5_CheckPendingChanges = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('📝 [STEP 5] Pending Changes 확인');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const pending = await getPendingChanges();
    const completionPending = pending.filter(p =>
      p.type === 'createCompletion' || p.type === 'deleteCompletion'
    );

    addLog(`⏳ 전체 Pending: ${pending.length}개`);
    addLog(`✅ Completion Pending: ${completionPending.length}개`);
    addLog('');

    if (completionPending.length === 0) {
      addLog('⚠️ Pending Changes 없음');
      addLog('💡 오프라인 상태에서 Step 2를 실행하세요');
    } else {
      addLog('📋 Pending Changes:');
      completionPending.forEach((p, index) => {
        addLog(`  [${index + 1}] ${p.type}`);
        addLog(`      todoId: ${p.todoId}`);
        addLog(`      date: ${p.date || 'null'}`);
        addLog(`      timestamp: ${new Date(p.timestamp).toLocaleString()}`);
        addLog('');
      });
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // 13. 오프라인 UI 테스트 - Step 6: 로컬 데이터 초기화
  const offlineTest6_ClearLocalData = async () => {
    const confirmClear = () => {
      return new Promise((resolve) => {
        if (Platform.OS === 'web') {
          const confirmed = window.confirm('⚠️ 로컬 Completion과 Pending Changes를 삭제하시겠습니까?');
          resolve(confirmed);
        } else {
          Alert.alert(
            '⚠️ 로컬 데이터 초기화',
            '로컬 Completion과 Pending Changes를 삭제하시겠습니까?',
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
      addLog('❌ 초기화 취소됨');
      return;
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('📝 [STEP 6] 로컬 데이터 초기화');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    addLog('🗑️ Completions 삭제 중...');
    await clearCompletions();
    addLog('✅ Completions 삭제 완료');

    addLog('🗑️ Pending Changes 삭제 중...');
    await clearPendingChanges();
    addLog('✅ Pending Changes 삭제 완료');

    addLog('🔄 캐시 무효화 중...');
    queryClient.invalidateQueries(['todos']);
    addLog('✅ 캐시 무효화 완료');

    addLog('');
    addLog('🎉 로컬 데이터 초기화 완료!');
    addLog('💡 테스트를 처음부터 다시 시작할 수 있습니다');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // ========== SQLite 마이그레이션 테스트 ==========

  // [BASIC] 가장 기본적인 SQLite 테스트 (스키마 없이)
  const sqlite_basic_test = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🧪 [BASIC] 기본 SQLite 테스트');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // 1. expo-sqlite import 확인
      const SQLite = await import('expo-sqlite');
      addLog('✅ expo-sqlite import 성공');
      addLog(`   버전: ${typeof SQLite.openDatabaseAsync}`);

      // 2. 테스트용 DB 열기
      addLog('');
      addLog('📦 테스트 DB 열기...');
      const testDb = await SQLite.openDatabaseAsync('test_basic.db');
      addLog('✅ DB 열기 성공');

      // 3. 간단한 테이블 생성 (개별 실행)
      addLog('');
      addLog('📝 테이블 생성...');
      await testDb.execAsync('CREATE TABLE IF NOT EXISTS test_table (id INTEGER PRIMARY KEY, name TEXT)');
      addLog('✅ 테이블 생성 성공');

      // 4. 데이터 삽입
      addLog('');
      addLog('📝 데이터 삽입...');
      await testDb.runAsync('INSERT OR REPLACE INTO test_table (id, name) VALUES (?, ?)', [1, 'Hello SQLite!']);
      addLog('✅ 데이터 삽입 성공');

      // 5. 데이터 조회
      addLog('');
      addLog('📖 데이터 조회...');
      const result = await testDb.getFirstAsync('SELECT * FROM test_table WHERE id = ?', [1]);
      addLog(`✅ 조회 결과: id=${result?.id}, name=${result?.name}`);

      // 6. DB 닫기
      addLog('');
      addLog('🔒 DB 닫기...');
      await testDb.closeAsync();
      addLog('✅ DB 닫기 성공');

      addLog('');
      addLog('🎉 모든 기본 테스트 통과!');

    } catch (error) {
      addLog(`❌ 오류: ${error.message}`);
      console.error('SQLite basic test error:', error);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // [BASIC-2] 여러 문장 한번에 실행 테스트
  const sqlite_multi_statement_test = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🧪 [BASIC-2] 여러 SQL 문장 테스트');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const SQLite = await import('expo-sqlite');
      const testDb = await SQLite.openDatabaseAsync('test_multi.db');
      addLog('✅ DB 열기 성공');

      // 여러 문장 한번에 실행
      addLog('');
      addLog('📝 여러 문장 실행 테스트...');
      const multiSql = `
        CREATE TABLE IF NOT EXISTS t1 (id INTEGER PRIMARY KEY);
        CREATE TABLE IF NOT EXISTS t2 (id INTEGER PRIMARY KEY);
        CREATE TABLE IF NOT EXISTS t3 (id INTEGER PRIMARY KEY);
      `;
      await testDb.execAsync(multiSql);
      addLog('✅ 여러 문장 실행 성공');

      // 테이블 확인
      const tables = await testDb.getAllAsync("SELECT name FROM sqlite_master WHERE type='table'");
      addLog(`📋 생성된 테이블: ${tables.map(t => t.name).join(', ')}`);

      await testDb.closeAsync();
      addLog('✅ 완료');

    } catch (error) {
      addLog(`❌ 오류: ${error.message}`);
      console.error('Multi statement test error:', error);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // [BASIC-3] PRAGMA 웹 테스트
  const sqlite_pragma_test = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🧪 [BASIC-3] PRAGMA 웹 테스트');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const SQLite = await import('expo-sqlite');
      const testDb = await SQLite.openDatabaseAsync('test_pragma.db');
      addLog('✅ DB 열기 성공');

      // PRAGMA journal_mode = WAL
      addLog('');
      addLog('📝 PRAGMA journal_mode = WAL...');
      try {
        await testDb.execAsync('PRAGMA journal_mode = WAL');
        addLog('✅ WAL 모드 성공');
      } catch (e) {
        addLog(`❌ WAL 실패: ${e.message}`);
      }

      // PRAGMA synchronous = NORMAL
      addLog('');
      addLog('📝 PRAGMA synchronous = NORMAL...');
      try {
        await testDb.execAsync('PRAGMA synchronous = NORMAL');
        addLog('✅ synchronous 성공');
      } catch (e) {
        addLog(`❌ synchronous 실패: ${e.message}`);
      }

      // PRAGMA foreign_keys = ON
      addLog('');
      addLog('📝 PRAGMA foreign_keys = ON...');
      try {
        await testDb.execAsync('PRAGMA foreign_keys = ON');
        addLog('✅ foreign_keys 성공');
      } catch (e) {
        addLog(`❌ foreign_keys 실패: ${e.message}`);
      }

      await testDb.closeAsync();
      addLog('');
      addLog('✅ 테스트 완료');

    } catch (error) {
      addLog(`❌ 오류: ${error.message}`);
      console.error('PRAGMA test error:', error);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // [TIMING] DB 초기화 시간 측정
  const sqlite_timing_test = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('⏱️ [TIMING] DB 초기화 시간 측정 테스트');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const SQLite = await import('expo-sqlite');

      // 1. openDatabaseAsync 시간
      addLog('');
      addLog('📦 Step 1: openDatabaseAsync...');
      const t1 = performance.now();
      const testDb = await SQLite.openDatabaseAsync('timing_test.db');
      const t2 = performance.now();
      addLog(`✅ DB 열기: ${(t2 - t1).toFixed(2)}ms`);

      // 2. PRAGMA journal_mode
      addLog('');
      addLog('📝 Step 2: PRAGMA journal_mode = WAL...');
      const t3 = performance.now();
      await testDb.execAsync('PRAGMA journal_mode = WAL');
      const t4 = performance.now();
      addLog(`✅ WAL 설정: ${(t4 - t3).toFixed(2)}ms`);

      // 3. PRAGMA synchronous
      addLog('');
      addLog('📝 Step 3: PRAGMA synchronous = NORMAL...');
      const t5 = performance.now();
      await testDb.execAsync('PRAGMA synchronous = NORMAL');
      const t6 = performance.now();
      addLog(`✅ synchronous 설정: ${(t6 - t5).toFixed(2)}ms`);

      // 4. PRAGMA foreign_keys
      addLog('');
      addLog('📝 Step 4: PRAGMA foreign_keys = ON...');
      const t7 = performance.now();
      await testDb.execAsync('PRAGMA foreign_keys = ON');
      const t8 = performance.now();
      addLog(`✅ foreign_keys 설정: ${(t8 - t7).toFixed(2)}ms`);

      // 5. CREATE TABLE (간단한 스키마)
      addLog('');
      addLog('📝 Step 5: CREATE TABLE...');
      const t9 = performance.now();
      await testDb.execAsync('CREATE TABLE IF NOT EXISTS timing_test (id INTEGER PRIMARY KEY, data TEXT)');
      const t10 = performance.now();
      addLog(`✅ 테이블 생성: ${(t10 - t9).toFixed(2)}ms`);

      // 6. INSERT
      addLog('');
      addLog('📝 Step 6: INSERT...');
      const t11 = performance.now();
      await testDb.runAsync('INSERT OR REPLACE INTO timing_test (id, data) VALUES (?, ?)', [1, 'test']);
      const t12 = performance.now();
      addLog(`✅ INSERT: ${(t12 - t11).toFixed(2)}ms`);

      // 7. SELECT
      addLog('');
      addLog('📝 Step 7: SELECT...');
      const t13 = performance.now();
      await testDb.getFirstAsync('SELECT * FROM timing_test WHERE id = ?', [1]);
      const t14 = performance.now();
      addLog(`✅ SELECT: ${(t14 - t13).toFixed(2)}ms`);

      await testDb.closeAsync();

      // 요약
      const total = t14 - t1;
      addLog('');
      addLog('📊 요약:');
      addLog(`   - openDatabaseAsync: ${(t2 - t1).toFixed(2)}ms`);
      addLog(`   - PRAGMA 설정 총합: ${(t8 - t3).toFixed(2)}ms`);
      addLog(`   - 테이블 생성: ${(t10 - t9).toFixed(2)}ms`);
      addLog(`   - INSERT/SELECT: ${(t14 - t11).toFixed(2)}ms`);
      addLog(`   - 총 소요 시간: ${total.toFixed(2)}ms`);

    } catch (error) {
      addLog(`❌ 오류: ${error.message}`);
      console.error('Timing test error:', error);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // [0-1] DB 초기화 테스트
  const sqlite_0_1_InitDb = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🚀 [0-1] SQLite DB 초기화 테스트');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      addLog('📦 DB 초기화 중...');
      const database = await initDatabase();
      addLog('✅ DB 초기화 완료');

      // 테이블 확인
      addLog('');
      addLog('📋 테이블 목록:');
      const tables = await database.getAllAsync(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      );
      tables.forEach(t => addLog(`  - ${t.name}`));

      // 통계 확인
      addLog('');
      const stats = await getDbStats();
      addLog('📊 DB 통계:');
      addLog(`  - Todos: ${stats.todos}개`);
      addLog(`  - Completions: ${stats.completions}개`);
      addLog(`  - Categories: ${stats.categories}개`);
      addLog(`  - Pending: ${stats.pending}개`);

    } catch (error) {
      addLog(`❌ 오류: ${error.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // [0-2] 현재 버전 확인
  const sqlite_0_2_CheckVersion = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('📋 [0-2] 현재 버전 확인');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const metadata = await getAllMetadata();
      addLog('📦 Metadata:');

      if (Object.keys(metadata).length === 0) {
        addLog('  (비어있음)');
      } else {
        Object.entries(metadata).forEach(([key, value]) => {
          addLog(`  - ${key}: ${value}`);
        });
      }

    } catch (error) {
      addLog(`❌ 오류: ${error.message}`);
      addLog('💡 먼저 [0-1] DB 초기화를 실행하세요');
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // [1-1] 마이그레이션 시뮬레이션
  const sqlite_1_1_SimulateMigration = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🧪 [1-1] 마이그레이션 시뮬레이션');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const result = await simulateMigration();

      addLog(`📊 AsyncStorage 데이터:`);
      addLog(`  - hasData: ${result.hasData ? '✅' : '❌'}`);
      addLog(`  - Todos: ${result.counts.todos}개`);
      addLog(`  - Completions: ${result.counts.completions}개`);
      addLog(`  - Categories: ${result.counts.categories}개`);
      addLog(`  - Pending: ${result.counts.pending}개`);
      addLog('');
      addLog(`📦 예상 크기:`);
      addLog(`  - Todos: ${(result.estimatedSize.todos / 1024).toFixed(2)} KB`);
      addLog(`  - Completions: ${(result.estimatedSize.completions / 1024).toFixed(2)} KB`);
      addLog(`  - Categories: ${(result.estimatedSize.categories / 1024).toFixed(2)} KB`);

      if (!result.hasData) {
        addLog('');
        addLog('⚠️ 마이그레이션할 데이터가 없습니다');
        addLog('💡 이미 마이그레이션되었거나 데이터가 없습니다');
      }

    } catch (error) {
      addLog(`❌ 오류: ${error.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // [1-2] 실제 마이그레이션 실행
  const sqlite_1_2_RunMigration = async () => {
    const confirmMigration = () => {
      return new Promise((resolve) => {
        if (Platform.OS === 'web') {
          const confirmed = window.confirm(
            '⚠️ AsyncStorage → SQLite 마이그레이션을 실행하시겠습니까?\n\n' +
            '- 백업이 자동 생성됩니다\n' +
            '- 문제 시 롤백 가능합니다'
          );
          resolve(confirmed);
        } else {
          Alert.alert(
            '⚠️ 마이그레이션 실행',
            'AsyncStorage → SQLite 마이그레이션을 실행하시겠습니까?\n\n백업이 자동 생성됩니다.',
            [
              { text: '취소', style: 'cancel', onPress: () => resolve(false) },
              { text: '실행', style: 'default', onPress: () => resolve(true) }
            ]
          );
        }
      });
    };

    const confirmed = await confirmMigration();
    if (!confirmed) {
      addLog('❌ 마이그레이션 취소됨');
      return;
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🚀 [1-2] 마이그레이션 실행');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // DB 초기화 (이미 되어있으면 스킵)
      await initDatabase();

      // 마이그레이션 실행
      addLog('🔄 마이그레이션 중...');
      const result = await migrateFromAsyncStorage();

      if (result.migrated) {
        addLog('✅ 마이그레이션 완료!');
        addLog('');
        addLog('📊 마이그레이션 통계:');
        addLog(`  - Todos: ${result.stats.todos}개`);
        addLog(`  - Completions: ${result.stats.completions}개`);
        addLog(`  - Categories: ${result.stats.categories}개`);
        addLog(`  - Pending: ${result.stats.pending}개`);
        addLog('');
        addLog('💾 백업이 생성되었습니다');
        addLog('💡 문제 시 [1-3] 롤백을 사용하세요');
      } else {
        addLog('⚠️ 마이그레이션 스킵됨');
        addLog(`이유: ${result.reason}`);
      }

    } catch (error) {
      addLog(`❌ 마이그레이션 실패: ${error.message}`);
      addLog('💡 [1-3] 롤백을 시도하세요');
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // [1-3] 마이그레이션 롤백
  const sqlite_1_3_Rollback = async () => {
    const confirmRollback = () => {
      return new Promise((resolve) => {
        if (Platform.OS === 'web') {
          const confirmed = window.confirm(
            '⚠️ 마이그레이션을 롤백하시겠습니까?\n\n' +
            '- SQLite 데이터가 삭제됩니다\n' +
            '- AsyncStorage 백업에서 복원됩니다'
          );
          resolve(confirmed);
        } else {
          Alert.alert(
            '⚠️ 마이그레이션 롤백',
            'SQLite → AsyncStorage로 복원하시겠습니까?',
            [
              { text: '취소', style: 'cancel', onPress: () => resolve(false) },
              { text: '롤백', style: 'destructive', onPress: () => resolve(true) }
            ]
          );
        }
      });
    };

    const confirmed = await confirmRollback();
    if (!confirmed) {
      addLog('❌ 롤백 취소됨');
      return;
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🔄 [1-3] 마이그레이션 롤백');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const result = await rollbackMigration();

      if (result.success) {
        addLog('✅ 롤백 완료!');
        addLog('');
        addLog('💡 앱을 재시작하면 AsyncStorage 데이터를 사용합니다');
      } else {
        addLog('⚠️ 롤백 실패');
        addLog(`이유: ${result.reason}`);
      }

    } catch (error) {
      addLog(`❌ 롤백 실패: ${error.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // [DB] SQLite 전체 초기화
  const sqlite_ResetDb = async () => {
    const confirmReset = () => {
      return new Promise((resolve) => {
        if (Platform.OS === 'web') {
          const confirmed = window.confirm(
            '⚠️ SQLite 데이터를 전체 삭제하시겠습니까?\n\n' +
            '이 작업은 되돌릴 수 없습니다!'
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
    addLog('🗑️ [DB] SQLite 전체 초기화');
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

  // ========== Phase 2: Todo Service 테스트 ==========

  // [2-1] 날짜별 Todo 조회
  const sqlite_2_1_TodosByDate = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog(`📋 [2-1] 날짜별 Todo 조회: ${selectedDate}`);
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
          addLog(`    반복: ${todo.recurrence ? 'O' : 'X'}`);
        });
      }
    } catch (error) {
      addLog(`❌ 오류: ${error.message}`);
      addLog('💡 먼저 [0-1] DB 초기화를 실행하세요');
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // [2-2] 월별 Todo 조회
  const sqlite_2_2_TodosByMonth = async () => {
    const [year, month] = selectedDate.split('-').map(Number);

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog(`📋 [2-2] 월별 Todo 조회: ${year}-${month}`);
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const todos = await sqliteGetTodosByMonth(year, month);
      addLog(`📊 결과: ${todos.length}개`);
      addLog('');

      // 날짜별 그룹
      const byDate = {};
      todos.forEach(todo => {
        const date = todo.date || 'period';
        if (!byDate[date]) byDate[date] = [];
        byDate[date].push(todo);
      });

      Object.entries(byDate).forEach(([date, list]) => {
        addLog(`📅 ${date}: ${list.length}개`);
        list.forEach(t => addLog(`  - ${t.title}`));
      });
    } catch (error) {
      addLog(`❌ 오류: ${error.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // [2-3] 전체 Todo 조회
  const sqlite_2_3_AllTodos = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('📋 [2-3] 전체 Todo 조회');
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

  // ========== Phase 3: Completion Service 테스트 ==========

  // [3-1] 날짜별 Completion 조회
  const sqlite_3_1_CompletionsByDate = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog(`✅ [3-1] 날짜별 Completion: ${selectedDate}`);
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

  // [3-2] 월별 Completion 통계
  const sqlite_3_2_CompletionStats = async () => {
    const [year, month] = selectedDate.split('-').map(Number);

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog(`📊 [3-2] 월별 Completion 통계: ${year}-${month}`);
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const stats = await getCompletionStats(year, month);
      const totalCount = await getCompletionCount();

      addLog(`📊 전체 Completion: ${totalCount}개`);
      addLog(`📅 ${year}년 ${month}월 통계:`);
      addLog('');

      if (stats.length === 0) {
        addLog('⚠️ 해당 월에 완료 기록이 없습니다');
      } else {
        stats.forEach(s => {
          addLog(`  ${s.date}: ${s.count}개 완료`);
        });
      }
    } catch (error) {
      addLog(`❌ 오류: ${error.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // [3-3] Completion 토글 테스트
  const sqlite_3_3_ToggleCompletion = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🔄 [3-3] Completion 토글 테스트');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // 첫 번째 Todo 가져오기
      const todos = await sqliteGetTodosByDate(selectedDate);

      if (todos.length === 0) {
        addLog('⚠️ 테스트할 Todo가 없습니다');
        addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        return;
      }

      const todo = todos[0];
      addLog(`📌 Todo: ${todo.title}`);
      addLog(`📅 Date: ${selectedDate}`);

      // 토글 전 상태
      const beforeCompletions = await sqliteGetCompletionsByDate(selectedDate);
      const key = `${todo._id}_${selectedDate}`;
      const beforeState = !!beforeCompletions[key];
      addLog(`🔄 현재 상태: ${beforeState ? '✅ 완료' : '⬜ 미완료'}`);

      // 토글
      addLog('');
      addLog('🔄 토글 실행...');
      const newState = await sqliteToggleCompletion(todo._id, selectedDate);
      addLog(`✅ 토글 완료!`);
      addLog(`🔄 새 상태: ${newState ? '✅ 완료' : '⬜ 미완료'}`);

    } catch (error) {
      addLog(`❌ 오류: ${error.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // ========== Phase 4: Pending Service 테스트 ==========

  // [4-1] Pending 목록 조회
  const sqlite_4_1_PendingList = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('⏳ [4-1] Pending Changes 목록');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const pending = await sqliteGetPendingChanges();
      const count = await getPendingChangesCount();

      addLog(`📊 총 ${count}개`);
      addLog('');

      if (pending.length === 0) {
        addLog('✅ Pending Changes 없음');
      } else {
        pending.forEach((p, i) => {
          addLog(`[${i + 1}] ${p.type}`);
          addLog(`    ID: ${p.id.slice(-8)}`);
          addLog(`    todoId: ${p.todoId?.slice(-8) || '-'}`);
          addLog(`    date: ${p.date || '-'}`);
          addLog(`    created: ${new Date(p.createdAt).toLocaleString()}`);
        });
      }
    } catch (error) {
      addLog(`❌ 오류: ${error.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // [4-2] 테스트 Pending 추가
  const sqlite_4_2_AddTestPending = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('➕ [4-2] 테스트 Pending 추가');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const id = await addPendingChange({
        type: 'createCompletion',
        todoId: 'test-todo-id',
        date: selectedDate,
        data: { test: true },
      });

      addLog(`✅ 추가 완료!`);
      addLog(`   ID: ${id}`);

      const count = await getPendingChangesCount();
      addLog(`📊 현재 Pending: ${count}개`);

    } catch (error) {
      addLog(`❌ 오류: ${error.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // [4-3] Pending 전체 삭제
  const sqlite_4_3_ClearPending = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🗑️ [4-3] Pending 전체 삭제');
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

  // [CAT] Category 조회
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔧 Debug Screen</Text>

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
        {/* Categories 디버그 */}
        <Text style={styles.sectionTitle}>📦 Categories 디버그</Text>

        <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={checkAllStatus}>
          <Text style={styles.buttonText}>🔍 전체 상태 확인</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.testButton]} onPress={testCategoriesCache}>
          <Text style={styles.buttonText}>🧪 Categories 캐시 테스트</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.testButton]} onPress={testEventColorMapping}>
          <Text style={styles.buttonText}>🎨 색상 매핑 테스트</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.warningButton]} onPress={checkNullCategoryTodos}>
          <Text style={styles.buttonText}>🔍 categoryId null 확인</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.warningButton]} onPress={checkCategoryIdType}>
          <Text style={styles.buttonText}>🔬 categoryId 타입 상세 확인</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.actionButton]} onPress={fixCategoryIdObjects}>
          <Text style={styles.buttonText}>🔧 categoryId 객체 → 문자열 변환</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.testButton]} onPress={checkCompletionCache}>
          <Text style={styles.buttonText}>🔬 Completion 캐시 확인</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.actionButton]} onPress={syncCompletionCache}>
          <Text style={styles.buttonText}>🔧 Completion 캐시 동기화</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.testButton]} onPress={checkSpecificTodo}>
          <Text style={styles.buttonText}>🔍 특정 Todo 상세 확인</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.testButton]} onPress={simulateOfflineToggle}>
          <Text style={styles.buttonText}>🧪 오프라인 완료 취소 시뮬레이션</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={checkCurrentTodos}>
          <Text style={styles.buttonText}>🔍 현재 Todo 상세 확인</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.actionButton]} onPress={forceInjectCategories}>
          <Text style={styles.buttonText}>💉 Categories 강제 주입</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* 오프라인 UI 테스트 */}
        <Text style={styles.sectionTitle}>✅ 오프라인 UI 테스트</Text>

        <TouchableOpacity style={[styles.button, styles.testButton]} onPress={offlineTest1_CheckLocalState}>
          <Text style={styles.buttonText}>Step 1: 로컬 상태 확인</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.testButton]} onPress={offlineTest2_ToggleFirstTodo}>
          <Text style={styles.buttonText}>Step 2: 첫 번째 Todo 토글</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.testButton]} onPress={offlineTest3_InvalidateAndRefetch}>
          <Text style={styles.buttonText}>Step 3: 캐시 무효화 후 재조회</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.testButton]} onPress={offlineTest4_CheckCompletionDetail}>
          <Text style={styles.buttonText}>Step 4: Completion 상세 확인</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.testButton]} onPress={offlineTest5_CheckPendingChanges}>
          <Text style={styles.buttonText}>Step 5: Pending Changes 확인</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.warningButton]} onPress={offlineTest6_ClearLocalData}>
          <Text style={styles.buttonText}>Step 6: 로컬 데이터 초기화</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* SQLite 마이그레이션 테스트 */}
        <Text style={styles.sectionTitle}>🗄️ SQLite 마이그레이션</Text>

        <Text style={styles.subSectionTitle}>🧪 BASIC 테스트 (먼저 실행!)</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.button, styles.actionButton, styles.halfButton]} onPress={sqlite_basic_test}>
            <Text style={styles.buttonText}>[BASIC] 기본 테스트</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.sqliteButton, styles.halfButton]} onPress={sqlite_multi_statement_test}>
            <Text style={styles.buttonText}>[BASIC-2] 다중 문장</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.button, styles.warningButton]} onPress={sqlite_pragma_test}>
          <Text style={styles.buttonText}>[BASIC-3] PRAGMA 웹 테스트</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.actionButton]} onPress={sqlite_timing_test}>
          <Text style={styles.buttonText}>⏱️ [TIMING] 시간 측정</Text>
        </TouchableOpacity>

        <Text style={styles.subSectionTitle}>Phase 0: 기반 작업</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.button, styles.sqliteButton, styles.halfButton]} onPress={sqlite_0_1_InitDb}>
            <Text style={styles.buttonText}>[0-1] DB 초기화</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.sqliteButton, styles.halfButton]} onPress={sqlite_0_2_CheckVersion}>
            <Text style={styles.buttonText}>[0-2] 버전 확인</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subSectionTitle}>Phase 1: 마이그레이션</Text>
        <TouchableOpacity style={[styles.button, styles.sqliteButton]} onPress={sqlite_1_1_SimulateMigration}>
          <Text style={styles.buttonText}>[1-1] 시뮬레이션 (데이터 확인만)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.actionButton]} onPress={sqlite_1_2_RunMigration}>
          <Text style={styles.buttonText}>[1-2] 🚀 실제 마이그레이션 실행</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.warningButton]} onPress={sqlite_1_3_Rollback}>
          <Text style={styles.buttonText}>[1-3] 롤백 (AsyncStorage 복원)</Text>
        </TouchableOpacity>

        <Text style={styles.subSectionTitle}>Phase 2: Todo Service</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.button, styles.sqliteButton, styles.halfButton]} onPress={sqlite_2_1_TodosByDate}>
            <Text style={styles.buttonText}>[2-1] 날짜별</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.sqliteButton, styles.halfButton]} onPress={sqlite_2_2_TodosByMonth}>
            <Text style={styles.buttonText}>[2-2] 월별</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.button, styles.sqliteButton]} onPress={sqlite_2_3_AllTodos}>
          <Text style={styles.buttonText}>[2-3] 전체 Todo 조회</Text>
        </TouchableOpacity>

        <Text style={styles.subSectionTitle}>Phase 3: Completion Service</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.button, styles.sqliteButton, styles.halfButton]} onPress={sqlite_3_1_CompletionsByDate}>
            <Text style={styles.buttonText}>[3-1] 날짜별</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.sqliteButton, styles.halfButton]} onPress={sqlite_3_2_CompletionStats}>
            <Text style={styles.buttonText}>[3-2] 월별 통계</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.button, styles.actionButton]} onPress={sqlite_3_3_ToggleCompletion}>
          <Text style={styles.buttonText}>[3-3] 🔄 Completion 토글 테스트</Text>
        </TouchableOpacity>

        <Text style={styles.subSectionTitle}>Phase 4: Pending Service</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.button, styles.sqliteButton, styles.halfButton]} onPress={sqlite_4_1_PendingList}>
            <Text style={styles.buttonText}>[4-1] 목록</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.sqliteButton, styles.halfButton]} onPress={sqlite_4_2_AddTestPending}>
            <Text style={styles.buttonText}>[4-2] 추가</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.button, styles.warningButton]} onPress={sqlite_4_3_ClearPending}>
          <Text style={styles.buttonText}>[4-3] Pending 전체 삭제</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.testButton]} onPress={sqlite_CategoryList}>
          <Text style={styles.buttonText}>📂 Categories 조회</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* 위험한 작업 */}
        <Text style={styles.sectionTitle}>⚠️ 위험한 작업</Text>

        <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={clearCache}>
          <Text style={styles.buttonText}>🗑️ 캐시 클리어</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={deleteAllTodos}>
          <Text style={styles.buttonText}>🗑️ 전체 일정 삭제</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={sqlite_ResetDb}>
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
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // SQLite 스타일
  subSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  halfButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  sqliteButton: {
    backgroundColor: '#0891b2',
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
