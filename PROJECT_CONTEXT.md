# Todolog Project Context

Last Updated: 2026-02-25
Status: Sync hardening complete (Pending Push -> Delta Pull), Phase 3 Step 1 recurrence engine complete/validated, Phase 3 Step 2 common query/aggregation complete/validated, Phase 3 Step 3 screen-adapter layer complete/validated, cache-policy unification complete/validated

## 1. Purpose

This is the implementation source-of-truth document for contributors and AI agents.
Use it to understand current architecture, data contracts, runtime flow, and where to make changes safely.

If this document conflicts with a feature spec, the feature spec under `.kiro/specs/<feature>/` wins for that feature.

## 2. Current Snapshot

### 2.1 Stack (actual packages)

Client:

- React Native `0.81.5`
- Expo `54.0.33`
- React `19.1.0`
- Zustand `5.x`
- React Query `5.x`
- SQLite via `expo-sqlite`

Server:

- Express `5.1.0`
- Mongoose `9.x`
- JWT auth
- Google OAuth / Calendar integration (`google-auth-library`, `googleapis`)

### 2.2 Delivery status

- Phase 1-2 calendar integration: complete
- Phase 2.5 data normalization: complete
- Sync hardening (`Pending Push -> Delta Pull`): complete
- Phase 3 recurrence engine core (Step 1): complete and validated
- Phase 3 common query/aggregation layer (Step 2): complete and validated
- Phase 3 screen-adapter layer (Step 3): complete and validated
- Cache-policy unification (Option A -> Option B): complete and validated (shared range cache + sync invalidation unification)
- Cache retention (memory control): enabled (shared range cache + calendar L1 caches pruned to anchor ±6 months)
- Strip-calendar foundation (weekly/monthly shell + anchor sync + debug instrumentation): active and integrated via adapter path

## 3. Non-Negotiable Architecture Commitments

### 3.1 Offline-first behavior

- User actions persist locally first.
- Network sync is background work.
- UI flow must not depend on server availability.

### 3.2 Local source of truth

- SQLite is authoritative for todos, completions, categories, pending changes.
- Settings are persisted via `authStore` + AsyncStorage.

### 3.3 ID strategy

- Client generates UUID v4 IDs.
- Server stores String `_id` for domain models.

### 3.4 Sync ordering

Dependency order must stay:

1. `ensureDatabase`
2. `Pending Push`
3. `Delta Pull` (category full + todo/completion delta)
4. `Cursor Commit`
5. `Cache Refresh`

Main sync entry point:

`client/src/services/sync/index.js`

## 4. Phase 2.5 Date/Time Contract (Canonical)

### 4.1 Allowed formats

- Date fields: `YYYY-MM-DD` or `null`
- Time fields: `HH:mm` or `null`

### 4.2 Disallowed legacy payload fields

These are rejected at API level:

- `date`
- `startDateTime`
- `endDateTime`
- `timeZone`

Validation and rejection logic:

`server/src/controllers/todoController.js`

### 4.3 Timezone source of truth

- Use `user.settings.timeZone`.
- Do not store todo-level timezone metadata.
- Google adapter must use user settings timezone only.

### 4.4 Selected date state rule

- `currentDate` is a UI state string (`YYYY-MM-DD`) in `dateStore`.
- App bootstrap computes `currentDate` using `user.settings.timeZone`.
- When timezone changes during runtime:
  - auto realign only if user is currently on "today" of previous timezone
  - do not auto jump while todo form is open (`mode !== 'CLOSED'`)

### 4.5 Today marker rule (derived state)

- `todayDate` is a derived value, not persisted store state.
- `todayDate` is computed from `user.settings.timeZone` via shared hook `useTodayDate`.
- `currentDate` (selected) and `todayDate` (actual today) are independent:
  - user can select any date while today marker stays on real "today"
  - if selected date equals `todayDate`, both states point to the same cell

## 5. Storage Layer Status

### 5.1 Client SQLite

File: `client/src/services/db/database.js`

