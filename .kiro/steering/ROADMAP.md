# Phase 3 Sync + Recurrence ROADMAP (임시)

작성일: 2026-02-18  
업데이트: 2026-02-23  
목적: 오프라인 퍼스트 최종 구조 기준으로 완료 상태를 고정하고, 다음 우선순위를 명확히 유지한다.

현재 상태:

- ✅ 동기화 서비스 핵심 구현(선결 블로커 + Pending Push -> Delta Pull + 운영 검증) 완료
- ✅ 반복 엔진(Phase 3 Step 1) 완료
- ✅ 공통 조회/집계 레이어(Phase 3 Step 2) 완료
- ✅ 화면어댑터 레이어(Phase 3 Step 3) 완료
- ✅ 캐시 정책 통합(Option A -> Option B) 완료

## 1. 동기화 서비스 선결 블로커 (가장 먼저)

### 1-1. Category 삭제 계약 수정 (최우선)

- [x] 서버 `category delete`에서 연결 Todo를 hard delete 하지 않도록 수정한다.
- [x] "삭제 시 Todo 처리 정책"을 계약으로 고정한다. (이동/차단/소프트삭제 중 명시)
- [x] Pending replay 시 대량 데이터 유실이 나지 않음을 검증한다.

### 1-2. Completion 삭제 계약 수정 (최우선)

- [x] 서버 `completion delete`를 hard delete에서 soft-delete/tombstone 방식으로 정렬한다.
- [x] completion delta pull이 삭제를 안정적으로 추적(`deletedAt`)하도록 맞춘다.
- [x] create/delete 중복 재생 시 idempotent 동작 정책을 고정한다.

### 1-3. 삭제 404 처리 정책 통일

- [x] todo/category/completion delete의 `404`를 재시도/성공등가 중 어떤 정책으로 갈지 엔드포인트별로 고정한다.
- [x] 클라이언트 pending 처리 로직과 서버 응답 정책을 1:1로 맞춘다.

### 1-4. Sync 순서 기준 단일화

- [x] 공통 규칙 문서와 sync 설계 문서의 순서 정의를 하나로 통일한다.
- [x] 구현 기준 순서를 확정하고, 이후 문서/코드가 같은 기준만 따르도록 정리한다.

## 2. Pending Push -> Delta Pull 구현

### 2-1. Pending Queue 상태 모델(v5)

- [x] `retry_count`, `last_error`, `next_retry_at`, `status` 확장 및 마이그레이션 적용
- [x] `pending/failed/dead_letter` 상태 전이 및 backoff 정책 구현

### 2-2. Pending Push 처리기

- [x] 타입별 API 라우팅(`create/update/delete` + completion create/delete) 구현
- [x] toggle replay 금지, completion 명시 API만 사용
- [x] 실패 분류/재시도/데드레터/의존 pending defer 처리

### 2-3. Delta Pull 처리기

- [x] todo/completion delta pull + category full pull 조합 적용
- [x] `updated/deleted` payload shape 정규화 후 SQLite 반영
- [x] Push + Pull + Apply 모두 성공할 때만 cursor commit

## 3. 캐시/정합성/성능 마무리

### 3-1. 캐시 정합성

- [x] `todos`, `categories`, todo-calendar, strip-calendar 갱신 순서를 고정
- [x] 과도한 전체 무효화(invalidation storm) 없이 변경 범위 기반 갱신 적용

### 3-2. 화면 일치성 검증

- [x] todo / todo-calendar / strip-calendar 동일 날짜 결과 일치 검증
- [x] 오프라인 생성/수정/삭제 -> 온라인 복귀 후 최종 상태 일치 검증

### 3-3. 운영/성능 검증

- [x] 대량 pending에서도 큐 처리 시간과 앱 체감 성능이 허용 범위인지 검증
- [x] 로그/메트릭(`processed/succeeded/failed/dead_letter`)으로 운영 추적 가능 상태 확보

### 4-1. 공통 조회/집계 레이어 구축

