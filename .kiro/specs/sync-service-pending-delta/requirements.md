# Requirements Document: Sync Service Pending Push -> Delta Pull

## Introduction

This document defines the requirements for hardening the offline-first sync pipeline.
The current system can enqueue pending changes, but it does not reliably flush them before pull sync,
and it still relies heavily on full pull behavior.

Primary goals:

1. Formalize a `Pending Push -> Delta Pull` pipeline.
2. Lock entity delete/cascade contracts and completion sync idempotency.
3. Introduce a retry/backoff/state model for operational reliability.

## Validation Status (Phase 0)

Baseline validation date: 2026-02-18  
TO-BE re-validation date: 2026-02-19  
Current status: ✅ READY (Phase 0 Section 2 PASS)

Status summary:
1. Baseline validation (2026-02-18) remains as reference evidence.
2. TO-BE contract re-validation (2026-02-19, Section 2-1~2-4) passed.
3. Current contract is locked for Phase 1 implementation.

Baseline artifacts:
1. `PHASE0_VALIDATION_REPORT.md`
2. `PHASE0_VALIDATION_SUMMARY.md`

TO-BE re-validation artifacts:
1. `phase0-validation-report.md`
2. `PHASE0_VALIDATION_REPORT.md` (updated with TO-BE result)
3. `PHASE0_VALIDATION_SUMMARY.md` (updated with TO-BE result)

## Implementation Status (Phase 1-3)

Update date: 2026-02-20  
Current status: ✅ COMPLETED (Task 1-15 done)

Summary:
1. Sync coordinator is running `Pending Push -> Delta Pull -> Cursor Commit -> Cache Refresh`.
2. Pending queue v5 (`retry_count`, `last_error`, `next_retry_at`, `status`) is applied.
3. Replay routing, retry/backoff/dead-letter policy, and cursor commit rule are implemented.
4. Replay/recovery/performance/operations checks are recorded in `.kiro/specs/sync-service-pending-delta/log.md`.

## Glossary

- **Pending Push**: The stage that sends local `pending_changes` to the server.
- **Delta Pull**: The stage that fetches only server-side changes since the last sync cursor.
- **Sync Cursor**: The last successfully committed sync timestamp (`lastSyncTime`).
- **Dead Letter**: Pending items excluded from automatic retries after repeated failures.
- **Poison Pending**: A repeatedly failing item that can block queue progress.
- **Idempotency**: Replaying the same request does not change the final state.

## Requirements

### Requirement 1: Non-blocking Sync Trigger

**User Story:** As a user, I want sync to run in the background without slowing the app.

#### Acceptance Criteria

1. The system SHALL trigger sync on app active, network online, and login events.
2. The sync trigger SHALL NOT block initial screen rendering.
3. The system SHALL prevent concurrent duplicate sync execution.

### Requirement 2: Mandatory Pending Push Stage

**User Story:** As a user, I want offline changes to be pushed when I reconnect.

#### Acceptance Criteria

1. The sync pipeline SHALL execute Pending Push before Delta Pull.
2. The system SHALL process pending items in FIFO order.
3. The system SHALL delete pending items only after confirmed successful server apply.
4. The system SHALL keep failed pending items for retry.

### Requirement 3: Pending Queue State Model

**User Story:** As an engineer, I want retry/failure state to be explicit and queryable.

#### Acceptance Criteria

1. The pending schema SHALL include retry metadata (`retry_count`, `last_error`, `next_retry_at`, `status`).
2. The system SHALL support at least `pending`, `failed`, and `dead_letter` states.
3. The schema migration SHALL be versioned and reset-safe.

### Requirement 4: Pending Routing by Type

**User Story:** As an engineer, I want each pending type routed to the correct API.

#### Acceptance Criteria

1. The system SHALL route todo pending types (`createTodo`, `updateTodo`, `deleteTodo`) to todo APIs.
2. The system SHALL route category pending types (`createCategory`, `updateCategory`, `deleteCategory`) to category APIs.
3. The system SHALL route completion pending types (`createCompletion`, `deleteCompletion`) to explicit completion create/delete APIs.
4. The system SHALL NOT use toggle API during Pending Push replay.
5. Category delete replay SHALL follow a tombstone cascade contract:
   - category tombstone
   - related todo tombstone
   - related completion tombstone
