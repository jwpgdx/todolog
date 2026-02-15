import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import WeekRow from './WeekRow';
import { addWeeks, getWeekDates } from '../utils/stripCalendarDateUtils';
import {
  DEBUG_STRIP_CALENDAR,
  WEEK_ROW_HEIGHT,
  WEEKLY_DRIFT_CORRECTION_THRESHOLD_PX,
  WEEKLY_LAYOUT_PAGE_DEBUG_SAMPLE_LIMIT,
  WEEKLY_WEB_PROGRAMMATIC_SETTLE_DELAY_MS,
  WEEKLY_SCROLL_SAMPLE_LIMIT,
  WEEKLY_VIEWABILITY_PERCENT_THRESHOLD,
} from '../utils/stripCalendarConstants';
import { logStripCalendar } from '../utils/stripCalendarDebug';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function WeeklyStripList({
  weekStarts,
  targetWeekStart,
  todayDate,
  currentDate,
  language,
  getSummaryByDate,
  onDayPress,
  onWeekSettled,
  scrollAnimated = false,
}) {
  const listRef = useRef(null);
  const lastSyncedTargetRef = useRef(null);
  const lastSyncedWidthRef = useRef(null);
  const lastEmittedSettledRef = useRef(null);
  const hasInitializedSyncRef = useRef(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [isInitialAligned, setIsInitialAligned] = useState(false);
  const pageLayoutLoggedRef = useRef(new Set());
  const scrollSampleCountRef = useRef(0);
  const viewabilityConfigRef = useRef({ itemVisiblePercentThreshold: WEEKLY_VIEWABILITY_PERCENT_THRESHOLD });

  const keyExtractor = useCallback((item) => item, []);

  const weekIndexMap = useMemo(() => {
    const map = new Map();
    weekStarts.forEach((weekStart, index) => map.set(weekStart, index));
    return map;
  }, [weekStarts]);

  const targetPrevWeekStart = targetWeekStart ? addWeeks(targetWeekStart, -1) : null;
  const targetNextWeekStart = targetWeekStart ? addWeeks(targetWeekStart, 1) : null;

  const renderItem = useCallback(
    ({ item, index }) => {
      const weekDays = getWeekDates(item, todayDate, currentDate, language);
      return (
        <View
          style={[styles.page, { width: viewportWidth }]}
          onLayout={
            DEBUG_STRIP_CALENDAR
              ? (event) => {
                const isNearTarget =
                  item === targetWeekStart ||
                  item === targetPrevWeekStart ||
                  item === targetNextWeekStart;
                const shouldSample = pageLayoutLoggedRef.current.size < WEEKLY_LAYOUT_PAGE_DEBUG_SAMPLE_LIMIT;
                if (!isNearTarget && !shouldSample) return;
                if (pageLayoutLoggedRef.current.has(item)) return;

                pageLayoutLoggedRef.current.add(item);
                logStripCalendar('WeeklyStripList', 'layout:page', {
                  weekStart: item,
                  index,
                  x: event.nativeEvent.layout.x,
                  width: event.nativeEvent.layout.width,
                  viewportWidth,
                  targetWeekStart,
                });
              }
              : undefined
          }
        >
          <WeekRow
            weekStart={item}
            weekDays={weekDays}
            getSummaryByDate={getSummaryByDate}
            onDayPress={onDayPress}
          />
        </View>
      );
    },
    [
      currentDate,
      getSummaryByDate,
      language,
      onDayPress,
      targetNextWeekStart,
      targetPrevWeekStart,
      targetWeekStart,
      todayDate,
      viewportWidth,
    ]
  );

  const settleByOffset = useCallback(
    (offsetX, source = 'momentum') => {
      if (!viewportWidth || !weekStarts.length) return;

      const maxIndex = weekStarts.length - 1;
      const rawIndex = offsetX / viewportWidth;
      const snappedIndex = Math.max(0, Math.min(maxIndex, Math.round(rawIndex)));
      const snappedOffset = snappedIndex * viewportWidth;
      const drift = offsetX - snappedOffset;
      const weekStart = weekStarts[snappedIndex];

      logStripCalendar('WeeklyStripList', 'settle:quantize', {
        source,
        offsetX,
        width: viewportWidth,
        rawIndex,
        snappedIndex,
        snappedOffset,
        drift,
        weekStart,
      });

      if (Math.abs(drift) > WEEKLY_DRIFT_CORRECTION_THRESHOLD_PX) {
        logStripCalendar('WeeklyStripList', 'settle:quantizeCorrection', {
          source,
          snappedIndex,
          snappedOffset,
          drift,
        });
        listRef.current?.scrollToOffset({ offset: snappedOffset, animated: false });
      }

      if (weekStart) {
        if (lastEmittedSettledRef.current === weekStart) {
          logStripCalendar('WeeklyStripList', 'settle:skipDuplicate', {
            source,
            weekStart,
          });
          return;
        }

        lastSyncedTargetRef.current = weekStart;
        lastEmittedSettledRef.current = weekStart;
        onWeekSettled(weekStart);
      }
    },
    [onWeekSettled, viewportWidth, weekStarts]
  );

  const onMomentumScrollEnd = useCallback(
    (event) => {
      settleByOffset(event.nativeEvent.contentOffset.x, 'momentumEnd');
    },
    [settleByOffset]
  );

  const targetIndex = targetWeekStart ? weekIndexMap.get(targetWeekStart) : null;

  const scrollToWeekIndex = useCallback((index, animated, reason) => {
    const offset = viewportWidth * index;
    logStripCalendar('WeeklyStripList', 'sync:scrollToOffset', {
      index,
      offset,
      width: viewportWidth,
      animated,
      reason,
    });
    listRef.current?.scrollToOffset({ offset, animated });
  }, [viewportWidth]);

  useEffect(() => {
    if (targetIndex == null) {
      setIsInitialAligned(true);
    }
  }, [targetIndex]);

  useEffect(() => {
    logStripCalendar('WeeklyStripList', 'mount', {
      dataLength: weekStarts.length,
      targetWeekStart,
      targetIndex,
      screenWidth: SCREEN_WIDTH,
      dimensionWindowWidth: Dimensions.get('window').width,
      dimensionScreenWidth: Dimensions.get('screen').width,
      webInnerWidth: typeof window !== 'undefined' ? window.innerWidth : null,
    });

    return () => {
      logStripCalendar('WeeklyStripList', 'unmount', {
        targetWeekStart,
      });
    };
  }, []);

  const onScroll = useCallback(
    (event) => {
      if (scrollSampleCountRef.current >= WEEKLY_SCROLL_SAMPLE_LIMIT) return;
      scrollSampleCountRef.current += 1;
      logStripCalendar('WeeklyStripList', 'scroll:sample', {
        x: event.nativeEvent.contentOffset.x,
        width: viewportWidth,
        sample: scrollSampleCountRef.current,
      });
    },
    [viewportWidth]
  );

  const onViewableItemsChangedRef = useRef(({ viewableItems }) => {
    const normalized = viewableItems
      .map((v) => ({
        index: v.index,
        weekStart: v.item,
        isViewable: v.isViewable,
      }))
      .filter((v) => v.isViewable);

    logStripCalendar('WeeklyStripList', 'viewability:changed', {
      visible: normalized,
    });
  });

  useEffect(() => {
    if (!targetWeekStart) return;
    const index = targetIndex;
    if (index == null) return;
    if (!viewportWidth) {
      logStripCalendar('WeeklyStripList', 'sync:skipWidthNotReady', {
        targetWeekStart,
        index,
      });
      return;
    }

    const isInitialSync = !hasInitializedSyncRef.current;
    hasInitializedSyncRef.current = true;

    if (
      !isInitialSync &&
      lastSyncedTargetRef.current === targetWeekStart &&
      lastSyncedWidthRef.current === viewportWidth
    ) {
      logStripCalendar('WeeklyStripList', 'sync:skipAlreadySynced', {
        targetWeekStart,
        index,
        width: viewportWidth,
      });
      return;
    }

    const animated = isInitialSync ? false : scrollAnimated;

    logStripCalendar('WeeklyStripList', 'sync:scrollToIndex', {
      targetWeekStart,
      index,
      scrollAnimated: animated,
      isInitialSync,
      lastSyncedTarget: lastSyncedTargetRef.current,
      lastSyncedWidth: lastSyncedWidthRef.current,
      width: viewportWidth,
    });

    requestAnimationFrame(() => {
      scrollToWeekIndex(index, animated, isInitialSync ? 'initialSync' : 'targetOrWidthChange');
    });
    lastSyncedTargetRef.current = targetWeekStart;
    lastSyncedWidthRef.current = viewportWidth;

    if (isInitialSync) {
      const timeoutId = setTimeout(() => {
        setIsInitialAligned(true);
        logStripCalendar('WeeklyStripList', 'sync:initialAlignmentDone', {
          targetWeekStart,
          index,
          width: viewportWidth,
        });
      }, 0);
      return () => clearTimeout(timeoutId);
    }

    if (!isInitialSync && Platform.OS === 'web') {
      const timeoutId = setTimeout(() => {
        logStripCalendar('WeeklyStripList', 'settle:fallbackWebProgrammatic', {
          targetWeekStart,
          index,
        });
        settleByOffset(index * viewportWidth, 'fallbackWebProgrammatic');
      }, animated ? WEEKLY_WEB_PROGRAMMATIC_SETTLE_DELAY_MS : 0);

      return () => clearTimeout(timeoutId);
    }

    return undefined;
  }, [scrollAnimated, scrollToWeekIndex, settleByOffset, targetIndex, targetWeekStart, viewportWidth]);

  return (
    <View
      style={[styles.listContainer, !isInitialAligned && styles.hiddenBeforeAlign]}
      onLayout={(event) => {
        const width = Math.round(event.nativeEvent.layout.width || 0);
        if (width > 0 && width !== viewportWidth) {
          setViewportWidth(width);
          logStripCalendar('WeeklyStripList', 'layout:viewportWidthUpdated', {
            width,
            x: event.nativeEvent.layout.x,
            y: event.nativeEvent.layout.y,
            height: event.nativeEvent.layout.height,
          });
        }
      }}
    >
      {viewportWidth > 0 ? (
        <FlashList
          ref={listRef}
          data={weekStarts}
          horizontal
          pagingEnabled={false}
          snapToInterval={viewportWidth}
          snapToAlignment="start"
          decelerationRate="fast"
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          estimatedItemSize={viewportWidth}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
          onScroll={DEBUG_STRIP_CALENDAR ? onScroll : undefined}
          scrollEventThrottle={DEBUG_STRIP_CALENDAR ? 16 : undefined}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onViewableItemsChanged={DEBUG_STRIP_CALENDAR ? onViewableItemsChangedRef.current : undefined}
          viewabilityConfig={DEBUG_STRIP_CALENDAR ? viewabilityConfigRef.current : undefined}
          getItemType={() => 'week'}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    width: '100%',
    height: WEEK_ROW_HEIGHT,
  },
  hiddenBeforeAlign: {
    opacity: 0,
  },
  page: {
    height: WEEK_ROW_HEIGHT,
  },
  contentContainer: {
    paddingHorizontal: 0,
  },
});
