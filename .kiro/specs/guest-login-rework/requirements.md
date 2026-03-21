# Requirements Document: Guest Login Rework (Local-Only Guest + All-to-Inbox Migration)

## Introduction

본 문서는 게스트 진입을 **서버 비의존 local-only 세션**으로 전환하고,
앱 기본 진입을 `TodoScreen`으로 바꾸며,
로그인/회원가입 시점에만 guest 데이터를 계정으로 **이관(move)** 하는 요구사항을 정의한다.

핵심 제품 결정은 다음 두 가지다.

1. guest는 서버와 연동하지 않는 local-only 세션이다.
2. guest 데이터를 가져오면 **모든 guest todo는 대상 계정 Inbox로 들어가고**, guest 카테고리 구조는 보존하지 않는다.

관련 문서:

1. `AI_COMMON_RULES.md`
2. `PROJECT_CONTEXT.md`
3. `.kiro/specs/guest-data-migration/requirements.md`
4. `.kiro/specs/inbox-system-category/requirements.md`

## Decisions (고정 결정)

1. 앱 첫 진입 기본 화면은 `Welcome`이 아니라 `TodoScreen`이다.
2. 게스트는 **serverless local-only** 세션이다.
3. local guest user 식별자는 `_id = 'guest_local'` 고정값을 사용한다.
4. local guest는 `token = null`, `refreshToken = null`, `isLoggedIn = false` 이다.
5. 게스트는 sync 대상이 아니다.
6. 로그인/회원가입은 `My Page`에서 사용자가 명시적으로 시작할 때만 진입한다.
7. guest 데이터 이관 UX는 **가져오기 / 버리기 / 취소** 3가지 선택을 제공한다.
8. guest 데이터 이관의 의미는 **이동(move)** 이다.
   - 구현은 `copy -> success 확인 -> local clear`여도,
   - 사용자 계약은 “guest 쪽에 남지 않는다”로 본다.
9. guest에서 가져오는 모든 todo는 대상 계정의 `Inbox(systemKey='inbox')` 로 이관한다.
10. guest 카테고리 구조는 대상 계정에 재생성하지 않는다.
11. 신규 회원가입의 가져오기 경로는 **`register -> migrateGuestData` 2-step orchestration** 으로 간다.
12. `/auth/guest`, `/auth/convert-guest`는 product primary path에서 제거한다. 호환성 정리는 별도 단계에서 결정한다.
13. guest local-only bootstrap은 SQLite에 active Inbox를 항상 보장한다.
14. seeded guest Inbox만 존재하는 상태는 “가져올 guest 데이터가 없는 상태”로 본다.
15. regular-user 계정은 정상 회원가입/로그인 플로우에서 active Inbox가 항상 존재하는 것을 전제로 한다.
16. 신규 회원가입의 `가져오기` 경로에서는 migration 성공 전까지 guest session이 현재 세션으로 유지된다.

## Requirements

### Requirement 1: Local-Only Guest Bootstrap

**User Story:** 사용자로서, 서버 없이도 앱을 바로 사용할 수 있길 원한다.

#### Acceptance Criteria

1. WHEN the app starts with no authenticated regular-user session THEN the client SHALL bootstrap a local-only guest session without calling `/auth/guest`.
2. THE local guest session SHALL use `_id = 'guest_local'`, `accountType = 'anonymous'`, `provider = 'local'`.
3. THE local guest session SHALL NOT require `token` or `refreshToken`.
4. THE local guest session SHALL persist across app restart via AsyncStorage.
5. THE local guest bootstrap SHALL ensure an active local Inbox exists in SQLite.
6. A seeded guest Inbox by itself SHALL NOT count as guest data that requires migration/discard choice UI.

### Requirement 2: Default Entry Route

**User Story:** 사용자로서, 앱 실행 직후 바로 일정 화면을 보고 싶다.

#### Acceptance Criteria

1. WHEN the app launches THEN the default route SHALL resolve to the home Todo route, not Welcome.
2. Welcome/legacy auth entry MAY remain as a reachable route for manual/debug use, but SHALL NOT be the primary startup route.

### Requirement 3: Guest Sync Policy

**User Story:** 개발자로서, guest 상태에서는 서버 sync가 돌지 않게 하고 싶다.

#### Acceptance Criteria

1. THE system SHALL keep `isLoggedIn = false` for local guest sessions.
2. Sync service SHALL continue skipping all background sync work for guest sessions.
3. Guest CRUD SHALL remain fully local-first against SQLite only.

### Requirement 4: My Page Auth Entry

**User Story:** 사용자로서, 필요할 때만 My Page에서 로그인/회원가입을 시작하고 싶다.

#### Acceptance Criteria

1. THE app SHALL expose login and signup entry points from My Page guest UI.
2. Guest startup SHALL NOT require immediate authentication UI.
3. Guest banner and guest-specific CTA SHALL continue to render for `accountType = 'anonymous'`.
4. Entering login/signup from My Page SHALL NOT clear the guest session before the user explicitly completes auth or discard flow.

### Requirement 5: Existing Account Login with Guest Data Choice

**User Story:** 게스트 사용자로서, 기존 계정 로그인 전에 내 로컬 데이터를 가져올지 선택하고 싶다.

#### Acceptance Criteria

