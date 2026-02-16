ㅇㅇ “해결책” 얘기하면 딱 두 군데가 **진짜 범인** 냄새가 진하게 남.

1. **웹 idle 타이머가 momentumEnd/settle 시점에 안 지워져서**
   같은 스크롤 흐름에서 `momentumEnd settle` 하고도 **100ms 뒤 `scrollIdleWeb settle`이 또 발동**할 수 있음.
   → “정착 경로 3개 경쟁”이 **현실로 터지는 지점**이 여기임.

2. **weekStarts window가 recenter로 갈아끼워졌는데도**
   MonthlyStripList가 “targetTopWeekStart 같네? 이미 sync 했음 ㅅㄱ” 하고 **scrollToIndex를 스킵**함.
   근데 recenter되면 **같은 weekStart라도 index가 바뀜**.
   → 리스트는 기존 픽셀 오프셋에 남아있고, 새 배열 기준으로 `settleByOffset`이 다른 weekStart를 찍어버림
   → **anchor가 연속 변경** (니가 말한 실로그 패턴) 나올 수 있음.

결론:
✅ **(A) idle 타이머는 settle/momentum에서 무조건 죽이고**
✅ **(B) “이미 sync” 판단 기준에 index + weekWindowKey까지 포함**하면, 지금 반복 정착/앵커 튐 대부분 잡힘.

---

## 1) 바로 꽂아넣는 안정화 패치 (경쟁 정착 + recenter 꼬임 방지)

아래는 내가 **MonthlyStripList.js 전체**를 “바로 적용 가능한 형태”로 수정한 버전임.
(수정 포인트: `clearWebIdleSettleTimer` 추가, settle/momentum/sync에서 타이머 정리, sync skip 조건 강화, 스크롤 샘플 로그는 detail에서만 찍게 변경)

> **전문적인 적용 가이드(예시)**
>
> * 아래 파일 전체를 `MonthlyStripList.js`에 그대로 교체합니다.
> * 적용 후 웹에서 휠/트랙패드 스크롤을 반복하며 `scrollIdleWeb` 기반 settle이 연속 발생하는지 확인합니다.
> * week window recenter가 발생하는 구간(Prev/Next 연타 등)에서도 anchor가 불필요하게 연쇄 변경되지 않는지 확인합니다.

```js
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
  STRIP_CALENDAR_DETAIL_LOG_ENABLED,
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
  const lastSyncedIndexRef = useRef(null);
  const lastSyncedWeekWindowKeyRef = useRef(null);
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

  const weekWindowKey = useMemo(() => {
    if (!weekStarts.length) return 'empty';
    return `${weekStarts[0]}|${weekStarts[weekStarts.length - 1]}|${weekStarts.length}`;
  }, [weekStarts]);

  const clearWebIdleSettleTimer = useCallback(() => {
    if (webIdleSnapTimerRef.current) {
      clearTimeout(webIdleSnapTimerRef.current);
      webIdleSnapTimerRef.current = null;
    }
  }, []);

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

      // ✅ settle이 호출되는 순간, 남아있는 web idle timer는 무조건 제거 (중복 경쟁 방지)
      if (Platform.OS === 'web') {
        clearWebIdleSettleTimer();
      }

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

        // ✅ “현재 window에서 snappedIndex로 정착했다”까지 기록
        //    (recenter로 window가 바뀌면 index가 바뀌므로, sync 스킵하면 안 됨)
        lastSyncedTargetRef.current = weekStart;
        lastSyncedIndexRef.current = snappedIndex;
        lastSyncedWeekWindowKeyRef.current = weekWindowKey;

        lastEmittedSettledRef.current = weekStart;
        onTopWeekSettled(weekStart);
      }
    },
    [clearWebIdleSettleTimer, onTopWeekSettled, weekStarts, weekWindowKey]
  );

  const onMomentumScrollEnd = useCallback(
    (event) => {
      // ✅ momentumEnd settle 직전에 idle 타이머 제거 (이거 안 하면 100ms 뒤 idle settle이 추가로 뜰 수 있음)
      clearWebIdleSettleTimer();

      idleSettleArmedRef.current = false;
      hasUserInteractionRef.current = false;
      idleSettleLockRef.current = true;
      settleByOffset(event.nativeEvent.contentOffset.y, 'momentumEnd', { allowCorrection: true });
    },
    [clearWebIdleSettleTimer, settleByOffset]
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

  const onScrollBeginDrag = useCallback(
    (event) => {
      clearWebIdleSettleTimer();
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
    },
    [clearWebIdleSettleTimer]
  );

  const onMomentumScrollBegin = useCallback(
    (event) => {
      clearWebIdleSettleTimer();
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
    },
    [clearWebIdleSettleTimer]
  );

  const onScroll = useCallback(
    (event) => {
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

      // ✅ 스크롤 샘플 로그는 detail일 때만 (DEBUG만 켜두고 쓰면 콘솔이 스크롤을 잡아먹음)
      if (!DEBUG_STRIP_CALENDAR) return;
      if (!STRIP_CALENDAR_DETAIL_LOG_ENABLED) return;

      if (scrollSampleCountRef.current >= MONTHLY_SCROLL_SAMPLE_LIMIT) return;
      scrollSampleCountRef.current += 1;
      if (scrollSampleCountRef.current % 2 !== 0) return;

      logStripCalendar('MonthlyStripList', 'scroll:sample', {
        y: offsetY,
        sample: scrollSampleCountRef.current,
      });
    },
    [settleByOffset]
  );

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

    // ✅ “targetTopWeekStart가 같다”만으로는 sync를 스킵하면 안 됨
    //    recenter로 weekStarts window가 바뀌면 index가 달라짐 → 그때는 재정렬 필요
    const isAlreadySynced =
      !isInitialSync &&
      lastSyncedTargetRef.current === targetTopWeekStart &&
      lastSyncedIndexRef.current === index &&
      lastSyncedWeekWindowKeyRef.current === weekWindowKey;

    if (isAlreadySynced) {
      logStripCalendar('MonthlyStripList', 'sync:skipAlreadySynced', {
        targetTopWeekStart,
        index,
        weekWindowKey,
      });
      return;
    }

    clearWebIdleSettleTimer();

    const animated = isInitialSync ? false : scrollAnimated;

    logStripCalendar('MonthlyStripList', 'sync:scrollToIndex', {
      targetTopWeekStart,
      index,
      scrollAnimated: animated,
      isInitialSync,
      lastSyncedTarget: lastSyncedTargetRef.current,
      lastSyncedIndex: lastSyncedIndexRef.current,
      lastSyncedWeekWindowKey: lastSyncedWeekWindowKeyRef.current,
      weekWindowKey,
    });

    lastSyncedTargetRef.current = targetTopWeekStart;
    lastSyncedIndexRef.current = index;
    lastSyncedWeekWindowKeyRef.current = weekWindowKey;

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
  }, [
    clearWebIdleSettleTimer,
    scrollAnimated,
    settleByOffset,
    targetIndex,
    targetTopWeekStart,
    weekWindowKey,
  ]);

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
```

