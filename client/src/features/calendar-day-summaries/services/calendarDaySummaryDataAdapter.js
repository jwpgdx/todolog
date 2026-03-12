import {
  invalidateByDateRange as invalidateRangeCacheByDateRange,
  pruneOutsideDateRange as pruneRangeCacheOutsideDateRange,
} from '../../../services/query-aggregation/cache/rangeCacheService';
import { mergeRanges } from '../../../services/query-aggregation/cache/rangeMerge';
import { normalizeRange } from '../../../services/query-aggregation/cache/rangeKey';

import { DEFAULT_MAX_DOTS, DEBUG_CALENDAR_DAY_SUMMARIES } from '../utils/calendarDaySummaryConstants';
import { useCalendarDaySummaryStore } from '../store/calendarDaySummaryStore';
import { buildDefaultSummaryRange, fetchDaySummariesByRange } from './calendarDaySummaryFetchService';

function rangesOverlap(leftRange, rightRange) {
  return !(
    leftRange.endDate < rightRange.startDate ||
    leftRange.startDate > rightRange.endDate
  );
}

function hasRecurrence(todo) {
  const recurrence = todo?.recurrence;
  if (!recurrence) return false;
  if (typeof recurrence === 'string') return recurrence.trim().length > 0;
  return true;
}

function resolveTodoRange(todo) {
  if (!todo) return null;

  const startDate = todo.startDate || todo.date || null;
  if (!startDate) return null;

  const endDate = todo.recurrenceEndDate || todo.endDate || startDate;
  const normalized = normalizeRange(startDate, endDate);
  return normalized || null;
}

export async function ensureDaySummariesLoaded({
  startDate,
  endDate,
  reason = 'unknown',
  traceId = null,
  maxDots = DEFAULT_MAX_DOTS,
  sourceTag = 'calendar-day-summaries',
  forceRefresh = false,
} = {}) {
  const store = useCalendarDaySummaryStore.getState();
  const covered = !forceRefresh && store.hasRangeCoverage(startDate, endDate);

  if (covered) {
    return {
      ok: true,
      cacheHit: true,
      reason,
      cacheInfo: null,
    };
  }

  const { summariesByDate, cacheInfo } = await fetchDaySummariesByRange(startDate, endDate, {
    maxDots,
    traceId,
    sourceTag,
  });

  const dirtyRanges = store.dirtyRanges || [];
  const overlapsDirty =
    Array.isArray(dirtyRanges) &&
    dirtyRanges.some((dirty) => dirty?.startDate && dirty?.endDate && rangesOverlap(dirty, { startDate, endDate }));

  const shouldFillDefaults =
    overlapsDirty || (typeof reason === 'string' && reason.includes('dirty-refresh'));

  const nextSummariesByDate = shouldFillDefaults
    ? { ...buildDefaultSummaryRange(startDate, endDate, maxDots), ...summariesByDate }
    : summariesByDate;

  useCalendarDaySummaryStore.getState().upsertSummaries(nextSummariesByDate);
  useCalendarDaySummaryStore.getState().addLoadedRange(startDate, endDate);

  if (DEBUG_CALENDAR_DAY_SUMMARIES) {
    console.log(
      `[day-summaries] ensure reason=${reason} range=${startDate}~${endDate} ` +
      `cacheHit=${covered ? 'Y' : 'N'} source=${cacheInfo?.sourceTag || 'unknown'}`
    );
  }

  return {
    ok: true,
    cacheHit: false,
    reason,
    cacheInfo,
  };
}

export function selectDaySummary(date) {
  return useCalendarDaySummaryStore.getState().selectDaySummary(date);
}

export function selectDaySummariesForDiagnostics({ startDate, endDate, maxDots = DEFAULT_MAX_DOTS } = {}) {
  const range = normalizeRange(startDate, endDate);
  if (!range) return {};

  const state = useCalendarDaySummaryStore.getState();
  const defaults = buildDefaultSummaryRange(range.startDate, range.endDate, maxDots);
  const selected = { ...defaults };

  for (const dateKey of Object.keys(defaults)) {
    const stored = state.summariesByDate?.[dateKey];
    if (stored) selected[dateKey] = stored;
  }

  return selected;
}

export function invalidateRanges(ranges = [], options = {}) {
  if (!Array.isArray(ranges) || ranges.length === 0) return;

  const normalized = mergeRanges(ranges.filter((r) => r?.startDate && r?.endDate));
  if (normalized.length === 0) return;

  useCalendarDaySummaryStore.getState().invalidateRanges(normalized, options);

  for (const range of normalized) {
    invalidateRangeCacheByDateRange({
      startDate: range.startDate,
      endDate: range.endDate,
      reason: options?.reason || 'calendar-day-summaries:range-invalidation',
    });
  }
}

export function invalidateTodoSummary(todo, options = {}) {
  const range = resolveTodoRange(todo);
  if (!range) return;

  const keepSummaries = options?.keepSummaries !== false;

  // Unbounded recurrence: invalidate only already-loaded coverage segments (and/or retention window),
  // and NEVER collapse sparse coverage into one contiguous min~max span.
  if (hasRecurrence(todo) && !todo.recurrenceEndDate) {
    const store = useCalendarDaySummaryStore.getState();
    const loadedRanges = Array.isArray(store.loadedRanges) ? store.loadedRanges : [];
    const clipped = [];

    for (const loaded of loadedRanges) {
      if (!loaded?.startDate || !loaded?.endDate) continue;
      if (loaded.endDate < range.startDate) continue;

      const startDate = loaded.startDate > range.startDate ? loaded.startDate : range.startDate;
      const endDate = loaded.endDate;
      if (startDate <= endDate) {
        clipped.push({ startDate, endDate });
      }
    }

    if (clipped.length > 0) {
      invalidateRanges(clipped, { keepSummaries, reason: 'calendar-day-summaries:todo-invalidation:unbounded' });
      return;
    }
  }

  invalidateRanges([range], { keepSummaries, reason: 'calendar-day-summaries:todo-invalidation' });
}

export function invalidateDateSummary(date, options = {}) {
  if (!date) return;
  invalidateRanges([{ startDate: date, endDate: date }], { keepSummaries: true, ...options });
}

export function pruneSummaryRetentionWindow({ startDate, endDate, reason = 'calendar-day-summaries:retention' } = {}) {
  if (!startDate || !endDate) return;
  useCalendarDaySummaryStore.getState().pruneToDateRange(startDate, endDate);
  pruneRangeCacheOutsideDateRange({ startDate, endDate, reason });
}
