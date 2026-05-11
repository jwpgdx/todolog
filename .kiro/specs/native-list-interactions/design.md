# Native List Interactions — Design

## Background / Decision

`Zeego`는 네이티브 메뉴 자체를 검증하는 데는 유용했지만, row-level 제스처 조합을 해결하는 핵심 primitive로는 맞지 않았다.
이번 스파이크는 `Zeego`를 row interaction의 중심에서 제거하고, 플랫폼별 네이티브 리스트 상호작용을 직접 실험하는 방향으로 전환한다.

핵심 결정:

- row interaction은 플랫폼별 native-first로 본다.
- 데이터와 상태 소스는 여전히 JS 쪽 in-memory state로 둔다.
- 공통화 대상은 "UI 모양"이 아니라 "item schema / event contract"다.
- Web은 이후 별도 전략으로 추가한다.

## High-Level Architecture

구조는 3계층으로 나눈다.

1. JS public interface
2. platform renderer bridge
3. native implementation

```text
Test Screen
  -> NativeMenuList (JS facade)
    -> ios renderer / android renderer / web placeholder
      -> native list view implementation
        -> native event -> JS callbacks
```

테스트 route는 인증된 앱 내부에만 두지 않고, 로그인 전 Welcome 경로에서도 진입 가능하도록 설계한다.
native baseline과 RN category gesture lab은 public route를 분리한다.

## JS Public Interface

테스트 화면과 향후 실제 화면은 아래 공통 인터페이스만 바라본다.

### Component Roles

- `NativeMenuList`
  - section 목록과 item 목록을 받아 렌더링
- `MenuListSection`
  - section header + grouped container 표현
- `MenuListItem`
  - 기본 메뉴 row
- `CategoryListItem`
  - 카테고리 전용 interactive row

구현 범위에서 public API는 `NativeMenuList`만 보장한다.
`MenuListSection`, `MenuListItem`, `CategoryListItem`은 내부 구현 세부 구조로 취급한다.

### Shared Item Schema

```ts
type NonDeleteMenuAction =
  | 'open'
  | 'rename'
  | 'edit'
  | 'duplicate'
  | 'archive';

type BaseItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  leadingIcon?: string | null;
  destructive?: boolean;
  disabled?: boolean;
};

type MenuRowItem =
  | (BaseItem & {
      kind: 'menu';
      variant: 'navigation';
    })
  | (BaseItem & {
      kind: 'menu';
      variant: 'switch';
      switchValue: boolean;
    })
  | (BaseItem & {
      kind: 'menu';
      variant: 'value-navigation';
      valueText: string;
    })
  | (BaseItem & {
      kind: 'menu';
      variant: 'menu';
      menuActions: NonDeleteMenuAction[];
    });

type CategoryRowItem = BaseItem & {
  kind: 'category';
  accentColor?: string | null;
  metaText?: string | null;
  reorderable: boolean;
  deletable: boolean;
  supportsMenu: boolean;
  menuActions: NonDeleteMenuAction[];
};

type NativeMenuItem = MenuRowItem | CategoryRowItem;

type NativeMenuSection = {
  id: string;
  title?: string;
  footer?: string;
  items: NativeMenuItem[];
};
```

### Shared Event Contract

```ts
type NativeMenuListEvents = {
  onPress?: (itemId: string) => void;
  onMenuAction?: (itemId: string, action: NonDeleteMenuAction) => void;
  onDelete?: (itemId: string) => void;
  onReorder?: (orderedIds: string[]) => void;
  onToggleSwitch?: (itemId: string, nextValue: boolean) => void;
};
```

이 계약은 platform renderer가 어떤 네이티브 기술을 쓰든 유지해야 한다.

Rules:

- category row는 menu-row variant 필드를 사용하지 않는다.
- delete는 절대로 `onMenuAction('delete')`로 emit하지 않는다.
- Android overflow/menu에서 delete가 선택되더라도 native는 이를 `onDelete(itemId)`로 변환해야 한다.
- `supportsMenu = false`인 category row는 `menuActions = []`이어야 한다.
- `supportsMenu = true`인 category row는 `menuActions.length > 0`이어야 한다.

### Trailing Policy

