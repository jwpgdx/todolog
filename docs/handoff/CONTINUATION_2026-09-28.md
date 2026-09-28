# 2026-09-28 Windows continuation — settings / timezone / active form

## Authority and scope

- User instruction: continue the prior Todolog work, inspecting current state before repeating anything.
- Workspace: `C:\dev\todolog` / CoS `/dev/todolog`.
- Branch: `codex/web-gpt-handoff-2026-09-21`.
- Verified starting HEAD: `775f40ad128958d0679b1119981254b30ab487b2`; starting worktree clean.
- Preserve prior calendar (`160b29d`), transactional offline CRUD (`5c2b27a`), and reorder (`775f40a`) fixes. No replay of those packages.
- This checkpoint supersedes older **operational next-step** text, not product policy. F24–F28, calendar-free selection scope, native UI boundaries, UUID/local-first and floating date/time contracts remain unchanged.
- This package is local source/test/document work. No commit, push, deployment, dependency upgrade, DB schema change, application DB mutation, real API call, or device install/run was performed.

## Implemented changes

### Settings and timezone

`client/src/store/authStore.js` serializes writes to the single AsyncStorage user record, reading the latest local settings inside the write lane. A failed local write does not publish a success state and does not poison later writes. Auth transitions share that lane and invalidate older queued settings work. Profile responses preserve settings changed during their request.

Local persistence completes independently of the network. Signed-in settings PATCHes are best-effort, ordered and bound to the initiating account/token. Full server settings snapshots are no longer merged over current local intent. `client/src/api/axios.js` preserves the explicitly supplied bearer and bypasses auth recovery for those settings requests, preventing a late settings 401 from logging out/clearing a replacement session. Other request auth-recovery behavior was not redesigned.

`useTimeZone` now delegates to this local-first settings path, so guest/timezone selection needs no authenticated timezone POST. The existing app-layout observer is the sole `autoDetect: true` owner; settings screens no longer register competing automatic observers or duplicate the auto-on write. Startup/foreground checks read current settings and coalesce an in-flight automatic update. Local persistence failures are surfaced by toast; no automatic failure loop was added.

**Limit:** remote settings failure still has no durable retry queue. This package does not promise cross-device delivery after an offline failure or a crash between local commit and PATCH. It preserves the existing best-effort policy rather than inventing a new sync contract.

### Date bootstrap and form

- Root prewarm uses the currently loaded user's timezone when available. This is not a new guarantee that auth hydration has completed before prewarm.
- Timezone realignment changes the selected date only when it was the previous timezone's today. It waits while Quick/Detail is open, while the V2 route is active, or while a Quick-to-V2 draft is pending.
- The active form reads canonical `startTime` / `endTime`, not legacy DateTime fields; explicit nullable end times survive editing.
- All-day and Quick payloads explicitly set both times to `null`. They no longer carry `userTimeZone` or legacy schedule metadata.
- Same-hour end-time comparison includes minutes. A 23h default timed create carries into the next date. Repeated late-night start edits do not keep extending the end date or extend an already longer date range.
- Switching an all-day record with null time fields to timed initializes usable defaults. Settings I/O is outside React's functional state updater.
- Quick-to-Detail handoff data takes precedence over the original stored todo, preserving unsaved edits.
- `DetailContent` no longer closes through an unconditional callback immediately after `handleSubmit`; the existing form mutation success path owns closing.

No Todo form redesign, recurrence-policy change, native module edit, or screen re-layout was made.

## Evidence and verification

Command from `client`:

```sh
node --test scripts/audit-settings-form.test.cjs
```

The harness Babel-loads and executes actual source modules. React scheduling, AsyncStorage, network, native UI and DB adapters are mocked; it is **not** real React Native/device/storage integration evidence.

