# Implementation Plan: Completion Write Unification (Always Pending + Sync-Aware Invalidation)

## Overview

본 계획은 `.kiro/specs/completion-write-unification/requirements.md`와
`.kiro/specs/completion-write-unification/design.md`를 구현 가능한 작업 단위로 분해한다.

원칙:

1. SQLite SOT 유지
2. Completion write는 foreground에서 서버 응답을 기다리지 않음
3. day summary marker 계약을 깨지 않음
4. correctness를 우선하고 pending compaction은 이번 범위에 넣지 않음

## Task List

- [ ] 1. 스펙 Freeze
  - requirements/design/tasks 상호 일치 확인
  - must-decide(특히 coalescing 비범위, rerun latch 범위) 합의

- [ ] 2. Sync: stage 결과를 entity-aware invalidation 가능 형태로 확장
  - `client/src/services/sync/pendingPush.js`
    - `appliedByKind` 또는 동등한 change summary 추가
  - `client/src/services/sync/deltaPull.js`
    - category full snapshot apply 결과에 `changed` signal 추가
  - 목적: sync coordinator가 completion-only sync를 구분할 수 있게 함

- [ ] 3. Sync Coordinator: rerun latch 추가
  - `client/src/services/sync/index.js`
  - `needsResyncRef` 추가
  - sync 실행 중 들어온 새 `syncAll()` 요청을 run 종료 직후 1회 재실행

- [ ] 4. Cache: completion-aware invalidation helper 추가
  - `client/src/services/query-aggregation/cache/cacheInvalidationService.js`
  - broad invalidation과 completion-only invalidation을 분리
  - completion-only 경로에서 day summary store clear / idle re-ensure 금지

- [ ] 5. Client: `useToggleCompletion`을 always-pending으로 전환
  - `client/src/hooks/queries/useToggleCompletion.js`
  - 온라인 direct API await 제거
  - SQLite write -> pending enqueue -> background sync trigger
  - local success 시 completion-aware invalidation 사용
  - `invalidateDateSummary(date)` 호출 제거

- [ ] 6. Sync: post-sync invalidation 분기 적용
  - `client/src/services/sync/index.js`
  - local 또는 remote todo/category 변경 포함 run -> broad invalidation
  - completion-only run -> completion-aware invalidation
  - no-change run -> 최소 invalidate만 유지

- [ ] 7. Validation: recovery / race 시나리오 보강
  - `client/e2e/completion-recovery.real.spec.js` 확장 또는 분리
  - 비반복 on/off
  - 반복 on/off
  - sync 실행 중 toggle
  - app restart with pending backlog
  - rapid toggle 최종 상태 검증

- [ ] 8. 문서 업데이트(구현 반영)
  - `PROJECT_CONTEXT.md`
  - 필요 시 sync / calendar 관련 스펙 링크 보정

## Checkpoints

- [ ] Checkpoint A: Sync coordinator safety 확보
  - Tasks 2~3 완료
  - sync 중 추가 pending이 후속 run으로 이어짐

- [ ] Checkpoint B: Completion write 통일 완료
  - Tasks 4~6 완료
  - completion local write와 post-sync invalidation이 day summary 규칙을 지킴

- [ ] Checkpoint C: Recovery 검증 완료
  - Task 7 완료
  - 반복/비반복/active-sync/restart 시나리오 PASS

## Validation Scenarios (필수)

1. (온라인) 비반복 todo completion on -> 즉시 반영 -> background sync -> 서버 수렴
2. (온라인) 비반복 todo completion off -> 즉시 반영 -> background sync -> 서버 수렴
3. (오프라인) 비반복 completion on/off -> 즉시 반영 -> 온라인 복귀 후 서버 수렴
4. (오프라인) 반복 todo completion on/off -> 날짜별 key 기준으로 서버 수렴
5. (sync 중) completion toggle -> 현재 sync 종료 후 후속 sync가 자동 실행되는지 확인
6. (completion-only sync) day summary marker store와 strip summary store가 clear/reset되지 않고, idle reensure도 발생하지 않는지 확인
7. (category-only remote sync 또는 category+completion mixed sync) broad invalidation 분기가 선택되는지 확인
8. (app restart) pending completion backlog가 재시작 후 replay되는지 확인
9. (rapid toggle) 최종 completed state가 로컬/서버에서 일치하는지 확인

## Requirements Traceability Matrix

- R1(Single write path): Tasks 5, 6
- R2(Non-blocking toggle): Task 5
- R3(Pending contract): Task 5, Task 7
- R4(Rerun guarantee): Tasks 2, 3, 7
- R5(Cache invalidation): Tasks 2, 4, 6
- R6(Validation): Task 7

## Out of Scope

1. Completion pending coalescing/compaction
2. 로컬 SQLite completion tombstone schema 변경
3. Completion server API contract 변경
