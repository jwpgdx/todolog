# 구현 감사표

기준: 2026-09-21, 코드 `79cbc8d`. 정적 검토이며 전체 기능 회귀 테스트가 아니다.
2026-09-26 Windows 후속: commit `d2d39ac`에서 F28의 calendar-free selection/bulk-move 정적 안정화 일부를 구현했다. 아래 표는 해당 코드 변경을 반영하되 iOS 실제 기기/SQLite E2E 미검증 상태를 구분한다.
아래 경로는 저장소 루트 기준이다. 함수 이름은 다음 작업자가 검색할 근거다.

## 1. 구조와 데이터 경로

| 영역 | 주요 소스 | 현재 상태 / 다음 작업 시 주의 |
|---|---|---|
| Router | `client/app/_layout.js`, `client/app/(app)/_layout.js`, `client/app/(app)/(tabs)/_layout.js` | Expo Router; root task modal과 My Page nested Stack 공존 |
| DB | `client/src/services/db/database.js` | migration version 9. 일정·카테고리·완료·pending 저장 |
| Local writes | `client/src/services/db/{todoService,categoryService,completionService,pendingService}.js` | tombstone / order / pending 기반. bulk 새 작업도 동일 계약 유지 |
| Sync | `client/src/services/sync/{index,pendingPush,deltaPull,syncErrorPolicy}.js` | pending push, delta pull, retry/dead-letter. 재설계 범위 아님 |
| Query / recurrence | `client/src/services/query-aggregation/`, `client/src/utils/recurrenceUtils.js` | candidate / occurrence / aggregation / cache / adapter 분리 |
| Server | `server/src/{routes,controllers,models}/` | Express / MongoDB / JWT, todo·category·completion·auth |
| Google | `server/src/services/googleCalendar.js`, `client/src/screens/settings/GoogleCalendarSettingsScreen.js` | 코드 존재. 현재 OAuth 연결·외부 동기화는 이번 감사에서 검증하지 않음 |
| Guest / settings | `client/src/store/authStore.js` | local-only guest, 계정 전환, 설정 저장. 과거 migration 검증 기록 보존 |
| Calendar | `client/src/features/todo-calendar-v2/`, `client/src/features/week-flow-calendar/` | 월간 calendar 탭과 Todo 상단 calendar가 별도 역할 |
| Order | `ORDER_SCHEMA.md`, `client/src/hooks/queries/useReorderTodo.js` | custom / category / favorite 독립 lane, ORDER_STEP 1024 |

서버 package에 Google API가 있다고 실제 연결이 정상이라고 단정하지 않는다. DB helper에 transaction이 있다고 전체 bulk UX가 원자적으로 완성됐다고 단정하지 않는다.

## 2. 세 가지 native family를 구분한다

| 이름 | 위치 / 역할 |
|---|---|
| NativeManagedList | `client/src/components/ui/native-managed-list/`; section/item/gesture/event 공통 facade |
| native-list-interactions | `client/modules/native-list-interactions/`; iOS UICollectionView + Swift interaction 분리 파일, Android RecyclerView |
| Todo wrapper | `client/src/features/todo/native/NativeTodoManagedList.js`, `buildManagedTodoSections.js`, `managedTodoItemAdapter.js` |
| 실제 카테고리 manager | `client/src/features/category/native/NativeCategoryManager.js`; NativeManagedList category adapter |
| native-settings family | `client/src/features/settings/`, `client/modules/native-settings/`; SettingsList / SelectionList / PickerHost 기반 |
| 구 settings CategoryManager | `client/src/features/settings/native/NativeCategoryManager.tsx`; catalog 등 별도 경로. 같은 이름의 실제 category adapter와 혼동 금지 |
| native-todo-form-session | `client/modules/native-todo-form-session/`; 기존 form session 기반. 재설계 완료를 의미하지 않음 |

`NativeManagedList.native.tsx`의 `usesNativeView`는 iOS category/todo, Android category만 native로 연결한다. 다른 variant는 fallback이다. 화면 이름이 Favorite이라고 native `favoriteTodo` variant를 쓴다고 추정하지 말고 전달 variant를 확인한다.

iOS 엔진 선택은 `NativeListInteractionsSections.swift::shouldUseCustomTodoCategoryDragEngine`에서 section 단위로 결정된다. top favorites + 다른 section, category section, `acrossSections`는 custom todo drag 대상이다. 나머지는 UIKit interactive movement 경로를 사용할 수 있다. 따라서 **Todo 시간순 전체가 항상 built-in**이라는 예전 문구는 정확하지 않다.

