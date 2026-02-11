# Implementation Plan: Infinite Scroll Calendar

## Overview

이 구현 계획은 React Native + FlashList 기반의 무한 스크롤 캘린더를 단계별로 구현합니다. 핵심 원칙은 State 경량화, 동기 처리, 6주 고정 레이아웃입니다. 각 태스크는 이전 태스크를 기반으로 점진적으로 기능을 추가하며, Checkpoint에서 중간 검증을 수행합니다.

## Tasks

- [x] 1. 프로젝트 구조 및 유틸리티 함수 구현
  - `client/src/features/todo-calendar/` 디렉토리 생성
  - `utils/calendarHelpers.js` 파일 생성
  - 날짜 계산 순수 함수 구현: `generateWeeks()`, `createMonthMetadata()`, `createMonthMetadataFromDayjs()`, `generateFutureMonths()`, `generatePastMonths()`
  - **중요**: `generateWeeks()`에서 DayObject에 `dateString` 필드 포함 (React key용)
  - **중요**: `createMonthMetadataFromDayjs()` 래퍼 함수로 dayjs month() 0-indexed 처리
  - _Requirements: 2.1, 3.1, 9.5, 10.1, 10.2, 10.5_

- [ ]* 1.1 calendarHelpers 유닛 테스트 작성
  - **Property 6: Fixed 6 Weeks Per Month**
  - **Property 12: Pure Function Guarantee**
  - **Property 13: Total Day Count**
  - **Property 14: Month Boundary Correctness (Start)**
  - **Property 15: Month Boundary Correctness (End)**
  - **Validates: Requirements 3.1, 9.5, 10.1, 10.2, 10.5**

- [x] 2. Zustand Store 구현
  - `store/calendarStore.js` 파일 생성
  - State 정의: `months` 배열 (MonthMetadata만 저장)
  - Actions 구현: `initializeMonths()`, `addFutureMonths()`, `addPastMonths()`, `trimMonths()`
  - 메모리 제한 로직: 100개월 초과 시 최근 50개월만 유지
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 2.1, 2.2_

- [ ]* 2.1 Store 로직 유닛 테스트 작성
  - **Property 1: Append 6 Future Months**
  - **Property 2: Prepend 6 Past Months**
  - **Property 3: Memory Limit Enforcement**
  - **Property 4: Primitive State Only**
  - **Property 5: State Size Limit**
  - **Validates: Requirements 1.2, 1.3, 1.5, 2.1, 2.3**

- [x] 3. useInfiniteCalendar Hook 구현
  - `hooks/useInfiniteCalendar.js` 파일 생성
  - Store 연동 및 초기화 로직 (현재 월 ±2개월)
  - `handleEndReached()` 구현 (하단 스크롤 시 6개월 추가)
  - `handleStartReached()` 구현 (상단 스크롤 시 6개월 추가)
  - `isLoadingRef`로 중복 로딩 방지
  - Performance 로깅 추가 (console.time/timeEnd)
  - _Requirements: 1.1, 1.2, 1.3, 5.1, 5.3_

- [ ]* 3.1 Hook 성능 테스트 작성
  - **Property 7: Metadata Generation Performance**
  - **Property 8: Initial Generation Performance**
  - **Property 9: Append Performance**
  - **Property 10: Prepend Performance**
  - **Validates: Requirements 5.1, 6.3, 7.2, 7.3**

- [x] 4. Checkpoint - 유틸리티 및 State 검증
  - `calendarHelpers.js` 함수 동작 확인 (console.log로 출력)
  - Store 초기화 및 추가 로직 확인
  - React DevTools로 State 크기 확인 (< 10KB for 100 months)
  - 사용자에게 질문이 있으면 확인

