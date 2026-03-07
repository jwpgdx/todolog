# Expo Router Migration — Tasks

## Status

- Implementation complete: 2026-03-07
- Smoke validated:
  - Web: `npm run e2e:web`
  - iOS: `npm run ios`
  - Android: `npm run android`
- Optional follow-up: manual parity checklist(Back/Modal/deep-link/push routes) 지속 검증

## Phase 0: Spec / Inventory

- [x] 0.1 route inventory 최종 확정
  - `MainStack`, `MainTabs`, `AuthStack` 기준 현재 활성 route 목록 확정
  - current route name ↔ target pathname 매핑표 검토
- [x] 0.2 blocker inventory 확정
  - callback route params 사용 지점 찾기
  - object 통째 전달 route params 사용 지점 찾기
  - custom tab button / modal / header mutation 패턴 목록화
  - tabs canonical route와 push 중복 route 정리 대상 확정

## Phase 1: Expo Router Bootstrap

- [x] 1.1 `expo-router` 설치 및 entry/config 연결
  - package dependency 추가
  - Expo Router entry 연결
  - router plugin / app dir 설정 반영
  - route 파일 확장자는 `.js` 기준으로 고정
- [x] 1.2 `app/` 디렉터리 생성
  - `app/_layout`
  - `app/index`
  - `app/+not-found`

## Phase 2: Root Layout / Providers

- [x] 2.1 `App.js`의 provider 체인을 `app/_layout`로 이동
  - `GestureHandlerRootView`
  - `KeyboardProvider`
  - `QueryClientProvider`
  - `SyncProvider`
  - `SafeAreaProvider`
  - `BottomSheetModalProvider`
  - `ActionSheetProvider`
  - `Toast`
  - `GlobalFormOverlay`
  - `App.js`와 동일한 provider nesting order 유지
- [x] 2.2 root side effects 이전
  - DB 초기화 / prewarm
  - auth load
  - timezone currentDate sync
  - theme/language sync
- [x] 2.3 `NavigationContainer` 제거 준비
  - Expo Router와 중복되지 않도록 root navigation 책임 정리

## Phase 3: Auth / App Group Layouts

- [x] 3.1 `(auth)` group 생성
  - `welcome`
  - `login`
- [x] 3.2 `(app)` group 생성
  - app stack layout 생성
  - tabs route + push route 수용 구조 생성
- [x] 3.3 auth gate / redirect 구현
  - user 있음/없음 분기
  - `shouldShowLogin` 분기
  - guest flow 보존

## Phase 4: Tabs Migration

- [x] 4.1 `(tabs)` layout 생성
  - Home
  - Calendar
  - Strip
  - Test
  - Debug
  - My Page
- [x] 4.2 tab icon/label parity 유지
- [x] 4.3 `Add` 커스텀 탭 버튼 이전
  - `openQuick` 동작 유지
  - 실제 route screen 없이 버튼만 동작하도록 재구성

## Phase 5: Push / Modal Routes Migration

- [x] 5.1 profile/settings route wrapper 생성
  - `profile/edit`
  - `profile/verify-password`
  - `settings/*`
- [x] 5.2 category route wrapper 생성
  - `category/[categoryId]`
  - `category/form`
  - `category/color`
- [x] 5.3 guest/test/debug route wrapper 생성
  - `guest/convert`
  - `guest/migration-test`
  - `test/recurrence-engine`
  - `todo-calendar`
- [x] 5.4 modal presentation parity 유지
  - `ConvertGuest` modal 유지
- [x] 5.5 tabs canonical route 중복 제거
  - `Debug`는 tabs route만 canonical path로 유지
  - `CalendarServiceTest`는 tabs `test` path만 canonical path로 유지

## Phase 6: Route Params Cleanup

- [x] 6.1 callback params 제거
  - `CategoryColorScreen` 경로 재설계
  - `CategoryFormScreen`의 `navigation.navigate('CategoryColor', { onSelect })` 호출 제거
- [x] 6.2 object route params 제거
  - category object 통째 전달 → `categoryId` 기준 조회로 전환
- [x] 6.3 serializable params 기준 문서화
  - pathname
  - search param
  - local/store draft state 경계

## Phase 7: Navigation API Replacement

- [x] 7.1 `navigation.navigate` → `router.push` / `Link`
- [x] 7.2 `navigation.replace` → `router.replace`
- [x] 7.3 `navigation.goBack` → `router.back`
- [x] 7.4 `useNavigation` 의존 지점 정리
- [x] 7.5 `route.params` 읽기 → pathname/search param/store 기반으로 치환

## Phase 8: Cleanup

- [x] 8.1 `MainStack`, `MainTabs`, `AuthStack` 사용 제거
- [x] 8.2 `App.js` 루트 navigation 책임 제거
- [x] 8.3 old route name 문자열 잔존 제거
- [x] 8.4 dead code / 임시 테스트 route 정리

## Phase 9: Validation

### 9.1 Boot / Auth
- [x] logged-out → welcome/login 진입
- [x] logged-in → tabs 진입
- [ ] guest user 배너 / convert flow 유지

### 9.2 Navigation parity
- [x] tabs 전환 정상
- [ ] my page → settings/profile/debug 이동 정상
- [ ] tabs canonical route로 이동하는 debug/test 진입 정상
- [ ] settings 하위 screen 이동 정상
- [ ] category list → category todos/form/color 이동 정상

### 9.3 Back / Modal parity
- [ ] Android hardware back 정상
- [ ] iOS stack back / modal dismiss 정상
- [ ] Web browser back 정상
- [ ] `ConvertGuest` modal presentation 유지

### 9.4 Overlay / Global behavior
- [ ] `openQuick` 탭 버튼 정상
- [ ] `GlobalFormOverlay` 정상
- [ ] toast / action sheet / bottom sheet provider 회귀 없음

### 9.5 Regression
- [ ] auth logout/login 회귀 없음
- [ ] home/calendar/strip/debug/test 진입 회귀 없음
- [ ] console error/warning 증가 없음
