# Screen Data/Cache Policy Unification Note

작성일: 2026-02-22  
목적: 화면별 조회/캐시 정책 차이를 명확히 문서화하고, 공통화 가능한 영역과 화면별 유지가 필요한 영역을 분리해 다음 개선 작업의 기준선을 고정한다.

## 1. 왜 이 문서가 필요한가

현재 `TodoScreen`, `TodoCalendar`, `StripCalendar`는 공통 조회/집계 레이어와 화면어댑터를 사용하지만, 조회 트리거/범위/캐시 정책은 화면별로 다르다.  
이 차이 때문에 특히 StripCalendar에서 "스크롤 후 데이터가 늦게 보이는 체감"이 나타날 수 있다.

본 문서는 다음을 결정하기 위한 실무 기준 문서다.

1. 어디까지 공통화할 것인가
2. 어디는 화면별 정책으로 남길 것인가
3. 어떤 순서로 리스크 낮게 이행할 것인가

## 1-1. 프로젝트 구현 구조 스냅샷 (2026-02-22)

### A) 파일 단위 호출 체인

1. TodoScreen
   - `client/src/hooks/queries/useTodos.js`
   - `runCommonQueryForDate(...)`
   - `adaptTodoScreenFromDateHandoff(...)`
   - React Query 결과를 화면 리스트에 전달

2. TodoCalendar
   - `client/src/features/todo-calendar/hooks/useTodoCalendarData.js`
   - `fetchCalendarDataForMonths(...)`
   - `runCommonQueryForRange(...)`
   - `adaptTodoCalendarFromRangeHandoff(...)`
   - `todoCalendarStore.setBatchMonthData(...)`

3. StripCalendar
   - `client/src/features/strip-calendar/hooks/useStripCalendarDataRange.js`
   - `ensureRangeLoaded(...)`
   - `fetchDaySummariesByRange(...)`
   - `runCommonQueryForRange(...)`
   - `adaptStripCalendarFromRangeHandoff(...)`
   - `stripCalendarStore.upsertSummaries(...)`

### B) Sync/Invalidation 연동

1. Sync 성공 후 공통 invalidate 경로:
   - `queryClient.invalidateQueries(['todos'])`
   - `queryClient.invalidateQueries(['categories'])`
   - `todoCalendarStore.clearAll()`
2. Strip summary invalidation:
   - `useStripCalendarStore.loadedRanges` 기준으로 `invalidateRanges(...)` 실행
   - loaded range가 없으면 strip summary invalidation 스킵
3. 해석:
   - TodoCalendar는 clearAll 중심
   - StripCalendar는 range invalidation 중심
   - invalidate 정책이 store별로 비대칭

### C) 범위/상수 정책 스냅샷

1. TodoCalendar
   - 월 단위 6주 grid (`getCalendarDateRange`)
   - visible month 기준 `±2개월` prefetch
2. StripCalendar
   - weekly: `-14 ~ +20일` (35일/5주)
   - monthly: `-14 ~ +48일` (63일/9주)
   - 월 모드 화면 표시 주수: `MONTHLY_VISIBLE_WEEK_COUNT = 5`
3. 네비게이션 week window
   - `WEEK_WINDOW_BEFORE/AFTER = 520` (인덱스 윈도우)
   - summary cache 범위와는 별개

## 2. AS-IS 요약 (현재 구현)

| 화면 | 조회 트리거 | 조회 범위 | 프리패치 | 출력 shape | 캐시 |
|---|---|---|---|---|---|
| TodoScreen | 선택 날짜 변경 | `runCommonQueryForDate` (1일) | 거의 없음 | list items | React Query `['todos', date]` |
| TodoCalendar | 보이는 월 변경 | 월별 6주 범위를 합쳐 `runCommonQueryForRange` 1회 | 보이는 월 `±2개월` | `todosByMonth`, `completionsByMonth` | `todoCalendarStore` |
| StripCalendar | 주/월 settle 후 | weekly `-14~+20일`, monthly `-14~+48일` (`runCommonQueryForRange`) | 현재 range 중심 | `summariesByDate` | `stripCalendarStore` |

핵심:

1. 판정 엔진/집계 코어는 공통화됨
2. 로딩 타이밍/범위/캐시 구조는 아직 화면별 정책

## 2-1. 모듈 영향 분석표 (변경 전 체크)

