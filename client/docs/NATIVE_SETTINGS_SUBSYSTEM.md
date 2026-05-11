# Native Settings Subsystem

**작성일:** 2026-03-18
**상태:** Draft
**목적:** Expo SDK 55 기반 앱에서 재사용 가능한 네이티브 설정 서브시스템의 큰 방향, 구조, 계약, 구현 순서를 한 문서에서 정리한다.
**문서 역할:** 이후 `.kiro/specs/native-settings-subsystem/`로 분해하기 전의 상위 설계 문서

---

## 1. 문서 요약

| 항목 | 내용 |
|------|------|
| 대상 앱 | Todolog Expo SDK 55 client |
| 핵심 목표 | iOS / Android 각각 네이티브 기술로 구현한 재사용 가능한 설정 UI 서브시스템 구축 |
| 기본 원칙 | shared contract는 JS/TS에 두고, renderer는 iOS / Android / Web을 분리 |
| foundation | local Expo Module |
| v1 비목표 | Expo Go 대응, `@expo/ui` 기반 통합 구현, row 단위 개별 bridge, giant `Platform.OS` component |
| 주요 결과물 | `SettingsList`, `SelectionList`, `CategoryManager`, `PickerHost` 4개 family |
| 사용 방식 | 화면마다 직접 row 조합을 하드코딩하기보다 schema 기반으로 선언하고 renderer가 해석 |
| 장기 방향 | theme 대응, 일부 디자인 통합 가능성, catalog/demo 페이지를 통한 조합 관리 |

---

## 2. 왜 이걸 따로 만드는가

| 문제 | 현재 일반 RN 컴포넌트만으로는 부족한 이유 | 이번 서브시스템의 방향 |
|------|------|------|
| 설정 화면 재사용성 부족 | 화면마다 row 조합이 달라지고 구현이 퍼지기 쉬움 | shared contract + reusable family 제공 |
| 플랫폼 UX 차이 | iOS와 Android의 자연스러운 settings interaction이 다름 | 시각과 interaction을 플랫폼별 native semantics로 분리 |
| 상호작용이 강한 리스트 | reorder, swipe, long-press menu 같은 동작은 JS-only 조합이 불안정할 수 있음 | CategoryManager를 별도 native family로 분리 |
| picker 종류 확장 | date/time/custom editor를 일반 row 안에 억지로 섞으면 구조가 커짐 | PickerHost를 분리해 heavy editor를 수용 |
| 향후 유지보수 | 기능을 붙일수록 giant settings component가 생기기 쉬움 | family 분리 + screen schema 기반 구성 |

---

## 3. 최상위 제품 목표

| 구분 | 내용 |
|------|------|
| 목표 1 | 설정/마이페이지/선택/카테고리 관리류 UI를 같은 계약 계층 위에서 재사용 가능하게 만든다 |
| 목표 2 | iOS는 UIKit 기반, Android는 RecyclerView 기반으로 네이티브답게 구현한다 |
| 목표 3 | Web은 별도 fallback renderer로 기능 동등성을 제공한다 |
| 목표 4 | stable ID 기반 이벤트 계약으로 reorder, selection, action을 안전하게 처리한다 |
| 목표 5 | 나중에 catalog/demo 페이지에서 여러 조합을 한 번에 보며 빠르게 적용 가능한 구조를 만든다 |

---

## 4. Hard Rules

| 규칙 | 결정 |
|------|------|
| Expo SDK | Expo SDK 55 고정 |
| 실행 환경 | development build 전제, Expo Go 비대상 |
| native foundation | local Expo Module 사용 |
| core UI foundation | `@expo/ui`를 v1 foundation으로 사용하지 않음 |
| bridge granularity | row 하나당 native view를 만드는 방식 금지 |
| JS facade | public JS API는 shared contract를 유지 |
| renderer split | iOS / Android / Web 구현을 분리 |
| identity | `sectionId`, `itemId`, `screenId`, `pickerId` 등 stable ID를 source of truth로 사용 |
| public event | index / position / IndexPath / adapter position을 public contract로 노출하지 않음 |
| architecture | giant universal settings component 금지 |

