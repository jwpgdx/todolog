import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { useDateStore } from "../../../store/dateStore";
import { useTodayDate } from "../../../hooks/useTodayDate";
import { useSettings } from "../../../hooks/queries/useSettings";
import {
  DEFAULT_WEEK_FLOW_DRAG_SNAP_ENABLED,
  DEFAULT_WEEK_FLOW_WEEKLY_RECENTER_ANIMATION_ENABLED,
  WEEK_ROW_HEIGHT,
} from "../utils/weekFlowConstants";
import { addWeeks, toMonthStart, toWeekStart } from "../utils/weekFlowDateUtils";
import {
  formatHeaderYearMonth,
  resolveCalendarLanguage,
} from "../utils/weekFlowLocaleUtils";

import WeekFlowMonthly from "./WeekFlowMonthly";
import WeekFlowWeekly from "./WeekFlowWeekly";
import WeekFlowHeader from "./WeekFlowHeader";

const AnimatedView = Animated.createAnimatedComponent(View);

const DEFAULT_WEEKLY_HEIGHT = 128;
const DEFAULT_MONTHLY_HEIGHT = 320;
const SNAP_THRESHOLD = 0.45;
const WEEKLY_RECENTER_TRANSITION_MS = 140;
const WEEKLY_RECENTER_SLIDE_DISTANCE = 36;
const SPRING_CONFIG = {
  damping: 28,
  stiffness: 280,
  mass: 0.85,
};

