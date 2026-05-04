# Native Managed List — Tasks

## Phase 0: Spec Freeze

- `requirements.md`를 현재 rollout 범위에 맞게 정리
- `design.md`를 `contract -> iOS category baseline -> Android later` 순서로 정리
- `tasks.md`를 현재 우선순위 기준으로 재정렬
- `메뉴 구조.md`와 책임 경계를 다시 확인
- `NativeSettingsList`와 역할 충돌이 없는지 확인

## Phase 1: Contract Freeze

- `client/src/components/ui/native-managed-list/types.ts`를 public contract source로 고정
- `ManagedListVariant` 정의 및 불필요한 variant 이름 정리
- `ManagedListSection` 정의
- `ManagedListItem` 정의
- `ManagedListAction` 정의
- `ManagedListControl` 정의
- `onPressItem`, `onAction`, `onControlAction`, `onReorderCommit`, `onError` payload 정의
- section-aware reorder payload를 최종 contract로 확정
- wrapper가 해석해야 하는 domain field(`custom/category/favorite order`) 책임 범위 명시

## Phase 2: JS Facade Alignment

- `client/src/components/ui/native-managed-list/NativeManagedList.tsx` public facade 정리
- `client/src/components/ui/native-managed-list/NativeManagedList.web.tsx` fallback 유지
- native view manager prop shape를 contract와 일치시킴
- `sectionsJson` serialization 정리
- native event -> typed callback 변환 정리
- iOS 기준 estimate/layout 기본값 정리

## Phase 3: iOS Category Baseline

- 기존 `NativeListInteractionsView.swift`의 `custom-lifted` 흐름을 새 iOS managed list view로 이식/정리
- `category` hard-coded naming을 managed-list generic naming으로 정리
- category preview renderer 정리
- custom native menu를 structured `ManagedListAction` 기반으로 정리
- swipe action을 structured action 기반으로 정리
- reorder commit을 section-aware payload로 정리
- handle reorder를 사용하지 않도록 유지

## Phase 4: Category Adapter / Validation Path

- `NativeCategoryManager`가 새 `NativeManagedList` category variant를 사용하도록 adapter 정리
- 기존 `NativeCategoryManagerProps`와 새 managed-list event를 매핑
- category data의 subtitle / count / color mapping 정책 정리
- `My Page > 카테고리`를 production validation path로 사용
- 기존 native-settings `CategoryManagerView`와의 전환 전략 결정

## Phase 5: Harness / Smoke

- 기존 `/native-category-menu` 테스트 화면은 보존
- category catalog / test route 정리
- event log에서 `onPressItem`, `onAction`, `onControlAction`, `onReorderCommit` 확인
- mock reorder state 업데이트 확인
- iOS long press menu / preview / reorder / swipe smoke 확인

## Phase 6: Todo Variant Contract

- `todo` variant row 디자인 초안 작성
- `todo -> ManagedListItem` adapter 추가
- `NativeTodoManagedList` wrapper 추가
- complete control mapping 정의
- trailing favorite control placeholder 정의
- sub label 표시 정책 정리
- TodoScreen `시간순 / 사용자 지정 / 카테고리별 순서`와 연결되는 데이터 shape 정의
- `CATEGORY SCREEN`, `ALL TODOS`, `FAVORITE`에서 재사용 가능한 최소 contract 확인

## Phase 7: Android Follow-up

- Android managed-list view scaffold는 contract freeze 이후 진행
- RecyclerView 기반 section/item 렌더링 설계
- long press reorder / swipe / trailing `⋮` action surface 연결
- 같은 JS contract로 event가 올라오도록 맞춤

## Phase 8: Favorite Follow-up

- Favorite 기능 요구사항 별도 spec 여부 결정
- `favoriteTodo` variant에 필요한 추가 필드 확정
- FavoriteScreen 적용은 Favorite feature 구현 후 진행

## Phase 9: Validation

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

### Android Checkpoints

- Android는 iOS lifted menu를 강제하지 않는다.
- long press reorder가 동작한다.
- `⋮` action surface가 열린다.
- swipe action이 동작한다.
- 같은 JS contract로 event가 올라온다.

## Phase 10: Decision Record

구현 후 아래를 기록한다.

- `NativeManagedList` 최종 이름 확정 여부
- iOS category variant의 production readiness
- `NativeCategoryManager` adapter 방식
- Android action surface 최종 선택
- Todo variant로 넘어가기 전 남은 blocker
- Favorite 기능을 별도 spec으로 분리할지 여부
