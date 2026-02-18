# Requirements Document: Phase 3 Recurrence Engine Core

## Introduction

본 문서는 Phase 3를 3단계로 나눴을 때 **1단계(엔진 확정)** 요구사항만 정의한다.

전체 단계:

1. 엔진 확정 (본 문서 범위)
2. 공통 경로 연결 (범위 외)
3. strip 포함 UI 연동 (범위 외)

핵심 목표:

1. 외부 `rrule` 의존 없이 반복 일정 계산 규칙을 확정한다.
2. date-only 기반 날짜 계약을 고정해 타임존 오차를 줄인다.
3. recurrence 관련 DB 계약을 최신 스키마 기준으로 고정한다.

## Glossary

- **Recurrence Engine**: 반복 규칙 정규화/판정/범위 전개를 담당하는 코어
- **Normalized Rule**: 다양한 recurrence 입력을 통일한 내부 표현
- **Date-only Contract**: 날짜를 `YYYY-MM-DD` 문자열로 다루는 계약
- **Effective End Date**: 반복 종료일 최종 해석값
- **Greenfield Initialization**: 기존 사용자 데이터 제약 없이 최신 스키마로 초기화하는 정책

## Requirements

### Requirement 1: Recurrence Engine Independence

**User Story:** 개발자로서, 엔진 핵심이 외부 라이브러리 변경에 흔들리지 않기를 원합니다.

#### Acceptance Criteria

1. THE recurrence engine SHALL operate without `rrule` package dependency.
2. THE recurrence behavior SHALL be reproducible from repository-local code.
3. THE phase SHALL define recurrence behavior as project-owned policy.

### Requirement 2: Supported Recurrence Input Coverage

**User Story:** 개발자로서, 현재 시스템에서 입력되는 반복 포맷을 모두 안정적으로 처리하고 싶습니다.

#### Acceptance Criteria

1. THE engine SHALL support RRULE-like string input.
2. THE engine SHALL support object-based recurrence input.
3. THE engine SHALL support array-wrapped recurrence input.
4. WHEN input is invalid, THEN THE engine SHALL fail soft without app-level crash.

### Requirement 3: Normalized Rule Contract

**User Story:** 개발자로서, 서로 다른 입력을 단일 규칙 모델로 다루고 싶습니다.

#### Acceptance Criteria

1. THE engine SHALL convert supported inputs into one normalized rule contract.
2. THE normalized rule SHALL preserve frequency, day/month constraints, start date, and end-date semantics.
3. WHEN normalization fails, THEN THE rule SHALL be marked as unknown-safe state.

### Requirement 4: Date-only Safety Contract

**User Story:** 개발자로서, 반복 판정에서 timezone off-by-one 오류를 방지하고 싶습니다.

#### Acceptance Criteria

1. THE engine SHALL evaluate recurrence using date-only (`YYYY-MM-DD`) semantics.
2. THE engine SHALL reject/guard non-date-only comparisons in core decision paths.
3. THE engine SHALL apply strict date parsing policy in recurrence-critical logic.

### Requirement 5: End-date Resolution Policy

**User Story:** 개발자로서, 종료일 정보가 여러 소스에서 올 때 일관된 결과를 얻고 싶습니다.

#### Acceptance Criteria

1. THE engine SHALL resolve effective end date by deterministic priority policy.
2. THE policy SHALL consider recurrence source end-date and separate end-date field together.
3. WHEN both are present, THEN THE effective end date SHALL be computed consistently.
4. Invalid end-date format SHALL be handled as safe invalid input.

### Requirement 6: Frequency Semantics Fixation

**User Story:** 개발자로서, daily/weekly/monthly/yearly 판정 기준을 고정하고 싶습니다.

#### Acceptance Criteria

1. THE engine SHALL define deterministic semantics for daily recurrence.
2. THE engine SHALL define deterministic semantics for weekly recurrence (with/without weekday constraints).
3. THE engine SHALL define deterministic semantics for monthly recurrence.
4. THE engine SHALL define deterministic semantics for yearly recurrence.

### Requirement 7: Edge-case and Range Guard Policy

**User Story:** 개발자로서, 월말/윤년/역범위 같은 경계 상황에서 예측 가능한 동작을 원합니다.

#### Acceptance Criteria

1. THE engine SHALL define explicit policy for short-month and leap-year edge cases.
2. WHEN range end precedes range start, THEN expansion SHALL return empty result.
3. WHEN effective end date precedes start date, THEN expansion SHALL return empty result.
4. THE engine SHALL enforce range safety guard to prevent unbounded expansion with default `MAX_EXPANSION_DAYS = 366`.
5. WHEN requested expansion range exceeds `MAX_EXPANSION_DAYS`, THEN THE engine SHALL return safe failure (`[]` or explicit guard result) without crash.

### Requirement 8: Recurrence-related Database Contract

**User Story:** 개발자로서, 엔진과 데이터 레이어가 같은 recurrence 계약을 사용하길 원합니다.

#### Acceptance Criteria

1. THE local schema SHALL include recurrence end-date field.
2. THE local schema SHALL include recurrence window index for candidate filtering.
3. Candidate SQL filtering contract SHALL be documented and testable.
4. Final recurrence inclusion SHALL be decided by engine predicate, not SQL alone.

### Requirement 9: Greenfield Schema Initialization Policy

**User Story:** 개발자로서, 현재 단계에서 단순한 최신 스키마 기준으로 빠르게 진행하고 싶습니다.

#### Acceptance Criteria

1. THE phase SHALL allow reset/rebuild of local DB during development.
2. THE initialization path SHALL ensure latest recurrence-related schema state.
3. Legacy-row backfill SHALL NOT be a blocker for this phase.
4. Optional legacy migration concerns SHALL be treated as deferred scope.

### Requirement 10: Engine Validation Baseline

**User Story:** 개발자로서, 연동 전에 엔진 정확성을 독립적으로 검증하고 싶습니다.

#### Acceptance Criteria

1. THE validation baseline SHALL cover normalization across supported inputs.
2. THE validation baseline SHALL cover recurrence semantics by frequency.
3. THE validation baseline SHALL cover edge-case and range-guard behavior.
4. THE validation baseline SHALL include recurrence-schema initialization smoke checks.
5. THE validation baseline SHALL include safety checks for prohibited date-handling patterns.
6. THE validation baseline SHALL require engine unit tests and safety checks before phase completion.

## Scope for This Draft

포함:

1. recurrence 엔진의 입력/규칙/판정/안전성 요구
2. recurrence 관련 DB 계약과 초기화 정책
3. 연동 이전 독립 검증 기준

제외:

1. `useTodos`, `todo-calendar`, `strip-calendar` 공통 경로 연결
2. strip-calendar UI 표시/상호작용 연동
3. 모드 전환, 스크롤, 제스처 정책

## Reference

1. `.kiro/specs/[보류]strip-calendar-phase3-integration/phase3_recurrence_technical_spec_v3.md`
2. `.kiro/specs/calendar-data-integration/phase3_recurrence_technical_spec_v3.md`
