# Native Managed List — Design

## Background / Decision

기존 `native-list-interactions` 스파이크는 iOS category row에서 원하는 UX를 실험했다.
이후 product 방향은 category뿐 아니라 todo, category-detail todo, favorite todo 목록에도 같은 핵심 interaction을 쓰는 쪽으로 확장되었다.

따라서 기존 `NativeCategoryManager`를 최종 공통 primitive로 키우지 않는다.
대신 별도 공통 family인 `NativeManagedList`를 둔다.

핵심 결정:

- `NativeSettingsList`와 분리한다.
- 동작 엔진은 공통화한다.
- row 디자인은 variant로 분리한다.
- domain mutation은 각 feature wrapper가 처리한다.
- iOS / Android native 구현은 분리한다.
- v0는 category variant를 첫 production candidate로 삼는다.

## Current Implementation Target

현재 구현 목표는 전체 family 완성이 아니다.
우선순위는 아래다.

1. `NativeManagedList` contract 고정
2. iOS `category` variant 기준본 안정화
3. `My Page > 카테고리`를 production validation path로 사용
4. 그다음 `todo` / `favoriteTodo` variant 확장
5. Android 구현은 같은 contract 뒤에서 후속 진행

따라서 현재 design의 핵심은 "공통 primitive를 화면 전체에 즉시 적용"이 아니라,
"category path를 통해 공통 contract를 동결"하는 데 있다.

## Conceptual Model

```text
App screen / page schema
  -> block renderer
    -> domain wrapper
      -> NativeManagedList JS facade
        -> iOS native managed list view
        -> Android native managed list view
```

예:

```text
MyPageV2
  -> settingsList block -> NativeSettingsList
  -> category block -> NativeCategoryManager -> NativeManagedList(variant="category")

TodoScreen
  -> todo list block -> NativeTodoManagedList -> NativeManagedList(variant="todo")

FavoriteScreen
  -> favorite block -> NativeFavoriteList -> NativeManagedList(variant="favoriteTodo")
```

## Responsibility Split

### NativeManagedList 책임

- section / item 렌더링
- platform-native gesture handling
- long press menu
- swipe actions
- reorder interaction
- stable ID event emit
- variant별 row surface rendering

### Feature wrapper 책임

- domain data -> `ManagedListSection[]` 변환
- `custom_order / category_order / favorite_order` 같은 order lane 해석
- event -> domain mutation 연결
- route navigation
- delete confirmation policy
- complete/favorite mutation
- sync/cache invalidation

### NativeManagedList가 하지 않는 것

- SQLite write
- server sync
- category/todo business rule 실행
- 반복 일정 계산
- favorite 기능 저장
- 실제 삭제 수행

## Naming

공통 family 이름은 `NativeManagedList`로 한다.

이유:

- `InteractiveList`는 너무 넓다.
- `ActionList`는 reorder 의미가 약하다.
- `ManagedList`는 사용자가 목록을 수정/삭제/이동/정렬하는 성격을 가장 잘 표현한다.

## File Structure

권장 최종 구조:

```text
client/
  modules/
    native-managed-list/
      ios/
      android/
      src/
  src/
    components/
      ui/
        native-managed-list/
          NativeManagedList.tsx
          NativeManagedList.web.tsx
          types.ts
    features/
      category/
        native/
          NativeCategoryManager.tsx
      todo/
        native/
          NativeTodoManagedList.tsx
      favorites/
        native/
          NativeFavoriteList.tsx
```

v0에서는 기존 `native-list-interactions` prototype을 바로 삭제하지 않는다.
먼저 새 module/facade로 category path를 복제/승격하고, 검증 후 prototype route를 정리한다.

## Public Contract

공통 타입은 `NativeManagedList` 전용으로 둔다.
기존 `settings/types.ts`의 `SettingsSection`에 억지로 합치지 않는다.

요약:

