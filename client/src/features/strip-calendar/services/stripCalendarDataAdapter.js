import dayjs from 'dayjs';
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

function resolveMonthlyPolicyWindow(policy = 'three_month') {
  if (policy === 'six_month') {
    return { beforeMonths: 2, afterMonths: 3 }; // past 2 + current + future 3
  }
  return { beforeMonths: 1, afterMonths: 1 }; // past 1 + current + future 1
}

function computeMonthlyRangeForPolicy(anchorDate, policy = 'three_month') {
  if (!anchorDate) return null;

  if (policy === 'legacy_9week') {
    return {
      startDate: addDays(anchorDate, -14),
      endDate: addDays(anchorDate, 48),
    };
  }

  const monthStart = dayjs(anchorDate).startOf('month');
  if (!monthStart.isValid()) return null;

  const window = resolveMonthlyPolicyWindow(policy);
  return {
    startDate: monthStart.subtract(window.beforeMonths, 'month').format('YYYY-MM-DD'),
    // Inclusive end date: last day of (anchorMonth + afterMonths).
    endDate: monthStart
      .add(window.afterMonths + 1, 'month')
      .subtract(1, 'day')
      .format('YYYY-MM-DD'),
  };
}

function maxDate(...candidates) {
  let max = null;
  for (const date of candidates) {
    if (!date) continue;
    if (max == null || date > max) {
      max = date;
    }
  }
  return max;
}

function minDate(...candidates) {
  let min = null;
  for (const date of candidates) {
    if (!date) continue;
    if (min == null || date < min) {
      min = date;
    }
  }
  return min;
}

function resolveMonthlyActiveRange() {
  const store = useStripCalendarStore.getState();
  const topWeekStart = store.monthlyTopWeekStart;
  if (!topWeekStart) return null;

  const policy = store.monthlyRangePolicy || 'three_month';
  return computeMonthlyRangeForPolicy(topWeekStart, policy);
}

function resolveWeeklyActiveRange() {
  const store = useStripCalendarStore.getState();
  const weekStart = store.weeklyVisibleWeekStart;
  if (!weekStart) return null;

  return {
    startDate: addDays(weekStart, -14),
    endDate: addDays(weekStart, 20),
  };
}

function hasRecurrence(todo) {
  const recurrence = todo?.recurrence;
  if (!recurrence) return false;
  if (typeof recurrence === 'string') return recurrence.trim().length > 0;
  return true;
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
  const dirtyRanges = store.dirtyRanges || [];
  const overlapsDirty =
    Array.isArray(dirtyRanges) &&
    dirtyRanges.some((dirty) => {
      if (!dirty?.startDate || !dirty?.endDate) return false;
      return dirty.startDate <= endDate && dirty.endDate >= startDate;
    });
  const shouldFillDefaults = overlapsDirty || (typeof reason === 'string' && reason.includes('dirty-refresh'));
  const nextSummariesByDate = shouldFillDefaults
    ? { ...buildDefaultSummaryRange(startDate, endDate), ...summariesByDate }
    : summariesByDate;

  const storeStartedAt = nowMs();
  useStripCalendarStore.getState().upsertSummaries(nextSummariesByDate);
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

export function invalidateRanges(ranges = [], options = {}) {
  if (!ranges.length) return;

  const keepSummaries = options?.keepSummaries === true;
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

  const stateUpdate = {
    loadedRanges: nextLoadedRanges,
    dirtyRanges: mergeRanges([...(store.dirtyRanges || []), ...normalizedRanges]),
    dirtySeq: Number(store.dirtySeq || 0) + 1,
  };

  if (!keepSummaries) {
    const nextSummariesByDate = { ...store.summariesByDate };
    const summaryDates = Object.keys(nextSummariesByDate);

    summaryDates.forEach((date) => {
      const shouldDelete = normalizedRanges.some((range) => date >= range.startDate && date <= range.endDate);
      if (shouldDelete) {
        delete nextSummariesByDate[date];
      }
    });

    stateUpdate.summariesByDate = nextSummariesByDate;
  }

  useStripCalendarStore.setState(stateUpdate);

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

  // Recurring todos can affect many visible days even when recurrenceEndDate is null.
  // In monthly/weekly mode, refresh the currently active range to avoid "holes" where
  // dates were already loaded but do not refresh until a future scroll/settle.
  const store = useStripCalendarStore.getState();
  if (store.mode === 'monthly' && hasRecurrence(todo) && !todo.recurrenceEndDate) {
    const activeRange = resolveMonthlyActiveRange();
    const policy = store.monthlyRangePolicy || 'three_month';
    const todoMonthRange = computeMonthlyRangeForPolicy(range.startDate, policy);
    const loadedRanges = store.loadedRanges || [];
    const minLoadedStart = minDate(...loadedRanges.map((loaded) => loaded?.startDate || null));
    const maxLoadedEnd = maxDate(...loadedRanges.map((loaded) => loaded?.endDate || null));

    const endDate = maxDate(activeRange?.endDate, todoMonthRange?.endDate, maxLoadedEnd);
    if (endDate) {
      // IMPORTANT:
      // Do not clip invalidation start to the *current* activeRange.startDate.
      // If the user scrolled far into the future and deletes an unbounded recurrence,
      // older already-loaded months (within retention/loadedRanges) can stay stale.
      const windowStart = minLoadedStart || activeRange?.startDate || todoMonthRange?.startDate || range.startDate;
      const startDate = maxDate(range.startDate, windowStart);
      if (startDate <= endDate) {
        invalidateRanges([{ startDate, endDate }], { keepSummaries: true });
        return;
      }
    }
  }

  if (store.mode === 'weekly' && hasRecurrence(todo) && !todo.recurrenceEndDate) {
    const activeRange = resolveWeeklyActiveRange();
    const loadedRanges = store.loadedRanges || [];
    const minLoadedStart = minDate(...loadedRanges.map((loaded) => loaded?.startDate || null));
    const maxLoadedEnd = maxDate(...loadedRanges.map((loaded) => loaded?.endDate || null));

    const endDate = maxDate(activeRange?.endDate, maxLoadedEnd);
    if (endDate) {
      const windowStart = minLoadedStart || activeRange?.startDate || range.startDate;
      const startDate = maxDate(range.startDate, windowStart);
      if (startDate <= endDate) {
        invalidateRanges([{ startDate, endDate }], { keepSummaries: true });
        return;
      }
    }
  }

  invalidateRanges([range]);
}

export function invalidateDateSummary(date) {
  if (!date) return;
  invalidateRanges([{ startDate: date, endDate: date }]);
}
