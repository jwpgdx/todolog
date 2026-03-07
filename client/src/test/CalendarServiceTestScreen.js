/**
 * Calendar Service Test Screen
 * 
 * Task 4: Service 레이어 검증
 * - fetchCalendarDataForMonths 테스트
 * - Batch fetch 동작 확인
 * - 기간 일정 다중 월 할당 확인
 * - 빈 월 처리 확인
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';

import { fetchCalendarDataForMonths } from '../features/todo-calendar/services/calendarTodoService';

export default function CalendarServiceTestScreen() {
  const router = useRouter();
  const [testResults, setTestResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Test 1: 2개월 Batch Fetch
  const handleTest1 = async () => {
    try {
      setIsLoading(true);
      console.log('\n========================================');
      console.log('🧪 Test 1: 2개월 Batch Fetch (2026-01, 2026-02)');
      console.log('========================================\n');

      const monthMetadatas = [
        { year: 2026, month: 1, id: '2026-01' },
        { year: 2026, month: 2, id: '2026-02' },
      ];

      const startTime = performance.now();
      const result = await fetchCalendarDataForMonths(monthMetadatas, 0);
      const endTime = performance.now();

      console.log('\n📊 Test 1 Results:');
      console.log('─────────────────────────────────────');
      console.log(`⏱️  Execution Time: ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`📦 Months Requested: ${monthMetadatas.length}`);
      console.log(`✅ Months in todosMap: ${Object.keys(result.todosMap).length}`);
      console.log(`✅ Months in completionsMap: ${Object.keys(result.completionsMap).length}`);
      
      console.log('\n📋 Todos by Month:');
      for (const [monthId, todos] of Object.entries(result.todosMap)) {
        console.log(`  [${monthId}]: ${todos.length} todos`);
        if (todos.length > 0) {
          todos.forEach((todo, idx) => {
            console.log(`    ${idx + 1}. ${todo.title} (${todo.date || `${todo.startDate} ~ ${todo.endDate}`})`);
          });
        }
      }

      console.log('\n✅ Completions by Month:');
      for (const [monthId, comps] of Object.entries(result.completionsMap)) {
        const count = Object.keys(comps).length;
        console.log(`  [${monthId}]: ${count} completions`);
      }

      console.log('\n========================================\n');

      setTestResults({
        test: 'Test 1: 2개월 Batch Fetch',
        executionTime: (endTime - startTime).toFixed(2),
        todosMap: result.todosMap,
        completionsMap: result.completionsMap,
      });

      Toast.show({
        type: 'success',
        text1: 'Test 1 완료',
        text2: `${(endTime - startTime).toFixed(2)}ms`,
      });
    } catch (error) {
      console.error('❌ Test 1 failed:', error);
      Toast.show({
        type: 'error',
        text1: 'Test 1 실패',
        text2: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Test 2: 5개월 Batch Fetch (Performance)
  const handleTest2 = async () => {
    try {
      setIsLoading(true);
      console.log('\n========================================');
      console.log('🧪 Test 2: 5개월 Batch Fetch (Performance Test)');
      console.log('========================================\n');

      const monthMetadatas = [
        { year: 2026, month: 1, id: '2026-01' },
        { year: 2026, month: 2, id: '2026-02' },
        { year: 2026, month: 3, id: '2026-03' },
        { year: 2026, month: 4, id: '2026-04' },
        { year: 2026, month: 5, id: '2026-05' },
      ];

      const startTime = performance.now();
      const result = await fetchCalendarDataForMonths(monthMetadatas, 0);
      const endTime = performance.now();

      const totalTodos = Object.values(result.todosMap).reduce((sum, todos) => sum + todos.length, 0);
      const totalCompletions = Object.values(result.completionsMap).reduce((sum, comps) => sum + Object.keys(comps).length, 0);

      console.log('\n📊 Test 2 Results:');
      console.log('─────────────────────────────────────');
      console.log(`⏱️  Execution Time: ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`📦 Months Requested: ${monthMetadatas.length}`);
      console.log(`📝 Total Todos: ${totalTodos}`);
      console.log(`✅ Total Completions: ${totalCompletions}`);
      console.log(`🎯 Target: < 50ms`);
      console.log(`📊 Result: ${(endTime - startTime) < 50 ? '✅ PASS' : '⚠️ SLOW'}`);

      console.log('\n========================================\n');

      setTestResults({
        test: 'Test 2: 5개월 Batch Fetch',
        executionTime: (endTime - startTime).toFixed(2),
        monthsCount: monthMetadatas.length,
        totalTodos,
        totalCompletions,
        passed: (endTime - startTime) < 50,
      });

      Toast.show({
        type: (endTime - startTime) < 50 ? 'success' : 'info',
        text1: 'Test 2 완료',
        text2: `${(endTime - startTime).toFixed(2)}ms (Target: <50ms)`,
      });
    } catch (error) {
      console.error('❌ Test 2 failed:', error);
      Toast.show({
        type: 'error',
        text1: 'Test 2 실패',
        text2: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Test 3: 빈 월 처리
  const handleTest3 = async () => {
    try {
      setIsLoading(true);
      console.log('\n========================================');
      console.log('🧪 Test 3: 빈 월 처리 (2030-01, 2030-02)');
      console.log('========================================\n');

      const monthMetadatas = [
        { year: 2030, month: 1, id: '2030-01' },
        { year: 2030, month: 2, id: '2030-02' },
      ];

      const result = await fetchCalendarDataForMonths(monthMetadatas, 0);

      console.log('\n📊 Test 3 Results:');
      console.log('─────────────────────────────────────');
      console.log(`✅ '2030-01' exists in todosMap: ${result.todosMap['2030-01'] !== undefined}`);
      console.log(`✅ '2030-02' exists in todosMap: ${result.todosMap['2030-02'] !== undefined}`);
      console.log(`✅ '2030-01' is empty array: ${Array.isArray(result.todosMap['2030-01']) && result.todosMap['2030-01'].length === 0}`);
      console.log(`✅ '2030-02' is empty array: ${Array.isArray(result.todosMap['2030-02']) && result.todosMap['2030-02'].length === 0}`);
      console.log(`✅ '2030-01' completions is empty object: ${Object.keys(result.completionsMap['2030-01']).length === 0}`);
      console.log(`✅ '2030-02' completions is empty object: ${Object.keys(result.completionsMap['2030-02']).length === 0}`);

      const allPassed = 
        result.todosMap['2030-01'] !== undefined &&
        result.todosMap['2030-02'] !== undefined &&
        Array.isArray(result.todosMap['2030-01']) &&
        Array.isArray(result.todosMap['2030-02']) &&
        result.todosMap['2030-01'].length === 0 &&
        result.todosMap['2030-02'].length === 0;

      console.log(`\n📊 Result: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
      console.log('\n========================================\n');

      setTestResults({
        test: 'Test 3: 빈 월 처리',
        passed: allPassed,
        todosMap: result.todosMap,
        completionsMap: result.completionsMap,
      });

      Toast.show({
        type: allPassed ? 'success' : 'error',
        text1: 'Test 3 완료',
        text2: allPassed ? '빈 월 처리 정상' : '빈 월 처리 실패',
      });
    } catch (error) {
      console.error('❌ Test 3 failed:', error);
      Toast.show({
        type: 'error',
        text1: 'Test 3 실패',
        text2: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Test 4: 월 시작 요일 변경 (Monday first)
  const handleTest4 = async () => {
    try {
      setIsLoading(true);
      console.log('\n========================================');
      console.log('🧪 Test 4: 월 시작 요일 변경 (Monday first)');
      console.log('========================================\n');

      const monthMetadatas = [
        { year: 2026, month: 2, id: '2026-02' },
      ];

      console.log('📅 Testing with startDayOfWeek = 1 (Monday)');
      const result = await fetchCalendarDataForMonths(monthMetadatas, 1);

      console.log('\n📊 Test 4 Results:');
      console.log('─────────────────────────────────────');
      console.log(`✅ Month exists: ${result.todosMap['2026-02'] !== undefined}`);
      console.log(`📝 Todos count: ${result.todosMap['2026-02'].length}`);
      
      if (result.todosMap['2026-02'].length > 0) {
        console.log('\n📋 Todos:');
        result.todosMap['2026-02'].forEach((todo, idx) => {
          console.log(`  ${idx + 1}. ${todo.title} (${todo.date || `${todo.startDate} ~ ${todo.endDate}`})`);
        });
      }

      console.log('\n========================================\n');

      setTestResults({
        test: 'Test 4: 월 시작 요일 변경',
        startDayOfWeek: 1,
        todosMap: result.todosMap,
      });

      Toast.show({
        type: 'success',
        text1: 'Test 4 완료',
        text2: 'Monday first 테스트 완료',
      });
    } catch (error) {
      console.error('❌ Test 4 failed:', error);
      Toast.show({
        type: 'error',
        text1: 'Test 4 실패',
        text2: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 p-4">
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold mb-2">
            Calendar Service Test
          </Text>
          <Text className="text-gray-600">
            Task 4: Service 레이어 검증
          </Text>
        </View>

        {/* Info */}
        <View className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-200">
          <Text className="text-sm font-semibold text-blue-900 mb-2">
            📋 검증 항목
          </Text>
          <Text className="text-blue-700 text-xs mb-1">
            1. Batch Fetch: SQL 쿼리 2회만 실행 (todos, completions)
          </Text>
          <Text className="text-blue-700 text-xs mb-1">
            2. 기간 일정: 여러 월에 중복 할당
          </Text>
          <Text className="text-blue-700 text-xs mb-1">
            3. 빈 월: 빈 배열/객체 반환
          </Text>
          <Text className="text-blue-700 text-xs">
            4. Performance: 5개월 &lt; 50ms
          </Text>
        </View>

        {/* Test Results */}
        {testResults && (
          <View className="bg-gray-50 p-4 rounded-lg mb-6">
            <Text className="text-sm font-semibold text-gray-900 mb-2">
              Last Test Result
            </Text>
            <Text className="text-xs text-gray-700 mb-1">
              {testResults.test}
            </Text>
            {testResults.executionTime && (
              <Text className="text-xs text-gray-600">
                ⏱️ {testResults.executionTime}ms
              </Text>
            )}
            {testResults.passed !== undefined && (
              <Text className={`text-xs font-semibold mt-1 ${testResults.passed ? 'text-green-600' : 'text-red-600'}`}>
                {testResults.passed ? '✅ PASS' : '❌ FAIL'}
              </Text>
            )}
          </View>
        )}

        {/* Tests */}
        <View className="mb-6">
          <Text className="text-lg font-semibold mb-3">Tests</Text>

          <TestButton
            title="Test 1: 2개월 Batch Fetch"
            description="2026-01, 2026-02 데이터 조회"
            onPress={handleTest1}
            disabled={isLoading}
            color="blue"
          />

          <TestButton
            title="Test 2: 5개월 Performance"
            description="5개월 데이터 < 50ms 목표"
            onPress={handleTest2}
            disabled={isLoading}
            color="purple"
          />

          <TestButton
            title="Test 3: 빈 월 처리"
            description="2030년 데이터 (빈 배열 반환)"
            onPress={handleTest3}
            disabled={isLoading}
            color="orange"
          />

          <TestButton
            title="Test 4: Monday First"
            description="월 시작 요일 변경 테스트"
            onPress={handleTest4}
            disabled={isLoading}
            color="green"
          />
        </View>

        {/* Navigation */}
        <TouchableOpacity
          onPress={() => router.back()}
          className="py-3 bg-gray-200 rounded-lg"
        >
          <Text className="text-center text-gray-700 font-medium">
            뒤로 가기
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// Test Button Component
function TestButton({ title, description, onPress, disabled, color = 'blue' }) {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    orange: 'bg-orange-500',
    purple: 'bg-purple-500',
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className={`mb-3 p-4 rounded-lg ${
        disabled ? 'bg-gray-300' : colorClasses[color]
      }`}
    >
      <Text className="text-white font-semibold mb-1">{title}</Text>
      <Text className="text-white text-xs opacity-90">{description}</Text>
    </TouchableOpacity>
  );
}
