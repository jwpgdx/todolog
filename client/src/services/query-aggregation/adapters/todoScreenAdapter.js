/**
 * TodoScreen Adapter (Phase A)
 * - 공통 조회/집계 레이어 date handoff를 TodoScreen 렌더 shape로 변환한다.
 * - recurrence/완료 판정은 상위 레이어 결과를 그대로 신뢰한다.
 */

function toDateTimeOrNull(date, time) {
  if (!date || !time) return null;
  return `${date}T${time}:00`;
}

function normalizeTodoScreenItem(item) {
  const todoId = item?.todoId || item?._id || null;
  const id = item?._id || todoId;
  const startDate = item?.startDate || item?.date || null;
  const endDate = item?.endDate || startDate;
  const startTime = item?.startTime || null;
  const endTime = item?.endTime || null;

  return {
    // Phase A: 기존 화면 호환을 위해 passthrough를 우선 적용한다.
    ...(item || {}),

    // 명시 계약 필드
    todoId,
    _id: id,
    title: item?.title || '',
    completed: Boolean(item?.completed),
    completionKey: item?.completionKey || `${id}_null`,
    completionId: item?.completionId || null,
    category: item?.category || null,
    categoryId: item?.categoryId || item?.category?._id || null,
    date: item?.date || null,
    startDate,
    endDate,
    isAllDay: Boolean(item?.isAllDay),
    startTime,
    endTime,
    isRecurring: Boolean(item?.isRecurring),
    startDateTime: item?.startDateTime || toDateTimeOrNull(startDate, startTime),
    endDateTime: item?.endDateTime || toDateTimeOrNull(endDate, endTime),
  };
}

/**
 * @param {Object} handoff
 * @returns {Object}
 */
export function adaptTodoScreenFromDateHandoff(handoff) {
  if (!handoff?.ok) {
    return {
      ok: false,
      mode: 'date',
      targetDate: handoff?.targetDate || null,
      items: [],
      meta: handoff?.meta || { isStale: false, staleReason: null, lastSyncTime: null },
      stage: handoff?.stage || { candidate: 0, decided: 0, aggregated: 0 },
      elapsed: handoff?.elapsed || { totalMs: 0, candidateMs: 0, decisionMs: 0, aggregationMs: 0 },
      diagnostics: handoff?.diagnostics || { completionCandidates: 0, invalidRecurrenceCount: 0 },
      error: handoff?.error || 'Invalid handoff result',
    };
  }

  const sourceItems = Array.isArray(handoff.items) ? handoff.items : [];
  const items = sourceItems
    .map(normalizeTodoScreenItem)
    .filter(item => Boolean(item?._id));

  return {
    ok: true,
    mode: 'date',
    targetDate: handoff.targetDate,
    items,
    meta: handoff.meta,
    stage: handoff.stage,
    elapsed: handoff.elapsed,
    diagnostics: handoff.diagnostics,
    error: null,
  };
}

