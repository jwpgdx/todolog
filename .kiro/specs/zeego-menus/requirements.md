# Zeego Menus (DropdownMenu/ContextMenu) — Requirements

## Goal

Expo(RN) 앱에서 Zeego 기반 메뉴를 도입할 수 있는지 빠르게 검증한다.
검증을 위해 iOS/Android/Web에서 동작하는 `ZeegoMenuTest` 테스트 페이지를 추가한다.

## Scope

- ✅ Zeego 및 필수 peer dependencies 설치 (client 앱)
- ✅ Expo Router 테스트 라우트 추가: `/test/zeego-menu`
- ✅ 테스트 화면에서 DropdownMenu/ContextMenu 동작 검증:
  - 메뉴 열림/닫힘
  - 아이템 클릭/선택 콜백
  - disabled / destructive 케이스
  - 체크 가능한 아이템(단일 선택 시나리오)
  - 서브메뉴(가능한 경우)
- ✅ 테스트 화면에서 리스트 제스처 조합 POC 검증:
  - row body long press = ContextMenu
  - row swipe = quick action
  - drag handle long press = reorder
- ✅ 테스트 화면에서 플랫폼별 사용법 안내 표시:
  - Web: right click
  - Native: long press (ContextMenu)
- ✅ (선택) DebugScreen에서 테스트 화면으로 이동 버튼 제공

- ❌ 기존 `Dropdown` 컴포넌트 제거/교체
- ❌ 실제 프로덕션 화면 마이그레이션 (`DetailedForm`, `RecurrenceOptions` 등)
- ❌ 디자인 시스템/스타일 가이드 확정(검증 단계에서는 최소 스타일)

## Hard Constraints

1. 기존 앱 동작/화면에 영향 최소화 (테스트 라우트 추가 외 기능 변경 금지)
2. Offline-first / SQLite SOT 아키텍처 영향 금지
3. Expo Go 의존 금지 (Zeego는 네이티브 모듈 포함)
4. Web(react-native-web + Metro)에서도 빌드/런타임 에러 없이 렌더링

## Functional Requirements

### FR-1: 테스트 라우트 제공

- `/test/zeego-menu` 라우트로 진입 가능해야 한다.
- 화면 상단에 현재 플랫폼(`Platform.OS`)을 표시한다.

### FR-2: DropdownMenu 검증

- 트리거 버튼을 눌렀을 때 메뉴가 표시되어야 한다.
- 아래 케이스를 포함한다:
  - 일반 아이템 2개 이상 (각각 onSelect 로그/알림)
  - disabled 아이템 1개
  - destructive 아이템 1개
  - 체크 가능한 아이템 그룹(단일 선택)
  - 서브메뉴(지원되는 경우) 1개

### FR-3: ContextMenu 검증

- Web에서 영역 right click 시 메뉴가 표시되어야 한다.
- Native(iOS/Android)에서 영역 long press 시 메뉴가 표시되어야 한다.
- 아이템 선택 시 onSelect 로그/알림이 동작해야 한다.

### FR-4: Web 스타일/런타임 제약 준수

- 테스트 화면은 Web에서 `StyleSheet.create` 기반 스타일을 Zeego(Radix) 컴포넌트에 직접 전달하지 않는다.
- 필요한 경우 inline style 또는 `className`(nativewind)만 사용한다.

### FR-5: Native Gesture Playground

- Native(iOS/Android)에서 `ZeegoMenuTest` 화면 안에 제스처 playground 섹션을 제공한다.
- Playground는 아래를 동시에 검증해야 한다:
  - 본문 영역 long press 시 ContextMenu가 열린다.
  - 좌/우 swipe 시 action UI가 드러난다.
  - 오른쪽 drag handle long press 후 이동 시 reorder가 가능하다.
- 각 액션 결과는 화면 내 로그로 확인 가능해야 한다.

## Non-Functional Requirements

- iOS Simulator / Android Emulator / Web에서 최소 1회 이상 메뉴 열림/아이템 선택이 가능해야 한다.
- 메뉴 선택 이벤트는 콘솔 로그 또는 화면 내 로그 리스트로 확인 가능해야 한다.
