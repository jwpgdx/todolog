# Decision Note: Todo Calendar Legacy Retirement

Date: 2026-03-17
Status: Completed

## Summary

The old monthly `todo-calendar` runtime has been retired.
`Todo Calendar V2 (TC2)` remains the only active monthly calendar implementation in the app.

## Deleted

- `client/app/(app)/todo-calendar.js`
- `client/src/test/LegacyTodoCalendarFallbackScreen.js`
- `client/src/test/CalendarServiceTestScreen.js`
- `client/src/screens/TodoCalendarScreen.js`
- `client/src/services/query-aggregation/adapters/todoCalendarAdapter.js`
- `client/src/features/todo-calendar/`

## Rehomed

- Shared month-grid helpers were moved to:
  - `client/src/utils/calendarMonthHelpers.js`

## Runtime Changes

- Todo CRUD hooks no longer invalidate the retired monthly calendar store.
- Shared cache invalidation no longer clears the retired monthly calendar store.
- `test` tab now points to the TC2 readiness harness.
- `DebugScreen` no longer imports or validates the retired monthly calendar path.

## Verification

- Active app/source import scan reached zero legacy monthly references outside archive paths.
- `todo-calendar-v2-cutover.spec.js` was updated for the no-fallback state.
- `todo-calendar-v2-readiness.spec.js` and `todo-calendar-v2-cutover.spec.js` are the primary post-retirement web checks.

## Intentional Remnants

- Historical references can remain in `_archive/` and old milestone/spec documents.
- No active runtime route, hook, cache path, or screen intentionally depends on the retired monthly calendar.
