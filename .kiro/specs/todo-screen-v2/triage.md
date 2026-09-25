# Todo Screen V2 Triage

Last Updated: 2026-09-25
Status: Layout/selection/D02 stale-data/D03 TodoScreen selection chrome/D04 platform-native interaction decisions frozen; calendar-free selection mode and category picker partially implemented; formal requirements/design/tasks promotion pending

현재 인수인계는 [WEB_GPT_HANDOFF.md](../../../WEB_GPT_HANDOFF.md)에서 시작한다. 상단 freeze와 하단 과거 후보/질문이 함께 남아 있으므로, [결정 목록](../../../docs/handoff/DECISIONS.md)으로 확정 여부를 확인한다. 이번 감사는 코드 정적 확인이며 runtime 재검증이 아니다.

이 문서는 `raw-memo.md`를 코드 확인 결과에 맞춰 `확정 후보`, `토론 필요`, `코드 확인 결과`, `나중 작업`으로 나눈다.
아직 최종 요구사항 문서가 아니며, 다음 단계에서 freeze한 항목만 `requirements.md` / `design.md` / `tasks.md`로 승격한다.

## 코드 확인 결과

- `TodoScreen`은 현재 `WeekFlowTodoHeader`를 위에 두고, 그 아래 `sortContainer` 버튼(`시간순`, `카테고리순`)과 `NativeTodoManagedList`를 렌더한다.
- `NativeTodoManagedList`는 iOS에서 native `variant="todo"` path를 사용한다. Android는 현재 `variant="category"`만 native path에 연결되어 있다.
- `TodoScreen`의 정렬 상태는 `TODO_SCREEN_SORT_MODE_STORAGE_KEY`로 저장하고, 현재 UI는 inline chip 버튼이다.
- 상단 즐겨찾기 section은 이미 `NativeTodoManagedList`에 포함되어 있고, 접힘/펼침 상태도 `TODO_SCREEN_FAVORITES_COLLAPSED_STORAGE_KEY`로 저장한다.
- `ManagedListItem.selected`, legacy native payload, iOS model/layout, Android model, fallback row까지 selection state가 연결되어 있다.
- iOS native todo row는 selection mode에서 완료 toggle 대신 `select` control을 렌더하고 selected background/tint를 적용한다. 등장/퇴장 animation polish는 아직 없다.
- iOS native item menu는 `menuActions` 기반으로 구성된다. 일정 메뉴에 `select` action을 추가하는 것은 contract 관점에서는 가능하다.
- root layout에는 `ActionSheetProvider`와 `BottomSheetModalProvider`가 이미 있다.
- `NativeManagedListFallback`에는 자체 bottom action sheet 모양의 `Modal`이 있지만, 앱 전체 공통 메뉴 컴포넌트로 분리되어 있지는 않다.
- `CategoryFormScreen`은 Expo Router route이며 category form은 modal로 열린다. 일정 이동용 `todo/category-select` modal route가 추가되어 단일 `todoId`와 bulk `todoIds`를 처리한다.
- todo 단일 삭제는 `Alert.alert` 확인 후 `useDeleteTodo`를 호출한다.
  - 초기 raw memo의 즉시 삭제 요청보다 후속 presentation freeze의 undo 전 확인 정책을 기준으로 한다. 결정 목록 R01 참고.