---

## 5. v1 범위와 비범위

### 5.1 v1 포함 범위

| 영역 | 포함 내용 |
|------|------|
| SettingsList | navigation value, static value, toggle, menu, selectionNavigation, action, destructive action, expandable parent, embedded content |
| SelectionList | single-select, multi-select readiness, checkmark/check indicator, optional search |
| CategoryManager | reorder, swipe actions, long-press menu/context action |
| PickerHost | date, time, dateTime, countdown timer, temporal presentation hint handling 중심 |
| Web fallback | 기본 parity 제공 |
| demo/catalog | family별 예제 schema를 한 화면 또는 여러 테스트 route에서 확인 가능하도록 구성 |

### 5.2 v1 비범위

| 항목 | 이유 |
|------|------|
| Expo Go 지원 | local native module 기반이므로 비현실적 |
| iOS/Android pixel-perfect 통일 | 플랫폼 semantic 차이를 유지하는 편이 맞음 |
| generic form builder 전체 대체 | 이 문서는 settings subsystem에 집중 |
| row-level bridge 남발 | bridge 비용과 유지보수성이 나빠짐 |
| 완전한 theme token system | v1에서는 확장 포인트만 설계 |
| exact same-touch menu-to-reorder handoff 강제 | 특히 iOS에서 best-effort만 목표 |

---

## 6. 최종 family 구조

| Family | 역할 | 대표 사용처 | 핵심 상호작용 |
|------|------|------|------|
| `SettingsList` | 일반 설정 홈 / grouped settings screen | 앱 설정, 마이페이지 메뉴, 옵션 진입 화면 | tap, toggle, expand, inline value |
| `SelectionList` | 옵션 선택 전용 화면 | 언어, 타임존, 정렬, 지역, 시작 요일 | single-select, multi-select readiness, search |
| `CategoryManager` | 카테고리 특화 상호작용 리스트 | 카테고리 순서 변경, 삭제, 편집 액션 | reorder, swipe, long press menu |
| `PickerHost` | temporal-first editor host | 날짜/시간 선택, 시간 관련 편집기 | inline/sheet/dialog/compact hint handling |

### 6.1 Settings / Category / Todo 경계

| public family | grouped/plain | 주 역할 | 대표 화면 |
|------|------|------|------|
| `NativeSettingsList` | grouped | 설정/마이페이지 메뉴 | settings home, my page menu |
| `NativeCategoryManager` | plain interactive | 카테고리 관리 | category manager |
| `NativeTodoList` (future adjacent family) | plain interactive | todo 목록/카테고리 내부 일정/즐겨찾기 목록 | todo screen, category todo list, favorites |

현재 settings subsystem v1의 공식 public family는 `SettingsList`, `SelectionList`, `CategoryManager`, `PickerHost` 4개를 유지한다.
다만 todo 계열 화면이 같은 gesture/list 기반을 필요로 할 경우, `SettingsList`나 `CategoryManager`를 억지로 확장하지 말고 별도 `NativeTodoList` family로 분리한다.

---

## 7. Family별 역할 구분 기준

| 질문 | 들어갈 family |
|------|------|
| 일반 설정 목록인가 | `SettingsList` |
| 여러 옵션 중 선택하는 화면인가 | `SelectionList` |
| reorder + swipe + long-press action이 핵심인가 | `CategoryManager` |
| date/time/custom editor를 열거나 host해야 하는가 | `PickerHost` |

이 구분을 유지해야 giant settings component로 다시 뭉개지지 않는다.
특히 `CategoryManager`는 범용 settings list가 아니라 카테고리 관리 전용 family로 유지한다.
todo 메인 목록, 카테고리 내부 일정 목록, 즐겨찾기 목록은 grouped settings semantics가 아니라 plain interactive list semantics이므로 별도 `NativeTodoList` 계열로 분리하는 것이 맞다.

---