- Before any runtime-source edit, the original 15 cases produced **2 PASS / 13 FAIL**. Failures included setting-key loss, stale/other-account overwrite, timezone not locally applied, canonical time loss, all-day/Quick clearing, date carry, and draft handoff loss.
- After the source patch, those same 15 cases produced **15 PASS / 0 FAIL**.
- Additional postpatch checks expanded the suite to **25 PASS / 0 FAIL**, including deferred local/remote completion, ordered PATCHes, local error recovery, auth/storage interleaving, old-session request fencing, late 401 handling, auto detection, root date/form guards and no premature close.
- Two additional profile/logout/rehydration tests bring the final suite to 27 cases. These additions have no claimed fail-first history.
- `node --check` passed for changed non-JSX auth/settings/form modules.
- Android-only offline Expo export and final diff verification are recorded below. Export is JS/Hermes bundling, not an APK/Gradle/native build or a device interaction test.
- Two attempted CoS helper audits failed to bootstrap. No independent-worker approval is claimed; source review and changes were performed by the prime agent.
- No full-project TypeScript PASS is claimed. The earlier documented baseline/type-resolution problems were not reclassified as fixed.

### Settings/form checkpoint verification

- Final expanded source-executing regression: **27 PASS / 0 FAIL / 0 skipped**, exit 0. Log: `client/dist/audit-20260928-settings-form/source-regression.log` (ignored local artifact).
- Android offline Expo export: **PASS**, exit 0, **2,306 modules**. Command from `client`: `node node_modules/expo/bin/cli export --platform android --max-workers 2 --output-dir dist/audit-20260928-settings-form`, with `EXPO_OFFLINE=1` and `EXPO_NO_TELEMETRY=1`.
- Export output: `client/dist/audit-20260928-settings-form/metadata.json` and `_expo/static/js/android/entry-0d5387bee4c0c4f244422d007991c60d.hbc`. This ignored output is not committed or published.
- Normal repository `git diff --check`: **PASS**, exit 0. One diagnostic invocation temporarily disabled `core.autocrlf` for that command and misclassified existing Windows CRLF as changed trailing whitespace; it was not a source fix or a persistent Git config change. Verification was repeated under the repository's actual settings without rewriting files.
- At this intermediate checkpoint HEAD remained `775f40ad128958d0679b1119981254b30ab487b2`; the later sync continuation below intentionally added more local source/test/doc changes without committing or replaying this package.

## Sync local-intent / pull atomicity continuation — completed locally

This follow-up was executed from the exact dirty checkpoint above without replaying the settings/form work. It remains source/test work only; no live queue replay, application DB write, API mutation, schema migration, device run, commit, push, or deployment occurred.

Fail-first harness: `client/scripts/audit-sync-local-intent.test.cjs`.

- Before sync runtime edits: **0 PASS / 9 FAIL**. It reproduced pull proceeding with active/future-backoff intent, an intent arriving during remote reads not fencing apply, Category mutation before a later Todo fetch failure, malformed payloads being treated as empty, missing shared transaction/rollback, and Category `INSERT OR REPLACE`.
- After remediation: the original nine cases are **9 PASS / 0 FAIL**.
- Dead-letter progress was added postpatch; focused final suite is **10 PASS / 0 FAIL**.

Implemented:

1. `deltaPull.js` blocks before remote reads whenever any `pending`/`failed` row remains; `dead_letter` rows do not permanently block pull.
2. After all three remote surfaces are fetched and shape-validated, Delta Pull enters one `withWriteTransaction` boundary and re-checks pending rows on that exact connection before applying anything. A local write during the network window aborts the pull; a write starting after the native exclusive transaction begins cannot be overwritten by that response.
3. Category/Todo/Completion local apply is one transaction, eliminating the prior Category/Todo partial-apply state when a later remote/apply step fails.
4. Batch DB helpers accept an existing transaction connection rather than nesting their own transaction during pull.
5. Category upsert no longer uses delete-and-reinsert `REPLACE`; it uses `ON CONFLICT(_id) DO UPDATE` so refresh cannot trigger FK cascade deletion through replacement semantics.
6. Non-array Category snapshots and invalid/missing Todo/Completion collection shapes or sync timestamps fail the pull before local mutation.

### Local-intent checkpoint verification

