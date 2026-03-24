# Design Document: Floating Tab Bar

## Overview

이번 설계의 목표는 현재 기본 `Tabs` 조합을 제품용 `floating TabBar shell`로 교체하는 것이다.

중요한 전제는 다음과 같다.

- 라우팅 엔진은 계속 `expo-router`를 사용한다.
- 이번 단계의 구현 방식은 `expo-router Tabs + custom tabBar renderer`다.
- 하단 바는 `NativeTabs`나 별도 native shell이 아니라 React Native view hierarchy 기반 shell로 구현한다.
- 시각 목표는 `iOS 26` detached tab bar 인상이지만, 제품 shell은 iOS/Android 공통 구조를 사용한다.
- `+`는 route가 아니라 action이며, 기존 global todo form session 계약을 재사용한다.
- `+`는 세 개의 destination이 들어가는 메뉴 shell 안이 아니라, 같은 detached row에 놓인 별도 원형 action surface다.
- 탭바는 `/(app)/(tabs)` 내부 product push screen에서 계속 보이는 persistent shell로 유지한다.
- 제품용 `My Page` descendant route family는 `/(app)/(tabs)/my-page/*`로 고정한다.

## Why This Architecture

이번 단계에서 `expo-router` 위에 custom `TabBar`를 얹는 쪽을 선택하는 이유는 아래와 같다.

1. `iOS 26` 스타일의 detached shape와 separate circular `+` action surface는 시스템 기본 탭보다 커스텀 구현이 더 적합하다.
2. Android까지 동일한 정보 구조와 유사한 외형으로 맞추기 쉽다.
3. 현재 프로젝트는 이미 `expo-router` 기반이며, 이를 버리지 않아도 shell만 교체할 수 있다.
4. `+`를 route가 아니라 action으로 다루기 쉽다.
5. `My Page` descendant route를 tab subtree 안으로 고정하면 persistent shell 계약을 단순하게 유지할 수 있다.

## Technology Choice

### Chosen

- `expo-router` `Tabs`
- custom `tabBar` renderer
- React Native view hierarchy 기반 shell
- existing Zustand store action `useTodoFormStore.openQuick()`
- shell-owned reserved bottom inset contract
- `react-native-reanimated` 기반 moving selected pill
- `expo-blur` 기반 shared surface background
- `react-native-svg` 기반 tab icon components

### Rejected for This Phase

- `expo-router NativeTabs`
  - `iOS 26` 스타일을 앱 전체에서 동일하게 재현하기보다 시스템 제약에 더 크게 묶인다.
- iOS/Android native shell 직접 구현
  - 제품 요구에 비해 구현/유지 비용이 크다.
- Android FAB 분기
  - 이번 요구사항은 `+`를 detached row 우측의 별도 원형 action surface로 통일하는 방향이다.

## Route Architecture

### Product Top-Level Destinations

Top-level tab destination은 아래 3개만 유지한다.

1. `index` -> Todo
2. `calendar` -> Calendar
3. `my-page` -> My Page

`add`는 top-level route에서 제거한다.

### Route Ownership

```text
client/app/(app)/(tabs)/
  _layout.js
  index.js
  calendar.js
  my-page/
    _layout.js
    index.js
    completed.js
    favorites.js
    inbox.js
    upcoming.js
    settings/*
    profile/*
    category/*
    debug.js
```

핵심 정책:

- 제품용 `My Page` descendant route는 `client/app/(app)/(tabs)/my-page/*` 아래에만 둔다.
- `settings/profile/category/debug`뿐 아니라 `completed/favorites/inbox/upcoming`도 제품 UI에서 계속 링크되는 동안 같은 descendant family로 취급한다.
- 동일 surface를 제공하는 `client/app/(app)/settings/*`, `client/app/(app)/profile/*`, `client/app/(app)/category/*` 같은 루트 route는 legacy duplicate로 분류한다.
- 위 duplicate route는 floating tab bar styling 이전에 제거하거나 제품 navigation code에서 참조되지 않도록 격리한다.
- `My Page` product UI에서 직접 진입하는 ordinary push route는 `/(app)/(tabs)`, `/(app)/(tabs)/calendar`, `/(app)/(tabs)/my-page/*` 중 하나여야 한다.
- `/native-settings-catalog` 같은 tab-shell-external public route는 product entry로 허용하지 않는다. 유지가 필요하면 `my-page/debug` subtree로 이동하거나 product menu에서 제거한다.
- 따라서 descendant route로 이동해도 tab shell은 유지된다.
- 이후 `Todo` 또는 `Calendar` 하위 push screen이 필요할 경우에도, 탭바를 유지하려면 동일하게 `/(app)/(tabs)` subtree 안에서 route를 소유해야 한다.

## Shell Structure

### Tabs Layout

`client/app/(app)/(tabs)/_layout.js`는 아래 역할만 가진다.

1. 실제 route screen 3개 선언
2. `headerShown: false`
3. custom `tabBar` 주입

`add` 가짜 route와 `tabBarButton` 기반 임시 액션 버튼은 제거한다.

### New Component

