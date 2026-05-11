# Native Settings Subsystem — Requirements

## Goal

Expo SDK 55 앱 안에서 재사용 가능한 네이티브 설정 서브시스템을 만든다.
핵심은 다음 4개 family를 shared JS/TS contract 위에 두고, iOS / Android / Web을 분리 구현하는 것이다.

- `SettingsList`
- `SelectionList`
- `CategoryManager`
- `PickerHost`

초기 구현은 기존 production 화면을 즉시 교체하는 것이 아니라, `Native Settings Catalog`에서 mock schema 기반으로 검증 가능한 상태를 만드는 것을 우선 목표로 한다.

## Scope

- ✅ local Expo module 기반 native settings subsystem 추가
- ✅ shared JS/TS contracts 추가
- ✅ `SettingsList`, `SelectionList`, `CategoryManager`, `PickerHost` public facade 설계
- ✅ iOS native renderer 추가
- ✅ Android native renderer 추가
- ✅ Web fallback renderer 추가
- ✅ section title / footer / grouped semantics 지원
- ✅ stable ID 기반 semantic event contract 정의
- ✅ `Native Settings Catalog` 테스트/프리뷰 화면 추가
- ✅ mock/in-memory schema 기반 preview와 event log 검증
- ✅ `CategoryManager`의 iOS / Android 상호작용 정책 고정
- ✅ date / time / dateTime / countdown timer host 설계

- ❌ 기존 `MyPage`, `Settings`, `Category`, `Todo` production 화면 즉시 교체
- ❌ 실제 auth/settings/category/todo store 연결
- ❌ SQLite / sync / API 계약 변경
- ❌ Expo Go 지원
- ❌ `@expo/ui` 기반 core 구현
- ❌ future `NativeTodoList` 구현
- ❌ 디자인 통합 skin/theme 완성

## Product Intent

이 기능의 목적은 "플랫폼별로 똑같이 보이는 설정 UI"가 아니다.
목적은 "같은 데이터 계약으로 iOS는 iOS답게, Android는 Android답게, Web은 기능 parity를 갖는 설정/선택/관리 UI를 제공"하는 것이다.

또한 `CategoryManager`는 일반 설정 리스트의 연장선이 아니라 카테고리 관리 전용 family로 유지한다.

## Hard Constraints

1. Target Expo SDK 55.
2. Development build를 전제로 하며 Expo Go는 비대상이다.
3. core native implementation은 local Expo module을 사용한다.
4. `@expo/ui`를 v1 foundation으로 사용하지 않는다.
5. row 하나당 native view를 bridge하는 구조를 금지한다.
6. giant cross-platform component + `Platform.OS` branch 남발을 금지한다.
7. shared public JS API는 유지하되, iOS / Android native implementation은 분리한다.
8. Web은 separate fallback implementation으로 유지한다.
9. stable ID를 모든 mutation/event의 source of truth로 사용한다.
10. public contract에 raw index / IndexPath / adapter position을 노출하지 않는다.
11. 기존 offline-first / SQLite SOT 아키텍처를 변경하지 않는다.
12. 초기 단계에서는 실제 앱 상태 연결 대신 mock/in-memory state로 검증한다.
13. `CategoryManager`는 카테고리 관리 전용이다.
14. todo/plain content list는 future adjacent family(`NativeTodoList`)로 분리하고, `SettingsList`로 재사용하지 않는다.

## Functional Requirements

### FR-1: Shared Contract Layer

공통 TS contract는 최소 아래를 지원해야 한다.

- `screenId`, `sectionId`, `itemId` stable ID
- `SettingsSection`
- `SettingsItem` discriminated union
- `SelectionOption`
- `TemporalConfig`
- `SwipeActionSpec`
- `MenuActionSpec`

`SettingsSection`은 최소 아래 필드를 가져야 한다.

```ts
type SettingsSection = {
  id: string;
  title?: string;
  footer?: string;
  items: SettingsItem[];
};
```

### FR-2: Public Family API

아래 public facade를 제공해야 한다.

- `NativeSettingsList`
- `NativeSelectionList`
- `NativeCategoryManager`
- `NativePickerHost`

non-web facade는 Expo Modules `requireNativeViewManager()`를 사용해야 한다.
web facade는 `.web.tsx` 분리 구현을 사용해야 한다.

### FR-3: SettingsList

`SettingsList`는 grouped settings screen family로 동작해야 한다.
최소 아래 row kind를 지원해야 한다.

- `navigationValue`
- `staticValue`
- `toggle`
- `menu`
- `selectionNavigation`
- `expandableParent`
- `embeddedContent`
- `action`
- `destructiveAction`

