# Requirements Document: Strip Calendar - Phase 3 Recurrence Integration

## Introduction

본 문서는 `Strip_Calendar`가 Phase 3 Recurrence Engine과 연결될 때 필요한 요구사항을 정의한다.

목표:

1. `Strip_Calendar`가 별도 반복 계산 경로를 만들지 않고, 단일 recurrence-aware 데이터 경로를 사용한다.
2. 기존 스크롤/전환 UX(weekly/monthly, settle 기반)를 유지하면서 데이터 정확성을 확보한다.
3. Offline-first/SQLite source-of-truth 원칙을 유지한다.

비목표:

1. `Strip_Calendar`의 제스처/애니메이션 정책 자체를 재정의하지 않는다.
2. 서버 API 스키마를 신규로 추가하지 않는다.

## Glossary

- **Strip_Calendar**: 메인 화면 상단의 주/월 전환 캘린더
- **Recurrence_Engine**: Phase 3에서 정의된 반복 판정/전개 엔진 (`dayjs` + date-only)
- **Data_Adapter**: Strip_Calendar UI와 데이터 레이어 사이의 단일 경계
- **Ensure_Range_Loaded**: 특정 날짜 범위를 캐시에 로드(또는 캐시 히트 확인)하는 동작
- **Select_Day_Summaries**: 캐시된 일자 요약 데이터를 UI에 제공하는 읽기 동작
- **Day_Summary**: `date`, `hasTodo`, `uniqueCategoryColors`, `dotCount`를 포함하는 요약 모델
- **Settle_Event**: 스크롤/전환이 확정되어 범위 조회를 트리거할 수 있는 이벤트
- **Canonical_Date_Contract**: 날짜는 `YYYY-MM-DD`, 시간은 `HH:mm`, 둘 다 문자열 기반

## Requirements

### Requirement 1: Single Recurrence-Aware Data Path

**User Story:** 개발자로서, strip-calendar가 중복 recurrence 계산 경로를 만들지 않길 원합니다.

#### Acceptance Criteria

1. THE `Strip_Calendar` SHALL consume day summaries only through a single `Data_Adapter` boundary.
2. THE adapter implementation SHALL delegate recurrence inclusion to the Phase 3 `Recurrence_Engine` path.
3. THE `Strip_Calendar` UI layer SHALL NOT implement recurrence expansion logic directly.
4. THE integration SHALL avoid parallel long-term recurrence paths between `todo-calendar` and `strip-calendar`.

### Requirement 2: Adapter Interface Contract Fixation

**User Story:** 개발자로서, UI/데이터 결합을 안정적으로 유지하고 싶습니다.

#### Acceptance Criteria

1. THE adapter SHALL expose `ensureRangeLoaded({ startDate, endDate, reason })`.
2. THE adapter SHALL expose `selectDaySummaries({ startDate, endDate })`.
3. THE adapter contract SHALL keep date parameters as `YYYY-MM-DD` strings only.
4. THE adapter SHALL be swappable without changing `Strip_Calendar` UI component interfaces.

### Requirement 3: Canonical Date/Time Contract Preservation

**User Story:** 개발자로서, 타임존/포맷 불일치로 인한 회귀를 막고 싶습니다.

#### Acceptance Criteria

1. THE integration SHALL use canonical date contract `YYYY-MM-DD | null`.
2. THE integration SHALL use canonical time contract `HH:mm | null`.
3. THE recurrence-related comparison path SHALL remain date-only.
4. THE integration SHALL NOT reintroduce legacy fields (`date`, `startDateTime`, `endDateTime`, `timeZone`) into strip-calendar payload paths.

### Requirement 4: Offline-First and SQLite Source of Truth

**User Story:** 사용자로서, 네트워크가 없어도 캘린더가 동작해야 합니다.

#### Acceptance Criteria

1. THE `Strip_Calendar` day-summary read path SHALL use local SQLite-backed cache as primary source.
2. THE UI SHALL remain interactive when network is unavailable.
3. THE recurrence-aware summary calculation SHALL be executable from local data without server dependency.
4. Sync state SHALL NOT block strip-calendar rendering or navigation.

### Requirement 5: Query Trigger Guardrail (Settle-Only)

**User Story:** 개발자로서, 스크롤 프레임마다 조회가 발생하지 않길 원합니다.

#### Acceptance Criteria

1. THE integration SHALL trigger `ensureRangeLoaded` only on settle events (weekly settle, monthly settle, mode-switch settled target).
2. THE integration SHALL NOT trigger recurrence-aware fetch on per-frame `onScroll`.
3. THE integration MAY prefetch neighbor ranges after settle, but SHALL dedupe cached ranges.
4. THE integration SHALL execute at most one effective load request per resolved target range when switching mode.

### Requirement 6: Day Summary Payload Stability

**User Story:** 개발자로서, UI 렌더 모델이 가볍고 예측 가능하길 원합니다.

#### Acceptance Criteria

1. THE `Day_Summary` payload SHALL include only `date`, `hasTodo`, `uniqueCategoryColors`, `dotCount`.
2. THE `uniqueCategoryColors` SHALL represent category-unique values (no duplicates).
3. THE UI layer SHALL NOT require raw todo arrays to render strip-calendar dots.
4. THE payload format SHALL remain compatible with existing `DayCell` dot rules (max 3 + overflow indicator).

