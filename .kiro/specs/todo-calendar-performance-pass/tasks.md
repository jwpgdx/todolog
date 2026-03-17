# Implementation Plan: Todo Calendar Performance Pass

## Overview

This plan follows the verdict: targeted improvements, not rewrite.

Execution order matters:

- remove churn first
- restore correctness/recovery next
- then refine projection granularity

## Tasks

- [ ] 1. Audit the current todo-calendar hot path and capture target files
  - Confirm current touchpoints:
    - `client/src/features/todo-calendar/hooks/useTodoCalendarData.js`
    - `client/src/features/todo-calendar/store/todoCalendarStore.js`
    - `client/src/features/todo-calendar/services/calendarTodoService.js`
    - `client/src/features/todo-calendar/ui/MonthSection.js`
    - `client/src/features/todo-calendar/ui/WeekRow.js`
    - `client/src/features/todo-calendar/ui/DayCell.js`
    - `client/src/services/query-aggregation/cache/cacheInvalidationService.js`
    - `client/src/hooks/queries/useToggleCompletion.js`
  - Summarize current completion coupling, invalidation path, and projection duplication before edits

- [ ] 2. Remove completion-driven churn from todo-calendar render path
  - Stop passing/subscribing completion data where the UI does not use it
  - Update completion invalidation so todo-calendar does not `clearAll()` or invalidate broad month caches unnecessarily for completion-only changes
  - Keep React Query completion/todo correctness intact for non-calendar consumers

- [ ] 3. Add mounted todo-calendar reensure after coarse invalidation
  - Add a lightweight reensure signal to `todoCalendarStore`
  - Trigger it on `clearAll()` / coarse invalidation paths that affect mounted calendar correctness
  - Update `useTodoCalendarData` to re-fetch the current/last-known visible range once when signaled

- [ ] 4. Dedupe visible-range fetch scheduling
  - Normalize visible month range into a stable dedupe key
  - Skip no-op viewability churn for equivalent range requests
  - Preserve queue-drain behavior for genuinely newer visible ranges

- [ ] 5. Fix `startDayOfWeek` cache correctness
  - Ensure cached month payloads are not reused across incompatible `startDayOfWeek` settings
  - Prefer a low-risk invalidation/rebuild approach first
  - Verify Sunday vs Monday produces correct range/layout after switching

- [ ] 6. Preserve date-keyed projection from service to UI
  - Evaluate the minimal store shape change needed to keep date-keyed month projection
  - Reduce or remove `MonthSection`’s `todosByDate` reconstruction
  - Keep unchanged day-level records stable where practical

- [ ] 7. Narrow rerender scope inside visible months
  - Reduce month-wide prop churn between `MonthSection`, `WeekRow`, and `DayCell`
  - Prefer date-keyed buckets or per-date selectors over full-month recomputation
  - Avoid large refactors unless profiling shows they are necessary

- [ ] 8. Re-check log noise on hot paths
  - Identify hot-path logs in `todo-calendar` fetch/store hooks
  - Gate or remove logs that materially distort dev-mode performance testing
  - Do not remove logs that are still needed for current sync/debug investigations without replacement

- [ ] 9. Verify behavior and performance after each phase
  - Web:
    - open calendar
    - scroll through months
    - toggle completion
    - change `startDayOfWeek`
  - Confirm mounted calendar recovers after invalidation without manual focus/scroll
  - Confirm redundant viewability churn no longer issues equivalent work
  - If feasible, capture React rerender/profiler evidence for visible month updates

- [ ] 10. Final decision checkpoint
  - Re-evaluate whether Phase A + Phase B sufficiently address todo-calendar cost
  - Only if strong structural problems remain after this pass, open a separate rewrite spec
