# Native Managed List — Requirements

## Goal

`NativeManagedList`는 앱 안에서 사용자가 직접 관리하는 목록을 위한 공통 네이티브 리스트 family다.

대상 목록은 다음과 같다.

- My Page 안의 카테고리 목록
- Todo Screen의 일정 목록
- 카테고리별 일정 목록
- 즐겨찾기 일정 목록

공통으로 필요한 기능은 아래 세 가지다.

- long press menu
- swipe actions
- reorder

`NativeManagedList`는 `NativeSettingsList`를 대체하지 않는다.
`NativeSettingsList`는 설정/메뉴형 grouped list 전용이고, `NativeManagedList`는 관리형 content list 전용이다.

## Source Notes

초기 product rule은 루트의 `메뉴 구조.md`를 기준으로 한다.

현재 `native-list-interactions`의 `custom-lifted` iOS prototype은 `NativeManagedList`의 `category` variant 초안으로 본다.
현재 `native-settings`의 `NativeCategoryManager`는 public category adapter 후보로 보되, 최종 공통 엔진 이름은 `NativeManagedList`로 둔다.

## Scope

- ✅ 공통 managed-list contract 정의
- ✅ category / todo / favorite 계열을 수용할 수 있는 item schema 정의
- ✅ iOS / Android 상호작용 정책 분리
- ✅ 디자인 variant 개념 정의
- ✅ stable ID 기반 event contract 정의
- ✅ reorder payload를 section-aware 형태로 정의
- ✅ delete / favorite / complete 같은 domain action은 native가 직접 처리하지 않는다는 규칙 정의
- ✅ `NativeSettingsList`와 책임 경계 정의
- ✅ iOS `custom-lifted` prototype을 category variant로 승격할 수 있는 경로 정의
- ✅ iOS `todo` variant의 category-grouped pilot 경로 정의
- ✅ `TODO SCREEN > 카테고리별 순서`와 `ALL TODOS SCREEN`의 공통 interaction model 정의

- ❌ Favorite 기능 자체 구현
- ❌ Todo DB schema / sync / API 변경
- ❌ 모든 production 화면 일괄 교체
- ❌ Android 최종 UX 완성
- ❌ Web 구현
- ❌ 모든 variant의 최종 디자인 확정

## Current Rollout Slice

현재 이 spec의 rollout 범위는 아래다.

- `NativeManagedList` public contract freeze
- iOS `category` variant production path 안정화
- `My Page > 카테고리`를 기준본으로 contract 검증
- iOS `todo` variant를 `NativeTodoManagedList` wrapper로 Todo 계열 화면에 pilot 적용
- `TODO SCREEN > 카테고리별 순서`와 `ALL TODOS SCREEN`에서 같은 category-grouped interaction model 재사용
- 이후 `favoriteTodo` variant로 확장 가능한 타입/이벤트 구조 확보

현재 바로 하지 않는 범위는 아래다.

- Android production 구현
- `CATEGORY SCREEN` / `FAVORITE SCREEN` 교체
- Favorite feature 자체 구현
- order schema 재설계

즉 이 spec의 현재 목적은 "공통 엔진의 최종 범위를 한 번에 다 구현"이 아니라,
"category를 기준으로 공통 계약을 먼저 고정하고, iOS Todo 계열 pilot으로 그 계약을 검증"하는 것이다.

## Product Intent

목표는 "모든 리스트를 같은 디자인으로 통일"하는 것이 아니다.

목표는 아래처럼 나누는 것이다.

- 동작 엔진은 공통
- 디자인은 variant별
- domain mutation은 각 feature가 처리

예:

- category variant는 iOS Settings 같은 inset grouped 디자인
- todo variant는 plain content list 디자인
- favoriteTodo variant는 todo 계열이지만 즐겨찾기 화면 정책을 적용

## Hard Constraints

1. Offline-first / SQLite source-of-truth 아키텍처를 변경하지 않는다.
2. Native layer는 DB, sync, API를 직접 호출하지 않는다.
3. Native layer는 domain action의 의미를 실행하지 않고 event만 emit한다.
4. 모든 item identity는 stable string ID를 사용한다.
5. public event에 native IndexPath / adapter position을 노출하지 않는다.
6. `NativeSettingsList`에 reorder/menu/swipe managed-list 기능을 추가하지 않는다.
7. iOS / Android 구현은 같은 JS contract 뒤에 두되, UX는 플랫폼별로 다르게 허용한다.
8. handle 기반 reorder는 기본 UX로 사용하지 않는다.
9. v0 production path는 category부터 시작한다.
10. Favorite 기능은 contract에서 막지 않되, 실제 데이터 모델 구현은 별도 feature로 미룬다.
11. 현재 rollout에서는 iOS category path를 기준본으로 삼고, iOS todo category-grouped path는 같은 contract의 pilot 검증 경로로 둔다. Android는 같은 contract를 따르는 후속 구현으로 둔다.
12. `custom_order / category_order / favorite_order` 같은 order lane 해석은 feature wrapper가 담당한다.

## Functional Requirements

### FR-1: Public Component

공통 public component는 아래 형태를 가져야 한다.

