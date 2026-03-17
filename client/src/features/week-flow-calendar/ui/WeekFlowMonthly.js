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

function buildWeekWindow(anchorWeekStart, beforeWeeks, afterWeeks) {
  const starts = [];
  for (let i = -beforeWeeks; i <= afterWeeks; i += 1) {
    starts.push(addWeeks(anchorWeekStart, i));
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

export default function WeekFlowMonthly({
  initialTopWeekStart,
  onToggleMode,
  showToggle = true,
  onTopWeekStartChange,
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
      ? buildWeekWindow(
          initialWeekStart,
          INITIAL_WINDOW_BEFORE_WEEKS,
          INITIAL_WINDOW_AFTER_WEEKS,
        )
      : [],
  );
  const [visibleMonthStart, setVisibleMonthStart] = useState(() =>
    getMonthStartFromYmd(initialWeekStart || currentDate),
  );
  const visibleMonthStartRef = useRef(visibleMonthStart);
  const [settledTopWeekStart, setSettledTopWeekStart] = useState(() => initialWeekStart || null);
  const [viewportSettledToken, setViewportSettledToken] = useState(0);
  const weekCountRef = useRef(weekStarts.length);
  const listRef = useRef(null);
  const hasHandledInitialViewabilityRef = useRef(false);
  const extendGuardRef = useRef({ up: false, down: false });
  const pendingScrollWeekStartRef = useRef(null);
  const scrollOffsetRef = useRef(0);
  const pendingTrimTopRowsRef = useRef(0);
  const lastReportedTopWeekStartRef = useRef(null);
  const lastExtendDirectionRef = useRef("down"); // 'down' | 'up'
  const pendingTrimDirectionRef = useRef(null); // 'down' | 'up'
  const scrollPhaseRef = useRef({ dragging: false, momentum: false });
  const webIdleSettleTimerRef = useRef(null);

  const reportTopWeekStart = useCallback(
    (weekStart) => {
      if (!weekStart) return;
      if (lastReportedTopWeekStartRef.current === weekStart) return;
      lastReportedTopWeekStartRef.current = weekStart;
      onTopWeekStartChange?.(weekStart);
    },
    [onTopWeekStartChange],
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

  const flushTrimIfNeeded = useCallback(() => {
    const phase = scrollPhaseRef.current;
    const isIdle = !phase.dragging && !phase.momentum;
    const direction = pendingTrimDirectionRef.current;

    if (!isIdle) return;
    if (!direction) return;
    if (pendingScrollWeekStartRef.current) return;

    pendingTrimDirectionRef.current = null;

    setWeekStarts((prev) => {
      const excess = prev.length - TARGET_WINDOW_WEEKS;
      if (excess <= 0) return prev;

      if (direction === "down") {
        pendingTrimTopRowsRef.current = excess;
        return prev.slice(excess);
      }

      // Trim from the bottom when we've been extending upwards.
      return prev.slice(0, TARGET_WINDOW_WEEKS);
    });
  }, []);

  useEffect(() => {
    if (weekStarts.length <= HARD_WINDOW_WEEKS) return;
    // Schedule a batched trim; actual trimming happens only when scroll is idle.
    pendingTrimDirectionRef.current = lastExtendDirectionRef.current;
    flushTrimIfNeeded();
  }, [flushTrimIfNeeded, weekStarts.length]);

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
        return;
      }

      pendingTrimTopRowsRef.current = 0;
      setWeekStarts(
        buildWeekWindow(
          targetWeekStart,
          INITIAL_WINDOW_BEFORE_WEEKS,
          INITIAL_WINDOW_AFTER_WEEKS,
        ),
      );
      setVisibleMonthStart(getMonthStartFromYmd(targetWeekStart));
      pendingScrollWeekStartRef.current = targetWeekStart;
    },
    [weekStarts],
  );

  useEffect(() => {
    const pending = pendingScrollWeekStartRef.current;
    if (pending) {
      const index = weekStarts.indexOf(pending);
      if (index === -1) return;
      listRef.current?.scrollToIndex?.({ index, animated: false });
      pendingScrollWeekStartRef.current = null;
      pendingTrimTopRowsRef.current = 0;
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
  }, [weekStarts]);

  const onDayPress = useCallback(
    (dateYmd) => {
      if (!dateYmd) return;
      setCurrentDate(dateYmd);
    },
    [setCurrentDate],
  );

  const onTodayJump = useCallback(() => {
    if (!todayDate) return;
    setCurrentDate(todayDate);
    const weekStart = toWeekStart(todayDate, startDayOfWeek);
    ensureWeekStartVisible(weekStart);
  }, [ensureWeekStartVisible, setCurrentDate, startDayOfWeek, todayDate]);

  const onPrevMonth = useCallback(() => {
    const baseMonthStart =
      visibleMonthStart || getMonthStartFromYmd(currentDate);
    if (!baseMonthStart) return;

    const nextMonthStart = addMonths(baseMonthStart, -1);
    if (!nextMonthStart) return;

    const desiredDay = Number(currentDate?.slice(8, 10)) || 1;
    const nextSelected = clampDayInMonth(nextMonthStart, desiredDay);
    setCurrentDate(nextSelected);
    ensureWeekStartVisible(toWeekStart(nextSelected, startDayOfWeek));
  }, [
    currentDate,
    ensureWeekStartVisible,
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
    setCurrentDate(nextSelected);
    ensureWeekStartVisible(toWeekStart(nextSelected, startDayOfWeek));
  }, [
    currentDate,
    ensureWeekStartVisible,
    setCurrentDate,
    startDayOfWeek,
    visibleMonthStart,
  ]);

  const appendWeeks = useCallback(() => {
    if (extendGuardRef.current.down) return;
    extendGuardRef.current.down = true;
    lastExtendDirectionRef.current = "down";

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
  }, []);

  const prependWeeks = useCallback(() => {
    if (extendGuardRef.current.up) return;
    extendGuardRef.current.up = true;
    lastExtendDirectionRef.current = "up";

    setWeekStarts((prev) => {
      const first = prev[0];
      if (!first) return prev;
      const next = [];
      for (let i = WINDOW_PAGE_WEEKS; i >= 1; i -= 1) {
        next.push(addWeeks(first, -i));
      }
      return [...next, ...prev];
    });

    requestAnimationFrame(() => {
      extendGuardRef.current.up = false;
    });
  }, []);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 30 }).current;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }) => {
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

      if (top?.item) {
        reportTopWeekStart(top.item);
        const nextMonthStart = getMonthStartFromYmd(top.item);
        const prevMonthStart = visibleMonthStartRef.current;
        if (nextMonthStart && nextMonthStart !== prevMonthStart) {
          visibleMonthStartRef.current = nextMonthStart;
          setVisibleMonthStart(nextMonthStart);
        }
      }

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
    [appendWeeks, prependWeeks, reportTopWeekStart],
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
  }, []);

  const onScroll = useCallback((e) => {
    const next = Number(e?.nativeEvent?.contentOffset?.y || 0);
    scrollOffsetRef.current = next;

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
  }, []);

  const onScrollBeginDrag = useCallback(() => {
    scrollPhaseRef.current.dragging = true;
  }, []);

  const onScrollEndDrag = useCallback(() => {
    scrollPhaseRef.current.dragging = false;
    // Defer one frame to avoid racing momentum-begin.
    requestAnimationFrame(() => flushTrimIfNeeded());
  }, [flushTrimIfNeeded]);

  const onMomentumScrollBegin = useCallback(() => {
    scrollPhaseRef.current.momentum = true;
  }, []);

  const onMomentumScrollEnd = useCallback(() => {
    scrollPhaseRef.current.momentum = false;
    requestAnimationFrame(() => flushTrimIfNeeded());

    const top = lastReportedTopWeekStartRef.current;
    if (top) {
      setSettledTopWeekStart(top);
      setViewportSettledToken((value) => value + 1);
    }
  }, [flushTrimIfNeeded]);

  useEffect(() => {
    return () => {
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

  useWeekFlowDaySummaryRange({
    mode: "monthly",
    activeRange,
    retentionAnchorDate: settledTopWeekStart,
    viewportSettledToken,
    getIsViewportSettled,
  });

  const initialScrollIndex = useMemo(() => {
    if (!initialWeekStart) return 0;
    const idx = weekStarts.indexOf(initialWeekStart);
    if (idx >= 0) return idx;
    return INITIAL_WINDOW_BEFORE_WEEKS;
  }, [initialWeekStart, weekStarts]);

  return (
    <View style={styles.container}>
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
          initialScrollIndex={
            weekStarts.length ? initialScrollIndex : undefined
          }
          onStartReached={prependWeeks}
          onStartReachedThreshold={0.35}
          onEndReached={appendWeeks}
          onEndReachedThreshold={0.35}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          onScroll={onScroll}
          onScrollBeginDrag={onScrollBeginDrag}
          onScrollEndDrag={onScrollEndDrag}
          onMomentumScrollBegin={onMomentumScrollBegin}
          onMomentumScrollEnd={onMomentumScrollEnd}
          scrollEventThrottle={32}
          onScrollToIndexFailed={onScrollToIndexFailed}
          showsVerticalScrollIndicator={false}
          getItemType={() => "week"}
        />
      </View>

      {showToggle ? (
        <WeekFlowModeToggleBar mode="monthly" onToggleMode={onToggleMode} />
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
});
