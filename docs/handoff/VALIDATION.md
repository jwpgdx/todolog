# 인수인계 검증 기록

날짜: 2026-09-21
범위: 문서 감사 및 인수인계 브랜치 준비
기능 코드 기준: `79cbc8d667019e99799bc4ade545c8085b8cba35`

## 수행한 확인

- 시작 시 `codex/macbook-handoff-2026-07-12` worktree가 깨끗했고 remote branch도 같은 기준 commit이었다.
- 기존 branch를 보존하고 `codex/web-gpt-handoff-2026-09-21`에서 문서만 수정했다.
- 실제 facade/native 경로, 화면별 list 경로, 선택 상태, picker 저장, pending batch 코드와 문서를 대조했다.
- package.json과 package-lock.json의 Expo/RN/React/Router/screens 버전을 대조했다.
- root/client/server에 `test` script가 없음을 확인했다.
- `git diff --check`를 수행했다.
- 새로 추가한 local Markdown 링크와 인수인계 문서의 명시적 source file 경로를 검사했다. 결과: 누락 없음.
- 변경 파일이 Markdown 문서뿐임을 검사했다.
- 추가 텍스트에 private-key/GitHub-token/OpenAI-key의 대표 패턴이 없는지 확인했다. 이는 전체 저장소/과거 commit의 보안 감사는 아니다.
- `.env`, 인증서, DB를 추가하지 않았다. 인수인계 문서에는 비밀값을 넣지 않았다.

## 수행하지 않은 확인

- iOS/Android 새 build/install/실행, UI 자동화, 실제 휴대폰 연결.
- SQLite 변경 또는 pending push/delta pull, 계정 전환, Google API 재검증.
- 최신 `expo-doctor` 실행이나 dependency upgrade.
- 웹 GPT가 GitHub 문서를 실제로 읽었는지, CoS가 로컬 Mac/기기를 제어하는지.

## 전달 경계

GitHub branch push 뒤 remote HEAD와 local HEAD를 대조한다. 최종 전달 메시지에 실제 commit을 기록한다. 문서 자체의 commit hash를 문서 안에 자기참조로 고정하지 않는다.

H0 산출물은 인수인계 문서, 구현 감사표, 결정 목록, 실행 가이드, 시작 프롬프트다. 앱 기능 완료나 다음 구현 Gate 승인을 의미하지 않는다.


## 2026-09-25 문서 후속

범위: D02-D06 freeze 및 Todo Screen V2 formal spec 작성.

- `docs/handoff/DECISIONS.md`에서 D02-D06을 F24-F28로 freeze했다.
- iOS/Android native interaction audit 문서를 추가하고 D04 platform-native 경계를 freeze했다.
- `.kiro/specs/todo-screen-v2/requirements.md`, `design.md`, `tasks.md`를 최신 freeze 기준으로 작성했다.
- 첫 production milestone은 iOS calendar-free selection + bulk move로 제한했다.
- TodoScreen selection, bulk delete/complete/favorite, Android todo/favorite native parity는 후속 milestone로 명시 분리했다.
- 이 문서 단계에서 앱 소스, SQLite, pending queue, build/install, device runtime은 변경/실행하지 않았다.
- formal spec은 사용자 검토 전 상태이며, 작성 자체가 implementation Gate 승인을 뜻하지 않는다.


## 2026-09-25 formal spec approval

- User explicitly approved the Todo Screen V2 formal spec and instructed continuation.
- Approved basis: D02-D06 = F24-F28, plus the formal `requirements.md`, `design.md`, and `tasks.md`.
- Approval authorizes moving to H2 environment/workspace verification; it does **not** authorize scope expansion beyond F28.
- No feature code, SQLite, pending queue, build/install, or device runtime was changed by recording this approval.

## 2026-09-25 H2 Windows workspace verification

- CoS Windows approved root contained no existing Todolog checkout, so a fresh `/dev/todolog` clone was created from `codex/web-gpt-handoff-2026-09-21`.
- Clone HEAD matched the approval-record remote commit and `git status --porcelain` was clean before this documentation update.
- Remote is `https://github.com/jwpgdx/todolog.git`.
- Host: Microsoft Windows 10 `10.0.19045.6466`, AMD64.
- Tool versions observed: Node `v24.14.1`, npm `11.12.1`, Git `2.53.0.windows.2`.
- Root, client, and server `package-lock.json` files are present. On 2026-09-26, `npm ci` completed for all three without tracked lockfile changes.
- This Windows environment is suitable for repository/document work, but it cannot satisfy the UIKit/Xcode/device portions of H2. iOS-capable Mac/Xcode and simulator/physical-device verification remain pending.
- No app source, SQLite, pending queue, dependency, build/install, or runtime mutation occurred in this partial H2 verification.

### Gate 2 preflight from Windows

- Read-only inspection found no current todo-specific native interaction harness. The surviving `/native-category-menu` harness is category-specific.
- The bounded iOS spike should therefore use a new test-only todo route that renders `NativeManagedList` directly with `variant="todo"` and system gesture mode, backed only by mock in-memory rows.
- Production `NativeTodoManagedList` currently forces `custom-lifted` and remains untouched during the spike.
- Current Swift explicitly suppresses a system context menu for reorderable todo rows and keeps `dragInteractionEnabled = false`; these are the exact native blockers the bounded spike must address under a system-mode todo guard.
- No feature/native source was edited in this Windows preflight.

## 2026-09-26 Windows F28 bulk-move stabilization

- Code commit: `d2d39ac8dcda96cadabfcaa3555d108d26b87ce5` (`fix: stabilize bulk todo move transaction`).
- Scope stayed within calendar-free selection/bulk-move stabilization. No Swift/UIKit, TodoScreen selection, bulk delete/complete/favorite, DB schema, or dependency-version changes were made.
- Added a dedicated bulk-move SQLite service/hook. It validates active target + exact selected set + origin scope, separates membership from screen-visible order, applies target-category no-op semantics, reads the latest target max order, writes moved rows, and enqueues existing `updateTodo` pending records in one `withExclusiveTransactionAsync` connection.
- Picker no longer calculates target order or uses todo React Query data as mutation authority. Both single and multi move require an explicit target-category row selection.
- Selection success/stale results are session-scoped. Success exits parent selection; stale removes only invalid IDs. Bottom-tab hiding is owner-scoped to avoid cross-screen cleanup races.
- AllTodos missing `styles.screen` was fixed; loading/empty early returns no longer hide selection chrome while selection mode is active.
- `node --check` passed for all changed/new JS files.
- Pure `selectionOrder` invariant smoke passed: reverse tap order is converted to visible order, and a non-visible selected ID is not assigned a fallback tap-order position.
- `git diff --check` passed.
- Android JS/Metro export smoke passed twice; final run bundled 2,306 modules and exported successfully to `C:\dev\_cos_tmp\todolog-android-bundle-smoke-final`.
- Two independent CoS read-only reviews passed the final dirty tree with no remaining concrete issue in the bounded data/lifecycle audit.
- Full `npx tsc --noEmit` is **not** a usable project gate in this checkout: it fails on pre-existing vendored sources under `client/docs/` (Expo SQLite, keyboard-controller/safe-area examples, missing their test/example dependencies) and existing native-module type-resolution issues. These errors were not introduced by this package.
- No actual app SQLite mutation, pending replay, Android device UI, iOS build/simulator, or iPhone interaction test was run for this package. Gate 8 database/device evidence remains required before runtime completion is claimed.