| 변경 대상 | 직접 영향 모듈 | 잠재 회귀 |
|---|---|---|
| Strip range 확대 | `useStripCalendarDataRange`, `stripCalendarDataAdapter`, `stripCalendarStore` | fetch 증가, cache 메모리 증가 |
| Strip prefetch 시점 변경 | `useStripCalendarDataRange`, `MonthlyStripList` settle 흐름 | 중복 요청, 스크롤 중 경합 |
| 공통 range cache 도입 | todo/strip calendar service + store invalidate | invalidate 누락, stale 노출 |
| invalidate 정책 통합 | `services/sync/index.js`, 각 store | 화면별 갱신 타이밍 불일치 |

## 3. 공통화해야 하는 것 vs 분리 유지할 것

### 3-1. 공통화 권장 (필수)

1. 공통 데이터 계약
   - `AggregatedItem` 의미, completion key 정책, category binding 의미
2. stale/sync 메타 계약
   - `isStale`, `staleReason`, `lastSyncTime` 해석 방식
3. 캐시 무효화 규칙
   - Todo/Completion 변경, sync 성공 후 invalidate 정책 기준
4. 범위 캐시 커버리지 규칙
   - range 포함/인접 병합/중복 로드 방지 기준

### 3-2. 화면별 유지 (필수)

1. 조회 트리거 시점
   - 날짜 선택 / 월 가시영역 변경 / settle 기반
2. 렌더 shape
   - list / month-bridge / day-summary
3. UI 표현 정책
   - day cap, dot max, overflow 표시

## 4. 권장 TO-BE 방향

## 4-1. 목표 구조

1. `공통 range 캐시 레이어`를 하나 둔다.
2. 각 화면은 해당 캐시를 읽고 어댑터로 변환만 한다.
3. 화면은 트리거를 유지하되, 로딩 대상 범위 계산은 공통 함수를 사용한다.

## 4-2. TO-BE 흐름

1. 화면이 필요한 range 계산 요청
2. 공통 range 캐시 서비스가:
   - cache hit면 즉시 반환
   - miss면 common query 실행 후 range cache upsert
3. 화면어댑터가 cache 데이터 -> 화면 shape 변환
4. 화면 store는 UI 최적화용 보조 캐시만 유지

## 5. Strip 지연 체감의 직접 원인 (현재)

1. settled 이후 `ensureRangeLoaded` 호출
2. range load가 비동기 완료되기 전 `empty summary` 렌더
3. 이후 data merge 시점에 점/요약이 늦게 나타남

즉, "범위가 작다" + "트리거 시점이 늦다"의 결합 이슈다.

## 6. 실행 옵션

### Option A: 빠른 개선 (저위험)

1. Strip monthly range를 9주에서 3개월 윈도우 수준으로 확대
2. settle 이전 선로딩(prefetch) 1회 추가
3. 기존 store 구조 유지

장점:

1. 체감 개선 빠름
2. 코드 변경량 작음

리스크:

1. 불필요한 fetch 증가 가능
2. 캐시 메모리 증가 가능

### Option B: 정책 통합 리팩터링 (중위험)

1. 공통 range cache service 도입
2. TodoCalendar/StripCalendar가 같은 range cache 계약 사용
3. 화면 store는 presentation cache로 축소

장점:

1. 중복 fetch 감소
2. invalidate 규칙 단일화
3. 장기 유지보수성 상승

리스크:

1. 이행 중 회귀 범위 큼
2. 테스트 시나리오 확대 필요

## 7. 권장 이행 순서

1. Phase 0: 계측
   - fetch 횟수, hit/miss, 평균 latency 로그 표준화
2. Phase 1: Strip 범위/선로딩만 조정 (Option A)
3. Phase 2: 공통 range cache 서비스 설계/도입 (Option B)
4. Phase 3: TodoCalendar/StripCalendar cache policy 통합
5. Phase 4: 회귀 테스트/성능 비교 후 확정

## 8. 검증 체크리스트

1. 동일 날짜에서 3화면 inclusion set 일치
2. Strip 스크롤 직후 dot 표시 지연 체감 개선
3. sync 이후 stale/fresh 전환 일관성 유지
4. fetch 호출량이 허용 범위 내인지 확인
5. cache 크기 증가가 허용 범위 내인지 확인

## 9. 외부 검증 요청 템플릿 (개발자/AI용)

아래 질문을 그대로 전달해 검증 요청한다.

