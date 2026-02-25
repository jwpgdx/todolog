import { ensureDatabase, getDatabase, getDatabaseInitDebugState } from '../db/database';
import { normalizeDateOnlyString } from '../../utils/recurrenceEngine';

const CANDIDATE_PERF_LOG_ENABLED = true;
const CANDIDATE_SLOW_THRESHOLD_MS = 80;
const CANDIDATE_EXPLAIN_ON_SLOW = true;
const CANDIDATE_ENSURE_DIAG_THRESHOLD_MS = 20;
const SQL_PING = `SELECT 1 AS ok`;

const SQL_TODOS_DATE = `
  WITH candidate_ids AS (
    SELECT _id
    FROM todos
    WHERE deleted_at IS NULL
      AND date = ?

    UNION

    SELECT _id
    FROM todos
    WHERE deleted_at IS NULL
      AND end_date IS NOT NULL
      AND start_date <= ?
      AND end_date >= ?

    UNION

    SELECT _id
    FROM todos
    WHERE deleted_at IS NULL
      AND end_date IS NULL
      AND start_date = ?

    UNION

    SELECT _id
    FROM todos
    WHERE deleted_at IS NULL
      AND recurrence IS NOT NULL
      AND start_date IS NOT NULL
      AND start_date <= ?
      AND (recurrence_end_date IS NULL OR recurrence_end_date >= ?)

    UNION

    SELECT _id
    FROM todos
    WHERE deleted_at IS NULL
      AND recurrence IS NOT NULL
      AND start_date IS NULL
      AND date IS NOT NULL
      AND date <= ?
      AND (recurrence_end_date IS NULL OR recurrence_end_date >= ?)
  )
  SELECT
    t.*,
    c.name as category_name,
    c.color as category_color,
    c.icon as category_icon
  FROM candidate_ids ids
  JOIN todos t ON t._id = ids._id
  LEFT JOIN categories c ON t.category_id = c._id
  ORDER BY t.is_all_day DESC, t.start_time ASC, t.created_at ASC
`;

const SQL_TODOS_RANGE = `
  WITH candidate_ids AS (
    SELECT _id
    FROM todos
    WHERE deleted_at IS NULL
      AND date >= ?
      AND date <= ?

    UNION

    SELECT _id
    FROM todos
    WHERE deleted_at IS NULL
      AND end_date IS NOT NULL
      AND start_date <= ?
      AND end_date >= ?

    UNION

    SELECT _id
    FROM todos
    WHERE deleted_at IS NULL
      AND end_date IS NULL
      AND start_date >= ?
      AND start_date <= ?

    UNION

    SELECT _id
    FROM todos
    WHERE deleted_at IS NULL
      AND recurrence IS NOT NULL
      AND start_date IS NOT NULL
      AND start_date <= ?
      AND (recurrence_end_date IS NULL OR recurrence_end_date >= ?)

    UNION

    SELECT _id
    FROM todos
    WHERE deleted_at IS NULL
      AND recurrence IS NOT NULL
      AND start_date IS NULL
      AND date IS NOT NULL
      AND date <= ?
      AND (recurrence_end_date IS NULL OR recurrence_end_date >= ?)
  )
  SELECT
    t.*,
    c.name as category_name,
    c.color as category_color,
    c.icon as category_icon
  FROM candidate_ids ids
  JOIN todos t ON t._id = ids._id
  LEFT JOIN categories c ON t.category_id = c._id
  ORDER BY t.is_all_day DESC, t.start_time ASC, t.created_at ASC
`;

const SQL_COMPLETIONS_DATE = `
  SELECT * FROM completions WHERE date = ?
  UNION ALL
  SELECT * FROM completions WHERE date IS NULL
`;

const SQL_COMPLETIONS_RANGE = `
  SELECT * FROM completions WHERE date >= ? AND date <= ?
  UNION ALL
  SELECT * FROM completions WHERE date IS NULL
`;

function buildTodoDateParams(targetDate) {
  return [
    targetDate,
    targetDate,
    targetDate,
    targetDate,
    targetDate,
    targetDate,
    targetDate,
    targetDate,
  ];
}

function buildTodoRangeParams(startDate, endDate) {
  return [
    startDate,
    endDate,
    endDate,
    startDate,
    startDate,
    endDate,
    endDate,
    startDate,
    endDate,
    startDate,
  ];
}