### Requirement 7: Range Cache Merge and Deduplication

**User Story:** 개발자로서, 중복 범위 로드로 인한 오버헤드를 줄이고 싶습니다.

#### Acceptance Criteria

1. THE adapter/data layer SHALL merge overlapping requested ranges before executing SQLite reads.
2. THE adapter SHALL skip effective fetch for fully cached ranges.
3. THE cache metadata SHALL distinguish load path (`ensure`) and read path (`select`) responsibilities.
4. THE cache behavior SHALL be consistent across weekly and monthly modes.

### Requirement 8: Mutation-Driven Invalidation Contract

**User Story:** 사용자로서, Todo/Completion 변경 후 캘린더 표시가 최신 상태이길 원합니다.

#### Acceptance Criteria

1. WHEN todo/completion/category mutations occur, THEN affected date ranges SHALL be invalidated for strip-calendar summaries.
2. Invalidation SHALL be range-scoped and SHALL NOT force full-cache clear by default.
3. The next settle-driven load after invalidation SHALL rehydrate summaries with updated recurrence-aware results.
4. Invalidations SHALL preserve offline-first behavior and SHALL NOT require immediate server roundtrip.

### Requirement 9: Weekly/Monthly Consistency Under Shared Data Path

**User Story:** 사용자로서, 주간/월간에서 같은 날짜의 dot 결과가 일관되길 원합니다.

#### Acceptance Criteria

1. THE same date SHALL produce equivalent summary output in weekly and monthly strip rendering.
2. Mode transitions SHALL NOT switch to a different summary source for the same visible range.
3. The integration SHALL preserve current mode-transition anchor policy while changing only data source wiring.
4. `Monthly -> Weekly` target resolution policy SHALL remain functionally unchanged by recurrence integration.

### Requirement 10: Timezone-Aware Today and CurrentDate Compatibility

**User Story:** 사용자로서, 오늘 표시와 선택 날짜가 타임존 기준으로 정확하길 원합니다.

#### Acceptance Criteria

1. THE recurrence-aware summary path SHALL be compatible with `todayDate` derived from user timezone.
2. THE integration SHALL preserve separation between `currentDate` (selected) and `todayDate` (derived actual today).
3. A timezone change SHALL not require app restart to reflect today marker and day summaries.
4. The strip-calendar today-jump behavior SHALL remain valid after recurrence integration.

### Requirement 11: Error Resilience and Fallback

**User Story:** 개발자로서, 파싱 실패나 데이터 오류 시에도 UI가 죽지 않길 원합니다.

#### Acceptance Criteria

1. WHEN recurrence parsing/normalization fails for a rule, THEN the system SHALL fail soft and keep UI responsive.
2. The adapter SHALL return safe fallback summaries (empty/default) instead of throwing unrecoverable UI errors.
3. Error logs SHALL include enough context (`range`, `reason`, `source`) for debugging.
4. Failed rows/rules SHALL NOT block other dates from being rendered.

### Requirement 12: Performance and Regression Guardrails

**User Story:** 개발자로서, recurrence 통합 후에도 메인 화면 성능 저하를 막고 싶습니다.

#### Acceptance Criteria

1. THE integration SHALL avoid additional per-frame JS work in strip-calendar scroll handlers.
2. THE recurrence-aware range load path SHALL be measurable by debug events and comparable before/after integration.
3. The integration SHALL keep mode transition behavior free from extra list reflow caused by data-trigger timing.
4. Validation SHALL include manual scenarios for rapid monthly scroll, repeated mode toggles, and cache-hit revisits.

### Requirement 13: Rollout and Runtime Flag Policy

**User Story:** 개발자로서, 단계적으로 위험을 제어하며 배포하고 싶습니다.

#### Acceptance Criteria

1. THE integration SHALL support controlled rollout via runtime flag or equivalent guarded activation policy.
2. Default runtime behavior before final validation MAY keep strip summary path disabled.
3. Flag-on path SHALL use the same adapter contract and SHALL NOT require UI component branching rewrite.
4. Rollback to flag-off SHALL be possible without data schema rollback.

### Requirement 14: Documentation and Source-of-Truth Alignment

**User Story:** 개발자로서, 문서 충돌 없이 유지보수 가능한 기준을 갖고 싶습니다.

#### Acceptance Criteria

1. This feature SHALL maintain source-of-truth docs in `.kiro/specs/strip-calendar-phase3-integration/`.
2. Requirements/design/tasks SHALL be updated together when integration policy changes.
3. The legacy `calendar-data-integration` docs SHALL be treated as historical reference where scope overlaps.
4. `PROJECT_CONTEXT.md` SHALL reflect runtime status changes when integration is activated.

## Scope for This Draft

포함:

1. Strip-calendar와 Phase 3 recurrence 엔진의 데이터 연계 요구사항
2. adapter 계약, 트리거 정책, 캐시/성능 가드
3. 문서 기준 경로 분리 및 정합성 정책

제외:

1. 구체 구현 코드/함수 시그니처 상세 설계
2. 테스트 코드 상세 케이스 목록
3. 서버 API 신규 스키마 확장
