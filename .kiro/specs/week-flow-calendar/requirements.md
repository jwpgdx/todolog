# Requirements Document: Week Flow Calendar

## Introduction

`Week Flow Calendar` is the replacement plan for the current `Strip Calendar Legacy`.

The goal is to keep the existing date-summary/data-adapter path, but replace the UI shell and
navigation model with a simpler, bounded, cross-platform-safe calendar.

This replacement explicitly avoids the current legacy complexity:

- giant multi-year week windows
- separate `anchor/weekly/monthly/target` navigation states
- mode-switch settle races
- platform-dependent scroll physics bugs

The new calendar must preserve the current user-facing essentials:

1. `Weekly <-> Monthly` mode switching
2. week-row based visual structure
3. month-boundary mini label inside a mixed week row
4. odd/even month subtle tint
5. selected date integration with the existing todo list contract

## Naming

- Old implementation name: `Strip Calendar Legacy`
- New implementation name: `Week Flow Calendar`
- Planned feature path: `client/src/features/week-flow-calendar/`

The old `strip-calendar` implementation remains as a temporary legacy reference only.

## Glossary

- `Week Flow Calendar`: new replacement calendar UI
- `Weekly_Mode`: single visible week row
- `Monthly_Mode`: one bounded month rendered as week rows
- `Selected_Date`: global selected date (`YYYY-MM-DD`) from `dateStore`
- `Visible_Week_Start`: the week currently shown in weekly mode
- `Visible_Month_Start`: the month currently shown in monthly mode (`YYYY-MM-01`)
- `Month_Grid`: 5 or 6 week rows required to render the visible month
- `Month_Boundary_Label`: small month label rendered above a day cell when the week contains a new month
- `Today_Marker`: visual marker for actual today derived from user timezone
- `Data_Adapter`: existing range-summary adapter path reused from current strip calendar

## Requirements

### Requirement 1: Replacement Scope

**User Story:** 개발자로서, 기존 strip-calendar를 계속 덧대지 않고 새 이름/새 구조로 분리하고 싶습니다.

#### Acceptance Criteria

1. THE new calendar SHALL be defined as `Week Flow Calendar`
2. THE planned implementation path SHALL be separate from `strip-calendar`
3. THE old `strip-calendar` docs/code SHALL be treated as legacy reference, not source of truth for the new UI

### Requirement 2: Main Screen Date Contract Reuse

**User Story:** 사용자로서, 새 캘린더를 써도 Todo 리스트는 지금처럼 같은 선택 날짜를 기준으로 동작하길 원합니다.

#### Acceptance Criteria

1. THE selected date contract SHALL remain `YYYY-MM-DD`
2. THE calendar SHALL keep using `dateStore.currentDate`
3. WHEN a day is selected, THEN the todo list filter date SHALL update through the existing global path

### Requirement 3: Weekly Mode

**User Story:** 사용자로서, 기본 상태에서는 한 주만 가볍게 보고 싶습니다.

#### Acceptance Criteria

1. THE default mode SHALL be `Weekly_Mode`
2. THE `Weekly_Mode` SHALL render exactly one week row
3. THE visible week SHALL be derived from `Visible_Week_Start`
4. THE week boundary SHALL follow `startDayOfWeek`

### Requirement 4: Monthly Mode

**User Story:** 사용자로서, 월간 모드에서는 같은 주 row 구조를 유지한 채 한 달을 보고 싶습니다.

#### Acceptance Criteria

1. THE `Monthly_Mode` SHALL render a bounded month grid, not an infinite multi-year scroll window
2. THE month grid SHALL be composed of week rows
3. THE month grid SHALL render 5 or 6 rows depending on the month layout
4. THE month grid SHALL include leading/trailing days required to fill full weeks
5. THE `Monthly_Mode` SHALL NOT rely on a giant virtualized week window
6. THE month grid SHALL keep a stable 5-row or 6-row layout and SHALL NOT collapse to a 4-row month layout

### Requirement 5: Mode Transition Rule

**User Story:** 사용자로서, 주/월 전환 시 날짜가 과거나 미래로 튀지 않고 지금 선택한 날짜 기준으로 자연스럽게 바뀌길 원합니다.

#### Acceptance Criteria

1. WHEN switching `Weekly_Mode -> Monthly_Mode`, THEN the visible month SHALL be derived from `Selected_Date`
2. WHEN switching `Monthly_Mode -> Weekly_Mode`, THEN the visible week SHALL be derived from `Selected_Date`
3. THE mode transition SHALL NOT depend on stale hidden target state from previous scroll cycles
4. THE mode transition SHALL NOT jump across years unless the selected date itself changes across years

### Requirement 6: Navigation Model

**User Story:** 사용자로서, 새 캘린더도 단순하고 예측 가능한 방식으로 이동하고 싶습니다.

#### Acceptance Criteria

