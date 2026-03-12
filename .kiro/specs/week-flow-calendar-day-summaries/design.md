# Design Document: Week Flow Calendar — Day Summaries (Schedule Markers)

## Overview

이 설계는 `Week Flow Calendar`에 “날짜 셀 dot markers”를 붙이기 위한 **요약(summary) 레이어**를 정의합니다.

핵심 목표:

- 스크롤 중 JS 작업/스토어 업데이트를 금지한다.
- `Active_Range`는 “settled/idle” 시점에만 갱신한다.
- CRUD/카테고리 변경은 “더티(Dirty_Ranges)”로 표시하고, 필요한 범위만 재요약한다.
- 요약 캐시는 retention window로 강제 제한한다.

이 설계는 UI 구조(월간이 grid인지, 5주 뷰포트 + 무한 week 리스트인지)와 독립적으로 동작할 수 있어야 합니다.
UI는 단지 “현재 필요한 날짜 범위(start/end)”를 요약 레이어에 전달합니다.

## Architecture

```mermaid
graph TB
  subgraph UI
    WF[Week Flow Calendar UI]
    DC[DayCell]
  end

  subgraph Summary_Layer
    HOOK[useCalendarDaySummaryRange]
    STORE[calendarDaySummaryStore]
    ADAPT[adaptDaySummariesFromRangeHandoff]
  end

  subgraph Common_Layer
    CACHE[getOrLoadRange (range cache)]
    COMMON[runCommonQueryForRange]
  end

  WF --> HOOK
  DC --> STORE
  HOOK --> STORE
  HOOK --> CACHE
  CACHE --> COMMON
  CACHE --> ADAPT
  ADAPT --> STORE
```

### Key idea

UI는 “달력 셀을 무엇으로 그릴지”만 책임집니다.

- Summary layer는 range 단위로 데이터를 로딩하고(date summary 생성),
- DayCell은 “자기 날짜의 요약”만 구독해서 dot를 그립니다.

이렇게 하면 summary 업데이트가 발생해도, 실제로 바뀐 날짜 셀만 리렌더됩니다.

## Data Model

### DaySummary (UI 최소형)

```ts
type DaySummary = {
  date: string; // YYYY-MM-DD
  hasTodo: boolean;
  uniqueCategoryColors: string[]; // stable order is not required
  dotCount: number; // uniqueCategoryColors.length
  maxDots: number; // default 3
  overflowCount: number; // max(0, dotCount - maxDots)
};
```

> 성능 목적상, UI가 실제로 쓰는 것은 `(uniqueCategoryColors.slice(0, maxDots), overflowCount)` 정도입니다.

## Store Design

### State

```ts
type DateRange = { startDate: string; endDate: string };

type CalendarDaySummaryState = {
  summariesByDate: Record<string, DaySummary>;
  loadedRanges: DateRange[];
  dirtyRanges: DateRange[];
  dirtySeq: number;
};
```

### Operations

- `upsertSummaries(summaryMap)`
- `addLoadedRange(startDate, endDate)` (merge/normalize)
- `hasRangeCoverage(startDate, endDate)` (coverage check)
- `invalidateRanges(ranges, { keepSummaries? })`
- `pruneToDateRange(startDate, endDate)` (retention)
- `clear()` (category change 같은 coarse invalidation에 사용)

### Performance Notes

- `summariesByDate`는 retention window 안에서만 유지되어야 합니다(예: ±6개월).
- `upsertSummaries`는 “작은 summaryMap”을 merge하는 형태로 유지하고, 가능한 한 잦은 호출을 피합니다.
- 스크롤 중에는 store 업데이트가 발생하지 않도록 UI가 트리거를 제한합니다.
- UI 성능을 위해, store는 **변경되지 않은 날짜의 `DaySummary` 객체 identity를 보존**해야 합니다. (per-date selector 구독 시 불필요한 리렌더 방지)

## Adapter Design

### Input

`getOrLoadRange({ startDate, endDate })`의 range handoff:

- `itemsByDate: Record<date, Item[]>`
- 각 `Item`은 `category.color`를 포함한다고 가정(공통 레이어 계약).

### Output

`Record<date, DaySummary>`

### Algorithm

- 날짜별 item 리스트를 순회하며 `category.color`를 Set으로 중복 제거
- `uniqueCategoryColors = Array.from(set)`
- `dotCount = uniqueCategoryColors.length`
- `overflowCount = Math.max(0, dotCount - maxDots)`

> 중요: adapter는 “무거운 가공”을 하지 않습니다. (정렬/그룹핑/필터링 최소)

## Range Loading Design

### Ensure API (Two-step contract)

```ts
async function ensureDaySummariesLoaded({ startDate, endDate, reason, traceId }) {}
function selectDaySummary(date) {}
function selectDaySummariesForDiagnostics({ startDate, endDate }) {}
```

- `ensure...`는 store coverage(loadedRanges) 확인 후:
  - covered이면 fast-path return
  - 아니면 `getOrLoadRange` → adapter → store upsert
- `selectDaySummary(date)`는 DayCell 전용 selector이며, “존재하지 않는 날짜”에 대해서도 **안정적인(empty) fallback**을 반환해야 합니다.
- range selection(`selectDaySummariesForDiagnostics`)은 디버그/검증 용도로만 사용합니다. DayCell 렌더 경로에는 range selector를 사용하지 않습니다.

### Active Range Policy (Lightweight First)

