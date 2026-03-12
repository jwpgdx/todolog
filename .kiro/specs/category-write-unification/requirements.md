# Requirements Document: Category Write Unification (Local-first + Pending)

## Introduction

현재 Category(카테고리) “쓰기(write)” 경로가 여러 갈래로 분기되어 있어 Offline-first 원칙(로컬 먼저, 네트워크는 백그라운드)을 깨거나, 화면마다 동작이 달라지는 문제가 있다.

본 스펙의 목표는 **Category write 경로를 1개로 통합**하여, iOS/Android/Web 공통으로 “즉시 로컬 반영 + Pending Push로 서버 동기화”가 일관되게 동작하도록 만드는 것이다.

관련 문서:

1. `AI_COMMON_RULES.md` (Offline-first, SQLite SOT, UUID v4, sync order)
2. `PROJECT_CONTEXT.md` (현재 구현/동작 SOT)
3. `.kiro/specs/sync-service-pending-delta/requirements.md` (Pending Push / Delta Pull 파이프라인)
4. `.kiro/specs/inbox-system-category/requirements.md` + `design.md` (Category 계약 및 Inbox 잠금 정책)
5. `.kiro/specs/login-data-sync-fix/requirements.md` (Query hook read-only 방향성)

## Decisions (고정 결정)

1. SQLite는 Category의 **로컬 Source of Truth**다.
2. Category write(create/update/delete/reorder)는 UI에서 **서버 응답을 기다리지 않는다.**
3. Category write는 항상:
   - (a) SQLite 즉시 반영
   - (b) `pending_changes`에 enqueue
   - (c) (온라인이면) SyncService를 **백그라운드로 트리거**
4. UI/컴포넌트에서 `api/categories`를 직접 호출하는 경로는 금지한다. (hook을 통해서만 write)
5. `useCategories`는 **read-only query hook**만 유지한다. (mutation export 제거)
6. Pending Push replay에서 `createCategory`가 **409(이미 존재)** 를 반환하면, 해당 pending은 **success-equivalent로 제거**하고 다음 단계(Delta Pull)로 진행한다.
7. Inbox(`systemKey='inbox'`) 잠금 정책은 현행 스펙을 유지한다. (create/update/delete/reorder에서 UI/서버 정책 준수)
8. Category delete는 서버 계약(tombstone cascade)과 사용자 기대에 맞추기 위해, 클라에서도 **로컬에서 즉시 cascade**로 반영한다. (Category -> Todo -> Completion)

## Glossary

- **Local-first**: 사용자 액션은 즉시 SQLite에 반영되고, 네트워크 동기화는 백그라운드에서 처리되는 방식.
- **Pending Change**: SQLite 테이블 `pending_changes`에 쌓이는 “서버 반영 대기” 작업 단위.
- **Pending Push**: pending queue를 FIFO로 서버에 적용하는 Sync 파이프라인 단계.
- **Write Unification**: Category write 경로가 “단일 hook 경로”로 합쳐지는 것.

## Requirements

### Requirement 1: Single Category Write Path

**User Story:** 개발자로서, 어떤 화면에서든 카테고리 생성/수정/삭제/정렬이 동일한 방식으로 동작하길 원한다.

#### Acceptance Criteria

1. THE system SHALL provide a single canonical set of Category write hooks (create/update/delete/reorder).
2. THE system SHALL migrate all existing UI paths to use the canonical hooks.
3. THE system SHALL forbid direct usage of `client/src/api/categories.js` from UI/components for write operations.
4. `client/src/hooks/queries/useCategories.js` SHALL remain read-only (query only).

### Requirement 2: Offline-first Non-Blocking Writes

**User Story:** 사용자로서, 네트워크가 불안정/오프라인이어도 카테고리 작업이 즉시 반영되길 원한다.

#### Acceptance Criteria

1. WHEN creating a category, THEN the category SHALL appear immediately after the action completes (SQLite write), without waiting for server.
2. WHEN updating a category, THEN changes SHALL reflect immediately (SQLite write), without waiting for server.
3. WHEN deleting a category, THEN the category SHALL disappear immediately (SQLite tombstone), without waiting for server.
4. WHEN reordering categories, THEN the new order SHALL reflect immediately (SQLite update), without waiting for server.
5. WHEN deleting a category, THEN related todos (and their completions) SHALL be removed from the UI immediately via local cascade (SQLite first), without waiting for server.

### Requirement 3: Pending Queue as the Only Server Apply Mechanism

**User Story:** 개발자로서, 모든 Category write가 동일한 방식으로 Pending Push에 의해 서버에 적용되길 원한다.

#### Acceptance Criteria

1. Category write hooks SHALL always enqueue a corresponding pending change:
   - create -> `createCategory`
   - update -> `updateCategory`
   - delete -> `deleteCategory`
   - reorder -> `updateCategory` with `{ order }`
2. Category write hooks SHALL NOT perform direct server writes in the foreground.
3. WHEN online, THEN the hooks MAY trigger sync in background, but SHALL NOT await it.

### Requirement 4: Deterministic Pending Replay for `createCategory` (409 Handling)

**User Story:** 개발자로서, 네트워크 타임아웃/재시도 상황에서도 pending queue가 안정적으로 진행되길 원한다.

#### Acceptance Criteria

1. IF `createCategory` replay returns HTTP 409 (Category already exists), THEN the system SHALL treat it as success-equivalent and remove the pending item.
2. The system SHALL proceed to Delta Pull after resolving pending replay outcomes (consistent with `Pending Push -> Delta Pull` pipeline).
3. This rule SHALL apply only to pending type `createCategory` and SHALL NOT change other 4xx handling rules unless explicitly specified.

### Requirement 5: Reorder Support Offline

**User Story:** 사용자로서, 카테고리 정렬 변경이 오프라인에서도 유지되길 원한다.

#### Acceptance Criteria

1. Reorder actions SHALL update SQLite `categories.order_index` immediately.
2. Reorder actions SHALL enqueue a pending update (`updateCategory` with `{ order }`).
3. The UI SHALL NOT revert order solely because the device is offline.

### Requirement 6: Validation Scenarios

**User Story:** 개발자로서, 통합 후 회귀/정합성을 빠르게 검증하고 싶다.

#### Acceptance Criteria

1. The spec SHALL define manual validation scenarios for:
   - create/update/delete/reorder in My Page Category screens
   - create category inside Todo form (Quick)
   - offline → online recovery (Pending Push replay)
2. The validation scenarios SHALL include at least one case that triggers `createCategory` retry/409 handling.

## Scope

### In Scope

1. Category write hooks 통합 및 UI 사용처 마이그레이션
2. Pending Push replay 안정화(특히 `createCategory` 409 success-equivalent)
3. Reorder offline 지원(로컬 반영 + pending enqueue)
4. Category delete 로컬 cascade 반영 (Category -> Todo -> Completion)
5. 관련 문서 업데이트(구현 반영 단계에서 `PROJECT_CONTEXT.md`)

### Out of Scope (본 스펙에서는 다루지 않음)

1. Server의 `createCategory` idempotent 응답 변경(409 대신 200/201) — 필요 시 후속 스펙
2. Pending queue coalescing(예: reorder 연속 변경 합치기)