function buildCompletionDateParams(targetDate) {
  return [targetDate];
}

function buildCompletionRangeParams(startDate, endDate) {
  return [startDate, endDate];
}

function nowMs() {
  if (typeof globalThis?.performance?.now === 'function') {
    return globalThis.performance.now();
  }
  return Date.now();
}

function formatMs(value) {
  return Number((value || 0).toFixed(2));
}

function formatEventLoopLagForLog(lagMs, fired) {
  if (typeof lagMs !== 'number' || !Number.isFinite(lagMs)) return 'n/a';
  const firedText = fired == null ? '?' : fired ? 'Y' : 'N';
  return `${lagMs}ms(fired=${firedText})`;
}

function startEventLoopLagProbe() {
  if (typeof setTimeout !== 'function') {
    return null;
  }

  const scheduledAtMs = nowMs();
  let firedAtMs = null;
  const timerId = setTimeout(() => {
    firedAtMs = nowMs();
  }, 0);

  return {
    stop: () => {
      if (typeof clearTimeout === 'function') {
        clearTimeout(timerId);
      }

      const stoppedAtMs = nowMs();
      const fired = firedAtMs != null;
      const lagMs = formatMs((firedAtMs ?? stoppedAtMs) - scheduledAtMs);
      return { fired, lagMs };
    },
  };
}

function simplifyInitStateForLog(state = {}) {
  return {
    hasDb: Boolean(state?.hasDb),
    hasInitPromise: Boolean(state?.hasInitPromise),
    phase: state?.phase || 'unknown',
    runId: state?.runId || 0,
    elapsedSinceStartMs: formatMs(state?.elapsedSinceStartMs || 0),
    totalMs: formatMs(state?.totalMs || 0),
  };
}

function shouldLogEnsureDiagnostics(ensureMs, beforeState, afterState) {
  if (ensureMs >= CANDIDATE_ENSURE_DIAG_THRESHOLD_MS) return true;
  if ((beforeState?.phase || 'unknown') !== 'ready') return true;
  if ((afterState?.phase || 'unknown') !== 'ready') return true;
  return false;
}

function logEnsureDiagnostics({ mode, label, ensureMs, beforeState, afterState }) {
  if (!shouldLogEnsureDiagnostics(ensureMs, beforeState, afterState)) return;

  console.log(
    `[common-candidate:ensure] mode=${mode} ${label} ensure=${ensureMs}ms ` +
      `before=${JSON.stringify(simplifyInitStateForLog(beforeState))} ` +
      `after=${JSON.stringify(simplifyInitStateForLog(afterState))}`
  );
}

async function runTimedGetAllAsync(db, sql, params = []) {
  const queryStart = nowMs();
  const rows = await db.getAllAsync(sql, params);
  const queryMs = formatMs(nowMs() - queryStart);
  return { rows, queryMs };
}

async function runParallelPairProbe({ mode, normalizedDate, normalizedStartDate, normalizedEndDate }) {
  const db = getDatabase();
  const todoParams =
    mode === 'date'
      ? buildTodoDateParams(normalizedDate)
      : buildTodoRangeParams(normalizedStartDate, normalizedEndDate);
  const completionParams =
    mode === 'date'
      ? buildCompletionDateParams(normalizedDate)
      : buildCompletionRangeParams(normalizedStartDate, normalizedEndDate);
  const todoSql = mode === 'date' ? SQL_TODOS_DATE : SQL_TODOS_RANGE;
  const completionSql = mode === 'date' ? SQL_COMPLETIONS_DATE : SQL_COMPLETIONS_RANGE;

  const pairStart = nowMs();
  const eventLoopProbe = startEventLoopLagProbe();
  let todoStartOffsetMs = 0;
  let todoEndOffsetMs = 0;
  let completionStartOffsetMs = 0;
  let completionEndOffsetMs = 0;

  const todoPromise = (async () => {
    todoStartOffsetMs = formatMs(nowMs() - pairStart);
    const result = await runTimedGetAllAsync(db, todoSql, todoParams);
    todoEndOffsetMs = formatMs(nowMs() - pairStart);
    return result;
  })();

  const completionPromise = (async () => {
    completionStartOffsetMs = formatMs(nowMs() - pairStart);
    const result = await runTimedGetAllAsync(db, completionSql, completionParams);
    completionEndOffsetMs = formatMs(nowMs() - pairStart);
    return result;
  })();

  const [todoProbe, completionProbe] = await Promise.all([todoPromise, completionPromise]);
  const eventLoopLag = eventLoopProbe?.stop?.() || null;
  const pairFetchMs = formatMs(nowMs() - pairStart);

  return {
    pairFetchMs,
    todoMs: todoProbe.queryMs,
    completionMs: completionProbe.queryMs,
    eventLoopLagMs: eventLoopLag?.lagMs ?? null,
    eventLoopLagFired: eventLoopLag?.fired ?? null,
    timeline: {
      todoStartOffsetMs,
      todoEndOffsetMs,
      completionStartOffsetMs,
      completionEndOffsetMs,
    },
  };
}