새 하단 바 컴포넌트는 아래 경로를 기본안으로 둔다.

- `client/src/navigation/TabBar.js`

책임:

1. 현재 active destination 계산
2. `Todo / Calendar / My Page` 3개 tab이 들어가는 메뉴 shell 렌더링
3. 우측의 별도 원형 `+` action surface 렌더링
4. safe area 반영
5. iOS/Android 공통 floating shell styling 적용
6. shared reserved bottom inset 계산값 publish

비책임:

1. todo form business logic
2. route ownership 판단
3. auth or modal orchestration

### Reserved Bottom Inset Contract

floating shell은 시각 요소이면서 동시에 하단 공간 점유 주체다. 따라서 shell이 자신의 점유 높이를 계산해 공유해야 한다.

공유 계약:

- shell은 `occupiedBottomInset` 값을 계산한다.
- 계산 기준은 `bottomOffset + topMargin + barHeight`다.
- `bottomOffset`은 viewport bottom edge에서 bar outer frame bottom까지의 거리이며, `safeAreaBottom`을 이미 포함한다.
- `topMargin`은 스크롤/리스트 콘텐츠가 bar 위로 바로 붙지 않게 두는 추가 clearance다.
- `/(app)/(tabs)` 내부 스크롤/리스트 화면은 hard-coded `paddingBottom` 대신 shared inset contract를 소비한다.
- 구현 형태는 `useFloatingTabBarInset()` 같은 hook 또는 동등한 context contract를 기본안으로 둔다.

적용 원칙:

- `Todo`, `Calendar`, `My Page`의 scrollable root 화면은 shared inset을 우선 사용한다.
- `/(app)/(tabs)/my-page/*` descendant 중 scrollable surface를 가진 화면도 동일 contract를 재사용한다.
- 시각 튜닝으로 bar 높이나 offset이 바뀌더라도 screen별 magic number를 다시 손대지 않도록 한다.

## Interaction Model

### Destination Tap

- `Todo` tap -> `/(app)/(tabs)`
- `Calendar` tap -> `/(app)/(tabs)/calendar`
- `My Page` tap -> `/(app)/(tabs)/my-page`

정책:

- destination tap은 항상 해당 destination의 root path로 reset한다.
- active destination을 다시 눌러도 동일하게 root path로 reset한다.
- last visited child route restore는 이번 단계에서 지원하지 않는다.
- scroll-to-top 같은 secondary behavior는 이번 단계에서 정의하지 않는다.

### Plus Action

- todo form session이 닫혀 있으면 `+` tap -> `useTodoFormStore.getState().openQuick()`
- 현재 active destination 유지
- route push 없음
- 기존 global overlay / quick form entry contract 유지
- todo form session이 이미 열려 있으면 `+`는 no-op으로 처리하고 기존 session을 유지한다.

즉 구조는 아래와 같다.

```text
TabBar +
  -> openQuick()
    -> useTodoFormStore.mode = 'QUICK'
      -> GlobalFormOverlay
```

## Persistent Visibility Policy

탭바는 `/(app)/(tabs)` shell이 살아 있는 동안 계속 표시한다.

### Keep Visible

- `Todo`
- `Calendar`
- `My Page`
- `My Page/completed`
- `My Page/favorites`
- `My Page/inbox`
- `My Page/upcoming`
- `My Page/settings/*`
- `My Page/profile/*`
- `My Page/category/*`
- `My Page/debug`
- `presentation: card`를 사용하는 `/(app)/(tabs)` 내부 descendant route

### May Cover the Bar

아래는 persistent tab bar policy의 예외로 보고, 화면 presentation이 bar 위를 덮을 수 있다.

- `presentation: modal`
- `presentation: pageSheet`
- `presentation: formSheet`
- auth group
- tab shell 밖의 명시적 full-screen flow

현재 코드 기준 예시:

- `/(app)/(tabs)/my-page/category/form`
  - iOS: `pageSheet`
  - Android: `modal`
- `/(app)/todo-form/v2`
  - `formSheet`
- `/(app)/guest/convert`
  - `modal`

즉 "탭바는 계속 보인다"의 의미는
`ordinary push/card navigation inside the tab shell`에 대한 계약이다.
모달이 잠시 위를 덮는 것은 허용한다.

## Visual Design Direction

### Design Target

정확한 복제는 아니지만, `iOS 26` detached tab bar 인상을 source direction으로 사용한다.

핵심 시각 특징:

1. 하단과 분리된 detached placement
2. `menu shell + quick action`이 한 row에 놓이는 분리형 구조
3. 큰 radius의 rounded shell
4. blur가 들어간 translucent surface
5. active item의 moving capsule 강조
6. 우측 끝의 별도 원형 `+` action

### Layout Tokens

현재 구현 기준 token은 아래와 같다.

```text
horizontalInset = 25
bottomOffset = max(safeAreaBottom, 25) + 0
topMargin = 16
barHeight = 62
barRadius = 100
surfacePadding = 4
blurIntensity = 8
barPaddingX = 4
barPaddingY = 4
itemHeight = 54
itemGap = -10
actionGap = 16
iconSize = 28
plusButtonSize = 54
```

