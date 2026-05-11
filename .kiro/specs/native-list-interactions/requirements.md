# Native List Interactions — Requirements

## Goal

기존 `Zeego` 중심 메뉴 검증과 별도로, iOS/Android에서 각 플랫폼에 맞는 네이티브 리스트 인터랙션을 실험한다.
1차 목표는 실제 화면 교체가 아니라, 재사용 가능한 "메뉴형 리스트 아이템 묶음"을 테스트 화면에서 검증하는 것이다.

이 실험은 아래 두 요구를 동시에 만족해야 한다.

- 카테고리처럼 상호작용이 많은 row는 플랫폼별 네이티브 UX를 최대한 살린다.
- 설정 / 마이페이지 같은 일반 메뉴 row도 같은 묶음 안에서 재사용 가능해야 한다.

## Scope

- ✅ 별도 스펙 폴더 추가: `.kiro/specs/native-list-interactions/`
- ✅ 테스트 전용 화면 추가:
  - iOS / Android 분기 동작 확인용
  - 로그인 없이 접근 가능해야 함
  - Welcome 화면에서 진입 가능해야 함
  - public route로 접근 가능해야 함
  - Web은 라우트/렌더러 자리만 고려하고 구현은 제외
- ✅ 재사용 가능한 공통 JS API 설계:
  - grouped list
  - section header
  - 기본 메뉴 row
  - 카테고리 전용 interactive row
- ✅ iOS 프로토타입 요구사항 정의:
  - Settings 스타일 grouped list
  - category row: swipe delete / system context menu / long press + move reorder 실험
  - 필요 시 category row 한정 custom gesture coordination compare mode 실험
- ✅ Android 프로토타입 요구사항 정의:
  - 기본 메뉴 row trailing `...`
  - `...` 클릭 시 액션시트 또는 네이티브 메뉴
  - category row long press reorder
- ✅ 테스트 화면에서 이벤트 로그와 in-memory reorder 검증

- ❌ 기존 카테고리 화면 / todo 리스트 즉시 교체
- ❌ SQLite / sync / API 계약 변경
- ❌ Web 실제 동작 구현
- ❌ 디자인 시스템 최종 확정
- ❌ production-ready 네이티브 모듈 배포까지 보장

## Product Intent

이 기능은 "공통 컴포넌트 1개로 모든 플랫폼을 똑같이 맞춘다"가 목적이 아니다.
목적은 "같은 데이터 계약으로 플랫폼별로 가장 자연스러운 리스트 상호작용을 제공한다"이다.

즉:

- iOS는 iOS답게
- Android는 Android답게
- Web은 추후 별도 전략으로

## Hard Constraints

1. Offline-first / SQLite SOT 아키텍처를 건드리지 않는다.
2. 테스트 단계에서는 실제 category/todo 데이터 소스에 연결하지 않는다.
3. 모든 테스트 상태는 화면 내부 mock/in-memory state로 관리한다.
4. iOS/Android 구현은 하나의 JS 인터페이스 뒤에 숨겨야 한다.
5. 기존 `zeego-menus` 스펙 및 테스트 화면은 유지하고, 새 실험은 별도 경로로 분리한다.
6. Web은 현재 스펙에서 비목표로 두되, 추후 renderer 추가가 가능하도록 인터페이스는 열어 둔다.
7. 테스트 화면은 인증 상태와 무관하게 열 수 있어야 한다.

## Functional Requirements

### FR-1: 공통 리스트 묶음 인터페이스

재사용 가능한 리스트 묶음은 최소 아래 개념을 지원해야 한다.

- grouped list container
- section 단위 그룹
- section title
- section footer
- 기본 메뉴 row
- 카테고리 전용 interactive row
- row variant
- trailing accessory 표시
- disabled / destructive 상태

공통 JS API는 section 배열을 직접 받아야 한다.

```ts
type NativeMenuSection = {
  id: string;
  title?: string;
  footer?: string;
  items: NativeMenuItem[];
};
```

사용 화면은 개별 row를 직접 그리지 않고, 위 `sections` 데이터를 `NativeMenuList`에 전달하는 방식이어야 한다.

각 row는 trailing 동작을 하나만 가져야 한다.
즉, 한 row에서 아래 종류를 동시에 섞지 않는다.

- `switch`
- `value-navigation`
- `menu`

공통 이벤트 계약은 아래 canonical contract를 사용해야 한다.

- `onPress(itemId)`
- `onMenuAction(itemId, action)` where `action` excludes delete
- `onDelete(itemId)` as the only canonical delete callback
- `onReorder(orderedIds)`
- `onToggleSwitch(itemId, nextValue)`

삭제가 menu surface에서 시작되더라도 JS에는 `onDelete(itemId)`만 전달해야 한다.
`onMenuAction(itemId, 'delete')`는 허용하지 않는다.

## FR-2: 기본 메뉴 row

기본 메뉴 row는 설정 / 마이페이지 / 일반 메뉴 항목에 재사용 가능해야 한다.

기본 메뉴 row는 최소 아래 variant를 지원해야 한다.

- `navigation`
- `switch`
- `value-navigation`
- `menu`

기본 메뉴 row는 아래를 지원해야 한다.

- leading icon or marker
- title
- optional subtitle
- trailing variant에 따른 accessory
- tap action

기본 메뉴 row는 section title/footer가 있는 grouped list 안에서도 정상 렌더링되어야 한다.

기본 메뉴 row는 reorder 대상이 아니다.

### FR-2.1: trailing variant 규칙

한 row는 아래 trailing variant 중 하나만 가진다.

- `switch`
  - row 내부에서 즉시 토글
- `value-navigation`
  - 현재 상태값 표시 + 다음 화면 이동
- `menu`
  - 추가 액션 진입점 표시
- `navigation`
  - 별도 상태값 없이 다음 화면 이동

variant별 필수 필드는 아래와 같다.

- `switch` -> `switchValue: boolean`
- `value-navigation` -> `valueText: string`
- `menu` -> `menuActions: NonDeleteMenuAction[]`
- `navigation` -> 추가 trailing data 없음

`NonDeleteMenuAction`은 아래만 허용한다.

- `open`
- `rename`
- `edit`
- `duplicate`
- `archive`

이 규칙은 iOS/Android 공통 데이터 계약으로 유지해야 한다.
플랫폼 renderer는 같은 variant를 각 플랫폼 관례에 맞게 표시하되, 한 row에 여러 trailing 의미를 동시에 노출해서는 안 된다.

### FR-2.2: iOS menu row interaction

iOS에서 `menu` variant는 navigation row와 다르게 동작해야 한다.

- row tap -> native menu open
- row tap 시 `onPress`는 emit하지 않는다
- 실제 메뉴 액션 선택 시 `onMenuAction(itemId, action)`만 emit한다
- 1차 스파이크에서는 iOS 기본 menu row에 별도 trailing `...`를 두지 않는다

## FR-3: 카테고리 interactive row

카테고리 interactive row는 일반 메뉴 row보다 더 많은 상호작용을 가진다.

카테고리 interactive row는 아래를 지원해야 한다.

- title / color / optional meta
- delete action
- reorder
- menu action set

카테고리 interactive row도 row 하나에 trailing action surface를 하나만 가져야 한다.
카테고리 row는 기본 메뉴 row의 trailing variant 시스템을 재사용하지 않는다.
카테고리 row는 아래 capability 계약을 사용한다.

- `reorderable`
- `deletable`
- `supportsMenu`
- `menuActions` (`delete` 제외)

불변식:

- `supportsMenu = false` -> `menuActions = []`
- `supportsMenu = true` -> `menuActions.length > 0`

카테고리 interactive row는 플랫폼별로 다른 상호작용을 허용한다.

### FR-3.1: iOS category row

iOS에서는 아래 UX를 목표로 한다.

- row를 왼쪽으로 swipe 하면 delete action이 나타난다.
- row를 long press 하면 system context menu 후보로 동작한다.
- long press 상태에서 row를 설정된 vertical threshold 이상 이동시키면 menu 대신 reorder가 시작된다.
- reorder는 visible handle 없이 row 자체 상호작용으로 시작하는 것을 목표로 한다.
- category row는 가능한 한 Apple system menu / swipe / reorder API를 우선 사용한다.
- exact same-touch handoff가 불가능하면 system reorder accessory 또는 명시적 fallback을 허용한다.
- 테스트 화면에서는 category row 한정 custom coordination compare mode를 둘 수 있다.
  - `native / system`
  - `native / custom-experiment`

주의:

- exact same-touch handoff는 phase 1에서 보장 기능이 아니라 검증 대상이다.
- 허용되는 결과는 아래 셋 중 하나다.
  - same-touch handoff 가능
  - system menu와 reorder를 분리한 fallback만 가능
  - 부분 가능하지만 OS 제약이 명확함
- phase 1 성공 조건은 위 결과 중 하나를 문서화하는 것이지, same-touch handoff 자체를 약속하는 것이 아니다.
- custom coordination compare mode는 category row 실험용이며, 기본 아키텍처를 곧바로 뒤집는 전제조건이 아니다.
- `custom-experiment`는 category row에만 적용되는 exact UX 비교 실험이다.
  - stationary hold -> custom iOS-style menu surface
  - vertical move threshold 초과 -> menu surface dismiss + reorder 진입 시도
  - 일반 `menu` row와 swipe delete는 기존 system 경로를 유지한다.

