# Phase 3 Sync + Recurrence ROADMAP (임시)

작성일: 2026-02-18  
업데이트: 2026-02-20  
목적: 동기화 서비스 완성도를 우선으로, 착수 순서를 명확히 고정한다.

현재 상태:

- ✅ 동기화 서비스 핵심 구현(선결 블로커 + Pending Push -> Delta Pull + 운영 검증) 완료
- ✅ 다음 우선순위는 반복 엔진(Phase 3) 연동

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

## 4. 반복 엔진 연동(후속)

- [ ] 공통 조회/집계 레이어에서 `Todo + Completion + Category` 병합 경로 통일
- [ ] 반복 일정은 recurrenceEngine, 일반 일정은 범위 규칙으로 최종 판정
- [ ] 화면 어댑터에서 동일 판정 결과를 동일하게 렌더
