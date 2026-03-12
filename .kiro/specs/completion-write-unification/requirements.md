# Requirements Document: Completion Write Unification (Always Pending + Sync-Aware Invalidation)

## Introduction

현재 Completion(완료 토글) write 경로는 `todo/category`와 다르게 동작한다.

- SQLite는 먼저 반영되지만
- 온라인이면 UI가 서버 `create/delete` 응답을 직접 기다리고
- completion 변경이 day summary marker invalidation까지 건드려서
  기존 캘린더 스펙과도 어긋난다.

본 스펙의 목표는 Completion write를 `todo/category`와 같은 Offline-first 방향으로 맞추되,
현재 sync coordinator의 빈틈(동기화 중 추가 pending stranded 가능성)과
completion-only invalidation 과다 문제를 같이 해결하는 것이다.

관련 문서:

1. `AI_COMMON_RULES.md`
2. `PROJECT_CONTEXT.md`
3. `.kiro/specs/sync-service-pending-delta/requirements.md`
4. `.kiro/specs/week-flow-calendar-day-summaries/requirements.md`
5. `.kiro/specs/category-write-unification/requirements.md`

## Decisions (고정 결정)

1. SQLite는 Completion의 **로컬 Source of Truth**다.
2. Completion UI write는 항상:
   - (a) SQLite 즉시 반영
   - (b) `pending_changes`에 enqueue
   - (c) (온라인이면) SyncService를 백그라운드로 트리거
3. Completion UI write는 서버 응답을 foreground에서 **await 하지 않는다**.
4. Pending replay는 현행 sync 스펙을 유지한다:
   - pending type은 `createCompletion` / `deleteCompletion`
   - replay에서 toggle API는 금지
5. `syncAll()` 요청이 이미 실행 중인 sync와 겹치면, 해당 요청은 버려지지 않고 **후속 1회 재실행**으로 보장되어야 한다.
6. Completion-only 변경은 completion-dependent 화면만 새로고침해야 하며,
   **day summary marker store / idle re-ensure**는 건드리지 않는다.
7. Completion identity는 `todoId + "_" + (date || "null")` 조합의 **completion key**를 사용한다.
8. 로컬 SQLite completion delete는 현행대로 **hard delete**를 유지한다. (`deleted_at` 마이그레이션은 본 스펙 범위 밖)
9. Completion pending coalescing/compaction은 본 스펙 범위 밖이다.
   - 이유: 현재 Pending Push는 ready queue snapshot 기반이며, in-flight reservation이 없어 성급한 coalescing은 correctness 리스크가 있다.

## Glossary

- **Completion Key**: `${todoId}_${date || 'null'}` 형태의 안정 키.
- **Always Pending**: 온라인/오프라인 여부와 무관하게 로컬 write 후 pending enqueue를 거치는 정책.
- **Completion-only Sync**: todo/category 변경 없이 completion만 push/pull된 sync run.
- **Rerun Latch**: sync 실행 중 새 sync 요청이 들어오면 종료 직후 한 번 더 실행하도록 보장하는 플래그.

## Requirements

### Requirement 1: Single Canonical Completion Write Path

**User Story:** 개발자로서, Completion toggle이 어디서 호출되든 동일한 write 경로로 동작하길 원한다.

#### Acceptance Criteria

1. THE system SHALL use `useToggleCompletion` as the single canonical Completion write entry.
2. Completion write SHALL always use local SQLite create/delete helpers plus pending enqueue.
3. Completion UI write SHALL NOT directly await `completionAPI.createCompletion` or `completionAPI.deleteCompletion`.
4. Pending replay SHALL continue using explicit `createCompletion` / `deleteCompletion` API routing only.

### Requirement 2: Offline-first Non-Blocking Completion Toggle

**User Story:** 사용자로서, 완료 토글이 네트워크 상태와 무관하게 즉시 반영되길 원한다.

#### Acceptance Criteria

