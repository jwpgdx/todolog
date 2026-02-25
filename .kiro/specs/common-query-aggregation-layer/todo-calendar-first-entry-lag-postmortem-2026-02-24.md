# Postmortem: todo-calendar 첫 진입 지연(400~550ms) (2026-02-23 ~ 2026-02-24)

## TL;DR
- **증상**: web에서 `todo-calendar` 첫 진입 시 일정/점 표시가 늦게 뜨고(백지처럼 보임), 로그상 `range` 공통 조회가 `~400~550ms`로 관측됨.
- **최종 원인**: 공통 레이어 SQL 병목이 아니라, `CalendarList` 초기 진입 시점에 **과거 months prepend가 즉시 발생**하면서 FlashList/레이아웃 재계산이 JS 메인 스레드를 오래 점유했고(`eventLoopLag0≈430ms`), 그 동안 await 해제가 늦어져 공통 레이어 시간이 과대 측정됨.
- **해결**: `CalendarList`에서 **초기 viewability 1회 prepend 스킵 + prepend 트리거 임계치 조정**.
- **검증 결과**: 첫 진입 `range`가 `total≈19.9ms`, `eventLoopLag0≈0.7ms`로 정상화.

---

## 1) 배경/범위

### 환경
- 플랫폼: **Expo web** (React Native Web)
- DB: `expo-sqlite`
- 화면: `todo-screen`(date) / `todo-calendar`(range) / `strip-calendar`(weekly/monthly)

### 공통 레이어(Phase 3 Step 2)
- Candidate Query: `client/src/services/query-aggregation/candidateQueryService.js`
- Decision: `client/src/services/query-aggregation/occurrenceDecisionService.js`
- Aggregation/Handoff: `client/src/services/query-aggregation/...`

본 이슈는 “공통 레이어가 느리다”로 시작했지만, 최종적으로는 **todo-calendar UI 진입 타이밍 문제**로 결론남.

---

## 2) 사용자 체감 증상
- `todo-screen`은 빠르게 렌더됨.
- `todo-calendar` 첫 진입에서 로딩 지연이 눈에 띔.
- 로그는 `candidateQueryService`의 `range`가 느린 것으로 보여 SQL 병목처럼 보였음.

---

## 3) 재현 시나리오(대표)
1. web에서 앱 완전 재시작
2. 로그인 후 `todo-screen` 진입 (정상)
3. `todo-calendar` 탭 클릭
4. 첫 화면에서 일정/점 표시가 늦게 뜨는지 관찰 + 콘솔 로그 확인

---

## 4) 초기 로그가 만든 착시(왜 SQL로 오해했나)

문제 시점에는 아래 패턴이 반복적으로 관측됨:
- `mainPair`(첫 실행)만 `~400~550ms`
- 바로 뒤 동일 SQL 재실행은 `repeatPair≈6~20ms`, `sequentialTotal≈6~18ms`
- `EXPLAIN QUERY PLAN`은 인덱스 사용 정상

이 패턴은 “SQL 자체가 느린 것”이라기보다,
**첫 실행 시점에 JS가 바빠서(Promise 해제가 늦어져) 측정 시간이 커지는 케이스**와 더 잘 맞음.

---

## 5) 가설/실험/결론(핵심 타임라인)

| 단계 | 가설 | 실험/관측 | 결론 |
|---|---|---|---|
| H1 | 공통 레이어 SQL/인덱스 병목 | Task 15/16: Perf Probe/EXPLAIN/인덱스 점검 | 단독 원인 아님(재실행이 너무 빠름) |
| H2 | DB ensure/재초기화 대기 | `ensurePath`, `ensureMs`, DB phase 로그 | `ensure=0`에서도 느림 -> 원인 아님 |
| H3 | “브리지/워커 큐 cold-path” | slow-probe(`mainPair/repeatPair/sequential/ping`) | 비SQL 1회성 패턴은 맞으나 원인 확정 불가 |
| H4 | 범위(6개월)가 커서 느림 | 6개월 -> 1개월 요청 제한 실험 | 첫 1개월도 동일하게 느릴 수 있음 -> 범위 원인 아님 |
| H5 | App prewarm로 해결 가능 | 앱 init 후 range prewarm | prewarm은 빠르지만 캘린더 진입은 느림 재현 -> 단독 해결 실패 |
| H6 | 메인스레드 long task(렌더/레이아웃) | `eventLoopLag0`(setTimeout(0) 지연) 측정 | 느린 케이스에서 `eventLoopLag0≈430ms` -> 강한 증거 |
| H7 | 초기 prepend가 long task 유발 | `CalendarList` 초기 viewability에서 prepend 스킵 A/B | `range total≈20ms`, `eventLoopLag0≈1ms` -> **원인 확정** |

