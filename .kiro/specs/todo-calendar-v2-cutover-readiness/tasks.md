# Implementation Plan: Todo Calendar V2 Cutover Readiness

Last Updated: 2026-03-15
Status: In Progress

## Overview

이 플랜은 `TC2`를 old `todo-calendar`의 실제 대체 후보로 만들기 위한 최소 준비 작업입니다.

원칙:

1. renderer를 다시 만들지 않는다
2. invalidation / refresh / route stability를 먼저 닫는다
3. readiness 완료와 legacy deletion을 분리한다

## Tasks

- [x] 1. Freeze the readiness scope
  - Confirm `TC2` is the replacement candidate, not yet the primary replacement
  - Keep old `todo-calendar` unchanged during readiness work
  - Keep completion glyphs out of scope
  - Notes:
    - readiness spec created and aligned with current baseline/cutover boundary
    - `TC2` remains the candidate path, not the primary replacement

- [x] 2. Preserve and document the TC2 validation scenario
  - Keep the seeded `Scenario 7` validation dataset
  - Treat it as the canonical repro set for:
    - adjacent-month span
    - cross-week span
    - timed multi-day span
    - recurring single-day
    - overflow
  - Notes:
    - `Scenario 7` added in `guestDataHelper`
    - scenario button added in `GuestMigrationTestScreen`

- [x] 3. Add a TC2 invalidation bridge
  - Define one canonical invalidation entry for `TC2` month layouts
  - Add a minimal mounted visible-context contract for:
    - visible month ids
    - anchor month id
    - idle reensure target
  - Support:
    - Todo create/update/delete
    - category coarse invalidation
    - sync/global cache invalidation
  - Ensure clear/reset is always followed by an idle-safe reensure path
  - Notes:
    - `TC2` store now tracks visible context + `reensureSeq`
    - `todoCalendarV2InvalidationService` added as the canonical invalidation entry

- [x] 4. Wire Todo CRUD to TC2 readiness behavior
  - Update Todo mutation hooks so visible `TC2` layouts recover without app restart
  - Prefer bounded invalidation by affected month/range
  - Avoid broad layout clears when a smaller invalidation is sufficient
  - Touch points:
    - `useCreateTodo`
    - `useUpdateTodo`
    - `useDeleteTodo`
  - Notes:
    - create/update/delete now invalidate bounded `TC2` month layouts and range-cache date spans
    - visible mounted `TC2` window queues idle reensure only when the affected range overlaps it

- [x] 5. Wire coarse invalidation to TC2 readiness behavior
  - Update global cache invalidation path so `TC2` layouts do not remain stale after:
    - category changes
    - sync-driven data refresh
    - full screen cache clears
  - Ensure mounted visible `TC2` range can re-render after invalidation
  - Touch points:
    - `cacheInvalidationService`
    - any shared sync-driven clear path used by app recovery flows
  - Notes:
    - `invalidateAllScreenCaches` now clears `TC2` layouts and queues reensure when `TC2` has visible context

- [x] 6. Explicitly exclude completion-only redraw churn
  - Verify completion-only changes do not broad-invalidate `TC2`
  - Keep completion behavior out of the line-layout contract
  - Document any unavoidable residual coupling
  - Notes:
    - `useToggleCompletion` still invalidates old calendar/query paths, but no `TC2` clear/reensure path was added
    - readiness web harness confirmed completion toggle does not blank the mounted `TC2` surface

- [x] 7. Re-validate route and initial render stability
  - Web:
    - open `TC2`
    - confirm first visible month renders without blank fallback persistence
  - Android:
    - confirm initial month renders without requiring manual scroll
  - iOS:
    - confirm route/tab entry still renders seeded layout
  - Notes:
    - Android initial blank issue fixed with synthetic initial visible dispatch
    - web/iOS/Android route and baseline render were revalidated after the fix

- [x] 8. Validate mutation refresh with real data
  - Using the `Scenario 7` dataset:
    - create one visible-range Todo
    - update one visible-range Todo
    - delete one visible-range Todo
  - Confirm `TC2` reflects changes without app restart
  - Notes:
    - added hidden readiness harness route with live `TC2` surface
    - web Playwright flow verified create/update/delete refresh on mounted `TC2` without app restart

- [x] 9. Validate coarse refresh and completion policy
  - Simulate category/sync-style invalidation
  - Confirm visible `TC2` layout recovers
  - Toggle completion for at least one visible item
  - Confirm no broad `TC2` redraw path is introduced
  - Notes:
    - readiness Playwright flow verified coarse invalidate -> mounted `TC2` recovery
    - same flow verified completion toggle keeps mounted `TC2` visible and stable

- [x] 10. Write the readiness decision
  - Summarize:
    - what now works
    - what still blocks cutover
    - whether `TC2` is replacement-ready or still evaluation-only
  - Explicitly state whether a separate cutover spec is now justified
  - Decision:
    - readiness gates in this spec are satisfied for the frozen baseline
    - `TC2` is now replacement-ready as the baseline monthly line-calendar candidate
    - this does NOT imply immediate legacy deletion or primary-tab swap
    - a separate cutover decision/spec is now justified for navigation promotion and legacy retirement
