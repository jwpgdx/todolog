# Requirements Document: 캐시 정책 통합 (Option A -> Option B 연속 이행)

## Introduction

본 문서는 `screen-adapter-layer` 이후 단계에서 화면 간 조회/캐시 정책을 통합하기 위한 요구사항을 정의한다.

핵심 전제:

1. `공통 조회/집계 레이어`와 `화면어댑터`는 완료 상태다.
2. 이번 작업은 기능 추가가 아니라 캐시 정책/무효화 정책 변경이다.
3. 이 스펙은 `Option A 완료 후 즉시 Option B`까지 같은 이행 흐름으로 수행한다.

관련 문서:

1. `.kiro/specs/screen-adapter-layer/cache-policy-unification.md`
2. `.kiro/specs/screen-adapter-layer/requirements.md`
3. `.kiro/specs/screen-adapter-layer/design.md`
4. `.kiro/specs/common-query-aggregation-layer/design.md`
5. `.kiro/specs/common-query-aggregation-layer/requirements.md` (Requirement 13: 성능 DoD)
6. `.kiro/specs/common-query-aggregation-layer/tasks.md` (Tasks 15~17: 성능 튜닝 트랙)
7. `.kiro/steering/ROADMAP.md`

성능 선행 의존:

1. cache-policy 통합 이후 남은 cold 체감 지연은 공통 레이어(candidate query) 병목이 주원인일 수 있다.
2. 추가 cache-policy 변경 전, 공통 레이어 성능 DoD(Requirement 13) 충족 여부를 먼저 확인한다.

## Requirements

### Requirement C0: TO-BE 우선 이행 원칙

1. THE implementation SHALL prioritize TO-BE cache contract over current per-screen convenience.
2. THE implementation SHALL replace legacy cache paths that conflict with the unified contract.
3. THE migration SHALL execute as `Option A` then immediate `Option B` in one continuous plan.

### Requirement C1: 공통 Range Cache 계약

1. THE system SHALL provide one shared range-cache contract for range-based screen data loading (TodoCalendar, StripCalendar).
2. THE contract SHALL support overlap/adjacent range merge and cache-hit decision.
3. THE contract SHALL deduplicate in-flight requests for the same normalized range.
4. THE contract SHALL expose cache metadata (`loadedRanges`, `lastLoadedAt`, `sourceTag`).
5. THE contract SHALL support cache-only retention pruning (keep-date-range) to prevent unbounded memory growth under long scrolling.

### Requirement C2: Option A (즉시 체감 개선)

1. THE strip-calendar path SHALL expand monthly loading window from the existing 9-week policy to a 3-month policy.
2. THE strip-calendar path SHALL add prefetch before settle-complete render point.
3. THE implementation SHALL keep current store shape during Option A.
4. THE implementation SHALL emit baseline and post-change metrics for fetch count and elapsed time.

### Requirement C3: Option B (정책 통합 본 이행)

1. THE TodoCalendar and StripCalendar data loaders SHALL consume the shared range-cache contract.
2. THE implementation SHALL remove direct, per-feature duplicated range loading paths where contract-equivalent.
3. THE implementation SHALL keep recurrence final decision path singular via common query/aggregation layer.
4. THE implementation SHALL preserve adapter boundary (adapter does not re-query SQLite directly).

### Requirement C4: Sync/Invalidation 단일화

1. THE sync layer SHALL invalidate unified range cache through one contract entrypoint.
2. THE invalidation policy SHALL preserve data consistency across TodoCalendar and StripCalendar.
3. THE implementation SHALL avoid asymmetric invalidation behavior (`clearAll` vs partial-only) without explicit policy reason.
4. THE unified invalidation entrypoint SHALL co-fire TodoScreen React Query invalidation (`['todos']`, `['categories']`) to keep all surfaces consistent.

### Requirement C5: 화면 일관성 계약

1. GIVEN same effective date/range, TodoScreen/TodoCalendar/StripCalendar SHALL preserve logical inclusion consistency.
2. Category/completion interpretation SHALL remain consistent after cache-policy migration.
3. The migration SHALL NOT change screen-specific rendering policy (dot cap, day cap, overflow UI rules).

### Requirement C6: 관측/검증 계약

1. Debug/diagnostic flow SHALL provide before/after metrics for:
   - range cache hit/miss
   - common query elapsed
   - screen compare diff
2. The validation SHALL include recurrence scenarios (daily/weekly/monthly/time-based).
3. The migration SHALL define rollback criteria for both Option A and Option B.

### Requirement C7: 완료 기준 (DoD)

1. Option A completion SHALL be proven with strip settle-to-visible delay reduction of at least 30% versus baseline.
2. Option B completion SHALL be proven with unified range-cache path adoption in both TodoCalendar and StripCalendar, including cache stats evidence (`hit/miss`, `inflight dedupe`).
3. Screen compare diff SHALL remain zero for agreed validation scenarios including recurrence types (daily/weekly/monthly/time-based).
4. Sync-triggered invalidation SHALL refresh all three surfaces (TodoScreen/TodoCalendar/StripCalendar) without stale regression beyond 5 seconds post-sync.

## Scope

### In Scope

1. StripCalendar range/prefetch policy adjustment (Option A)
2. Shared range cache service contract and adoption (Option B)
3. TodoCalendar/StripCalendar cache-path unification
4. Sync invalidation contract unification including TodoScreen React Query co-fire
5. Debug validation/metrics contract for this migration

### Out of Scope

1. Recurrence engine rule changes
2. Common query/aggregation business rules changes
3. Screen visual design policy changes (dot/bar/day cap UI spec)
4. Server API or transport protocol redesign
