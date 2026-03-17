# Implementation Plan: Local Completion Tombstone

## Overview

본 계획은 `.kiro/specs/completion-local-tombstone/requirements.md`와
`.kiro/specs/completion-local-tombstone/design.md`를 구현 가능한 작업 단위로 분해한다.

원칙:

1. schema migration을 먼저 고정
2. read-path active filter를 write-path보다 먼저 안정화
3. restore 시 `_id` 보존 계약을 hook까지 연결
4. normal flow와 reset/debug hard delete를 분리

## Task List

- [x] 1. 스펙 Freeze
  - requirements/design/tasks 상호 일치 확인
  - 고정 결정(`effectiveCompletionId`, missing deleted row no-op, guest export active-only) 반영 확인

- [x] 2. DB schema migration 추가
  - `client/src/services/db/database.js`
  - `completions.deleted_at TEXT NULL` 추가
  - migration version 증가
  - reset-safe migration 확인
  - 필요 시 active partial index 추가

- [x] 3. Completion read path를 active-only로 정리
  - `client/src/services/db/completionService.js`
  - `client/src/services/query-aggregation/candidateQueryService.js`
  - `client/src/store/authStore.js`가 사용하는 guest migration export path 포함
  - user-facing read/query/stat helpers에 `deleted_at IS NULL` 반영

- [x] 4. Completion write helpers를 restore-aware tombstone model로 전환
  - `client/src/services/db/completionService.js`
  - `toggleCompletion`
  - `createCompletion`
  - `deleteCompletion`
  - `deleteCompletionByKey`
  - `deleteCompletionsByTodoId`
  - `deleteCompletionsByKeys`

- [x] 5. Hook / pending payload를 effectiveCompletionId 기준으로 연결
  - `client/src/hooks/queries/useToggleCompletion.js`
  - tombstoned row restore 시 기존 `_id`를 pending create payload에 사용

- [x] 6. Todo/Category local cascade를 completion tombstone으로 정렬
  - `client/src/services/db/todoService.js`
  - `client/src/services/db/categoryService.js`
  - normal delete path에서 completion hard delete 제거

- [x] 7. Delta Pull apply를 tombstone model에 맞게 조정
  - `client/src/services/db/completionService.js`
  - `client/src/services/sync/deltaPull.js`
  - updated => restore / deleted => tombstone existing row

- [x] 8. Guest migration completion identity contract 정렬
  - `client/src/services/db/completionService.js`
  - `client/src/store/authStore.js`
  - `server/src/controllers/authController.js`
  - active-only completion export 유지
  - 서버 import 시 exported `_id` 보존

- [x] 9. Hard delete boundary 정리
  - `clearAllCompletions`
  - `rollbackMigration`
  - `resetDatabase`
  - `clearAllData`
  - explicit debug/test reset helper

- [x] 10. Validation: migration / restore / cascade / recovery
  - unit 또는 기존 debug/E2E 기반 검증
  - 아래 Validation Scenarios 실행

- [x] 11. 문서 업데이트(구현 반영)
  - `PROJECT_CONTEXT.md`
  - 필요 시 `ROADMAP.md`
  - 관련 spec trace 업데이트

## Checkpoints

- [x] Checkpoint A: Schema + active read semantics
  - Tasks 2~3 완료
  - tombstoned completion이 user-facing read에서 보이지 않음

- [x] Checkpoint B: Restore-aware local write semantics
  - Tasks 4~5 완료
  - toggle restore가 기존 `_id`를 재사용하고 pending payload도 일치함

- [x] Checkpoint C: Cascade + sync alignment
  - Tasks 6~7 완료
  - todo/category local delete와 delta apply가 tombstone model로 수렴함

- [x] Checkpoint D: Recovery validation
  - Task 10 완료
  - migration 이후 completion offline-first / coalescing 회귀 없음

## Validation Scenarios (필수)

1. [x] 기존 DB에 active completion row가 있는 상태로 migration 실행
   - row 보존
   - `deleted_at IS NULL`

2. [x] 비반복 completion off
   - row가 삭제되지 않고 `deleted_at`만 채워짐

3. [x] 비반복 completion off -> on
   - 같은 key row가 복구됨
   - `_id`가 유지됨

4. [x] 반복 completion 다른 날짜 key 2개
   - 한 날짜 tombstone/restore가 다른 날짜 key에 영향 없음

5. [x] todo local delete
   - todo는 tombstone
   - related completion도 tombstone

6. [x] category local delete cascade
   - category/todo는 기존 tombstone
   - related completion은 hard delete가 아니라 tombstone

7. [x] server delta updated
   - tombstoned local completion이 restore되고 `deleted_at`가 비워짐

8. [x] server delta deleted
   - existing local completion row가 tombstone 처리됨
   - missing local row는 no-op이어도 실패하지 않음

9. [x] guest-data migration export
   - tombstoned completion row는 export되지 않음
   - 서버 이관 후 active completion으로 되살아나지 않음

10. [x] guest-data migration import identity
   - active completion `_id`가 서버 import 후에도 유지됨

11. [x] completion always-pending recovery 회귀 없음
   - on/off
   - restart backlog
   - rapid toggle

12. [x] completion coalescing 회귀 없음
   - same-key last-intent
   - recurring different dates
   - dead_letter coexist

## Requirements Traceability Matrix

- R1(Schema migration): Task 2
- R2(Active read semantics): Task 3
- R3(Local toggle/create/delete): Tasks 4, 5
- R4(Local cascade): Task 6
- R5(Sync apply semantics): Task 7
- R6(Hard delete boundary): Task 9
- R7(Guest migration identity): Task 8
- R8(Migration/recovery validation): Task 10