추가 규칙:

- section title / footer를 지원해야 한다.
- 한 row는 하나의 trailing 의미만 가져야 한다.
- grouped semantics는 caller가 아니라 renderer가 책임진다.

Contract clarification:

- `menu` row는 short single-select row다. generic contextual action surface가 아니다.
- `menu` row는 `options: SelectionOption[]`를 가져야 하며, 필요 시 `selectedOptionId?: string`를 가질 수 있다.
- `selectionNavigation` row는 `selectionScreenId: string`를 가져야 한다.
- `onMenuAction({ itemId, actionId })`에서 `menu` row의 `actionId`는 선택된 `SelectionOption.id`와 같아야 한다.
- `onNavigate({ itemId, destination })`에서 `selectionNavigation` row의 `destination`은 `selectionScreenId`와 같아야 한다.
- `navigationValue` row의 `destination`과 `selectionNavigation` row의 `selectionScreenId`는 서로 다른 의미를 가진다.

### FR-4: SelectionList

`SelectionList`는 option picking screen family로 동작해야 한다.
최소 아래를 지원해야 한다.

- single-select
- multi-select readiness
- selected row check indicator
- optional search
- 긴 옵션 집합에 대한 별도 screen pattern

언어 / 시작 요일 / 타임존 같은 화면은 `SelectionList` 목적지 화면으로 처리해야 한다.

### FR-5: CategoryManager

`CategoryManager`는 카테고리 관리 전용 plain interactive list family로 동작해야 한다.
일반 settings/menu list로 재사용하지 않는다.

최소 아래를 지원해야 한다.

- reorder
- swipe actions
- contextual actions
- stable ID reorder commit
- category metadata text

`interactiveCategory` row는 최소 아래를 가져야 한다.

- `title`
- `subtitle?`
- `reorderable`
- `pinned?`
- `swipeActions?`
- `menuActions?`

### FR-6: PickerHost

`PickerHost`는 heavy editor host family로 동작해야 한다.
최소 아래 temporal mode를 지원해야 한다.

- `date`
- `time`
- `dateTime`
- `countDownTimer`

최소 아래 presentation 힌트를 지원해야 한다.

- `inline`
- `sheet`
- `dialog`
- `compact`

### FR-7: Semantic Event Model

최소 아래 public event를 제공해야 한다.

- `onPressItem({ itemId, kind })`
- `onToggleChange({ itemId, value })`
- `onMenuAction({ itemId, actionId })`
- `onNavigate({ itemId, destination })`
- `onSelectionCommit({ screenId, selectedIds })`
- `onExpandChange({ itemId, expanded })`
- `onReorderCommit({ orderedItemIds })`
- `onSwipeAction({ itemId, actionId })`
- `onRequestDelete({ itemId })`
- `onError({ code, message })`

Reorder payload rule:

- `onReorderCommit({ orderedItemIds })`는 affected list의 최종 visible order 전체를 포함해야 한다.
- draggable subset만 emit해서는 안 된다.
- `pinned` 또는 non-reorderable item도 최종 visible order에 맞춰 `orderedItemIds`에 포함해야 한다.
- caller는 `orderedItemIds`만으로 최종 순서를 저장할 수 있어야 한다.

### FR-8: iOS Renderer Requirements

iOS는 UIKit 기반으로 구현해야 한다.

공통 base:

- `UICollectionView`
- `UICollectionLayoutListConfiguration`
- `UICollectionViewDiffableDataSource`
- stable item ID
- section header/footer

iOS `SettingsList`:

- grouped / insetGrouped appearance
- navigation value + disclosure
- static value
- switch row
- action / destructive action
- expandable parent + embedded content
- selectionNavigation

iOS `SelectionList`:

- collection-view list
- checkmark accessory
- optional search

iOS `CategoryManager`:

- default baseline은 `native-list-interactions` 스파이크의 system-first 경로다:
  - swipe actions
  - system context menu
  - diffable reordering
- `Custom Experiment`는 category-row coordination reference 또는 compare path로만 사용할 수 있다.
- `Custom Experiment`를 required baseline으로 승격하려면, 별도 decision record에서 supported verdict가 먼저 확정되어야 한다.
- swipe actions
- long-press context menu
- diffable reordering
- same-touch handoff는 best-effort only
- reorder handle fallback 항상 허용
- category metadata는 trailing value 쪽에 짧게 배치 가능

iOS `PickerHost`:

- date inline 허용
- time compact/wheels 허용
- dateTime은 config에 따라 inline/sheet
- countdown timer 지원

### FR-9: Android Renderer Requirements