1. WHEN completion is toggled on, THEN the completed state SHALL be visible immediately after SQLite write, without waiting for server.
2. WHEN completion is toggled off, THEN the incomplete state SHALL be visible immediately after SQLite delete, without waiting for server.
3. The mutation success path SHALL complete after local SQLite apply + pending enqueue.
4. 온라인일 때도 UI는 background sync를 기다리지 않는다.

### Requirement 3: Stable Pending Contract for Recurring and Non-Recurring Completion

**User Story:** 개발자로서, 반복/비반복 완료 토글이 동일한 pending 규칙으로 안정적으로 replay되길 원한다.

#### Acceptance Criteria

1. Completion create pending payload SHALL include `_id`, `todoId`, `date`, and `isRecurring`.
2. Completion delete pending payload SHALL include `todoId`, `date`, and `isRecurring`.
3. Pending `entityId` SHALL use the completion key, not completion UUID-only mapping.
4. Repeating todo completion SHALL use date-specific keys.
5. Non-recurring todo completion SHALL use `date = null` semantics and `todoId_null` key.

### Requirement 4: Sync Rerun Guarantee for In-Flight Requests

**User Story:** 사용자로서, sync가 이미 돌고 있을 때 완료 토글을 눌러도 그 작업이 다음 sync에 반드시 포함되길 원한다.

#### Acceptance Criteria

1. IF `syncAll()` is requested while a sync run is already active, THEN the system SHALL remember that request and execute one follow-up sync after the current run finishes.
2. Newly enqueued completion pending items SHALL NOT rely solely on app-active / network-online / login triggers to be pushed.
3. The rerun guarantee SHALL apply to completion-triggered sync requests without allowing concurrent duplicate sync runs.

### Requirement 5: Completion-Aware Cache Invalidation

**User Story:** 사용자로서, 완료 상태가 필요한 화면은 즉시 갱신되되, completion과 무관한 marker cache는 불필요하게 다시 계산하지 않길 원한다.

#### Acceptance Criteria

1. Completion local write success SHALL invalidate only completion-dependent views/caches.
2. Completion-only successful sync SHALL invalidate only completion-dependent views/caches.
3. Completion local write or completion-only sync SHALL NOT clear `Week Flow Calendar` day summary store.
4. Completion local write or completion-only sync SHALL NOT trigger strip/week-flow day summary re-ensure.
5. Completion local write or completion-only sync SHALL NOT clear strip summary stores or day-summary stores.
6. Completion local write or completion-only sync MAY invalidate the shared range cache, but SHALL NOT trigger summary-store reset or idle re-ensure as a side effect.
7. IF a sync run includes local or remote todo/category changes, THEN the system SHALL use the existing broad invalidation path.

### Requirement 6: Validation Matrix

**User Story:** 개발자로서, Completion write 통일 후 회귀를 자동/수동으로 검증하고 싶다.

#### Acceptance Criteria

1. The validation plan SHALL include non-recurring completion recovery (`off -> on -> off`).
2. The validation plan SHALL include recurring completion recovery.
3. The validation plan SHALL include repeated rapid toggles on the same completion key.
4. The validation plan SHALL include “toggle while sync is already running”.
5. The validation plan SHALL include app restart with pending completion backlog.
6. The validation plan SHALL include completion-only sync verification that summary stores are not reset and idle re-ensure is not requested.
7. The validation plan SHALL include category-only or category+completion mixed sync verification that broad invalidation is selected.

## Scope

### In Scope

1. `useToggleCompletion`의 always-pending write 경로 통일
2. `syncAll()` rerun latch 추가
3. completion-aware cache invalidation 경로 추가
4. sync stage 결과를 entity-aware invalidation에 필요한 수준으로 확장
5. Completion recovery/replay 검증 시나리오 보강
6. 구현 반영 시 `PROJECT_CONTEXT.md` 업데이트

### Out of Scope

1. 로컬 SQLite `completions.deleted_at` 컬럼 추가
2. Completion pending coalescing/compaction
3. Completion server API contract 변경
