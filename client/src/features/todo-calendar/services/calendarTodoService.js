/**
 * Calendar Todo Service
 *
 * Responsibilities:
 * - 월 메타데이터 배열의 6주 그리드 범위를 계산
 * - 공통 조회/집계 레이어(range)를 단 1회 실행
 * - TodoCalendar adapter를 통해 기존 store 브릿지 shape로 변환
 */

import { getCalendarDateRange } from '../utils/calendarHelpers';
import { getOrLoadRange } from '../../../services/query-aggregation/cache';
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
export async function fetchCalendarDataForMonths(monthMetadatas, startDayOfWeek = 0, options = {}) {
  if (!Array.isArray(monthMetadatas) || monthMetadatas.length === 0) {
    return { todosMap: {}, completionsMap: {} };
  }

  const startTime = performance.now();
  const emptyMaps = buildEmptyMaps(monthMetadatas);
  const traceId = options?.traceId || null;
  const tracePrefix = traceId ? `[CalendarTodoService:trace] trace=${traceId} ` : '';

  try {
    const rangeComputeStartedAt = performance.now();
    const monthRanges = monthMetadatas.map(m => ({
      ...m,
      ...getCalendarDateRange(m.year, m.month, startDayOfWeek),
    }));

    const sortedByStart = [...monthRanges].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const sortedByEnd = [...monthRanges].sort((a, b) => a.endDate.localeCompare(b.endDate));
    const globalStart = sortedByStart[0]?.startDate;
    const globalEnd = sortedByEnd[sortedByEnd.length - 1]?.endDate;
    const rangeComputeMs = performance.now() - rangeComputeStartedAt;

    if (!globalStart || !globalEnd) {
      console.warn('[CalendarTodoService] Invalid month range, returning empty maps');
      return emptyMaps;
    }

    console.log(
      `[CalendarTodoService] Common range query: ${globalStart} ~ ${globalEnd} ` +
      `(${monthMetadatas.length} months, compute=${rangeComputeMs.toFixed(2)}ms)`
    );
    if (tracePrefix) {
      console.log(
        `${tracePrefix}range-compute months=${monthMetadatas.length} ` +
        `global=${globalStart}~${globalEnd} compute=${rangeComputeMs.toFixed(2)}ms`
      );
    }

    const rangeFetchStartedAt = performance.now();
    const handoff = await getOrLoadRange({
      startDate: globalStart,
      endDate: globalEnd,
      sourceTag: 'todo-calendar',
      traceId,
    });
    const rangeFetchMs = performance.now() - rangeFetchStartedAt;

    if (!handoff.ok) {
      console.warn(`[CalendarTodoService] Common layer failed: ${handoff.error}`);
      return emptyMaps;
    }

    console.log(
      `[CalendarTodoService] Range cache: hit=${handoff.cacheInfo?.hit ? 'Y' : 'N'}, ` +
      `inFlightDeduped=${handoff.cacheInfo?.inFlightDeduped ? 'Y' : 'N'} ` +
      `(range=${rangeFetchMs.toFixed(2)}ms)`
    );
    if (tracePrefix) {
      console.log(
        `${tracePrefix}range-handoff hit=${handoff.cacheInfo?.hit ? 'Y' : 'N'} ` +
        `deduped=${handoff.cacheInfo?.inFlightDeduped ? 'Y' : 'N'} ` +
        `uncovered=${handoff.cacheInfo?.uncoveredRanges?.length || 0} ` +
        `rangeMs=${rangeFetchMs.toFixed(2)}`
      );
    }

    const adapterStartedAt = performance.now();
    const adapted = adaptTodoCalendarFromRangeHandoff(handoff, {
      monthRanges,
      visibleLimit: 3,
    });
    const adapterMs = performance.now() - adapterStartedAt;

    if (!adapted.ok) {
      console.warn(`[CalendarTodoService] TodoCalendar adapter failed: ${adapted.error}`);
      return emptyMaps;
    }

    const endTime = performance.now();
    const decisionProfile = handoff.diagnostics?.decisionProfile;
    const ensureBefore = handoff.diagnostics?.candidateProfile?.ensureStateBefore;
    const ensureAfter = handoff.diagnostics?.candidateProfile?.ensureStateAfter;
    console.log(
      `[CalendarTodoService] Total ${(endTime - startTime).toFixed(2)}ms ` +
      `(compute=${rangeComputeMs.toFixed(2)}ms, range=${rangeFetchMs.toFixed(2)}ms, adapt=${adapterMs.toFixed(2)}ms) | ` +
      `stage(c=${handoff.stage?.candidate || 0}, d=${handoff.stage?.decided || 0}, a=${handoff.stage?.aggregated || 0}) ` +
      `elapsed(total=${handoff.elapsed?.totalMs || 0}, cand=${handoff.elapsed?.candidateMs || 0}, dec=${handoff.elapsed?.decisionMs || 0}, agg=${handoff.elapsed?.aggregationMs || 0}) ` +
      `profile(ensure=${handoff.diagnostics?.candidateProfile?.ensureMs || 0}, ` +
      `ensurePath=${handoff.diagnostics?.candidateProfile?.ensurePath || 'unknown'}, ` +
      `todoQ=${handoff.diagnostics?.candidateProfile?.todoQueryMs || 0}, ` +
      `todoDe=${handoff.diagnostics?.candidateProfile?.todoDeserializeMs || 0}, ` +
      `compQ=${handoff.diagnostics?.candidateProfile?.completionQueryMs || 0}, ` +
      `compDe=${handoff.diagnostics?.candidateProfile?.completionDeserializeMs || 0}, ` +
      `ensurePhase=${ensureBefore?.phase || 'unknown'}->${ensureAfter?.phase || 'unknown'}) ` +
      `decision(rec=${decisionProfile?.recurringCount || 0}/${decisionProfile?.recurringPassedCount || 0}, ` +
      `nonRec=${decisionProfile?.nonRecurringCount || 0}/${decisionProfile?.nonRecurringPassedCount || 0}, ` +
      `recMs=${decisionProfile?.recurringDecisionMs || 0}, nonRecMs=${decisionProfile?.nonRecurringDecisionMs || 0})`
    );
    if (tracePrefix) {
      console.log(
        `${tracePrefix}total=${(endTime - startTime).toFixed(2)}ms ` +
        `compute=${rangeComputeMs.toFixed(2)}ms range=${rangeFetchMs.toFixed(2)}ms ` +
        `adapt=${adapterMs.toFixed(2)}ms`
      );
    }

    return {
      todosMap: adapted.todosByMonth,
      completionsMap: adapted.completionsByMonth,
    };
  } catch (error) {
    console.error('[CalendarTodoService] Fetch failed:', error);
    return emptyMaps;
  }
}
