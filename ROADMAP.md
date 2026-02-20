# Todolog Roadmap

Last Updated: 2026-02-20
Owner: Product + Engineering

## 1. Purpose

This roadmap tracks:

- completed milestones (with dates)
- current focus
- upcoming work by priority

For implementation truth, see `PROJECT_CONTEXT.md`.
For execution rules, see `.kiro/steering/requirements.md`.

## 2. Current Focus

Current state:

- Phase 2.5 data normalization is complete
- Sync hardening (`Pending Push -> Delta Pull`) is complete
- Strip-calendar module is in stabilization/debugging phase
- Phase 3 recurrence engine is the next major deliverable

Immediate objective:

- maintain sync operational stability (retry/dead-letter/throughput monitoring)
- stabilize strip-calendar weekly/monthly settle behavior and mode-anchor consistency
- start Phase 3 recurrence engine kickoff

## 3. Dated Milestones (Completed)

### 2026-01-28

- Cache strategy optimization baseline documented and improved
- Architecture and performance docs refreshed

### 2026-01-29

- Infinite scroll calendar and dynamic event architecture delivered (legacy UltimateCalendar line)
- Documentation reorganized into archive structure

### 2026-01-30

- Category Cache-First strategy stabilized
- Event color sync and offline display consistency improved

### 2026-02-02

- Completion offline sync and cache optimization updates completed

### 2026-02-03

- SQLite migration completed (core entities moved to SQLite)
- UUID migration completed (tempId removed, String IDs unified)
- Debug and operational docs cleanup

### 2026-02-07 to 2026-02-08

- Refactor into `services/db` and `services/sync`
- Removed unnecessary background API calls from query hooks
- Introduced centralized sync service behavior

### 2026-02-10

- Hybrid cache strategy refactor completed
- Completion toggle recurrence bug fixed
- SQLite upsert conflict handling corrected

### 2026-02-11

- Settings storage unified into authStore-based flow
- New infinite-scroll calendar UX iteration completed

### 2026-02-12

- Legacy UltimateCalendar implementation archived
- New `todo-calendar` module path established as active path

### 2026-02-13

- Phase 2.5 migration and cleanup completed
  - Mongo date-field migration script delivered
  - Dry-run: 41/41 updated, 0 failed
  - Live migration: 41/41 modified, no date drift mismatch
  - Legacy schedule fields blocked in API
  - Final integration checkpoint passed

Evidence:

- `.kiro/specs/calendar-data-integration/log.md`
- `.kiro/specs/calendar-data-integration/tasks.md`

### 2026-02-14

- `currentDate` timezone alignment completed for runtime UX consistency
  - App startup now derives `currentDate` from `user.settings.timeZone`
  - Runtime timezone change now conditionally realigns only when user is on previous "today"
  - Auto-jump is blocked while todo form is open to protect in-progress input
  - Todo form default time and quick labels now use user timezone

Evidence:

- `client/src/store/dateStore.js`
- `client/src/utils/timeZoneDate.js`
- `client/App.js`
- `client/src/screens/TodoScreen.js`
- `client/src/features/todo/form/useTodoFormLogic.js`

### 2026-02-15

- Strip-calendar implementation line established and instrumented for stabilization
  - Separate weekly/monthly FlashList path with anchor-based mode transitions
  - Weekly viewport-width based offset sync and quantized settle handling
  - Monthly week-snap path with web idle-settle fallback guards/cooldowns
  - Centralized strip-calendar tuning constants and structured debug log format (`seq/at/dt`)
  - Dedicated test route (`Strip` tab) kept for iterative UX tuning

Evidence:

- `client/src/features/strip-calendar/ui/WeeklyStripList.js`
- `client/src/features/strip-calendar/ui/MonthlyStripList.js`
- `client/src/features/strip-calendar/ui/StripCalendarShell.js`
- `client/src/features/strip-calendar/utils/stripCalendarConstants.js`
- `client/src/features/strip-calendar/utils/stripCalendarDebug.js`
- `client/src/screens/StripCalendarTestScreen.js`

### 2026-02-16

