import { useTodoCalendarStore } from '../../../features/todo-calendar/store/todoCalendarStore';
import { useStripCalendarStore } from '../../../features/strip-calendar/store/stripCalendarStore';
import { useCalendarDaySummaryStore } from '../../../features/calendar-day-summaries/store/calendarDaySummaryStore';
import { invalidateAll as invalidateAllRangeCache } from './rangeCacheService';

export function invalidateAllScreenCaches({
  queryClient,
  reason = 'unknown',
} = {}) {
  if (queryClient) {
    queryClient.invalidateQueries({ queryKey: ['todos'] });
    queryClient.invalidateQueries({ queryKey: ['categories'] });
  }

  useTodoCalendarStore.getState().clearAll();
  useStripCalendarStore.getState().clearRangeCache();
  useCalendarDaySummaryStore.getState().clear();
  useCalendarDaySummaryStore.getState().requestIdleReensure();
  invalidateAllRangeCache({ reason });

  return {
    ok: true,
    reason,
  };
}

export function invalidateCompletionDependentCaches({
  queryClient,
  reason = 'unknown',
  date = null,
} = {}) {
  if (queryClient) {
    queryClient.invalidateQueries({ queryKey: ['todos'] });
  }

  const normalizedDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? date
    : null;

  if (normalizedDate) {
    const [year, month] = normalizedDate.split('-').map(Number);
    useTodoCalendarStore.getState().invalidateAdjacentMonths(year, month);
  } else {
    useTodoCalendarStore.getState().clearAll();
  }

  invalidateAllRangeCache({ reason });

  return {
    ok: true,
    reason,
    date: normalizedDate,
  };
}