- Sync source regression: **10 PASS / 0 FAIL / 0 skipped** after remediation. The pre-edit baseline for its original nine cases was **0/9 PASS**.
- Settings/form source regression re-run after sync changes: **27 PASS / 0 FAIL / 0 skipped**.
- `node --check` passed for the changed sync/DB JS modules before the final documentation-only updates.
- Android offline Expo export after all runtime-source changes: **PASS**, exit 0, **2,306 modules**, output `client/dist/audit-20260928-sync-local-intent` (ignored local artifact). Generated bundle: `_expo/static/js/android/entry-005c48e28fcce9700a9b05304311cec4.hbc`.
- Normal repository `git diff --check`: **PASS**, exit 0 after the final runtime/doc changes.
- At this intermediate checkpoint HEAD was still `775f40ad128958d0679b1119981254b30ab487b2` on `codex/web-gpt-handoff-2026-09-21`, with **21 modified tracked files + 3 new files** and no commit/push.
- Root/client package manifests and lockfiles and `client/modules` were unchanged. The cursor continuation below subsequently makes bounded server-controller changes, so the earlier “server source unchanged” boundary no longer describes the final worktree.
- No live API request, app SQLite mutation, native app build/install, emulator/device interaction, deployment, or dependency update is claimed by these checks. Android Expo export is JS/Hermes bundling evidence only.

## Cursor watermark / read-window continuation — completed locally

This package continued from the exact local-intent dirty tree and touched only the bounded cursor protocol plus tests/docs. Fail-first harness: `client/scripts/audit-sync-cursor-watermark.test.cjs`.

- Pre-edit cursor suite: **0 PASS / 6 FAIL**.
- Post-remediation cursor suite: **6 PASS / 0 FAIL**.
- It covers pre-read endpoint boundaries, inclusive same-ms replay, bounded upper queries, clock rollback monotonicity, invalid Todo cursor rejection, and earliest sequential endpoint watermark selection on the client.

Implemented:

1. Todo/Completion server delta handlers validate `lastSyncTime` and capture `serverSyncBoundary` before Mongo reads.
2. Both updated/deleted queries use inclusive `$gte lastSyncTime` and `$lte serverSyncBoundary`. This intentionally trades harmless idempotent overlap for protection against same-millisecond lost writes.
3. If the server clock is behind the incoming cursor, the endpoint returns the existing cursor rather than moving backwards.
4. The client now commits the **earliest** Todo/Completion endpoint boundary. This is paired with the server bounded-window change; changing client max→min alone was not treated as a fix.
5. A combined server cursor earlier than the current cursor is rejected.

Source checks after this change: cursor **6/6 PASS**, local-intent **10/10 PASS**, settings/form **27/27 PASS**, and `node --check` for the changed cursor files PASS. Final Android export/diff/status are recorded below after completion.

### Final verification after cursor continuation

- Android offline Expo export after the final client runtime change: **PASS**, exit 0, **2,306 modules**. Output: `client/dist/audit-20260928-sync-cursor-watermark` (ignored local artifact), bundle `_expo/static/js/android/entry-ae96efaee952ae9fb6a50d73b74be2b2.hbc`.
- Final normal-repository `git diff --check`: **PASS**, exit 0.
- Final HEAD remains `775f40ad128958d0679b1119981254b30ab487b2` on `codex/web-gpt-handoff-2026-09-21`.
- Final worktree: **24 modified tracked files + 4 new files**. This includes the preserved settings/form package, local-intent sync package, cursor package, their source-executing harnesses, and synchronized docs/specs. No commit or push occurred.
- Root/client package manifests and lockfiles and `client/modules` remain unchanged. Server source changes are limited to the Todo/Completion delta controllers in this cursor package.
- No live API request, Mongo/SQLite application-data mutation, schema migration, dependency update, native build/install, emulator/device interaction, deployment, or production action was performed.

## Todo detail input lifecycle continuation — completed locally

Fail-first harness: `client/scripts/audit-form-input-lifecycle.test.cjs`.

