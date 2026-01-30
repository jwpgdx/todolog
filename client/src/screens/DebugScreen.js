import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { loadTodos, saveTodos } from '../storage/todoStorage';
import { loadCategories } from '../storage/categoryStorage';
import { todoAPI } from '../api/todos';
import NetInfo from '@react-native-community/netinfo';

export default function DebugScreen() {
  const [logs, setLogs] = useState([]);
  const queryClient = useQueryClient();

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 30));
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔧 Categories 색상 디버그</Text>

      <ScrollView style={styles.buttonContainer}>
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

        <View style={styles.divider} />

        <TouchableOpacity style={[styles.button, styles.actionButton]} onPress={forceInjectCategories}>
          <Text style={styles.buttonText}>💉 Categories 강제 주입</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={clearCache}>
          <Text style={styles.buttonText}>🗑️ 캐시 클리어</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={deleteAllTodos}>
          <Text style={styles.buttonText}>🗑️ 전체 일정 삭제</Text>
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
    marginBottom: 16,
    textAlign: 'center',
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
