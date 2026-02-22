# 공통 조회/집계 레이어 프리스펙 베이스라인

작성일: 2026-02-20
업데이트: 2026-02-21
상태: Approved (범위 재정렬 완료)

## 1) 문서 목적

이 문서는 `공통 조회/집계 레이어` 스펙 작성 전 기준선이다.

범위 원칙:

1. 본 폴더는 `공통 조회/판정/병합/집계`만 다룬다.
2. 화면어댑터는 별도 폴더(`.kiro/specs/screen-adapter-layer/`)로 분리한다.
3. 최종 렌더 규칙은 공통 레이어에서 구현하지 않는다.

## 2) 실행 기준선 (TO-BE 우선)

1. 구현 우선순위는 "현재 코드 재사용"이 아니라 "최종 목표 계약 충족"이다.
2. 기존 코드는 TO-BE 계약과 충돌하면 수정/치환/폐기한다.
3. 재사용은 계약 일치 코드에 한해 제한적으로 허용한다.
4. 레거시 호환은 이행 안정성을 위한 임시 수단이며, 최종 상태가 아니다.

## 3) 현재 상태 스냅샷

완료된 기반:

1. SQLite 초기화/마이그레이션(v5) 완료
2. Sync 파이프라인 완료: `Pending Push -> Delta Pull -> Cursor Commit -> Cache Refresh`
3. 반복 엔진 코어(`recurrenceEngine`) 완료

미완료 영역(본 범위):

1. 화면별로 흩어진 조회/판정/병합 경로 공통화
2. 반복 판정 단일 경로 강제
3. completion/category 병합 계약 단일화

## 4) Sync 의존성 (중요)

1. 공통 조회/집계 레이어는 서버 직접 조회를 수행하지 않는다.
2. SQLite 최신성/정합성은 동기화 서비스가 보장한다.
3. 공통 레이어는 sync 완료 전 `stale` 상태를 명시하고 fail-soft로 동작한다.

## 5) TO-BE 구조 (공통 조회/집계 레이어 한정)

1. Candidate Query Layer
   - SQLite에서 Todo/Completion/Category 후보 조회
2. Occurrence Decision Layer
   - 일반 일정/반복 일정 최종 판정
3. Aggregation Layer
   - 판정 통과 대상 기준 `일정 + 완료 + 카테고리` 병합/집계
   - 공통 DTO(handoff) 생성

경계:

- 화면어댑터(TodoScreen/TodoCalendar/StripCalendar)는 별도 스펙에서 수행

## 6) 스펙 작성 전 확정 결정

1. completion key 정책: `todoId + (date|null)`
2. completion 범위 조회 정책: `(date BETWEEN ? AND ?) OR date IS NULL`
3. non-recurring single fallback: `date` 없으면 `startDate`
4. stale-state 메타: `isStale`, `staleReason`
   - 입력 소스: sync 상태(`isSyncing`, `error`, `lastSyncTime`)를 공통 레이어 진입 시 주입
5. 레거시 정리 대상: 중복 recurrence 판정 함수 + `todoFilters.js`

## 7) 레거시 정리 원칙

1. 반복 판정 엔진은 `recurrenceEngine` 단일 경로로 고정한다.
2. 결과 일치 검증 전 레거시 삭제를 강행하지 않는다.
3. 삭제는 단계적으로 수행한다.
   - 1차: 중복 recurrence 판정 함수
   - 2차: 구버전 predicate helper
   - 3차: dead util/dead import (`todoFilters.js`)

## 8) 검증 전략

우선순위:

1. DebugScreen (기본/필수)
2. 웹 수동 실행 + 콘솔/서버 로그 (보조)
3. 터미널 로그 검증 (보조)

필수 로그:

1. `candidate/decided/aggregated`
2. `elapsed`
3. `isStale/staleReason`
4. PASS/FAIL 요약

## 9) 후속 문서 연결

본 폴더(공통 조회/집계 레이어):

1. `requirements.md`
2. `design.md`
3. `tasks.md`

별도 폴더(화면어댑터):

1. `.kiro/specs/screen-adapter-layer/requirements.md`
2. `.kiro/specs/screen-adapter-layer/design.md`
3. `.kiro/specs/screen-adapter-layer/tasks.md`
