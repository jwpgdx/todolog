# Requirements Document: Calendar Data Integration

## Introduction

Calendar Data Integration은 Phase 1에서 구현된 무한 스크롤 캘린더 UI에 SQLite Todo/Completion 데이터를 연동하는 기능입니다. 6주 패딩 범위를 고려한 효율적인 데이터 조회, 별도 캐시 관리, Selector 패턴을 통한 성능 최적화를 통해 60fps를 유지하면서 Todo 데이터를 캘린더 그리드에 표시합니다.

Phase 2는 데이터 연동에 집중하며, 날짜 클릭 이벤트나 상세 UI는 향후 Phase로 미룹니다.

## Glossary

- **Calendar_System**: 무한 스크롤 캘린더 전체 시스템 (Phase 1에서 구현됨)
- **Todo_Calendar_Store**: 캘린더 전용 Todo/Completion 데이터 캐시 (Zustand)
- **Month_Metadata**: 월 단위 메타데이터 객체 `{year, month, id}` (Phase 1에서 정의됨)
- **Six_Week_Padding**: 6주 고정 레이아웃으로 인해 발생하는 이전/다음 월 날짜 범위
- **Calendar_Date_Range**: 특정 월의 6주 그리드가 커버하는 실제 날짜 범위 (예: 2026-02는 1/26~3/8)
- **Batch_Fetch**: 여러 월의 데이터를 1회 SQL 쿼리로 조회하는 최적화 기법
- **Selector_Pattern**: Zustand에서 특정 데이터만 구독하여 불필요한 리렌더링 방지
- **Visible_Range**: 현재 화면에 보이는 월 범위
- **Prefetch_Buffer**: Visible_Range 앞뒤로 추가 조회할 월 개수 (±2개월)
- **Cache_Invalidation**: Todo CRUD 후 캐시를 무효화하여 다음 조회 시 최신 데이터 반영
- **Adjacent_Months**: 특정 월의 이전 월과 다음 월 (6주 패딩으로 인해 영향받는 범위)
- **Todo_Dot**: 캘린더 날짜 셀에 표시되는 Todo 존재 표시 (점 또는 마커)
- **Completion_Status**: Todo의 완료 여부 (completions 테이블 조회)

## Requirements

### Requirement 1: 6주 패딩 인식 날짜 범위 계산

**User Story:** 개발자로서, 6주 고정 레이아웃으로 인해 발생하는 이전/다음 월 날짜를 포함한 정확한 범위를 계산하고 싶습니다.

#### Acceptance Criteria

1. THE Calendar_System SHALL provide a function `getCalendarDateRange(year, month, startDayOfWeek)` that returns Calendar_Date_Range
2. WHEN calculating Calendar_Date_Range for 2026-02 with startDayOfWeek=0, THEN THE function SHALL return `{startDate: '2026-01-25', endDate: '2026-03-07'}` (Note: 2026-02-01 is Sunday)
3. THE `getCalendarDateRange` function SHALL use the same grid start calculation logic as `generateWeeks` function
4. WHEN startDayOfWeek is 1 (Monday), THEN THE Calendar_Date_Range SHALL start from the previous Monday
5. WHEN startDayOfWeek is 0 (Sunday), THEN THE Calendar_Date_Range SHALL start from the previous Sunday

### Requirement 2: 캘린더 전용 데이터 캐시

**User Story:** 개발자로서, 캘린더 데이터를 별도 Zustand Store로 관리하여 기존 Todo 캐시와 분리하고 싶습니다.

#### Acceptance Criteria

1. THE Calendar_System SHALL create a separate Zustand store named `todoCalendarStore`
2. THE Todo_Calendar_Store SHALL store todos by month using key format 'YYYY-MM'
3. THE Todo_Calendar_Store SHALL store completions by month using key format 'YYYY-MM'
4. THE Todo_Calendar_Store SHALL provide `setMonthData(monthId, todos, completions)` action
5. THE Todo_Calendar_Store SHALL provide `setBatchMonthData(todosMap, completionsMap)` action
6. THE Todo_Calendar_Store SHALL provide `invalidateMonth(monthId)` action
7. THE Todo_Calendar_Store SHALL provide `invalidateAdjacentMonths(year, month)` action
8. THE Todo_Calendar_Store SHALL provide `clearAll()` action
9. THE Todo_Calendar_Store SHALL provide `hasMonth(monthId)` selector

### Requirement 3: Batch Fetch 서비스

