# Todolog

Offline-first Todo and Calendar app built with React Native (Expo) and Node.js.

Todolog is designed to work fully offline, then sync safely to server and Google Calendar when online.

## Highlights

- Offline-first by default (local writes first)
- SQLite as local source of truth for core entities
- UUID v4 IDs generated client-side
- Calendar module with month-batch fetch and cache
- Todo Calendar V2 line-monthly renderer now backing the primary `calendar` tab
- Common query/aggregation layer (SQLite-only candidate -> decision -> aggregation)
- Screen adapter layer for TodoScreen/TodoCalendar/StripCalendar handoff conversion
- Strip-calendar module with separate weekly/monthly list architecture + summary adapter integration
- Google Calendar integration with strict schedule type handling
- Timezone-aware selected-date state (`currentDate`) based on `user.settings.timeZone`

## Current Status

As of 2026-03-21:

- Phase 1-2 calendar integration: complete
- Phase 2.5 data normalization (floating date/time string contract): complete
- Sync hardening (`Pending Push -> Delta Pull`): complete
- Phase 3 recurrence engine core (Step 1): complete and validated
- Phase 3 common query/aggregation layer (Step 2): complete and validated
- Phase 3 screen-adapter layer (Step 3): complete and validated
- Category write unification: complete and validated (local-first + pending + background sync)
- Completion write unification: implemented and primary recovery validated (always-pending toggle + rerun latch + completion-aware invalidation)
- Completion coalescing: implemented and validated (sync-start full-snapshot compaction + last-intent replay)
- Guest local-only bootstrap + migration rework: implemented and validated
  - app default entry now goes straight to Todo tabs
  - guest start is local-only (`guest_local`) and no longer depends on `/auth/guest`
  - login/signup begin from My Page and import all guest todos into account Inbox
  - migration now uses canonical todo/completion DTOs instead of raw local guest objects
  - iOS simulator + Maestro validated `login/signup -> 취소 / 버리기 / 가져오기` branches
  - forced signup partial-failure validation confirmed guest session/local data retention and Inbox-only server rollback
- Web real-server recovery specs: added for `category`, `todo`, `completion`
  - completion matrix validated for `rapid toggle`, `recurring`, `mixed queue`, `dead_letter`, `restart`
- Todo Calendar V2 line-monthly baseline: implemented
- Todo Calendar V2 cutover: `calendar` tab now renders TC2 as the primary monthly calendar path, and the legacy monthly calendar runtime has been retired
- Strip-calendar stabilization/debugging: ongoing hardening (adapter path already active)
- Expo Router migration: implemented (file-based routing under `client/app/`)
- Expo SDK 55 upgrade: complete and validated
  - client stack now resolves to Expo `55.0.6`, React Native `0.83.2`, React `19.2.0`
  - React Compiler is enabled through `client/app.json` with env-aware overrides in `client/app.config.js`
  - iOS prebuild now opts into React Native source build through `expo-build-properties`
  - Android emulator and iOS simulator smoke runs both passed on 2026-03-17
  - the only remaining non-blocking Expo doctor warning is `react-native-wheel-pick` New Architecture metadata

See `ROADMAP.md` for dated milestones and next steps.

## Architecture Overview

```text
Client (React Native + Expo)
  -> SQLite (todos/completions/categories/pending_changes)
  -> Background Sync Service
  -> Server API (Express + MongoDB)
  -> Google Calendar Adapter (optional)
```

Core principles:

1. Local-first UX: UI is never blocked by server calls.
2. Sync as background concern.
3. Dependency-safe sync order: `ensureDatabase -> Pending Push -> Delta Pull -> Cursor Commit -> Cache Refresh`.
4. Strict date/time string contracts across client/API/server.

## Tech Stack

Client:

- React Native `0.83.2`
- Expo `55.0.6`
- Expo Router `55.0.5`
- React `19.2.0`
- Zustand `5.x`
- React Query `5.x`
- `expo-sqlite`

Server:

- Express `5.1.0`
- Mongoose `9.x`
- JWT auth
- Google OAuth / Calendar API (`google-auth-library`, `googleapis`)

## Repository Structure

