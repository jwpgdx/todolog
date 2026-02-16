# Implementation Plan: Strip Calendar (Main Screen)

## Overview

This plan implements Strip Calendar using the approved requirements (R1-R25) and design decisions:

- Separate weekly/monthly FlashList components
- Shared range-based data adapter path
- Anchor-preserving mode transitions
- Lightweight main-screen behavior with no per-frame fetch

## Tasks

- [x] 1. Bootstrap feature structure
  - Create `client/src/features/strip-calendar/` with folders:
    - `hooks/`
    - `services/`
    - `store/`
    - `ui/`
    - `utils/`
  - Create `index.js` export entry
  - _Requirements: R1, R12, R19_

- [x] 2. Implement date utility layer for week/month strip math
  - Create `client/src/features/strip-calendar/utils/stripCalendarDateUtils.js`
  - Implement:
    - week-start normalization (`sunday`/`monday`)
    - week generation (7 cells)
    - month-boundary label helper
    - `Anchor_Week_Start` conversion helpers
  - Keep all date I/O as `YYYY-MM-DD` strings
  - _Requirements: R2, R5, R9, R22_

- [x] 3. Implement display localization helpers
  - Create `client/src/features/strip-calendar/utils/stripCalendarLocaleUtils.js`
  - Map settings language to header month/weekday labels
  - Integrate system-language fallback path
  - _Requirements: R8, R16_

- [x] 4. Define data adapter contract and feature service boundary
  - Create `client/src/features/strip-calendar/services/stripCalendarDataAdapter.js`
  - Define contract:
    - `ensureRangeLoaded({ startDate, endDate, reason })`
    - `selectDaySummaries({ startDate, endDate })`
    - optional invalidation API
  - Ensure UI has no direct SQLite access
  - _Requirements: R14, R15, R20_

- [x] 5. Implement day-summary range service (SQLite-backed)
  - Create `client/src/features/strip-calendar/services/stripCalendarSummaryService.js`
  - Implement summary generation payload:
    - `date`
    - `hasTodo`
    - `uniqueCategoryColors`
    - `dotCount`
  - Enforce category-unique dot semantics in service layer
  - Keep recurrence evaluation delegated to adapter boundary (Phase 3 compatible)
  - _Requirements: R10, R14, R15, R20_

- [x] 6. Implement strip-calendar feature store
  - Create `client/src/features/strip-calendar/store/stripCalendarStore.js`
  - Store fields:
    - `mode`
    - `anchorWeekStart`
    - `weeklyVisibleWeekStart`
    - `monthlyTopWeekStart`
    - summary cache map and loaded ranges
  - Add range merge/dedupe bookkeeping
  - _Requirements: R11, R12, R20, R21, R22_

- [x] 7. Implement transition/controller hook
  - Create `client/src/features/strip-calendar/hooks/useStripCalendarController.js`
  - Handle:
    - mode toggle (header + bar)
    - arrow prev/next
    - weekly/monthly anchor synchronization
    - settled-callback based today visibility evaluation
    - header today-jump action (`currentDate=todayDate` + mode-specific navigation)
  - _Requirements: R3, R7, R8, R22, R24_

- [x] 8. Implement range-loading hook with trigger guardrails
  - Create `client/src/features/strip-calendar/hooks/useStripCalendarDataRange.js`
  - Trigger fetch only on:
    - weekly settle
    - monthly momentum settle
    - mode switch target range ensure
  - Explicitly prevent per-frame fetch on `onScroll`
  - _Requirements: R20, R21, R24_

- [x] 9. Implement `DayCell` component
  - Create `client/src/features/strip-calendar/ui/DayCell.js`
  - Render states:
    - selected
    - today marker
    - normal
  - Visual semantics:
    - today marker = bold text only
    - selected (`currentDate`) = circular indicator
    - composed state = selected circle + bold text
  - Dot behavior:
    - max 3 unique category dots
    - show `+` overflow when unique categories >= 4
  - _Requirements: R10, R11, R18, R23_

