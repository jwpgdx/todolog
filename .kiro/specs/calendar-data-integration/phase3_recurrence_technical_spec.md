# Phase 3 Technical Spec: Recurrence Expansion & Data Integrity

Status: Draft (Implementation pending approval)
Feature Path: `.kiro/specs/calendar-data-integration/`

## 1. Goal

Phase 3의 목표는 아래 3가지를 동시에 달성하는 것이다.

1. 반복 일정(Recurrence)을 캘린더 Dot/일일 Todo 목록에서 동일한 규칙으로 계산한다.
2. 로컬 SQLite에 반복 종료일을 보존하여 조회 정확도와 쿼리 효율을 개선한다.
3. 반복 일정 CRUD 시 캐시 무효화 범위를 실제 영향 범위에 맞게 확장한다.

---

## 2. Scope / Non-scope

### In Scope

- SQLite 스키마 확장 (`recurrence_end_date`)
- 공통 반복 계산기 도입 (캘린더 + TodoScreen 공용)
- 반복 일정 전용 캐시 무효화 범위 개선
- 기존 데이터 백필(backfill) 마이그레이션

### Out of Scope

- Google Calendar 양방향 고급 RRULE 완전 편집 UI
- `EXDATE` 저장/편집 기능 신규 추가
- 과거 아카이브 스크린 리뉴얼

---

## 3. Data Model & DB Schema Change

## 3.1 Required DB Changes

`client/src/services/db/database.js`의 `todos` 테이블에 아래 컬럼 추가:

- `recurrence_end_date TEXT NULL` (format: `YYYY-MM-DD`)

추가 인덱스:

- `CREATE INDEX IF NOT EXISTS idx_todos_recurrence_window ON todos(start_date, recurrence_end_date);`

## 3.2 Additional Fields 여부

- **필수 추가 필드 없음**
- Phase 3에서 신규 필수 컬럼은 `recurrence_end_date` 하나만 추가한다.
- `exdates` 등 추가 필드는 이번 단계에서 도입하지 않는다.

## 3.3 Serialization Contract (Client SQLite)

- write: `todo.recurrenceEndDate` -> `recurrence_end_date`
- read: `recurrence_end_date` -> `todo.recurrenceEndDate`
- 포맷 통일: 내부 저장은 항상 `YYYY-MM-DD` 문자열

---

## 4. Common Recurrence Engine Design

공통 모듈(신규):

- `client/src/utils/recurrenceEngine.js`

공용 API:

1. `normalizeRecurrence(todo)`
2. `occursOnDate(todo, targetDate)`
3. `expandOccurrencesInRange(todo, rangeStart, rangeEnd)`
4. `getEffectiveRecurrenceEndDate(todo)`

## 4.1 Accepted Input Shape

- `todo.startDate`: `YYYY-MM-DD` (required for recurrence)
- `todo.recurrence`: `string | string[] | null`
- `todo.recurrenceEndDate`: `YYYY-MM-DD | null`
- `todo.endDate`: period todo 처리용

## 4.2 Supported Rule Subset

- `FREQ=DAILY`
- `FREQ=WEEKLY` (+ optional `BYDAY`)
- `FREQ=MONTHLY` (+ optional `BYMONTHDAY`)
- `FREQ=YEARLY` (+ optional `BYMONTH`, `BYMONTHDAY`)
- `UNTIL` 지원 (`RRULE` 내부 값 + 별도 컬럼 병행)

정합성 규칙:

- `effectiveUntil = min(rrule.until, recurrenceEndDate)` (둘 다 있으면 더 이른 날짜)
- 둘 중 하나만 있으면 그 값을 사용
- 둘 다 없으면 무한 반복

## 4.3 Input/Output Examples

### Example A: Daily

Input Rule:

- `startDate=2026-02-10`
- `recurrence=RRULE:FREQ=DAILY;UNTIL=20260213T235959Z`

`expandOccurrencesInRange(todo, 2026-02-01, 2026-02-28)` Output:

- `[2026-02-10, 2026-02-11, 2026-02-12, 2026-02-13]`