정리:
- H3(bridge-queue-cold-path)은 “현상 설명”에는 가까웠지만, **H6/H7로 원인이 UI/main-thread임이 확정**되면서 주가설이 교체됨.

---

## 6) 결정적 증거 로그(요약)

### 6-1. 느린 케이스(대표 패턴)
- `common-candidate:perf mode=range total≈498ms`
- `eventLoopLag0≈430ms`
- 직후 `repeatPair/sequential/ping`은 한 자릿수~십수 ms

즉 “SQL이 500ms를 먹는다”가 아니라,
**JS event loop가 400ms 이상 막혀 있어서** async 결과 처리 자체가 늦어진 상태.

### 6-2. 수정 후 케이스(대표 패턴)
사용자 제공 최신 로그:
- `common-candidate:perf mode=range ... total=19.9ms ... eventLoopLag0=0.7ms`
- `CalendarTodoService Total 29.4ms`
- `useTodoCalendarData ... total=31.2ms`

---

## 7) 최종 원인 분석(상세)

호출 흐름(요지):
- `todo-calendar` 진입
- `CalendarList`(FlashList) 초기 렌더
- `onViewableItemsChanged`가 초기에도 호출됨
- 기존 로직에서 “상단 근접” 조건이 넓어(`firstIdx <= 3` 등) **초기에도 prepend가 트리거**됨
- `handleStartReached()` -> `addPastMonths(6)` -> `months` 배열이 커지고
- `maintainVisibleContentPosition`/레이아웃/측정 작업이 겹치며 메인 스레드가 long task
- 그 사이 공통 레이어의 `Promise.all([todoQuery, completionQuery])`는 DB에서 결과가 나와도
  JS 쪽 resolve/후속 처리 타이밍이 늦어져 `total`, `todoQueryMs` 같은 측정치가 부풀어짐

핵심: **SQL/DB가 아니라 “UI 진입 + 리스트 prepend” 타이밍이 병목을 만들고, 그 병목이 공통 레이어 계측값에 투영**됨.

---

## 8) 적용 수정 사항(무엇을 바꿨나)

### 8-1. 최종 Fix(원인 제거)
- `client/src/features/todo-calendar/ui/CalendarList.js`
  - 초기 viewability 1회에서 `handleStartReached()`를 스킵
  - prepend 트리거를 초기 인덱스(`initialScrollIndex=2`)에서 바로 걸리지 않도록 조정

### 8-2. 진단/계측(원인 확정 및 재발 방지)
- `client/src/services/query-aggregation/candidateQueryService.js`
  - slow-probe(`mainPair/repeatPair/sequential/ping`) 추가
  - `eventLoopLag0` 추가
  - suspect 분류에 `event-loop-lag` 케이스를 추가해 오판 방지

### 8-3. 실험용 변경 및 원복
- `client/src/features/todo-calendar/hooks/useTodoCalendarData.js`
  - “1개월만 fetch” throttle은 원인 확정 후 **원복**(정상 프리패치로 복귀)

### 8-4. 보조/부수 변경(있었지만 핵심 원인과는 분리)
- `client/App.js`에 공통 range prewarm 추가
  - 이번 이슈의 핵심 해결은 아니었고, UI long task를 제거하지 못하면 단독 효과가 제한적이었음

---

## 9) Task 15/16(Perf Probe, SQL 튜닝)이 ‘잘못’이었나?
- 결론: **완전히 잘못된 건 아님. 다만 이번 이슈의 root cause는 SQL이 아니었다.**

이 작업들이 유효했던 이유:
- “SQL이 실제로 느린지/아닌지”를 증거로 분리함
- `repeatPair/sequential/ping` 같은 분해 계측이 없었으면 UI 병목을 확정하기 더 오래 걸렸을 가능성이 큼

