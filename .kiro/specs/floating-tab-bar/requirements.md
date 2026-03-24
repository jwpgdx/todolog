# Requirements Document: Floating Tab Bar

## Introduction

본 문서는 앱의 메인 하단 네비게이션을 기존 기본 탭바 조합에서
`떠 있는(floating) 커스텀 TabBar`로 재설계하기 위한 요구사항을 정의한다.

이번 작업의 핵심 의도는 다음과 같다.

1. 제품용 top-level navigation을 `Todo / Calendar / My Page` 3개로 단순화한다.
2. `+`는 탭이 아니라 생성 액션으로 취급한다.
3. iOS와 Android 모두 동일한 정보 구조와 유사한 시각 구조를 사용한다.
4. 하단 바는 화면 하단에 붙는 기본 탭바가 아니라, 하단에서 살짝 떠 있는 detached row 형태를 가진다.
5. 기존 Expo Router 라우팅 계약과 Todo quick form 진입 계약은 유지한다.

관련 문서:

1. `AI_COMMON_RULES.md`
2. `PROJECT_CONTEXT.md`
3. `.kiro/specs/native-todo-form-session/requirements.md`

## Decisions (고정 결정)

1. 제품용 main tab destination은 `todo`, `calendar`, `my-page` 3개만 사용한다.
2. `calendar`는 계속 TC2를 primary monthly calendar path로 사용한다.
3. `week-flow`는 별도 tab destination으로 두지 않고, Todo 화면 내부 header 실험 라인으로만 남긴다.
4. `debug`는 top-level tab이 아니라 `My Page` 내부 진입 화면으로 유지한다.
5. `+`는 navigation destination이 아니라 create action이다.
6. `+` tap은 현재 선택된 tab을 바꾸지 않는다.
7. Android도 별도 FAB를 쓰지 않고, iOS와 동일한 "메뉴 shell + 우측 별도 원형 quick action" 구조로 통일한다.
8. 하단 바는 기본 일직선 시스템 탭바가 아니라, `iOS 26`의 detached tab bar 인상을 참고한 rounded floating bar visual을 사용한다.
9. Production target은 `iOS`와 `Android`이며, web product parity는 이번 스펙 범위 밖이다.
10. 기존 test / evaluation 전용 tab은 제품 shell에서 제거된 상태를 유지한다.
11. 탭바는 `/(app)/(tabs)` 내부의 product push screen들에서 계속 보이는 persistent shell로 유지한다.
12. `My Page` descendant product 화면은 탭바를 숨기지 않는다.
13. 이번 단계의 구현 기술은 `expo-router Tabs + custom tabBar renderer`로 고정하며, `NativeTabs` 또는 별도 native shell migration은 범위 밖으로 둔다.
14. 제품용 `My Page` descendant route family는 `/(app)/(tabs)/my-page/*`로 고정한다.
15. 현재 존재하는 `completed / favorites / inbox / upcoming / settings/* / profile/* / category/* / debug` 경로는, 제품 UI에서 계속 링크되는 동안 모두 `My Page` descendant route로 취급한다.
16. 동일한 surface를 제공하는 `/(app)` 루트 경로는 legacy duplicate로 취급하며, floating tab bar migration 이후 제품 navigation code에서 참조하지 않는다.
17. `My Page` product UI에서 직접 진입하는 ordinary push route는 `/(app)/(tabs)`, `/(app)/(tabs)/calendar`, `/(app)/(tabs)/my-page/*` 중 하나여야 한다.
18. `/native-settings-catalog` 같은 tab-shell-external public route는 `My Page` product entry로 허용하지 않으며, 유지가 필요하면 debug-only surface로 재분류하거나 제품 UI에서 제거한다.

## Requirements

### Requirement 1: Main Navigation Information Architecture

**User Story:** 사용자로서, 앱의 메인 이동 구조가 단순하고 일관되길 원한다.

#### Acceptance Criteria

