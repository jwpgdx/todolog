import { getOrLoadRange } from '../../../services/query-aggregation/cache';
import { adaptStripCalendarFromRangeHandoff } from '../../../services/query-aggregation/adapters';
import { addDays } from '../utils/stripCalendarDateUtils';

function nowMs() {
  if (typeof globalThis?.performance?.now === 'function') {
    return globalThis.performance.now();
  }
  return Date.now();
}

function summarizeAdaptedDiagnostics(sourceItemsByDate = {}, summariesByDate = {}) {
  let itemDateCount = 0;
  let itemCount = 0;
  let summaryDateCount = 0;
  let summaryHasTodoDays = 0;
  let summaryDotDays = 0;
  let summaryDotTotal = 0;
  let missingColorDays = 0;
  const missingColorSampleDates = [];

  for (const [date, items] of Object.entries(sourceItemsByDate)) {
    const list = Array.isArray(items) ? items : [];
    if (list.length === 0) continue;

    itemDateCount += 1;
    itemCount += list.length;

    const summary = summariesByDate[date];
    const dotCount = summary?.dotCount || 0;
    if (dotCount === 0) {
      missingColorDays += 1;
      if (missingColorSampleDates.length < 3) {
        missingColorSampleDates.push(date);
      }
    }
  }

  for (const summary of Object.values(summariesByDate)) {
    summaryDateCount += 1;

    if (summary?.hasTodo) {
      summaryHasTodoDays += 1;
    }

    const dotCount = Number(summary?.dotCount || 0);
    if (dotCount > 0) {
      summaryDotDays += 1;
      summaryDotTotal += dotCount;
    }
  }

  return {
    itemDateCount,
    itemCount,
    summaryDateCount,
    summaryHasTodoDays,
    summaryDotDays,
    summaryDotTotal,
    missingColorDays,
    missingColorSampleDates,
  };
}

export async function fetchDaySummariesByRange(startDate, endDate, options = {}) {
  const traceId = options?.traceId || null;
  const queryStartedAt = nowMs();
  const handoff = await getOrLoadRange({
    startDate,
    endDate,
    sourceTag: 'strip-calendar',
    traceId,
  });
  const queryMs = Number((nowMs() - queryStartedAt).toFixed(2));

  if (!handoff.ok) {
    throw new Error(`common-layer failed: ${handoff.error}`);
  }

  const adaptStartedAt = nowMs();
  const adapted = adaptStripCalendarFromRangeHandoff(handoff, { maxDots: 3 });
  const adaptMs = Number((nowMs() - adaptStartedAt).toFixed(2));
  if (!adapted.ok) {
    throw new Error(`strip-adapter failed: ${adapted.error}`);
  }

  const diagnostics = summarizeAdaptedDiagnostics(handoff.itemsByDate || {}, adapted.summariesByDate || {});

  return {
    summariesByDate: adapted.summariesByDate,
    cacheInfo: handoff.cacheInfo || null,
    perf: {
      queryMs,
      adaptMs,
      stage: handoff.stage || null,
      commonElapsed: handoff.elapsed || null,
      commonCandidateProfile: handoff.diagnostics?.candidateProfile || null,
      diagnostics,
    },
  };
}

export function buildEmptySummary(date) {
  return {
    date,
    hasTodo: false,
    uniqueCategoryColors: [],
    dotCount: 0,
    maxDots: 3,
    overflowCount: 0,
  };
}

export function buildDefaultSummaryRange(startDate, endDate) {
  const defaults = {};
  let cursor = startDate;

  while (cursor <= endDate) {
    defaults[cursor] = buildEmptySummary(cursor);
    cursor = addDays(cursor, 1);
  }

  return defaults;
}
