# Native Settings Subsystem — Tasks

## Task 1: Spec Baseline

- `requirements.md` 작성
- `design.md` 작성
- `tasks.md` 작성
- 기존 큰 문서 2개와 스펙의 역할 분리

## Task 2: Shared Contract Layer

- `client/src/features/settings/contracts.ts` 추가
- `client/src/features/settings/types.ts` 추가
- stable ID 중심 schema 정의
- row kind discriminated union 정의
- semantic event payload 타입 정의
- `interactiveCategory`의 category-specific 규칙 반영

## Task 2.1: Common State + Accessibility Contract

- shared contract에 `enabled`, `disabled`, `selected`, `expanded`, `loading`, `error` 상태 표현 규칙 추가
- toggle/select/reorder/delete accessibility semantics 정의
- catalog fixture와 validation에 accessibility/common-state 예시 추가

## Task 3: Local Expo Module Scaffold

- `client/modules/native-settings/` scaffold 추가
- `package.json`
- `expo-module.config.json`
- `src/index.ts`
- `src/NativeSettings.types.ts`
- `ios/NativeSettings.podspec`
- `android/build.gradle`
- iOS / Android native view entry 추가:
  - `NativeSettingsListView`
  - `NativeSelectionListView`
  - `NativeCategoryManagerView`
  - `NativePickerHostView`

## Task 3.1: Native Module Packaging + Build Validation

- `client/modules/native-settings/` 구조가 existing local module pattern과 일치하는지 확인
- Expo autolinking이 `native-settings` 모듈을 감지하는지 확인
- `expo-doctor` 기준 링크 오류가 없는지 확인
- Android debug build 기준 링크/빌드 확인
- iOS simulator build 기준 링크/빌드 확인

## Task 4: JS Facade Scaffold

- `NativeSettingsList.tsx` / `.web.tsx`
- `NativeSelectionList.tsx` / `.web.tsx`
- `NativeCategoryManager.tsx` / `.web.tsx`
- `NativePickerHost.tsx` / `.web.tsx`
- non-web facade는 `requireNativeViewManager()` 사용
- web facade는 fallback renderer 사용

## Task 5: Native Settings Catalog Scaffold

- catalog route 추가
- mock schema registry 추가
- family selector / schema selector 추가
- event log UI 추가
- mock/in-memory state 관리 추가

Recommended preview set:

- `my-page-main`
- `settings-general`
- `language-selection`
- `time-zone-selection`
- `category-manager`
- `picker-date-time`
- `switch-dependent-child`

## Task 6: SettingsList Implementation

- iOS `SettingsListView.swift`
  - grouped / insetGrouped list
  - section title/footer
  - `navigationValue`
  - `staticValue`
  - `toggle`
  - `menu`
  - `selectionNavigation`
  - `expandableParent`
  - `embeddedContent` render path
  - `action`
  - `destructiveAction`
  - destructive confirmation flow
- Android `SettingsListView.kt`
  - section header/footer semantics
  - `navigationValue`
  - `staticValue`
  - `toggle`
  - `menu`
  - `selectionNavigation`
  - `expandableParent`
  - `embeddedContent` render path
  - `action`
  - `destructiveAction`
  - destructive confirmation flow
- web fallback 기본 parity 구현
- catalog에서 다음 preview 연결
  - `settings-general`
  - `time-zone-settings`
  - short-option `menu`
  - `switch-dependent-child`

## Task 7: SelectionList Implementation

- iOS `SelectionListView.swift`
  - checkmark
  - optional search
  - multi-select readiness path
- Android `SelectionListView.kt`
  - check indicator
  - optional `SearchView`
  - multi-select readiness path
- web fallback 구현
- catalog에서 언어/타임존 선택 schema 연결
- catalog에 multi-select readiness fixture 추가

## Task 8: CategoryManager iOS Implementation