1. THE main tab bar SHALL expose exactly three navigation destinations: `Todo`, `Calendar`, `My Page`.
2. THE system SHALL NOT expose `TC2`, `WF`, `Test`, or `Debug` as top-level tab items.
3. THE selected tab state SHALL always map to one of the three product destinations.
4. `Calendar` destination SHALL continue opening the current production calendar path backed by TC2.

### Requirement 2: Plus Action Semantics

**User Story:** 사용자로서, 하단 바의 `+` 버튼을 눌렀을 때 새 할 일 작성이 즉시 시작되길 원한다.

#### Acceptance Criteria

1. THE tab bar SHALL include a dedicated `+` action control in the same detached floating row, but outside the three-destination menu shell.
2. THE `+` control SHALL NOT be modeled as a product navigation destination.
3. WHEN the user taps `+` THEN the app SHALL start the todo quick-create entry flow.
4. The quick-create entry flow SHALL preserve the existing global todo form session entry contract and SHALL use `openQuick()` semantics when no todo form session is currently open.
5. WHEN the user taps `+` THEN the currently selected tab SHALL remain unchanged.
6. WHEN the todo form session is already open THEN tapping `+` SHALL NOT create a second navigation entry, SHALL NOT switch tabs, and SHALL preserve the existing form session for this phase.

### Requirement 3: Floating Visual Style

**User Story:** 사용자로서, 하단 네비게이션이 기본 시스템 바보다 더 가볍고 떠 있는 느낌으로 보이길 원한다.

#### Acceptance Criteria

1. THE tab bar SHALL render as a detached floating row visually separated from the device bottom edge.
2. THE tab bar SHALL use horizontal inset and bottom spacing rather than stretching edge-to-edge.
3. THE tab bar SHALL use a rounded container with a clearly visible large corner radius.
4. THE `+` action SHALL visually belong to the same detached row, but SHALL remain a separate circular action surface rather than part of the three-tab menu shell.
5. THE visual target SHALL be explicitly inspired by the `iOS 26` detached tab bar look rather than the legacy flat full-width tab bar.
6. Baseline spacing, radius, shadow, blur, and color tokens SHALL be defined in `design.md` before implementation, and any implementation-time tuning SHALL stay within explicitly documented tolerances.

### Requirement 4: Cross-Platform Consistency

**User Story:** 사용자로서, iOS와 Android에서 같은 앱 구조를 거의 동일하게 인지하고 싶다.

#### Acceptance Criteria

1. THE information architecture of the floating tab bar SHALL be identical on iOS and Android.
2. THE `+` action position SHALL remain at the right end of the detached row on both platforms.
3. Android SHALL NOT replace the detached-row `+` action with a separate FAB in this phase.
4. Platform-specific polish MAY differ, but the overall bar composition SHALL remain consistent across iOS and Android.

### Requirement 5: Active-State and Navigation Behavior

**User Story:** 사용자로서, 현재 어디에 있는지 하단 바만 보고도 명확히 알 수 있길 원한다.

#### Acceptance Criteria

1. THE active visual state SHALL reflect the currently focused product destination.
2. Tapping `Todo`, `Calendar`, or `My Page` SHALL navigate to that destination’s root path and SHALL clear deeper child state for that destination.
3. Reaching nested screens under `My Page` SHALL continue to map active state to the `My Page` destination until the user explicitly selects another destination.
4. Debug access SHALL remain reachable from `My Page`, but SHALL NOT create a separate top-level active destination.
5. Re-tapping the currently active destination SHALL reset that destination to its root path and SHALL NOT restore the last visited child route in this phase.

### Requirement 6: Persistent Tab Bar Policy

**User Story:** 사용자로서, 앱 안을 이동해도 하단 탭바가 계속 보이길 원한다.

#### Acceptance Criteria

