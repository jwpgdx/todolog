# Zeego Menus (DropdownMenu/ContextMenu) — Design

## Background / Decision

Zeego는 iOS/Android에서 네이티브 메뉴를 사용하고 Web에서는 Radix 기반 컴포넌트를 렌더링한다.
이 스펙의 목표는 "도입 가능 여부"를 빠르게 검증하는 것이며, 실제 화면 마이그레이션은 다음 단계로 미룬다.

## Files / Structure

- Spec
  - `.kiro/specs/zeego-menus/requirements.md`
  - `.kiro/specs/zeego-menus/design.md`
  - `.kiro/specs/zeego-menus/tasks.md`
- Client app
  - `client/src/test/ZeegoMenuTestScreen.js`
  - `client/app/(app)/test/zeego-menu.js`
  - (선택) `client/src/screens/DebugScreen.js`에 진입 버튼 추가

## Dependency Plan (Expo SDK 54 / RN 0.81)

- `client` 패키지에 Zeego 및 필수 peer dependencies를 추가한다.
- npm 환경이므로 Zeego 문서 권장대로 필요 시 `--legacy-peer-deps`를 사용한다.
- 설치 후 iOS/Android는 `expo run:*`로 dev client 재빌드가 필요하다.

버전 호환성은 실제 설치/빌드로 검증한다.
특히 RN 0.81(Expo 54)에서 `react-native-ios-context-menu`가 상위 버전을 요구할 수 있으므로,
빌드 실패 시 peer dependency 버전을 상향 조정하는 것을 허용한다(단, 테스트 화면 외 코드 변경은 금지).

## UI Design: Test Screen

### Layout

- 상단: 타이틀 + 뒤로가기 버튼
- 안내 영역:
  - 현재 플랫폼 표시
  - ContextMenu 사용법 (Web right click / Native long press)
- 섹션 1: DropdownMenu
  - Trigger 버튼 1개
  - Content 내부에 샘플 아이템(일반/disabled/destructive/체크/서브메뉴)
- 섹션 2: ContextMenu
  - Trigger 영역(카드 형태)
  - Content 내부에 샘플 아이템
- 섹션 3: Gesture Playground
  - Native 전용 실험 영역
  - `ReanimatedSwipeable` + `ContextMenu` + `DraggableFlatList` 조합 검증
  - row body와 drag handle의 hit area를 분리하여 제스처 충돌을 줄임
- 하단: "이벤트 로그" 리스트

### Styling

- 테스트 목적이므로 플랫폼 간 픽셀 퍼펙트 스타일은 목표가 아니다.
- 단, Web에서 Radix 기반 컴포넌트를 사용하므로:
  - Zeego 컴포넌트에 `StyleSheet.create` 객체를 style로 전달하지 않는다.
  - inline style 또는 `className`만 사용한다.

### Event Logging

- 메뉴 선택 시 `addLog("...")` 형태로 화면 로그에 기록한다.
- Native에서는 필요 시 `Alert.alert`로도 확인 가능하게 한다.

## Future Migration Notes (Out of Scope)

향후 실제 화면에 적용할 때는 아래 기준을 사용한다.

- 액션 메뉴/컨텍스트 메뉴: Zeego 우선
- 커스텀 렌더링(검색/가상화/복잡한 row): 기존 `Dropdown` 유지 또는 별도 컴포넌트
- 본문 long press와 reorder를 같은 hit area에서 동시에 처리하는 것은 2차 검토 범위로 남긴다.
- 1차 구현은 "body = menu / handle = reorder" 구조를 우선 검증한다.
