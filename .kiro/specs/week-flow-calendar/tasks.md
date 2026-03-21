# Implementation Plan: Week Flow Calendar

## Overview

현재 플랜은 `Week Flow Calendar`를 `TodoScreen` 상단의 active calendar header로 유지하면서,
기능 안정성과 문서 정합성을 맞추는 데 초점을 둡니다.

## Tasks

- [x] 1. Create the feature path and exports
  - `client/src/features/week-flow-calendar/`
  - shared export surface via `index.js`

- [x] 2. Implement shared date/grid primitives
  - `toWeekStart`, `addDays/addWeeks/addMonths`, weekday helpers, week meta cache

- [x] 3. Implement the weekly surface
  - single visible week row
  - header prev/next
  - legacy horizontal swipe intent

- [x] 4. Implement the monthly surface
  - bounded vertical week-row list
  - snapped top-week tracking
  - prepend/append/trim
  - visible loading for past-direction anchor correction

- [x] 5. Reuse existing summary infrastructure
  - `useWeekFlowDaySummaryRange`
  - shared `calendar-day-summaries` path
  - no direct SQLite reads

- [x] 6. Implement the drag-snap shell
  - `WeekFlowDragSnapCard`
  - monthly open/close drag-snap
  - monthly -> weekly selected-week recenter
  - hidden-layer freeze rules

- [x] 7. Integrate into `TodoScreen`
  - mount `WeekFlowTodoHeader` above `DailyTodoList`
  - remove dedicated `week-flow` evaluation tab from active runtime

- [x] 8. Keep weekly horizontal interaction conservative
  - weekly drag-follow experiment removed
  - legacy prev/next swipe path retained

- [x] 9. Keep default runtime low-noise
  - temporary `[WF]` debug logs removed after iOS validation
  - debug-only verification artifacts kept out of default runtime

- [x] 10. Validate iOS functional behavior
  - multi-step monthly -> weekly transition
  - today return
  - monthly future/past scroll regression
  - simulator + device smoke

- [ ] 11. Finish remaining validation / polish
  - Android parity smoke
  - weekly horizontal swipe final manual confidence pass
  - visual/motion polish after functional freeze