1. THE floating tab bar SHALL remain visible for product routes that live under `/(app)/(tabs)`.
2. `My Page` descendant product screens such as `completed`, `favorites`, `inbox`, `upcoming`, `settings`, `profile`, `category`, and `debug` SHALL keep the tab bar visible while they remain part of the product UI.
3. The persistent visibility policy SHALL be treated as a shell contract, not as a screen-by-screen optional styling choice.
4. Explicit sheet/modal presentations using `modal`, `pageSheet`, or `formSheet` MAY temporarily cover the tab bar even when launched from within `/(app)/(tabs)`.
5. Ordinary `push` or `card` navigation inside `/(app)/(tabs)` SHALL NOT hide, cover as a shell policy, or unmount the floating tab bar.

### Requirement 7: Route and Shell Cleanup

**User Story:** 개발자로서, 제품 shell과 실험용 경로가 뒤섞이지 않게 정리하고 싶다.

#### Acceptance Criteria

1. The product tab shell SHALL NOT depend on dummy routes whose only purpose is to simulate an action button.
2. Legacy/evaluation-only tab entries removed from the product shell SHALL remain absent after the floating tab bar migration.
3. Product-owned `My Page` descendant routes SHALL exist only under `/(app)/(tabs)/my-page/*`.
4. Duplicate `/(app)` root routes that represent the same `My Page` descendant surfaces SHALL be removed, quarantined as legacy, or otherwise made unreachable from product navigation before floating bar styling work begins.
5. My Page internal routes such as completed/favorites/inbox/upcoming/settings/profile/category/debug SHALL continue to be reachable without reintroducing extra top-level tabs.
6. Ordinary push targets directly linked from `My Page` product UI SHALL resolve only to `/(app)/(tabs)`, `/(app)/(tabs)/calendar`, or `/(app)/(tabs)/my-page/*`, unless they are explicitly documented modal/sheet exceptions.

### Requirement 8: Safe Area and Device Adaptation

**User Story:** 사용자로서, 기기마다 홈 인디케이터나 하단 제스처 영역에 가려지지 않는 하단 바를 원한다.

#### Acceptance Criteria

1. THE floating tab bar SHALL respect bottom safe-area insets on modern iPhone and Android gesture-navigation devices.
2. THE bar SHALL remain visually detached while still maintaining tappable clearance above the bottom gesture area.
3. THE bar layout SHALL remain usable on compact-width phones and larger phones.
4. THE floating tab shell SHALL expose a single reserved bottom inset equal to its occupied bottom clearance, and screens under `/(app)/(tabs)` SHALL consume that shared inset instead of hard-coded bottom padding where floating bar overlap would otherwise occur.

### Requirement 9: Architecture Constraints

**User Story:** 개발자로서, 하단 바를 바꾸더라도 기존 오프라인 퍼스트와 라우팅 구조를 깨지 않길 원한다.

#### Acceptance Criteria

1. THE floating tab bar work SHALL NOT change the offline-first / SQLite source-of-truth architecture.
2. THE work SHALL NOT change todo/completion/category sync contracts.
3. THE work SHALL preserve file-based route ownership for `Todo`, `Calendar`, and `My Page`.
4. THE work SHALL preserve the existing global todo form entry path semantics even if the visual trigger changes.

## Scope

### In Scope

1. Product tab information architecture 정리
2. Floating tab bar visual 요구사항 정의
3. Detached row 안의 별도 원형 `+` create action 요구사항 정의
4. iOS / Android 공통 하단 바 구조 정의
5. Debug의 My Page 하위 진입 정책 고정
6. Legacy tab shell cleanup contract 정의
7. Persistent tab bar shell policy 정의
8. Reserved bottom inset contract 정의
9. My Page descendant route ownership 고정

### Out of Scope

1. Floating tab bar의 픽셀 단위 완성형 polish 전체 확정
2. `TabBar` 컴포넌트 파일 구조 및 내부 prop 설계
3. Native shell migration은 이번 단계 범위 밖이며, 이번 단계는 `expo-router Tabs + custom tabBar`를 사용한다.
4. Todo quick form 자체 UX 재설계
5. Web product 대응
6. Modal presentation route들이 탭바 위를 덮는 방식의 세부 애니메이션 확정
7. Bar-specific baseline token을 넘어서는 전면적인 icon/typography/color system 재설계
