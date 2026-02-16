import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import WeekRow from './WeekRow';
import { getWeekDates } from '../utils/stripCalendarDateUtils';
import {
  DEBUG_STRIP_CALENDAR,
  MONTHLY_DRIFT_CORRECTION_THRESHOLD_PX,
  MONTHLY_IDLE_SETTLE_DELAY_MS,
  MONTHLY_PROGRAMMATIC_GUARD_MS,
  MONTHLY_PROGRAMMATIC_SETTLE_DELAY_MS,
  MONTHLY_VISIBLE_WEEK_COUNT,
  WEEK_ROW_HEIGHT,
} from '../utils/stripCalendarConstants';
import { logStripCalendar } from '../utils/stripCalendarDebug';

/**
 * Scroll phase state machine:
 *   idle → dragging → momentum → settling → idle       (native)
 *   idle → dragging → settling → idle                   (web, momentum absent)
 *   idle → programmatic → settling → idle               (programmatic scroll)
 *
 * Phase 'settling' provides mutual exclusion:
 * all settle entry points are routed through requestSettle(),
 * which rejects concurrent requests while phase === 'settling'.
 */
function createInitialScrollState() {
  return {
    phase: 'idle',             // 'idle' | 'dragging' | 'momentum' | 'settling' | 'programmatic'
    lastOffset: 0,
    lastEmittedWeekStart: null,
    lastSyncedTarget: null,
    isProgrammatic: false,
    settleTimer: null,
    programmaticGuardTimer: null,
  };
}

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
  const scrollStateRef = useRef(createInitialScrollState());
  const hasInitializedSyncRef = useRef(false);
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

  // --- Core settle logic ---
  const armProgrammaticGuard = useCallback(
    (reason) => {
      const state = scrollStateRef.current;
      state.phase = 'programmatic';
      state.isProgrammatic = true;

      if (state.programmaticGuardTimer) {
        clearTimeout(state.programmaticGuardTimer);
        state.programmaticGuardTimer = null;
      }

      state.programmaticGuardTimer = setTimeout(() => {
        const latest = scrollStateRef.current;
        if (latest.phase === 'programmatic') {
          latest.phase = 'idle';
        }
        latest.isProgrammatic = false;
        latest.programmaticGuardTimer = null;
        logStripCalendar('MonthlyStripList', 'guard:programmaticReleased', {
          reason,
          guardMs: MONTHLY_PROGRAMMATIC_GUARD_MS,
        });
      }, MONTHLY_PROGRAMMATIC_GUARD_MS);
    },
    []
  );

  const executeSettle = useCallback(
    (offsetY, source) => {
      if (!weekStarts.length) return;

      const state = scrollStateRef.current;
      state.phase = 'settling';

      const maxIndex = weekStarts.length - 1;
      const rawIndex = offsetY / WEEK_ROW_HEIGHT;
      const snappedIndex = Math.max(0, Math.min(maxIndex, Math.round(rawIndex)));
      const snappedOffset = snappedIndex * WEEK_ROW_HEIGHT;
      const drift = offsetY - snappedOffset;
      const weekStart = weekStarts[snappedIndex];

      logStripCalendar('MonthlyStripList', 'settle:execute', {
        source,
        offsetY,
        rawIndex,
        snappedIndex,
        snappedOffset,
        drift,
        weekStart,
      });

      // Quantize correction - phase='settling' prevents correction → onScroll → re-settle loop
      if (Math.abs(drift) > MONTHLY_DRIFT_CORRECTION_THRESHOLD_PX) {
        logStripCalendar('MonthlyStripList', 'settle:quantizeCorrection', {
          source,
          snappedIndex,
          snappedOffset,
          drift,
        });
        armProgrammaticGuard('quantizeCorrection');
        listRef.current?.scrollToOffset({ offset: snappedOffset, animated: false });
      }

      // Emit settled event (deduplicate same weekStart)
      if (weekStart) {
        if (state.lastEmittedWeekStart === weekStart) {
          logStripCalendar('MonthlyStripList', 'settle:skipDuplicate', {
            source,
            weekStart,
          });
        } else {
          state.lastEmittedWeekStart = weekStart;
          state.lastSyncedTarget = weekStart;
          onTopWeekSettled(weekStart);
        }
      }

      // Transition: settling → idle (next tick to let correction scroll complete)
      requestAnimationFrame(() => {
        if (scrollStateRef.current.phase === 'settling') {
          scrollStateRef.current.phase = 'idle';
        }
      });
    },
    [armProgrammaticGuard, onTopWeekSettled, weekStarts]
  );

  const requestSettle = useCallback(
    (offsetY, source) => {
      const state = scrollStateRef.current;

      // Mutual exclusion: reject if already settling
      if (state.phase === 'settling') {
        logStripCalendar('MonthlyStripList', 'settle:rejected:alreadySettling', {
          source,
          phase: state.phase,
        });
        return;
      }

      // Programmatic guard: block only idle/web-origin settle while programmatic scroll is active.
      // momentumEnd/fallbackProgrammatic are valid settle points.
      if (state.isProgrammatic && source === 'scrollIdleWeb') {
        logStripCalendar('MonthlyStripList', 'settle:rejected:programmatic', {
          source,
        });
        return;
      }

      // Clear any pending settle timer
      if (state.settleTimer) {
        clearTimeout(state.settleTimer);
        state.settleTimer = null;
      }

      // Immediate settle for native events, debounced for web idle
      if (source === 'momentumEnd' || source === 'fallbackProgrammatic') {
        executeSettle(offsetY, source);
      } else {
        // Web idle: debounce
        state.settleTimer = setTimeout(() => {
          state.settleTimer = null;
          const latest = scrollStateRef.current;
          if (
            latest.phase === 'settling' ||
            latest.phase === 'dragging' ||
            latest.phase === 'momentum' ||
            latest.phase === 'programmatic'
          ) {
            logStripCalendar('MonthlyStripList', 'settle:debounceSkippedByPhase', {
              source,
              phase: latest.phase,
            });
            return;
          }
          executeSettle(scrollStateRef.current.lastOffset, source);
        }, MONTHLY_IDLE_SETTLE_DELAY_MS);
      }
    },
    [executeSettle]
  );

  // --- Scroll event handlers ---

  const onMomentumScrollEnd = useCallback(
    (event) => {
      requestSettle(event.nativeEvent.contentOffset.y, 'momentumEnd');
    },
    [requestSettle]
  );

  const onScrollBeginDrag = useCallback(() => {
    const state = scrollStateRef.current;
    if (state.settleTimer) {
      clearTimeout(state.settleTimer);
      state.settleTimer = null;
    }
    state.phase = 'dragging';
    state.isProgrammatic = false;

    logStripCalendar('MonthlyStripList', 'phase:dragging', {});
  }, []);

  const onScrollEndDrag = useCallback(
    (event) => {
      const state = scrollStateRef.current;
      const velocityY = event.nativeEvent.velocity?.y ?? 0;
      state.lastOffset = event.nativeEvent.contentOffset.y;

      logStripCalendar('MonthlyStripList', 'drag:end', {
        platform: Platform.OS,
        offsetY: state.lastOffset,
        velocityY,
      });

      // On web, momentum events may not fire. If velocity is near zero, settle now.
      if (Platform.OS === 'web' && Math.abs(velocityY) < 0.1) {
        state.phase = 'idle';
        requestSettle(state.lastOffset, 'scrollIdleWeb');
      }
    },
    [requestSettle]
  );

  const onMomentumScrollBegin = useCallback(() => {
    const state = scrollStateRef.current;
    state.phase = 'momentum';
    logStripCalendar('MonthlyStripList', 'phase:momentum', {});
  }, []);

  const onScroll = useCallback(
    (event) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const state = scrollStateRef.current;
      state.lastOffset = offsetY;

      // Web idle detection: if not programmatic and not settling, request debounced settle
      if (
        Platform.OS === 'web' &&
        state.phase !== 'programmatic' &&
        state.phase !== 'settling'
      ) {
        const maxIndex = weekStarts.length - 1;
        const rawIndex = offsetY / WEEK_ROW_HEIGHT;
        const snappedIndex = Math.max(0, Math.min(maxIndex, Math.round(rawIndex)));
        const snappedOffset = snappedIndex * WEEK_ROW_HEIGHT;
        const drift = offsetY - snappedOffset;
        const nearSnapped = Math.abs(drift) <= MONTHLY_DRIFT_CORRECTION_THRESHOLD_PX;
        const snappedWeekStart = weekStarts[snappedIndex];
        const sameAsLastSettled = state.lastEmittedWeekStart === snappedWeekStart;

        if (nearSnapped && sameAsLastSettled) {
          if (state.settleTimer) {
            clearTimeout(state.settleTimer);
            state.settleTimer = null;
          }
          return;
        }

        requestSettle(offsetY, 'scrollIdleWeb');
      }
    },
    [requestSettle, weekStarts]
  );

  // --- Sync / programmatic scroll ---

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
      const state = scrollStateRef.current;
      if (state.settleTimer) {
        clearTimeout(state.settleTimer);
      }
      if (state.programmaticGuardTimer) {
        clearTimeout(state.programmaticGuardTimer);
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

    const state = scrollStateRef.current;
    const isInitialSync = !hasInitializedSyncRef.current;
    hasInitializedSyncRef.current = true;

    if (!isInitialSync && state.lastSyncedTarget === targetTopWeekStart) {
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
      lastSyncedTarget: state.lastSyncedTarget,
    });

    // Mark as programmatic to prevent idle settle from firing during scroll
    state.lastSyncedTarget = targetTopWeekStart;
    armProgrammaticGuard('targetSync');

    // Clear any pending settle timer
    if (state.settleTimer) {
      clearTimeout(state.settleTimer);
      state.settleTimer = null;
    }

    if (isInitialSync) {
      const timeoutId = setTimeout(() => {
        setIsInitialAligned(true);
        logStripCalendar('MonthlyStripList', 'sync:initialAlignmentDone', {
          targetTopWeekStart,
          index,
        });
      }, 0);

      return () => {
        clearTimeout(timeoutId);
      };
    }

    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index, animated });
    });

    // Fallback settle for web (momentum events may not fire after programmatic scroll)
    if (Platform.OS === 'web') {
      const delay = animated ? MONTHLY_PROGRAMMATIC_SETTLE_DELAY_MS : MONTHLY_PROGRAMMATIC_GUARD_MS;
      const timeoutId = setTimeout(() => {
        logStripCalendar('MonthlyStripList', 'settle:fallbackProgrammatic', {
          targetTopWeekStart,
          index,
        });
        requestSettle(index * WEEK_ROW_HEIGHT, 'fallbackProgrammatic');
      }, delay);

      return () => clearTimeout(timeoutId);
    }

    return undefined;
  }, [armProgrammaticGuard, scrollAnimated, requestSettle, targetIndex, targetTopWeekStart]);

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
