/**
 * useTodoCalendarData Hook
 * 
 * Responsibilities:
 * - Detect visible months from CalendarList
 * - Calculate prefetch range (visible ±2 months)
 * - Filter uncached months
 * - Batch fetch and update store
 * - Refetch invalidated months on screen focus
 * 
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */

import { useCallback, useRef } from 'react';
import { useTodoCalendarStore } from '../store/todoCalendarStore';
import { fetchCalendarDataForMonths } from '../services/calendarTodoService';
import { createMonthMetadata } from '../utils/calendarHelpers';
import dayjs from 'dayjs';

/**
 * Hook for fetching calendar todo data based on visible months
 * 
 * @param {number} startDayOfWeek - 0 (Sunday) or 1 (Monday)
 * @returns {{ 
 *   onVisibleMonthsChange: (viewableItems: Array) => void,
 *   refetchInvalidated: () => Promise<void>
 * }}
 */
export function useTodoCalendarData(startDayOfWeek = 0) {
  const isFetchingRef = useRef(false);
  const lastVisibleRef = useRef([]); // Store last visible items for refetch
  const hasMonth = useTodoCalendarStore(state => state.hasMonth);
  const setBatchMonthData = useTodoCalendarStore(state => state.setBatchMonthData);

  /**
   * Core fetch logic: fetch uncached months from viewable items
   * Used by both onVisibleMonthsChange and refetchInvalidated
   * 
   * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
   */
  const fetchUncachedMonths = useCallback(async (viewableItems) => {
    if (viewableItems.length === 0) return;
    if (isFetchingRef.current) {
      console.log('[useTodoCalendarData] Already fetching, skipping...');
      return;
    }

    // 1. Calculate visible month range
    const firstVisible = viewableItems[0].item;
    const lastVisible = viewableItems[viewableItems.length - 1].item;

    console.log(`[useTodoCalendarData] Visible months: ${firstVisible.id} ~ ${lastVisible.id}`);

    // 2. Expand range with ±2 month buffer for prefetch
    const bufferStart = dayjs(`${firstVisible.year}-${String(firstVisible.month).padStart(2, '0')}-01`)
      .subtract(2, 'month');
    const bufferEnd = dayjs(`${lastVisible.year}-${String(lastVisible.month).padStart(2, '0')}-01`)
      .add(2, 'month');

    // 3. Generate all month metadata in range
    const allMonths = [];
    let cursor = bufferStart;
    while (cursor.isBefore(bufferEnd) || cursor.isSame(bufferEnd, 'month')) {
      allMonths.push(createMonthMetadata(cursor.year(), cursor.month() + 1));
      cursor = cursor.add(1, 'month');
    }

    console.log(`[useTodoCalendarData] Prefetch range (±2): ${allMonths[0].id} ~ ${allMonths[allMonths.length - 1].id} (${allMonths.length} months)`);

    // 4. Filter uncached months
    const uncachedMonths = allMonths.filter(m => !hasMonth(m.id));

    if (uncachedMonths.length === 0) {
      console.log('[useTodoCalendarData] All months cached, no fetch needed');
      return;
    }

    console.log(`[useTodoCalendarData] Cache miss: ${uncachedMonths.map(m => m.id).join(', ')} (${uncachedMonths.length} months)`);

    // 5. Batch fetch
    isFetchingRef.current = true;
    try {
      const startTime = performance.now();
      const { todosMap, completionsMap } = await fetchCalendarDataForMonths(
        uncachedMonths,
        startDayOfWeek
      );
      const endTime = performance.now();
      
      console.log(`[useTodoCalendarData] Fetched ${uncachedMonths.length} months in ${(endTime - startTime).toFixed(2)}ms`);
      
      // 6. Update store
      setBatchMonthData(todosMap, completionsMap);
      
      console.log('[useTodoCalendarData] Store updated successfully');
    } catch (error) {
      console.error('[useTodoCalendarData] Batch fetch failed:', error);
    } finally {
      isFetchingRef.current = false;
    }
  }, [startDayOfWeek, hasMonth, setBatchMonthData]);

  /**
   * Callback for CalendarList's onViewableItemsChanged
   * Fetches data for visible months + buffer (±2 months)
   * 
   * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
   */
  const onVisibleMonthsChange = useCallback(async (viewableItems) => {
    lastVisibleRef.current = viewableItems; // Store for refetchInvalidated
    await fetchUncachedMonths(viewableItems);
  }, [fetchUncachedMonths]);

  /**
   * Refetch invalidated months on screen focus
   * Uses last visible items to determine which months to check
   * Only fetches months that have been invalidated (hasMonth === false)
   * 
   * Called by CalendarList's useFocusEffect
   */
  const refetchInvalidated = useCallback(async () => {
    if (lastVisibleRef.current.length === 0) return;
    console.log('[useTodoCalendarData] Refetching invalidated months on focus...');
    await fetchUncachedMonths(lastVisibleRef.current);
  }, [fetchUncachedMonths]);

  return { onVisibleMonthsChange, refetchInvalidated };
}
