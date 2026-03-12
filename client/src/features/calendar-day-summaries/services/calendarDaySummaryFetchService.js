import { getOrLoadRange } from '../../../services/query-aggregation/cache/rangeCacheService';
import { addDaysToDate, normalizeRange } from '../../../services/query-aggregation/cache/rangeKey';

import { adaptDaySummariesFromRangeHandoff } from '../adapters/adaptDaySummariesFromRangeHandoff';
import { DEFAULT_MAX_DOTS, DEBUG_CALENDAR_DAY_SUMMARIES } from '../utils/calendarDaySummaryConstants';

function nowMs() {
  if (typeof globalThis?.performance?.now === 'function') {
    return globalThis.performance.now();
  }
  return Date.now();
}

export function buildEmptySummary(date, maxDots = DEFAULT_MAX_DOTS) {
  return {
    date,
    hasTodo: false,
    uniqueCategoryColors: [],
    dotCount: 0,
    maxDots,
    overflowCount: 0,
  };
}

export function buildDefaultSummaryRange(startDate, endDate, maxDots = DEFAULT_MAX_DOTS) {
  const range = normalizeRange(startDate, endDate);
  if (!range) return {};

  const defaults = {};
  let cursor = range.startDate;
  while (cursor <= range.endDate) {
    defaults[cursor] = buildEmptySummary(cursor, maxDots);
    cursor = addDaysToDate(cursor, 1);
  }
  return defaults;
}

export async function fetchDaySummariesByRange(startDate, endDate, options = {}) {
  const maxDots = Number.isFinite(options?.maxDots) ? options.maxDots : DEFAULT_MAX_DOTS;
  const traceId = options?.traceId || null;
  const sourceTag = options?.sourceTag || 'calendar-day-summaries';

  const queryStartedAt = DEBUG_CALENDAR_DAY_SUMMARIES ? nowMs() : 0;
  const handoff = await getOrLoadRange({
    startDate,
    endDate,
    sourceTag,
    traceId,
  });
  const queryMs = DEBUG_CALENDAR_DAY_SUMMARIES ? Number((nowMs() - queryStartedAt).toFixed(2)) : 0;

  if (!handoff.ok) {
    throw new Error(`common-layer failed: ${handoff.error}`);
  }

  const adaptStartedAt = DEBUG_CALENDAR_DAY_SUMMARIES ? nowMs() : 0;
  const adapted = adaptDaySummariesFromRangeHandoff(handoff, { maxDots });
  const adaptMs = DEBUG_CALENDAR_DAY_SUMMARIES ? Number((nowMs() - adaptStartedAt).toFixed(2)) : 0;
  if (!adapted.ok) {
    throw new Error(`day-summary adapter failed: ${adapted.error}`);
  }

  if (DEBUG_CALENDAR_DAY_SUMMARIES) {
    console.log(
      `[day-summaries] fetch range=${startDate}~${endDate} query=${queryMs}ms adapt=${adaptMs}ms ` +
      `cacheHit=${handoff?.cacheInfo?.hit ? 'Y' : 'N'} source=${handoff?.cacheInfo?.sourceTag || 'unknown'}`
    );
  }

  return {
    summariesByDate: adapted.summariesByDate,
    cacheInfo: handoff.cacheInfo || null,
    perf: DEBUG_CALENDAR_DAY_SUMMARIES
      ? { queryMs, adaptMs, stage: handoff.stage || null, commonElapsed: handoff.elapsed || null }
      : null,
  };
}
