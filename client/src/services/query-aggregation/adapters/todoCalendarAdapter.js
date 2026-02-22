/**
 * TodoCalendar Adapter (Phase B)
 * - 공통 조회/집계 레이어 range handoff를 기존 todoCalendarStore 브릿지 shape로 변환한다.
 * - recurrence/완료 판정은 상위 레이어 결과를 그대로 신뢰한다.
 */

function buildEmptyMonthMaps(monthRanges = []) {
  const todosByMonth = {};
  const completionsByMonth = {};

  for (const range of monthRanges) {
    if (!range?.id) continue;
    todosByMonth[range.id] = [];
    completionsByMonth[range.id] = {};
  }

  return { todosByMonth, completionsByMonth };
}

function normalizeCalendarItem(dateKey, item) {
  const occurrenceDate = item?.occurrenceDate || dateKey;
  const todoId = item?.todoId || item?._id || null;
  const id = item?._id || todoId;
  const categoryColor = item?.category?.color || '#333';

  return {
    ...(item || {}),
    _id: id,
    todoId,
    // 기존 MonthSection 그룹핑과 충돌하지 않게 occurrence 단위로 고정한다.
    date: occurrenceDate,
    startDate: occurrenceDate,
    endDate: occurrenceDate,
    occurrenceDate,
    categoryColor,
    isAllDay: Boolean(item?.isAllDay),
    completed: Boolean(item?.completed),
    eventBarMeta: {
      title: item?.title || '',
      categoryColor,
      completed: Boolean(item?.completed),
    },
  };
}

function toCompletionMapValue(item, dateKey) {
  return {
    _id: item?.completionId || item?.completionKey || `${item?.todoId || item?._id || 'unknown'}_${dateKey}`,
    todoId: item?.todoId || item?._id || null,
    date: item?.completionKey?.endsWith('_null') ? null : dateKey,
    completedAt: null,
  };
}

function buildDateToMonthIdsMap(monthRanges = []) {
  const dateToMonthIds = {};

  for (const range of monthRanges) {
    if (!range?.id || !range?.startDate || !range?.endDate) continue;

    let cursor = range.startDate;
    while (cursor && cursor <= range.endDate) {
      if (!dateToMonthIds[cursor]) {
        dateToMonthIds[cursor] = [];
      }
      dateToMonthIds[cursor].push(range.id);

      // date string(YYYY-MM-DD) 기준 +1 day
      const date = new Date(`${cursor}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + 1);
      cursor = date.toISOString().slice(0, 10);
    }
  }

  return dateToMonthIds;
}

/**
 * @param {Object} handoff
 * @param {{monthRanges:Array<{id:string,startDate:string,endDate:string}>, visibleLimit?:number}} options
 * @returns {Object}
 */
export function adaptTodoCalendarFromRangeHandoff(handoff, options = {}) {
  const monthRanges = Array.isArray(options.monthRanges) ? options.monthRanges : [];
  const visibleLimit = Number.isFinite(options.visibleLimit) ? options.visibleLimit : 3;
  const baseMaps = buildEmptyMonthMaps(monthRanges);

  if (!handoff?.ok) {
    return {
      ok: false,
      mode: 'range',
      range: handoff?.range || null,
      itemsByDate: {},
      dayMetaByDate: {},
      todosByMonth: baseMaps.todosByMonth,
      completionsByMonth: baseMaps.completionsByMonth,
      meta: handoff?.meta || { isStale: false, staleReason: null, lastSyncTime: null },
      stage: handoff?.stage || { candidate: 0, decided: 0, aggregated: 0 },
      elapsed: handoff?.elapsed || { totalMs: 0, candidateMs: 0, decisionMs: 0, aggregationMs: 0 },
      diagnostics: handoff?.diagnostics || { completionCandidates: 0, invalidRecurrenceCount: 0 },
      error: handoff?.error || 'Invalid handoff result',
    };
  }

  const dateToMonthIds = buildDateToMonthIdsMap(monthRanges);
  const itemsByDate = {};
  const dayMetaByDate = {};
  const todosByMonth = { ...baseMaps.todosByMonth };
  const completionsByMonth = { ...baseMaps.completionsByMonth };
  const monthItemSeen = {};

  for (const monthId of Object.keys(todosByMonth)) {
    monthItemSeen[monthId] = new Set();
  }

  const sourceItemsByDate = handoff.itemsByDate || {};
  for (const [dateKey, sourceItems] of Object.entries(sourceItemsByDate)) {
    const list = Array.isArray(sourceItems) ? sourceItems : [];
    const normalizedItems = list.map(item => normalizeCalendarItem(dateKey, item));
    itemsByDate[dateKey] = normalizedItems;

    dayMetaByDate[dateKey] = {
      visibleLimit,
      totalCount: normalizedItems.length,
      overflowCount: Math.max(0, normalizedItems.length - visibleLimit),
    };

    const targetMonthIds = dateToMonthIds[dateKey] || [];
    if (targetMonthIds.length === 0) continue;

    for (const monthId of targetMonthIds) {
      if (!todosByMonth[monthId]) todosByMonth[monthId] = [];
      if (!completionsByMonth[monthId]) completionsByMonth[monthId] = {};

      const seen = monthItemSeen[monthId] || new Set();
      monthItemSeen[monthId] = seen;

      for (const item of normalizedItems) {
        const uniqueKey = `${item?._id || item?.todoId || 'unknown'}_${item?.occurrenceDate || dateKey}`;
        if (seen.has(uniqueKey)) continue;
        seen.add(uniqueKey);
        todosByMonth[monthId].push(item);

        if (item.completed && item.completionKey) {
          completionsByMonth[monthId][item.completionKey] = toCompletionMapValue(item, dateKey);
        }
      }
    }
  }

  return {
    ok: true,
    mode: 'range',
    range: handoff.range,
    itemsByDate,
    dayMetaByDate,
    todosByMonth,
    completionsByMonth,
    meta: handoff.meta,
    stage: handoff.stage,
    elapsed: handoff.elapsed,
    diagnostics: handoff.diagnostics,
    error: null,
  };
}

