# Implementation Plan: Todo Calendar Legacy Retirement

Last Updated: 2026-03-17
Status: Completed

## Overview

이 플랜은 old `todo-calendar`를 active runtime에서 완전히 제거하고,
그 다음 source deletion까지 안전하게 수행하는 순서를 정의합니다.

원칙:

1. active runtime import 제거가 먼저
2. fallback/debug 정리가 그 다음
3. source deletion은 마지막

## Tasks

- [x] 1. Freeze retirement scope
  - Confirm this pass is legacy retirement, not another TC2 feature pass
  - Confirm `TC2` remains the canonical monthly runtime path
  - Confirm old calendar rollback-only artifacts are now in scope for removal

- [x] 2. Inventory residual legacy dependencies
  - Enumerate every active import of:
    - `todoCalendarStore`
    - `TodoCalendarScreen`
    - `calendarTodoService`
    - `todoCalendarAdapter`
  - Classify each dependency as:
    - runtime blocker
    - debug/test blocker
    - archive-only reference

- [x] 3. Remove old monthly invalidation from Todo CRUD hooks
  - Update:
    - `useCreateTodo`
    - `useUpdateTodo`
    - `useDeleteTodo`
  - Ensure primary monthly correctness still depends on `TC2` invalidation path only

- [x] 4. Remove legacy monthly dependency from cache invalidation
  - Update:
    - `invalidateAllScreenCaches`
    - `invalidateCompletionDependentCaches`
  - Preserve:
    - `TC2` mounted recovery
    - completion-only no broad `TC2` redraw

- [x] 5. Remove hidden legacy fallback route
  - Delete route:
    - `client/app/(app)/todo-calendar.js`
  - Delete fallback wrapper:
    - `LegacyTodoCalendarFallbackScreen`
  - Remove any route-based test assumptions that still expect fallback availability

- [x] 6. Clean debug/test ownership
  - Remove or replace legacy monthly references in:
    - `DebugScreen`
    - `CalendarServiceTestScreen`
    - any other active test routes/screens that keep old monthly feature alive
  - Prefer:
    - `TC2` diagnostics
    - shared query/cache diagnostics

- [x] 7. Rehome or remove remaining shared helpers
  - If any active code still imports reusable helpers from `client/src/features/todo-calendar/`
    that are not inherently legacy UI code, move them to a neutral shared location first
  - Do not delete shared helpers blindly

- [x] 8. Delete legacy monthly source
  - Remove `client/src/features/todo-calendar/` after active imports reach zero
  - Remove `client/src/screens/TodoCalendarScreen.js` if it becomes dead
  - Remove dead exports/re-exports tied only to the legacy monthly feature

- [x] 9. Verify import-zero state
  - Run `rg` against active app/source paths
  - Confirm no active route, hook, cache path, or screen imports the retired legacy monthly files

- [x] 10. Verify promoted monthly path after retirement
  - Web:
    - `calendar` opens `TC2`
    - live mutation/coarse invalidate still works
    - no fallback route remains
  - Native:
    - promoted `calendar` tab smoke on at least one platform

- [x] 11. Update docs
  - Update:
    - `PROJECT_CONTEXT.md`
    - `ROADMAP.md`
    - `README.md` if external current-state wording changes
  - Reflect that:
    - `TC2` is canonical monthly path
    - old `todo-calendar` is retired, not merely hidden

- [x] 12. Write retirement decision note
  - Record:
    - what was deleted
    - what was rehomed
    - what verification passed
    - whether any legacy monthly artifact intentionally remains
