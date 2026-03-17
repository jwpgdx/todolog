# Implementation Plan: Week Flow Calendar Cutover

## Overview

이 플랜은 `week-flow-calendar`를 canonical replacement path로 확정하고
`strip-calendar`의 런타임 의존성을 제거하기 위한 작업 순서를 정의합니다.

원칙:

- 먼저 runtime-critical reference를 끊는다.
- 그다음 navigation/debug/legacy cleanup을 한다.
- 마지막에 strip 폴더 삭제 가능 여부를 판단한다.

## Tasks

- [x] 1. Audit strip references and classify by risk
  - Run reference audit for:
    - `strip-calendar`
    - `StripCalendar`
    - `useStripCalendarStore`
  - Classify each hit into:
    - runtime-critical
    - debug/test-only
    - archive/docs-only
  - Save or summarize the audit result before deletion work begins

- [x] 2. Remove runtime strip invalidation from Todo mutation hooks
  - Update:
    - `client/src/hooks/queries/useCreateTodo.js`
    - `client/src/hooks/queries/useUpdateTodo.js`
    - `client/src/hooks/queries/useDeleteTodo.js`
  - Remove imports/calls to strip invalidation
  - Keep `calendar-day-summaries` invalidation path intact

- [x] 3. Remove strip store dependency from global cache invalidation
  - Update:
    - `client/src/services/query-aggregation/cache/cacheInvalidationService.js`
  - Remove `useStripCalendarStore` import and clear call
  - Preserve:
    - `todo-calendar` cache invalidation
    - `calendar-day-summaries.clear()`
    - `calendar-day-summaries.requestIdleReensure()`
    - range cache invalidation

- [x] 4. Remove strip from active tab navigation
  - Update:
    - `client/app/(app)/(tabs)/_layout.js`
    - `client/app/(app)/(tabs)/strip.js`
  - Remove the active `strip` tab route
  - Keep `week-flow` tab route as the active replacement surface

- [x] 5. Decide and apply debug/test cleanup strategy
  - Review:
    - `client/src/screens/StripCalendarTestScreen.js`
    - `client/src/screens/DebugScreen.js`
    - strip-specific adapter/debug helpers
  - Choose one:
    - remove strip diagnostics entirely
    - move them to archive-only code
  - Ensure no runtime screen imports depend on strip

- [x] 6. Re-run reference audit after runtime cleanup
  - Confirm no runtime-critical file imports strip modules
  - Confirm remaining hits are only debug/archive/docs paths

- [x] 7. Verify week-flow behavior after cutover
  - Web:
    - login
    - week-flow route open
    - weekly/monthly toggle
  - Mutation path:
    - create/update/delete todo
    - visible markers still refresh
  - Sync path:
    - login-triggered sync
    - cache invalidation does not break week-flow rendering

- [x] 8. Decide strip folder retirement
  - If no runtime/debug dependency remains:
    - delete `client/src/features/strip-calendar/`
    - delete strip-specific adapters/exports
  - Otherwise:
    - move remaining strip code under explicit archive/legacy location
    - document why full deletion is deferred

- [ ] 9. Update project docs after cutover
  - Update:
    - `PROJECT_CONTEXT.md`
    - `README.md` if navigation/testing instructions changed
    - `ROADMAP.md` if milestone state changed
  - Reflect that week-flow is the canonical replacement path and strip is retired/legacy

- [x] 10. Final verification report
  - Summarize:
    - which strip runtime references were removed
    - whether strip tab was removed
    - whether strip folder was deleted or archived
    - what verification was run
    - what residual risk remains, if any