- [x] 10. Implement `WeekRow` component
  - Create `client/src/features/strip-calendar/ui/WeekRow.js`
  - Render 7 day cells
  - Apply month-boundary label logic
  - _Requirements: R2, R5, R9_

- [x] 11. Implement `WeeklyStripList` (FlashList horizontal)
  - Create `client/src/features/strip-calendar/ui/WeeklyStripList.js`
  - Requirements:
    - one-week viewport semantics
    - horizontal week navigation
    - `pagingEnabled={false}` + `snapToInterval={viewportWidth}` + `snapToAlignment="start"`
    - `onLayout` width 기반 `scrollToOffset` 초기 정렬
    - settled week callback for anchor/data updates via quantized settle (`onMomentumScrollEnd` + web programmatic fallback)
  - _Requirements: R2, R3, R19, R22_

- [x] 12. Implement `MonthlyStripList` (FlashList vertical + snap)
  - Create `client/src/features/strip-calendar/ui/MonthlyStripList.js`
  - Enforce:
    - `pagingEnabled={false}`
    - `snapToInterval={WEEK_ROW_HEIGHT}`
    - `decelerationRate="fast"`
    - five-row visible max height
    - `initialScrollIndex` + top-anchor target sync for initial mode mount
  - Include settled callback for anchor/data updates
    - primary: `onMomentumScrollEnd`
    - web fallback: idle settle from `onScroll` timer (guard/cooldown/re-arm)
  - _Requirements: R5, R6, R13, R17, R19, R22_

- [x] 13. Implement header and toggle-bar UI
  - Create:
    - `client/src/features/strip-calendar/ui/StripCalendarHeader.js`
    - `client/src/features/strip-calendar/ui/ModeToggleBar.js`
  - Hook left/right arrows and mode toggle handlers
  - Add conditional `Today_Jump_Button` rendering
  - Wire today-jump click behavior through controller
  - _Requirements: R7, R8, R24_

- [x] 14. Implement shell composition and mode-based rendering
  - Create `client/src/features/strip-calendar/ui/StripCalendarShell.js`
  - Compose header + active list + toggle bar
  - Use mode-based conditional rendering between weekly/monthly lists
  - Keep transition animation optional and lightweight
  - Avoid per-frame height interpolation during transition
  - Use transform/opacity-oriented visual transition and commit final layout height once at end
  - Bootstrap first render to `todayWeekStart`
  - Use non-animated mode-switch positioning, and animated `<`/`>` navigation only
  - _Requirements: R4, R6, R12, R19, R22_

- [x] 15. Integrate settings and today-date dependencies
  - Connect `useSettings` (`language`, `startDayOfWeek`, `timeZone`)
  - Connect `useTodayDate` for timezone-aware `Today_Marker`
  - Ensure runtime settings changes update UI without restart
  - _Requirements: R16, R18_

- [x] 16. Wire date selection to global date source of truth
  - On day tap, update `useDateStore().setCurrentDate`
  - Ensure selected date contract remains `YYYY-MM-DD`
  - _Requirements: R1, R11_

- [ ] 17. Integrate Strip Calendar into `TodoScreen`
  - 현재 상태: `StripCalendarTestScreen` + `MainTabs`의 `Strip` 탭으로 검증 중
  - TODO: `client/src/screens/TodoScreen.js` 레이아웃에 strip-calendar 실제 임베드
  - TODO: 메인 화면 todo list 필터링이 `currentDate` 기반으로 그대로 동작하는지 최종 검증
  - _Requirements: R1, R11_

- [x] 18. Implement cache invalidation hooks for data freshness
  - Connect to existing todo/completion mutation points
  - Invalidate only affected date ranges/month windows
  - Avoid full-cache invalidation on every mutation
  - _Requirements: R20, R21_

- [x] 19. Implement resilience and fallback handling
  - Adapter failure fallback to empty summaries
  - Invalid anchor fallback to current week from selected date
  - `scrollToIndex` fail fallback to offset
  - _Requirements: R12, R21, R22_

