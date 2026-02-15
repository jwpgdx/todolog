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
  showTodayJumpButton: false,
  summariesByDate: {},
  loadedRanges: [],

  setMode: (mode) => set({ mode }),
  setAnchorWeekStart: (anchorWeekStart) => set({ anchorWeekStart }),
  setWeeklyVisibleWeekStart: (weeklyVisibleWeekStart) => set({ weeklyVisibleWeekStart }),
  setMonthlyTopWeekStart: (monthlyTopWeekStart) => set({ monthlyTopWeekStart }),
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

  clearRangeCache: () => set({ loadedRanges: [], summariesByDate: {} }),

  resetNavigationState: () =>
    set({
      mode: 'weekly',
      anchorWeekStart: null,
      weeklyVisibleWeekStart: null,
      monthlyTopWeekStart: null,
      showTodayJumpButton: false,
    }),
}));