## 8. Public JS API 방향

| facade 이름 | 플랫폼 파일 | 역할 |
|------|------|------|
| `NativeSettingsList` | `NativeSettingsList.tsx`, `NativeSettingsList.web.tsx` | grouped settings home renderer |
| `NativeSelectionList` | `NativeSelectionList.tsx`, `NativeSelectionList.web.tsx` | option picking renderer |
| `NativeCategoryManager` | `NativeCategoryManager.tsx`, `NativeCategoryManager.web.tsx` | interaction-heavy manager renderer |
| `NativePickerHost` | `NativePickerHost.tsx`, `NativePickerHost.web.tsx` | picker/editor host renderer |

### 8.1 공통 import 목표

| 목표 | 예시 |
|------|------|
| JS caller는 shared module path만 바라본다 | `src/features/settings/native/NativeSettingsList` |
| non-web wrapper는 Expo Modules `requireNativeViewManager()`를 사용한다 | native view 연결 |
| web wrapper는 RN Web 기반 fallback을 직접 렌더링한다 | DOM/RNW fallback |

---

## 9. Shared Data Contract

### 9.1 공통 식별자

| 이름 | 타입 | 설명 |
|------|------|------|
| `screenId` | `string` | screen schema 식별자 |
| `sectionId` | `string` | section 식별자 |
| `itemId` | `string` | row 식별자 |
| `selectionScreenId` | `string` | selection screen 연결 ID |
| `embeddedContentId` | `string` | expandable child content 연결 ID |
| `pickerId` | `string` | picker host 식별자 |

### 9.2 screen kind

| 값 |
|------|
| `settingsList` |
| `selectionList` |
| `categoryManager` |
| `pickerHost` |

### 9.3 row kind

| 값 | 설명 |
|------|------|
| `navigationValue` | title + current value + disclosure |
| `staticValue` | title + static trailing value |
| `toggle` | switch row |
| `menu` | inline option set or short selection |
| `selectionNavigation` | selection screen으로 이동 |
| `expandableParent` | child content reveal control |
| `embeddedContent` | inline embedded editor host |
| `action` | 일반 action row |
| `destructiveAction` | 파괴적 action row |
| `interactiveCategory` | 카테고리 관리 전용 reorder/swipe/menu 대상 row. `subtitle` 같은 메타 텍스트는 플랫폼별로 다르게 배치될 수 있음 |

### 9.4 대표 타입 스케치

```ts
export type SettingsSection = {
  id: string;
  title?: string;
  footer?: string;
  items: SettingsItem[];
};

export type SettingsItem =
  | {
      kind: 'navigationValue';
      id: string;
      title: string;
      value?: string;
      destination: string;
      enabled?: boolean;
    }
  | {
      kind: 'staticValue';
      id: string;
      title: string;
      value?: string;
      enabled?: boolean;
    }
  | {
      kind: 'toggle';
      id: string;
      title: string;
      subtitle?: string;
      value: boolean;
      enabled?: boolean;
      childVisibilityKey?: string;
    }
  | {
      kind: 'menu';
      id: string;
      title: string;
      value?: string;
      options: SelectionOption[];
      selectedOptionId?: string;
      enabled?: boolean;
    }
  | {
      kind: 'selectionNavigation';
      id: string;
      title: string;
      value?: string;
      selectionScreenId: string;
      enabled?: boolean;
    }
  | {
      kind: 'expandableParent';
      id: string;
      title: string;
      value?: string;
      expanded: boolean;
      embeddedContentId: string;
      enabled?: boolean;
    }
  | {
      kind: 'embeddedContent';
      id: string;
      contentType: 'date' | 'time' | 'dateTime' | 'custom';
      temporalConfig?: TemporalConfig;
      enabled?: boolean;
    }
  | {
      kind: 'action';
      id: string;
      title: string;
      enabled?: boolean;
    }
  | {
      kind: 'destructiveAction';
      id: string;
      title: string;
      enabled?: boolean;
      confirmStyle?: 'alert' | 'sheet';
    }
  | {
      kind: 'interactiveCategory';
      id: string;
      title: string;
      subtitle?: string; // shared metadata text, e.g. "일정 12개"
      reorderable: boolean;
      pinned?: boolean;
      swipeActions?: SwipeActionSpec[];
      menuActions?: MenuActionSpec[];
      enabled?: boolean;
    };

export type SelectionOption = {
  id: string;
  label: string;
  subtitle?: string;
  keywords?: string[];
};

export type TemporalConfig = {
  mode: 'date' | 'time' | 'dateTime' | 'countDownTimer';
  minISO?: string;
  maxISO?: string;
  minuteInterval?: number;
  locale?: string;
  timeZone?: string;
  calendar?: string;
  presentation?: 'inline' | 'sheet' | 'dialog' | 'compact';
};

export type SwipeActionSpec = {
  id: string;
  title: string;
  role?: 'normal' | 'destructive';
};

export type MenuActionSpec = {
  id: string;
  title: string;
  role?: 'normal' | 'destructive';
};
```

