# Requirements Document: Strip Calendar (Main Screen)

## Introduction

Strip Calendar는 `TodoScreen` 메인 화면에서 날짜 선택을 담당하는 경량 캘린더 컴포넌트입니다.

이번 단계의 목표는 **겉모습(UI shell) + 제스처/전환 동작 + 날짜 선택 UX**를 우선 구현하는 것입니다.
실제 일정 조회/반복 전개(Recurrence)는 Phase 3 통합 경로 확정 후 연결합니다.

핵심 원칙:

1. 메인 화면용이므로 가볍게 동작해야 한다.
2. 드래그 기반 높이 조절은 제외하고, 스와이프 감지 기반 모드 전환만 지원한다.
3. 카테고리 dot은 일정 개수가 아니라 카테고리 unique 기준으로 표시한다.

## Glossary

- **Strip_Calendar**: 메인 화면 상단의 경량 캘린더 컴포넌트
- **Weekly_Mode**: 7일 1주만 표시하는 축소 모드
- **Monthly_Mode**: 주 단위 리스트를 세로로 보여주는 확장 모드
- **Mode_Toggle_Bar**: 하단 `v` 바 형태의 전환 핸들(UI), 스와이프로만 모드 전환
- **Week_Row**: 7개 날짜 셀로 구성된 한 줄
- **Month_Boundary_Label**: 월이 바뀌는 날짜 셀(예: 2월 1일)에 표시되는 작은 월 라벨
- **Category_Dot_Set**: 해당 날짜 일정의 카테고리 집합(중복 제거)
- **Day_Selection**: 날짜 탭 시 `currentDate`를 해당 날짜로 변경하는 동작
- **Today_Date**: 사용자 설정 타임존 기준 실제 오늘 날짜(`YYYY-MM-DD`)
- **Today_Marker**: Day cell에서 오늘을 표시하는 시각적 상태
- **Data_Adapter**: 캘린더 UI가 일정 dot 데이터를 가져오는 추상 인터페이스
- **Unified_Recurrence_Path**: Phase 3에서 확정할 반복 포함 단일 조회/판정 경로

## Requirements

### Requirement 1: Main Screen Embedding

**User Story:** 사용자로서, 메인 Todo 화면에서 바로 날짜를 선택하고 이동하고 싶습니다.

#### Acceptance Criteria

1. THE system SHALL render `Strip_Calendar` on `TodoScreen` main area
2. THE `Strip_Calendar` SHALL control selected date used by Todo list filtering
3. WHEN a date cell is tapped, THEN THE system SHALL update selected date (`YYYY-MM-DD`)

### Requirement 2: Weekly Base Mode (7-day strip)

**User Story:** 사용자로서, 기본 화면에서 1주(7일)만 간결하게 보고 싶습니다.

#### Acceptance Criteria

1. THE default mode SHALL be `Weekly_Mode`
2. THE `Weekly_Mode` SHALL render exactly 7 day cells
3. THE currently selected day SHALL be visually highlighted
4. THE visible week boundary SHALL follow user `startDayOfWeek` setting from local settings (`sunday` or `monday`)

### Requirement 3: Weekly Horizontal Navigation

**User Story:** 사용자로서, 좌우 스와이프로 이전 주/다음 주로 빠르게 이동하고 싶습니다.

#### Acceptance Criteria

1. THE `Weekly_Mode` SHALL support horizontal swipe gestures
2. WHEN swiping left, THEN THE calendar SHALL move to next week
3. WHEN swiping right, THEN THE calendar SHALL move to previous week
4. THE navigation SHALL allow continuous week traversal (no hard boundary)

### Requirement 4: Gesture Model Decision (Performance)

**User Story:** 개발자로서, 메인 화면 성능을 위해 무거운 상호작용을 피하고 싶습니다.

#### Acceptance Criteria

1. THE implementation SHALL compare `drag-to-resize` vs `swipe-detection-only` interaction model
2. THE final interaction model SHALL use `swipe-detection-only` for mode switching
3. THE implementation SHALL NOT include continuous drag-based height interpolation
4. THE decision rationale SHALL be documented in design/tasks phase

### Requirement 5: Monthly Expanded Mode (Week stack)

**User Story:** 사용자로서, 월 단위로 주차 흐름을 세로로 보고 싶습니다.

#### Acceptance Criteria

1. THE calendar SHALL support `Monthly_Mode`
2. THE `Monthly_Mode` SHALL display week rows in vertical order
3. THE week list SHALL continue across month boundaries (e.g., `29|30|31|1|2|3|4`)
4. THE `Monthly_Mode` SHALL support infinite vertical navigation semantics
5. THE week-row generation SHALL use user `startDayOfWeek` setting from local settings (`sunday` or `monday`)