async function runSlowSequentialProbe({ mode, normalizedDate, normalizedStartDate, normalizedEndDate }) {
  const db = getDatabase();
  const todoParams =
    mode === 'date'
      ? buildTodoDateParams(normalizedDate)
      : buildTodoRangeParams(normalizedStartDate, normalizedEndDate);
  const completionParams =
    mode === 'date'
      ? buildCompletionDateParams(normalizedDate)
      : buildCompletionRangeParams(normalizedStartDate, normalizedEndDate);
  const todoSql = mode === 'date' ? SQL_TODOS_DATE : SQL_TODOS_RANGE;
  const completionSql = mode === 'date' ? SQL_COMPLETIONS_DATE : SQL_COMPLETIONS_RANGE;

  const startedAt = nowMs();
  const eventLoopProbe = startEventLoopLagProbe();
  const todoProbe = await runTimedGetAllAsync(db, todoSql, todoParams);
  const completionProbe = await runTimedGetAllAsync(db, completionSql, completionParams);
  const eventLoopLag = eventLoopProbe?.stop?.() || null;
  const sequentialTotalMs = formatMs(nowMs() - startedAt);

  return {
    todoOnlyMs: todoProbe.queryMs,
    completionOnlyMs: completionProbe.queryMs,
    sequentialTotalMs,
    eventLoopLagMs: eventLoopLag?.lagMs ?? null,
    eventLoopLagFired: eventLoopLag?.fired ?? null,
  };
}

async function runPingProbe() {
  const db = getDatabase();
  const eventLoopProbe = startEventLoopLagProbe();
  const ping = await runTimedGetAllAsync(db, SQL_PING);
  const eventLoopLag = eventLoopProbe?.stop?.() || null;
  return {
    queryMs: ping.queryMs,
    eventLoopLagMs: eventLoopLag?.lagMs ?? null,
    eventLoopLagFired: eventLoopLag?.fired ?? null,
  };
}

function detectSlowPathSuspect({
  mainPairMs,
  repeatPairMs,
  sequentialTotalMs,
  pingMs,
  eventLoopLag0Ms,
}) {
  // 분류 목적:
  // - SQL/인덱스 병목인지 (sequential이 느리면)
  // - "한 번만" 느린데 SQL은 빠른 패턴인지 (repeat/sequential/ping이 모두 빠르면)
  //   - 그 원인이 브리지/워커 큐인지, 아니면 JS 메인 스레드 long task(렌더/레이아웃 등)인지 구분

  if (sequentialTotalMs >= 120) return 'sql-or-index';

  const looksLikeNonSqlColdOnce =
    mainPairMs >= 120 &&
    repeatPairMs <= 40 &&
    sequentialTotalMs <= 40 &&
    pingMs <= 8;

  if (!looksLikeNonSqlColdOnce) return 'mixed-or-unknown';

  const likelyEventLoopLag =
    typeof eventLoopLag0Ms === 'number' && Number.isFinite(eventLoopLag0Ms) && eventLoopLag0Ms >= 80;
  if (likelyEventLoopLag) return 'event-loop-lag';

  return 'bridge-queue-cold-path';
}

function buildTraceToken(traceId) {
  return traceId ? ` trace=${traceId}` : '';
}

