# Requirements Document: Week Flow Calendar

## Introduction

`Week Flow Calendar`는 `TodoScreen` 상단에 붙는 현재 주간/월간 캘린더 surface입니다.

이 구현은 `Strip Calendar Legacy`의 active runtime mount를 대체하지만,
`calendar` 탭의 메인 월간 캘린더는 계속 `Todo Calendar V2`가 담당합니다.

현재 구현 목표는 다음과 같습니다.

1. `TodoScreen` 상단에서 가벼운 주간 기본 보기 제공
2. iOS에서도 안정적인 `weekly <-> monthly` 전환 제공
3. 기존 `currentDate` / `todayDate` / day-summary 경로 재사용
4. 월간 닫힘 시 selected week 정합성 유지

## Naming

- Legacy reference: `Strip Calendar Legacy`
- Active feature: `Week Flow Calendar`
- Runtime entry: `client/src/features/week-flow-calendar/ui/WeekFlowTodoHeader.js`
- Feature path: `client/src/features/week-flow-calendar/`

## Glossary

- `Weekly_Mode`: 단일 주 row
- `Monthly_Mode`: 5-row viewport를 가진 bounded vertical week window
- `Selected_Date`: 전역 선택 날짜 (`dateStore.currentDate`)
- `Today_Date`: 타임존 기반 derived today (`useTodayDate`)
- `Visible_Week_Start`: weekly에서 현재 보여주는 주 시작일
- `Monthly_Top_Week_Start`: monthly viewport 맨 윗줄 주 시작일
- `Visible_5_Row_Window`: monthly에서 현재 보이는 5주 범위
- `Weekly_Recenter`: monthly -> weekly 닫힘 후 selected week가 viewport 안에 있을 때 수행하는 보정

## Requirements

### Requirement 1: Runtime Surface

**User Story:** 사용자로서, Todo 리스트 위에 주간/월간 헤더 캘린더가 자연스럽게 붙어 있길 원합니다.

#### Acceptance Criteria

1. THE active runtime surface SHALL mount on `TodoScreen` via `WeekFlowTodoHeader`
2. THE dedicated `week-flow` evaluation tab SHALL NOT be required for normal runtime
3. THE `calendar` tab monthly surface SHALL remain `Todo Calendar V2`

### Requirement 2: Selected Date and Today Contract Reuse

**User Story:** 사용자로서, 캘린더를 조작해도 Todo 리스트와 오늘 표시는 기존 계약 그대로 유지되길 원합니다.

#### Acceptance Criteria

1. THE selected date contract SHALL remain `YYYY-MM-DD`
2. THE calendar SHALL keep using `dateStore.currentDate`
3. THE actual today SHALL remain a derived value from `useTodayDate`
4. `currentDate` (selected) and `todayDate` (derived) SHALL remain independent

### Requirement 3: Weekly Mode

**User Story:** 사용자로서, 기본 상태에서는 한 주만 빠르게 보고 싶습니다.

#### Acceptance Criteria

1. THE default mode SHALL be `Weekly_Mode`
2. `Weekly_Mode` SHALL render exactly one visible week row
3. THE visible week SHALL be controlled by explicit `Visible_Week_Start`
4. Header prev/next and legacy swipe intent SHALL move by exactly `±1 week`

### Requirement 4: Monthly Mode

**User Story:** 사용자로서, 월간 모드에서는 5줄 viewport 안에서 주 단위로 위아래 이동하고 싶습니다.

#### Acceptance Criteria

1. `Monthly_Mode` SHALL render week rows inside a bounded vertical list
2. THE viewport SHALL show 5 visible week rows at a time
3. THE top visible week SHALL be derived from snapped scroll offset
4. THE list MAY prepend/append/trim around the viewport, but SHALL remain bounded in memory
5. Leading/trailing days required to fill full weeks SHALL remain visible

### Requirement 5: Mode Transition and Recenter Rule

**User Story:** 사용자로서, 월간/주간 전환 시 selected date와 viewport가 엇갈리지 않길 원합니다.

#### Acceptance Criteria

1. WHEN switching `Weekly_Mode -> Monthly_Mode`, THEN monthly SHALL anchor to the current `Visible_Week_Start`
2. WHEN switching `Monthly_Mode -> Weekly_Mode`, THEN the close-transition source SHALL be `Monthly_Top_Week_Start`
3. IF the selected date's week is inside the current `Visible_5_Row_Window`, THEN weekly SHALL recenter to that selected week after close
4. IF the selected date's week is outside the current `Visible_5_Row_Window`, THEN weekly SHALL keep `Monthly_Top_Week_Start`
5. Hidden-layer stale state SHALL NOT overwrite the committed weekly target after close

### Requirement 6: Drag-Snap Interaction Model

**User Story:** 사용자로서, 하단 핸들을 잡아끌어 월간을 열고 닫고 싶습니다.

#### Acceptance Criteria

1. THE bottom handle SHALL support drag-snap between `Weekly_Mode` and `Monthly_Mode`
2. THE bottom handle MAY also support tap toggle
3. Monthly drag-snap SHALL be enabled by default
4. Weekly horizontal movement SHALL remain the legacy prev/next swipe path and SHALL NOT require drag-follow carousel behavior

### Requirement 7: Visual Semantics

**User Story:** 사용자로서, today/selected/month-boundary를 헷갈리지 않고 보고 싶습니다.

#### Acceptance Criteria

1. THE selected date SHALL use the primary selection indicator
2. THE actual today SHALL use a separate today marker
3. Month-boundary mini label SHALL appear on month changes and always on day `1`
4. Odd/even month tint SHALL stay secondary to selected/today/summary-dot states

### Requirement 8: Data and Summary Reuse

**User Story:** 개발자로서, 기존 summary/invalidation 경로를 유지하고 싶습니다.

#### Acceptance Criteria

1. Week-flow SHALL reuse the existing `calendar-day-summaries` path
2. Week-flow SHALL use `useWeekFlowDaySummaryRange` for visible-range summary loading
3. THE UI SHALL NOT read SQLite directly
4. Only the active mode SHALL enable summary loading by default

### Requirement 9: Performance Guardrails

**User Story:** 개발자로서, drag-snap을 유지하면서도 숨은 레이어 간섭과 과도한 로딩을 피하고 싶습니다.

#### Acceptance Criteria

1. THE implementation SHALL avoid unbounded multi-year week windows
2. Inactive layers MAY remain mounted for transition continuity, but interaction and summary loading SHALL be restricted by mode
3. Hidden monthly top-week reports SHALL NOT override committed weekly visible-week state outside active monthly mode
4. Default runtime SHALL avoid noisy debug logging

### Requirement 10: State Responsibility

**User Story:** 개발자로서, transition 버그를 줄이기 위해 preview/recenter state의 책임을 분리하고 싶습니다.

#### Acceptance Criteria

1. The implementation MAY keep explicit preview/recenter state such as:
   - `previewWeeklyWeekStart`
   - `previewWeeklySelectedDate`
   - `monthlyViewportWeekStart`
   - `weeklyRecenterTransition`
2. Each additional state SHALL have a distinct responsibility and SHALL NOT act as an unbounded legacy anchor machine

### Requirement 11: Validation Scope

**User Story:** 개발자로서, 현재 런타임에서 어떤 검증이 끝났고 무엇이 남았는지 분명히 알고 싶습니다.

#### Acceptance Criteria

1. iOS validation SHALL cover:
   - monthly drag-snap
   - monthly -> weekly recenter
   - multi-step selected-date transition
   - today return
2. Android parity MAY remain pending after iOS functional freeze
3. Design polish MAY be deferred after functional validation