- Pre-edit: **0 PASS / 2 FAIL**. The form delayed title/memo writes by 300ms, and `handleSubmit` built its payload from the previous render even after a synchronous `handleChange`.
- Post-remediation: **2 PASS / 0 FAIL**.
- `DetailedForm.js` keeps uncontrolled native inputs (`defaultValue`) but forwards every title/memo text event immediately; no title/memo timer remains that can fire after close/reopen.
- `useTodoFormLogic` now maintains a synchronous latest-draft ref alongside render state. `buildPayload` and submit validation read that ref, so a save tap does not depend on a rerender occurring after the final native text event.
- Existing settings/form regression remained **27/27 PASS** after the input-lifecycle change.
- `node --check` passed for `useTodoFormLogic.js`; Android offline Expo export after the runtime change passed with **2,306 modules**, output `client/dist/audit-20260928-form-input-lifecycle` (ignored artifact), bundle `_expo/static/js/android/entry-50d6ee3ca80cb15f70a7ffd48f1f37a1.hbc`.

This removes the known delayed-input data-loss path. It does not claim device-level IME/performance validation; the inputs remain uncontrolled specifically to preserve native composition behavior.

## Nullable schedule / recurrence round-trip continuation — completed locally

Fail-first harness: `client/scripts/audit-form-recurrence-compat.test.cjs`.

- Pre-edit: **1 PASS / 4 FAIL** across five cases. Existing behavior silently replaced legacy/null `startDate` and `endDate` with the selected/current date, simplified richer RRULE grammar during unrelated edits, and did not surface an embedded RRULE `UNTIL` when the separate `recurrenceEndDate` field was null.
- Post-remediation: **5 PASS / 0 FAIL**.
- Server create/update and the Mongo Todo schema still require a `startDate`; this package does **not** introduce a new undated-Todo product mode. When editing legacy/local nullable data, the form now preserves null instead of silently assigning today and blocks submit with “시작 날짜를 선택해주세요” until the record is explicitly repaired.
- Nullable `endDate` is preserved as null rather than being silently rewritten to `startDate` during an unrelated edit.
- Existing recurrence rules are round-tripped exactly while recurrence controls remain untouched. This protects grammar not represented by the current UI (for example `INTERVAL`, `COUNT`, `WKST`, or other extra tokens) from being discarded by a title/memo/date edit.
- An embedded RRULE `UNTIL=YYYYMMDD...` is parsed for the form's repeat-end display when `recurrenceEndDate` is absent, while an unrelated save still preserves the original raw recurrence and original separate end-date field.
- Once the user actually edits a recurrence control, the form intentionally rebuilds the currently supported canonical subset rather than pretending unsupported tokens were edited safely.
- Quick labels show `날짜 선택` for a preserved null start date rather than formatting null as a date.

Verification after this change: recurrence-compat **5/5 PASS**, input-lifecycle **2/2 PASS**, settings/form **27/27 PASS**, and `node --check` for `useTodoFormLogic.js` PASS. Android offline Expo export after the runtime change passed with **2,306 modules**, output `client/dist/audit-20260928-form-recurrence-compat` (ignored artifact), bundle `_expo/static/js/android/entry-6bc8158cd619bd63068fa4c00c4221fb.hbc`.

One separate recurrence-engine gap was discovered at this checkpoint: the active form can intentionally build monthly `BYMONTHDAY=1,15`-style rules, while `client/src/utils/recurrenceEngine.js` still normalized `BYMONTHDAY` through a single-positive-integer parser. It was handled in the following bounded package.

## Recurrence engine multi-value BYMONTHDAY continuation — completed locally

Fail-first harness: `client/scripts/audit-recurrence-multi-bymonthday.test.cjs`.

- Before engine edits, the original six cases were **0 PASS / 6 FAIL**. Multi-value RRULE/JSON normalization returned no usable month-day constraint, expansion fell back to the start-date day, and the active `occurrenceDecisionService` excluded the second authored monthly date.
- After remediation, those six cases are **6 PASS / 0 FAIL**. One postpatch yearly single-value compatibility case brings the final focused suite to **7 PASS / 0 FAIL**.
- `recurrenceEngine.js` now normalizes `BYMONTHDAY` to the already-documented list shape (`number[]`), accepting comma-separated RRULE values, JSON arrays and scalar values.
- Monthly occurrence checks match any listed positive day. Short months naturally skip impossible dates instead of remapping them; e.g. `15,31` yields Feb 15, then Mar 15/31.
- Yearly rules continue to accept the same normalized list shape while preserving the existing single-day behavior used by the current form.
- Active common occurrence decision was executed in the harness, proving a todo with `BYMONTHDAY=1,15` is included on the 15th rather than only the first/start-date fallback.

