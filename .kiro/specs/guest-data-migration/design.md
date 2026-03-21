# Design Document: Guest Data Migration (All Guest Todos -> Target Inbox)

## Overview

이 설계는 local-only guest 데이터 이관을
**모든 guest todo -> 대상 계정 Inbox** 규칙으로 단순화한다.

핵심 원칙:

1. guest 카테고리 구조는 보존하지 않는다.
2. 서버는 대상 계정의 active Inbox를 resolve 한 뒤, 모든 guest todo를 그 Inbox에 넣는다.
3. guest completion은 imported todo ids와 함께 보존한다.
4. migration은 move semantics를 따른다. 성공 전에는 guest local SQLite를 비우지 않는다.

## End-to-End Flow

### Existing Login

1. guest 사용자가 My Page에서 기존 계정 로그인을 시도한다.
2. client가 guest local SQLite 데이터 존재 여부를 확인한다.
3. 데이터가 있으면 `가져오기 / 버리기 / 취소` 를 보여준다.
4. `가져오기` 선택 시, client가 guest active todos/completions를 수집한다.
5. client가 `POST /auth/migrate-guest-data` 경로로 migration을 수행한다.
6. server는 target account Inbox를 resolve 하고, 모든 guest todo를 Inbox로 import 한다.
7. 성공 후 client는 guest local SQLite를 clear 하고 signed-in session 기준 full sync를 수행한다.

### New Signup

1. guest 사용자가 My Page에서 회원가입을 시도한다.
2. client가 guest local SQLite 데이터 존재 여부를 확인한다.
3. 데이터가 있으면 `가져오기 / 버리기 / 취소` 를 보여준다.
4. `가져오기` 선택 시, client는 먼저 `register`를 수행한다.
5. `register` 성공 후 client는 `POST /auth/migrate-guest-data` 를 수행한다.
6. migration 성공 후 client는 guest local SQLite를 clear 하고 signed-in full sync를 수행한다.
7. `register` 성공 + migration 실패면 guest local SQLite와 guest session은 남기고, 이후 로그인 경로에서 재시도 가능해야 한다.
8. signup `가져오기` 경로에서는 migration 성공 전까지 register 응답의 regular session을 현재 활성 세션으로 commit 하지 않는다.

## Data Contracts

### Migration Request

```typescript
interface MigrateGuestDataRequest {
  email: string;
  password: string;
  guestData: {
    todos: Array<{
      _id: string;
      title: string;
      startDate: string;
      endDate: string | null;
      recurrence: string[] | null;
      recurrenceEndDate: string | null;
      isAllDay: boolean;
      startTime: string | null;
      endTime: string | null;
      memo: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
    completions: Array<{
      _id: string;
      key: string;
      todoId: string;
      date: string | null;
      completedAt: string;
    }>;
  };
}
```

Rules:

1. `todos` 와 `completions` 가 migration의 실제 materialized payload다.
2. `todos` 는 raw `getAllTodos()` 결과를 그대로 보내지 않고, canonical migration DTO로 변환한다.
3. canonical todo DTO는 legacy `date` 를 제거하고 `startDate`, `endDate`, `startTime`, `endTime`, `recurrence`, `recurrenceEndDate` 를 명시한다.
4. `completions` 는 `_id`, `key`, `todoId`, `date`, `completedAt` 기준 DTO를 사용한다.
5. `categories` 는 migration payload에서 제외한다. category 정보는 client-side detection/cleanup 용도로만 사용한다.
6. tombstoned local rows는 payload에서 제외한다.
7. seeded guest Inbox-only 상태는 migration payload 수집/choice UI 트리거 대상이 아니다.

### Migration Response

```typescript
interface MigrateGuestDataResponse {
  success: boolean;
  message: string;
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    accountType: string;
    provider: string;
    hasCalendarAccess: boolean;
    settings: object;
  };
  targetInboxCategoryId: string;
  stats: {
    todosInserted: number;
    completionsInserted: number;
  };
}
```

