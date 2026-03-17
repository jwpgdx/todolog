# Requirements Document: Local Completion Tombstone

## Introduction

현재 로컬 SQLite `completions`는 삭제 시 row를 `DELETE`한다.
반면 서버 Completion 계약은 `deletedAt` soft delete를 사용한다.

즉, 현재 completion은:

- 로컬: hard delete
- 서버: tombstone

이 비대칭은 지금도 기능 correctness를 깨지는 않는다.
하지만 아래 비용이 계속 남는다.

- 로컬/서버 삭제 모델 설명 비용 증가
- toggle restore 시 기존 row 복구 대신 새 row 생성/교체 reasoning 증가
- todo/category cascade delete의 completion 처리 모델 불일치
- delta / replay / restore 추론 복잡도 증가

이번 스펙의 목적은 **로컬 SQLite completion 삭제 모델을 tombstone으로 정렬**하는 것이다.

핵심 전제:

1. 이번 범위는 **local SQLite completion model** 정리다.
2. 서버 API contract은 바꾸지 않는다.
3. pending type / coalescing contract은 유지한다.
4. correctness가 최우선이다.

관련 문서:

1. `AI_COMMON_RULES.md`
2. `PROJECT_CONTEXT.md`
3. `.kiro/specs/sync-service-pending-delta/requirements.md`
4. `.kiro/specs/completion-write-unification/requirements.md`
5. `.kiro/specs/completion-coalescing/requirements.md`

## Decisions (고정 결정)

1. 로컬 SQLite `completions` 테이블에 `deleted_at TEXT NULL` 컬럼을 추가한다.
2. user-facing active completion 조회는 모두 `deleted_at IS NULL`만 활성 row로 간주한다.
3. 로컬 completion delete는 normal path에서 hard delete를 쓰지 않고 `deleted_at` tombstone으로 바꾼다.
4. 같은 completion key에 tombstoned row가 존재하면, local restore는 **기존 row를 복구**한다.
   - 가능하면 기존 `_id`를 유지한다.
5. completion pending contract은 유지한다.
   - `createCompletion`
   - `deleteCompletion`
   - toggle replay는 도입하지 않는다.
6. `completionKey = todoId + "_" + (date || "null")` 계약은 그대로 유지한다.
7. local todo/category delete cascade는 completion hard delete 대신 tombstone으로 맞춘다.
8. `clearAllCompletions` 같은 reset/debug 전용 path는 hard delete를 유지할 수 있다.
9. 이번 범위는 **deleted completion placeholder reconstruction**을 목표로 하지 않는다.
   - 서버 delta deleted payload에 `completedAt`가 없으므로, 로컬에 row가 없는 삭제 항목까지 새 tombstone row를 생성하는 것은 본 범위 밖이다.
10. 이번 범위는 `completed_at NULL 허용` 또는 서버 deleted payload 확장을 요구하지 않는다.
11. 게스트 completion migration은 active row만 export하며, export된 completion `_id`를 서버 import에서도 그대로 보존한다.

## Requirements

### Requirement 1: SQLite Schema Migration

**User Story:** 개발자로서, 로컬 completion도 tombstone을 저장할 수 있어야 한다.

#### Acceptance Criteria

1. THE system SHALL add `deleted_at TEXT NULL` to SQLite `completions`.
2. Existing completion rows SHALL be preserved during migration.
3. Existing active rows SHALL remain active after migration (`deleted_at IS NULL`).
4. The migration SHALL be versioned and reset-safe.
5. Existing `key` uniqueness SHALL remain unchanged.
6. The schema change SHALL NOT require server API contract changes.

### Requirement 2: Active Read Semantics

**User Story:** 사용자로서, 삭제된 completion이 완료 상태로 다시 보이지 않기를 원한다.

#### Acceptance Criteria

1. User-facing completion reads SHALL treat only rows with `deleted_at IS NULL` as active.
2. This rule SHALL apply to:
   - date reads
   - range reads
   - month reads
   - candidate query / aggregation completion reads
   - stats / existence checks used by UI logic
   - guest-data export/migration completion reads
3. Tombstoned completion rows SHALL NOT contribute to completed state, counts, or calendar completion markers.
4. Guest-data export/migration paths SHALL export only active completion rows.
5. IF a full/debug export path needs tombstoned rows, THEN it SHALL be separate from guest-data migration export.