## 3. 화면별 상태

| 화면 / 소스 | 현재 코드 | 검증 및 남은 일 |
|---|---|---|
| `TodoScreen.js` | WeekFlowTodoHeader + inline 시간순/카테고리순 + NativeTodoManagedList. 즐겨찾기 section | 과거 iOS 검증. v2 native header 및 Todo 선택모드 미연결 |
| `AllTodosScreen.js` | 날짜 범위 없는 category-grouped 목록 + favorites + 선택모드 | header/primary scroll 과거 검증. 최근 wrapper/style 문제 A01 확인 필요 |
| `FavoriteTodosScreen.js` | 즐겨찾기 목록, 완료/해제/reorder, 선택모드 | SafeAreaView / RN `총 n개` 상단 구조가 남음. F27과 달리 summary가 native list item이 아니므로 rollout 재검증 |
| `CategoryTodosScreen.js` | iOS managed list; Android FlashList 분기 | RN/FlashList `총 n개` header가 F27 summary contract와 다름. Android 선택·드래그 동등성도 미완성 |
| `MyPageScreen.js` | RN ScrollView + 카테고리 manager + 일반 메뉴/프로필 + 실험 진입점 | 전체 NativeSettingsList 또는 Account Hub로 전환되지 않음 |
| `CategoryFormScreen.js`, `CategoryColorScreen.js` | form modal; 색상 row는 pending 선택, 완료로 store 반영 후 back | 색상은 즉시 commit 정책이 아님. 양 플랫폼 흐름 재검증 필요 |
| `TodoCategorySelectScreen.js` | single/bulk IDs, NativeSelectionList, staged target, 이동 action | 단일 이동 과거 검증. bulk는 A02~A06 |
| `screens/settings/*.js` | Theme/StartDay/Language/TimeZone 선택은 기존 RN 화면 | native choice 전면 rollout, 언어/timezone 검색 고정 미완료 |
| My Page `completed.js`, `upcoming.js`, `inbox.js` | 구현 예정 문구의 ScrollView | 독립 리스트 기능 미구현. 실제 Inbox category 기능과 구분 |
| Account Hub | 현재 My Page는 profile/edit 또는 verify-password로 이동 | modal hub는 설계만 존재 |
| Todo form | 기존 route `todo-form/v2`는 formSheet | 재설계 보류, 현재 form 제거 금지 |

## 4. 선택모드와 이동: 다음 구현자가 해결할 차이

| ID | 정적 근거 / 현재 동작 | 기대 / 검증 |
|---|---|---|
| A01 | `d2d39ac`: 누락된 `styles.screen`을 추가하고 selection 중 loading/empty early return이 selection chrome을 숨기지 않게 보정 | 정적 수정 완료. root flex/실측 높이 및 native large-title scroll 연동은 iOS runtime 재검증 필요 |
| A02 | `TodoSelectionActionBar.js`에 네 action이 있으나 세 화면은 `onMove`만 전달 | delete/complete/favorite disabled. 기능 전체 완료 아님 |
| A03 | `d2d39ac`: bulk move 전용 `todoBulkMoveService`가 이미 target category인 todo를 `noOpTodoIds`로 분리해 category/order write와 pending을 만들지 않음 | 정적 구현 완료. mixed-category 실제 SQLite 검증은 Gate 8에서 필요 |
| A04 | `d2d39ac`: selection membership과 화면순서를 분리. 세 화면이 full selected ID set과 `orderedTodoIds`를 별도 전달하고 service가 exact-set/order 일치를 검증 | helper invariant에서 reverse tap order와 visible order 분리를 확인. 실제 UI reverse-tap E2E는 Gate 8에서 필요 |
| A05 | `d2d39ac`: selection session ID + session-scoped result store를 추가. picker success만 부모 selection을 종료하고 cancel은 result를 만들지 않음 | 정적 연결 완료. modal cancel/success/tab restore 실제 navigation 검증 필요 |
| A06 | `d2d39ac`: bulk move가 SQLite exclusive transaction에서 target + exact selected set + origin scope를 검증. stale/missing/scope-invalid면 write/pending 없이 `selection_stale` 반환, invalid ID만 selection에서 제거 | 정적 구현/독립 리뷰 PASS. 실제 DB rollback/pending 0건 증거는 Gate 8에서 필요 |
| A07 | 선택 hook은 ID만 저장; occurrenceDate snapshot 없음 | bulk complete 구현 전 화면 occurrence context를 보존하는 계약 필요 |
| A08 | `d2d39ac`: bottom-tab hide를 owner별 map으로 관리하고 selection hook마다 독립 owner ID를 사용. 한 hook cleanup이 다른 owner를 풀지 않도록 보정 | 정적 경쟁 조건 보정 완료. focus/blur/back/runtime 검증은 남음 |
| A09 | 화면 header는 `선택` 직접 버튼. bottom bar action 목록/라벨 고정 | freeze는 `... > 일정 선택`, Favorites 해제 override, 확장 가능한 action contract |
| A10 | 선택모드 list bottom inset이 화면에서 96 고정 | safe area / 실제 action bar 높이와 맞는지 작은·큰 기기 검증 |
| A11 | `useBulkDeleteTodos.js`가 `/todos/bulk-delete` 서버 API 직접 호출 | 새 선택 UI에 그대로 연결 금지. SQLite/pending transaction 기반 bulk hook 필요 |
| A12 | picker `headerActionText` 색상을 common constant로 지정 | iOS header 색상을 시스템에 맡긴 정책이 custom RN header button까지 완전히 적용된 것은 아님 |
| A13 | `d2d39ac`: picker에서 todo query/order 계산을 제거. service가 `withExclusiveTransactionAsync` 안에서 active target과 최신 `MAX(category_order)`를 읽고 write + 기존 `updateTodo` pending까지 같은 txn connection에서 처리 | 정적 구현/Expo SQLite API 확인 완료. 실제 동시성/SQLite E2E는 Gate 8에서 필요 |

