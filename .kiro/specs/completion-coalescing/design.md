# Design Document: Completion Coalescing (Pending Queue Last-Intent Compaction)

## Overview

본 문서는 `.kiro/specs/completion-coalescing/requirements.md`를 구현하기 위한 설계를 정의한다.

핵심 목표:

1. 같은 Completion Key에 대한 중복 replay를 줄인다.
2. 현재 sync coordinator / rerun latch correctness를 깨지 않는다.
3. todo/category pending ordering은 유지한다.

핵심 전략:

- **enqueue-time rewrite가 아니라 sync-start snapshot compaction**
- **pair cancel/no-op 추론이 아니라 last-intent wins**

이 전략은 현재 sync 구조와 가장 잘 맞는다.

## Current State (AS-IS)

### 1) Completion pending은 append-only다

- `useToggleCompletion`은 local SQLite write 뒤 항상 `addPendingChange()`를 호출한다.
- 같은 Completion Key라도 기존 pending을 검사/압축하지 않는다.
- 결과적으로 `create/delete/create...`가 순서대로 누적될 수 있다.

### 2) Pending Push는 ready queue를 그대로 replay한다

- `runPendingPush()`는 ready rows를 읽어 FIFO로 처리한다.
- 현재는 동일 Completion Key에 대한 중복 row를 줄이는 단계가 없다.
- queue 한도(`maxItems=200`)가 있으므로, 중복 completion pending이 recovery throughput을 잠식할 수 있다.
- 또한 `failed + future next_retry_at` row는 ready queue에서 빠지지만,
  현재 defer 로직은 여전히 전체 pending snapshot을 참고한다.

### 3) Completion server endpoints는 idempotent다

- `createCompletion`은 중복/복구를 success-equivalent로 처리할 수 있다.
- `deleteCompletion`은 missing/already-deleted를 success-equivalent로 처리할 수 있다.

이 특성 덕분에 Phase 1은 “최종 intent만 replay”해도 correctness를 유지하기 쉽다.

## Non-Goals in This Design

### 1) enqueue-time coalescing은 하지 않는다

이유:

1. 현재 sync는 ready snapshot 기반이며, 별도 in-flight reservation이 없다.
2. enqueue 시점에 기존 row를 rewrite/remove하면, 이미 현재 sync snapshot에 실린 row와 충돌할 수 있다.
3. sync-start snapshot compaction은 현재 run이 보게 될 전체 pending snapshot을 기준으로 안전하게 결정할 수 있다.

### 2) no-op elimination은 하지 않는다

예:

- 시작 상태가 complete인지 incomplete인지에 따라
  `delete -> create`를 no-op으로 볼지, `create` 유지로 볼지가 달라질 수 있다.

이번 Phase 1은 synced base-state를 추론하지 않고,
같은 key에 대해 **가장 마지막 action 1개만 남기는 것**에 집중한다.

## Target State (TO-BE)

### 1) Sync-Start Snapshot Compaction Point

대상 파일:

- `client/src/services/sync/pendingPush.js`

새 흐름:

1. sync run 시작 시 전체 pending snapshot을 읽는다.
2. 그 snapshot에서 non-dead_letter completion rows를 추출한다.
3. `compactCompletionPendingSnapshot(allPending)`으로 superseded completion row ids와 retained completion row ids를 계산한다.
4. compacted snapshot을 기준으로 ready rows를 다시 해석한다.
5. retained ready rows에서 `queue = compactedReadyRows.slice(0, maxItems)` 선택
6. superseded row ids는 SQLite queue에서 제거
7. 이후 기존 Pending Push replay 루프 실행

중요:

- `slice(0, maxItems)`보다 **먼저** compaction을 수행한다.
- 그래야 중복 completion row가 ready window를 낭비하지 않는다.
- supersession 판단은 ready subset이 아니라 전체 non-dead_letter completion snapshot을 기준으로 한다.

### 2) Coalescing Rule

대상 타입:

- `createCompletion`
- `deleteCompletion`

대상 키:

- `entityId = completionKey`

Rule:

1. sync run 시작 시점의 전체 non-dead_letter completion snapshot을 앞에서 뒤로 순회한다.
2. Completion pending이 아니면 무조건 유지 후보로 둔다.
3. Completion pending이면 같은 `entityId`의 이전 completion pending을 superseded로 마킹하고,
   현재 row를 latest row로 갱신한다.
4. 최종적으로 각 Completion Key당 마지막 row 1개만 retain한다.

예:

- `C1:create, C1:delete, C1:create` -> final retain: 마지막 `create`
- `C1:delete, C1:create` -> final retain: 마지막 `create`
- `C1:create, T1:update, C1:delete` -> retain set은 `T1:update`, 마지막 `C1:delete`

### 3) Order Preservation

단순히 map/group 후 재조립하면 전체 queue ordering이 꼬일 수 있다.
따라서 구현은 다음 원칙을 따른다.

1. 먼저 전체 snapshot에서 retain할 completion row id 집합을 계산한다.
2. 그 다음 원본 snapshot을 순서대로 다시 순회하면서:
   - superseded completion row는 제외한다.
   - 나머지 row는 compacted snapshot에 유지한다.
3. ready queue는 compacted snapshot에서 다시 계산한다.

이렇게 하면:

- non-completion rows의 상대 순서 유지
- retained completion rows의 상대 순서 유지
- 기존 defer 정책과의 충돌 최소화

## Pending Push Result Extension

`runPendingPush()` 결과에 아래 필드를 추가한다.

- `rawReady`
- `compactedReady`
- `supersededRemoved`
- `coalescedCompletionKeys`

목적:

1. 실제로 queue가 얼마나 줄었는지 관측
2. recovery 성능 개선 체감과 운영 로그를 연결

## SQLite Queue Cleanup Policy

대상 파일:

- `client/src/services/db/pendingService.js`
- `client/src/services/sync/pendingPush.js`

정책:

1. superseded completion row ids는 replay loop 전에 DB에서 제거할 수 있어야 한다.
2. 제거 대상은 **이번 compaction으로 superseded 판정된 non-dead_letter completion rows**다.
3. `dead_letter` row는 제거하지 않는다.
4. 제거 대상에는 미래 `next_retry_at` 때문에 아직 ready가 아닌 older `failed` completion row도 포함될 수 있다.
5. retained row는 replay 성공 시 기존 정책대로 제거한다.
6. 이 조기 retire는 generic pending queue contract의 예외가 아니라,
   **superseded non-dead_letter completion rows에만 허용되는 좁은 예외**로 취급한다.

이 정책으로:

- recovery 시작 시 queue가 즉시 정리되고
- 불필요한 재시도/재분류 비용이 줄어든다.

## Interaction with Existing Safety Rules

### 1) `shouldDeferByPriorCreate`

현재 Pending Push는 동일 entity의 이전 create가 아직 처리되지 않았으면 update/delete를 defer할 수 있다.

Completion coalescing 이후에는:

- superseded create가 제거될 수 있다.
- retained final action만 남는다.

Phase 1에서 이는 허용된다.
이유는 completion create/delete server endpoint가 idempotent이므로,
마지막 intent만 replay해도 final convergence가 가능하기 때문이다.

따라서 구현은 defer 체크가 **compacted snapshot만** 보도록 해야 한다.
즉, superseded completion create는 prior-create blocking 후보에서 제외된다.

즉, Completion은 “기존 create를 반드시 먼저 replay해야만 delete가 의미를 가지는” 타입으로 취급하지 않는다.

### 2) Rerun Latch

sync 실행 중 새 completion pending이 생기면:

- 그 row는 현재 ready snapshot에 포함되지 않을 수 있다.
- 하지만 `completion-write-unification`에서 추가한 rerun latch가 후속 sync를 보장한다.

따라서 coalescing은 **현재 snapshot 내부**만 다루고,
run 도중 뒤늦게 들어온 pending은 다음 run에 맡긴다.

## Validation Plan

### 1) Rapid Toggle / Same Key

- 비반복 todo에서 `on -> off -> on`
- recovery 시 서버 최종 상태가 `completed=true`
- replay API 호출이 마지막 intent 기준으로 줄어드는지 확인

### 2) Recurring / Different Dates

- 같은 todoId라도 날짜가 다르면 key가 다르다.
- `2026-03-13`, `2026-03-14` completion pending은 서로 합쳐지면 안 된다.

### 3) Failed Older Pending + Newer Intent

- 오래된 completion pending을 `failed` 상태로 둔 뒤
- 그 row의 `next_retry_at`은 미래 시각으로 둔다
- 같은 key에 대해 더 새로운 intent를 enqueue
- sync-start snapshot compaction 후 older failed row가 superseded 제거되는지 확인

### 4) Mixed Queue Integrity

- todo/category/completion pending이 섞인 queue에서
- completion row만 compaction되고
- non-completion row ordering이 유지되는지 확인

### 5) Sync-In-Flight Regression

- sync run이 active인 동안 새로운 completion pending enqueue
- 현재 run 종료 후 rerun latch가 follow-up sync를 실행
- coalescing이 이 동작을 깨지 않는지 확인

### 6) Backlog Window Crossing

- raw ready queue가 200개를 넘는 상태를 만든다
- 최신 completion intent가 raw FIFO 기준으로는 `maxItems=200` 밖에 위치하도록 만든다
- sync-start snapshot compaction 후 retained latest intent가 현재 run replay 대상에 포함되는지 확인한다

### 7) Restart After Cleanup Before Replay

- superseded completion rows를 cleanup한 직후 앱/프로세스를 재시작한다
- retained final intent만 남아 recovery가 계속 가능한지 확인한다

## Risk Notes

1. Phase 1은 sync-start snapshot compaction이므로, 오프라인 상태에서 DB 상 pending row 개수는
   sync가 시작되기 전까지 그대로 늘어날 수 있다.
   - 하지만 recovery throughput과 network replay 효율은 개선된다.
2. base-state-aware no-op 제거까지 같이 하려 하면 설계가 급격히 복잡해진다.
   - 이번 범위에서는 제외한다.
3. enqueue-time coalescing은 미래 후속 최적화로 남길 수 있다.
   - 필요 시 in-flight reservation 또는 sync epoch 계약이 먼저 필요하다.
4. Phase 1은 completion key 기준 최종 상태 수렴을 보장한다.
   - 최신 client-generated completion UUID가 서버에 그대로 남는 것까지는 보장하지 않는다.