async function explainQueryPlan(db, sql, params = []) {
  try {
    const planRows = await db.getAllAsync(`EXPLAIN QUERY PLAN ${sql}`, params);
    return (planRows || []).map((row) => row?.detail || JSON.stringify(row));
  } catch (error) {
    return [`EXPLAIN failed: ${error?.message || String(error)}`];
  }
}

async function collectCandidateExplainPlans({ mode, normalizedDate, normalizedStartDate, normalizedEndDate }) {
  const db = getDatabase();
  const todoParams =
    mode === 'date'
      ? buildTodoDateParams(normalizedDate)
      : buildTodoRangeParams(normalizedStartDate, normalizedEndDate);
  const completionParams =
    mode === 'date'
      ? buildCompletionDateParams(normalizedDate)
      : buildCompletionRangeParams(normalizedStartDate, normalizedEndDate);
  const todoSql = mode === 'date' ? SQL_TODOS_DATE : SQL_TODOS_RANGE;
  const completionSql = mode === 'date' ? SQL_COMPLETIONS_DATE : SQL_COMPLETIONS_RANGE;

  const [todoPlan, completionPlan] = await Promise.all([
    explainQueryPlan(db, todoSql, todoParams),
    explainQueryPlan(db, completionSql, completionParams),
  ]);

  return {
    mode,
    todoPlan,
    completionPlan,
  };
}

function logCandidateExplainDetails({ mode, trigger, explain }) {
  if (!explain) return;

  console.log(`[common-candidate:explain] mode=${mode} trigger=${trigger} todosPlan=`, explain.todoPlan);
  console.log(`[common-candidate:explain] mode=${mode} trigger=${trigger} completionsPlan=`, explain.completionPlan);
}

async function logCandidateSlowQueryDetails(payload, existingExplain = null) {
  if (!CANDIDATE_EXPLAIN_ON_SLOW) return existingExplain;

  const explain = existingExplain || (await collectCandidateExplainPlans(payload));
  logCandidateExplainDetails({
    mode: payload.mode,
    trigger: 'slow',
    explain,
  });
  return explain;
}

function normalizeExplainMetrics(explain) {
  if (!explain) return null;

  return {
    mode: explain.mode,
    todoPlan: Array.isArray(explain.todoPlan) ? explain.todoPlan : [],
    completionPlan: Array.isArray(explain.completionPlan) ? explain.completionPlan : [],
  };
}

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
  const { rows, queryMs } = await runTimedGetAllAsync(
    db,
    SQL_TODOS_DATE,
    buildTodoDateParams(targetDate)
  );
  const deserializeStart = nowMs();
  const todos = rows.map(deserializeTodoCandidate);
  const deserializeMs = formatMs(nowMs() - deserializeStart);
  return { todos, queryMs, deserializeMs };
}

async function fetchTodoCandidatesForRange(startDate, endDate) {
  const db = getDatabase();
  const { rows, queryMs } = await runTimedGetAllAsync(
    db,
    SQL_TODOS_RANGE,
    buildTodoRangeParams(startDate, endDate)
  );
  const deserializeStart = nowMs();
  const todos = rows.map(deserializeTodoCandidate);
  const deserializeMs = formatMs(nowMs() - deserializeStart);
  return { todos, queryMs, deserializeMs };
}

async function fetchCompletionCandidatesForDate(targetDate) {
  const db = getDatabase();
  const { rows, queryMs } = await runTimedGetAllAsync(
    db,
    SQL_COMPLETIONS_DATE,
    buildCompletionDateParams(targetDate)
  );
  const deserializeStart = nowMs();
  const completions = rows.map(deserializeCompletion);
  const deserializeMs = formatMs(nowMs() - deserializeStart);
  return { completions, queryMs, deserializeMs };
}

async function fetchCompletionCandidatesForRange(startDate, endDate) {
  const db = getDatabase();
  const { rows, queryMs } = await runTimedGetAllAsync(
    db,
    SQL_COMPLETIONS_RANGE,
    buildCompletionRangeParams(startDate, endDate)
  );
  const deserializeStart = nowMs();
  const completions = rows.map(deserializeCompletion);
  const deserializeMs = formatMs(nowMs() - deserializeStart);
  return { completions, queryMs, deserializeMs };
}

