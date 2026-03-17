# Todolog Roadmap

Last Updated: 2026-03-17
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
- Phase 3 recurrence engine core (Step 1) is complete/validated
- Phase 3 common query/aggregation layer (Step 2) is complete/validated
- Phase 3 screen-adapter layer (Step 3) is complete/validated
- Category write unification is complete/validated
- Completion write unification is implemented; primary recovery/rerun-latch validation is complete
- Completion coalescing is implemented and validated
- Completion local tombstone is implemented and validated
- Cache-policy unification (Option A -> Option B) is complete/validated
- Todo Calendar V2 readiness is complete/validated on web and native baseline checks
- Todo Calendar V2 cutover + legacy retirement landed: `calendar` tab now points to TC2, duplicate `TC2` tab is hidden, and the old monthly calendar runtime has been removed from active app code
- Post-cutover promoted native smoke is still pending before any legacy-retirement decision
- Strip-calendar legacy module remains in stabilization/debugging phase
- Week Flow Calendar rewrite prototype is active (bounded weekly/monthly shell); spec remains SOT for the full replacement plan
- Expo Router migration is complete/validated (file-based routing under `client/app/`)
- Expo SDK 55 upgrade is complete/validated; Android emulator + iOS simulator smoke both passed
- `react-native-wheel-pick` remains as the only non-blocking Expo doctor warning and is slated for later native replacement

Immediate objective:

- maintain sync operational stability (retry/dead-letter/throughput monitoring)
- reduce runtime debug log noise after Phase 3 integration
- finish post-cutover promoted native smoke for Todo Calendar V2 and decide legacy monthly-calendar retirement timing
- stabilize strip-calendar weekly/monthly settle behavior and mode-anchor consistency
- finalize Week Flow Calendar rewrite spec and use it as the new source of truth for calendar UI replacement
- prepare next feature track on top of common layer + screen-adapter contracts
- post Expo Router migration: ensure deep-link/push route parity and keep legacy navigation deps at 0
- replace `react-native-wheel-pick` with native UI after the SDK 55 stabilization window

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

### 2026-02-21 to 2026-02-22

- Phase 3 common query/aggregation layer completed and integrated
  - SQLite-only candidate/decision/aggregation path unified
  - stale-state metadata contract wired (`isStale`, `staleReason`, `lastSyncTime`)
  - DebugScreen PASS suite validated (`common-date`, `common-range`, `sync-smoke`)
- Phase 3 screen-adapter layer completed and integrated
  - TodoScreen/TodoCalendar/StripCalendar adapter paths switched
  - Strip summary path enabled (`ENABLE_STRIP_CALENDAR_SUMMARY = true`)
  - DebugScreen screen comparison PASS (`screen-compare`, ID diff 0)

Evidence:

- `.kiro/specs/common-query-aggregation-layer/requirements.md`
- `.kiro/specs/common-query-aggregation-layer/design.md`
- `.kiro/specs/common-query-aggregation-layer/tasks.md`
- `.kiro/specs/common-query-aggregation-layer/log.md`
- `.kiro/specs/screen-adapter-layer/requirements.md`
- `.kiro/specs/screen-adapter-layer/design.md`
- `.kiro/specs/screen-adapter-layer/tasks.md`
- `.kiro/specs/screen-adapter-layer/adapter_spec_review.md`

### 2026-02-23

- Cache-policy unification completed (`Option A -> Option B`)
  - Option A: strip monthly 3-month policy + prefetch + benchmark PASS (elapsed 62.3% improvement)
  - Option B: shared range cache adoption in TodoCalendar/StripCalendar + sync invalidation unification
  - Regression: general/recurrence/time-based sets PASS (`screen-compare` diff 0, `sync-smoke` stale=false)
  - Debug controls added for cache-policy validation (`shared clear`, `strip L1 clear`, `range-hit-smoke`, policy toggle, benchmark)

Evidence:

- `.kiro/specs/cache-policy-unification/requirements.md`
- `.kiro/specs/cache-policy-unification/design.md`
- `.kiro/specs/cache-policy-unification/tasks.md`
- `.kiro/specs/cache-policy-unification/log.md`

### 2026-03-06

- Page-sheet reusable overlay baseline implemented
  - Added shared cross-platform overlay components under `client/src/components/ui/page-sheet/`
  - Platform mapping fixed as:
    - iOS: RN `Modal` page sheet
    - Android: `BottomSheetModal`
    - Web mobile: `vaul`
    - Web desktop: RN centered `Modal`
  - Added shared `PageSheetInput` entrypoints
  - Added debug/sample route `PageSheetTest` for long form + in-sheet stack validation
  - Existing Todo form migration remains deferred; current delivery is infrastructure + sample only