- `useDeleteTodo`는 SQLite/pending 기반 offline-first 삭제다.
- `deleteTodos(ids)` DB 함수는 있지만, 현재 `useBulkDeleteTodos`는 서버 API 중심이라 offline-first bulk delete로 보기 어렵다.
- `completionService`에는 `createCompletion(todoId, date)` / `deleteCompletion(todoId, date)`가 있다. bulk complete/uncomplete는 toggle 반복이 아니라 이 idempotent helper를 써야 한다.
- `useToggleCompletion`은 반복 일정이면 전달받은 날짜를 completion date로 쓰고, 비반복 일정이면 `null` completion date를 쓴다.
- `pendingPush`는 `deleteTodo`, `updateTodo`, `createCompletion`, `deleteCompletion` 같은 단일 pending type만 처리한다. bulk 전용 pending type은 현재 없다.
- `getNextCategoryOrder`, `getNextFavoriteOrder`는 `ORDER_STEP = 1024` 기준으로 마지막 order 뒤 값을 만든다.
- `updateTodoOrdersBatch`는 SQLite transaction 안에서 여러 todo를 수정하고, 각 todo마다 기존 `updateTodo` pending change를 쌓는 패턴을 이미 사용한다.
- 카테고리 삭제는 `Alert.alert` 확인 후 `useDeleteCategory`를 호출하고, SQLite에서 카테고리와 포함 todo/completion을 cascade tombstone 처리한다.
- `settings.showCompleted` 전역 설정은 존재하지만, `TodoScreen`의 header menu 상태로는 아직 연결되어 있지 않다.
- `NativeManagedList`에는 현재 scroll offset event나 `scrollToTop` command가 없다.
- Todo tab 안에 nested `Stack` route를 추가하는 스파이크는 성공했다. native header, headerRight `...`, bottom tab bar 유지, header 아래 mock `ScrollView` 본문 스크롤이 가능했다.
- native header 아래에 실제 `NativeManagedList`를 붙이는 스파이크도 성공했다. `NativeManagedList`가 본문 전체 스크롤 owner가 되고, native header는 고정되며, bottom tab bar도 유지된다.
- `NativeManagedList`에 native `pageTitle` item kind를 추가하는 스파이크는 iOS 빌드와 시뮬레이터 확인을 통과했다. 큰 title/subtitle은 UICollectionView item으로 렌더되고, 리스트 스크롤 시 일반 item처럼 위로 사라진다.
- calendar 없는 native-list 화면에서 `headerTransparent: true`와 iOS 26 `scrollEdgeEffects.top = 'soft'`를 조합하는 스파이크도 통과했다. native header는 스크롤 밖에 고정되지만, NativeManagedList content가 header 뒤로 underlap되며 흐릿하게 비치는 iOS 기본형에 가까운 동작을 확인했다.
- 이후 실제 `AllTodosScreen`에서 `NativeManagedList`를 화면의 직접 primary content로 배치하고, iOS native `headerLargeTitle` collapse가 정상 동작하는 것을 확인했다.
- `SafeAreaView` / wrapper `View` / RN top header가 `NativeManagedList` 앞에 있으면 native-stack이 내부 `UICollectionView`를 primary scroll view로 안정적으로 잡지 못할 수 있다.
- 단, 현재 `NativeManagedList`는 React children / `ListHeaderComponent` / arbitrary RN component embedding을 지원하지 않는다. 기존 RN/Reanimated calendar widget을 `NativeManagedList` 내부 스크롤 콘텐츠로 그대로 넣는 방식은 현재 구조상 불가능하다.

### 2026-09-21 구현 차이

- 선택 action bar는 이동만 연결됐다. 삭제/완료/즐겨찾기는 미연결이다.
- bulk move는 이미 target category에 있는 선택 항목도 재정렬하며 클릭 순서를 사용한다. 아래 no-op / 화면상 순서 freeze와 차이가 있다.
- 성공 시 picker가 back만 호출하고 부모 selection 종료를 명시적으로 연결하지 않는다.
- 선택은 ID만 보존한다. occurrence context 보존은 bulk complete 구현 전에 필요하다. stale/missing ID 처리 정책은 2026-09-24 D02로 freeze했지만 코드는 아직 미반영이다.
- AllTodos의 현재 wrapper는 정의되지 않은 `styles.screen`을 사용한다. 과거 native header 실험 성공과 최신 화면 상태를 구분한다.
- 자세한 소스 근거와 검증 항목은 `docs/handoff/IMPLEMENTATION_AUDIT.md` A01-A13을 따른다.

## 확정된 결정

### TodoScreen v2 layout

TodoScreen v2는 아래 화면 골격으로 고정한다.

```txt
[ native header: 오른쪽 ... 버튼 ]
[ RN title/date + RN calendar ]
[ NativeManagedList scroll ]
```

결정 사항:

- TodoScreen은 Expo Router native Stack header를 사용한다.
- native header에는 route/action 영역만 둔다. 우측 `...` 메뉴가 기본 액션 진입점이다.
- 큰 title/date 영역은 native header가 아니라 RN content chrome으로 둔다.
- 기존 RN/Reanimated calendar widget은 유지한다.
- calendar를 iOS/Android native item으로 재구현하지 않는다.
- `NativeManagedList`는 todo/favorite/category list의 유일한 vertical scroll owner로 유지한다.
- RN `ScrollView`/`FlatList`가 `NativeManagedList`를 같은 세로축으로 감싸는 구조는 금지한다.
- title/calendar/list가 완전히 하나의 스크롤처럼 움직이는 one-page-scroll은 TodoScreen v2 1차 범위에서 제외한다.
- one-page-scroll 느낌은 후속 prototype에서 `topSpacerHeight`, scroll offset bridge, RN overlay 방식으로 별도 검증한다.

이 결정은 기존 RN calendar 재사용, iOS native list reorder/drag/menu 안정성, Android native list 확장 가능성을 우선한 타협안이다.

### TodoScreen header menu

TodoScreen header menu는 아래 방식으로 고정한다.

