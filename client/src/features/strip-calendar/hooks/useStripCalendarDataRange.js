import { useCallback, useEffect, useMemo } from 'react';
import { ensureRangeLoaded, selectDaySummaries } from '../services/stripCalendarDataAdapter';
import { useStripCalendarStore } from '../store/stripCalendarStore';
import { addDays } from '../utils/stripCalendarDateUtils';
import { buildEmptySummary } from '../services/stripCalendarSummaryService';
import { logStripCalendar } from '../utils/stripCalendarDebug';

// Phase 3 recurrence path 확정 전까지 strip-calendar의 일정 조회/표시 비활성화
const ENABLE_STRIP_CALENDAR_SUMMARY = false;

function getWeeklyRange(weekStart) {
  return {
    startDate: addDays(weekStart, -14),
    endDate: addDays(weekStart, 20),
  };
}

function getMonthlyRange(topWeekStart) {
  return {
    startDate: addDays(topWeekStart, -14),
    endDate: addDays(topWeekStart, 48),
  };
}

export function useStripCalendarDataRange({ mode, weeklyVisibleWeekStart, monthlyTopWeekStart }) {
  const summariesByDate = useStripCalendarStore((state) => state.summariesByDate);
  const loadedRanges = useStripCalendarStore((state) => state.loadedRanges);

  const activeRange = useMemo(() => {
    if (mode === 'weekly' && weeklyVisibleWeekStart) {
      return getWeeklyRange(weeklyVisibleWeekStart);
    }

    if (mode === 'monthly' && monthlyTopWeekStart) {
      return getMonthlyRange(monthlyTopWeekStart);
    }

    return null;
  }, [mode, weeklyVisibleWeekStart, monthlyTopWeekStart]);

  useEffect(() => {
    if (!activeRange) return;
    logStripCalendar('useStripCalendarDataRange', 'range:activeChanged', {
      mode,
      startDate: activeRange.startDate,
      endDate: activeRange.endDate,
      summaryEnabled: ENABLE_STRIP_CALENDAR_SUMMARY,
    });
  }, [activeRange, mode]);

  useEffect(() => {
    if (!activeRange) return;
    if (!ENABLE_STRIP_CALENDAR_SUMMARY) return;

    logStripCalendar('useStripCalendarDataRange', 'range:ensureLoaded', {
      mode,
      startDate: activeRange.startDate,
      endDate: activeRange.endDate,
    });

    ensureRangeLoaded({
      startDate: activeRange.startDate,
      endDate: activeRange.endDate,
      reason: `${mode}:settled`,
    }).catch((error) => {
      console.warn('[strip-calendar] ensureRangeLoaded failed:', error?.message || error);
    });
  }, [activeRange, mode, loadedRanges]);

  const summariesInRange = useMemo(() => {
    if (!activeRange) return {};
    if (!ENABLE_STRIP_CALENDAR_SUMMARY) return {};

    return selectDaySummaries({
      startDate: activeRange.startDate,
      endDate: activeRange.endDate,
    });
  }, [activeRange, summariesByDate]);

  const getSummaryByDate = useCallback(
    (date) => {
      if (!ENABLE_STRIP_CALENDAR_SUMMARY) {
        return buildEmptySummary(date);
      }
      return summariesInRange[date] || buildEmptySummary(date);
    },
    [summariesInRange]
  );

  return {
    activeRange,
    getSummaryByDate,
  };
}
