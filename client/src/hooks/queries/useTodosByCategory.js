import { useQuery } from '@tanstack/react-query';
import { getTodosByCategory } from '../../services/db/todoService';
import { getAllCompletions } from '../../services/db/completionService';
import { ensureDatabase } from '../../services/db/database';
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

function hydrateCategoryTodo(todo, referenceDate, completionsByKey) {
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
 * 카테고리별 Todo 조회 (SQLite 기반)
 * 
 * @param {string} categoryId - 카테고리 ID
 * @param {string} referenceDate - YYYY-MM-DD
 */
export const useTodosByCategory = (categoryId, referenceDate) => {
  return useQuery({
    queryKey: ['todos', 'category', categoryId, referenceDate || 'no-reference-date'],
    queryFn: async () => {
      const startTime = performance.now();

      try {
        await ensureDatabase();
        const [todos, completionsByKey] = await Promise.all([
          getTodosByCategory(categoryId),
          getAllCompletions(),
        ]);
        const hydratedTodos = todos.map((todo) =>
          hydrateCategoryTodo(todo, referenceDate, completionsByKey)
        );

        const endTime = performance.now();
        console.log(
          `⚡ [useTodosByCategory] SQLite 조회 (${categoryId}): ${hydratedTodos.length}개 (${(endTime - startTime).toFixed(2)}ms)`
        );

        return hydratedTodos;
      } catch (error) {
        console.error('❌ [useTodosByCategory] SQLite 조회 실패:', error);
        return [];
      }
    },
    enabled: !!categoryId,
    staleTime: 1000 * 60 * 5,
  });
};
