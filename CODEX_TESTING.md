# Codex Testing Guide

This runbook is the single handoff document for Codex when the task is:

- run tests
- verify a fix
- boot the app for manual smoke checks
- use the new Expo launcher in non-interactive mode

## 1. Default Rule

Prefer the most deterministic path first.

1. Web UI regression -> Playwright
2. Real API integration check -> Playwright `.real.spec.js`
3. Native app boot / manual smoke -> Expo launcher

Do not default to manual simulator testing if Playwright can cover the change.

## 2. Important Paths

- Root combined dev script: `npm run dev`
- API server: `cd server && npm run dev`
- Client interactive launcher: `cd client && npm run dev`
- Client non-interactive launcher: `cd client && npm run dev -- --target <target> --non-interactive`
- Codex localhost wrapper: `cd client && npm run codex:test:smoke`
- Web Playwright config: `client/playwright.config.js`
- Expo launcher script: `client/scripts/dev-launcher.js`
- Codex env wrapper: `client/scripts/codex-test-env.js`

## 3. Fastest Stable Path For Codex

### 3.1 Web smoke / regression

Preferred default:

```bash
cd client
npm run codex:test:smoke
```

Run a single spec:

```bash
cd client
npm run codex:test -- e2e/smoke.spec.js
```

Why this is preferred:

- `client/playwright.config.js` already manages a web server automatically
- it is the most reproducible path for Codex
- it avoids simulator/device UI timing issues
- it forces `EXPO_PUBLIC_API_URL` to `127.0.0.1:<server-port>/api` instead of using the current LAN IP from `client/.env`
- it disables Expo `.env` reloading for this path so stale LAN IP values do not leak back into the web bundle

### 3.2 Real API integration

Start the API server first:

```bash
cd server
npm run dev
```

Then run a real API spec from another terminal:

```bash
cd client
npm run codex:test:real:category
```

By default the wrapper reads `server/.env` `PORT` and builds `http://127.0.0.1:<PORT>/api`.
Override points:

- `CODEX_SERVER_PORT=<port>` to force a different localhost server port
- `CODEX_API_URL=http://127.0.0.1:<port>/api` to force an exact API base URL
- `PW_WEB_PORT=<port>` if the default Playwright web port is busy

Other existing real API specs:

```bash
cd client
npm run codex:test:real:todo
npm run codex:test:real:completion
```

Use this path when the change affects:

- sync behavior
- persistence/recovery
- API contracts
- optimistic/offline flows that must reconcile with the real server

## 4. Expo Launcher For Native Smoke Checks

### 4.1 Interactive mode

```bash
cd client
npm run dev
```

This opens a terminal menu for:

- `iOS Simulator`
- `Android Emulator`
- `Physical Device (Tunnel)`
- `Web`
- `Dev Client Server Only`
- `Install / Rebuild iOS App`
- `Install / Rebuild Android App`

### 4.2 Non-interactive mode for Codex

Codex should prefer non-interactive mode.

Boot dev client server only:

```bash
cd client
npm run dev -- --target server --non-interactive
```

Boot iOS simulator path:

```bash
cd client
npm run dev -- --target ios-sim --non-interactive
```

Boot Android emulator path:

```bash
cd client
npm run dev -- --target android-emu --non-interactive
```

Boot physical-device tunnel path:

```bash
cd client
npm run dev -- --target device --non-interactive
```

Shortcut aliases also exist:

```bash
cd client
npm run dev:server
npm run dev:ios:sim
npm run dev:android:emu
npm run dev:device
npm run dev:web
```

## 5. Reusing An Existing Web Server

Usually this is not necessary because Playwright starts its own web server.

Only use this if a server is already running and should be reused.

Start web manually:

```bash
cd client
npm run codex:web -- --port 4100
```

Then point Playwright at it:

```bash
cd client
PW_SKIP_WEBSERVER=1 PW_BASE_URL=http://127.0.0.1:4100 npm run codex:test -- e2e/smoke.spec.js
```

Useful env vars from `client/playwright.config.js`:

- `PW_WEB_PORT`
- `PW_BASE_URL`
- `PW_SKIP_WEBSERVER`
- `PW_REAL_API_BASE_URL`
- `PW_BROWSER_CHANNEL`
- `CODEX_SERVER_PORT`
- `CODEX_API_URL`

## 6. Multiple Codex Sessions

The Expo launcher was added to reduce conflicts between parallel sessions.

Rules:

- use non-interactive launcher targets for Codex
- prefer `npm run codex:*` for web/API test paths
- do not assume Metro port `8081`
- let the launcher choose a free port when possible
- do not try to control the same simulator or physical device UI from two sessions at once

Parallel sessions are okay for:

- separate Playwright runs
- separate web servers
- separate Metro servers

Parallel sessions are not reliable for:

- simultaneous control of the same iOS simulator window
- simultaneous control of the same real device

## 7. Current Caveats

- Root `npm run dev` is a combined legacy path (`server + client web`). It is not the preferred Codex path for targeted testing.
- Playwright in this repo is for web flows. It is not native iOS/Android UI automation.
- For true native UI automation, add a dedicated tool later (`Detox` or `Maestro`). The Expo launcher does not replace that.
- If API requests fail during local native testing, check `EXPO_PUBLIC_API_URL` first.
- If Codex reports Chromium launch errors like `bootstrap_check_in ... Permission denied (1100)`, treat that as an environment/sandbox issue first, not an app regression.

## 8. Recommended Codex Decision Flow

1. If the change is mostly UI/business logic and works on web, run Playwright first.
2. If the change touches sync/persistence/API behavior, run a `.real.spec.js` with `PW_REAL_API_BASE_URL`.
3. If the issue is native booting, deep-linking, simulator/device launch, or Expo runtime behavior, use the Expo launcher.
4. Only escalate to manual native testing when the deterministic web/API paths are insufficient.
