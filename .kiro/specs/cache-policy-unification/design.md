# Design Document: 캐시 정책 통합 (Option A -> Option B)

## Overview

본 설계는 화면별로 분산된 조회/캐시 정책을 공통 계약으로 통합하는 구조를 정의한다.

이행 원칙:

1. Step 1: Option A로 Strip 체감 지연을 즉시 완화한다.
2. Step 2: 같은 작업 흐름에서 Option B로 공통 Range Cache를 도입한다.
3. Step 3: Sync invalidation을 공통 cache entrypoint 기준으로 정리한다.

## 현재 구조 (AS-IS 요약)

1. TodoScreen: `runCommonQueryForDate` + React Query date key
2. TodoCalendar: `runCommonQueryForRange` + `todoCalendarStore` month cache
3. StripCalendar: `runCommonQueryForRange` + `stripCalendarStore` range/date cache
4. Sync invalidation: TodoCalendar와 StripCalendar가 서로 다른 invalidate 방식 사용

리스크:

1. 범위 중복 fetch 가능성
2. invalidate 정책 비대칭
3. Strip settle 이후 데이터 지연 체감

## TO-BE 구조

### 1) Shared Range Cache Service

신규 모듈(제안 경로):

1. `client/src/services/query-aggregation/cache/rangeCacheService.js`
2. `client/src/services/query-aggregation/cache/rangeKey.js`
3. `client/src/services/query-aggregation/cache/rangeMerge.js`

핵심 역할:

1. normalized range key 생성
2. cache-hit 판단 (`covers(range)`)
3. overlap/adjacent merge
4. in-flight dedupe
5. invalidate entrypoint 제공

### 2) Loader 경로 통합

1. TodoCalendar loader는 direct range-query 대신 rangeCacheService를 사용한다.
2. StripCalendar loader는 direct range-query 대신 rangeCacheService를 사용한다.
3. rangeCacheService miss에서만 `runCommonQueryForRange`를 호출한다.
4. adapter는 rangeCache 결과를 화면 shape로 변환한다.
5. TodoScreen은 `runCommonQueryForDate` + React Query date-key 경로를 유지한다. (range 기반으로 강제 전환하지 않음)
6. TodoScreen 일관성은 unified invalidate entrypoint에서 React Query invalidation을 동시 발화해 보장한다.

### 3) Store 역할 축소

1. `todoCalendarStore`, `stripCalendarStore`는 presentation cache로 유지한다.
2. 원본 range 데이터의 source-of-truth는 shared range cache 계약으로 단일화한다.
3. store는 view projection/selection 최적화 역할만 수행한다.

Option B 이후 store 메서드 처분:

1. `todoCalendarStore.hasMonth()` -> `rangeCacheService.covers()`로 대체
2. `stripCalendarStore.hasRangeCoverage()` -> `rangeCacheService.covers()`로 대체
3. `todoCalendarStore.clearAll()` -> `rangeCacheService.invalidateAll()` 경유 정책으로 대체
4. `stripCalendarStore.loadedRanges` 직접 관리 -> `rangeCacheService` 내부 관리로 이관
5. 양 store는 adapter output projection만 유지한다.

## 단계별 설계

## Phase A: Option A (즉시 개선)

대상:

1. `useStripCalendarDataRange` 로딩 범위/선로딩 정책

변경:

1. monthly range를 기존 9주 정책에서 3개월 정책으로 변경
2. settle 완료 후 로드만 수행하던 경로에 prefetch 타이밍 추가
3. 기존 strip store 구조는 유지

검증 포인트:

1. strip scroll 직후 dot/summary 지연 감소
2. fetch count/elapsed 로그 수집

## Phase B: Option B (정책 통합)

대상:

1. TodoCalendar range fetch path
2. StripCalendar range fetch path
3. Sync invalidation bridge

변경:

1. rangeCacheService 도입
2. calendar/strip loader를 service 경유로 전환
3. sync에서 unified invalidate entrypoint 사용
4. TodoCalendar의 기존 `visible +/-2 month` prefetch 전략은 초기 이행에서 유지한다.

검증 포인트:

1. 동일 범위 중복 fetch 감소
2. 3스크린 inclusion diff=0 유지
3. stale regression 없음

## Contract API (초안)

```js
// rangeCacheService.js
async function getOrLoadRange(params) {
  // params: { startDate, endDate, sourceTag, forceRefresh? }
  // returns: { itemsByDate, meta, cacheInfo }
}

function peekRange(params) {
  // returns cached payload or null
}

function covers(params) {
  // returns whether requested range is fully covered by loaded ranges
}

function invalidateAll() {}

function invalidateByDateRange(params) {
  // params: { startDate, endDate, reason }
}

function pruneOutsideDateRange(params) {
  // params: { startDate, endDate, reason }
  // cache-only retention helper (memory bound). keep-range 밖 payload를 제거/clip한다.
}

function getDebugStats() {
  // returns { hit, miss, inFlightDeduped, loadedRanges }
}
```

설계 결정:

1. shared range cache의 canonical payload는 pre-adapter raw handoff(`itemsByDate`)로 저장한다.
2. in-flight dedupe 정책:
   - 요청 range가 in-flight 요청에 fully covered면 기존 Promise를 await한다.
   - partially overlapped면 uncovered sub-range만 추가 로드 후 merge한다.
3. eviction 정책: loaded range count가 기본 상한(`12`)을 초과하면 oldest-first로 정리한다.
4. sub-range 로드 완료 후 인접/겹침 merge를 즉시 수행하며, merge 결과는 1개 range entry로 카운트한다.
5. retention 정책(메모리 상한):
   - overlap/adjacent merge로 1개의 거대 엔트리가 생길 수 있어, `maxEntries`만으로는 메모리 성장을 제한하기 어렵다.
   - 따라서 keep-range 기반 prune(`pruneOutsideDateRange`)를 제공하고, 화면 hook에서 anchor 기준 윈도우(예: ±6개월)로 주기적으로 prune한다.

## Sync 연동 설계

1. Sync 성공 시점에 unified invalidate 호출
2. invalidate 정책:
   - full sync 성격이면 `invalidateAll`
   - delta 영향 범위가 확보되면 `invalidateByDateRange`
3. invalidate 이후 화면 hook은 필요 범위 재조회
4. unified invalidate entrypoint는 TodoScreen React Query invalidation(`['todos']`, `['categories']`)을 동시 실행한다.

## 관측/진단 설계

필수 로그:

1. `cache_hit` / `cache_miss` / `inflight_deduped`
2. range load elapsed
3. screen compare diff (`TodoScreen`, `TodoCalendar`, `StripCalendar`)

DebugScreen 액션:

1. baseline 수집
2. option A/option B 이후 비교
3. pass/fail summary

## 롤백 기준

### Option A rollback

1. average range load elapsed > 100ms 또는 baseline 대비 3배 초과
2. fetch count increase > 3x baseline
3. strip settle-to-visible delay 개선율 < 30%

### Option B rollback

1. DebugScreen screen compare diff > 0
2. sync completion to screen refresh elapsed > 5 seconds
3. rangeCache invalidation miss가 재현됨 (stale 잔존)

## Non-Goals

1. recurrence 비즈니스 규칙 수정
2. adapter의 UI 정책 변경
3. 서버 API 구조 변경
4. `useTodos` SQLite init 실패 시 서버 fallback 경로 수정
