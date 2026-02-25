# Cache Policy Unification: 상태/후속개선 검증 패킷

작성일: 2026-02-23  
대상: 외부 AI(예: Opus/Gemini)에게 "후속 작업 필요성/우선순위"를 검증받기 위한 단일 핸드오프 문서

---

## 1. 문서 목적

이 문서는 아래 3가지를 한 번에 공유하기 위한 패킷이다.

1. 현재 프로젝트 상태(무엇이 완료됐고 무엇이 남았는지)
2. 실제 로그/코드 근거 기반 이슈(깜빡임/지연 체감)
3. 바로 실행 가능한 후속 수정안(P0/P1)과 검증 기준

---

## 2. 프로젝트 상태 스냅샷 (현재)

### 2-1. 아키텍처 상태

1. `공통 조회/집계 레이어` 완료 상태
2. `화면어댑터` 완료 상태
3. 캐시 정책 통합 스펙(`cache-policy-unification`) Option A -> Option B 완료 상태
4. Sync invalidation은 공통 entrypoint를 사용

관련 스펙:

1. `.kiro/specs/cache-policy-unification/requirements.md`
2. `.kiro/specs/cache-policy-unification/design.md`
3. `.kiro/specs/cache-policy-unification/tasks.md`
4. `.kiro/specs/cache-policy-unification/log.md`

### 2-2. 구현 근거(코드)

1. Shared range cache
   - `client/src/services/query-aggregation/cache/rangeCacheService.js`
   - `client/src/services/query-aggregation/cache/index.js`
2. TodoCalendar가 shared cache 사용
   - `client/src/features/todo-calendar/services/calendarTodoService.js`
3. StripCalendar가 shared cache 사용
   - `client/src/features/strip-calendar/services/stripCalendarSummaryService.js`
4. Sync invalidation 단일화
   - `client/src/services/sync/index.js`
   - `client/src/services/query-aggregation/cache/cacheInvalidationService.js`

### 2-3. 검증 로그 근거

1. Option A benchmark PASS (elapsed 개선 62.3%)
2. range-hit-smoke PASS (1차 miss, 2차 hit)
3. screen-compare PASS (ID diff=0)
4. recurrence 포함 Set A/B/C PASS

출처:

1. `.kiro/specs/cache-policy-unification/log.md`
2. `.kiro/specs/cache-policy-unification/tasks.md`

---

## 3. 최근 운영 이슈/수정 이력

### 3-1. 데이터 0건 고정 이슈 (해결됨)

증상:

1. 로그아웃 후 재로그인 시 sync는 성공하지만 todo/completion이 0건 유지

원인:

1. `clearAllData()`에서 user data는 삭제되지만 sync cursor(`sync.last_success_at`)가 남아 delta가 0건으로 고정

수정:

1. `clearAllData()` 시 `sync.last_success_at` 삭제하도록 변경
2. 첫 sync가 기본 커서(`1970-01-01...`)로 시작해 full delta 재적재

코드:

1. `client/src/services/db/database.js`

로그 확인 포인트:

1. `커서 없음 → 기본값 사용 (1970-01-01T00:00:00.000Z)`
2. `todo delta: updated > 0`
3. 이후 `useTodos` count 증가

### 3-2. 웹 API URL 해석 개선 (적용됨)

1. web에서도 `EXPO_PUBLIC_API_URL` 우선 사용하도록 조정
2. fallback은 `http://localhost:5001/api`

코드:

1. `client/src/api/axios.js`

---

## 4. 현재 남은 핵심 이슈 (기능 오류 아님, UX/perf 후속개선)

요약:

1. 캐시 미스 구간에서 "빈 상태 먼저 렌더 -> 나중 채움" 패턴으로 깜빡임 체감 존재
2. Option A/B의 계약은 충족했지만, first paint UX는 추가 개선 여지 큼

### 4-1. StripCalendar 쪽 근거

