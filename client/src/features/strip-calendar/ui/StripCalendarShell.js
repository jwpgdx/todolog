import React, { Profiler, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDateStore } from '../../../store/dateStore';
import { useTodayDate } from '../../../hooks/useTodayDate';
import { useSettings } from '../../../hooks/queries/useSettings';
import {
  createWeekWindow,
  addWeeks,
  toMonthAnchor,
  toWeekStart,
  shouldRecenterWeekWindow,
} from '../utils/stripCalendarDateUtils';
import { formatHeaderYearMonth, getWeekdayLabels, resolveCalendarLanguage } from '../utils/stripCalendarLocaleUtils';
import { useStripCalendarController } from '../hooks/useStripCalendarController';
import { useStripCalendarDataRange } from '../hooks/useStripCalendarDataRange';
import WeeklyStripList from './WeeklyStripList';
import MonthlyStripList from './MonthlyStripList';
import StripCalendarHeader from './StripCalendarHeader';
import ModeToggleBar from './ModeToggleBar';
import { MONTHLY_VISIBLE_WEEK_COUNT, STRIP_CALENDAR_PERF_LOG_ENABLED, WEEK_ROW_HEIGHT } from '../utils/stripCalendarConstants';
import { useStripCalendarStore } from '../store/stripCalendarStore';
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

const MONTHLY_REACT_PROFILER_THRESHOLD_MS = 8;

function createWeekWindowMeasured(pivotWeekStart, reason) {
  const t0 = STRIP_CALENDAR_PERF_LOG_ENABLED ? nowPerfMs() : 0;
  const result = createWeekWindow(pivotWeekStart);
  if (STRIP_CALENDAR_PERF_LOG_ENABLED) {
    const t1 = nowPerfMs();
    const start = result[0] || 'null';
    const end = result[result.length - 1] || 'null';
    console.log(
      `[strip-calendar:ui-perf] weekWindow create reason=${reason} ` +
        `pivot=${pivotWeekStart || 'null'} ` +
        `start=${start} end=${end} weeks=${result.length} ` +
        `ms=${formatMs(t1 - t0)} t=${formatMs(t1)}ms`
    );
  }
  return result;
}

