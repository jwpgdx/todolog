/**
 * StripCalendar Adapter (Phase C)
 * - 공통 조회/집계 레이어 range handoff를 strip day-summary로 변환한다.
 */

function buildSummary(date, uniqueCategoryColors, maxDots) {
  const dotCount = uniqueCategoryColors.length;
  return {
    date,
    hasTodo: dotCount > 0,
    uniqueCategoryColors,
    dotCount,
    maxDots,
    overflowCount: Math.max(0, dotCount - maxDots),
  };
}

/**
 * @param {Object} handoff
 * @param {{maxDots?:number}} options
 * @returns {Object}
 */
export function adaptStripCalendarFromRangeHandoff(handoff, options = {}) {
  const maxDots = Number.isFinite(options.maxDots) ? options.maxDots : 3;

  if (!handoff?.ok) {
    return {
      ok: false,
      mode: 'range',
      range: handoff?.range || null,
      summariesByDate: {},
      meta: handoff?.meta || { isStale: false, staleReason: null, lastSyncTime: null },
      stage: handoff?.stage || { candidate: 0, decided: 0, aggregated: 0 },
      elapsed: handoff?.elapsed || { totalMs: 0, candidateMs: 0, decisionMs: 0, aggregationMs: 0 },
      diagnostics: handoff?.diagnostics || { completionCandidates: 0, invalidRecurrenceCount: 0 },
      error: handoff?.error || 'Invalid handoff result',
    };
  }

  const summariesByDate = {};
  const sourceItemsByDate = handoff.itemsByDate || {};

  for (const [date, items] of Object.entries(sourceItemsByDate)) {
    const list = Array.isArray(items) ? items : [];
    const colorSet = new Set();

    for (const item of list) {
      const color = item?.category?.color || null;
      if (color) colorSet.add(color);
    }

    summariesByDate[date] = buildSummary(date, Array.from(colorSet), maxDots);
  }

  return {
    ok: true,
    mode: 'range',
    range: handoff.range,
    summariesByDate,
    meta: handoff.meta,
    stage: handoff.stage,
    elapsed: handoff.elapsed,
    diagnostics: handoff.diagnostics,
    error: null,
  };
}