1. WHEN a guest user attempts existing-account login AND guest SQLite data exists THEN the client SHALL present `가져오기 / 버리기 / 취소`.
2. Guest SQLite data existence for this choice SHALL ignore the seeded guest Inbox when no real todo/completion or other non-Inbox user-created data exists.
3. THE choice UI SHALL disclose that imported guest todos will be moved into the target account Inbox and guest category structure will not be preserved.
4. WHEN the user selects `취소` THEN the login attempt SHALL abort and the guest session SHALL remain unchanged.
5. WHEN the user selects `버리기` THEN guest SQLite data SHALL be cleared before normal login proceeds.
6. WHEN the user selects `가져오기` THEN the client SHALL use the guest migration flow and only clear guest SQLite after migration success.

### Requirement 6: New Account Signup with Guest Data Choice

**User Story:** 게스트 사용자로서, 새 계정을 만들 때도 로컬 데이터를 유지한 채 가져올지 선택하고 싶다.

#### Acceptance Criteria

1. WHEN a guest user attempts signup AND guest SQLite data exists THEN the client SHALL present `가져오기 / 버리기 / 취소`.
2. Guest SQLite data existence for this choice SHALL ignore the seeded guest Inbox when no real todo/completion or other non-Inbox user-created data exists.
3. THE choice UI SHALL disclose that imported guest todos will be moved into the new account Inbox and guest category structure will not be preserved.
4. WHEN the user selects `취소` THEN the signup attempt SHALL abort and the guest session SHALL remain unchanged.
5. WHEN the user selects `버리기` THEN guest SQLite data SHALL be cleared before normal signup proceeds.
6. WHEN the user selects `가져오기` THEN the client SHALL execute `register -> migrateGuestData` in that order.
7. IF `register` succeeds but `migrateGuestData` fails THEN guest SQLite data SHALL remain intact, the guest session SHALL remain the active session, and the system SHALL allow retry via subsequent auth flow.
8. In the signup `가져오기` path, the newly registered regular-user token/session SHALL NOT replace the active guest session until migration success is confirmed.

### Requirement 7: All Guest Todos -> Target Inbox

**User Story:** 사용자로서, guest에서 쓰던 일정은 로그인 후 대상 계정 Inbox에서 바로 이어서 보고 싶다.

#### Acceptance Criteria

1. WHEN guest data migration runs THEN the target account SHALL resolve its active Inbox by `systemKey = 'inbox'`.
2. THE migration SHALL map every imported guest todo to the target account Inbox regardless of the guest todo’s original category.
3. THE migration SHALL NOT recreate guest categories on the target account.
4. Imported completions SHALL continue to refer to the imported todo ids under the new regular-user ownership.
5. In this phase, target regular-user Inbox existence is treated as an invariant guaranteed by normal register/login flows.

### Requirement 8: Migration Semantics = Move

**User Story:** 사용자로서, 데이터를 가져오면 guest 쪽에는 남지 않고 계정 쪽으로 완전히 넘어가길 원한다.

#### Acceptance Criteria

1. THE product contract SHALL define guest migration as move semantics.
2. THE implementation MAY internally copy data first, but guest local data SHALL only be cleared after confirmed server success.
3. IF migration fails THEN guest local data SHALL remain intact and usable.

### Requirement 9: Compatibility Boundary

**User Story:** 개발자로서, 새 local-only guest 모델과 기존 guest server endpoints의 경계를 명확히 하고 싶다.

#### Acceptance Criteria

1. `/auth/guest` SHALL NOT be used by the primary client guest-start path.
2. `/auth/convert-guest` SHALL NOT be used by the primary signup path.
3. Compatibility retention or deprecation of those endpoints MAY be handled later, but the client product flow SHALL no longer depend on them.

### Requirement 10: Validation

**User Story:** 개발자로서, guest local-only 전환 후 오프라인 퍼스트와 migration 계약이 실제로 지켜지는지 검증하고 싶다.

#### Acceptance Criteria

1. The validation matrix SHALL include offline first launch with server unavailable.
2. The validation matrix SHALL include guest app restart and session restore.
3. The validation matrix SHALL include guest local Inbox seed on first launch.
4. The validation matrix SHALL include empty guest state where seeded Inbox alone does not trigger `가져오기 / 버리기 / 취소`.
5. The validation matrix SHALL include existing-account login with `가져오기 / 버리기 / 취소`.
6. The validation matrix SHALL include new-account signup with `가져오기 / 버리기 / 취소`.
7. The validation matrix SHALL include the copy/ActionSheet disclosure that imported guest todos land in Inbox and guest categories are not preserved.
8. The validation matrix SHALL include verification that all imported guest todos land in the target account Inbox.
9. The validation matrix SHALL include verification that guest categories are not recreated on the target account.
10. The validation matrix SHALL include migration failure preserving guest local data and keeping guest session active after signup partial failure.

## Scope

### In Scope

1. Local-only guest bootstrap
2. App default entry route change to TodoScreen
3. My Page auth entry policy
4. Existing login / new signup guest-data choice UX
5. All guest todos -> target Inbox migration rule
6. Product-flow removal of `/auth/guest` and `/auth/convert-guest`

### Out of Scope

1. Server endpoint cleanup/deletion policy for deprecated guest APIs
2. One-step `register-with-guest-data` API
3. Social signup/login special-case guest migration UX
4. Non-auth test/debug route cleanup
