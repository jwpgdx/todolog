# Design Document: Completion Write Unification (Always Pending + Sync-Aware Invalidation)

## Overview

본 문서는 `.kiro/specs/completion-write-unification/requirements.md`를 구현하기 위한 설계를 정의한다.

핵심 목표:

1. Completion write를 `todo/category`와 같은 local-first + pending 경로로 통일한다.
2. sync run 중 새 pending이 생겨도 후속 sync가 보장되도록 coordinator를 보강한다.
3. completion-only 변경이 day summary marker cache를 과도하게 비우지 않도록 invalidation을 분리한다.

## Current State (AS-IS)

### 1) `useToggleCompletion`은 하이브리드 write flow

- SQLite는 먼저 토글한다.
- 오프라인/서버 실패일 때만 pending enqueue 한다.
- 온라인이면 서버 `createCompletion/deleteCompletion`을 foreground에서 await 한다.
- local success 시 `invalidateDateSummary(date)`까지 호출한다.

즉, Completion만 `todo/category`보다 서버 타이밍 의존성이 더 크고,
day summary 스펙과도 맞지 않는 invalidation이 섞여 있다.

### 2) `syncAll()`은 in-flight skip 후 rerun 보장이 없다

- 현재 coordinator는 `isSyncingRef.current`가 true면 새 `syncAll()` 요청을 그냥 skip한다.
- 이 상태에서 completion pending이 새로 생기면, 다음 app-active / network-online / login trigger 전까지 queue에 남을 수 있다.

### 3) Post-sync invalidation이 completion-only 변경에도 너무 넓다

- 현재 sync는 push/pull 후 `hasDataChange`만 true면 `invalidateAllScreenCaches()`를 호출한다.
- 이 경로는:
  - React Query invalidate
  - todo-calendar clear
  - strip range cache clear
  - calendar day summary store clear + idle re-ensure
  를 한 번에 수행한다.
- 그러나 day summary 스펙은 completion이 marker 계산에 영향을 주지 않는다고 고정되어 있다.

### 4) Pending replay contract 자체는 이미 준비되어 있다

- Pending Push는 `createCompletion` / `deleteCompletion`을 명시 API로 라우팅한다.
- 서버 `createCompletion/deleteCompletion`은 idempotent create/delete semantics를 가진다.
- 즉, write unification의 핵심 부족분은 **UI write path + sync coordinator + invalidation policy** 쪽이다.

## Target State (TO-BE)

### 1) Canonical Completion Write Flow

대상 파일:

- `client/src/hooks/queries/useToggleCompletion.js`

새 공통 흐름:

1. `ensureDatabase()`
2. `todo.recurrence`를 기준으로 `completionDate`와 `completionKey` 계산
3. `toggleCompletion(todoId, completionDate, completionId)`로 SQLite 즉시 반영
4. 결과 state에 따라 pending enqueue
   - 완료됨 -> `createCompletion`
   - 완료 취소됨 -> `deleteCompletion`
5. 온라인이면 `syncAll()`을 background trigger (절대 await 하지 않음)
6. mutation은 local result를 즉시 반환
7. `onSuccess`는 completion-aware invalidation만 수행

### 2) Pending Payload / Identity Rules

- create pending:
  - `type: 'createCompletion'`
  - `entityId: completionKey`
  - `data: { _id, todoId, date, isRecurring }`
- delete pending:
  - `type: 'deleteCompletion'`
  - `entityId: completionKey`
  - `data: { todoId, date, isRecurring }`

이 설계는 sync spec의 explicit create/delete replay 규칙과 동일하다.

## Non-Goals in This Design

### Completion Pending Coalescing은 이번 범위에서 제외

이유:

1. 현재 `runPendingPush()`는 ready queue snapshot을 잡고 순차 처리한다.
2. 별도 in-flight reservation 없이 DB queue만 보고 coalescing하면,
   이미 현재 sync run에 실린 pending과 새 local toggle이 엇갈릴 수 있다.
3. correctness를 먼저 확보한 뒤, 나중에 dispatch/in-flight contract가 분명해지면 coalescing을 별도 스펙으로 다루는 편이 안전하다.

즉, 이번 스펙은 **always-pending correctness + sync rerun 보장 + invalidation 분리**까지만 책임진다.

## Sync Coordinator Design

대상 파일:

- `client/src/services/sync/index.js`

### Rerun Latch

추가 상태:

- `needsResyncRef`

동작:

1. `syncAll()` 요청이 들어왔을 때 이미 `isSyncingRef.current === true`이면:
   - `needsResyncRef.current = true`
   - 즉시 return
