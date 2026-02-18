# Phase 3 Technical Spec v3: Recurrence Engine (Custom Regex + dayjs)

Status: Draft v3 (Implementation pending approval)  
Feature Path: `.kiro/specs/strip-calendar-phase3-integration/`  
Supersedes: `phase3_recurrence_technical_spec_v2.md`
Legacy Reference: `.kiro/specs/calendar-data-integration/phase3_recurrence_technical_spec_v3.md`

## 1. Goal

Phase 3의 목표는 다음 4가지다.

1. `rrule` 라이브러리 없이 반복 일정 계산을 안정적으로 수행한다.
2. 타임존 오차(Off-by-one)를 제거하기 위해 date-only + dayjs 문자열 비교 정책을 강제한다.
3. SQLite에 `recurrence_end_date`를 저장/인덱싱하여 성능과 무결성을 유지한다.
4. 마이그레이션 시 UI 블로킹을 피하기 위해 100개 단위 배치 처리로 전환한다.

---

## 2. Core Decisions (Critical)

1. `rrule` 도입 취소:
- Client에 `rrule` 패키지를 추가하지 않는다.
- 기존 Regex 파서 기반 유틸(`client/src/utils/routineUtils.js`)을 확장하여 사용한다.

2. 날짜 처리 원칙:
- Recurrence Engine 내부에서 `new Date()` 사용 금지.
- `dayjs` + `YYYY-MM-DD` 문자열 기반 계산/비교만 허용.

3. 마이그레이션 성능:
- `initDatabase`의 백필은 100개 단위 트랜잭션으로 실행한다.
- 배치 사이에 이벤트 루프를 양보하여 장시간 점유를 완화한다.

4. 포맷 정규화:
- `normalizeRecurrence()`에서 JSON 객체 규칙 + RRULE 문자열 규칙을 모두 처리한다.

---

## 3. Recurrence Engine Architecture

신규 모듈:

- `client/src/utils/recurrenceEngine.js`

기존 모듈 재사용/강화:

- `client/src/utils/routineUtils.js` (Regex 파서 강화)
- `client/src/utils/recurrenceUtils.js` (기존 API 호환 래퍼 일부 유지)

## 3.1 Public API

1. `normalizeRecurrence(rawRecurrence, recurrenceEndDate?)`
2. `occursOnDateNormalized(normalizedRule, targetDate)`
3. `expandOccurrencesInRange(normalizedRule, rangeStart, rangeEnd)`
4. `extractUntilFromRRule(rruleString)` (내부 유틸)

입력/출력 포맷:

- 입력 날짜: `YYYY-MM-DD`
- 출력 날짜: `YYYY-MM-DD`
- 내부 비교: `dayjs(dateStr, 'YYYY-MM-DD', true)` 기반

## 3.2 Normalized Rule Shape

```js
{
  sourceType: 'rrule_string' | 'json_object' | 'unknown',
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly' | null,
  byDay: string[] | null,       // ['MO','WE']
  byMonthDay: number[] | null,  // [1,15,31]
  byMonth: number[] | null,     // [2,12]
  until: string | null,         // 'YYYY-MM-DD'
  startDate: string | null,     // 'YYYY-MM-DD'
}
```

---

## 4. Format Normalization Rules (JSON + RRULE)

## 4.1 Supported Inputs

1. RRULE 문자열:
- 예: `RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261231T235959Z`

2. JSON 객체:
- 예:
```js
{
  frequency: 'weekly',
  weekdays: [1,3],     // Monday, Wednesday
  dayOfMonth: [15],
  month: [1,6],
  until: '2026-12-31'
}
```

3. 문자열 배열:
- 예: `['RRULE:FREQ=DAILY;UNTIL=20261231T235959Z']`

## 4.2 Normalization Priority

1. `rawRecurrence`에서 `until` 추출
2. 별도 필드 `recurrenceEndDate` 반영
3. 유효 종료일 = 두 값 중 더 이른 날짜
4. 둘 다 없으면 무한 반복

## 4.3 Invalid Input Handling

1. 파싱 실패 시 crash 금지
2. `sourceType='unknown'`으로 정규화
3. fallback: `startDate` 1회성 이벤트로 처리
4. 경고 로그는 남기되 UI는 계속 동작

## 4.4 Date-only 정규화 규칙 (필수)

