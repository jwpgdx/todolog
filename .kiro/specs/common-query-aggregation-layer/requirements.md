# Requirements Document: 공통 조회/집계 레이어

## Introduction

본 문서는 Phase 3 Step 2의 `공통 조회/집계 레이어` 요구사항만 정의한다.

범위 원칙:

1. 이 문서는 `조회/판정/병합/집계`와 공통 DTO handoff 계약까지만 다룬다.
2. `화면어댑터`(TodoScreen/TodoCalendar/StripCalendar)는 별도 스펙으로 분리한다.
3. 최종 렌더 표현 규칙(예: 3개+..., dot 중복 제거)은 본 문서 범위가 아니다.

관련 문서:

1. `.kiro/specs/common-query-aggregation-layer/pre-spec-baseline.md`
2. `.kiro/specs/screen-adapter-layer/requirements.md`
3. `.kiro/steering/ROADMAP.md`

## Glossary

- **Candidate Query Layer**: SQLite에서 Todo/Completion/Category 후보를 조회하는 계층
- **Occurrence Decision Layer**: 후보 Todo가 특정 날짜/범위에 실제 표시 대상인지 판정하는 계층
- **Aggregation Layer**: 판정 통과 Todo에 Completion/Category를 병합하는 계층
- **Handoff DTO**: 화면어댑터로 전달되는 공통 출력 DTO
- **SQLite-only Read Path**: 서버 직접 조회 없이 SQLite 기준으로 동작하는 정책
- **Completion Key Policy**: `todoId + (date|null)` 매칭 정책

## Requirements

### Requirement 1: 공통 조회/집계 레이어 구조

**User Story:** 개발자로서, 조회/판정/병합 책임을 단일 구조로 고정하고 싶다.

#### Acceptance Criteria

1. THE system SHALL implement three layers: `Candidate Query`, `Occurrence Decision`, `Aggregation`.
2. THE system SHALL keep each layer responsibility separated and independently testable.
3. THE system SHALL expose one shared handoff DTO contract for downstream 화면어댑터.

### Requirement 2: SQLite-only Read Contract

**User Story:** 개발자로서, 조회 결과가 서버 상태 변동에 직접 흔들리지 않고 로컬 기준으로 일관되길 원한다.

#### Acceptance Criteria

1. THE common query/aggregation path SHALL read from SQLite only.
2. THE common query/aggregation path SHALL NOT directly call server read APIs.
3. WHEN SQLite initialization fails, THEN fallback behavior SHALL be explicitly defined outside the common layer boundary.

### Requirement 3: Sync Dependency Contract

**User Story:** 개발자로서, 공통 레이어 정확성의 전제 조건을 명확히 알고 싶다.

#### Acceptance Criteria

1. THE system SHALL treat sync pipeline completion (`Pending Push -> Delta Pull -> Cursor Commit -> Cache Refresh`) as freshness prerequisite.
2. THE common layer SHALL assume local SQLite is the source of truth after sync.
3. THE design SHALL explicitly describe stale-data behavior before sync completion.
4. THE common layer SHALL expose stale-state metadata (`isStale`, `staleReason`) for diagnostics.

### Requirement 4: Candidate Query Unification

**User Story:** 개발자로서, 화면별로 다른 SQL 조건을 공통 규칙으로 통합하고 싶다.

#### Acceptance Criteria

1. THE candidate query SHALL support Todo/Completion/Category unified fetch by target date/range.
2. THE candidate query SHALL include single-date, period, and recurring candidate rules.
3. THE candidate query SHALL apply soft-delete exclusion consistently.
4. THE candidate query SHALL define month/range prefetch behavior for calendar consumers.
5. THE candidate query SHALL define category binding strategy explicitly.
6. WHEN completion candidates are fetched for range, THEN query policy SHALL explicitly define handling of `date IS NULL` rows.

### Requirement 5: Occurrence Decision Unification

**User Story:** 개발자로서, 반복 일정 판정이 화면별로 달라지는 문제를 없애고 싶다.

#### Acceptance Criteria

1. THE occurrence decision SHALL enforce `recurrenceEngine` as the only final recurrence predicate path.
2. THE decision layer SHALL define deterministic rules for non-recurring (single/period) todos.
3. THE decision layer SHALL handle invalid recurrence input with fail-soft policy.
4. THE decision layer SHALL produce deterministic output for the same input dataset.
5. THE decision layer SHALL support both `date` mode and `range` mode interfaces.
6. For non-recurring single todos, the decision rule SHALL cover both:
   - `date == targetDate`
   - `startDate == targetDate` (when `date` is null)

### Requirement 6: Aggregation Contract

**User Story:** 개발자로서, 완료 상태/카테고리 병합 규칙을 단일 계약으로 고정하고 싶다.

#### Acceptance Criteria

1. THE aggregation layer SHALL merge Todo + Completion + Category by one shared policy.
2. THE completion match SHALL follow `todoId + (date|null)` policy.
3. THE aggregation output SHALL include fields required for downstream adapters and debugging.
4. THE aggregation layer SHALL not contain screen-specific presentation formatting.
5. THE common aggregation DTO SHALL include schedule fields used by consumers (`isAllDay`, `startTime`, `endTime`).

