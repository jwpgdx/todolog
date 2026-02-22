import { runCommonQueryForRange } from '../../../services/query-aggregation';
import { adaptStripCalendarFromRangeHandoff } from '../../../services/query-aggregation/adapters';
import { addDays } from '../utils/stripCalendarDateUtils';

export async function fetchDaySummariesByRange(startDate, endDate) {
  const handoff = await runCommonQueryForRange({ startDate, endDate });
  if (!handoff.ok) {
    throw new Error(`common-layer failed: ${handoff.error}`);
  }

  const adapted = adaptStripCalendarFromRangeHandoff(handoff, { maxDots: 3 });
  if (!adapted.ok) {
    throw new Error(`strip-adapter failed: ${adapted.error}`);
  }

  return adapted.summariesByDate;
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

