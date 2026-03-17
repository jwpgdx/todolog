import { useCallback, useEffect, useRef } from 'react';

import { useTodoCalendarV2Store } from '../store/useTodoCalendarV2Store';

export function useTodoCalendarV2InfiniteMonths() {
  const months = useTodoCalendarV2Store((state) => state.months);
  const initializeMonths = useTodoCalendarV2Store((state) => state.initializeMonths);
  const addFutureMonths = useTodoCalendarV2Store((state) => state.addFutureMonths);
  const addPastMonths = useTodoCalendarV2Store((state) => state.addPastMonths);
  const isLoadingRef = useRef(false);

  useEffect(() => {
    initializeMonths();
  }, [initializeMonths]);

  const handleEndReached = useCallback(() => {
    if (isLoadingRef.current || months.length === 0) return;
    isLoadingRef.current = true;
    addFutureMonths(6);
    isLoadingRef.current = false;
  }, [addFutureMonths, months.length]);

  const handleStartReached = useCallback(() => {
    if (isLoadingRef.current || months.length === 0) return;
    isLoadingRef.current = true;
    addPastMonths(6);
    isLoadingRef.current = false;
  }, [addPastMonths, months.length]);

  return {
    months,
    handleEndReached,
    handleStartReached,
    initialScrollIndex: 2,
  };
}
