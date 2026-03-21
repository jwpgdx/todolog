# Design Document: Week Flow Calendar

## Overview

현재 `Week Flow Calendar`는 `TodoScreen` 상단에 붙는 bounded weekly/monthly calendar shell입니다.

핵심 설계 의도는 다음과 같습니다.

- `currentDate` / `todayDate` / `calendar-day-summaries` 계약 재사용
- weekly 기본 보기 유지
- monthly는 iOS에서 안정적인 drag-snap / snapped top-week 기반으로 동작
- hidden layer 간섭은 freeze 규칙으로 제한

이 구현은 더 이상 “한 달 그리드 하나”를 목표로 하지 않습니다.
현재 기준 설계는 `single-row weekly + bounded sliding monthly week window + close-time recenter` 입니다.

## Runtime Architecture

```text
dateStore.currentDate
useTodayDate / useSettings
        ↓
WeekFlowTodoHeader
        ↓
WeekFlowDragSnapCard
   ├─ WeekFlowWeekly
   └─ WeekFlowMonthly
        ↓
useWeekFlowDaySummaryRange
        ↓
calendar-day-summaries / shared range cache
```

## Core State Model

### Global state reused

- `Selected_Date = dateStore.currentDate`
- `Today_Date = useTodayDate()`
- `startDayOfWeek`, `language` from `useSettings()`

### Local runtime state

`WeekFlowTodoHeader`

- `weeklyWeekStart`

`WeekFlowDragSnapCard`

- `committedMode`
- `monthlyViewportWeekStart`
- `previewWeeklyWeekStart`
- `previewWeeklySelectedDate`
- `weeklyRecenterTransition`
- measured weekly/monthly heights for drag-snap

### Why extra state exists

이 구현은 “상태 최소화”만으로는 해결되지 않는 iOS 전환 문제를 겪었기 때문에,
다음 상태를 명시적으로 둡니다.

- `monthlyViewportWeekStart`
  - monthly 현재 맨 윗주
- `previewWeeklyWeekStart`
  - close/open transition 중 weekly preview source
- `previewWeeklySelectedDate`
  - hidden weekly selected freeze용
- `weeklyRecenterTransition`
  - monthly close 이후 selected week recenter animation 정보

핵심 원칙은 “상태를 늘리지 않는다”가 아니라,
“각 상태의 책임을 명확히 분리하고 hidden layer 간섭을 막는다” 입니다.

## Weekly Surface

- `WeekFlowWeekly`는 단일 visible week row만 렌더합니다.
- header prev/next는 `±1 week`
- 좌우 스와이프는 기존 legacy prev/next intent path를 유지합니다.
- `visibleWeekStart`는 상위로 보고되고, Todo header는 이 값을 다음 monthly open anchor로 재사용합니다.

## Monthly Surface

- `WeekFlowMonthly`는 vertical `FlashList` 기반 week-row surface입니다.
- viewport는 5 visible rows를 기준으로 동작합니다.
- 내부 데이터는 bounded sliding window로 유지됩니다.
  - prepend / append / trim
  - top-anchored rebuild
  - snapped offset 기반 top-week 계산
- 과거 방향 prepend 시에는 anchor lock과 visible loading으로 튐을 줄입니다.

## Drag-Snap Shell

`WeekFlowDragSnapCard`는 weekly/monthly 두 레이어를 유지하면서 높이와 opacity를 애니메이션합니다.

### Why dual-layer is kept

- monthly open/close를 손가락에 붙는 방식으로 유지하기 위해
- close 시 `monthly top week -> weekly preview -> selected week recenter` 흐름을 자연스럽게 만들기 위해

### Freeze rules

- hidden monthly top-week report는 active monthly mode가 아닐 때 visible weekly를 덮지 않습니다.
- `monthly`에서 날짜를 눌러도 hidden weekly visible-week는 자동 변경되지 않습니다.
- inactive mode는 기본적으로 summary loading을 비활성화합니다.
- hidden monthly는 weekly visible-week를 따라가되, 주로 다음 open source 정합성용으로만 sync합니다.

## Transition Rules

### Weekly -> Monthly

1. current weekly visible week를 monthly sync target으로 전달
2. hidden monthly가 해당 top week를 보이도록 맞춤
3. drag-snap/tap toggle로 monthly를 연다

즉 open 기준은 `Selected_Date` 단독이 아니라 현재 weekly visible week 입니다.

### Monthly -> Weekly

1. 닫히는 순간 source week는 `monthlyViewportWeekStart`
2. selected date의 week가 현재 5-row viewport 안에 있으면 recenter target으로 채택
3. viewport 밖이면 monthly top week를 그대로 유지
4. recenter가 필요한 경우 close 후 slide/fade로 weekly target week에 맞춘다

### Today jump

- weekly에서 `오늘`:
  - weekly visible week를 today week로 먼저 commit
  - 그 다음 `currentDate = todayDate`
- monthly에서 `오늘`:
  - `currentDate = todayDate`
  - monthly list를 today week가 보이도록 이동

## Data Loading

### Weekly

- active range는 visible week 기준의 작은 버퍼 범위만 유지합니다.
- mounted summary loading은 active weekly mode일 때만 기본 활성입니다.

### Monthly

- active range는 settled top week 기준의 visible 5 rows + small buffer 입니다.
- scroll settled token이 바뀔 때 필요한 범위만 re-ensure 합니다.

### Shared contract

- `useWeekFlowDaySummaryRange`
- `calendar-day-summaries`
- shared range cache miss -> common query/aggregation -> summary selection

SQLite 직접 접근은 없습니다.

## Logging and Debug

- default runtime은 low-noise가 원칙입니다.
- temporary `[WF]` debug logs는 validation 이후 제거합니다.
- 추가 디버그가 필요하면 test-only panel이나 explicit flag로만 켭니다.

## Integration Surface

- active runtime: `TodoScreen` + `WeekFlowTodoHeader`
- removed: dedicated `week-flow` tab
- retained as legacy reference only: `strip-calendar` spec/code lineage

## Validation Status

완료:

- iOS simulator/device
- monthly drag-snap
- monthly -> weekly recenter
- multi-step selected-date transition
- today return
- monthly future/past scroll regression

남음:

- Android parity smoke
- design polish / motion tuning
