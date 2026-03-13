# Requirements Document: Completion Coalescing (Pending Queue Last-Intent Compaction)

## Introduction

`completion-write-unification`으로 Completion toggle은 이미 `always-pending` 구조가 되었다.
이제 correctness는 확보되었지만, 같은 Completion Key에 대한 연속 토글이
`pending_changes`에 그대로 누적될 수 있다.

예:

- `createCompletion -> deleteCompletion -> createCompletion`
- `deleteCompletion -> createCompletion`

현재 구조에서도 최종 상태는 서버와 수렴한다.
하지만 replay 시 불필요한 네트워크 호출이 늘고, ready queue 한도(`maxItems`)를
중복 pending이 소모할 수 있다.

본 스펙의 목표는 Completion pending만 대상으로,
**최종 의도(last intent)** 기준으로 replay queue를 압축하는 것이다.

핵심 전제:

1. correctness가 최우선이다.
2. 이번 범위는 **queue compaction**이며, 로컬 SQLite completion tombstone 도입은 다루지 않는다.
3. 이번 범위는 **server base state를 추론해서 no-op 제거**하는 최적화가 아니라,
   같은 Completion Key에 대한 **중간 pending 제거**에 집중한다.

관련 문서:

1. `AI_COMMON_RULES.md`
2. `PROJECT_CONTEXT.md`
3. `.kiro/specs/completion-write-unification/requirements.md`
4. `.kiro/specs/completion-write-unification/design.md`
5. `.kiro/specs/sync-service-pending-delta/requirements.md`

## Decisions (고정 결정)

1. Completion coalescing은 **Completion pending만** 대상으로 한다.
2. Coalescing key는 현행과 동일하게 `completionKey = todoId + "_" + (date || "null")`를 사용한다.
3. Phase 1 coalescing rule은 **last-intent wins** 이다.
   - 같은 key에 대한 non-dead_letter completion pending이 여러 개 있으면 가장 마지막 pending 1개만 남긴다.
4. Phase 1은 **sync-start snapshot compaction** 으로 구현한다.
   - enqueue 시점 DB rewrite는 이번 범위에 넣지 않는다.
   - sync run 시작 시점의 전체 non-dead_letter completion snapshot을 기준으로 supersession을 계산한다.
5. `dead_letter` pending은 coalescing 대상에서 제외한다.
6. `todo/category` pending ordering 및 sync 계약은 유지한다.
7. `createCompletion -> deleteCompletion` 쌍을 무조건 no-op으로 제거하지 않는다.
   - base state 추론이 필요하기 때문이며, 이번 범위는 last-intent만 보장한다.
8. local SQLite completion의 hard delete 모델은 그대로 유지한다.
9. Phase 1이 보장하는 것은 **completion key 기준 최종 상태 수렴**이다.
   - 최신 client-generated completion UUID 보존은 보장 범위가 아니다.

## Glossary

- **Completion Key**: `${todoId}_${date || 'null'}` 형태의 안정 키
- **Last Intent**: 같은 Completion Key에 대해 sync run 시작 시점 snapshot에서 가장 나중에 enqueue된 pending action
- **Superseded Pending**: 같은 Completion Key의 더 최신 pending에 의해 의미를 잃은 이전 pending
- **Sync Snapshot Compaction**: sync run 시작 시점의 non-dead_letter completion snapshot에서 superseded row를 계산하는 단계

## Requirements

### Requirement 1: Completion-Only Coalescing Scope

**User Story:** 개발자로서, Completion queue만 최적화하고 기존 todo/category replay 계약은 건드리지 않고 싶다.

#### Acceptance Criteria

1. THE system SHALL apply coalescing only to `createCompletion` and `deleteCompletion`.
2. THE system SHALL NOT coalesce todo/category pending types in this phase.
3. Existing explicit completion replay contract (`createCompletion` / `deleteCompletion`) SHALL remain unchanged.

### Requirement 2: Last-Intent-Wins Queue Semantics

**User Story:** 사용자로서, 같은 완료 항목을 짧게 여러 번 토글해도 서버에는 마지막 상태만 효율적으로 반영되길 원한다.

#### Acceptance Criteria

