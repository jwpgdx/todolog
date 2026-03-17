# Todo Calendar V2 Line Monthly Requirements

Last Updated: 2026-03-15
Status: Draft

## 1. Purpose

This spec defines `todo-calendar-v2`, a separate monthly calendar surface that
renders inline event lines instead of dots.

This is a new implementation path.
The existing `todo-calendar` remains untouched during this work.

## 2. Scope

In scope:

- a new feature module for `todo-calendar-v2`
- a route-addressable validation entry during development and a primary monthly calendar binding after cutover
- a fixed 6-week monthly grid
- event line rendering inside day cells
- week-row span rendering for non-recurring multi-day events
- overflow display

Out of scope:

- modifying the current `todo-calendar` UI/store path
- using DebugScreen as the primary entry point
- weekly mode
- event detail, edit, or tap behavior in the first release
- completion glyph rendering in the frozen baseline

## 3. Canonical Decisions

1. The implementation SHALL live in a new module, separate from the current `todo-calendar`.
2. The current `todo-calendar` SHALL remain available and unchanged during v2 development.
3. `todo-calendar-v2` SHALL remain route-addressable for validation and MAY back the primary `calendar` tab after cutover.
4. The initial interaction model SHALL be display-only; day/date/event/overflow taps SHALL be no-op.

## 4. Navigation / Isolation Requirements

1. The implementation SHALL remain route-addressable outside DebugScreen for direct validation and QA.
2. During the pre-cutover phase, the app MAY expose `todo-calendar-v2` through a dedicated bottom-tab route for side-by-side comparison.
3. After cutover, the primary `calendar` tab MAY render `todo-calendar-v2` while the temporary `todo-calendar-v2` route remains hidden but addressable.
4. The implementation SHALL NOT depend on a debug-only route or screen.
5. The baseline navigation model SHALL be a vertically scrollable month list.

## 5. Monthly Grid Requirements

1. The calendar SHALL render monthly view only in this scope.
2. Each month SHALL render as a fixed 6-week grid.
3. Fixed 6-week rendering is required to avoid scroll/layout instability from variable month height.
4. Each day cell SHALL have a height of `88px`.
5. The date label SHALL appear at the top-left of the day cell.
6. The fixed 6-week month grid SHALL include leading and trailing adjacent-month days as structural cells inside the visible 42-day grid.
7. Adjacent-month cells SHALL remain in the 42-day layout to preserve fixed-height scrolling stability.
8. The frozen baseline SHALL hide adjacent-month date labels, event lines, and overflow indicators from the visible UI.

## 6. Event Line Requirements

1. Each day cell SHALL reserve up to 3 visible event lanes.
2. Each event lane SHALL have a height of `14px`.
3. Each visible event line SHALL render category color + title only.
4. Event lines SHALL NOT render time text in the initial release.
5. Event titles SHALL be single-line and truncated if needed.
6. If a day has hidden events beyond the visible 3-lane capacity, the cell SHALL render a non-interactive overflow indicator using `...`.
7. Overflow indication SHALL NOT increase the month height.
8. The renderer boundary SHALL consume canonical `YYYY-MM-DD` date strings from the shared query layer and SHALL NOT reinterpret day boundaries with local `Date` math.

## 7. Ordering Requirements

1. All-day events SHALL be placed before timed events.
2. Candidate sorting SHALL use this exact key:
   `classRank(allDaySpan, timedSpan, allDaySingle, timedSingle) ASC`
   -> `startDate ASC`
   -> `startTime ASC` (`null` before non-null inside all-day classes)
   -> `category.order_index ASC` (`null` or missing values sort after numeric values)
   -> `title ASC`
   -> `_id ASC`.

## 8. Span Requirements

1. Non-recurring events with `startDate < endDate` SHALL render as spanning events, including events that also have time fields.
2. Recurring events SHALL NOT render as spanning bars in v2.
3. Recurring events SHALL render as single-day occurrences only.
4. Week-row segmentation SHALL use `user.settings.startDayOfWeek` as the week boundary.
5. Cross-month events SHALL be clipped only by the visible 42-day grid, not by calendar month boundaries.
6. Lane allocation SHALL be computed independently for each week row.
7. A lane conflict exists when two visible candidates occupy at least one common date within the same week row.
8. A placed span segment SHALL keep one lane value across every covered day in that week-row segment.
9. If a candidate cannot be placed in lanes `0..2`, `hiddenCount` SHALL increment by `1` for every covered day in that candidate's visible segment.
10. Spanning visuals SHALL continue across adjacent days within the same week row.
11. Multi-week spanning events SHALL be segmented by week row and use deterministic continuation cues at row boundaries.

## 9. Completion Requirements

1. Completion glyphs are OUT OF SCOPE for the frozen baseline implementation.
2. The baseline v2 implementation SHALL ship without completion glyph rendering or completion-aware lane/layout changes.
3. Any completion glyph experiment SHALL be handled by a follow-up spec after baseline performance validation.

## 10. Performance Requirements

1. The new module SHALL reuse the shared query/aggregation and cache backbone instead of introducing a separate recurrence/query engine.
2. The UI SHALL avoid per-frame JS settle loops or forced scroll correction logic.
3. The month list SHALL load only the visible month plus a bounded prefetch window of `±1 month`.
4. Projected month layouts SHALL be retained only inside an anchor-based retention window of `±6 months`.
5. The anchor month for loading and retention telemetry SHALL be the top-most visible month in the scroll list.
6. Projection-store updates SHALL occur only on initial load and visible-month changes, not on per-frame scroll callbacks.
7. UI subscriptions SHALL be scoped to visible month layouts or day cells; subscribing the entire UI to `monthLayoutsById` is forbidden.
8. The frozen baseline SHALL ship with the lightest viable rendering path and SHALL NOT include completion glyphs.
9. The new module SHALL be designed so hidden/overflow items do not require rendering all day-detail content eagerly.

## 11. Acceptance Criteria

1. The TC2 renderer is route-addressable for validation and, in the current app state, backs the primary `calendar` tab.
2. The old `todo-calendar` remains intact and functional.
3. The baseline surface behaves as a vertically scrollable month list.
4. Each day cell shows:
   - top-left date label
   - up to 3 visible event lines
   - `...` when overflow exists
5. Leading and trailing adjacent-month cells remain in the fixed 42-day grid, but their date labels, lines, and overflow indicators are hidden.
6. Non-recurring multi-day events span across days; recurring events do not.
7. Timed multi-day events also span.
8. The initial release is fully no-op on tap interactions.
9. The frozen baseline ships without completion glyphs.
