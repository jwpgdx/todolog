# Design Document: Local Completion Tombstone

## Overview

이 설계의 목적은 로컬 SQLite `completions`를 hard delete 모델에서 tombstone 모델로 전환하는 것이다.

TO-BE 핵심:

- active row: `deleted_at IS NULL`
- deleted row: `deleted_at IS NOT NULL`
- restore: 같은 key의 tombstoned row를 되살림
- normal flow delete: `DELETE` 금지
- reset/debug path만 hard delete 허용

이번 설계는 아래 기존 계약과 양립해야 한다.

1. `completion-write-unification`
   - local-first
   - always-pending
   - background sync
2. `completion-coalescing`
   - `completionKey` 기준 last-intent compaction
3. `sync-service-pending-delta`
   - explicit `createCompletion` / `deleteCompletion`
   - delete visibility는 tombstone-compatible

## Current State

### 1. SQLite schema

- `completions`에는 `deleted_at`이 없다.
- row shape:
  - `_id`
  - `key`
  - `todo_id`
  - `date`
  - `completed_at`

### 2. Read path

- completion read SQL은 tombstone 개념 없이 `SELECT * FROM completions ...`를 사용한다.
- `candidateQueryService`도 completion active filter가 없다.

### 3. Write path

- `toggleCompletion`, `deleteCompletion`, `deleteCompletionByKey`, `deleteCompletionsByTodoId`, `deleteCompletionsByKeys`가 `DELETE`를 사용한다.
- `categoryService.deleteCategoryCascade`도 completion을 hard delete한다.
- `todoService.deleteTodo/deleteTodos`는 현재 completion cascade tombstone을 하지 않는다.

### 4. Sync path

- server completion create/delete는 tombstone contract이다.
- delta deleted payload는 `_id`, `todoId`, `date`만 전달한다.
- 현재 client delta apply는 deleted completion을 hard delete로 반영한다.

## TO-BE Design

### 1. Schema

#### 1.1 Migration version

- `MIGRATION_VERSION`을 1 증가시킨다.
- 신규 migration: `migrateV8AddCompletionDeletedAt()` (번호는 구현 시 현재 최신 버전에 맞춘다)

#### 1.2 Column add

- `ALTER TABLE completions ADD COLUMN deleted_at TEXT`

#### 1.3 Index policy

- 기존 `key UNIQUE`는 유지한다.
- 기존 일반 인덱스는 유지 가능하다.
- 필요 시 active read 최적화를 위해 partial index를 추가한다:
  - `idx_completions_active_date ON completions(date) WHERE deleted_at IS NULL`
  - `idx_completions_active_todo ON completions(todo_id) WHERE deleted_at IS NULL`

### 2. Read-path contract

모든 user-facing active read는 `deleted_at IS NULL`을 기본 조건으로 사용한다.

대상:

1. `completionService`
   - `getCompletionsByDate`
   - `getCompletionsByMonth`
   - `getCompletionsByRange`
   - `getCompletionsByTodoId`
   - `hasCompletion`
   - `getCompletionStats`
   - UI용 count/read helpers
   - `getAllCompletionsArray` (게스트 마이그레이션 export path는 active-only)
2. `candidateQueryService`
   - date/range completion SQL
3. guest migration caller
   - `authStore.migrateGuestData`는 active-only export 결과만 서버로 보낸다

비대상:

- `clearAllCompletions`
- reset/debug 전체 삭제
- 필요 시 tombstoned rows까지 보고 싶은 debug-only full export

설계 규칙:

- `getAllCompletionsArray`는 guest migration 용 active-only export로 정의한다.
- tombstoned row까지 포함하는 full export가 필요하면 별도 debug helper로 분리한다.
- guest migration용 active export row는 local `_id`를 유지한다.
- `authController.migrateGuestData`는 exported completion `_id`를 그대로 insert payload에 포함한다.

### 3. Write-path contract

#### 3.1 `toggleCompletion(todoId, date, requestedId)`

lookup는 **key 기준 전체 row(active+tombstoned)** 를 본다.

동작:

1. active row exists
   - `deleted_at = now`
   - return `{ completed: false, effectiveCompletionId: existing._id }`
2. tombstoned row exists
   - `deleted_at = NULL`
   - `completed_at = now`
   - preserve `_id = existing._id`
   - return `{ completed: true, effectiveCompletionId: existing._id }`
3. no row exists
   - insert new row with `_id = requestedId`
   - `deleted_at = NULL`
   - return `{ completed: true, effectiveCompletionId: requestedId }`

#### 3.2 `createCompletion(todoId, date, completionId)`

explicit create helper도 같은 restore-aware semantics를 사용한다.

1. active row exists
   - no-op / normalize to active state
2. tombstoned row exists
   - restore existing row, preserve `_id`
3. no row exists
   - insert new row

이 helper는 local restore 시 existing `_id`를 유지하며,
호출자는 실제 사용된 `_id`를 받을 수 있어야 한다.

#### 3.3 delete helpers

다음 helper는 hard delete 대신 tombstone으로 전환한다.

1. `deleteCompletion(todoId, date)`
2. `deleteCompletionByKey(key)`
3. `deleteCompletionsByTodoId(todoId)`
4. `deleteCompletionsByKeys(keys)`

공통 규칙:

- matching row exists -> `deleted_at = now`
- row missing -> no-op

### 4. Local cascade alignment

#### 4.1 Todo delete

`todoService.deleteTodo` / `deleteTodos`는 todo tombstone과 같은 트랜잭션 또는 같은 apply unit 안에서 관련 completion row도 tombstone 처리한다.

이유:

- server contract과 정렬
- local reasoning 단순화
- category delete cascade와 대칭화

#### 4.2 Category delete

`categoryService.deleteCategoryCascade`의 completion 처리:

- BEFORE: `DELETE FROM completions ...`
- AFTER: `UPDATE completions SET deleted_at = now WHERE ...`

### 5. Sync apply semantics

#### 5.1 Delta updated

`upsertCompletions(completions)`는:

- matching key row가 있으면 restore/update
- `deleted_at = NULL`
- `completed_at = server.completedAt`
- `_id = server._id`

즉, tombstoned local row도 server updated로 다시 활성화될 수 있다.

#### 5.2 Delta deleted

deleted payload는 현재 `_id`, `todoId`, `date`만 가진다.

적용 규칙:

1. key 계산
2. local row exists -> `deleted_at = now`
3. local row missing -> no-op

이 phase는 **missing deleted row placeholder 생성**을 하지 않는다.
이유:

- payload에 `completedAt`가 없음
- 현재 schema에서 placeholder reconstruction은 scope를 넓힌다

### 6. Pending / replay compatibility

아래 계약은 유지한다.

1. pending type:
   - `createCompletion`
   - `deleteCompletion`
2. coalescing:
   - `completionKey` 기준
   - sync-start snapshot compaction
3. rerun latch / background sync:
   - unchanged

write hook 관점에서 필요한 변경:

- `useToggleCompletion`은 SQLite helper가 반환한 `effectiveCompletionId`를 pending create payload에 사용한다.

### 7. Guest migration identity contract

게스트 completion migration의 end-to-end contract:

1. `getAllCompletionsArray`
   - active-only export
   - `_id`, `key`, `todoId`, `date`, `completedAt` 유지
2. `authStore.migrateGuestData`
   - exported active completion rows를 그대로 서버 payload에 포함
3. `authController.migrateGuestData`
   - completion insert payload 생성 시 exported `_id`를 보존
   - 이 phase에서는 guest completion `_id` 재생성을 허용하지 않음

이 규칙은 tombstoned completion의 active-state resurrection을 막는 것과 별개로,
active completion identity contract도 end-to-end로 유지하기 위한 것이다.

### 8. Hard-delete boundary

hard delete 유지 대상:

1. `clearAllCompletions`
2. `rollbackMigration`
3. `resetDatabase`
4. `clearAllData`
5. explicit test-only reset helpers

user/business-flow path에서는 hard delete를 허용하지 않는다.

보충 메모:

- `rollbackMigration`, `resetDatabase`, `clearAllData`는 out-of-band reset/recovery helper로 취급한다.
- 이 예외 목록 밖의 helper/path는 business flow 여부와 관계없이 normal completion delete semantics를 우회하면 안 된다.

## Risks and Guardrails

### R1. Read-path filter 누락

위험:

- tombstoned completion이 완료 상태로 다시 보일 수 있다.

대응:

- `completionService`와 `candidateQueryService`를 한 세트로 점검한다.

### R2. restore 시 `_id` drift

위험:

- tombstoned existing row가 있는데 새 `_id`로 덮어쓰면 local/server reasoning이 다시 복잡해진다.

대응:

- local restore는 기존 `_id` 보존을 기본 규칙으로 고정한다.
- hook은 `effectiveCompletionId`를 pending create payload로 사용한다.

### R3. todo/category cascade 누락

위험:

- 일부 경로는 tombstone, 일부 경로는 hard delete가 되어 모델 정리가 반쪽이 된다.

대응:

- `todoService.deleteTodo/deleteTodos`
- `categoryService.deleteCategoryCascade`
- completion delete helpers
를 같은 스펙 범위로 묶는다.

### R4. deleted payload placeholder overdesign

위험:

- 서버 payload 확장이나 `completed_at nullable` 변경까지 요구하면 범위가 과해진다.

대응:

- missing deleted row는 no-op 허용을 명시한다.

### R5. guest migration identity drift

위험:

- client export는 `_id`를 내보내지만 server import가 이를 버리면 completion model 계약과 충돌하거나 active completion identity가 바뀔 수 있다.

대응:

- guest migration export/import 모두 `_id` preservation을 명시한다.
- `authController.migrateGuestData`를 구현 touchpoint로 스펙 범위에 포함한다.

## Validation Plan

1. migration
   - 기존 active completion row 유지
   - 기존 read path 정상
2. local toggle
   - off => tombstone
   - on => restore
   - restore 시 `_id` 유지
3. recurring
   - 같은 todo, 다른 date key 분리 유지
4. cascade
   - todo delete -> completion tombstone
   - category delete -> completion tombstone
5. delta apply
   - updated -> restore/clear `deleted_at`
   - deleted -> tombstone existing row
6. guest migration
   - tombstoned completion은 export되지 않음
   - active completion은 서버 import 후에도 `_id`가 유지됨
7. recovery
   - completion write-unification / coalescing 회귀 없음
