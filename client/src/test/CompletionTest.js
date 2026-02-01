import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToggleCompletion } from '../hooks/queries/useToggleCompletion';
import { useTodos } from '../hooks/queries/useTodos';
import { todoAPI } from '../api/todos';
import { loadCompletions, clearCompletions } from '../storage/completionStorage';
import { getPendingChanges, clearPendingChanges } from '../storage/pendingChangesStorage';
import NetInfo from '@react-native-community/netinfo';

/**
 * Completion 기능 테스트 화면
 * Phase 1: Optimistic Update + Offline-First 테스트
 */
export default function CompletionTest() {
  const [localCompletions, setLocalCompletions] = useState({});
  const [pendingChanges, setPendingChanges] = useState([]);
  const [selectedDate] = useState('2026-01-31');
  const [isOnline, setIsOnline] = useState(true);
  const [testStep, setTestStep] = useState(0);

  const queryClient = useQueryClient();

  // useTodos 훅 사용 (오프라인 UI 테스트용)
  const { data: todos = [], isLoading, refetch } = useTodos(selectedDate);

  // Completion 토글 훅
  const toggleCompletion = useToggleCompletion();

  // 로컬 Completion 상태 로드
  const loadLocalState = async () => {
    const completions = await loadCompletions();
    const pending = await getPendingChanges();
    setLocalCompletions(completions);
    setPendingChanges(pending.filter(p => 
      p.type === 'createCompletion' || p.type === 'deleteCompletion'
    ));
  };

  // 네트워크 상태 모니터링
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected);
      console.log('🌐 [CompletionTest] 네트워크 상태:', state.isConnected ? '온라인' : '오프라인');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    loadLocalState();
  }, []);

  // Completion 토글 핸들러
  const handleToggle = async (todo) => {
    try {
      console.log('🔄 [CompletionTest] 토글 시작:', todo.title, '현재 상태:', todo.completed);
      
      await toggleCompletion.mutateAsync({
        todoId: todo._id,
        date: selectedDate,
        currentCompleted: todo.completed,
      });
      
      // 로컬 상태 다시 로드
      await loadLocalState();
      
      console.log('✅ [CompletionTest] 토글 완료');
    } catch (error) {
      console.error('❌ [CompletionTest] Toggle failed:', error);
    }
  };

  // 테스트 단계별 실행
  const runTestStep = async (step) => {
    setTestStep(step);
    
    switch(step) {
      case 1:
        console.log('\n📝 [TEST STEP 1] 로컬 상태 새로고침');
        await loadLocalState();
        await refetch();
        Alert.alert('Step 1', '로컬 상태를 새로고침했습니다.\n로그를 확인하세요.');
        break;
        
      case 2:
        console.log('\n📝 [TEST STEP 2] 첫 번째 Todo 완료 토글 (온라인)');
        if (todos.length > 0) {
          await handleToggle(todos[0]);
          Alert.alert('Step 2', `"${todos[0].title}" 토글 완료\n로그를 확인하세요.`);
        } else {
          Alert.alert('Error', 'Todo가 없습니다.');
        }
        break;
        
      case 3:
        console.log('\n📝 [TEST STEP 3] 로컬 Completion 확인');
        const completions = await loadCompletions();
        console.log('💾 [CompletionTest] 로컬 Completions:', completions);
        Alert.alert('Step 3', `로컬 Completion 개수: ${Object.keys(completions).length}\n로그를 확인하세요.`);
        break;
        
      case 4:
        console.log('\n📝 [TEST STEP 4] 캐시 무효화 후 재조회');
        queryClient.invalidateQueries(['todos']);
        await refetch();
        await loadLocalState();
        Alert.alert('Step 4', '캐시를 무효화하고 재조회했습니다.\n로그를 확인하세요.');
        break;
        
      case 5:
        console.log('\n📝 [TEST STEP 5] Pending Changes 확인');
        const pending = await getPendingChanges();
        console.log('⏳ [CompletionTest] Pending Changes:', pending);
        Alert.alert('Step 5', `Pending Changes: ${pending.length}개\n로그를 확인하세요.`);
        break;
        
      case 6:
        console.log('\n📝 [TEST STEP 6] 로컬 데이터 초기화');
        Alert.alert(
          '경고',
          '로컬 Completion과 Pending Changes를 모두 삭제합니다.\n계속하시겠습니까?',
          [
            { text: '취소', style: 'cancel' },
            {
              text: '삭제',
              style: 'destructive',
              onPress: async () => {
                await clearCompletions();
                await clearPendingChanges();
                await loadLocalState();
                queryClient.invalidateQueries(['todos']);
                console.log('🗑️ [CompletionTest] 로컬 데이터 초기화 완료');
                Alert.alert('Step 6', '로컬 데이터를 초기화했습니다.');
              }
            }
          ]
        );
        break;
        
      default:
        break;
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4">
        {/* 헤더 */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-gray-900 mb-2">
            Completion Test
          </Text>
          <Text className="text-sm text-gray-600">
            Phase 1-4: 오프라인 UI 테스트
          </Text>
          <Text className="text-xs text-gray-500 mt-1">
            Date: {selectedDate}
          </Text>
          
          {/* 네트워크 상태 */}
          <View className={`mt-2 px-3 py-2 rounded-lg ${isOnline ? 'bg-green-100' : 'bg-red-100'}`}>
            <Text className={`text-sm font-semibold ${isOnline ? 'text-green-800' : 'text-red-800'}`}>
              {isOnline ? '🟢 온라인' : '🔴 오프라인'}
            </Text>
          </View>
        </View>

        {/* 테스트 단계 버튼 */}
        <View className="bg-white rounded-lg p-4 mb-4 shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-3">
            🧪 Test Steps
          </Text>
          
          <TouchableOpacity
            onPress={() => runTestStep(1)}
            className={`p-3 mb-2 rounded-lg ${testStep === 1 ? 'bg-blue-500' : 'bg-blue-100'}`}
          >
            <Text className={`font-semibold ${testStep === 1 ? 'text-white' : 'text-blue-900'}`}>
              Step 1: 로컬 상태 새로고침
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => runTestStep(2)}
            className={`p-3 mb-2 rounded-lg ${testStep === 2 ? 'bg-blue-500' : 'bg-blue-100'}`}
            disabled={todos.length === 0}
          >
            <Text className={`font-semibold ${testStep === 2 ? 'text-white' : 'text-blue-900'}`}>
              Step 2: 첫 번째 Todo 토글 (온라인)
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => runTestStep(3)}
            className={`p-3 mb-2 rounded-lg ${testStep === 3 ? 'bg-blue-500' : 'bg-blue-100'}`}
          >
            <Text className={`font-semibold ${testStep === 3 ? 'text-white' : 'text-blue-900'}`}>
              Step 3: 로컬 Completion 확인
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => runTestStep(4)}
            className={`p-3 mb-2 rounded-lg ${testStep === 4 ? 'bg-blue-500' : 'bg-blue-100'}`}
          >
            <Text className={`font-semibold ${testStep === 4 ? 'text-white' : 'text-blue-900'}`}>
              Step 4: 캐시 무효화 후 재조회
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => runTestStep(5)}
            className={`p-3 mb-2 rounded-lg ${testStep === 5 ? 'bg-blue-500' : 'bg-blue-100'}`}
          >
            <Text className={`font-semibold ${testStep === 5 ? 'text-white' : 'text-blue-900'}`}>
              Step 5: Pending Changes 확인
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => runTestStep(6)}
            className={`p-3 rounded-lg ${testStep === 6 ? 'bg-red-500' : 'bg-red-100'}`}
          >
            <Text className={`font-semibold ${testStep === 6 ? 'text-white' : 'text-red-900'}`}>
              Step 6: 로컬 데이터 초기화 (위험)
            </Text>
          </TouchableOpacity>
        </View>

        {/* 통계 */}
        <View className="bg-white rounded-lg p-4 mb-4 shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-3">
            📊 Statistics
          </Text>
          <View className="space-y-2">
            <View className="flex-row justify-between">
              <Text className="text-gray-600">Total Todos:</Text>
              <Text className="font-semibold text-gray-900">{todos.length}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-gray-600">Completed:</Text>
              <Text className="font-semibold text-green-600">
                {todos.filter(t => t.completed).length}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-gray-600">Local Completions:</Text>
              <Text className="font-semibold text-blue-600">
                {Object.keys(localCompletions).length}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-gray-600">Pending Changes:</Text>
              <Text className="font-semibold text-orange-600">
                {pendingChanges.length}
              </Text>
            </View>
          </View>
        </View>

        {/* Todo 리스트 */}
        <View className="bg-white rounded-lg p-4 mb-4 shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-3">
            ✅ Todos
          </Text>
          {todos.length === 0 ? (
            <Text className="text-gray-500 text-center py-4">
              No todos for this date
            </Text>
          ) : (
            todos.map((todo) => (
              <TouchableOpacity
                key={todo._id}
                onPress={() => handleToggle(todo)}
                className={`p-3 mb-2 rounded-lg border ${
                  todo.completed
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
                disabled={toggleCompletion.isPending}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text
                      className={`text-base ${
                        todo.completed
                          ? 'text-green-900 line-through'
                          : 'text-gray-900'
                      }`}
                    >
                      {todo.title}
                    </Text>
                    <Text className="text-xs text-gray-500 mt-1">
                      ID: {todo._id.slice(-8)}
                    </Text>
                  </View>
                  <View
                    className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                      todo.completed
                        ? 'bg-green-500 border-green-500'
                        : 'border-gray-300'
                    }`}
                  >
                    {todo.completed && (
                      <Text className="text-white text-xs">✓</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Pending Changes */}
        {pendingChanges.length > 0 && (
          <View className="bg-orange-50 rounded-lg p-4 mb-4 border border-orange-200">
            <Text className="text-lg font-semibold text-orange-900 mb-3">
              ⏳ Pending Changes
            </Text>
            {pendingChanges.map((change, index) => (
              <View key={change.id} className="mb-2 p-2 bg-white rounded">
                <Text className="text-sm font-medium text-gray-900">
                  {change.type === 'createCompletion' ? '✅ Create' : '❌ Delete'}
                </Text>
                <Text className="text-xs text-gray-600 mt-1">
                  Todo: {change.todoId?.slice(-8)}
                </Text>
                <Text className="text-xs text-gray-500">
                  Date: {change.date}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Local Completions */}
        {Object.keys(localCompletions).length > 0 && (
          <View className="bg-blue-50 rounded-lg p-4 mb-4 border border-blue-200">
            <Text className="text-lg font-semibold text-blue-900 mb-3">
              💾 Local Completions
            </Text>
            {Object.entries(localCompletions).map(([key, completion]) => (
              <View key={key} className="mb-2 p-2 bg-white rounded">
                <Text className="text-xs font-mono text-gray-700">
                  {key}
                </Text>
                <Text className="text-xs text-gray-500 mt-1">
                  Completed: {new Date(completion.completedAt).toLocaleTimeString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* 새로고침 버튼 */}
        <TouchableOpacity
          onPress={loadLocalState}
          className="bg-blue-500 rounded-lg p-4 items-center"
        >
          <Text className="text-white font-semibold">
            🔄 Refresh Local State
          </Text>
        </TouchableOpacity>

        {/* 테스트 가이드 */}
        <View className="bg-gray-100 rounded-lg p-4 mt-4">
          <Text className="text-sm font-semibold text-gray-900 mb-2">
            📝 오프라인 UI 테스트 가이드
          </Text>
          <Text className="text-xs text-gray-700 leading-5">
            <Text className="font-bold">온라인 테스트:</Text>{'\n'}
            1. Step 1: 로컬 상태 새로고침{'\n'}
            2. Step 2: 첫 번째 Todo 토글{'\n'}
            3. Step 3: 로컬 Completion 확인{'\n'}
            4. Step 4: 캐시 무효화 후 재조회{'\n'}
            {'\n'}
            <Text className="font-bold">오프라인 테스트:</Text>{'\n'}
            1. 비행기 모드 켜기 (또는 서버 종료){'\n'}
            2. Step 2: Todo 토글 (UI 즉시 반영 확인){'\n'}
            3. Step 3: 로컬 Completion 확인{'\n'}
            4. Step 4: 캐시 무효화 후 재조회{'\n'}
            5. 완료 상태가 유지되는지 확인{'\n'}
            6. Step 5: Pending Changes 확인{'\n'}
            {'\n'}
            <Text className="font-bold">동기화 테스트:</Text>{'\n'}
            1. 비행기 모드 끄기 (또는 서버 시작){'\n'}
            2. 앱 포그라운드 복귀 또는 재시작{'\n'}
            3. 자동 동기화 로그 확인{'\n'}
            {'\n'}
            <Text className="font-bold text-red-600">초기화:</Text>{'\n'}
            Step 6: 로컬 데이터 초기화 (테스트 재시작용)
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