### Requirement 3: Local Toggle / Create / Delete Semantics

**User Story:** 사용자로서, completion on/off가 로컬에서도 soft delete 모델로 일관되게 동작하길 원한다.

#### Acceptance Criteria

1. IF an active completion row exists for a key, THEN local delete/toggle-off SHALL set `deleted_at` instead of removing the row.
2. IF a tombstoned completion row exists for a key, THEN local toggle-on/create SHALL restore that row by clearing `deleted_at`.
3. Local restore SHALL preserve the existing completion `_id` when the key already exists in tombstoned state.
4. IF no row exists for a key, THEN local create/toggle-on SHALL insert a new row.
5. `useToggleCompletion` SHALL enqueue create payload using the effective restored/created completion `_id`.
6. Local create/delete semantics SHALL remain compatible with explicit pending replay (`createCompletion` / `deleteCompletion`).

### Requirement 4: Local Cascade Semantics

**User Story:** 개발자로서, todo/category local delete cascade도 completion tombstone 모델과 맞추고 싶다.

#### Acceptance Criteria

1. Local todo delete SHALL tombstone related completion rows instead of hard-deleting them.
2. Local category delete cascade SHALL tombstone related completion rows instead of hard-deleting them.
3. Existing todo/category tombstone behavior for parent rows SHALL remain unchanged.
4. Cascade tombstoning SHALL preserve completion keys for future reasoning and restore compatibility.

### Requirement 5: Sync Apply Semantics

**User Story:** 개발자로서, delta pull과 replay가 local tombstone model과 충돌하지 않기를 원한다.

#### Acceptance Criteria

1. Applying server completion `updated` rows SHALL upsert/restore local completion rows and clear `deleted_at`.
2. Applying server completion `deleted` rows SHALL tombstone the matching local row if it exists.
3. IF a matching local completion row does not exist for a server deleted item, THEN apply MAY no-op in this phase.
4. Local tombstone apply SHALL remain compatible with the existing server deleted payload shape (`_id`, `todoId`, `date`).
5. Completion pending replay contract SHALL remain unchanged.
6. Completion coalescing by `completionKey` SHALL remain valid after this migration.

### Requirement 6: Hard Delete Boundary

**User Story:** 개발자로서, normal business flow와 reset/debug hard delete를 구분하고 싶다.

#### Acceptance Criteria

1. User/business-flow delete paths SHALL NOT hard-delete completion rows.
2. The following helpers MAY remain hard delete by design:
   - `clearAllCompletions`
   - `rollbackMigration`
   - `resetDatabase`
   - `clearAllData`
   - explicit test-only reset helpers
3. Helpers outside the explicit exception list SHALL NOT hard-delete completion rows in normal business flow.

### Requirement 7: Guest Migration Identity Contract

**User Story:** 개발자로서, tombstoned completion이 guest migration 과정에서 active completion으로 되살아나지 않으면서도 active completion의 `_id` 계약은 유지되길 원한다.

#### Acceptance Criteria

1. Guest-data completion export SHALL include only active completion rows.
2. Exported active completion rows SHALL preserve their existing local `_id`.
3. The server guest migration import path SHALL preserve the exported completion `_id` when inserting completion documents.
4. This phase SHALL NOT regenerate guest completion IDs on the server during migration import.

### Requirement 8: Validation and Migration Safety

**User Story:** 개발자로서, migration 이후에도 completion/offline-first behavior가 깨지지 않기를 원한다.

#### Acceptance Criteria

1. Migration validation SHALL cover an existing DB with active completion rows.
2. Validation SHALL confirm:
   - non-recurring completion off -> tombstone
   - tombstoned row restore on next on
   - restored row reuses existing `_id` when applicable
   - recurring completion keys remain date-scoped
   - todo/category local cascade uses completion tombstone
   - delta updated clears `deleted_at`
   - delta deleted tombstones existing local row
   - guest-data export/migration excludes tombstoned completion rows
   - guest-data migration preserves active completion `_id` through server import
3. Recovery / replay validation SHALL confirm completion write-unification and completion-coalescing behavior remain correct after tombstone migration.

## Out of Scope

1. 서버 Completion API contract 변경
2. completion pending coalescing rule 변경
3. enqueue-time queue compaction
4. deleted completion placeholder를 위한 서버 deleted payload 확장
5. `completed_at` nullable 스키마 전환
6. todo/category tombstone 모델 자체 재설계