```ts
type NativeManagedListProps = {
  listId?: string;
  variant: ManagedListVariant;
  sections: ManagedListSection[];
  contentInsetBottom?: number;
  onPressItem?: (event: ManagedListPressEvent) => void;
  onAction?: (event: ManagedListActionEvent) => void;
  onControlAction?: (event: ManagedListControlEvent) => void;
  onReorderCommit?: (event: ManagedListReorderCommitEvent) => void;
  onSectionExpandRequest?: (event: ManagedListSectionExpandRequestEvent) => void;
  onError?: (event: ManagedListErrorEvent) => void;
};
```

`variant`는 row 디자인과 일부 platform affordance를 결정한다.
domain business logic을 결정하지 않는다.
`contentInsetBottom`은 floating tab bar 같은 overlay가 collection view의 마지막 drop target을 가리지 않도록 native scroll inset에 전달한다.
`iosCategoryGestureMode`는 현재 rollout/debug용 bridge prop이며, product wrapper 밖으로 무분별하게 노출하지 않는다.

### FR-2: Variants

v0는 최소 아래 variant를 정의한다.

```ts
type ManagedListVariant =
  | 'category'
  | 'todo'
  | 'favoriteTodo';
```

의미:

- `category`: 카테고리 row. iOS에서는 Settings-like inset grouped 디자인.
- `todo`: 일반 일정 row. plain list 디자인.
- `favoriteTodo`: 즐겨찾기 일정 row. todo 계열이지만 favorite 화면 정책을 적용할 수 있도록 분리.

`favoriteTodo`는 Favorite 기능 구현 전에도 contract에만 존재할 수 있다.

### FR-3: Section Schema

section은 최소 아래를 가져야 한다.

```ts
type ManagedListSection = {
  id: string;
  title?: string;
  footer?: string;
  role?: 'normal' | 'favorites' | 'category' | 'date';
  reorderMode?: 'none' | 'withinSection' | 'acrossSections';
  items: ManagedListItem[];
};
```

규칙:

- section ID는 stable해야 한다.
- `reorderMode` 기본값은 `withinSection`이다.
- `acrossSections`는 TodoScreen처럼 category/favorite section 간 이동이 필요한 화면에서만 사용한다.

### FR-4: Item Schema

item은 최소 아래를 가져야 한다.

```ts
type ManagedListItem = {
  id: string;
  kind: 'category' | 'todo' | 'sectionHeader';
  title: string;
  subtitle?: string;
  metaText?: string;
  collapsed?: boolean;
  hidden?: boolean;
  subLabels?: ManagedListSubLabel[];
  enabled?: boolean;
  loading?: boolean;
  pinned?: boolean;
  reorderable?: boolean;
  selected?: boolean;
  completed?: boolean;
  favorite?: boolean;
  accentColor?: string;
  leadingControl?: ManagedListControl;
  trailingControl?: ManagedListControl;
  menuActions?: ManagedListAction[];
  leadingSwipeActions?: ManagedListAction[];
  trailingSwipeActions?: ManagedListAction[];
};
```

`subLabels`는 todo 계열 row에서 사용하는 보조 라벨 배열이다.
예:

- 즐겨찾기 표시
- 일정 날짜 / 기간
- 시간
- 반복 설정 텍스트
- TODO SCREEN 상단 즐겨찾기 그룹의 `다음 일정`

`sectionHeader`는 `todo` variant의 category-grouped mode에서 카테고리 그룹 헤더를 표현한다.
헤더는 category처럼 보일 수 있지만 domain item이 아니며, 클릭하면 접기/펼치기, long press drag이면 category section reorder를 의미한다.
`hidden`은 접힌 section의 todo row를 snapshot에서 제외하기 위한 표시 상태이고, native는 domain 삭제로 해석하지 않는다.

규칙:

- `enabled === false` 또는 `loading === true`이면 interactive action은 비활성화한다.
- `pinned === true`이면 기본적으로 reorder 대상에서 제외한다.
- `reorderable === false`이면 reorder 대상에서 제외한다.
- `completed`, `favorite`, `accentColor`는 native가 표시에는 사용할 수 있지만 domain state 변경은 직접 하지 않는다.

### FR-5: Action Schema

menu와 swipe action은 같은 action schema를 사용한다.

```ts
type ManagedListAction = {
  id: string;
  title: string;
  role?: 'normal' | 'destructive';
  systemIcon?: string;
};
```

규칙:

- Native는 action을 실행하지 않는다.
- Native는 action 선택 시 `onAction`을 emit한다.
- `delete`, `rename`, `move`, `favorite`, `unfavorite` 같은 의미는 caller가 해석한다.
- destructive action도 native가 직접 삭제하지 않는다.

### FR-6: Control Schema

row 안의 즉시 토글성 control은 action과 분리한다.

```ts
type ManagedListControl = {
  id: 'complete' | 'favorite' | string;
  kind: 'toggle';
  value: boolean;
  disabled?: boolean;
};
```

예:

- todo 완료/완료취소 버튼
- favorite 별 토글

Native는 control의 새 값을 `onControlAction`으로 emit하고, 실제 저장은 caller가 한다.

