# Implementation Plan: Todo Calendar V2 Line Monthly

## Overview

This plan builds a new monthly line-calendar beside the existing
`todo-calendar`.

Execution order:

1. new isolated module
2. baseline renderer without completion glyph
3. bottom-tab validation path
4. deterministic fixture validation
5. performance validation

## Tasks

- [x] 1. Create isolated `todo-calendar-v2` module
  - Create folder:
    - `client/src/features/todo-calendar-v2/`
  - Add initial subfolders:
    - `adapters/`
    - `hooks/`
    - `services/`
    - `store/`
    - `ui/`
    - `utils/`
  - Ensure old `todo-calendar` files are not modified for v2 behavior

- [x] 2. Add a dedicated bottom-tab route for v2
  - Add a temporary bottom-tab entry for direct access
  - Route should open the new v2 screen
  - Do not use DebugScreen as the primary launch path
  - Freeze baseline behavior as a vertically scrollable month list
  - Notes:
    - temporary `TC2` tab was used for validation during development
    - current app state promotes the primary `calendar` tab to TC2 and keeps `todo-calendar-v2` hidden but route-addressable

- [x] 3. Build the monthly data adapter for v2
  - Reuse shared query/range-cache backbone
  - Create a v2 adapter that converts common-layer output into:
    - fixed 6-week month model
    - day-cell display payload
    - span segment payload
    - per-day overflow count
  - Treat shared-query canonical `YYYY-MM-DD` strings as authoritative
  - Do not re-interpret renderer day boundaries with local `Date` math

- [x] 4. Implement fixed 6-week month grid UI
  - Render:
    - month header
    - 6 week rows
    - 7 day cells per row
  - Enforce:
    - day cell height `88px`
    - date label at top-left
    - event lane height `14px`
  - Keep leading/trailing adjacent-month cells as structural slots inside the visible 42-day grid
  - Hide adjacent-month date labels, line content, and overflow indicators in the baseline UI

- [x] 5. Implement line rendering without completion glyphs
  - Render category-colored title bars
  - Render title only (no time text)
  - Clamp to 1 line / truncate
  - Keep date/line/overflow taps as no-op
  - Exclude completion glyphs from the frozen baseline path

- [x] 6. Implement span segmentation for non-recurring multi-day events
  - Split visible event ranges by week row
  - Use `user.settings.startDayOfWeek` as the week boundary
  - Preserve continuation flags across row boundaries
  - Ensure recurring events remain single-day lines
  - Ensure timed multi-day events also span
  - Clip only by the visible 42-day grid, not by calendar month boundaries

- [x] 7. Implement ordering and lane placement
  - Use this exact sort key:
    - `classRank(allDaySpan, timedSpan, allDaySingle, timedSingle)`
    - `startDate`
    - `startTime`
    - `category.order_index`
    - `title`
    - `_id`
  - Compute placement independently per week row
  - Define conflict as overlapping visible dates within the same week row
  - Keep one lane value across all covered days within a placed row segment
  - Allocate at most 3 visible lanes

- [x] 8. Implement overflow handling
  - Show `...` when hidden items exist for a day
  - Keep overflow non-interactive
  - Do not change cell or month height
  - Ensure overflow still appears when 3 visible span lanes are already occupied
  - Increment `hiddenCount` for every covered day of a hidden row segment

- [x] 9. Add a deterministic pre-acceptance fixture matrix
  - Lock cases for:
    - cross-week spans
    - cross-month spans
    - Sunday/Monday week starts
    - timed multi-day spans
    - all-day/timed ordering collisions
    - overflow when all 3 lanes are already occupied by spans

- [x] 10. Validate baseline performance and loading bounds
  - Web validation:
    - open v2 tab
    - scroll month list
    - confirm fixed-height behavior
    - confirm span layout and overflow behavior
  - Native validation:
    - verify scroll stability on iOS/Android
  - Confirm visible load window is only current visible month + `±1 month`
  - Confirm retention pruning at anchor `±6 months`
  - Confirm there are no per-frame store writes during active scroll
  - Confirm UI subscriptions are not bound to the entire layout store
  - Validation notes:
    - Web:
      - evaluation route and promoted `calendar` tab both opened TC2 successfully during the validation/cutover passes
      - month list scroll, fixed-height month rendering, span layout, and overflow rendering verified
      - deterministic fixture matrix Playwright check passed
    - Native:
      - Android:
        - `com.anonymous.client://todo-calendar-v2` route opened successfully
        - native month scroll changed the visible month as expected
      - iOS:
        - app install/launch verified on simulator
        - `com.anonymous.client://todo-calendar-v2` route opened successfully on simulator
        - route/render verified; automated native swipe was not available through `simctl`
    - Code-path validation:
      - visible request window is bounded to visible months + `±1 month`
      - retention pruning keeps layouts only within anchor `±6 months`
      - layout writes happen on initial load / visible-month changes, not per-frame scroll callbacks
      - month UI subscribes by month id instead of binding the full UI tree to the entire layout store

- [x] 11. Final acceptance checkpoint
  - Confirm:
    - old `todo-calendar` unchanged
    - v2 reachable from bottom tab
    - baseline is a vertically scrollable month list
    - no-op interactions preserved
    - title-only lines render correctly
    - span behavior matches spec
    - overflow behavior matches spec
    - completion glyphs are absent from the frozen baseline
  - Acceptance notes:
    - existing `todo-calendar` path was not modified as part of the v2 renderer work
    - TC2 remains route-addressable and now backs the primary `calendar` tab in the app
    - baseline remains a vertically scrollable month list
    - taps remain no-op in the frozen baseline
    - renderer remains title-only and does not include completion glyphs
    - fixture validation and native/web route checks completed without blocker regressions