### Requirement 7: Legacy Path Governance (공통 레이어 범위)

**User Story:** 개발자로서, 공통 레이어와 충돌하는 레거시 판정 경로를 단계적으로 정리하고 싶다.

#### Acceptance Criteria

1. THE migration SHALL keep legacy paths only as temporary compatibility layer.
2. THE migration SHALL define explicit deletion gates before removing legacy functions.
3. THE migration SHALL include `todoFilters.js` cleanup in final dead-code phase.
4. Legacy recurrence predicate functions SHALL be removed after common-layer parity validation passes.

### Requirement 8: Error/Fallback Policy

**User Story:** 개발자로서, 예외 상황에서 어느 계층이 fallback을 담당하는지 명확히 하고 싶다.

#### Acceptance Criteria

1. THE common layer SHALL expose structured error results without direct server fallback.
2. Hook/UI boundary SHALL decide user-facing fallback behavior.
3. `useTodos` server fallback policy SHALL be either removed or explicitly boundary-isolated in final design.

### Requirement 9: Performance & Cache Contract

**User Story:** 사용자로서, 공통화 이후에도 체감 성능이 떨어지지 않길 원한다.

#### Acceptance Criteria

1. THE system SHALL define measurable thresholds for candidate query and aggregation runtime.
2. THE system SHALL define cache key and invalidation policy aligned with sync pipeline.
3. THE refactor SHALL avoid introducing invalidation storms.

### Requirement 10: Observability Contract

**User Story:** 개발자로서, 공통 레이어 결과를 로그로 빠르게 검증하고 원인 분석하고 싶다.

#### Acceptance Criteria

1. THE system SHALL log stage-wise counters (`candidate`, `decided`, `aggregated`).
2. THE system SHALL log error samples and mismatch hints for diagnostics.
3. THE system SHALL expose PASS/FAIL summary per validation run.

### Requirement 11: DebugScreen-first Validation (공통 레이어)

**User Story:** 개발자로서, 버튼 기반 재현 가능한 수동 검증으로 빠르게 품질을 확인하고 싶다.

#### Acceptance Criteria

1. THE validation primary path SHALL be DebugScreen scenario execution.
2. DebugScreen SHALL provide:
   - common-layer run action (`date`/`range`)
   - sync-coupled smoke action
3. DebugScreen logs SHALL be sufficient to decide PASS/FAIL for common-layer checkpoints.

### Requirement 12: 화면어댑터 Handoff Boundary

**User Story:** 개발자로서, 화면어댑터와의 경계를 명확히 유지하고 싶다.

#### Acceptance Criteria

1. THE common layer SHALL define adapter input DTO contract, but SHALL NOT implement screen-specific rendering rules.
2. Screen-specific formatting/grouping/limit rules SHALL be specified in `.kiro/specs/screen-adapter-layer/` docs.
3. The common-layer spec SHALL link to screen-adapter spec as downstream dependency.

### Requirement 13: 성능 튜닝 DoD (Cold/Hot 계측 기준 고정)

**User Story:** 개발자로서, 공통 레이어 성능 튜닝 완료 여부를 재현 가능한 기준으로 판단하고 싶다.

#### Acceptance Criteria

1. THE system SHALL define two performance modes for validation:
   - `cold`: shared range cache + screen L1 cache clear 후 첫 실행
   - `hot`: 동일 range를 invalidation 없이 즉시 재실행
2. THE system SHALL record stage-wise elapsed for each run (`candidate`, `decision`, `aggregation`, `total`).
3. WHEN running `date` mode (`1일`) under `cold`, THEN `total` p95 SHALL be `<= 120ms`.
4. WHEN running `range` mode (`3개월`) under `cold`, THEN `candidate` p95 임계치는 Task 15 baseline 확정 후 최종 고정한다. 잠정 기준: small dataset(`<= 50 todos`) `<= 80ms`, large dataset(`>= 200 todos`) `<= 300ms` OR baseline 대비 `>= 30%` 개선.
5. WHEN running same `range` under `hot`, THEN cache-hit path SHALL complete within `<= 20ms` and SHALL NOT trigger additional SQLite candidate query.
6. Measurement conditions SHALL be fixed and logged:
   - sync 완료 상태(`isStale=false`)
   - 동일 테스트 데이터셋(일반/반복/시간포함 반복 포함)
   - 테스트 데이터셋 최소 구성: `todos >= 20`, 유형(단일/기간/daily/weekly/monthly/time-based 반복), `completions >= 5`(date+null 혼합)
   - 데이터셋 ID 목록은 Task 15에서 고정하고 `log.md`에 기록
   - 시나리오별 최소 5회 반복 후 p50/p95 기록
7. THE validation result SHALL be appended to `.kiro/specs/common-query-aggregation-layer/log.md` with PASS/FAIL summary.

## Scope

### In Scope

1. 공통 조회/판정/병합/집계 계약 정의
2. 공통 DTO(handoff) 계약 정의
3. sync/stale 연동 계약 정의
4. DebugScreen 기반 공통 레이어 검증 계약 정의

### Out of Scope

1. 화면어댑터 구현 상세
2. 화면별 렌더 규칙(예: 3개+..., dot dedupe)
3. 서버 API 계약 변경
4. Sync 파이프라인 자체 재설계