- TodoScreen header는 Expo Router native Stack header를 사용한다.
- header 오른쪽에는 `...` 버튼을 둔다.
- iOS에서 `...`는 pull-down menu로 연다.
- Android에서 app-bar `...`는 platform/native overflow menu를 기본으로 한다. 더 큰 task/selection surface가 필요할 때만 bottom sheet를 사용한다.
- header menu의 항목/상태 로직은 `TodoScreenActionMenu` 같은 JS facade에 모은다.
- iOS/Android의 표시 방식은 달라도 메뉴 항목 contract는 동일하게 유지한다.
- Expo `Stack.Toolbar.Menu`는 iOS 후보로 둘 수 있지만, Android SDK 55 안정성 때문에 공통 전제로 삼지 않는다.

### 완료된 항목 보기/가리기

완료된 항목 표시 상태는 일정 리스트 계열 공통 설정으로 고정한다.

- 적용 대상은 TodoScreen, AllTodos, Favorites, Category detail 같은 일정 리스트 화면이다.
- TodoScreen 전용 로컬 상태로 두지 않는다.
- 앱 전체의 모든 설정 화면/통계/디버그 화면까지 강제로 묶는 전역 UI 정책으로도 보지 않는다.
- header `...` 메뉴에는 `완료된 항목 가리기` / `완료된 항목 보기` 액션을 넣는다.
- 설정값은 일정 리스트 계열 화면 간 공유되어야 한다.
- 즐겨찾기 section도 같은 표시 정책을 따른다.
- 완료 항목 숨김은 native section build 전에 JS 데이터 필터 단계에서 적용하는 것을 우선 검토한다.

### 선택모드 UX

선택모드는 아래 구조로 고정한다.

- selection mode는 별도 route/page가 아니라 현재 화면 안에서 전환되는 mode로 처리한다.
- AllTodos, Favorites, Category detail, Completed 같은 calendar 없는 native-list 화면은 현재 화면의 scope/filter/sort/section 상태를 유지한 채 selection mode에 진입한다.
- 선택모드 진입 시 현재 정렬/section 구조는 유지한다.
- 선택모드 진입 시 header 왼쪽 navigation/back 영역은 기존 화면 상태를 유지한다.
- 예: `My Page > 즐겨찾기`에서 선택모드에 들어가도 왼쪽 back affordance는 기존 `My Page` back 상태를 유지한다.
- 선택모드 중 back을 누르면 이전 화면으로 이동하고 선택 상태는 폐기한다. 선택 상태 폐기에 별도 confirm은 띄우지 않는다.
- header title은 0개 선택 시 `일정 선택`, 1개 이상 선택 시 `n개 선택됨` 상태로 표시한다.
- header 오른쪽에는 `완료` 버튼을 둔다.
- 선택모드에서 기존 header `...` 메뉴는 숨긴다.
- 선택모드 진입 시 custom floating bottom tab bar는 숨긴다.
- bottom tab bar 자리에는 공통 RN `SelectionActionBar`를 표시한다.
- `SelectionActionBar`는 iOS/Android 공통 컴포넌트로 구현한다.
- `SelectionActionBar`는 action registry/array 기반으로 구성해 후속 액션 추가/제거를 쉽게 한다.
- `SelectionActionBar`의 기본 액션은 삭제, 완료됨으로 표시, 즐겨찾기 추가, 이동이다.
- `SelectionActionBar`는 화면별 action override를 허용한다.
- Favorites 화면에서는 기본 `즐겨찾기 추가` 대신 `즐겨찾기 해제`를 사용한다.
- Completed 화면에서는 기본 `완료됨으로 표시` 대신 `미완료로 표시`를 사용한다.
- 선택 항목이 0개일 때 action button disable 규칙을 둔다.
- `NativeManagedList`의 `contentInsetBottom`은 선택모드 action bar 높이와 safe area에 맞춰 조정한다.
- 선택모드에서는 reorder/drag interaction을 비활성화하는 것을 우선 원칙으로 한다.
- 선택모드에서는 item context menu, drag reorder, category collapse/expand interaction을 비활성화하는 것을 우선 원칙으로 한다.
- 선택모드에서는 row tap이 선택 toggle로 동작한다.
- todo 완료 toggle 자리는 checkbox/multiselect control로 대체한다.
- 일정 item은 selected 상태 디자인을 가진다.
- swipe action은 선택모드 중 비활성화한다.
- 선택모드에서 summary item은 숨기는 것을 기본 후보로 둔다. 필요하면 선택 개수 title과 중복되지 않는 보조 정보만 남긴다.
- category move 액션은 선택모드 자체를 별도 page로 이동시키지 않고, 현재 selection mode 위에서 별도 picker sheet/page를 연다.
- TodoScreen도 별도 route/page 없이 in-place selection mode를 사용한다. RN title/date/calendar chrome 처리와 상태 보존 규칙은 아래 D03 freeze를 따른다.