export async function queryCandidatesForDate(targetDate, options = {}) {
  const normalizedDate = normalizeDateOnlyString(targetDate);
  const traceToken = buildTraceToken(options?.traceId);
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

  const startAt = nowMs();
  const ensureStateBefore = getDatabaseInitDebugState();
  let ensureMs = 0;
  let ensureStateAfter = ensureStateBefore;
  let ensurePath = 'fast-sync';

  // Keep this branch fully synchronous to avoid an extra await/yield cost on hot path.
  if (!(ensureStateBefore?.hasDb && ensureStateBefore?.phase === 'ready')) {
    const ensureStart = nowMs();
    await ensureDatabase();
    ensureMs = formatMs(nowMs() - ensureStart);
    ensureStateAfter = getDatabaseInitDebugState();
    ensurePath = 'await';
    logEnsureDiagnostics({
      mode: 'date',
      label: `target=${normalizedDate}`,
      ensureMs,
      beforeState: ensureStateBefore,
      afterState: ensureStateAfter,
    });
  }

  // If "slow query" is actually main-thread blockage, timers won't fire during await.
  // Keep this off hot-path unless traceId is present.
  const eventLoopProbe = options?.traceId ? startEventLoopLagProbe() : null;
  const [todoResult, completionResult] = await Promise.all([
    fetchTodoCandidatesForDate(normalizedDate),
    fetchCompletionCandidatesForDate(normalizedDate),
  ]);
  const eventLoopLag = eventLoopProbe?.stop?.() || null;
  const parallelFetchMs = formatMs(nowMs() - startAt - ensureMs);
  const todos = todoResult.todos;
  const completions = completionResult.completions;
  const endAt = nowMs();
  const elapsedMs = formatMs(endAt - startAt);
  const explainPayload = {
    mode: 'date',
    normalizedDate,
  };
  let explain = null;

  if (CANDIDATE_PERF_LOG_ENABLED) {
    console.log(
      `[common-candidate:perf] mode=date target=${normalizedDate} ` +
        `total=${elapsedMs}ms ensure=${ensureMs}ms ` +
        `pairFetch=${parallelFetchMs}ms ` +
        `todoQuery=${todoResult.queryMs}ms todoDeserialize=${todoResult.deserializeMs}ms todoRows=${todos.length} ` +
        `completionQuery=${completionResult.queryMs}ms completionDeserialize=${completionResult.deserializeMs}ms completionRows=${completions.length} ` +
        `ensurePhase=${ensureStateBefore?.phase || 'unknown'}->${ensureStateAfter?.phase || 'unknown'} ` +
        `ensurePath=${ensurePath}` +
        (eventLoopLag ? ` eventLoopLag0=${eventLoopLag.lagMs}ms(fired=${eventLoopLag.fired ? 'Y' : 'N'})` : '') +
        `${traceToken}`
    );
  }

  if (options.debugExplain) {
    explain = await collectCandidateExplainPlans(explainPayload);
    logCandidateExplainDetails({ mode: 'date', trigger: 'manual', explain });
  }

  if (elapsedMs >= CANDIDATE_SLOW_THRESHOLD_MS) {
    const repeatPairProbe = await runParallelPairProbe({
      mode: 'date',
      normalizedDate,
    });
    const slowProbe = await runSlowSequentialProbe({
      mode: 'date',
      normalizedDate,
    });
    const pingProbe = await runPingProbe();
    const suspect = detectSlowPathSuspect({
      mainPairMs: parallelFetchMs,
      repeatPairMs: repeatPairProbe.pairFetchMs,
      sequentialTotalMs: slowProbe.sequentialTotalMs,
      pingMs: pingProbe.queryMs,
      eventLoopLag0Ms: eventLoopLag?.lagMs ?? null,
    });
    console.log(
      `[common-candidate:slow-probe] mode=date target=${normalizedDate} ` +
        `mainPair=${parallelFetchMs}ms(mainTodo=${todoResult.queryMs}ms,mainComp=${completionResult.queryMs}ms) ` +
        `repeatPair=${repeatPairProbe.pairFetchMs}ms(repeatTodo=${repeatPairProbe.todoMs}ms,repeatComp=${repeatPairProbe.completionMs}ms) ` +
        `sequentialTotal=${slowProbe.sequentialTotalMs}ms(seqTodo=${slowProbe.todoOnlyMs}ms,seqComp=${slowProbe.completionOnlyMs}ms) ` +
        `timeline(todo=${repeatPairProbe.timeline.todoStartOffsetMs}->${repeatPairProbe.timeline.todoEndOffsetMs}ms,` +
        `comp=${repeatPairProbe.timeline.completionStartOffsetMs}->${repeatPairProbe.timeline.completionEndOffsetMs}ms) ` +
        `ping=${pingProbe.queryMs}ms suspect=${suspect}` +
        ` eventLoopLagRepeat=${formatEventLoopLagForLog(repeatPairProbe.eventLoopLagMs, repeatPairProbe.eventLoopLagFired)}` +
        ` eventLoopLagSeq=${formatEventLoopLagForLog(slowProbe.eventLoopLagMs, slowProbe.eventLoopLagFired)}` +
        ` eventLoopLagPing=${formatEventLoopLagForLog(pingProbe.eventLoopLagMs, pingProbe.eventLoopLagFired)}` +
        (eventLoopLag ? ` eventLoopLag0=${eventLoopLag.lagMs}ms(fired=${eventLoopLag.fired ? 'Y' : 'N'})` : '') +
        `${traceToken}`
    );
    explain = await logCandidateSlowQueryDetails(explainPayload, explain);
  }

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
      elapsedMs,
      ensureMs,
      parallelFetchMs,
      todoQueryMs: todoResult.queryMs,
      todoDeserializeMs: todoResult.deserializeMs,
      completionQueryMs: completionResult.queryMs,
      completionDeserializeMs: completionResult.deserializeMs,
      eventLoopLag0Ms: eventLoopLag?.lagMs ?? null,
      eventLoopLag0Fired: eventLoopLag?.fired ?? null,
      ensurePath,
      ensureStateBefore: simplifyInitStateForLog(ensureStateBefore),
      ensureStateAfter: simplifyInitStateForLog(ensureStateAfter),
      explain: normalizeExplainMetrics(explain),
    },
    error: null,
  };
}