Evidence:

- `.kiro/specs/page-sheet/requirements.md`
- `.kiro/specs/page-sheet/design.md`
- `.kiro/specs/page-sheet/tasks.md`
- `client/src/components/ui/page-sheet/index.js`
- `client/src/test/PageSheetTestScreen.js`

### 2026-03-05

- Inbox system category 도입 (`systemKey='inbox'`)
  - 서버: `Category.systemKey` 추가 + partial unique(활성 + userId+systemKey) + auth flow에서 멱등 ensureInbox
  - 서버: Inbox CRUD 잠금 + `systemKey` 주입/변경 차단
  - 클라: SQLite `categories.system_key` 마이그레이션(v7) + Inbox-first 정렬 + 카테고리 관리 화면에서 잠금/상단 고정
  - 레거시 `isDefault` 삭제 완료 (서버/클라)
- UI 네이밍 정리: `My` 탭을 `My Page`로 변경
  - 탭 라우트명: `Profile` -> `MyPage`
  - 스크린 파일/컴포넌트명: `ProfileScreen` -> `MyPageScreen`
- 카테고리 UI 임시 재배치: `CategoryManagement` 화면 제거 → `My Page`에 iOS 그룹 리스트로 내장
  - 새 컴포넌트: `CategoryGroupList`
  - 이동: 카테고리 관리 진입을 별도 라우트가 아닌 `My Page` 내 섹션으로 제공

Evidence:

- `.kiro/specs/inbox-system-category/requirements.md`
- `.kiro/specs/inbox-system-category/design.md`
- `.kiro/specs/inbox-system-category/tasks.md`
- `client/src/navigation/MainTabs.js`
- `client/src/navigation/MainStack.js`
- `client/src/screens/MyPageScreen.js`
- `client/src/components/domain/category/CategoryGroupList.js`

### 2026-02-25

- Strip-calendar monthly 1-row-only visible issue mitigated
  - FlashList initial estimated-layout artifacts could leave y-coordinate discontinuities (only 1 week visible until scroll/layout)
  - Added layout normalize nudge (1px width/padding bump) on monthly enter when discontinuity is detected
- Long-scroll memory growth bounded with retention window (anchor ±6 months)
  - Shared range cache: date-window prune (`pruneOutsideDateRange`)
  - TodoCalendar L1: month-window prune (`pruneToMonthWindow`)
  - StripCalendar L1: date-window prune (`pruneToDateRange`)

Evidence:

- `client/src/features/strip-calendar/ui/MonthlyStripList.js`
- `client/src/services/query-aggregation/cache/rangeCacheService.js`
- `client/src/features/strip-calendar/hooks/useStripCalendarDataRange.js`
- `client/src/features/strip-calendar/store/stripCalendarStore.js`
- `client/src/features/todo-calendar/hooks/useTodoCalendarData.js`
- `client/src/features/todo-calendar/store/todoCalendarStore.js`
- `.kiro/specs/common-query-aggregation-layer/todo-calendar-first-entry-lag-postmortem-2026-02-24.md`

### 2026-03-07

- Expo Router migration implemented and validated (Web/iOS/Android)
  - Single routing entry: `expo-router/entry`
  - File-based routes under `client/app/` with `/(auth)` + `/(app)` groups and tabs
  - Root providers/side effects migrated to `client/app/_layout.js`
  - Removed non-serializable route params (CategoryColor callback) and object route params
  - Removed legacy React Navigation stack code (`client/src/navigation/*`)
- Removed unused page-sheet experiment artifacts (`client/src/components/ui/page-sheet/`)
- Added iOS form sheet evaluation route (`/test/form-sheet`) to compare against bottom-sheet UX

Evidence:

- `.kiro/specs/expo-router-migration/tasks.md`
- `client/app/_layout.js`
- `client/app/(app)/(tabs)/_layout.js`
- `client/e2e/smoke.spec.js`
- `client/app/(app)/test/form-sheet.js`
- `client/src/test/FormSheetTestScreen.js`

### 2026-03-10

- My Page subtree routing 도입 (native-stack Large Title/back label UX parity 강화)
  - My Page에서 여는 Settings/Profile/Category 화면을 `/(app)/(tabs)/my-page/*` stack 하위로 이동
  - shared screen에서 상대 라우팅(`./...`)을 사용해 root stack / My Page stack 양쪽에서 동작하도록 정리
- Modal/page-sheet/form-sheet presentation 옵션 비교용 test routes 확장 (`/(app)/test/modals`)
- Week Flow Calendar rewrite prototype test screen 추가 (`/(app)/(tabs)/week-flow`)

### 2026-03-13