### 9-1. 아키텍처 검증 요청

```text
프로젝트는 공통 조회/집계 레이어 + 화면어댑터 구조를 사용 중입니다.
다만 화면별 조회 트리거/범위/캐시 정책이 달라 StripCalendar 체감 지연이 있습니다.

문서:
- .kiro/specs/screen-adapter-layer/cache-policy-unification.md
- .kiro/specs/screen-adapter-layer/design.md
- .kiro/specs/common-query-aggregation-layer/design.md

요청:
1) 공통화해야 할 영역과 화면별 유지해야 할 영역 분리가 타당한지
2) Option A(빠른 개선)와 Option B(정책 통합)의 리스크/우선순위 판단
3) 누락된 회귀 리스크가 있는지

중요 기준:
- TO-BE 우선 (기존 코드 재사용보다 최종 계약 정합성)
- offline-first/SQLite 소스 오브 트루스 유지
- recurrence 최종 판정 단일 경로 유지
```

### 9-2. 구현 전 체크 질문

1. range 확대 시 sync invalidation과 충돌 가능성은 없는가
2. prefetch로 인해 stale 데이터 노출 시간이 늘어나지 않는가
3. 캐시 통합 시 화면 재렌더 비용이 급증하지 않는가
4. 어댑터 경계가 무너지지 않는가 (판정 재실행 금지 유지)

## 10. 문서 상태

본 문서는 `screen-adapter-layer`의 보완 설계 노트이며, 실제 구현 착수 시에는  
`requirements/design/tasks`에 결론을 반영해 스펙 본문으로 승격한다.

## 11. 실행 결과 (2026-02-23)

본 문서의 Option A/B는 `cache-policy-unification` 스펙으로 이관되어 구현/검증이 완료되었다.

요약:

1. Option A 완료
   - Strip monthly 정책: 3개월 윈도우
   - prefetch 적용
   - 정량 검증: `option-a-benchmark` elapsed 62.3% 개선
2. Option B 완료
   - shared range cache(`getOrLoadRange`) 기반으로 TodoCalendar/StripCalendar 공통화
   - sync invalidation 단일 entrypoint 적용
   - `range-hit-smoke`로 miss->hit 검증 PASS
3. 통합 회귀 완료
   - 일반 일정 / 반복(일·주·월) / 시간 포함 반복 시나리오에서 screen-compare PASS
   - ID diff 0, sync-smoke stale=false 확인

근거:

1. `.kiro/specs/cache-policy-unification/tasks.md`
2. `.kiro/specs/cache-policy-unification/log.md`
3. `.kiro/specs/cache-policy-unification/design.md`

### 11-1. Deprecated 경로 정리 목록 (반영 완료)

아래 "직접 per-feature range query" 경로는 shared range cache 계약으로 치환되었다.

1. Strip calendar direct range-query 중심 경로
   - `fetchDaySummariesByRange -> getOrLoadRange`로 통합
2. TodoCalendar direct range-query 중심 경로
   - `fetchCalendarDataForMonths -> getOrLoadRange`로 통합
3. 화면별 분산 invalidation 경로
   - sync 성공 후 `invalidateAllScreenCaches` 단일 경유

### 11-2. 성능 선행 의존 (공통 레이어)

cache-policy 통합(Option A/B) 완료 이후에도, cold 진입 시 체감 지연의 주 병목이 `common query candidate` 단계에 남아있다.  
따라서 cache-policy 후속 튜닝은 아래 공통 레이어 성능 트랙을 선행 의존으로 둔다.

1. 성능 DoD 기준: `.kiro/specs/common-query-aggregation-layer/requirements.md` (Requirement 13)
2. 실행 태스크: `.kiro/specs/common-query-aggregation-layer/tasks.md` (Tasks 15~17, Checkpoint E)

정책:

1. 화면 캐시 정책 변경 전에 공통 레이어 성능 DoD 충족 여부를 먼저 확인한다.
2. 화면 이슈 재현 로그에는 공통 레이어 stage elapsed(`candidate/decision/aggregation`)를 함께 첨부한다.
3. 공통 레이어 성능 DoD(R13) FAIL 시, 해당 병목 해소 전까지 추가 cache-policy 변경은 보류한다.

주의:

1. L1 store(`stripCalendarStore`, `todoCalendarStore`)는 UI 최적화 캐시로 유지한다.
2. authoritative range cache는 shared range cache service다.