export default function StripCalendarShell() {
  const { currentDate, setCurrentDate } = useDateStore();
  const { todayDate } = useTodayDate();
  const { data: settings = {} } = useSettings();
  const hasBootstrappedRef = useRef(false);
  const viewportLayoutRef = useRef({ mode: null, width: null, height: null });

  const startDayOfWeek = settings.startDayOfWeek || 'sunday';
  const language = resolveCalendarLanguage(settings.language || 'system');
  const todayWeekStart = useMemo(
    () => toWeekStart(todayDate, startDayOfWeek),
    [todayDate, startDayOfWeek]
  );

  const currentWeekStart = useMemo(
    () => toWeekStart(currentDate, startDayOfWeek),
    [currentDate, startDayOfWeek]
  );

  const [weekStarts, setWeekStarts] = useState(() =>
    createWeekWindowMeasured(currentWeekStart, 'init:currentWeekStart')
  );
  const [weeklyTargetWeekStart, setWeeklyTargetWeekStart] = useState(null);
  const [monthlyTargetWeekStart, setMonthlyTargetWeekStart] = useState(null);
  const [scrollAnimated, setScrollAnimated] = useState(false);
  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const prevModeRef = useRef('weekly');

  const handleMonthlyReactProfilerRender = useCallback(
    (id, phase, actualDuration, baseDuration, startTime, commitTime) => {
      if (!STRIP_CALENDAR_PERF_LOG_ENABLED) return;
      if (phase !== 'mount' && actualDuration < MONTHLY_REACT_PROFILER_THRESHOLD_MS) return;

      console.log(
        `[strip-calendar:react-profiler] id=${id} phase=${phase} ` +
          `actual=${formatMs(actualDuration)}ms base=${formatMs(baseDuration)}ms ` +
          `start=${formatMs(startTime)}ms commit=${formatMs(commitTime)}ms t=${formatMs(nowPerfMs())}ms`
      );
    },
    []
  );

  const {
    mode,
    anchorWeekStart,
    weeklyVisibleWeekStart,
    monthlyTopWeekStart,
    showTodayJumpButton,
    handleToggleMode,
    handleWeeklySettled,
    handleMonthlySettled,
    handleDayPress,
    handleTodayJump,
  } = useStripCalendarController({
    currentDate,
    setCurrentDate,
    todayDate,
    startDayOfWeek,
  });

  useStripCalendarDataRange({
    mode,
    weeklyVisibleWeekStart,
    monthlyTopWeekStart,
    weeklyTargetWeekStart,
    monthlyTargetWeekStart,
  });

  useEffect(() => {
    const prevMode = prevModeRef.current;
    if (STRIP_CALENDAR_PERF_LOG_ENABLED && mode === 'monthly' && prevMode !== 'monthly') {
      const targetTopWeekStart =
        monthlyTargetWeekStart ||
        monthlyTopWeekStart ||
        anchorWeekStart ||
        todayWeekStart ||
        currentWeekStart ||
        null;
      console.log(
        `[strip-calendar:ui] monthly enter from=${prevMode || 'unknown'} ` +
          `targetTopWeekStart=${targetTopWeekStart || 'null'} weekStarts=${weekStarts.length} ` +
          `t=${formatMs(nowPerfMs())}ms`
      );
    }
    prevModeRef.current = mode;
  }, [
    anchorWeekStart,
    currentWeekStart,
    mode,
    monthlyTargetWeekStart,
    monthlyTopWeekStart,
    todayWeekStart,
    weekStarts.length,
  ]);

  useEffect(() => {
    if (hasBootstrappedRef.current) return;
    if (!todayWeekStart) return;

    logStripCalendar('StripCalendarShell', 'bootstrap:start', {
      todayWeekStart,
      currentWeekStart,
      currentDate,
      todayDate,
    });

    const state = useStripCalendarStore.getState();
    state.resetNavigationState();
    state.setMode('weekly');
    state.setAnchorWeekStart(todayWeekStart);
    state.setWeeklyVisibleWeekStart(todayWeekStart);
    state.setMonthlyTopWeekStart(todayWeekStart);

    const initialWeekWindow = createWeekWindowMeasured(todayWeekStart, 'bootstrap:todayWeekStart');
    setWeekStarts(initialWeekWindow);
    setWeeklyTargetWeekStart(todayWeekStart);
    setMonthlyTargetWeekStart(todayWeekStart);
    setScrollAnimated(false);
    setIsNavigationReady(true);
    hasBootstrappedRef.current = true;

    logStripCalendar('StripCalendarShell', 'bootstrap:done', {
      mode: 'weekly',
      anchorWeekStart: todayWeekStart,
      weekWindowLength: initialWeekWindow.length,
    });
  }, [todayWeekStart]);

  useEffect(() => {
    const pivotWeekStart = mode === 'weekly'
      ? weeklyTargetWeekStart || weeklyVisibleWeekStart || currentWeekStart
      : monthlyTargetWeekStart || monthlyTopWeekStart || currentWeekStart;

    if (!pivotWeekStart) return;

    if (shouldRecenterWeekWindow(weekStarts, pivotWeekStart)) {
      logStripCalendar('StripCalendarShell', 'weekWindow:recenter', {
        mode,
        pivotWeekStart,
        weekWindowLength: weekStarts.length,
      });
      setWeekStarts(createWeekWindowMeasured(pivotWeekStart, 'recenter:effect'));
    }
  }, [
    currentWeekStart,
    mode,
    monthlyTargetWeekStart,
    monthlyTopWeekStart,
    weekStarts,
    weeklyTargetWeekStart,
    weeklyVisibleWeekStart,
  ]);

  useEffect(() => {
    logStripCalendar('StripCalendarShell', 'state:snapshot', {
      mode,
      anchorWeekStart,
      weeklyVisibleWeekStart,
      monthlyTopWeekStart,
      weeklyTargetWeekStart,
      monthlyTargetWeekStart,
      titleWeekStart:
        mode === 'weekly'
          ? (weeklyTargetWeekStart || weeklyVisibleWeekStart || anchorWeekStart || currentWeekStart)
          : (monthlyTargetWeekStart || monthlyTopWeekStart || anchorWeekStart || currentWeekStart),
      showTodayJumpButton,
      scrollAnimated,
      isNavigationReady,
      currentDate,
      todayDate,
    });
  }, [
    anchorWeekStart,
    currentDate,
    currentWeekStart,
    mode,
    monthlyTargetWeekStart,
    monthlyTopWeekStart,
    scrollAnimated,
    showTodayJumpButton,
    todayDate,
    isNavigationReady,
    weeklyTargetWeekStart,
    weeklyVisibleWeekStart,
  ]);

  const titleWeekStart = mode === 'weekly'
    ? (weeklyTargetWeekStart || weeklyVisibleWeekStart || anchorWeekStart || currentWeekStart)
    : (monthlyTargetWeekStart || monthlyTopWeekStart || anchorWeekStart || currentWeekStart);

  const monthAnchor = useMemo(() => toMonthAnchor(titleWeekStart), [titleWeekStart]);

  const headerTitle = useMemo(
    () => formatHeaderYearMonth(monthAnchor.year, monthAnchor.month, language),
    [language, monthAnchor.month, monthAnchor.year]
  );

  const weekdayLabels = useMemo(
    () => getWeekdayLabels(language, startDayOfWeek),
    [language, startDayOfWeek]
  );

  const onPrevWeek = () => {
    setScrollAnimated(true);
    if (mode === 'weekly') {
      const base = weeklyTargetWeekStart || weeklyVisibleWeekStart || titleWeekStart;
      const target = addWeeks(base, -1);
      logStripCalendar('StripCalendarShell', 'action:prevWeek', {
        mode,
        base,
        target,
      });
      setWeeklyTargetWeekStart(target);
      if (shouldRecenterWeekWindow(weekStarts, target)) {
        setWeekStarts(createWeekWindowMeasured(target, 'recenter:prevWeek'));
      }
      return;
    }

    const base = monthlyTargetWeekStart || monthlyTopWeekStart || titleWeekStart;
    const target = addWeeks(base, -1);
    logStripCalendar('StripCalendarShell', 'action:prevWeek', {
      mode,
      base,
      target,
    });
    setMonthlyTargetWeekStart(target);
    if (shouldRecenterWeekWindow(weekStarts, target)) {
      setWeekStarts(createWeekWindowMeasured(target, 'recenter:prevWeek'));
    }
  };

  const onNextWeek = () => {
    setScrollAnimated(true);
    if (mode === 'weekly') {
      const base = weeklyTargetWeekStart || weeklyVisibleWeekStart || titleWeekStart;
      const target = addWeeks(base, 1);
      logStripCalendar('StripCalendarShell', 'action:nextWeek', {
        mode,
        base,
        target,
      });
      setWeeklyTargetWeekStart(target);
      if (shouldRecenterWeekWindow(weekStarts, target)) {
        setWeekStarts(createWeekWindowMeasured(target, 'recenter:nextWeek'));
      }
      return;
    }

    const base = monthlyTargetWeekStart || monthlyTopWeekStart || titleWeekStart;
    const target = addWeeks(base, 1);
    logStripCalendar('StripCalendarShell', 'action:nextWeek', {
      mode,
      base,
      target,
    });
    setMonthlyTargetWeekStart(target);
    if (shouldRecenterWeekWindow(weekStarts, target)) {
      setWeekStarts(createWeekWindowMeasured(target, 'recenter:nextWeek'));
    }
  };

  const onTodayJump = () => {
    logStripCalendar('StripCalendarShell', 'action:todayJump', {
      mode,
      todayDate,
      todayWeekStart,
    });
    setScrollAnimated(false);
    setWeeklyTargetWeekStart(null);
    setMonthlyTargetWeekStart(null);
    handleTodayJump();
  };

  const onToggleMode = (source = 'unknown') => {
    const startedAt = STRIP_CALENDAR_PERF_LOG_ENABLED ? nowPerfMs() : 0;
    const fromMode = mode;
    const toMode = mode === 'weekly' ? 'monthly' : 'weekly';

    if (STRIP_CALENDAR_PERF_LOG_ENABLED) {
      console.log(
        `[strip-calendar:ui] toggle request source=${source} from=${fromMode} to=${toMode} ` +
          `weeklyVisible=${weeklyVisibleWeekStart || 'null'} monthlyTop=${monthlyTopWeekStart || 'null'} ` +
          `anchor=${anchorWeekStart || 'null'} currentWeek=${currentWeekStart || 'null'} ` +
          `t=${formatMs(nowPerfMs())}ms`
      );
    }

    try {
      logStripCalendar('StripCalendarShell', 'action:toggleMode', {
        mode,
        source,
        weeklyTargetWeekStart,
        weeklyVisibleWeekStart,
        monthlyTopWeekStart,
        currentWeekStart,
        anchorWeekStart,
      });
      setScrollAnimated(false);

      if (mode === 'weekly') {
        const preferredWeeklyWeekStart =
          weeklyTargetWeekStart ||
          weeklyVisibleWeekStart ||
          anchorWeekStart ||
          currentWeekStart;

        if (preferredWeeklyWeekStart) {
          setMonthlyTargetWeekStart(preferredWeeklyWeekStart);
        }

        handleToggleMode({ weeklyWeekStart: preferredWeeklyWeekStart });
        return;
      }

      // Prevent stale weekly target from overriding monthly->weekly transition result.
      setWeeklyTargetWeekStart(null);
      handleToggleMode();
    } finally {
      if (STRIP_CALENDAR_PERF_LOG_ENABLED) {
        const endedAt = nowPerfMs();
        console.log(
          `[strip-calendar:ui-perf] toggle handler done source=${source} ` +
            `dt=${formatMs(endedAt - startedAt)}ms t=${formatMs(endedAt)}ms`
        );
      }
    }
  };

  const onSwipeUp = () => {
    if (mode === 'monthly') {
      onToggleMode('gesture:swipeUp');
    }
  };

  const onSwipeDown = () => {
    if (mode === 'weekly') {
      onToggleMode('gesture:swipeDown');
    }
  };

  const onWeeklySettled = (weekStart) => {
    logStripCalendar('StripCalendarShell', 'settled:weekly', {
      weekStart,
    });
    setWeeklyTargetWeekStart(null);
    handleWeeklySettled(weekStart);
  };

  const onMonthlySettled = (weekStart) => {
    logStripCalendar('StripCalendarShell', 'settled:monthly', {
      topWeekStart: weekStart,
    });
    setMonthlyTargetWeekStart(null);
    setWeeklyTargetWeekStart(null);
    handleMonthlySettled(weekStart);
  };

  return (
    <View style={styles.container}>
      <StripCalendarHeader
        title={headerTitle}
        mode={mode}
        showTodayJumpButton={showTodayJumpButton}
        onTodayJump={onTodayJump}
        onPrevWeek={onPrevWeek}
        onNextWeek={onNextWeek}
        onToggleMode={() => onToggleMode('header')}
      />

      <View style={styles.weekdayHeader}>
        {weekdayLabels.map((label, index) => (
          <Text key={`${label}-${index}`} style={styles.weekdayText}>
            {label}
          </Text>
        ))}
      </View>

      <View
        style={mode === 'weekly' ? styles.weeklyViewport : styles.monthlyViewport}
        onLayout={(event) => {
          if (!STRIP_CALENDAR_PERF_LOG_ENABLED) return;
          const width = Math.round(event.nativeEvent.layout.width || 0);
          const height = Math.round(event.nativeEvent.layout.height || 0);
          const prev = viewportLayoutRef.current;
          if (prev.mode === mode && prev.width === width && prev.height === height) return;
          viewportLayoutRef.current = { mode, width, height };
          console.log(
            `[strip-calendar:ui-perf] shell viewport layout ` +
              `mode=${mode} w=${width} h=${height} t=${formatMs(nowPerfMs())}ms`
          );
        }}
      >
        {isNavigationReady && mode === 'weekly' ? (
          <WeeklyStripList
            weekStarts={weekStarts}
            targetWeekStart={weeklyTargetWeekStart || weeklyVisibleWeekStart || anchorWeekStart || todayWeekStart || currentWeekStart}
            todayDate={todayDate}
            currentDate={currentDate}
            language={language}
            onDayPress={handleDayPress}
            onWeekSettled={onWeeklySettled}
            onSwipePrevWeek={onPrevWeek}
            onSwipeNextWeek={onNextWeek}
            scrollAnimated={scrollAnimated}
          />
        ) : null}
        {isNavigationReady && mode === 'monthly' ? (
          <Profiler id="StripCalendarMonthlySubtree" onRender={handleMonthlyReactProfilerRender}>
            <MonthlyStripList
              weekStarts={weekStarts}
              targetTopWeekStart={monthlyTargetWeekStart || monthlyTopWeekStart || anchorWeekStart || todayWeekStart || currentWeekStart}
              todayDate={todayDate}
              currentDate={currentDate}
              language={language}
              onDayPress={handleDayPress}
              onTopWeekSettled={onMonthlySettled}
              scrollAnimated={scrollAnimated}
            />
          </Profiler>
        ) : null}
      </View>

      <ModeToggleBar
        mode={mode}
        onSwipeUp={onSwipeUp}
        onSwipeDown={onSwipeDown}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  weekdayHeader: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingBottom: 2,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  weeklyViewport: {
    height: WEEK_ROW_HEIGHT,
  },
  monthlyViewport: {
    height: WEEK_ROW_HEIGHT * MONTHLY_VISIBLE_WEEK_COUNT,
  },
});
