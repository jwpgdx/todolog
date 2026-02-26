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

import { useCallback, useEffect, useRef } from 'react';
import { useTodoCalendarStore } from '../store/todoCalendarStore';
import { fetchCalendarDataForMonths } from '../services/calendarTodoService';
import { createMonthMetadata } from '../utils/calendarHelpers';
import dayjs from 'dayjs';
import { pruneRangeCacheOutsideDateRange } from '../../../services/query-aggregation/cache';

const PREFETCH_BUFFER_MONTHS = 2;
const RETENTION_MONTHS_BEFORE = 6;
const RETENTION_MONTHS_AFTER = 6;
// By default, fetch all uncached months in the prefetch window.
// Keep this as a finite number only for experiments.
const MAX_FETCH_MONTHS_PER_REQUEST = Number.POSITIVE_INFINITY;

function describeVisibleRange(viewableItems = []) {
  if (!Array.isArray(viewableItems) || viewableItems.length === 0) {
    return 'empty';
  }

  const first = viewableItems[0]?.item?.id || 'unknown';
  const last = viewableItems[viewableItems.length - 1]?.item?.id || 'unknown';
  return `${first}~${last} (${viewableItems.length} items)`;
}

function createFetchTraceId() {
  return `tc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function computeRetentionWindowFromMonthMeta(monthMeta) {
  const year = Number(monthMeta?.year);
  const month = Number(monthMeta?.month);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;

  const anchor = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
  if (!anchor.isValid()) return null;

  const startMonth = anchor.startOf('month').subtract(RETENTION_MONTHS_BEFORE, 'month');
  const endMonth = anchor.startOf('month').add(RETENTION_MONTHS_AFTER, 'month');

  return {
    anchorMonthId: anchor.format('YYYY-MM'),
    startMonthId: startMonth.format('YYYY-MM'),
    endMonthId: endMonth.format('YYYY-MM'),
    startDate: startMonth.startOf('month').format('YYYY-MM-DD'),
    endDate: endMonth.endOf('month').format('YYYY-MM-DD'),
  };
}

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
  const inFlightMetaRef = useRef(null);
  const skippedWhileFetchingRef = useRef(0);
  const lastRetentionMonthRef = useRef(null);
  const isDrainingRef = useRef(false);
  const pendingVisibleRef = useRef(null);
  const pendingTriggerRef = useRef(null);
  const hasMonth = useTodoCalendarStore(state => state.hasMonth);
  const setBatchMonthData = useTodoCalendarStore(state => state.setBatchMonthData);
  const pruneToMonthWindow = useTodoCalendarStore(state => state.pruneToMonthWindow);
  const invalidationSeq = useTodoCalendarStore(state => state.invalidationSeq);

  const formatMs = (value) => Number((value || 0).toFixed(2));

  const maybePruneRetention = useCallback((anchorMonthMeta) => {
    const window = computeRetentionWindowFromMonthMeta(anchorMonthMeta);
    if (!window) return;
    if (lastRetentionMonthRef.current === window.anchorMonthId) return;
    lastRetentionMonthRef.current = window.anchorMonthId;

    pruneToMonthWindow(window.startMonthId, window.endMonthId);
    pruneRangeCacheOutsideDateRange({
      startDate: window.startDate,
      endDate: window.endDate,
      reason: `todo-calendar:retention:${window.anchorMonthId}`,
    });
  }, [pruneToMonthWindow]);

  /**
   * Core fetch logic: fetch uncached months from viewable items
   * Used by both onVisibleMonthsChange and refetchInvalidated
   * 
   * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
   */
  const fetchUncachedMonths = useCallback(async (viewableItems, { trigger = 'unknown' } = {}) => {
    if (viewableItems.length === 0) return;

    // Retention policy (Option A): keep only around the current visible month (±6 months).
    // Do this even if we skip fetching due to in-flight work, so memory doesn't grow unbounded.
    const anchorMonthMeta = viewableItems[0]?.item || null;
    if (anchorMonthMeta?.id) {
      maybePruneRetention(anchorMonthMeta);
    }

    // 1. Calculate visible month range
    const startedAt = performance.now();
    const visibleStartedAt = performance.now();
    const firstVisible = viewableItems[0].item;
    const lastVisible = viewableItems[viewableItems.length - 1].item;

    console.log(
      `[useTodoCalendarData] Visible months: ${firstVisible.id} ~ ${lastVisible.id} ` +
      `(trigger=${trigger}) ` +
      `(${formatMs(performance.now() - visibleStartedAt)}ms)`
    );

    // 2. Expand range with buffer for prefetch
    const prefetchStartedAt = performance.now();
    const bufferStart = dayjs(`${firstVisible.year}-${String(firstVisible.month).padStart(2, '0')}-01`)
      .subtract(PREFETCH_BUFFER_MONTHS, 'month');
    const bufferEnd = dayjs(`${lastVisible.year}-${String(lastVisible.month).padStart(2, '0')}-01`)
      .add(PREFETCH_BUFFER_MONTHS, 'month');

    // 3. Generate all month metadata in range
    const allMonths = [];
    let cursor = bufferStart;
    while (cursor.isBefore(bufferEnd) || cursor.isSame(bufferEnd, 'month')) {
      allMonths.push(createMonthMetadata(cursor.year(), cursor.month() + 1));
      cursor = cursor.add(1, 'month');
    }

    console.log(
      `[useTodoCalendarData] Prefetch range (±${PREFETCH_BUFFER_MONTHS}): ${allMonths[0].id} ~ ${allMonths[allMonths.length - 1].id} ` +
      `(${allMonths.length} months, ${formatMs(performance.now() - prefetchStartedAt)}ms)`
    );

    // 4. Filter uncached months (visible-first priority)
    const filterStartedAt = performance.now();
    const visibleMonths = [];
    let visibleCursor = dayjs(`${firstVisible.year}-${String(firstVisible.month).padStart(2, '0')}-01`);
    const visibleEnd = dayjs(`${lastVisible.year}-${String(lastVisible.month).padStart(2, '0')}-01`);
    while (visibleCursor.isBefore(visibleEnd) || visibleCursor.isSame(visibleEnd, 'month')) {
      visibleMonths.push(createMonthMetadata(visibleCursor.year(), visibleCursor.month() + 1));
      visibleCursor = visibleCursor.add(1, 'month');
    }

    const visibleIds = new Set(visibleMonths.map(m => m.id));
    const uncachedVisibleMonths = visibleMonths.filter(m => !hasMonth(m.id));
    const uncachedBufferMonths = allMonths.filter(m => !visibleIds.has(m.id) && !hasMonth(m.id));
    const uncachedMonths = [...uncachedVisibleMonths, ...uncachedBufferMonths];
    const filterMs = formatMs(performance.now() - filterStartedAt);

    if (uncachedMonths.length === 0) {
      console.log(`[useTodoCalendarData] All months cached, no fetch needed (${filterMs}ms)`);
      return;
    }

    const targetMonths = uncachedMonths.slice(0, MAX_FETCH_MONTHS_PER_REQUEST);
    const droppedMonthIds = uncachedMonths
      .slice(MAX_FETCH_MONTHS_PER_REQUEST)
      .map(m => m.id);

    console.log(
      `[useTodoCalendarData] Cache miss: ${uncachedMonths.map(m => m.id).join(', ')} ` +
      `(${uncachedMonths.length} months, ${filterMs}ms)`
    );
    if (droppedMonthIds.length > 0) {
      console.log(
        `[useTodoCalendarData] Fetch throttled: requesting ${targetMonths.length} month(s), ` +
        `deferred=${droppedMonthIds.join(', ')}`
      );
    }

    // 5. Batch fetch
    isFetchingRef.current = true;
    try {
      const startTime = performance.now();
      const traceId = createFetchTraceId();
      inFlightMetaRef.current = {
        startedAtMs: startTime,
        visibleRange: describeVisibleRange(viewableItems),
        monthIds: targetMonths.map(m => m.id),
        traceId,
      };
      console.log(
        `[useTodoCalendarData:trace] trace=${traceId} ` +
        `trigger=${trigger} start visible=${firstVisible.id}~${lastVisible.id} ` +
        `months=${targetMonths.length}`
      );
      const { todosMap, completionsMap } = await fetchCalendarDataForMonths(
        targetMonths,
        startDayOfWeek,
        { traceId }
      );
      const endTime = performance.now();
      
      console.log(
        `[useTodoCalendarData] Fetched ${targetMonths.length} months in ${(endTime - startTime).toFixed(2)}ms ` +
        `(trace=${traceId})`
      );
      
      // 6. Update store
      const storeStartedAt = performance.now();
      setBatchMonthData(todosMap, completionsMap);
      const storeMs = formatMs(performance.now() - storeStartedAt);
      
      console.log(
        `[useTodoCalendarData] Store updated successfully ` +
        `(store=${storeMs}ms, total=${formatMs(performance.now() - startedAt)}ms, ` +
        `trace=${traceId})`
      );
    } catch (error) {
      console.error('[useTodoCalendarData] Batch fetch failed:', error);
    } finally {
      isFetchingRef.current = false;
      inFlightMetaRef.current = null;
    }
  }, [startDayOfWeek, hasMonth, maybePruneRetention, setBatchMonthData]);

  const requestFetch = useCallback((viewableItems, { trigger = 'unknown' } = {}) => {
    if (!Array.isArray(viewableItems) || viewableItems.length === 0) return;

    // Keep last visible around for future invalidation/focus triggers.
    lastVisibleRef.current = viewableItems;

    // Retention policy should apply even when we are currently fetching.
    const anchorMonthMeta = viewableItems[0]?.item || null;
    if (anchorMonthMeta?.id) {
      maybePruneRetention(anchorMonthMeta);
    }

    // Keep only the latest request; older ones are obsolete once a newer visible range arrives.
    pendingVisibleRef.current = viewableItems;
    pendingTriggerRef.current = trigger;

    if (isDrainingRef.current) {
      skippedWhileFetchingRef.current += 1;
      const inFlight = inFlightMetaRef.current;
      const inFlightElapsedMs = inFlight?.startedAtMs != null
        ? (performance.now() - inFlight.startedAtMs).toFixed(2)
        : 'n/a';
      console.log(
        `[useTodoCalendarData] Queued while fetching trigger=${trigger} ` +
          `incoming=${describeVisibleRange(viewableItems)} ` +
          `inFlightVisible=${inFlight?.visibleRange || 'unknown'} ` +
          `inFlightMonths=${inFlight?.monthIds?.join(', ') || 'none'} ` +
          `inFlightElapsed=${inFlightElapsedMs}ms ` +
          `queuedCount=${skippedWhileFetchingRef.current}`
      );
      return;
    }

    isDrainingRef.current = true;
    skippedWhileFetchingRef.current = 0;

    (async () => {
      try {
        // Drain in a single loop so we never miss invalidations/visible changes while in-flight.
        while (pendingVisibleRef.current && pendingVisibleRef.current.length > 0) {
          const nextItems = pendingVisibleRef.current;
          const nextTrigger = pendingTriggerRef.current || 'unknown';
          pendingVisibleRef.current = null;
          pendingTriggerRef.current = null;
          await fetchUncachedMonths(nextItems, { trigger: nextTrigger });
        }
      } finally {
        isDrainingRef.current = false;
        skippedWhileFetchingRef.current = 0;
      }
    })();
  }, [fetchUncachedMonths, maybePruneRetention]);

  // Trigger a refetch when month caches are invalidated by Todo CRUD.
  // This removes "stale until focus/scroll" gaps for in-place CRUD flows (modal, inline edit, etc).
  useEffect(() => {
    if (invalidationSeq <= 0) return;
    if (lastVisibleRef.current.length === 0) return;
    requestFetch(lastVisibleRef.current, { trigger: `invalidation:${invalidationSeq}` });
  }, [invalidationSeq, requestFetch]);

  /**
   * Callback for CalendarList's onViewableItemsChanged
   * Fetches data for visible months + buffer (±2 months)
   * 
   * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
   */
  const onVisibleMonthsChange = useCallback((viewableItems) => {
    requestFetch(viewableItems, { trigger: 'viewability' });
  }, [requestFetch]);

  /**
   * Refetch invalidated months on screen focus
   * Uses last visible items to determine which months to check
   * Only fetches months that have been invalidated (hasMonth === false)
   * 
   * Called by CalendarList's useFocusEffect
   */
  const refetchInvalidated = useCallback(() => {
    if (lastVisibleRef.current.length === 0) return;
    console.log('[useTodoCalendarData] Refetching invalidated months on focus...');
    requestFetch(lastVisibleRef.current, { trigger: 'focus' });
  }, [requestFetch]);

  return { onVisibleMonthsChange, refetchInvalidated };
}
