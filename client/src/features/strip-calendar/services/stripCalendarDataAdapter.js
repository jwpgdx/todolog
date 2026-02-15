import { useStripCalendarStore } from '../store/stripCalendarStore';
import { fetchDaySummariesByRange, buildDefaultSummaryRange } from './stripCalendarSummaryService';

export async function ensureRangeLoaded({ startDate, endDate, reason = 'unknown' }) {
  const store = useStripCalendarStore.getState();

  if (store.hasRangeCoverage(startDate, endDate)) {
    return { cacheHit: true, reason };
  }

  const summaries = await fetchDaySummariesByRange(startDate, endDate);

  useStripCalendarStore.getState().upsertSummaries(summaries);
  useStripCalendarStore.getState().addLoadedRange(startDate, endDate);

  return { cacheHit: false, reason };
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

  const store = useStripCalendarStore.getState();
  const nextLoadedRanges = store.loadedRanges.filter((loadedRange) => {
    return !ranges.some((target) => {
      const overlap = !(target.endDate < loadedRange.startDate || target.startDate > loadedRange.endDate);
      return overlap;
    });
  });

  const nextSummariesByDate = { ...store.summariesByDate };
  const summaryDates = Object.keys(nextSummariesByDate);

  summaryDates.forEach((date) => {
    const shouldDelete = ranges.some((range) => date >= range.startDate && date <= range.endDate);
    if (shouldDelete) {
      delete nextSummariesByDate[date];
    }
  });

  useStripCalendarStore.setState({
    loadedRanges: nextLoadedRanges,
    summariesByDate: nextSummariesByDate,
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
