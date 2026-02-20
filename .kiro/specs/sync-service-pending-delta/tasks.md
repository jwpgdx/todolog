# Implementation Plan: Sync Service Pending Push -> Delta Pull

## Overview

This plan defines executable tasks for migrating the current pull-only sync flow to
`Pending Push -> Delta Pull` using `requirements.md` and `design.md`.

## Phase 0 Validation Status

Baseline validation date: 2026-02-18  
TO-BE re-validation date: 2026-02-19  
Status: ✅ READY (Section 2-1~2-4 PASS)

Evidence:
1. `PHASE0_VALIDATION_REPORT.md`
2. `PHASE0_VALIDATION_SUMMARY.md`
3. `phase0-validation-report.md`

TO-BE validated scope:
1. Category delete tombstone cascade (category -> todo -> completion)
2. Todo delete tombstone cascade (todo -> completion)
3. Completion delete tombstone + delta deleted visibility
4. Delete idempotency/404 policy (endpoint-explicit)

Result summary:
1. Blocking issues: 없음
2. Minimal fix targets: 없음
3. Phase 1 진행 가능

Requirement tag mapping:

- `R1` = Requirement 1
- `R2` = Requirement 2
- ...
- `R12` = Requirement 12

## Tasks

- [x] 1. Lock entity delete/push contract (blocking prerequisite, completed)
  - Finalize server/client contract for:
    - createCompletion payload (`todoId`, `date`, `isRecurring`, `_id`)
    - deleteCompletion payload (`todoId`, `date`, `isRecurring`)
    - endpoint-specific delete `404` handling policy
  - Patch/lock server behavior required for safe replay:
    - completion delete must use soft-delete/tombstone semantics (no hard delete)
    - completion create duplicate must return idempotent success-equivalent behavior
    - todo delete must cascade completion tombstone (no hard delete)
    - category delete must cascade category->todo->completion tombstone (no hard delete)
    - todo/category/completion delete replay policy must be explicit and idempotent
  - Explicitly ban toggle replay in pending push policy docs
  - _Requirements: R4, R5, R7_
  - Status: Completed (TO-BE re-validation PASS on 2026-02-19)

- [x] 2. Implement pending schema v5 migration
  - Increase DB migration version in `client/src/services/db/database.js`
  - Add `pending_changes` columns:
    - `retry_count`, `last_error`, `next_retry_at`, `status`
  - Document reset-safe migration verification flow
  - _Requirements: R3, R6, R11_

- [x] 3. Extend pendingService state APIs
  - Add APIs in `client/src/services/db/pendingService.js`:
    - `markPendingRetry`
    - `markPendingDeadLetter`
    - `updatePendingError`
    - `getPendingReady(now)` (filter by `next_retry_at`)
  - Keep backward compatibility with current read/remove functions
  - _Requirements: R2, R3, R6, R11_

- [x] 4. Add explicit completion API methods in client layer
  - Add to `client/src/api/todos.js` or split into `client/src/api/completions.js`:
    - `createCompletion`
    - `deleteCompletion`
  - Keep `toggleCompletion` for direct UI interaction only
  - _Requirements: R4, R5_

- [x] 5. Update completion pending payload contract
  - Update `client/src/hooks/queries/useToggleCompletion.js` pending enqueue payload:
    - create: `data: { _id, todoId, date, isRecurring }`
    - delete: `data: { todoId, date, isRecurring }` (`_id` optional)
  - Align `entityId` strategy with completion apply contract
  - _Requirements: R4, R5_

- [x] 6. Implement error policy and backoff module
  - Create `client/src/services/sync/syncErrorPolicy.js`
  - Implement classification for:
    - network/offline
    - 5xx
    - 4xx validation
    - 404 delete
  - Implement backoff function and max retry policy
  - _Requirements: R6, R7, R11_

- [x] 7. Implement Pending Push processor
  - Create `client/src/services/sync/pendingPush.js`
  - Implement:
    - FIFO iteration
    - type-based API routing
    - success deletion
    - failure classification + retry/dead-letter handling
    - stage metrics return payload
    - deferred processing for dependent operations when create pending exists first
    - transaction-batched pending deletions for successful items
  - Depends on: Task 1, Task 4, Task 5, Task 6
  - _Requirements: R2, R4, R6, R7, R11_

- [x] 8. Implement Delta Pull processor
  - Create `client/src/services/sync/deltaPull.js`
  - Execute category full pull + todo/completion delta pull
  - Apply local upsert/deletion and return stage metrics + `serverSyncTime`
  - Normalize deleted payload shape across entities before apply
  - _Requirements: R8, R9, R11_

- [x] 9. Refactor Sync Coordinator stage order
  - Update `client/src/services/sync/index.js` `syncAll` flow to:
    - `ensureDatabase`
    - `pendingPush`
    - `deltaPull`
    - `cursorCommit`
    - `cacheRefresh`
  - Preserve existing run-guard/debounce/triggers
  - Document and keep the push-failure-aborts-pull policy (unless separately changed)
  - _Requirements: R1, R2, R8, R10_

- [x] 10. Implement cursor storage and commit rules
  - Define metadata key (`sync.last_success_at`)
  - Commit only on full-stage success (push + pull + apply)
  - Verify cursor stays unchanged on partial failure
  - _Requirements: R8, R11_

- [x] 11. Consolidate cache consistency path
  - Standardize post-sync refresh order:
    - React Query (`todos`, `categories`)
    - todo-calendar store
    - strip-calendar summary invalidation
  - Scope invalidation to changed entities/ranges where feasible to avoid invalidation storms
  - Avoid over-clearing cache on failed sync
  - _Requirements: R10_

- [x] 12. Build replay validation scenarios
  - Offline enqueue -> online replay for todo/category/completion
  - Mixed create/update/delete replay scenarios
  - Recurring vs non-recurring completion replay scenarios
  - _Requirements: R12_

- [x] 13. Build partial-failure and restart-recovery tests
  - Push interrupted and resumed
  - Pull failed with unchanged cursor and resumed
  - App restart during queue backlog
  - _Requirements: R6, R8, R12_

- [x] 14. Run performance and operations checks
  - Compare duration and network cost against full-sync-only path
  - Collect pending throughput/failure/dead-letter metrics
  - Validate queue behavior on large pending volume (batch size, run time cap, retry pressure)
  - Trim excessive runtime logs for production-readiness
  - _Requirements: R11, R12_

- [x] 15. Sync spec and project documentation updates
  - Verify consistency across `requirements.md`, `design.md`, and `tasks.md`
  - Update `PROJECT_CONTEXT.md` and `ROADMAP.md` when implementation is completed
  - _Requirements: R12_

## Phase Checkpoints

- [x] A. Pending Push MVP complete
  - Todo/category replay works end-to-end
  - Completion contract locked and basic replay validated
  - Queue drains without unexpected dead-letter growth

- [x] B. Delta Pull + Cursor complete
  - Todo/completion delta paths enabled
  - Cursor commit rule validated
  - No data loss under partial failures

- [x] C. Operational hardening complete
  - Dead-letter and retry visibility available
  - Cross-screen data consistency verified
  - Performance targets met

## Out of Scope

1. strip-calendar UI/gesture changes
2. recurrence display policy changes
3. new server-side category delta API implementation (follow-up)
