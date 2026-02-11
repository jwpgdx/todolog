import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useCalendarStore } from '../features/todo-calendar/store/calendarStore';

/**
 * CalendarPerformanceBenchmark Component
 * 
 * 성능 벤치마크 테스트 화면
 * 
 * 테스트 시나리오:
 * 1. 초기화 성능 (5개월 생성)
 * 2. 미래 월 추가 성능 (6개월 × N회)
 * 3. 과거 월 추가 성능 (6개월 × N회)
 * 4. 메모리 사용량 (상태 크기)
 * 5. 100개월 시뮬레이션 (빠른 스크롤)
 * 
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.5
 */
export default function CalendarPerformanceBenchmark() {
  const {
    months,
    initializeMonths,
    addFutureMonths,
    addPastMonths,
    getStateSize,
  } = useCalendarStore();

  const [results, setResults] = useState([]);

  /**
   * 결과 추가 헬퍼
   */
  const addResult = (label, value, unit = 'ms') => {
    setResults((prev) => [...prev, { label, value, unit }]);
  };

  /**
   * 결과 초기화
   */
  const clearResults = () => {
    setResults([]);
  };

  /**
   * Test 1: 초기화 성능
   */
  const testInitialization = () => {
    clearResults();
    
    const start = performance.now();
    initializeMonths();
    const end = performance.now();
    
    addResult('초기화 (5개월)', (end - start).toFixed(2));
    addResult('생성된 월 수', months.length, '개월');
  };

  /**
   * Test 2: 미래 월 추가 성능 (6개월 × 10회 = 60개월)
   */
  const testFutureMonths = () => {
    clearResults();
    initializeMonths();
    
    const iterations = 10;
    const monthsPerIteration = 6;
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      addFutureMonths(monthsPerIteration);
      const end = performance.now();
      times.push(end - start);
    }
    
    const avgTime = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2);
    const maxTime = Math.max(...times).toFixed(2);
    const minTime = Math.min(...times).toFixed(2);
    
    addResult('미래 월 추가 평균', avgTime);
    addResult('미래 월 추가 최대', maxTime);
    addResult('미래 월 추가 최소', minTime);
    addResult('총 월 수', months.length, '개월');
  };

  /**
   * Test 3: 과거 월 추가 성능 (6개월 × 10회 = 60개월)
   */
  const testPastMonths = () => {
    clearResults();
    initializeMonths();
    
    const iterations = 10;
    const monthsPerIteration = 6;
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      addPastMonths(monthsPerIteration);
      const end = performance.now();
      times.push(end - start);
    }
    
    const avgTime = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2);
    const maxTime = Math.max(...times).toFixed(2);
    const minTime = Math.min(...times).toFixed(2);
    
    addResult('과거 월 추가 평균', avgTime);
    addResult('과거 월 추가 최대', maxTime);
    addResult('과거 월 추가 최소', minTime);
    addResult('총 월 수', months.length, '개월');
  };

  /**
   * Test 4: 메모리 사용량 (상태 크기)
   */
  const testMemoryUsage = () => {
    clearResults();
    initializeMonths();
    
    // 5개월
    const size5 = getStateSize();
    addResult('5개월 상태 크기', size5, 'KB');
    
    // 50개월
    addFutureMonths(45);
    const size50 = getStateSize();
    addResult('50개월 상태 크기', size50, 'KB');
    
    // 100개월
    addFutureMonths(50);
    const size100 = getStateSize();
    addResult('100개월 상태 크기', size100, 'KB');
    
    addResult('총 월 수', months.length, '개월');
  };

  /**
   * Test 5: 100개월 시뮬레이션 (빠른 스크롤)
   */
  const test100MonthsScroll = () => {
    clearResults();
    
    const totalStart = performance.now();
    
    // 초기화
    const initStart = performance.now();
    initializeMonths();
    const initEnd = performance.now();
    
    // 미래 50개월 추가 (6개월 × 8회 + 2개월)
    const futureStart = performance.now();
    for (let i = 0; i < 8; i++) {
      addFutureMonths(6);
    }
    addFutureMonths(2);
    const futureEnd = performance.now();
    
    // 과거 50개월 추가 (6개월 × 8회 + 2개월)
    const pastStart = performance.now();
    for (let i = 0; i < 8; i++) {
      addPastMonths(6);
    }
    addPastMonths(2);
    const pastEnd = performance.now();
    
    const totalEnd = performance.now();
    
    addResult('초기화', (initEnd - initStart).toFixed(2));
    addResult('미래 50개월 추가', (futureEnd - futureStart).toFixed(2));
    addResult('과거 50개월 추가', (pastEnd - pastStart).toFixed(2));
    addResult('총 소요 시간', (totalEnd - totalStart).toFixed(2));
    addResult('총 월 수', months.length, '개월');
    addResult('상태 크기', getStateSize(), 'KB');
  };

  /**
   * 모든 테스트 실행
   */
  const runAllTests = () => {
    clearResults();
    
    addResult('=== 전체 벤치마크 시작 ===', '', '');
    
    // Test 1
    testInitialization();
    addResult('---', '', '');
    
    // Test 2
    testFutureMonths();
    addResult('---', '', '');
    
    // Test 3
    testPastMonths();
    addResult('---', '', '');
    
    // Test 4
    testMemoryUsage();
    addResult('---', '', '');
    
    // Test 5
    test100MonthsScroll();
    
    addResult('=== 전체 벤치마크 완료 ===', '', '');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📊 Calendar Performance Benchmark</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={testInitialization}>
          <Text style={styles.buttonText}>Test 1: 초기화</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={testFutureMonths}>
          <Text style={styles.buttonText}>Test 2: 미래 월</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={testPastMonths}>
          <Text style={styles.buttonText}>Test 3: 과거 월</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={testMemoryUsage}>
          <Text style={styles.buttonText}>Test 4: 메모리</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={test100MonthsScroll}>
          <Text style={styles.buttonText}>Test 5: 100개월</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={runAllTests}>
          <Text style={[styles.buttonText, styles.primaryButtonText]}>🚀 전체 실행</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={clearResults}>
          <Text style={[styles.buttonText, styles.dangerButtonText]}>🗑️ 결과 초기화</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.resultsContainer}>
        <Text style={styles.resultsTitle}>📈 Results:</Text>
        {results.map((result, index) => (
          <View key={index} style={styles.resultRow}>
            <Text style={styles.resultLabel}>{result.label}</Text>
            <Text style={styles.resultValue}>
              {result.value} {result.unit}
            </Text>
          </View>
        ))}
      </ScrollView>
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonContainer: {
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#34C759',
  },
  primaryButtonText: {
    fontWeight: 'bold',
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
  },
  dangerButtonText: {
    fontWeight: 'bold',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  resultLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  resultValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
});
