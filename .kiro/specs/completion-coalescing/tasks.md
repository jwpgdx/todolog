# Implementation Plan: Completion Coalescing (Sync-Start Snapshot Last-Intent Compaction)

## Overview

본 계획은 `.kiro/specs/completion-coalescing/requirements.md`와
`.kiro/specs/completion-coalescing/design.md`를 구현 가능한 작업 단위로 분해한다.

원칙:

1. correctness 우선
2. sync-start snapshot compaction만 다룸
3. todo/category queue 계약 불변
4. tombstone/schema 변경은 제외

## Task List

- [x] 1. 스펙 Freeze
  - requirements/design/tasks 상호 일치 확인
  - must-decide(last-intent wins, replay-time only) 합의

- [x] 2. Pending Push: completion queue compaction helper 추가
  - `client/src/services/sync/pendingPush.js`
  - 전체 non-dead_letter snapshot에서 completion superseded row를 계산하는 helper 추가
  - `slice(maxItems)` 이전에 compaction 적용
  - older `failed + future next_retry_at` completion row도 superseded 대상에 포함

- [x] 3. Pending Push: 순서 보존 + queue 선택 로직 반영
  - retain id 집합 계산 후 원본 snapshot을 필터
  - compacted snapshot에서 ready rows를 재계산
  - non-completion row ordering 유지
  - retained completion row ordering 유지
  - defer 체크가 compacted snapshot 기준으로 동작하도록 설계 반영

- [x] 4. Pending Service: superseded pending cleanup 경로 추가/재사용
  - `client/src/services/db/pendingService.js`
  - superseded non-dead_letter row ids 제거 API 점검
  - replay run 시작 시 superseded ids 제거
  - cleanup 직후 재시작해도 retained final intent가 남는지 검증 가능 상태 유지

- [x] 5. Pending Push result / logging 확장
  - `rawReady`
  - `compactedReady`
  - `supersededRemoved`
  - `coalescedCompletionKeys`

- [x] 6. Validation: completion coalescing 시나리오 추가
  - `client/e2e/completion-recovery.real.spec.js` 확장 또는 신규 spec
  - rapid toggle same key
  - recurring different dates
  - failed older pending superseded
  - mixed queue ordering
  - sync-in-flight regression
  - raw 200 cutoff beyond latest intent
  - restart after cleanup before retained replay

- [x] 7. 문서 업데이트(구현 반영)
  - `PROJECT_CONTEXT.md`
  - 필요 시 `README.md` / `ROADMAP.md`

## Checkpoints

- [x] Checkpoint A: Compaction correctness
  - Tasks 2~4 완료
  - 같은 Completion Key의 non-dead_letter snapshot이 마지막 intent 1개로 축약됨

- [x] Checkpoint B: Observability
  - Task 5 완료
  - 로그/결과에서 compaction 효과 확인 가능

- [x] Checkpoint C: Recovery validation
  - Tasks 6~7 완료
  - same-key rapid toggle / mixed queue / rerun latch 회귀 없음

## Validation Scenarios (필수)

1. [x] 비반복 completion `on -> off -> on`
   - recovery 후 서버 최종 상태가 `completed=true`
   - replay가 최종 intent 기준으로 압축됨

2. [x] 비반복 completion `on -> off`
   - recovery 후 서버 최종 상태가 `completed=false`
   - 중간 `create` replay가 제거됨

3. [x] 반복 completion (같은 todo, 다른 날짜 2개)
   - 날짜별 key가 분리되어 서로 coalescing되지 않음

4. [x] 오래된 `failed` completion pending + 새로운 같은 key intent
   - older row는 미래 `next_retry_at`여도 superseded 제거됨
   - defer 체크가 stale prior create를 보지 않음

5. [x] todo/category/completion mixed queue
   - non-completion ordering 유지
   - completion row만 compaction 적용

6. [x] sync 진행 중 새로운 completion enqueue
   - 현재 run + 후속 rerun latch 동작이 유지됨

7. [x] `dead_letter` completion row 존재 상태
   - dead_letter는 그대로 남고, 신규 ready completion row만 정상 replay 대상이 됨

8. [x] raw ready queue 200 초과
   - 최신 retained intent가 원래 FIFO 200 밖에 있어도 compaction 후 현재 run에 포함됨

9. [x] superseded cleanup 직후 앱 재시작
   - retained final intent만 남고 recovery가 계속 가능함

## Requirements Traceability Matrix

- R1(Completion-only scope): Tasks 2, 3
- R2(Last-intent semantics): Tasks 2, 6
- R3(Safe compaction timing): Tasks 2, 6
- R4(Order preservation): Tasks 3, 6
- R5(Superseded cleanup): Tasks 4, 6
- R6(Observability): Task 5
- R7(Validation): Task 6

## Out of Scope

1. enqueue-time completion coalescing
2. base-state-aware no-op elimination
3. local completion tombstone migration
4. todo/category queue compaction
5. server API contract 변경
