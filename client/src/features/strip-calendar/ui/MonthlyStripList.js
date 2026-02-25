import React, { Profiler, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import WeekRow from './WeekRow';
import { getWeekDates } from '../utils/stripCalendarDateUtils';
import {
  DEBUG_STRIP_CALENDAR,
  MONTHLY_DRIFT_CORRECTION_THRESHOLD_PX,
  MONTHLY_IDLE_SETTLE_DELAY_MS,
  STRIP_CALENDAR_PERF_LOG_ENABLED,
  MONTHLY_PROGRAMMATIC_GUARD_MS,
  MONTHLY_PROGRAMMATIC_SETTLE_DELAY_MS,
  MONTHLY_VISIBLE_WEEK_COUNT,
  WEEK_ROW_HEIGHT,
} from '../utils/stripCalendarConstants';
import { logStripCalendar } from '../utils/stripCalendarDebug';

function nowPerfMs() {
  if (typeof globalThis?.performance?.now === 'function') {
    return globalThis.performance.now();
  }
  return Date.now();
}

function formatMs(value) {
  return Number((value || 0).toFixed(2));
}

const REACT_PROFILER_THRESHOLD_MS = 8;
const WEEK_ROW_PROFILER_THRESHOLD_MS = 4;

// Keep referentially stable to avoid treating it as a prop change on every render.
// Note: `overrideProps` are spread onto the internal ScrollView in FlashList v2.
// Without a ScrollView style, web can end up with a 1-row viewport until user scroll triggers relayout.
const MONTHLY_OVERRIDE_PROPS = {
  initialDrawBatchSize: MONTHLY_VISIBLE_WEEK_COUNT,
  style: { flex: 1 },
};

function shouldLogReactProfiler(actualDuration) {
  if (!STRIP_CALENDAR_PERF_LOG_ENABLED) return false;
  if (typeof __DEV__ === 'boolean' && !__DEV__) return false;
  return actualDuration >= REACT_PROFILER_THRESHOLD_MS;
}

function shouldLogWeekRowProfiler(actualDuration) {
  if (!STRIP_CALENDAR_PERF_LOG_ENABLED) return false;
  if (typeof __DEV__ === 'boolean' && !__DEV__) return false;
  return actualDuration >= WEEK_ROW_PROFILER_THRESHOLD_MS;
}

function createMonthlyUiPerfId() {
  return `msc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function supportsLongTaskObserver() {
  if (typeof globalThis?.PerformanceObserver !== 'function') return false;
  if (typeof globalThis?.PerformanceObserver?.supportedEntryTypes === 'undefined') return false;
  return globalThis.PerformanceObserver.supportedEntryTypes.includes('longtask');
}

/**
 * Scroll phase state machine:
 *   idle → dragging → momentum → settling → idle       (native)
 *   idle → dragging → settling → idle                   (web, momentum absent)
 *   idle → programmatic → settling → idle               (programmatic scroll)
 *
 * Phase 'settling' provides mutual exclusion:
 * all settle entry points are routed through requestSettle(),
 * which rejects concurrent requests while phase === 'settling'.
 */
function createInitialScrollState() {
  return {
    phase: 'idle',             // 'idle' | 'dragging' | 'momentum' | 'settling' | 'programmatic'
    lastOffset: 0,
    lastEmittedWeekStart: null,
    lastSyncedTarget: null,
    lastSyncedWindowKey: null,
    isProgrammatic: false,
    settleTimer: null,
    programmaticGuardTimer: null,
  };
}

export default function MonthlyStripList({
  weekStarts,
  targetTopWeekStart,
  todayDate,
  currentDate,
  language,
  onDayPress,
  onTopWeekSettled,
  scrollAnimated = false,
}) {
  const reactProfilerEnabled =
    STRIP_CALENDAR_PERF_LOG_ENABLED && (typeof __DEV__ === 'boolean' ? __DEV__ : true);

  const listRef = useRef(null);
  const scrollStateRef = useRef(createInitialScrollState());
  const hasInitializedSyncRef = useRef(false);
  const [isInitialAligned, setIsInitialAligned] = useState(false);
  const [layoutNudgeEnabled, setLayoutNudgeEnabled] = useState(false);
  const uiPerfIdRef = useRef(createMonthlyUiPerfId());
  const mountSnapshotRef = useRef(null);
  const viewportLayoutRef = useRef({ width: null, height: null });
  const scrollViewLayoutRef = useRef({ width: null, height: null });
  const scrollViewContentSizeRef = useRef({ width: null, height: null });
  const renderStatsRef = useRef({
    startedAtMs: nowPerfMs(),
    renderCalls: 0,
    minIndex: null,
    maxIndex: null,
    cellMinIndex: null,
    cellMaxIndex: null,
    targets: { Cell: 0, Measurement: 0, StickyHeader: 0 },
    weekDatesTotalMs: 0,
    weekDatesSlowCalls: 0,
  });
  const renderStatsLoggedRef = useRef(false);
  const firstCellLoggedRef = useRef(false);
  const viewabilityLogCountRef = useRef(0);
  const viewabilityConfigRef = useRef({ itemVisiblePercentThreshold: 60 });
  const internalsDumpTimersRef = useRef([]);
  const internalsDumpCountRef = useRef(0);
  const lastInternalsDumpKeyRef = useRef({ viewport: null, scrollView: null });
  const layoutNormalizeRef = useRef({
    key: null,
    attempts: 0,
    inFlight: false,
    clearTimer: null,
  });

  const weekIndexMap = useMemo(() => {
    const t0 = STRIP_CALENDAR_PERF_LOG_ENABLED ? nowPerfMs() : 0;
    const map = new Map();
    weekStarts.forEach((weekStart, index) => map.set(weekStart, index));
    if (STRIP_CALENDAR_PERF_LOG_ENABLED) {
      const t1 = nowPerfMs();
      console.log(
        `[strip-calendar:ui-perf] monthly weekIndexMap weeks=${weekStarts.length} ` +
          `ms=${formatMs(t1 - t0)} t=${formatMs(t1)}ms`
      );
    }
    return map;
  }, [weekStarts]);

  const weekWindowKey = useMemo(() => {
    if (!weekStarts.length) return 'empty';
    return `${weekStarts[0]}|${weekStarts[weekStarts.length - 1]}`;
  }, [weekStarts]);

  const weekDaysCacheRef = useRef({
    key: null,
    map: new Map(),
  });
  const weekDaysCacheKey = `${todayDate || 'null'}|${currentDate || 'null'}|${language || 'null'}`;
  if (weekDaysCacheRef.current.key !== weekDaysCacheKey) {
    weekDaysCacheRef.current.key = weekDaysCacheKey;
    weekDaysCacheRef.current.map.clear();
  }

  const getWeekDaysCached = useCallback(
    (weekStart) => {
      const cache = weekDaysCacheRef.current.map;
      const cached = cache.get(weekStart);
      if (cached) return cached;
      const computed = getWeekDates(weekStart, todayDate, currentDate, language);
      cache.set(weekStart, computed);
      return computed;
    },
    [currentDate, language, todayDate]
  );

  const onMonthlyListProfile = useCallback((id, phase, actualDuration, baseDuration, startTime, commitTime) => {
    if (!reactProfilerEnabled) return;
    if (phase !== 'mount' && !shouldLogReactProfiler(actualDuration)) return;
    console.log(
      `[strip-calendar:react-profiler] id=${id} phase=${phase} ` +
        `actual=${formatMs(actualDuration)}ms base=${formatMs(baseDuration)}ms ` +
        `start=${formatMs(startTime)}ms commit=${formatMs(commitTime)}ms t=${formatMs(nowPerfMs())}ms`
    );
  }, [reactProfilerEnabled]);

  const onWeekRowProfile = useCallback((id, phase, actualDuration, baseDuration, startTime, commitTime) => {
    if (!shouldLogWeekRowProfiler(actualDuration)) return;
    console.log(
      `[strip-calendar:react-profiler] id=${id} phase=${phase} ` +
        `actual=${formatMs(actualDuration)}ms base=${formatMs(baseDuration)}ms ` +
        `start=${formatMs(startTime)}ms commit=${formatMs(commitTime)}ms t=${formatMs(nowPerfMs())}ms`
    );
  }, []);

  if (mountSnapshotRef.current == null) {
    mountSnapshotRef.current = {
      targetTopWeekStart,
      targetIndex: targetTopWeekStart ? weekIndexMap.get(targetTopWeekStart) : null,
      weekStartsLength: weekStarts.length,
    };
  }

  const targetIndex = targetTopWeekStart ? weekIndexMap.get(targetTopWeekStart) : null;

  const maybeNormalizeMonthlyLayout = useCallback(
    (reason) => {
      const ref = listRef.current;
      if (!ref) return;
      if (!weekStarts.length) return;

      const ti = targetIndex ?? 0;
      if (ti < 0 || ti >= weekStarts.length) return;

      const phase = scrollStateRef.current?.phase || 'unknown';
      if (phase === 'dragging' || phase === 'momentum') return;

      const normalizeKey = `${weekWindowKey}|${ti}`;
      const normalizeState = layoutNormalizeRef.current;
      if (normalizeState.key !== normalizeKey) {
        normalizeState.key = normalizeKey;
        normalizeState.attempts = 0;
        normalizeState.inFlight = false;
      }
      if (normalizeState.inFlight) return;
      if (normalizeState.attempts >= 2) return;

      let childH = null;
      let windowH = null;
      let visible = null;
      let layout0 = null;
      let layout1 = null;

      try {
        childH = ref.getChildContainerDimensions()?.height ?? null;
      } catch {
        childH = null;
      }
      try {
        windowH = ref.getWindowSize()?.height ?? null;
      } catch {
        windowH = null;
      }
      try {
        visible = ref.computeVisibleIndices();
      } catch {
        visible = null;
      }
      try {
        layout0 = ref.getLayout(ti);
      } catch {
        layout0 = null;
      }
      try {
        layout1 = ti + 1 < weekStarts.length ? ref.getLayout(ti + 1) : null;
      } catch {
        layout1 = null;
      }

      // Wait for at least the target cell to have a measured height before taking action.
      if (!layout0?.isHeightMeasured) return;

      const expectedViewportH = WEEK_ROW_HEIGHT * MONTHLY_VISIBLE_WEEK_COUNT;
      const expectedContentH = weekStarts.length * WEEK_ROW_HEIGHT;

      const visibleCount =
        visible && typeof visible === 'object' && typeof visible.startIndex === 'number' && typeof visible.endIndex === 'number'
          ? Math.max(0, visible.endIndex - visible.startIndex + 1)
          : null;

      const gapY =
        layout0 && layout1 && typeof layout0.y === 'number' && typeof layout1.y === 'number'
          ? layout1.y - layout0.y
          : null;

      const looksLikeEstimated200 =
        typeof childH === 'number' &&
        expectedContentH > 0 &&
        childH > expectedContentH * 1.5;

      const looksLikeDiscontinuousY =
        typeof gapY === 'number' && gapY > WEEK_ROW_HEIGHT * 8;

      const looksLikeOnlyOneVisibleRow =
        typeof visibleCount === 'number' &&
        typeof windowH === 'number' &&
        windowH >= expectedViewportH - 1 &&
        visibleCount < Math.min(MONTHLY_VISIBLE_WEEK_COUNT, weekStarts.length);

      if (!looksLikeEstimated200 && !looksLikeDiscontinuousY && !looksLikeOnlyOneVisibleRow) {
        return;
      }

      normalizeState.inFlight = true;
      normalizeState.attempts += 1;

      // Nudge the available width by 1px to force RVLinearLayoutManager.updateLayoutParams()
      // to run recomputeLayouts(0..end), which removes y-discontinuities left by initialScrollIndex adjustment.
      setLayoutNudgeEnabled(true);
      if (normalizeState.clearTimer) {
        clearTimeout(normalizeState.clearTimer);
      }
      normalizeState.clearTimer = setTimeout(() => {
        setLayoutNudgeEnabled(false);
        layoutNormalizeRef.current.inFlight = false;
        layoutNormalizeRef.current.clearTimer = null;
      }, 50);

      // eslint-disable-next-line no-unused-vars
      void reason;
    },
    [targetIndex, weekStarts.length, weekWindowKey]
  );

  const dumpMonthlyFlashListInternals = useCallback(
    (reason) => {
      if (!STRIP_CALENDAR_PERF_LOG_ENABLED) return;
      if (internalsDumpCountRef.current >= 12) return;
      internalsDumpCountRef.current += 1;

      const t = formatMs(nowPerfMs());
      const ref = listRef.current;

      const safe = (fn) => {
        try {
          return fn();
        } catch (e) {
          return `err:${e?.message || String(e)}`;
        }
      };

      if (!ref) {
        console.log(
          `[strip-calendar:ui-perf] monthly flashlist internals#${internalsDumpCountRef.current} ` +
            `reason=${reason} ref=null t=${t}ms`
        );
        return;
      }

      const windowSize = safe(() => ref.getWindowSize());
      const childDims = safe(() => ref.getChildContainerDimensions());
      const absOffset = safe(() => ref.getAbsoluteLastScrollOffset());
      const visible = safe(() => ref.computeVisibleIndices());
      const firstVisible = safe(() => ref.getFirstVisibleIndex());

      const ti = targetIndex ?? 0;
      const start = Math.max(0, ti - 2);
      const end = Math.min(weekStarts.length - 1, ti + 6);
      const layouts = [];
      for (let i = start; i <= end; i += 1) {
        const layout = safe(() => ref.getLayout(i));
        if (!layout || typeof layout !== 'object') {
          layouts.push({ i, layout });
          continue;
        }
        layouts.push({
          i,
          y: Math.round(layout.y || 0),
          h: Math.round(layout.height || 0),
          mh: Boolean(layout.isHeightMeasured),
          mw: Boolean(layout.isWidthMeasured),
        });
      }

      const visibleRange =
        visible && typeof visible === 'object' && 'startIndex' in visible
          ? `${visible.startIndex}..${visible.endIndex}`
          : String(visible);

      console.log(
        `[strip-calendar:ui-perf] monthly flashlist internals#${internalsDumpCountRef.current} ` +
          `reason=${reason} ` +
          `targetIndex=${targetIndex == null ? 'null' : targetIndex} ` +
          `viewportH=${viewportLayoutRef.current?.height ?? 'n/a'} ` +
          `scrollViewH=${scrollViewLayoutRef.current?.height ?? 'n/a'} ` +
          `contentH=${scrollViewContentSizeRef.current?.height ?? 'n/a'} ` +
          `windowH=${windowSize?.height ?? windowSize} ` +
          `childH=${childDims?.height ?? childDims} ` +
          `absOffset=${absOffset} ` +
          `firstVisible=${firstVisible} ` +
          `visible=${visibleRange} ` +
          `t=${t}ms`
      );
      console.log(
        `[strip-calendar:ui-perf] monthly flashlist layouts reason=${reason} ` +
          `sample=${JSON.stringify(layouts)} t=${t}ms`
      );
    },
    [targetIndex, weekStarts.length]
  );

  const scheduleMonthlyFlashListInternalsDump = useCallback(
    (reason) => {
      if (!STRIP_CALENDAR_PERF_LOG_ENABLED) return;
      const delays = [0, 200, 1000];
      delays.forEach((delay) => {
        const id = setTimeout(() => {
          dumpMonthlyFlashListInternals(`${reason}+${delay}`);
        }, delay);
        internalsDumpTimersRef.current.push(id);
      });
    },
    [dumpMonthlyFlashListInternals]
  );

  const renderItem = useCallback(
    ({ item, index, target }) => {
      let weekDays;
      if (STRIP_CALENDAR_PERF_LOG_ENABLED) {
        const t0 = nowPerfMs();
        weekDays = getWeekDaysCached(item);
        const dt = formatMs(nowPerfMs() - t0);
        const stats = renderStatsRef.current;
        stats.renderCalls += 1;
        stats.weekDatesTotalMs += dt;
        if (dt >= 4) stats.weekDatesSlowCalls += 1;
        stats.targets[target] = (stats.targets[target] ?? 0) + 1;
        stats.minIndex = stats.minIndex == null ? index : Math.min(stats.minIndex, index);
        stats.maxIndex = stats.maxIndex == null ? index : Math.max(stats.maxIndex, index);
        if (target === 'Cell') {
          stats.cellMinIndex = stats.cellMinIndex == null ? index : Math.min(stats.cellMinIndex, index);
          stats.cellMaxIndex = stats.cellMaxIndex == null ? index : Math.max(stats.cellMaxIndex, index);
          if (!firstCellLoggedRef.current) {
            firstCellLoggedRef.current = true;
            console.log(
              `[strip-calendar:ui-perf] monthly firstCell index=${index} weekStart=${item} ` +
                `targetIndex=${targetIndex == null ? 'null' : targetIndex} ` +
                `viewportH=${viewportLayoutRef.current?.height ?? 'n/a'} t=${formatMs(nowPerfMs())}ms`
            );
          }
        }
      } else {
        weekDays = getWeekDaysCached(item);
      }
      return (
        <View style={styles.rowContainer}>
          {reactProfilerEnabled ? (
            <Profiler id={`MonthlyWeekRow:${item}`} onRender={onWeekRowProfile}>
              <WeekRow
                weekStart={item}
                weekDays={weekDays}
                onDayPress={onDayPress}
              />
            </Profiler>
          ) : (
            <WeekRow
              weekStart={item}
              weekDays={weekDays}
              onDayPress={onDayPress}
            />
          )}
        </View>
      );
    },
    [getWeekDaysCached, onDayPress, onWeekRowProfile, reactProfilerEnabled]
  );

  const onMonthlyScrollViewLayout = useCallback(
    (event) => {
      if (!STRIP_CALENDAR_PERF_LOG_ENABLED) return;
      const width = Math.round(event.nativeEvent.layout.width || 0);
      const height = Math.round(event.nativeEvent.layout.height || 0);
        const prev = scrollViewLayoutRef.current;
        if (prev.width === width && prev.height === height) return;
        scrollViewLayoutRef.current = { width, height };
        const key = `${width}x${height}`;
        if (lastInternalsDumpKeyRef.current.scrollView !== key) {
          lastInternalsDumpKeyRef.current.scrollView = key;
          scheduleMonthlyFlashListInternalsDump('scrollViewLayout');
        }
        console.log(
          `[strip-calendar:ui-perf] monthly scrollView layout ` +
            `w=${width} h=${height} ` +
            `aligned=${isInitialAligned ? 'Y' : 'N'} ` +
            `targetIndex=${targetIndex == null ? 'null' : targetIndex} ` +
          `t=${formatMs(nowPerfMs())}ms`
      );
    },
    [isInitialAligned, scheduleMonthlyFlashListInternalsDump, targetIndex]
  );

  const onMonthlyContentSizeChange = useCallback(
    (width, height) => {
      if (!STRIP_CALENDAR_PERF_LOG_ENABLED) return;
      const w = Math.round(width || 0);
      const h = Math.round(height || 0);
      const prev = scrollViewContentSizeRef.current;
      if (prev.width === w && prev.height === h) return;
      scrollViewContentSizeRef.current = { width: w, height: h };
      console.log(
        `[strip-calendar:ui-perf] monthly contentSize ` +
          `w=${w} h=${h} ` +
          `aligned=${isInitialAligned ? 'Y' : 'N'} ` +
          `targetIndex=${targetIndex == null ? 'null' : targetIndex} ` +
          `t=${formatMs(nowPerfMs())}ms`
      );
    },
    [isInitialAligned, targetIndex]
  );

  const onMonthlyViewableItemsChanged = useCallback(
    ({ viewableItems }) => {
      if (!STRIP_CALENDAR_PERF_LOG_ENABLED) return;
      if (viewabilityLogCountRef.current >= 4) return;
      viewabilityLogCountRef.current += 1;

      const visible = (viewableItems || [])
        .filter((v) => v?.isViewable)
        .map((v) => ({ index: v.index, weekStart: v.item }))
        .slice(0, 12);

      console.log(
        `[strip-calendar:ui-perf] monthly viewability sample=${viewabilityLogCountRef.current} ` +
          `visible=${JSON.stringify(visible)} ` +
          `targetIndex=${targetIndex == null ? 'null' : targetIndex} ` +
          `t=${formatMs(nowPerfMs())}ms`
      );
    },
    [targetIndex]
  );

  useEffect(() => {
    if (!STRIP_CALENDAR_PERF_LOG_ENABLED) return;

    const perfId = uiPerfIdRef.current;
    const mountAt = nowPerfMs();
    const snapshot = mountSnapshotRef.current;
    const mountTarget = snapshot?.targetTopWeekStart || null;
    const targetIndex = snapshot?.targetIndex ?? null;
    const weekStartsLength = snapshot?.weekStartsLength ?? weekStarts.length;

    console.log(
      `[strip-calendar:ui-perf] monthly mount id=${perfId} ` +
        `targetTopWeekStart=${mountTarget || 'null'} ` +
        `targetIndex=${targetIndex == null ? 'null' : targetIndex} ` +
        `weekStarts=${weekStartsLength} t0=${formatMs(mountAt)}ms`
    );
    scheduleMonthlyFlashListInternalsDump('mount');

    // Frame-gap monitor: detect long tasks via rAF gaps (no stack trace, but reliable timing).
    let rafFrames = 0;
    let rafLastAt = mountAt;
    let rafMaxGap = 0;
    let rafMaxGapAt = 0;
    let rafCancelled = false;

    const rafTick = () => {
      if (rafCancelled) return;
      const now = nowPerfMs();
      const gap = now - rafLastAt;
      if (gap > rafMaxGap) {
        rafMaxGap = gap;
        rafMaxGapAt = now - mountAt;
      }
      rafFrames += 1;
      rafLastAt = now;

      if (rafFrames < 120) {
        requestAnimationFrame(rafTick);
      }
    };

    requestAnimationFrame(rafTick);

    // LongTask observer (Chrome): prints only when long tasks are observed.
    let longTaskObserver = null;
    const longTasks = [];
    if (supportsLongTaskObserver()) {
      try {
        longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const dur = entry?.duration || 0;
            if (dur < 80) continue;
            if (longTasks.length >= 5) continue;
            longTasks.push({
              start: formatMs(entry.startTime),
              dur: formatMs(dur),
            });
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
      } catch {
        longTaskObserver = null;
      }
    }

    const summaryTimer = setTimeout(() => {
      const stats = renderStatsRef.current;
      if (!renderStatsLoggedRef.current) {
        renderStatsLoggedRef.current = true;
        console.log(
          `[strip-calendar:ui-perf] monthly renderStats id=${perfId} ` +
            `renderCalls=${stats.renderCalls} ` +
            `indexRange=${stats.minIndex == null ? 'n/a' : `${stats.minIndex}..${stats.maxIndex}`} ` +
            `cellIndexRange=${stats.cellMinIndex == null ? 'n/a' : `${stats.cellMinIndex}..${stats.cellMaxIndex}`} ` +
            `targets=Cell:${stats.targets.Cell || 0},Meas:${stats.targets.Measurement || 0},Sticky:${stats.targets.StickyHeader || 0} ` +
            `weekDatesTotal=${formatMs(stats.weekDatesTotalMs)}ms slowWeekDatesCalls=${stats.weekDatesSlowCalls}`
        );
      }

      console.log(
        `[strip-calendar:ui-perf] monthly frames id=${perfId} ` +
          `frames=${rafFrames} maxGap=${formatMs(rafMaxGap)}ms maxGapAt=${formatMs(rafMaxGapAt)}ms`
      );

      if (longTasks.length > 0) {
        const maxDur = Math.max(...longTasks.map((t) => t.dur));
        console.log(
          `[strip-calendar:longtask] monthly id=${perfId} ` +
            `count=${longTasks.length} maxDur=${formatMs(maxDur)}ms sample=${JSON.stringify(longTasks)}`
        );
      }

      if (longTaskObserver) {
        longTaskObserver.disconnect();
      }
    }, 2000);

    return () => {
      rafCancelled = true;
      clearTimeout(summaryTimer);
      internalsDumpTimersRef.current.forEach((id) => clearTimeout(id));
      internalsDumpTimersRef.current = [];
      const normalizeState = layoutNormalizeRef.current;
      if (normalizeState.clearTimer) {
        clearTimeout(normalizeState.clearTimer);
        normalizeState.clearTimer = null;
      }
      if (longTaskObserver) {
        longTaskObserver.disconnect();
      }
      const unmountAt = nowPerfMs();
      console.log(
        `[strip-calendar:ui-perf] monthly unmount id=${perfId} ` +
          `lifetime=${formatMs(unmountAt - mountAt)}ms`
      );
    };
  }, []);

  // --- Core settle logic ---
  const armProgrammaticGuard = useCallback(
    (reason) => {
      const state = scrollStateRef.current;
      state.phase = 'programmatic';
      state.isProgrammatic = true;

      if (state.programmaticGuardTimer) {
        clearTimeout(state.programmaticGuardTimer);
        state.programmaticGuardTimer = null;
      }

      state.programmaticGuardTimer = setTimeout(() => {
        const latest = scrollStateRef.current;
        if (latest.phase === 'programmatic') {
          latest.phase = 'idle';
        }
        latest.isProgrammatic = false;
        latest.programmaticGuardTimer = null;
        logStripCalendar('MonthlyStripList', 'guard:programmaticReleased', {
          reason,
          guardMs: MONTHLY_PROGRAMMATIC_GUARD_MS,
        });
      }, MONTHLY_PROGRAMMATIC_GUARD_MS);
    },
    []
  );

  const executeSettle = useCallback(
    (offsetY, source) => {
      if (!weekStarts.length) return;

      const state = scrollStateRef.current;
      state.phase = 'settling';

      // Fail-safe: once settle starts, release initial hidden gate.
      setIsInitialAligned((prev) => {
        if (prev) return prev;
        logStripCalendar('MonthlyStripList', 'sync:initialAlignmentDone', {
          reason: `settle:${source}`,
        });
        return true;
      });

      const maxIndex = weekStarts.length - 1;
      const rawIndex = offsetY / WEEK_ROW_HEIGHT;
      const snappedIndex = Math.max(0, Math.min(maxIndex, Math.round(rawIndex)));
      const snappedOffset = snappedIndex * WEEK_ROW_HEIGHT;
      const drift = offsetY - snappedOffset;
      const weekStart = weekStarts[snappedIndex];

      logStripCalendar('MonthlyStripList', 'settle:execute', {
        source,
        offsetY,
        rawIndex,
        snappedIndex,
        snappedOffset,
        drift,
        weekStart,
      });

      // Quantize correction - phase='settling' prevents correction → onScroll → re-settle loop
      if (Math.abs(drift) > MONTHLY_DRIFT_CORRECTION_THRESHOLD_PX) {
        logStripCalendar('MonthlyStripList', 'settle:quantizeCorrection', {
          source,
          snappedIndex,
          snappedOffset,
          drift,
        });
        armProgrammaticGuard('quantizeCorrection');
        listRef.current?.scrollToOffset({ offset: snappedOffset, animated: false });
      }

      // Emit settled event (deduplicate same weekStart)
      if (weekStart) {
        if (state.lastEmittedWeekStart === weekStart) {
          logStripCalendar('MonthlyStripList', 'settle:skipDuplicate', {
            source,
            weekStart,
          });
        } else {
          state.lastEmittedWeekStart = weekStart;
          state.lastSyncedTarget = weekStart;
          onTopWeekSettled(weekStart);
        }
      }

      // Transition: settling → idle (next tick to let correction scroll complete)
      requestAnimationFrame(() => {
        if (scrollStateRef.current.phase === 'settling') {
          scrollStateRef.current.phase = 'idle';
        }
      });
    },
    [armProgrammaticGuard, onTopWeekSettled, weekStarts]
  );

  const requestSettle = useCallback(
    (offsetY, source) => {
      const state = scrollStateRef.current;

      // Mutual exclusion: reject if already settling
      if (state.phase === 'settling') {
        logStripCalendar('MonthlyStripList', 'settle:rejected:alreadySettling', {
          source,
          phase: state.phase,
        });
        return;
      }

      // Programmatic guard: block only idle/web-origin settle while programmatic scroll is active.
      // momentumEnd/fallbackProgrammatic are valid settle points.
      if (state.isProgrammatic && source === 'scrollIdle') {
        logStripCalendar('MonthlyStripList', 'settle:rejected:programmatic', {
          source,
        });
        return;
      }

      // Clear any pending settle timer
      if (state.settleTimer) {
        clearTimeout(state.settleTimer);
        state.settleTimer = null;
      }

      // Immediate settle for momentum end/fallback, debounced for idle-settle
      if (source === 'momentumEnd' || source === 'fallbackProgrammatic') {
        executeSettle(offsetY, source);
      } else {
        // Idle settle: debounce
        state.settleTimer = setTimeout(() => {
          state.settleTimer = null;
          const latest = scrollStateRef.current;
          if (
            latest.phase === 'settling' ||
            latest.phase === 'dragging' ||
            latest.phase === 'momentum' ||
            latest.phase === 'programmatic'
          ) {
            logStripCalendar('MonthlyStripList', 'settle:debounceSkippedByPhase', {
              source,
              phase: latest.phase,
            });
            return;
          }
          executeSettle(scrollStateRef.current.lastOffset, source);
        }, MONTHLY_IDLE_SETTLE_DELAY_MS);
      }
    },
    [executeSettle]
  );

  // --- Scroll event handlers ---

  const onMomentumScrollEnd = useCallback(
    (event) => {
      requestSettle(event.nativeEvent.contentOffset.y, 'momentumEnd');
    },
    [requestSettle]
  );

  const onScrollBeginDrag = useCallback(() => {
    const state = scrollStateRef.current;
    if (state.settleTimer) {
      clearTimeout(state.settleTimer);
      state.settleTimer = null;
    }
    state.phase = 'dragging';
    state.isProgrammatic = false;

    logStripCalendar('MonthlyStripList', 'phase:dragging', {});
  }, []);

  const onScrollEndDrag = useCallback(
    (event) => {
      const state = scrollStateRef.current;
      const velocityY = event.nativeEvent.velocity?.y ?? 0;
      state.lastOffset = event.nativeEvent.contentOffset.y;

      logStripCalendar('MonthlyStripList', 'drag:end', {
        offsetY: state.lastOffset,
        velocityY,
      });

      // Some runtimes do not fire momentum end (or report velocity reliably).
      // If velocity is near zero, treat this as "no momentum" and settle.
      if (Math.abs(velocityY) < 0.1) {
        state.phase = 'idle';
        requestSettle(state.lastOffset, 'scrollIdle');
      }
    },
    [requestSettle]
  );

  const onMomentumScrollBegin = useCallback(() => {
    const state = scrollStateRef.current;
    state.phase = 'momentum';
    logStripCalendar('MonthlyStripList', 'phase:momentum', {});
  }, []);

  const onScroll = useCallback(
    (event) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const state = scrollStateRef.current;
      state.lastOffset = offsetY;

      // Idle settle detection: used as a fallback when momentum events are missing.
      // Keep this lightweight by only running while we believe we're "idle" (e.g. inertia scroll).
      if (state.phase === 'idle') {
        const maxIndex = weekStarts.length - 1;
        const rawIndex = offsetY / WEEK_ROW_HEIGHT;
        const snappedIndex = Math.max(0, Math.min(maxIndex, Math.round(rawIndex)));
        const snappedOffset = snappedIndex * WEEK_ROW_HEIGHT;
        const drift = offsetY - snappedOffset;
        const nearSnapped = Math.abs(drift) <= MONTHLY_DRIFT_CORRECTION_THRESHOLD_PX;
        const snappedWeekStart = weekStarts[snappedIndex];
        const sameAsLastSettled = state.lastEmittedWeekStart === snappedWeekStart;

        if (nearSnapped && sameAsLastSettled) {
          if (state.settleTimer) {
            clearTimeout(state.settleTimer);
            state.settleTimer = null;
          }
          return;
        }

        requestSettle(offsetY, 'scrollIdle');
      }
    },
    [requestSettle, weekStarts]
  );

  // --- Sync / programmatic scroll ---

  const keyExtractor = useCallback((item) => item, []);

  useEffect(() => {
    if (targetIndex == null) {
      setIsInitialAligned(true);
    }
  }, [targetIndex]);

  useEffect(() => {
    if (!STRIP_CALENDAR_PERF_LOG_ENABLED) return;
    console.log(
      `[strip-calendar:ui] monthly align=${isInitialAligned ? 'ready' : 'pending'} ` +
        `phase=${scrollStateRef.current?.phase || 'unknown'} ` +
        `targetTopWeekStart=${targetTopWeekStart || 'null'} ` +
        `targetIndex=${targetIndex == null ? 'null' : targetIndex} ` +
        `weekStarts=${weekStarts.length} t=${formatMs(nowPerfMs())}ms`
    );
  }, [isInitialAligned, targetIndex, targetTopWeekStart, weekStarts.length]);

  useEffect(() => {
    if (!isInitialAligned) return;
    if (!weekStarts.length) return;

    const timers = [
      setTimeout(() => maybeNormalizeMonthlyLayout('aligned+0'), 0),
      setTimeout(() => maybeNormalizeMonthlyLayout('aligned+200'), 200),
      setTimeout(() => maybeNormalizeMonthlyLayout('aligned+1000'), 1000),
    ];

    return () => timers.forEach((id) => clearTimeout(id));
  }, [isInitialAligned, maybeNormalizeMonthlyLayout, weekStarts.length]);

  const onScrollToIndexFailed = useCallback((info) => {
    logStripCalendar('MonthlyStripList', 'scrollToIndexFailed', {
      index: info.index,
      highestMeasuredFrameIndex: info.highestMeasuredFrameIndex,
      averageItemLength: info.averageItemLength,
    });
    listRef.current?.scrollToOffset({
      offset: info.averageItemLength * info.index,
      animated: false,
    });
  }, []);

  useEffect(() => {
    logStripCalendar('MonthlyStripList', 'mount', {
      dataLength: weekStarts.length,
      targetTopWeekStart,
      targetIndex,
    });

    return () => {
      const state = scrollStateRef.current;
      if (state.settleTimer) {
        clearTimeout(state.settleTimer);
      }
      if (state.programmaticGuardTimer) {
        clearTimeout(state.programmaticGuardTimer);
      }
      logStripCalendar('MonthlyStripList', 'unmount', {
        targetTopWeekStart,
      });
    };
  }, []);

  useEffect(() => {
    if (!targetTopWeekStart) return;
    const index = targetIndex;
    if (index == null) return;

    const state = scrollStateRef.current;
    const isInitialSync = !hasInitializedSyncRef.current;
    hasInitializedSyncRef.current = true;

    const windowChanged =
      state.lastSyncedWindowKey != null &&
      state.lastSyncedWindowKey !== weekWindowKey;

    if (!isInitialSync && state.lastSyncedTarget === targetTopWeekStart && !windowChanged) {
      logStripCalendar('MonthlyStripList', 'sync:skipAlreadySynced', {
        targetTopWeekStart,
        index,
        weekWindowKey,
      });
      return;
    }

    if (windowChanged) {
      // Prevent 1-frame "date jump" flash: data window changed but scroll offset hasn't been re-synced yet.
      setIsInitialAligned(false);
      logStripCalendar('MonthlyStripList', 'sync:windowChanged', {
        targetTopWeekStart,
        index,
        weekWindowKey,
        lastSyncedWindowKey: state.lastSyncedWindowKey,
      });
    }

    const animated = isInitialSync || windowChanged ? false : scrollAnimated;

    logStripCalendar('MonthlyStripList', 'sync:scrollToIndex', {
      targetTopWeekStart,
      index,
      scrollAnimated: animated,
      isInitialSync,
      lastSyncedTarget: state.lastSyncedTarget,
      weekWindowKey,
      lastSyncedWindowKey: state.lastSyncedWindowKey,
      windowChanged,
    });

    // Mark as programmatic to prevent idle settle from firing during scroll
    state.lastSyncedTarget = targetTopWeekStart;
    state.lastSyncedWindowKey = weekWindowKey;
    armProgrammaticGuard('targetSync');

    // Clear any pending settle timer
    if (state.settleTimer) {
      clearTimeout(state.settleTimer);
      state.settleTimer = null;
    }

    if (isInitialSync) {
      requestAnimationFrame(() => {
        setIsInitialAligned(true);
        logStripCalendar('MonthlyStripList', 'sync:initialAlignmentDone', {
          targetTopWeekStart,
          index,
          reason: 'initialSync:raf',
        });
      });
      return undefined;
    }

    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index, animated });
      if (windowChanged) {
        // Release hidden gate after the resync scroll is scheduled.
        requestAnimationFrame(() => {
          setIsInitialAligned(true);
          logStripCalendar('MonthlyStripList', 'sync:windowResyncDone', {
            targetTopWeekStart,
            index,
            weekWindowKey,
          });
        });
      }
    });

    // Fallback settle in case momentum events don't fire after programmatic scroll.
    // Safe cross-platform because settle is deduped by weekStart.
    const delay = animated ? MONTHLY_PROGRAMMATIC_SETTLE_DELAY_MS : MONTHLY_PROGRAMMATIC_GUARD_MS;
    const timeoutId = setTimeout(() => {
      const latest = scrollStateRef.current;
      if (latest.lastEmittedWeekStart === targetTopWeekStart) return;
      logStripCalendar('MonthlyStripList', 'settle:fallbackProgrammatic', {
        targetTopWeekStart,
        index,
      });
      requestSettle(index * WEEK_ROW_HEIGHT, 'fallbackProgrammatic');
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [armProgrammaticGuard, scrollAnimated, requestSettle, targetIndex, targetTopWeekStart, weekWindowKey]);

  return (
    <View
      style={[
        styles.viewport,
        layoutNudgeEnabled && styles.viewportLayoutNudge,
        !isInitialAligned && styles.hiddenBeforeAlign,
      ]}
      onLayout={(event) => {
        if (!STRIP_CALENDAR_PERF_LOG_ENABLED) return;
        const width = Math.round(event.nativeEvent.layout.width || 0);
        const height = Math.round(event.nativeEvent.layout.height || 0);
        const prev = viewportLayoutRef.current;
        if (prev.width === width && prev.height === height) return;
        viewportLayoutRef.current = { width, height };
        const key = `${width}x${height}`;
        if (lastInternalsDumpKeyRef.current.viewport !== key) {
          lastInternalsDumpKeyRef.current.viewport = key;
          scheduleMonthlyFlashListInternalsDump('viewportLayout');
        }
        console.log(
          `[strip-calendar:ui-perf] monthly viewport layout ` +
            `w=${width} h=${height} ` +
            `aligned=${isInitialAligned ? 'Y' : 'N'} ` +
            `t=${formatMs(nowPerfMs())}ms`
        );
      }}
    >
      {reactProfilerEnabled ? (
        <Profiler id="MonthlyFlashListSubtree" onRender={onMonthlyListProfile}>
          <FlashList
            ref={listRef}
            data={weekStarts}
            initialScrollIndex={targetIndex ?? 0}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            onLayout={onMonthlyScrollViewLayout}
            onContentSizeChange={onMonthlyContentSizeChange}
            viewabilityConfig={viewabilityConfigRef.current}
            onViewableItemsChanged={onMonthlyViewableItemsChanged}
            // Ensure initial paint fills the full monthly viewport (5 rows) across platforms.
            overrideProps={MONTHLY_OVERRIDE_PROPS}
            // Avoid platform default differences (web=500px). Render only the viewport rows first.
            // If we see blanks during fast scroll, increase this (e.g. WEEK_ROW_HEIGHT * 2).
            drawDistance={0}
            pagingEnabled={false}
            snapToInterval={WEEK_ROW_HEIGHT}
            snapToAlignment="start"
            decelerationRate="fast"
            disableIntervalMomentum
            onScrollBeginDrag={onScrollBeginDrag}
            onScroll={onScroll}
            scrollEventThrottle={32}
            onMomentumScrollBegin={onMomentumScrollBegin}
            onMomentumScrollEnd={onMomentumScrollEnd}
            onScrollEndDrag={onScrollEndDrag}
            onScrollToIndexFailed={onScrollToIndexFailed}
            showsVerticalScrollIndicator={false}
            getItemType={() => 'week'}
          />
        </Profiler>
      ) : (
        <FlashList
          ref={listRef}
          data={weekStarts}
          initialScrollIndex={targetIndex ?? 0}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          onLayout={onMonthlyScrollViewLayout}
          onContentSizeChange={onMonthlyContentSizeChange}
          viewabilityConfig={viewabilityConfigRef.current}
          onViewableItemsChanged={onMonthlyViewableItemsChanged}
          // Ensure initial paint fills the full monthly viewport (5 rows) across platforms.
          overrideProps={MONTHLY_OVERRIDE_PROPS}
          // Avoid platform default differences (web=500px). Render only the viewport rows first.
          // If we see blanks during fast scroll, increase this (e.g. WEEK_ROW_HEIGHT * 2).
          drawDistance={0}
          pagingEnabled={false}
          snapToInterval={WEEK_ROW_HEIGHT}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          onScrollBeginDrag={onScrollBeginDrag}
          onScroll={onScroll}
          scrollEventThrottle={32}
          onMomentumScrollBegin={onMomentumScrollBegin}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onScrollEndDrag={onScrollEndDrag}
          onScrollToIndexFailed={onScrollToIndexFailed}
          showsVerticalScrollIndicator={false}
          getItemType={() => 'week'}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    height: WEEK_ROW_HEIGHT * MONTHLY_VISIBLE_WEEK_COUNT,
  },
  viewportLayoutNudge: {
    paddingRight: 1,
  },
  hiddenBeforeAlign: {
    opacity: 0,
  },
  rowContainer: {
    height: WEEK_ROW_HEIGHT,
  },
});