- [x] 5. DayCell 컴포넌트 구현
  - `ui/DayCell.js` 파일 생성
  - Props: `day` (DayObject with `dateString`)
  - 날짜 숫자 렌더링
  - 스타일링: 현재 월 여부에 따라 opacity 조정 (30% vs 100%)
  - StyleSheet 사용 (NativeWind 없이)
  - **중요**: `isToday` 필드는 생성하되, 시각적 하이라이트는 Phase 2로 미룸
  - _Requirements: 4.3, 4.4_

- [x] 6. WeekRow 컴포넌트 구현
  - `ui/WeekRow.js` 파일 생성
  - Props: `week` (Array<DayObject>)
  - 7개 DayCell 렌더링 (flexDirection: 'row')
  - **중요**: React key로 `day.dateString` 사용 (date만으로는 중복 가능)
  - React.memo로 최적화
  - _Requirements: 9.3_

- [ ]* 6.1 WeekRow 렌더링 테스트 작성
  - **Property 11: Week Row Cell Count**
  - **Validates: Requirements 9.3**

- [x] 7. MonthSection 컴포넌트 구현
  - `ui/MonthSection.js` 파일 생성
  - Props: `monthMetadata` (MonthMetadata)
  - useMemo로 `weeks` 배열 생성 (generateWeeks 호출)
  - useMemo로 `monthTitle` 생성 (예: "2025년 1월")
  - 월 타이틀 렌더링
  - 요일 헤더 렌더링 (일~토, 일요일 빨강/토요일 파랑)
  - 6개 WeekRow 렌더링
  - React.memo로 최적화
  - _Requirements: 2.4, 3.1, 4.1, 4.2, 4.5, 9.2_

- [x] 8. CalendarList 컴포넌트 구현
  - `ui/CalendarList.js` 파일 생성
  - useInfiniteCalendar Hook 연동
  - **높이 상수 정의**: `TITLE_HEIGHT=30`, `WEEKDAY_HEADER_HEIGHT=30`, `WEEK_ROW_HEIGHT=70`, `MONTH_HEIGHT=480`
  - FlashList 설정:
    - `estimatedItemSize: 480` (정확한 높이: 30 + 30 + 6×70)
    - `initialScrollIndex: 2` (현재 월)
    - `onEndReached: handleEndReached`
    - `onEndReachedThreshold: 0.2`
    - `onViewableItemsChanged`: 상단 3개월 이내 도달 시 `handleStartReached` 호출
    - `maintainVisibleContentPosition: { minIndexForVisible: 0 }`
  - MonthSection 렌더링
  - `onScrollToIndexFailed` 에러 핸들링
  - **중요**: FlashList는 `onStartReached` prop을 지원하지 않으므로 `onViewableItemsChanged`로 구현
  - _Requirements: 1.2, 1.3, 1.4, 3.4, 7.4_

- [x] 9. TodoCalendarScreen 구현
  - `TodoCalendarScreen.js` 파일 생성
  - CalendarList 컴포넌트 렌더링
  - 기본 레이아웃 (SafeAreaView, 배경색)
  - _Requirements: 8.4_

- [x] 10. Navigation 설정
  - `client/src/navigation/AppNavigator.js` 수정
  - TodoCalendarScreen 등록 (Stack.Screen)
  - 헤더 설정: title "무한 스크롤 캘린더", headerShown: true
  - _Requirements: 8.3_

- [x] 11. Settings 화면 테스트 버튼 추가
  - `client/src/screens/SettingsScreen.js` 수정
  - "무한 스크롤 캘린더 테스트" 버튼 추가
  - 버튼 클릭 시 `navigation.navigate('TodoCalendar')` 호출
  - _Requirements: 8.1, 8.2, 8.5_

- [x] 12. index.js Public API 작성
  - `client/src/features/todo-calendar/index.js` 파일 생성
  - TodoCalendarScreen export
  - _Requirements: 9.1_