```text
.
├─ client/
│  ├─ app/
│  ├─ src/
│  │  ├─ api/
│  │  ├─ features/
│  │  │  ├─ todo/
│  │  │  ├─ todo-calendar-v2/
│  │  │  └─ strip-calendar/
│  │  ├─ services/
│  │  │  ├─ db/
│  │  │  └─ sync/
│  │  ├─ store/
│  │  └─ utils/
│  └─ docs/
├─ server/
│  └─ src/
│     ├─ controllers/
│     ├─ models/
│     ├─ routes/
│     ├─ scripts/
│     └─ services/
├─ .kiro/
│  ├─ steering/
│  └─ specs/
├─ PROJECT_CONTEXT.md
├─ ROADMAP.md
└─ README.md
```

## Canonical Schedule Data Contract (Phase 2.5)

Todo schedule fields:

- `startDate`, `endDate`: `YYYY-MM-DD` or `null`
- `startTime`, `endTime`: `HH:mm` or `null`
- `recurrenceEndDate`: `YYYY-MM-DD` or `null`

Legacy fields rejected by API:

- `date`
- `startDateTime`
- `endDateTime`
- `timeZone`

Timezone source of truth:

- `user.settings.timeZone`
- UI selected date (`currentDate`) is stored as `YYYY-MM-DD` and derived from user timezone

## Quick Start

### 1) Prerequisites

- Node.js 18+
- npm
- MongoDB running locally or reachable remotely
- Expo toolchain for mobile/web testing

### 2) Install dependencies

```bash
# root
npm install

# client
cd client && npm install

# server
cd ../server && npm install
```

### 3) Configure environment variables

Create `client/.env`:

```env
EXPO_PUBLIC_API_URL=http://localhost:5000/api
```

Optional for iOS physical-device builds, create `client/.env.local`:

```env
EXPO_IOS_APPLE_TEAM_ID=ABCDE12345
EXPO_IOS_BUNDLE_IDENTIFIER=com.example.todolog
```

Create `server/.env`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/todolog
JWT_SECRET=replace_with_secure_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

Important note:

- `client/src/api/axios.js` has a fallback URL `http://localhost:5001/api`
- Android emulator/dev-client: `localhost` will be converted to `10.0.2.2` automatically for API calls.
- If API calls fail, set `EXPO_PUBLIC_API_URL` explicitly

### 4) Run

Option A: run both from root

```bash
npm run dev
```

Option B: run separately

```bash
# server
cd server
npm run dev

# client
cd client
npm run dev
```

Client launcher notes:

- `cd client && npm run dev` opens an interactive Expo launcher menu.
- The launcher auto-selects a free Metro port instead of assuming `8081`.
- `npm run dev:device` respects `EXPO_PUBLIC_API_URL` from shell, `.env.local`, and `.env`; if none is set, it falls back to the detected LAN IP for device testing.
- Default targets:
  - `iOS Simulator` -> dev client + `lan`
  - `Android Emulator` -> dev client + `localhost`
  - `Physical Device (Tunnel)` -> dev client + `tunnel`
  - `Web`
  - `Dev Client Server Only`
- Raw Expo commands are still available:
  - `npm run dev:expo`
  - `npm run ios`
  - `npm run ios:device` (requires `EXPO_IOS_APPLE_TEAM_ID` and `EXPO_IOS_BUNDLE_IDENTIFIER`)
  - `npm run android`
  - `npm run web`

Non-interactive examples:

```bash
cd client
npm run dev -- --target ios-sim --non-interactive
npm run dev -- --target device --non-interactive
```

Convenience shortcuts:

```bash
cd client
npm run dev:ios:sim
npm run dev:android:emu
npm run dev:device
npm run dev:web
```

Device-build note:

- `npm run ios:device` now exits early with a signing hint unless `EXPO_IOS_APPLE_TEAM_ID` and `EXPO_IOS_BUNDLE_IDENTIFIER` are set.
- Physical-device dev builds now use `expo-dev-client` launcher mode. After this native config changes, rebuild once with `npm run ios:device`; after that, network changes should only require `npm run dev:device` plus reopening the dev build or QR link.
- Simulator builds do not require provisioning profiles and should use `npm run dev:ios:sim` or `npm run ios`.
- `npm run dev:ios:sim` now defaults to `host=lan`; this project’s iOS dev-client reopen path was not reliable with `localhost`.

