/**
 * RRULE 기반 루틴 유틸리티
 */

/**
 * 특정 날짜가 RRULE 반복 규칙에 해당하는지 확인
 * @param {Date} date - 확인할 날짜
 * @param {string} rrule - RRULE 문자열 (예: "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR")
 * @param {Date} startDate - 반복 시작 날짜
 * @param {Date} endDate - 반복 종료 날짜 (선택적)
 * @returns {boolean} 해당 날짜에 이벤트가 발생하는지 여부
 */
export const isDateInRRule = (date, rrule, startDate, endDate = null) => {
  if (!rrule) return false;
  
  const targetDate = new Date(date);
  const ruleStartDate = new Date(startDate);
  
  // 시작 날짜 이전이면 false
  if (targetDate < new Date(ruleStartDate.setHours(0,0,0,0))) return false;
  
  // 종료 날짜 이후면 false
  if (endDate && targetDate > new Date(new Date(endDate).setHours(23,59,59,999))) return false;
  
  // RRULE에서 UNTIL 파싱
  const untilMatch = rrule.match(/UNTIL=(\d{8})/);
  if (untilMatch) {
    const untilStr = untilMatch[1]; // YYYYMMDD
    const untilDate = new Date(
      parseInt(untilStr.substr(0, 4)), // year
      parseInt(untilStr.substr(4, 2)) - 1, // month (0-based)
      parseInt(untilStr.substr(6, 2)) // day
    );
    if (targetDate > untilDate) return false;
  }
  
  // FREQ 파싱
  const freqMatch = rrule.match(/FREQ=(\w+)/);
  if (!freqMatch) return false;
  
  const frequency = freqMatch[1].toLowerCase();
  
  switch (frequency) {
    case 'daily':
      return true;
    
    case 'weekly':
      const bydayMatch = rrule.match(/BYDAY=([^;]+)/);
      if (bydayMatch) {
        const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
        const dayStrings = bydayMatch[1].split(',');
        const allowedDays = dayStrings.map(dayStr => days.indexOf(dayStr)).filter(day => day !== -1);
        const dayOfWeek = targetDate.getDay();
        return allowedDays.includes(dayOfWeek);
      }
      return false;
    
    case 'monthly':
      const bymonthdayMatch = rrule.match(/BYMONTHDAY=(\d+)/);
      if (bymonthdayMatch) {
        const dayOfMonth = parseInt(bymonthdayMatch[1]);
        return targetDate.getDate() === dayOfMonth;
      }
      return false;
    
    case 'yearly':
      const bymonthMatch = rrule.match(/BYMONTH=(\d+)/);
      const yearlyBymonthdayMatch = rrule.match(/BYMONTHDAY=(\d+)/);
      if (bymonthMatch && yearlyBymonthdayMatch) {
        const month = parseInt(bymonthMatch[1]);
        const day = parseInt(yearlyBymonthdayMatch[1]);
        return targetDate.getMonth() + 1 === month && targetDate.getDate() === day;
      }
      return false;
    
    default:
      return false;
  }
};

/**
 * 구 버전 호환성을 위한 래퍼 함수
 * @param {Date} date - 확인할 날짜
 * @param {Object} routine - 구 루틴 객체 (사용하지 않음)
 * @returns {boolean} 항상 false (구 데이터 구조는 더 이상 지원하지 않음)
 */
export const isDateInRoutine = (date, routine) => {
  console.warn('isDateInRoutine is deprecated. Use isDateInRRule instead.');
  return false;
};

export const generateRoutineEvents = (routine, dateRangeStart, dateRangeEnd) => {
  // 구 버전 호환성을 위한 빈 함수
  console.warn('generateRoutineEvents is deprecated.');
  return []; 
};
