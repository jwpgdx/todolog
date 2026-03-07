# Implementation Plan: Week Flow Calendar

## Overview

This plan creates a new bounded calendar UI under a new name, while keeping the existing
date-summary adapter and selected-date contract.

The rewrite goal is not to patch `Strip Calendar Legacy`, but to replace its UI shell and
navigation model with a simpler implementation.

## Tasks

- [ ] 1. Create new feature path
  - Create `client/src/features/week-flow-calendar/`
  - Add subfolders:
    - `ui/`
    - `utils/`
    - `hooks/`
    - `services/` (only if a thin bridge is needed)
  - Add `index.js` export

- [ ] 2. Define new date/grid utility layer
  - Implement:
    - `toWeekStart`
    - `toMonthStart`
    - `buildWeekDays`
    - `buildMonthGrid`
    - month-boundary label helper
  - Keep all date values as `YYYY-MM-DD`

- [ ] 3. Implement new shell state model
  - Use only:
    - `mode`
    - `visibleWeekStart`
    - `visibleMonthStart`
    - `Selected_Date` from global store
  - Avoid legacy-style target/anchor duplication

- [ ] 4. Implement `DayCell`
  - Preserve:
    - selected state
    - today marker
    - composed selected+today state
    - odd/even month tint
    - category dots
    - month-boundary mini label

- [ ] 5. Implement shared `WeekRow`
  - Render 7 cells
  - Apply `startDayOfWeek`
  - Reuse in both weekly and monthly modes

- [ ] 6. Implement `WeekModeRow`
  - Single bounded week row
  - No large horizontal virtualized list
  - Prev/next navigation moves one week
  - Optional swipe intent uses the same handlers

- [ ] 7. Implement `MonthModeGrid`
  - Render one bounded month grid (5 or 6 rows)
  - No internal infinite scroll list
  - Prev/next navigation moves one month
  - Selected date must remain visible and highlighted

- [ ] 8. Implement `WeekFlowHeader`
  - Render title and navigation controls
  - Weekly mode title: selected/visible month context
  - Monthly mode title: visible month
  - Include today jump button if today is outside the current visible calendar scope
  - Today jump updates both `Selected_Date` and the active visible scope

- [ ] 9. Implement `WeekFlowToggleBar`
  - Preserve swipe-based weekly/monthly toggle
  - Use toggle bar up/down swipe for mode switching
  - In weekly mode, left/right swipe may reuse prev/next week handlers
  - Ensure toggle is selected-date-driven, not stale-scroll-driven

- [ ] 10. Add a new calendar-specific data range hook
  - Create `useWeekFlowDataRange`
  - Reuse the current range-summary adapter/store path
  - Call existing `ensureRangeLoaded/select` semantics internally
  - Keep retention/prune behavior compatible with the shared summary cache
  - Do not fork recurrence/data logic

- [ ] 11. Bound range loading for the new UI
  - Weekly mode: active week + small prefetch
  - Monthly mode: visible month grid range + minimal buffer
  - Remove dependence on giant virtual windows

- [ ] 12. Add dedicated test screen
  - Create a new test route for `Week Flow Calendar`
  - Keep legacy `Strip Calendar` test screen side-by-side during migration

- [ ] 13. Add logging guardrails
  - Default: low-noise logs
  - Debug mode: transition and range-request logs only
  - Remove scroll-spam as default behavior

- [ ] 14. Cross-platform validation
  - Web:
    - selected date propagation
    - month grid correctness
    - toggle behavior
  - iOS:
    - no year jump on mode switch
    - smooth weekly/monthly transition
  - Android:
    - no crash
    - no year jump on mode switch
    - selected date propagation works
    - prev/next navigation works as defined
    - acceptable render performance

- [ ] 15. Migration checkpoint
  - Replace the test tab/screen with the new calendar once validated
  - Keep legacy implementation available only as rollback reference
  - Do not wire into `TodoScreen` production path until the new test screen passes cross-platform checks
