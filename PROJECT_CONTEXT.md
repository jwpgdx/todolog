# Todolog Project Context

Last Updated: 2026-02-13
Status: Phase 2.5 complete, Phase 3 not started

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
- Phase 3 recurrence engine: planned, not implemented

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

Category -> Todo -> Completion

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

## 5. Storage Layer Status

### 5.1 Client SQLite

File: `client/src/services/db/database.js`

- `MIGRATION_VERSION = 4`
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

1. Calendar visible month range changes.
2. `useTodoCalendarData` requests month batches.
3. `calendarTodoService` performs batch SQL reads.
4. `todoCalendarStore` caches by month.
5. UI components subscribe by month/date selectors.

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
- `client/src/services/sync/todoSync.js`
- `client/src/services/sync/categorySync.js`
- `client/src/services/sync/completionSync.js`

Calendar module:

- `client/src/features/todo-calendar/hooks/useTodoCalendarData.js`
- `client/src/features/todo-calendar/services/calendarTodoService.js`
- `client/src/features/todo-calendar/store/todoCalendarStore.js`
- `client/src/features/todo-calendar/ui/*`

Todo form:

- `client/src/features/todo/form/useTodoFormLogic.js`

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

Completed tasks:

- Task 17-29 complete
- Optional property tests `19.1`, `27.1` not executed

Migration validation snapshot (from log):

- Dry-run processed/updated/failed: `41 / 41 / 0`
- Live migration matched/modified: `41 / 41`
- Legacy schedule fields remaining: `0`
- Date-typed schedule fields remaining: `0`

## 9. Phase 3 Readiness Checklist

Primary spec:

- `.kiro/specs/calendar-data-integration/phase3_recurrence_technical_spec_v3.md`

Before implementation:

1. Verify terms and contracts against:
   - `.kiro/specs/calendar-data-integration/requirements.md`
   - `.kiro/specs/calendar-data-integration/design.md`
   - `.kiro/specs/calendar-data-integration/tasks.md`
2. Confirm no references to removed legacy fields.
3. Define regression checklist for:
   - todo CRUD
   - sync pipeline
   - Google adapter behavior

## 10. Runbook

### 10.1 Start services

```bash
# server
cd server
npm run dev

# client
cd client
npm start
```

### 10.2 Environment variables (minimum)

Client:

- `EXPO_PUBLIC_API_URL`

Server:

- `PORT`
- `MONGODB_URI`
- `JWT_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### 10.3 Known local mismatch

- Server default port: `5000` (`server/src/index.js`)
- Axios fallback URL: `http://localhost:5001/api` (`client/src/api/axios.js`)

If requests fail locally, check `EXPO_PUBLIC_API_URL` first.

## 11. Frequent Pitfalls

1. Re-introducing legacy schedule fields.
2. Violating the string date/time contract.
3. Breaking sync order (Category -> Todo -> Completion).
4. Missing calendar month-cache invalidation on todo/completion updates.
5. Leaving verbose debug logs in production flows.

## 12. Document Source of Truth

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
