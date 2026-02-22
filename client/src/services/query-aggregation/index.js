import { queryCandidatesForDate, queryCandidatesForRange } from './candidateQueryService';
import { decideForDate, decideForRange } from './occurrenceDecisionService';
import { aggregateForDate, aggregateForRange } from './aggregationService';

function buildFailureResult(mode, message, meta, stage = {}) {
  return {
    ok: false,
    mode,
    items: [],
    itemsByDate: {},
    meta: meta || { isStale: false, staleReason: null, lastSyncTime: null },
    stage: {
      candidate: stage.candidate || 0,
      decided: stage.decided || 0,
      aggregated: stage.aggregated || 0,
    },
    elapsed: {
      totalMs: stage.totalMs || 0,
      candidateMs: stage.candidateMs || 0,
      decisionMs: stage.decisionMs || 0,
      aggregationMs: stage.aggregationMs || 0,
    },
    error: message,
  };
}

export async function runCommonQueryForDate({ targetDate, syncStatus } = {}) {
  const totalStart = performance.now();

  const candidateResult = await queryCandidatesForDate(targetDate, { syncStatus });
  if (!candidateResult.ok) {
    return buildFailureResult(
      'date',
      candidateResult.error,
      candidateResult.meta,
      { candidateMs: candidateResult.metrics.elapsedMs, totalMs: candidateResult.metrics.elapsedMs }
    );
  }

  const decisionResult = decideForDate(candidateResult, candidateResult.targetDate);
  if (!decisionResult.ok) {
    const totalEnd = performance.now();
    return buildFailureResult('date', decisionResult.error, candidateResult.meta, {
      candidate: candidateResult.metrics.todoCandidates,
      candidateMs: candidateResult.metrics.elapsedMs,
      decisionMs: decisionResult.metrics.elapsedMs,
      totalMs: Number((totalEnd - totalStart).toFixed(2)),
    });
  }

  const aggregationResult = aggregateForDate({
    candidates: candidateResult,
    decision: decisionResult,
    targetDate: candidateResult.targetDate,
  });
  if (!aggregationResult.ok) {
    const totalEnd = performance.now();
    return buildFailureResult('date', aggregationResult.error, candidateResult.meta, {
      candidate: candidateResult.metrics.todoCandidates,
      decided: decisionResult.metrics.decidedCount,
      candidateMs: candidateResult.metrics.elapsedMs,
      decisionMs: decisionResult.metrics.elapsedMs,
      aggregationMs: aggregationResult.metrics.elapsedMs,
      totalMs: Number((totalEnd - totalStart).toFixed(2)),
    });
  }

  const totalEnd = performance.now();
  return {
    ok: true,
    mode: 'date',
    targetDate: candidateResult.targetDate,
    items: aggregationResult.items,
    meta: candidateResult.meta,
    stage: {
      candidate: candidateResult.metrics.todoCandidates,
      decided: decisionResult.metrics.decidedCount,
      aggregated: aggregationResult.metrics.aggregatedCount,
    },
    elapsed: {
      totalMs: Number((totalEnd - totalStart).toFixed(2)),
      candidateMs: candidateResult.metrics.elapsedMs,
      decisionMs: decisionResult.metrics.elapsedMs,
      aggregationMs: aggregationResult.metrics.elapsedMs,
    },
    diagnostics: {
      completionCandidates: candidateResult.metrics.completionCandidates,
      invalidRecurrenceCount: decisionResult.metrics.invalidRecurrenceCount,
    },
    error: null,
  };
}

export async function runCommonQueryForRange({ startDate, endDate, syncStatus } = {}) {
  const totalStart = performance.now();

  const candidateResult = await queryCandidatesForRange(startDate, endDate, { syncStatus });
  if (!candidateResult.ok) {
    return buildFailureResult(
      'range',
      candidateResult.error,
      candidateResult.meta,
      { candidateMs: candidateResult.metrics.elapsedMs, totalMs: candidateResult.metrics.elapsedMs }
    );
  }

  const decisionResult = decideForRange(
    candidateResult,
    candidateResult.range.startDate,
    candidateResult.range.endDate
  );
  if (!decisionResult.ok) {
    const totalEnd = performance.now();
    return buildFailureResult('range', decisionResult.error, candidateResult.meta, {
      candidate: candidateResult.metrics.todoCandidates,
      candidateMs: candidateResult.metrics.elapsedMs,
      decisionMs: decisionResult.metrics.elapsedMs,
      totalMs: Number((totalEnd - totalStart).toFixed(2)),
    });
  }

  const aggregationResult = aggregateForRange({
    candidates: candidateResult,
    decision: decisionResult,
    range: candidateResult.range,
  });
  if (!aggregationResult.ok) {
    const totalEnd = performance.now();
    return buildFailureResult('range', aggregationResult.error, candidateResult.meta, {
      candidate: candidateResult.metrics.todoCandidates,
      decided: decisionResult.metrics.decidedCount,
      candidateMs: candidateResult.metrics.elapsedMs,
      decisionMs: decisionResult.metrics.elapsedMs,
      aggregationMs: aggregationResult.metrics.elapsedMs,
      totalMs: Number((totalEnd - totalStart).toFixed(2)),
    });
  }

  const totalEnd = performance.now();
  return {
    ok: true,
    mode: 'range',
    range: candidateResult.range,
    itemsByDate: aggregationResult.itemsByDate,
    meta: candidateResult.meta,
    stage: {
      candidate: candidateResult.metrics.todoCandidates,
      decided: decisionResult.metrics.decidedCount,
      aggregated: aggregationResult.metrics.aggregatedCount,
    },
    elapsed: {
      totalMs: Number((totalEnd - totalStart).toFixed(2)),
      candidateMs: candidateResult.metrics.elapsedMs,
      decisionMs: decisionResult.metrics.elapsedMs,
      aggregationMs: aggregationResult.metrics.elapsedMs,
    },
    diagnostics: {
      completionCandidates: candidateResult.metrics.completionCandidates,
      invalidRecurrenceCount: decisionResult.metrics.invalidRecurrenceCount,
    },
    error: null,
  };
}

