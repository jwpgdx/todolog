import dayjs from 'dayjs';

/**
 * Get weekday names based on language and start day
 * @param {string} language - 'ko' | 'en' | 'ja' | 'system'
 * @param {number} startDayOfWeek - 0 (Sunday) or 1 (Monday)
 * @returns {Array<string>} - Array of 7 weekday names
 */
export function getWeekdayNames(language = 'ko', startDayOfWeek = 0) {
  const weekdays = {
    ko: ['일', '월', '화', '수', '목', '금', '토'],
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    ja: ['日', '月', '火', '水', '木', '金', '土'],
  };
  
  // system은 한국어로 fallback
  const lang = language === 'system' ? 'ko' : language;
  const names = weekdays[lang] || weekdays.ko;
  
  // Rotate array based on startDayOfWeek
  if (startDayOfWeek === 1) {
    // Monday first: [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
    return [...names.slice(1), names[0]];
  }
  
  // Sunday first (default)
  return names;
}

/**
 * Format month title based on language
 * @param {number} year - Year (e.g., 2025)
 * @param {number} month - Month (1~12)
 * @param {string} language - 'ko' | 'en' | 'ja' | 'system'
 * @returns {string} - Formatted month title
 */
export function formatMonthTitle(year, month, language = 'ko') {
  const lang = language === 'system' ? 'ko' : language;
  
  switch (lang) {
    case 'en':
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[month - 1]} ${year}`;
    case 'ja':
      return `${year}年${month}月`;
    case 'ko':
    default:
      return `${year}년 ${month}월`;
  }
}

/**
 * 특정 월의 캘린더 그리드 날짜 범위 계산 (6주 고정)
 * @param {number} year - 연도 (예: 2025)
 * @param {number} month - 월 (1~12)
 * @param {number} startDayOfWeek - 0 (Sunday) or 1 (Monday)
 * @returns {{startDate: string, endDate: string}} - {startDate: "2025-01-26", endDate: "2025-03-08"}
 * 
 * @note generateWeeks와 동일한 gridStart 계산 로직 사용
 * @note 6주(42일) 범위 반환
 */
export function getCalendarDateRange(year, month, startDayOfWeek = 0) {
  try {
    const firstDay = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
    
    if (!firstDay.isValid()) {
      console.error(`Invalid date: ${year}-${month}`);
      return { startDate: '', endDate: '' };
    }
    
    // Calculate first day of the week based on startDayOfWeek setting
    let gridStart;
    if (startDayOfWeek === 1) {
      // Monday first: find previous Monday (or current day if it's Monday)
      const dayOfWeek = firstDay.day(); // 0 (Sun) ~ 6 (Sat)
      const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      gridStart = firstDay.subtract(daysToSubtract, 'day');
    } else {
      // Sunday first (default)
      gridStart = firstDay.day(0);  // Previous Sunday
    }
    
    // 6주(42일) 범위 계산
    const gridEnd = gridStart.add(41, 'day'); // 0-indexed: 0~41 = 42일
    
    return {
      startDate: gridStart.format('YYYY-MM-DD'),
      endDate: gridEnd.format('YYYY-MM-DD'),
    };
  } catch (error) {
    console.error('getCalendarDateRange error:', error);
    return { startDate: '', endDate: '' };
  }
}

/**
 * 특정 월의 6주 고정 weeks 배열 생성
 * @param {number} year - 연도 (예: 2025)
 * @param {number} month - 월 (1~12)
 * @param {number} startDayOfWeek - 0 (Sunday) or 1 (Monday)
 * @returns {Array<Array<DayObject>>} - 6주 × 7일 배열
 * 
 * DayObject: {
 *   date: number,           // 1~31
 *   dateString: string,     // "2025-01-28" (unique key for React)
 *   isCurrentMonth: boolean,
 *   isToday: boolean
 * }
 */
export function generateWeeks(year, month, startDayOfWeek = 0) {
  try {
    // ✅ [필수 리팩토링] getCalendarDateRange를 사용하여 날짜 계산 로직 통일
    const { startDate, endDate } = getCalendarDateRange(year, month, startDayOfWeek);
    
    if (!startDate || !endDate) {
      console.error(`Invalid date range: ${year}-${month}`);
      return generateEmptyWeeks();
    }
    
    const weeks = [];
    let currentDay = dayjs(startDate);
    const today = dayjs();
    
    // 6주 고정 생성 (42일)
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
