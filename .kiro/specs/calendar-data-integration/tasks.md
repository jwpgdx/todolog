# Implementation Plan: Calendar Data Integration

## Overview

Phase 2는 Phase 1의 무한 스크롤 캘린더 UI에 SQLite Todo/Completion 데이터를 연동합니다.  
Phase 2.5는 Phase 3 선행 과제로 데이터 정규화(Floating string contract)를 적용합니다.

구현 순서는 하위 레이어부터 상위 레이어로 진행하며, 각 단계에서 점진적으로 검증합니다.

**구현 순서**:
1. Utility 함수 (calendarHelpers)
2. Service 레이어 (calendarTodoService)
3. State 레이어 (todoCalendarStore)
4. Hook 레이어 (useTodoCalendarData)
5. UI 레이어 (CalendarList, MonthSection, WeekRow, DayCell)
6. CRUD 연동 (캐시 무효화)

---

## Tasks

- [x] 1. calendarHelpers에 getCalendarDateRange 함수 추가
  - `client/src/features/todo-calendar/utils/calendarHelpers.js` 파일 수정
  - `getCalendarDateRange(year, month, startDayOfWeek)` 함수 구현
  - `generateWeeks`와 동일한 gridStart 계산 로직 사용
  - 6주(42일) 범위 계산하여 `{startDate, endDate}` 반환
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 14.1, 14.2, 14.3, 14.4_

- [ ]* 1.1 Write property test for getCalendarDateRange
  - **Property 1: Date Range Consistency**
  - **Property 2: Week Start Day Correctness**
  - **Property 3: Date Range Span**
  - **Validates: Requirements 1.1, 1.3, 1.4, 1.5, 14.1, 14.2, 14.3, 14.4**

- [x] 2. todoCalendarStore 구현
  - `client/src/features/todo-calendar/store/todoCalendarStore.js` 파일 생성
  - Zustand store 생성: `todosByMonth`, `completionsByMonth` state
  - Actions 구현: `setMonthData`, `setBatchMonthData`, `invalidateMonth`, `invalidateAdjacentMonths`, `clearAll`, `hasMonth`
  - 월 경계 처리 로직 (year transition) 구현
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

- [ ]* 2.1 Write unit tests for todoCalendarStore actions
  - `setMonthData` 테스트: 데이터 저장 확인
  - `invalidateAdjacentMonths` 테스트: 3개월 무효화 확인
  - `hasMonth` 테스트: 캐시 존재 여부 확인
  - 월 경계 처리 테스트 (12월 → 1월, 1월 → 12월)
  - _Requirements: 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 10.4, 10.5_

- [x] 3. calendarTodoService 구현
  - `client/src/features/todo-calendar/services/calendarTodoService.js` 파일 생성
  - `fetchCalendarDataForMonths(monthMetadatas, startDayOfWeek)` 함수 구현
  - `getCalendarDateRange`로 각 월의 6주 범위 계산
  - 전체 범위(globalStart ~ globalEnd)로 1회 SQL 쿼리 (todos, completions)
  - SQL 조건: 단일 일정, 기간 일정, 반복 일정 모두 포함
  - 월별 그룹핑 로직 (기간 일정은 여러 월에 중복 할당)
  - `deserializeTodoLight` 함수 구현 (경량 Todo 객체)
  - 빈 월은 빈 배열로 초기화
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3, 5.5_

- [ ]* 3.1 Write property test for fetchCalendarDataForMonths
  - **Property 4: Batch Fetch Query Efficiency**
  - **Property 5: Month Grouping Completeness**
  - **Property 6: Empty Month Handling**
  - **Property 7: SQL Query Coverage**
  - **Property 8: Lightweight Todo Fields**
  - **Property 14: Period Todo Multi-Month Assignment**
  - **Validates: Requirements 3.2, 3.3, 3.5, 3.7, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 15.1, 15.4**

