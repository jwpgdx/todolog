# Implementation Plan: 공통 조회/집계 레이어

## Overview

본 계획은 `공통 조회/집계 레이어` 범위만 구현 가능한 작업 단위로 분해한 문서다.

구현 원칙:

1. TO-BE 계약 우선
2. SQLite-only 경로 고정
3. DebugScreen 기반 검증 우선
4. 화면어댑터는 본 문서 스코프 밖(별도 스펙)

## Task List

- [x] 1. 공통 레이어 폴더/기본 계약 파일 생성
  - `client/src/services/query-aggregation/` 골격 생성
  - `types.js`(JSDoc DTO 계약) 추가
  - _Requirements: R1, R6_

- [x] 2. DebugScreen 최소 검증 기능 선반영
  - `공통 레이어 실행(date/range)` 버튼 추가
  - stage 카운터(`candidate/decided/aggregated`)와 elapsed 로그 출력
  - Checkpoint A 이전 최소 검증 동선 확보
  - _Requirements: R10, R11_

- [x] 3. Candidate Query Service 구현
  - Todo 후보 조회 시 category LEFT JOIN 고정
  - completion 조회 일별/범위별 진입점 분리
  - 범위 completion 조회 정책 `(date BETWEEN ? AND ?) OR date IS NULL` 반영
  - soft-delete 공통 필터 적용
  - _Requirements: R2, R4_

- [x] 4. Occurrence Decision Service 구현
  - `decideForDate` / `decideForRange` 인터페이스 구현
  - non-recurring 판정 규칙 (`date` null 시 `startDate` fallback 포함)
  - recurring 판정은 `recurrenceEngine` 경유로 고정 (`expandOccurrencesInRange` 포함)
  - invalid recurrence fail-soft 처리
  - _Requirements: R5_

- [x] 5. Aggregation Service 구현
  - completion key 정책(`todoId + date|null`) 단일화
  - 공통 DTO 생성 (`isAllDay`, `startTime`, `endTime` 포함)
  - category 메타 병합 정책 고정
  - _Requirements: R6_

- [x] 6. Sync stale-state 계약 연동
  - sync 진행 중/실패 시 결과 메타(`isStale`, `staleReason`) 노출
  - stale 상태에서도 SQLite 조회는 계속 수행
  - stale 감지 입력 소스(`isSyncing`, `error`, `lastSyncTime`)를 공통 레이어 진입 파라미터로 주입
  - sync 완료 후 stale 해제 규칙 고정
  - _Requirements: R3_

- [x] 7. `useTodos` 서버 폴백 경계 정리
  - 공통 레이어 내부 서버 폴백 금지 보장
  - Hook boundary fallback 정책 명시 구현(유지/축소 중 선택)
  - _Requirements: R2, R8_

- [x] 8. Legacy 정리 1차
  - 화면별 중복 recurrence 판정 함수 정리
  - 호환 레이어 범위 최소화
  - _Requirements: R7_

- [x] 9. Legacy 정리 2차
  - `recurrenceUtils`에서 구버전 "판정 helper" 사용처만 정리
  - `convertToApiFormat` / `convertFromApiFormat`는 이번 스코프 제외
  - _Requirements: R7_

- [x] 10. Legacy 정리 3차
  - `todoFilters.js` 제거
  - dead import 정리 및 정적 체크
  - _Requirements: R7_

- [x] 11. 로그 포맷 표준화
  - stage별 `elapsed/candidate/decided/aggregated`
  - 에러 샘플/원인 요약
  - PASS/FAIL 요약 출력
  - _Requirements: R10, R11_

- [x] 12. 캐시/성능/동기화 결합 검증
  - sync 후 캐시 무효화/재조회 경로 점검
  - stale -> fresh 전환 로그 점검
  - 공통화 전후 성능 비교 로그 수집
  - _Requirements: R3, R9_

- [x] 13. DebugScreen 기준 통합 검증 실행
  - 우선순위: DebugScreen -> 웹 수동 -> 터미널 로그
  - 결과를 `log.md`에 기록
  - _Requirements: R10, R11_

- [x] 14. 화면어댑터 스펙 인계
  - handoff DTO 기준으로 `.kiro/specs/screen-adapter-layer/` 문서와 정합성 확인
  - 공통 레이어 문서와 화면어댑터 문서의 경계 중복 제거
  - _Requirements: R12_

## Checkpoints

- [x] Checkpoint A: 공통 조회/판정/병합 동작
  - Tasks 1~6 완료
  - DebugScreen로 date/range 실행 및 단계별 카운터 검증

- [x] Checkpoint B: 폴백/레거시 정리
  - Tasks 7~10 완료
  - 레거시 경로 축소 + dead util 제거 확인

- [x] Checkpoint C: 검증 체계 완료
  - Tasks 11~13 완료
  - PASS/FAIL 자동 요약 검증

- [x] Checkpoint D: 화면어댑터 인계 완료
  - Task 14 완료
  - adapter 스펙과 handoff DTO 계약 일치 확인

## Validation Scenarios (필수)

1. 동일 데이터셋에서 date/range 판정 결과 일관성
2. recurring/non-recurring 혼합 판정 일치
3. completion 생성/삭제 후 completion key 매칭 일치
4. sync 직후 stale -> fresh 전환 검증
5. fallback 경계 정책 동작 확인

## Requirements Traceability Matrix

- R1: Tasks 1
- R2: Tasks 3, 7
- R3: Tasks 6, 12
- R4: Task 3
- R5: Task 4
- R6: Tasks 1, 5
- R7: Tasks 8, 9, 10
- R8: Task 7
- R9: Task 12
- R10: Tasks 2, 11, 13
- R11: Tasks 2, 11, 13
- R12: Task 14

## Out of Scope

1. 화면어댑터 구현/렌더 규칙
2. 서버 API 계약 변경
3. Sync 파이프라인 구조 변경
4. RN 네이티브 자동화 프레임워크 신규 도입
