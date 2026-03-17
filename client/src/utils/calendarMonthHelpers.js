import dayjs from 'dayjs';

/**
 * Get weekday names based on language and start day.
 * @param {string} language
 * @param {number} startDayOfWeek
 * @returns {Array<string>}
 */
export function getWeekdayNames(language = 'ko', startDayOfWeek = 0) {
  const weekdays = {
    ko: ['일', '월', '화', '수', '목', '금', '토'],
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    ja: ['日', '月', '火', '水', '木', '金', '土'],
  };

  const lang = language === 'system' ? 'ko' : language;
  const names = weekdays[lang] || weekdays.ko;

  if (startDayOfWeek === 1) {
    return [...names.slice(1), names[0]];
  }

  return names;
}

/**
 * Format month title based on language.
 * @param {number} year
 * @param {number} month
 * @param {string} language
 * @returns {string}
 */
export function formatMonthTitle(year, month, language = 'ko') {
  const lang = language === 'system' ? 'ko' : language;

  switch (lang) {
    case 'en': {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[month - 1]} ${year}`;
    }
    case 'ja':
      return `${year}年${month}月`;
    case 'ko':
    default:
      return `${year}년 ${month}월`;
  }
}

/**
 * Calculate a fixed 6-week grid range for a month.
 * @param {number} year
 * @param {number} month
 * @param {number} startDayOfWeek
 * @returns {{startDate: string, endDate: string}}
 */
export function getCalendarDateRange(year, month, startDayOfWeek = 0) {
  try {
    const firstDay = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);

    if (!firstDay.isValid()) {
      console.error(`Invalid date: ${year}-${month}`);
      return { startDate: '', endDate: '' };
    }

    let gridStart;
    if (startDayOfWeek === 1) {
      const dayOfWeek = firstDay.day();
      const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      gridStart = firstDay.subtract(daysToSubtract, 'day');
    } else {
      gridStart = firstDay.day(0);
    }

    const gridEnd = gridStart.add(41, 'day');

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
 * Generate 6 fixed weeks for a month.
 * @param {number} year
 * @param {number} month
 * @param {number} startDayOfWeek
 * @param {string|null} todayDate
 * @returns {Array<Array<{date:number,dateString:string,isCurrentMonth:boolean,isToday:boolean}>>}
 */
export function generateWeeks(year, month, startDayOfWeek = 0, todayDate = null) {
  try {
    const { startDate } = getCalendarDateRange(year, month, startDayOfWeek);

    if (!startDate) {
      console.error(`Invalid date range: ${year}-${month}`);
      return generateEmptyWeeks();
    }

    const weeks = [];
    let currentDay = dayjs(startDate);
    const resolvedTodayDate = todayDate || dayjs().format('YYYY-MM-DD');

    for (let week = 0; week < 6; week += 1) {
      const weekDays = [];
      for (let day = 0; day < 7; day += 1) {
        weekDays.push({
          date: currentDay.date(),
          dateString: currentDay.format('YYYY-MM-DD'),
          isCurrentMonth: currentDay.month() === month - 1,
          isToday: currentDay.format('YYYY-MM-DD') === resolvedTodayDate,
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

function generateEmptyWeeks() {
  const weeks = [];
  for (let week = 0; week < 6; week += 1) {
    const weekDays = [];
    for (let day = 0; day < 7; day += 1) {
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

export function createMonthMetadata(year, month) {
  return {
    year,
    month,
    id: `${year}-${String(month).padStart(2, '0')}`,
  };
}

export function createMonthMetadataFromDayjs(dayjsObj) {
  const year = dayjsObj.year();
  const month = dayjsObj.month() + 1;
  return createMonthMetadata(year, month);
}

export function generateFutureMonths(lastMonth, count) {
  const result = [];
  let current = dayjs(`${lastMonth.year}-${String(lastMonth.month).padStart(2, '0')}-01`);

  for (let i = 0; i < count; i += 1) {
    current = current.add(1, 'month');
    result.push(createMonthMetadataFromDayjs(current));
  }

  return result;
}

export function generatePastMonths(firstMonth, count) {
  const result = [];
  let current = dayjs(`${firstMonth.year}-${String(firstMonth.month).padStart(2, '0')}-01`);

  for (let i = 0; i < count; i += 1) {
    current = current.subtract(1, 'month');
    result.unshift(createMonthMetadataFromDayjs(current));
  }

  return result;
}
