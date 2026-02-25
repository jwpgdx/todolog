import { useEffect, useMemo, useRef } from 'react';
import dayjs from 'dayjs';
import { ensureRangeLoaded, inspectRangeState } from '../services/stripCalendarDataAdapter';
import { useStripCalendarStore } from '../store/stripCalendarStore';
import { addDays } from '../utils/stripCalendarDateUtils';
import { logStripCalendar } from '../utils/stripCalendarDebug';
import { STRIP_CALENDAR_PERF_LOG_ENABLED } from '../utils/stripCalendarConstants';
import { pruneRangeCacheOutsideDateRange } from '../../../services/query-aggregation/cache';

// 화면어댑터 경로 전환 완료: strip summary 활성화
const ENABLE_STRIP_CALENDAR_SUMMARY = true;
const RETENTION_MONTHS_BEFORE = 6;
const RETENTION_MONTHS_AFTER = 6;

function nowPerfMs() {
  if (typeof globalThis?.performance?.now === 'function') {
    return globalThis.performance.now();
  }
  return Date.now();
}

function formatMs(value) {
  return Number((value || 0).toFixed(2));
}

function createStripEnsureTraceId(mode) {
  const prefix = mode === 'monthly' ? 'scm' : 'scw';
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getWeeklyRange(weekStart) {
  return {
    startDate: addDays(weekStart, -14),
    endDate: addDays(weekStart, 20),
  };
}

function getMonthlyRange(topWeekStart, policy = 'three_month') {
  if (policy === 'legacy_9week') {
    return {
      startDate: addDays(topWeekStart, -14),
      endDate: addDays(topWeekStart, 48),
    };
  }

  const monthAnchor = dayjs(topWeekStart);
  return {
    startDate: monthAnchor.startOf('month').subtract(1, 'month').format('YYYY-MM-DD'),
    endDate: monthAnchor.endOf('month').add(1, 'month').format('YYYY-MM-DD'),
  };
}

function computeRetentionWindow(anchorDate) {
  const anchor = dayjs(anchorDate);
  if (!anchor.isValid()) return null;

  return {
    startDate: anchor
      .startOf('month')
      .subtract(RETENTION_MONTHS_BEFORE, 'month')
      .format('YYYY-MM-DD'),
    endDate: anchor
      .startOf('month')
      .add(RETENTION_MONTHS_AFTER, 'month')
      .endOf('month')
      .format('YYYY-MM-DD'),
    anchorMonthId: anchor.format('YYYY-MM'),
  };
}

function isSameRange(leftRange, rightRange) {
  return (
    leftRange?.startDate === rightRange?.startDate &&
    leftRange?.endDate === rightRange?.endDate
  );
}

export function useStripCalendarDataRange({
  mode,
  weeklyVisibleWeekStart,
  monthlyTopWeekStart,
  weeklyTargetWeekStart,
  monthlyTargetWeekStart,
}) {
  const monthlyRangePolicy = useStripCalendarStore((state) => state.monthlyRangePolicy);
  const lastRetentionMonthRef = useRef(null);

  const activeRange = useMemo(() => {
    if (mode === 'weekly' && weeklyVisibleWeekStart) {
      return getWeeklyRange(weeklyVisibleWeekStart);
    }

    if (mode === 'monthly' && monthlyTopWeekStart) {
      return getMonthlyRange(monthlyTopWeekStart, monthlyRangePolicy);
    }

    return null;
  }, [mode, monthlyRangePolicy, weeklyVisibleWeekStart, monthlyTopWeekStart]);

  const prefetchRange = useMemo(() => {
    if (mode === 'weekly') {
      const prefetchAnchor = weeklyTargetWeekStart || weeklyVisibleWeekStart;
      return prefetchAnchor ? getWeeklyRange(prefetchAnchor) : null;
    }

    if (mode === 'monthly') {
      const prefetchAnchor = monthlyTargetWeekStart || monthlyTopWeekStart;
      return prefetchAnchor ? getMonthlyRange(prefetchAnchor, monthlyRangePolicy) : null;
    }

    return null;
  }, [
    mode,
    monthlyRangePolicy,
    monthlyTargetWeekStart,
    monthlyTopWeekStart,
    weeklyTargetWeekStart,
    weeklyVisibleWeekStart,
  ]);

  // Option A retention: keep only around the currently viewed month (±6 months).
  // This prevents cache growth when users scroll across years.
  // Gate by month-id to avoid expensive pruning on every weekly settle.
  useEffect(() => {
    const anchorDate = mode === 'monthly' ? monthlyTopWeekStart : weeklyVisibleWeekStart;
    if (!anchorDate) return;

    const window = computeRetentionWindow(anchorDate);
    if (!window) return;
    if (lastRetentionMonthRef.current === window.anchorMonthId) return;
    lastRetentionMonthRef.current = window.anchorMonthId;

    useStripCalendarStore.getState().pruneToDateRange(window.startDate, window.endDate);
    pruneRangeCacheOutsideDateRange({
      startDate: window.startDate,
      endDate: window.endDate,
      reason: `strip-calendar:retention:${mode}:${window.anchorMonthId}`,
    });
  }, [mode, monthlyTopWeekStart, weeklyVisibleWeekStart]);

  useEffect(() => {
    if (!activeRange) return;
    logStripCalendar('useStripCalendarDataRange', 'range:activeChanged', {
      mode,
      monthlyRangePolicy,
      startDate: activeRange.startDate,
      endDate: activeRange.endDate,
      summaryEnabled: ENABLE_STRIP_CALENDAR_SUMMARY,
    });
  }, [activeRange, mode, monthlyRangePolicy]);

  useEffect(() => {
    if (!prefetchRange) return;
    if (!ENABLE_STRIP_CALENDAR_SUMMARY) return;
    if (isSameRange(prefetchRange, activeRange)) return;

    logStripCalendar('useStripCalendarDataRange', 'range:prefetch:start', {
      mode,
      monthlyRangePolicy,
      startDate: prefetchRange.startDate,
      endDate: prefetchRange.endDate,
    });

    ensureRangeLoaded({
      startDate: prefetchRange.startDate,
      endDate: prefetchRange.endDate,
      reason: `${mode}:prefetch`,
    })
      .then((result) => {
        logStripCalendar('useStripCalendarDataRange', 'range:prefetch:done', {
          mode,
          monthlyRangePolicy,
          startDate: prefetchRange.startDate,
          endDate: prefetchRange.endDate,
          cacheHit: result?.cacheHit ?? false,
          elapsedMs: result?.elapsedMs ?? 0,
          source: result?.cacheInfo?.sourceTag || 'unknown',
          traceId: result?.traceId || null,
        });
      })
      .catch((error) => {
        console.warn('[strip-calendar] prefetch ensureRangeLoaded failed:', error?.message || error);
      });
  }, [activeRange, mode, monthlyRangePolicy, prefetchRange]);

  useEffect(() => {
    if (!activeRange) return;
    if (!ENABLE_STRIP_CALENDAR_SUMMARY) return;

    logStripCalendar('useStripCalendarDataRange', 'range:ensureLoaded:start', {
      mode,
      monthlyRangePolicy,
      startDate: activeRange.startDate,
      endDate: activeRange.endDate,
    });

    const traceId = createStripEnsureTraceId(mode);
    if (STRIP_CALENDAR_PERF_LOG_ENABLED) {
      console.log(
        `[strip-calendar:timeline] ensure request mode=${mode} ` +
          `range=${activeRange.startDate}~${activeRange.endDate} trace=${traceId} t=${formatMs(nowPerfMs())}ms`
      );
    }

    ensureRangeLoaded({
      startDate: activeRange.startDate,
      endDate: activeRange.endDate,
      reason: `${mode}:settled`,
      traceId,
    })
      .then((result) => {
        const snapshot = inspectRangeState({
          startDate: activeRange.startDate,
          endDate: activeRange.endDate,
        });

        if (STRIP_CALENDAR_PERF_LOG_ENABLED) {
          console.log(
            `[strip-calendar:state] reason=${mode}:settled ` +
              `range=${activeRange.startDate}~${activeRange.endDate} ` +
              `cacheHit=${result?.cacheHit ? 'Y' : 'N'} covered=${snapshot.covered ? 'Y' : 'N'} ` +
              `loadedRanges=${snapshot.loadedRangesCount} storedDays=${snapshot.storedDayCount} ` +
              `todoDays=${snapshot.storedHasTodoDays} dotDays=${snapshot.storedDotDays} dotTotal=${snapshot.storedDotTotal} ` +
              `trace=${result?.traceId || 'none'}`
          );
        }

        logStripCalendar('useStripCalendarDataRange', 'range:ensureLoaded:done', {
          mode,
          monthlyRangePolicy,
          startDate: activeRange.startDate,
          endDate: activeRange.endDate,
          cacheHit: result?.cacheHit ?? false,
          elapsedMs: result?.elapsedMs ?? 0,
          source: result?.cacheInfo?.sourceTag || 'unknown',
          traceId: result?.traceId || null,
        });
      })
      .catch((error) => {
        console.warn('[strip-calendar] ensureRangeLoaded failed:', error?.message || error);
      });
  }, [activeRange, mode, monthlyRangePolicy]);

  useEffect(() => {
    if (!prefetchRange) return;

    logStripCalendar('useStripCalendarDataRange', 'range:prefetch:candidate', {
      mode,
      startDate: prefetchRange.startDate,
      endDate: prefetchRange.endDate,
      weeklyTargetWeekStart,
      monthlyTargetWeekStart,
    });
  }, [mode, monthlyTargetWeekStart, prefetchRange, weeklyTargetWeekStart]);

  useEffect(() => {
    if (!activeRange) return;

    logStripCalendar('useStripCalendarDataRange', 'range:settled:active', {
      mode,
      startDate: activeRange.startDate,
      endDate: activeRange.endDate,
      weeklyVisibleWeekStart,
      monthlyTopWeekStart,
    });
  }, [activeRange, mode, monthlyTopWeekStart, weeklyVisibleWeekStart]);

  return {
    activeRange,
  };
}
