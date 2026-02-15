import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import WeekRow from './WeekRow';
import { getWeekDates } from '../utils/stripCalendarDateUtils';
import {
  DEBUG_STRIP_CALENDAR,
  MONTHLY_DRIFT_CORRECTION_THRESHOLD_PX,
  MONTHLY_SCROLL_SAMPLE_LIMIT,
  MONTHLY_VISIBLE_WEEK_COUNT,
  MONTHLY_WEB_CORRECTION_COOLDOWN_MS,
  MONTHLY_WEB_IDLE_REARM_THRESHOLD_PX,
  MONTHLY_WEB_IDLE_SETTLE_DELAY_MS,
  MONTHLY_WEB_INITIAL_IDLE_GUARD_MS,
  MONTHLY_MIN_SCROLL_DELTA_PX,
  MONTHLY_WEB_PROGRAMMATIC_SCROLL_GUARD_MS,
  MONTHLY_WEB_PROGRAMMATIC_SETTLE_DELAY_MS,
  MONTHLY_WEB_SETTLE_HARD_COOLDOWN_MS,
  WEEK_ROW_HEIGHT,
} from '../utils/stripCalendarConstants';
import { logStripCalendar } from '../utils/stripCalendarDebug';

export default function MonthlyStripList({
  weekStarts,
  targetTopWeekStart,
  todayDate,
  currentDate,
  language,
  getSummaryByDate,
  onDayPress,
  onTopWeekSettled,
  scrollAnimated = false,
}) {
  const listRef = useRef(null);
  const lastSyncedTargetRef = useRef(null);
  const lastEmittedSettledRef = useRef(null);
  const hasInitializedSyncRef = useRef(false);
  const scrollSampleCountRef = useRef(0);
  const lastCorrectionAtRef = useRef(0);
  const webIdleSnapTimerRef = useRef(null);
  const lastScrollOffsetRef = useRef(0);
  const correctionCooldownUntilRef = useRef(0);
  const initialIdleGuardUntilRef = useRef(Date.now() + MONTHLY_WEB_INITIAL_IDLE_GUARD_MS);
  const programmaticScrollGuardUntilRef = useRef(0);
  const hasUserInteractionRef = useRef(false);
  const idleSettleArmedRef = useRef(false);
  const idleSettleLockRef = useRef(false);
  const lastSettledOffsetRef = useRef(null);
  const settleHardCooldownUntilRef = useRef(0);
  const isDraggingRef = useRef(false);
  const [isInitialAligned, setIsInitialAligned] = useState(false);

  const weekIndexMap = useMemo(() => {
    const map = new Map();
    weekStarts.forEach((weekStart, index) => map.set(weekStart, index));
    return map;
  }, [weekStarts]);

  const renderItem = useCallback(
    ({ item }) => {
      const weekDays = getWeekDates(item, todayDate, currentDate, language);
      return (
        <View style={styles.rowContainer}>
          <WeekRow
            weekStart={item}
            weekDays={weekDays}
            getSummaryByDate={getSummaryByDate}
            onDayPress={onDayPress}
          />
        </View>
      );
    },
    [currentDate, getSummaryByDate, language, onDayPress, todayDate]
  );

  const settleByOffset = useCallback(
    (offsetY, source = 'momentumEnd', options = {}) => {
      if (!weekStarts.length) return;

      const allowCorrection = options.allowCorrection ?? true;
      const correctionAnimated = options.correctionAnimated ?? false;
      const maxIndex = weekStarts.length - 1;
      const rawIndex = offsetY / WEEK_ROW_HEIGHT;
      const snappedIndex = Math.max(0, Math.min(maxIndex, Math.round(rawIndex)));
      const snappedOffset = snappedIndex * WEEK_ROW_HEIGHT;
      const drift = offsetY - snappedOffset;
      const weekStart = weekStarts[snappedIndex];
      lastSettledOffsetRef.current = snappedOffset;
      settleHardCooldownUntilRef.current = Date.now() + MONTHLY_WEB_SETTLE_HARD_COOLDOWN_MS;

      logStripCalendar('MonthlyStripList', 'momentum:settleByOffset', {
        source,
        offsetY,
        rawIndex,
        snappedIndex,
        snappedOffset,
        drift,
        allowCorrection,
        correctionAnimated,
        weekStart,
        settleHardCooldownMs: MONTHLY_WEB_SETTLE_HARD_COOLDOWN_MS,
      });

      if (allowCorrection && Math.abs(drift) > MONTHLY_DRIFT_CORRECTION_THRESHOLD_PX) {
        const now = Date.now();
        const sinceLastCorrectionMs = lastCorrectionAtRef.current
          ? now - lastCorrectionAtRef.current
          : null;
        lastCorrectionAtRef.current = now;
        correctionCooldownUntilRef.current = now + MONTHLY_WEB_CORRECTION_COOLDOWN_MS;
        if (Platform.OS === 'web') {
          programmaticScrollGuardUntilRef.current = now + MONTHLY_WEB_PROGRAMMATIC_SCROLL_GUARD_MS;
        }

        logStripCalendar('MonthlyStripList', 'settle:quantizeCorrection', {
          source,
          snappedIndex,
          snappedOffset,
          drift,
          sinceLastCorrectionMs,
          correctionAnimated,
        });
        listRef.current?.scrollToOffset({ offset: snappedOffset, animated: correctionAnimated });
      }

      if (weekStart) {
        if (lastEmittedSettledRef.current === weekStart) {
          logStripCalendar('MonthlyStripList', 'settle:skipDuplicate', {
            source,
            weekStart,
          });
          return;
        }

        lastSyncedTargetRef.current = weekStart;
        lastEmittedSettledRef.current = weekStart;
        onTopWeekSettled(weekStart);
      }
    },
    [onTopWeekSettled, weekStarts]
  );

  const onMomentumScrollEnd = useCallback(
    (event) => {
      idleSettleArmedRef.current = false;
      hasUserInteractionRef.current = false;
      idleSettleLockRef.current = true;
      settleByOffset(event.nativeEvent.contentOffset.y, 'momentumEnd', { allowCorrection: true });
    },
    [settleByOffset]
  );

  const onScrollEndDrag = useCallback(
    (event) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const velocityY = event.nativeEvent.velocity?.y ?? null;
      isDraggingRef.current = false;
      logStripCalendar('MonthlyStripList', 'drag:end', {
        platform: Platform.OS,
        offsetY,
        velocityY,
      });
    },
    []
  );

  const onScrollBeginDrag = useCallback((event) => {
    hasUserInteractionRef.current = true;
    idleSettleArmedRef.current = true;
    if (idleSettleLockRef.current) {
      logStripCalendar('MonthlyStripList', 'idle:unlockByDrag', {
        offsetY: event.nativeEvent.contentOffset.y,
      });
    }
    idleSettleLockRef.current = false;
    isDraggingRef.current = true;
    logStripCalendar('MonthlyStripList', 'drag:begin', {
      offsetY: event.nativeEvent.contentOffset.y,
    });
  }, []);

  const onMomentumScrollBegin = useCallback((event) => {
    hasUserInteractionRef.current = true;
    idleSettleArmedRef.current = true;
    if (idleSettleLockRef.current) {
      logStripCalendar('MonthlyStripList', 'idle:unlockByMomentum', {
        offsetY: event.nativeEvent.contentOffset.y,
      });
    }
    idleSettleLockRef.current = false;
    logStripCalendar('MonthlyStripList', 'momentum:begin', {
      offsetY: event.nativeEvent.contentOffset.y,
    });
  }, []);

  const onScroll = useCallback((event) => {
    const now = Date.now();
    const offsetY = event.nativeEvent.contentOffset.y;
    const previousOffsetY = lastScrollOffsetRef.current;
    lastScrollOffsetRef.current = offsetY;

    if (Platform.OS === 'web') {
      const settledBaseOffset = lastSettledOffsetRef.current ?? offsetY;
      const distanceFromSettled = Math.abs(offsetY - settledBaseOffset);
      if (idleSettleLockRef.current && distanceFromSettled >= MONTHLY_WEB_IDLE_REARM_THRESHOLD_PX) {
        logStripCalendar('MonthlyStripList', 'idle:unlockByDistance', {
          distanceFromSettled,
          rearmThresholdPx: MONTHLY_WEB_IDLE_REARM_THRESHOLD_PX,
          offsetY,
          settledBaseOffset,
        });
        idleSettleLockRef.current = false;
      }

      const canTreatAsUserScroll =
        now >= initialIdleGuardUntilRef.current &&
        now >= programmaticScrollGuardUntilRef.current &&
        now >= settleHardCooldownUntilRef.current &&
        Math.abs(offsetY - previousOffsetY) > MONTHLY_MIN_SCROLL_DELTA_PX &&
        !idleSettleLockRef.current &&
        distanceFromSettled >= MONTHLY_WEB_IDLE_REARM_THRESHOLD_PX;

      if (!hasUserInteractionRef.current && canTreatAsUserScroll) {
        logStripCalendar('MonthlyStripList', 'idle:armByScroll', {
          offsetY,
          previousOffsetY,
          distanceFromSettled,
          rearmThresholdPx: MONTHLY_WEB_IDLE_REARM_THRESHOLD_PX,
        });
        hasUserInteractionRef.current = true;
        idleSettleArmedRef.current = true;
      }

      if (now < initialIdleGuardUntilRef.current) {
        if (webIdleSnapTimerRef.current) {
          clearTimeout(webIdleSnapTimerRef.current);
        }
      } else if (now < correctionCooldownUntilRef.current) {
        if (!DEBUG_STRIP_CALENDAR) return;
      } else if (now < settleHardCooldownUntilRef.current) {
        if (webIdleSnapTimerRef.current) {
          clearTimeout(webIdleSnapTimerRef.current);
        }
        if (!DEBUG_STRIP_CALENDAR) return;
      } else {
        if (!hasUserInteractionRef.current || !idleSettleArmedRef.current) {
          if (!DEBUG_STRIP_CALENDAR) return;
        } else {
          if (webIdleSnapTimerRef.current) {
            clearTimeout(webIdleSnapTimerRef.current);
          }

          webIdleSnapTimerRef.current = setTimeout(() => {
            if (isDraggingRef.current) return;
            idleSettleArmedRef.current = false;
            hasUserInteractionRef.current = false;
            idleSettleLockRef.current = true;
            settleByOffset(lastScrollOffsetRef.current, 'scrollIdleWeb', {
              allowCorrection: true,
              correctionAnimated: false,
            });
          }, MONTHLY_WEB_IDLE_SETTLE_DELAY_MS);
        }
      }
    }

    if (!DEBUG_STRIP_CALENDAR) return;

    // Reduce debug logging pressure while preserving visibility.
    if (scrollSampleCountRef.current >= MONTHLY_SCROLL_SAMPLE_LIMIT) return;
    scrollSampleCountRef.current += 1;
    if (scrollSampleCountRef.current % 2 !== 0) return;

    logStripCalendar('MonthlyStripList', 'scroll:sample', {
      y: offsetY,
      sample: scrollSampleCountRef.current,
    });
  }, [settleByOffset]);

  const keyExtractor = useCallback((item) => item, []);
  const targetIndex = targetTopWeekStart ? weekIndexMap.get(targetTopWeekStart) : null;

  useEffect(() => {
    if (targetIndex == null) {
      setIsInitialAligned(true);
    }
  }, [targetIndex]);

  const onScrollToIndexFailed = useCallback((info) => {
    logStripCalendar('MonthlyStripList', 'scrollToIndexFailed', {
      index: info.index,
      highestMeasuredFrameIndex: info.highestMeasuredFrameIndex,
      averageItemLength: info.averageItemLength,
    });
    listRef.current?.scrollToOffset({
      offset: info.averageItemLength * info.index,
      animated: false,
    });
  }, []);

  useEffect(() => {
    logStripCalendar('MonthlyStripList', 'mount', {
      dataLength: weekStarts.length,
      targetTopWeekStart,
      targetIndex,
    });

    return () => {
      if (webIdleSnapTimerRef.current) {
        clearTimeout(webIdleSnapTimerRef.current);
      }
      logStripCalendar('MonthlyStripList', 'unmount', {
        targetTopWeekStart,
      });
    };
  }, []);

  useEffect(() => {
    if (!targetTopWeekStart) return;
    const index = targetIndex;
    if (index == null) return;

    const isInitialSync = !hasInitializedSyncRef.current;
    hasInitializedSyncRef.current = true;

    if (!isInitialSync && lastSyncedTargetRef.current === targetTopWeekStart) {
      logStripCalendar('MonthlyStripList', 'sync:skipAlreadySynced', {
        targetTopWeekStart,
        index,
      });
      return;
    }

    const animated = isInitialSync ? false : scrollAnimated;

    logStripCalendar('MonthlyStripList', 'sync:scrollToIndex', {
      targetTopWeekStart,
      index,
      scrollAnimated: animated,
      isInitialSync,
      lastSyncedTarget: lastSyncedTargetRef.current,
    });

    lastSyncedTargetRef.current = targetTopWeekStart;
    if (Platform.OS === 'web') {
      const now = Date.now();
      initialIdleGuardUntilRef.current = now + MONTHLY_WEB_INITIAL_IDLE_GUARD_MS;
      programmaticScrollGuardUntilRef.current = now + MONTHLY_WEB_PROGRAMMATIC_SCROLL_GUARD_MS;
      hasUserInteractionRef.current = false;
      idleSettleArmedRef.current = false;
      idleSettleLockRef.current = true;
      lastSettledOffsetRef.current = index * WEEK_ROW_HEIGHT;
    }

    if (isInitialSync) {
      const timeoutId = setTimeout(() => {
        setIsInitialAligned(true);
        logStripCalendar('MonthlyStripList', 'sync:initialAlignmentDone', {
          targetTopWeekStart,
          index,
        });
      }, 0);

      return () => clearTimeout(timeoutId);
    }

    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index, animated });
    });

    if (!isInitialSync && Platform.OS === 'web') {
      const timeoutId = setTimeout(() => {
        logStripCalendar('MonthlyStripList', 'settle:fallbackWebProgrammatic', {
          targetTopWeekStart,
          index,
        });
        settleByOffset(index * WEEK_ROW_HEIGHT, 'fallbackWebProgrammatic', { allowCorrection: false });
      }, animated ? MONTHLY_WEB_PROGRAMMATIC_SETTLE_DELAY_MS : 0);

      return () => clearTimeout(timeoutId);
    }

    return undefined;
  }, [scrollAnimated, settleByOffset, targetIndex, targetTopWeekStart]);

  return (
    <View style={[styles.viewport, !isInitialAligned && styles.hiddenBeforeAlign]}>
      <FlashList
        ref={listRef}
        data={weekStarts}
        initialScrollIndex={targetIndex ?? 0}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        estimatedItemSize={WEEK_ROW_HEIGHT}
        pagingEnabled={false}
        snapToInterval={WEEK_ROW_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        onScrollBeginDrag={onScrollBeginDrag}
        onScroll={onScroll}
        scrollEventThrottle={32}
        onMomentumScrollBegin={onMomentumScrollBegin}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollEndDrag={onScrollEndDrag}
        onScrollToIndexFailed={onScrollToIndexFailed}
        showsVerticalScrollIndicator={false}
        getItemType={() => 'week'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    height: WEEK_ROW_HEIGHT * MONTHLY_VISIBLE_WEEK_COUNT,
  },
  hiddenBeforeAlign: {
    opacity: 0,
  },
  rowContainer: {
    height: WEEK_ROW_HEIGHT,
  },
});