- `MIGRATION_VERSION = 5`
- `todos` key columns:
  - `_id TEXT PRIMARY KEY`
  - `date TEXT` (legacy compatibility column; runtime contract uses start/end date)
  - `start_date TEXT`
  - `end_date TEXT`
  - `start_time TEXT`
  - `end_time TEXT`
  - `recurrence TEXT`
  - `recurrence_end_date TEXT`
- Key index:
  - `idx_todos_recurrence_window(start_date, recurrence_end_date)`
- Pending queue v5 additions:
  - `retry_count INTEGER NOT NULL DEFAULT 0`
  - `last_error TEXT NULL`
  - `next_retry_at TEXT NULL`
  - `status TEXT NOT NULL DEFAULT 'pending'`

### 5.2 Server MongoDB Todo model

File: `server/src/models/Todo.js`

Schedule fields:

- `startDate: String`
- `endDate: String`
- `startTime: String | null`
- `endTime: String | null`
- `recurrenceEndDate: String | null`

Removed legacy fields:

- `startDateTime`
- `endDateTime`
- `timeZone`

Note:

- `exdates` is currently `Date[]` and was not converted in Phase 2.5.

### 5.3 Google adapter

File: `server/src/services/googleCalendar.js`

Input contract:

- DB string fields (`startDate`, `endDate`, `startTime`, `endTime`)
- `user.settings.timeZone`

Behavior:

- strict `recurrenceEndDate` string handling for RRULE `UNTIL`
- guardrails to avoid Date/String mixed-type runtime errors

## 6. Runtime Data Flow

### 6.1 Todo create/update flow

1. UI form creates normalized payload.
2. Data persists to SQLite.
3. Pending change queued if needed.
4. Sync service sends normalized payload to server.
5. Server validates string contract and saves to Mongo.
6. Optional Google sync runs using user timezone.

### 6.2 Calendar read flow

1. Screen/hook requests date or range data (`TodoScreen`, `TodoCalendar`, `StripCalendar`).
2. For range reads (`TodoCalendar`, `StripCalendar`), the shared range cache is the first hop:
   - cache hit: return cached handoff payload (`itemsByDate`)
   - cache miss: load uncovered sub-ranges via common query/aggregation and merge into cache
3. Common query/aggregation layer runs on SQLite-only path (direct for date reads, miss-only for range reads):
   - candidate query (`Todo/Completion/Category`)
   - occurrence decision (non-recurring + recurring via `recurrenceEngine`)
   - aggregation (`todo + completion + category`)
4. Screen adapters transform handoff DTO into screen-specific shapes.
5. Screen stores cache adapter outputs when needed:
   - `todoCalendarStore` (`todosByMonth`/`completionsByMonth`)
   - `stripCalendarStore` (`summariesByDate`)
6. UI components render from adapted shape and cache selectors.

Shared range cache implementation:

- `client/src/services/query-aggregation/cache/rangeCacheService.js`
  - cache: `itemsByDate` (pre-adapter raw handoff payload)
  - supports overlap/adjacent merge, in-flight dedupe, invalidate, and retention prune
- `client/src/services/query-aggregation/cache/cacheInvalidationService.js`
  - unified invalidate entrypoint (called by sync) + TodoScreen React Query co-fire

### 6.3 Selected date flow

1. `App` loads auth/settings and resolves user timezone.
2. `App` sets `dateStore.currentDate` from timezone-aware "today" string.
3. `TodoScreen` and todo form use this shared `currentDate`.
4. On timezone update, app compares old/new timezone "today" and conditionally realigns `currentDate`.

### 6.4 Today marker flow

1. `useTodayDate` reads `user.settings.timeZone`.
2. `todayDate` is computed using `getCurrentDateInTimeZone`.
3. Screens/components compare `currentDate` vs `todayDate` for UI state.
4. On AppState `active`, `todayDate` is re-evaluated (midnight rollover safety).

### 6.5 Strip-calendar flow (current implementation)