- [x] 13. Checkpoint - 통합 테스트
  - Settings → "무한 스크롤 캘린더 테스트" 버튼 클릭
  - 초기 로딩 확인 (0.1초 이내, 로딩 인디케이터 없음)
  - 하단 스크롤 테스트 (10개월, 끊김 없음)
  - 상단 스크롤 테스트 (10개월, 화면 점프 없음)
  - Expo Performance Monitor로 60fps 확인
  - React DevTools로 State 크기 확인 (< 10KB for 100 months)
  - 사용자에게 질문이 있으면 확인

- [x] 14. 성능 최적화 및 마무리
  - Performance 로그 분석 (console.log 출력 확인)
  - React.memo 최적화 확인 (불필요한 리렌더링 제거)
  - FlashList drawDistance 조정 (필요 시)
  - 최종 성능 벤치마크 실행 (100개월 빠른 스크롤)
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.5_

- [ ]* 14.1 통합 성능 테스트 작성
  - 초기 로딩 시간 측정 (< 100ms)
  - 6개월 추가 시간 측정 (< 5ms)
  - State 크기 측정 (< 10KB for 100 months)
  - **Validates: Requirements 6.1, 6.3, 7.2, 7.3, 2.3**

- [x] 15. 최종 Checkpoint - 완료 기준 확인
  - ✅ 초기 로딩 0.1초 이내
  - ✅ 하단 스크롤 시 끊김 없이 미래 달력 생성
  - ✅ 상단 스크롤 시 화면 점프 없음
  - ✅ State에 Date/Day.js 객체 없음 (Primitive Only)
  - ✅ 모든 달 6주 고정 (420px 일정 높이)
  - ✅ 100개월 빠른 스크롤 → 60fps 유지
  - ✅ React DevTools → State 크기 < 10KB
  - 사용자에게 최종 확인 요청

## Notes

- `*` 표시된 태스크는 선택 사항입니다 (자동화된 테스트 프레임워크 없음)
- 각 태스크는 이전 태스크를 기반으로 점진적으로 구현됩니다
- Checkpoint에서 중간 검증을 수행하여 문제를 조기에 발견합니다
- Performance 로그는 개발 중에만 활성화하고, 프로덕션에서는 제거합니다
- Phase 1에서는 Todo 데이터 연동 없이 순수 캘린더 UI에 집중합니다

**Critical Implementation Notes**:
1. **DayObject.dateString**: React key로 사용 (date만으로는 이전/다음 월과 중복)
2. **createMonthMetadataFromDayjs**: dayjs month() 0-indexed 처리 래퍼
3. **estimatedItemSize**: 480px (title 30 + header 30 + 6주×70)
4. **onStartReached**: FlashList 미지원, onViewableItemsChanged로 구현
5. **메모리 Trim**: Phase 1에서는 단순 구현, Phase 2에서 visible index 기반으로 개선

## Testing Strategy

### Manual Testing (Phase 1)

자동화된 테스트 프레임워크가 없으므로, 다음 방법으로 수동 테스트를 수행합니다:

1. **Console Logging**: Performance 측정 및 디버깅
2. **React DevTools**: State 크기 및 리렌더링 확인
3. **Expo Performance Monitor**: FPS 측정
4. **Visual Inspection**: UI 렌더링 및 스타일링 확인

### Property-Based Testing (Future)

Phase 2에서 Jest 또는 Vitest 도입 시, 다음 Property-Based Tests를 구현합니다:

- Property 1~15: 각 Correctness Property를 100회 이상 반복 테스트
- Tag 형식: `Feature: infinite-scroll-calendar, Property N: [property_text]`
- 각 테스트는 design.md의 해당 Property를 참조

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| 초기 로딩 | < 100ms | React DevTools Profiler |
| 초기 계산 | < 10ms | console.time() |
| 스크롤 FPS | 60fps | Expo Performance Monitor |
| 추가 로딩 | < 5ms | console.time() |
| State 크기 | < 10KB | React DevTools (100개월) |
| 높이 정확도 | 100% | FlashList estimatedItemSize |
