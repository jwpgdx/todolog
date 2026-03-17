# Requirements Document: Todo Calendar V2 Cutover Readiness

Last Updated: 2026-03-15
Status: Draft

## Introduction

이 스펙은 `todo-calendar-v2`(`TC2`)를 기존 `todo-calendar`의 실제 대체 후보로
승격하기 전에 충족해야 하는 readiness 기준을 정의합니다.

현재 상태는 다음과 같습니다.

- `TC2` baseline renderer는 구현 완료
- web / iOS / Android에서 month list와 line renderer 자체는 확인됨
- seeded real-data 시나리오에서 `span / overflow / recurring single-day` 렌더 확인됨
- 하지만 기존 `todo-calendar`를 바로 제거할 단계는 아님

핵심 이유는 두 가지입니다.

1. `TC2`가 아직 old calendar의 mutation / invalidation / cutover 기준을 완전히 대체하지 않음
2. `TC2`를 canonical path로 올릴 최소 제품/기술 조건이 문서로 고정되어 있지 않음

이 스펙의 목적은 다음과 같습니다.

1. `TC2`를 canonical replacement candidate로 정의한다.
2. 실제 cutover 전에 필요한 최소 기능/안정성 조건을 고정한다.
3. old `todo-calendar`를 언제까지 유지해야 하는지 경계를 명확히 한다.

## Naming

- `Legacy_Todo_Calendar`: 현재 운영 중인 기존 dot calendar
- `TC2`: `todo-calendar-v2` line-monthly implementation
- `Cutover_Readiness`: old calendar를 primary path에서 내릴 수 있는 상태

## Requirements

### Requirement 1: Replacement Candidate Ownership

**User Story:** 개발자로서, 앞으로 확장할 월간 calendar 구현이 어느 쪽인지 명확히 알고 싶습니다.

#### Acceptance Criteria

1. THE project SHALL treat `TC2` as the canonical replacement candidate for monthly calendar work.
2. New monthly line-calendar enhancements SHALL target `TC2`, not `Legacy_Todo_Calendar`.
3. `Legacy_Todo_Calendar` SHALL remain available until `TC2` passes the readiness gates in this spec.

### Requirement 2: Route and Initial Render Stability

**User Story:** 사용자로서, `TC2`를 열었을 때 플랫폼에 따라 빈 달력이나 초기 blank state를 보지 않길 원합니다.

#### Acceptance Criteria

1. `TC2` SHALL open reliably from active tab navigation.
2. `TC2` SHALL render the initial visible month even if platform-specific viewability callbacks are delayed or skipped.
3. Web, iOS, and Android SHALL all show the initial month layout without requiring manual cache reset or app restart.
4. Route entry stability SHALL be validated for:
   - tab entry
   - warm app state
   - cold app state when feasible in dev-client constraints

### Requirement 3: Baseline Rendering Correctness

**User Story:** 사용자로서, line calendar가 현재 spec대로 일관되게 렌더되길 원합니다.

#### Acceptance Criteria

1. `TC2` SHALL preserve the frozen baseline rules from `todo-calendar-v2-line-monthly`.
2. The renderer SHALL correctly show:
   - adjacent-month visible cells
   - non-recurring multi-day spans
   - timed multi-day spans
   - recurring single-day occurrences
   - per-day `...` overflow
3. Ordering, lane placement, and overflow rules SHALL remain deterministic.
4. The renderer SHALL continue to use the shared query/aggregation backbone rather than ad-hoc direct SQLite UI reads.

### Requirement 4: Visible Data Refresh After Mutations

**User Story:** 사용자로서, Todo나 Category가 바뀌면 현재 보고 있는 `TC2` 화면이 재시작 없이 갱신되길 원합니다.

#### Acceptance Criteria

1. Todo create/update/delete SHALL invalidate or refresh the visible `TC2` month layouts when the affected range overlaps the currently retained window.
2. Category update/delete or coarse cache invalidation SHALL NOT leave `TC2` permanently stale or blank until full app restart.
3. Sync-driven cache invalidation SHALL recover the currently visible `TC2` month layouts without manual route re-entry.
4. The implementation SHALL define one canonical invalidation path for `TC2` month layouts.
5. If `TC2` is mounted when month layouts are cleared or broadly invalidated, the implementation SHALL queue one idle-safe reensure for the current visible or retained `TC2` window.
6. If `TC2` is not mounted, the next tab or route entry SHALL perform a normal visible-window ensure without requiring manual cache reset.

### Requirement 5: Completion Change Policy

**User Story:** 개발자로서, completion-only 변경 때문에 `TC2`가 불필요하게 다시 그려지지 않게 하고 싶습니다.

#### Acceptance Criteria

1. The frozen `TC2` baseline SHALL remain completion-glyph free.
2. Completion-only changes SHALL NOT force broad `TC2` month-layout invalidation by default.
3. Completion changes MAY still invalidate shared non-`TC2` paths that require them, but `TC2` SHALL avoid unnecessary redraw if no visible line-layout contract depends on completion state.
4. Completion-only changes SHALL NOT call full `TC2` layout clear or full-window reensure APIs in the frozen baseline.

### Requirement 6: Performance Guardrails Before Cutover

**User Story:** 개발자로서, cutover 준비 과정에서 `TC2`가 기존 캘린더보다 무거워지지 않게 하고 싶습니다.

#### Acceptance Criteria

1. `TC2` SHALL preserve:
   - visible `±1 month` loading
   - anchor `±6 months` retention
   - no per-frame store writes during active scroll
   - month-local or day-local subscriptions
   - synthetic initial visible-month dispatch or an equivalent platform-safe first-load guard
2. Cutover-readiness work SHALL NOT reintroduce:
   - month-wide recomputation in UI render paths
   - completion-driven broad rerenders
   - JS settle loops or forced scroll correction
3. Any `TC2` diagnostics added during readiness work SHALL remain removable and MUST NOT become a runtime dependency.

### Requirement 7: Legacy Calendar Boundary

**User Story:** 개발자로서, old calendar를 언제까지 유지하고 언제부터 primary path에서 내릴지 명확히 알고 싶습니다.

#### Acceptance Criteria

1. `Legacy_Todo_Calendar` SHALL remain in place until all readiness tasks pass.
2. Readiness completion SHALL NOT automatically imply legacy deletion.
3. A separate cutover step SHALL decide:
   - whether `TC2` becomes the primary tab/screen
   - whether `Legacy_Todo_Calendar` becomes hidden, debug-only, or removed

### Requirement 8: Validation Dataset and Reproducibility

**User Story:** 개발자로서, `TC2` regressions를 재현 가능한 데이터로 반복 검증하고 싶습니다.

#### Acceptance Criteria

1. The project SHALL keep a deterministic validation scenario for `TC2`.
2. That scenario SHALL include:
   - adjacent-month span
   - cross-week span
   - timed multi-day span
   - recurring single-day item
   - overflow on at least one day
3. The readiness process SHALL use this scenario for at least one native validation run.

### Requirement 9: Readiness Decision Gate

**User Story:** 개발자로서, `TC2`가 실제 cutover 후보인지 아닌지를 감이 아니라 기준으로 판단하고 싶습니다.

#### Acceptance Criteria

1. `TC2` readiness SHALL be considered complete only when:
   - route stability is verified
   - visible mutation refresh works
   - completion-only invalidation policy is respected
   - seeded scenario renders correctly on web and at least one native platform
2. If any of the above fails, `TC2` SHALL remain an evaluation surface, not a replacement-ready surface.