1. `StripCalendarShell` bootstraps weekly mode using `todayWeekStart` as initial anchor.
2. Weekly and monthly lists are separated components (`WeeklyStripList`, `MonthlyStripList`) and only one is mounted by mode.
3. Weekly list:
   - horizontal FlashList (layout only), with direct user free horizontal scroll disabled
   - weekly movement is driven by one-shot intent detection:
     - touch/mouse drag swipe threshold (`dx`) -> prev/next week action
     - web wheel/trackpad horizontal movement is not mapped to weekly navigation
   - viewport width from `onLayout`
   - explicit `scrollToOffset(index * viewportWidth)` sync for deterministic positioning
   - week settle quantization via `onMomentumScrollEnd` and web fallback settle after programmatic scroll
4. Monthly list:
   - vertical FlashList
   - `snapToInterval={WEEK_ROW_HEIGHT}` + `disableIntervalMomentum` + `decelerationRate="fast"`
   - settle path uses `onMomentumScrollEnd`, plus web idle settle fallback (`onScroll` timer) with guards/cooldowns/re-arm thresholds
   - layout normalize nudge: on monthly enter, if FlashList layout looks discontinuous (estimated-height artifacts), nudge width by 1px to force relayout and prevent "1 week only visible" viewport
5. Data summary path is enabled at runtime:
   - `ENABLE_STRIP_CALENDAR_SUMMARY = true`
   - summary source is shared range cache miss -> `runCommonQueryForRange` -> shared range cache upsert -> `adaptStripCalendarFromRangeHandoff`
   - dot rendering uses category-color dedupe + overflow metadata
6. Monthly -> Weekly target resolution policy:
   - stale weekly transition target is cleared in shell on monthly settle and before monthly->weekly toggle
   - transition target is resolved once at mode-switch time (no per-frame `onScroll` evaluation)
   - base target is `monthlyTopWeekStart` (fallback: `currentWeekStart`)
   - if `currentDate` week is inside current monthly 5-row viewport, weekly target prefers `currentWeekStart`
   - if outside viewport, weekly target uses `monthlyTopWeekStart`
7. Current integration surface:
   - active in `StripCalendarTestScreen`
   - main `TodoScreen` still uses the existing todo list path without strip-calendar mount
8. Bottom mode-toggle interaction policy:
   - bottom bar is swipe-only (click/tap toggle removed)
   - `Weekly_Mode` + swipe-down => `Monthly_Mode`
   - `Monthly_Mode` + swipe-up => `Weekly_Mode`
9. Month-boundary label rendering policy:
   - month label is shown on month-change boundary inside a week row
   - month label is also shown when day-number is `1`, including week-first cell
10. Day-cell month readability tint policy:
   - odd/even month uses subtle background tint difference at day-cell level
   - tint is subordinate to selected-circle, today-text, and dot indicators

### 6.6 Recurrence engine flow (Phase 3 Step 1)

1. Engine core is implemented in `client/src/utils/recurrenceEngine.js`.
2. Core API:
   - `normalizeRecurrence(rawRecurrence, recurrenceEndDate?, options?)`
   - `occursOnDateNormalized(normalizedRule, targetDate)`
   - `expandOccurrencesInRange(normalizedRule, rangeStart, rangeEnd)`
3. Engine guardrails:
   - date-only normalization (`YYYY-MM-DD`) for recurrence-critical paths
   - fail-soft behavior for invalid recurrence inputs
   - bounded expansion guard (`MAX_EXPANSION_DAYS = 366`)
4. DB contract alignment for recurrence:
   - `todos.recurrence_end_date` column
   - `idx_todos_recurrence_window(start_date, recurrence_end_date)` index
5. Runtime integration status:
   - `recurrenceUtils` delegates recurrence predicate to engine core
   - common query/aggregation path-level unification (TodoScreen/TodoCalendar/StripCalendar) is complete
   - screen adapters (TodoScreen/TodoCalendar/StripCalendar) are complete and wired to runtime read paths

## 7. Key Files by Responsibility

### 7.1 Client

API:

- `client/src/api/axios.js`
- `client/src/api/todos.js`

SQLite:

