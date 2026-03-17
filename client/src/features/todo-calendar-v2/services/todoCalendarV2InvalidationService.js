import dayjs from 'dayjs';

import { invalidateRangeCacheByDateRange } from '../../../services/query-aggregation/cache';
import { useTodoCalendarV2Store } from '../store/useTodoCalendarV2Store';

function rangesOverlap(left, right) {
  if (!left?.startDate || !left?.endDate || !right?.startDate || !right?.endDate) {
    return false;
  }

  return !(
    left.endDate < right.startDate ||
    left.startDate > right.endDate
  );
}

function hasRecurrence(todo) {
  const recurrence = todo?.recurrence;
  if (!recurrence) return false;
  if (typeof recurrence === 'string') return recurrence.trim().length > 0;
  return true;
}

function resolveTodoStartDate(todo) {
  return todo?.startDate || todo?.date || null;
}

function resolveTodoEndDate(todo) {
  return todo?.recurrenceEndDate || todo?.endDate || resolveTodoStartDate(todo);
}

function buildMonthIdsForRange(startDate, endDate) {
  if (!startDate || !endDate) return [];

  const ids = [];
  let cursor = dayjs(`${startDate.slice(0, 7)}-01`).subtract(1, 'month');
  const finalMonth = dayjs(`${endDate.slice(0, 7)}-01`).add(1, 'month');

  while (cursor.isBefore(finalMonth) || cursor.isSame(finalMonth, 'month')) {
    ids.push(cursor.format('YYYY-MM'));
    cursor = cursor.add(1, 'month');
  }

  return ids;
}

function resolveTodoInvalidationRanges(todo, visibleContext) {
  const startDate = resolveTodoStartDate(todo);
  if (!startDate) return [];

  const endDate = resolveTodoEndDate(todo) || startDate;

  if (hasRecurrence(todo) && !todo?.recurrenceEndDate) {
    const clippedStart = visibleContext?.requestStartDate && visibleContext.requestStartDate > startDate
      ? visibleContext.requestStartDate
      : startDate;
    const clippedEnd = visibleContext?.requestEndDate || null;

    if (clippedEnd && clippedStart <= clippedEnd) {
      return [{ startDate: clippedStart, endDate: clippedEnd }];
    }

    return [{ startDate, endDate: startDate }];
  }

  return [{ startDate, endDate }];
}

export function requestIdleReensureTodoCalendarV2() {
  useTodoCalendarV2Store.getState().requestIdleReensure();
}

export function invalidateTodoCalendarV2Layouts({ todo, reason = 'unknown' } = {}) {
  if (!todo) {
    return {
      ok: false,
      reason,
      error: 'todo is required',
    };
  }

  const store = useTodoCalendarV2Store.getState();
  const visibleContext = store.visibleContext || null;
  const ranges = resolveTodoInvalidationRanges(todo, visibleContext);
  const monthIds = [...new Set(
    ranges.flatMap((range) => buildMonthIdsForRange(range.startDate, range.endDate)),
  )];

  if (monthIds.length > 0) {
    store.invalidateMonthLayouts(monthIds);
  }

  ranges.forEach((range) => {
    invalidateRangeCacheByDateRange({
      startDate: range.startDate,
      endDate: range.endDate,
      reason: `todo-calendar-v2:${reason}`,
    });
  });

  const shouldReensure =
    visibleContext &&
    ranges.some((range) => rangesOverlap(range, {
      startDate: visibleContext.requestStartDate,
      endDate: visibleContext.requestEndDate,
    }));

  if (shouldReensure) {
    store.requestIdleReensure();
  }

  return {
    ok: true,
    reason,
    ranges,
    monthIds,
    reensureQueued: Boolean(shouldReensure),
  };
}

export function invalidateTodoCalendarV2All({ reason = 'unknown' } = {}) {
  const store = useTodoCalendarV2Store.getState();
  const visibleContext = store.visibleContext || null;

  store.clearMonthLayouts();

  if (visibleContext?.requestMonthIds?.length) {
    store.requestIdleReensure();
  }

  return {
    ok: true,
    reason,
    reensureQueued: Boolean(visibleContext?.requestMonthIds?.length),
  };
}
