import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { todoAPI } from '../../api/todos';
import { getAllTodos } from '../../services/db/todoService';
import { ensureDatabase } from '../../services/db/database';
import { getAllCompletions } from '../../services/db/completionService';
import {
  addDaysDateOnly,
  expandOccurrencesInRange,
  hasRecurrenceRule,
  normalizeRecurrence,
} from '../../utils/recurrenceEngine';

const OCCURRENCE_LOOKAROUND_DAYS = 366;

function resolveStartDate(todo) {
  return todo?.startDate || todo?.date || null;
}

function resolveNearestOccurrenceDate(todo, referenceDate) {
  const startDate = resolveStartDate(todo);

  if (!hasRecurrenceRule(todo?.recurrence) || !startDate) {
    return null;
  }

  const anchorDate = referenceDate || startDate;
  const normalized = normalizeRecurrence(todo.recurrence, todo.recurrenceEndDate, {
    startDate,
  });

  if (!normalized?.isValid) {
    return startDate;
  }

  const rangeStart = addDaysDateOnly(anchorDate, -OCCURRENCE_LOOKAROUND_DAYS) || startDate;
  const rangeEnd = addDaysDateOnly(anchorDate, OCCURRENCE_LOOKAROUND_DAYS) || anchorDate;
  const occurrences = expandOccurrencesInRange(normalized, rangeStart, rangeEnd);

  if (occurrences.length === 0) {
    return startDate;
  }

  const upcoming = occurrences.find((date) => date >= anchorDate);
  return upcoming || occurrences[occurrences.length - 1];
}

function hasActiveCompletion(completionsByKey, completionKey) {
  const completion = completionsByKey?.[completionKey];
  return Boolean(completion && !completion.deletedAt);
}

function hydrateTodo(todo, referenceDate, completionsByKey) {
  const isRecurring = hasRecurrenceRule(todo?.recurrence);
  const occurrenceDate = isRecurring
    ? resolveNearestOccurrenceDate(todo, referenceDate)
    : null;
  const completionKey = isRecurring
    ? `${todo._id}_${occurrenceDate || referenceDate || resolveStartDate(todo) || 'null'}`
    : `${todo._id}_null`;

  return {
    ...todo,
    isRecurring,
    occurrenceDate,
    completionKey,
    completed: hasActiveCompletion(completionsByKey, completionKey),
  };
}

/**
 * 전체 Todo 조회 (SQLite 기반)
 * 주로 디버그나 전체 목록이 필요한 경우 사용
 */
export const useAllTodos = (referenceDate) => {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: ['todos', 'all', referenceDate || 'no-reference-date'],
    queryFn: async () => {
      try {
        await ensureDatabase();

        const startTime = performance.now();
        const [todos, completionsByKey] = await Promise.all([
          getAllTodos(),
          getAllCompletions(),
        ]);
        const hydratedTodos = todos.map((todo) =>
          hydrateTodo(todo, referenceDate, completionsByKey)
        );
        const endTime = performance.now();

        console.log(`⚡ [useAllTodos] SQLite 조회: ${hydratedTodos.length}개 (${(endTime - startTime).toFixed(2)}ms)`);

        // 백그라운드 서버 동기화
        if (user) {
          todoAPI.getAllTodos()
            .then(res => {
              if (res.data.length !== hydratedTodos.length) {
                console.log('🔄 [useAllTodos] 서버 데이터 차이 감지');
              }
            })
            .catch(() => {});
        }

        return hydratedTodos;
      } catch (error) {
        console.log('⚠️ [useAllTodos] SQLite 실패 - 서버 폴백');
        const res = await todoAPI.getAllTodos();
        return res.data;
      }
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
};
