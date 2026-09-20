# Codex Native Testing Guide

This runbook is the Codex handoff document for local native validation.

For the current Web GPT / CoS handoff and physical-device readiness checklist, start with
[WEB_GPT_HANDOFF.md](WEB_GPT_HANDOFF.md) and [execution guide](docs/handoff/EXECUTION_GUIDE.md).
The commands below are examples; discover the actual device, port, and LAN address first.
No new native runtime validation was performed in the 2026-09-21 documentation audit.

Web and Playwright paths were retired on 2026-05-16. Use iOS/Android dev-client
smoke checks for UI/runtime validation.

## 1. Default Rule

Prefer the smallest native surface that proves the change.

1. Static checks for changed JS/TS contracts.
2. Android emulator smoke for Android/fallback behavior.
3. iOS simulator smoke for iOS native-list/native-form behavior.
4. Manual device checks only when simulator behavior is insufficient.

## 2. Important Paths

- API server: `cd server && npm run dev`
- Client interactive launcher: `cd client && npm run dev`
- Client non-interactive launcher: `cd client && npm run dev -- --target <target> --non-interactive`
- Expo launcher script: `client/scripts/dev-launcher.js`
- iOS runbook: `client/docs/IOS_SIMULATOR_RUNBOOK.md`

## 3. Expo Launcher

Interactive:

```bash
cd client
npm run dev
```

Targets:

- `iOS Simulator`
- `Android Emulator`
- `Physical Device (Tunnel)`
- `Dev Client Server Only`
- `Install / Rebuild iOS App`
- `Install / Rebuild Android App`

Non-interactive examples:

```bash
cd client
npm run dev -- --target server --non-interactive
npm run dev -- --target ios-sim --non-interactive
npm run dev -- --target android-emu --non-interactive
npm run dev -- --target device --non-interactive
```

Shortcut aliases:

```bash
cd client
npm run dev:server
npm run dev:ios:sim
npm run dev:android:emu
npm run dev:device
```

## 4. Android Manual Smoke

Use the existing Android dev client and Metro server when possible:

```bash
cd client
EXPO_NO_TELEMETRY=1 npx expo start --dev-client --port 8082
```

Then connect and launch:

```bash
adb reverse tcp:8082 tcp:8082
adb shell am start -a android.intent.action.VIEW -d 'com.anonymous.client://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8082'
```

Useful checks:

```bash
adb shell uiautomator dump /sdcard/window.xml >/dev/null
adb shell cat /sdcard/window.xml
adb logcat -d -t 300 -v time AndroidRuntime:E ReactNativeJS:E Expo:E '*:S'
```

## 5. iOS Manual Smoke

Use the existing Metro server when possible:

```bash
cd client
npm run dev:server
```

When native module code changed, rebuild the dev client for the booted simulator:

```bash
cd client
npm run ios -- --device "iPhone 17" --no-bundler
```

Attach the rebuilt app to Metro and open a route:

```bash
xcrun simctl openurl booted 'com.anonymous.client://expo-development-client/?url=<URL_ENCODED_METRO_URL>'
xcrun simctl openurl booted 'com.anonymous.client://my-page/favorites'
xcrun simctl openurl booted 'com.anonymous.client://todo/category-select?todoIds=<id1>,<id2>'
```

Capture screenshots:

```bash
xcrun simctl io booted screenshot /tmp/todo-screen.png
```

Notes:

- Replace `<URL_ENCODED_METRO_URL>` with the actual Metro URL, URL-encoded. Do not reuse another project's host/port.
- Use `booted` only when exactly one simulator is running; otherwise specify its UDID. For Android, use `adb -s <serial>` when multiple devices are connected.

- `expo run:ios` in the current SDK uses `--device`, not `--simulator`.
- If the app opens to a blank dev-client screen after rebuild, inject the dev-client URL again and then reopen the target route.
- Maestro may hang against the current simulator session; prefer manual touch confirmation when `maestro hierarchy` times out.

## 6. Multiple Codex Sessions

- Do not assume Metro port `8081`; pass an explicit port or let the launcher choose one.
- Do not try to control the same simulator/emulator UI from two sessions at once.
- Separate Metro servers are okay; simultaneous UI automation on one device is not.

## 7. Caveats

- Root `npm run dev` starts server + client launcher, not a web server.
- If API requests fail during local native testing, check `EXPO_PUBLIC_API_URL`.
- If an emulator/simulator disappears after switching tools, restart the device and re-run `adb reverse` or the iOS runbook steps.
