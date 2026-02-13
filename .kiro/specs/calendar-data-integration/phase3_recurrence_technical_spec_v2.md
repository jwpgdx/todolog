# Phase 3 Technical Spec v2: Recurrence Expansion (rrule-based)

Status: Draft v2 (Implementation pending approval)  
Feature Path: `.kiro/specs/calendar-data-integration/`

## 1. Goal

Phase 3의 목표는 다음 3가지다.

1. 반복 일정(Recurrence)을 캘린더 Dot과 Todo 일일 목록에서 동일한 규칙으로 계산한다.
2. 로컬 SQLite에 반복 종료일을 보존하여 조회 정확도와 성능을 보장한다.
3. 무한 반복/타임존 엣지 케이스를 라이브러리 + 래퍼로 안전하게 통제한다.

---

## 2. Decision Summary

1. 반복 계산 엔진은 커스텀 구현 대신 `rrule` 라이브러리를 사용한다.
2. 계산 API는 `rrule`을 직접 호출하지 않고 클라이언트 래퍼 모듈에서만 호출한다.
3. 무한 반복 방어를 위해 `all()`은 금지하고 `between()`만 허용한다.
4. 날짜 처리는 date-only (`YYYY-MM-DD`) 정책을 유지하고 UTC 변환 래퍼를 강제한다.
5. `recurrence_end_date` 컬럼/인덱스 설계를 유지한다.

---

## 3. Library Policy

## 3.1 라이브러리 명시

- Target package: `rrule`
- Target version: `2.8.1`
- Client/Server 동시 사용 버전 고정: `2.8.1`

## 3.2 버전 관리 전략

1. Client와 Server는 동일한 `rrule` 버전을 유지한다.
2. 업그레이드는 단독 PR로 진행하고, Wrapper 테스트 + 마이그레이션 회귀 테스트 통과를 필수로 한다.
3. Major 또는 Minor 변경 시에는 Phase 3 테스트 스위트를 전체 재실행한다.

---

## 4. Data Integrity and Schema

## 4.1 SQLite Schema (유지)

`todos` 테이블에 아래 컬럼을 추가한다.

- `recurrence_end_date TEXT NULL` (`YYYY-MM-DD`)

추가 인덱스:

- `CREATE INDEX IF NOT EXISTS idx_todos_recurrence_window ON todos(start_date, recurrence_end_date);`

## 4.2 Additional Fields 여부

- 신규 필수 필드는 `recurrence_end_date`만 추가한다.
- `exdates` 등 다른 필드 추가는 Phase 3 범위에서 제외한다.

## 4.3 무결성 규칙

1. 저장 시 `todo.recurrenceEndDate` <-> `recurrence_end_date`를 양방향 직렬화한다.
2. `recurrence` 내부 `UNTIL`과 `recurrence_end_date`가 둘 다 있으면 더 이른 날짜를 유효 종료일로 사용한다.
3. 종료일 정보가 없으면 무한 반복으로 처리한다.

---

## 5. Safety Wrapper Design (UTC + Infinite Guard)

신규 모듈:

- `client/src/utils/recurrenceRRuleAdapter.js`

`rrule` 직접 호출은 이 모듈로만 제한한다.

## 5.1 Public API

1. `expandOccurrenceDates(input): string[]`
2. `occursOnDate(input): boolean`
3. `extractUntilDate(recurrence): string | null`

`input` shape:

- `startDate: string` (`YYYY-MM-DD`)
- `recurrence: string | string[] | null`
- `recurrenceEndDate?: string | null`
- `rangeStart?: string` (`YYYY-MM-DD`)
- `rangeEnd?: string` (`YYYY-MM-DD`)
- `targetDate?: string` (`YYYY-MM-DD`)

Output:

- 날짜 결과는 항상 `YYYY-MM-DD` 배열/불리언으로 반환한다.

## 5.2 UTC date-only 방어 규칙

1. 입력은 date-only 문자열만 허용한다.
2. 내부 변환은 `Date.UTC(y, m-1, d, 0, 0, 0)`로 고정한다.
3. `between()` 경계는 `[rangeStart 00:00:00Z, rangeEnd 23:59:59.999Z]`로 생성한다.
4. 출력은 `getUTCFullYear/getUTCMonth/getUTCDate`로 역직렬화한다.
5. 로컬 타임존 offset 기반 Date 생성(`new Date('YYYY-MM-DD')`)을 금지한다.

## 5.3 무한 반복 방어 규칙

1. `RRule.prototype.all()` 사용 금지.
2. 래퍼는 `between()`만 호출한다.
3. range 길이 상한을 둔다.
- 기본 상한: 548일(약 18개월). 초과 입력 시 에러 또는 안전 절단(clamp) 처리.
4. 월 렌더에서는 42일 범위만 계산한다.