---

## 2) “스크롤 작동될 때 작업 좀 빼야되나?” → 응, 빼는 게 맞음

지금 onScroll은 **상태머신/타이머/가드/로깅** 다 들고 있어서, 디버그 켜진 순간 체감이 바로 흔들릴 수밖에 없음.

### 추천 구조(최신/더 나은 방향)

**onScroll에서 해야 할 일은 사실 2개면 끝**이야.

> **전문적인 설계 예시**
>
> 1. `onScroll`: 최신 offset/timestamp만 저장
> 2. `requestAnimationFrame` 또는 단일 idle timer에서 “정착 조건 판단 + settle 호출” 처리
> 3. settle 호출 경로는 `requestSettle()`로 단일화(중복 호출 coalesce)

예시(개념):

```js
// onScroll: 초경량
function onScroll(e) {
  latestOffsetRef.current = e.nativeEvent.contentOffset.y;
  latestAtRef.current = performance.now();
  scheduleProcess(); // rAF 1회만 예약
}

// rAF 1프레임에 1번만 실행
function processScrollFrame() {
  if (now < guardUntil) return;
  if (abs(latestOffset - lastSettledOffset) < rearmThreshold) return;
  scheduleIdleSettle(); // 마지막 스크롤 이후 N ms
}
```

이렇게 하면:

* 스크롤 이벤트가 1초에 60번 와도, “판단 로직”은 프레임당 1번만 함
* 타이머/락/가드가 여기저기서 싸우는 구조가 **자연스럽게 정리됨**

---

## 3) “쓸모없으면 빼도 됨” 기준으로, 삭제 후보 찍어준다

지금 코드 기준으로 **정리해도 되는(혹은 합쳐도 되는) 애들**:

### 바로 삭제/비활성 추천

* **scroll:sample 로그** (지금도 패치에서 detail일 때만 찍게 낮춤)
  → 이거 켜져 있으면 콘솔이 스크롤 성능 잡아먹는 주범임

### 구조 리팩터링하면서 삭제 추천 (web only)

* `hasUserInteractionRef`, `idleSettleArmedRef`, `idleSettleLockRef`
  → “거리 조건 + 가드 시간 + idle timer”만으로 대부분 대체 가능함
  → 지금은 상태가 셋으로 갈라져서 추론 난이도만 올림

### 합치는 게 더 나은 애들

* `initialIdleGuardUntilRef`, `correctionCooldownUntilRef`, `settleHardCooldownUntilRef`
  → 전부 “지금은 settle 금지”라는 동일 목적이라
  `idleSettleBlockedUntilRef = max(...)` 이런 식으로 **단일 타임가드**로 통합 가능

---

## 4) 너가 물은 질문에 한 줄로 대답

* “스크롤 작동될 때 작업 빼야되나?” → **응. onScroll은 ‘기록만’ 하게 만들면 승리임.**
* “쓸모없는 건 빼도 됨?” → **응. 특히 스크롤 샘플 로그/복잡한 ref 상태머신은 과감히 빼는 게 맞음.**

---

원하면 내가 다음 단계로 **(A) onScroll 다이어트 버전(상태 3개 삭제하고 idle settle 단순화)**도 “컴포넌트 전체 코드”로 바로 만들어줄게.
지금은 일단 위 패치만 넣어도, 니가 말한 **scrollIdleWeb 반복 정착 + anchor 연쇄 변경** 같은 똥줄타는 증상은 확 꺾일 확률이 높다.