---

## 10. Event Model

### 10.1 public event contract

| 이벤트 | payload | 설명 |
|------|------|------|
| `onPressItem` | `{ itemId, kind }` | 일반 row press |
| `onToggleChange` | `{ itemId, value }` | toggle value 변경 |
| `onMenuAction` | `{ itemId, actionId }` | `menu` row에서는 `SelectionOption.id` 기반 선택 결과 |
| `onNavigate` | `{ itemId, destination }` | `navigationValue`는 route destination, `selectionNavigation`은 logical `selectionScreenId` |
| `onSelectionCommit` | `{ screenId, selectedIds }` | selection 결과 commit |
| `onExpandChange` | `{ itemId, expanded }` | expandable row 상태 변경 |
| `onReorderCommit` | `{ orderedItemIds }` | reorder 완료. pinned/non-reorderable item을 포함한 최종 visible order 전체 |
| `onSwipeAction` | `{ itemId, actionId }` | swipe action 선택 |
| `onRequestDelete` | `{ itemId }` | delete 요청 |
| `onError` | `{ code, message }` | native/contract/rendering error |

### 10.2 event 설계 원칙

| 원칙 | 설명 |
|------|------|
| semantic-first | 의미 중심 이벤트만 노출 |
| ID-first | index가 아니라 stable ID를 사용 |
| native translation | 플랫폼 내부 gesture/adapter/index는 native 내부에서 해석 |
| JS simplicity | JS caller는 이벤트 결과만 받아 상태를 갱신 |

### 10.3 금지 사항

| 금지 | 이유 |
|------|------|
| raw `IndexPath` 노출 | 플랫폼 종속성이 강함 |
| adapter position 노출 | reorder 이후 취약 |
| index를 source of truth로 저장 | 데이터 변이 시 깨지기 쉬움 |

---

## 11. 플랫폼별 구현 원칙

| 플랫폼 | 원칙 | 주의점 |
|------|------|------|
| iOS | UIKit list interaction 우선 | Apple system UX를 최대한 활용 |
| Android | RecyclerView + Android-native semantics | iOS를 그대로 복제하지 않음 |
| Web | RN Web / DOM fallback | 기능 parity 위주, interaction parity는 일부 완화 가능 |

---

## 12. iOS 설계 방향

### 12.1 base renderer

| 항목 | 결정 |
|------|------|
| list foundation | `UICollectionView` |
| list layout | `UICollectionLayoutListConfiguration` |
| data source | `UICollectionViewDiffableDataSource` |
| identity | stable item ID 기반 diffable snapshot |
| appearance | grouped / insetGrouped 계열 |
| section support | header/footer 대응 |

### 12.2 iOS family별 방향

| Family | 구현 방향 |
|------|------|
| `SettingsList` | title/value/disclosure, switch, action, expandable + embedded content |
| `SelectionList` | collection-view list + checkmark accessory + optional search |
| `CategoryManager` | trailing swipe actions + context menu + diffable reordering + reorder handle fallback |
| `PickerHost` | date inline 가능, time compact/wheels 허용, dateTime은 config 따라 inline/sheet 선택 |