2. 현재 sync run의 `finally`에서:
   - `isSyncingRef.current = false`
   - `needsResyncRef.current === true`면 flag를 clear하고 즉시 한 번 더 `syncAll()` 실행

보장:

- 동시 중복 sync는 여전히 금지
- 하지만 run 도중 생긴 completion pending은 현재 run 종료 직후 1회 follow-up sync에서 처리 기회를 얻는다

## Entity-Aware Cache Invalidation Design

대상 파일:

- `client/src/services/query-aggregation/cache/cacheInvalidationService.js`
- `client/src/services/sync/index.js`
- `client/src/hooks/queries/useToggleCompletion.js`

### 새 invalidation helper

추가 helper 예시:

- `invalidateCompletionDependentCaches({ queryClient, reason })`

역할:

1. React Query `['todos']` invalidate
2. todo-calendar invalidation (targeted invalidate 또는 full clear는 implementation-defined)
3. **금지**
   - `useCalendarDaySummaryStore.clear()`
   - `requestIdleReensure()`
   - `invalidateDateSummary(date)`
   - `useStripCalendarStore.clearRangeCache()`

원칙:

- completion은 list/item completed state에는 영향
- 하지만 day summary marker에는 영향 없음
- 따라서 marker 계산에 쓰이는 strip/week-flow summary store는 completion-only 경로에서 건드리지 않는다
- shared `rangeCache` invalidation은 허용되지만, 그것만으로 summary store reset/reensure가 발생하면 안 된다

### `syncAll()` 분기 기준

현재 `hasDataChange` boolean만으로는 completion-only 변경과 todo/category 변경을 구분할 수 없다.
따라서 sync stage 결과를 조금 더 구조화한다.

#### `runPendingPush()` 확장

- 반환값에 `appliedByKind`를 추가:
  - `todo`
  - `category`
  - `completion`

#### `runDeltaPull()` 확장

- 반환값에 category snapshot apply가 실제로 로컬을 바꿨는지 나타내는 값 추가:
  - 예: `categories: { changed, updated, deleted }`
- todo/completion은 기존 updated/deleted 카운트를 유지

#### `syncAll()` invalidation 규칙

1. local 또는 remote category/todo 변경이 하나라도 있으면:
   - 기존 broad invalidation (`invalidateAllScreenCaches`) 사용
2. category/todo 변경은 없고 completion 변경만 있으면:
   - `invalidateCompletionDependentCaches` 사용
3. 아무 변경도 없으면:
   - React Query 최소 invalidate만 수행

이 분기 덕분에 completion-only sync는 marker cache를 건드리지 않으면서도,
todo/category가 섞인 sync run은 기존 수렴 경로를 유지할 수 있다.

## Category Snapshot Change Detection

대상 파일:

- `client/src/services/sync/deltaPull.js`

필요 이유:

- completion-only invalidation을 안전하게 쓰려면,
  이번 sync run에 remote category change가 있었는지도 알아야 한다.
- category full pull이 로컬 SQLite를 실제로 바꿨는데도 이를 모르고 completion-only invalidation을 선택하면,
  marker/color recovery가 늦어질 수 있다.

설계 원칙:

1. category full snapshot apply는 최소한 `changed 여부`를 반환한다.
2. coarse 전략이어도 괜찮지만, “실제로 로컬이 바뀌었는지”는 구분해야 한다.
3. sync coordinator는 이 값을 broad/completion-only invalidation 분기에 사용한다.

## Validation Plan (Implementation Verification)

1. 비반복 todo completion on/off: local-first + recovery 확인
2. 반복 todo completion on/off: date-specific key로 recovery 확인
3. sync 실행 중 completion toggle: rerun latch로 후속 sync가 자동 실행되는지 확인
4. completion-only sync 성공 시 day summary store, strip summary store, shared range cache가 reset/reensure 되지 않는지 확인
5. category-only remote sync 또는 category+completion mixed sync에서 broad invalidation 분기가 선택되는지 확인
6. rapid toggle은 correctness 관점(최종 상태 일치)만 검증하고, queue compaction은 본 스펙 범위 밖으로 유지

## Risk Notes

1. Completion pending이 많아지면 queue 길이는 늘어날 수 있다.
   - 이번 스펙은 correctness를 우선하고, compaction은 후속 최적화로 분리한다.
2. category full snapshot changed detection은 너무 느슨하면 broad invalidation으로 기울고,
   너무 공격적이면 구현 복잡도가 올라간다.
   - 이번 스펙에서는 “completion-only invalidation을 안전하게 고를 수 있을 정도”의 최소 changed signal만 확보하면 된다.