function clampProgress(value) {
  "worklet";
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function parseYmdToUtcMs(dateYmd) {
  if (typeof dateYmd !== "string") return NaN;
  const match = dateYmd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return NaN;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return Date.UTC(year, month - 1, day);
}

function diffWeekStarts(targetWeekStart, baseWeekStart) {
  const targetMs = parseYmdToUtcMs(targetWeekStart);
  const baseMs = parseYmdToUtcMs(baseWeekStart);
  if (!Number.isFinite(targetMs) || !Number.isFinite(baseMs)) return 0;
  const diffMs = targetMs - baseMs;
  return Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
}

function modeForProgress(targetProgress) {
  return targetProgress >= 0.5 ? "monthly" : "weekly";
}

function formatMonthTitle(monthStartYmd, language) {
  if (!monthStartYmd || monthStartYmd.length < 7) return "";
  const year = Number(monthStartYmd.slice(0, 4));
  const month1Based = Number(monthStartYmd.slice(5, 7));
  if (!Number.isFinite(year) || !Number.isFinite(month1Based)) return "";
  return formatHeaderYearMonth(year, month1Based, language);
}

export default function WeekFlowDragSnapCard({
  initialMode = "weekly",
  weeklyWeekStart,
  onWeeklyWeekStartChange,
  onModeChange,
  enabled = DEFAULT_WEEK_FLOW_DRAG_SNAP_ENABLED,
  enableWeeklyRecenterAnimation = DEFAULT_WEEK_FLOW_WEEKLY_RECENTER_ANIMATION_ENABLED,
}) {
  const { currentDate, setCurrentDate } = useDateStore();
  const { todayDate } = useTodayDate();
  const { data: settings = {} } = useSettings();

  const startDayOfWeek = settings.startDayOfWeek || "sunday";
  const language = resolveCalendarLanguage(settings.language || "system");
  const initialProgress = initialMode === "monthly" ? 1 : 0;
  const [committedMode, setCommittedMode] = useState(
    initialMode === "monthly" ? "monthly" : "weekly",
  );
  const committedModeRef = useRef(initialMode === "monthly" ? "monthly" : "weekly");
  const [measuredHeights, setMeasuredHeights] = useState({
    weekly: 0,
    monthly: 0,
  });
  const [monthlyViewportWeekStart, setMonthlyViewportWeekStart] = useState(
    () => weeklyWeekStart || null,
  );
  const [previewWeeklyWeekStart, setPreviewWeeklyWeekStart] = useState(
    () => weeklyWeekStart || null,
  );
  const [previewWeeklySelectedDate, setPreviewWeeklySelectedDate] = useState(
    () => currentDate || null,
  );
  const [weeklyRecenterTransition, setWeeklyRecenterTransition] = useState(null);
  const [monthlySyncTopWeekStart, setMonthlySyncTopWeekStart] = useState(null);

  const monthlyViewportWeekStartRef = useRef(weeklyWeekStart || null);
  const latestSelectedDateRef = useRef(currentDate || null);
  const dragStartProgressRef = useSharedValue(initialProgress);
  const progress = useSharedValue(initialProgress);
  const weeklyRecenterProgress = useSharedValue(0);

  useEffect(() => {
    committedModeRef.current = committedMode;
  }, [committedMode]);

  const applyVisualMode = useCallback(
    (targetProgress) => {
      const nextMode = modeForProgress(targetProgress);
      if (committedModeRef.current === nextMode) return;

      committedModeRef.current = nextMode;
      setCommittedMode(nextMode);
      onModeChange?.(nextMode);
    },
    [onModeChange],
  );

  const weeklyHeight = measuredHeights.weekly || DEFAULT_WEEKLY_HEIGHT;
  const monthlyHeight = measuredHeights.monthly || DEFAULT_MONTHLY_HEIGHT;
  const travelDistance = Math.max(monthlyHeight - weeklyHeight, WEEK_ROW_HEIGHT * 2);

  const setMeasuredHeight = useCallback((type, nextHeight) => {
    const normalized = Math.ceil(Number(nextHeight) || 0);
    if (normalized <= 0) return;
    setMeasuredHeights((prev) => {
      if (prev[type] === normalized) return prev;
      return { ...prev, [type]: normalized };
    });
  }, []);

  const handleWeeklyLayout = useCallback(
    (event) => {
      setMeasuredHeight("weekly", event?.nativeEvent?.layout?.height);
    },
    [setMeasuredHeight],
  );

  const handleMonthlyLayout = useCallback(
    (event) => {
      setMeasuredHeight("monthly", event?.nativeEvent?.layout?.height);
    },
    [setMeasuredHeight],
  );

  const commitMonthlyViewportWeekStart = useCallback((weekStart) => {
    if (!weekStart) return;
    monthlyViewportWeekStartRef.current = weekStart;
    setMonthlyViewportWeekStart((prev) =>
      prev === weekStart ? prev : weekStart,
    );
  }, []);

  const commitPreviewWeeklySelectedDate = useCallback((dateYmd) => {
    if (!dateYmd) return;
    latestSelectedDateRef.current = dateYmd;
    setPreviewWeeklySelectedDate((prev) =>
      prev === dateYmd ? prev : dateYmd,
    );
  }, []);

  const handleMonthlyTopWeekStartChange = useCallback(
    (weekStart) => {
      if (!weekStart) return;
      setMonthlySyncTopWeekStart((prev) => (prev === weekStart ? null : prev));
      commitMonthlyViewportWeekStart(weekStart);
      if (committedMode !== "monthly") return;
      setPreviewWeeklyWeekStart((prev) => (prev === weekStart ? prev : weekStart));
    },
    [commitMonthlyViewportWeekStart, committedMode],
  );

  useEffect(() => {
    if (!weeklyWeekStart) return;
    if (weeklyRecenterTransition) return;

    setPreviewWeeklyWeekStart((prev) =>
      prev === weeklyWeekStart ? prev : weeklyWeekStart,
    );

    if (committedMode === "weekly") {
      commitMonthlyViewportWeekStart(weeklyWeekStart);
    }
  }, [
    commitMonthlyViewportWeekStart,
    committedMode,
    weeklyRecenterTransition,
    weeklyWeekStart,
  ]);

  useEffect(() => {
    latestSelectedDateRef.current = currentDate || null;
    if (committedMode !== "weekly" || !currentDate) return;
    setPreviewWeeklySelectedDate((prev) =>
      prev === currentDate ? prev : currentDate,
    );
  }, [committedMode, currentDate]);

  const handleMonthlySelectedDateChange = useCallback(
    (dateYmd) => {
      commitPreviewWeeklySelectedDate(dateYmd);
    },
    [commitPreviewWeeklySelectedDate],
  );

  const handleWeeklyVisibleWeekStartChange = useCallback(
    (weekStart) => {
      if (!weekStart) return;
      if (weeklyRecenterTransition) return;
      setPreviewWeeklyWeekStart((prev) => (prev === weekStart ? prev : weekStart));
      commitMonthlyViewportWeekStart(weekStart);
      onWeeklyWeekStartChange?.(weekStart);
    },
    [
      commitMonthlyViewportWeekStart,
      onWeeklyWeekStartChange,
      weeklyRecenterTransition,
    ],
  );

  const activeWeeklyWeekStart = useMemo(
    () =>
      previewWeeklyWeekStart ||
      weeklyWeekStart ||
      toWeekStart(currentDate, startDayOfWeek),
    [currentDate, previewWeeklyWeekStart, startDayOfWeek, weeklyWeekStart],
  );

  const activeMonthlyTopWeekStart = useMemo(
    () =>
      monthlyViewportWeekStart ||
      activeWeeklyWeekStart ||
      toWeekStart(currentDate, startDayOfWeek),
    [activeWeeklyWeekStart, currentDate, monthlyViewportWeekStart, startDayOfWeek],
  );

  const headerMonthStart = useMemo(() => {
    if (committedMode === "monthly") {
      return toMonthStart(activeMonthlyTopWeekStart || currentDate);
    }

    return toMonthStart(activeWeeklyWeekStart || currentDate);
  }, [activeMonthlyTopWeekStart, activeWeeklyWeekStart, committedMode, currentDate]);

  const headerTitle = useMemo(
    () => formatMonthTitle(headerMonthStart, language),
    [headerMonthStart, language],
  );

  const showTodayJumpButton = useMemo(() => {
    if (!todayDate) return false;

    if (committedMode === "monthly") {
      return toMonthStart(todayDate) !== headerMonthStart;
    }

    const todayWeekStart = toWeekStart(todayDate, startDayOfWeek);
    return todayWeekStart != null && todayWeekStart !== activeWeeklyWeekStart;
  }, [
    activeWeeklyWeekStart,
    committedMode,
    headerMonthStart,
    startDayOfWeek,
    todayDate,
  ]);

  const commitWeeklyViewport = useCallback(
    (nextWeekStart) => {
      if (!nextWeekStart) return;
      setMonthlySyncTopWeekStart(null);
      setPreviewWeeklyWeekStart((prev) =>
        prev === nextWeekStart ? prev : nextWeekStart,
      );
      commitMonthlyViewportWeekStart(nextWeekStart);
      onWeeklyWeekStartChange?.(nextWeekStart);
    },
    [commitMonthlyViewportWeekStart, onWeeklyWeekStartChange],
  );

  const handleHeaderTodayJump = useCallback(() => {
    if (!todayDate) return;
    const todayWeekStart = toWeekStart(todayDate, startDayOfWeek);
    if (!todayWeekStart) return;

    commitPreviewWeeklySelectedDate(todayDate);
    setCurrentDate(todayDate);
    commitWeeklyViewport(todayWeekStart);
    setMonthlySyncTopWeekStart(todayWeekStart);
  }, [
    commitPreviewWeeklySelectedDate,
    commitWeeklyViewport,
    setCurrentDate,
    startDayOfWeek,
    todayDate,
  ]);

  const handleHeaderPrev = useCallback(() => {
    const nextWeekStart = addWeeks(activeWeeklyWeekStart, -1);
    commitWeeklyViewport(nextWeekStart);
  }, [activeWeeklyWeekStart, commitWeeklyViewport]);

  const handleHeaderNext = useCallback(() => {
    const nextWeekStart = addWeeks(activeWeeklyWeekStart, 1);
    commitWeeklyViewport(nextWeekStart);
  }, [activeWeeklyWeekStart, commitWeeklyViewport]);

  const finishWeeklyRecenterTransition = useCallback(
    (targetWeekStart) => {
      if (!targetWeekStart) {
        setWeeklyRecenterTransition(null);
        return;
      }

      commitMonthlyViewportWeekStart(targetWeekStart);
      setPreviewWeeklyWeekStart((prev) =>
        prev === targetWeekStart ? prev : targetWeekStart,
      );
      onWeeklyWeekStartChange?.(targetWeekStart);
      setWeeklyRecenterTransition(null);
    },
    [commitMonthlyViewportWeekStart, onWeeklyWeekStartChange],
  );

  useEffect(() => {
    if (!weeklyRecenterTransition) return;

    weeklyRecenterProgress.value = 0;
    weeklyRecenterProgress.value = withTiming(
      1,
      { duration: WEEKLY_RECENTER_TRANSITION_MS },
      (finished) => {
        if (!finished) return;
        runOnJS(finishWeeklyRecenterTransition)(
          weeklyRecenterTransition.targetWeekStart,
        );
      },
    );
  }, [
    finishWeeklyRecenterTransition,
    weeklyRecenterProgress,
    weeklyRecenterTransition,
  ]);

  const commitMode = useCallback(
    (targetProgress) => {
      const nextMode = modeForProgress(targetProgress);

      if (nextMode === "weekly") {
        const latestStoreSelectedDate = useDateStore.getState?.().currentDate || null;
        const latestSelectedDate =
          latestStoreSelectedDate || latestSelectedDateRef.current || currentDate;
        if (latestSelectedDate) {
          setPreviewWeeklySelectedDate((prev) =>
            prev === latestSelectedDate ? prev : latestSelectedDate,
          );
        }
        const topWeekStart =
          previewWeeklyWeekStart ||
          weeklyWeekStart ||
          monthlyViewportWeekStartRef.current ||
          null;
        const selectedWeekStart = latestSelectedDate
          ? toWeekStart(latestSelectedDate, startDayOfWeek)
          : null;
        let nextWeeklyWeekStart = topWeekStart;
        let nextWeeklyDelta = 0;

        if (topWeekStart && selectedWeekStart) {
          const visibleEndWeekStart = addWeeks(topWeekStart, 4);
          if (
            visibleEndWeekStart &&
            selectedWeekStart >= topWeekStart &&
            selectedWeekStart <= visibleEndWeekStart
          ) {
            nextWeeklyWeekStart = selectedWeekStart;
            nextWeeklyDelta = diffWeekStarts(selectedWeekStart, topWeekStart);
          }
        }

        if (
          enableWeeklyRecenterAnimation &&
          topWeekStart &&
          nextWeeklyWeekStart &&
          nextWeeklyWeekStart !== topWeekStart
        ) {
          setPreviewWeeklyWeekStart((prev) =>
            prev === topWeekStart ? prev : topWeekStart,
          );
          setWeeklyRecenterTransition({
            kind: Math.abs(nextWeeklyDelta) === 1 ? "slide" : "fade",
            direction: nextWeeklyDelta >= 0 ? 1 : -1,
            sourceWeekStart: topWeekStart,
            targetWeekStart: nextWeeklyWeekStart,
          });
        }

        if (nextWeeklyWeekStart) {
          if (
            !enableWeeklyRecenterAnimation ||
            !topWeekStart ||
            nextWeeklyWeekStart === topWeekStart
          ) {
            commitMonthlyViewportWeekStart(nextWeeklyWeekStart);
            setPreviewWeeklyWeekStart((prev) =>
              prev === nextWeeklyWeekStart ? prev : nextWeeklyWeekStart,
            );
            onWeeklyWeekStartChange?.(nextWeeklyWeekStart);
          }
        }
      }

      applyVisualMode(targetProgress);
    },
    [
      applyVisualMode,
      currentDate,
      enableWeeklyRecenterAnimation,
      commitMonthlyViewportWeekStart,
      onModeChange,
      onWeeklyWeekStartChange,
      previewWeeklyWeekStart,
      startDayOfWeek,
      weeklyWeekStart,
    ],
  );

  const animateToMode = useCallback(
    (targetProgress) => {
      applyVisualMode(targetProgress);
      progress.value = withSpring(targetProgress, SPRING_CONFIG, (finished) => {
        if (!finished) return;
        runOnJS(commitMode)(targetProgress);
      });
    },
    [applyVisualMode, commitMode, progress],
  );

  const handleTogglePress = useCallback(() => {
    const targetProgress = committedMode === "weekly" ? 1 : 0;
    animateToMode(targetProgress);
  }, [animateToMode, committedMode]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!weeklyRecenterTransition)
        .minDistance(4)
        .activeOffsetX([-16, 16])
        .onBegin(() => {
          dragStartProgressRef.value = progress.value;
        })
        .onUpdate((event) => {
          const nextProgress =
            dragStartProgressRef.value + event.translationY / travelDistance;
          progress.value = clampProgress(nextProgress);
        })
        .onEnd((event) => {
          const velocityProgress = event.velocityY / Math.max(travelDistance, 1);
          const projected = clampProgress(progress.value + velocityProgress * 0.12);
          const targetProgress = projected >= SNAP_THRESHOLD ? 1 : 0;
          runOnJS(applyVisualMode)(targetProgress);
          progress.value = withSpring(targetProgress, SPRING_CONFIG, (finished) => {
            if (!finished) return;
            runOnJS(commitMode)(targetProgress);
          });
        }),
    [
      applyVisualMode,
      commitMode,
      dragStartProgressRef,
      progress,
      travelDistance,
      weeklyRecenterTransition,
    ],
  );

  const surfaceStyle = useAnimatedStyle(() => ({
    height: interpolate(
      progress.value,
      [0, 1],
      [weeklyHeight, monthlyHeight],
      Extrapolation.CLAMP,
    ),
  }), [monthlyHeight, weeklyHeight]);

  const weeklyLayerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.2, 0.7, 1],
      [1, 0.92, 0.16, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          progress.value,
          [0, 1],
          [0, -10],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const monthlyLayerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.25, 1],
      [0, 0.35, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          progress.value,
          [0, 1],
          [10, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const weeklyRecenterKind = weeklyRecenterTransition?.kind || "none";
  const weeklyRecenterDirection = weeklyRecenterTransition?.direction || 1;

  const weeklyRecenterOutgoingStyle = useAnimatedStyle(() => {
    if (weeklyRecenterKind === "slide") {
      return {
        opacity: interpolate(
          weeklyRecenterProgress.value,
          [0, 1],
          [1, 0],
          Extrapolation.CLAMP,
        ),
        transform: [
          {
            translateX: interpolate(
              weeklyRecenterProgress.value,
              [0, 1],
              [0, -weeklyRecenterDirection * WEEKLY_RECENTER_SLIDE_DISTANCE],
              Extrapolation.CLAMP,
            ),
          },
        ],
      };
    }

    return {
      opacity: interpolate(
        weeklyRecenterProgress.value,
        [0, 1],
        [1, 0],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          scale: interpolate(
            weeklyRecenterProgress.value,
            [0, 1],
            [1, 0.988],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  }, [weeklyRecenterDirection, weeklyRecenterKind]);

  const weeklyRecenterIncomingStyle = useAnimatedStyle(() => {
    if (weeklyRecenterKind === "slide") {
      return {
        opacity: interpolate(
          weeklyRecenterProgress.value,
          [0, 1],
          [0, 1],
          Extrapolation.CLAMP,
        ),
        transform: [
          {
            translateX: interpolate(
              weeklyRecenterProgress.value,
              [0, 1],
              [weeklyRecenterDirection * WEEKLY_RECENTER_SLIDE_DISTANCE, 0],
              Extrapolation.CLAMP,
            ),
          },
        ],
      };
    }

    return {
      opacity: interpolate(
        weeklyRecenterProgress.value,
        [0, 1],
        [0, 1],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          scale: interpolate(
            weeklyRecenterProgress.value,
            [0, 1],
            [0.994, 1],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  }, [weeklyRecenterDirection, weeklyRecenterKind]);

  const monthlyScrollEnabled = enabled && committedMode === "monthly";
  const monthlySyncTarget =
    monthlySyncTopWeekStart ||
    (enabled && committedMode === "weekly"
      ? previewWeeklyWeekStart || weeklyWeekStart || null
      : null);

  return (
    <View style={styles.wrapper}>
      <WeekFlowHeader
        title={headerTitle}
        mode={committedMode}
        showTodayJumpButton={showTodayJumpButton}
        onTodayJump={handleHeaderTodayJump}
        onPrev={handleHeaderPrev}
        onNext={handleHeaderNext}
        onToggleMode={handleTogglePress}
        showToggle
      />

      <AnimatedView style={[styles.surface, surfaceStyle]}>
        <AnimatedView
          pointerEvents={committedMode === "monthly" ? "auto" : "none"}
          style={[styles.layer, monthlyLayerStyle]}
        >
          <View onLayout={handleMonthlyLayout}>
            <WeekFlowMonthly
              embedded
              enableDaySummaries={committedMode === "monthly"}
              initialTopWeekStart={monthlyViewportWeekStart || weeklyWeekStart}
              onSelectedDateChange={handleMonthlySelectedDateChange}
              onTopWeekStartChange={handleMonthlyTopWeekStartChange}
              scrollEnabled={monthlyScrollEnabled}
              showHeader={false}
              showToggle={false}
              syncTopWeekStart={monthlySyncTarget}
            />
          </View>
        </AnimatedView>

        {!weeklyRecenterTransition ? (
          <AnimatedView
            pointerEvents={
              committedMode === "weekly" && !weeklyRecenterTransition ? "auto" : "none"
            }
            style={[styles.layer, weeklyLayerStyle]}
          >
            <View onLayout={handleWeeklyLayout}>
              <WeekFlowWeekly
                embedded
                enableDaySummaries={committedMode === "weekly"}
                onVisibleWeekStartChange={handleWeeklyVisibleWeekStartChange}
                showHeader={false}
                showToggle={false}
                selectedDate={previewWeeklySelectedDate}
                visibleWeekStart={previewWeeklyWeekStart || weeklyWeekStart}
              />
            </View>
          </AnimatedView>
        ) : null}

        {committedMode === "weekly" && weeklyRecenterTransition ? (
          <View pointerEvents="none" style={styles.layer}>
            <AnimatedView style={[styles.recenterLayer, weeklyRecenterOutgoingStyle]}>
              <WeekFlowWeekly
                embedded
                enableDaySummaries={false}
                showHeader={false}
                showToggle={false}
                selectedDate={previewWeeklySelectedDate}
                visibleWeekStart={weeklyRecenterTransition.sourceWeekStart}
              />
            </AnimatedView>

            <AnimatedView style={[styles.recenterLayer, weeklyRecenterIncomingStyle]}>
              <WeekFlowWeekly
                embedded
                enableDaySummaries={false}
                showHeader={false}
                showToggle={false}
                selectedDate={previewWeeklySelectedDate}
                visibleWeekStart={weeklyRecenterTransition.targetWeekStart}
              />
            </AnimatedView>
          </View>
        ) : null}
      </AnimatedView>

      <GestureDetector gesture={panGesture}>
        <Pressable
          disabled={Boolean(weeklyRecenterTransition)}
          onPress={handleTogglePress}
          style={styles.handleContainer}
        >
          <View style={styles.touchArea}>
            <View style={styles.bar} />
          </View>
        </Pressable>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  surface: {
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    position: "relative",
  },
  layer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  recenterLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  handleContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    backgroundColor: "#FFFFFF",
  },
  touchArea: {
    alignItems: "center",
    justifyContent: "center",
  },
  bar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
  },
});