1. 미커버 range는 비동기 `ensureRangeLoaded` 완료 전 비어있는 summary가 노출됨
2. `buildEmptySummary`/`buildDefaultSummaryRange`가 기본 빈 상태를 즉시 생성
3. `getSummaryByDate`가 data 부재 시 빈 summary fallback

코드:

1. `client/src/features/strip-calendar/services/stripCalendarSummaryService.js`
2. `client/src/features/strip-calendar/services/stripCalendarDataAdapter.js`
3. `client/src/features/strip-calendar/hooks/useStripCalendarDataRange.js`

### 4-2. TodoCalendar 쪽 근거

1. `isFetchingRef.current`면 새 visible range 요청을 skip
2. fetch 중 발생한 최신 viewport 요청이 유실되어 "늦게 뜸" 체감 가능
3. 월 데이터가 store에 들어오기 전 `todosByMonth[monthId]`는 `undefined`이며 cell은 dot 미표시

코드:

1. `client/src/features/todo-calendar/hooks/useTodoCalendarData.js`
2. `client/src/features/todo-calendar/ui/MonthSection.js`
3. `client/src/features/todo-calendar/ui/DayCell.js`

### 4-3. 최신 실행 로그 해석 (2026-02-23)

1. 대부분 월 fetch는 `5~23ms` 수준으로 빠른 편이다.
2. 간헐적으로 `50~60ms` 스파이크가 발생한다.
3. 체감을 키우는 직접 신호는 `Already fetching, skipping...` 로그다.
4. 즉, 순수 조회 속도보다 "요청 유실 + 로딩 중 빈 렌더"가 체감 지연의 주 원인이다.

### 4-4. TodoCalendar 첫 진입(cold-open) 체감 이슈

1. 탭 비활성 시 백그라운드 렌더/로딩을 막는 현재 정책에서는, TodoCalendar 미진입 상태에서 월 캐시가 미리 채워지지 않는다.
2. 따라서 TodoCalendar를 처음 열 때 `visible + prefetch(±2개월)`를 한 번에 조회하게 되고, cold-open에서 수백 ms 지연이 발생할 수 있다.
3. 실제 로그 예시:
   - `Cache miss: 2025-12 ... 2026-05 (6 months)`
   - `Fetched 6 months in 461.80ms`
4. 이 현상은 기능 오류라기보다 "성능 최적화 정책(비활성 탭 작업 중지)"과 "초기 체감 UX"의 트레이드오프다.

---

## 5. 제안 수정안 (우선순위)

## P0 (즉시 권장)

1. TodoCalendar fetch 큐잉
   - `isFetching` 중 들어온 최신 요청을 `pendingRangeRef`로 저장
   - 현재 fetch 종료 직후 최신 요청 1회 재실행
   - 목표: 요청 유실 방지, 늦게 뜨는 체감 감소

2. Strip 로딩 상태 분리
   - range 미커버 시 `empty`를 즉시 확정 렌더하지 않고 `loading` 상태를 명시
   - UI는 skeleton/placeholder 또는 기존 summary 유지 후 갱신
   - 목표: "빈 점 -> 갑자기 점 등장" 깜빡임 완화

3. TodoCalendar 월 로딩 표시 보강
   - `MonthSection`/`DayCell`에서 `undefined`를 "실제 데이터 없음"과 구분
   - 목표: 로딩 중 오인 렌더 최소화
4. P0 완료 전 `±2개월 -> ±3개월` 확대는 보류
   - 이유: 버퍼 확대는 miss 빈도를 줄일 수 있지만, 현재 핵심 병목(요청 유실)을 해결하지 못함
   - 목표: 원인 우선 해결 후 버퍼 확대 효과를 순수하게 측정
5. TodoCalendar cold-open 2단계 로딩
   - 1단계: 최초 진입 시 visible month(또는 visible months)만 우선 로드
   - 2단계: 첫 paint 이후 `±2개월` prefetch 비동기 수행
   - 목표: 첫 진입 시 "비어있다가 늦게 채워짐" 체감 최소화