- [x] 27. Fix Monthly->Weekly target resolution policy and stale-target override
  - Add monthly viewport date-visibility utility (`isDateVisibleInMonthlyViewport`)
  - Clear stale `weeklyTargetWeekStart` on `Monthly_Mode -> Weekly_Mode` toggle path
  - Clear stale `weeklyTargetWeekStart` when monthly settle is committed
  - Resolve `nextWeek` once at mode-switch:
    - use `currentWeekStart` if `currentDate` is visible in monthly 5-row viewport
    - otherwise use `monthlyTopWeekStart` fallback
  - Extend transition debug payload for weekly target decision (`baseTopWeekStart`, `isCurrentDateVisibleFromTop`)
  - _Requirements: R22, R25_

- [x] 28. Stabilize monthly settle re-entry and redundant correction behavior
  - Add phase-aware guard so web idle settle does not execute during active scroll phases (`dragging`, `momentum`, `programmatic`)
  - Arm/reuse programmatic guard around correction scroll and target sync to avoid correction -> onScroll -> settle loops
  - Skip idle settle scheduling when offset is already near snapped position and settled week is unchanged
  - Tune monthly drift correction threshold for reduced micro-correction churn in web scrolling
  - _Requirements: R17, R21_

- [x] 29. Convert weekly navigation to swipe-intent-only interaction
  - Disable direct free horizontal list scrolling in weekly mode
  - Add horizontal swipe-intent threshold detection and route to existing prev/next week actions
  - Remove web horizontal wheel/trackpad intent mapping from weekly navigation path (PanResponder-only)
  - Keep weekly positioning/sync path index-based through existing programmatic `scrollToOffset`
  - _Requirements: R3, R12_

- [x] 30. Normalize bottom mode-toggle interaction to swipe-only policy
  - Remove bottom bar click/tap mode toggle action
  - Apply mode-specific swipe direction rule:
    - `Weekly_Mode` + swipe-down => `Monthly_Mode`
    - `Monthly_Mode` + swipe-up => `Weekly_Mode`
  - Keep header toggle button as explicit click-based mode switch path
  - _Requirements: R7, R8_

- [x] 31. Fix month-label omission when day `1` is rendered at week-first cell
  - Update week date labeling logic so day-number `1` always emits month label
  - Keep existing month-boundary transition labeling behavior for non-first-day boundaries
  - Verify weekly/monthly views both show month label for `... 1 ...` cases
  - _Requirements: R9_

- [x] 32. Apply odd/even month tint for calendar readability
  - Add subtle month-parity background tint in `DayCell`:
    - odd month: neutral background
    - even month: light tinted background
  - Ensure tint does not reduce readability of selected-circle, today-text, and dot indicators
  - Verify both weekly/monthly rendering paths apply identical tint rule
  - _Requirements: R9, R23_

- [ ] 20. Checkpoint: Interaction and contract validation
  - Verify weekly horizontal navigation
  - Verify weekly free horizontal drag scrolling is blocked
  - Verify weekly swipe-intent detection triggers one week move per gesture
  - Verify weekly web trackpad/wheel horizontal movement does not trigger week navigation
  - Verify monthly free scroll + week snap settle
  - Verify weekly <-> monthly anchor preservation
  - Verify bottom toggle bar is swipe-only (click/tap does not toggle)
  - Verify bottom swipe direction policy:
    - `Weekly_Mode` + swipe-down => `Monthly_Mode`
    - `Monthly_Mode` + swipe-up => `Weekly_Mode`
  - Verify month label appears when day-number is `1` even when rendered at week-first cell
  - Verify odd/even month tint is visible and subtle without reducing selected/today/dot readability
  - Verify first render starts at week containing `todayDate`
  - Verify mode switch does not show index-0 flash or glide from wrong week
  - Verify `<`/`>` week navigation remains animated
  - Verify selected-date propagation to todo list
  - Verify weekly: today button appears only when today week is off-screen and click returns to today week + selects today
  - Verify monthly: today button appears only when today is outside visible 5-row window and click aligns today week to top + selects today
  - If drift/glide issue appears, enable `DEBUG_STRIP_CALENDAR` and capture logs for:
    - shell state snapshot (`mode`, `anchorWeekStart`, `weeklyVisibleWeekStart`, `monthlyTopWeekStart`)
    - list sync target/index (`sync:scrollToIndex`, `sync:skipAlreadySynced`)
    - settled anchor (`momentum:settleByOffset`, `settled:*`)
  - _Requirements: R1, R3, R5, R11, R17, R22, R24_