### 12.3 iOS 중요 판단

| 주제 | 방향 |
|------|------|
| menu vs reorder same-touch handoff | best-effort only |
| reorder 시작점 | default baseline은 `native-list-interactions`의 system-first 경로로 두고, `System + Custom` / `Custom Experiment`는 compare/reference 실험으로만 사용한다. 항상 reorder handle fallback 제공 |
| custom gesture | v1 기본안이 아니라 보조 실험안이 아니라, `interactiveCategory` 한정으로 검증된 정책만 사용 |
| visual style | iOS Settings/List 느낌 유지 |
| category metadata 표현 | 카테고리 내 일정 수 같은 짧은 메타 텍스트는 trailing value 영역에 배치하고, 필요 시 chevron과 함께 표시 |

---

## 13. Android 설계 방향

### 13.1 base renderer

| 항목 | 결정 |
|------|------|
| list foundation | `RecyclerView` |
| renderer family | 4개 family 모두 `RecyclerView` 기반 v1 |
| row semantics | Android title + summary 패턴 우선 |
| interaction | Material/Android-native flow 우선 |

### 13.2 Android family별 방향

| Family | 구현 방향 |
|------|------|
| `SettingsList` | title + summary/value + chevron/switch/action row |
| `SelectionList` | option list + check indicator + optional `SearchView` |
| `CategoryManager` | `ItemTouchHelper` 기반 swipe quick action + trailing `...` action menu + long-press reorder |
| `PickerHost` | dialog/sheet style date/time picking 우선 |

### 13.3 Android 중요 판단

| 주제 | 방향 |
|------|------|
| iOS visual mimicry | 하지 않음 |
| menu interaction | long press가 아니라 trailing `...` overflow action menu 또는 bottom sheet로 분리 |
| reorder gesture | long press reorder를 기본으로 하고, 필요 시 drag handle fallback 검토 |
| inline date UI | 필요할 때만, 무리해서 iOS 스타일을 복제하지 않음 |
| category metadata 표현 | 카테고리 내 일정 수 같은 메타 텍스트는 title 아래 subtitle/summary로 표시 |

### 13.4 Category Row Platform Rendering

| 항목 | iOS | Android |
|------|------|------|
| 카테고리 제목 | main title | main title |
| 카테고리 메타 텍스트 | trailing value 영역에 짧게 표시 가능 | title 아래 subtitle/summary로 표시 |
| 우측 액션 | disclosure/chevron + 필요 시 reorder fallback handle | trailing `...` action menu |
| 빠른 액션 | swipe actions | swipe quick actions |
| reorder 진입 | system-first baseline + fallback handle (`System + Custom`, `Custom Experiment`는 compare/reference only) | long press |

같은 데이터는 shared contract에서 관리하고, 실제 배치는 renderer가 플랫폼 규칙에 맞게 결정한다.

---

## 14. Web fallback 방향

| 항목 | 방향 |
|------|------|
| 구현 파일 | `.web.tsx` 별도 구현 |
| foundation | React Native Web / DOM-friendly component |
| parity 목표 | 기능 parity |
| 비목표 | native gesture parity |
| category manager | reorder는 단순화 또는 지연 가능 |
| swipe action | explicit button으로 대체 가능 |

### 14.1 web v1 최소 지원

| 기능 | 지원 여부 |
|------|------|
| navigation row | 지원 |
| static value | 지원 |
| switch row | 지원 |
| selection screen | 지원 |
| action/destructive row | 지원 |
| simple expansion | 지원 |
| basic date/time fallback | 지원 |
| advanced native-like swipe/reorder | 단순화 가능 |

---

## 15. 로컬 Expo Module 전략