row는 trailing 의미를 하나만 가진다.

- `navigation`
- `switch`
- `value-navigation`
- `menu`

renderer는 이 variant를 플랫폼에 맞는 시각 표현으로 바꿀 수 있다.
하지만 한 row에서 `switch + menu`, `switch + value-navigation`, `menu + value-navigation`처럼 여러 trailing 행동을 동시에 노출하지 않는다.

### Public Usage Shape

사용 화면은 아래 형태로만 리스트를 넘긴다.

```ts
type NativeMenuListProps = {
  sections: NativeMenuSection[];
  onPress?: (itemId: string) => void;
  onMenuAction?: (itemId: string, action: NonDeleteMenuAction) => void;
  onDelete?: (itemId: string) => void;
  onReorder?: (orderedIds: string[]) => void;
  onToggleSwitch?: (itemId: string, nextValue: boolean) => void;
};
```

중요한 점:

- section title/footer 렌더링 여부는 caller가 플랫폼별로 신경 쓰지 않는다.
- caller는 `sections` 데이터만 넘기고, 각 renderer가 iOS/Android 관례에 맞게 표시한다.

## Platform Split

### iOS Renderer

목표는 UIKit list interaction을 최대한 활용하는 것이다.

예상 구현 방향:

- `UICollectionView` list (`.insetGrouped`) 기반 렌더링
- native swipe actions
- 일반 menu row는 native menu
- category row는 system context menu + system reorder interaction 우선
- same-touch handoff는 추가 gesture coordination 실험으로 분리
- 테스트 화면에서는 category row 한정 compare mode를 둘 수 있음
  - `system`
  - `custom-experiment`

여기서 핵심은 단순 wrapper가 아니라, **카테고리 row interaction coordinator**를 두는 것이다.

#### iOS Gesture Model

iOS category row는 아래 상태를 가진다.

```text
idle
  -> horizontal swipe intent -> swipe actions
  -> long press candidate

long press candidate
  -> minimal movement 유지 -> system context menu open
  -> vertical movement threshold 초과 -> reorder begin
```

중요:

- 이번 스파이크는 exact same-touch handoff를 실험 대상으로 보며, 기술적으로 불가능할 수도 있다.
- 기본 경로는 `UICollectionView` list + system context menu + system reorder를 우선 사용한다.
- same-touch handoff가 system API 조합만으로 충분하지 않으면, 그때만 gesture coordination을 추가 실험한다.
- compare mode가 `custom-experiment`일 때만 category row에 별도 long-press coordinator를 붙인다.
- 일반 `menu` row만 system native menu를 유지한다.
- `Zeego`처럼 외부 추상화에 맡기지 않는다.
- 목표는 Apple 기본 API를 최대한 그대로 유지하면서 순정 iOS 앱처럼 느껴지는 리스트 상호작용을 확보하는 것이다.

Phase 1 acceptance는 exact same-touch handoff 성공 자체를 요구하지 않는다.
스파이크는 아래 셋 중 하나의 verdict로 종료되어야 한다.

- `supported`
- `partially-supported`
- `not-supported`

`supported`가 아닌 경우, decision record에는 실제 fallback interaction을 명시해야 한다.

#### iOS Category Row Interaction Rule

iOS category row는 일반 `menu` row와 다르게 동작한다.

- row swipe -> native delete action reveal
- row long press -> system context menu 후보
- row long press + vertical movement threshold 초과 -> system reorder 진입 시도
- exact same-touch handoff가 충분히 자연스럽지 않으면 reorder accessory 또는 명시적 fallback을 허용
- category row는 system `UICollectionView` list API를 우선 사용하고, custom menu overlay는 1차 기본안이 아니다.

즉 category row에서는:

- `stationary hold` = system context menu candidate
- `hold + move` = reorder candidate

이번 스파이크의 목적은 이 분기가 Apple system API 중심으로 어디까지 자연스럽게 가능한지 검증하는 것이다.

#### iOS Category Compare Mode

테스트 화면에서는 iOS category row 한정으로 두 가지 경로를 비교할 수 있다.

- `native / system`
  - system context menu
  - system reorder
  - same-touch handoff는 system API 범위에서만 기대
