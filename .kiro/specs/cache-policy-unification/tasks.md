# Implementation Plan: 캐시 정책 통합 (Option A -> Option B 연속 진행)

## Overview

본 계획은 `Option A 완료 후 즉시 Option B`를 같은 이행 트랙으로 진행한다.

원칙:

1. TO-BE 계약 우선
2. 회귀 방지 계측 병행
3. sync invalidation 단일화까지 완료

## Task List

- [x] 0. 사전 계측 기준선 고정
  - DebugScreen/console 기준으로 cache/fetch elapsed baseline 기록
  - 공통 레이어 screen-compare baseline 기록
  - _Requirements: C6, C7_

- [x] 1. Option A-1: Strip monthly range 3개월 정책 적용
  - `useStripCalendarDataRange`의 monthly range 계산을 3개월 윈도우로 변경
  - weekly 정책은 기존 유지(필요 시 상수화)
  - _Requirements: C2_

- [x] 2. Option A-2: settle 이전 prefetch 추가
  - `useStripCalendarDataRange`에 선행 prefetch용 `useEffect`를 추가하고 mode/anchor 변경 시 preload 호출
  - 중복 호출 방지 가드(in-flight/covered range)는 `stripCalendarStore.hasRangeCoverage` 기준으로 보강
  - _Requirements: C2, C6_

- [x] 3. Option A 검증
  - strip 지연 개선 로그 확보
  - fetch 증가율/elapsed 변화 기록
  - rollback 기준 미충족 확인
  - _Requirements: C2, C6, C7_

- [x] 4. Option B-1: shared range cache service 골격 추가
  - `rangeCacheService`/`rangeMerge`/`rangeKey` 생성
  - API: `getOrLoadRange`, `peekRange`, `covers`, `invalidateAll`, `invalidateByDateRange`, `getDebugStats`
  - in-flight dedupe를 Promise map으로 구현하고 fully-covered 요청은 기존 Promise를 await 처리
  - partially-overlapped 요청은 uncovered sub-range만 로드 후 merge 처리
  - eviction 정책(기본 상한 12 range, oldest-first 정리) 구현
  - _Requirements: C1, C3_

- [x] 5. Option B-2: Strip loader를 shared range cache로 전환
  - strip summary fetch 경로에서 direct range-query 제거
  - cache miss에서만 common range-query 실행
  - _Requirements: C1, C3_

- [x] 6. Option B-3: TodoCalendar loader를 shared range cache로 전환
  - calendar month fetch 경로에서 shared range cache 사용
  - 기존 month bridge output 계약 유지
  - _Requirements: C1, C3, C5_

- [x] 7. Option B-4: sync invalidation 단일화
  - sync 성공 후 unified invalidate entrypoint 사용
  - clearAll/partial invalidation 비대칭 경로 정리
  - unified invalidate에서 TodoScreen React Query `['todos']`/`['categories']` 동시 무효화
  - _Requirements: C4_

- [x] 8. Option B-5: 관측/디버그 보강
  - cache hit/miss/inflight dedupe 로그 추가
  - DebugScreen에서 screen-compare + cache stats 동시 확인
  - _Requirements: C6_

- [x] 9. 통합 회귀 테스트
  - 일반 일정 + 반복 일정(daily/weekly/monthly/time-based) 시나리오 재검증
  - sync 이후 3화면 inclusion diff=0 확인
  - _Requirements: C5, C6, C7_

- [x] 10. 문서/정리
  - 변경된 정책을 `screen-adapter-layer`/`ROADMAP` 참조 문서에 반영
  - deprecated된 per-screen range load 경로 정리 목록 확정
  - _Requirements: C0, C7_

- [x] 11. Retention(메모리 상한) 추가
  - shared range cache에 keep-range prune API(`pruneOutsideDateRange`) 추가
  - TodoCalendar/StripCalendar L1 cache에 anchor 기준(예: ±6개월) prune 적용
  - DebugScreen 로그로 장기 스크롤 시 무한 누적이 아닌지 확인
  - _Requirements: C1, C6_

## Checkpoints

- [x] Checkpoint CPU-1: Option A 완료
  - Tasks 0~3 완료
  - strip 체감 개선 지표 확보

- [x] Checkpoint CPU-2: shared range cache 도입 완료
  - Tasks 4~6 완료
  - calendar/strip 공통 로딩 경유 확인

- [x] Checkpoint CPU-3: invalidation 통합 + 회귀 검증 완료
  - Tasks 7~10 완료

## Status Snapshot (2026-02-25, Updated)

완료:

1. Option A 구현(Tasks 1, 2)
2. Option A 정량 검증 PASS(62.3% elapsed 개선, `option-a-benchmark`)
3. Option B 구현(Tasks 4~8)
4. shared range cache hit/miss 동작 스모크 PASS (`range-hit-smoke`)
5. screen-compare PASS(기준 로그 상 ID diff=0)
6. retention(메모리 상한) 적용 완료 (anchor ±6개월 prune)

남은 작업:

1. 없음 (본 스펙 범위 완료)

후속 권장 트랙(별도 스펙):

1. runtime debug 로그 최소화/게이팅
2. 장기 운영 지표(메모리/latency) 자동 수집 강화

## Requirements Traceability Matrix

- C0: Tasks 10
- C1: Tasks 4, 5, 6, 11
- C2: Tasks 1, 2, 3
- C3: Tasks 4, 5, 6
- C4: Task 7 (TodoScreen React Query invalidation co-fire 포함)
- C5: Tasks 6, 9
- C6: Tasks 0, 2, 3, 8, 9, 11
- C7: Tasks 3, 9, 10

## Validation Notes

필수 수집 로그:

1. Option A 전/후 strip range load elapsed
2. Option B 전/후 cache hit/miss 비율
3. sync 직후 screen-compare 결과
4. recurrence 포함 시나리오별 inclusion 일치 여부

권장 실행:

1. DebugScreen 기반 수동 검증
2. 필요 시 터미널 로그 수집 병행
3. 검증 로그는 `.kiro/specs/cache-policy-unification/log.md`에 누적
