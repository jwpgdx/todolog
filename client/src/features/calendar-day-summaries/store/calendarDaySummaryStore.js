import { create } from 'zustand';

import { mergeRanges, splitRangeByInvalidation } from '../../../services/query-aggregation/cache/rangeMerge';
import { addDaysToDate } from '../../../services/query-aggregation/cache/rangeKey';

const EMPTY_SUMMARY = Object.freeze({
  date: null,
  hasTodo: false,
  uniqueCategoryColors: [],
  dotCount: 0,
  maxDots: 3,
  overflowCount: 0,
});

function isRangeCovered(ranges = [], startDate, endDate) {
  if (!startDate || !endDate) return false;
  return ranges.some((range) => range.startDate <= startDate && range.endDate >= endDate);
}

function rangesOverlap(left, right) {
  return !(
    left.endDate < right.startDate ||
    left.startDate > right.endDate
  );
}

function equalStringSets(left = [], right = []) {
  if (left === right) return true;
  const leftList = Array.isArray(left) ? left : [];
  const rightList = Array.isArray(right) ? right : [];
  if (leftList.length !== rightList.length) return false;
  if (leftList.length === 0) return true;
  const rightSet = new Set(rightList);
  for (const value of leftList) {
    if (!rightSet.has(value)) return false;
  }
  return true;
}

function isDaySummaryEqual(left, right) {
  if (left === right) return true;
  if (!left || !right) return false;
  return (
    left.date === right.date &&
    left.hasTodo === right.hasTodo &&
    left.dotCount === right.dotCount &&
    left.maxDots === right.maxDots &&
    left.overflowCount === right.overflowCount &&
    equalStringSets(left.uniqueCategoryColors, right.uniqueCategoryColors)
  );
}

