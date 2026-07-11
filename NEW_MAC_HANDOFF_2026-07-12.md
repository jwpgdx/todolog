# Todolog New Mac Handoff

Last Updated: 2026-07-12
Branch: `codex/macbook-handoff-2026-07-12`
Purpose: Restore the current WIP state on a new Apple Silicon Mac and continue with Codex without relying on the previous chat history.

## 1. Read First

Codex must read these files before editing:

1. `AGENTS.md`
2. `AI_COMMON_RULES.md`
3. `PROJECT_CONTEXT.md`
4. `README.md`
5. `ROADMAP.md`
6. `IMPLEMENTATION_ORDER.md`
7. `메뉴 구조.md`
8. `.kiro/specs/native-managed-list/requirements.md`
9. `.kiro/specs/native-managed-list/design.md`
10. `.kiro/specs/native-managed-list/tasks.md`
11. `.kiro/specs/todo-screen-v2/triage.md`

Do not run dependency upgrades, `npx expo install --fix`, destructive Git commands, or simulator resets during the initial restore.

## 2. Transfer Policy

Preferred transfer:

1. Clone the handoff branch from GitHub.
2. Restore ignored `.env` files from the encrypted secrets archive.
3. Install dependencies with `npm ci`.
4. Regenerate `client/ios` and `client/android` locally.

Do not transfer these generated or architecture-specific folders:

- `node_modules`
- `client/node_modules`
- `server/node_modules`
- `client/ios`
- `client/android`
- `client/.expo`
- Xcode DerivedData
- CoreSimulator device folders
- Android SDK/AVD folders
- Gradle caches

The source archive includes `.git`, tracked changes, and untracked source files, but excludes secrets and generated folders. The secrets archive contains only:

- `client/.env`
- `client/.env.local`
- `server/.env`

The GitHub repository is public. Never commit or push the three environment files.

## 3. Current Product/Architecture Status

Completed and validated foundations:

- Expo SDK 55 / React Native 0.83 / React 19.2 baseline
- Expo Router file-based navigation
- SQLite offline-first source of truth
- pending-change background sync and retry/dead-letter flow
- recurrence engine and common query/aggregation layer
- Todo Calendar V2 monthly path
- Week Flow Calendar Todo header
- floating bottom tab bar
- iOS NativeManagedList category/todo foundation
- iOS category header reorder and Inbox pinned rule
- iOS todo same-category and cross-category reorder
- collapsed category hover auto-expand and drag edge auto-scroll
- favorites section drag in/out, collapse persistence, and order persistence
- iOS native menu, swipe, preview, and bottom inset handling
- Android My Page category RecyclerView first slice
- NativeSelectionList baseline for category color and category picker flows

Non-negotiable architecture rules:

- SQLite remains the local source of truth.
- UI writes local data first and never waits for the server.
- sync order remains Category -> Todo -> Completion.
- native list code emits events; domain writes stay in JS hooks/services.
- generated `client/ios` and `client/android` folders stay ignored.

## 4. Last Active Work: Todo Selection Mode

Implemented:

- selection-mode state hook
- selected todo ID set
- bottom tab bar hide/show state
- shared RN `TodoSelectionActionBar`
- selected item payload through NativeManagedList JS/iOS/Android models
- iOS selected row background and selection control
- selection-mode row tap/control toggle
- selection-mode menu/swipe/reorder/category collapse disable path
- selection entry on Favorites, All Todos, and Category detail
- single and comma-separated bulk `todoIds` category picker route
- modal header: `취소 / 카테고리 선택 / 이동`
- target category append order calculation
- custom/favorite/date/time fields preserved by category move

Validated:

- JS syntax checks passed for selection-mode files.
- iOS native rebuild succeeded after native selected-state changes.
- Favorite screen rendered after rebuild.
- bulk `todoIds` category picker deep link rendered.
- modal header and disabled-until-target-selection state were visually confirmed.

Not yet completed:

- manual end-to-end validation of selecting multiple rows and committing category move
- SQLite verification after the latest bulk UI flow
- automatic UI validation; Maestro timed out on the current simulator session
- selection-mode exit after successful bulk action needs final behavior validation
- bulk delete handler
- bulk complete/uncomplete handler
- bulk favorite/unfavorite handler
- first-class offline-first bulk hooks/transactions
- TodoScreen selection mode
- Android todo/favorite selection parity

Important implementation fact:

- The action bar renders Delete, Complete, Favorite, and Move.
- Only Move currently has a screen handler. The other actions are disabled because no handler is supplied.

## 5. TodoScreen V2 Decisions

Frozen first-pass layout:

```text
[ native Stack header: right-side action menu ]
[ RN title/date + RN calendar ]
[ NativeManagedList as the list scroll owner ]
```

Rules:

- Keep the existing RN/Reanimated calendar.
- Do not embed RN calendar children inside NativeManagedList.
- Do not wrap NativeManagedList in a same-axis RN ScrollView/FlatList.
- One-page scrolling/collapse is deferred to a spacer/scroll-offset/overlay prototype.
- Calendar-free native-list screens use native Stack header/large title and NativeManagedList as the primary scroll view.
- TodoScreen selection mode remains a separate follow-up because its RN title/calendar chrome needs a dedicated transition spike.

The triage document contains frozen decisions but has not yet been promoted into formal `requirements.md`, `design.md`, and `tasks.md` for TodoScreen V2.