- Category write unification completed
  - `create/update/delete/reorder`를 local-first + pending + background sync 경로로 통일
  - category delete의 local cascade와 `createCategory 409` success-equivalent replay 처리 반영
- Completion write unification implemented
  - completion toggle을 always-pending으로 전환
  - sync in-flight rerun latch와 completion-aware invalidation 분기 추가
- Recovery validation and testing workflow expanded
  - Web real-server recovery specs 추가 (`category`, `todo`, `completion`)
  - Codex web/Playwright wrapper scripts + runbook 정리

Evidence:

- `.kiro/specs/category-write-unification/tasks.md`
- `.kiro/specs/completion-write-unification/tasks.md`
- `client/e2e/category-recovery.real.spec.js`
- `client/e2e/todo-recovery.real.spec.js`
- `client/e2e/completion-recovery.real.spec.js`
- `client/src/services/sync/index.js`
- `client/src/services/query-aggregation/cache/cacheInvalidationService.js`
- `CODEX_TESTING.md`

### 2026-03-14

- Completion coalescing implemented
  - Pending Push now compacts completion rows by sync-start full non-dead_letter snapshot
  - last-intent wins for the same `completionKey`
  - superseded older completion rows, including future-retry failed rows, are retired before replay
- Targeted recovery validation added
  - future-retry failed completion create is superseded by newer intent and does not replay later
  - recurring different dates remain isolated by key and both replay
  - dead_letter completion rows stay excluded while newer ready rows still replay
  - mixed queue / raw-200 / restart-after-cleanup scenarios pass in the real-server matrix

Evidence:

- `.kiro/specs/completion-coalescing/tasks.md`
- `client/src/services/sync/pendingPush.js`
- `client/e2e/completion-recovery.real.spec.js`

### 2026-03-15

- Todo Calendar V2 line-monthly baseline, cutover, and legacy retirement advanced
  - `calendar` tab now renders TC2 as the primary monthly calendar path
  - duplicate `TC2` tab was hidden from active bottom navigation
  - old legacy monthly calendar route/runtime was retired from active app code
  - TC2 readiness harness verified mounted create/update/delete refresh and coarse invalidate recovery on web
  - adjacent-month cells remain in the fixed 42-day grid, but their labels/lines/overflow are hidden in the baseline UI

Evidence:

- `.kiro/specs/todo-calendar-v2-line-monthly/tasks.md`
- `.kiro/specs/todo-calendar-v2-cutover-readiness/tasks.md`
- `.kiro/specs/todo-calendar-v2-cutover/tasks.md`
- `.kiro/specs/todo-calendar-legacy-retirement/tasks.md`
- `client/e2e/todo-calendar-v2-readiness.spec.js`
- `client/e2e/todo-calendar-v2-cutover.spec.js`

### 2026-03-16

- Completion local tombstone implemented
  - SQLite `completions` now uses `deleted_at` for normal delete flow
  - local completion restore reuses existing `_id`
  - todo/category local delete cascades now tombstone completions instead of hard delete
- Validation expanded
  - full web + real-server E2E suite passed under Codex localhost wrapper
  - guest migration completion import preserves exported `_id`

Evidence:

- `.kiro/specs/completion-local-tombstone/tasks.md`
- `client/src/services/db/database.js`
- `client/src/services/db/completionService.js`
- `client/src/services/db/todoService.js`
- `client/src/services/db/categoryService.js`
- `client/src/hooks/queries/useToggleCompletion.js`
- `server/src/controllers/authController.js`

### 2026-03-17

- Expo SDK 55 upgrade completed and validated
  - tracked app config now targets Expo `55.0.6`, React Native `0.83.2`, React `19.2.0`
  - `client/app.json` enables React Compiler and configures `expo-build-properties` `ios.buildReactNativeFromSource: true`
  - unused `zeego` / native-menu dependency path was removed
  - Android `assembleDebug` + emulator smoke and iOS simulator build/launch smoke both passed
- Codex Expo upgrade workflow documented
  - local Codex skill `upgrading-expo` is available through `AGENTS.md`
  - project docs were refreshed to reflect SDK 55 and the remaining `react-native-wheel-pick` warning

Evidence:

- `client/package.json`
- `client/package-lock.json`
- `client/app.json`
- `PROJECT_CONTEXT.md`
- `README.md`
- `AGENTS.md`

## 4. Next Milestones (Planned)

## P0: Phase 3 Integration Hardening

Target:

- stabilize post-integration runtime on top of common query/aggregation + screen-adapter contracts

Priority checks:

1. remove or gate verbose debug logs in runtime-critical paths
2. keep 3-screen consistency checks (`TodoScreen`, `TodoCalendar`, `StripCalendar`) regression-safe
3. ensure stale/fresh transition behavior remains deterministic after sync

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