- Strip-calendar monthly -> weekly target-resolution policy hardened
  - Cleared stale `weeklyTargetWeekStart` on monthly settle and before monthly->weekly toggle
  - Added one-shot mode-switch target policy:
    - if `currentDate` week is visible in monthly 5-row viewport, prefer `currentWeekStart`
    - otherwise use `monthlyTopWeekStart`
  - Added generic monthly viewport date-visibility utility for consistent date-rule evaluation
  - Updated strip-calendar specs (`requirements/tasks/design`) to lock transition rule
- Strip-calendar weekly interaction policy revised to swipe-intent-only navigation
  - Disabled direct free horizontal inertial scrolling in weekly mode
  - Added one-shot horizontal swipe intent mapping to existing prev/next week actions
  - Removed web horizontal wheel/trackpad `deltaX` mapping from weekly navigation path (PanResponder-only)
- Strip-calendar bottom mode-toggle policy finalized as swipe-only
  - Removed bottom bar click/tap toggle action
  - Direction policy: `Weekly_Mode` swipe-down => `Monthly_Mode`, `Monthly_Mode` swipe-up => `Weekly_Mode`
- Strip-calendar month-boundary label consistency fix
  - Fixed omission case where month label could be skipped when day `1` was rendered as the first cell of a week row
  - Month label now appears for day `1` across both weekly/monthly rendering paths
- Strip-calendar day-cell readability improvement
  - Added subtle odd/even month background tint to reduce month-transition confusion
  - Preserved visual priority of selected circle, today bold text, and dot indicators

Evidence:

- `client/src/features/strip-calendar/ui/StripCalendarShell.js`
- `client/src/features/strip-calendar/ui/ModeToggleBar.js`
- `client/src/features/strip-calendar/hooks/useStripCalendarController.js`
- `client/src/features/strip-calendar/utils/stripCalendarDateUtils.js`
- `client/src/features/strip-calendar/ui/DayCell.js`
- `client/src/features/strip-calendar/ui/WeeklyStripList.js`
- `.kiro/specs/strip-calendar/requirements.md`
- `.kiro/specs/strip-calendar/design.md`
- `.kiro/specs/strip-calendar/tasks.md`

### 2026-02-20

- Sync service hardening completed (`Pending Push -> Delta Pull`)
  - Pending queue v5 migration applied (`retry_count`, `last_error`, `next_retry_at`, `status`)
  - Replay routing completed for todo/category/completion (toggle replay 금지)
  - Retry/backoff/dead-letter policy and cursor commit rule 적용
  - Delta pull path stabilized (category full + todo/completion delta)
  - Performance/operations checks and trigger dedupe checks completed

Evidence:

- `.kiro/specs/sync-service-pending-delta/requirements.md`
- `.kiro/specs/sync-service-pending-delta/design.md`
- `.kiro/specs/sync-service-pending-delta/tasks.md`
- `.kiro/specs/sync-service-pending-delta/log.md`

## 4. Next Milestones (Planned)

## P0: Phase 3 Recurrence Engine

Target:

- implement recurrence behavior on top of floating string contract

Entry criteria:

1. Spec consistency check across:
   - `.kiro/specs/calendar-data-integration/requirements.md`
   - `.kiro/specs/calendar-data-integration/design.md`
   - `.kiro/specs/calendar-data-integration/tasks.md`
   - `.kiro/specs/calendar-data-integration/phase3_recurrence_technical_spec_v3.md`
2. Regression baseline for:
   - todo CRUD
   - sync pipeline
   - Google adapter

## P1: Reliability and Operational Hardening

- reduce noisy debug logs in runtime-critical paths
- improve smoke-test checklist automation
- tighten rollback checklist for migration scripts

## P2: Data Lifecycle Policy

- define retention/cleanup policy for old completions
- define policy for long-lived soft-deleted records

## P3: UX and Product Expansion

- incremental UI/UX polish for calendar and form flows
- evaluate additional platforms/features after Phase 3 stability

## 5. Parking Lot

These are intentionally deferred until P0/P1 are stable:

- deep sync architecture redesign beyond current service model
- advanced recurrence UI redesign
- long-term analytics/performance instrumentation program

## 6. Update Policy

When a milestone is completed:

1. Add exact date (`YYYY-MM-DD`)
2. Add concise outcome
3. Add evidence link (spec log, task file, or commit range)
4. Move item from planned -> completed

When scope changes:

- update this roadmap and the corresponding feature specs in the same working session
