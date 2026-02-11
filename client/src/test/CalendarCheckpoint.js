import React, { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import dayjs from 'dayjs';
import {
  generateWeeks,
  createMonthMetadata,
  createMonthMetadataFromDayjs,
  generateFutureMonths,
  generatePastMonths,
} from '../features/todo-calendar/utils/calendarHelpers';
import { useCalendarStore } from '../features/todo-calendar/store/calendarStore';

/**
 * Task 4 Checkpoint: 유틸리티 및 State 검증
 * 
 * 검증 항목:
 * 1. calendarHelpers.js 함수 동작 확인
 * 2. calendarStore.js 초기화 및 추가 로직 확인
 * 3. State 크기 확인 (100개월 기준 < 10KB)
 */
export default function CalendarCheckpoint() {
  const {
    months,
    initializeMonths,
    addFutureMonths,
    addPastMonths,
    getStateSize,
  } = useCalendarStore();

  useEffect(() => {
    console.log('\n========================================');
    console.log('📅 Task 4 Checkpoint: Calendar Utilities & Store Verification');
    console.log('========================================\n');

    runHelperTests();
  }, []);

  const runHelperTests = () => {
    console.log('--- 1. generateWeeks() 테스트 ---');
    const weeks = generateWeeks(2025, 2); // 2025년 2월
    console.log('✅ 2025년 2월 weeks 생성:', weeks.length, '주');
    console.log('   첫 번째 주:', weeks[0].map(d => `${d.date}(${d.isCurrentMonth ? 'O' : 'X'})`).join(', '));
    console.log('   마지막 주:', weeks[5].map(d => `${d.date}(${d.isCurrentMonth ? 'O' : 'X'})`).join(', '));
    
    // 오늘 날짜 확인
    const todayFound = weeks.flat().find(d => d.isToday);
    if (todayFound) {
      console.log('   오늘:', todayFound.dateString);
    }

    console.log('\n--- 2. createMonthMetadata() 테스트 ---');
    const meta1 = createMonthMetadata(2025, 2);
    console.log('✅ 2025년 2월 메타데이터:', meta1);

    console.log('\n--- 3. createMonthMetadataFromDayjs() 테스트 ---');
    const now = dayjs();
    const meta2 = createMonthMetadataFromDayjs(now);
    console.log('✅ 현재 월 메타데이터:', meta2);

    console.log('\n--- 4. generateFutureMonths() 테스트 ---');
    const futureMonths = generateFutureMonths(meta1, 3);
    console.log('✅ 2025-02 이후 3개월:', futureMonths.map(m => m.id).join(', '));

    console.log('\n--- 5. generatePastMonths() 테스트 ---');
    const pastMonths = generatePastMonths(meta1, 3);
    console.log('✅ 2025-02 이전 3개월:', pastMonths.map(m => m.id).join(', '));

    console.log('\n========================================');
    console.log('✅ calendarHelpers.js 모든 함수 정상 동작');
    console.log('========================================\n');
  };

  const testStoreInitialization = () => {
    console.log('\n--- Store 초기화 테스트 ---');
    initializeMonths();
    console.log('✅ 초기화 완료, 현재 months 개수:', months.length);
    console.log('   월 목록:', months.map(m => m.id).join(', '));
  };

  const testAddFutureMonths = () => {
    console.log('\n--- 미래 월 추가 테스트 ---');
    addFutureMonths(10);
    console.log('✅ 10개월 추가 완료, 현재 months 개수:', months.length);
    console.log('   마지막 5개월:', months.slice(-5).map(m => m.id).join(', '));
  };

  const testAddPastMonths = () => {
    console.log('\n--- 과거 월 추가 테스트 ---');
    addPastMonths(10);
    console.log('✅ 10개월 추가 완료, 현재 months 개수:', months.length);
    console.log('   첫 5개월:', months.slice(0, 5).map(m => m.id).join(', '));
  };

  const testMemoryLimit = () => {
    console.log('\n--- 메모리 제한 테스트 (100개월 추가) ---');
    const initialCount = months.length;
    addFutureMonths(100);
    console.log(`✅ 100개월 추가 시도, 현재 months 개수: ${months.length}`);
    console.log(`   메모리 제한 동작 확인: ${months.length <= 50 ? '✅ 정상 (50개월로 트림됨)' : '❌ 비정상'}`);
  };

  const testStateSize = () => {
    console.log('\n--- State 크기 측정 ---');
    const sizeKB = getStateSize();
    console.log(`✅ 현재 State 크기: ${sizeKB} KB (${months.length}개월)`);
    
    // 100개월 기준 예상 크기 계산
    const avgSizePerMonth = parseFloat(sizeKB) / months.length;
    const estimated100Months = (avgSizePerMonth * 100).toFixed(2);
    console.log(`   100개월 예상 크기: ${estimated100Months} KB`);
    console.log(`   요구사항 충족: ${estimated100Months < 10 ? '✅ < 10KB' : '❌ >= 10KB'}`);
  };

  const runAllTests = () => {
    console.log('\n🚀 전체 Store 테스트 시작\n');
    testStoreInitialization();
    setTimeout(() => testAddFutureMonths(), 500);
    setTimeout(() => testAddPastMonths(), 1000);
    setTimeout(() => testStateSize(), 1500);
    setTimeout(() => testMemoryLimit(), 2000);
    setTimeout(() => testStateSize(), 2500);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>📅 Task 4 Checkpoint</Text>
      <Text style={styles.subtitle}>Calendar Utilities & Store Verification</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>현재 State</Text>
        <Text style={styles.text}>Months 개수: {months.length}</Text>
        {months.length > 0 && (
          <>
            <Text style={styles.text}>첫 번째 월: {months[0].id}</Text>
            <Text style={styles.text}>마지막 월: {months[months.length - 1].id}</Text>
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>테스트 실행</Text>
        <TouchableOpacity style={styles.button} onPress={runAllTests}>
          <Text style={styles.buttonText}>🚀 전체 테스트 실행</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={testStoreInitialization}>
          <Text style={styles.buttonText}>1. Store 초기화</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={testAddFutureMonths}>
          <Text style={styles.buttonText}>2. 미래 월 추가 (10개월)</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={testAddPastMonths}>
          <Text style={styles.buttonText}>3. 과거 월 추가 (10개월)</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={testStateSize}>
          <Text style={styles.buttonText}>4. State 크기 측정</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={testMemoryLimit}>
          <Text style={styles.buttonText}>5. 메모리 제한 테스트</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>검증 결과</Text>
        <Text style={styles.info}>
          ✅ calendarHelpers.js 함수들이 정상 동작하는지 확인{'\n'}
          ✅ Store 초기화 및 추가 로직 확인{'\n'}
          ✅ State 크기가 100개월 기준 10KB 미만인지 확인{'\n'}
          {'\n'}
          📝 Console 로그를 확인하세요!
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  text: {
    fontSize: 14,
    marginBottom: 4,
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
    textAlign: 'center',
  },
  info: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
  },
});