### TodoScreen selection chrome (D03, 2026-09-24 freeze)

TodoScreen도 다른 일정 list 화면과 같은 **in-place selection mode**를 사용한다. 별도 selection route/page를 만들지 않는다.

- selection 진입 시 `currentDate`, 현재 sort mode, section/collapse 구조와 선택 대상 scope를 바꾸지 않는다.
- RN content chrome인 title/date와 `WeekFlowTodoHeader` calendar는 selection 중 화면에서 숨기고 조작할 수 없게 한다.
- calendar를 숨긴다는 이유로 사용자가 보던 weekly/monthly mode, visible week/month viewport 같은 상태를 잃어서는 안 된다.
- 상태 보존을 위해 calendar를 계속 mount한 채 layout에서 숨길지, 필요한 state를 상위로 lift할지는 구현 세부사항이다. 제품 계약은 **선택 종료 시 진입 전 calendar mode/viewport가 그대로 복원되는 것**이다.
- selection 중 날짜 이동, 오늘 이동, 이전/다음 주·월 이동, weekly/monthly toggle, calendar drag/scroll 등 날짜 scope를 바꾸는 interaction은 허용하지 않는다.
- calendar chrome이 빠진 공간은 `NativeManagedList`가 사용한다. selection 때문에 별도 RN vertical scroll owner를 추가하지 않는다.
- native header의 `일정 선택` / `n개 선택됨`, 오른쪽 `완료`, bottom tab 숨김과 공통 `SelectionActionBar`는 다른 일정 list 화면과 동일한 contract를 사용한다.
- selection 종료 또는 성공 후 원래 TodoScreen으로 돌아오면 기존 `currentDate`, sort/section 상태와 calendar presentation 상태를 복원한다.
- 이 결정은 calendar 자체 재구현, one-page-scroll, scroll bridge를 요구하지 않는다. 해당 항목은 기존 보류 범위를 유지한다.
- 실제 전환 animation, 숨김 방식과 iOS/Android 세부 layout은 구현 후 기기에서 검증한다.

### Platform-native list interaction (D04, 2026-09-25 freeze)

- iOS와 Android는 동일한 기능 계약을 공유하지만 동일한 gesture나 presentation을 강제하지 않는다.
- OS가 적절한 native primitive를 제공하면 그것을 우선하고, Todolog 고유 의미 때문에 필요한 부분만 custom native layer로 확장한다.
- iOS todo row long-press는 UIKit system context menu를 기본으로 한다.
- iOS reorder 가능 item은 `UICollectionView` native Drag & Drop으로 context-menu gesture에서 drag로 전환하는 경로를 우선한다. UIKit이 gesture, lift/preview, drag session, 일반적인 reorder/drop feedback과 drop animation을 소유하도록 한다.
- iOS에서 Todolog는 허용 drop target, Favorites/category/order 의미, Inbox/timed constraints, collapsed hover-expand와 persistence 같은 제품 semantics를 소유한다.
- flat/simple reorder는 UIKit system behavior를 우선한다. logical section-header drag나 UIKit으로 안정적으로 표현할 수 없는 경계에서만 custom engine을 유지한다.
- 기존 iOS custom engine은 reference/fallback baseline으로 보존한다. native spike가 실제 기기에서 합격한 범위만 단계적으로 대체한다.
- Android todo row long-press는 contextual multi-selection 진입에 사용하며 long-press한 row를 최초 선택한다.
- Android reorder는 명시적인 native drag affordance에서 `ItemTouchHelper.startDrag()`로 시작한다. reorder 가능 여부에 따라 row long-press의 의미를 바꾸지 않는다.
- Android row `⋮`는 anchored native/Material per-item menu, app-bar `⋮`는 platform overflow menu를 기본으로 한다. bottom sheet는 더 큰 task/selection surface가 필요할 때만 사용한다.
- selection mode에서는 양 플랫폼 모두 row tap만 selection toggle로 사용하고 reorder/drag/swipe/item menu/collapse-expand를 비활성화한다.
- 구현 전 iOS 첫 bounded spike는 system context menu → 같은 gesture의 native collection drag → simple same-section reorder만 검증한다. 전체 custom engine rewrite/delete를 한 번에 수행하지 않는다.

### Bulk action data layer

선택모드 bulk action은 아래 구조로 고정한다.

