# Strip-Calendar Monthly 도트 깜빡임(Flicker) — 원인 분석 + 솔루션 제안

---

## 1) 원인 가설 Top 3

### 가설 1: Settle-Only Ensure Trigger (확신도: **매우 높음**)

[useStripCalendarDataRange](file:///Users/admin/Documents/github/todo/client/src/features/strip-calendar/hooks/useStripCalendarDataRange.js#86-377)의 `activeRange`는 `monthlyTopWeekStart`(settle 후에만 갱신되는 값) 기준으로 계산된다. **스크롤 중에는 절대 ensure가 트리거되지 않는다.**

**근거(로그):**
- [3mo.md](file:///Users/admin/Documents/github/todo/.kiro/specs/cache-policy-unification/3mo.md)에서 시퀀스가 명확:
  1. `t=4692ms`: 첫 monthly ensure 요청 (`range=2026-01-01~2026-03-31`) — settle 후
  2. `t=4693ms~4984ms`: DB query (~291ms)
  3. `t=4985ms~5066ms`: WeekRow re-render (~80ms)
  4. **합계: settle 후 ~370ms 동안 도트가 EMPTY로 보임**
- 두 번째 settle(`t=7391ms`)에서도 동일 패턴: ensure→query(22ms)→re-render(77ms) ≈ 100ms 지연

**로그 포인트:** `[strip-calendar:timeline] ensure request` 와 `[strip-calendar:perf] reason=monthly:settled` 사이의 시간차 측정

---

### 가설 2: EMPTY_SUMMARY Fallback = "없음"으로 렌더 (확신도: **매우 높음**)

[DayCell.js](file:///Users/admin/Documents/github/todo/client/src/features/strip-calendar/ui/DayCell.js)에서:

```javascript
const summary = useStripCalendarStore((state) => state.summariesByDate?.[date]) || EMPTY_SUMMARY;
```

`EMPTY_SUMMARY`는 `dotCount: 0, uniqueCategoryColors: []` — 즉, **"데이터 미로딩"과 "진짜 도트 없음"이 동일한 UI 출력**. 사용자에게 "빈 상태 → 도트 등장"이 시각적 flicker로 체감된다.

**로그 포인트:** `summariesByDate`에 해당 날짜가 없는 시점을 [DayCell](file:///Users/admin/Documents/github/todo/client/src/features/strip-calendar/ui/DayCell.js#14-49)에서 `console.count`로 측정 가능

---

### 가설 3: Event Loop Congestion 증폭 (확신도: **중간**)

첫 번째 monthly ensure에서 `eventLoopLag0=163.3ms`(!)가 관찰됨. 이는 monthly 모드 전환 시 FlashList mount/layout/프로파일링 작업이 event loop를 점유해서 비동기 bridge queue가 밀리는 현상이다.

**근거(로그):**
- 첫 monthly ensure: `mainPair=254.6ms`이지만 `repeatPair=11.2ms` — 실제 SQL은 11ms인데 event loop lag으로 23배 느림
- 이후 settle에서는 `total=16.9ms`(warm path) — lag이 해소된 후엔 빠름

**로그 포인트:** `[common-candidate:slow-probe]`의 `eventLoopLag0` 값이 50ms 이상이면 이 가설 해당

---

## 2) 추천 솔루션

### 솔루션 A: Viewability 기반 Scroll-time Prefetch (⭐ **1순위**)

| 항목 | 내용 |
|------|------|
| **구현 난이도** | 중 (todo-calendar에 이미 동일 패턴 존재) |
| **리스크** | 스크롤 중 DB 호출 → 저사양 안드로이드에서 jank 가능. throttle + 작은 청크로 완화 |
| **성능 영향** | DB 호출 추가이나, warm-path에서 16~22ms 수준 (3mo.md 기준). 눈에 띄는 jank 없을 것으로 추정 |
| **효과** | settle 전에 데이터가 이미 있으므로 **flicker 90%+ 제거** 예상 |

**핵심 원리:** `onViewableItemsChanged`에서 visible 경계를 감지 → 아직 coverage에 없는 range를 **settle 전에** [ensureRangeLoaded](file:///Users/admin/Documents/github/todo/client/src/features/strip-calendar/services/stripCalendarDataAdapter.js#58-157) 호출.

---

### 솔루션 B: "미로딩" UI 구분 (보완책, A와 병용)

| 항목 | 내용 |
|------|------|
| **구현 난이도** | 낮음 (DayCell + store 변경 최소) |
| **리스크** | 거의 없음. UI 레벨 변경만 |
| **성능 영향** | 없음 |
| **효과** | prefetch가 미처 못 채운 edge case에서도 "없다→있다" jump 대신 부드러운 전환 |

---

## 3) 스크롤 중 Prefetch 설계안 (솔루션 A 구체화)

### Trigger 조건

```
현재 visible 주(week) 중 가장 바깥쪽(스크롤 방향) 주가
ensured coverage 경계까지 **2주 이하** 남으면 → prefetch 발동
```

- `onViewableItemsChanged` callback에서 viewableItems의 `firstWeekStart` / `lastWeekStart`를 추출
- store의 현재 `coveredRange`와 비교
- `lastWeekStart + 14일 > coveredRange.endDate` → 아래쪽 prefetch
- `firstWeekStart - 14일 < coveredRange.startDate` → 위쪽 prefetch

### 청크 사이즈

**6주(42일) 단위 권장** — 이유:
- 한 "월 화면" ≈ 4~6주이므로, 한 번 prefetch로 다음 settle까지 충분
- [3mo.md](file:///Users/admin/Documents/github/todo/.kiro/specs/cache-policy-unification/3mo.md) 기준 warm-path에서 1개월 range 쿼리가 ~17ms → 6주 청크는 약 20~25ms 예상
- `three_month` 정책(3개월)보다 훨씬 가벼움

### Throttle 값

| 항목 | 권장값 | 이유 |
|------|--------|------|
| **throttle interval** | 300ms | FlashList viewability callback은 스크롤 중 빈번 발생. 300ms면 fast flick에서도 3회 이하 |
| **dedup** | `inFlightRef` boolean | 이전 ensureRangeLoaded가 아직 resolve 안 됐으면 skip |
| **already-covered skip** | range 비교 | coveredRange가 이미 포함하면 호출 자체를 건너뜀 |

### 플랫폼별 주의점

#### iOS
- `onMomentumScrollEnd`가 정상 동작. settle은 momentum 종료 시점에 확실하게 발생
- `snapToInterval`과 `onViewableItemsChanged`는 독립적으로 동작 → prefetch에 지장 없음
- **주의:** `onViewableItemsChanged`의 `minimumViewTime` 기본값이 높으면(250ms+) fast flick에서 callback이 지연될 수 있음 → **`minimumViewTime: 0`** 또는 **100ms 이하** 권장

#### Android
- `onMomentumScrollEnd`가 일부 기기/RN 버전에서 호출 안 되거나 느린 경우가 보고됨 (FlashList 2.x에서는 개선됨)
- `onViewableItemsChanged`가 native thread에서 batch 처리돼 JS thread로 올라오므로, **event loop가 busy하면 callback이 늦을 수 있음**
- **주의:** 저사양 기기에서 prefetch DB 호출이 jank를 유발할 수 있음 → `InteractionManager.runAfterInteractions` wrap 또는 `requestIdleCallback` 패턴 고려

#### Web
- momentum 이벤트 없음 → idle settle이 주요 trigger
- `onViewableItemsChanged`는 정상 동작하지만, web scroll은 passive event로 처리되므로 timing이 native보다 정확
- **주의:** FlashList v2의 web 환경에서 `initialDrawBatchSize` 이후 layout이 안정화되기 전에 early viewability callback이 올 수 있음. guard 필요

---

## 4) UI 레벨 대안: "미로딩" 구분 옵션

### Option 4-A: Coverage 기반 placeholder (⭐ 권장)

```
if (date가 coveredRange 안에 있고 summary 없음) → 진짜 도트 0개 (확정)
if (date가 coveredRange 밖에 있고 summary 없음) → placeholder 렌더 (미확정)
```

- placeholder: 회색 dot 1개 (opacity 0.3) 또는 빈 상태 유지 + fade-in 트랜지션
- `coveredRange` 정보는 store에 이미 존재 (`loadedRanges` via `rangeCacheService`)

구현:
```javascript
// DayCell.js 변경
const isCovered = useStripCalendarStore(
  (state) => isDateInCoveredRange(state, date)
);
const summary = useStripCalendarStore(
  (state) => state.summariesByDate?.[date]
) || EMPTY_SUMMARY;

// 미커버이고 summary 없으면 = 로딩 중
const isLoading = !isCovered && summary === EMPTY_SUMMARY;
```

### Option 4-B: Last-known value 유지 (Optimistic)

스크롤 중 summary가 아직 없는 날짜에 대해, **해당 주/월의 이전 summary를 힌트로 유지**.
- 장점: flicker 완전 제거
- 단점: 잘못된 도트가 잠깐 보일 수 있음 (실제 이벤트가 없는 날에 도트가 보임)
- 캘린더 앱에서는 부정확한 정보 표시가 더 나쁠 수 있으므로 **비추천**

### Option 4-C: Fade-in 트랜지션

DayCell의 dotRow에 `Animated.Value(0→1)` opacity 전환 (200ms):
- summary가 업데이트될 때만 fade-in → "팝" 대신 부드러운 등장
- 단점: 매 DayCell마다 Animated 인스턴스 → 메모리 증가. `React.memo` 효과도 감소
- **솔루션 A가 잘 동작하면 불필요**, edge case만 커버 가능

---

## 5) Apple Calendar / Google Calendar 참고

### Apple Calendar (iOS)

| 항목 | 관찰/추정 |
|------|-----------|
| **데이터 소스** | EventKit (EKEventStore) — **로컬 인덱스** + iCloud 동기화 |
| **Month view dots** | 스크롤 중 **즉시 표시**. placeholder/로딩 표시 없음 |
| **즉시 가능한 이유** | EventKit은 CoreData 기반 로컬 DB에 인덱스된 데이터를 제공. [Apple Developer 문서](https://developer.apple.com/documentation/eventkit)에 따르면 `predicateForEvents(withStart:end:calendars:)` API로 date-range 쿼리가 ms 단위 |
| **iCloud 미동기 시** | 이벤트가 아직 동기화 안 된 경우에도 **빈 상태로 표시** (placeholder 없음). 동기화 완료 시 batch 업데이트 |
| **Apple의 패턴 요약** | 로컬 인덱스가 충분히 빨라서 "즉시 렌더" 전략. 비동기 fetch는 iCloud → 로컬 동기화 단에서 해결 |

> [!NOTE]
> Apple Calendar의 동작은 기기에서 직접 관찰한 결과와 [EventKit 공식 문서](https://developer.apple.com/documentation/eventkit) 기반 추정을 혼합한 것임. Apple이 내부적으로 month view에서 prefetch/pagination을 쓰는지는 비공개.

### Google Calendar (Android)

| 항목 | 관찰/추정 |
|------|-----------|
| **데이터 소스** | CalendarProvider (ContentProvider) + 로컬 SQLite. 서버 동기화는 별도 SyncAdapter |
| **Month view dots** | 2024년 이전: 색상 dot 표시, 스크롤 중 **즉시 표시**. 2024년 이후: event title 직접 표시로 전환 |
| **아키텍처** | 2024 업데이트에서 "hidden week panel → lazy-loaded virtualized grid"로 전환. 메모리 112MB→38MB, GPU overhead 14% 감소 (출처: web search 결과, Alibaba tech blog reference) |
| **로딩 처리** | placeholder/skeleton 없음. 로컬 DB가 source of truth이므로 즉시 렌더 가능 |

> [!IMPORTANT]
> 두 캘린더 앱 모두 **"로컬 인덱스가 source of truth → 즉시 렌더"** 패턴. 우리 앱도 SQLite가 source of truth이므로, **쿼리만 미리 돌리면 동일한 UX가 가능**. 차이점은 우리가 "range aggregation + adapter" 레이어를 거치므로 쿼리 비용이 11~250ms로 더 높다는 것.

### 우리 앱에의 시사점

- Apple/Google은 **비동기 네트워크 fetch와 로컬 렌더를 완전 분리**. 로컬 DB에 있으면 즉시, 없으면 (동기화 후) 갱신.
- 우리 앱도 동일 원리: **ensureRangeLoaded**가 로컬 SQLite만 조회하므로, settle 전에 호출하면 "즉시 보임"과 동일한 효과.
- 핵심 차이: Apple/Google은 쿼리 latency가 1~5ms, 우리는 warm 11~25ms / cold 250ms+ → **prefetch timing이 더 여유 있어야 함** (2주 버퍼 권장)

---

## 6) 코드 적용 포인트 + Pseudo-code

### 변경 파일 요약

| 파일 | 변경 | 난이도 |
|------|------|--------|
| [MonthlyStripList.js](file:///Users/admin/Documents/github/todo/client/src/features/strip-calendar/ui/MonthlyStripList.js) | `onViewableItemsChanged`에서 prefetch trigger 추가 | 중 |
| [useStripCalendarDataRange.js](file:///Users/admin/Documents/github/todo/client/src/features/strip-calendar/hooks/useStripCalendarDataRange.js) | scroll-time prefetch range 계산 + ensure 호출 추가 | 중 |
| [DayCell.js](file:///Users/admin/Documents/github/todo/client/src/features/strip-calendar/ui/DayCell.js) | coverage 기반 loading 구분 (Option 4-A) | 낮 |
| [stripCalendarStore.js](file:///Users/admin/Documents/github/todo/client/src/features/strip-calendar/store/stripCalendarStore.js) | `coveredDateRange` selector 추가 | 낮 |

---

### Pseudo-code

#### A. MonthlyStripList.js — viewability 기반 prefetch trigger

```javascript
// --- 현재 코드 (로그만 찍음) ---
const onMonthlyViewableItemsChanged = useCallback(
  ({ viewableItems }) => {
    // PERF_LOG only...
  }, []
);

// --- 변경 후 ---
const prefetchThrottleRef = useRef(0);
const prefetchInFlightRef = useRef(false);

const onMonthlyViewableItemsChanged = useCallback(
  ({ viewableItems }) => {
    // 1. 기존 로그 유지 (생략)

    // 2. Prefetch trigger
    const now = Date.now();
    if (now - prefetchThrottleRef.current < 300) return;      // throttle
    if (prefetchInFlightRef.current) return;                   // dedup
    prefetchThrottleRef.current = now;

    const visibleWeeks = (viewableItems || [])
      .filter(v => v?.isViewable)
      .map(v => v.item);                                       // weekStart strings
    if (visibleWeeks.length === 0) return;

    const first = visibleWeeks[0];
    const last  = visibleWeeks[visibleWeeks.length - 1];

    // 3. 상위로 전달 (hook에서 coverage 비교 + ensure)
    onPrefetchNeeded?.({ firstWeekStart: first, lastWeekStart: last });
  },
  [onPrefetchNeeded]
);
```

#### B. useStripCalendarDataRange.js — scroll-time prefetch

```javascript
// 새 prop: monthlyVisibleEdges (MonthlyStripList에서 올려줌)
// { firstWeekStart, lastWeekStart }

const scrollPrefetchInFlightRef = useRef(false);

useEffect(() => {
  if (mode !== 'monthly') return;
  if (!monthlyVisibleEdges) return;
  if (scrollPrefetchInFlightRef.current) return;

  const store = useStripCalendarStore.getState();
  const covered = store.coveredDateRange;  // { startDate, endDate }
  if (!covered) return;

  const { lastWeekStart, firstWeekStart } = monthlyVisibleEdges;
  const buffer = 14; // 2주

  // 아래쪽 체크
  const tailDate = addDays(lastWeekStart, 6);  // 해당 주의 마지막 날
  const needsForward = tailDate > addDays(covered.endDate, -buffer);

  // 위쪽 체크
  const needsBackward = firstWeekStart < addDays(covered.startDate, buffer);

  if (!needsForward && !needsBackward) return;

  // 6주(42일) 청크 계산
  const prefetchStart = needsBackward
    ? addDays(covered.startDate, -42)
    : covered.startDate;
  const prefetchEnd = needsForward
    ? addDays(covered.endDate, 42)
    : covered.endDate;

  scrollPrefetchInFlightRef.current = true;
  ensureRangeLoaded({
    startDate: prefetchStart,
    endDate: prefetchEnd,
    reason: 'monthly:scroll-prefetch',
  })
    .then(() => { scrollPrefetchInFlightRef.current = false; })
    .catch(() => { scrollPrefetchInFlightRef.current = false; });
}, [mode, monthlyVisibleEdges]);
```

#### C. DayCell.js — 미로딩 구분

```javascript
const EMPTY_SUMMARY = Object.freeze({ /* ... 기존 */ });

function DayCell({ day, onPress }) {
  const date = day?.date || null;

  // 기존
  const summary = useStripCalendarStore(
    (state) => state.summariesByDate?.[date]
  ) || EMPTY_SUMMARY;

  // 추가: coverage 확인
  const isCovered = useStripCalendarStore(
    (state) => isDateCovered(state, date)
  );

  const isLoading = !isCovered && summary === EMPTY_SUMMARY;

  // dotRow 렌더 분기
  // isLoading이면 → 회색 placeholder dot (opacity 0.3) 1개
  // !isLoading이면 → 기존 로직 (실제 dotColors)
  return (
    <Pressable ...>
      {/* ... */}
      <View style={styles.dotRow}>
        {isLoading ? (
          <View style={[styles.dot, { backgroundColor: '#D1D5DB', opacity: 0.3 }]} />
        ) : (
          dotColors.map(...)
        )}
      </View>
    </Pressable>
  );
}
```

---

## 우선순위 추천

```
Phase 1: 솔루션 A (viewability prefetch) — flicker의 90%+ 해결
Phase 2: Option 4-A (coverage placeholder) — 나머지 edge case 커버
Phase 3: (선택) six_month 정책은 실험적으로만 유지, 기본은 three_month
```

Phase 1만으로도 체감 개선이 클 것. Phase 2는 cold-path(첫 mount 직후 monthly 전환) 같은 극단 케이스에서만 의미있음.