Regression after the engine change: engine **7/7 PASS**, form recurrence compatibility **5/5 PASS**, input lifecycle **2/2 PASS**, settings/form **27/27 PASS**, and `node --check src/utils/recurrenceEngine.js` PASS. Android offline Expo export after the runtime change passed with **2,306 modules**, output `client/dist/audit-20260928-recurrence-multi-bymonthday` (ignored artifact), bundle `_expo/static/js/android/entry-4dbaa38e9935bbb61b7c9de1bec06551.hbc`.

The server occurrence path already uses the `rrule` package and was not modified. At this checkpoint a separate presentation-only gap remained in `getRecurrenceDescription`: multi-day monthly rules displayed only the first day, and persisted recurrence arrays could throw in the active native managed-list adapter. It was handled in the following bounded package.

## Recurrence description / persisted-array continuation — completed locally

Fail-first harness: `client/scripts/audit-recurrence-description.test.cjs`.

- Pre-edit: **1 PASS / 4 FAIL** across five cases. `BYMONTHDAY=1,15,31` rendered only `1일`; recurrence arrays caused `.match` type errors; empty/malformed non-string inputs were not fail-soft; and the active `managedTodoItemAdapter` crashed when given a persisted recurrence array.
- Post-remediation: **5 PASS / 0 FAIL**.
- `getRecurrenceDescription` now accepts either a string or persisted string-array recurrence and consistently uses the first non-empty rule.
- Monthly multi-value `BYMONTHDAY` descriptions render all positive authored days, e.g. `매월 1일, 15일, 31일`, while existing single monthly/yearly wording remains unchanged.
- Empty recurrence input returns `반복 없음`; malformed unsupported shapes return `반복 규칙 오류` without throwing.
- The active native managed-list adapter was executed through the source harness and now renders an array-backed `BYMONTHDAY=1,15` todo as `매월 1일, 15일` without crashing.

Regression after this display-only change: recurrence-description **5/5 PASS**, recurrence-engine multi-BYMONTHDAY **7/7 PASS**, form recurrence compatibility **5/5 PASS**, and `node --check src/utils/recurrenceUtils.js` PASS. Android offline Expo export after the runtime change passed with **2,306 modules**, output `client/dist/audit-20260928-recurrence-description` (ignored artifact), bundle `_expo/static/js/android/entry-9da8e14a10cefb5be0bb100b36345aa2.hbc`.

## Other follow-up observations / unverified native behavior

- Verify timezone changes and restart persistence in guest/signed-in modes, editing saved timed todos, Quick-to-V2 handoff, save failure keeping the form open, and native picker behavior on real Android/iOS devices.
- Previous iOS/H2/native gesture evidence remains pending; Android JS export does not satisfy it.

### 2026-09-28 Windows Android native-smoke availability check

The next validation boundary was checked without replaying any completed source package.

- `adb devices`: daemon started successfully, but **0 attached devices/emulators** were present.
- `emulator` executable is not installed/on PATH; `ANDROID_HOME` and `ANDROID_SDK_ROOT` are unset.
- The usual `%LOCALAPPDATA%\\Android\\Sdk\\emulator\\emulator.exe` path is absent, and no AVD could be enumerated.
- `client/android` is currently absent (native output remains ungenerated/ignored in this workspace).
- Existing Platform Tools `adb.exe` is available through WinGet, but that alone is insufficient for a native app run.

Therefore no Android build/install/device interaction was attempted. Creating an SDK/AVD or regenerating native output would be a separate environment/bootstrap action rather than verification of the current code package. Current evidence remains source-executing regressions + Android offline Expo JS/Hermes exports only. iOS native validation is also not available from this Windows host.

### Windows Android bootstrap continuation — existing toolchain rediscovered, compile/run boundary isolated