1. `recurrenceEndDate`는 `YYYY-MM-DD | null`만 허용한다.
2. ISO 8601 문자열 입력은 허용하지 않으며 invalid로 처리한다.
3. `recurrence`에 `UNTIL`이 있으면 `UNTIL` 파싱 결과를 우선 소스로 사용하고, `recurrenceEndDate`는 보조 소스로 사용한다.
4. `iso.slice(0, 10)` 방식은 금지한다.

---

## 5. Timezone Defense: `new Date()` Prohibition

## 5.1 Mandatory Rule

Recurrence Engine(`recurrenceEngine.js`, `routineUtils.js` 강화 영역)에서는 아래를 금지한다.

- `new Date(...)`
- `Date.parse(...)`
- `toISOString().split('T')[0]` 기반 비교

## 5.2 Allowed Operations

1. `dayjs('YYYY-MM-DD', 'YYYY-MM-DD', true)` strict parsing
2. `isBefore/isAfter/isSame`
3. `add/subtract` with `'day' | 'month' | 'year'`
4. `format('YYYY-MM-DD')`

## 5.3 Date-only Comparison Contract

1. Engine은 시간 정보를 다루지 않는다.
2. 비교 단위는 항상 day 단위다.
3. 입력이 date-only가 아니면 invalid로 처리한다.

---

## 6. Recurrence Semantics (Custom Regex Engine)

## 6.1 Frequency Behavior

1. Daily: 시작일 이후 매일 발생
2. Weekly:
- `BYDAY`가 있으면 해당 요일만 발생
- `BYDAY`가 없으면 시작일 요일 기준
3. Monthly:
- `BYMONTHDAY` 우선
- 없으면 시작일 day-of-month 기준
4. Yearly:
- `BYMONTH` + `BYMONTHDAY` 우선
- 없으면 시작일 month/day 기준

## 6.2 Edge Cases

1. 31일 반복 + 2월:
- 정책: skip (보정 없음)

2. 2/29 yearly:
- 윤년만 발생

3. `rangeEnd < rangeStart`:
- 빈 배열 반환

4. `until < startDate`:
- 빈 배열 반환

## 6.3 Infinite Recurrence Guard

1. 엔진 출력 함수는 반드시 range 입력을 받는다.
2. 최대 range 제한:
- 기본 548일(약 18개월) 초과 시 clamp 또는 에러
3. `expandOccurrencesInRange`는 range 밖 계산 금지

---

## 7. Data Integrity: `recurrence_end_date` (Keep)

## 7.1 SQLite Schema

`todos` 테이블 변경(유지):

- `recurrence_end_date TEXT NULL` (`YYYY-MM-DD`)

추가 인덱스(유지):

- `CREATE INDEX IF NOT EXISTS idx_todos_recurrence_window ON todos(start_date, recurrence_end_date);`

## 7.2 Query Filtering

반복 후보 쿼리 공통 조건:

- `recurrence IS NOT NULL`
- `start_date <= ?`
- `(recurrence_end_date IS NULL OR recurrence_end_date >= ?)`

주의:

- SQL은 후보군 필터
- 최종 판정은 `occursOnDateNormalized()`로 확정

## 7.3 API 계약 정리 (정합성)

1. Client -> Server:
- `startDate`, `endDate`, `recurrenceEndDate`는 `YYYY-MM-DD | null` 문자열로 전송한다.
- `startTime`, `endTime`은 `HH:mm | null` 문자열로 전송한다.
- Recurrence Engine 내부에서는 Date 객체를 사용하지 않는다.

2. Server 내부:
- Todo 도메인 저장 필드는 문자열 계약을 유지한다.
- Google Adapter는 `startDate/startTime/endDate/endTime` 문자열 + `user.settings.timeZone`으로 payload를 생성한다.
- 반복 계산/필터 기준 날짜는 date-only 문자열만 사용한다.

3. Server -> Client:
- 일정 필드는 Client/Server 동일 문자열 계약(`YYYY-MM-DD`, `HH:mm`, `null`)을 유지한다.

---

## 8. Migration Plan v4 (Batch Optimized)

## 8.1 Versioning

- `MIGRATION_VERSION: 3 -> 4`
- 신규 함수: `migrateV4AddRecurrenceEndDateBatch()`

## 8.2 Batch Strategy

