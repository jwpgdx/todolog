# Implementation Plan: Phase 3 Recurrence Engine Core

## Overview

본 계획은 `requirements.md`의 엔진 확정 범위만 구현한다.

순서:

1. 엔진 코어 확정
2. 스키마 초기화 정합성 확정
3. 검증 체크포인트 완료

## Tasks

- [ ] 1. 엔진 골격 확정
  - 엔진 모듈 생성
  - 정규화/판정/전개 API 경계 확정
  - 금지 date-handling 패턴 가드 기준 명시
  - _Requirements: R1, R3, R4_

- [ ] 2. 입력 정규화 구현
  - RRULE/object/array 입력 지원
  - unknown-safe fallback 경로 구현
  - _Requirements: R2, R3_

- [ ] 3. 종료일 해석 규칙 구현
  - source 종료일 + 별도 종료일 우선순위 고정
  - invalid 종료일 처리 규칙 적용
  - _Requirements: R5_

- [ ] 4. 빈도 판정 구현
  - daily/weekly/monthly/yearly 판정 규칙 확정
  - weekday/monthday/month 제약 반영
  - _Requirements: R6_

- [ ] 5. 엣지/범위 가드 구현
  - 월말/윤년 정책 반영
  - 역범위/종료일 역전 처리
  - 범위 가드 적용
  - _Requirements: R7_

- [ ] 6. DB 계약 점검
  - recurrence end-date 필드/인덱스 계약 확인
  - SQL prefilter + 엔진 최종 판정 분리 검증
  - _Requirements: R8_

- [ ] 7. 그린필드 초기화 경로 점검
  - 최신 스키마 초기화/재생성 경로 확인
  - 초기화 후 recurrence 관련 스모크 검증
  - _Requirements: R9_

- [ ] 8. Checkpoint A - 엔진 동작 검증
  - 포맷별 정규화 검증
  - frequency별 판정 검증
  - _Requirements: R2, R5, R6_

- [ ] 9. Checkpoint B - 안정성 검증
  - 엣지케이스/범위 가드 검증
  - _Requirements: R7_

- [ ] 10. Checkpoint C - 스키마 검증
  - 컬럼/인덱스 존재 및 후보군 쿼리 스모크 검증
  - _Requirements: R8, R9_

- [ ] 11. 단위 테스트 추가
  - 정규화/판정/전개/엣지 테스트
  - _Requirements: R2, R5, R6, R7, R10_

- [ ] 12. 정적 안전성 검사 추가
  - 금지 date-handling 패턴 검사
  - _Requirements: R4, R10_

- [ ] 13. Final checkpoint - 엔진 확정
  - R1~R10 충족 여부 확인
  - 2단계 착수 인수조건 정리
  - _Requirements: R1-R10_

## Requirements Traceability Matrix

- R1: Tasks 1
- R2: Tasks 2, 8, 11
- R3: Tasks 1, 2
- R4: Tasks 1, 12
- R5: Tasks 3, 8, 11
- R6: Tasks 4, 8, 11
- R7: Tasks 5, 9, 11
- R8: Tasks 6, 10
- R9: Tasks 7, 10
- R10: Tasks 11, 12, 13

## Notes

1. 테스트 태스크(11, 12)는 R10 충족을 위해 필수 수행한다.
2. 공통 경로 연결과 strip UI 연동은 다음 단계 문서에서 다룬다.