| 항목 | 결정 |
|------|------|
| 모듈 위치 | `client/modules/native-settings/` |
| 이유 | 현재 프로젝트의 local Expo module 패턴과 일치 |
| JS facade와의 관계 | JS 쪽 public facade는 `client/src/features/settings/native/`에 두고, 실제 native view는 local module에서 제공 |
| native view names | `NativeSettingsListView`, `NativeSelectionListView`, `NativeCategoryManagerView`, `NativePickerHostView` |

### 15.1 예상 구조

```text
client/
  src/
    features/
      settings/
        contracts.ts
        types.ts
        adapters.ts
        catalog/
          exampleSchemas.ts
        screens/
          SettingsScreen.tsx
          SelectionScreen.tsx
          CategoryManagerScreen.tsx
          PickerScreen.tsx
        native/
          NativeSettingsList.tsx
          NativeSettingsList.web.tsx
          NativeSelectionList.tsx
          NativeSelectionList.web.tsx
          NativeCategoryManager.tsx
          NativeCategoryManager.web.tsx
          NativePickerHost.tsx
          NativePickerHost.web.tsx
          // future adjacent family:
          // NativeTodoList.tsx
          // NativeTodoList.web.tsx

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
        // future shared base reuse:
        // PlainInteractiveListCore.swift
      android/
        build.gradle
        src/main/java/expo/modules/nativesettings/
          NativeSettingsModule.kt
          SettingsListView.kt
          SelectionListView.kt
          CategoryManagerView.kt
          PickerHostView.kt
        // future shared base reuse:
        // PlainInteractiveListCore.kt

  app/
    (app)/(tabs)/my-page/
      settings/
        index.js
    (app)/test/
      native-settings-catalog.js
      native-settings-selection.js
      native-settings-category-manager.js
      native-settings-picker.js
```

---

## 16. JS 계층 구조

| 계층 | 책임 |
|------|------|
| contracts/types | shared schema, event payload, validation helper |
| adapters | app domain state를 settings schema로 변환 |
| native facade | platform wrapper, prop normalization, native event mapping |
| app screens | 실제 route 화면, state binding, navigation wiring |
| catalog/examples | 예시 schema와 조합 모음 |

### 16.2 shared native base 재사용 방향

| 내부 base | 재사용 대상 | 역할 |
|------|------|------|
| `GroupedSettingsListCore` | `NativeSettingsList` | grouped settings semantics |
| `PlainInteractiveListCore` | `NativeCategoryManager`, future `NativeTodoList` | plain appearance + swipe/menu/reorder infra |
| `SelectionListCore` | `NativeSelectionList` | checkmark/search selection |
| `PickerHostCore` | `NativePickerHost` | temporal/custom editor host |

중요한 점은 internal base를 재사용하더라도 public facade와 data contract는 화면 의미에 맞게 분리한다는 것이다.

### 16.1 adapter가 필요한 이유

| 이유 | 설명 |
|------|------|
| app state 분리 | auth/settings/category domain과 renderer contract를 분리 |
| 유지보수 | 실제 저장 구조가 바뀌어도 renderer contract는 유지 가능 |
| 테스트 | fixture/schema 기반 preview가 쉬워짐 |

---

## 17. Catalog / Demo 페이지 전략

이 시스템은 나중에 빠르게 적용하려면 단일 컴포넌트보다 “예제 schema를 한 번에 보는 페이지”가 중요하다.
이 테스트/프리뷰 허브의 작업명은 우선 `Native Settings Catalog`로 둔다.

### 17.1 목표

| 목표 | 설명 |
|------|------|
| 빠른 조합 검토 | 어떤 row 구성이 어떤 family로 가야 하는지 즉시 확인 |
| schema 기반 대화 | 사용자가 “이 메뉴는 이 조합”이라고 말하면 그대로 mapping 가능 |
| regression 확인 | platform별 렌더링/이벤트 동작 smoke 확인 |
| 향후 theme 실험 | 같은 schema를 theme별로 미리 보기 가능 |

### 17.2 추천 catalog 구성

