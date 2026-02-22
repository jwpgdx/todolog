import {
  addDaysDateOnly,
  expandOccurrencesInRange,
  normalizeDateOnlyString,
  normalizeRecurrence,
  occursOnDateNormalized,
} from '../../utils/recurrenceEngine';

function isWithinRange(targetDate, startDate, endDate) {
  return targetDate >= startDate && targetDate <= endDate;
}

function maxDate(left, right) {
  return left > right ? left : right;
}

function minDate(left, right) {
  return left < right ? left : right;
}

function listDateRangeInclusive(startDate, endDate) {
  const result = [];
  let cursor = startDate;

  while (cursor && cursor <= endDate) {
    result.push(cursor);
    if (cursor === endDate) break;
    cursor = addDaysDateOnly(cursor, 1);
  }

  return result;
}

function decideNonRecurringForDate(todo, targetDate) {
  const singleDate = normalizeDateOnlyString(todo.date);
  const startDate = normalizeDateOnlyString(todo.startDate || todo.date);
  const endDate = normalizeDateOnlyString(todo.endDate || startDate);

  if (singleDate) {
    if (singleDate === targetDate) return { pass: true, reason: 'single' };
    return { pass: false, reason: 'excluded' };
  }

  if (!startDate) {
    return { pass: false, reason: 'excluded' };
  }

  if (endDate && startDate !== endDate) {
    if (isWithinRange(targetDate, startDate, endDate)) {
      return { pass: true, reason: 'period' };
    }
    return { pass: false, reason: 'excluded' };
  }

  if (startDate === targetDate) {
    return { pass: true, reason: 'single' };
  }

  return { pass: false, reason: 'excluded' };
}

function decideRecurringForDate(todo, targetDate) {
  const normalizedRule = normalizeRecurrence(
    todo.recurrence,
    todo.recurrenceEndDate,
    { startDate: todo.startDate || todo.date }
  );

  if (!normalizedRule.isValid) {
    return {
      pass: false,
      reason: 'excluded',
      invalidRecurrence: true,
      normalizedRule,
    };
  }

  if (occursOnDateNormalized(normalizedRule, targetDate)) {
    return { pass: true, reason: 'recurrence', invalidRecurrence: false, normalizedRule };
  }

  return { pass: false, reason: 'excluded', invalidRecurrence: false, normalizedRule };
}

function decideNonRecurringForRange(todo, rangeStart, rangeEnd) {
  const singleDate = normalizeDateOnlyString(todo.date);
  const startDate = normalizeDateOnlyString(todo.startDate || todo.date);
  const endDate = normalizeDateOnlyString(todo.endDate || startDate);

  if (singleDate) {
    if (isWithinRange(singleDate, rangeStart, rangeEnd)) {
      return { pass: true, reason: 'single', occurrences: [singleDate] };
    }
    return { pass: false, reason: 'excluded', occurrences: [] };
  }

  if (!startDate) {
    return { pass: false, reason: 'excluded', occurrences: [] };
  }

  const effectiveEnd = endDate || startDate;
  const overlapStart = maxDate(startDate, rangeStart);
  const overlapEnd = minDate(effectiveEnd, rangeEnd);

  if (overlapEnd < overlapStart) {
    return { pass: false, reason: 'excluded', occurrences: [] };
  }

  if (startDate !== effectiveEnd) {
    return {
      pass: true,
      reason: 'period',
      occurrences: listDateRangeInclusive(overlapStart, overlapEnd),
    };
  }

  return {
    pass: true,
    reason: 'single',
    occurrences: [startDate],
  };
}

function decideRecurringForRange(todo, rangeStart, rangeEnd) {
  const normalizedRule = normalizeRecurrence(
    todo.recurrence,
    todo.recurrenceEndDate,
    { startDate: todo.startDate || todo.date }
  );

  if (!normalizedRule.isValid) {
    return {
      pass: false,
      reason: 'excluded',
      occurrences: [],
      invalidRecurrence: true,
      normalizedRule,
    };
  }

  const occurrences = expandOccurrencesInRange(normalizedRule, rangeStart, rangeEnd);
  if (occurrences.length === 0) {
    return {
      pass: false,
      reason: 'excluded',
      occurrences: [],
      invalidRecurrence: false,
      normalizedRule,
    };
  }

  return {
    pass: true,
    reason: 'recurrence',
    occurrences,
    invalidRecurrence: false,
    normalizedRule,
  };
}