Android는 RecyclerView 기반으로 구현해야 한다.

공통 base:

- `RecyclerView`
- Android-native title + summary semantics
- Material/Android-native interaction

Android `SettingsList`:

- title + summary/value + chevron/switch/action row
- grouped와 동일 모양 복제가 아니라 Android-native section 표현

Android `SelectionList`:

- RecyclerView option list
- check indicator
- optional `SearchView`

Android `CategoryManager`:

- `ItemTouchHelper` 기반 swipe/reorder
- trailing `...` action menu 또는 bottom sheet
- long press reorder
- iOS식 long-press menu handoff를 목표로 하지 않음
- category metadata는 title 아래 subtitle/summary로 표시

Android `PickerHost`:

- dialog/sheet-style date/time picking 우선
- iOS inline calendar 복제 강제 금지

### FR-10: Web Fallback

Web은 4 family 모두 별도 `.web.tsx` 구현을 가져야 한다.

최소 요구:

- navigation rows
- static values
- switches
- selection screens
- action/destructive rows
- simple expansion
- basic date/time fallback

Web `CategoryManager`는 다음 단순화를 허용한다.

- reorder defer 또는 simplified reorder
- swipe actions -> explicit button 치환

### FR-11: Native Settings Catalog

실제 앱 연결 전 검증용 `Native Settings Catalog` 화면을 제공해야 한다.

최소 포함:

- row pattern preview
- full screen schema preview
- family별 preview
- event log
- mock/in-memory state

최소 schema 예시:

- `my-page-main`
- `settings-general`
- `language-selection`
- `time-zone-selection`
- `category-manager`
- `picker-date-time`
- `switch-dependent-child`

### FR-12: Grouped vs Plain Boundary

- `SettingsList`는 grouped settings semantics를 가진다.
- `CategoryManager`는 plain interactive semantics를 가진다.
- future `NativeTodoList`는 plain interactive semantics를 공유하되, public contract는 별도로 가진다.
- `SettingsList`를 todo/plain content list로 사용하지 않는다.

### FR-13: Common State + Accessibility

공통 contract와 renderer는 최소 아래 상태 의미를 다룰 수 있어야 한다.

- `enabled`
- `disabled`
- `selected`
- `expanded`
- `loading`
- `error`

최소 아래 accessibility semantics를 다룰 수 있어야 한다.

- toggle semantics
- selected semantics
- reorder/delete custom actions
- destructive action meaning

## Non-Functional Requirements

- iOS/Android native renderer는 separate code path를 유지해야 한다.
- no giant `Platform.OS` branch file.
- 변경 파일은 full-file 기준으로 관리 가능한 형태여야 한다.
- catalog route 진입 시 crash가 없어야 한다.
- 기존 production 화면은 즉시 교체하지 않는다.
- local Expo module은 현재 저장소의 working local module pattern과 동일한 repo-buildable shape를 가져야 한다.
- 최소 `expo-doctor`, Android debug build, iOS simulator build 기준의 링크/빌드 검증이 가능해야 한다.

## Acceptance Criteria

완료 기준은 아래를 모두 만족할 때다.

- shared TS contract layer가 존재한다.
- `SettingsList`, `SelectionList`, `CategoryManager`, `PickerHost`가 모두 렌더링된다.
- iOS/Android native renderer가 분리되어 있다.
- Web fallback이 존재한다.
- stable ID 기반 mutation/event를 사용한다.
- iOS `CategoryManager`가 swipe/context menu/reorder를 지원한다.
- Android `CategoryManager`가 swipe/`...` action menu/long-press reorder를 지원한다.
- `menu`, `selectionNavigation`, `onReorderCommit` payload 규칙이 테스트 가능하게 고정되어 있다.
- selection list가 check indicator와 optional search를 지원한다.
- date/time rows가 양 플랫폼에서 동작한다.
- `countDownTimer`가 spec과 docs에서 동일한 수준으로 정의된다.
- `Native Settings Catalog`에서 mock schema preview가 가능하다.
- `NativeCategoryManager.web.tsx`를 포함한 4 family web fallback이 존재한다.
- `SettingsList`의 `menu`, `selectionNavigation`, `expandableParent`, `embeddedContent`, destructive confirmation flow가 task/validation까지 포함된다.
- common state layer와 accessibility semantics가 spec/task에 반영된다.
- local Expo module이 repo-buildable shape와 빌드 검증 기준을 만족한다.
- `CategoryManager`는 category-specific family로 유지된다.
- future todo/plain list 요구를 위해 internal plain interactive base 재사용 방향이 문서화되어 있다.
