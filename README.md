# Todolog

Offline-first Todo and Calendar app built with React Native (Expo) and Node.js.

Todolog is designed to work fully offline, then sync safely to server and Google Calendar when online.

## Highlights

- Offline-first by default (local writes first)
- SQLite as local source of truth for core entities
- UUID v4 IDs generated client-side
- Calendar module with month-batch fetch and cache
- Strip-calendar module with separate weekly/monthly list architecture (stabilization in progress)
- Google Calendar integration with strict schedule type handling
- Timezone-aware selected-date state (`currentDate`) based on `user.settings.timeZone`

## Current Status

As of 2026-02-15:

- Phase 1-2 calendar integration: complete
- Phase 2.5 data normalization (floating date/time string contract): complete
- Strip-calendar stabilization/debugging: in progress
- Phase 3 recurrence engine: planned

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
3. Dependency-safe sync order: Category -> Todo -> Completion.
4. Strict date/time string contracts across client/API/server.

## Tech Stack

Client:

- React Native `0.81.5`
- Expo `54.0.33`
- React `19.1.0`
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
│  ├─ src/
│  │  ├─ api/
│  │  ├─ features/
│  │  │  ├─ todo/
│  │  │  ├─ todo-calendar/
│  │  │  └─ strip-calendar/
│  │  ├─ services/
│  │  │  ├─ db/
│  │  │  └─ sync/
│  │  └─ store/
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
npm start
```

## Key Runtime Paths

Client:

- SQLite init/migrations: `client/src/services/db/database.js`
- Todo persistence: `client/src/services/db/todoService.js`
- Sync orchestration: `client/src/services/sync/index.js`
- Calendar data hook: `client/src/features/todo-calendar/hooks/useTodoCalendarData.js`
- Strip-calendar shell: `client/src/features/strip-calendar/ui/StripCalendarShell.js`
- Strip-calendar weekly/monthly lists: `client/src/features/strip-calendar/ui/WeeklyStripList.js`, `client/src/features/strip-calendar/ui/MonthlyStripList.js`
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

1. `.kiro/steering/requirements.md`
2. `PROJECT_CONTEXT.md`
3. `README.md`
4. `ROADMAP.md`
5. Relevant `.kiro/specs/<feature>/...`

## Documentation Map

- AI behavior and constraints: `.kiro/steering/requirements.md`
- Current implementation truth: `PROJECT_CONTEXT.md`
- Feature specs and task traceability: `.kiro/specs/`
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
- Confirm month cache invalidation in `todoCalendarStore`.

## License

Private repository. Internal use only.
