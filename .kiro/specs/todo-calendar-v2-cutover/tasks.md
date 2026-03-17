# Implementation Plan: Todo Calendar V2 Cutover

Last Updated: 2026-03-15
Status: In Progress

## Overview

이 플랜은 `TC2`를 실제 primary monthly calendar path로 승격하고,
old `todo-calendar`를 primary navigation에서 내리는 작업 순서를 정의합니다.

원칙:

1. primary route binding부터 바꾼다
2. duplicate tab은 같은 pass에서 정리한다
3. legacy는 hidden fallback route로만 남긴다
4. 삭제는 이번 범위가 아니다

## Tasks

- [x] 1. Freeze cutover ownership
  - Confirm `TC2` is now promotion target, not just evaluation surface
  - Confirm this pass covers navigation promotion only
  - Confirm legacy deletion is out of scope
  - Notes:
    - cutover spec approved and scoped to route promotion + fallback retention only

- [x] 2. Add a hidden legacy fallback route
  - Create a non-tab route for `Legacy_Todo_Calendar`
  - Keep it reachable for QA/rollback confirmation
  - Ensure it is not exposed in default bottom navigation
  - Notes:
    - existing hidden route `/(app)/todo-calendar` was repurposed as the legacy fallback route
    - fallback wrapper now shows explicit legacy-only banner

- [x] 3. Promote `calendar` tab to TC2
  - Rebind `client/app/(app)/(tabs)/calendar.js` to `TodoCalendarV2Screen`
  - Preserve user-facing tab ownership as the primary monthly calendar entry
  - Notes:
    - `calendar` tab route now exports `TodoCalendarV2Screen`

- [x] 4. Remove duplicate TC2 tab from active navigation
  - Update `client/app/(app)/(tabs)/_layout.js`
  - Remove or hide `todo-calendar-v2` from the default tab bar
  - Ensure only one primary monthly calendar tab remains
  - Notes:
    - `todo-calendar-v2` remains route-addressable but is hidden from the bottom tab bar via `href: null`

- [x] 5. Preserve test/readiness routes
  - Keep:
    - readiness harness route
    - fixture matrix route
  - Ensure these remain test-only, not primary navigation
  - Notes:
    - readiness and fixture routes remain under `/(app)/test/*`

- [ ] 6. Re-verify promoted primary path
  - Web:
    - open `calendar` tab
    - confirm TC2 renders
    - confirm live mutation/coarse invalidate flow still works
  - Native:
    - confirm promoted `calendar` tab opens on at least one platform
  - Notes:
    - web cutover Playwright verification passed
    - native promoted-tab smoke was attempted, but a clean post-cutover proof was not captured yet due dev-client routing instability

- [x] 7. Verify legacy fallback route
  - Open the hidden fallback route
  - Confirm `Legacy_Todo_Calendar` still renders
  - Confirm fallback route is not exposed in active bottom navigation
  - Notes:
    - web cutover Playwright verification confirmed `/todo-calendar` fallback route opens
    - fallback route is not exposed in active bottom navigation

- [ ] 8. Write cutover decision note
  - Summarize:
    - whether `calendar` now points to `TC2`
    - whether duplicate monthly tab exposure was removed
    - whether fallback route exists
    - what residual risks remain
  - Explicitly state whether a later legacy-retirement spec is now the next step