이 표는 runtime 완료 목록이 아니다. `d2d39ac`의 정적 해결과 실제 기기/DB 검증 상태를 분리해서 읽는다.

## 5. 검증 기록을 해석하는 방법

| 기록 | 근거 문서 | 이번 인수인계에서의 해석 |
|---|---|---|
| iOS category/todo/favorite interaction 수동 검증 | `IMPLEMENTATION_ORDER.md`, `custom drag engine_fix.md` | 과거 성공 기록. 현재 모든 선택모드 회귀를 보장하지 않음 |
| Android category build/install/render/menu/reorder/swipe | `.kiro/specs/native-managed-list/tasks.md` Phase 8 | category 범위 기록. todo parity 증거 아님 |
| 단일 category move Maestro + SQLite | `IMPLEMENTATION_ORDER.md` 검증 13 | bulk transaction 및 다중 선택 검증으로 확장 불가 |
| 최근 iOS selection build + 화면 렌더 + bulk picker deep link | `NEW_MAC_HANDOFF_2026-07-12.md` 4절 | 실제 row 선택 -> 이동 -> DB 저장 E2E는 남음 |
| Expo doctor 16/19 | 같은 문서 7절 | 2026-07-12 기록. 현재 실행 결과나 최신 권장 버전 아님 |
| My Page native header / AllTodos collapse / 색상 header | triage, 메뉴 구조, presentation 기록 | 해당 실험/수동 확인 기록. 구형 iOS와 Android 전체 보장 아님 |
| 2026-09-21 이번 감사 | 코드 경로·문서·Git 확인 | 앱 빌드, UI 자동화, 실제 DB 쓰기, 외부 sync 재실행 없음 |

## 6. 문서 정리 결과와 잔여 이력

- `IMPLEMENTATION_ORDER.md`: Android 전부 대기, 선택모드 완료, 시간순 항상 built-in 등 현재 상태 표현을 수정한다.
- `PROJECT_CONTEXT.md`, `ROADMAP.md`: 과거 doctor clean과 7월 16/19 기록을 구분한다.
- native-managed-list spec: 옛 pilot 설명은 이력으로 남기고 현재 구현 감사표로 연결한다.
- presentation 문서: 과거 색상 immediate-commit 표기는 최신 staged + 완료 규칙으로 정정한다.
- triage 하단의 과거 후보/질문과 raw memo는 유지한다. 확정 여부는 결정 목록과 상단 freeze를 함께 읽는다.
- vendored 라이브러리 문서, `client/docs/archive`, 예전 테스트 보고서는 이력이다. 이번에 모두 최신 사양으로 다시 쓰지는 않았다.
- 문서가 서로 다른 주장을 하면 제품 결정을 재발명하지 말고 [결정 목록](DECISIONS.md)에 근거를 추가한다.
