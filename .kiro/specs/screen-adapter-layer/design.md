# Design Document: 화면어댑터 레이어

## Overview

본 설계는 공통 조회/집계 레이어 출력(Handoff DTO)을 화면별 출력으로 변환하는 화면어댑터 구조를 정의한다.

상위 레이어 완료 스냅샷(2026-02-21):

1. `common-query-aggregation-layer`는 Checkpoint C 완료 상태다.
2. 검증 근거는 `.kiro/specs/common-query-aggregation-layer/log.md`를 따른다.
3. 본 설계는 상위 레이어를 "완료된 입력 제공자"로 가정하고 어댑터 변환만 정의한다.

전제:

1. 공통 조회/집계 레이어가 후보 조회/판정/병합을 완료한다.
2. 화면어댑터는 표현형 변환만 담당한다.

## Boundary Contract

입력:

- `Aggregated Item (Handoff DTO)` from `.kiro/specs/common-query-aggregation-layer/design.md`
- 공통 메타(`isStale`, `staleReason`, `lastSyncTime`) from common-layer result meta

금지:

1. adapter 내부 recurrence 최종 판정 재실행
2. adapter 내부 서버 조회
3. adapter 내부 completion 매칭 정책 변경

입력 계약 고정(현 단계):

1. item 필수: `todoId`, `title`, `completionKey`, `completed`, `category`
2. 일정 필드: `date`, `startDate`, `endDate`, `isAllDay`, `startTime`, `endTime`, `isRecurring`
3. 어댑터는 입력 필드 의미를 재해석하지 않고 화면 shape로만 변환한다.
4. 공통 레이어 호환 필드(`_id`, `memo`, `recurrence`, `recurrenceEndDate`, `createdAt`, `updatedAt`, `startDateTime`, `endDateTime`)는
   기존 화면 의존이 해소될 때까지 adapter에서 passthrough를 허용한다.

## Module Structure

1. `client/src/services/query-aggregation/adapters/todoScreenAdapter.js`
2. `client/src/services/query-aggregation/adapters/todoCalendarAdapter.js`
3. `client/src/services/query-aggregation/adapters/stripCalendarAdapter.js`
4. `client/src/services/query-aggregation/adapters/types.js`

## Adapter Design

### 1) TodoScreen Adapter

역할:

1. handoff DTO를 일자 리스트 형태로 변환
2. completion/category가 즉시 렌더 가능한 shape로 정렬
3. Phase A에서는 passthrough 중심으로 시작하고, 정렬/표시 우선순위 규칙은 adapter 계층에 명시적으로 수렴시킨다.

출력 포인트:

1. day list items
2. completion checked state
3. category badge metadata
4. (Phase A) 기존 UI 호환 필드 passthrough

### 2) TodoCalendar Adapter

역할:

1. handoff DTO를 날짜별 이벤트 맵으로 변환
2. 구글캘린더 스타일 이벤트 바 렌더용 메타 제공

출력 포인트:

1. date -> events[]
2. 이벤트 바 색상(category color), title, completion state
3. day cap 메타 (`visibleLimit`, `overflowCount`) 지원

참고 정책:

- 기본 표시 규칙 예시: 일별 3개 노출 + 나머지 `...` (최종 값은 UI 정책에서 관리)

### 3) StripCalendar Adapter

역할:

1. handoff DTO를 날짜별 summary로 변환
2. dot indicator용 카테고리 색상 집계

출력 포인트:

1. date -> categoryDots[]
2. 카테고리 중복 제거(동일 category color 1개)
3. max-dot + overflow 메타(`maxDots`, `overflowCount`) 지원

참고 정책:

- 기본 표시 규칙 예시: 최대 3~4개 dot + 초과 `+`

## Cross-screen Consistency Design

1. inclusion/exclusion set은 공통 조회/집계 레이어 결과를 그대로 계승
2. adapter는 표현 shape만 바꾸고 데이터 해석 규칙을 바꾸지 않는다.
3. DebugScreen 비교 버튼으로 3화면 결과 차이를 즉시 확인 가능해야 한다.

## Observability

필수 로그:

1. adapter별 입력 count / 출력 count
2. overflow 발생 횟수
3. 화면 간 diff 샘플 ID

## Rollout Plan

### Phase A

1. TodoScreen adapter 적용
2. 기존 TodoScreen 경로 대비 parity 확인

### Phase B

1. TodoCalendar adapter 적용
2. day cap/overflow 메타 검증

### Phase C

1. StripCalendar adapter 적용
2. category dot dedupe/overflow 메타 검증

## Dependency

1. 공통 조회/집계 레이어 Checkpoint C 완료 후 착수
2. handoff DTO 변경 시 adapter spec 동시 업데이트
3. 공통 레이어 로직 회귀는 상위 스펙에서 검증하고, adapter는 결과 shape 정합성만 검증한다.
