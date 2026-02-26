import { create } from 'zustand';
import dayjs from 'dayjs';

function mergeRanges(ranges) {
  if (!ranges.length) return [];

  const sorted = [...ranges].sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  const merged = [sorted[0]];

  for (let i = 1; i < sorted.length; i += 1) {
    const last = merged[merged.length - 1];
    const current = sorted[i];

    const adjacentOrOverlap = current.startDate <= dayjs(last.endDate).add(1, 'day').format('YYYY-MM-DD');

    if (adjacentOrOverlap) {
      last.endDate = current.endDate > last.endDate ? current.endDate : last.endDate;
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

function isCovered(ranges, startDate, endDate) {
  return ranges.some((range) => range.startDate <= startDate && range.endDate >= endDate);
}

export const useStripCalendarStore = create((set, get) => ({
  mode: 'weekly',
  anchorWeekStart: null,
  weeklyVisibleWeekStart: null,
  monthlyTopWeekStart: null,
  monthlyRangePolicy: 'three_month',
  showTodayJumpButton: false,
  summariesByDate: {},
  loadedRanges: [],
  // Ranges that were invalidated by CRUD but not yet re-fetched for the current viewport.
  // This is used to trigger targeted refresh without forcing a full-range reload.
  dirtyRanges: [],
  dirtySeq: 0,

  setMode: (mode) => set({ mode }),
  setAnchorWeekStart: (anchorWeekStart) => set({ anchorWeekStart }),
  setWeeklyVisibleWeekStart: (weeklyVisibleWeekStart) => set({ weeklyVisibleWeekStart }),
  setMonthlyTopWeekStart: (monthlyTopWeekStart) => set({ monthlyTopWeekStart }),
  setMonthlyRangePolicy: (monthlyRangePolicy) =>
    set({
      monthlyRangePolicy:
        monthlyRangePolicy === 'legacy_9week'
          ? 'legacy_9week'
          : monthlyRangePolicy === 'six_month'
            ? 'six_month'
            : 'three_month',
    }),
  setShowTodayJumpButton: (showTodayJumpButton) => set({ showTodayJumpButton }),

  upsertSummaries: (summaryMap) => {
    set((state) => ({ summariesByDate: { ...state.summariesByDate, ...summaryMap } }));
  },

  addLoadedRange: (startDate, endDate) => {
    set((state) => ({
      loadedRanges: mergeRanges([...state.loadedRanges, { startDate, endDate }]),
    }));
  },

  hasRangeCoverage: (startDate, endDate) => isCovered(get().loadedRanges, startDate, endDate),

  clearRangeCache: () => set({ loadedRanges: [], summariesByDate: {}, dirtyRanges: [], dirtySeq: 0 }),

  addDirtyRanges: (ranges = []) => {
    if (!Array.isArray(ranges) || ranges.length === 0) return;
    set((state) => ({
      dirtyRanges: mergeRanges([...state.dirtyRanges, ...ranges]),
    }));
  },

  consumeDirtyRanges: (ranges = []) => {
    if (!Array.isArray(ranges) || ranges.length === 0) return;
    set((state) => {
      let remaining = [...state.dirtyRanges];
      const normalized = mergeRanges(ranges);

      for (const remove of normalized) {
        const next = [];
        for (const source of remaining) {
          const overlap = !(remove.endDate < source.startDate || remove.startDate > source.endDate);
          if (!overlap) {
            next.push(source);
            continue;
          }

          if (source.startDate < remove.startDate) {
            const leftEnd = dayjs(remove.startDate).subtract(1, 'day').format('YYYY-MM-DD');
            if (source.startDate <= leftEnd) {
              next.push({ startDate: source.startDate, endDate: leftEnd });
            }
          }

          if (source.endDate > remove.endDate) {
            const rightStart = dayjs(remove.endDate).add(1, 'day').format('YYYY-MM-DD');
            if (rightStart <= source.endDate) {
              next.push({ startDate: rightStart, endDate: source.endDate });
            }
          }
        }
        remaining = next;
      }

      const merged = mergeRanges(remaining);
      if (merged.length === state.dirtyRanges.length &&
        state.dirtyRanges.every((r, i) => {
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
   * Retention helper: keep only summaries/loadedRanges within [startDate, endDate].
   * This is for memory control only; callers must be able to re-fetch on cache miss.
   */
  pruneToDateRange: (startDate, endDate) => {
    if (!startDate || !endDate || startDate > endDate) return;

    set((state) => {
      const beforeSummaryCount = Object.keys(state.summariesByDate || {}).length;
      const beforeRangeCount = state.loadedRanges.length;

      const nextSummariesByDate = {};
      for (const [dateKey, summary] of Object.entries(state.summariesByDate || {})) {
        if (dateKey < startDate || dateKey > endDate) continue;
        nextSummariesByDate[dateKey] = summary;
      }

      const clippedRanges = [];
      for (const range of state.loadedRanges) {
        const overlap = !(range.endDate < startDate || range.startDate > endDate);
        if (!overlap) continue;

        const clippedStart = range.startDate < startDate ? startDate : range.startDate;
        const clippedEnd = range.endDate > endDate ? endDate : range.endDate;
        if (clippedStart > clippedEnd) continue;
        clippedRanges.push({ startDate: clippedStart, endDate: clippedEnd });
      }

      const nextLoadedRanges = mergeRanges(clippedRanges);
      const afterSummaryCount = Object.keys(nextSummariesByDate).length;
      const afterRangeCount = nextLoadedRanges.length;

      if (
        beforeSummaryCount === afterSummaryCount &&
        beforeRangeCount === afterRangeCount &&
        state.loadedRanges.every((r, i) => {
          const next = nextLoadedRanges[i];
          return next && r.startDate === next.startDate && r.endDate === next.endDate;
        })
      ) {
        return state;
      }

      console.log(
        `[strip-calendar] pruneToDateRange keep=${startDate}~${endDate} ` +
          `summaries=${beforeSummaryCount}->${afterSummaryCount} ranges=${beforeRangeCount}->${afterRangeCount}`
      );

      return {
        summariesByDate: nextSummariesByDate,
        loadedRanges: nextLoadedRanges,
      };
    });
  },

  resetNavigationState: () =>
    set({
      mode: 'weekly',
      anchorWeekStart: null,
      weeklyVisibleWeekStart: null,
      monthlyTopWeekStart: null,
      monthlyRangePolicy: 'three_month',
      showTodayJumpButton: false,
    }),
}));