사용자 관점에서 납득 포인트:
- 처음엔 로그가 SQL 병목처럼 보였고, 그 오해를 깨기 위해서 계측/EXPLAIN이 필요했음
- 최종 해결은 UI였지만, 그 결론에 도달하기 위한 증거 수집 과정이 Task 15/16이었다고 정리 가능

---

## 10) 재발 방지 체크리스트

다음 패턴이면 “SQL 튜닝” 전에 UI/main-thread부터 본다:
- `mainPair`만 큼
- `repeatPair/sequential/ping`은 빠름
- `eventLoopLag0`가 큼

우선 점검 순서:
1. 화면 진입 직후 리스트/레이아웃 작업(특히 prepend/append, maintainVisibleContentPosition)
2. event loop lag
3. 그 다음에야 SQL/인덱스

---

## 11) 산출물(문서/증빙)
- 회고 문서(본 문서): `.kiro/specs/common-query-aggregation-layer/todo-calendar-first-entry-lag-postmortem-2026-02-24.md`
- 로그 증빙: `.kiro/specs/common-query-aggregation-layer/log.md`
- 작업 계획: `.kiro/specs/common-query-aggregation-layer/tasks.md`

---

## 12) 후속 이슈: strip-calendar monthly 전환 시 1주만 보이는 현상 (FlashList 레이아웃 불연속)

### 12-1. 증상
- weekly -> monthly 전환 직후, **월간(5주 뷰포트)**로 들어가야 하는데 **맨 위 1주만 보이고**, 사용자가 스크롤(또는 레이아웃 변화)이 발생한 후에야 나머지 주가 정상적으로 나타남.
- 동시에 FlashList 내부 레이아웃에서 **인덱스 y 좌표가 불연속**(바로 다음 주가 수만 px 뒤로 점프) 현상이 관측됨.

대표 로그(요약):

```text
[strip-calendar:ui-perf] monthly flashlist internals ... windowH=380 childH=208200 ... visible=520..520
[strip-calendar:ui-perf] monthly flashlist layouts ... 520 y=39520 h=76, 521 y=103952 h=76
```

해석:
- 뷰포트 높이 `windowH=380`은 **5주(76*5)**로 정상인데, “보이는 인덱스”가 1개(`visible=520..520`)만 잡힘.
- `521 y=103952`처럼 y 좌표가 급격히 점프해서, **viewport(39520~39900px) 안에 다음 주가 존재하지 않는 상태**가 됨.
- `childH=208200`은 `1041 * 200`과 일치하여, FlashList v2의 기본 추정치(200px)로 전체 높이가 한 번 깔린 흔적이 남아있던 케이스로 해석됨.

### 12-2. 원인
- DB/쿼리/브릿지(공통 레이어) 문제가 아니라, **FlashList(월간) 초기 레이아웃 추정/보정 과정에서 y 좌표가 불연속으로 남는 UI 레이아웃 문제**.
- 즉, “데이터는 이미 존재”해도 레이아웃이 깨져서 **5주가 렌더될 수 없는 상태**가 먼저 발생.

### 12-3. 해결(워크어라운드)
파일:
- `client/src/features/strip-calendar/ui/MonthlyStripList.js`

전략:
- 월간 진입 직후(최소 1개 셀이 측정되어 `WEEK_ROW_HEIGHT=76`이 확정된 뒤),
  FlashList 레이아웃이 아래 중 하나로 “깨진 상태”로 판단되면:
  - `childH`가 `weekStarts.length * 76` 대비 과도하게 큼(추정 200px 레이아웃 잔존)
  - `layout(index+1).y - layout(index).y`가 비정상적으로 큼(y 불연속)
  - 뷰포트 높이는 5주인데 visible row가 1주로 잡힘
- **viewport에 1px 폭을 잠깐 흔들어(paddingRight=1 -> 0)** LayoutManager가 recomputeLayouts(0..end)를 수행하도록 유도해 불연속을 제거.

대표 로그(복구 확인):

```text
internals#1 ... childH=208200 ... visible=520..520 ... 521 y=103952
internals#2 ... childH=79116  ... visible=520..525 ... 521 y=39596
```

### 12-4. 안전성/리스크
- 이 수정은 “데이터/정합성”을 건드리지 않고, **월간 진입 직후 1회(조건부) 레이아웃 재계산을 강제하는 UI-only 워크어라운드**다.
- 조건부 실행(깨진 상태 추정 시에만) + 짧은 duration(50ms)로 영향 범위를 최소화했다.