**User Story:** 개발자로서, 여러 월의 Todo 데이터를 1회 SQL 쿼리로 조회하여 성능을 최적화하고 싶습니다.

#### Acceptance Criteria

1. THE Calendar_System SHALL provide a service function `fetchCalendarDataForMonths(monthMetadatas, startDayOfWeek)`
2. WHEN fetching data for multiple months, THEN THE service SHALL execute only 1 SQL query for todos
3. WHEN fetching data for multiple months, THEN THE service SHALL execute only 1 SQL query for completions
4. THE service SHALL query todos using global date range (min startDate ~ max endDate)
5. THE service SHALL group todos by month after fetching
6. THE service SHALL group completions by month after fetching
7. WHEN a month has no todos, THEN THE service SHALL return empty array for that month
8. THE service SHALL return `{todosMap, completionsMap}` where keys are 'YYYY-MM'

### Requirement 4: SQL 쿼리 조건

**User Story:** 개발자로서, 6주 패딩 범위 내의 모든 Todo를 정확히 조회하고 싶습니다.

#### Acceptance Criteria

1. WHEN querying todos, THEN THE service SHALL include single-day todos where `date >= startDate AND date <= endDate`
2. WHEN querying todos, THEN THE service SHALL include period todos where `start_date <= endDate AND end_date >= startDate`
3. WHEN querying todos, THEN THE service SHALL include recurring todos where `recurrence IS NOT NULL AND start_date <= endDate`
4. THE service SHALL exclude deleted todos using `deleted_at IS NULL` condition
5. THE service SHALL join categories table to get category color
6. THE service SHALL order todos by `date ASC, is_all_day DESC, start_time ASC`

### Requirement 5: 경량 Todo 객체

**User Story:** 개발자로서, 캘린더에서 불필요한 필드를 제외한 경량 Todo 객체를 사용하여 메모리를 절약하고 싶습니다.

#### Acceptance Criteria

1. THE service SHALL return lightweight todo objects with only essential fields
2. THE lightweight todo SHALL include `_id, title, date, startDate, endDate, categoryColor, isAllDay, recurrence` fields
3. THE lightweight todo SHALL NOT include `memo, startTime, endTime, categoryId, createdAt, updatedAt` fields
4. WHEN full todo data is needed, THEN THE Calendar_System SHALL use existing `todoService.getTodoById()`
5. THE lightweight todo SHALL use `categoryColor` from joined categories table

### Requirement 6: Prefetch Orchestrator Hook

**User Story:** 개발자로서, 화면에 보이는 월 ±2개월의 데이터를 자동으로 prefetch하고 싶습니다.

#### Acceptance Criteria

1. THE Calendar_System SHALL provide a hook `useTodoCalendarData(startDayOfWeek)`
2. THE hook SHALL accept `onVisibleMonthsChange(viewableItems)` callback
3. WHEN visible months change, THEN THE hook SHALL calculate Prefetch_Buffer range (visible ±2 months)
4. THE hook SHALL filter out cached months using `hasMonth` selector
5. WHEN uncached months exist, THEN THE hook SHALL call `fetchCalendarDataForMonths` with uncached months only
6. THE hook SHALL use `isFetchingRef` to prevent duplicate fetches
7. WHEN fetch completes, THEN THE hook SHALL call `setBatchMonthData` to update store

### Requirement 7: CalendarList 연동

**User Story:** 개발자로서, 기존 CalendarList 컴포넌트에 최소한의 수정으로 데이터 연동을 추가하고 싶습니다.

#### Acceptance Criteria

1. THE CalendarList SHALL use `useTodoCalendarData` hook
2. THE CalendarList SHALL call `onVisibleMonthsChange` in existing `onViewableItemsChanged` handler
3. THE CalendarList SHALL pass `startDayOfWeek` to the hook
4. THE CalendarList SHALL NOT modify existing scroll logic
5. THE CalendarList SHALL NOT add loading indicators

### Requirement 8: MonthSection Selector 패턴

**User Story:** 개발자로서, MonthSection이 자기 월 데이터만 구독하여 다른 월 변경 시 리렌더링을 방지하고 싶습니다.

#### Acceptance Criteria

1. THE MonthSection SHALL use Zustand selector to subscribe only to its month data
2. THE MonthSection SHALL use `state => state.todosByMonth[monthMetadata.id]` selector
3. THE MonthSection SHALL use `state => state.completionsByMonth[monthMetadata.id]` selector
4. WHEN other month data changes, THEN THE MonthSection SHALL NOT re-render
5. THE MonthSection SHALL compute `todosByDate` map using useMemo
6. THE MonthSection SHALL pass `todosByDate` and `completions` to WeekRow components

