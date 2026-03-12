# Requirements Document: Week Flow Calendar — Day Summaries (Schedule Markers)

## Introduction

이 스펙은 `Week Flow Calendar`에 “일정 표시(=날짜별 요약, dot markers)”를 **성능 우선**으로 추가/재개발하기 위한 문서입니다.

기존 `strip-calendar`는 날짜별 dot 요약(`summariesByDate`)을 제공하지만,

- Monthly 스크롤/정착(settle) 로직이 복잡하고
- range ensure/refresh 트리거가 잦아질 수 있으며
- summary store가 legacy UI state와 강하게 결합되어

새 `week-flow-calendar`의 “가벼움 우선” 목표에 맞게 **요약 레이어를 명확한 계약 + 최소 상태 + 더티/캐시 정책**으로 재정의할 필요가 있습니다.

이 스펙의 목표는 다음을 동시에 만족하는 것입니다.

1. 달력 셀에 표시할 날짜별 요약을 안정적으로 제공한다.
2. Todo/Category 변경 시 달력 표시가 다시 그려져야 한다.
3. 스크롤 중 per-frame JS 작업을 금지하고, “idle/settled 시점”에만 갱신한다.
4. 메모리/캐시가 연도 스크롤로 무한히 커지지 않게 retention을 강제한다.

> 범위: “dot markers(카테고리 색)” 중심의 요약만 다룹니다. 날짜 셀 내부에 일정 텍스트 리스트를 직접 렌더하는 것은 **비범위(Out of scope)** 입니다.

## Naming

- Feature name: `Week Flow Calendar Day Summaries`
- Planned spec folder: `.kiro/specs/week-flow-calendar-day-summaries/`
- Planned implementation module (suggested): `client/src/features/calendar-day-summaries/`

## Glossary

- **Day_Summary**: 날짜(`YYYY-MM-DD`) 단위 요약. dot(카테고리 색) + overflow 등 UI가 필요한 최소 정보만 포함.
- **Date_Range**: `{ startDate, endDate }` (inclusive, `YYYY-MM-DD`)
- **Active_Range**: 현재 화면(weekly/monthly)에서 필요한 요약 범위(가시 영역 + 최소 버퍼)
- **Prefetch_Range**: 사용자 이동을 대비해 미리 로딩하는 범위(Active_Range와 동일하거나 약간 확장)
- **Loaded_Ranges**: 이미 summary가 보장되는 범위 목록(coverage bookkeeping)
- **Dirty_Ranges**: 변경(CRUD)로 인해 재요약이 필요한 범위 목록
- **Retention_Window**: 메모리/캐시를 제한하기 위해 유지하는 요약 범위(예: anchor ±N개월)
- **Range_Cache**: 공통 레이어 `getOrLoadRange()`가 유지하는 range handoff 캐시
- **Adapter**: range handoff(`itemsByDate`) → `Day_Summary`로 변환하는 함수

## Requirements

### Requirement 1: Scope (Markers Only)

**User Story:** 개발자로서, 달력 성능을 위해 “날짜 셀에는 요약 표시만” 붙이고 싶습니다.

#### Acceptance Criteria

1. THE system SHALL render day-level schedule markers (dots) in `Week Flow Calendar` day cells.
2. THE system SHALL NOT render full event lists inside calendar cells in this scope.
3. The marker rendering SHALL remain stable in both weekly and monthly modes.

### Requirement 2: Summary Model (Unique Category Dots)

**User Story:** 사용자로서, 날짜별로 “몇 개 카테고리가 있는지”를 점으로 간결하게 보고 싶습니다.

#### Acceptance Criteria

1. A `Day_Summary` SHALL be keyed by `date: YYYY-MM-DD`.
2. THE summary dot semantics SHALL use **unique category colors**, not raw todo count.
3. THE UI SHALL render at most `maxDots` dots (default `3`).
4. WHEN unique category count exceeds `maxDots`, THEN THE UI SHALL render an overflow indicator (e.g. `+`), and SHALL expose `overflowCount`.

### Requirement 3: Data Source Contract (No Direct SQLite in UI)

**User Story:** 개발자로서, UI가 SQLite에 직접 접근하지 않고 공통 경로를 재사용하고 싶습니다.