- `CategoryManagerView.swift` 추가
- `PlainInteractiveListCore` 성격 반영
- `native-list-interactions`의 system-first 경로를 기본 baseline으로 사용
- `Custom Experiment`는 compare/reference path로만 재사용
- swipe actions
- long-press context menu
- reorder
- reorder handle fallback
- trailing metadata 표현
- semantic event bridge 연결

## Task 9: CategoryManager Android Implementation

- `CategoryManagerView.kt` 추가
- `ItemTouchHelper` 기반 swipe/reorder
- trailing `...` action menu 또는 bottom sheet
- long press reorder
- subtitle/summary metadata 표현
- semantic event bridge 연결

## Task 9.5: CategoryManager Web Fallback

- `NativeCategoryManager.web.tsx` 구현
- simplified reorder 또는 explicit move controls
- explicit action buttons replacing swipe
- locked/non-reorderable item handling
- semantic event bridge 연결
- catalog preview 연결

## Task 10: PickerHost Implementation

- iOS `PickerHostView.swift`
  - date
  - time
  - dateTime
  - countDownTimer
  - `inline` / `sheet` / `compact` presentation hint path
- Android `PickerHostView.kt`
  - native date/time dialog or sheet
  - `dialog` / `sheet` presentation hint path
- web fallback date/time 구현
- `expandableParent` / `embeddedContent`가 `SettingsList`에서 실제 render/change path로 연결되도록 구현
- catalog에 presentation hint fixture 추가

## Task 11: Catalog Validation Pass

### Shared Checkpoints

- same mock schema가 iOS / Android / Web에서 렌더링된다.
- section title / footer가 기대한 위치에 표시된다.
- stable ID 기반 event만 전달된다.
- row index가 public payload에 노출되지 않는다.
- `menu` row 선택 결과가 stable option ID를 emit한다.
- `selectionNavigation`이 logical destination ID를 emit한다.
- `onReorderCommit.orderedItemIds`가 pinned/non-reorderable item을 포함한 최종 visible order를 전달한다.
- event log가 모든 주요 action을 표시한다.
- local Expo module이 실제로 링크/빌드된다:
  - `expo-doctor`
  - Android debug build
  - iOS simulator build

### SettingsList Checkpoints

- `navigationValue`가 표시된다.
- `staticValue`가 표시된다.
- `toggle`이 state를 변경한다.
- `menu`가 stable option ID를 emit한다.
- `selectionNavigation`이 logical destination ID를 emit한다.
- `expandableParent` / `embeddedContent`가 mock state와 연결된다.
- `action` / `destructiveAction`이 분리 표현된다.
- destructive confirmation flow가 동작한다.

### SelectionList Checkpoints

- selected option check indicator가 표시된다.
- search on/off가 동작한다.
- multi-select readiness fixture가 crash 없이 렌더링되고 선택 상태 표현이 가능하다.

### CategoryManager Checkpoints

- iOS: swipe / context menu / reorder 동작
- Android: swipe / trailing `...` / long press reorder 동작
- Web: simplified reorder 또는 explicit action path가 crash 없이 동작한다.
- reorder 결과가 stable ID 순서로 commit된다.

### PickerHost Checkpoints

- date/time/dateTime이 렌더링된다.
- catalog mock state와 값이 연결된다.
- `inline` / `sheet` / `dialog` / `compact` presentation hint fixture가 platform policy에 맞게 처리된다.

## Task 12: Deferred / Out of Scope Record

다음은 문서에만 위치를 남기고 이번 구현 범위에서는 제외한다.

- 기존 production 화면 교체
- auth/settings/category/todo 실제 wiring
- future `NativeTodoList`
- theme token override
- segmented / numeric / detail info optional row

## Task 13: Decision Record

구현 후 최소 아래를 기록한다.

- iOS category same-touch handoff verdict
- Android category action surface 최종 선택
- grouped vs plain internal base 분리 방식
- future `NativeTodoList`로 넘길 재사용 가능 infra 목록
