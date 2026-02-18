# Phase 3 Recurrence Engine Core - 1페이지 요약

## 목적

Phase 3를 3단계로 나눌 때, 현재 문서는 **1단계(엔진 확정)**만 다룬다.

1. 엔진 확정 (현재)
2. 공통 경로 연결 (`useTodos`, `todo-calendar`)
3. strip-calendar UI 연동

## 이번 단계에서 반드시 끝내야 할 것

1. `rrule` 라이브러리 없이 반복 계산 코어 확정
2. `YYYY-MM-DD` date-only 계약 강제 (`dayjs` 사용 권장, 동등한 date-only 처리도 허용)
3. `recurrence_end_date` 기반 DB 무결성/성능 계약 확정
4. 그린필드 기준 최신 스키마 초기화 경로 확정

## 절대 하지 않는 것 (이번 단계)

1. UI 컴포넌트 연동/수정
2. strip-calendar 데이터 경로 연결
3. mode transition / 스크롤 정책 변경

## 구현 핵심 파일

1. `client/src/utils/recurrenceEngine.js` (신규)
2. `client/src/utils/routineUtils.js` (파서 강화)
3. `client/src/utils/recurrenceUtils.js` (호환 래퍼 정리)
4. `client/src/services/db/database.js` (최신 스키마 초기화 경로)

## 엔진 API (확정 대상)

1. `normalizeRecurrence(rawRecurrence, recurrenceEndDate?)`
2. `occursOnDateNormalized(normalizedRule, targetDate)`
3. `expandOccurrencesInRange(normalizedRule, rangeStart, rangeEnd)`

## 필수 정책

1. 금지 API: `new Date`, `Date.parse`, `toISOString().split('T')[0]`
2. 입력/출력 날짜: `YYYY-MM-DD`
3. 종료일 우선순위: `UNTIL` + `recurrenceEndDate` 규칙 고정
4. 엣지케이스 정책 고정:
   - 31일 월간 반복 + 짧은 월: skip
   - 2/29 yearly: 윤년만

## DB/스키마 정책

1. `recurrence_end_date TEXT NULL`
2. 인덱스: `(start_date, recurrence_end_date)`
3. 후보군 SQL 필터 + 엔진 최종 판정 분리
4. 그린필드 단계에서는 DB 리셋/재생성 허용
5. legacy backfill은 본 단계 필수 범위 아님

## 완료 기준 (Done Definition)

1. R1~R10 요구사항 충족
2. 엔진 단위 검증 통과 (파서/정규화/빈도/엣지)
3. 스키마 초기화 후 recurrence 컬럼/인덱스 스모크 검증
4. 금지 API 정적 검사 통과
5. 2단계(공통 경로 연결) 착수 가능한 상태로 문서/코드 기준 확정

## 참고 문서

1. `./requirements.md`
2. `./design.md`
3. `./tasks.md`
4. `.kiro/specs/[보류]strip-calendar-phase3-integration/phase3_recurrence_technical_spec_v3.md` (원본 참고)
