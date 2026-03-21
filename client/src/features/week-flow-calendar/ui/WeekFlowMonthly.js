import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import dayjs from "dayjs";
import { FlashList } from "@shopify/flash-list";

import { useDateStore } from "../../../store/dateStore";
import { useTodayDate } from "../../../hooks/useTodayDate";
import { useSettings } from "../../../hooks/queries/useSettings";
import { useWeekFlowDaySummaryRange } from "../../calendar-day-summaries";
import {
  formatHeaderYearMonth,
  getWeekdayLabels,
  resolveCalendarLanguage,
} from "../utils/weekFlowLocaleUtils";
import { addDays, addMonths, addWeeks, toWeekStart } from "../utils/weekFlowDateUtils";
import { WEEK_ROW_HEIGHT } from "../utils/weekFlowConstants";
import { getWeekMeta } from "../utils/weekFlowWeekMetaCache";

import WeekFlowHeader from "./WeekFlowHeader";
import WeekFlowModeToggleBar from "./WeekFlowModeToggleBar";
import WeekRow from "./WeekRow";

// Perf-first tuning:
// - Smaller initial window reduces initial JS/memory pressure.
// - Keep a bounded sliding window to prevent unbounded growth during infinite scroll.
// "Lightweight first" defaults: keep the dataset small and accept occasional loading/blank gaps.
// Tweak these upward only if UX becomes too janky on fast scroll.
const INITIAL_WINDOW_BEFORE_WEEKS = 13;
const INITIAL_WINDOW_AFTER_WEEKS = 13;
const INITIAL_WINDOW_TOTAL_WEEKS =
  INITIAL_WINDOW_BEFORE_WEEKS + INITIAL_WINDOW_AFTER_WEEKS + 1;
const WINDOW_PAGE_WEEKS = 7;
// Keep a bounded window, but trim in batches and only when scroll is idle.
// This avoids frequent "trim + scrollToOffset" work during fast scroll.
const TARGET_WINDOW_WEEKS = 260;
const TRIM_HYSTERESIS_WEEKS = WINDOW_PAGE_WEEKS * 8; // 56w buffer
const HARD_WINDOW_WEEKS = TARGET_WINDOW_WEEKS + TRIM_HYSTERESIS_WEEKS;
const PREFETCH_EDGE_ROWS = 4; // how early we extend near edges (perf-first, small buffer)
const MONTHLY_VISIBLE_WEEK_COUNT = 5;
const SUMMARY_BUFFER_BEFORE_WEEKS = 3;
const SUMMARY_BUFFER_AFTER_WEEKS = 2;

function formatDebugRange(range) {
  if (!range?.startDate || !range?.endDate) return "-";
  return `${range.startDate}..${range.endDate}`;
}

function formatDebugStamp(isoString) {
  const source = typeof isoString === "string" ? isoString : new Date().toISOString();
  return source.slice(11, 19);
}

function createInitialDebugState(initialWeekStart, initialMonthStart, initialWeekCount) {
  return {
    scrollPhase: "idle",
    scrollOffset: 0,
    topWeekStart: initialWeekStart || "-",
    settledTopWeekStart: initialWeekStart || "-",
    visibleMonthStart: initialMonthStart || "-",
    viewportSettledToken: 0,
    weekCount: initialWeekCount,
    pendingScrollWeekStart: "-",
    pendingTrimDirection: "none",
    pendingTrimTopRows: 0,
    lastScrollCommand: "-",
    lastWindowOp: "-",
    activeEnsure: "idle",
    dirtyRefresh: "idle",
    retention: "idle",
  };
}

function getMonthStartFromYmd(dateYmd) {
  if (!dateYmd || dateYmd.length < 7) return null;
  return `${dateYmd.slice(0, 7)}-01`;
}

function parseYearMonthFromMonthStart(monthStartYmd) {
  if (!monthStartYmd || monthStartYmd.length < 7) return null;
  const year = Number(monthStartYmd.slice(0, 4));
  const month1Based = Number(monthStartYmd.slice(5, 7));
  if (!Number.isFinite(year) || !Number.isFinite(month1Based)) return null;
  return { year, month1Based };
}

