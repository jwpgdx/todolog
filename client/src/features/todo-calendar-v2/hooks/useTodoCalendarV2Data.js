import { useCallback, useEffect, useRef } from 'react';
import dayjs from 'dayjs';

import { fetchMonthLayoutsForMonths } from '../services/fetchMonthLayouts';
import { useTodoCalendarV2Store } from '../store/useTodoCalendarV2Store';
import { addMonthsToMonthId } from '../utils/monthLayoutUtils';
import { getCalendarDateRange } from '../../../utils/calendarMonthHelpers';

const PREFETCH_BUFFER_MONTHS = 1;
const RETENTION_MONTHS = 6;

function describeVisibleRange(viewableItems = []) {
  if (!Array.isArray(viewableItems) || viewableItems.length === 0) return 'empty';
  return `${viewableItems[0]?.item?.id || 'unknown'}~${viewableItems[viewableItems.length - 1]?.item?.id || 'unknown'}`;
}

function finalizeRequest(baseRequest, startDayOfWeek = 0) {
  if (!baseRequest?.months?.length) return null;

  const requestMonthIds = baseRequest.months.map((month) => month.id);
  const firstRequestMonth = baseRequest.months[0];
  const lastRequestMonth = baseRequest.months[baseRequest.months.length - 1];
  const firstRange = getCalendarDateRange(
    firstRequestMonth.year,
    firstRequestMonth.month,
    startDayOfWeek,
  );
  const lastRange = getCalendarDateRange(
    lastRequestMonth.year,
    lastRequestMonth.month,
    startDayOfWeek,
  );

  return {
    ...baseRequest,
    requestMonthIds,
    requestStartDate: firstRange.startDate,
    requestEndDate: lastRange.endDate,
    startDayOfWeek,
  };
}

function toVisibleContext(request) {
  if (!request) return null;

  return {
    visibleMonthIds: request.visibleMonthIds || [],
    requestMonthIds: request.requestMonthIds || [],
    anchorMonthId: request.anchorMonthId || null,
    requestKey: `${request.key}:${request.startDayOfWeek}`,
    requestStartDate: request.requestStartDate || null,
    requestEndDate: request.requestEndDate || null,
    startDayOfWeek: request.startDayOfWeek ?? 0,
  };
}

function buildVisibleRequest(viewableItems = [], startDayOfWeek = 0) {
  if (!Array.isArray(viewableItems) || viewableItems.length === 0) return null;

  const sortedItems = [...viewableItems]
    .filter((entry) => entry?.item?.id)
    .sort((left, right) => (left?.index ?? 0) - (right?.index ?? 0));
  const first = sortedItems[0]?.item;
  const last = sortedItems[sortedItems.length - 1]?.item;
  if (!first?.id || !last?.id) return null;

  const start = dayjs(`${first.id}-01`).subtract(PREFETCH_BUFFER_MONTHS, 'month');
  const end = dayjs(`${last.id}-01`).add(PREFETCH_BUFFER_MONTHS, 'month');
  const months = [];
  let cursor = start;

  while (cursor.isBefore(end) || cursor.isSame(end, 'month')) {
    months.push({
      year: cursor.year(),
      month: cursor.month() + 1,
      id: cursor.format('YYYY-MM'),
    });
    cursor = cursor.add(1, 'month');
  }

  return finalizeRequest({
    months,
    visibleMonthIds: sortedItems.map((entry) => entry.item.id),
    key: `${first.id}:${last.id}`,
    anchorMonthId: first.id,
  }, startDayOfWeek);
}

export function useTodoCalendarV2Data({ startDayOfWeek = 0, language = 'ko' } = {}) {
  const setMonthLayouts = useTodoCalendarV2Store((state) => state.setMonthLayouts);
  const pruneMonthLayouts = useTodoCalendarV2Store((state) => state.pruneMonthLayouts);
  const clearMonthLayouts = useTodoCalendarV2Store((state) => state.clearMonthLayouts);
  const hasMonthLayout = useTodoCalendarV2Store((state) => state.hasMonthLayout);
  const setVisibleContext = useTodoCalendarV2Store((state) => state.setVisibleContext);
  const reensureSeq = useTodoCalendarV2Store((state) => state.reensureSeq);
  const lastRequestKeyRef = useRef(null);
  const isFetchingRef = useRef(false);
  const pendingRequestRef = useRef(null);
  const visibleRequestRef = useRef(null);
  const lastStartDayRef = useRef(startDayOfWeek);

  const maybePruneRetention = useCallback((anchorMonthId) => {
    if (!anchorMonthId) return;
    pruneMonthLayouts(
      addMonthsToMonthId(anchorMonthId, -RETENTION_MONTHS),
      addMonthsToMonthId(anchorMonthId, RETENTION_MONTHS),
    );
  }, [pruneMonthLayouts]);

  const drain = useCallback(async () => {
    if (isFetchingRef.current) return;
    const next = pendingRequestRef.current;
    if (!next) return;

    pendingRequestRef.current = null;
    isFetchingRef.current = true;

    try {
      const monthsToFetch = next.months.filter((monthMeta) => !hasMonthLayout(monthMeta.id));
      if (monthsToFetch.length > 0) {
        const result = await fetchMonthLayoutsForMonths(monthsToFetch, {
          startDayOfWeek,
          language,
        });
        if (result.ok && result.monthLayoutsById) {
          setMonthLayouts(result.monthLayoutsById);
        }
      }
      lastRequestKeyRef.current = `${next.key}:${startDayOfWeek}`;
      maybePruneRetention(next.anchorMonthId);
    } finally {
      isFetchingRef.current = false;
      if (pendingRequestRef.current) {
        drain();
      }
    }
  }, [hasMonthLayout, language, maybePruneRetention, setMonthLayouts, startDayOfWeek]);

  useEffect(() => {
    if (lastStartDayRef.current === startDayOfWeek) return;
    lastStartDayRef.current = startDayOfWeek;
    lastRequestKeyRef.current = null;
    visibleRequestRef.current = finalizeRequest(visibleRequestRef.current, startDayOfWeek);
    pendingRequestRef.current = visibleRequestRef.current;
    clearMonthLayouts();
    setVisibleContext(toVisibleContext(visibleRequestRef.current));
    drain();
  }, [clearMonthLayouts, drain, setVisibleContext, startDayOfWeek]);

  useEffect(() => {
    if (!reensureSeq) return;
    if (!visibleRequestRef.current) return;

    pendingRequestRef.current = visibleRequestRef.current;
    drain();
  }, [drain, reensureSeq]);

  const onVisibleMonthsChange = useCallback((viewableItems) => {
    const request = buildVisibleRequest(viewableItems, startDayOfWeek);
    if (!request) return;

    visibleRequestRef.current = request;
    setVisibleContext(toVisibleContext(request));
    const requestKey = `${request.key}:${startDayOfWeek}`;
    if (requestKey === lastRequestKeyRef.current && !isFetchingRef.current) {
      maybePruneRetention(request.anchorMonthId);
      return;
    }

    pendingRequestRef.current = request;
    maybePruneRetention(request.anchorMonthId);
    drain();
  }, [drain, maybePruneRetention, setVisibleContext, startDayOfWeek]);

  return {
    onVisibleMonthsChange,
    describeVisibleRange,
  };
}
