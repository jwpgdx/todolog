import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { MONTHLY_VISIBLE_WEEK_COUNT, WEEK_ROW_HEIGHT } from '../utils/stripCalendarConstants';
import { useStripCalendarStore } from '../store/stripCalendarStore';
import { logStripCalendar } from '../utils/stripCalendarDebug';

export default function StripCalendarShell() {
  const { currentDate, setCurrentDate } = useDateStore();
  const { todayDate } = useTodayDate();
  const { data: settings = {} } = useSettings();
  const hasBootstrappedRef = useRef(false);

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

  const [weekStarts, setWeekStarts] = useState(() => createWeekWindow(currentWeekStart));
  const [weeklyTargetWeekStart, setWeeklyTargetWeekStart] = useState(null);
  const [monthlyTargetWeekStart, setMonthlyTargetWeekStart] = useState(null);
  const [scrollAnimated, setScrollAnimated] = useState(false);
  const [isNavigationReady, setIsNavigationReady] = useState(false);

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

  const { getSummaryByDate } = useStripCalendarDataRange({
    mode,
    weeklyVisibleWeekStart,
    monthlyTopWeekStart,
  });

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

    const initialWeekWindow = createWeekWindow(todayWeekStart);
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
      setWeekStarts(createWeekWindow(pivotWeekStart));
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
        setWeekStarts(createWeekWindow(target));
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
      setWeekStarts(createWeekWindow(target));
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
        setWeekStarts(createWeekWindow(target));
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
      setWeekStarts(createWeekWindow(target));
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

  const onToggleMode = () => {
    logStripCalendar('StripCalendarShell', 'action:toggleMode', {
      mode,
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
  };

  const onSwipeUp = () => {
    if (mode === 'monthly') {
      onToggleMode();
    }
  };

  const onSwipeDown = () => {
    if (mode === 'weekly') {
      onToggleMode();
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
        onToggleMode={onToggleMode}
      />

      <View style={styles.weekdayHeader}>
        {weekdayLabels.map((label, index) => (
          <Text key={`${label}-${index}`} style={styles.weekdayText}>
            {label}
          </Text>
        ))}
      </View>

      <View style={mode === 'weekly' ? styles.weeklyViewport : styles.monthlyViewport}>
        {isNavigationReady && mode === 'weekly' ? (
          <WeeklyStripList
            weekStarts={weekStarts}
            targetWeekStart={weeklyTargetWeekStart || weeklyVisibleWeekStart || anchorWeekStart || todayWeekStart || currentWeekStart}
            todayDate={todayDate}
            currentDate={currentDate}
            language={language}
            getSummaryByDate={getSummaryByDate}
            onDayPress={handleDayPress}
            onWeekSettled={onWeeklySettled}
            onSwipePrevWeek={onPrevWeek}
            onSwipeNextWeek={onNextWeek}
            scrollAnimated={scrollAnimated}
          />
        ) : null}
        {isNavigationReady && mode === 'monthly' ? (
          <MonthlyStripList
            weekStarts={weekStarts}
            targetTopWeekStart={monthlyTargetWeekStart || monthlyTopWeekStart || anchorWeekStart || todayWeekStart || currentWeekStart}
            todayDate={todayDate}
            currentDate={currentDate}
            language={language}
            getSummaryByDate={getSummaryByDate}
            onDayPress={handleDayPress}
            onTopWeekSettled={onMonthlySettled}
            scrollAnimated={scrollAnimated}
          />
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
