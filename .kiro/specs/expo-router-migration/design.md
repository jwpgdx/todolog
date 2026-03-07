# Expo Router Migration — Design

## Status

- Implemented + validated: 2026-03-07
- Final state achieved: Expo Router 단일 라우터 (legacy React Navigation 제거)

## 1. AS-IS Inventory

### 1.1 Current Root Entry

현재 루트 진입은 `client/index.js -> client/App.js` 이다.

`client/App.js`가 다음 책임을 동시에 가진다.

- DB 조기 초기화 / prewarm
- i18n 초기화
- auth load
- timezone 기반 `currentDate` 보정
- theme/language 적용
- provider chain 구성
- `NavigationContainer` 렌더
- `user ? MainStack : AuthStack` 분기
- `Toast`, `GlobalFormOverlay` 렌더

### 1.2 Current Navigation Topology

#### Auth 영역

- `AuthStack`
  - `Welcome`
  - `Login`

#### Main 영역

- `MainStack`
  - root: `MainTabs`
  - push screens:
    - `CategoryTodos`
    - `EditProfile`
    - `CategoryForm`
    - `CategoryColor`
    - `VerifyPassword`
    - `Settings`
    - `ThemeSettings`
    - `LanguageSettings`
    - `StartDaySettings`
    - `TimeZoneSettings`
    - `TimeZoneSelection`
    - `GoogleCalendarSettings`
    - `ConvertGuest`
    - `GuestMigrationTest`
    - `CalendarServiceTest`
    - `RecurrenceEngineTest`
    - `Debug`
    - `TodoCalendar`

#### Tabs 영역

- `MainTabs`
  - `Home` → `TodoScreen`
  - `Calendar` → `TodoCalendarScreen`
  - `Strip` → `StripCalendarTestScreen`
  - `Test` → `CalendarServiceTestScreen`
  - `Debug` → `DebugScreen`
  - `MyPage` → `MyPageScreen`
  - `Add` → fake tab button (`openQuick`)

## 2. Migration Strategy

### 2.1 Principle

- **route shell 먼저, screen 로직은 최대한 그대로**
- screen 파일을 전면 이동/분해하지 않고, `app/` route 파일이 기존 `src/screens/*` 를 re-export 또는 thin wrapper 하는 방식으로 시작한다
- domain/store/query/sync 로직은 migration 1차 범위 밖이다

### 2.2 Single Router (Final State)

최종 상태는 `Expo Router` 단일 라우터이며, 이번 migration에서 해당 상태를 달성했다.

- `NavigationContainer`, `MainStack`, `MainTabs`, `AuthStack` 제거
- route 파일은 기존 `src/screens/*` / `src/test/*`를 thin wrapper 방식으로 재사용

## 3. Target Route Structure

```text
client/
├─ app/
│  ├─ _layout.js
│  ├─ index.js
│  ├─ (auth)/
│  │  ├─ _layout.js
│  │  ├─ welcome.js
│  │  └─ login.js
│  ├─ (app)/
│  │  ├─ _layout.js
│  │  ├─ (tabs)/
│  │  │  ├─ _layout.js
│  │  │  ├─ index.js
│  │  │  ├─ calendar.js
│  │  │  ├─ strip.js
│  │  │  ├─ test.js
│  │  │  ├─ debug.js
│  │  │  └─ my-page.js
│  │  ├─ category/
│  │  │  ├─ [categoryId].js
│  │  │  ├─ form.js
│  │  │  └─ color.js
│  │  ├─ profile/
│  │  │  ├─ edit.js
│  │  │  └─ verify-password.js
│  │  ├─ settings/
│  │  │  ├─ index.js
│  │  │  ├─ theme.js
│  │  │  ├─ language.js
│  │  │  ├─ start-day.js
│  │  │  ├─ time-zone.js
│  │  │  ├─ time-zone-selection.js
│  │  │  └─ google-calendar.js
│  │  ├─ guest/
│  │  │  ├─ convert.js
│  │  │  └─ migration-test.js
│  │  ├─ test/
│  │  │  └─ recurrence-engine.js
│  │  └─ todo-calendar.js
│  └─ +not-found.js
```

> 참고: 현재 프로젝트는 TypeScript로 전환하지 않는다.
> Expo Router route 파일은 이번 migration 범위에서 `.js` 기준으로 생성한다.

## 4. Layout Responsibilities

