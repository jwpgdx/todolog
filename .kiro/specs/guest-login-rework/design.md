# Design Document: Guest Login Rework (Local-Only Guest + All-to-Inbox Migration)

## Overview

이 설계는 guest 시작을 **serverless local-only bootstrap** 으로 바꾸고,
인증 진입을 My Page로 밀어내며,
기존/신규 계정 인증 시점에만 guest SQLite 데이터를 서버로 **move** 하는 구조를 정의한다.

핵심 목표:

1. 앱 첫 실행에서 네트워크/서버 의존 제거
2. guest 상태의 SQLite-only 오프라인 퍼스트 유지
3. 로그인/회원가입 시점의 migration을 **모든 guest todo -> 대상 Inbox** 규칙으로 단순화

## Architecture Summary

### Before

- startup -> Welcome
- `loginAsGuest()` -> `/auth/guest`
- guest user + token 저장
- guest migration은 별도 스펙에서 “single migrated category” 또는 category-preserving 해석 여지가 남아 있음

### After

- startup -> Todo route
- `loadAuth()` 또는 bootstrap path가 local guest를 생성
- local guest는 `token = null`
- sync는 계속 스킵
- 로그인/회원가입은 My Page에서만 시작
- 가져오기 선택 시에만 `migrateGuestData` 경로 진입
- guest todo는 전부 대상 계정 Inbox로 들어가고 guest category 구조는 서버에 재생성되지 않음

## Data Contracts

### Local Guest User Shape

```json
{
  "_id": "guest_local",
  "id": "guest_local",
  "accountType": "anonymous",
  "provider": "local",
  "name": "Guest User",
  "email": null,
  "settings": {
    "timeZone": "Asia/Seoul"
  }
}
```

Rules:

1. `_id` / `id`는 모두 `guest_local`
2. `token`, `refreshToken`은 저장하지 않음
3. `isLoggedIn`은 항상 `false`

## Client Flow

### 1. App Startup

Touchpoints:

- `client/app/index.js`
- `client/app/_layout.js`
- `client/src/store/authStore.js`

Flow:

1. 앱 시작 시 기본 route는 Todo tab으로 간다.
2. `loadAuth()`가 regular user 세션을 못 찾으면 local guest를 bootstrap 한다.
3. bootstrap은 SQLite 초기화와 독립적으로 성공해야 한다.

### 2. Guest Bootstrap

Touchpoints:

- `client/src/store/authStore.js`
- `client/src/screens/WelcomeScreen.js` (legacy entry 유지 시)

Rules:

1. `loginAsGuest()`는 더 이상 `/auth/guest`를 호출하지 않는다.
2. local guest user object를 AsyncStorage에 저장한다.
3. `token`, `refreshToken`은 제거한다.
4. 기존 guest 세션이 이미 있으면 재생성하지 않고 그대로 복원한다.
5. bootstrap 시 local guest Inbox를 ensure 한다.
6. guest data detection은 seeded Inbox-only 상태를 “empty guest”로 취급한다.

### 3. Sync Boundary

Touchpoints:

- `client/src/services/sync/index.js`

Rules:

1. guest는 `isLoggedIn = false`를 유지하므로 sync 서비스는 현재 가드 로직 그대로 스킵한다.
2. guest CRUD는 SQLite + pending local state만 사용하고, pending은 서버 replay 대상으로 취급하지 않는다.

## Auth Entry UX

### My Page Entry

Touchpoints:

- `client/src/screens/MyPageScreen.js`
- guest banner / CTA

Rules:

1. 로그인/회원가입 CTA는 My Page guest banner에서 노출한다.
2. startup path에서 인증 화면을 먼저 띄우지 않는다.
3. CTA 진입만으로 `logout()` 또는 guest SQLite clear를 먼저 수행하지 않는다.

### Existing Login

Touchpoints:

- `client/src/screens/LoginScreen.js`
- `client/src/store/authStore.js`

Flow:

1. 사용자가 로그인 submit
2. `checkGuestData()`로 SQLite guest 데이터 존재 여부 확인
3. seeded Inbox만 있는 상태면 “데이터 없음”으로 간주하고 normal login
4. 데이터가 있으면 `가져오기 / 버리기 / 취소` ActionSheet
5. ActionSheet는 “가져오면 guest 일정은 대상 계정 Inbox로 들어가며 카테고리 구조는 유지되지 않음”을 명시한다.
6. `취소` -> 로그인 중단
7. `버리기` -> `discardGuestData()` 후 normal login
8. `가져오기` -> `migrateGuestData(credentials)` 실행

### New Signup

Touchpoints:

- `client/src/screens/ConvertGuestScreen.js`
- `client/src/store/authStore.js`
- `client/src/api/auth.js`

Flow:

1. 사용자가 회원가입 submit
2. `checkGuestData()`로 SQLite guest 데이터 확인
3. seeded Inbox만 있는 상태면 “데이터 없음”으로 간주하고 normal register
4. 데이터가 있으면 `가져오기 / 버리기 / 취소` ActionSheet
5. ActionSheet는 “가져오면 guest 일정은 새 계정 Inbox로 들어가며 카테고리 구조는 유지되지 않음”을 명시한다.
6. `취소` -> 회원가입 중단
7. `버리기` -> `discardGuestData()` 후 normal register
8. `가져오기` -> `register` 성공 후 `migrateGuestData(email,password)` 실행