- bulk action은 offline-first hook/service layer로 구현한다.
- 새 bulk 전용 pending type은 1차 구현에서 만들지 않는다.
- 서버 bulk API를 직접 호출하는 방식은 사용하지 않는다.
- UI에서 기존 단일 mutation을 반복 호출하는 방식은 사용하지 않는다.
- SQLite transaction 1번 안에서 여러 row를 처리하고, 기존 pending change를 여러 개 쌓는다.
- 로컬 transaction은 all-or-nothing으로 본다. 로컬 transaction 성공 후 UI는 즉시 반영한다.
- 서버 sync 실패는 기존 pending retry/dead-letter 흐름에 맡기고, UI rollback은 하지 않는다.
- 구현 단위는 `useBulkDeleteTodos`, `useBulkCompleteTodos`, `useBulkFavoriteTodos`, `useBulkMoveTodos` 같은 first-class bulk hook을 우선한다.
- 기존 `useBulkDeleteTodos`는 API-first 구현이므로 offline-first 구현으로 재작성한다.

액션별 정책:

- `bulk delete`
  - 선택된 todo 전체를 soft delete/tombstone 처리한다.
  - DB는 기존 `deleteTodos(ids)` helper를 사용한다.
  - completion/occurrence 관련 데이터는 기존 단일 삭제 정책과 동일하게 completion tombstone 처리한다.
  - sync는 todo마다 기존 `deleteTodo` pending change를 쌓는다.
- `bulk complete`
  - toggle 반복이 아니라 idempotent `완료로 표시` 액션으로 처리한다.
  - 반복 일정은 현재 화면 item의 `occurrenceDate` 기준으로 완료 처리한다.
  - 비반복 일정은 현재 completion 모델과 동일하게 `date = null` 기준으로 완료 처리한다.
  - 이미 완료된 항목은 no-op으로 둔다.
  - DB는 `createCompletion(todoId, completionDate)` 계열 helper를 사용한다.
  - sync는 completion마다 기존 `createCompletion` pending change를 쌓는다.
- `bulk uncomplete`
  - Completed 화면 같은 override 액션에서 사용한다.
  - 반복 일정은 `occurrenceDate`, 비반복 일정은 `date = null` 기준으로 미완료 처리한다.
  - 이미 미완료인 항목은 no-op으로 둔다.
  - DB는 `deleteCompletion(todoId, completionDate)` 계열 helper를 사용한다.
  - sync는 completion마다 기존 `deleteCompletion` pending change를 쌓는다.
- `bulk favorite`
  - 즐겨찾기 추가/해제를 모두 지원한다.
  - Favorites 이외 화면은 추가만 제공하며, 이미 즐겨찾기인 항목은 no-op이다. Favorites 화면은 해제만 제공한다.
  - 추가 시 현재 favorite order의 마지막 뒤에 `ORDER_STEP` 간격으로 순차 부여한다.
  - 해제 시 `favorite_order` / `order.favorite`는 `null`로 둔다.
  - Favorites 화면에서는 기본 action override로 `즐겨찾기 해제`를 사용한다.
  - sync는 todo마다 기존 `updateTodo` pending change를 쌓는다.
- `bulk move`
  - 선택된 todo의 `categoryId`를 이동 대상 category로 변경한다.
  - 이동 대상 category의 마지막 `category_order` 뒤에 `ORDER_STEP` 간격으로 순차 부여한다.
  - 이미 대상 category에 있는 todo는 no-op으로 둔다. bulk move가 의도하지 않은 reorder를 만들지 않게 한다.
  - `custom_order`와 `favorite_order`는 move 액션 자체에서는 변경하지 않는다.
  - sync는 todo마다 기존 `updateTodo` pending change를 쌓는다.

추가 공통 규칙 (`PRESENTATION_IOS_TEST.md` / Android 동일 정책):

- append order는 클릭 순서가 아니라 선택된 화면상 순서를 보존한다.
- 로컬 bulk 성공 후 선택모드를 종료하고 tab bar를 복원한다.

#### Stale / missing selection policy (D02, 2026-09-24 freeze)

- bulk action은 실행 직전 로컬 SQLite를 source of truth로 선택된 요청 집합 전체를 다시 검증한다. React Query 목록에 현재 보이는지 여부만으로 삭제를 판정하지 않는다.
- 같은 todo ID가 active 상태로 남아 있고 해당 action의 현재 scope에서 유효하다면 제목·시간·order 같은 일반 필드 변경만으로 선택을 무효화하지 않는다. 실제 write에는 commit 시점의 최신 local row를 사용한다.
- 선택 항목 중 삭제/tombstone, 실제 누락, 또는 현재 selection/action scope에서 더 이상 유효하지 않은 항목이 하나라도 있으면 해당 bulk action은 아무 write/pending change도 만들지 않고 전체 중단한다. 유효한 일부만 조용히 처리하지 않는다.
- 실패 후 무효 항목만 selection에서 제거하고 나머지 유효 선택은 유지한다. 사용자가 변경 내용을 확인한 뒤 action을 다시 실행해야 하며 자동 재실행하지 않는다.
- query refetch/loading/cache 공백처럼 로컬 SQLite의 active row 존재 여부가 아직 확인되지 않은 상태는 삭제로 간주하지 않는다. 이 경우 실행을 보류하거나 재검증한다.
- 이미 완료, 이미 favorite, 이미 target category처럼 각 action에 기존에 정의된 idempotent no-op은 stale/missing 오류가 아니다.
- move처럼 필수 target이 있는 action은 target category도 commit 시점에 유효해야 한다. target이 삭제/누락되면 전체 action을 중단한다.
- 요청 집합 검증과 실제 local write는 그 사이 경쟁 상태로 부분 성공이 생기지 않도록 같은 SQLite transaction 경계에서 보장한다. 검증 실패 시 pending change도 생성하지 않는다.