### Example B: Weekly BYDAY

Input Rule:

- `startDate=2026-02-01`
- `recurrence=RRULE:FREQ=WEEKLY;BYDAY=MO,WE`

Range:

- `2026-02-01 ~ 2026-02-14`

Output:

- `[2026-02-02, 2026-02-04, 2026-02-09, 2026-02-11]`

### Example C: Monthly 31st

Input Rule:

- `startDate=2026-01-31`
- `recurrence=RRULE:FREQ=MONTHLY;BYMONTHDAY=31`

Range:

- `2026-01-01 ~ 2026-04-30`

Output:

- `[2026-01-31, 2026-03-31]`

(2월/4월은 31일이 없으므로 skip)

---

## 5. Exception / Edge Case Policy

## 5.1 월말 예외 (31일 반복, 2월)

- 정책: **skip** (보정하여 말일로 당기지 않음)
- 이유: RFC RRULE 의미와 서버(`rrule`) 동작과의 정합성 유지

## 5.2 윤년 예외 (2/29 yearly)

- 윤년이 아닌 해는 skip

## 5.3 Weekly BYDAY 누락

- `BYDAY`가 없으면 `startDate`의 요일을 기본 반복 요일로 사용

## 5.4 Invalid Rule

- 파싱 실패 시:
  - crash 금지
  - warning 로그 기록
  - fallback: `startDate` 단일 발생으로 취급

## 5.5 Invalid Date Range

- `rangeEnd < rangeStart` => 빈 배열 반환
- `effectiveUntil < startDate` => 빈 배열 반환

---

## 6. Query & Integration Changes

## 6.1 SQLite Query Filter 개선

### `getTodosByDate(date)`

기존 조건:

- `recurrence IS NOT NULL AND start_date <= ?`

변경 조건:

- `recurrence IS NOT NULL`
- `AND start_date <= ?`
- `AND (recurrence_end_date IS NULL OR recurrence_end_date >= ?)`

주의:

- SQL은 후보군(candidates)만 줄여주고,
- 최종 포함 여부는 `occursOnDate(todo, date)`로 확정한다.

### `fetchCalendarDataForMonths(...)`

반복 일정 후보 쿼리에도 동일 조건 적용:

- `start_date <= globalEnd`
- `(recurrence_end_date IS NULL OR recurrence_end_date >= globalStart)`

월별 날짜 Dot 매핑 단계에서 `expandOccurrencesInRange(todo, monthRangeStart, monthRangeEnd)` 사용.

## 6.2 Shared Engine 적용 지점

1. `client/src/hooks/queries/useTodos.js`
- `getTodosByDate()` 결과 중 반복 일정은 `occursOnDate()`로 2차 필터

2. `client/src/features/todo-calendar/ui/MonthSection.js` 또는 서비스 레이어
- 반복 일정은 `expandOccurrencesInRange()`로 날짜별 전개 후 `todosByDate` 생성

권장:

- Phase 3 최소 변경 기준에서는 `MonthSection`의 `useMemo` 내부 전개 유지
- 단, 반복 분기만 공통 엔진 사용

---

## 7. Cache Invalidation Strategy (Phase 3)

## 7.1 문제

현재 `invalidateAdjacentMonths(year, month)`(±1개월)는 반복 일정의 장기 영향 범위를 반영하지 못함.

## 7.2 신규 액션

`todoCalendarStore`에 액션 추가:

- `invalidateRecurringRange(startYear, startMonth, endYear?, endMonth?)`

동작:

- end가 있으면: `[start-1month, end+1month]` 구간의 **캐시된 월만** 삭제
- end가 없으면: `[start-1month, +infinity)` 대신 **현재 캐시된 월 중 start-1 이후 월만** 삭제

## 7.3 Mutation Hook Rules

- Create recurring: 새 규칙 범위 invalidate
- Update recurring:
  - old rule 범위 invalidate
  - new rule 범위 invalidate
- Delete recurring: old rule 범위 invalidate
- Non-recurring: 기존 `invalidateAdjacentMonths` 유지

