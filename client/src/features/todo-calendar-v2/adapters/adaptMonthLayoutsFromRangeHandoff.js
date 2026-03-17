import { formatMonthTitle } from '../../../utils/calendarMonthHelpers';
import {
  buildMonthGridWeeks,
  compareLayoutCandidates,
  TC2_VISIBLE_LANE_COUNT,
} from '../utils/monthLayoutUtils';

function normalizeDateEntry(day) {
  return {
    ...day,
    hiddenCount: 0,
  };
}

function createEmptyMonthLayout(monthMeta, startDayOfWeek, language) {
  const weeks = buildMonthGridWeeks(monthMeta.year, monthMeta.month, startDayOfWeek).map((week, weekIndex) => ({
    weekIndex,
    days: week.map(normalizeDateEntry),
    segments: [],
  }));

  return {
    id: monthMeta.id,
    year: monthMeta.year,
    month: monthMeta.month,
    title: formatMonthTitle(monthMeta.year, monthMeta.month, language),
    weeks,
  };
}

function isNonRecurringSpan(item) {
  return !item?.isRecurring && !!item?.startDate && !!item?.endDate && item.startDate < item.endDate;
}

function buildWeekCandidates(week, itemsByDate = {}) {
  const weekStart = week[0]?.dateString;
  const weekEnd = week[week.length - 1]?.dateString;
  const seen = new Set();
  const candidates = [];

  for (const day of week) {
    const items = Array.isArray(itemsByDate[day.dateString]) ? itemsByDate[day.dateString] : [];
    for (const item of items) {
      const todoId = item?.todoId || item?._id || 'unknown';

      if (isNonRecurringSpan(item)) {
        const key = `span:${todoId}:${weekStart}:${weekEnd}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const segmentStart = item.startDate > weekStart ? item.startDate : weekStart;
        const segmentEnd = item.endDate < weekEnd ? item.endDate : weekEnd;
        if (segmentStart > segmentEnd) continue;

        candidates.push({
          id: key,
          todoId,
          title: item?.title || '',
          color: item?.category?.color || '#64748B',
          isAllDay: Boolean(item?.isAllDay),
          isSpan: true,
          sortStartDate: item?.startDate || segmentStart,
          sortStartTime: item?.startTime || null,
          categoryOrder: item?.category?.order ?? null,
          visibleStartDate: segmentStart,
          visibleEndDate: segmentEnd,
          continuesFromPrevious: item.startDate < weekStart,
          continuesToNext: item.endDate > weekEnd,
        });
        continue;
      }

      const occurrenceDate = item?.occurrenceDate || day.dateString;
      const key = `single:${todoId}:${occurrenceDate}`;
      if (seen.has(key)) continue;
      seen.add(key);

      candidates.push({
        id: key,
        todoId,
        title: item?.title || '',
        color: item?.category?.color || '#64748B',
        isAllDay: Boolean(item?.isAllDay),
        isSpan: false,
        sortStartDate: occurrenceDate,
        sortStartTime: item?.startTime || null,
        categoryOrder: item?.category?.order ?? null,
        visibleStartDate: occurrenceDate,
        visibleEndDate: occurrenceDate,
        continuesFromPrevious: false,
        continuesToNext: false,
      });
    }
  }

  return candidates.sort(compareLayoutCandidates);
}

function overlaps(left, right) {
  return !(left.endCol < right.startCol || left.startCol > right.endCol);
}

function buildWeekLayout(week, itemsByDate = {}) {
  const dayIndexByDate = new Map();
  const days = week.map((day, index) => {
    dayIndexByDate.set(day.dateString, index);
    return normalizeDateEntry(day);
  });

  const hiddenCountByDate = {};
  const placedByLane = Array.from({ length: TC2_VISIBLE_LANE_COUNT }, () => []);
  const segments = [];
  const candidates = buildWeekCandidates(week, itemsByDate);

  for (const candidate of candidates) {
    const startCol = dayIndexByDate.get(candidate.visibleStartDate);
    const endCol = dayIndexByDate.get(candidate.visibleEndDate);
    if (!Number.isFinite(startCol) || !Number.isFinite(endCol)) continue;

    let placedLane = -1;
    for (let lane = 0; lane < TC2_VISIBLE_LANE_COUNT; lane += 1) {
      const hasConflict = placedByLane[lane].some((segment) =>
        overlaps({ startCol, endCol }, segment),
      );
      if (!hasConflict) {
        placedLane = lane;
        break;
      }
    }

    if (placedLane === -1) {
      for (let col = startCol; col <= endCol; col += 1) {
        const dateKey = week[col]?.dateString;
        if (!dateKey) continue;
        hiddenCountByDate[dateKey] = (hiddenCountByDate[dateKey] || 0) + 1;
      }
      continue;
    }

    const segment = {
      ...candidate,
      lane: placedLane,
      startCol,
      endCol,
    };
    placedByLane[placedLane].push({ startCol, endCol });
    segments.push(segment);
  }

  const normalizedDays = days.map((day) => ({
    ...day,
    hiddenCount: hiddenCountByDate[day.dateString] || 0,
  }));
  segments.sort((left, right) => {
    if (left.lane !== right.lane) return left.lane - right.lane;
    if (left.startCol !== right.startCol) return left.startCol - right.startCol;
    if (left.endCol !== right.endCol) return left.endCol - right.endCol;
    return String(left.id).localeCompare(String(right.id));
  });

  return {
    weekIndex: week[0]?.weekIndex || 0,
    days: normalizedDays,
    segments,
  };
}

export function adaptMonthLayoutsFromRangeHandoff(handoff, options = {}) {
  const monthMetadatas = Array.isArray(options.monthMetadatas) ? options.monthMetadatas : [];
  const startDayOfWeek = Number.isFinite(options.startDayOfWeek) ? options.startDayOfWeek : 0;
  const language = options.language || 'ko';
  const sourceItemsByDate = handoff?.itemsByDate || {};

  if (!handoff?.ok) {
    return {
      ok: false,
      monthLayoutsById: {},
      meta: handoff?.meta || { isStale: false, staleReason: null, lastSyncTime: null },
      stage: handoff?.stage || { candidate: 0, decided: 0, aggregated: 0 },
      elapsed: handoff?.elapsed || { totalMs: 0, candidateMs: 0, decisionMs: 0, aggregationMs: 0 },
      diagnostics: handoff?.diagnostics || { completionCandidates: 0, invalidRecurrenceCount: 0 },
      error: handoff?.error || 'Invalid handoff result',
    };
  }

  const monthLayoutsById = {};

  for (const monthMeta of monthMetadatas) {
    if (!monthMeta?.id) continue;
    const base = createEmptyMonthLayout(monthMeta, startDayOfWeek, language);
    monthLayoutsById[monthMeta.id] = {
      ...base,
      weeks: base.weeks.map((weekLayout) => buildWeekLayout(weekLayout.days, sourceItemsByDate)),
    };

    const segmentCount = monthLayoutsById[monthMeta.id].weeks.reduce(
      (sum, week) => sum + (week.segments?.length || 0),
      0,
    );
    const hiddenCount = monthLayoutsById[monthMeta.id].weeks.reduce(
      (sum, week) => sum + week.days.reduce((daySum, day) => daySum + (day.hiddenCount || 0), 0),
      0,
    );
    console.log(
      `[TC2] month=${monthMeta.id} segments=${segmentCount} hidden=${hiddenCount}`
    );
  }

  return {
    ok: true,
    monthLayoutsById,
    meta: handoff.meta,
    stage: handoff.stage,
    elapsed: handoff.elapsed,
    diagnostics: handoff.diagnostics,
    error: null,
  };
}