### 4.1 `app/_layout.js`

루트 layout은 기존 `App.js`의 provider / boot / global overlay 책임을 가진다.

포함 대상:

- `GestureHandlerRootView`
- `KeyboardProvider`
- `QueryClientProvider`
- `SyncProvider`
- `SafeAreaProvider`
- `BottomSheetModalProvider`
- `ActionSheetProvider`
- `Toast`
- `GlobalFormOverlay`
- `StatusBar`

주의:

- DB 초기화 / auth load / theme / language / timezone side effect도 여기에 옮긴다
- `NavigationContainer`는 더 이상 사용하지 않는다
- provider 순서는 `App.js`와 동일하게 유지한다:
  - `GestureHandlerRootView`
  - `KeyboardProvider`
  - `QueryClientProvider`
  - `SyncProvider`
  - `SafeAreaProvider`
  - `BottomSheetModalProvider`
  - `ActionSheetProvider`
  - router content + `Toast` + `GlobalFormOverlay`
- `GestureHandlerRootView`는 Expo Router가 자동 제공하는지 먼저 확인하고, 자동 제공하지 않으면 root layout 최외곽에 둔다
- `ActionSheetProvider`는 단일 React element child만 허용하므로, 내부를 `<View style={{ flex: 1 }}>`로 한 번 감싼다

### 4.2 `app/index.js`

루트 entry.

역할:

- auth state(`user`, `isLoading`, `shouldShowLogin`) 기준으로 최초 경로를 `Redirect`로 결정한다.
  - user 있음 → `/(app)/(tabs)`
  - user 없음 + `shouldShowLogin=true` → `/(auth)/login`
  - user 없음 + 기본 상태 → `/(auth)/welcome`
- auth 그룹/앱 그룹 강제 동기화(auth gate)는 `app/_layout.js`에서 `useSegments` + `router.replace`로 처리한다.

### 4.3 `app/(auth)/_layout.js`

- `Welcome`, `Login` 전용 stack
- 기존 `AuthStack`의 header hidden 정책 유지

### 4.4 `app/(app)/_layout.js`

- tabs + push/modal routes를 감싸는 app stack
- 현재 `MainStack` 역할 대체

### 4.5 `app/(app)/(tabs)/_layout.js`

- 현재 `MainTabs` 역할 대체
- `Add` 커스텀 탭 버튼 유지
- tab label / icon parity 유지

## 5. Route Mapping

| Current Route | Target Path | Notes |
|---|---|---|
| `Welcome` | `/(auth)/welcome` | auth |
| `Login` | `/(auth)/login` | auth |
| `Home` | `/(app)/(tabs)` | tabs index |
| `Calendar` | `/(app)/(tabs)/calendar` | tabs |
| `Strip` | `/(app)/(tabs)/strip` | tabs |
| `Test` | `/(app)/(tabs)/test` | `CalendarServiceTestScreen`의 canonical path |
| `Debug` | `/(app)/(tabs)/debug` | canonical path는 tabs debug로 고정 |
| `MyPage` | `/(app)/(tabs)/my-page` | tabs |
| `CategoryTodos` | `/(app)/category/[categoryId]` | object param 금지 |
| `CategoryForm` | `/(app)/category/form` | create/edit는 query or categoryId로 구분 |
| `CategoryColor` | `/(app)/category/color` | callback param 제거 필요 |
| `EditProfile` | `/(app)/profile/edit` | push |
| `VerifyPassword` | `/(app)/profile/verify-password` | push |
| `Settings` | `/(app)/settings` | push |
| `ThemeSettings` | `/(app)/settings/theme` | push |
| `LanguageSettings` | `/(app)/settings/language` | push |
| `StartDaySettings` | `/(app)/settings/start-day` | push |
| `TimeZoneSettings` | `/(app)/settings/time-zone` | push |
| `TimeZoneSelection` | `/(app)/settings/time-zone-selection` | push |
| `GoogleCalendarSettings` | `/(app)/settings/google-calendar` | push |
| `ConvertGuest` | `/(app)/guest/convert` | modal |
| `GuestMigrationTest` | `/(app)/guest/migration-test` | test |
| `CalendarServiceTest` | `/(app)/(tabs)/test` | 별도 push route 만들지 않고 tabs path 재사용 |
| `RecurrenceEngineTest` | `/(app)/test/recurrence-engine` | test |
| `TodoCalendar` | `/(app)/todo-calendar` | push |

