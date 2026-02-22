# Implementation Plan: 화면어댑터 레이어

## Overview

본 계획은 공통 조회/집계 레이어 출력(Handoff DTO)을 화면별 렌더 shape로 연결하는 작업을 정의한다.

선행조건:

1. 공통 조회/집계 레이어 Checkpoint C 이상 완료
2. handoff DTO 계약 확정
3. 공통 레이어 검증 로그(`.kiro/specs/common-query-aggregation-layer/log.md`) 확인 완료

## Task List

- [x] 0. 상위 레이어 완료 상태 고정 확인
  - Checkpoint C 완료 여부 재확인
  - 입력 계약(Handoff DTO + meta) 고정 스냅샷 기록
  - _Requirements: A0_

- [x] 1. Adapter 타입/입력 계약 파일 생성
  - `adapters/types.js` 생성
  - handoff DTO 입력 타입 주석 고정
  - _Requirements: A0, A1_

- [x] 2. TodoScreen Adapter 구현
  - day-list 변환
  - completion/category 메타 유지
  - _Requirements: A2_

- [x] 3. TodoScreen 경로 전환
  - `useTodos`가 TodoScreen adapter 사용
  - 기존 화면 병합 코드 제거/축소
  - _Requirements: A1, A2, A5_

- [x] 4. TodoCalendar Adapter 구현
  - date-keyed events 변환
  - 이벤트 바 메타 + day cap 메타 출력
  - _Requirements: A3_

- [x] 5. TodoCalendar 경로 전환
  - 캘린더 데이터 경로를 adapter 기반으로 정리
  - 기존 중복 그룹핑 코드 제거/축소
  - 공통 레이어 `itemsByDate`를 기존 `todoCalendarStore` shape(`todosByMonth`/`completionsByMonth`)로 브릿지 변환
  - `todoCalendarStore`는 Phase 1에서 유지하고, 데이터 소스만 adapter 경유로 전환
  - _Requirements: A1, A3, A5_

- [x] 6. StripCalendar Adapter 구현
  - day-summary 변환
  - 카테고리 dot dedupe + overflow 메타 출력
  - _Requirements: A4_

- [x] 7. StripCalendar 경로 전환
  - strip summary 경로를 adapter 기반으로 정리
  - 중복 recurrence/summary 해석 코드 제거
  - adapter 전환 완료 후 `ENABLE_STRIP_CALENDAR_SUMMARY` 플래그를 `true`로 전환(또는 플래그 제거)
  - `stripCalendarStore`는 Phase 1에서 유지하고, 데이터 소스만 adapter 경유로 전환
  - _Requirements: A1, A4, A5_

- [x] 8. DebugScreen 화면 비교 기능 연결
  - `화면 결과 비교` 버튼으로 3화면 count/ID diff 출력
  - _Requirements: A6, A7_

- [x] 9. 통합 검증
  - 동일 입력에서 3화면 결과 일치 검증
  - day cap/overflow 규칙 동작 검증
  - _Requirements: A5, A7_

## Checkpoints

- [x] Checkpoint SA-1: TodoScreen adapter 완료
  - Tasks 0~3 완료

- [x] Checkpoint SA-2: TodoCalendar adapter 완료
  - Tasks 4~5 완료

- [x] Checkpoint SA-3: StripCalendar adapter 완료
  - Tasks 6~7 완료

- [x] Checkpoint SA-4: 비교/검증 완료
  - Tasks 8~9 완료

## Requirements Traceability Matrix

- A0: Tasks 0, 1
- A1: Tasks 1, 3, 5, 7
- A2: Tasks 2, 3
- A3: Tasks 4, 5
- A4: Tasks 6, 7
- A5: Tasks 3, 5, 7, 9
- A6: Task 8
- A7: Tasks 8, 9

## Out of Scope

1. 공통 조회/판정/병합 로직 변경
2. recurrenceEngine 내부 구현 변경
3. 서버/Sync 파이프라인 구조 변경