| 섹션 | 내용 |
|------|------|
| Overview | 4개 family 요약 |
| Settings examples | navigation, toggle, menu, expandable, action |
| Selection examples | single, multi-select readiness, search on/off |
| Category examples | reorder, swipe, menu action |
| Picker examples | date, time, dateTime, countdown, presentation hints |
| Event log | 마지막 이벤트 payload 표시 |
| Theme preview | future extension placeholder |

### 17.3 schema 예시 묶음

| schema ID | 설명 |
|------|------|
| `settings-general` | 일반 앱 설정 묶음 |
| `settings-appearance` | theme/language/start day/time zone |
| `selection-language` | 언어 선택 |
| `selection-time-zone` | 타임존 선택 + 검색 |
| `category-default` | reorder + swipe + menu |
| `picker-reminder-time` | 시간 선택 |
| `picker-date-range` | 날짜/시간 확장 예시 |

---

## 18. Theme / Style 확장 포인트

v1에서 완전한 통합 theme system을 끝내는 것은 목표가 아니지만, 나중에 확장할 수 있는 구조는 지금 열어 둔다.

| 주제 | v1 방향 | 이후 확장 |
|------|------|------|
| color theme | native default semantic color 우선 | app theme token mapping |
| typography | 플랫폼 기본값 우선 | 일부 통합 typography strategy |
| spacing | 플랫폼 list convention 우선 | cross-platform tuning token |
| destructive color | native semantic destructive 우선 | theme-aware override |
| grouped background | platform default 유지 | custom skin layer 가능성 검토 |

### 18.1 중요한 판단

| 판단 | 이유 |
|------|------|
| v1은 platform-native semantics 우선 | 안정성과 일관성이 중요 |
| theme는 override layer로 추가 | core interaction architecture와 분리해야 안전 |
| style 통합은 v2 논의 | 지금은 동작과 구조를 먼저 고정 |

---

## 19. 상태 관리와 데이터 연결 방식

| 항목 | 방향 |
|------|------|
| renderer 내부 source of truth | native 내부 임시 상태가 아니라 JS에서 받은 schema/state를 반영 |
| 실제 persistence | 기존 authStore, category hooks, app domain 로직이 담당 |
| renderer 역할 | display + interaction capture + semantic event emit |
| optimistic update | JS/domain 계층에서 처리 |

### 19.1 current project와 연결 시 주의

| 항목 | 주의 |
|------|------|
| Offline-first | 서버 의존 UI 흐름을 만들지 않음 |
| category reorder | stable ID 기반 commit만 emit |
| settings persistence | 기존 settings/auth 흐름과 contract를 명확히 분리 |
| selection commit | selected IDs만 emit하고 저장은 caller가 결정 |

---

## 20. 권장 화면 연결 방식

| route 종류 | 역할 |
|------|------|
| 실제 settings route | production 사용 화면 |
| test/catalog route | schema preview, event log, native behavior 확인 |
| picker route | 필요 시 picker 단독 host 화면 |
| selection route | 긴 옵션 목록 전용 진입 화면 |

### 20.1 예시 route

| 경로 | 목적 |
|------|------|
| `client/app/(app)/(tabs)/my-page/settings/index.js` | 실제 설정 홈 |
| `client/app/(app)/(tabs)/my-page/settings/language.js` | selection flow 실제 예 |
| `client/app/(app)/test/native-settings-catalog.js` | 전체 catalog landing |
| `client/app/(app)/test/native-settings-selection.js` | SelectionList 실험 |
| `client/app/(app)/test/native-settings-category-manager.js` | CategoryManager 실험 |
| `client/app/(app)/test/native-settings-picker.js` | PickerHost 실험 |

---

## 21. 구현 단계 제안

| Phase | 목표 | 결과물 |
|------|------|------|
| Phase 1 | shared contracts + local Expo module skeleton + web fallback shell | 타입, facade, native view skeleton |
| Phase 2 | `SettingsList` 구현 | navigationValue, staticValue, toggle, action, destructiveAction |
| Phase 3 | `SelectionList` 구현 | single-select, multi-select readiness, check indicator, search |
| Phase 4 | `PickerHost` 구현 | date, time, dateTime, countdown, presentation hint handling |
| Phase 5 | `CategoryManager` 구현 | iOS swipe/context menu/reorder, Android swipe/reorder/long-press |
| Phase 6 | app route wiring + catalog/demo + example schemas | 실제 연결 및 smoke route |

