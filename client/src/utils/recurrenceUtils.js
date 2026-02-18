/**
 * 클라이언트용 반복 규칙 유틸리티 (RRULE 기반)
 */

import { normalizeRecurrence, occursOnDateNormalized } from './recurrenceEngine';

/**
 * 할일 입력 데이터를 RRULE 기반 API 형식으로 변환
 * @param {Object} formData - 폼에서 입력받은 데이터
 * @returns {Object} API 전송용 데이터
 */
export function convertToApiFormat(formData) {
  let {
    title,
    memo,
    categoryId,
    startDate,
    startTime,
    endDate,
    endTime,
    isRecurring,
    frequency,
    weekdays,
    dayOfMonth,
    month,
    day,
    recurrenceEndDate,
  } = formData;

  // 1. 시간 자동 채움 로직 (종료 시간만 있는 경우 시작 시간 = 종료 시간 - 1시간)
  if (!startTime && endTime) {
    const end = new Date(`${startDate}T${endTime}`);
    end.setHours(end.getHours() - 1);
    const hours = String(end.getHours()).padStart(2, '0');
    const minutes = String(end.getMinutes()).padStart(2, '0');
    startTime = `${hours}:${minutes}`;
  }

  // 2. 반복 일정 처리 (종료 날짜 = 시작 날짜)
  if (isRecurring) {
    endDate = startDate;
  } else {
    // 반복이 아닌데 종료 날짜가 없으면 시작 날짜와 동일하게 설정 (단, 종료 시간이 있는 경우)
    if (!endDate && endTime) {
      endDate = startDate;
    }
    // 종료 날짜도 없고 종료 시간도 없으면 endDate는 null (종료일 없음)
  }

  // 3. 하루종일 여부 판단
  const isAllDay = !startTime && !endTime;

  // 4. 반복 규칙 생성
  let recurrence = null;
  let finalRecurrenceEndDate = null; // YYYY-MM-DD string

  if (isRecurring && frequency) {
    recurrence = createRRuleString(frequency, { weekdays, dayOfMonth, month, day });
    if (recurrenceEndDate) {
      finalRecurrenceEndDate = recurrenceEndDate; // 문자열 그대로 사용
    }
  }

  // 5. API 전송 데이터 구성
  return {
    title,
    memo,
    categoryId,
    startDate,                // "2025-12-28"
    startTime: startTime || null, // "16:00" or null
    endDate: endDate || null,   // "2025-12-28" or null
    endTime: endTime || null,   // "17:00" or null
    userTimeZone: getUserTimeZone(),
    isAllDay,
    recurrence,
    recurrenceEndDate: finalRecurrenceEndDate, // "2025-12-31" or null
  };
}

/**
 * API 응답 데이터를 UI 표시용으로 변환
 * @param {Object} todo - API에서 받은 할일 데이터
 * @returns {Object} UI 표시용 데이터
 */
export function convertFromApiFormat(todo) {
  // 1. 새로운 포맷 (startDate / startTime 분리) 지원
  if (todo.startDate && !todo.startDateTime) {
    const { startDate, startTime, endDate, endTime, isAllDay, recurrence, recurrenceEndDate, ...rest } = todo;
    let result = {
      ...rest,
      startDate,
      startTime: startTime || '',
      endDate: endDate || null,
      endTime: endTime || '',
      isRecurring: !!recurrence,
      isAllDay: (isAllDay !== undefined) ? isAllDay : (!startTime && !endTime),
    };

    if (recurrence) {
      const routineInfo = parseRRuleString(recurrence);
      Object.assign(result, routineInfo);

      if (recurrenceEndDate) {
        result.recurrenceEndDate = recurrenceEndDate;
      }
    }
    return result;
  }

  // 2. 기존 포맷 (startDateTime / endDateTime ISO string) 지원
  const {
    startDateTime,
    endDateTime,
    recurrence,
    recurrenceEndDate,
    ...rest
  } = todo;

  // 하루종일 할일인지 확인 (startDateTime이 null이면 하루종일)
  const isAllDay = !startDateTime;

  let result = {
    ...rest,
    isRecurring: !!recurrence,
    isAllDay, // 하루종일 여부 추가
  };

  if (isAllDay) {
    // 하루종일 할일: 시간 정보 없음
    result.startDate = todo.startDate || new Date().toISOString().split('T')[0]; // 기본값
    result.startTime = '';
    result.endDate = todo.endDate || null;
    result.endTime = '';
  } else {
    // 시간 지정 할일: 기존 로직
    const startDate = new Date(startDateTime);
    const endDate = endDateTime ? new Date(endDateTime) : null;

    result.startDate = formatDate(startDate);
    result.startTime = formatTime(startDate);
    result.endDate = endDate ? formatDate(endDate) : null;
    result.endTime = endDate ? formatTime(endDate) : null;
  }

  // 반복 정보 파싱
  if (recurrence) {
    const routineInfo = parseRRuleString(recurrence);
    Object.assign(result, routineInfo);

    if (recurrenceEndDate) {
      result.recurrenceEndDate = formatDate(new Date(recurrenceEndDate));
    }
  }

  return result;
}