1. 컬럼/인덱스 생성은 1회 실행
2. 백필 대상 row를 조회
3. 100개 단위로 분할 처리
4. 각 배치마다 `db.withTransactionAsync` 실행
5. 배치 완료 후 이벤트 루프 양보:
- `await new Promise(resolve => setTimeout(resolve, 0))`

## 8.3 Backfill Logic

1. 대상:
- `recurrence IS NOT NULL AND recurrence_end_date IS NULL`

2. 소스 파싱:
- RRULE 문자열의 `UNTIL=...`
- JSON 객체의 `until`

3. 변환:
- `YYYYMMDD`, `YYYYMMDDTHHmmssZ`, `YYYY-MM-DD`를 `YYYY-MM-DD`로 정규화

4. 실패 처리:
- 실패 row는 스킵 + 로그
- 전체 마이그레이션은 계속 진행

## 8.4 Idempotency

1. 컬럼 이미 존재 시 skip
2. 인덱스 이미 존재 시 skip
3. 이미 `recurrence_end_date` 채워진 row는 skip

---

## 9. Integration Points

1. `client/src/hooks/queries/useTodos.js`
- 반복 후보를 engine으로 2차 필터링

2. `client/src/features/strip-calendar/services/stripCalendarDataAdapter.js`
- `ensureRangeLoaded({startDate,endDate,reason})` 경로에서 recurrence-aware summary를 로드한다.
- `selectDaySummaries({startDate,endDate})` 경로에서 캐시된 요약을 UI에 제공한다.

3. `client/src/features/strip-calendar/services/stripCalendarSummaryService.js`
- 일자 summary(`date`, `hasTodo`, `uniqueCategoryColors`, `dotCount`)를 생성한다.
- recurrence 판정은 엔진 결과를 사용하며 UI 레이어에서 반복 계산을 재구현하지 않는다.

4. `client/src/features/strip-calendar/hooks/useStripCalendarDataRange.js`
- weekly/monthly settle 이벤트 기준으로만 `ensureRangeLoaded`를 트리거한다.
- per-frame `onScroll` fetch를 금지한다.

5. `client/src/features/todo-calendar/*` (Legacy compatibility path)
- 기존 month-grid 캘린더 경로는 호환 대상이며, strip-calendar 경로가 1순위 소비자다.

---

## 10. Test Plan (v3)

## 10.1 Engine Unit Tests

1. RRULE 문자열 파싱 (FREQ/BYDAY/BYMONTHDAY/BYMONTH/UNTIL)
2. JSON 객체 파싱 (frequency/weekdays/dayOfMonth/month/until)
3. normalize 우선순위 (`until` vs `recurrenceEndDate`)
4. daily/weekly/monthly/yearly 날짜 전개 정확성
5. 월말/윤년 edge case
6. invalid rule fallback
7. `new Date()` 미사용 정적 검사 (lint rule or grep check)

## 10.2 Migration Tests

1. v3 -> v4 1회 실행 성공
2. 2회 실행 idempotent
3. 100개 배치 경계(99/100/101/1000건) 검증
4. 배치 실패 row가 있어도 다음 row 진행되는지 검증

## 10.3 Integration Tests

1. 캘린더 Dot: 반복 일정 누락/과표시 없음
2. TodoScreen: 특정 날짜 필터 정확성
3. 반복 CRUD 후 invalidation + refetch 정확성
4. 앱 초기 구동 시 마이그레이션 중 UI freeze 회귀 점검
5. Strip weekly/monthly 동일 날짜 summary 일관성 검증
6. Strip mode 전환/스크롤 중 per-frame recurrence fetch 미발생 검증
7. Strip monthly settle 기반 range load/캐시 hit 동작 검증

---

## 11. Implementation Order (after v3 approval)

1. v3 스펙 기준으로 `routineUtils.js` Regex 파서 확장
2. `recurrenceEngine.js` 구현 (`dayjs` + 문자열 비교)
3. DB v4 배치 마이그레이션 구현
4. `useTodos` + strip-calendar adapter/summary 경로에 engine 적용
5. strip/todo-calendar 양쪽 캐시 무효화 범위 정합성 확장
6. strip-calendar runtime flag 경로 검증 (`ENABLE_STRIP_CALENDAR_SUMMARY`)
7. 테스트 및 성능 검증