- `client/src/services/db/database.js`
- `client/src/services/db/todoService.js`
- `client/src/services/db/completionService.js`
- `client/src/services/db/categoryService.js`
- `client/src/services/db/pendingService.js`

Sync:

- `client/src/services/sync/index.js`
- `client/src/services/sync/pendingPush.js`
- `client/src/services/sync/deltaPull.js`
- `client/src/services/sync/syncErrorPolicy.js`
- `client/src/services/sync/todoSync.js` (legacy full-pull module)
- `client/src/services/sync/categorySync.js` (legacy full-pull module)
- `client/src/services/sync/completionSync.js` (legacy full-pull module)

Common query/aggregation layer:

- `client/src/services/query-aggregation/index.js`
- `client/src/services/query-aggregation/candidateQueryService.js`
- `client/src/services/query-aggregation/occurrenceDecisionService.js`
- `client/src/services/query-aggregation/aggregationService.js`
- `client/src/services/query-aggregation/types.js`
- `client/src/services/query-aggregation/cache/rangeCacheService.js`
- `client/src/services/query-aggregation/cache/cacheInvalidationService.js`
- `client/src/services/query-aggregation/cache/index.js`

Screen adapters:

- `client/src/services/query-aggregation/adapters/todoScreenAdapter.js`
- `client/src/services/query-aggregation/adapters/todoCalendarAdapter.js`
- `client/src/services/query-aggregation/adapters/stripCalendarAdapter.js`
- `client/src/services/query-aggregation/adapters/types.js`

Calendar module:

- `client/src/features/todo-calendar/hooks/useTodoCalendarData.js`
- `client/src/features/todo-calendar/services/calendarTodoService.js`
- `client/src/features/todo-calendar/store/todoCalendarStore.js`
- `client/src/features/todo-calendar/ui/*`

Strip calendar module:

- `client/src/features/strip-calendar/ui/StripCalendarShell.js`
- `client/src/features/strip-calendar/ui/WeeklyStripList.js`
- `client/src/features/strip-calendar/ui/MonthlyStripList.js`
- `client/src/features/strip-calendar/hooks/useStripCalendarController.js`
- `client/src/features/strip-calendar/hooks/useStripCalendarDataRange.js`
- `client/src/features/strip-calendar/services/stripCalendarDataAdapter.js`
- `client/src/features/strip-calendar/services/stripCalendarSummaryService.js`
- `client/src/features/strip-calendar/store/stripCalendarStore.js`
- `client/src/features/strip-calendar/utils/stripCalendarConstants.js`
- `client/src/features/strip-calendar/utils/stripCalendarDebug.js`
- `client/src/screens/StripCalendarTestScreen.js`

Todo form:

- `client/src/features/todo/form/useTodoFormLogic.js`

Date state and timezone helpers:

- `client/src/store/dateStore.js`
- `client/src/utils/timeZoneDate.js`
- `client/src/hooks/useTodayDate.js`
- `client/App.js`
- `client/src/screens/TodoScreen.js`

Recurrence engine:

- `client/src/utils/recurrenceEngine.js`
- `client/src/utils/recurrenceUtils.js` (compatibility wrapper + legacy helper area)
- `client/src/test/RecurrenceEngineTestScreen.js`

Calendar today-marker path:

- `client/src/features/todo-calendar/ui/CalendarList.js`
- `client/src/features/todo-calendar/ui/MonthSection.js`
- `client/src/features/todo-calendar/ui/DayCell.js`
- `client/src/features/todo-calendar/utils/calendarHelpers.js`

### 7.2 Server

Models:

- `server/src/models/Todo.js`
- `server/src/models/Completion.js`
- `server/src/models/Category.js`
- `server/src/models/User.js`

Controllers:

- `server/src/controllers/todoController.js`
- `server/src/controllers/completionController.js`
- `server/src/controllers/categoryController.js`
- `server/src/controllers/authController.js`

Services and scripts:

- `server/src/services/googleCalendar.js`
- `server/src/scripts/migrateTodoDateFieldsToString.js`

## 8. Phase 2.5 Completion Evidence