- [x] 4. Checkpoint - Service 레이어 검증
  - `calendarTodoService.fetchCalendarDataForMonths` 수동 테스트
  - 2026-01, 2026-02 데이터 조회 확인
  - SQL 쿼리 2회만 실행 확인 (console.log)
  - 기간 일정 다중 월 할당 확인
  - 빈 월 빈 배열 반환 확인
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. useTodoCalendarData Hook 구현
  - `client/src/features/todo-calendar/hooks/useTodoCalendarData.js` 파일 생성
  - `useTodoCalendarData(startDayOfWeek)` hook 구현
  - `onVisibleMonthsChange(viewableItems)` callback 구현
  - Visible 월 ±2개월 prefetch 범위 계산
  - 캐시 미스 월 필터링 (`hasMonth` selector 사용)
  - `isFetchingRef`로 중복 fetch 방지
  - `fetchCalendarDataForMonths` 호출 및 `setBatchMonthData`로 store 업데이트
  - Performance logging 추가
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [ ]* 5.1 Write property test for useTodoCalendarData
  - **Property 9: Cache Hit Prevention**
  - **Validates: Requirements 6.4, 12.2**

- [x] 6. CalendarList 컴포넌트 수정
  - `client/src/features/todo-calendar/ui/CalendarList.js` 파일 수정
  - `useTodoCalendarData` hook import 및 사용
  - `startDayOfWeek` props 전달
  - 기존 `onViewableItemsChanged`에 `onVisibleMonthsChange` 호출 추가
  - dependency 배열에 `onVisibleMonthsChange` 추가
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 7. MonthSection 컴포넌트 수정
  - `client/src/features/todo-calendar/ui/MonthSection.js` 파일 수정
  - `useTodoCalendarStore` selector로 `todosByMonth[monthMetadata.id]` 구독
  - `useTodoCalendarStore` selector로 `completionsByMonth[monthMetadata.id]` 구독
  - `todosByDate` map 생성 (useMemo)
  - `WeekRow`에 `todosByDate`, `completions` props 전달
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [ ]* 7.1 Write property test for MonthSection selector isolation
  - **Property 11: Selector Isolation**
  - **Validates: Requirements 8.4**

- [x] 8. WeekRow 컴포넌트 수정
  - `client/src/features/todo-calendar/ui/WeekRow.js` 파일 수정
  - `todosByDate`, `completions` props 추가
  - `DayCell`에 `todos={todosByDate?.[day.dateString] || []}` 전달
  - `DayCell`에 `completions` props 전달
  - _Requirements: 8.6_

- [x] 9. DayCell 컴포넌트 수정
  - `client/src/features/todo-calendar/ui/DayCell.js` 파일 수정
  - `todos`, `completions` props 추가
  - Todo dot 표시 로직 구현
  - 1개 todo: categoryColor 사용
  - 여러 todo: '#333' 사용
  - 스타일 추가: `todoDot` (4px circle)
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [ ]* 9.1 Write property test for DayCell todo dot display
  - **Property 12: Todo Dot Display Logic**
  - **Validates: Requirements 9.2, 9.4, 9.5**

- [x] 10. Checkpoint - UI 레이어 검증
  - CalendarScreen 진입하여 Todo dot 표시 확인
  - 스크롤 시 prefetch 동작 확인 (console.log)
  - 캐시 히트 시 fetch 없음 확인
  - React DevTools로 MonthSection 리렌더링 추적
  - 다른 월 데이터 변경 시 리렌더 없음 확인
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. useCreateTodo에 캐시 무효화 추가
  - `client/src/hooks/mutations/useCreateTodo.js` 파일 수정
  - `useTodoCalendarStore` import
  - `invalidateAdjacentMonths` selector 사용
  - `onSuccess`에서 `data.date` 파싱하여 `invalidateAdjacentMonths(year, month)` 호출
  - _Requirements: 10.1, 10.5, 10.6_

- [x] 12. useUpdateTodo에 캐시 무효화 추가
  - `client/src/hooks/mutations/useUpdateTodo.js` 파일 수정
  - `useTodoCalendarStore` import
  - `invalidateAdjacentMonths` selector 사용
  - `onSuccess`에서 새 날짜(`data.date`) 파싱하여 `invalidateAdjacentMonths(year, month)` 호출
  - 날짜 변경 시: 이전 날짜(`variables.date` 또는 `previousTodo.date`)도 파싱하여 `invalidateAdjacentMonths` 호출
  - 두 날짜가 다른 경우 양쪽 모두 무효화 (이전 달력에서 dot 제거, 새 달력에 dot 추가)
  - _Requirements: 10.2, 10.3, 10.5, 10.6_