캐시/무효화 정책:

- 1차 구현은 optimistic cache 정밀 갱신보다 transaction 완료 후 광범위 invalidate를 우선한다.
- `['todos']`, category/favorite/all todos query, completion-dependent cache, calendar summary/layout cache는 액션 성격에 맞춰 무효화한다.
- 성능 문제가 확인되면 이후 화면별 optimistic cache update로 좁힌다.

### Calendar 없는 NativeManagedList 화면 header

AllTodos, Favorites, Category detail처럼 RN calendar가 없는 일정 리스트 화면은 아래 구조로 고정한다.

```txt
[ native Stack header: native title / large title / route actions ]
[ NativeManagedList / UICollectionView content ]
  sectionHeader item
  todo rows
```

결정 사항:

- native header는 native title, native large title, back, 오른쪽 `...`, 선택모드 cancel/done 같은 route/action chrome을 담당한다.
- 큰 화면 제목은 `NativeManagedList`의 `pageTitle` item이 아니라 native Stack header의 `title` + `headerLargeTitle: true`를 기준으로 한다.
- `pageTitle` item은 현재 기준 구조에서 사용하지 않는다. 사용자 입력 title이 너무 길거나 custom subtitle/summary가 필요한 화면에서만 별도 예외로 재검토한다.
- `NativeManagedList`는 화면의 primary scroll owner이자 native header가 추적하는 primary content가 되어야 한다.
- `NativeManagedList` 앞에 `SafeAreaView`, wrapper `View`, RN header, hard-coded top padding을 두지 않는다.
- JS에서 native header 높이만큼 top padding을 하드코딩하지 않는다.
- iOS native UICollectionView는 `contentInsetAdjustmentBehavior = .automatic`을 명시해 navigation/safe-area inset 조정을 시스템에 맡긴다.
- iOS back button은 기본값을 우선한다. 즉 이전 화면 title을 보여주되, 공간이 부족하면 시스템이 generic title 또는 icon-only로 줄이는 동작을 따른다.
- 화면 title은 back button과 collapsed title 공간을 고려해 짧게 유지한다.
- 특정 화면에서 이전 title이 너무 길거나 오른쪽 action과 충돌하면 `headerBackButtonDisplayMode: 'generic'` 또는 `'minimal'`을 화면별 예외로 검토한다.
- RN `ScrollView` / `FlatList` 화면도 native Stack header + native title + `headerLargeTitle: true`를 기준으로 하되, 해당 scroll view가 화면의 첫 주요 scroll child가 되고 `contentInsetAdjustmentBehavior="automatic"`을 갖도록 한다.
- Android는 iOS large-title/underlap을 강제하지 않고 별도 app bar/background 정책을 둔다.

이 결정은 local spike와 실제 `AllTodosScreen` 적용 결과를 반영한 freeze다. Favorites, Category detail 같은 화면은 `총 n개` 같은 RN header를 제거할지 native list item으로 옮길지 별도 결정 후 rollout한다.

### Calendar 없는 NativeManagedList 화면 summary item

AllTodos, Favorites, Category detail, Completed처럼 RN calendar가 없는 native-list 화면의 count/summary/action 정보는 아래 방식으로 고정한다.

```txt
[ native Stack header: native large title ]
[ NativeManagedList / UICollectionView content ]
  summary item
  sectionHeader item
  todo rows
```

결정 사항:

- `총 n개`, `총 n개의 즐겨찾기`, `n개 완료됨 - 지우기` 같은 RN header `View`는 `NativeManagedList` 앞에 두지 않는다.
- summary/count/action 정보는 `NativeManagedList` 내부 item으로 둔다.
- 1차 구현은 UIKit supplementary header가 아니라 item snapshot 안의 `summary` item 방식으로 간다.
- `summary` item은 `UICollectionViewListCell` / `UIListContentConfiguration` 기반의 list row/header 스타일을 따른다.
- 오른쪽 action이 필요한 경우 native accessory 또는 custom accessory button으로 처리한다.
- 진짜 pinned section header가 필요한 화면에서만 `UICollectionLayoutListConfiguration.headerMode = .supplementary` 승격을 재검토한다.
- summary item은 reorder 대상이 아니다.
- summary item은 todo drag/drop insertion target이 아니다.
- Android도 같은 JS contract를 받되, Material list/header 스타일은 별도 Android policy에서 조정한다.