function buildWeekWindowFromTop(topWeekStart, totalWeeks = INITIAL_WINDOW_TOTAL_WEEKS) {
  const starts = [];
  for (let i = 0; i < totalWeeks; i += 1) {
    starts.push(addWeeks(topWeekStart, i));
  }
  return starts;
}

function clampDayInMonth(monthStartYmd, desiredDayOfMonth) {
  const base = dayjs(monthStartYmd);
  if (!base.isValid()) return monthStartYmd;
  const daysInMonth = base.daysInMonth();
  const clamped = Math.max(
    1,
    Math.min(Number(desiredDayOfMonth) || 1, daysInMonth),
  );
  return base.date(clamped).format("YYYY-MM-DD");
}

function clampWeekIndex(index, weekStarts) {
  if (!Array.isArray(weekStarts) || weekStarts.length === 0) return -1;
  const normalized = Number.isFinite(index) ? index : 0;
  return Math.max(0, Math.min(weekStarts.length - 1, normalized));
}

export default function WeekFlowMonthly({
  initialTopWeekStart,
  onToggleMode,
  showToggle = true,
  onTopWeekStartChange,
  onSelectedDateChange,
  showDebugPanel = false,
  embedded = false,
  enableDaySummaries = true,
  scrollEnabled = true,
  syncTopWeekStart = null,
}) {
  const { currentDate, setCurrentDate } = useDateStore();
  const { todayDate } = useTodayDate();
  const { data: settings = {} } = useSettings();

  const startDayOfWeek = settings.startDayOfWeek || "sunday";
  const language = resolveCalendarLanguage(settings.language || "system");

  const selectedWeekStart = useMemo(
    () => toWeekStart(currentDate, startDayOfWeek),
    [currentDate, startDayOfWeek],
  );

  const initialWeekStartRef = useRef(initialTopWeekStart || selectedWeekStart);
  const initialWeekStart = initialWeekStartRef.current;

  const [weekStarts, setWeekStarts] = useState(() =>
    initialWeekStart
      ? buildWeekWindowFromTop(initialWeekStart)
      : [],
  );
  const [visibleMonthStart, setVisibleMonthStart] = useState(() =>
    getMonthStartFromYmd(initialWeekStart || currentDate),
  );
  const initialMonthStart = getMonthStartFromYmd(initialWeekStart || currentDate);
  const visibleMonthStartRef = useRef(visibleMonthStart);
  const [settledTopWeekStart, setSettledTopWeekStart] = useState(() => initialWeekStart || null);
  const [viewportSettledToken, setViewportSettledToken] = useState(0);
  const weekCountRef = useRef(weekStarts.length);
  const listRef = useRef(null);
  const hasHandledInitialViewabilityRef = useRef(false);
  const extendGuardRef = useRef({ up: false, down: false });
  const pendingScrollWeekStartRef = useRef(null);
  const scrollOffsetRef = useRef(0);
  const pendingPrependedRowsRef = useRef(0);
  const pendingTrimTopRowsRef = useRef(0);
  const lastReportedTopWeekStartRef = useRef(null);
  const lastExtendDirectionRef = useRef("down"); // 'down' | 'up'
  const pendingTrimDirectionRef = useRef(null); // 'down' | 'up'
  const scrollPhaseRef = useRef({ dragging: false, momentum: false });
  const webIdleSettleTimerRef = useRef(null);
  const debugScrollReportRef = useRef({ offset: 0, atMs: 0 });
  const prependAnchorLockRef = useRef(false);
  const prependAnchorUnlockTimerRef = useRef(null);
  const [windowLoadState, setWindowLoadState] = useState("idle");
  const [debugState, setDebugState] = useState(() =>
    createInitialDebugState(initialWeekStart, initialMonthStart, weekStarts.length),
  );

  const updateDebugState = useCallback(
    (patch) => {
      if (!showDebugPanel) return;
      setDebugState((prev) => {
        const nextPatch = typeof patch === "function" ? patch(prev) : patch;
        if (!nextPatch) return prev;
        return { ...prev, ...nextPatch };
      });
    },
    [showDebugPanel],
  );

  const recordScrollCommand = useCallback(
    (label) => {
      updateDebugState({
        lastScrollCommand: `[${formatDebugStamp()}] ${label}`,
        pendingScrollWeekStart: pendingScrollWeekStartRef.current || "-",
        pendingTrimDirection: pendingTrimDirectionRef.current || "none",
        pendingTrimTopRows: pendingTrimTopRowsRef.current || 0,
      });
    },
    [updateDebugState],
  );

  const recordWindowOp = useCallback(
    (label) => {
      updateDebugState({
        lastWindowOp: `[${formatDebugStamp()}] ${label}`,
      });
    },
    [updateDebugState],
  );

  const resolveTopWeekStartFromOffset = useCallback(
    (offset = scrollOffsetRef.current, targetWeekStarts = weekStarts) => {
      if (!Array.isArray(targetWeekStarts) || targetWeekStarts.length === 0) return null;
      const normalizedOffset = Math.max(0, Number(offset) || 0);
      const snappedIndex = clampWeekIndex(
        Math.round(normalizedOffset / WEEK_ROW_HEIGHT),
        targetWeekStarts,
      );
      return targetWeekStarts[snappedIndex] || null;
    },
    [weekStarts],
  );

  const reportTopWeekStart = useCallback(
    (weekStart) => {
      if (!weekStart) return;
      if (lastReportedTopWeekStartRef.current === weekStart) return;
      lastReportedTopWeekStartRef.current = weekStart;
      onTopWeekStartChange?.(weekStart);
      updateDebugState({ topWeekStart: weekStart });
    },
    [onTopWeekStartChange, updateDebugState],
  );

  const syncViewportTopWeekStart = useCallback(
    (offset = scrollOffsetRef.current, targetWeekStarts = weekStarts) => {
      const topWeekStart = resolveTopWeekStartFromOffset(offset, targetWeekStarts);
      if (!topWeekStart) return null;

      reportTopWeekStart(topWeekStart);

      const nextMonthStart = getMonthStartFromYmd(topWeekStart);
      const prevMonthStart = visibleMonthStartRef.current;
      if (nextMonthStart && nextMonthStart !== prevMonthStart) {
        visibleMonthStartRef.current = nextMonthStart;
        setVisibleMonthStart(nextMonthStart);
      }

      return topWeekStart;
    },
    [reportTopWeekStart, resolveTopWeekStartFromOffset, weekStarts],
  );

  useEffect(() => {
    reportTopWeekStart(initialWeekStart);
  }, [initialWeekStart, reportTopWeekStart]);

  useEffect(() => {
    setSettledTopWeekStart(initialWeekStart || null);
  }, [initialWeekStart]);

  useEffect(() => {
    visibleMonthStartRef.current = visibleMonthStart;
  }, [visibleMonthStart]);

  useEffect(() => {
    weekCountRef.current = weekStarts.length;
  }, [weekStarts.length]);

  useEffect(() => {
    updateDebugState({
      visibleMonthStart: visibleMonthStart || "-",
      settledTopWeekStart: settledTopWeekStart || "-",
      viewportSettledToken,
      weekCount: weekStarts.length,
      pendingScrollWeekStart: pendingScrollWeekStartRef.current || "-",
      pendingTrimDirection: pendingTrimDirectionRef.current || "none",
      pendingTrimTopRows: pendingTrimTopRowsRef.current || 0,
    });
  }, [
    settledTopWeekStart,
    updateDebugState,
    viewportSettledToken,
    visibleMonthStart,
    weekStarts.length,
  ]);

  const flushTrimIfNeeded = useCallback(() => {
    const phase = scrollPhaseRef.current;
    const isIdle = !phase.dragging && !phase.momentum;
    const direction = pendingTrimDirectionRef.current;
    const excess = weekCountRef.current - TARGET_WINDOW_WEEKS;

    if (!isIdle) return;
    if (!direction) return;
    if (pendingScrollWeekStartRef.current) return;
    if (excess <= 0) return;

    pendingTrimDirectionRef.current = null;
    if (direction === "down") {
      pendingTrimTopRowsRef.current = excess;
    }
    recordScrollCommand(`trim apply direction=${direction} rows=${excess}`);

    setWeekStarts((prev) => {
      if (direction === "down") {
        return prev.slice(excess);
      }

      // Trim from the bottom when we've been extending upwards.
      return prev.slice(0, TARGET_WINDOW_WEEKS);
    });
  }, [recordScrollCommand]);

  useEffect(() => {
    if (weekStarts.length <= HARD_WINDOW_WEEKS) return;
    // Schedule a batched trim; actual trimming happens only when scroll is idle.
    pendingTrimDirectionRef.current = lastExtendDirectionRef.current;
    updateDebugState({
      pendingTrimDirection: pendingTrimDirectionRef.current || "none",
    });
    flushTrimIfNeeded();
  }, [flushTrimIfNeeded, updateDebugState, weekStarts.length]);

  const weekdayLabels = useMemo(
    () => getWeekdayLabels(language, startDayOfWeek),
    [language, startDayOfWeek],
  );

  const headerTitle = useMemo(() => {
    const monthStart = visibleMonthStart || getMonthStartFromYmd(currentDate);
    const parsed = parseYearMonthFromMonthStart(monthStart);
    if (!parsed) return "";
    return formatHeaderYearMonth(parsed.year, parsed.month1Based, language);
  }, [currentDate, language, visibleMonthStart]);

  const showTodayJumpButton = useMemo(() => {
    if (!todayDate) return false;
    const todayMonthStart = getMonthStartFromYmd(todayDate);
    const visible = visibleMonthStart;
    return (
      todayMonthStart != null && visible != null && todayMonthStart !== visible
    );
  }, [todayDate, visibleMonthStart]);

  const ensureWeekStartVisible = useCallback(
    (targetWeekStart, options = {}) => {
      if (!targetWeekStart) return;

      const index = weekStarts.indexOf(targetWeekStart);
      if (index >= 0) {
        listRef.current?.scrollToIndex?.({
          index,
          animated: options.animated === true,
        });
        recordScrollCommand(`scrollToIndex ensure target=${targetWeekStart} index=${index}`);
        return;
      }

      pendingTrimTopRowsRef.current = 0;
      pendingPrependedRowsRef.current = 0;
      pendingTrimDirectionRef.current = null;
      scrollOffsetRef.current = 0;
      setWeekStarts(
        buildWeekWindowFromTop(targetWeekStart),
      );
      setVisibleMonthStart(getMonthStartFromYmd(targetWeekStart));
      pendingScrollWeekStartRef.current = targetWeekStart;
      recordScrollCommand(`rebuild top-anchored window target=${targetWeekStart}`);
    },
    [recordScrollCommand, weekStarts],
  );

  useEffect(() => {
    if (!syncTopWeekStart) return;
    if (syncTopWeekStart === lastReportedTopWeekStartRef.current) return;
    ensureWeekStartVisible(syncTopWeekStart, { animated: false });
  }, [ensureWeekStartVisible, syncTopWeekStart]);

  useEffect(() => {
    const pending = pendingScrollWeekStartRef.current;
    if (pending) {
      const index = weekStarts.indexOf(pending);
      if (index === -1) return;
      listRef.current?.scrollToIndex?.({ index, animated: false });
      scrollOffsetRef.current = index * WEEK_ROW_HEIGHT;
      pendingScrollWeekStartRef.current = null;
      pendingTrimTopRowsRef.current = 0;
      syncViewportTopWeekStart(scrollOffsetRef.current, weekStarts);
      recordScrollCommand(`scrollToIndex applied target=${pending} index=${index}`);
      return;
    }

    const prependedRows = pendingPrependedRowsRef.current;
    if (prependedRows) {
      pendingPrependedRowsRef.current = 0;
      const nextOffset = scrollOffsetRef.current + prependedRows * WEEK_ROW_HEIGHT;
      listRef.current?.scrollToOffset?.({ offset: nextOffset, animated: false });
      scrollOffsetRef.current = nextOffset;
      syncViewportTopWeekStart(nextOffset, weekStarts);
      recordScrollCommand(`scrollToOffset prepend rows=${prependedRows} nextOffset=${nextOffset}`);
      if (prependAnchorUnlockTimerRef.current) {
        clearTimeout(prependAnchorUnlockTimerRef.current);
      }
      prependAnchorUnlockTimerRef.current = setTimeout(() => {
        prependAnchorLockRef.current = false;
        extendGuardRef.current.up = false;
        setWindowLoadState("idle");
      }, 90);
      return;
    }

    const trimmedRows = pendingTrimTopRowsRef.current;
    if (!trimmedRows) return;

    pendingTrimTopRowsRef.current = 0;
    const nextOffset = Math.max(
      0,
      scrollOffsetRef.current - trimmedRows * WEEK_ROW_HEIGHT,
    );
    listRef.current?.scrollToOffset?.({ offset: nextOffset, animated: false });
    scrollOffsetRef.current = nextOffset;
    syncViewportTopWeekStart(nextOffset, weekStarts);
    recordScrollCommand(`scrollToOffset trim rows=${trimmedRows} nextOffset=${nextOffset}`);
  }, [recordScrollCommand, syncViewportTopWeekStart, weekStarts]);

  const onDayPress = useCallback(
    (dateYmd) => {
      if (!dateYmd) return;
      onSelectedDateChange?.(dateYmd);
      setCurrentDate(dateYmd);
    },
    [onSelectedDateChange, setCurrentDate],
  );

  const onTodayJump = useCallback(() => {
    if (!todayDate) return;
    onSelectedDateChange?.(todayDate);
    setCurrentDate(todayDate);
    const weekStart = toWeekStart(todayDate, startDayOfWeek);
    ensureWeekStartVisible(weekStart);
  }, [
    ensureWeekStartVisible,
    onSelectedDateChange,
    setCurrentDate,
    startDayOfWeek,
    todayDate,
  ]);

  const onPrevMonth = useCallback(() => {
    const baseMonthStart =
      visibleMonthStart || getMonthStartFromYmd(currentDate);
    if (!baseMonthStart) return;

    const nextMonthStart = addMonths(baseMonthStart, -1);
    if (!nextMonthStart) return;

    const desiredDay = Number(currentDate?.slice(8, 10)) || 1;
    const nextSelected = clampDayInMonth(nextMonthStart, desiredDay);
    onSelectedDateChange?.(nextSelected);
    setCurrentDate(nextSelected);
    ensureWeekStartVisible(toWeekStart(nextSelected, startDayOfWeek));
  }, [
    currentDate,
    ensureWeekStartVisible,
    onSelectedDateChange,
    setCurrentDate,
    startDayOfWeek,
    visibleMonthStart,
  ]);

  const onNextMonth = useCallback(() => {
    const baseMonthStart =
      visibleMonthStart || getMonthStartFromYmd(currentDate);
    if (!baseMonthStart) return;

    const nextMonthStart = addMonths(baseMonthStart, 1);
    if (!nextMonthStart) return;

    const desiredDay = Number(currentDate?.slice(8, 10)) || 1;
    const nextSelected = clampDayInMonth(nextMonthStart, desiredDay);
    onSelectedDateChange?.(nextSelected);
    setCurrentDate(nextSelected);
    ensureWeekStartVisible(toWeekStart(nextSelected, startDayOfWeek));
  }, [
    currentDate,
    ensureWeekStartVisible,
    onSelectedDateChange,
    setCurrentDate,
    startDayOfWeek,
    visibleMonthStart,
  ]);

  const appendWeeks = useCallback(() => {
    if (extendGuardRef.current.down) return;
    extendGuardRef.current.down = true;
    lastExtendDirectionRef.current = "down";
    recordWindowOp(`append ${WINDOW_PAGE_WEEKS}w`);

    setWeekStarts((prev) => {
      const last = prev[prev.length - 1];
      if (!last) return prev;
      const next = [];
      for (let i = 1; i <= WINDOW_PAGE_WEEKS; i += 1) {
        next.push(addWeeks(last, i));
      }
      return [...prev, ...next];
    });

    requestAnimationFrame(() => {
      extendGuardRef.current.down = false;
    });
  }, [recordWindowOp]);

  const prependWeeks = useCallback(() => {
    if (extendGuardRef.current.up) return;
    extendGuardRef.current.up = true;
    lastExtendDirectionRef.current = "up";
    prependAnchorLockRef.current = true;
    setWindowLoadState("prepend");
    pendingPrependedRowsRef.current += WINDOW_PAGE_WEEKS;
    recordWindowOp(`prepend ${WINDOW_PAGE_WEEKS}w`);

    setWeekStarts((prev) => {
      const first = prev[0];
      if (!first) return prev;
      const next = [];
      for (let i = WINDOW_PAGE_WEEKS; i >= 1; i -= 1) {
        next.push(addWeeks(first, -i));
      }
      return [...next, ...prev];
    });

  }, [recordWindowOp]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 30 }).current;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }) => {
      if (prependAnchorLockRef.current) return;
      if (!Array.isArray(viewableItems) || viewableItems.length === 0) return;

      // Pick the top-most visible item by smallest index to avoid flicker.
      let top = viewableItems[0];
      let bottom = viewableItems[0];
      for (const item of viewableItems) {
        if (item?.index == null) continue;
        if (top?.index == null || item.index < top.index) {
          top = item;
        }
        if (bottom?.index == null || item.index > bottom.index) {
          bottom = item;
        }
      }

      syncViewportTopWeekStart();

      const isInitial = !hasHandledInitialViewabilityRef.current;
      hasHandledInitialViewabilityRef.current = true;

      const firstIdx = top?.index;
      if (firstIdx != null && firstIdx <= PREFETCH_EDGE_ROWS) {
        if (!isInitial) {
          prependWeeks();
        }
      }

      const lastIdx = bottom?.index;
      const total = weekCountRef.current;
      if (
        lastIdx != null &&
        total &&
        lastIdx >= total - 1 - PREFETCH_EDGE_ROWS
      ) {
        if (!isInitial) {
          appendWeeks();
        }
      }
    },
    [appendWeeks, prependWeeks, syncViewportTopWeekStart],
  );

  const renderItem = useCallback(
    ({ item }) => (
      <WeekRow
        weekStart={item}
        days={getWeekMeta(item, language)}
        selectedDate={currentDate}
        todayDate={todayDate}
        onDayPress={onDayPress}
      />
    ),
    [currentDate, language, onDayPress, todayDate],
  );

  const keyExtractor = useCallback((item) => item, []);

  const onScrollToIndexFailed = useCallback((info) => {
    const averageLength = Number(info?.averageItemLength || WEEK_ROW_HEIGHT);
    const index = Number(info?.index || 0);
    listRef.current?.scrollToOffset?.({
      offset: averageLength * index,
      animated: false,
    });
    recordScrollCommand(`scrollToIndexFailed fallback index=${index} avg=${averageLength}`);
  }, [recordScrollCommand]);

  const onScroll = useCallback((e) => {
    const next = Number(e?.nativeEvent?.contentOffset?.y || 0);
    const prev = scrollOffsetRef.current;
    scrollOffsetRef.current = next;

    if (showDebugPanel) {
      const nowMs = Date.now();
      const last = debugScrollReportRef.current;
      if (
        Math.abs(next - last.offset) >= 24 ||
        nowMs - last.atMs >= 120
      ) {
        debugScrollReportRef.current = { offset: next, atMs: nowMs };
        updateDebugState({ scrollOffset: Math.round(next) });
      }

      const phase = scrollPhaseRef.current;
      if (!phase.dragging && !phase.momentum && Math.abs(next - prev) >= 8) {
        recordScrollCommand(`passive onScroll delta=${Math.round(next - prev)} offset=${Math.round(next)}`);
      }
    }

    // Web/no-momentum fallback: debounce an "idle settled" token after scroll inactivity.
    // This does NOT call ensure directly; it only advances the settled token.
    if (Platform.OS === "web") {
      if (webIdleSettleTimerRef.current) {
        clearTimeout(webIdleSettleTimerRef.current);
      }
      webIdleSettleTimerRef.current = setTimeout(() => {
        const top = lastReportedTopWeekStartRef.current;
        if (top) {
          setSettledTopWeekStart(top);
          setViewportSettledToken((value) => value + 1);
        }
      }, 120);
    }
  }, [recordScrollCommand, showDebugPanel, updateDebugState]);

  const onScrollBeginDrag = useCallback(() => {
    scrollPhaseRef.current.dragging = true;
    updateDebugState({ scrollPhase: "dragging" });
  }, [updateDebugState]);

  const onScrollEndDrag = useCallback(() => {
    scrollPhaseRef.current.dragging = false;
    updateDebugState({
      scrollPhase: scrollPhaseRef.current.momentum ? "momentum" : "idle",
    });
    if (!scrollPhaseRef.current.momentum) {
      const top = syncViewportTopWeekStart();
      if (top) {
        setSettledTopWeekStart(top);
        setViewportSettledToken((value) => value + 1);
      }
    }
    // Defer one frame to avoid racing momentum-begin.
    requestAnimationFrame(() => flushTrimIfNeeded());
  }, [flushTrimIfNeeded, syncViewportTopWeekStart, updateDebugState]);

  const onMomentumScrollBegin = useCallback(() => {
    scrollPhaseRef.current.momentum = true;
    updateDebugState({ scrollPhase: "momentum" });
  }, [updateDebugState]);

  const onMomentumScrollEnd = useCallback(() => {
    scrollPhaseRef.current.momentum = false;
    updateDebugState({ scrollPhase: "idle" });
    requestAnimationFrame(() => flushTrimIfNeeded());

    const top = syncViewportTopWeekStart();
    if (top) {
      setSettledTopWeekStart(top);
      setViewportSettledToken((value) => value + 1);
    }
  }, [flushTrimIfNeeded, syncViewportTopWeekStart, updateDebugState]);

  useEffect(() => {
    return () => {
      if (prependAnchorUnlockTimerRef.current) {
        clearTimeout(prependAnchorUnlockTimerRef.current);
      }
      if (webIdleSettleTimerRef.current) {
        clearTimeout(webIdleSettleTimerRef.current);
      }
    };
  }, []);

  const activeRange = useMemo(() => {
    if (!settledTopWeekStart) return null;
    const startDate = addDays(settledTopWeekStart, -SUMMARY_BUFFER_BEFORE_WEEKS * 7);
    const endDate = addDays(
      settledTopWeekStart,
      (MONTHLY_VISIBLE_WEEK_COUNT + SUMMARY_BUFFER_AFTER_WEEKS) * 7 - 1,
    );
    if (!startDate || !endDate) return null;
    return { startDate, endDate };
  }, [settledTopWeekStart]);

  const getIsViewportSettled = useCallback(() => {
    const phase = scrollPhaseRef.current;
    return !phase.dragging && !phase.momentum;
  }, []);

  const onDaySummaryDebugEvent = useCallback(
    (event) => {
      if (!showDebugPanel || !event?.type) return;

      const prefix = `[${formatDebugStamp(event.at)}]`;

      if (event.type === "active-ensure") {
        const suffix =
          event.status === "done"
            ? ` ${event.cacheHit ? "cache-hit" : "loaded"} ${formatDebugRange(event.range)}`
            : event.status === "error"
              ? ` error ${event.error || "-"}`
              : ` loading ${formatDebugRange(event.range)}`;

        updateDebugState({
          activeEnsure: `${prefix} ${event.status}${suffix}`,
        });
        return;
      }

      if (event.type === "dirty-refresh") {
        const refreshedRanges =
          Array.isArray(event.refreshedRanges) && event.refreshedRanges.length > 0
            ? event.refreshedRanges.map((range) => formatDebugRange(range)).join(", ")
            : formatDebugRange(event.range);
        const suffix =
          event.status === "error"
            ? ` error ${event.error || "-"}`
            : ` ${refreshedRanges}`;

        updateDebugState({
          dirtyRefresh: `${prefix} ${event.status}${suffix}`,
        });
        return;
      }

      if (event.type === "retention") {
        updateDebugState({
          retention: `${prefix} ${event.status} ${event.anchorMonthId || "-"} ${formatDebugRange(event.range)}`,
        });
      }
    },
    [showDebugPanel, updateDebugState],
  );

  useWeekFlowDaySummaryRange({
    mode: "monthly",
    activeRange: enableDaySummaries ? activeRange : null,
    retentionAnchorDate: enableDaySummaries ? settledTopWeekStart : null,
    viewportSettledToken: enableDaySummaries ? viewportSettledToken : null,
    getIsViewportSettled,
    onDebugEvent: onDaySummaryDebugEvent,
  });

  return (
    <View style={[styles.container, embedded ? styles.embeddedContainer : null]}>
      <WeekFlowHeader
        title={headerTitle}
        mode="monthly"
        showTodayJumpButton={showTodayJumpButton}
        onTodayJump={onTodayJump}
        onPrev={onPrevMonth}
        onNext={onNextMonth}
        onToggleMode={onToggleMode}
        showToggle={showToggle}
      />

      <View style={styles.weekdayRow}>
        {weekdayLabels.map((label) => (
          <View key={label} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.listViewport}>
        <FlashList
          ref={listRef}
          data={weekStarts}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          estimatedItemSize={WEEK_ROW_HEIGHT}
          drawDistance={240}
          // Native snap (no JS settle loop): stop on exact week rows for easier testing.
          snapToInterval={WEEK_ROW_HEIGHT}
          snapToAlignment="start"
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          maintainVisibleContentPosition={{ disabled: true }}
          onScroll={onScroll}
          onScrollBeginDrag={onScrollBeginDrag}
          onScrollEndDrag={onScrollEndDrag}
          onMomentumScrollBegin={onMomentumScrollBegin}
          onMomentumScrollEnd={onMomentumScrollEnd}
          scrollEventThrottle={32}
          onScrollToIndexFailed={onScrollToIndexFailed}
          scrollEnabled={scrollEnabled}
          showsVerticalScrollIndicator={false}
          getItemType={() => "week"}
        />

        {windowLoadState === "prepend" ? (
          <View pointerEvents="none" style={styles.edgeLoadingTop}>
            <Text style={styles.edgeLoadingText}>과거 주 로딩중...</Text>
          </View>
        ) : null}
      </View>

      {showToggle ? (
        <WeekFlowModeToggleBar mode="monthly" onToggleMode={onToggleMode} />
      ) : null}

      {showDebugPanel ? (
        <View style={styles.debugPanel}>
          <Text style={styles.debugTitle}>WF Monthly Debug</Text>
          <Text style={styles.debugLine}>
            phase {debugState.scrollPhase} | offset {debugState.scrollOffset} | rows {debugState.weekCount}
          </Text>
          <Text style={styles.debugLine}>
            top {debugState.topWeekStart} | settled {debugState.settledTopWeekStart}
          </Text>
          <Text style={styles.debugLine}>
            month {debugState.visibleMonthStart} | token {debugState.viewportSettledToken}
          </Text>
          <Text style={styles.debugLine}>
            pending scroll {debugState.pendingScrollWeekStart} | trim {debugState.pendingTrimDirection}/{debugState.pendingTrimTopRows}
          </Text>
          <Text style={styles.debugLine}>last scroll {debugState.lastScrollCommand}</Text>
          <Text style={styles.debugLine}>window {debugState.lastWindowOp}</Text>
          <Text style={styles.debugLine}>ensure {debugState.activeEnsure}</Text>
          <Text style={styles.debugLine}>dirty {debugState.dirtyRefresh}</Text>
          <Text style={styles.debugLine}>retention {debugState.retention}</Text>
          <Text style={styles.debugHint}>
            list config mVCP:off snap:{WEEK_ROW_HEIGHT} decel:fast
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    overflow: "hidden",
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 12,
  },
  embeddedContainer: {
    borderWidth: 0,
    borderRadius: 0,
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
  },
  weekdayRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  weekdayCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    backgroundColor: "#FFFFFF",
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
  },
  listViewport: {
    height: WEEK_ROW_HEIGHT * MONTHLY_VISIBLE_WEEK_COUNT,
  },
  edgeLoadingTop: {
    position: "absolute",
    top: 8,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  edgeLoadingText: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.84)",
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  debugPanel: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
  },
  debugLine: {
    marginTop: 4,
    fontSize: 11,
    color: "#334155",
  },
  debugHint: {
    marginTop: 6,
    fontSize: 10,
    color: "#64748B",
  },
});