export async function queryCandidatesForRange(startDate, endDate, options = {}) {
  const normalizedStartDate = normalizeDateOnlyString(startDate);
  const normalizedEndDate = normalizeDateOnlyString(endDate);
  const traceToken = buildTraceToken(options?.traceId);

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

  const startAt = nowMs();
  const ensureStateBefore = getDatabaseInitDebugState();
  let ensureMs = 0;
  let ensureStateAfter = ensureStateBefore;
  let ensurePath = 'fast-sync';

  // Keep this branch fully synchronous to avoid an extra await/yield cost on hot path.
  if (!(ensureStateBefore?.hasDb && ensureStateBefore?.phase === 'ready')) {
    const ensureStart = nowMs();
    await ensureDatabase();
    ensureMs = formatMs(nowMs() - ensureStart);
    ensureStateAfter = getDatabaseInitDebugState();
    ensurePath = 'await';
    logEnsureDiagnostics({
      mode: 'range',
      label: `range=${normalizedStartDate}~${normalizedEndDate}`,
      ensureMs,
      beforeState: ensureStateBefore,
      afterState: ensureStateAfter,
    });
  }

  // Same probe as date-mode (see above).
  const eventLoopProbe = options?.traceId ? startEventLoopLagProbe() : null;
  const [todoResult, completionResult] = await Promise.all([
    fetchTodoCandidatesForRange(normalizedStartDate, normalizedEndDate),
    fetchCompletionCandidatesForRange(normalizedStartDate, normalizedEndDate),
  ]);
  const eventLoopLag = eventLoopProbe?.stop?.() || null;
  const parallelFetchMs = formatMs(nowMs() - startAt - ensureMs);
  const todos = todoResult.todos;
  const completions = completionResult.completions;
  const endAt = nowMs();
  const elapsedMs = formatMs(endAt - startAt);
  const explainPayload = {
    mode: 'range',
    normalizedStartDate,
    normalizedEndDate,
  };
  let explain = null;

  if (CANDIDATE_PERF_LOG_ENABLED) {
    console.log(
      `[common-candidate:perf] mode=range range=${normalizedStartDate}~${normalizedEndDate} ` +
        `total=${elapsedMs}ms ensure=${ensureMs}ms ` +
        `pairFetch=${parallelFetchMs}ms ` +
        `todoQuery=${todoResult.queryMs}ms todoDeserialize=${todoResult.deserializeMs}ms todoRows=${todos.length} ` +
        `completionQuery=${completionResult.queryMs}ms completionDeserialize=${completionResult.deserializeMs}ms completionRows=${completions.length} ` +
        `ensurePhase=${ensureStateBefore?.phase || 'unknown'}->${ensureStateAfter?.phase || 'unknown'} ` +
        `ensurePath=${ensurePath}` +
        (eventLoopLag ? ` eventLoopLag0=${eventLoopLag.lagMs}ms(fired=${eventLoopLag.fired ? 'Y' : 'N'})` : '') +
        `${traceToken}`
    );
  }

  if (options.debugExplain) {
    explain = await collectCandidateExplainPlans(explainPayload);
    logCandidateExplainDetails({ mode: 'range', trigger: 'manual', explain });
  }

  if (elapsedMs >= CANDIDATE_SLOW_THRESHOLD_MS) {
    const repeatPairProbe = await runParallelPairProbe({
      mode: 'range',
      normalizedStartDate,
      normalizedEndDate,
    });
    const slowProbe = await runSlowSequentialProbe({
      mode: 'range',
      normalizedStartDate,
      normalizedEndDate,
    });
    const pingProbe = await runPingProbe();
    const suspect = detectSlowPathSuspect({
      mainPairMs: parallelFetchMs,
      repeatPairMs: repeatPairProbe.pairFetchMs,
      sequentialTotalMs: slowProbe.sequentialTotalMs,
      pingMs: pingProbe.queryMs,
      eventLoopLag0Ms: eventLoopLag?.lagMs ?? null,
    });
    console.log(
      `[common-candidate:slow-probe] mode=range range=${normalizedStartDate}~${normalizedEndDate} ` +
        `mainPair=${parallelFetchMs}ms(mainTodo=${todoResult.queryMs}ms,mainComp=${completionResult.queryMs}ms) ` +
        `repeatPair=${repeatPairProbe.pairFetchMs}ms(repeatTodo=${repeatPairProbe.todoMs}ms,repeatComp=${repeatPairProbe.completionMs}ms) ` +
        `sequentialTotal=${slowProbe.sequentialTotalMs}ms(seqTodo=${slowProbe.todoOnlyMs}ms,seqComp=${slowProbe.completionOnlyMs}ms) ` +
        `timeline(todo=${repeatPairProbe.timeline.todoStartOffsetMs}->${repeatPairProbe.timeline.todoEndOffsetMs}ms,` +
        `comp=${repeatPairProbe.timeline.completionStartOffsetMs}->${repeatPairProbe.timeline.completionEndOffsetMs}ms) ` +
        `ping=${pingProbe.queryMs}ms suspect=${suspect}` +
        ` eventLoopLagRepeat=${formatEventLoopLagForLog(repeatPairProbe.eventLoopLagMs, repeatPairProbe.eventLoopLagFired)}` +
        ` eventLoopLagSeq=${formatEventLoopLagForLog(slowProbe.eventLoopLagMs, slowProbe.eventLoopLagFired)}` +
        ` eventLoopLagPing=${formatEventLoopLagForLog(pingProbe.eventLoopLagMs, pingProbe.eventLoopLagFired)}` +
        (eventLoopLag ? ` eventLoopLag0=${eventLoopLag.lagMs}ms(fired=${eventLoopLag.fired ? 'Y' : 'N'})` : '') +
        `${traceToken}`
    );
    explain = await logCandidateSlowQueryDetails(explainPayload, explain);
  }

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
      elapsedMs,
      ensureMs,
      parallelFetchMs,
      todoQueryMs: todoResult.queryMs,
      todoDeserializeMs: todoResult.deserializeMs,
      completionQueryMs: completionResult.queryMs,
      completionDeserializeMs: completionResult.deserializeMs,
      eventLoopLag0Ms: eventLoopLag?.lagMs ?? null,
      eventLoopLag0Fired: eventLoopLag?.fired ?? null,
      ensurePath,
      ensureStateBefore: simplifyInitStateForLog(ensureStateBefore),
      ensureStateAfter: simplifyInitStateForLog(ensureStateAfter),
      explain: normalizeExplainMetrics(explain),
    },
    error: null,
  };
}
