# Native Managed List — Tasks

## Current Status: 2026-05-09

- Contract/facade path는 `client/src/components/ui/native-managed-list/` 아래에 있다.
- iOS native 구현은 아직 `client/modules/native-list-interactions/ios/NativeListInteractionsView.swift` 한 파일에 집중되어 있다.
- `NativeTodoManagedList` wrapper는 iOS Todo category-grouped pilot path에서 활성화되어 있다.
- `TODO SCREEN > 카테고리별 순서`와 `ALL TODOS SCREEN`은 같은 category-grouped interaction model을 재사용한다.
- Category header reorder, todo cross-category move, collapsed category hover auto-expand, drag auto-scroll, Inbox pinned ordering, native bottom inset이 iOS path에 구현되어 있다.
- 다음 우선순위는 managed-list 새 기능 추가가 아니라 안정화와 Swift file split이다.

## Phase 0: Spec Freeze

- [x] `requirements.md`를 현재 rollout 범위에 맞게 정리
- [x] `design.md`를 `contract -> iOS category baseline -> iOS todo pilot -> Android later` 순서로 정리
- [x] `tasks.md`를 현재 우선순위 기준으로 재정렬
- [x] `메뉴 구조.md`와 책임 경계를 다시 확인
- [x] `NativeSettingsList`와 역할 충돌이 없는지 확인

## Phase 1: Contract Freeze

- [x] `client/src/components/ui/native-managed-list/types.ts`를 public contract source로 고정
- [x] `ManagedListVariant` 정의 및 불필요한 variant 이름 정리
- [x] `ManagedListSection` 정의
- [x] `ManagedListItem` 정의
- [x] `sectionHeader`, `collapsed`, `hidden` item state 정의
- [x] `ManagedListAction` 정의
- [x] `ManagedListControl` 정의
- [x] `onPressItem`, `onAction`, `onControlAction`, `onReorderCommit`, `onSectionExpandRequest`, `onError` payload 정의
- [x] section-aware reorder payload를 최종 contract로 확정
- [x] wrapper가 해석해야 하는 domain field(`custom/category/favorite order`) 책임 범위 명시
- [x] `contentInsetBottom` native scroll inset prop 정의

## Phase 2: JS Facade Alignment

- [x] `client/src/components/ui/native-managed-list/NativeManagedList.tsx` public facade 정리
- [x] `client/src/components/ui/native-managed-list/NativeManagedList.web.tsx` fallback 유지
- [x] native view manager prop shape를 contract와 일치시킴
- [x] `sectionsJson` serialization 정리
- [x] native event -> typed callback 변환 정리
- [x] iOS 기준 estimate/layout 기본값 정리
- [x] `todo` variant는 fixed estimated height 대신 flex/minHeight path 사용

## Phase 3: iOS Category Baseline

- [x] 기존 `NativeListInteractionsView.swift`의 `custom-lifted` 흐름을 managed-list facade 뒤에 연결
- [ ] `category` hard-coded naming을 managed-list generic naming으로 정리
- [ ] category preview renderer 정리
- [ ] custom native menu를 structured `ManagedListAction` 기반으로 정리
- [x] swipe action을 managed action event로 연결
- [x] reorder commit을 section-aware payload로 정리
- [x] handle reorder를 사용하지 않도록 유지

## Phase 4: Category Adapter / Validation Path

- [x] `NativeCategoryManager`가 새 `NativeManagedList` category variant를 사용하도록 adapter 정리
- [x] 기존 `NativeCategoryManagerProps`와 새 managed-list event를 매핑
- [x] category data의 subtitle / count / color mapping 정책 정리
- [x] `My Page > 카테고리`를 production validation path로 사용
- [ ] 기존 native-settings `CategoryManagerView`와의 전환 전략 결정

## Phase 5: Harness / Smoke

- [x] 기존 `/native-category-menu` 테스트 화면은 보존
- [ ] category catalog / test route 정리
- [x] event log에서 `onPressItem`, `onAction`, `onControlAction`, `onReorderCommit` 확인
- [x] mock reorder state 업데이트 확인
- [x] iOS long press menu / preview / reorder / swipe smoke 확인

## Phase 6: Todo Variant Contract

- [x] `todo` variant row 디자인 초안 작성
- [x] `todo -> ManagedListItem` adapter 추가
- [x] `NativeTodoManagedList` wrapper 추가
- [x] complete control mapping 정의
- [x] trailing favorite control placeholder 정의
- [x] sub label 표시 정책 정리
- [x] TodoScreen `시간순 / 사용자 지정 / 카테고리별 순서`와 연결되는 데이터 shape 정의
- [x] `ALL TODOS`에서 재사용 가능한 최소 contract 확인
- [ ] `CATEGORY SCREEN`, `FAVORITE`에서 재사용 가능한 최소 contract 확인

