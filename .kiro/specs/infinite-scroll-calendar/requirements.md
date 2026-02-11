# Requirements Document: Infinite Scroll Calendar

## Introduction

무한 스크롤 캘린더는 React Native 기반의 고성능 월간 캘린더 UI 컴포넌트입니다. 기존 UltimateCalendar의 성능 및 유지보수성 문제를 해결하기 위해 설계되었으며, FlashList 기반의 무한 스크롤과 경량화된 상태 관리를 통해 100개월 이상의 데이터를 60fps로 렌더링할 수 있습니다.

Phase 1에서는 Todo 데이터 연동 없이 순수 캘린더 UI와 무한 스크롤 메커니즘에 집중합니다.

## Glossary

- **Calendar_System**: 무한 스크롤 캘린더 전체 시스템
- **Month_Metadata**: 월 단위 메타데이터 객체 `{year, month, id}` (Primitive 타입만 포함)
- **Week_Data**: 주 단위 날짜 배열 (7개 Day 객체)
- **Day_Object**: 날짜 정보 객체 `{date, isCurrentMonth, isToday}`
- **FlashList**: Shopify의 고성능 리스트 컴포넌트
- **State_Store**: Zustand 기반 전역 상태 저장소
- **Fixed_6_Rows**: 모든 월을 6주(42일)로 고정하는 레이아웃 전략
- **Primitive_State**: Date/Day.js 객체를 제외한 순수 원시 타입 상태
- **Scroll_Threshold**: 추가 데이터 로딩을 트리거하는 스크롤 위치 (상단 20%, 하단 20%)
- **Memory_Limit**: 누적 월 데이터의 최대 개수 (100개월)
- **Retention_Count**: 메모리 제한 초과 시 유지할 최근 월 개수 (50개월)

## Requirements

### Requirement 1: 무한 스크롤 메커니즘

**User Story:** 개발자로서, 사용자가 과거와 미래의 달력을 끊김 없이 탐색할 수 있도록 무한 스크롤을 구현하고 싶습니다.

#### Acceptance Criteria

1. WHEN the Calendar_System initializes, THEN THE Calendar_System SHALL generate Month_Metadata for current month ±2 months (total 5 months)
2. WHEN the user scrolls to bottom Scroll_Threshold, THEN THE Calendar_System SHALL append 6 months of future Month_Metadata
3. WHEN the user scrolls to top Scroll_Threshold, THEN THE Calendar_System SHALL prepend 6 months of past Month_Metadata
4. WHEN Month_Metadata is prepended, THEN THE FlashList SHALL maintain visible content position without screen jump
5. WHEN total months exceed Memory_Limit, THEN THE Calendar_System SHALL retain only the most recent Retention_Count months

### Requirement 2: 경량 상태 관리

**User Story:** 개발자로서, 100개월 이상 누적 시에도 메모리 사용량을 최소화하기 위해 State를 경량화하고 싶습니다.

#### Acceptance Criteria

1. THE State_Store SHALL store only Month_Metadata as Primitive_State
2. THE State_Store SHALL NOT store Date objects or Day.js objects
3. WHEN 100 months are accumulated, THEN THE State_Store size SHALL be less than 10KB
4. THE Week_Data SHALL be computed synchronously from Month_Metadata using useMemo
5. THE Day_Object SHALL be computed synchronously from Week_Data using useMemo

### Requirement 3: 6주 고정 레이아웃

**User Story:** 개발자로서, FlashList의 estimatedItemSize 정확도를 100%로 유지하여 스크롤 안정성을 보장하고 싶습니다.

#### Acceptance Criteria

1. THE Calendar_System SHALL render all months with Fixed_6_Rows (6 weeks per month)
2. WHEN a month has fewer than 6 weeks, THEN THE Calendar_System SHALL pad with empty cells
3. WHEN a month has more than 6 weeks, THEN THE Calendar_System SHALL NOT render (this case does not exist in Gregorian calendar)
4. THE FlashList estimatedItemSize SHALL be exactly 420px (6 weeks × 70px per week)
5. THE FlashList SHALL achieve 100% height estimation accuracy

### Requirement 4: 날짜 표시 및 스타일링

**User Story:** 사용자로서, 현재 월의 날짜와 이전/다음 월의 날짜를 시각적으로 구분하여 볼 수 있기를 원합니다.

#### Acceptance Criteria

1. THE Calendar_System SHALL display weekday headers (일~토) at the top of each month
2. WHEN rendering weekday headers, THEN THE Calendar_System SHALL style Sunday in red and Saturday in blue
3. WHEN rendering Day_Object, THEN THE Calendar_System SHALL apply 30% opacity to dates not in current month
4. WHEN rendering Day_Object, THEN THE Calendar_System SHALL apply 100% opacity to dates in current month
5. THE Calendar_System SHALL display month and year title (e.g., "2025년 1월") at the top of each month section

### Requirement 5: 동기 처리 및 Race Condition 방지

**User Story:** 개발자로서, setTimeout을 제거하고 동기 처리로 race condition을 방지하고 싶습니다.