- `native / custom-experiment`
  - category row만 custom long-press coordinator 사용
  - stationary hold -> custom iOS-style menu surface 표시
  - vertical move threshold 초과 -> custom menu dismiss + reorder begin 시도
  - 일반 `menu` row, swipe action, switch/value-navigation row는 기존 system-first 경로 유지
  - 목적은 exact UX가 category row에 한정해 실제로 더 자연스럽게 작동하는지 비교하는 것이다

이 compare mode는 category row 전용 실험이며, public JS contract를 바꾸지 않는다.
목적은 native system-first baseline과 category 특화 exact UX 경로를 나란히 검증하는 것이다.

#### iOS Section Appearance

iOS는 아래 구조를 기본으로 한다.

- grouped background
- rounded card-like section
- inset separators
- destructive row tint

이 구조는 설정 앱 / 미리 알림의 grouped list 감각을 참고하되, 테스트 단계에서는 최소 구현으로 시작한다.

#### iOS Menu Row Variants

- `switch`: trailing switch
- `value-navigation`: trailing value text + disclosure
- `navigation`: disclosure 중심
- `menu`: row tap으로 native menu open

#### iOS Menu Row Interaction Rule

iOS `menu` row의 callback 규칙은 아래로 고정한다.

- row tap -> native menu open
- row tap 시 `onPress`는 emit하지 않음
- 메뉴에서 action 선택 시 `onMenuAction(itemId, action)`만 emit
- iOS 기본 menu row는 1차 스파이크에서 trailing `...`를 사용하지 않음

즉 iOS에서:

- `navigation` = tap -> 이동 (`onPress`)
- `menu` = tap -> menu open (`onMenuAction` on selection)

### Android Renderer

Android는 iOS UX를 흉내내지 않는다.
대신 Android에서 자연스러운 상호작용으로 바꾼다.

예상 구현 방향:

- native list / recycler 기반 렌더링
- trailing `...` 버튼
- `...` 탭 시 native popup 또는 bottom sheet
- long press reorder

#### Android Interaction Rules

- `menu` row:
  - tap -> onPress
  - trailing `...` -> onMenuAction
- `switch` row:
  - trailing switch -> onToggleSwitch
- `value-navigation` row:
  - 상태값 표시 + tap 이동
- `category` row:
  - tap -> onPress
  - long press -> reorder
  - trailing `...` -> rename/duplicate/archive 등 `onMenuAction`
  - delete는 menu에서 시작되더라도 `onDelete`로만 전달

Android에서 row long press context menu는 이번 설계에서 제외한다.

### Web Placeholder

Web은 이번 스파이크에서 비구현이다.
다만 facade level에서 `web` renderer를 나중에 추가할 수 있도록 빈 placeholder renderer를 둘 수 있다.

## Native Module Strategy

현재 프로젝트는 Expo dev build + New Architecture 환경이다.
따라서 새 실험은 레거시 `RCTViewManager` 튜토리얼을 그대로 따르기보다, **Expo Modules 기반의 로컬 네이티브 뷰/모듈**을 우선 검토한다.

이 스파이크에서 필요한 것은 아래 둘 중 하나다.

1. native list view 자체를 bridge 하는 방법
2. RN shell 안에 native interaction-capable row/container를 embed 하는 방법

이번 실험의 목적을 고려하면 1번이 우선순위가 높다.

이유:

- swipe / menu / reorder는 row 하나보다 list container 수준에서 더 자연스럽게 조율된다.
- grouped list appearance도 native list 쪽이 유리하다.

## Test Screen Design

테스트 화면은 별도 route로 분리한다.

예상 파일:

- `client/src/test/NativeListInteractionsTestScreen.js`
- `client/app/native-list-interactions.js`
- optional secondary route: `client/app/(app)/test/native-list-interactions.js`

추가 진입 정책:

- Welcome 화면(`/(auth)/welcome`)에 `/native-list-interactions` 진입 버튼 제공
- 필요 시 실제 화면 파일은 공용 screen을 재사용하고, `/(app)/test/*` route는 보조 route로만 연결
- 테스트 screen 자체는 인증 상태에 의존하지 않는 mock data 기반으로 유지

### Screen Sections

