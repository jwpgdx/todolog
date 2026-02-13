/**
 * Calendar Todo Service
 * 
 * Responsibilities:
 * - Batch fetch todos/completions for multiple months
 * - Calculate 6-week grid date ranges
 * - Group data by month
 * - Handle period todos spanning multiple months
 * 
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3, 5.5
 */

import { getDatabase } from '../../../services/db/database';
import { getCalendarDateRange } from '../utils/calendarHelpers';

/**
 * Fetch calendar data for multiple months (Batch Fetch)
 * 
 * Key optimization: Query entire date range once, then group by month
 * 
 * @param {Array<{year: number, month: number, id: string}>} monthMetadatas - Month metadata array
 * @param {number} startDayOfWeek - 0 (Sunday) or 1 (Monday)
 * @returns {Promise<{ todosMap: Object, completionsMap: Object }>}
 * 
 * @example
 * fetchCalendarDataForMonths([
 *   { year: 2026, month: 1, id: '2026-01' },
 *   { year: 2026, month: 2, id: '2026-02' }
 * ], 0)
 * // Returns:
 * // {
 * //   todosMap: { '2026-01': [...todos], '2026-02': [...todos] },
 * //   completionsMap: { '2026-01': { key: completion }, '2026-02': {...} }
 * // }
 */
export async function fetchCalendarDataForMonths(monthMetadatas, startDayOfWeek = 0) {
  if (monthMetadatas.length === 0) {
    return { todosMap: {}, completionsMap: {} };
  }

  try {
    const db = getDatabase();
    const startTime = performance.now();

    // 1. Calculate 6-week grid range for each month
    const ranges = monthMetadatas.map(m => ({
      ...m,
      ...getCalendarDateRange(m.year, m.month, startDayOfWeek),
    }));

    // 2. Calculate global date range (min ~ max) for single query
    const globalStart = ranges[0].startDate;
    const globalEnd = ranges[ranges.length - 1].endDate;

    console.log(`[CalendarTodoService] Fetching ${monthMetadatas.length} months: ${globalStart} ~ ${globalEnd}`);

    // 3. Fetch todos (1 SQL query)
    // Includes:
    // - Single date todos (date BETWEEN globalStart AND globalEnd)
    // - Period todos (startDate <= globalEnd AND endDate >= globalStart)
    // - Recurring todos (recurrence IS NOT NULL AND startDate <= globalEnd AND recurrenceEndDate filter)
    const todos = await db.getAllAsync(`
      SELECT 
        t.*,
        c.name as category_name, 
        c.color as category_color,
        c.icon as category_icon
      FROM todos t
      LEFT JOIN categories c ON t.category_id = c._id
      WHERE (
        (t.date >= ? AND t.date <= ?)
        OR (t.start_date <= ? AND t.end_date >= ?)
        OR (
          t.recurrence IS NOT NULL
          AND t.start_date <= ?
          AND (t.recurrence_end_date IS NULL OR t.recurrence_end_date >= ?)
        )
      )
      AND t.deleted_at IS NULL
      ORDER BY t.date ASC, t.is_all_day DESC, t.start_time ASC
    `, [globalStart, globalEnd, globalEnd, globalStart, globalEnd, globalStart]);

    // 4. Fetch completions (1 SQL query)
    const completions = await db.getAllAsync(
      'SELECT * FROM completions WHERE date >= ? AND date <= ?',
      [globalStart, globalEnd]
    );

    const fetchTime = performance.now() - startTime;
    console.log(`[CalendarTodoService] SQL queries completed in ${fetchTime.toFixed(2)}ms (${todos.length} todos, ${completions.length} completions)`);

    // 5. Group by month
    const groupStart = performance.now();
    const todosMap = {};
    const completionsMap = {};

    // Initialize empty arrays/maps for all months (mark as "fetched")
    for (const m of monthMetadatas) {
      todosMap[m.id] = [];
      completionsMap[m.id] = {};
    }

    // Group todos by month
    // Critical: Period todos can span multiple months
    for (const todo of todos) {
      const todoStart = todo.start_date || todo.date;
      
      if (!todoStart) continue;

      // Check overlap with each month's grid range
      for (const range of ranges) {
        const todoEnd = todo.recurrence
          ? (todo.recurrence_end_date || range.endDate)
          : (todo.end_date || todo.date);

        // Overlap check: todoStart <= range.endDate && todoEnd >= range.startDate
        // This ensures period todos (e.g., 1/28 ~ 2/5) appear in both January and February
        if (todoStart <= range.endDate && todoEnd >= range.startDate) {
          todosMap[range.id].push(deserializeTodoLight(todo));
          // Don't break - one todo can belong to multiple months
        }
      }
    }

    // Group completions by month
    for (const comp of completions) {
      if (!comp.date) continue;
      
      for (const range of ranges) {
        if (comp.date >= range.startDate && comp.date <= range.endDate) {
          completionsMap[range.id][comp.key] = {
            _id: comp._id,
            todoId: comp.todo_id,
            date: comp.date,
            completedAt: comp.completed_at,
          };
        }
      }
    }

    const groupTime = performance.now() - groupStart;
    const totalTime = performance.now() - startTime;
    
    console.log(`[CalendarTodoService] Grouping completed in ${groupTime.toFixed(2)}ms`);
    console.log(`[CalendarTodoService] Total time: ${totalTime.toFixed(2)}ms`);

    return { todosMap, completionsMap };

  } catch (error) {
    console.error('[CalendarTodoService] Fetch failed:', error);
    
    // Graceful degradation: Return empty maps
    const todosMap = {};
    const completionsMap = {};
    
    for (const m of monthMetadatas) {
      todosMap[m.id] = [];
      completionsMap[m.id] = {};
    }
    
    return { todosMap, completionsMap };
  }
}

/**
 * Deserialize DB row to lightweight Todo object
 * 
 * Calendar only needs: title, date, category color
 * Excludes: memo, startTime, endTime, etc. (memory optimization)
 * 
 * Validates: Requirements 5.1, 5.2, 5.3, 5.5
 * 
 * @param {Object} row - DB row
 * @returns {Object} - Lightweight Todo object
 */
function deserializeTodoLight(row) {
  return {
    _id: row._id,
    title: row.title,
    date: row.date,
    startDate: row.start_date,
    endDate: row.end_date,
    recurrenceEndDate: row.recurrence_end_date,
    categoryColor: row.category_color || row.color || '#333',
    isAllDay: row.is_all_day === 1,
    recurrence: row.recurrence ? JSON.parse(row.recurrence) : null,
  };
}
