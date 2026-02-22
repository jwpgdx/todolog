import { ensureDatabase, getDatabase } from '../db/database';
import { normalizeDateOnlyString } from '../../utils/recurrenceEngine';

function safeParseRecurrence(rawValue) {
  if (rawValue == null) return null;
  if (typeof rawValue !== 'string') return rawValue;

  try {
    return JSON.parse(rawValue);
  } catch {
    return rawValue;
  }
}

function deserializeTodoCandidate(row) {
  return {
    _id: row._id,
    title: row.title,
    date: row.date,
    startDate: row.start_date,
    endDate: row.end_date,
    recurrence: safeParseRecurrence(row.recurrence),
    recurrenceEndDate: row.recurrence_end_date,
    categoryId: row.category_id,
    isAllDay: row.is_all_day === 1,
    startTime: row.start_time,
    endTime: row.end_time,
    memo: row.memo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    category: row.category_name
      ? {
        _id: row.category_id,
        name: row.category_name,
        color: row.category_color,
        icon: row.category_icon,
      }
      : null,
  };
}

function deserializeCompletion(row) {
  return {
    _id: row._id,
    key: row.key,
    todoId: row.todo_id,
    date: row.date,
    completedAt: row.completed_at,
  };
}

function buildStaleMeta(syncStatus = {}) {
  const isSyncing = Boolean(syncStatus?.isSyncing);
  const hasSyncError = Boolean(syncStatus?.error);

  let staleReason = null;
  if (isSyncing) staleReason = 'sync_in_progress';
  else if (hasSyncError) staleReason = 'sync_failed';

  return {
    isStale: Boolean(staleReason),
    staleReason,
    lastSyncTime: syncStatus?.lastSyncTime || null,
  };
}

async function fetchTodoCandidatesForDate(targetDate) {
  const db = getDatabase();
  const rows = await db.getAllAsync(
    `
      SELECT
        t.*,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon
      FROM todos t
      LEFT JOIN categories c ON t.category_id = c._id
      WHERE (
        t.date = ?
        OR (t.start_date <= ? AND COALESCE(t.end_date, t.start_date, t.date) >= ?)
        OR (
          t.recurrence IS NOT NULL
          AND COALESCE(t.start_date, t.date) <= ?
          AND (t.recurrence_end_date IS NULL OR t.recurrence_end_date >= ?)
        )
      )
      AND t.deleted_at IS NULL
      ORDER BY t.is_all_day DESC, t.start_time ASC, t.created_at ASC
    `,
    [targetDate, targetDate, targetDate, targetDate, targetDate]
  );

  return rows.map(deserializeTodoCandidate);
}

async function fetchTodoCandidatesForRange(startDate, endDate) {
  const db = getDatabase();
  const rows = await db.getAllAsync(
    `
      SELECT
        t.*,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon
      FROM todos t
      LEFT JOIN categories c ON t.category_id = c._id
      WHERE (
        (t.date >= ? AND t.date <= ?)
        OR (t.start_date <= ? AND COALESCE(t.end_date, t.start_date, t.date) >= ?)
        OR (
          t.recurrence IS NOT NULL
          AND COALESCE(t.start_date, t.date) <= ?
          AND (t.recurrence_end_date IS NULL OR t.recurrence_end_date >= ?)
        )
      )
      AND t.deleted_at IS NULL
      ORDER BY t.is_all_day DESC, t.start_time ASC, t.created_at ASC
    `,
    [startDate, endDate, endDate, startDate, endDate, startDate]
  );

  return rows.map(deserializeTodoCandidate);
}

async function fetchCompletionCandidatesForDate(targetDate) {
  const db = getDatabase();
  const rows = await db.getAllAsync(
    `
      SELECT *
      FROM completions
      WHERE date = ? OR date IS NULL
    `,
    [targetDate]
  );

  return rows.map(deserializeCompletion);
}

async function fetchCompletionCandidatesForRange(startDate, endDate) {
  const db = getDatabase();
  const rows = await db.getAllAsync(
    `
      SELECT *
      FROM completions
      WHERE (date >= ? AND date <= ?) OR date IS NULL
    `,
    [startDate, endDate]
  );

  return rows.map(deserializeCompletion);
}

export async function queryCandidatesForDate(targetDate, options = {}) {
  const normalizedDate = normalizeDateOnlyString(targetDate);
  if (!normalizedDate) {
    return {
      ok: false,
      mode: 'date',
      targetDate,
      todos: [],
      completions: [],
      meta: buildStaleMeta(options.syncStatus),
      metrics: {
        todoCandidates: 0,
        completionCandidates: 0,
        elapsedMs: 0,
      },
      error: `invalid targetDate: ${targetDate}`,
    };
  }

  const startAt = performance.now();
  await ensureDatabase();
  const [todos, completions] = await Promise.all([
    fetchTodoCandidatesForDate(normalizedDate),
    fetchCompletionCandidatesForDate(normalizedDate),
  ]);
  const endAt = performance.now();

  return {
    ok: true,
    mode: 'date',
    targetDate: normalizedDate,
    todos,
    completions,
    range: { startDate: normalizedDate, endDate: normalizedDate },
    meta: buildStaleMeta(options.syncStatus),
    metrics: {
      todoCandidates: todos.length,
      completionCandidates: completions.length,
      elapsedMs: Number((endAt - startAt).toFixed(2)),
    },
    error: null,
  };
}

export async function queryCandidatesForRange(startDate, endDate, options = {}) {
  const normalizedStartDate = normalizeDateOnlyString(startDate);
  const normalizedEndDate = normalizeDateOnlyString(endDate);

  if (!normalizedStartDate || !normalizedEndDate || normalizedEndDate < normalizedStartDate) {
    return {
      ok: false,
      mode: 'range',
      range: { startDate, endDate },
      todos: [],
      completions: [],
      meta: buildStaleMeta(options.syncStatus),
      metrics: {
        todoCandidates: 0,
        completionCandidates: 0,
        elapsedMs: 0,
      },
      error: `invalid range: ${startDate} ~ ${endDate}`,
    };
  }

  const startAt = performance.now();
  await ensureDatabase();
  const [todos, completions] = await Promise.all([
    fetchTodoCandidatesForRange(normalizedStartDate, normalizedEndDate),
    fetchCompletionCandidatesForRange(normalizedStartDate, normalizedEndDate),
  ]);
  const endAt = performance.now();

  return {
    ok: true,
    mode: 'range',
    range: { startDate: normalizedStartDate, endDate: normalizedEndDate },
    todos,
    completions,
    meta: buildStaleMeta(options.syncStatus),
    metrics: {
      todoCandidates: todos.length,
      completionCandidates: completions.length,
      elapsedMs: Number((endAt - startAt).toFixed(2)),
    },
    error: null,
  };
}