- [ ] 21. Checkpoint: Dot and today marker validation
  - Verify unique-category dot dedupe and overflow
  - Verify today-only cell uses bold text only
  - Verify selected-only cell uses circular indicator
  - Verify selected + today composed state rendering (circle + bold text)
  - Verify timezone change updates today marker
  - _Requirements: R10, R18, R23_

- [ ] 22. Checkpoint: Localization and week-start validation
  - Change language setting and verify month/weekday labels
  - Change `startDayOfWeek` and verify weekly/monthly row generation
  - _Requirements: R2, R5, R16_

- [ ] 23. Checkpoint: Performance validation on main screen
  - Confirm no adapter fetch on every `onScroll` frame
  - Confirm anchor/data updates are triggered only from `onMomentumScrollEnd`
  - Confirm batch range loading and cache dedupe behavior
  - Confirm monthly fast scroll has no blank-area regression
  - Confirm monthly settle does not fire during active drag/momentum/programmatic phases
  - Confirm near-snapped + same-week state does not repeatedly schedule idle settle
  - Confirm via React Native Perf Monitor that mode transition does not cause unnecessary lower-list reflow/layout thrash
  - Confirm debug logs show no unintended extra `scrollToIndex` on mode switch
  - _Requirements: R12, R13, R20, R21_

- [ ]* 24. Optional automated unit tests for utilities and controller
  - Test week generation and boundary label helpers
  - Test anchor conversion and transition mapping
  - _Requirements: R2, R9, R22_

- [ ]* 25. Optional property-based tests (P1-P24)
  - Use `fast-check` when test runner is enabled
  - Validate design properties:
    - P1..P24 from `design.md`
  - _Requirements: R2, R5, R10, R16, R18, R20, R21, R22, R23, R24_

- [ ] 26. Final checkpoint and rollout readiness
  - Verify requirements coverage and no unresolved blockers
  - Update docs if implementation decisions changed
  - Prepare merge with summary of risks and follow-ups
  - _Requirements: R1-R25_

## Requirements Traceability Matrix

- R1: Tasks 1, 16, 17, 20
- R2: Tasks 2, 10, 11, 22, 24
- R3: Tasks 7, 11, 20, 29
- R4: Tasks 14
- R5: Tasks 2, 10, 12, 20, 22
- R6: Tasks 12, 14
- R7: Tasks 7, 13
- R8: Tasks 7, 13
- R9: Tasks 2, 10, 24
- R10: Tasks 5, 9, 21, 25
- R11: Tasks 6, 16, 17, 20
- R12: Tasks 1, 6, 14, 19, 23, 29
- R13: Tasks 12, 23
- R14: Tasks 4, 5
- R15: Tasks 4, 5
- R16: Tasks 3, 15, 22
- R17: Tasks 12, 20, 28
- R18: Tasks 9, 15, 21
- R19: Tasks 1, 11, 12, 14
- R20: Tasks 4, 5, 6, 8, 18, 23
- R21: Tasks 6, 8, 11, 12, 19, 23, 28
- R22: Tasks 2, 6, 7, 11, 12, 14, 19, 20, 24, 25, 27
- R23: Tasks 9, 21
- R24: Tasks 7, 8, 13, 20
- R25: Tasks 20, 27

## Notes

- Tasks marked with `*` are optional until an automated runner is added.
- Keep recurrence logic out of strip-calendar UI and consume recurrence-aware summaries through the adapter boundary.
- Today visibility and today-jump behavior must be evaluated on settled callbacks (`onMomentumScrollEnd`) only, not per-frame scroll.
- If a decision changes during implementation, update all three spec docs (`requirements.md`, `design.md`, `tasks.md`) in the same commit.