---

## 22. Acceptance Criteria

| 항목 | 완료 기준 |
|------|------|
| shared contract layer | TS contract가 family 전반에서 공통 사용됨 |
| platform split | iOS/Android renderer가 분리되어 있음 |
| web fallback | 4개 family에 대해 `.web.tsx` 존재 |
| render coverage | 4개 family 모두 렌더링 가능 |
| stable IDs | 모든 mutation/event가 stable ID 기반 |
| iOS category manager | swipe, context menu, reorder 지원 |
| Android category manager | swipe, reorder, long-press action 지원 |
| selection list | single-select + check indicator + optional search 지원, multi-select readiness가 task/fixture 수준으로 검증됨 |
| picker | date/time/countdown이 양 플랫폼에서 동작하고 presentation hint handling이 fixture 수준으로 검증됨 |
| anti-pattern 방지 | giant `Platform.OS` branch file 없음 |
| integration usability | catalog/demo 페이지에서 family 조합을 확인 가능 |

---

## 23. Anti-Patterns

| 하지 말아야 할 것 | 이유 |
|------|------|
| giant universal `SettingsList` with many flags | family 책임 분리가 무너짐 |
| row per native bridge | 성능/복잡도/유지보수 비용 증가 |
| 모든 플랫폼 차이를 TSX 한 파일에 몰기 | platform split 원칙 위반 |
| Android를 iOS처럼 보이게 강제 | 플랫폼 UX 훼손 |
| `@expo/ui`를 core foundation으로 사용 | v1 목표와 불일치 |
| JS drag-and-drop을 core category manager에 사용 | native interaction 신뢰도 저하 |
| index 기반 mutation contract | reorder 이후 취약 |

---

## 24. 이 문서를 스펙으로 분해할 때의 기준

| 스펙 문서 | 이 문서에서 가져갈 내용 |
|------|------|
| `requirements.md` | 목표, 범위, hard rules, acceptance criteria, family 역할 |
| `design.md` | module 구조, contract, iOS/Android/web 설계, event 모델 |
| `tasks.md` | phase별 구현 순서, route wiring, catalog, validation 항목 |

---

## 25. 현재 시점 권장 결론

| 질문 | 현재 결론 |
|------|------|
| 지금 바로 구현부터 들어갈까 | 아니오 |
| 먼저 큰 문서 하나로 합의할까 | 예 |
| 그 다음 스펙으로 쪼갤까 | 예 |
| 실제 프로젝트 구조는 어디 기준으로 잡을까 | `client/modules/native-settings/` + `client/src/features/settings/` |
| demo/catalog는 필요한가 | 예, 장기 재사용성과 대화형 적용을 위해 중요 |

---

## 26. 다음 단계

| 순서 | 작업 |
|------|------|
| 1 | 이 문서에서 용어, 범위, family 정의, route 구조를 수정/보완 |
| 2 | 필요하면 예시 schema 표를 더 추가 |
| 3 | 합의된 내용을 기준으로 `.kiro/specs/native-settings-subsystem/` 생성 |
| 4 | `requirements -> design -> tasks` 순서로 분해 |
| 5 | 승인 후 구현 시작 |

---

## 27. 메모

| 주제 | 메모 |
|------|------|
| 기존 `native-list-interactions` | production SOT가 아니라 spike/reference로 보는 편이 맞음 |
| 기존 settings 화면 | 새 subsystem이 안정화되면 점진적 이관 가능 |
| theme 통합 | 지금 약속할 것은 “가능성”이지 “즉시 통합”이 아님 |
| design 통합 | interaction architecture를 먼저 고정한 뒤 style layer를 올리는 순서가 안전 |