```ts
type ManagedListVariant = 'category' | 'todo' | 'favoriteTodo';

type ManagedListSection = {
  id: string;
  title?: string;
  footer?: string;
  role?: 'normal' | 'favorites' | 'category' | 'date';
  reorderMode?: 'none' | 'withinSection' | 'acrossSections';
  items: ManagedListItem[];
};

type ManagedListItem = {
  id: string;
  kind: 'category' | 'todo';
  title: string;
  subtitle?: string;
  metaText?: string;
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

`subtitle` / `metaText`는 category 계열의 단순 보조 텍스트에 주로 사용한다.
`todo` 계열은 여러 보조 라벨을 동시에 표현해야 하므로 `subLabels`를 기본 surface로 사용한다.

`subLabels` 예:

- `favorite` 표시
- 날짜 / 기간
- 시간
- 반복 설정 텍스트
- TODO SCREEN 상단 즐겨찾기 그룹의 `다음 일정`

## Event Model

모든 event는 stable ID 중심이다.

Native가 emit하는 최소 event:

- `onPressItem`
- `onAction`
- `onControlAction`
- `onReorderCommit`
- `onError`

`onAction`은 menu/swipe를 하나로 받는다.

```ts
type ManagedListActionEvent = {
  listId?: string;
  sectionId: string;
  itemId: string;
  actionId: string;
  source: 'menu' | 'leadingSwipe' | 'trailingSwipe';
};
```

이 설계에서는 `delete`도 action ID일 뿐이다.
Native는 삭제하지 않고 caller가 처리한다.

## Reorder Payload

기존 category prototype의 `orderedIds: string[]`는 단일 section에서는 충분하지만 TodoScreen처럼 여러 section 사이 이동이 들어가면 부족하다.

따라서 `NativeManagedList`는 section-aware reorder event를 사용한다.

```ts
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
```

규칙:

- affected section의 최종 order 전체를 emit한다.
- native index는 public으로 노출하지 않는다.
- pinned/non-reorderable item도 최종 visible order에 포함한다.
- 어떤 order lane(`category`, `custom`, `favorite`)을 실제로 갱신할지는 caller가 결정한다.

## Variant Rendering

### `category`

iOS:

- inset grouped/settings-like row
- leading color dot
- title
- trailing count/meta + chevron
- long press custom native menu
- lifted lightweight preview
- swipe actions
- handle 없는 reorder

Android:

- category row
- leading color indicator
- title
- optional subtitle/meta
- trailing `⋮`
- long press reorder
- swipe actions

### `todo`

iOS / Android 공통 개념:

- plain content list row
- leading complete toggle
- title
- optional sub labels
- optional trailing favorite toggle
- swipe actions
- reorder

세부 디자인은 v0에서 확정하지 않는다.

### `favoriteTodo`

`todo` 계열 variant다.

차이:

- favorite screen policy를 표현할 수 있도록 별도 variant로 둔다.
- 즐겨찾기 해제 후 즉시 사라지지 않는 UX는 feature wrapper가 처리한다.
- favorite order 저장은 Favorite feature에서 처리한다.

## iOS Implementation Direction

현재 iOS 구현은 `category` variant를 먼저 production quality로 끌어올린다.

이 단계에서 필요한 결정:

- `client/src/components/ui/native-managed-list/types.ts`를 public contract source로 고정
- `NativeCategoryManager`를 category adapter로 유지할지, 더 얇게 줄일지 결정
- `NativeManagedList` facade가 `sections -> native payload -> typed event` 흐름을 안정적으로 제공하는지 검증
- `My Page > 카테고리`에서 menu / swipe / reorder path가 contract대로 동작하는지 검증

`todo` / `favoriteTodo`는 현재 즉시 구현 대상이 아니라, 같은 contract가 수용할 수 있도록 타입과 event surface를 먼저 고정하는 단계다.

iOS v0는 현재 `NativeListInteractionsView.swift`의 `custom-lifted` 경로를 기준으로 한다.

가져올 것:

- lightweight preview
- two-phase lift animation
- custom native menu
- persistent menu after finger release
- focused preview pan -> reorder
- native swipe actions

수정할 것:

- `category`에 박힌 이름을 managed-list generic 이름으로 바꾼다.
- action schema를 string array에서 structured action으로 바꾼다.
- reorder event를 section-aware payload로 바꾼다.
- variant별 row renderer를 분리한다.

## Android Implementation Direction

Android는 iOS와 동일한 lifted menu를 강제하지 않는다.

v0 방향:

- RecyclerView
- ItemTouchHelper
- long press reorder
- trailing `⋮` action menu 또는 bottom sheet
- swipe actions
- stable ID event bridge

Android 최종 구현은 iOS category v0가 안정된 뒤 진행한다.

## MyPage V2 Integration

MyPage V2는 page schema -> block renderer 방식으로 진행한다.

예:

```ts
type MyPageBlock =
  | { kind: 'settingsList'; sections: SettingsSection[] }
  | { kind: 'managedList'; variant: 'category'; sections: ManagedListSection[] };
```

일반 메뉴는 `NativeSettingsList`.
카테고리는 `NativeCategoryManager` 또는 `NativeManagedList(variant="category")`.

중요:

- MyPage 전체를 `NativeManagedList`로 만들지 않는다.
- 카테고리만 managed list block이다.
- 일반 메뉴 row는 settings family로 유지한다.

## Migration Strategy

1. Spec으로 contract 고정
2. TS type/facade 추가
3. iOS category variant만 먼저 구현
4. NativeCategoryManager adapter를 새 엔진 위에 얇게 얹기
5. MyPage V2 category block 적용
6. Todo variant 설계/구현
7. Android 구현
8. Favorite feature 구현 후 favoriteTodo variant 연결

## Open Questions

- TodoScreen의 cross-section reorder 저장 정책
- category detail screen의 todo order DB field 확인
- Favorite feature DB/schema/sync 설계
- Todo 반복 일정 완료/표시 정책과 managed list event 연결
- Android action surface를 PopupMenu로 갈지 bottom sheet로 갈지
