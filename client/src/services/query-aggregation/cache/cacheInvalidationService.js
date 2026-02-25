import { useTodoCalendarStore } from '../../../features/todo-calendar/store/todoCalendarStore';
import { useStripCalendarStore } from '../../../features/strip-calendar/store/stripCalendarStore';
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
  invalidateAllRangeCache({ reason });

  return {
    ok: true,
    reason,
  };
}

