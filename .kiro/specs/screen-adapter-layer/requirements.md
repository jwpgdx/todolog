# Requirements Document: 화면어댑터 레이어

## Introduction

본 문서는 `공통 조회/집계 레이어`가 전달한 handoff DTO를 화면별 형태로 변환하는 `화면어댑터` 요구사항을 정의한다.

상위 레이어 상태(2026-02-21 기준):

1. 공통 조회/집계 레이어는 Checkpoint C까지 완료되었다.
2. 화면어댑터는 상위 레이어의 구현 상세를 재구현하지 않고, 확정된 DTO 계약을 입력으로만 사용한다.
3. 상위 레이어 계약 변경 시 본 문서를 동시 갱신한다.

관련 문서:

1. `.kiro/specs/common-query-aggregation-layer/requirements.md`
2. `.kiro/specs/common-query-aggregation-layer/design.md`
3. `.kiro/specs/common-query-aggregation-layer/tasks.md`
4. `.kiro/specs/common-query-aggregation-layer/log.md`
5. `.kiro/steering/ROADMAP.md`
6. `.kiro/specs/screen-adapter-layer/cache-policy-unification.md` (조회/캐시 정책 통합 검토 노트)

## Requirements

### Requirement A0: Upstream Completion Contract

1. THE adapter-layer implementation SHALL assume common query/aggregation Checkpoint C is complete.
2. THE adapter-layer implementation SHALL treat common-layer handoff DTO as frozen input contract for this phase.
3. WHEN common-layer contract changes, THEN adapter spec/docs SHALL be updated in the same change set.

### Requirement A1: Adapter Boundary

1. THE adapter layer SHALL consume only common-layer handoff DTO.
2. THE adapter layer SHALL NOT re-run recurrence final decision.
3. THE adapter layer SHALL NOT directly query server APIs.

### Requirement A2: TodoScreen Adapter

1. THE TodoScreen adapter SHALL transform handoff DTO to day-list shape.
2. THE adapter SHALL preserve completion/category binding from common DTO.
3. THE adapter SHALL not alter completion match policy.

### Requirement A3: TodoCalendar Adapter

1. THE TodoCalendar adapter SHALL provide date-keyed list/group structure.
2. THE adapter SHALL support event-bar rendering metadata (title/category color/completion state) required by UI.
3. THE adapter SHALL support day-cap metadata (예: 3개 노출 + `...`) via UI contract fields.

### Requirement A4: StripCalendar Adapter

1. THE StripCalendar adapter SHALL provide day-summary structure for dot indicators.
2. THE adapter SHALL deduplicate category color indicators per day.
3. THE adapter SHALL support max-dot + overflow marker(`+`) metadata via UI contract fields.

### Requirement A5: Cross-screen Consistency

1. GIVEN same handoff DTO input, adapters SHALL produce logically consistent inclusion/exclusion set.
2. Category metadata binding SHALL remain consistent across adapters.
3. Completion state interpretation SHALL remain consistent across adapters (even when a specific screen does not render completion explicitly).

### Requirement A6: Observability

1. THE adapter layer SHALL log per-screen transformed counts.
2. THE adapter layer SHALL expose mismatch diff samples for DebugScreen compare action.

### Requirement A7: Debug Validation

1. DebugScreen SHALL provide `화면 결과 비교` action.
2. DebugScreen SHALL show TodoScreen/TodoCalendar/StripCalendar count + ID diff summary.
3. Adapter validation SHALL be executable without changing app code between runs.

## Scope

### In Scope

1. TodoScreen/TodoCalendar/StripCalendar 어댑터 계약
2. 화면별 출력 shape/집계 메타 계약
3. DebugScreen 화면 비교 검증 계약
4. 공통 조회/집계 레이어 완료 상태를 전제로 한 입력 계약 명시

### Out of Scope

1. 공통 조회/판정/병합 로직 자체
2. recurrenceEngine 내부 로직 변경
3. 서버/Sync 파이프라인 구조 변경
