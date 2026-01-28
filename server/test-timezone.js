/**
 * 시간대 처리 테스트 스크립트
 */

const { occursOnDate } = require('./src/utils/recurrenceUtils');

// 테스트 데이터
const testCases = [
  {
    name: '매주 화요일 반복 (한국 시간대)',
    rrule: 'RRULE:FREQ=WEEKLY;BYDAY=TU',
    startDateTime: new Date('2024-12-17T09:00:00.000Z'), // UTC 기준 화요일 09:00 (한국 시간 18:00)
    testDates: [
      { date: '2024-12-17', expected: true, description: '화요일 (시작일)' },
      { date: '2024-12-18', expected: false, description: '수요일' },
      { date: '2024-12-24', expected: true, description: '다음 화요일' },
      { date: '2024-12-25', expected: false, description: '수요일' },
    ]
  },
  {
    name: '매주 목요일 반복 (한국 시간대)',
    rrule: 'RRULE:FREQ=WEEKLY;BYDAY=TH',
    startDateTime: new Date('2024-12-19T09:00:00.000Z'), // UTC 기준 목요일 09:00 (한국 시간 18:00)
    testDates: [
      { date: '2024-12-19', expected: true, description: '목요일 (시작일)' },
      { date: '2024-12-20', expected: false, description: '금요일' },
      { date: '2024-12-26', expected: true, description: '다음 목요일' },
      { date: '2024-12-27', expected: false, description: '금요일' },
    ]
  }
];

console.log('🧪 시간대 처리 테스트 시작\n');

testCases.forEach((testCase, index) => {
  console.log(`📋 테스트 케이스 ${index + 1}: ${testCase.name}`);
  console.log(`   RRULE: ${testCase.rrule}`);
  console.log(`   시작 시간: ${testCase.startDateTime.toISOString()}`);
  console.log(`   시작 시간 (한국): ${testCase.startDateTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
  console.log('');

  let allPassed = true;

  testCase.testDates.forEach(({ date, expected, description }) => {
    const targetDate = new Date(date + 'T00:00:00.000Z');
    const result = occursOnDate(testCase.rrule, testCase.startDateTime, targetDate);
    const passed = result === expected;
    
    if (!passed) allPassed = false;

    console.log(`   ${passed ? '✅' : '❌'} ${date} (${description}): ${result} (예상: ${expected})`);
  });

  console.log(`   ${allPassed ? '🎉 모든 테스트 통과!' : '💥 일부 테스트 실패'}\n`);
});

console.log('🏁 테스트 완료');