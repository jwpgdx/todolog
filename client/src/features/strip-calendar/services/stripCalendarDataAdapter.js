import { useStripCalendarStore } from '../store/stripCalendarStore';
import { fetchDaySummariesByRange, buildDefaultSummaryRange } from './stripCalendarSummaryService';
import { invalidateRangeCacheByDateRange } from '../../../services/query-aggregation/cache';
import { STRIP_CALENDAR_PERF_LOG_ENABLED } from '../utils/stripCalendarConstants';
import { addDays } from '../utils/stripCalendarDateUtils';
import { mergeRanges, splitRangeByInvalidation } from '../../../services/query-aggregation/cache/rangeMerge';

function nowMs() {
  if (typeof globalThis?.performance?.now === 'function') {
    return globalThis.performance.now();
  }
  return Date.now();
}

function createStripFetchTraceId() {
  return `sc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function logStripPerf({
  reason,
  startDate,
  endDate,
  cacheHit,
  totalMs,
  queryMs,
  adaptMs,
  storeMs,
  source,
  stage,
  commonElapsed,
  commonCandidateProfile,
  diagnostics,
  traceId,
}) {
  if (!STRIP_CALENDAR_PERF_LOG_ENABLED) return;

  const stageText = stage
    ? ` stage(c=${stage.candidate},d=${stage.decided},a=${stage.aggregated})`
    : '';
  const commonText = commonElapsed
    ? ` common(total=${commonElapsed.totalMs},cand=${commonElapsed.candidateMs},dec=${commonElapsed.decisionMs},agg=${commonElapsed.aggregationMs})`
    : '';
  const profileText = commonCandidateProfile
    ? ` profile(ensure=${commonCandidateProfile.ensureMs},todoQ=${commonCandidateProfile.todoQueryMs},todoDe=${commonCandidateProfile.todoDeserializeMs},compQ=${commonCandidateProfile.completionQueryMs},compDe=${commonCandidateProfile.completionDeserializeMs})`
    : '';
  const diagnosticsText = diagnostics
    ? ` diag(itemDays=${diagnostics.itemDateCount},items=${diagnostics.itemCount},summaryDays=${diagnostics.summaryDateCount},todoDays=${diagnostics.summaryHasTodoDays},dotDays=${diagnostics.summaryDotDays},dotTotal=${diagnostics.summaryDotTotal},missingColorDays=${diagnostics.missingColorDays})`
    : '';
  const traceText = traceId ? ` trace=${traceId}` : '';

  console.log(
    `[strip-calendar:perf] reason=${reason} range=${startDate}~${endDate} ` +
      `cacheHit=${cacheHit ? 'Y' : 'N'} source=${source || 'unknown'} ` +
      `total=${totalMs}ms query=${queryMs}ms adapt=${adaptMs}ms store=${storeMs}ms${stageText}${commonText}${profileText}${diagnosticsText}${traceText}`
  );
}

export async function ensureRangeLoaded({ startDate, endDate, reason = 'unknown', traceId: incomingTraceId = null }) {
  const store = useStripCalendarStore.getState();
  const startedAt = nowMs();
  const covered = store.hasRangeCoverage(startDate, endDate);
  const traceId = incomingTraceId || (covered ? null : createStripFetchTraceId());

  if (STRIP_CALENDAR_PERF_LOG_ENABLED) {
    console.log(
      `[strip-calendar:timeline] ensure start reason=${reason} ` +
        `range=${startDate}~${endDate} covered=${covered ? 'Y' : 'N'} ` +
        `trace=${traceId || 'none'} t=${Number(startedAt.toFixed(2))}ms`
    );
  }

  if (covered) {
    const totalMs = Number((nowMs() - startedAt).toFixed(2));
    logStripPerf({
      reason,
      startDate,
      endDate,
      cacheHit: true,
      totalMs,
      queryMs: 0,
      adaptMs: 0,
      storeMs: 0,
      source: 'l1-store',
      stage: null,
      commonElapsed: null,
      commonCandidateProfile: null,
      diagnostics: null,
      traceId,
    });

    return {
      cacheHit: true,
      reason,
      elapsedMs: totalMs,
      cacheInfo: null,
      traceId,
      perf: {
        totalMs,
        queryMs: 0,
        adaptMs: 0,
        storeMs: 0,
        stage: null,
        commonElapsed: null,
        commonCandidateProfile: null,
        diagnostics: null,
      },
    };
  }

  const { summariesByDate, cacheInfo, perf: fetchPerf } = await fetchDaySummariesByRange(startDate, endDate, {
    traceId,
  });

  const storeStartedAt = nowMs();
  useStripCalendarStore.getState().upsertSummaries(summariesByDate);
  useStripCalendarStore.getState().addLoadedRange(startDate, endDate);
  const storeMs = Number((nowMs() - storeStartedAt).toFixed(2));
  const totalMs = Number((nowMs() - startedAt).toFixed(2));
  const queryMs = fetchPerf?.queryMs ?? 0;
  const adaptMs = fetchPerf?.adaptMs ?? 0;

  logStripPerf({
    reason,
    startDate,
    endDate,
    cacheHit: false,
    totalMs,
    queryMs,
    adaptMs,
    storeMs,
    source: cacheInfo?.sourceTag || null,
    stage: fetchPerf?.stage || null,
    commonElapsed: fetchPerf?.commonElapsed || null,
    commonCandidateProfile: fetchPerf?.commonCandidateProfile || null,
    diagnostics: fetchPerf?.diagnostics || null,
    traceId,
  });

  return {
    cacheHit: false,
    reason,
    elapsedMs: totalMs,
    cacheInfo,
    traceId,
    perf: {
      totalMs,
      queryMs,
      adaptMs,
      storeMs,
      stage: fetchPerf?.stage || null,
      commonElapsed: fetchPerf?.commonElapsed || null,
      commonCandidateProfile: fetchPerf?.commonCandidateProfile || null,
      diagnostics: fetchPerf?.diagnostics || null,
    },
  };
}

export function inspectRangeState({ startDate, endDate }) {
  const state = useStripCalendarStore.getState();
  const covered = state.hasRangeCoverage(startDate, endDate);

  let cursor = startDate;
  let storedDayCount = 0;
  let storedHasTodoDays = 0;
  let storedDotDays = 0;
  let storedDotTotal = 0;

  while (cursor <= endDate) {
    const summary = state.summariesByDate[cursor];
    if (summary) {
      storedDayCount += 1;
      if (summary.hasTodo) {
        storedHasTodoDays += 1;
      }
      const dotCount = Number(summary.dotCount || 0);
      if (dotCount > 0) {
        storedDotDays += 1;
        storedDotTotal += dotCount;
      }
    }
    cursor = addDays(cursor, 1);
  }

  return {
    covered,
    loadedRangesCount: state.loadedRanges.length,
    storedDayCount,
    storedHasTodoDays,
    storedDotDays,
    storedDotTotal,
  };
}

export function selectDaySummaries({ startDate, endDate }) {
  const state = useStripCalendarStore.getState();
  const defaults = buildDefaultSummaryRange(startDate, endDate);
  const selected = { ...defaults };

  Object.keys(defaults).forEach((date) => {
    if (state.summariesByDate[date]) {
      selected[date] = state.summariesByDate[date];
    }
  });

  return selected;
}

export function invalidateRanges(ranges = []) {
  if (!ranges.length) return;

  const normalizedRanges = mergeRanges(ranges);
  const store = useStripCalendarStore.getState();
  const beforeLoadedRanges = store.loadedRanges || [];
  let nextLoadedRanges = beforeLoadedRanges.map((r) => ({ ...r }));

  // IMPORTANT:
  // Do not drop a whole loaded range when a 1-day invalidation overlaps.
  // Instead, keep coverage for unaffected days and create a "hole" for the invalidated subrange.
  for (const invalid of normalizedRanges) {
    const splitParts = [];
    for (const loaded of nextLoadedRanges) {
      const parts = splitRangeByInvalidation(loaded, invalid);
      splitParts.push(...parts);
    }
    nextLoadedRanges = splitParts;
  }
  nextLoadedRanges = mergeRanges(nextLoadedRanges);

  const nextSummariesByDate = { ...store.summariesByDate };
  const summaryDates = Object.keys(nextSummariesByDate);

  summaryDates.forEach((date) => {
    const shouldDelete = normalizedRanges.some((range) => date >= range.startDate && date <= range.endDate);
    if (shouldDelete) {
      delete nextSummariesByDate[date];
    }
  });

  useStripCalendarStore.setState({
    loadedRanges: nextLoadedRanges,
    summariesByDate: nextSummariesByDate,
    dirtyRanges: mergeRanges([...(store.dirtyRanges || []), ...normalizedRanges]),
    dirtySeq: Number(store.dirtySeq || 0) + 1,
  });

  normalizedRanges.forEach((range) => {
    invalidateRangeCacheByDateRange({
      startDate: range.startDate,
      endDate: range.endDate,
      reason: 'strip-store-range-invalidation',
    });
  });
}

function resolveTodoRange(todo) {
  if (!todo) return null;

  const startDate = todo.startDate || todo.date || null;
  if (!startDate) return null;

  const endDate = todo.recurrenceEndDate || todo.endDate || startDate;
  return {
    startDate,
    endDate,
  };
}

export function invalidateTodoSummary(todo) {
  const range = resolveTodoRange(todo);
  if (!range) return;
  invalidateRanges([range]);
}

export function invalidateDateSummary(date) {
  if (!date) return;
  invalidateRanges([{ startDate: date, endDate: date }]);
}
