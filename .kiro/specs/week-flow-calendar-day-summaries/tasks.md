# Implementation Plan: Week Flow Calendar — Day Summaries (Schedule Markers)

## Overview

이 플랜은 `.kiro/specs/week-flow-calendar-day-summaries/requirements.md`와
`design.md`를 구현 단계로 옮기는 작업 목록입니다.

목표는 `strip-calendar`의 dot 표시 기능(요약)을 재사용/승계하되,
`week-flow-calendar`의 “성능 우선” 상호작용 모델(스크롤 중 업데이트 금지)에 맞춰
요약 레이어를 **독립 모듈**로 정리하는 것입니다.

## Tasks

- [ ] 1. Create new module: `calendar-day-summaries`
  - Create folder: `client/src/features/calendar-day-summaries/`
  - Add subfolders:
    - `store/`
    - `services/`
    - `adapters/`
    - `hooks/`
    - `utils/`
  - Add `index.js` exports
  - Requirements: R1, R3

- [ ] 2. Implement adapter: range handoff → day summaries
  - Implement `adaptDaySummariesFromRangeHandoff(handoff, { maxDots })`
  - Keep algorithm minimal (unique category colors set)
  - Requirements: R2, R3

- [ ] 3. Implement summary store (Zustand)
  - Store:
    - `summariesByDate`, `loadedRanges`, `dirtyRanges`, `dirtySeq`
  - Helpers:
    - `mergeRanges`, `splitRangeByInvalidation`
  - Provide ops:
    - `upsertSummaries`, `addLoadedRange`, `hasRangeCoverage`
    - `invalidateRanges`, `consumeDirtyRanges`, `pruneToDateRange`, `clear`
  - Requirements: R5, R7

- [ ] 4. Implement ensure/select service API
  - `ensureDaySummariesLoaded({ startDate, endDate, reason, traceId })`
    - coverage check fast-path
    - `getOrLoadRange` + adapter + store upsert
  - `selectDaySummary(date)`
    - return a stable empty summary for missing days
  - `selectDaySummariesForDiagnostics({ startDate, endDate })` (diagnostics only)
  - Requirements: R3, R4

- [ ] 5. Implement invalidation API (Todo)
  - `invalidateDateSummary(date)`
  - `invalidateTodoSummary(todo)`
    - include unbounded recurrence guard: derive invalidation from `loadedRanges` intersections inside the current retention window (never `minLoadedStart~maxLoadedEnd`)
  - Ensure invalidation also calls `invalidateRangeCacheByDateRange`
  - Requirements: R5

- [ ] 6. Implement retention policy + prune gating
  - Compute retention window (anchor month ±N months)
  - Gate prune by settled `anchorMonthId` change, then execute prune only while idle
  - Apply pruning to:
    - summary store
    - range cache (`pruneOutsideDateRange`)
  - Requirements: R7

- [ ] 7. Integrate category changes (coarse invalidation)
  - Ensure category update/delete clears summary caches or invalidates retention window
  - Update `invalidateAllScreenCaches` to also clear the new summary store
  - If week-flow calendar is mounted, queue one idle re-ensure for the current `Active_Range` after the coarse invalidation
  - Requirements: R6, R7

- [ ] 8. Wire mutation hooks to the new invalidation API
  - Update:
    - `useCreateTodo`, `useUpdateTodo`, `useDeleteTodo`
  - Replace legacy imports (strip-calendar adapter) with the new module exports
  - Ensure behavior remains offline-first and does not block UI
  - Requirements: R5, R8

- [ ] 9. Week-flow UI: render dots in day cells
  - Update `client/src/features/week-flow-calendar/ui/DayCell.js` to render:
    - up to `maxDots` dot views
    - overflow `+` when needed
  - Subscribe to summary store per-date to avoid whole-calendar rerender
  - Requirements: R1, R2, R8

- [ ] 10. Week-flow UI: ensure range only on idle/settled
  - Add `useWeekFlowDaySummaryRange` hook usage:
    - Weekly: ensure on `visibleWeekStart` changes
    - Monthly: ensure only after actual settle
      - native: `onMomentumScrollEnd`
      - web / no-momentum fallback: debounced idle settle after scroll inactivity
      - `onScrollEndDrag` may arm the fallback, but MUST NOT call ensure directly
  - Add minimal prefetch ranges (lightweight first)
  - Requirements: R4, R8

- [ ] 11. Dirty refresh loop for active viewport range
  - When `dirtySeq` changes, queue dirty work; execute it only when `isViewportSettled === true` (or `viewportSettledToken` changes) and there is overlap with current `Active_Range`:
    - refresh overlap (merge ranges) via `ensureDaySummariesLoaded`
    - overwrite the refreshed dates with empty defaults before upsert so removed items clear old markers
    - consume dirty overlap
  - Ensure this runs only on idle/settled points
  - Requirements: R5, R8

- [ ] 12. Debug flags + logging guardrails
  - Add `DEBUG_CALENDAR_DAY_SUMMARIES` flag
  - Keep logs OFF by default
  - Requirements: R8

- [ ] 13. Manual verification checklist (iOS/Android/Web)
  - Weekly:
    - create/update/delete todo → dots update
    - completion toggle does NOT affect dots (by design)
  - Monthly:
    - fast scroll far future/past → no per-frame ensure, dots appear after settle
  - Category:
    - update color → dots reflect new color after refresh
    - delete category → dots removed after refresh
  - Memory:
    - scroll across years → cache does not grow unbounded (retention prune observed)
  - Requirements: R9

## External Spec Review (Opus/Gemini)

- [ ] Run external review using the prompt in `review-prompt.md`
- [ ] Triage findings into `must-fix / optional / reject`
- [ ] Apply `must-fix` changes to spec docs before implementation starts
