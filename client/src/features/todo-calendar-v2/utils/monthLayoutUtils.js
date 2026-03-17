import dayjs from 'dayjs';

import { getCalendarDateRange } from '../../../utils/calendarMonthHelpers';

export const TC2_DAY_CELL_HEIGHT = 88;
export const TC2_EVENT_LANE_HEIGHT = 14;
export const TC2_VISIBLE_LANE_COUNT = 3;
export const TC2_MONTH_TITLE_HEIGHT = 36;
export const TC2_MONTH_HEIGHT = TC2_MONTH_TITLE_HEIGHT + (6 * TC2_DAY_CELL_HEIGHT);

export function buildMonthGridWeeks(year, month, startDayOfWeek = 0) {
  const { startDate } = getCalendarDateRange(year, month, startDayOfWeek);
  const weeks = [];
  let cursor = dayjs(startDate);

  for (let weekIndex = 0; weekIndex < 6; weekIndex += 1) {
    const days = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      days.push({
        weekIndex,
        dayIndex,
        date: cursor.date(),
        dateString: cursor.format('YYYY-MM-DD'),
        isCurrentMonth: cursor.month() === month - 1,
      });
      cursor = cursor.add(1, 'day');
    }
    weeks.push(days);
  }

  return weeks;
}

export function getClassRank(candidate) {
  if (candidate.isSpan && candidate.isAllDay) return 0;
  if (candidate.isSpan && !candidate.isAllDay) return 1;
  if (!candidate.isSpan && candidate.isAllDay) return 2;
  return 3;
}

export function getCategoryOrderValue(categoryOrder) {
  return Number.isFinite(categoryOrder) ? categoryOrder : Number.POSITIVE_INFINITY;
}

export function compareLayoutCandidates(left, right) {
  const classDelta = getClassRank(left) - getClassRank(right);
  if (classDelta !== 0) return classDelta;

  const startDateDelta = String(left.sortStartDate).localeCompare(String(right.sortStartDate));
  if (startDateDelta !== 0) return startDateDelta;

  const startTimeDelta = String(left.sortStartTime ?? '').localeCompare(String(right.sortStartTime ?? ''));
  if (startTimeDelta !== 0) return startTimeDelta;

  const categoryDelta = getCategoryOrderValue(left.categoryOrder) - getCategoryOrderValue(right.categoryOrder);
  if (categoryDelta !== 0) return categoryDelta;

  const titleDelta = String(left.title || '').localeCompare(String(right.title || ''));
  if (titleDelta !== 0) return titleDelta;

  return String(left.todoId || left.id || '').localeCompare(String(right.todoId || right.id || ''));
}

export function addMonthsToMonthId(monthId, offset) {
  return dayjs(`${monthId}-01`).add(offset, 'month').format('YYYY-MM');
}
