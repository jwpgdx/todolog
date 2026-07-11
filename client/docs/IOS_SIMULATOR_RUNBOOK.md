# iOS Simulator Runbook

Last updated: 2026-07-12

## Purpose

This document records the currently validated local iOS simulator setup and the exact build/run/test workflow for this repository.

Use this when:

- rebuilding the iOS dev client locally
- reconnecting Metro to the simulator
- running `simctl` / `xcodebuild` / Maestro flows
- reproducing native iOS UI issues

## Locked Local Baseline

Validated local combination:

- macOS `15.7.3`
- Expo SDK `55`
- React Native `0.83.6`
- Xcode `26.2`
- build SDK: `iPhoneSimulator26.2.sdk`
- simulator runtime: `iOS 26.3.1`
- simulator device: `iPhone 17`

Operational rule:

- keep exactly one iOS simulator booted during validation
- do not mix `18.x` and `26.x` runtimes in the same debug session

## Important Constraint

When running through Codex tools, these commands must be executed outside the sandbox:

- `xcodebuild`
- `xcrun simctl`
- `~/.maestro/bin/maestro`

Otherwise they can fail with misleading CoreSimulator errors.

Typical bad symptom set:

- `CoreSimulatorService connection became invalid`
- `simdiskimaged crashed or is not responding`
- `xcworkspace is not a workspace file`

If Xcode GUI works but CLI fails, check this first.

## Current Preferred Workflow

### 1. Start Metro

```bash
cd client
npm run dev:server
```

Expected result:

- Metro starts on `localhost:8081` if available
- Expo dev client can reconnect to that server

### 2. Boot the simulator

Prefer creating and using a single `iPhone 17` device in Xcode GUI, then booting it once.

CLI check:

```bash
xcrun simctl list devices
```

### 3. Build from CLI

Preferred Expo command when the generated iOS folder is absent or native modules changed:

```bash
cd client
npm run ios -- --device "iPhone 17" --no-bundler
```

Use `--no-bundler` only when Metro is already running. The current Expo CLI accepts `--device`; it does not accept the old `--simulator` option.

Direct workspace fallback:

Use the workspace directly.

```bash
cd client
xcodebuild \
  -workspace ios/client.xcworkspace \
  -scheme client \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17,OS=26.3.1' \
  build
```

What was validated:

- CLI build reaches full native compile
- result: `BUILD SUCCEEDED`
- build uses `iPhoneSimulator26.2.sdk`

If destination resolution is flaky, use the simulator UDID instead:

```bash
xcodebuild \
  -workspace ios/client.xcworkspace \
  -scheme client \
  -configuration Debug \
  -destination 'platform=iOS Simulator,id=<DEVICE_UDID>' \
  build
```

### 4. Install and launch from CLI

Find the built app:

```bash
find ~/Library/Developer/Xcode/DerivedData -path '*Build/Products/Debug-iphonesimulator/client.app'
```

Install to the booted simulator:

```bash
xcrun simctl install booted /path/to/client.app
```

Launch:

```bash
xcrun simctl launch booted com.anonymous.client.r6l8abtkq3
```

Validated result:

- `simctl install` succeeded
- `simctl launch` succeeded
- app process started normally

## Dev Client Reconnect

There are two reconnect paths.

### Preferred

If Metro is already running and the app is on the dev client launcher, tap the saved project entry manually or via Maestro.

### Optional deep link

```bash
xcrun simctl openurl booted 'com.anonymous.client://expo-development-client/?url=http%3A%2F%2F<MAC_LAN_IP>%3A8081'
```

Note:

- if the rebuilt app opens to a blank dev-client surface, inject the dev-client URL again and then open the target app route
- if URL handoff fails, use the launcher UI instead of retrying blindly

## Xcode GUI Fallback

If CLI build is healthy but you want a manual fallback:

1. Open `client/ios/client.xcworkspace`
2. Select scheme `client`
3. Select destination `iPhone 17`
4. Press `Run`

This path is useful when you want to keep the simulator session stable while checking UI manually.

## Maestro Workflow

### Inspect current screen

```bash
~/.maestro/bin/maestro hierarchy --compact
```

### Run a flow

```bash
~/.maestro/bin/maestro test /path/to/flow.yaml
```

### Practical guidance

- check hierarchy before writing selectors
- prefer current accessibility text over guessed labels
- on My Page, category controls may require scrolling twice before they are visible

## Current iOS Category Test Notes

As of 2026-05-08:

- iOS category creation was verified successfully with `NativeCategoryManager` temporarily excluded
- test path:
  - `My Page`
  - scroll down twice
  - `, 카테고리 추가`
  - enter category name
  - `완료`
- SQLite save completed
- category count increased in logs
- Maestro debug hierarchy contained the new item

This means:

- category creation itself is currently working
- earlier freezes are more strongly associated with the shared native category list path

## Troubleshooting

### `Unable to lookup in current state: Shutdown`

Meaning:

- the target simulator is not booted

Action:

- boot the device first
- or use `booted` only after confirming the simulator is running

### `Unable to boot device in current state: Booted`

Meaning:

- the simulator is already running

Action:

- do not boot again
- proceed with install/launch

### `openurl` fails with error 115

Meaning:

- dev client did not accept the Expo URL handoff

Action:

- keep Metro running
- use the dev client launcher entry manually or via Maestro

### CLI fails but Xcode GUI works

First suspect:

- the command was executed in a restricted/sandboxed environment

Action:

- rerun `xcodebuild`, `simctl`, or Maestro outside the sandbox

## Change Control

If any of these change, update this file in the same session:

- Xcode version
- simulator runtime
- primary simulator device
- validated CLI build command
- dev client reconnect method

For full new-Mac restore order and dependency warnings, read `../../NEW_MAC_HANDOFF_2026-07-12.md`.