이 스펙은 “UI가 월간을 어떤 구조로 구현하든” summary range는 다음 규칙으로 잡는 것을 권장합니다.

- Weekly: `visibleWeekStart` 기준, 작은 앞/뒤 버퍼 포함
- Monthly: 현재 보이는 5주 뷰포트 기준, 작은 앞/뒤 버퍼 포함

권장 기본값(튜닝 가능):

- Weekly:
  - `start = weekStart - 14d`
  - `end = weekStart + 20d`
- Monthly:
  - `start = topWeekStart - (BUFFER_BEFORE_WEEKS * 7)d`
  - `end = topWeekStart + ((VISIBLE_WEEKS + BUFFER_AFTER_WEEKS) * 7 - 1)d`
  - `VISIBLE_WEEKS = 5`
  - `BUFFER_BEFORE_WEEKS = 4`
  - `BUFFER_AFTER_WEEKS = 4`

> “가벼움 우선”이므로 buffer를 크게 잡지 않습니다. dot가 늦게 뜨는 것은 허용합니다.

### Trigger Rule (Idle/Settled Only)

요약 로딩은 다음 시점에만 트리거되어야 합니다.

- 모드 전환 직후(1회)
- weekly: 주 이동(prev/next)으로 `visibleWeekStart`가 변경된 직후(1회)
- monthly: 스크롤이 멈춰서 “top week start”가 확정된 직후(1회)
  - native: `onMomentumScrollEnd`를 settled 신호로 사용
  - web / no-momentum fallback: scroll inactivity 기반 debounced idle settle
  - `onScrollEndDrag`는 fallback을 arm 할 수는 있으나, ensure를 직접 호출하면 안 됩니다.

금지:

- `onScroll`에서 매 프레임 range를 계산/ensure 호출
- viewability 콜백에서 즉시 ensure 호출 (ref 업데이트는 가능하나, ensure는 idle에서만)

## Dirty / Invalidation Design

### Why dirty ranges exist

Todo/Category 변경이 발생하면:

- range cache의 handoff가 stale이 될 수 있고
- 이미 생성된 day summaries는 최신 상태가 아닙니다.

따라서 변경을 “더티 범위”로 기록하고, 필요한 순간에만 재요약해야 합니다.

### Invalidation strategy

#### Todo create/update/delete

- 기본: todo가 영향을 주는 `{startDate..endDate}` 범위를 invalidate
- recurring + `recurrenceEndDate == null` (무기한 반복):
  - “전체 미래” invalidate는 금지(무거움)
  - invalidate 대상은 todo 영향 범위와 `loadedRanges` 각 segment의 **교집합**으로 계산합니다.
  - 교집합은 현재 `Retention_Window`를 넘지 않도록 clip 합니다.
  - 여러 segment를 `min/max` 하나의 연속 범위로 합치지 않습니다.

#### Completion state

- Completion(완료/완료 발생) 상태는 `Day_Summary` 계산/표시에 포함하지 않습니다. (성능 우선)
- Completion 변경은 summary invalidation을 트리거하지 않습니다.

#### Category update/delete

- coarse invalidation 허용:
  - `calendarDaySummaryStore.clear()` 또는
  - retention window 전체를 invalidate
- 그리고 `Range_Cache`도 `invalidateAll` 또는 해당 window invalidation을 수행
- coarse invalidation 후 현재 달력이 mount 상태이면 현재 `Active_Range`를 1회 **idle re-ensure** 대상으로 예약합니다.
- `clear()`만 수행하고 재ensure를 예약하지 않는 구현은 금지합니다.

### Dirty refresh algorithm (Active Range overlap only)

- drag/momentum 중 mutation이 발생하면 `dirtyRanges`만 적재하고 refresh는 실행하지 않습니다.
- dirty refresh 실행 조건은 `isViewportSettled === true` 또는 동등한 `viewportSettledToken` 갱신입니다.
- UI가 `Active_Range`를 갱신(=settled)하면:
  1. active range ensure
  2. dirtyRanges와 activeRange가 겹치는 부분만 merge해서 refresh ensure
     - refresh ensure에서는 refreshed range 전체에 대한 empty summary defaults를 먼저 materialize 한 뒤 adapter 결과를 덮어써서 삭제 후 ghost dots를 방지합니다.
  3. refresh 완료 후 해당 더티 부분만 consume

이 모델은 “현재 화면에 보이는 영역”이 우선 최신화되도록 합니다.

## Retention Policy

### Default window

권장: anchor month 기준 `±6개월` (strip-calendar와 동일 철학)

### Prune gating

- 매 스크롤 tick에 prune 하면 hitch가 날 수 있으므로,
- settled `anchorMonthId(YYYY-MM)`가 바뀐 경우에만 prune 후보로 간주합니다.
- prune 실행은 viewport가 idle/settled 상태일 때만 수행합니다.

Retention 적용 대상:

- `calendarDaySummaryStore`의 `summariesByDate`, `loadedRanges`, `dirtyRanges`
- 공통 `Range_Cache`의 loaded entries (지원 API: `pruneOutsideDateRange`)

## Logging Policy

- 기본: 로그 OFF
- 디버그 플래그가 켜진 경우에만:
  - ensureRangeLoaded 시작/완료
  - dirty refresh 시작/완료
  - retention prune 수행 로그

스크롤 샘플 로그(매 프레임)는 금지합니다.