- [x] 13. useDeleteTodo에 캐시 무효화 추가
  - `client/src/hooks/mutations/useDeleteTodo.js` 파일 수정
  - `useTodoCalendarStore` import
  - `invalidateAdjacentMonths` selector 사용
  - `onSuccess`에서 삭제된 todo의 date 파싱하여 `invalidateAdjacentMonths(year, month)` 호출
  - _Requirements: 10.4, 10.5, 10.6_

- [ ]* 13.1 Write property test for adjacent month invalidation
  - **Property 10: Adjacent Month Invalidation**
  - **Validates: Requirements 10.5, 10.6**

- [x] 13.2 useToggleCompletion에 캐시 무효화 추가
  - `client/src/hooks/queries/useToggleCompletion.js` 파일 수정
  - `useTodoCalendarStore` import
  - `invalidateAdjacentMonths` selector 사용
  - `onSuccess`에서 완료 토글된 todo의 date 파싱하여 `invalidateAdjacentMonths(year, month)` 호출
  - 완료 상태 변경 시 캘린더 캐시 갱신 필요
  - _Requirements: 10.5, 10.6_

- [x] 14. useSyncService에 캘린더 캐시 클리어 추가
  - `client/src/hooks/useSyncService.js` 파일 수정 (또는 sync 완료 핸들러)
  - `useTodoCalendarStore` import
  - Sync 완료 시 `useTodoCalendarStore.getState().clearAll()` 호출
  - _Requirements: 11.1, 11.2, 11.3_

- [x] 15. Error handling 추가
  - `calendarTodoService.js`에 try-catch 추가
  - SQL 실패 시 빈 todosMap, completionsMap 반환
  - `getCalendarDateRange`에 invalid date 처리 추가
  - console.error 로깅 추가
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [ ]* 15.1 Write property test for error handling
  - **Property 13: Error Handling Graceful Degradation**
  - **Validates: Requirements 13.1, 13.2, 13.3**

- [x] 16. Final Checkpoint - 전체 통합 테스트
  - CalendarScreen 진입하여 초기 로딩 확인
  - 12개월 빠른 스크롤 (60fps 유지 확인)
  - Todo 생성 → 캘린더에 dot 표시 확인
  - Todo 삭제 → 캘린더에서 dot 사라짐 확인
  - 1/28 ~ 2/5 기간 일정 생성 → 1월, 2월 모두 표시 확인
  - 2026-01-28 Todo 생성 → 2월 그리드 첫째 주에도 표시 확인
  - Performance 측정: Batch fetch < 50ms, 캐시 히트율 > 90%
  - Ensure all tests pass, ask the user if questions arise.

## Phase 2.5 Tasks (Data Normalization)

- [x] 17. Phase 2.5 스펙 동기화 (requirements/design/tasks)
  - `requirements.md`에 Requirement 16~23 반영 확인
  - `design.md`에 Phase 2.5 addendum 구조/다이어그램/검증전략 반영 확인
  - `phase2_5_data_normalization_technical_spec.md`와 충돌 항목 정리
  - _Requirements: 16.1, 17.1, 18.1, 20.1_

- [x] 18. Client Form/API 문자열 계약 고정
  - `client/src/features/todo/form/useTodoFormLogic.js` 수정
  - `recurrenceEndDate` Date 변환(`toDate`) 제거
  - `client/src/api/todos.js` payload가 string/null 계약만 사용하도록 정리
  - _Requirements: 16.1, 16.2, 16.3, 16.4_

- [x] 19. SQLite 스키마 마이그레이션 추가 (`recurrence_end_date`)
  - `client/src/services/db/database.js` 마이그레이션 버전 증가
  - `todos.recurrence_end_date TEXT` 컬럼 추가
  - `idx_todos_recurrence_window(start_date, recurrence_end_date)` 인덱스 추가
  - 기존 반복 일정 백필 로직 추가
  - _Requirements: 17.1, 17.2, 17.3_

- [ ]* 19.1 Property test - SQLite recurrence_end_date 백필
  - **Property 16: Backfill Determinism**
  - **Property 17: Until Extraction Priority**
  - _Validates: Requirements 17.2, 19.4_

- [x] 20. SQLite Todo 서비스 정규화 반영
  - `client/src/services/db/todoService.js` serialize/deserialize 매핑 추가
  - 반복 후보 SQL에 `recurrence_end_date` 조건 반영
  - 캘린더 조회 서비스(`calendarTodoService`)와 정합성 검증
  - _Requirements: 17.4, 19.1_