Notes for parallel Codex sessions:

- Separate launcher runs will choose separate Metro ports when possible.
- Tunnel/device mode still depends on Expo tunnel behavior and current network state.
- Multiple sessions can run separate Metro servers, but they should not try to control the same simulator or device UI at the same time.

### 5) Web E2E (Playwright)

Use web-only smoke checks first for fast validation.

```bash
cd client
npm install
npm run e2e:web:install
npm run e2e:web
```

Optional (headed):

```bash
cd client
npm run e2e:web:headed
```

Codex wrapper scripts:

```bash
cd client
npm run codex:test:smoke
npm run codex:test:real:category
npm run codex:test:real:todo
npm run codex:test:real:completion
```

Notes:

- `codex:test:real:*` wrappers assume the API server is reachable and use the environment/bootstrap rules documented in `CODEX_TESTING.md`.
- Use `CODEX_TESTING.md` when running parallel Codex sessions or when you need the standardized local web + Playwright launch flow.

## Key Runtime Paths

Client:

- SQLite init/migrations: `client/src/services/db/database.js`
- Todo persistence: `client/src/services/db/todoService.js`
- Sync orchestration: `client/src/services/sync/index.js`
- Common query/aggregation: `client/src/services/query-aggregation/index.js`
- Screen adapters: `client/src/services/query-aggregation/adapters/index.js`
- TC2 month data hook: `client/src/features/todo-calendar-v2/hooks/useTodoCalendarV2Data.js`
- TC2 month fetch service: `client/src/features/todo-calendar-v2/services/fetchMonthLayouts.js`
- Calendar month helpers: `client/src/utils/calendarMonthHelpers.js`
- Strip-calendar shell: `client/src/features/strip-calendar/ui/StripCalendarShell.js`
- Strip-calendar weekly/monthly lists: `client/src/features/strip-calendar/ui/WeeklyStripList.js`, `client/src/features/strip-calendar/ui/MonthlyStripList.js`
- Strip-calendar summary service: `client/src/features/strip-calendar/services/stripCalendarSummaryService.js`
- Todo form logic: `client/src/features/todo/form/useTodoFormLogic.js`

Server:

- Todo schema: `server/src/models/Todo.js`
- Todo contract validation: `server/src/controllers/todoController.js`
- Google adapter: `server/src/services/googleCalendar.js`
- Date normalization migration script: `server/src/scripts/migrateTodoDateFieldsToString.js`

## Development Workflow (Spec-Driven)

For new features and major changes:

1. Create or update spec folder under `.kiro/specs/<feature>/`
2. Finalize `requirements.md`
3. Finalize `design.md`
4. Finalize `tasks.md`
5. Implement in task order
6. Verify checkpoints and update logs

Use lightweight flow for small bug fixes or doc-only changes.

## AI Contributor Entry

If you are an AI agent, read in this order:

1. `AGENTS.md`
2. `AI_COMMON_RULES.md`
3. `PROJECT_CONTEXT.md`
4. `README.md`
5. `ROADMAP.md`
6. Relevant `.kiro/specs/<feature>/...`

Codex Expo note:

- The local Codex skill `upgrading-expo` is available and listed in `AGENTS.md`; use it for future Expo SDK maintenance work.

## Documentation Map

- AI behavior and constraints: `.kiro/steering/requirements.md`
- Current implementation truth: `PROJECT_CONTEXT.md`
- Feature specs and task traceability: `.kiro/specs/`
- Codex testing runbook: `CODEX_TESTING.md`
- Milestones and future plan: `ROADMAP.md`

## Troubleshooting

1. API connection issues
- Verify `EXPO_PUBLIC_API_URL` in `client/.env`.
- Confirm server is listening on expected `PORT`.

2. Date/time payload rejected (400)
- Remove legacy fields (`date`, `startDateTime`, `endDateTime`, `timeZone`).
- Ensure date/time formats follow canonical contract.

3. Calendar view not updating after edits
- Check invalidation paths in todo/completion mutation hooks.
- Confirm TC2 invalidation bridge and shared range cache invalidation both ran.

## License

Private repository. Internal use only.