export const useCalendarDaySummaryStore = create((set, get) => ({
  summariesByDate: {},
  loadedRanges: [],
  dirtyRanges: [],
  dirtySeq: 0,
  reensureSeq: 0,

  upsertSummaries: (summaryMap = {}) => {
    const entries = Object.entries(summaryMap || {});
    if (entries.length === 0) return;

    set((state) => {
      const prev = state.summariesByDate || {};
      let changed = false;
      const next = { ...prev };

      for (const [dateKey, incoming] of entries) {
        if (!dateKey) continue;
        if (!incoming) continue;

        const existing = prev[dateKey];
        if (existing && isDaySummaryEqual(existing, incoming)) {
          // Preserve identity for unchanged records.
          continue;
        }

        next[dateKey] = incoming;
        changed = true;
      }

      return changed ? { summariesByDate: next } : state;
    });
  },

  addLoadedRange: (startDate, endDate) => {
    if (!startDate || !endDate) return;
    set((state) => ({
      loadedRanges: mergeRanges([...(state.loadedRanges || []), { startDate, endDate }]),
    }));
  },

  hasRangeCoverage: (startDate, endDate) => isRangeCovered(get().loadedRanges, startDate, endDate),

  addDirtyRanges: (ranges = []) => {
    if (!Array.isArray(ranges) || ranges.length === 0) return;
    set((state) => ({
      dirtyRanges: mergeRanges([...(state.dirtyRanges || []), ...ranges]),
    }));
  },

  consumeDirtyRanges: (ranges = []) => {
    if (!Array.isArray(ranges) || ranges.length === 0) return;
    set((state) => {
      let remaining = [...(state.dirtyRanges || [])];
      const normalized = mergeRanges(ranges);

      for (const remove of normalized) {
        const next = [];
        for (const source of remaining) {
          if (!rangesOverlap(source, remove)) {
            next.push(source);
            continue;
          }

          if (source.startDate < remove.startDate) {
            const leftEnd = addDaysToDate(remove.startDate, -1);
            if (source.startDate <= leftEnd) {
              next.push({ startDate: source.startDate, endDate: leftEnd });
            }
          }

          if (source.endDate > remove.endDate) {
            const rightStart = addDaysToDate(remove.endDate, 1);
            if (rightStart <= source.endDate) {
              next.push({ startDate: rightStart, endDate: source.endDate });
            }
          }
        }
        remaining = next;
      }

      const merged = mergeRanges(remaining);
      if (
        merged.length === (state.dirtyRanges || []).length &&
        (state.dirtyRanges || []).every((r, i) => {
          const next = merged[i];
          return next && r.startDate === next.startDate && r.endDate === next.endDate;
        })
      ) {
        return state;
      }

      return { dirtyRanges: merged };
    });
  },

  /**
   * Invalidation helper:
   * - create "holes" in loadedRanges (do not drop an entire segment for a 1-day invalidate)
   * - mark dirtyRanges + bump dirtySeq
   * - optionally drop summariesByDate keys
   */
  invalidateRanges: (ranges = [], options = {}) => {
    if (!Array.isArray(ranges) || ranges.length === 0) return;

    const keepSummaries = options?.keepSummaries === true;
    const normalized = mergeRanges(ranges);
    const store = get();
    const beforeLoaded = store.loadedRanges || [];
    let nextLoaded = beforeLoaded.map((r) => ({ ...r }));

    for (const invalid of normalized) {
      const splitParts = [];
      for (const loaded of nextLoaded) {
        splitParts.push(...splitRangeByInvalidation(loaded, invalid));
      }
      nextLoaded = splitParts;
    }
    nextLoaded = mergeRanges(nextLoaded);

    const stateUpdate = {
      loadedRanges: nextLoaded,
      dirtyRanges: mergeRanges([...(store.dirtyRanges || []), ...normalized]),
      dirtySeq: Number(store.dirtySeq || 0) + 1,
    };

    if (!keepSummaries) {
      const nextSummaries = { ...(store.summariesByDate || {}) };
      const keys = Object.keys(nextSummaries);

      for (const dateKey of keys) {
        const shouldDelete = normalized.some(
          (range) => dateKey >= range.startDate && dateKey <= range.endDate,
        );
        if (shouldDelete) {
          delete nextSummaries[dateKey];
        }
      }

      stateUpdate.summariesByDate = nextSummaries;
    }

    set(stateUpdate);
  },

  /**
   * Retention helper: keep only summaries/ranges inside [startDate, endDate].
   * Memory control only; callers must be able to re-fetch on cache miss.
   */
  pruneToDateRange: (startDate, endDate) => {
    if (!startDate || !endDate || startDate > endDate) return;

    set((state) => {
      const prevSummaries = state.summariesByDate || {};
      const nextSummaries = {};
      for (const [dateKey, summary] of Object.entries(prevSummaries)) {
        if (dateKey < startDate || dateKey > endDate) continue;
        nextSummaries[dateKey] = summary;
      }

      const clipRanges = (ranges = []) => {
        const clipped = [];
        for (const range of ranges) {
          if (!range?.startDate || !range?.endDate) continue;
          if (range.endDate < startDate || range.startDate > endDate) continue;

          const clippedStart = range.startDate < startDate ? startDate : range.startDate;
          const clippedEnd = range.endDate > endDate ? endDate : range.endDate;
          if (clippedStart > clippedEnd) continue;
          clipped.push({ startDate: clippedStart, endDate: clippedEnd });
        }
        return mergeRanges(clipped);
      };

      const nextLoadedRanges = clipRanges(state.loadedRanges || []);
      const nextDirtyRanges = clipRanges(state.dirtyRanges || []);

      const summariesChanged =
        Object.keys(prevSummaries).length !== Object.keys(nextSummaries).length;
      const loadedChanged =
        (state.loadedRanges || []).length !== nextLoadedRanges.length ||
        !(state.loadedRanges || []).every((r, i) => {
          const next = nextLoadedRanges[i];
          return next && r.startDate === next.startDate && r.endDate === next.endDate;
        });
      const dirtyChanged =
        (state.dirtyRanges || []).length !== nextDirtyRanges.length ||
        !(state.dirtyRanges || []).every((r, i) => {
          const next = nextDirtyRanges[i];
          return next && r.startDate === next.startDate && r.endDate === next.endDate;
        });

      if (!summariesChanged && !loadedChanged && !dirtyChanged) {
        return state;
      }

      return {
        summariesByDate: nextSummaries,
        loadedRanges: nextLoadedRanges,
        dirtyRanges: nextDirtyRanges,
      };
    });
  },

  clear: () =>
    set({
      summariesByDate: {},
      loadedRanges: [],
      dirtyRanges: [],
      dirtySeq: 0,
    }),

  requestIdleReensure: () =>
    set((state) => ({ reensureSeq: Number(state.reensureSeq || 0) + 1 })),

  selectDaySummaryUnsafe: (date) => get().summariesByDate?.[date] || null,
  selectDaySummary: (date) => get().summariesByDate?.[date] || EMPTY_SUMMARY,
}));

export { EMPTY_SUMMARY as CALENDAR_DAY_SUMMARY_EMPTY };