1. IF multiple non-dead_letter completion pending rows share the same Completion Key in the sync-start snapshot, THEN only the newest one SHALL be retained as the valid intent for that key.
2. Older non-dead_letter completion pending rows with the same Completion Key SHALL be treated as superseded, even if some of them are currently `failed` with a future `next_retry_at`.
3. Example semantics:
   - `create -> delete` => keep `delete`
   - `delete -> create` => keep `create`
   - `create -> delete -> create` => keep final `create`
4. The system SHALL preserve final-state correctness without requiring synced base-state inference.

### Requirement 3: Safe Compaction Timing

**User Story:** 개발자로서, coalescing이 in-flight sync correctness를 깨지 않기를 원한다.

#### Acceptance Criteria

1. Coalescing SHALL run at sync-run start from the full non-dead_letter completion snapshot, not during arbitrary enqueue-time mutation in this phase.
2. Replay selection MAY still use the ready subset, but supersession analysis SHALL NOT be limited to the ready subset.
3. `dead_letter` rows SHALL remain untouched.
4. Coalescing SHALL NOT require concurrent sync runs or bypass the existing sync guard.

### Requirement 4: Order Preservation for Non-Completion Work

**User Story:** 개발자로서, Completion queue 압축이 todo/category sync ordering을 망가뜨리지 않기를 원한다.

#### Acceptance Criteria

1. Non-completion pending rows SHALL preserve their existing relative replay order.
2. Retained completion pending rows SHALL preserve their original relative order among the remaining queue.
3. The system SHALL continue to honor existing defer/ordering safety rules for dependent creates.
4. Any defer/dependency check applied during replay SHALL evaluate the compacted snapshot and SHALL ignore superseded completion creates.

### Requirement 5: Superseded Pending Cleanup

**User Story:** 사용자로서, 온라인 복귀 후 불필요한 pending이 줄어들어 복구가 빨라지길 원한다.

#### Acceptance Criteria

1. Superseded non-dead_letter completion pending rows SHALL be retired from SQLite queue storage before or during replay of the compacted run.
2. A retryable failure on another retained queue item SHALL NOT cause the final retained completion intent to be lost.
3. Retiring superseded rows SHALL include older `failed` completion rows whose `next_retry_at` is still in the future.
4. The compacted run SHALL continue replay using the retained completion pending rows only.
5. Superseded non-dead_letter completion-row retirement SHALL be treated as the narrow allowed exception to the generic pending queue rule of “remove on confirmed success / keep failed for retry”.

### Requirement 6: Observability

**User Story:** 개발자로서, coalescing이 실제로 queue를 줄였는지 진단 가능하길 원한다.

#### Acceptance Criteria

1. Pending Push diagnostics SHALL expose at least:
   - raw ready count
   - compacted ready count
   - superseded completion count removed
2. Logs or structured stage results SHALL allow distinguishing “normal replay success” from “replay after compaction”.

### Requirement 7: Validation Matrix

**User Story:** 개발자로서, coalescing이 correctness를 깨지 않았음을 검증하고 싶다.

#### Acceptance Criteria

1. Validation SHALL include non-recurring completion rapid toggles on the same key.
2. Validation SHALL include recurring completion toggles on the same `todoId` but different `date` values, proving keys do not collapse incorrectly.
3. Validation SHALL include offline backlog recovery with compacted completion queue.
4. Validation SHALL include a mixed queue containing todo/category/completion pending.
5. Validation SHALL include a case where an older completion pending is `failed` with a future `next_retry_at` and a newer intent supersedes it.
6. Validation SHALL include “sync already running + later completion enqueue” regression check, proving rerun latch behavior is preserved.
7. Validation SHALL include a backlog case where the retained latest intent would have been beyond the raw `maxItems=200` cutoff without compaction.
8. Validation SHALL include restart after superseded-row cleanup and before retained replay, proving the retained final intent still converges.

## Scope

### In Scope

1. Pending Push 전 full non-dead_letter completion snapshot compaction
2. Completion superseded pending cleanup in SQLite queue
3. Pending Push diagnostics/result 확장
4. Recovery / rapid-toggle validation scenarios 추가

### Out of Scope

1. enqueue-time completion coalescing
2. base-state-aware no-op elimination
3. local SQLite completion tombstone schema 변경
4. todo/category queue compaction
5. server API contract 변경