Reference documents:

- `.kiro/specs/calendar-data-integration/tasks.md`
- `.kiro/specs/calendar-data-integration/log.md`

## 9. Phase 3 Step 1 Completion Evidence

Reference documents:

- `.kiro/specs/phase3-recurrence-engine-core/ONE_PAGER.md`
- `.kiro/specs/phase3-recurrence-engine-core/requirements.md`
- `.kiro/specs/phase3-recurrence-engine-core/design.md`
- `.kiro/specs/phase3-recurrence-engine-core/tasks.md`
- `.kiro/specs/phase3-recurrence-engine-core/phase3_engine_review.md`

Completed tasks:

- Task 17-29 complete
- Optional property tests `19.1`, `27.1` not executed

Migration validation snapshot (from log):

- Dry-run processed/updated/failed: `41 / 41 / 0`
- Live migration matched/modified: `41 / 41`
- Legacy schedule fields remaining: `0`
- Date-typed schedule fields remaining: `0`

## 10. Phase 3 Step 2-3 Completion Evidence

Reference documents:

- `.kiro/specs/common-query-aggregation-layer/requirements.md`
- `.kiro/specs/common-query-aggregation-layer/design.md`
- `.kiro/specs/common-query-aggregation-layer/tasks.md`
- `.kiro/specs/common-query-aggregation-layer/log.md`
- `.kiro/specs/screen-adapter-layer/requirements.md`
- `.kiro/specs/screen-adapter-layer/design.md`
- `.kiro/specs/screen-adapter-layer/tasks.md`

Validation snapshot:

- Common layer DebugScreen suite: PASS (`common-date`, `common-range`, `sync-smoke`)
- Screen adapter comparison suite: PASS (`screen-compare`, ID diff 0)
- Stage counters and stale-state metadata output contract verified in runtime logs

## 11. Runbook

### 11.1 Start services

```bash
# server
cd server
npm run dev

# client
cd client
npm start
```

### 11.2 Environment variables (minimum)

Client:

- `EXPO_PUBLIC_API_URL`

Server:

- `PORT`
- `MONGODB_URI`
- `JWT_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### 11.3 Known local mismatch

- Server default port: `5000` (`server/src/index.js`)
- Axios fallback URL: `http://localhost:5001/api` (`client/src/api/axios.js`)

If requests fail locally, check `EXPO_PUBLIC_API_URL` first.

## 12. Frequent Pitfalls

1. Re-introducing legacy schedule fields.
2. Violating the string date/time contract.
3. Breaking sync order (`Pending Push -> Delta Pull -> Cursor Commit -> Cache Refresh`).
4. Missing calendar month-cache invalidation on todo/completion updates.
5. Leaving verbose debug logs in production flows.
6. Monthly strip web settle path currently mixes list snap physics and JS idle-settle correction logic; this area is still under tuning.

## 13. Document Source of Truth

Method and behavior rules:

- `AGENTS.md`
- `.kiro/steering/requirements.md`

Feature source-of-truth:

- `.kiro/specs/<feature>/requirements.md`
- `.kiro/specs/<feature>/design.md`
- `.kiro/specs/<feature>/tasks.md`

Calendar integration focus docs:

- `.kiro/specs/calendar-data-integration/requirements.md`
- `.kiro/specs/calendar-data-integration/design.md`
- `.kiro/specs/calendar-data-integration/tasks.md`
- `.kiro/specs/calendar-data-integration/log.md`
- `.kiro/specs/strip-calendar/requirements.md`
- `.kiro/specs/strip-calendar/design.md`
- `.kiro/specs/strip-calendar/tasks.md`
- `.kiro/specs/common-query-aggregation-layer/requirements.md`
- `.kiro/specs/common-query-aggregation-layer/design.md`
- `.kiro/specs/common-query-aggregation-layer/tasks.md`
- `.kiro/specs/screen-adapter-layer/requirements.md`
- `.kiro/specs/screen-adapter-layer/design.md`
- `.kiro/specs/screen-adapter-layer/tasks.md`
