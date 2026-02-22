/**
 * Calendar Todo Service
 *
 * Responsibilities:
 * - 월 메타데이터 배열의 6주 그리드 범위를 계산
 * - 공통 조회/집계 레이어(range)를 단 1회 실행
 * - TodoCalendar adapter를 통해 기존 store 브릿지 shape로 변환
 */

import { getCalendarDateRange } from '../utils/calendarHelpers';
import { runCommonQueryForRange } from '../../../services/query-aggregation';
import { adaptTodoCalendarFromRangeHandoff } from '../../../services/query-aggregation/adapters';

function buildEmptyMaps(monthMetadatas = []) {
  const todosMap = {};
  const completionsMap = {};

  for (const m of monthMetadatas) {
    if (!m?.id) continue;
    todosMap[m.id] = [];
    completionsMap[m.id] = {};
  }

  return { todosMap, completionsMap };
}

/**
 * Fetch calendar data for multiple months (Batch Fetch)
 *
 * @param {Array<{year: number, month: number, id: string}>} monthMetadatas
 * @param {number} startDayOfWeek - 0 (Sunday) or 1 (Monday)
 * @returns {Promise<{ todosMap: Object, completionsMap: Object }>}
 */
export async function fetchCalendarDataForMonths(monthMetadatas, startDayOfWeek = 0) {
  if (!Array.isArray(monthMetadatas) || monthMetadatas.length === 0) {
    return { todosMap: {}, completionsMap: {} };
  }

  const startTime = performance.now();
  const emptyMaps = buildEmptyMaps(monthMetadatas);

  try {
    const monthRanges = monthMetadatas.map(m => ({
      ...m,
      ...getCalendarDateRange(m.year, m.month, startDayOfWeek),
    }));

    const sortedByStart = [...monthRanges].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const sortedByEnd = [...monthRanges].sort((a, b) => a.endDate.localeCompare(b.endDate));
    const globalStart = sortedByStart[0]?.startDate;
    const globalEnd = sortedByEnd[sortedByEnd.length - 1]?.endDate;

    if (!globalStart || !globalEnd) {
      console.warn('[CalendarTodoService] Invalid month range, returning empty maps');
      return emptyMaps;
    }

    console.log(`[CalendarTodoService] Common range query: ${globalStart} ~ ${globalEnd} (${monthMetadatas.length} months)`);

    const handoff = await runCommonQueryForRange({
      startDate: globalStart,
      endDate: globalEnd,
    });

    if (!handoff.ok) {
      console.warn(`[CalendarTodoService] Common layer failed: ${handoff.error}`);
      return emptyMaps;
    }

    const adapted = adaptTodoCalendarFromRangeHandoff(handoff, {
      monthRanges,
      visibleLimit: 3,
    });

    if (!adapted.ok) {
      console.warn(`[CalendarTodoService] TodoCalendar adapter failed: ${adapted.error}`);
      return emptyMaps;
    }

    const endTime = performance.now();
    console.log(
      `[CalendarTodoService] Adapted in ${(endTime - startTime).toFixed(2)}ms | ` +
      `stage(c=${handoff.stage.candidate}, d=${handoff.stage.decided}, a=${handoff.stage.aggregated})`
    );

    return {
      todosMap: adapted.todosByMonth,
      completionsMap: adapted.completionsByMonth,
    };
  } catch (error) {
    console.error('[CalendarTodoService] Fetch failed:', error);
    return emptyMaps;
  }
}

