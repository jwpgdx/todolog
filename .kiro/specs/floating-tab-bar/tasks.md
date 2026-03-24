# Implementation Plan: Floating Tab Bar

## Overview

이 플랜은 현재 기본 `Tabs` 조합을
`iOS 26` 인상의 detached floating `TabBar` shell로 교체하는 구현 순서를 정의한다.

원칙:

1. 라우팅 엔진은 유지하고 shell만 교체한다.
2. `Todo / Calendar / My Page` 3개 destination만 top-level로 둔다.
3. `+`는 route가 아니라 action으로 구현한다.
4. `/(app)/(tabs)` 내부 product push screen에서는 tab bar를 계속 보이게 유지한다.
5. route ownership과 reserved inset contract를 먼저 안정화한 뒤 visual styling에 들어간다.
6. 최종 구현은 `3-tab menu shell + separate circular quick action` 구조를 기준으로 기록한다.

## Tasks

- [x] 1. Spec baseline 확정
  - `requirements.md` 작성
  - `design.md` 작성
  - `tasks.md` 작성
  - `iOS 26` 스타일 방향과 persistent tab bar 정책 고정

- [x] 2. Top-level tab route와 forbidden route reference 정리
  - `client/app/(app)/(tabs)/_layout.js`를 `index / calendar / my-page` 3개 route 기준으로 정리
  - `add` dummy route 제거
  - shell이 더 이상 fake tab destination에 의존하지 않게 정리
  - 제품 navigation code에서 `/(app)/settings/*`, `/(app)/profile/*`, `/(app)/category/*`, `/(app)/(tabs)/debug` 같은 forbidden route reference 제거
  - `My Page` product UI에서 ordinary push로 접근하는 shell-external public route(`'/native-settings-catalog'` 등)를 제거, 이전, 또는 debug-only 재분류 중 하나로 처리
  - duplicate root route가 남더라도 product UI가 접근하지 않도록 먼저 차단

- [x] 3. Routing checkpoint
  - `Todo / Calendar / My Page` 3개 destination만 노출되는지 확인
  - `add` 또는 다른 fake action route 의존이 남지 않았는지 확인
  - 전역 검색으로 forbidden route reference가 남지 않았는지 확인
  - styling 없이도 `/(app)/(tabs)` shell이 기본 navigation에서 안정적으로 유지되는지 확인
  - `client/src/screens/MyPageScreen.js`의 모든 navigation target을 전수 확인하고, `/(app)/(tabs)`, `/(app)/(tabs)/calendar`, `/(app)/(tabs)/my-page/*`, `/(app)/guest/convert` 외 경로가 남아 있지 않은지 확인
  - `client/src/screens/MyPageScreen.js`에서 `앱 설정`, `구글 캘린더 연동`, `디버그` entry tap이 각각 `/(app)/(tabs)/my-page/settings`, `/(app)/(tabs)/my-page/settings/google-calendar`, `/(app)/(tabs)/my-page/debug`로 진입하는지 확인
  - `client/src/screens/MyPageScreen.js`의 `Native Settings Catalog` entry는 product menu에서 제거되었거나 `/(app)/(tabs)/my-page/debug/*` 같은 in-shell debug-only subtree로 이동했는지 확인
  - `client/src/components/domain/category/CategoryGroupList.js`가 계속 `/(app)/(tabs)/my-page/category/*`만 push하는지 확인
  - `client/app/(app)/_layout.js`에 남아 있는 root duplicate `settings/*`, `profile/*`, `category/*` route가 product navigation에서 더 이상 reachable하지 않은지 확인

- [x] 4. Reserved bottom inset contract 구현
  - shell-owned reserved inset 계산 계약 추가
  - `useFloatingTabBarInset()` 또는 동등한 shared contract scaffold 추가
  - scrollable screen이 hard-coded bottom padding 대신 shared inset을 소비할 수 있게 준비
  - 기존 `paddingBottom` magic number가 남아 있는 화면 후보를 식별
  - 최소한 `client/src/screens/MyPageScreen.js`의 `contentContainerStyle.paddingBottom` 같은 hotspot을 shared inset 소비 대상으로 표시
  - `client/src/features/todo/list/DailyTodoList.js`의 `paddingBottom: 100`과 `client/src/screens/CategoryTodosScreen.js`의 `paddingBottom: 100`을 reserved inset rollout hotspot으로 표시

