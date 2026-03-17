import { getOrLoadRange } from '../../../services/query-aggregation/cache';
import { getCalendarDateRange } from '../../../utils/calendarMonthHelpers';
import { adaptMonthLayoutsFromRangeHandoff } from '../adapters/adaptMonthLayoutsFromRangeHandoff';

function buildMonthRanges(monthMetadatas = [], startDayOfWeek = 0) {
  return monthMetadatas.map((monthMeta) => ({
    ...monthMeta,
    ...getCalendarDateRange(monthMeta.year, monthMeta.month, startDayOfWeek),
  }));
}

export async function fetchMonthLayoutsForMonths(monthMetadatas, options = {}) {
  if (!Array.isArray(monthMetadatas) || monthMetadatas.length === 0) {
    return {
      ok: true,
      monthLayoutsById: {},
      meta: { isStale: false, staleReason: null, lastSyncTime: null },
      stage: { candidate: 0, decided: 0, aggregated: 0 },
      elapsed: { totalMs: 0, candidateMs: 0, decisionMs: 0, aggregationMs: 0 },
      diagnostics: { completionCandidates: 0, invalidRecurrenceCount: 0 },
      error: null,
    };
  }

  const startDayOfWeek = Number.isFinite(options.startDayOfWeek) ? options.startDayOfWeek : 0;
  const language = options.language || 'ko';
  const monthRanges = buildMonthRanges(monthMetadatas, startDayOfWeek);
  const globalStart = monthRanges[0]?.startDate;
  const globalEnd = monthRanges[monthRanges.length - 1]?.endDate;

  const handoff = await getOrLoadRange({
    startDate: globalStart,
    endDate: globalEnd,
    sourceTag: 'todo-calendar-v2',
  });

  console.log(
    `[TC2] fetchMonthLayoutsForMonths months=${monthMetadatas.map((m) => m.id).join(',')} ` +
      `range=${globalStart}~${globalEnd} ok=${handoff?.ok ? 'Y' : 'N'} ` +
      `dates=${Object.keys(handoff?.itemsByDate || {}).length}`
  );

  return adaptMonthLayoutsFromRangeHandoff(handoff, {
    monthMetadatas,
    startDayOfWeek,
    language,
  });
}