## 6. Blocking Changes Before Route Swap

### 6.1 Non-Serializable Params Removal

현재 가장 명확한 blocker:

- `client/src/screens/CategoryFormScreen.js`
  - `navigation.navigate('CategoryColor', { selectedColor, onSelect })`
- `client/src/screens/CategoryColorScreen.js`
  - `route.params.selectedColor`
  - `route.params.onSelect`

`onSelect` callback 전달은 Expo Router 전환 후 허용하지 않는다.

즉, 수신 측과 발신 측을 동시에 바꿔야 한다.

해결 원칙:

- route param에는 primitive / serializable value만 전달
- 반환값 전달이 필요하면:
  - category form draft store
  - search param 반영
  - parent screen local state + replace/back pattern
  중 하나로 재구성

### 6.2 Route Object Passing Removal

현재 코드에는 `navigation.navigate('CategoryTodos', { category })` 처럼
entity object 전체를 route param으로 넘기는 곳이 있다.

전환 후 원칙:

- pathname에는 ID만 전달
- screen 내부에서 ID 기준 조회

대상 예:

- `CategoryGroupList`
- `CategoryFormScreen`
- `CategoryTodosScreen`

### 6.3 Header Mutation Patterns

현재 일부 screen은 `useLayoutEffect + navigation.setOptions()` 패턴을 쓴다.

예:

- `CategoryFormScreen`
- `CategoryColorScreen`

전환 후 원칙:

- 가능하면 route file의 static options 사용
- screen state에 따라 header action이 바뀌는 경우만 router/native stack 옵션 갱신 유지

## 7. Presentation Policy

### 7.1 First-Pass Rule

1차 migration에서는 **presentation parity** 우선이다.

- 현재 card 화면은 card로 유지
- 현재 modal(`ConvertGuest`)은 modal로 유지
- `formSheet` / `transparentModal` / `pageSheet` 도입은 별도 작업

즉, Expo Router 전환과 modal UX 재설계는 분리한다.

### 7.2 Why

현재 page-sheet / bottom-sheet 전략이 미확정 상태이므로,
migration에 presentation 재설계까지 함께 넣으면 리스크가 너무 커진다.

## 8. Screen Migration Pattern

### 8.1 Recommended First-Pass Pattern

각 route file은 기존 screen을 thin wrapper로 감싼다.

예시 개념:

- route file은 pathname/search param 해석만 수행
- 실제 UI/logic은 기존 `src/screens/*` 또는 `src/test/*` 컴포넌트 재사용

장점:

- route 전환과 screen 로직 변경을 분리 가능
- diff를 작게 유지 가능

### 8.2 Navigation API Replacement

기존:

- `navigation.navigate(name, params)`
- `navigation.replace(name, params)`
- `navigation.goBack()`

전환:

- `router.push(path)`
- `router.replace(path)`
- `router.back()`
- 탭 간 이동은 pathname 또는 `Link`

## 9. Validation Plan

### 9.1 Boot / Auth

- cold start
- logged-out → welcome/login
- logged-in user → tabs
- anonymous user → my page guest banner / convert route

### 9.2 Core Navigation

- tabs 전환
- settings push 흐름
- my page → profile/settings/debug 이동
- category list → category todos / form / color

### 9.3 Modal / Back

- `ConvertGuest` modal presentation
- Android hardware back
- iOS back / swipe dismiss parity
- Web browser back

### 9.4 Global Overlay

- quick add (`openQuick`) 버튼
- `GlobalFormOverlay`가 route 전환 후에도 최상위에서 정상 동작하는지

### 9.5 Regression Guard

- auth logout/login
- todo screen 진입
- calendar / strip / debug route 진입
- query cache / sync provider 초기화 문제 없음

## 10. Rollout / Risk Notes

1. `Expo Router` migration은 page-sheet 문제 해결책이 아니라 **navigation platform migration** 이다.
2. first-pass에서는 route parity 우선, UX redesign 금지.
3. 기존 React Navigation 파일 삭제는 마지막 단계에서만 수행한다.
4. canonical tabs route가 이미 있는 screen(`Debug`, `CalendarServiceTest`)은 push route를 새로 만들지 않는다.
5. `CategoryColor` callback param 제거 없이 route swap을 시작하면 중간 단계에서 바로 막힌다.