export function decideForDate(candidates, targetDate) {
  const normalizedTargetDate = normalizeDateOnlyString(targetDate);
  const todoCandidates = Array.isArray(candidates?.todos) ? candidates.todos : [];

  if (!normalizedTargetDate) {
    return {
      ok: false,
      mode: 'date',
      targetDate,
      passedTodoIds: [],
      reasonsByTodoId: {},
      metrics: {
        candidateCount: todoCandidates.length,
        decidedCount: 0,
        excludedCount: todoCandidates.length,
        invalidRecurrenceCount: 0,
        elapsedMs: 0,
      },
      error: `invalid targetDate: ${targetDate}`,
    };
  }

  const startAt = performance.now();
  const passedTodoIds = [];
  const reasonsByTodoId = {};
  let excludedCount = 0;
  let invalidRecurrenceCount = 0;

  for (const todo of todoCandidates) {
    if (!todo?._id) continue;

    const isRecurring = Boolean(todo.recurrence);
    const decision = isRecurring
      ? decideRecurringForDate(todo, normalizedTargetDate)
      : decideNonRecurringForDate(todo, normalizedTargetDate);

    reasonsByTodoId[todo._id] = decision.reason;
    if (decision.invalidRecurrence) invalidRecurrenceCount += 1;

    if (decision.pass) passedTodoIds.push(todo._id);
    else excludedCount += 1;
  }

  const endAt = performance.now();
  return {
    ok: true,
    mode: 'date',
    targetDate: normalizedTargetDate,
    passedTodoIds,
    reasonsByTodoId,
    metrics: {
      candidateCount: todoCandidates.length,
      decidedCount: passedTodoIds.length,
      excludedCount,
      invalidRecurrenceCount,
      elapsedMs: Number((endAt - startAt).toFixed(2)),
    },
    error: null,
  };
}

export function decideForRange(candidates, rangeStart, rangeEnd) {
  const normalizedRangeStart = normalizeDateOnlyString(rangeStart);
  const normalizedRangeEnd = normalizeDateOnlyString(rangeEnd);
  const todoCandidates = Array.isArray(candidates?.todos) ? candidates.todos : [];

  if (!normalizedRangeStart || !normalizedRangeEnd || normalizedRangeEnd < normalizedRangeStart) {
    return {
      ok: false,
      mode: 'range',
      range: { startDate: rangeStart, endDate: rangeEnd },
      passedTodoIds: [],
      reasonsByTodoId: {},
      occurrencesByTodoId: {},
      metrics: {
        candidateCount: todoCandidates.length,
        decidedCount: 0,
        excludedCount: todoCandidates.length,
        invalidRecurrenceCount: 0,
        elapsedMs: 0,
      },
      error: `invalid range: ${rangeStart} ~ ${rangeEnd}`,
    };
  }

  const startAt = performance.now();
  const passedTodoIds = [];
  const reasonsByTodoId = {};
  const occurrencesByTodoId = {};
  let excludedCount = 0;
  let invalidRecurrenceCount = 0;

  for (const todo of todoCandidates) {
    if (!todo?._id) continue;

    const isRecurring = Boolean(todo.recurrence);
    const decision = isRecurring
      ? decideRecurringForRange(todo, normalizedRangeStart, normalizedRangeEnd)
      : decideNonRecurringForRange(todo, normalizedRangeStart, normalizedRangeEnd);

    reasonsByTodoId[todo._id] = decision.reason;
    if (decision.invalidRecurrence) invalidRecurrenceCount += 1;

    if (decision.pass) {
      passedTodoIds.push(todo._id);
      occurrencesByTodoId[todo._id] = decision.occurrences;
    } else {
      excludedCount += 1;
    }
  }

  const endAt = performance.now();
  return {
    ok: true,
    mode: 'range',
    range: { startDate: normalizedRangeStart, endDate: normalizedRangeEnd },
    passedTodoIds,
    reasonsByTodoId,
    occurrencesByTodoId,
    metrics: {
      candidateCount: todoCandidates.length,
      decidedCount: passedTodoIds.length,
      excludedCount,
      invalidRecurrenceCount,
      elapsedMs: Number((endAt - startAt).toFixed(2)),
    },
    error: null,
  };
}