Failure boundary:

1. `register` 실패 -> guest local data와 guest session 유지
2. `register` 성공 + `migrateGuestData` 실패 -> guest local data와 guest session 유지, regular account는 남음, 이후 login flow에서 재시도 가능
3. signup `가져오기` 경로에서는 migration 성공 전까지 regular session/token을 현재 활성 세션으로 commit 하지 않는다

## Guest Migration Mapping Contract

### Source Data

Source is local SQLite guest data:

- active todos
- active completions
- active categories (local detection / cleanup 용도)

Rules:

1. guest categories는 local guest 데이터의 일부로 감지/삭제 대상에는 포함된다.
2. guest categories는 서버 마이그레이션 시 materialize 대상은 아니다.

### Target Mapping

Rules:

1. target account Inbox는 `systemKey='inbox'`로 resolve 한다.
2. 모든 imported guest todo는 원래 categoryId와 무관하게 target Inbox category id를 사용한다.
3. guest categories는 target account에 새로 생성하지 않는다.
4. imported completions는 imported todo ids를 계속 참조한다.
5. imported todo/completion `_id`는 현재 local UUID 계약을 그대로 유지한다.
6. 이 phase는 regular-user account의 active Inbox 존재를 정상 auth 플로우 invariant로 가정한다.

### Move Semantics

Rules:

1. 서버 insert/merge 성공 전에는 local guest SQLite를 비우지 않는다.
2. 성공 후에만 local guest SQLite를 clear 한다.
3. 실패 시 guest local session과 SQLite 데이터는 그대로 유지한다.

## Server Touchpoints

### Paths that remain primary

- `POST /auth/login`
- `POST /auth/register`
- `POST /auth/migrate-guest-data`

### Paths removed from product flow

- `POST /auth/guest`
- `POST /auth/convert-guest`

Rule:

1. 이 두 endpoint는 compatibility 차원에서 남아 있을 수 있지만, primary client flow는 사용하지 않는다.

### Migration Contract Update

Touchpoint:

- `server/src/controllers/authController.js#migrateGuestData`

Required design change:

1. 기존 “single migrated category” 전략을 폐기한다.
2. category-preserving mapping 전략도 사용하지 않는다.
3. target regular user의 active Inbox를 resolve 한 뒤, 모든 imported guest todo의 `categoryId`를 그 Inbox id로 설정한다.
4. guest migration은 raw local todo object가 아니라 canonical migration DTO를 사용한다.
5. guest category payload는 server materialization 대상으로 사용하지 않는다.
6. completion import는 기존 local `_id` preservation 계약과 todo link를 유지한다.

## Affected Files

Client:

- `client/app/index.js`
- `client/app/_layout.js`
- `client/src/store/authStore.js`
- `client/src/screens/WelcomeScreen.js`
- `client/src/screens/LoginScreen.js`
- `client/src/screens/ConvertGuestScreen.js`
- `client/src/screens/MyPageScreen.js`

Server:

- `server/src/controllers/authController.js`

Related specs needing alignment:

- `.kiro/specs/guest-data-migration/requirements.md`
- `.kiro/specs/guest-data-migration/design.md`
- `.kiro/specs/guest-data-migration/tasks.md`

## Risks

### R1. Startup route regression

- Todo route가 auth/boot ordering과 엮여 white screen이나 auth flicker를 만들 수 있음

### R2. Guest session overwrite

- `loadAuth()`가 local guest를 매번 새로 만들면 settings/local state continuity가 깨질 수 있음

### R3. Signup partial-success recovery

- register success 후 migration fail 시, 계정은 생성됐지만 guest local data는 남아 있는 상태를 명시적으로 다뤄야 함

### R4. Spec conflict with guest-data-migration

- 기존 guest-data-migration 스펙이 “single migrated category” 또는 category recreation으로 남아 있으면 현재 결정과 충돌함

## Validation Plan

1. server down / airplane mode first launch -> local guest로 Todo route 진입
2. first launch 시 local guest Inbox seed 확인
3. seeded Inbox만 있는 상태 -> login/signup에서 choice UI 미표시
4. app restart -> `guest_local` 세션 유지
5. guest 상태 CRUD 후 재실행 -> SQLite 데이터 유지
6. 기존 로그인 + `취소`
7. 기존 로그인 + `버리기`
8. 기존 로그인 + `가져오기`
9. 신규 가입 + `취소`
10. 신규 가입 + `버리기`
11. 신규 가입 + `가져오기`
12. signup `가져오기`에서 migration 실패 시 guest session이 계속 active인지 확인
13. ActionSheet copy가 “Inbox 이관 / 카테고리 구조 미보존”을 명시하는지 확인
14. 모든 imported guest todo가 target Inbox로 들어가는지 확인
15. guest categories가 대상 계정에 recreated되지 않는지 확인
16. migration 실패 시 guest local data 유지 확인
