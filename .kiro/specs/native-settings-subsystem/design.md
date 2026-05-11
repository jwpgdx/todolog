# Native Settings Subsystem — Design

## Background / Decision

기존 `native-list-interactions` 스파이크는 category row 상호작용 가능성을 확인하는 데는 유용했지만, production-oriented settings subsystem 전체를 담기에는 범위가 좁았다.
이번 설계는 다음을 동시에 만족시키는 방향으로 고정한다.

- shared contract는 JS/TS에 둔다.
- 핵심 리스트 렌더링과 상호작용은 native에 둔다.
- iOS / Android / Web을 분리한다.
- settings/menu grouped list와 plain interactive list를 같은 public component로 섞지 않는다.

핵심 결정:

- public family는 4개로 시작한다.
- `CategoryManager`는 category-specific family로 유지한다.
- todo 계열 plain list는 future adjacent family(`NativeTodoList`)로 둔다.
- 초기 구현은 production wiring보다 `Native Settings Catalog` 검증을 우선한다.

## High-Level Architecture

구조는 4계층으로 나눈다.

1. shared contract / schema
2. JS public facade
3. platform renderer bridge
4. native implementation

```text
Catalog / App Screen
  -> JS schema/contracts
    -> NativeSettingsList / NativeSelectionList / NativeCategoryManager / NativePickerHost
      -> ios native view / android native view / web fallback
        -> semantic event -> JS callback
```

## Public Family Boundaries

| family | semantics | appearance | reuse policy |
|------|------|------|------|
| `NativeSettingsList` | settings/menu | grouped | settings/my-page/menu only |
| `NativeSelectionList` | option selection | list | selection destination screens |
| `NativeCategoryManager` | category management | plain interactive | category-specific only |
| `NativePickerHost` | temporal/custom editor | host/editor | picker/editing only |

Adjacent future family:

| family | semantics | appearance | note |
|------|------|------|------|
| future `NativeTodoList` | todo/plain content | plain interactive | internal base reuse, public contract separate |

## Shared Contracts

### Screen Kinds

```ts
type ScreenKind =
  | 'settingsList'
  | 'selectionList'
  | 'categoryManager'
  | 'pickerHost';
```

### Section Shape

```ts
type SettingsSection = {
  id: string;
  title?: string;
  footer?: string;
  items: SettingsItem[];
};
```

### Row Kinds

```ts
type SettingsItem =
  | { kind: 'navigationValue'; ... }
  | { kind: 'staticValue'; ... }
  | { kind: 'toggle'; ... }
  | { kind: 'menu'; ... }
  | { kind: 'selectionNavigation'; ... }
  | { kind: 'expandableParent'; ... }
  | { kind: 'embeddedContent'; ... }
  | { kind: 'action'; ... }
  | { kind: 'destructiveAction'; ... }
  | { kind: 'interactiveCategory'; ... };
```

### Important Contract Decisions

| 주제 | 결정 |
|------|------|
| identity | 모든 mutation/event는 stable ID 기반 |
| event model | semantic payload only |
| category metadata | shared field는 `subtitle`로 두고, 배치는 renderer가 결정 |
| grouped/plain | contract가 아니라 family semantics로 분리 |
| todo list | 같은 contract에 억지로 넣지 않음 |
| `menu` | short single-select row. `actionId`는 `SelectionOption.id` |
| `selectionNavigation` | destination는 route path가 아니라 logical `selectionScreenId` |
| reorder payload | final visible order 전체를 포함하고 pinned/non-reorderable item도 포함 |

## Semantic Event Bridge

Native는 내부 index / adapter position / IndexPath를 public으로 노출하지 않는다.
모든 event는 native 내부에서 stable item ID로 복원한 뒤 JS로 전달한다.

```ts
type NativeSettingsEvents = {
  onPressItem?: (event: { itemId: string; kind: string }) => void;
  onToggleChange?: (event: { itemId: string; value: boolean }) => void;
  onMenuAction?: (event: { itemId: string; actionId: string }) => void;
  onNavigate?: (event: { itemId: string; destination: string }) => void;
  onSelectionCommit?: (event: { screenId: string; selectedIds: string[] }) => void;
  onExpandChange?: (event: { itemId: string; expanded: boolean }) => void;
  onReorderCommit?: (event: { orderedItemIds: string[] }) => void;
  onSwipeAction?: (event: { itemId: string; actionId: string }) => void;
  onRequestDelete?: (event: { itemId: string }) => void;
  onError?: (event: { code: string; message: string }) => void;
};
```

Event mapping clarification:

- `menu` row -> `onMenuAction({ itemId, actionId })`, where `actionId === SelectionOption.id`
- `selectionNavigation` row -> `onNavigate({ itemId, destination })`, where `destination === selectionScreenId`
- `navigationValue` row -> `onNavigate({ itemId, destination })`, where `destination === row.destination`
- `onReorderCommit({ orderedItemIds })` -> final visible order including pinned/non-reorderable items

## Internal Native Base Split

public family는 4개지만, native 내부 base는 성격별로 나눌 수 있다.

| internal base | 담당 |
|------|------|
| `GroupedSettingsListCore` | grouped settings/menu semantics |
| `SelectionListCore` | checkmark/search selection semantics |
| `PlainInteractiveListCore` | swipe/menu/reorder plain interactive semantics |
| `PickerHostCore` | temporal/custom editor host |

중요한 점:

- `PlainInteractiveListCore`는 `NativeCategoryManager`와 future `NativeTodoList`가 재사용 가능하다.
- public facade와 shared contract는 화면 의미별로 분리한다.

## iOS Design

### Base

- `UICollectionView`
- `UICollectionLayoutListConfiguration`
- `UICollectionViewDiffableDataSource`
- stable ID snapshot

### `NativeSettingsList`

- grouped / insetGrouped appearance
- section title/footer 지원
- `navigationValue`: title + trailing value + disclosure
- `staticValue`: title + value
- `toggle`: title/subtitle + `UISwitch`
- `action` / `destructiveAction`: tint / red style
- `expandableParent` + `embeddedContent`: diffable snapshot 기반 reveal

### `NativeSelectionList`

- list appearance
- selected option -> checkmark accessory
- optional search -> `UISearchController`

### `NativeCategoryManager`

- `PlainInteractiveListCore` 위에 구현
- default baseline은 `native-list-interactions` 스파이크의 system-first 경로다.
- `Custom Experiment`는 compare/reference path로만 사용한다.
- swipe actions
- long-press context menu
- diffable reordering
- same-touch handoff는 best-effort
- reorder handle fallback 허용
- category count 같은 메타 정보는 trailing value로 짧게 표시 가능

### `NativePickerHost`

- `UIDatePicker` 중심
- `date` -> inline 허용
- `time` -> compact / wheels 허용
- `dateTime` -> config 기반 inline/sheet
- `countDownTimer` -> supported

## Android Design

### Base

- `RecyclerView`
- title + summary 패턴
- Material/Android-native interaction

### `NativeSettingsList`

- grouped look을 그대로 복제하지 않는다.
- section header/footer + spacing/surface로 Android-native section 의미를 전달한다.
- `navigationValue`: title + summary/current value + chevron
- `toggle`: switch row
- `action`: standard action
- `destructiveAction`: destructive confirmation flow

### `NativeSelectionList`

- RecyclerView option list
- selected option check indicator
- optional `SearchView`

### `NativeCategoryManager`

- `PlainInteractiveListCore` 위에 구현
- swipe -> quick action
- trailing `...` -> action menu or bottom sheet
- long press -> reorder
- category count 같은 메타 정보는 subtitle/summary에 표시

### `NativePickerHost`

- dialog/sheet-style date/time 우선
- inline calendar 강제 금지

## Web Fallback Design

각 family는 `.web.tsx`를 분리한다.

| family | web 방향 |
|------|------|
| `SettingsList` | RN Web + grouped-like sections |
| `SelectionList` | list + optional search |
| `CategoryManager` | simplified reorder, explicit action buttons 허용 |
| `PickerHost` | basic date/time fallback |

## Category Row Platform Rendering

같은 데이터는 공유하고 배치만 플랫폼별로 다르게 한다.

| 항목 | iOS | Android |
|------|------|------|
| title | main title | main title |
| metadata text | trailing value | subtitle/summary |
| menu surface | long press context menu | trailing `...` |
| reorder | system-first baseline + fallback handle (`Custom Experiment`는 compare/reference only) | long press |

## Catalog-First Flow

초기 구현은 production data wiring을 하지 않는다.
대신 `Native Settings Catalog`에서 mock/in-memory schema를 렌더링한다.

Catalog responsibilities:

- family별 preview
- row pattern preview
- complete screen schema preview
- event log
- mock state mutation

Recommended schema registry:

- `my-page-main`
- `settings-general`
- `time-zone-settings`
- `language-selection`
- `time-zone-selection`
- `category-manager`
- `picker-date-time`
- `switch-dependent-child`

## File Structure

```text
.kiro/specs/native-settings-subsystem/
  requirements.md
  design.md
  tasks.md

client/
  src/
    features/
      settings/
        contracts.ts
        types.ts
        adapters.ts
        catalog/
          exampleSchemas.ts
        native/
          NativeSettingsList.tsx
          NativeSettingsList.web.tsx
          NativeSelectionList.tsx
          NativeSelectionList.web.tsx
          NativeCategoryManager.tsx
          NativeCategoryManager.web.tsx
          NativePickerHost.tsx
          NativePickerHost.web.tsx

  modules/
    native-settings/
      package.json
      expo-module.config.json
      src/
        index.ts
        NativeSettings.types.ts
      ios/
        NativeSettings.podspec
        NativeSettingsModule.swift
        SettingsListView.swift
        SelectionListView.swift
        CategoryManagerView.swift
        PickerHostView.swift
      android/
        build.gradle
        src/main/java/expo/modules/nativesettings/
          NativeSettingsModule.kt
          SettingsListView.kt
          SelectionListView.kt
          CategoryManagerView.kt
          PickerHostView.kt
```

`native-settings` 모듈 구조는 현재 저장소의 working local Expo module(`client/modules/native-list-interactions/`) 패턴을 따른다.
`package.json`, `src/index.ts`, iOS podspec, Android `build.gradle`는 선택사항이 아니라 repo-buildable shape의 필수 구성으로 본다.

## Risks / Open Decisions

| 주제 | 현재 결정 |
|------|------|
| iOS same-touch menu->reorder | best-effort only |
| Android menu surface | trailing `...` 우선 |
| grouped vs plain 공용화 | public facade는 분리, internal base만 재사용 |
| build shape | existing local Expo module pattern을 따른다 |
| future todo list | v1 구현 범위 밖, boundary만 문서화 |