- [x] 21. Server Todo 모델 정규화
  - `server/src/models/Todo.js` 수정
  - `startDateTime/endDateTime/timeZone` 제거(정리 릴리스 기준)
  - `[NEW] startTime/endTime` 문자열 필드 추가
  - `recurrenceEndDate`를 String으로 전환
  - _Requirements: 18.1, 18.2, 18.3_

- [x] 22. Todo Controller 문자열 검증/저장 로직 전환
  - `server/src/controllers/todoController.js` 수정
  - `new Date(...)` 조합 제거
  - `YYYY-MM-DD`, `HH:mm` 정규식 검증 추가
  - 잘못된 형식 요청에 대한 400 응답 표준화
  - _Requirements: 19.1, 19.2, 19.3, 19.4_

- [x] 23. User timezone Source of Truth 경로 정리
  - `server/src/controllers/authController.js`의 게스트 마이그레이션 입력 구조 정리
  - todo-level timezone 의존 코드 제거
  - `user.settings.timeZone` 우선 사용 규칙 반영
  - _Requirements: 20.1, 20.2, 20.3_

- [x] 24. Google 연동 호환성 패치
  - `server/src/services/googleCalendar.js` 수정
  - DB 문자열 + `user.settings.timeZone`으로 payload 생성
  - 타입 불일치(Date/String) 예외 방지 가드 추가
  - 기능 고도화 없이 어댑터 호환성 범위 내 변경 유지
  - _Requirements: 22.1, 22.2, 22.3, 22.4_

- [x] 25. MongoDB 마이그레이션 스크립트 구현
  - `server/src/scripts/migrateTodoDateFieldsToString.js` 생성
  - `todo.userId -> User` 조회 후 timezone 해석
  - `Map<userId, timeZone>` 캐시 적용
  - `startDateTime -> startDate + startTime` 분해
  - `endDateTime -> endDate + endTime` 분해
  - dry-run/backup/batch write/report 구현
  - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 23.1, 23.2, 23.3, 23.4_

- [x] 26. Checkpoint - 마이그레이션 Dry-Run 검증
  - 샘플 데이터 기준 변환 리포트(total/updated/failed) 확인
  - timezone fallback 동작 확인(`Asia/Seoul`)
  - User timezone 캐시 hit/miss 로그 확인
  - Ensure all checks pass before live migration.

- [x] 27. Checkpoint - 실마이그레이션/무결성 검증
  - backup 컬렉션 생성 확인
  - 변환 후 Todo 필드에 Date 타입 잔존 여부 점검
  - 날짜 밀림(±1 day) 샘플 검증
  - _Requirements: 23.2, 23.3, 23.4_

- [ ]* 27.1 Property test - DateTime split invariants
  - **Property 18: Start Split Determinism**
  - **Property 19: End Split Determinism**
  - **Property 20: Timezone Source Consistency**
  - _Validates: Requirements 20.1, 21.1, 21.2, 21.4_

- [x] 28. Server 정리 릴리스 (fallback 제거)
  - 구필드 fallback 경로 제거
  - strict validation 강화
  - 문서/운영 체크리스트 업데이트
  - _Requirements: 18.4, 23.1_

- [x] 29. Final Checkpoint - Phase 2.5 통합 검증
  - 오프라인 생성/수정 -> 온라인 동기화 전체 흐름 검증
  - API payload/response string contract 검증
  - Google 연동 Type Error 재발 없음 확인
  - Phase 3 착수 전 Gate 승인

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- CRUD 연동은 기존 mutation hooks에 최소한의 수정만 추가
- Error handling은 graceful degradation 원칙 적용

---

## Performance Targets

| Metric | Target | Measurement Point |
|--------|--------|-------------------|
| Batch Fetch (5개월) | < 50ms | Task 4 checkpoint |
| MonthSection Render | < 16ms | Task 10 checkpoint |
| 스크롤 FPS | 60fps | Task 16 checkpoint |
| 캐시 히트율 | > 90% | Task 16 checkpoint |
| SQL 쿼리 횟수 (12개월 스크롤) | < 3회 | Task 16 checkpoint |

---

## Dependencies

- Phase 1: Infinite Scroll Calendar (완료)
- Phase 1.5: Settings Integration (완료)
- SQLite: expo-sqlite (기존)
- Zustand: 상태 관리 (기존)
- Day.js: 날짜 계산 (기존)