### Requirement 6: Max Height with Scrollable Content

**User Story:** 사용자로서, 화면을 과도하게 차지하지 않으면서 월 보기 내용을 스크롤로 탐색하고 싶습니다.

#### Acceptance Criteria

1. THE `Monthly_Mode` container SHALL cap visible height to six week rows
2. WHEN content exceeds six rows, THEN content SHALL be vertically scrollable
3. THE `Weekly_Mode` SHALL remain one-row height

### Requirement 7: Bottom Toggle Bar (Swipe-only)

**User Story:** 사용자로서, 하단 바를 통해 위/아래 스와이프로 주/월 모드를 빠르게 전환하고 싶습니다.

#### Acceptance Criteria

1. THE calendar SHALL render a bottom `Mode_Toggle_Bar` with chevron-like indicator (`v`)
2. WHEN user swipes up on toggle area, THEN mode SHALL switch to `Monthly_Mode`
3. WHEN user swipes down on toggle area, THEN mode SHALL switch to `Weekly_Mode`
4. THE toggle SHALL NOT support free-form drag height adjustment

### Requirement 8: Header Controls

**User Story:** 사용자로서, 헤더에서 현재 기준 월을 확인하고 모드/주 이동을 제어하고 싶습니다.

#### Acceptance Criteria

1. THE header right area SHALL display current `year + month`
2. THE header right area SHALL include a toggle arrow to switch `Weekly_Mode <-> Monthly_Mode`
3. THE header left area SHALL include `<` and `>` controls for week navigation
4. Header controls and swipe navigation SHALL remain behaviorally consistent

### Requirement 9: Month Boundary Label in Week Row

**User Story:** 사용자로서, 주차 내에서 월이 바뀌는 지점을 직관적으로 보고 싶습니다.

#### Acceptance Criteria

1. WHEN a day cell belongs to a new month within the same week row, THEN THE cell SHALL show a small month label
2. THE label SHALL be visually secondary (small/subtle)
3. THE label SHALL work in both weekly and monthly representations where applicable

### Requirement 10: Category Dot Deduplication

**User Story:** 사용자로서, 날짜별 일정 현황을 카테고리 기준으로 간결하게 보고 싶습니다.

#### Acceptance Criteria

1. THE day cell SHALL compute dots using unique category set, not raw todo count
2. WHEN multiple todos belong to same category, THEN THE day cell SHALL show one dot for that category
3. WHEN todos span multiple categories, THEN THE day cell SHALL show one dot per category
4. THE dot color SHALL match category color
5. THE day cell SHALL display at most 3 category dots
6. WHEN unique category count is 4 or more, THEN THE day cell SHALL render a small `+` overflow indicator

### Requirement 11: Main Screen Date Selection Contract

**User Story:** 개발자로서, 캘린더 선택과 Todo 리스트 필터가 동일한 날짜 상태를 사용하길 원합니다.

#### Acceptance Criteria

1. THE selected date contract SHALL be `YYYY-MM-DD` string
2. THE `Strip_Calendar` SHALL integrate with existing date store used by Todo list
3. WHEN selected date changes in calendar, THEN main list query date SHALL change accordingly

### Requirement 12: Lightweight Rendering and State

**User Story:** 개발자로서, 메인 화면 프레임 드랍 없이 캘린더를 유지하고 싶습니다.

#### Acceptance Criteria

1. THE `Strip_Calendar` SHALL avoid expensive per-frame gesture calculations
2. THE state model SHALL separate mode state from data state
3. THE implementation SHALL avoid unnecessary full re-renders on unrelated state changes
4. THE design SHALL prefer primitive/serializable state for calendar navigation metadata

### Requirement 13: Monthly List Implementation (FlashList Mandatory)

**User Story:** 개발자로서, 안드로이드 고속 스크롤에서도 빈 화면 없이 월간 리스트를 안정적으로 보여주고 싶습니다.

#### Acceptance Criteria

1. THE `Monthly_Mode` vertical week list SHALL use `@shopify/flash-list` as the required list implementation
2. THE implementation SHALL NOT use `FlatList` as the primary monthly scrolling path
3. THE `FlashList` configuration SHALL include virtualization-friendly sizing (e.g., `estimatedItemSize`) for stable rendering
4. THE design rationale SHALL document that FlashList is chosen to reduce blank-area risk during fast Android scrolling

### Requirement 14: Data Integration Deferred with Adapter Contract

**User Story:** 개발자로서, UI shell을 먼저 완성하고 이후 Phase 3 단일 경로로 데이터를 연결하고 싶습니다.

#### Acceptance Criteria

