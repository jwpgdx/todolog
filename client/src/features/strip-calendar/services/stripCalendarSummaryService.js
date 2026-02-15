import dayjs from 'dayjs';
import { ensureDatabase, getDatabase } from '../../../services/db/database';
import { addDays, getDateList } from '../utils/stripCalendarDateUtils';

function normalizeRRule(rawRecurrence) {
  if (!rawRecurrence) return null;

  if (Array.isArray(rawRecurrence)) {
    return rawRecurrence[0] || null;
  }

  if (typeof rawRecurrence === 'string') {
    try {
      const parsed = JSON.parse(rawRecurrence);
      if (Array.isArray(parsed)) return parsed[0] || null;
      if (typeof parsed === 'string') return parsed;
    } catch {
      return rawRecurrence;
    }
    return null;
  }

  return null;
}

function extractFrequency(rrule) {
  const match = rrule.match(/FREQ=(\w+)/);
  return match ? match[1].toUpperCase() : null;
}

function matchesRecurringDate(rrule, startDate, targetDate) {
  const freq = extractFrequency(rrule);
  if (!freq) return false;

  if (targetDate < startDate) return false;

  if (freq === 'DAILY') {
    return true;
  }

  if (freq === 'WEEKLY') {
    const byDay = rrule.match(/BYDAY=([^;]+)/);
    const dayCodes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const targetCode = dayCodes[dayjs(targetDate).day()];

    if (byDay) {
      const allowed = byDay[1].split(',');
      return allowed.includes(targetCode);
    }

    return dayjs(targetDate).day() === dayjs(startDate).day();
  }

  if (freq === 'MONTHLY') {
    const byMonthDay = rrule.match(/BYMONTHDAY=(\d+)/);
    if (byMonthDay) {
      return dayjs(targetDate).date() === Number(byMonthDay[1]);
    }
    return dayjs(targetDate).date() === dayjs(startDate).date();
  }

  if (freq === 'YEARLY') {
    const byMonth = rrule.match(/BYMONTH=(\d+)/);
    const byMonthDay = rrule.match(/BYMONTHDAY=(\d+)/);

    const target = dayjs(targetDate);
    const monthMatch = byMonth
      ? target.month() + 1 === Number(byMonth[1])
      : target.month() === dayjs(startDate).month();
    const dayMatch = byMonthDay
      ? target.date() === Number(byMonthDay[1])
      : target.date() === dayjs(startDate).date();

    return monthMatch && dayMatch;
  }

  return false;
}

function todoOccursOnDate(row, targetDate) {
  const startDate = row.start_date || row.date;
  const endDate = row.end_date || row.start_date || row.date;

  if (!startDate) return false;

  const rrule = normalizeRRule(row.recurrence);
  if (!rrule) {
    return targetDate >= startDate && targetDate <= endDate;
  }

  if (row.recurrence_end_date && targetDate > row.recurrence_end_date) {
    return false;
  }

  return matchesRecurringDate(rrule, startDate, targetDate);
}

function getTodoIterationRange(row, rangeStart, rangeEnd) {
  const todoStart = row.start_date || row.date;
  if (!todoStart) return null;

  const recurring = !!normalizeRRule(row.recurrence);

  const todoEnd = recurring
    ? row.recurrence_end_date || rangeEnd
    : row.end_date || row.start_date || row.date;

  const start = todoStart > rangeStart ? todoStart : rangeStart;
  const end = todoEnd < rangeEnd ? todoEnd : rangeEnd;

  if (start > end) return null;

  return { start, end };
}

function buildSummaryMap(rows, startDate, endDate) {
  const setsByDate = {};

  for (const row of rows) {
    const color = row.category_color || '#6B7280';
    const iteration = getTodoIterationRange(row, startDate, endDate);
    if (!iteration) continue;

    for (const date of getDateList(iteration.start, iteration.end)) {
      if (!todoOccursOnDate(row, date)) continue;
      if (!setsByDate[date]) {
        setsByDate[date] = new Set();
      }
      setsByDate[date].add(color);
    }
  }

  const summaryMap = {};

  Object.entries(setsByDate).forEach(([date, colorSet]) => {
    const uniqueCategoryColors = Array.from(colorSet);
    summaryMap[date] = {
      date,
      hasTodo: uniqueCategoryColors.length > 0,
      uniqueCategoryColors,
      dotCount: uniqueCategoryColors.length,
    };
  });

  return summaryMap;
}

export async function fetchDaySummariesByRange(startDate, endDate) {
  await ensureDatabase();
  const db = getDatabase();

  const rows = await db.getAllAsync(
    `
      SELECT
        t._id,
        t.date,
        t.start_date,
        t.end_date,
        t.recurrence,
        t.recurrence_end_date,
        c.color AS category_color
      FROM todos t
      LEFT JOIN categories c ON t.category_id = c._id
      WHERE (
        (t.date >= ? AND t.date <= ?)
        OR (t.start_date >= ? AND t.start_date <= ?)
        OR (t.start_date <= ? AND COALESCE(t.end_date, t.start_date) >= ?)
        OR (
          t.recurrence IS NOT NULL
          AND t.start_date <= ?
          AND (t.recurrence_end_date IS NULL OR t.recurrence_end_date >= ?)
        )
      )
      AND t.deleted_at IS NULL
    `,
    [startDate, endDate, startDate, endDate, endDate, startDate, endDate, startDate]
  );

  return buildSummaryMap(rows, startDate, endDate);
}

export function buildEmptySummary(date) {
  return {
    date,
    hasTodo: false,
    uniqueCategoryColors: [],
    dotCount: 0,
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