## Server Design

### Primary Touchpoint

- `server/src/controllers/authController.js#migrateGuestData`

### Migration Steps

1. authenticate target regular user from provided credentials
2. resolve the target user’s active Inbox by `systemKey='inbox'`
3. start MongoDB transaction
4. validate canonical guest todo DTO fields (`startDate`, `endDate`, `startTime`, `endTime`, `recurrence`, `recurrenceEndDate`) and reject legacy `date` payloads
5. insert all guest todos with:
   - `userId = targetRegularUserId`
   - `categoryId = targetInboxCategoryId`
   - existing client `_id` preserved
6. insert all guest completions with:
   - `userId = targetRegularUserId`
   - `todoId` referencing imported todo ids
   - existing client `_id` preserved
7. do **not** create any migrated category
8. do **not** recreate guest categories
9. commit transaction and return token/user/targetInboxCategoryId/stats

Invariant:

1. this phase assumes target regular-user accounts created through normal auth flows already have an active Inbox

### Integrity Checks

The server should verify:

1. every imported todo belongs to the target user
2. every imported todo points to the resolved Inbox
3. no guest category rows were created on the target account
4. every imported completion points to an imported todo id

## Client Design

### Primary Touchpoints

- `client/src/store/authStore.js`
- `client/src/api/auth.js`
- `client/src/screens/LoginScreen.js`
- `client/src/screens/ConvertGuestScreen.js`

### Client Responsibilities

1. detect guest local data before login/signup continuation
2. display `가져오기 / 버리기 / 취소`
3. disclose that imported guest todos go to Inbox and guest categories are not preserved
4. convert active guest todos into the canonical migration DTO before request dispatch
5. gather active guest completions into the canonical completion DTO
6. call `migrateGuestData`
7. clear guest local SQLite only after success
8. persist authenticated session and trigger full sync
9. treat seeded guest Inbox-only state as empty guest and skip migration/discard choice UI
10. in signup `가져오기`, defer regular-session commit until migration success

### Local Clear Boundary

On success, client must clear:

- guest todos
- guest categories
- guest completions
- guest pending changes

On failure, client must keep:

- guest session
- guest SQLite rows
- guest retry path

## Contract Changes vs Old Design

The previous design is explicitly replaced in the following ways:

1. “single migrated category” 전략을 제거한다.
2. guest category 구조 보존/재생성 전략을 제거한다.
3. `migratedCategoryId` 응답은 `targetInboxCategoryId` 로 대체한다.
4. imported todo의 최종 `categoryId` 는 항상 target Inbox id 이다.

## Risks

### R1. UX surprise if copy text is vague

- “가져오기”가 category preservation으로 오해되면 제품 계약과 다르게 느껴질 수 있음

### R2. Completion / todo id linkage

- imported todo ids와 completion.todoId 관계를 끊으면 imported completion이 orphan이 될 수 있음

### R3. Partial-success signup path

- register success 후 migration fail 상태를 로그인 재시도 가능 상태로 남겨야 함

## Validation Plan

1. seeded guest Inbox-only state -> choice UI 미표시
2. existing login + `가져오기`
3. existing login + `버리기`
4. existing login + `취소`
5. signup + `가져오기`
6. signup + `버리기`
7. signup + `취소`
8. signup `가져오기`에서 migration 실패 시 guest session이 계속 active인지 확인
9. migration request가 canonical todo DTO를 사용하고 legacy `date` 를 보내지 않는지 확인
10. 가져오기 UI copy가 Inbox 이관 / category 미보존을 명시하는지 확인
11. 모든 imported guest todo가 target Inbox로 들어가는지 확인
12. guest categories가 대상 계정에 recreated되지 않는지 확인
13. imported completions가 imported todo ids를 유지하는지 확인
14. migration 실패 시 guest local SQLite가 유지되는지 확인