이후 refetch 트리거는 기존 `refetchInvalidated` 흐름 유지.

---

## 8. Performance Strategy

## 8.1 원칙

- 스크롤 렌더에서 “매 셀 × 매 todo 전체 탐색”을 피한다.
- 월 단위(42일 range)로 한 번만 계산하고 재사용한다.

## 8.2 계산 복잡도 설계

- 비반복: 기존 O(period length)
- 반복:
  - Daily: O(days in range)
  - Weekly: O(number of matched weekdays)
  - Monthly/Yearly: O(number of months/years in range)

월 렌더 기준(range=42일)에서는 충분히 제한적이다.

## 8.3 Memoization / Caching

모듈 내부 LRU 캐시(메모리 한정):

- `compiledRuleCache`: key = `recurrenceRaw`
- `occurrenceRangeCache`: key = `${todoId}|${updatedAt}|${rangeStart}|${rangeEnd}`

`MonthSection`는 기존 `useMemo([todos])` 유지.

목표:

- 기존 스크롤 체감 성능(60fps) 유지
- recurrence todo가 많은 월에서도 month 계산 < 16ms 목표

---

## 9. Existing Data Migration Strategy

## 9.1 Migration Version

- `MIGRATION_VERSION: 3 -> 4`
- 신규 함수: `migrateV4AddRecurrenceEndDate()`

## 9.2 V4 Steps

1. `PRAGMA table_info(todos)`로 컬럼 존재 확인
2. 없으면 `ALTER TABLE todos ADD COLUMN recurrence_end_date TEXT`
3. 인덱스 생성 (`idx_todos_recurrence_window`)
4. 백필:
   - 대상: `recurrence IS NOT NULL AND recurrence_end_date IS NULL`
   - `recurrence`(JSON string)에서 `UNTIL=...` 추출
   - `YYYYMMDD` 또는 `YYYYMMDDTHHmmssZ` -> `YYYY-MM-DD` 변환
   - 추출 성공 시 `recurrence_end_date` 업데이트
5. 실패 row는 로그만 남기고 스킵 (앱 실행 지속)

## 9.3 기존 반복 일정 처리 결과

- 서버에서 내려온 `recurrenceEndDate`는 이제 SQLite에 영구 저장됨
- 과거 로컬 데이터는 RRULE `UNTIL` 기반 백필로 복원
- `UNTIL`도 없고 `recurrenceEndDate`도 없는 데이터는 무한 반복으로 유지

---

## 10. Validation Plan

## 10.1 Unit Tests (필수)

- recurrence parser: freq/byday/bymonthday/until 파싱
- `occursOnDate` edge cases (31일/윤년/invalid rule)
- `expandOccurrencesInRange` correctness

## 10.2 Migration Tests (필수)

- v3 -> v4 실제 마이그레이션
- UNTIL 백필 성공/실패 케이스
- idempotency (2회 실행 안전)

## 10.3 Integration Tests (필수)

- 캘린더 Dot: weekly/monthly/yearly 반복 표시
- TodoScreen: 특정 날짜에서 recurrence 정확 필터
- 반복 일정 CRUD 후 캐시 invalidation + 재조회

---

## 11. Risks & Mitigation

1. Risk: 클라이언트/서버 RRULE 해석 차이
- Mitigation: Rule subset 고정 + edge case 테스트 강화

2. Risk: 무한 반복 일정 대량 계산
- Mitigation: range 기반 계산 + 캐시 + 쿼리 후보 축소

3. Risk: 기존 데이터의 UNTIL 형식 불일치
- Mitigation: 다중 패턴 파싱 + 실패 row graceful skip

---

## 12. Implementation Order (after approval)

1. DB v4 마이그레이션 + `todoService` serialize/deserialize 반영
2. `recurrenceEngine` 추가 + 단위 테스트
3. `useTodos`에 recurrence 2차 필터 적용
4. 캘린더 recurrence 전개(`MonthSection` 또는 서비스) 적용
5. recurring range invalidation 액션/훅 반영
6. 통합 테스트 & 성능 측정