## Phase 6A: iOS Todo Category-Grouped Pilot

- [x] `TODO SCREEN > 카테고리별 순서`에 `NativeTodoManagedList` 연결
- [x] `ALL TODOS SCREEN`에 `NativeTodoManagedList` 연결
- [x] category group header item(`sectionHeader`) 도입
- [x] header tap으로 collapse/expand 상태 변경
- [x] todo row same-category reorder
- [x] todo row cross-category move
- [x] target category 내부 gap 기준 drop
- [x] collapsed category hover auto-expand
- [x] drag 중 edge auto-scroll
- [x] category header long press reorder
- [x] category header long press menu action(rename/delete cascade)
- [x] expanded category drag 시작 시 임시 collapse 처리
- [x] Inbox/system category top pinned rule 적용
- [x] bottom floating tab bar overlap 방지를 위한 native bottom inset 적용
- [ ] All Todos manual parity checklist 재확인
- [ ] 자동화 가능한 native interaction smoke 재정의

## Phase 7: iOS Swift Stabilization / File Split

- [x] `NativeListInteractionsModels.swift`: `NativeSection`, `NativeItem`, session/drop target structs 이동
- [x] `NativeListInteractionsDataSource.swift`: diffable datasource, snapshot, visible item filtering 이동
- [x] `NativeListInteractionsLayout.swift`: collection layout/cell configuration helper 이동
- [x] `NativeListInteractionsCategoryMenu.swift`: custom menu overlay, menu descriptors, preview rendering 이동
- [x] `NativeListInteractionsTodoDrag.swift`: todo floating snapshot drag, drop target, insertion indicator, commit 이동
- [x] `NativeListInteractionsSectionHeaderDrag.swift`: category group header drag/reorder 이동
- [x] `NativeListInteractionsAutoScroll.swift`: drag edge auto-scroll 이동
- [x] `applySnapshot` + `reloadData` 병행 호출 감사
- [x] split 후 iOS build 검증
- [x] split 후 Todo category-grouped manual smoke 검증
- [x] split 후 My Page category create/reorder smoke 검증

## Phase 8: Android Follow-up

- Android managed-list view scaffold는 contract freeze 이후 진행
- RecyclerView 기반 section/item 렌더링 설계
- long press reorder / swipe / trailing `⋮` action surface 연결
- 같은 JS contract로 event가 올라오도록 맞춤

## Phase 9: Favorite Follow-up

- Favorite 기능 요구사항 별도 spec 여부 결정
- `favoriteTodo` variant에 필요한 추가 필드 확정
- FavoriteScreen 적용은 Favorite feature 구현 후 진행

## Phase 10: Validation

### Contract Checkpoints

- native event에 raw native index가 노출되지 않는다.
- action은 native에서 직접 실행되지 않고 event만 emit된다.
- reorder payload만으로 affected section의 최종 order를 복원할 수 있다.
- `NativeSettingsList`는 managed-list 기능을 포함하지 않는다.

### iOS Category Checkpoints

- long press 시 custom native menu가 열린다.
- lightweight preview가 뜬다.
- 손을 떼도 menu/preview가 유지된다.
- preview를 다시 잡고 움직이면 reorder가 시작된다.
- swipe action이 열린다.
- handle이 보이지 않는다.
- reorder 결과가 section-aware payload로 emit된다.

### MyPage V2 Checkpoints

- 일반 메뉴 block과 category block이 같은 화면 안에서 함께 렌더링된다.
- 일반 메뉴는 `NativeSettingsList`를 사용한다.
- category block은 managed-list category variant를 사용한다.
- 기존 MyPage runtime은 깨지지 않는다.

### Todo Category-Grouped Checkpoints

- TODO SCREEN category mode와 ALL TODOS가 같은 wrapper/interaction model을 사용한다.
- todo reorder payload가 DB reload 후에도 target category insertion position을 유지한다.
- section header reorder는 category order만 변경한다.
- Inbox는 non-system category보다 항상 위에 pinned 상태로 유지된다.
- collapsed category hover expand 중 dragged item을 놓치지 않는다.
- 상단/하단 근처로 drag하면 collection view가 auto-scroll 된다.
- bottom floating tab bar가 마지막 visible drop target을 가리지 않는다.

### Android Checkpoints

- Android는 iOS lifted menu를 강제하지 않는다.
- long press reorder가 동작한다.
- `⋮` action surface가 열린다.
- swipe action이 동작한다.
- 같은 JS contract로 event가 올라온다.

## Phase 11: Decision Record

구현 후 아래를 기록한다.

- `NativeManagedList` 최종 이름 확정 여부
- iOS category variant의 production readiness
- `NativeCategoryManager` adapter 방식
- Android action surface 최종 선택
- Todo variant로 넘어가기 전 남은 blocker
- Favorite 기능을 별도 spec으로 분리할지 여부