- [x] 5. 새 `TabBar` 컴포넌트 scaffold 추가
  - `client/src/navigation/TabBar.js` 생성
  - custom `tabBar` renderer 기본 skeleton 추가
  - 필요한 경우 tab item config 상수 정리
  - `Todo / Calendar / My Page` 메뉴 shell + 우측 별도 `+` action row 구조 세팅

- [x] 6. Tabs layout에 custom `tabBar` 연결
  - `client/app/(app)/(tabs)/_layout.js`에서 기본 tab bar 대신 새 `TabBar` 주입
  - `headerShown: false` 정책 유지
  - tab route와 visual shell 책임을 분리

- [x] 7. Active state / route mapping / tab press 정책 구현
  - `index` -> `todo`
  - `calendar` -> `calendar`
  - `my-page` subtree -> `my-page`
  - nested route에서도 active highlight가 깨지지 않도록 처리
  - destination tap은 항상 root path reset 정책으로 구현
  - active destination re-tap도 root path reset으로 동작하게 구현
  - last-child restore를 하지 않도록 명시적으로 확인

- [x] 8. `+` action integration 구현
  - `+` tap 시 `useTodoFormStore.getState().openQuick()` 호출
  - active destination 유지
  - route push 없이 기존 quick form entry contract 재사용
  - form session이 이미 열린 상태에서는 no-op으로 처리해 duplicate session을 만들지 않게 구현

- [x] 9. Floating shell visual 구현
  - detached placement
  - horizontal inset
  - bottom offset + safe area 반영
  - rounded menu shell + separate circular `+` surface
  - blurred / translucent shared surface
  - moving selected pill 스타일
  - detached right-end `+` action 스타일

- [x] 10. Persistent tab bar policy 보장
  - `My Page` 하위 `completed / favorites / inbox / upcoming / settings / profile / category / debug` 진입 시 tab bar 유지 확인
  - ordinary push/card navigation이 tab shell을 벗어나지 않도록 점검
  - 필요 시 route ownership 또는 layout 연결 보정

- [ ] 11. Presentation cover matrix 검증 및 보정
  - `modal / pageSheet / formSheet`가 bar를 덮어도 shell contract를 깨지 않도록 확인
  - 최소 예시로 `my-page/category/form`, `todo-form/v2`, `guest/convert` 동작 확인
  - push/card와 sheet/modal의 정책이 섞이지 않도록 정리
  - 상태: route/presentation policy 문서화는 완료됐고, detached shell 구현 이후 수동 런타임 재확인은 남아 있음

- [x] 12. Screen bottom spacing / overlap 보정
  - floating tab bar가 리스트/스크롤 콘텐츠를 가리지 않도록 shared inset 기반으로 보정
  - 적용 대상은 `Todo`, `Calendar`, `My Page` root에 한정하지 않고 `/(app)/(tabs)/my-page/*`의 scrollable descendant(`completed`, `favorites`, `inbox`, `upcoming`, `settings/*`, `profile/*`, `category/*`, `debug`)까지 포함
  - `client/src/screens/MyPageScreen.js`의 `contentContainerStyle.paddingBottom` 같은 hard-coded bottom padding을 shared inset으로 교체
  - `client/src/features/todo/list/DailyTodoList.js`와 `client/src/screens/CategoryTodosScreen.js`의 `paddingBottom: 100` 같은 hotspot도 shared inset 기준으로 재조정
  - compact phone 및 safe area 환경에서 터치 가능 영역 유지
  - screen별 magic number padding 제거 또는 축소

- [ ] 13. Cross-platform visual tuning
  - iOS: `iOS 26` detached 느낌에 맞게 spacing/radius/surface 조정
  - Android: 동일 geometry 유지, material만 소폭 조정
  - 두 플랫폼 모두 `+`가 detached row 우측 별도 원형 action으로 일관되게 보이도록 조정
  - 상태: iOS 시뮬레이터 검증 완료, Android/manual 시각 검증은 후속 확인 필요

