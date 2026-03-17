import { adaptMonthLayoutsFromRangeHandoff } from '../adapters/adaptMonthLayoutsFromRangeHandoff';
import { decideForRange } from '../../../services/query-aggregation/occurrenceDecisionService';
import { aggregateForRange } from '../../../services/query-aggregation/aggregationService';

function createMonthMeta(year, month) {
  return {
    year,
    month,
    id: `${year}-${String(month).padStart(2, '0')}`,
  };
}

function createSuccessfulHandoff(itemsByDate) {
  return {
    ok: true,
    itemsByDate,
    meta: { isStale: false, staleReason: null, lastSyncTime: null },
    stage: { candidate: 0, decided: 0, aggregated: 0 },
    elapsed: { totalMs: 0, candidateMs: 0, decisionMs: 0, aggregationMs: 0 },
    diagnostics: { completionCandidates: 0, invalidRecurrenceCount: 0 },
    error: null,
  };
}

function createBaseItem(overrides = {}) {
  return {
    _id: overrides._id || overrides.todoId || 'todo',
    todoId: overrides.todoId || overrides._id || 'todo',
    title: overrides.title || 'Untitled',
    isRecurring: Boolean(overrides.isRecurring),
    isAllDay: Boolean(overrides.isAllDay),
    startDate: overrides.startDate || null,
    endDate: overrides.endDate || null,
    startTime: overrides.startTime || null,
    occurrenceDate: overrides.occurrenceDate || null,
    category: {
      _id: overrides.categoryId || `cat-${overrides.todoId || overrides._id || 'default'}`,
      color: overrides.color || '#64748B',
      order: overrides.categoryOrder ?? null,
    },
  };
}

function appendItem(itemsByDate, date, item) {
  if (!itemsByDate[date]) {
    itemsByDate[date] = [];
  }
  itemsByDate[date].push(item);
}

function addSpan(itemsByDate, config) {
  const item = createBaseItem(config);
  const dates = Array.isArray(config.dates) ? config.dates : [];
  for (const date of dates) {
    appendItem(itemsByDate, date, item);
  }
}

function addSingle(itemsByDate, config) {
  const item = createBaseItem({
    ...config,
    occurrenceDate: config.date,
  });
  appendItem(itemsByDate, config.date, item);
}

function summarizeSegments(week) {
  return (week?.segments || []).map((segment) => ({
    title: segment.title,
    lane: segment.lane,
    startCol: segment.startCol,
    endCol: segment.endCol,
    isSpan: segment.isSpan,
    isAllDay: segment.isAllDay,
    continuesFromPrevious: segment.continuesFromPrevious,
    continuesToNext: segment.continuesToNext,
  }));
}

function summarizeHiddenCounts(week, dateStrings) {
  const dayMap = new Map((week?.days || []).map((day) => [day.dateString, day.hiddenCount || 0]));
  return dateStrings.map((dateString) => ({
    dateString,
    hiddenCount: dayMap.get(dateString) || 0,
  }));
}

function buildMarchLayout(itemsByDate, startDayOfWeek = 0) {
  const result = adaptMonthLayoutsFromRangeHandoff(createSuccessfulHandoff(itemsByDate), {
    monthMetadatas: [createMonthMeta(2026, 3)],
    startDayOfWeek,
    language: 'ko',
  });

  return result.monthLayoutsById['2026-03'];
}

function createAssertionResult(id, label, passed, details) {
  return {
    id,
    label,
    passed,
    details: passed ? [] : details,
  };
}