## 6. Remaining Work Order

Restore checkpoint:

1. Clone/extract the handoff branch.
2. Restore `.env` files and update the new Mac LAN API host.
3. Run `npm ci` in root, client, and server.
4. Reproduce the iOS native dev-client build without dependency upgrades.
5. Reproduce the Android category baseline on an ARM64 emulator.

Resume feature work:

1. Manually verify Favorites/All Todos/Category detail selection mode.
2. Select two todos, open category picker, move them, and verify SQLite category/order fields.
3. Fix any selection-mode state/exit defects found by that smoke test.
4. Implement first-class offline-first bulk hooks: delete, complete/uncomplete, favorite/unfavorite, move.
5. Connect action-registry handlers per screen.
6. Promote TodoScreen V2 triage decisions into requirements/design/tasks with user approval.
7. Implement TodoScreen selection-mode chrome behavior.
8. Continue Android todo/favorite native-list and selection parity.
9. Defer Account Hub, settings migration, theme rollout, and Todo form redesign until the above path is stable.

## 7. Dependency State

The handoff intentionally preserves the current lockfile state.

Current client baseline:

- Expo `55.0.24`
- React Native `0.83.6`
- React `19.2.0`
- Expo Router `55.0.14`

As of 2026-07-12, `npx expo-doctor` reports 16/19 checks passing. Known follow-up items:

- direct `expo-constants` peer dependency is missing
- `react-native-wheel-pick` is untested on the New Architecture
- ten Expo packages have newer expected SDK 55 patch versions

Migration rule:

- First use `npm ci` and prove the preserved baseline builds.
- Do not run `npx expo install --fix` during restore.
- Handle Expo patch alignment and `expo-constants` in a separate approved dependency-maintenance task.
- After any native dependency change, regenerate native folders and rebuild both platforms.

## 8. Toolchain Baseline

Validated old-Mac baseline:

- macOS `15.7.3`
- Xcode `26.2` (`17C52`)
- iOS build SDK `26.2`
- iOS simulator runtime `26.3.1`
- iPhone simulator `iPhone 17`
- Node `24.14.0`
- npm `11.9.0`
- CocoaPods `1.16.2`
- JDK `17`
- Android compile/target SDK `36`
- Android Build Tools `36.1.0`
- Android NDK `27.1.12297006`
- CMake `3.22.1`

On Apple Silicon, create a new Android API 36/36.1 Google Play ARM64 emulator. Do not copy the old Intel `x86_64` AVD.

## 9. New Mac Installation

Install:

- latest Codex/ChatGPT desktop app and sign in with the same account
- Xcode 26.2 from Apple Developer Downloads for the initial baseline
- iOS 26.3.1 simulator runtime and an iPhone 17 simulator
- Xcode Command Line Tools
- Homebrew
- Node 24.14.0 through a version manager
- CocoaPods 1.16.2
- JDK 17
- Android Studio for Apple Silicon
- Android SDK/Build Tools/NDK/CMake versions listed above
- GitHub authentication for pushing future changes

Initialize Xcode:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
xcodebuild -runFirstLaunch
```

Install project packages:

```bash
cd /path/to/todo
npm ci

cd client
npm ci

cd ../server
npm ci
```

Restore environment files, then update `client/.env`:

```text
EXPO_PUBLIC_API_URL=http://<NEW_MAC_LAN_IP>:5001/api
```

The server uses MongoDB Atlas through `mongodb+srv`; a local MongoDB server is not required.

## 10. First Validation on the New Mac

Start the server:

```bash
cd server
npm run dev
```

First iOS build:

```bash
cd client
npm run ios -- --device "iPhone 17"
```

After the dev client exists, start/reconnect Metro with the launcher:

```bash
cd client
npm run dev:ios:sim
```

First Android build:

```bash
cd client
npm run android
```

Read `CODEX_TESTING.md` and `client/docs/IOS_SIMULATOR_RUNBOOK.md` for route, deep-link, screenshot, and native smoke commands.

## 11. First Prompt for the New Codex Session

```text
This is a transferred Todolog workspace. Do not edit yet.

Read AGENTS.md and follow its startup order. Then read
NEW_MAC_HANDOFF_2026-07-12.md, IMPLEMENTATION_ORDER.md, 메뉴 구조.md,
.kiro/specs/native-managed-list/*, and .kiro/specs/todo-screen-v2/triage.md.

Inspect git status, the current branch, package versions, and generated native
folder state. Do not run dependency upgrades, expo install --fix, git reset,
git clean, or simulator resets.

First reproduce the preserved iOS build. Then report whether the environment
matches the handoff baseline. After that, verify the existing selection-mode
flow: Favorites/All Todos/Category detail -> select two todos -> Move -> choose
a category -> verify SQLite category_id/category_order and preserved order fields.

The current action bar only wires Move. Bulk Delete/Complete/Favorite and
TodoScreen selection mode are not implemented. Ask for approval before edits.
```

## 12. Restore Verification

Before resuming feature work, confirm:

- current branch is the handoff branch
- working tree matches the checkpoint commit
- all three `.env` files exist but remain ignored
- `npm ci` succeeds in all three package roots
- `npx expo install --check` output is recorded but not auto-fixed
- iOS native build succeeds
- Android category baseline builds on ARM64
- server connects to MongoDB Atlas
- no secrets appear in `git status` or staged changes