#### Acceptance Criteria

1. THE summary fetch path SHALL reuse the existing range-based common query/aggregation layer (`getOrLoadRange`).
2. THE UI layer SHALL NOT query SQLite directly.
3. THE summary adapter SHALL accept a range handoff (`itemsByDate`) and produce day summaries.

### Requirement 4: Range Loading Strategy (Perf-First)

**User Story:** 사용자로서, 스크롤이 버벅이지 않는 가벼운 캘린더를 원합니다.

#### Acceptance Criteria

1. THE system SHALL only trigger summary range loads on **settled/idle** points, not on every scroll event.
2. THE weekly mode SHALL compute `Active_Range` from the currently visible week.
3. THE monthly mode SHALL compute `Active_Range` from the currently visible month/week viewport anchor (implementation-defined), plus a small buffer.
4. The buffer size SHALL be configurable (constants) and default to “lightweight first”.

### Requirement 5: Dirty Refresh on Mutations (Todo)

**User Story:** 사용자로서, 일정 추가/삭제/수정 시 달력의 점 표시가 다시 반영되어야 합니다.

#### Acceptance Criteria

1. WHEN a Todo is created/updated/deleted, THEN the affected date range SHALL be invalidated as `Dirty_Ranges`.
2. Completion (완료/완료 발생) 상태는 `Day_Summary` 계산/표시에 포함하지 않으며, completion 변경은 summary invalidation을 트리거하지 않습니다. (성능 우선)
3. Dirty refresh SHALL be bounded to the currently active viewport range (Active_Range), plus minimal safety buffer if needed.
4. Dirty refresh SHALL not cause unbounded fetch of future dates for unbounded recurrences.
5. For unbounded recurrences, invalidation SHALL be clipped to already-loaded `Loaded_Ranges` segments and/or the current `Retention_Window`; sparse coverage MUST NOT be collapsed into one contiguous span.

### Requirement 6: Category Changes (Update/Delete)

**User Story:** 사용자로서, 카테고리 색이 바뀌거나 삭제되면 달력 점 색도 같이 바뀌어야 합니다.

#### Acceptance Criteria

1. WHEN a category is updated (e.g. color/name), THEN day summaries SHALL eventually reflect updated category colors.
2. WHEN a category is deleted, THEN day summaries SHALL not show its color.
3. The implementation MAY choose a coarse invalidation strategy (e.g. clear summary caches) because category changes are relatively rare.
4. IF the calendar is mounted, THEN category update/delete SHALL queue one idle re-ensure for the current `Active_Range` so visible markers recover without extra navigation.

### Requirement 7: Retention and Memory Bound

**User Story:** 개발자로서, 사용자가 연도를 계속 스크롤해도 메모리가 무한히 증가하지 않게 하고 싶습니다.

#### Acceptance Criteria

1. THE summary cache/store SHALL enforce a `Retention_Window` policy.
2. The retention policy SHALL be anchor-driven (e.g. by visible month id), and SHALL prune outside the window.
3. Retention pruning SHALL run only after a settled `anchorMonthId` change and only while the viewport is idle.
4. The common range cache (`Range_Cache`) SHALL also be pruned outside the same retention window (if supported).

### Requirement 8: Performance Guardrails

**User Story:** 개발자로서, 일정 표시가 붙어도 week-flow-calendar의 “가벼움”을 유지하고 싶습니다.

#### Acceptance Criteria

1. THE implementation SHALL avoid per-frame JS loops (e.g. repeated `scrollToOffset` in response to scroll).
2. THE implementation SHALL avoid high-volume console logging by default (logs must be behind explicit flags).
3. THE UI SHALL subscribe with per-date selector granularity so unrelated date updates do not re-render the full calendar surface.
4. Store writes SHALL preserve object identity for unchanged `Day_Summary` records.

### Requirement 9: Cross-Platform Consistency

**User Story:** 사용자로서, iOS/Android/Web에서 동일한 요약 표시 규칙으로 동작하길 원합니다.

#### Acceptance Criteria

1. THE summary calculation semantics SHALL be identical across platforms.
2. The range triggering points MAY differ by platform (e.g. scroll settle events), but MUST remain “idle/settled only” in principle.
