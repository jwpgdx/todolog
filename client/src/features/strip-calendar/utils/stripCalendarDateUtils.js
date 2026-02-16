import dayjs from 'dayjs';
import { WEEKDAY_COUNT, WEEK_WINDOW_AFTER, WEEK_WINDOW_BEFORE, MONTHLY_VISIBLE_WEEK_COUNT } from './stripCalendarConstants';

export function normalizeStartDayOfWeek(startDayOfWeek) {
  return startDayOfWeek === 'monday' ? 'monday' : 'sunday';
}

export function toWeekStart(dateYmd, startDayOfWeek) {
  const normalized = normalizeStartDayOfWeek(startDayOfWeek);
  const d = dayjs(dateYmd);
  const day = d.day(); // 0 (Sun) .. 6 (Sat)

  if (normalized === 'monday') {
    const subtract = day === 0 ? 6 : day - 1;
    return d.subtract(subtract, 'day').format('YYYY-MM-DD');
  }

  return d.subtract(day, 'day').format('YYYY-MM-DD');
}

export function addDays(ymd, amount) {
  return dayjs(ymd).add(amount, 'day').format('YYYY-MM-DD');
}

export function addWeeks(ymd, amount) {
  return addDays(ymd, amount * 7);
}

export function isDateInInclusiveRange(dateYmd, startYmd, endYmd) {
  return dateYmd >= startYmd && dateYmd <= endYmd;
}

export function isDateVisibleInMonthlyViewport(topWeekStart, dateYmd) {
  const endDate = addDays(topWeekStart, MONTHLY_VISIBLE_WEEK_COUNT * WEEKDAY_COUNT - 1);
  return isDateInInclusiveRange(dateYmd, topWeekStart, endDate);
}

export function isTodayVisibleInMonthlyViewport(topWeekStart, todayDate) {
  return isDateVisibleInMonthlyViewport(topWeekStart, todayDate);
}

export function createWeekWindow(todayWeekStart) {
  const weekStarts = [];

  for (let i = -WEEK_WINDOW_BEFORE; i <= WEEK_WINDOW_AFTER; i += 1) {
    weekStarts.push(addWeeks(todayWeekStart, i));
  }

  return weekStarts;
}

export function shouldRecenterWeekWindow(weekStarts, targetWeekStart, edgeThreshold = 120) {
  if (!weekStarts.length || !targetWeekStart) return false;

  const index = weekStarts.indexOf(targetWeekStart);
  if (index === -1) return true;

  return index <= edgeThreshold || index >= weekStarts.length - edgeThreshold - 1;
}

export function getWeekIndex(weekStarts, targetWeekStart) {
  return weekStarts.indexOf(targetWeekStart);
}

export function getWeekDates(weekStartYmd, todayDate, currentDate, language = 'ko') {
  const result = [];
  let previousMonth = null;

  for (let i = 0; i < WEEKDAY_COUNT; i += 1) {
    const date = addDays(weekStartYmd, i);
    const parsed = dayjs(date);
    const month = parsed.month();

    let monthLabel = null;
    if (previousMonth !== null && previousMonth !== month) {
      monthLabel = formatShortMonthLabel(parsed, language);
    }

    result.push({
      date,
      dayNumber: parsed.date(),
      month,
      monthLabel,
      isToday: date === todayDate,
      isSelected: date === currentDate,
    });

    previousMonth = month;
  }

  return result;
}

function formatShortMonthLabel(parsedDay, language) {
  const year = parsedDay.year();
  const month1Based = parsedDay.month() + 1;

  if (language === 'en') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[month1Based - 1]}`;
  }

  if (language === 'ja') {
    return `${month1Based}月`;
  }

  if (language === 'ko') {
    return `${month1Based}월`;
  }

  return `${year}-${String(month1Based).padStart(2, '0')}`;
}

export function toMonthAnchor(weekStartYmd) {
  const parsed = dayjs(weekStartYmd);
  return {
    year: parsed.year(),
    month: parsed.month() + 1,
  };
}

export function getDateList(startDate, endDate) {
  const dates = [];
  let cursor = startDate;

  while (cursor <= endDate) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return dates;
}