1. THE current phase SHALL implement UI shell without final recurrence data fetch coupling
2. THE `Strip_Calendar` SHALL define a `Data_Adapter` interface for day-level category dots
3. THE adapter SHALL be swappable so that Phase 3 `Unified_Recurrence_Path` can be plugged in later
4. THE current phase MAY use placeholder/mock/empty adapter output for dot rendering pipeline validation

### Requirement 15: Phase 3 Integration Guardrail

**User Story:** 개발자로서, 나중에 recurrence 통합 시 중복 조회 경로가 생기지 않게 하고 싶습니다.

#### Acceptance Criteria

1. THE strip-calendar data binding SHALL align with Phase 3 recurrence engine integration strategy
2. THE implementation SHALL avoid hardcoding a second long-term recurrence computation path inside strip-calendar
3. THE final recurrence-aware fetch source SHALL be decided in Phase 3 design approval

### Requirement 16: Localization by User Local Settings

**User Story:** 사용자로서, 월/요일 표시가 내 로컬 설정(언어/주 시작 요일)에 맞게 바뀌길 원합니다.

#### Acceptance Criteria

1. THE `Strip_Calendar` SHALL read display locale settings from local user settings (`authStore`-backed settings)
2. THE month title and weekday labels SHALL follow user `language` setting (`system`, `ko`, `en`, `ja`)
3. WHEN `language` is `system`, THEN THE calendar SHALL follow the resolved app/system language path already used by i18n
4. THE week layout calculation SHALL follow `startDayOfWeek` setting (`sunday` or `monday`) in both `Weekly_Mode` and `Monthly_Mode`
5. WHEN `language` or `startDayOfWeek` changes, THEN the calendar labels/layout SHALL update without requiring app restart
6. IF settings are missing, THEN the calendar SHALL use local defaults defined by settings layer (`language='system'`, `startDayOfWeek='sunday'`)
7. THE `startDayOfWeek` source SHALL be the same local settings source used by the app settings flow (`authStore` / `useSettings`)

### Requirement 17: Monthly Scroll UX (Free Scroll + Week Snap)

**User Story:** 사용자로서, 월간 뷰를 답답한 페이지 단위가 아니라 부드럽게 스크롤하되, 멈출 때는 주 단위로 깔끔하게 정렬되길 원합니다.

#### Acceptance Criteria

1. THE `Monthly_Mode` scrolling SHALL use free scrolling behavior and SHALL NOT use page-by-page snapping
2. THE monthly list SHALL set `pagingEnabled={false}`
3. THE monthly list SHALL align stop positions by week-row height using `snapToInterval={WEEK_ROW_HEIGHT}`
4. THE monthly list SHALL set `decelerationRate="fast"` to reduce over-glide after finger release
5. WHEN the user stops scrolling, THEN the visible content SHALL settle on week-row boundaries without partial-row resting states
6. THE week-snap behavior SHALL preserve smooth transition intent for `Monthly_Mode -> Weekly_Mode` anchoring

### Requirement 18: Today Marker with Timezone-Aware Derived Date

**User Story:** 사용자로서, 달력에서 실제 오늘 날짜가 선택 날짜와 별개로 정확히 표시되길 원합니다.

#### Acceptance Criteria

1. THE calendar SHALL compute `Today_Date` from user local settings timezone (`user.settings.timeZone`) using a shared derived-date path
2. THE implementation SHALL use a shared hook-based approach (e.g., `useTodayDate`) backed by timezone utility logic, not duplicated per screen
3. THE `Today_Marker` SHALL be independent from selected date (`currentDate`)
4. WHEN selected date equals `Today_Date`, THEN the day cell SHALL support composed visual state (selected + today)
5. THE `Today_Marker` SHALL work in both `Weekly_Mode` and `Monthly_Mode`
6. WHEN user timezone setting changes, THEN the `Today_Marker` SHALL update without requiring app restart

## Scope for This Draft

포함:

- Weekly/Monthly 전환 UI
- 제스처/헤더/토글바 상호작용
- 날짜 선택 및 메인 화면 연결 계약
- 카테고리 중복 제거 dot 표시 규칙
- 데이터 어댑터 인터페이스 정의(연결 지점만)

제외:

- 최종 recurrence 확장/판정 로직
- 최종 단일 조회 경로 구현
- 서버/API 변경

## Open Questions (to resolve in Design Phase)

1. Weekly horizontal navigation 구현체: `Pager` vs `gesture + virtual 3-page` 중 선택 기준
2. Mode 전환 애니메이션 수준(즉시 전환 vs 짧은 transition)
3. Phase 3 통합 시 strip-calendar adapter의 정확한 함수 시그니처
