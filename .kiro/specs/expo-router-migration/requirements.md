# Expo Router Migration — Requirements

## Status

- Completed: 2026-03-07
- Addendum: 2026-03-10 (My Page subtree routing for native UX parity)
- Validated: Web smoke (`npm run e2e:web`), iOS/Android dev build boot (`npm run ios` / `npm run android`)

## Goal

클라이언트 라우팅을 기존 `React Navigation` 수동 구성(`App.js` + `MainStack` + `MainTabs` + `AuthStack`)에서
`Expo Router` 파일 기반 라우팅으로 전환한다.

목표는 다음 3가지다.

1. modal / formSheet / stack / tab 라우팅을 Expo 표준 위로 올린다.
2. 현재 오프라인 우선 데이터/동기화 구조는 그대로 유지한다.
3. 화면 로직을 최대한 재사용하면서 라우팅 레이어만 교체한다.

## Scope

- ✅ `client` 앱 엔트리와 라우팅 레이어를 `Expo Router`로 전환
- ✅ 기존 `App.js` provider 체인을 router layout 기준으로 재배치
- ✅ `AuthStack`, `MainStack`, `MainTabs` 역할을 `app/` 디렉터리 구조로 분해
- ✅ 현재 활성 화면/탭/테스트 라우트의 동작 동등성 확보
- ✅ route params를 serializable-only 규칙으로 정리
- ✅ 기존 modal presentation(`ConvertGuest`)을 Expo Router route presentation으로 이전
- ❌ todo/category/settings 도메인 로직 리팩터링
- ❌ SQLite / sync / auth contract 변경
- ❌ 서버 API / payload 변경
- ❌ UI 전면 개편
- ❌ page-sheet 전략 확정/도입 (별도 작업)

## Hard Constraints

1. Offline-first 아키텍처 유지 (`SQLite` SOT, background sync, UUID v4 client generation)
2. 데이터/동기화 동작 회귀 금지
3. 현재 auth 흐름(guest 포함) 유지
4. 기존 screen 로직은 가능하면 재사용하고, 라우팅 껍데기만 먼저 바꾼다
5. 비직렬화 route params(function/object instance) 전달 금지
6. iOS / Android / Web 모두 동일한 route 구조를 사용한다

## Functional Requirements

### FR-1: Expo Router를 앱의 단일 라우팅 엔트리로 사용

- `client/App.js`의 `NavigationContainer` 기반 진입을 제거한다
- `Expo Router`가 앱의 단일 라우팅 엔트리가 된다
- 기존 `index.js -> App` 진입 구조는 Expo Router entry 기준으로 교체한다

### FR-2: Provider 체인과 전역 overlay를 유지

- 현재 `App.js`에 있는 다음 provider/전역 요소를 Expo Router 루트 layout으로 이동한다
  - `GestureHandlerRootView`
  - `KeyboardProvider`
  - `QueryClientProvider`
  - `SyncProvider`
  - `SafeAreaProvider`
  - `BottomSheetModalProvider`
  - `ActionSheetProvider`
  - `Toast`
  - `GlobalFormOverlay`
- provider 순서는 기존과 동일한 의미를 유지해야 한다
- 최소 유지 순서:
  - `GestureHandlerRootView`
  - `KeyboardProvider`
  - `QueryClientProvider`
  - `SyncProvider`
  - `SafeAreaProvider`
  - `BottomSheetModalProvider`
  - `ActionSheetProvider`
  - router content + `Toast` + `GlobalFormOverlay`

### FR-3: Auth / Guest 진입 흐름을 동일하게 유지

- 로그인 전 사용자는 `Welcome` / `Login` 흐름으로 진입한다
- 로그인 후 사용자는 tabs 기반 메인 영역으로 진입한다
- `shouldShowLogin` 조건도 동일하게 동작해야 한다
- guest user(`anonymous`) 관련 라우트와 분기도 유지해야 한다

### FR-4: 현재 탭 구조를 Expo Router Tabs로 이전

- 현재 탭 구조를 유지한다
  - 홈
  - 캘린더
  - 스트립
  - 테스트
  - 디버그
  - 마이페이지
- 현재 `Add` 커스텀 탭 버튼 동작(`openQuick`)도 유지해야 한다

### FR-5: Stack push 화면을 route로 동일하게 노출

- 현재 `MainStack`에 있는 push 화면을 Expo Router stack route로 이전한다
- 최소 포함 대상:
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
  - `RecurrenceEngineTest`
  - `TodoCalendar`

- 이미 tabs 경로가 canonical entry인 screen은 별도 push route를 새로 만들지 않는다
  - 예: `Debug`, `CalendarServiceTest`

### FR-6: 비직렬화 route params 제거

- Expo Router 기준으로 모든 route params는 serializable 해야 한다
- 현재 `CategoryColorScreen`처럼 callback function을 `route.params`로 넘기는 구조는 제거해야 한다
- screen 간 상태 공유가 필요하면 route param 대신 store / local draft state / query param 재구성으로 해결해야 한다

### FR-7: Modal / presentation 동작을 route 옵션으로 유지

- 현재 modal presentation을 사용하는 화면은 Expo Router의 stack presentation으로 이전한다
- 최소 요구:
  - `ConvertGuest` modal 유지
- 향후 `formSheet` 도입이 가능하도록 route-level presentation 구조를 열어둔다

### FR-8: 기존 navigation intent를 pathname 기반으로 치환 가능해야 함

- `navigation.navigate(...)`, `navigation.replace(...)`, `navigation.goBack()` 사용 지점을
  Expo Router의 `router.push`, `router.replace`, `router.back`, `Link`로 치환 가능해야 한다
- 현재 route 이름과 새 pathname 간 1:1 매핑표가 필요하다

### FR-9: Web / Native back 동작 동등성 유지

- Android hardware back
- iOS stack back / modal dismiss
- Web browser back
  이 3가지가 현재 화면 전환 의미를 크게 바꾸지 않아야 한다

### FR-10: 테스트/디버그 route도 유지

- 현재 개발 중 사용하는 test/debug route는 migration 후에도 접근 가능해야 한다
- 최소 포함 대상:
  - `Debug`
  - `GuestMigrationTest`
  - `CalendarServiceTest`
  - `RecurrenceEngineTest`
- tabs 경로가 있는 test/debug screen은 tabs path를 canonical route로 사용한다

### FR-11: My Page 하위 push는 My Page stack에 쌓인다 (iOS native UX parity)

- My Page에서 열리는 Settings/Profile/Category 흐름은 `/(app)/(tabs)/my-page/*` 아래로 push되어야 한다
- 목적: iOS Large Title 전환 및 back label이 유저가 체감하는 "이전 화면"(My Page 등)과 일치하도록 한다
- screen 로직은 기존 `src/screens/*` 재사용을 우선하고, 라우팅은 상대 경로(`./...`)를 우선한다

## Non-Functional Requirements

- migration 동안 app boot 실패 상태가 길게 유지되지 않도록 단계적으로 검증 가능해야 한다
- 기존 screen 파일은 최대한 유지하고 route wrapper 방식으로 이전 가능해야 한다
- first-pass migration에서는 UI redesign보다 route parity가 우선이다
- route transition 후에도 console error / warning 증가 금지
- rollback 가능하도록 기존 React Navigation 구조 제거는 마지막 단계에 수행한다