- [x] 공통 조회/집계 레이어는 서버 직접 조회가 아니라 SQLite 기준으로 동작하도록 고정한다.
- [x] SQLite 최신성/정합성은 Sync 파이프라인(`Pending Push -> Delta Pull -> Cursor Commit -> Cache Refresh`) 완료 상태를 전제로 한다.
- [x] 범위 문서는 `.kiro/specs/common-query-aggregation-layer/`를 기준으로 관리한다.

### 4-2. 일정 최종 판정 공통화

- [x] non-recurring/recurring 판정을 공통 경로(`recurrenceEngine`)로 단일화한다.
- [x] date/range 모드 판정 계약을 공통 조회/집계 레이어 문서에 고정한다.

### 4-3. 병합/집계 공통화

- [x] 판정 통과 대상 기준으로 `일정 + 완료 + 카테고리` 병합/집계 계약을 고정한다.
- [x] completion key 정책(`todoId + date|null`)을 단일화한다.
- [x] 결과는 화면어댑터가 소비할 handoff DTO로 제공한다.

### 4-4. 화면어댑터 레이어 (별도 트랙)

- [x] 화면어댑터는 공통 조회/집계 레이어와 별도 스펙으로 진행한다.
- [x] 범위 문서는 `.kiro/specs/screen-adapter-layer/`를 기준으로 관리한다.
- [x] TodoScreen -> TodoCalendar -> StripCalendar 순으로 단계 적용한다.

### 4-5. 완료 기준(DoD)

- [x] 공통 조회/집계 레이어와 화면어댑터 레이어의 체크포인트가 각각 독립 PASS 상태다.
- [x] 동일 입력 데이터에서 3화면 결과 일치 검증이 PASS다.
- [x] 레거시 판정 경로 정리가 게이트 조건 충족 후 완료된다.

### 4-6. 캐시 정책 통합 (Option A -> Option B)

- [x] Option A(3개월 monthly + prefetch) 적용 및 정량 검증 PASS(62.3% elapsed 개선)
- [x] Option B(shared range cache + invalidation 단일화) 적용 완료
- [x] 일반/반복/시간포함 반복 시나리오 회귀 검증 PASS
- [x] 디버그 검증 도구(shared/L1 clear, range-hit-smoke, policy toggle, benchmark) 반영


## 최종 목표 흐름 (오프라인 퍼스트)

아래는 "최종적으로 맞추려는 목표 구조"다. (현재 일부만 구현됨)

1. 앱 시작
2. SQLite 초기화 [x]
3. 동기화 서비스 시작 (백그라운드, 화면 렌더를 막지 않음) [x]
4. 공통 조회/집계 레이어 [x]
- 4-1. 로컬(SQLite)에서 후보 데이터 조회 (Todo / Completion / Category)
- 4-2. 일정 타입별 최종 판정 (공통 판정 함수 내부 분기)
  - 일반 일정(단일/기간): 날짜 범위 규칙으로 바로 판정
  - 반복 일정: recurrenceEngine 호출로 최종 판정
- 4-3. 판정 통과 대상 기준으로 `일정 + 완료 + 카테고리` 병합/집계
5. 화면어댑터가 화면별 형태로 변환 [x]
6. todo-screen / todo-calendar / strip-calendar 렌더 [x]

동시에 뒤에서:

1. 동기화 트리거 감지 (앱 활성화 / 온라인 복귀 / 로그인) [x]
2. `Pending Push` 수행 (로컬 변경분 서버 반영) [x]
3. `Server Pull(Delta)` 수행 (서버 변경분 로컬 반영) [x]
4. 반영 결과를 SQLite에 저장(Upsert/Soft Delete) [x]
5. 캐시 무효화/재조회로 화면 자동 갱신 [x]
6. 실패 건은 pending queue 유지 + 재시도 정책으로 후속 처리 [x]

핵심:

1. 화면은 항상 로컬 기준으로 빠르게 뜬다.
2. 서버 반영은 뒤에서 안정적으로 따라온다.
