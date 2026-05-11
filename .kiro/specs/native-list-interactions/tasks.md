# Native List Interactions — Tasks

## Task 1: Spec Baseline

- `requirements.md` 작성
- `design.md` 작성
- `tasks.md` 작성
- 스파이크 범위를 `zeego-menus`와 분리

## Task 2: Public Test Route Scaffold

- 테스트 화면 파일 추가
  - `client/src/test/NativeListInteractionsTestScreen.js`
- 로그인 여부와 무관하게 접근 가능한 public route 추가
- `client/app/native-list-interactions.js` 추가
- root auth gate에서 `native-list-interactions` segment를 명시적으로 allowlist 처리
- Welcome 화면에서 `/native-list-interactions`로 진입 가능한 entry 추가
- 필요 시 `client/app/(app)/test/native-list-interactions.js`를 보조 재사용 route로 추가
- 필요 시 DebugScreen에 진입 버튼 추가

## Task 3: Shared JS Facade

- 공통 JS entry component 초안 작성
  - `NativeMenuList`
  - `MenuListSection`
  - `MenuListItem`
  - `CategoryListItem`
- 공통 item schema / section schema / callback prop 정의
- `sections[]` 기반 public API 정의
- section title / footer 전달 및 렌더링 계약 정의
- menu row를 discriminated union으로 정의
- category row capability 계약을 menu row variant와 분리
- row `variant` 및 trailing 단일 선택 규칙 정의
- canonical delete event 규칙 정의
  - delete는 `onDelete`만 사용
- `onToggleSwitch`를 공통 callback 계약에 포함
- `value-navigation`의 필수 값 필드(`valueText`) 정의
- 테스트 화면에서 in-memory mock state 연결

## Task 4: iOS Native Prototype

- iOS renderer/bridge 구조 추가
- `UICollectionView` list + `.insetGrouped` appearance 실험
- 기본 메뉴 row tap 검증
- iOS `menu` row interaction 규칙 구현
  - tap -> native menu open
  - action 선택 -> `onMenuAction`
  - tap 자체는 `onPress` emit 안 함
- category row interaction 검증:
  - swipe delete reveal
  - system context menu candidate
  - system reorder interaction
  - vertical move threshold -> reorder 진입 시도
- 필요 시 category row 한정 custom coordination compare mode 구현
  - stationary hold -> custom menu surface 표시
  - vertical move threshold -> custom menu dismiss + reorder begin 시도
- exact same-touch handoff는 system API 우선으로 검증하고, 불충분하면 fallback을 기록
- 이벤트를 JS로 전달:
  - `onPress`
  - `onMenuAction`
  - `onDelete`
  - `onReorder`
  - `onToggleSwitch`

## Task 5: Android Native Prototype

- Android renderer/bridge 구조 추가
- grouped list / section 구조 실험
- trailing `...` action surface 추가
- native popup / sheet action selection 검증
- category row long press reorder 검증
- 이벤트를 JS로 전달:
  - `onPress`
  - `onMenuAction`
  - `onDelete`
  - `onReorder`
  - `onToggleSwitch`

## Task 6: Test Screen Integration

- 일반 메뉴 row 그룹 추가
- 카테고리 interactive row 그룹 추가
- destructive row 그룹 추가
- section title / footer 예시 추가
- row variant 예시 추가:
  - `navigation`
  - `switch`
  - `value-navigation`
  - `menu`
- event log UI 추가
- reset / mock data restore 버튼 추가

## Task 7: Validation

### iOS Checkpoints

- grouped section이 settings-style로 인지 가능하다.
- 일반 메뉴 row tap이 작동한다.
- iOS `menu` row tap 시 native menu가 열린다.
- iOS `menu` row action 선택은 `onMenuAction`으로만 전달된다.
- iOS `menu` row tap 시 `onPress`는 발생하지 않는다.
- category row swipe delete가 드러난다.
- category row stationary long press 시 system context menu가 열린다.
- category row long press 후 vertical move 시 system reorder 또는 명시적 fallback으로 분기된다.
- category reorder 결과가 JS state에 반영된다.
- exact same-touch handoff 가능 여부를 판정할 수 있다.
- compare mode가 `custom-experiment`일 때 stationary hold에서 custom menu surface가 표시된다.
- compare mode가 `custom-experiment`일 때 vertical move threshold 초과 시 custom menu surface가 닫히고 reorder 진입을 시도한다.

### Android Checkpoints

- grouped section이 구분 가능하다.
- trailing `...` 액션이 열린다.
- menu action 선택이 JS event로 전달된다.
- category row long press reorder가 동작한다.
- reorder 결과가 JS state에 반영된다.

### Shared Checkpoints

- 같은 mock item schema로 iOS / Android를 렌더링한다.
- 같은 row variant schema로 iOS / Android를 렌더링한다.
- `switch` row가 `onToggleSwitch`를 emit하고 mock state가 갱신된다.
- `value-navigation` row가 iOS / Android 모두에서 필수 value text를 표시한다.
- `menu` row와 `category` row에서 delete가 중복 callback 없이 단일 규칙으로 전달된다.
- 어떤 row도 둘 이상의 trailing 의미를 동시에 렌더링하지 않는다.
- category row 데이터에 `switch` / `value-navigation` variant가 들어오지 않도록 검증한다.
- `supportsMenu = false`인 category row는 `menuActions = []`를 유지한다.
- `supportsMenu = true`인 category row는 `menuActions.length > 0`만 허용한다.
- disabled / destructive 예시가 기대한 시각/동작으로 표현된다.
- 로그인하지 않은 상태에서도 테스트 화면 진입이 가능하다.
- 로그인한 상태에서도 동일 public route로 테스트 화면 진입이 가능하다.
- `/native-list-interactions`를 Welcome에서 직접 진입 가능하다.
- route 진입 시 crash가 없다.
- 기존 production 화면은 영향을 받지 않는다.

## Task 8: Decision Record

스파이크 완료 후 아래를 문서화한다.

- iOS exact handoff verdict: `supported` / `partially-supported` / `not-supported`
- Android action surface 최종 선택
- native list 전체 브리지 vs native row 브리지 중 어떤 구조가 더 맞는지
- category / settings / my-page 실제 적용 가능성
