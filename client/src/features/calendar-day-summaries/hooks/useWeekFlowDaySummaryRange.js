import { useEffect, useMemo, useRef } from 'react';
import dayjs from 'dayjs';

import { mergeRanges } from '../../../services/query-aggregation/cache/rangeMerge';

import {
  DEFAULT_MAX_DOTS,
  RETENTION_MONTHS_AFTER,
  RETENTION_MONTHS_BEFORE,
} from '../utils/calendarDaySummaryConstants';
import { useCalendarDaySummaryStore } from '../store/calendarDaySummaryStore';
import {
  ensureDaySummariesLoaded,
  pruneSummaryRetentionWindow,
} from '../services/calendarDaySummaryDataAdapter';

function computeRetentionWindow(anchorDate) {
  const anchor = dayjs(anchorDate);
  if (!anchor.isValid()) return null;

  const startDate = anchor
    .startOf('month')
    .subtract(RETENTION_MONTHS_BEFORE, 'month')
    .format('YYYY-MM-DD');

  const endDate = anchor
    .startOf('month')
    .add(RETENTION_MONTHS_AFTER, 'month')
    .endOf('month')
    .format('YYYY-MM-DD');

  return {
    startDate,
    endDate,
    anchorMonthId: anchor.format('YYYY-MM'),
  };
}

function rangesOverlap(leftRange, rightRange) {
  return !(
    leftRange.endDate < rightRange.startDate ||
    leftRange.startDate > rightRange.endDate
  );
}

function mergeOverlaps(overlaps = []) {
  if (!Array.isArray(overlaps) || overlaps.length === 0) return [];
  return mergeRanges(overlaps);
}

function emitDebugEvent(onDebugEvent, event) {
  if (typeof onDebugEvent !== 'function' || !event?.type) return;
  onDebugEvent({
    at: new Date().toISOString(),
    ...event,
  });
}