function compareJson(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function assertCase(id, label, actual, expected, debugLabel) {
  const passed = compareJson(actual, expected);
  return createAssertionResult(
    id,
    label,
    passed,
    passed
      ? []
      : [
          `${debugLabel} mismatch`,
          `expected: ${JSON.stringify(expected)}`,
          `actual: ${JSON.stringify(actual)}`,
        ],
  );
}

function runCrossWeekSpanCase() {
  const itemsByDate = {};
  addSpan(itemsByDate, {
    todoId: 'cross-week',
    title: 'Cross Week',
    isAllDay: true,
    startDate: '2026-03-06',
    endDate: '2026-03-10',
    dates: ['2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10'],
    categoryOrder: 0,
    color: '#2563EB',
  });

  const layout = buildMarchLayout(itemsByDate, 0);
  const actual = {
    week0: summarizeSegments(layout.weeks[0]),
    week1: summarizeSegments(layout.weeks[1]),
  };
  const expected = {
    week0: [
      {
        title: 'Cross Week',
        lane: 0,
        startCol: 5,
        endCol: 6,
        isSpan: true,
        isAllDay: true,
        continuesFromPrevious: false,
        continuesToNext: true,
      },
    ],
    week1: [
      {
        title: 'Cross Week',
        lane: 0,
        startCol: 0,
        endCol: 2,
        isSpan: true,
        isAllDay: true,
        continuesFromPrevious: true,
        continuesToNext: false,
      },
    ],
  };

  return assertCase('cross-week-span', 'Cross-week span', actual, expected, 'segment');
}

function runCrossMonthSpanCase() {
  const itemsByDate = {};
  addSpan(itemsByDate, {
    todoId: 'cross-month',
    title: 'Cross Month',
    isAllDay: true,
    startDate: '2026-02-26',
    endDate: '2026-03-03',
    dates: ['2026-03-01', '2026-03-02', '2026-03-03'],
    categoryOrder: 0,
    color: '#0EA5E9',
  });

  const layout = buildMarchLayout(itemsByDate, 0);
  const actual = summarizeSegments(layout.weeks[0]);
  const expected = [
    {
      title: 'Cross Month',
      lane: 0,
      startCol: 0,
      endCol: 2,
      isSpan: true,
      isAllDay: true,
      continuesFromPrevious: true,
      continuesToNext: false,
    },
  ];

  return assertCase('cross-month-span', 'Cross-month span clipping', actual, expected, 'segment');
}

function runMondayBoundaryCase() {
  const itemsByDate = {};
  addSpan(itemsByDate, {
    todoId: 'monday-boundary',
    title: 'Monday Boundary',
    isAllDay: true,
    startDate: '2026-03-01',
    endDate: '2026-03-03',
    dates: ['2026-03-01', '2026-03-02', '2026-03-03'],
    categoryOrder: 0,
    color: '#7C3AED',
  });

  const layout = buildMarchLayout(itemsByDate, 1);
  const actual = {
    week0: summarizeSegments(layout.weeks[0]),
    week1: summarizeSegments(layout.weeks[1]),
  };
  const expected = {
    week0: [
      {
        title: 'Monday Boundary',
        lane: 0,
        startCol: 6,
        endCol: 6,
        isSpan: true,
        isAllDay: true,
        continuesFromPrevious: false,
        continuesToNext: true,
      },
    ],
    week1: [
      {
        title: 'Monday Boundary',
        lane: 0,
        startCol: 0,
        endCol: 1,
        isSpan: true,
        isAllDay: true,
        continuesFromPrevious: true,
        continuesToNext: false,
      },
    ],
  };

  return assertCase('monday-boundary', 'Monday week boundary segmentation', actual, expected, 'segment');
}

function runTimedMultiDaySpanCase() {
  const itemsByDate = {};
  addSpan(itemsByDate, {
    todoId: 'timed-span',
    title: 'Timed Span',
    isAllDay: false,
    startDate: '2026-03-11',
    endDate: '2026-03-13',
    startTime: '09:00',
    dates: ['2026-03-11', '2026-03-12', '2026-03-13'],
    categoryOrder: 1,
    color: '#16A34A',
  });

  const layout = buildMarchLayout(itemsByDate, 0);
  const actual = summarizeSegments(layout.weeks[1]);
  const expected = [
    {
      title: 'Timed Span',
      lane: 0,
      startCol: 3,
      endCol: 5,
      isSpan: true,
      isAllDay: false,
      continuesFromPrevious: false,
      continuesToNext: false,
    },
  ];

  return assertCase('timed-multi-day-span', 'Timed multi-day span', actual, expected, 'segment');
}

function runOrderingCollisionCase() {
  const itemsByDate = {};
  addSpan(itemsByDate, {
    todoId: 'all-day-span',
    title: 'All Day Span',
    isAllDay: true,
    startDate: '2026-03-10',
    endDate: '2026-03-14',
    dates: ['2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14'],
    categoryOrder: 0,
    color: '#2563EB',
  });
  addSpan(itemsByDate, {
    todoId: 'timed-span',
    title: 'Timed Span',
    isAllDay: false,
    startDate: '2026-03-10',
    endDate: '2026-03-14',
    startTime: '09:00',
    dates: ['2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14'],
    categoryOrder: 1,
    color: '#0EA5E9',
  });
  addSingle(itemsByDate, {
    todoId: 'all-day-single',
    title: 'All Day Single',
    isAllDay: true,
    date: '2026-03-10',
    categoryOrder: 2,
    color: '#D97706',
  });
  addSingle(itemsByDate, {
    todoId: 'timed-single',
    title: 'Timed Single',
    isAllDay: false,
    startTime: '08:00',
    date: '2026-03-10',
    categoryOrder: 3,
    color: '#DC2626',
  });

  const layout = buildMarchLayout(itemsByDate, 0);
  const week = layout.weeks[1];
  const actual = {
    segments: summarizeSegments(week),
    hiddenCounts: summarizeHiddenCounts(week, ['2026-03-10']),
  };
  const expected = {
    segments: [
      {
        title: 'All Day Span',
        lane: 0,
        startCol: 2,
        endCol: 6,
        isSpan: true,
        isAllDay: true,
        continuesFromPrevious: false,
        continuesToNext: false,
      },
      {
        title: 'Timed Span',
        lane: 1,
        startCol: 2,
        endCol: 6,
        isSpan: true,
        isAllDay: false,
        continuesFromPrevious: false,
        continuesToNext: false,
      },
      {
        title: 'All Day Single',
        lane: 2,
        startCol: 2,
        endCol: 2,
        isSpan: false,
        isAllDay: true,
        continuesFromPrevious: false,
        continuesToNext: false,
      },
    ],
    hiddenCounts: [
      {
        dateString: '2026-03-10',
        hiddenCount: 1,
      },
    ],
  };

  return assertCase('ordering-collision', 'Class-rank ordering and overflow', actual, expected, 'layout');
}

function runSpanOverflowCase() {
  const itemsByDate = {};
  const visibleDates = ['2026-03-15', '2026-03-16', '2026-03-17'];

  addSpan(itemsByDate, {
    todoId: 'span-a',
    title: 'Span A',
    isAllDay: true,
    startDate: '2026-03-15',
    endDate: '2026-03-17',
    dates: visibleDates,
    categoryOrder: 0,
    color: '#2563EB',
  });
  addSpan(itemsByDate, {
    todoId: 'span-b',
    title: 'Span B',
    isAllDay: true,
    startDate: '2026-03-15',
    endDate: '2026-03-17',
    dates: visibleDates,
    categoryOrder: 1,
    color: '#0EA5E9',
  });
  addSpan(itemsByDate, {
    todoId: 'span-c',
    title: 'Span C',
    isAllDay: true,
    startDate: '2026-03-15',
    endDate: '2026-03-17',
    dates: visibleDates,
    categoryOrder: 2,
    color: '#D97706',
  });
  addSpan(itemsByDate, {
    todoId: 'span-d',
    title: 'Span D',
    isAllDay: true,
    startDate: '2026-03-15',
    endDate: '2026-03-17',
    dates: visibleDates,
    categoryOrder: 3,
    color: '#DC2626',
  });

  const layout = buildMarchLayout(itemsByDate, 0);
  const week = layout.weeks[2];
  const actual = {
    segments: summarizeSegments(week),
    hiddenCounts: summarizeHiddenCounts(week, visibleDates),
  };
  const expected = {
    segments: [
      {
        title: 'Span A',
        lane: 0,
        startCol: 0,
        endCol: 2,
        isSpan: true,
        isAllDay: true,
        continuesFromPrevious: false,
        continuesToNext: false,
      },
      {
        title: 'Span B',
        lane: 1,
        startCol: 0,
        endCol: 2,
        isSpan: true,
        isAllDay: true,
        continuesFromPrevious: false,
        continuesToNext: false,
      },
      {
        title: 'Span C',
        lane: 2,
        startCol: 0,
        endCol: 2,
        isSpan: true,
        isAllDay: true,
        continuesFromPrevious: false,
        continuesToNext: false,
      },
    ],
    hiddenCounts: [
      { dateString: '2026-03-15', hiddenCount: 1 },
      { dateString: '2026-03-16', hiddenCount: 1 },
      { dateString: '2026-03-17', hiddenCount: 1 },
    ],
  };

  return assertCase('span-overflow', 'Overflow with 3 occupied span lanes', actual, expected, 'layout');
}

function runLegacyDateSpanDecisionCase() {
  const todo = {
    _id: 'legacy-date-span',
    todoId: 'legacy-date-span',
    title: 'Legacy Date Span',
    date: '2026-03-02',
    startDate: '2026-03-02',
    endDate: '2026-03-20',
    recurrence: null,
    isAllDay: true,
    startTime: null,
    endTime: null,
    category: {
      _id: 'cat-legacy-date-span',
      color: '#2563EB',
      order: 0,
    },
  };

  const decision = decideForRange(
    { todos: [todo] },
    '2026-03-01',
    '2026-03-31',
  );
  const aggregation = aggregateForRange({
    candidates: { todos: [todo], completions: [] },
    decision,
    range: { startDate: '2026-03-01', endDate: '2026-03-31' },
  });

  const actual = {
    occurrences: decision.occurrencesByTodoId?.['legacy-date-span'] || [],
    aggregatedDates: Object.keys(aggregation.itemsByDate || {}).sort(),
  };
  const expectedDates = [];
  for (let day = 2; day <= 20; day += 1) {
    expectedDates.push(`2026-03-${String(day).padStart(2, '0')}`);
  }
  const expected = {
    occurrences: expectedDates,
    aggregatedDates: expectedDates,
  };

  return assertCase(
    'legacy-date-span-decision',
    'Legacy date field does not collapse multi-day span',
    actual,
    expected,
    'range-decision',
  );
}

export function runTodoCalendarV2FixtureMatrix() {
  const cases = [
    runCrossWeekSpanCase(),
    runCrossMonthSpanCase(),
    runMondayBoundaryCase(),
    runTimedMultiDaySpanCase(),
    runOrderingCollisionCase(),
    runSpanOverflowCase(),
    runLegacyDateSpanDecisionCase(),
  ];

  const passedCount = cases.filter((entry) => entry.passed).length;
  return {
    passedCount,
    totalCount: cases.length,
    allPassed: passedCount === cases.length,
    cases,
  };
}