/**
 * Date 객체를 YYYY-MM-DD 형식으로 변환 (사용자 시간대 기준)
 * @param {Date} date - Date 객체
 * @returns {string} YYYY-MM-DD 형식
 */
function formatDate(date) {
  // 사용자 시간대 기준으로 날짜 포맷팅
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Date 객체를 HH:mm 형식으로 변환 (사용자 시간대 기준)
 * @param {Date} date - Date 객체
 * @returns {string} HH:mm 형식
 */
function formatTime(date) {
  // 사용자 시간대 기준으로 시간 포맷팅
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * 반복 설정으로 RRULE 문자열 생성
 * @param {string} frequency - daily, weekly, monthly, yearly
 * @param {Object} options - 추가 옵션들
 * @returns {string} RRULE 문자열
 */
function createRRuleString(frequency, options = {}) {
  let rrule = `RRULE:FREQ=${frequency.toUpperCase()}`;

  switch (frequency) {
    case 'weekly':
      if (options.weekdays && options.weekdays.length > 0) {
        const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
        const byday = options.weekdays.map(day => days[day]).join(',');
        rrule += `;BYDAY=${byday}`;
      }
      break;

    case 'monthly':
      if (options.dayOfMonth) {
        rrule += `;BYMONTHDAY=${options.dayOfMonth}`;
      }
      break;

    case 'yearly':
      if (options.month && options.day) {
        rrule += `;BYMONTH=${options.month};BYMONTHDAY=${options.day}`;
      }
      break;
  }

  return rrule;
}

/**
 * RRULE 문자열을 파싱하여 반복 정보 추출
 * @param {string} rrule - RRULE 문자열
 * @returns {Object} 반복 정보 객체
 */
function parseRRuleString(rrule) {
  const result = {};

  // FREQ 파싱
  const freqMatch = rrule.match(/FREQ=(\w+)/);
  if (freqMatch) {
    result.frequency = freqMatch[1].toLowerCase();
  }

  // BYDAY 파싱 (주간 반복)
  const bydayMatch = rrule.match(/BYDAY=([^;]+)/);
  if (bydayMatch && result.frequency === 'weekly') {
    const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const dayStrings = bydayMatch[1].split(',');
    result.weekdays = dayStrings.map(dayStr => days.indexOf(dayStr)).filter(day => day !== -1);
  }

  // BYMONTHDAY 파싱 (월간 반복)
  const bymonthdayMatch = rrule.match(/BYMONTHDAY=(\d+)/);
  if (bymonthdayMatch && result.frequency === 'monthly') {
    result.dayOfMonth = parseInt(bymonthdayMatch[1]);
  }

  // BYMONTH, BYMONTHDAY 파싱 (연간 반복)
  const bymonthMatch = rrule.match(/BYMONTH=(\d+)/);
  if (bymonthMatch && result.frequency === 'yearly') {
    result.month = parseInt(bymonthMatch[1]);
    if (bymonthdayMatch) {
      result.day = parseInt(bymonthdayMatch[1]);
    }
  }

  return result;
}

/**
 * 반복 규칙 설명 생성
 * @param {string} recurrence - RRULE 문자열
 * @returns {string} 사용자 친화적 설명
 */
export function getRecurrenceDescription(recurrence) {
  if (!recurrence) return '반복 없음';

  const freqMatch = recurrence.match(/FREQ=(\w+)/);
  if (!freqMatch) return '반복 규칙 오류';

  const frequency = freqMatch[1].toLowerCase();

  switch (frequency) {
    case 'daily':
      return '매일 반복';

    case 'weekly':
      const bydayMatch = recurrence.match(/BYDAY=([^;]+)/);
      if (bydayMatch) {
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
        const dayStrings = bydayMatch[1].split(',');
        const koreanDays = dayStrings.map(dayStr => {
          const index = days.indexOf(dayStr);
          return index !== -1 ? dayNames[index] : dayStr;
        });
        return `매주 ${koreanDays.join(', ')}요일`;
      }
      return '매주 반복';

    case 'monthly':
      const bymonthdayMatch = recurrence.match(/BYMONTHDAY=(\d+)/);
      if (bymonthdayMatch) {
        return `매월 ${bymonthdayMatch[1]}일`;
      }
      return '매월 반복';

    case 'yearly':
      const bymonthMatch = recurrence.match(/BYMONTH=(\d+)/);
      const yearlyBymonthdayMatch = recurrence.match(/BYMONTHDAY=(\d+)/);
      if (bymonthMatch && yearlyBymonthdayMatch) {
        return `매년 ${bymonthMatch[1]}월 ${yearlyBymonthdayMatch[1]}일`;
      }
      return '매년 반복';

    default:
      return '반복';
  }
}

/**
 * 할일이 특정 날짜에 발생하는지 체크 (서버 로직과 동일)
 * @param {Object} todo - 할일 객체
 * @param {string} targetDate - 확인할 날짜 (YYYY-MM-DD)
 * @returns {boolean} 발생 여부
 */
export function occursOnDate(todo, targetDate) {
  // 하루종일 할일인 경우
  if (todo.isAllDay) {
    // 반복 할일인 경우
    if (todo.recurrence) {
      return checkRecurrenceOnDate(
        todo.recurrence,
        todo.startDate,
        targetDate,
        todo.recurrenceEndDate
      );
    } else {
      // 단일 날짜 또는 기간 할일
      const startDateStr = todo.startDate;
      const endDateStr = todo.endDate || todo.startDate;
      return targetDate >= startDateStr && targetDate <= endDateStr;
    }
  } else {
    // 시간 지정 할일인 경우
    if (!todo.startDateTime) return false;
    
    const startDate = new Date(todo.startDateTime);
    const startDateStr = formatDate(startDate);

    // 반복이 없는 경우
    if (!todo.recurrence) {
      // 기간 할일인 경우
      if (todo.endDateTime) {
        const endDate = new Date(todo.endDateTime);
        const endDateStr = formatDate(endDate);
        return targetDate >= startDateStr && targetDate <= endDateStr;
      }
      // 단일 날짜 할일
      return targetDate === startDateStr;
    }

    // 반복 할일
    return checkRecurrenceOnDate(
      todo.recurrence,
      startDateStr,
      targetDate,
      todo.recurrenceEndDate
    );
  }
}

/**
 * RRULE 문자열을 기반으로 특정 날짜에 발생하는지 체크
 * @param {string} rruleString - RRULE 문자열 (예: "RRULE:FREQ=DAILY")
 * @param {string} startDate - 시작 날짜 (YYYY-MM-DD)
 * @param {string} targetDate - 확인할 날짜 (YYYY-MM-DD)
 * @param {string} recurrenceEndDate - 반복 종료 날짜 (YYYY-MM-DD)
 * @returns {boolean} 발생 여부
 */
function checkRecurrenceOnDate(rruleString, startDate, targetDate, recurrenceEndDate) {
  if (!rruleString) return false;

  const normalized = normalizeRecurrence(rruleString, recurrenceEndDate, {
    startDate,
  });

  return occursOnDateNormalized(normalized, targetDate);
}

/**
 * 사용자의 현재 시간대 정보 가져오기
 * @returns {string} 시간대 문자열 (예: 'Asia/Seoul')
 */
export function getUserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