### FR-3.2: Android category row

Android에서는 아래 UX를 목표로 한다.

- long press 시 reorder가 가능해야 한다.
- trailing `...` 버튼을 누르면 menu action sheet 또는 native popup/bottom sheet가 나타난다.
- iOS식 row long press context menu는 Android 프로토타입의 목표가 아니다.

## FR-4: iOS grouped list appearance

iOS 프로토타입은 설정 앱처럼 section 단위로 묶인 grouped list 느낌을 제공해야 한다.

- section header
- rounded group container
- section 내부 row separator
- destructive row 구분 가능

완전한 픽셀 매칭은 목표가 아니지만, "settings-style grouped list"로 인지될 정도의 구조는 필요하다.

## FR-5: Android menu/list appearance

Android 프로토타입은 Material/Android 관례에 맞는 list row와 trailing action 진입점을 제공해야 한다.

- section 그룹 지원
- row tap
- trailing `...`
- reorder 가능한 category row

## FR-6: 테스트 화면

테스트 화면은 iOS / Android에서 각각 다른 동작을 즉시 확인할 수 있어야 한다.
테스트 화면은 로그인 없이도 접근 가능해야 하며, Welcome 화면에서 명시적인 진입점을 제공해야 한다.

테스트 화면에는 최소 아래 섹션이 필요하다.

- 일반 메뉴 row 그룹
- 카테고리 interactive row 그룹
- destructive row 예시
- section title / footer 예시
- row variant 예시 (`navigation`, `switch`, `value-navigation`, `menu`)
- 이벤트 로그
- row reset / mock data reset

테스트 화면에서는 아래를 확인할 수 있어야 한다.

- tap 이벤트
- menu action 이벤트
- delete 이벤트
- reorder 결과

## FR-7: 플랫폼 분기

JS 진입 컴포넌트는 하나로 유지하되, 내부 구현은 플랫폼별로 분기 가능해야 한다.

- `ios`: native-first implementation
- `android`: native-first implementation
- `web`: placeholder or deferred renderer

Web renderer는 현재 구현하지 않아도 되지만, API 설계가 Web 추가를 막아서는 안 된다.

## FR-8: Public Test Access

테스트용 라우트는 인증된 앱 내부 전용이 아니어야 한다.

- Welcome 화면에서 직접 진입 가능해야 한다.
- 로그인하지 않은 상태에서도 route 진입 시 auth redirect에 막히지 않아야 한다.
- 로그인한 상태에서도 동일한 public route로 진입 가능해야 한다.
- 테스트 목적이므로 production 사용자 흐름과 분리된 명시적 entry label을 사용해야 한다.
- public route는 `/native-list-interactions`를 canonical route로 사용한다.
- 구현 파일은 `client/app/native-list-interactions.js`를 기준으로 한다.
- root auth gate는 `native-list-interactions` segment를 allowlist로 예외 처리해야 한다.
- `/(app)` 또는 `/(auth)` 내부 route는 보조 재사용 route로만 허용한다.

## Non-Functional Requirements

- 기존 production 화면에 회귀를 만들지 않아야 한다.
- 테스트 화면은 dev build 기준으로 iOS Simulator / Android Emulator에서 실행 가능해야 한다.
- mock 데이터 기반 reorder는 최소 20개 이하 항목에서 부드럽게 동작해야 한다.
- 이벤트는 화면 내 로그로 확인 가능해야 한다.
- 네이티브 이벤트에서 전달되는 row 식별자는 JS mock state와 안정적으로 매핑 가능해야 한다.

## Success Criteria

이번 스파이크가 성공으로 간주되려면 아래를 만족해야 한다.

1. iOS에서 grouped list + swipe delete + long press / reorder 실험이 동작한다.
2. Android에서 grouped list + trailing `...` + long press reorder가 동작한다.
3. 같은 JS 데이터 모델로 iOS/Android 테스트 화면을 공통 렌더링할 수 있다.
4. 기존 `zeego` 없이도 row-level 핵심 상호작용을 설명 가능한 수준으로 재현한다.

## Open Questions

1. iOS에서 system context menu와 system reorder를 same-touch로 얼마나 자연스럽게 연결할 수 있는가?
2. Android menu 진입점은 `ActionSheet`, `PopupMenu`, `BottomSheet` 중 무엇이 가장 자연스러운가?
3. grouped list appearance를 100% native list에 맡길지, native row + JS section shell 혼합으로 갈지 결정이 필요한가?
4. Web renderer를 나중에 붙일 때 동일한 item schema만 유지하면 충분한가?