## P1 (옵션/실험)

1. TodoCalendar prefetch 버퍼 실험
   - `±2개월 -> ±3개월` feature flag로 A/B
   - miss/hit/elapsed/memory 함께 비교

2. DoD 확장
   - "first paint 깜빡임 기준"을 스펙 DoD로 명시
   - 예: visible month 전환 시 placeholder 즉시 표출, 점 등장 지연 임계치 관리
3. 앱 시작 시 경량 warm-up prefetch 실험
   - TodoCalendar 미진입 상태에서도 공통 range cache에 "예상 첫 화면 범위"를 1회 선적재할지 실험
   - freezeOnBlur 정책은 유지하되, 렌더 없는 데이터 선적재만 허용하는 옵션 비교

---

## 6. 외부 AI에 물어볼 핵심 질문

1. P0 3개가 현재 구조에서 가장 효율적인 최소수정인지?
2. TodoCalendar 큐잉 방식에서 race condition/중복 fetch 리스크는 없는지?
3. Strip의 loading 분리 시 store/source-of-truth 경계가 깨지지 않는지?
4. P1(`±3개월`)가 메모리/CPU 대비 실익이 있는지?
5. "버퍼 확대 전에 큐잉/로딩 상태 분리부터"라는 우선순위가 타당한지?
6. 추가로 반드시 넣어야 할 회귀 테스트가 무엇인지?

---

## 7. 외부 AI 검증 프롬프트 (복붙용)

```text
Role:
You are a senior React Native offline-first architecture reviewer.
Focus on defect/risk analysis and practical prioritization only.

Project constraints:
1) TO-BE-first principle
2) Common query/aggregation layer and screen adapter are already implemented
3) Cache-policy-unification Option A/B is implemented and validated
4) Current issue is UX/perf (flicker/late paint), not a hard functional failure

Primary docs:
1. .kiro/specs/cache-policy-unification/requirements.md
2. .kiro/specs/cache-policy-unification/design.md
3. .kiro/specs/cache-policy-unification/tasks.md
4. .kiro/specs/cache-policy-unification/log.md
5. .kiro/specs/cache-policy-unification/ai-review-handoff.md

Code references:
1. client/src/features/todo-calendar/hooks/useTodoCalendarData.js
2. client/src/features/todo-calendar/ui/MonthSection.js
3. client/src/features/todo-calendar/ui/DayCell.js
4. client/src/features/strip-calendar/hooks/useStripCalendarDataRange.js
5. client/src/features/strip-calendar/services/stripCalendarDataAdapter.js
6. client/src/features/strip-calendar/services/stripCalendarSummaryService.js
7. client/src/services/query-aggregation/cache/rangeCacheService.js

Review requests:
1) Validate whether P0 changes are necessary and sufficient.
2) Identify hidden risks/regressions for the proposed queueing/loading-state changes.
3) Classify recommendations into must-fix / optional / reject with reasons.
4) Suggest acceptance criteria and test cases for each must-fix.

Output format (strict):
1. Findings by severity [Critical/High/Medium/Low] with file evidence.
2. Decision table: must-fix / optional / reject.
3. Concrete patch directions (short, implementation-ready).
4. Final verdict: "Ready for implementation" / "Conditionally ready" / "Needs redesign".
```

---

## 8. 사용자 추가 입력 섹션 (직접 편집용)

아래를 채워서 다음 라운드 검증에 같이 넘긴다.

### 8-1. 내가 추가로 반영하고 싶은 수정사항

1. TodoCalendar fetch 큐잉(`isFetching` 중 최신 요청 보존/재처리)
2. Strip 로딩 상태 분리(빈 summary 즉시 확정 렌더 방지)
3. TodoCalendar 월 로딩 placeholder 정책

### 8-2. 절대 유지해야 하는 제약/선호

1.
2.
3.

### 8-3. 검증 후 triage 결과

1. must-fix:
2. optional:
3. reject:
