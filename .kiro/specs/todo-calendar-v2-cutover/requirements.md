# Requirements Document: Todo Calendar V2 Cutover

Last Updated: 2026-03-15
Status: Draft

## Introduction

이 스펙은 `todo-calendar-v2`(`TC2`)를 실제 사용자 기본 monthly calendar surface로
승격하기 위한 cutover 요구사항을 정의합니다.

현재 상태는 다음과 같습니다.

- `TC2` readiness spec의 baseline gate는 통과함
- `TC2`는 mounted mutation refresh / coarse invalidation / completion-no-op policy까지 검증됨
- 하지만 앱 기본 탭은 여전히 기존 `calendar`와 별도 `TC2` 탭이 병존하는 상태임
- old `todo-calendar`는 아직 active primary path로 남아 있음

이번 스펙의 목적은 “새 캘린더를 하나 더 유지”하는 것이 아니라,
`TC2`를 기본 monthly calendar path로 승격하고,
old `todo-calendar`를 primary navigation에서 내리는 것입니다.

단, 이번 cutover는 곧바로 legacy 코드 삭제를 뜻하지 않습니다.
legacy 삭제는 별도 retirement 단계로 분리합니다.

## Naming

- `Primary_Calendar_Tab`: 사용자가 기본으로 여는 `calendar` 탭
- `Legacy_Todo_Calendar`: 기존 dot-based monthly calendar
- `TC2`: `todo-calendar-v2` line-monthly implementation
- `Fallback_Route`: 문제가 생겼을 때 old calendar를 다시 확인할 수 있는 hidden route

## Requirements

### Requirement 1: Primary Calendar Promotion

**User Story:** 사용자로서, 기본 `calendar` 탭에서 새 monthly calendar를 바로 보고 싶습니다.

#### Acceptance Criteria

1. The app SHALL promote `TC2` to the `Primary_Calendar_Tab`.
2. The active `calendar` tab route SHALL render `TC2`, not `Legacy_Todo_Calendar`.
3. User-facing tab naming for the primary calendar SHALL remain stable unless intentionally changed in the same cutover.

### Requirement 2: Duplicate Surface Removal

**User Story:** 사용자로서, 같은 역할의 달력 탭이 둘 이상 보여 헷갈리지 않길 원합니다.

#### Acceptance Criteria

1. The default bottom tab bar SHALL NOT expose both `calendar` and `todo-calendar-v2` as parallel primary monthly calendar surfaces after cutover.
2. The temporary `TC2` validation tab SHALL be removed or hidden from the default tab bar.
3. The cutover SHALL leave exactly one primary monthly calendar entry in active bottom navigation.

### Requirement 3: Legacy Fallback Boundary

**User Story:** 개발자로서, cutover 직후 문제가 생기면 old calendar를 완전히 잃지 않고 fallback 확인을 하고 싶습니다.

#### Acceptance Criteria

1. `Legacy_Todo_Calendar` SHALL be removed from primary tab navigation.
2. `Legacy_Todo_Calendar` MAY remain available through a hidden test/debug route during the fallback window.
3. The fallback route SHALL be clearly non-primary and SHALL NOT be user-facing in normal bottom navigation.
4. This cutover SHALL NOT require immediate deletion of legacy feature code.

### Requirement 4: Data Freshness Continuity

**User Story:** 사용자로서, primary calendar가 바뀌어도 Todo/Category 변경 후 달력 갱신이 계속 정상적으로 보이길 원합니다.

#### Acceptance Criteria

1. After cutover, the promoted `calendar` tab SHALL preserve the `TC2` mutation refresh behavior already validated in readiness.
2. Coarse invalidation and sync-driven cache clears SHALL continue to recover the mounted primary calendar surface.
3. Completion-only changes SHALL continue to avoid broad `TC2` redraw in the frozen baseline.

### Requirement 5: Rollback Safety

**User Story:** 개발자로서, cutover 후 blocker가 생기면 빠르게 되돌릴 수 있길 원합니다.

#### Acceptance Criteria

1. The cutover SHALL keep rollback complexity low.
2. Rollback to `Legacy_Todo_Calendar` SHALL be possible by route binding change, not by reconstructing deleted logic.
3. Any rollback-critical legacy route/screen kept for the fallback window SHALL remain isolated from primary navigation.

### Requirement 6: Validation Before Promotion

**User Story:** 개발자로서, navigation promotion을 감으로 하지 않고 최소 검증 후 올리고 싶습니다.

#### Acceptance Criteria

1. The cutover SHALL include web validation of:
   - `calendar` tab opening `TC2`
   - no duplicate primary monthly tab
   - seeded/live mutation flow still rendering in the promoted path
2. The cutover SHALL include at least one native smoke validation for the promoted primary tab.
3. The cutover SHALL confirm the fallback route still opens `Legacy_Todo_Calendar`.

### Requirement 7: Scope Boundary

**User Story:** 개발자로서, cutover 작업이 다시 새 기능 개발로 번지지 않게 하고 싶습니다.

#### Acceptance Criteria

1. This cutover SHALL focus on navigation promotion, fallback retention, and verification.
2. This cutover SHALL NOT add completion glyphs, event taps, or new monthly layout rules.
3. This cutover SHALL NOT delete `Legacy_Todo_Calendar` feature code unless a separate retirement pass is approved.