#### Acceptance Criteria

1. THE Calendar_System SHALL generate Month_Metadata synchronously (within 1ms)
2. THE Calendar_System SHALL NOT use setTimeout for data generation
3. WHEN multiple scroll events occur, THEN THE Calendar_System SHALL use isLoadingRef to prevent duplicate loading
4. WHEN scroll threshold is reached, THEN THE Calendar_System SHALL complete data generation before next scroll event
5. THE Calendar_System SHALL compute Week_Data and Day_Object synchronously without async operations

### Requirement 6: 초기 로딩 성능

**User Story:** 사용자로서, 캘린더 화면 진입 시 0.1초 이내에 로딩이 완료되어 로딩 인디케이터 없이 즉시 사용할 수 있기를 원합니다.

#### Acceptance Criteria

1. WHEN the Calendar_System mounts, THEN THE Calendar_System SHALL complete initial render within 100ms
2. THE Calendar_System SHALL NOT display loading indicator during initial mount
3. WHEN generating initial 5 months, THEN THE Calendar_System SHALL complete computation within 10ms
4. THE Calendar_System SHALL render first visible month within 50ms
5. THE FlashList SHALL achieve stable 60fps during initial render

### Requirement 7: 스크롤 성능

**User Story:** 사용자로서, 100개월 이상 누적된 상태에서도 빠르게 스크롤할 때 60fps를 유지하며 끊김 없이 탐색할 수 있기를 원합니다.

#### Acceptance Criteria

1. WHEN the user scrolls rapidly through 100 months, THEN THE FlashList SHALL maintain 60fps
2. WHEN appending 6 months, THEN THE Calendar_System SHALL complete within 5ms without blocking UI
3. WHEN prepending 6 months, THEN THE Calendar_System SHALL complete within 5ms without blocking UI
4. THE FlashList SHALL use maintainVisibleContentPosition for prepend operations
5. WHEN rendering Month_Section, THEN THE component SHALL complete render within 16ms (1 frame)

### Requirement 8: 테스트 진입점

**User Story:** 개발자로서, Settings 화면에서 새로운 캘린더를 테스트할 수 있는 진입점을 만들고 싶습니다.

#### Acceptance Criteria

1. THE Settings_Screen SHALL display a button labeled "무한 스크롤 캘린더 테스트"
2. WHEN the user taps the test button, THEN THE Calendar_System SHALL navigate to TodoCalendarScreen
3. THE TodoCalendarScreen SHALL be registered in navigation stack
4. THE TodoCalendarScreen SHALL render Calendar_System as main content
5. THE TodoCalendarScreen SHALL include a back button to return to Settings

### Requirement 9: 컴포넌트 구조 및 책임 분리

**User Story:** 개발자로서, 각 컴포넌트의 책임을 명확히 분리하여 유지보수성을 높이고 싶습니다.

#### Acceptance Criteria

1. THE useInfiniteCalendar hook SHALL manage only Month_Metadata array and scroll logic
2. THE MonthSection component SHALL compute Week_Data from Month_Metadata using useMemo
3. THE WeekRow component SHALL render 7 Day_Object cells
4. THE DayCell component SHALL render individual date with styling
5. THE calendarHelpers utility SHALL provide pure functions for date calculations (no side effects)

### Requirement 10: 날짜 계산 정확성

**User Story:** 개발자로서, 모든 월이 정확히 6주로 계산되고 날짜가 올바르게 표시되기를 원합니다.

#### Acceptance Criteria

1. WHEN calculating Week_Data, THEN THE Calendar_System SHALL include previous month's trailing dates in first week
2. WHEN calculating Week_Data, THEN THE Calendar_System SHALL include next month's leading dates in last week
3. WHEN a month starts on Sunday, THEN THE first week SHALL contain only current month dates
4. WHEN a month ends on Saturday, THEN THE last week SHALL contain only current month dates
5. FOR ALL months, THE total number of Day_Object SHALL be exactly 42 (6 weeks × 7 days)

## Phase 1 Scope

이 요구사항 문서는 Phase 1 범위를 다룹니다:
- ✅ 무한 스크롤 캘린더 UI 구현
- ✅ 날짜 표시 및 스타일링
- ✅ 성능 최적화 (State 경량화, 6주 고정)
- ✅ 테스트 진입점

Phase 2 (향후):
- ❌ Todo 데이터 연동 (SQLite 조회)
- ❌ 완료 표시 (점/체크마크)
- ❌ 날짜 클릭 이벤트
- ❌ 오늘 날짜 하이라이트

## Performance Targets

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| 초기 로딩 | < 100ms | React DevTools Profiler |
| 초기 계산 | < 10ms | console.time() |
| 스크롤 FPS | 60fps | Expo Performance Monitor |
| 추가 로딩 | < 5ms | console.time() |
| State 크기 | < 10KB | React DevTools (100개월 누적 시) |
| 높이 정확도 | 100% | FlashList estimatedItemSize |
