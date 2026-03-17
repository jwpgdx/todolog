import { useCalendarDaySummaryStore } from '../../../features/calendar-day-summaries/store/calendarDaySummaryStore';
import { invalidateTodoCalendarV2All } from '../../../features/todo-calendar-v2/services/todoCalendarV2InvalidationService';
import { invalidateAll as invalidateAllRangeCache } from './rangeCacheService';

export function invalidateAllScreenCaches({
  queryClient,
  reason = 'unknown',
} = {}) {
  if (queryClient) {
    queryClient.invalidateQueries({ queryKey: ['todos'] });
    queryClient.invalidateQueries({ queryKey: ['categories'] });
  }

  useCalendarDaySummaryStore.getState().clear();
  useCalendarDaySummaryStore.getState().requestIdleReensure();
  invalidateTodoCalendarV2All({ reason });
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

  invalidateAllRangeCache({ reason });

  return {
    ok: true,
    reason,
    date: normalizedDate,
  };
}
