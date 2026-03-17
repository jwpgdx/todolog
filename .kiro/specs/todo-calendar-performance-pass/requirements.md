# Todo Calendar Performance Pass Requirements

Last Updated: 2026-03-14
Status: Draft

## 1. Purpose

This spec defines a targeted optimization pass for `todo-calendar`.

The goal is to improve runtime cost and correctness without rewriting the
calendar shell. Current evidence does not justify a full replacement.

## 2. Scope

In scope:

- `client/src/features/todo-calendar/`
- todo-calendar cache invalidation behavior
- mounted-screen refresh behavior after cache clears
- month fetch scheduling and dedupe
- cache correctness when `startDayOfWeek` changes
- reducing rerender/projection breadth inside visible months

Out of scope:

- replacing `todo-calendar` with `week-flow-calendar`
- changing offline-first / SQLite / sync ordering contracts
- rendering completion state inside todo-calendar cells

## 3. Decision Baseline

1. The system SHALL treat `todo-calendar` as salvageable with targeted changes.
2. The implementation SHALL NOT introduce a second calendar rewrite path in this scope.
3. Performance work SHALL prioritize high-leverage fixes before deeper structural changes.

## 4. Functional / Correctness Requirements

### 4.1 Completion Isolation

1. IF `todo-calendar` does not render completion state, THEN completion-only updates SHALL NOT cause month cache churn that is irrelevant to this screen.
2. `todo-calendar` SHALL NOT subscribe to completion data that is not used by rendered cells.
3. Completion-only invalidation SHALL NOT fall back to a blind `clearAll()` path that leaves a mounted calendar empty without scheduled recovery.

### 4.2 Mounted Recovery

1. IF todo-calendar cache is cleared or invalidated while the screen is mounted, THEN the screen SHALL schedule one re-ensure of the current visible range.
2. The recovery path SHALL run without requiring manual scroll, focus change, or route remount.
3. The recovery trigger SHALL be bounded to the currently visible or last-known visible range.

### 4.3 Fetch Scheduling

1. Viewability-driven fetch scheduling SHALL dedupe repeated requests for the same effective visible range.
2. Small/no-op viewability churn SHALL NOT repeatedly enqueue equivalent fetch work.
3. Prefetch behavior MAY keep a small buffer, but SHALL avoid unnecessary repeated work during active scroll.

### 4.4 Cache Contract Correctness

1. Month cache validity SHALL account for `startDayOfWeek`.
2. IF `startDayOfWeek` changes, THEN stale month payloads derived from the previous week boundary SHALL NOT be reused.

## 5. Rendering / Performance Requirements

### 5.1 Projection Reuse

1. The implementation SHALL avoid rebuilding equivalent date projections multiple times across service/store/UI boundaries.
2. IF a date-keyed projection already exists from the adapter layer, THEN todo-calendar SHOULD reuse or preserve that projection instead of reconstructing it in `MonthSection`.

### 5.2 Granular Rendering

1. The UI SHOULD move toward date-keyed subscription or equivalent fine-grained props so a localized day change does not rerender an entire visible month subtree.
2. Unrelated date updates within the same month SHOULD NOT require recomputing every day map for that month.
3. Object identity for unchanged day-level records SHOULD be preserved where practical.

### 5.3 Dev Noise Control

1. Performance evaluation SHALL distinguish real architecture cost from development-only logging noise.
2. The optimization pass MAY disable or gate hot-path logs that distort measurement.

## 6. Guardrails

1. Offline-first behavior SHALL remain unchanged.
2. Shared range cache SHALL remain the canonical upstream query source.
3. Recurrence evaluation SHALL continue to use the common query/aggregation path.
4. This pass SHALL NOT introduce per-frame JS settle loops or scroll correction logic.

## 7. Acceptance Criteria

1. Completion-only updates no longer cause unnecessary todo-calendar cache churn.
2. Mounted todo-calendar recovers automatically after clear/invalidation events.
3. Repeated viewability events for the same range no longer trigger redundant fetch scheduling.
4. `startDayOfWeek` changes no longer reuse invalid month cache payloads.
5. At least one projection/rendering hotspot is reduced without rewrite-level migration cost.
