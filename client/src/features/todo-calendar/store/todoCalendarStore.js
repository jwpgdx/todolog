import { create } from 'zustand';

/**
 * Zustand Store for Calendar Todo/Completion Data Cache
 * 
 * State:
 * - todosByMonth: Record<string, Array<LightweightTodo>> - { '2026-01': [...todos] }
 * - completionsByMonth: Record<string, Record<string, Completion>> - { '2026-01': { 'todoId:date': {...} } }
 * 
 * Actions:
 * - setMonthData(monthId, todos, completions): Set data for a single month
 * - setBatchMonthData(todosMap, completionsMap): Set data for multiple months (batch fetch)
 * - invalidateMonth(monthId): Remove cached data for a month
 * - invalidateAdjacentMonths(year, month): Remove cached data for month ±1 (3 months total)
 * - clearAll(): Clear all cached data
 * - hasMonth(monthId): Check if month data exists in cache
 * 
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9
 */
export const useTodoCalendarStore = create((set, get) => ({
  todosByMonth: {},
  completionsByMonth: {},

  /**
   * Set Todo + Completion data for a single month
   * Validates: Requirements 2.1, 2.2
   * 
   * @param {string} monthId - 'YYYY-MM'
   * @param {Array} todos - Todo array
   * @param {Object} completions - Completion map { key: completion }
   */
  setMonthData: (monthId, todos, completions) => {
    set(state => ({
      todosByMonth: { ...state.todosByMonth, [monthId]: todos },
      completionsByMonth: { ...state.completionsByMonth, [monthId]: completions },
    }));
  },

  /**
   * Set data for multiple months at once (batch fetch result)
   * Validates: Requirements 2.3
   * 
   * @param {Object} todosMap - { 'YYYY-MM': [...todos] }
   * @param {Object} completionsMap - { 'YYYY-MM': { key: completion } }
   */
  setBatchMonthData: (todosMap, completionsMap) => {
    set(state => ({
      todosByMonth: { ...state.todosByMonth, ...todosMap },
      completionsByMonth: { ...state.completionsByMonth, ...completionsMap },
    }));
  },

  /**
   * Retention helper: keep only month caches within [startMonthId, endMonthId].
   * This is for memory control only; callers must be able to re-fetch on cache miss.
   *
   * @param {string} startMonthId - 'YYYY-MM'
   * @param {string} endMonthId - 'YYYY-MM'
   */
  pruneToMonthWindow: (startMonthId, endMonthId) => {
    if (!startMonthId || !endMonthId || startMonthId > endMonthId) return;

    set((state) => {
      const beforeTodos = Object.keys(state.todosByMonth || {}).length;
      const beforeComps = Object.keys(state.completionsByMonth || {}).length;

      const nextTodosByMonth = {};
      for (const [monthId, todos] of Object.entries(state.todosByMonth || {})) {
        if (monthId < startMonthId || monthId > endMonthId) continue;
        nextTodosByMonth[monthId] = todos;
      }

      const nextCompletionsByMonth = {};
      for (const [monthId, completions] of Object.entries(state.completionsByMonth || {})) {
        if (monthId < startMonthId || monthId > endMonthId) continue;
        nextCompletionsByMonth[monthId] = completions;
      }

      const afterTodos = Object.keys(nextTodosByMonth).length;
      const afterComps = Object.keys(nextCompletionsByMonth).length;

      if (beforeTodos === afterTodos && beforeComps === afterComps) {
        return state;
      }

      console.log(
        `[TodoCalendarStore] pruneToMonthWindow keep=${startMonthId}~${endMonthId} ` +
          `todos=${beforeTodos}->${afterTodos} completions=${beforeComps}->${afterComps}`
      );

      return {
        todosByMonth: nextTodosByMonth,
        completionsByMonth: nextCompletionsByMonth,
      };
    });
  },

  /**
   * Invalidate (remove) cached data for a single month
   * Validates: Requirements 2.4
   * 
   * @param {string} monthId - 'YYYY-MM'
   */
  invalidateMonth: (monthId) => {
    set(state => {
      const updatedTodos = { ...state.todosByMonth };
      const updatedCompletions = { ...state.completionsByMonth };
      delete updatedTodos[monthId];
      delete updatedCompletions[monthId];
      return { todosByMonth: updatedTodos, completionsByMonth: updatedCompletions };
    });
  },

  /**
   * Invalidate cached data for target month ±1 (3 months total)
   * Used after Todo CRUD operations (6-week padding affects adjacent months)
   * Validates: Requirements 2.5, 2.6, 2.7, 2.8, 2.9, 10.5, 10.6
   * 
   * @param {number} year - Year (e.g., 2026)
   * @param {number} month - Month (1~12)
   */
  invalidateAdjacentMonths: (year, month) => {
    const getMonthId = (y, m) => {
      // Handle year boundary transitions
      if (m <= 0) { 
        y -= 1; 
        m = 12 + m; 
      }
      if (m > 12) { 
        y += 1; 
        m = m - 12; 
      }
      return `${y}-${String(m).padStart(2, '0')}`;
    };

    const idsToInvalidate = [
      getMonthId(year, month - 1),  // Previous month
      getMonthId(year, month),      // Current month
      getMonthId(year, month + 1),  // Next month
    ];

    set(state => {
      const updatedTodos = { ...state.todosByMonth };
      const updatedCompletions = { ...state.completionsByMonth };
      
      idsToInvalidate.forEach(id => {
        delete updatedTodos[id];
        delete updatedCompletions[id];
      });

      return { todosByMonth: updatedTodos, completionsByMonth: updatedCompletions };
    });

    console.log(`[TodoCalendarStore] Invalidated adjacent months: ${idsToInvalidate.join(', ')}`);
  },

  /**
   * Clear all cached data (logout, sync complete)
   * Validates: Requirements 11.1, 11.2, 11.3
   */
  clearAll: () => {
    set({ todosByMonth: {}, completionsByMonth: {} });
    console.log('[TodoCalendarStore] Cleared all cached data');
  },

  /**
   * Check if month data exists in cache
   * Validates: Requirements 6.4, 12.2
   * 
   * @param {string} monthId - 'YYYY-MM'
   * @returns {boolean}
   */
  hasMonth: (monthId) => {
    return get().todosByMonth[monthId] !== undefined;
  },
}));
