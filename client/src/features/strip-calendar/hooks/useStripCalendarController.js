import { useCallback, useEffect, useMemo } from 'react';
import { useStripCalendarStore } from '../store/stripCalendarStore';
import { isTodayVisibleInMonthlyViewport, toWeekStart } from '../utils/stripCalendarDateUtils';
import { logStripCalendar } from '../utils/stripCalendarDebug';

export function useStripCalendarController({ currentDate, setCurrentDate, todayDate, startDayOfWeek }) {
  const mode = useStripCalendarStore((state) => state.mode);
  const anchorWeekStart = useStripCalendarStore((state) => state.anchorWeekStart);
  const weeklyVisibleWeekStart = useStripCalendarStore((state) => state.weeklyVisibleWeekStart);
  const monthlyTopWeekStart = useStripCalendarStore((state) => state.monthlyTopWeekStart);
  const showTodayJumpButton = useStripCalendarStore((state) => state.showTodayJumpButton);

  const setMode = useStripCalendarStore((state) => state.setMode);
  const setAnchorWeekStart = useStripCalendarStore((state) => state.setAnchorWeekStart);
  const setWeeklyVisibleWeekStart = useStripCalendarStore((state) => state.setWeeklyVisibleWeekStart);
  const setMonthlyTopWeekStart = useStripCalendarStore((state) => state.setMonthlyTopWeekStart);
  const setShowTodayJumpButton = useStripCalendarStore((state) => state.setShowTodayJumpButton);

  const currentWeekStart = useMemo(
    () => toWeekStart(currentDate, startDayOfWeek),
    [currentDate, startDayOfWeek]
  );

  const todayWeekStart = useMemo(
    () => toWeekStart(todayDate, startDayOfWeek),
    [todayDate, startDayOfWeek]
  );

  useEffect(() => {
    if (!anchorWeekStart) {
      logStripCalendar('useStripCalendarController', 'init:setAnchorWeekStart', {
        currentWeekStart,
      });
      setAnchorWeekStart(currentWeekStart);
    }

    if (!weeklyVisibleWeekStart) {
      logStripCalendar('useStripCalendarController', 'init:setWeeklyVisibleWeekStart', {
        currentWeekStart,
      });
      setWeeklyVisibleWeekStart(currentWeekStart);
    }

    if (!monthlyTopWeekStart) {
      logStripCalendar('useStripCalendarController', 'init:setMonthlyTopWeekStart', {
        currentWeekStart,
      });
      setMonthlyTopWeekStart(currentWeekStart);
    }
  }, [
    anchorWeekStart,
    currentWeekStart,
    monthlyTopWeekStart,
    setAnchorWeekStart,
    setMonthlyTopWeekStart,
    setWeeklyVisibleWeekStart,
    weeklyVisibleWeekStart,
  ]);

  const evaluateTodayVisibility = useCallback(
    (nextMode, weeklyWeekStart, monthlyWeekStart) => {
      if (nextMode === 'weekly') {
        setShowTodayJumpButton(todayWeekStart !== weeklyWeekStart);
        return;
      }

      setShowTodayJumpButton(!isTodayVisibleInMonthlyViewport(monthlyWeekStart, todayDate));
    },
    [setShowTodayJumpButton, todayDate, todayWeekStart]
  );

  useEffect(() => {
    if (!weeklyVisibleWeekStart || !monthlyTopWeekStart) return;
    evaluateTodayVisibility(mode, weeklyVisibleWeekStart, monthlyTopWeekStart);
  }, [evaluateTodayVisibility, mode, monthlyTopWeekStart, weeklyVisibleWeekStart]);

  const handleWeeklySettled = useCallback(
    (weekStart) => {
      logStripCalendar('useStripCalendarController', 'action:handleWeeklySettled', {
        weekStart,
        monthlyTopWeekStart,
      });
      setWeeklyVisibleWeekStart(weekStart);
      setAnchorWeekStart(weekStart);
      evaluateTodayVisibility('weekly', weekStart, monthlyTopWeekStart || weekStart);
    },
    [evaluateTodayVisibility, monthlyTopWeekStart, setAnchorWeekStart, setWeeklyVisibleWeekStart]
  );

  const handleMonthlySettled = useCallback(
    (topWeekStart) => {
      logStripCalendar('useStripCalendarController', 'action:handleMonthlySettled', {
        topWeekStart,
        weeklyVisibleWeekStart,
      });
      setMonthlyTopWeekStart(topWeekStart);
      setAnchorWeekStart(topWeekStart);
      evaluateTodayVisibility('monthly', weeklyVisibleWeekStart || topWeekStart, topWeekStart);
    },
    [evaluateTodayVisibility, setAnchorWeekStart, setMonthlyTopWeekStart, weeklyVisibleWeekStart]
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
      setMonthlyTopWeekStart(nextTop);
      setAnchorWeekStart(nextTop);
      setMode('monthly');
      evaluateTodayVisibility('monthly', weeklyVisibleWeekStart || nextTop, nextTop);
      return;
    }

    const nextWeek = monthlyTopWeekStart || currentWeekStart;
    logStripCalendar('useStripCalendarController', 'action:handleToggleMode:toWeekly', {
      nextWeek,
    });
    setWeeklyVisibleWeekStart(nextWeek);
    setAnchorWeekStart(nextWeek);
    setMode('weekly');
    evaluateTodayVisibility('weekly', nextWeek, monthlyTopWeekStart || nextWeek);
  }, [
    anchorWeekStart,
    currentWeekStart,
    evaluateTodayVisibility,
    mode,
    monthlyTopWeekStart,
    setAnchorWeekStart,
    setMode,
    setMonthlyTopWeekStart,
    setWeeklyVisibleWeekStart,
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
      setWeeklyVisibleWeekStart(todayWeekStart);
      setAnchorWeekStart(todayWeekStart);
      evaluateTodayVisibility('weekly', todayWeekStart, monthlyTopWeekStart || todayWeekStart);
      logStripCalendar('useStripCalendarController', 'action:handleTodayJump:weeklyDone', {
        todayWeekStart,
      });
      return todayWeekStart;
    }

    setMonthlyTopWeekStart(todayWeekStart);
    setAnchorWeekStart(todayWeekStart);
    evaluateTodayVisibility('monthly', weeklyVisibleWeekStart || todayWeekStart, todayWeekStart);
    logStripCalendar('useStripCalendarController', 'action:handleTodayJump:monthlyDone', {
      todayWeekStart,
    });
    return todayWeekStart;
  }, [
    evaluateTodayVisibility,
    mode,
    monthlyTopWeekStart,
    setAnchorWeekStart,
    setCurrentDate,
    setMonthlyTopWeekStart,
    setWeeklyVisibleWeekStart,
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
    setWeeklyVisibleWeekStart,
    setMonthlyTopWeekStart,
  };
}