이 결정은 RN header가 native large title collapse를 깨지 않게 하면서도, iOS 리스트 안의 header/footer/row 스타일을 활용하기 위한 1차 정책이다.

## 확정 후보

### TodoScreen v2를 Android todo native 확장보다 먼저 잡는다

이 화면 구조가 iOS/Android native list의 전제가 되므로, Android todo/favorite native drag 작업 전에 `TodoScreen v2` 구조를 먼저 freeze하는 것이 맞다.

### native list scroll owner 유지

전체 RN `ScrollView`로 감싸지 않는다.
`NativeManagedList`가 계속 scroll owner가 되어야 drag/drop, auto-scroll, hover expand, bottom inset을 유지할 수 있다.

단, 전체 스크롤처럼 보이게 하는 계약은 v2 1차 구현 범위가 아니라 후속 prototype으로 둔다.

- list scroll offset event
- scrollToTop command
- top content spacer 또는 header inset
- header/calendar collapse state와 list scroll offset 동기화
- calendar weekly/monthly 높이 변경 시 spacer/inset 재계산

### Native Header와 Content Title 영역을 분리한다

선택모드까지 고려해도 route/action 영역과 content title 영역은 분리한다.

- native header: 오른쪽 `...`, 선택모드에서는 left cancel/back, title, 완료/액션 상태
- content title 영역: `오늘` / `5월 3일` 또는 `TODAY` / `March 3`
- content title은 RN calendar와 같은 RN content chrome에 둔다.
- v2 1차에서는 content title/calendar가 list와 함께 완전히 collapse되는 one-page-scroll을 구현하지 않는다.

### Calendar 없는 native-list 화면 rollout 범위

Native header / large title / summary item 구조는 확정했지만, AllTodos, Favorites, Category detail 각각에 실제 적용하는 순서는 후속 tasks에서 나눈다.

- iOS 26 route/header options 적용
- iOS 16~25 fallback 확인
- Android header/background parity 확인
- 화면별 native title 문구와 summary item 문구/action 확정

### 정렬 버튼은 header menu로 이동한다

현재 inline chip UI는 v2에서 제거 후보.
`...` 메뉴 안에 `시간순`, `카테고리순`을 넣고 현재 선택 상태를 표시한다.

### 기본 정렬은 시간순 유지

현재 `normalizeTodoScreenSortMode`도 legacy custom 값을 시간순으로 보정한다.
v2에서도 기본값은 `시간순` 유지가 자연스럽다.

### 즐겨찾기 section은 list 내부 상단 section으로 유지

현재 구현처럼 즐겨찾기는 일반 목록과 중복 표시하지 않고 상단 section으로 유지한다.
선택모드에 들어가도 현재 정렬/section 구조는 바꾸지 않는다.

### 카테고리 삭제는 중앙 confirm dialog 유지

카테고리 삭제는 포함된 일정까지 cascade 삭제하므로, 단일 todo 삭제보다 강한 확인이 필요하다.
현재 `useDeleteCategory`와 `deleteCategoryCascade` 구조도 이 판단과 맞다.

## 토론 필요

### 단일 todo 삭제 확인 제거 여부

현재 단일 todo 삭제는 Alert confirm 후 삭제한다.
바로 삭제로 바꾸려면 undo UX가 먼저 필요할 수 있다.
undo 없이 바로 삭제하면 실수 복구가 어렵다.

### 다중 todo 삭제 확인 UI

미리 알림처럼 action sheet 형태가 자연스럽다.
root에 `ActionSheetProvider`가 있으므로 `@expo/react-native-action-sheet`를 사용할 수 있다.
다만 offline-first bulk delete hook이 먼저 필요하다.

### 카테고리 이동 picker 방식

현재 있는 것은 카테고리 생성/수정 form과 color screen이다.
선택모드의 `이동`에는 별도 category picker가 필요하다.

후보:

- Expo Router `formSheet` / `pageSheet` screen
- gorhom bottom sheet
- full screen modal route

추천 후보는 route 기반 `pageSheet/formSheet` category picker다.
선택 후 오른쪽 `이동`, 왼쪽 `취소`, group list, 선택 checkmark 구조를 만들기 쉽다.

### iOS native interaction 재감사 (2026-09-24, D04 선행 근거)