export function useWeekFlowDaySummaryRange({
  mode,
  activeRange,
  retentionAnchorDate,
  viewportSettledToken,
  getIsViewportSettled,
  maxDots = DEFAULT_MAX_DOTS,
  onDebugEvent,
} = {}) {
  const dirtySeq = useCalendarDaySummaryStore((state) => state.dirtySeq);
  const reensureSeq = useCalendarDaySummaryStore((state) => state.reensureSeq);

  const refreshDirtyInFlightRef = useRef(false);
  const lastRetentionMonthRef = useRef(null);

  const active = useMemo(() => {
    if (!activeRange?.startDate || !activeRange?.endDate) return null;
    return { startDate: activeRange.startDate, endDate: activeRange.endDate };
  }, [activeRange?.endDate, activeRange?.startDate]);

  useEffect(() => {
    if (!retentionAnchorDate) return;
    if (typeof getIsViewportSettled === 'function' && !getIsViewportSettled()) return;

    const window = computeRetentionWindow(retentionAnchorDate);
    if (!window) return;
    if (lastRetentionMonthRef.current === window.anchorMonthId) return;
    lastRetentionMonthRef.current = window.anchorMonthId;

    emitDebugEvent(onDebugEvent, {
      type: 'retention',
      status: 'start',
      anchorMonthId: window.anchorMonthId,
      range: { startDate: window.startDate, endDate: window.endDate },
      mode,
    });

    pruneSummaryRetentionWindow({
      startDate: window.startDate,
      endDate: window.endDate,
      reason: `day-summaries:retention:${mode || 'unknown'}:${window.anchorMonthId}`,
    });

    emitDebugEvent(onDebugEvent, {
      type: 'retention',
      status: 'done',
      anchorMonthId: window.anchorMonthId,
      range: { startDate: window.startDate, endDate: window.endDate },
      mode,
    });
  }, [getIsViewportSettled, mode, onDebugEvent, retentionAnchorDate, viewportSettledToken]);

  useEffect(() => {
    if (!active) return;
    if (typeof getIsViewportSettled === 'function' && !getIsViewportSettled()) return;

    let cancelled = false;

    emitDebugEvent(onDebugEvent, {
      type: 'active-ensure',
      status: 'start',
      mode,
      range: active,
      reason: `${mode || 'unknown'}:settled`,
    });

    ensureDaySummariesLoaded({
      startDate: active.startDate,
      endDate: active.endDate,
      reason: `${mode || 'unknown'}:settled`,
      maxDots,
    })
      .then((result) => {
        if (cancelled) return;
        emitDebugEvent(onDebugEvent, {
          type: 'active-ensure',
          status: 'done',
          mode,
          range: active,
          reason: result?.reason || `${mode || 'unknown'}:settled`,
          cacheHit: result?.cacheHit === true,
        });
      })
      .catch((error) => {
        if (!cancelled) {
          emitDebugEvent(onDebugEvent, {
            type: 'active-ensure',
            status: 'error',
            mode,
            range: active,
            reason: `${mode || 'unknown'}:settled`,
            error: error?.message || String(error),
          });
        }
        console.warn('[day-summaries] ensureDaySummariesLoaded failed:', error?.message || error);
      });

    return () => {
      cancelled = true;
    };
  }, [
    active?.endDate,
    active?.startDate,
    getIsViewportSettled,
    maxDots,
    mode,
    onDebugEvent,
    reensureSeq,
    viewportSettledToken,
  ]);

  useEffect(() => {
    if (!active) return;
    if (refreshDirtyInFlightRef.current) return;
    if (typeof getIsViewportSettled === 'function' && !getIsViewportSettled()) return;

    const initialDirty = useCalendarDaySummaryStore.getState().dirtyRanges;
    if (!Array.isArray(initialDirty) || initialDirty.length === 0) return;

    refreshDirtyInFlightRef.current = true;
    (async () => {
      emitDebugEvent(onDebugEvent, {
        type: 'dirty-refresh',
        status: 'start',
        mode,
        range: active,
      });

      while (true) {
        const snapshot = useCalendarDaySummaryStore.getState();
        const currentDirty = snapshot.dirtyRanges || [];
        const seqBefore = snapshot.dirtySeq;

        if (!Array.isArray(currentDirty) || currentDirty.length === 0) {
          emitDebugEvent(onDebugEvent, {
            type: 'dirty-refresh',
            status: 'done',
            mode,
            range: active,
            refreshedRanges: [],
          });
          return;
        }

        const overlaps = [];
        for (const dirty of currentDirty) {
          if (!dirty?.startDate || !dirty?.endDate) continue;
          if (!rangesOverlap(dirty, active)) continue;

          const overlapStart = dirty.startDate > active.startDate ? dirty.startDate : active.startDate;
          const overlapEnd = dirty.endDate < active.endDate ? dirty.endDate : active.endDate;
          if (overlapStart <= overlapEnd) {
            overlaps.push({ startDate: overlapStart, endDate: overlapEnd });
          }
        }

        const merged = mergeOverlaps(overlaps);
        if (merged.length === 0) {
          emitDebugEvent(onDebugEvent, {
            type: 'dirty-refresh',
            status: 'done',
            mode,
            range: active,
            refreshedRanges: [],
          });
          return;
        }

        for (const range of merged) {
          await ensureDaySummariesLoaded({
            startDate: range.startDate,
            endDate: range.endDate,
            reason: `${mode || 'unknown'}:dirty-refresh`,
            maxDots,
          });
        }

        const seqAfter = useCalendarDaySummaryStore.getState().dirtySeq;
        if (seqAfter !== seqBefore) {
          // New invalidation happened during refresh; retry from the latest dirty ranges.
          continue;
        }

        // Remove only the part we refreshed; keep other dirty ranges for later scroll.
        useCalendarDaySummaryStore.getState().consumeDirtyRanges(merged);
        emitDebugEvent(onDebugEvent, {
          type: 'dirty-refresh',
          status: 'done',
          mode,
          range: active,
          refreshedRanges: merged,
        });
        return;
      }
    })()
      .catch((error) => {
        emitDebugEvent(onDebugEvent, {
          type: 'dirty-refresh',
          status: 'error',
          mode,
          range: active,
          error: error?.message || String(error),
        });
        console.warn('[day-summaries] dirty refresh failed:', error?.message || error);
      })
      .finally(() => {
        refreshDirtyInFlightRef.current = false;
      });
  }, [
    active?.endDate,
    active?.startDate,
    dirtySeq,
    getIsViewportSettled,
    maxDots,
    mode,
    onDebugEvent,
    viewportSettledToken,
  ]);
}