---

## 13) 후속 이슈: 장기 스크롤 시 메모리 누적(retention) 문제와 해결(±6개월 유지)

### 13-1. 문제 정의
FlashList/CalendarList는 UI 셀을 재활용(virtualization)하지만, 아래 데이터 캐시는 별개라서:
- 사용자가 심심해서 10년 치 달력을 계속 스크롤하면
- **서버/SQLite에서 읽어온 실제 일정 데이터가 캐시에 누적되어 앱 메모리가 계속 증가**할 수 있음

특히 shared range cache는 overlap/adjacent merge가 발생하면 `maxEntries`로는 막기 어려운 케이스가 있음:
- “entries 개수”는 1개로 유지되는데
- **하나의 entry가 수년치 itemsByDate를 포함**하게 되어 메모리 증가가 가능

### 13-2. 결정: Option A retention 정책(앞뒤 6개월 유지)
정책:
- 현재 보고 있는 달(anchor month)을 기준으로
  - 과거 6개월 ~ 미래 6개월(총 1년 + anchor 포함이라 **최대 13개월**)만 메모리에 유지
- 범위를 벗어나는 “아주 먼 과거/미래 캐시 데이터”는 메모리에서 제거

이 정책은 정확성 목적이 아니라 **메모리 상한을 만드는 운영 안전장치**다.  
(제거된 구간은 다시 스크롤 시 cache miss로 재조회하면 됨)

### 13-3. 구현 위치(공통 Range Cache + 화면 L1 store 동시 적용)

1) Shared Range Cache (raw `itemsByDate`)
- `client/src/services/query-aggregation/cache/rangeCacheService.js`
  - `pruneOutsideDateRange({ startDate, endDate, reason })`
  - 설명: keep-range 밖의 entry를 제거하거나, keep-range에 맞춰 entry를 clipping(slicing)한다.
- export:
  - `client/src/services/query-aggregation/cache/index.js`
    - `pruneRangeCacheOutsideDateRange`

2) StripCalendar L1 cache (`summariesByDate`, `loadedRanges`)
- `client/src/features/strip-calendar/store/stripCalendarStore.js`
  - `pruneToDateRange(startDate, endDate)`
- 호출:
  - `client/src/features/strip-calendar/hooks/useStripCalendarDataRange.js`
  - month-id(`YYYY-MM`) 기준으로 게이트하여(매 settle마다 prune하지 않음) 비용을 제한

3) TodoCalendar L1 cache (`todosByMonth`, `completionsByMonth`)
- `client/src/features/todo-calendar/store/todoCalendarStore.js`
  - `pruneToMonthWindow(startMonthId, endMonthId)`
- 호출:
  - `client/src/features/todo-calendar/hooks/useTodoCalendarData.js`
  - 최초 visible month를 anchor로 month-id 기준 게이트

### 13-4. 검증(디버그 출력 기반)
DebugScreen에서 캐시 상태 출력으로 “무한 누적이 아닌지”를 확인했다.

StripCalendar 예시:

```text
summaryDate 범위(키 기준): 2040-03-01 ~ 2040-05-30
strip loadedRanges: loadedRanges=1, summariesByDate=91
```

TodoCalendar 예시:

```text
cached months(sample): 2040-09, 2040-10, 2040-11, 2040-12, 2041-01
month 범위(키 기준): 2040-09 ~ 2041-01
items(total): todos=791, completions=0
```

해석:
- “현재 필요한 범위(예: 3개월/5개월)”만 남아 있고, 멀리 떨어진 과거/미래 데이터가 무제한으로 누적되지 않는다.
- retention은 “상한”이기 때문에, 실제로는 프리패치/가시 범위 정책에 따라 더 적게 유지될 수 있다.

### 13-5. 영향/트레이드오프
- 장기 스크롤 후 다시 먼 과거/미래로 이동할 때 cache hit율은 떨어질 수 있음(의도된 트레이드오프).
- shared range cache는 global이라, 마지막으로 active였던 화면이 prune를 수행하면 다른 화면의 warm-cache도 일부 잘릴 수 있음.
  - correctness는 유지되며, 필요 시 fetch로 복구됨.