## 5.4 파싱 실패 처리

1. 파싱 실패 시 crash 금지.
2. 경고 로그 기록 후 `startDate` 1회 발생 fallback 적용.
3. 잘못된 rule 데이터는 반환 결과에 영향을 최소화하고 앱 동작은 유지한다.

---

## 6. Query and Integration Changes

## 6.1 SQLite 후보군 필터

`getTodosByDate(date)` 및 캘린더 batch query에서 반복 후보 조건을 다음으로 변경한다.

- `recurrence IS NOT NULL`
- `start_date <= ?`
- `(recurrence_end_date IS NULL OR recurrence_end_date >= ?)`

주의:

- SQL은 후보군 축소 용도다.
- 실제 발생 여부는 Wrapper `occursOnDate()`로 확정한다.

## 6.2 적용 지점

1. `client/src/hooks/queries/useTodos.js`
- 반복 일정 후보를 `occursOnDate()`로 2차 필터링

2. `client/src/features/todo-calendar/ui/MonthSection.js` 또는 `client/src/features/todo-calendar/services/calendarTodoService.js`
- 반복 일정은 `expandOccurrenceDates()`로 날짜별 전개하여 `todosByDate` 생성

---

## 7. Cache Invalidation Strategy

반복 일정 영향 범위를 반영하기 위해 Store 액션을 확장한다.

- 신규 액션: `invalidateRecurringRange(startYear, startMonth, endYear?, endMonth?)`

규칙:

1. 종료일이 있으면 `[start-1month, end+1month]` 범위의 캐시된 월을 삭제한다.
2. 종료일이 없으면 `start-1month` 이후 캐시된 월을 삭제한다.
3. 비반복 일정은 기존 `invalidateAdjacentMonths`를 유지한다.
4. refetch는 기존 `refetchInvalidated` 경로를 그대로 사용한다.

---

## 8. Migration Plan (v4)

## 8.1 Versioning

- `MIGRATION_VERSION: 3 -> 4`
- 신규 함수: `migrateV4AddRecurrenceEndDate()`

## 8.2 Steps

1. `PRAGMA table_info(todos)`로 컬럼 존재 여부 확인
2. 컬럼 없으면 `ALTER TABLE todos ADD COLUMN recurrence_end_date TEXT`
3. 인덱스 생성 `idx_todos_recurrence_window`
4. 백필 실행
- 대상: `recurrence IS NOT NULL AND recurrence_end_date IS NULL`
- `recurrence` JSON에서 `UNTIL` 파싱
- `YYYYMMDD` / `YYYYMMDDTHHmmssZ` -> `YYYY-MM-DD` 변환 후 저장
5. 실패 row는 로그 기록 후 스킵 (graceful degradation)

## 8.3 Existing Data Handling

1. 서버 동기화 데이터의 `recurrenceEndDate`는 SQLite에 영구 보존된다.
2. 로컬 레거시 데이터는 `UNTIL` 백필로 최대한 복구한다.
3. `UNTIL`/`recurrenceEndDate` 모두 없으면 무한 반복으로 유지한다.

---

## 9. Test Plan (Wrapper + Migration 중심)

## 9.1 Wrapper Unit Tests (필수)

1. Daily/Weekly/Monthly/Yearly 발생 계산 검증
2. 월말 31일, 윤년 2/29, BYDAY 누락 검증
3. `UNTIL` + `recurrence_end_date` 동시 존재 시 min-date 규칙 검증
4. 무한 반복에서 `between()`만 사용하는지 검증 (`all()` 호출 금지)
5. UTC 직렬화/역직렬화 고정 검증

## 9.2 Migration Tests (필수)

1. v3 -> v4 마이그레이션 1회 실행 검증
2. 동일 마이그레이션 2회 실행(idempotent) 검증
3. `UNTIL` 백필 성공/실패 케이스 검증
4. 인덱스 생성 확인 검증

## 9.3 Integration Tests (필수)

1. 캘린더 Dot: 반복 일정이 날짜별로 정확 표시되는지 검증
2. TodoScreen: 특정 날짜 필터에서 반복 일정이 과표시/누락 없이 표시되는지 검증
3. 반복 CRUD 후 캐시 무효화 + 재조회 정확성 검증

---

## 10. Implementation Order (after v2 approval)

1. Client에 `rrule@2.8.1` 추가
2. DB v4 마이그레이션 + `todoService` 직렬화 반영
3. `recurrenceRRuleAdapter` 구현 + 단위 테스트
4. `useTodos` 및 캘린더 경로에 Wrapper 적용
5. recurring range invalidation 적용
6. 통합 테스트 및 성능 측정

