import { useEffect, useRef, useCallback } from 'react';
import { useCalendarStore } from '../store/calendarStore';

/**
 * useInfiniteCalendar Hook
 * 
 * Manages infinite scroll calendar logic:
 * - Initializes with current month ±2 months (total 5 months)
 * - Handles bottom scroll: append 6 future months
 * - Handles top scroll: prepend 6 past months
 * - Prevents duplicate loading with isLoadingRef
 * - Performance logging with console.time/timeEnd
 * 
 * Validates: Requirements 1.1, 1.2, 1.3, 5.1, 5.3
 * 
 * @returns {{
 *   months: Array<MonthMetadata>,
 *   handleEndReached: () => void,
 *   handleStartReached: () => void,
 *   initialScrollIndex: number
 * }}
 */
export function useInfiniteCalendar() {
  const { months, initializeMonths, addFutureMonths, addPastMonths } = useCalendarStore();
  const isLoadingRef = useRef(false);

  // Initialize months on mount
  useEffect(() => {
    console.time('[useInfiniteCalendar] Initialize');
    initializeMonths();
    console.timeEnd('[useInfiniteCalendar] Initialize');
  }, [initializeMonths]);

  /**
   * Handle bottom scroll: append 6 future months
   * Validates: Requirements 1.2, 5.1, 5.3
   */
  const handleEndReached = useCallback(() => {
    if (isLoadingRef.current) {
      console.log('[useInfiniteCalendar] Already loading, skipping handleEndReached');
      return;
    }

    if (months.length === 0) {
      console.warn('[useInfiniteCalendar] Cannot add future months: months array is empty');
      return;
    }

    isLoadingRef.current = true;

    console.time('[useInfiniteCalendar] Add 6 future months');
    addFutureMonths(6);
    console.timeEnd('[useInfiniteCalendar] Add 6 future months');

    isLoadingRef.current = false;
  }, [months.length, addFutureMonths]);

  /**
   * Handle top scroll: prepend 6 past months
   * Validates: Requirements 1.3, 5.1, 5.3
   */
  const handleStartReached = useCallback(() => {
    if (isLoadingRef.current) {
      console.log('[useInfiniteCalendar] Already loading, skipping handleStartReached');
      return;
    }

    if (months.length === 0) {
      console.warn('[useInfiniteCalendar] Cannot add past months: months array is empty');
      return;
    }

    isLoadingRef.current = true;

    console.time('[useInfiniteCalendar] Add 6 past months');
    addPastMonths(6);
    console.timeEnd('[useInfiniteCalendar] Add 6 past months');

    isLoadingRef.current = false;
  }, [months.length, addPastMonths]);

  return {
    months,
    handleEndReached,
    handleStartReached,
    initialScrollIndex: 2, // Current month is at index 2 (±2 months)
  };
}
