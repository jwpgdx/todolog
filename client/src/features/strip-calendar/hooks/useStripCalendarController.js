import { useCallback, useEffect, useMemo } from 'react';
import { useStripCalendarStore } from '../store/stripCalendarStore';
import { isDateVisibleInMonthlyViewport, isTodayVisibleInMonthlyViewport, toWeekStart } from '../utils/stripCalendarDateUtils';
import { logStripCalendar } from '../utils/stripCalendarDebug';

export function useStripCalendarController({ currentDate, setCurrentDate, todayDate, startDayOfWeek }) {
  const mode = useStripCalendarStore((state) => state.mode);
  const anchorWeekStart = useStripCalendarStore((state) => state.anchorWeekStart);
  const weeklyVisibleWeekStart = useStripCalendarStore((state) => state.weeklyVisibleWeekStart);
  const monthlyTopWeekStart = useStripCalendarStore((state) => state.monthlyTopWeekStart);
  const showTodayJumpButton = useStripCalendarStore((state) => state.showTodayJumpButton);

  const currentWeekStart = useMemo(
    () => toWeekStart(currentDate, startDayOfWeek),
    [currentDate, startDayOfWeek]
  );

  const todayWeekStart = useMemo(
    () => toWeekStart(todayDate, startDayOfWeek),
    [todayDate, startDayOfWeek]
  );

  useEffect(() => {
    // Batch init defaults in one store update to reduce nested updates on mount.
    const patch = {};
    if (!anchorWeekStart) patch.anchorWeekStart = currentWeekStart;
    if (!weeklyVisibleWeekStart) patch.weeklyVisibleWeekStart = currentWeekStart;
    if (!monthlyTopWeekStart) patch.monthlyTopWeekStart = currentWeekStart;

    if (Object.keys(patch).length === 0) return;

    logStripCalendar('useStripCalendarController', 'init:batchDefaults', {
      currentWeekStart,
      patch,
    });
    useStripCalendarStore.setState(patch);
  }, [
    anchorWeekStart,
    currentWeekStart,
    monthlyTopWeekStart,
    weeklyVisibleWeekStart,
  ]);

  const computeShowTodayJumpButton = useCallback(
    (nextMode, weeklyWeekStart, monthlyWeekStart) => {
      if (nextMode === 'weekly') {
        return todayWeekStart !== weeklyWeekStart;
      }

      return !isTodayVisibleInMonthlyViewport(monthlyWeekStart, todayDate);
    },
    [todayDate, todayWeekStart]
  );

  useEffect(() => {
    if (!weeklyVisibleWeekStart || !monthlyTopWeekStart) return;
    const next = computeShowTodayJumpButton(mode, weeklyVisibleWeekStart, monthlyTopWeekStart);
    // Avoid redundant store updates during toggle/settle where we already set the same value.
    useStripCalendarStore.setState((state) => {
      if (state.showTodayJumpButton === next) return state;
      return { showTodayJumpButton: next };
    });
  }, [computeShowTodayJumpButton, mode, monthlyTopWeekStart, weeklyVisibleWeekStart]);

  const handleWeeklySettled = useCallback(
    (weekStart) => {
      logStripCalendar('useStripCalendarController', 'action:handleWeeklySettled', {
        weekStart,
        monthlyTopWeekStart,
      });
      const nextShowToday = computeShowTodayJumpButton('weekly', weekStart, monthlyTopWeekStart || weekStart);
      useStripCalendarStore.setState((state) => {
        if (
          state.weeklyVisibleWeekStart === weekStart &&
          state.anchorWeekStart === weekStart &&
          state.showTodayJumpButton === nextShowToday
        ) {
          return state;
        }
        return {
          weeklyVisibleWeekStart: weekStart,
          anchorWeekStart: weekStart,
          showTodayJumpButton: nextShowToday,
        };
      });
    },
    [computeShowTodayJumpButton, monthlyTopWeekStart]
  );

  const handleMonthlySettled = useCallback(
    (topWeekStart) => {
      logStripCalendar('useStripCalendarController', 'action:handleMonthlySettled', {
        topWeekStart,
        weeklyVisibleWeekStart,
      });
      const nextShowToday = computeShowTodayJumpButton('monthly', weeklyVisibleWeekStart || topWeekStart, topWeekStart);
      useStripCalendarStore.setState((state) => {
        if (
          state.monthlyTopWeekStart === topWeekStart &&
          state.anchorWeekStart === topWeekStart &&
          state.showTodayJumpButton === nextShowToday
        ) {
          return state;
        }
        return {
          monthlyTopWeekStart: topWeekStart,
          anchorWeekStart: topWeekStart,
          showTodayJumpButton: nextShowToday,
        };
      });
    },
    [computeShowTodayJumpButton, weeklyVisibleWeekStart]
  );

  const handleToggleMode = useCallback((options = {}) => {
    const preferredWeeklyWeekStart = options.weeklyWeekStart || null;

    logStripCalendar('useStripCalendarController', 'action:handleToggleMode:start', {
      mode,
      preferredWeeklyWeekStart,
      weeklyVisibleWeekStart,
      monthlyTopWeekStart,
      currentWeekStart,
      anchorWeekStart,
    });

    if (mode === 'weekly') {
      const nextTop =
        preferredWeeklyWeekStart ||
        weeklyVisibleWeekStart ||
        anchorWeekStart ||
        currentWeekStart;
      logStripCalendar('useStripCalendarController', 'action:handleToggleMode:toMonthly', {
        nextTop,
      });
      const nextShowToday = computeShowTodayJumpButton('monthly', weeklyVisibleWeekStart || nextTop, nextTop);
      useStripCalendarStore.setState((state) => {
        if (
          state.mode === 'monthly' &&
          state.monthlyTopWeekStart === nextTop &&
          state.anchorWeekStart === nextTop &&
          state.showTodayJumpButton === nextShowToday
        ) {
          return state;
        }
        return {
          monthlyTopWeekStart: nextTop,
          anchorWeekStart: nextTop,
          mode: 'monthly',
          showTodayJumpButton: nextShowToday,
        };
      });
      return;
    }

    const baseTopWeekStart = monthlyTopWeekStart || currentWeekStart;
    const isCurrentDateVisibleFromTop =
      monthlyTopWeekStart && currentDate
        ? isDateVisibleInMonthlyViewport(monthlyTopWeekStart, currentDate)
        : true;
    const nextWeek = isCurrentDateVisibleFromTop
      ? (currentWeekStart || baseTopWeekStart)
      : baseTopWeekStart;

    logStripCalendar('useStripCalendarController', 'action:handleToggleMode:toWeekly', {
      baseTopWeekStart,
      currentDate,
      currentWeekStart,
      isCurrentDateVisibleFromTop,
      nextWeek,
    });
    const nextShowToday = computeShowTodayJumpButton('weekly', nextWeek, monthlyTopWeekStart || nextWeek);
    useStripCalendarStore.setState((state) => {
      if (
        state.mode === 'weekly' &&
        state.weeklyVisibleWeekStart === nextWeek &&
        state.anchorWeekStart === nextWeek &&
        state.showTodayJumpButton === nextShowToday
      ) {
        return state;
      }
      return {
        weeklyVisibleWeekStart: nextWeek,
        anchorWeekStart: nextWeek,
        mode: 'weekly',
        showTodayJumpButton: nextShowToday,
      };
    });
  }, [
    anchorWeekStart,
    currentDate,
    currentWeekStart,
    computeShowTodayJumpButton,
    mode,
    monthlyTopWeekStart,
    weeklyVisibleWeekStart,
  ]);

  const handleDayPress = useCallback(
    (date) => {
      logStripCalendar('useStripCalendarController', 'action:handleDayPress', {
        date,
      });
      setCurrentDate(date);
    },
    [setCurrentDate]
  );

  const handleTodayJump = useCallback(() => {
    logStripCalendar('useStripCalendarController', 'action:handleTodayJump:start', {
      mode,
      todayDate,
      todayWeekStart,
      weeklyVisibleWeekStart,
      monthlyTopWeekStart,
    });
    setCurrentDate(todayDate);

    if (mode === 'weekly') {
      const nextShowToday = computeShowTodayJumpButton('weekly', todayWeekStart, monthlyTopWeekStart || todayWeekStart);
      useStripCalendarStore.setState((state) => {
        if (
          state.weeklyVisibleWeekStart === todayWeekStart &&
          state.anchorWeekStart === todayWeekStart &&
          state.showTodayJumpButton === nextShowToday
        ) {
          return state;
        }
        return {
          weeklyVisibleWeekStart: todayWeekStart,
          anchorWeekStart: todayWeekStart,
          showTodayJumpButton: nextShowToday,
        };
      });
      logStripCalendar('useStripCalendarController', 'action:handleTodayJump:weeklyDone', {
        todayWeekStart,
      });
      return todayWeekStart;
    }

    const nextShowToday = computeShowTodayJumpButton('monthly', weeklyVisibleWeekStart || todayWeekStart, todayWeekStart);
    useStripCalendarStore.setState((state) => {
      if (
        state.monthlyTopWeekStart === todayWeekStart &&
        state.anchorWeekStart === todayWeekStart &&
        state.showTodayJumpButton === nextShowToday
      ) {
        return state;
      }
      return {
        monthlyTopWeekStart: todayWeekStart,
        anchorWeekStart: todayWeekStart,
        showTodayJumpButton: nextShowToday,
      };
    });
    logStripCalendar('useStripCalendarController', 'action:handleTodayJump:monthlyDone', {
      todayWeekStart,
    });
    return todayWeekStart;
  }, [
    computeShowTodayJumpButton,
    mode,
    monthlyTopWeekStart,
    setCurrentDate,
    todayDate,
    todayWeekStart,
    weeklyVisibleWeekStart,
  ]);

  return {
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
  };
}