### FR-7: Events

event는 stable ID 중심이어야 한다.

```ts
type ManagedListPressEvent = {
  listId?: string;
  sectionId: string;
  itemId: string;
  itemKind: 'category' | 'todo' | 'sectionHeader';
};

type ManagedListActionEvent = {
  listId?: string;
  sectionId: string;
  itemId: string;
  actionId: string;
  source: 'menu' | 'leadingSwipe' | 'trailingSwipe';
};

type ManagedListControlEvent = {
  listId?: string;
  sectionId: string;
  itemId: string;
  controlId: string;
  value: boolean;
};

type ManagedListReorderCommitEvent = {
  listId?: string;
  movedItemId?: string;
  fromSectionId?: string;
  toSectionId?: string;
  sections: Array<{
    sectionId: string;
    orderedItemIds: string[];
  }>;
};

type ManagedListSectionExpandRequestEvent = {
  listId?: string;
  sectionId: string;
};
```

Reorder 규칙:

- `orderedItemIds`는 해당 section의 최종 visible order 전체를 포함한다.
- draggable subset만 emit하지 않는다.
- cross-section 이동이면 affected section들을 모두 포함한다.
- caller는 이 payload만으로 최종 순서를 저장할 수 있어야 한다.
- category-grouped todo mode에서 `orderedItemIds`에는 section header item ID가 포함될 수 있으므로, wrapper는 todo ID만 필터링해서 todo order를 저장한다.
- category section reorder는 section 순서로 표현하며, Inbox 같은 pinned/system category는 wrapper와 native drop constraint가 함께 보호한다.
- collapsed section hover auto-expand는 native가 UI continuity를 담당하고, 영구 펼침 상태 저장은 `onSectionExpandRequest`를 받은 wrapper가 처리한다.

### FR-8: iOS Interaction

iOS v0 목표:

- long press -> custom native menu
- menu/preview 유지 가능
- 열린 menu/preview 상태에서 item을 잡고 움직이면 reorder 가능
- horizontal swipe -> native swipe actions
- reorder handle 없음

category variant는 현재 `custom-lifted` prototype의 UX를 기준으로 한다.
todo category-grouped mode는 built-in interactive movement가 아니라 floating snapshot 기반 custom drag engine을 사용한다.
이유는 drag 중 collapsed section expand, cross-section drop, same-gesture continuity가 UIKit built-in reorder의 전제와 맞지 않기 때문이다.

Todo category-grouped iOS 목표:

- todo row long press -> custom native menu
- menu/preview 상태에서 움직이면 floating snapshot drag 시작
- 같은 카테고리 안 reorder 가능
- 다른 카테고리로 cross-section move 가능
- 접힌 카테고리 header hover 유지 시 자동 펼침 가능
- 펼쳐진 뒤 같은 gesture 안에서 보이는 gap에 drop 가능
- collection view edge 근처에서 auto-scroll 가능
- section header long press -> 해당 category를 임시 collapse 후 category reorder 가능
- Inbox/system category는 최상단 pinned 상태를 유지하고 그 위로 drop할 수 없음

### FR-9: Android Interaction

Android v0 목표:

- long press -> reorder
- trailing `⋮` 또는 row action surface -> bottom action menu
- horizontal swipe -> swipe actions
- reorder handle 없음

Android는 iOS custom lifted menu와 같은 시각/동작을 강제하지 않는다.
Android-native gesture expectation을 우선한다.

### FR-10: NativeSettingsList Boundary

`NativeSettingsList`는 아래 row family만 책임진다.

- navigationValue
- staticValue
- toggle
- menu
- selectionNavigation
- expandableParent
- embeddedContent
- action
- destructiveAction

`NativeSettingsList`는 아래를 책임지지 않는다.

- reorder
- swipe actions
- managed item long-press menu
- todo 완료 control
- favorite control
- category management

### FR-11: Domain Wrapper Policy

각 feature는 공통 `NativeManagedList` 위에 얇은 wrapper를 둘 수 있다.

예:

- `NativeCategoryManager`
- `NativeTodoManagedList`
- `NativeFavoriteList`

wrapper는 domain data를 `ManagedListSection[]`로 변환하고, native event를 domain mutation으로 연결한다.

### FR-12: MyPage V2 Policy

MyPage V2는 page schema -> block renderer 구조를 사용한다.

예:

```ts
type MyPageBlock =
  | { kind: 'settingsList'; sections: SettingsSection[] }
  | { kind: 'managedList'; variant: 'category'; sections: ManagedListSection[] };
```

일반 메뉴 block은 `NativeSettingsList`를 사용한다.
카테고리 block은 `NativeManagedList` category variant 또는 이를 감싼 `NativeCategoryManager`를 사용한다.

## Non-Goals

- `NativeSettingsList`에 managed-list 기능을 섞지 않는다.
- Native에서 domain mutation을 수행하지 않는다.
- Favorite DB/schema/sync를 이 스펙에서 구현하지 않는다.
- Todo 반복 일정 표시/완료 규칙을 이 스펙에서 구현하지 않는다.
- Web parity를 v0에서 요구하지 않는다.
