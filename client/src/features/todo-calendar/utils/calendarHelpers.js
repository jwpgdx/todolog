import dayjs from 'dayjs';

/**
 * 특정 월의 6주 고정 weeks 배열 생성
 * @param {number} year - 연도 (예: 2025)
 * @param {number} month - 월 (1~12)
 * @returns {Array<Array<DayObject>>} - 6주 × 7일 배열
 * 
 * DayObject: {
 *   date: number,           // 1~31
 *   dateString: string,     // "2025-01-28" (unique key for React)
 *   isCurrentMonth: boolean,
 *   isToday: boolean
 * }
 */
export function generateWeeks(year, month) {
  try {
    const firstDay = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
    
    if (!firstDay.isValid()) {
      console.error(`Invalid date: ${year}-${month}`);
      return generateEmptyWeeks();
    }
    
    // 첫 주 시작일 (일요일 기준)
    const startDay = firstDay.day(0);  // 이전 주 일요일
    
    const weeks = [];
    let currentDay = startDay;
    const today = dayjs();
    
    // 6주 고정 생성
    for (let week = 0; week < 6; week++) {
      const weekDays = [];
      for (let day = 0; day < 7; day++) {
        weekDays.push({
          date: currentDay.date(),
          dateString: currentDay.format('YYYY-MM-DD'),  // ✅ unique key
          isCurrentMonth: currentDay.month() === month - 1,  // dayjs month is 0-indexed
          isToday: currentDay.isSame(today, 'day'),
        });
        currentDay = currentDay.add(1, 'day');
      }
      weeks.push(weekDays);
    }
    
    return weeks;
  } catch (error) {
    console.error('generateWeeks error:', error);
    return generateEmptyWeeks();
  }
}

/**
 * 빈 6주 배열 생성 (에러 처리용)
 * @returns {Array<Array<DayObject>>}
 */
function generateEmptyWeeks() {
  const weeks = [];
  for (let week = 0; week < 6; week++) {
    const weekDays = [];
    for (let day = 0; day < 7; day++) {
      weekDays.push({
        date: 0,
        dateString: '',
        isCurrentMonth: false,
        isToday: false,
      });
    }
    weeks.push(weekDays);
  }
  return weeks;
}

/**
 * 월 메타데이터 생성
 * @param {number} year - 연도 (예: 2025)
 * @param {number} month - 월 (1~12)
 * @returns {MonthMetadata} - {year, month, id}
 */
export function createMonthMetadata(year, month) {
  return {
    year,
    month,
    id: `${year}-${String(month).padStart(2, '0')}`,
  };
}

/**
 * dayjs 객체로부터 MonthMetadata 생성 (안전한 래퍼)
 * @param {Dayjs} dayjsObj - dayjs 인스턴스
 * @returns {MonthMetadata}
 * @note dayjs.month()는 0-indexed (0=1월, 11=12월)이므로 +1 필요
 */
export function createMonthMetadataFromDayjs(dayjsObj) {
  const year = dayjsObj.year();
  const month = dayjsObj.month() + 1;  // 0-indexed → 1-indexed
  return createMonthMetadata(year, month);
}

/**
 * 미래 N개월 메타데이터 배열 생성
 * @param {MonthMetadata} lastMonth - 마지막 월 메타데이터
 * @param {number} count - 생성할 개수
 * @returns {Array<MonthMetadata>}
 */
export function generateFutureMonths(lastMonth, count) {
  const result = [];
  let current = dayjs(`${lastMonth.year}-${String(lastMonth.month).padStart(2, '0')}-01`);
  
  for (let i = 0; i < count; i++) {
    current = current.add(1, 'month');
    result.push(createMonthMetadataFromDayjs(current));
  }
  
  return result;
}

/**
 * 과거 N개월 메타데이터 배열 생성
 * @param {MonthMetadata} firstMonth - 첫 번째 월 메타데이터
 * @param {number} count - 생성할 개수
 * @returns {Array<MonthMetadata>}
 */
export function generatePastMonths(firstMonth, count) {
  const result = [];
  let current = dayjs(`${firstMonth.year}-${String(firstMonth.month).padStart(2, '0')}-01`);
  
  for (let i = 0; i < count; i++) {
    current = current.subtract(1, 'month');
    result.unshift(createMonthMetadataFromDayjs(current));
  }
  
  return result;
}
