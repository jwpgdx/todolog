# Requirements Document: Week Flow Calendar Cutover

## Introduction

이 스펙은 기존 `strip-calendar` 레거시 구현을 `week-flow-calendar`로 최종 대체하기 위한
컷오버(cutover) 요구사항을 정의합니다.

현재 상태는 다음과 같습니다.

- `week-flow-calendar`는 별도 탭/테스트 화면에서 동작 중
- `strip-calendar`는 여전히 탭, store, invalidation 경로, debug 코드에 남아 있음
- Todo CRUD / sync cache invalidation 일부가 아직 strip 의존성을 직접 참조함

이번 스펙의 목표는 “새 캘린더를 하나 더 추가”하는 것이 아니라,
`week-flow-calendar`를 **유일한 활성 대체 경로**로 확정하고
`strip-calendar`를 **런타임 의존성에서 제거**하는 것입니다.

본 스펙은 다음을 목표로 합니다.

1. `week-flow-calendar`를 활성 평가/대체 구현으로 확정한다.
2. strip 관련 런타임 의존성을 제거한다.
3. CRUD / sync / cache invalidation 이후 달력 marker 갱신이 계속 정상 동작하도록 유지한다.
4. 성능 우선 원칙을 유지한 채 legacy surface를 정리한다.

## Naming

- New canonical implementation: `Week Flow Calendar`
- Legacy implementation: `Strip Calendar Legacy`
- Spec folder: `.kiro/specs/week-flow-calendar-cutover/`

## Glossary

- `Cutover`: 새 구현을 canonical path로 전환하고 legacy runtime reference를 제거하는 작업
- `Canonical_Calendar`: 앞으로 유지/확장할 기준 캘린더 구현 (`week-flow-calendar`)
- `Legacy_Strip`: 제거 대상인 기존 `strip-calendar` 구현
- `Runtime_Dependency`: 앱 부팅, 라우트, mutation, sync, cache invalidation 등 실제 동작에 영향을 주는 import/reference
- `Debug_Only_Reference`: debug/test/archive에서만 쓰이는 참조
- `Marker_Summary_Path`: `calendar-day-summaries` + common range cache 기반의 날짜 dot 요약 경로

## Requirements

### Requirement 1: Canonical Calendar Ownership

**User Story:** 개발자로서, 앞으로 유지할 캘린더 구현을 하나로 확정하고 싶습니다.

#### Acceptance Criteria

1. THE app SHALL treat `week-flow-calendar` as the canonical calendar rewrite path.
2. THE cutover SHALL define `strip-calendar` as legacy, not as an active alternative.
3. Future calendar-specific enhancements SHALL target `week-flow-calendar`, not `strip-calendar`.

### Requirement 2: Runtime Strip Dependency Removal

**User Story:** 개발자로서, strip 관련 코드가 런타임 동작을 계속 끌어당기지 않게 하고 싶습니다.

#### Acceptance Criteria

1. Todo mutation hooks SHALL NOT import or call strip-specific summary invalidation code.
2. Global cache invalidation / sync invalidation SHALL NOT import or clear strip-specific stores.
3. App boot and normal navigation SHALL NOT require any strip-specific store/service to exist.
4. After cutover, any remaining strip references MUST be debug-only or archived, not runtime-critical.

### Requirement 3: Navigation Surface Cleanup

**User Story:** 사용자로서, 앱에 legacy calendar와 replacement calendar가 동시에 노출되어 헷갈리지 않길 원합니다.

#### Acceptance Criteria

1. THE default tab/navigation surface SHALL NOT expose a `strip` route after cutover.
2. THE `week-flow` route SHALL remain available as the active evaluation/replacement surface.
3. THE cutover SHALL remove or hide legacy strip-specific screen exports from active tab navigation.

### Requirement 4: Marker and Invalidation Continuity

**User Story:** 사용자로서, Todo/Category가 바뀌면 새 캘린더의 dot marker가 계속 정상적으로 갱신되길 원합니다.

#### Acceptance Criteria

1. Todo create/update/delete SHALL continue to invalidate and refresh visible marker summaries through the `calendar-day-summaries` path.
2. Category-driven coarse invalidation SHALL continue to recover visible marker summaries without strip store involvement.
3. Sync-driven cache invalidation SHALL continue to clear and re-ensure the active summary path correctly.
4. The cutover SHALL NOT reintroduce direct SQLite access from calendar UI code.

### Requirement 5: Performance Guardrails During Cutover

**User Story:** 개발자로서, legacy 제거 작업 때문에 새 캘린더 성능이 악화되지 않게 하고 싶습니다.

#### Acceptance Criteria

1. THE cutover SHALL preserve the performance-first interaction model already established in `week-flow-calendar`.
2. THE cutover SHALL NOT reintroduce strip-style settle loops, large legacy state machines, or high-volume default logging.
3. Existing monthly buffer and retention tuning in `week-flow-calendar` / `calendar-day-summaries` SHALL remain configurable after cutover.

### Requirement 6: Debug and Legacy Code Policy

**User Story:** 개발자로서, 당장 필요한 런타임 정리와 나중에 지울 legacy debug 코드를 구분하고 싶습니다.

#### Acceptance Criteria

1. THE implementation SHALL classify strip references into `runtime-critical` and `debug/archive-only`.
2. Runtime-critical strip references SHALL be removed in the cutover.
3. Debug/archive-only strip code MAY remain temporarily, but it MUST be clearly marked non-canonical and MUST NOT be imported by runtime code.
4. IF strip code is fully removable after reference cleanup, THEN the feature folder MAY be deleted in the same cutover.

### Requirement 7: Verification Before Legacy Retirement

**User Story:** 개발자로서, strip를 지우기 전에 week-flow가 대체 경로로 충분한지 검증하고 싶습니다.

#### Acceptance Criteria

1. THE cutover SHALL include web smoke verification for app shell and login/basic navigation.
2. THE cutover SHALL include manual or scripted verification that `week-flow` route opens and renders weekly/monthly mode.
3. THE cutover SHALL include marker/invalidation verification after at least one Todo mutation path.
4. Strip removal SHALL NOT be declared complete unless runtime imports/routes are removed and verification passes.

### Requirement 8: Scope Boundaries

**User Story:** 개발자로서, cutover 작업이 다시 새 기능 개발로 번지지 않게 하고 싶습니다.

#### Acceptance Criteria

1. This cutover SHALL focus on replacement, dependency removal, and verification.
2. This cutover SHALL NOT redesign `week-flow-calendar` visuals.
3. This cutover SHALL NOT introduce a new schedule rendering model beyond the existing day-summary marker path.
4. Separate performance tuning beyond small safe constants MAY be deferred to later work.