- 현재 UIKit은 context menu와 drag interaction을 시스템적으로 연동할 수 있으므로, reorderable todo에서 system context menu를 끄고 custom pan/snapshot으로 전환하는 현 구현이 유일한 방법은 아니다.
- 현재 코드의 `dragInteractionEnabled = false`와 reorderable todo의 system context-menu suppression은 과거 custom engine 선택이며, 최신 제품 freeze로 간주하지 않는다.
- flat reorder는 기존 diffable `reorderingHandlers`를 포함한 UIKit 경로를 우선한다.
- cross-section todo drag도 `UICollectionViewDragDelegate/DropDelegate`가 gesture/preview/drop을 소유하고 Todolog가 target/order semantics만 소유하는 방식의 bounded spike를 먼저 검증한다.
- collapsed hover-expand, Favorites/Inbox/order 정책, category section-header reorder는 UIKit이 제품 의미를 자동 제공하지 않으므로 custom policy가 계속 필요하다.
- 자세한 기술 근거와 spike 경계는 `docs/handoff/IOS_NATIVE_INTERACTION_AUDIT.md`를 따른다. 이 감사 이후 D04 제품 계약은 2026-09-25 F26으로 freeze했지만, 감사 문서 자체는 구현 승인이 아니다.
- Android의 공식 selection/reorder/menu 근거와 두 long-press 후보의 충돌은 `docs/handoff/ANDROID_NATIVE_INTERACTION_AUDIT.md`를 따른다. F26에 따라 Android category baseline의 long-press reorder를 todo/favorite 최종 UX로 자동 확장하지 않는다.

## 코드 확인 필요 / 구현 전 점검

- `NativeManagedList` scroll offset event와 imperative command는 TodoScreen one-page-scroll prototype 전까지 보류한다.
- iOS/Android/fallback selection payload와 selection-mode reorder/menu/swipe disable path는 1차 구현됐다. iOS manual smoke는 남아 있고 Android todo/favorite parity는 아직 미구현이다.
- menu action `select`는 calendar-free iOS native-list 화면에 연결됐다. Android todo/favorite menu parity는 후속이다.
- `useBulkDeleteTodos`를 offline-first hook으로 재작성한다.
- bulk complete / bulk favorite / bulk move hook을 신규 구현한다.
- `settings.showCompleted`와 TodoScreen-specific hide completed state의 충돌 여부를 확인한다.
- route 기반 category picker와 `client/app/(app)/_layout.js` modal presentation은 구현됐다. 최신 bulk commit은 수동/SQLite 검증이 남아 있다.

## 나중 작업

- `날짜 지정 안함` todo는 별도 데이터/쿼리/정렬 정책 작업이다.
- Android 선택모드는 iOS selection contract freeze 이후 진행한다.
- Android todo/favorite native list 확장은 TodoScreen v2 구조 freeze 이후 진행한다.
- Android header / app bar / action menu 정책은 iOS header freeze와 별도 작업으로 분리한다.
- modal / pageSheet / formSheet 화면의 header, title, back/cancel/save action 정책은 별도 freeze가 필요하다.
- single delete 즉시 삭제 + undo는 deletion UX 별도 작업으로 분리 가능하다.
- selection checkbox 등장/퇴장 animation polish는 selection 기능이 안정된 뒤 다듬는다.
- TodoScreen one-page-scroll 느낌은 `NativeManagedList` top spacer / scroll offset bridge / RN overlay prototype 이후 재검토한다.
- calendar native 재구현은 TodoScreen v2 1차 범위에서 제외한다.

## 추천 freeze 순서

1. TodoScreen v2 화면 골격 freeze 완료
2. native list scroll owner 계약 freeze 완료
3. header menu 방식 freeze 완료
4. 완료 항목 보기/가리기 정책 freeze 완료
5. 선택모드 UX freeze 완료
6. bulk action data layer freeze 완료
7. category picker presentation 방식 freeze
8. modal / pageSheet / formSheet header policy freeze
9. Android header / app bar policy freeze
10. 구현 tasks 작성

## 다음 대화에서 먼저 결정할 질문

1. 단일 todo 삭제는 confirm 유지할지, undo 전제로 즉시 삭제로 바꿀지?
2. category picker presentation은 route sheet로 갈지, bottom sheet로 갈지?
3. `SelectionActionBar`의 action별 disabled/no-op 규칙을 어떻게 둘지?
4. 선택모드 row checkbox animation은 1차 구현에 포함할지, polish로 미룰지?
5. modal / pageSheet / formSheet의 title, 취소/저장/완료 버튼 정책을 어떻게 통일할지?
6. Android에서 native header를 어느 수준까지 맞추고, Material app bar / bottom sheet menu를 어디까지 별도 정책으로 둘지?