### Requirement 9: DayCell Todo 표시

**User Story:** 사용자로서, 캘린더 날짜 셀에 Todo가 있는 날짜를 시각적으로 확인하고 싶습니다.

#### Acceptance Criteria

1. THE DayCell SHALL receive `todos` array for that date
2. WHEN todos array is not empty, THEN THE DayCell SHALL display a Todo_Dot
3. THE Todo_Dot SHALL be a small circle below the date number
4. THE Todo_Dot SHALL use category color if only one todo exists
5. WHEN multiple todos exist, THEN THE Todo_Dot SHALL use default color (#333)
6. THE DayCell SHALL NOT display todo titles or details

### Requirement 10: CRUD 후 캐시 무효화

**User Story:** 개발자로서, Todo 생성/수정/삭제 후 캘린더 캐시를 무효화하여 최신 데이터를 반영하고 싶습니다.

#### Acceptance Criteria

1. WHEN a todo is created, THEN THE Calendar_System SHALL call `invalidateAdjacentMonths` with todo's year and month
2. WHEN a todo is updated, THEN THE Calendar_System SHALL call `invalidateAdjacentMonths` with todo's new year and month
3. WHEN a todo's date is changed, THEN THE Calendar_System SHALL call `invalidateAdjacentMonths` for both old date and new date
4. WHEN a todo is deleted, THEN THE Calendar_System SHALL call `invalidateAdjacentMonths` with todo's year and month
5. THE `invalidateAdjacentMonths` SHALL invalidate current month + previous month + next month
6. WHEN month boundary is crossed (e.g., month=1), THEN THE function SHALL handle year transition correctly
7. WHEN invalidated month is revisited, THEN THE Calendar_System SHALL automatically re-fetch data

### Requirement 11: Sync 완료 후 전체 캐시 클리어

**User Story:** 개발자로서, 서버 동기화 완료 후 캘린더 캐시를 전체 클리어하여 서버 데이터를 반영하고 싶습니다.

#### Acceptance Criteria

1. WHEN server sync completes successfully, THEN THE Calendar_System SHALL call `todoCalendarStore.clearAll()`
2. THE `clearAll` action SHALL remove all cached todos and completions
3. WHEN user revisits calendar after sync, THEN THE Calendar_System SHALL fetch fresh data from SQLite

### Requirement 12: 성능 목표

**User Story:** 개발자로서, 데이터 연동 후에도 60fps 스크롤 성능을 유지하고 싶습니다.

#### Acceptance Criteria

1. WHEN scrolling through 12 months rapidly, THEN THE Calendar_System SHALL maintain 60fps
2. WHEN revisiting cached month, THEN THE Calendar_System SHALL NOT execute SQL queries
3. WHEN batch fetching 5 months data, THEN THE operation SHALL complete within 50ms
4. THE MonthSection render time SHALL remain under 16ms (1 frame)
5. THE cache hit rate SHALL be above 90% during normal usage

### Requirement 13: 에러 처리

**User Story:** 개발자로서, SQL 쿼리 실패 시 앱이 크래시하지 않고 빈 데이터를 표시하고 싶습니다.

#### Acceptance Criteria

1. WHEN SQL query fails, THEN THE service SHALL log error to console
2. WHEN SQL query fails, THEN THE service SHALL return empty todosMap and completionsMap
3. WHEN fetch fails, THEN THE Calendar_System SHALL NOT update store
4. WHEN fetch fails, THEN THE Calendar_System SHALL allow retry on next visible change
5. THE Calendar_System SHALL NOT display error messages to user

### Requirement 14: 날짜 계산 동기화

**User Story:** 개발자로서, `getCalendarDateRange`와 `generateWeeks`의 그리드 시작일 계산이 항상 동일하게 유지되기를 원합니다.

#### Acceptance Criteria

1. THE `getCalendarDateRange` function SHALL use identical grid start calculation as `generateWeeks`
2. WHEN startDayOfWeek is 0, THEN both functions SHALL calculate Sunday as week start
3. WHEN startDayOfWeek is 1, THEN both functions SHALL calculate Monday as week start
4. WHEN first day of month is Sunday and startDayOfWeek is 1, THEN both functions SHALL subtract 6 days
5. FOR ALL year and month combinations, THE two functions SHALL produce consistent date ranges

### Requirement 15: 기간 일정 다중 월 할당

**User Story:** 개발자로서, 여러 월에 걸친 기간 일정이 모든 해당 월 그리드에 표시되기를 원합니다.

#### Acceptance Criteria

1. WHEN a period todo spans multiple months (e.g., 1/28 ~ 2/5), THEN THE service SHALL include it in both months' todosMap
2. THE service SHALL NOT break loop after first month match
3. WHEN grouping todos by month, THEN THE service SHALL check all month ranges for each todo
4. WHEN a todo matches multiple ranges, THEN THE service SHALL add it to all matching months
5. THE service SHALL NOT duplicate todos within the same month

### Requirement 16: 날짜/시간 Canonical Contract 통일

**User Story:** 개발자로서, Client -> API -> Server 전 구간에서 날짜/시간 포맷을 일관되게 유지하여 타임존 오차와 타입 혼용을 제거하고 싶습니다.

#### Acceptance Criteria

1. THE Todo contract SHALL use `startDate`, `endDate`, `startTime`, `endTime`, `recurrenceEndDate` fields only
2. THE date fields SHALL use `YYYY-MM-DD` string format or `null`
3. THE time fields SHALL use `HH:mm` string format or `null`
4. THE API payload SHALL NOT include `startDateTime` and `endDateTime` fields
5. THE server SHALL NOT persist Date-typed schedule fields for Todo domain data

### Requirement 17: SQLite 반복 종료일 정규화

**User Story:** 개발자로서, 반복 일정 조회 성능과 정합성을 위해 SQLite에 반복 종료일을 명시적으로 저장하고 싶습니다.

#### Acceptance Criteria

1. THE `todos` table SHALL include `recurrence_end_date TEXT NULL`
2. THE schema migration SHALL backfill `recurrence_end_date` for existing recurring todos
3. THE system SHALL create index `idx_todos_recurrence_window(start_date, recurrence_end_date)`
4. THE query layer SHALL include `(recurrence_end_date IS NULL OR recurrence_end_date >= ?)` predicate for recurring candidates

### Requirement 18: Server Todo 스키마 정규화

**User Story:** 개발자로서, 서버 Todo 저장 구조를 Floating string 중심으로 단순화하고 싶습니다.

#### Acceptance Criteria

1. THE Todo schema SHALL remove `startDateTime`, `endDateTime`, and todo-level `timeZone` fields
2. THE Todo schema SHALL store `startDate`, `endDate`, `startTime`, `endTime`, `recurrenceEndDate` as strings
3. THE `startTime` and `endTime` fields SHALL be treated as newly introduced persistent fields
4. THE schema SHALL keep compatibility only for migration/read fallback period

### Requirement 19: Controller 문자열 저장/검증 강제

**User Story:** 개발자로서, Controller 계층에서 Date 객체 자동 캐스팅을 제거하고 문자열 검증 기반으로 저장하고 싶습니다.

#### Acceptance Criteria

1. THE create/update controllers SHALL NOT construct schedule values using `new Date(...)`
2. THE controllers SHALL validate `startDate/endDate/recurrenceEndDate` with `YYYY-MM-DD` pattern
3. THE controllers SHALL validate `startTime/endTime` with `HH:mm` pattern
4. WHEN invalid date/time format is received, THEN THE API SHALL return validation error without partial write

### Requirement 20: 타임존 Source of Truth 고정

**User Story:** 개발자로서, 마이그레이션/연동 시 타임존 기준을 단일화하여 변환 오차를 줄이고 싶습니다.

#### Acceptance Criteria

1. THE system SHALL use `user.settings.timeZone` as the only timezone source of truth
2. THE system SHALL NOT detect device timezone for migration or Google adapter conversion
3. WHEN user timezone is missing, THEN THE system SHALL use `'Asia/Seoul'` default

### Requirement 21: Mongo 마이그레이션 분해 규칙

**User Story:** 개발자로서, 기존 Date 필드를 안전하게 문자열 필드로 분해/이관하고 싶습니다.

#### Acceptance Criteria

1. THE migration SHALL split `startDateTime` into `startDate(YYYY-MM-DD)` and `startTime(HH:mm)` using user timezone
2. THE migration SHALL split `endDateTime` into `endDate(YYYY-MM-DD)` and `endTime(HH:mm)` using user timezone
3. THE migration SHALL resolve timezone by `todo.userId -> User` lookup
4. THE migration SHALL cache user timezone values with `Map<userId, timeZone>` to avoid repeated DB lookups
5. THE migration SHALL use dry-run, backup, and batched write strategy

### Requirement 22: Google 연동 호환성 패치 범위 제한

**User Story:** 개발자로서, Phase 2.5에서 구글 연동 로직을 과도하게 변경하지 않고 타입 호환성만 확보하고 싶습니다.

#### Acceptance Criteria

1. THE Phase 2.5 Google integration changes SHALL be limited to compatibility adapter patch
2. THE adapter SHALL build Google API payload from DB string fields + `user.settings.timeZone`
3. THE adapter changes SHALL prevent Date/String type errors after migration
4. THE phase SHALL NOT introduce advanced sync behavior changes beyond compatibility

### Requirement 23: 단계적 배포와 검증

**User Story:** 개발자로서, 데이터 모델 전환을 무중단에 가깝게 배포하고 실패 시 복구 가능해야 합니다.

#### Acceptance Criteria

1. THE rollout SHALL follow `compat release -> migration -> cleanup release`
2. THE migration SHALL create backup collection before write operations
3. THE migration SHALL emit report including total/updated/failed counts
4. WHEN validation fails for a row, THEN THE row SHALL be logged and skipped without aborting whole batch

## Phase 2 Scope

이 요구사항 문서는 Phase 2 범위를 다룹니다:
- ✅ SQLite Todo/Completion 데이터 조회
- ✅ 6주 패딩 범위 계산
- ✅ Batch Fetch 최적화
- ✅ 별도 캐시 관리 (todoCalendarStore)
- ✅ Selector 패턴으로 리렌더링 최적화
- ✅ CRUD 후 캐시 무효화
- ✅ Todo Dot 표시

Phase 3 (향후):
- ❌ 날짜 클릭 이벤트 (Todo 목록 모달)
- ❌ 오늘 날짜 시각적 하이라이트 (배경색, 테두리)
- ❌ Todo 개수 표시 (숫자 뱃지)
- ❌ 완료율 표시 (프로그레스 바)

## Phase 2.5 Scope

이 요구사항 문서의 Phase 2.5 추가 범위:
- ✅ date/time 문자열 계약 통일 (`YYYY-MM-DD`, `HH:mm`)
- ✅ Todo 스키마 Date 필드 제거 및 `startTime/endTime` 신규 도입
- ✅ SQLite `recurrence_end_date` 컬럼/인덱스/백필
- ✅ `user.settings.timeZone` 단일 기준 정책 확정
- ✅ Mongo 마이그레이션(분해 변환 + 유저 타임존 캐싱 + dry-run/backup)
- ✅ Google 연동 호환성 패치(타입 에러 방지 범위)

## Phase 2.5 Spec Sync Notes (Task 17)

Task 17 기준 동기화 결과:
1. Requirement 16~23은 본 문서에 반영 완료 상태로 유지한다.
2. Phase 2.5 구현/검증의 Source of Truth는 `requirements.md`, `design.md`, `tasks.md` 3문서다.
3. `phase2_5_data_normalization_technical_spec.md`는 참고 문서로 사용하며, 충돌 시 본 문서와 `design.md`를 우선한다.

충돌 항목 정리:

| 항목 | technical spec 문구 | 동기화 결정(최종) |
|------|---------------------|------------------|
| 타임존 키 명칭 | `userSettings.timeZone` | `user.settings.timeZone`으로 통일 |
| 호환 릴리스/정리 릴리스 경계 | 구필드 fallback 유지(개념) | `Task 28` 전까지만 fallback 허용, 이후 제거 |
| 마이그레이션 실패 로깅 형식 | JSONL 로그 제안 | 필수 요건은 row 단위 skip + id/원인 보고, 저장 형식은 구현 선택 |
| 백업 컬렉션 네이밍 | `todos_backup_phase2_5_YYYYMMDD` 예시 | 백업 생성은 필수, 이름 패턴은 운영/스크립트 정책에 위임 |

## Performance Targets

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Batch Fetch (5개월) | < 50ms | console.time() |
| MonthSection Render | < 16ms | React DevTools Profiler |
| 스크롤 FPS | 60fps | Expo Performance Monitor |
| 캐시 히트율 | > 90% | console.log 카운터 |
| SQL 쿼리 횟수 (12개월 스크롤) | < 3회 | console.log 카운터 |

## Dependencies

- Phase 1: Infinite Scroll Calendar (완료)
- Phase 1.5: Settings Integration (완료)
- SQLite: expo-sqlite (기존)
- Zustand: 상태 관리 (기존)
- Day.js: 날짜 계산 (기존)