6. Category delete replay SHALL NOT hard-delete related todos/completions.
7. Todo delete replay SHALL soft-delete the todo and SHALL cascade soft-delete to related completions.

### Requirement 5: Completion Push Contract Hardening

**User Story:** As an engineer, I want completion replay to be safe under retries.

#### Acceptance Criteria

1. Completion pending payload SHALL include `_id`, `todoId`, `date`, and `isRecurring` for create replay.
2. Completion pending key strategy SHALL be compatible with server apply semantics (not UUID-only entity mapping).
3. Completion create/delete replay SHALL be idempotent.
4. Already-applied completion create/delete outcomes SHALL be handled by policy (success-equivalent or terminal non-retry).
5. Completion delete replay SHALL preserve delta visibility of deletions (soft-delete/tombstone-compatible behavior).
6. Completion rows affected by todo/category cascade deletes SHALL be soft-deleted (tombstone), not hard-deleted.

### Requirement 6: Retry and Backoff Policy

**User Story:** As an operator, I want transient failures retried and permanent failures isolated.

#### Acceptance Criteria

1. The system SHALL apply backoff scheduling for retryable failures.
2. The system SHALL classify non-retryable failures and move them to `dead_letter`.
3. The system SHALL enforce a max retry threshold per pending item.
4. The system SHALL preserve queue progress in the presence of poison pending items.

### Requirement 7: Error Classification Policy

**User Story:** As an engineer, I want deterministic queue behavior by error class.

#### Acceptance Criteria

1. The system SHALL classify at least network, 5xx, 4xx validation, and not-found delete outcomes.
2. Not-found delete handling SHALL be explicitly defined per endpoint, and idempotent delete replay SHALL default to success-equivalent handling.
3. Classification results SHALL be persisted for diagnostics and retry decisions.

### Requirement 8: Delta Pull with Cursor Commit Rule

**User Story:** As a user, I want efficient sync without missing updates.

#### Acceptance Criteria

1. The system SHALL support delta pull for todos and completions using a sync cursor.
2. The system SHALL apply server upserts and deletions to local SQLite.
3. The sync cursor SHALL be committed only when both push and pull succeed.
4. On partial failure, the sync cursor SHALL remain unchanged.
5. The delta pull implementation SHALL normalize per-entity deleted payload shapes before local apply.

### Requirement 9: Category Sync Strategy

**User Story:** As an engineer, I want category sync to remain safe before category delta exists.

#### Acceptance Criteria

1. The system SHALL keep category full pull as the initial strategy.
2. The design SHALL allow future category delta adoption without breaking the pipeline.

### Requirement 10: Cache Consistency after Sync

**User Story:** As a user, I want todo/todo-calendar/strip-calendar to converge to the same state.

#### Acceptance Criteria

1. The system SHALL invalidate or refresh query caches after successful sync stages.
2. Calendar-related caches SHALL be refreshed in a deterministic order.
3. The three screens SHALL converge to the same final state after sync completion.

### Requirement 11: Observability and Diagnostics

**User Story:** As an engineer, I want to trace sync stage outcomes and failure causes.

#### Acceptance Criteria

1. The system SHALL log per-stage results (push/pull/cache).
2. The system SHALL expose summary counters (`processed`, `succeeded`, `failed`, `dead_letter`).
3. Diagnostic data SHALL include pending failure reason and retry metadata.

### Requirement 12: Validation and Rollout Safety

**User Story:** As an engineer, I want safe rollout with reproducible validation.

#### Acceptance Criteria

1. The validation plan SHALL include offline->online replay for todo/category/completion.
2. The validation plan SHALL include partial failure and app-restart recovery scenarios.
3. The validation plan SHALL include performance comparison against full-sync-only behavior.

## Scope

### In Scope

1. Sync pipeline restructuring (`Pending Push -> Delta Pull`).
2. Pending schema extension and retry policy.
3. Completion push contract hardening.
4. Cursor commit policy and cache consistency handling.

### Out of Scope

1. UI/gesture/layout changes.
2. Recurrence display policy changes.
3. New server-side category delta API implementation (follow-up).
