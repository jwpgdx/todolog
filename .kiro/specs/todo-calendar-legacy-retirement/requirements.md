# Requirements Document: Todo Calendar Legacy Retirement

Last Updated: 2026-03-17
Status: Draft

## Introduction

이 스펙은 old `todo-calendar`를 앱의 active runtime에서 완전히 은퇴시키기 위한
요구사항을 정의합니다.

현재 상태는 다음과 같습니다.

- `calendar` 탭의 primary monthly path는 이미 `TC2`입니다.
- old `todo-calendar`는 사용자 기본 경로에서는 내려갔지만,
  runtime invalidation / hidden fallback route / debug-test 경로에 아직 남아 있습니다.
- 따라서 지금 old `todo-calendar` 폴더를 바로 삭제하면 runtime import가 깨질 수 있습니다.

이번 스펙의 목적은 “파일만 지우기”가 아니라,
old monthly calendar의 **runtime dependency를 0으로 만들고**,
그 다음에 source deletion까지 안전하게 수행하는 것입니다.

## Naming

- `TC2`: `client/src/features/todo-calendar-v2/` line-monthly implementation
- `Legacy_Todo_Calendar`: old dot-based monthly calendar implementation under `client/src/features/todo-calendar/`
- `Legacy_Runtime_Dependency`: old calendar store/service/route/debug path 중 아직 앱이 실제로 참조하는 것
- `Retirement`: old calendar runtime dependency 제거 + hidden fallback 제거 + source deletion

## Requirements

### Requirement 1: Retirement Preconditions

**User Story:** 개발자로서, primary calendar가 아직 불안정한데 legacy를 너무 일찍 지우고 싶지 않습니다.

#### Acceptance Criteria

1. Retirement SHALL begin only after `TC2` remains the accepted primary monthly path.
2. Retirement SHALL NOT assume that “primary tab cutover” alone means legacy deletion is already safe.
3. The retirement pass SHALL explicitly review the residual risks left by the `todo-calendar-v2-cutover` spec before deleting legacy source files.

### Requirement 2: Runtime Dependency Removal

**User Story:** 개발자로서, old calendar source를 삭제하기 전에 런타임이 더 이상 그 코드를 참조하지 않길 원합니다.

#### Acceptance Criteria

1. Todo CRUD hooks SHALL stop depending on `todoCalendarStore` invalidation for user-facing monthly calendar behavior.
2. Global cache invalidation SHALL stop requiring old `todo-calendar` store clears for correctness of the primary calendar path.
3. Completion-only invalidation SHALL continue to avoid broad `TC2` redraw and SHALL NOT depend on the legacy monthly store.
4. After retirement, the active monthly runtime path SHALL be satisfied by `TC2` plus shared lower layers only.

### Requirement 3: Route and Fallback Removal

**User Story:** 개발자로서, hidden fallback route까지 포함한 legacy surface를 정리하고 싶습니다.

#### Acceptance Criteria

1. The hidden fallback route `/(app)/todo-calendar` SHALL be removed when retirement is complete.
2. `LegacyTodoCalendarFallbackScreen` SHALL be removed once no rollback-only route depends on it.
3. The app SHALL expose only the promoted `calendar` tab as the monthly calendar surface after retirement.

### Requirement 4: Debug/Test Boundary Cleanup

**User Story:** 개발자로서, debug/test 코드 때문에 legacy monthly implementation이 계속 살아남지 않길 원합니다.

#### Acceptance Criteria

1. Debug and test surfaces SHALL NOT require `Legacy_Todo_Calendar` runtime code after retirement.
2. Any remaining monthly-calendar diagnostics SHALL target `TC2` or shared lower layers instead.
3. Legacy-only debug/test screens MAY be removed, replaced, or archived, but they SHALL NOT keep the legacy monthly feature in the active source tree by accident.

### Requirement 5: Source Deletion Safety

**User Story:** 개발자로서, import가 남아 있는 상태에서 source를 지우는 실수를 피하고 싶습니다.

#### Acceptance Criteria

1. `Legacy_Todo_Calendar` source deletion SHALL happen only after runtime and test imports are reduced to zero or explicitly archived.
2. The retirement pass SHALL verify that no active route, active hook, active cache invalidation path, or active screen imports the deleted legacy files.
3. If a shared lower-layer helper from the legacy folder is still needed, it SHALL be moved or rehomed before deleting the legacy feature folder.

### Requirement 6: Scope Boundary

**User Story:** 개발자로서, legacy retirement 작업이 TC2 신규 기능 추가로 번지지 않길 원합니다.

#### Acceptance Criteria

1. This retirement SHALL focus on legacy removal only.
2. This retirement SHALL NOT add completion glyphs, event taps, or new monthly layout behavior to `TC2`.
3. This retirement SHALL NOT redesign shared query/aggregation beyond what is necessary to detach legacy runtime dependencies.

### Requirement 7: Verification

**User Story:** 개발자로서, old calendar를 지운 뒤 monthly path가 계속 안전한지 확인하고 싶습니다.

#### Acceptance Criteria

1. The retirement pass SHALL include an import-level verification proving no active code path depends on `Legacy_Todo_Calendar`.
2. The retirement pass SHALL include web verification that:
   - `calendar` still opens `TC2`
   - mounted mutation/coarse invalidate behavior still works
   - no legacy fallback route remains
3. The retirement pass SHALL include at least one native smoke verification for the promoted `calendar` tab after legacy removal.