- [x] 14. Cleanup
  - old flat tab bar 스타일 의존 제거
  - 더 이상 쓰지 않는 tab bar 관련 임시 코드 제거
  - 필요 시 dead route/file/import 정리

- [ ] 15. Validation
  - `Todo / Calendar / My Page` 3개 destination만 노출된다
  - `+` 탭 시 quick form이 열린다
  - `+` 탭 후 현재 active tab이 바뀌지 않는다
  - form session이 이미 열린 상태에서 `+`를 다시 눌러도 duplicate session이 생기지 않는다
  - `my-page/settings -> Calendar -> My Page`가 `/(app)/(tabs)/my-page` root reset으로 동작한다
  - `my-page/debug -> Todo -> My Page`도 last-child restore 없이 root reset으로 동작한다
  - active tab re-tap 시 duplicate route entry 없이 root path로 reset된다
  - `My Page/completed`
  - `My Page/favorites`
  - `My Page/inbox`
  - `My Page/upcoming`
  - `My Page/settings`
  - `My Page/profile`
  - `My Page/category`
  - `My Page/debug`
  - 위 경로들에서 tab bar가 계속 보인다
  - `my-page`, `my-page/completed`, `my-page/favorites`, `my-page/inbox`, `my-page/upcoming`, `my-page/settings`, `my-page/profile`, `my-page/category`, `my-page/debug`에서 마지막 actionable item이 floating bar/home indicator/gesture area에 가려지지 않는다
  - `my-page/category/form` iOS `pageSheet` / Android `modal`에서 cover policy가 의도대로 동작한다
  - `todo-form/v2` `formSheet`에서 cover policy가 의도대로 동작한다
  - `guest/convert` `modal`에서 cover policy가 의도대로 동작한다
  - 전역 검색으로 forbidden route reference가 남아 있지 않다
  - `client/src/screens/MyPageScreen.js`의 모든 navigation target이 `/(app)/(tabs)`, `/(app)/(tabs)/calendar`, `/(app)/(tabs)/my-page/*`, `/(app)/guest/convert` 외 경로로 ordinary push하지 않는다
  - `client/src/screens/MyPageScreen.js`의 `앱 설정`, `구글 캘린더 연동`, `디버그` entry tap이 stale path 없이 올바른 `my-page` descendant route로 연결된다
  - `client/src/screens/MyPageScreen.js`의 `Native Settings Catalog` entry는 product menu에서 제거되었거나 `/(app)/(tabs)/my-page/debug/*` 같은 in-shell debug-only subtree로 이동한 상태다
  - `client/src/components/domain/category/CategoryGroupList.js`가 `/(app)/(tabs)/my-page/category/*` 외 경로를 push하지 않는다
  - `client/app/(app)/_layout.js`의 root duplicate `settings/*`, `profile/*`, `category/*`가 product navigation에서 reachable하지 않다
  - reserved inset 계산을 `safeAreaBottom = 0`인 Android gesture-nav profile과 home indicator iPhone profile에서 각각 검증한다
  - `client/src/features/todo/list/DailyTodoList.js`와 `client/src/screens/CategoryTodosScreen.js`의 하단 padding hotspot이 shared inset rollout 이후에도 마지막 actionable item을 가리지 않는지 검증한다
  - iPhone home indicator 기기와 Android gesture-nav 기기에서 마지막 actionable item이 가려지지 않고 눌린다
  - iOS에서 detached floating shell, blur, moving selected pill, SVG icon이 의도대로 보인다
  - Android에서도 FAB가 아니라 detached row 우측 별도 원형 action으로 보인다
  - 상태: iOS 시뮬레이터 smoke는 완료됐고, Android/manual parity와 modal/sheet cover runtime smoke는 남아 있음

- [x] 16. Documentation update
  - 구현 완료 후 실제 token/radius/offset 값을 design 또는 관련 문서에 반영
  - 필요 시 `PROJECT_CONTEXT.md`
  - 필요 시 `ROADMAP.md`
  - 최종 shell 구조, route ownership, reserved inset contract, persistent policy를 실제 구현 기준으로 기록
