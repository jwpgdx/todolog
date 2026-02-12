# Implementation Plan: Calendar Data Integration

## Overview

Phase 2는 Phase 1의 무한 스크롤 캘린더 UI에 SQLite Todo/Completion 데이터를 연동합니다. 구현 순서는 하위 레이어부터 상위 레이어로 진행하며, 각 단계에서 점진적으로 검증합니다.

**구현 순서**:
1. Utility 함수 (calendarHelpers)
2. Service 레이어 (calendarTodoService)
3. State 레이어 (todoCalendarStore)
4. Hook 레이어 (useTodoCalendarData)
5. UI 레이어 (CalendarList, MonthSection, WeekRow, DayCell)
6. CRUD 연동 (캐시 무효화)

---

## Tasks

- [ ] 1. calendarHelpers에 getCalendarDateRange 함수 추가
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

- [ ] 2. todoCalendarStore 구현
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

- [ ] 3. calendarTodoService 구현
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

- [ ] 4. Checkpoint - Service 레이어 검증
  - `calendarTodoService.fetchCalendarDataForMonths` 수동 테스트
  - 2026-01, 2026-02 데이터 조회 확인
  - SQL 쿼리 2회만 실행 확인 (console.log)
  - 기간 일정 다중 월 할당 확인
  - 빈 월 빈 배열 반환 확인
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. useTodoCalendarData Hook 구현
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

- [ ] 6. CalendarList 컴포넌트 수정
  - `client/src/features/todo-calendar/ui/CalendarList.js` 파일 수정
  - `useTodoCalendarData` hook import 및 사용
  - `startDayOfWeek` props 전달
  - 기존 `onViewableItemsChanged`에 `onVisibleMonthsChange` 호출 추가
  - dependency 배열에 `onVisibleMonthsChange` 추가
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 7. MonthSection 컴포넌트 수정
  - `client/src/features/todo-calendar/ui/MonthSection.js` 파일 수정
  - `useTodoCalendarStore` selector로 `todosByMonth[monthMetadata.id]` 구독
  - `useTodoCalendarStore` selector로 `completionsByMonth[monthMetadata.id]` 구독
  - `todosByDate` map 생성 (useMemo)
  - `WeekRow`에 `todosByDate`, `completions` props 전달
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [ ]* 7.1 Write property test for MonthSection selector isolation
  - **Property 11: Selector Isolation**
  - **Validates: Requirements 8.4**

- [ ] 8. WeekRow 컴포넌트 수정
  - `client/src/features/todo-calendar/ui/WeekRow.js` 파일 수정
  - `todosByDate`, `completions` props 추가
  - `DayCell`에 `todos={todosByDate?.[day.dateString] || []}` 전달
  - `DayCell`에 `completions` props 전달
  - _Requirements: 8.6_

- [ ] 9. DayCell 컴포넌트 수정
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

- [ ] 10. Checkpoint - UI 레이어 검증
  - CalendarScreen 진입하여 Todo dot 표시 확인
  - 스크롤 시 prefetch 동작 확인 (console.log)
  - 캐시 히트 시 fetch 없음 확인
  - React DevTools로 MonthSection 리렌더링 추적
  - 다른 월 데이터 변경 시 리렌더 없음 확인
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. useCreateTodo에 캐시 무효화 추가
  - `client/src/hooks/mutations/useCreateTodo.js` 파일 수정
  - `useTodoCalendarStore` import
  - `invalidateAdjacentMonths` selector 사용
  - `onSuccess`에서 `data.date` 파싱하여 `invalidateAdjacentMonths(year, month)` 호출
  - _Requirements: 10.1, 10.5, 10.6_

- [ ] 12. useUpdateTodo에 캐시 무효화 추가
  - `client/src/hooks/mutations/useUpdateTodo.js` 파일 수정
  - `useTodoCalendarStore` import
  - `invalidateAdjacentMonths` selector 사용
  - `onSuccess`에서 새 날짜(`data.date`) 파싱하여 `invalidateAdjacentMonths(year, month)` 호출
  - 날짜 변경 시: 이전 날짜(`variables.date` 또는 `previousTodo.date`)도 파싱하여 `invalidateAdjacentMonths` 호출
  - 두 날짜가 다른 경우 양쪽 모두 무효화 (이전 달력에서 dot 제거, 새 달력에 dot 추가)
  - _Requirements: 10.2, 10.3, 10.5, 10.6_

- [ ] 13. useDeleteTodo에 캐시 무효화 추가
  - `client/src/hooks/mutations/useDeleteTodo.js` 파일 수정
  - `useTodoCalendarStore` import
  - `invalidateAdjacentMonths` selector 사용
  - `onSuccess`에서 삭제된 todo의 date 파싱하여 `invalidateAdjacentMonths(year, month)` 호출
  - _Requirements: 10.4, 10.5, 10.6_

- [ ]* 13.1 Write property test for adjacent month invalidation
  - **Property 10: Adjacent Month Invalidation**
  - **Validates: Requirements 10.5, 10.6**

- [ ] 13.2 useToggleCompletion에 캐시 무효화 추가
  - `client/src/hooks/queries/useToggleCompletion.js` 파일 수정
  - `useTodoCalendarStore` import
  - `invalidateAdjacentMonths` selector 사용
  - `onSuccess`에서 완료 토글된 todo의 date 파싱하여 `invalidateAdjacentMonths(year, month)` 호출
  - 완료 상태 변경 시 캘린더 캐시 갱신 필요
  - _Requirements: 10.5, 10.6_

- [ ] 14. useSyncService에 캘린더 캐시 클리어 추가
  - `client/src/hooks/useSyncService.js` 파일 수정 (또는 sync 완료 핸들러)
  - `useTodoCalendarStore` import
  - Sync 완료 시 `useTodoCalendarStore.getState().clearAll()` 호출
  - _Requirements: 11.1, 11.2, 11.3_

- [ ] 15. Error handling 추가
  - `calendarTodoService.js`에 try-catch 추가
  - SQL 실패 시 빈 todosMap, completionsMap 반환
  - `getCalendarDateRange`에 invalid date 처리 추가
  - console.error 로깅 추가
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [ ]* 15.1 Write property test for error handling
  - **Property 13: Error Handling Graceful Degradation**
  - **Validates: Requirements 13.1, 13.2, 13.3**

- [ ] 16. Final Checkpoint - 전체 통합 테스트
  - CalendarScreen 진입하여 초기 로딩 확인
  - 12개월 빠른 스크롤 (60fps 유지 확인)
  - Todo 생성 → 캘린더에 dot 표시 확인
  - Todo 삭제 → 캘린더에서 dot 사라짐 확인
  - 1/28 ~ 2/5 기간 일정 생성 → 1월, 2월 모두 표시 확인
  - 2026-01-28 Todo 생성 → 2월 그리드 첫째 주에도 표시 확인
  - Performance 측정: Batch fetch < 50ms, 캐시 히트율 > 90%
  - Ensure all tests pass, ask the user if questions arise.

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
