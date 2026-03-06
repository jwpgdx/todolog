# Page Sheet — Requirements

## Goal

플랫폼별(`iOS`/`Android`/`Web`) 최적 구현을 자동 선택하는 재사용 가능한 오버레이 컴포넌트 `PageSheet`를 만든다.
현재 `DetailContainer.*` 에 하드코드된 패턴을 추상화하여, 신규 화면/폼에서 복붙 없이 일관된 오버레이를 띄울 수 있게 한다.

## Scope

- ✅ `PageSheet` 컴포넌트 (3 platform files + index)
- ✅ `PageSheetInput` 컴포넌트 (3 platform files)
- ✅ 키보드/입력/스크롤/a11y 정책 내장
- ❌ 카테고리 화면/폼 변경 (별도 작업)
- ❌ 기존 `DetailContainer.*` → `PageSheet` 마이그레이션 (별도 작업)
- ❌ 기존 `bottom-sheet/*` 컴포넌트 변경/삭제
- ❌ Expo Router 전환 등 대규모 네비게이션 변경

## Hard Constraints

1. 안정성/성능 최우선 (키보드/입력/스크롤)
2. iOS UX가 기준 레퍼런스
3. 플랫폼 매핑 고정:
   - iOS: RN `Modal` + `presentationStyle="pageSheet"`
   - Android: `@gorhom/bottom-sheet` `BottomSheetModal`
   - Web mobile: `vaul` Drawer
   - Web desktop: RN `Modal` (center dialog)
4. Offline-first / SQLite SOT 데이터 아키텍처에 영향 금지

## Functional Requirements

### FR-1: 단일 API로 플랫폼별 최적 오버레이 제공

- `<PageSheet open={bool} onOpenChange={fn}>` 로 호출
- 내부에서 플랫폼 자동 분기 (consumer는 플랫폼 코드를 모름)
- Web은 width > 768 = desktop modal, else = vaul drawer

### FR-2: 닫힘 이벤트 통합

- 모든 닫힘 경로가 `onOpenChange(false)`로 수렴:
  - iOS: swipe dismiss, onDismiss, onRequestClose
  - Android: pan-down, backdrop tap, hardware back
  - Web mobile: drag dismiss, backdrop
  - Web desktop: backdrop click, ESC
- `onOpenChange(false)`는 idempotent (중복 호출 안전)

### FR-3: 키보드/입력 안정성

- iOS: `KeyboardAvoidingView behavior="padding"` 자동 적용
- Android: gorhom 키보드 옵션 내장 (`interactive`, `adjustResize`, `restore`)
- `PageSheetInput` 제공 → 소비자가 플랫폼별 입력 컴포넌트를 신경 쓰지 않음

### FR-4: Web 접근성

- vaul: `Drawer.Title`(sr-only) 항상 렌더
- Desktop modal: `role="dialog"`, `aria-modal="true"`, ESC 닫기
- 닫힘 시 focus restore (trigger 또는 blur)
- `aria-hidden` 콘솔 경고 재발 방지

### FR-5: In-Sheet Navigation (Stack)

- `PageSheet` children으로 Stack Navigator 삽입 가능
- NavigationContainer 안에서 렌더될 때만 지원
- route state ownership은 child Stack에 있고, `PageSheet`는 navigator route tree를 직접 소유/관리하지 않음
- 닫힘/재열림 시 Stack 초기 라우트로 리셋
- Android hardware back: 내부 Stack pop 우선 → 없으면 시트 닫기

### FR-6: Rendering/Mount 최적화

- `open=false` 시 children 렌더 최소화 (플랫폼별 정책 준수)
- 닫았다 다시 열기 = 초기 상태 재시작 (draft 보존은 호출부 책임)

## Non-Functional Requirements

- 기존 Todo 폼 대비 UX 회귀 없음
- 동시에 2개 PageSheet 열리지 않도록 호출부에서 제어 가능
- 콘솔 a11y 경고(aria-hidden/focus) 재발 없음