위 값의 source-of-truth는 `client/src/navigation/tabBarMetrics.js`이며, 이후 조정 시 문서와 코드 둘 다 함께 갱신한다.

### Surface Policy

#### Shared policy

- 메뉴 shell과 `+` quick action surface는 동일한 blur/tint/border 체계를 공유한다.
- 실제 구현은 `expo-blur` `BlurView` + white overlay 조합이다.
- separation은 horizontal inset / bottom clearance / blur / border로 만든다.
- 현재 구현에는 surface shadow를 두지 않는다.

핵심은 메뉴 shell과 `+` surface가 동일 family의 재질처럼 보이는 것이다.

### Item Composition

각 destination item은 아래 구조를 기본안으로 둔다.

- icon
- short label
- moving selected pill 위의 active state

`+` action은:

- icon-only primary action
- 동일한 detached row 안에 존재
- destination item과 구분되는 별도 원형 affordance 사용
- 현재 구현에서는 메뉴 shell과 별도 bg surface를 공유하되, active/open에 따라 자체 색이 바뀌지 않는다

아이콘 정책:

- 탭바 아이콘은 `client/src/navigation/icons/` 아래 SVG 기반 컴포넌트를 사용한다.
- `Todo`는 `focused` 상태에 따라 outline/filled 베이스를 바꾸고, 중앙에 현재 day number를 표시한다.
- `Calendar`, `My Page`도 SVG 기반 상태 분기를 사용한다.
- `+`는 단일 SVG 아이콘을 사용한다.

## Active State Model

active state는 `state.routes[state.index]`에서 계산한다.

매핑 규칙:

- `index` -> `todo`
- `calendar` -> `calendar`
- `my-page` subtree -> `my-page`

`debug`, `completed`, `favorites`, `inbox`, `upcoming`, `settings`, `profile`, `category`는 route path가 더 깊어져도 `my-page` active state를 유지한다.

tab press 후 복귀 정책:

- `my-page/settings` -> `Calendar` -> `My Page`는 `/(app)/(tabs)/my-page`로 복귀한다.
- `my-page/debug` -> `Todo` -> `My Page`도 마지막 child restore가 아니라 root reset이다.

active pill 구현:

- selected state는 item별 static background가 아니라 하나의 moving pill로 렌더링한다.
- pill 위치/너비는 각 tab item `onLayout` 측정값을 기준으로 계산한다.
- 이동 애니메이션은 `react-native-reanimated` `withTiming`으로 처리한다.
- 탭 item 자체에는 별도 pressed 배경 효과를 두지 않는다.

## Accessibility

최소 정책:

1. 모든 tab item은 접근성 role을 `tab`으로 제공한다.
2. `+`는 접근성 role을 `button`으로 제공한다.
3. active destination은 selected state를 명시한다.
4. compact phone에서도 tappable area가 44pt/44dp 수준 이하로 떨어지지 않게 한다.

## Migration Plan

### Step 1

- 현재 `Tabs` route를 `index / calendar / my-page` 3개만 남긴다.
- `add` dummy route 제거
- product navigation이 `/(app)/settings/*`, `/(app)/profile/*`, `/(app)/category/*`, `/(app)/(tabs)/debug` 같은 forbidden route를 참조하지 않도록 먼저 정리한다.

### Step 2

- reserved bottom inset contract를 먼저 도입한다.
- screen별 hard-coded bottom padding 정리 기준을 만든다.

### Step 3

- `client/src/navigation/TabBar.js` 생성
- `tabBar` prop으로 연결

### Step 4

- active capsule / integrated plus action 구현
- destination tap root-reset 정책 구현
- `+` 중복 탭 no-op 정책 구현

### Step 5

- floating shell styling 적용
- safe area / compact phone 확인

### Step 6

- `My Page` 하위 push screen에서 persistent visibility 확인
- sheet/modal cover matrix 확인

## Risks

1. `tabBar` custom renderer에서 nested route active-state 계산이 부정확하면 `My Page` 하위 화면에서 highlight가 깨질 수 있다.
2. descendant route ownership 정리가 선행되지 않으면 일부 product navigation이 root duplicate route를 타면서 tab shell을 이탈할 수 있다.
3. detached bottom offset이 크면 작은 화면에서 리스트 하단 콘텐츠와 충돌할 수 있다.
4. iOS 26 느낌을 과하게 좇으면 Android에서 어색해질 수 있다.

대응 원칙:

- geometry는 공통화
- material은 플랫폼별 미세 조정
- active-state 계산은 route subtree 기준으로 단순하게 유지
- reserved inset은 shell이 단일 source-of-truth로 publish

## Implementation Boundary

이번 design은 아래를 구현 대상으로 본다.

1. custom `TabBar` shell
2. persistent tab bar policy
3. integrated `+` action
4. reserved bottom inset contract
5. route cleanup before shell styling

이번 design은 아래를 구현 대상으로 보지 않는다.

1. native shell migration
2. todo form session redesign
3. web parity
4. icon set 전면 교체