1. Intro / platform label
2. Basic menu rows group
3. Category interactive rows group
4. Destructive/support rows group
5. Event log
6. Reset controls

### Public Access Strategy

이번 스파이크의 테스트 화면은 로그인 여부와 무관하게 같은 public route로 접근 가능해야 한다.

필수 구조:

1. 공용 테스트 screen 컴포넌트 작성
   - `client/src/test/NativeListInteractionsTestScreen.js`
2. 로그인 여부와 무관하게 접근 가능한 public route 추가
   - `client/app/native-list-interactions.js`
3. root auth gate가 `native-list-interactions` segment를 allowlist로 예외 처리
4. Welcome 화면 진입 버튼은 `/native-list-interactions`로 연결
5. 필요하면 기존 `/(app)/test/*` route에서도 같은 screen을 재사용 가능
   - 단, 이 route는 보조 route이고 source of truth가 아니다

이 구조를 명시하지 않으면 auth gate 요구사항을 만족했다고 볼 수 없다.

### Mock Data Strategy

모든 데이터는 화면 내부 state로 관리한다.

- 일반 메뉴 section
- 카테고리 section
- destructive section
- 각 section별 title/footer 포함
- 각 row variant 예시 포함 (`switch`, `value-navigation`, `menu`, `navigation`)

Native가 담당하는 범위:

- row/list interaction
- native gesture handling
- native visual presentation

JS mock state가 담당하는 범위:

- section/item data
- event logging
- in-memory mutation
- route accessibility test harness

reorder 이후에는 JS state의 순서를 native 쪽 결과에 맞춰 갱신한다.

## Reusability Strategy

이 시스템은 "카테고리 전용 컴포넌트"로 만들지 않는다.
대신 아래 2단계로 재사용한다.

1. `MenuListItem`
   - 설정 / 마이페이지 / 일반 이동 row
2. `CategoryListItem`
   - 카테고리처럼 swipe / menu / reorder가 필요한 row

이 분리를 하지 않으면 모든 row가 불필요하게 복잡한 gesture surface를 갖게 된다.

## Event Flow

### Tap

```text
tap-driven row tap
  -> emit onPress(itemId)
  -> JS test screen logs action
```

예외:

- iOS `menu` row는 tap 시 `onPress`를 emit하지 않는다.
- iOS `menu` row는 tap으로 native menu를 열고, 실제 action 선택 시 `onMenuAction`만 emit한다.

### Delete

```text
iOS swipe delete action OR Android menu action
  -> emit onDelete(itemId)
  -> JS removes item from local state
  -> log append
```

### Reorder

```text
native reorder end
  -> emit orderedIds[]
  -> JS reorder local array
  -> log append
```

### Menu Action

```text
native menu selection
  -> emit onMenuAction(itemId, action) where action excludes delete
  -> JS handles mock state mutation
  -> log append
```

## Risks

### Risk 1: iOS exact handoff

가장 큰 리스크는 iOS에서 아래 흐름이다.

- long press로 menu 후보
- vertical movement threshold 초과
- menu 대신 reorder 시작

이 흐름이 OS-level interaction과 완전히 일치하지 않을 수 있다.
이번 스파이크는 바로 이 가능 여부를 검증하는 용도다.

### Risk 2: Android menu primitive 선택

Android는 `PopupMenu`, `BottomSheet`, `AlertDialog` 계열 중 어느 쪽이 row trailing action에 더 맞는지 검증이 필요하다.

### Risk 3: Native list vs JS shell 경계

list 전체를 native로 감싸면 grouped appearance와 gesture 조합은 좋아지지만, JS 쪽 section/header 제어가 복잡해질 수 있다.
반대로 JS shell 안에 native row만 두면 gesture coordination이 다시 어려워질 수 있다.

## Acceptance Strategy

이번 스파이크는 production-ready 여부보다 아래 판단을 내릴 수 있으면 성공이다.

1. iOS에서 row-level exact interaction이 native로 충분히 재현 가능한가?
2. Android에서 trailing action + reorder가 자연스럽게 동작하는가?
3. 공통 JS schema/event contract로 두 플랫폼을 묶을 수 있는가?
4. 추후 category / settings / my-page 메뉴에 재사용할 수 있는가?