The next bounded pass checked whether the machine already had reusable Android tooling before any download/install action.

- Android Studio **is already installed**, but at the nonstandard path `D:\\DevTools\\AndroidStudio` (Winget package `Google.AndroidStudio`, version 2026.1). Its bundled JBR is present.
- Android SDK **is already installed** at `D:\\Android\\Sdk` with:
  - `platform-tools`
  - `emulator`
  - `platforms/android-36.1`
  - `build-tools/36.0.0`
- `cmdline-tools` / `sdkmanager` / `avdmanager` are not present in that SDK.
- No `system-images` directory exists and `emulator -list-avds` returns no AVDs. `adb devices` still shows zero attached devices/emulators.
- The previous “SDK absent” conclusion was therefore only a PATH/default-location miss; no new SDK was installed during this continuation.

Using only the existing Node dependencies and the rediscovered SDK path, Expo Android prebuild was executed with `--no-install`:

- `client/android` was generated successfully.
- Expo reported `package.json` “updated | no changes”; repository package manifests/locks remain unchanged.
- The generated Android tree is ignored/local output and does not add tracked repository changes.

The generated wrapper requires `gradle-9.0.0-bin.zip`. The user Gradle wrapper cache has no reusable distribution, and Android Studio contains no reusable Gradle distribution archive/launcher suitable for this project. Running `gradlew` would therefore cross into a new external Gradle download. That download was not started in this bounded existing-toolchain-only pass.

Final native boundary on this Windows host:

1. **Prebuild:** PASS using existing local dependencies.
2. **Compile (`assembleDebug`):** not executed; requires first-time Gradle 9.0.0 distribution download.
3. **Install/run smoke:** not executable yet; no attached device and no installed system image/AVD.

The next environment package, if authorized, is specifically: acquire/reuse the exact Gradle wrapper distribution needed by the generated project, run Android compile with `ANDROID_HOME=D:\\Android\\Sdk`, then separately provision/reuse a system image/AVD (or attach a physical device) before install/run smoke. Do not repeat the SDK/Studio discovery or Expo prebuild unless the generated ignored tree is removed.

### Android compile attempt and C: cleanup — latest state

The user then authorized continuing the Android compile path.

- Gradle wrapper downloaded `gradle-9.0.0-bin.zip` and began `:app:assembleDebug`.
- The first compile attempt ran for about 19m 40s and failed before producing an APK. The dominant failure was repeated inability to create Gradle transform/cache directories under `C:\\Users\\park\\.gradle\\caches\\9.0.0\\transforms`; Kotlin/native-settings work also failed in that broken cache state.
- No APK was produced.
- A second attempt was started with Gradle user/project cache redirected to `D:\\GradleHome` / `D:\\GradleProjectCache\\todolog`; it progressed beyond the earlier cache failure into React Native/Expo plugin and project configuration, but the user explicitly stopped the work because C: capacity had become critical. The build was not allowed to complete.
- After CoS reconnected, no TODOLOG Gradle/Kotlin/Expo build process remained running.

The C: artifacts created by this Android attempt were then removed deliberately:

- `C:\\Users\\park\\.gradle` (~4.34 GB)
- ignored/generated `client/android` (~1.18 GB)
- generated `android/build` directories under React Native/Expo `node_modules`
- generated `client/modules/*/android/build` directories

Post-cleanup checks:

- C: free space recovered from about **5.11 GB to 12.58 GB**.
- `C:\\Users\\park\\.gradle` is absent.
- `client/android` is absent.
- No Android `build` directories remain under the checked client/module paths.
- Repository source changes and package manifests/locks were preserved.

Do not resume Android native compile automatically from this checkpoint. If Android compile is requested later, keep Gradle caches off C: (for example `GRADLE_USER_HOME=D:\\GradleHome`) and first re-create the ignored Android native tree.

## Resume safely

Read this checkpoint, then inspect `git status`, HEAD and the current test file. The package is intentionally left as reviewable local changes; do not reset, replay the patch or treat older H2-only text as the latest operational stop. Preserve all unrelated work and stop at real product/deployment boundaries.
