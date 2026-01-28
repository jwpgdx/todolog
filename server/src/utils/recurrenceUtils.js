const { RRule, RRuleSet } = require('rrule');

/**
 * 기존 routine 객체를 RRULE 문자열로 변환
 * @param {Object} routine - 기존 routine 객체
 * @param {Date} startDateTime - 시작 일시
 * @returns {string} RRULE 문자열
 */
function routineToRRule(routine, startDateTime) {
  if (!routine || !routine.frequency) return null;
  
  const options = {
    freq: getFrequency(routine.frequency),
    dtstart: startDateTime,
  };
  
  // 반복 종료일 설정
  if (routine.endDate) {
    options.until = new Date(routine.endDate + 'T23:59:59');
  }
  
  // 주기별 설정
  switch (routine.frequency) {
    case 'weekly':
      if (routine.weekdays && routine.weekdays.length > 0) {
        // [1, 3, 5] -> [RRule.MO, RRule.WE, RRule.FR]
        options.byweekday = routine.weekdays.map(day => {
          const weekdays = [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA];
          return weekdays[day];
        });
      }
      break;
      
    case 'monthly':
      if (routine.dayOfMonth) {
        options.bymonthday = routine.dayOfMonth;
      }
      break;
      
    case 'yearly':
      if (routine.month && routine.day) {
        options.bymonth = routine.month;
        options.bymonthday = routine.day;
      }
      break;
  }
  
  const rule = new RRule(options);
  return rule.toString().replace('DTSTART:', ''); // DTSTART 제거 (별도 저장)
}

/**
 * RRULE 문자열과 시작일시로 특정 기간의 발생 날짜들 계산
 * @param {string} rruleString - RRULE 문자열
 * @param {Date} startDateTime - 시작 일시 (UTC)
 * @param {Date} rangeStart - 조회 시작일 (UTC)
 * @param {Date} rangeEnd - 조회 종료일 (UTC)
 * @param {Date[]} exdates - 제외할 날짜들
 * @returns {Date[]} 발생 날짜 배열
 */
function getOccurrences(rruleString, startDateTime, rangeStart, rangeEnd, exdates = []) {
  if (!rruleString) {
    // 단발성 할일 - 범위 내에 있으면 반환
    if (startDateTime >= rangeStart && startDateTime <= rangeEnd) {
      return [startDateTime];
    }
    return [];
  }
  
  try {
    // UTC 기준으로 DTSTART 생성
    const fullRRule = `DTSTART:${formatDateForRRule(startDateTime)}\n${rruleString}`;
    const rule = RRule.fromString(fullRRule);
    
    // 기간 내 발생 날짜 계산
    const occurrences = rule.between(rangeStart, rangeEnd, true);
    
    // 제외 날짜 필터링
    if (exdates.length > 0) {
      return occurrences.filter(date => {
        return !exdates.some(exdate => 
          date.toDateString() === exdate.toDateString()
        );
      });
    }
    
    return occurrences;
  } catch (error) {
    console.error('RRULE 파싱 오류:', error);
    return [];
  }
}

/**
 * 특정 날짜에 할일이 발생하는지 확인
 * @param {string} rruleString - RRULE 문자열
 * @param {Date} startDateTime - 시작 일시 (UTC)
 * @param {Date} targetDate - 확인할 날짜 (UTC)
 * @param {Date[]} exdates - 제외할 날짜들
 * @returns {boolean} 발생 여부
 */
function occursOnDate(rruleString, startDateTime, targetDate, exdates = []) {
  // 제외 날짜 확인
  if (exdates.some(exdate => exdate.toDateString() === targetDate.toDateString())) {
    return false;
  }
  
  if (!rruleString) {
    // 단발성 할일
    return startDateTime.toDateString() === targetDate.toDateString();
  }
  
  try {
    // UTC 기준으로 DTSTART 생성
    const fullRRule = `DTSTART:${formatDateForRRule(startDateTime)}\n${rruleString}`;
    const rule = RRule.fromString(fullRRule);
    
    // 해당 날짜에 발생하는지 확인
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);
    
    const occurrences = rule.between(dayStart, dayEnd, true);
    return occurrences.length > 0;
  } catch (error) {
    console.error('RRULE 확인 오류:', error);
    return false;
  }
}

/**
 * 구글 캘린더용 RRULE 문자열 생성
 * @param {string} rruleString - 내부 RRULE 문자열
 * @param {Date} startDateTime - 시작 일시 (UTC)
 * @returns {string} 구글 캘린더용 RRULE
 */
function toGoogleCalendarRRule(rruleString, startDateTime) {
  if (!rruleString) return null;
  
  // 구글 캘린더는 DTSTART가 포함된 전체 RRULE을 원함
  return `DTSTART:${formatDateForRRule(startDateTime)}\n${rruleString}`;
}

// === 헬퍼 함수들 ===

function getFrequency(frequency) {
  const freqMap = {
    'daily': RRule.DAILY,
    'weekly': RRule.WEEKLY,
    'monthly': RRule.MONTHLY,
    'yearly': RRule.YEARLY,
  };
  return freqMap[frequency] || RRule.DAILY;
}

/**
 * Date 객체를 RRULE용 날짜 문자열로 변환 (UTC 기준)
 * @param {Date} date - Date 객체 (UTC)
 * @returns {string} RRULE용 날짜 문자열
 */
function formatDateForRRule(date) {
  // UTC 기준으로 RRULE 형식 생성
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * 사용자 친화적인 반복 설명 생성
 * @param {string} rruleString - RRULE 문자열
 * @param {Date} startDateTime - 시작 일시 (UTC)
 * @returns {string} 반복 설명
 */
function getRecurrenceDescription(rruleString, startDateTime) {
  if (!rruleString) return '반복 없음';
  
  try {
    const fullRRule = `DTSTART:${formatDateForRRule(startDateTime)}\n${rruleString}`;
    const rule = RRule.fromString(fullRRule);
    return rule.toText(); // "every week on Monday, Wednesday"
  } catch (error) {
    return '반복 규칙 오류';
  }
}

module.exports = {
  routineToRRule,
  getOccurrences,
  occursOnDate,
  toGoogleCalendarRRule,
  getRecurrenceDescription,
};