1. IN `Weekly_Mode`, header prev/next SHALL move by exactly one week
2. IN `Monthly_Mode`, header prev/next SHALL move by exactly one month
3. THE bottom toggle bar SHALL keep swipe-based mode switching
4. THE new calendar SHALL NOT require inner infinite inertial scroll to navigate across months
5. IN `Weekly_Mode`, left/right swipe MAY map to the same prev/next week handlers
6. IN `Monthly_Mode`, mode switching swipe SHALL belong to the toggle bar, not to an internal scrolling month surface

### Requirement 7: Month Boundary Label

**User Story:** 사용자로서, 같은 주 안에 다른 월이 섞이면 지금처럼 작은 월 라벨이 보여야 헷갈리지 않습니다.

#### Acceptance Criteria

1. WHEN a day cell belongs to a different month within the same week row, THEN THE cell SHALL show a small month label above the day number
2. WHEN the day number is `1`, THEN THE label SHALL always be shown even if it is the first cell of the row
3. THE month label SHALL work in both weekly and monthly modes

### Requirement 8: Odd/Even Month Tint

**User Story:** 사용자로서, 월 경계가 잘 보이도록 홀수/짝수 월 배경 차이를 유지하고 싶습니다.

#### Acceptance Criteria

1. THE day cell background SHALL apply subtle odd/even month tint
2. THE tint SHALL be visually secondary
3. THE tint SHALL NOT reduce readability of selected state, today marker, or category dots

### Requirement 9: Selected/Today Visual Semantics

**User Story:** 사용자로서, 오늘과 선택 날짜를 헷갈리지 않고 보고 싶습니다.

#### Acceptance Criteria

1. THE selected date SHALL use the main selection indicator
2. THE actual today SHALL use a separate today marker
3. WHEN selected date is also today, THEN both semantics SHALL compose correctly

### Requirement 10: Adapter Reuse

**User Story:** 개발자로서, 일정 데이터 가져오는 경로는 유지하고 캘린더 UI만 갈아엎고 싶습니다.

#### Acceptance Criteria

1. THE new calendar SHALL reuse the existing date-summary adapter path
2. THE UI SHALL NOT access SQLite directly
3. THE data path SHALL continue to use range-based `ensureRangeLoaded/select` semantics
4. THE rewrite SHALL focus on UI shell, state model, and rendering behavior
5. THE rewrite MAY introduce a new calendar-specific range hook as long as it reuses the existing summary adapter/store path

### Requirement 11: Performance Guardrails

**User Story:** 개발자로서, 새 캘린더는 iOS/Android/Web 모두에서 가볍고 예측 가능해야 합니다.

#### Acceptance Criteria

1. THE new calendar SHALL avoid multi-year in-memory week windows
2. THE new calendar SHALL avoid nested settle/programmatic guard loops as primary navigation model
3. THE monthly view SHALL use a bounded 5/6-row render path rather than a long scrolling list
4. THE weekly view SHALL use a bounded render path rather than a giant horizontal list

### Requirement 12: State Simplification

**User Story:** 개발자로서, 전환 버그를 줄이기 위해 상태 수를 최소화하고 싶습니다.

#### Acceptance Criteria

1. THE new calendar SHALL NOT reintroduce separate long-lived states equivalent to:
   - `anchorWeekStart`
   - `weeklyVisibleWeekStart`
   - `monthlyTopWeekStart`
   - `weeklyTargetWeekStart`
   - `monthlyTargetWeekStart`
   unless each has a distinct unavoidable responsibility
2. THE preferred navigation state model SHALL be based on:
   - `mode`
   - `Visible_Week_Start`
   - `Visible_Month_Start`
   - `Selected_Date` (global)

### Requirement 13: Localization and Settings

**User Story:** 사용자로서, 새 캘린더도 언어/주 시작 요일/타임존 설정을 그대로 따라야 합니다.

#### Acceptance Criteria

1. THE calendar SHALL use existing user settings for `language`
2. THE calendar SHALL use existing user settings for `startDayOfWeek`
3. THE today marker SHALL remain timezone-aware through the existing app path

### Requirement 14: Logging and Debuggability

**User Story:** 개발자로서, 테스트 중에는 디버그 로그를 켜고, 평상시에는 조용히 유지하고 싶습니다.

#### Acceptance Criteria

1. THE new calendar SHALL keep its debug logs behind explicit feature flags
2. THE default runtime path SHALL avoid noisy perf logs
3. Debug logging SHALL focus on transition inputs/outputs, not high-volume scroll spam

### Requirement 15: Cross-Platform Consistency

**User Story:** 사용자로서, iOS/Android/Web 모두에서 비슷하게 동작하길 원합니다.

#### Acceptance Criteria

1. THE core calendar interaction model SHALL be the same on iOS, Android, and Web
2. THE rewrite SHALL minimize reliance on platform-specific scroll physics
3. The calendar SHALL not depend on a platform-only gesture workaround for core correctness
