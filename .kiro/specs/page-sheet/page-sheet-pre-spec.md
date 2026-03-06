# Pre-Spec (Single Doc): `page-sheet` (Cross-Platform Overlay)

Status: Draft (문서 1개로 먼저 고정 → 이후 `requirements/design/tasks`로 분리 예정)  
Last Updated: 2026-03-06  

## 0) 목적 (왜 이 문서가 필요한가)

현재 프로젝트에는 "오버레이(모달/시트)"가 **두 갈래로 따로** 존재한다.

1) `client/src/components/ui/bottom-sheet/*`
- Web: `vaul` Drawer
- Native(iOS/Android): `@gorhom/bottom-sheet` (일반 BottomSheet)

2) Todo 폼(Detail) 전용 컨테이너: `client/src/features/todo/form/containers/DetailContainer.*`
- iOS: RN `Modal` + `presentationStyle="pageSheet"`
- Android: `BottomSheetModal`
- Web: desktop=RN Modal, mobile=vaul BottomSheet

이 구조는 "작동은 되지만" 다음 문제가 있다:
- 신규 기능(예: 카테고리 추가 폼)에서 **어떤 방식으로 띄워야 하는지 기준이 없음**
- 플랫폼별(특히 iOS/Android/Web) **키보드/스크롤/포커스** 이슈가 재발하기 쉬움
- "페이지 시트" 스타일을 재사용하려면 지금은 Todo 폼 구현을 복붙해야 함

따라서 **`page-sheet`** 라는 이름으로 "플랫폼별로 최적 구현을 자동 선택하는 재사용 컴포넌트"를 정의하고, 이후 화면/폼들은 이를 통해 일관되게 띄우는 것을 목표로 한다.

> 중요: 이 문서는 **카테고리 화면/폼 변경을 다루지 않는다.**  
> 우선 `page-sheet` 자체를 "완벽하게" 만든 뒤, 그 다음에 카테고리/다른 기능에 적용한다.

---

## 1) 하드 제약 (프로젝트 기준)

- 안정성/성능이 최우선 (특히 키보드/입력/스크롤)
- 앱은 iOS 스타일을 많이 따른다 (UX의 기준은 iOS)
- Web은 **desktop=Modal / mobile=vaul**을 유지
- Android는 `@gorhom/bottom-sheet` 기반을 유지 (이미 Provider가 앱 루트에 있음)
- iOS는 RN `Modal presentationStyle="pageSheet"` 를 기준으로 한다
- Offline-first / SQLite SOT 등 데이터 아키텍처는 이 작업과 무관 (영향 금지)

---

## 2) 현재 코드 근거(AS-IS Evidence)

### 2.1 Todo 폼 Detail 오버레이 (사실상 "page-sheet"의 원형)

- iOS: `client/src/features/todo/form/containers/DetailContainer.ios.js`
  - `Modal` + `presentationStyle="pageSheet"`
  - `KeyboardAvoidingView behavior="padding"`
- Android: `client/src/features/todo/form/containers/DetailContainer.android.js`
  - `BottomSheetModal`
  - `keyboardBehavior="interactive"`, `android_keyboardInputMode="adjustResize"` 등
- Web: `client/src/features/todo/form/containers/DetailContainer.web.js`
  - width > 768: RN `Modal` (center)
  - else: `BottomSheet`(=vaul)

### 2.2 기존 BottomSheet 컴포넌트("page-sheet" 아님)

- Branch: `client/src/components/ui/bottom-sheet/core/index.js`
  - `Platform.OS === 'web' ? vaul : gorhom`
- Web: `client/src/components/ui/bottom-sheet/core/bottom-sheet-web.js` (vaul)
- Native: `client/src/components/ui/bottom-sheet/core/bottom-sheet-native.js` (gorhom BottomSheet)

### 2.3 Provider/전역 세팅

- `client/App.js`
  - `<BottomSheetModalProvider>` 존재 (Android `BottomSheetModal` 사용 가능)
  - `<KeyboardProvider>` 존재 (키보드 컨트롤)

---

## 3) TO-BE: `page-sheet`의 정의

`page-sheet`는 "하나의 API"로 호출되지만, 내부 구현은 플랫폼/환경에 따라 달라진다.

| Platform | Target UI | 구현 후보 | 비고 |
|---|---|---|---|
| iOS | Page Sheet | RN `Modal` + `presentationStyle="pageSheet"` | 기준 UX |
| Android | Bottom Sheet (page-sheet 대체) | `@gorhom/bottom-sheet` **`BottomSheetModal`** | `BottomSheetModalProvider` 필요 (App.js 확인). present/dismiss 명령형 API. 일반 `BottomSheet`와 혼동 금지. |
| Web (mobile) | Bottom Sheet | `vaul` Drawer | a11y/focus 이슈 주의 |
| Web (desktop) | Center Modal | RN `Modal` | 기존 Todo 폼과 동일 |

---

## 4) Public API (초안)

목표는 "카테고리/다른 화면에서도 그대로 재사용" 가능한 최소 API다.

### 4.1 1차(필수) Props

- `open: boolean`
- `onOpenChange(nextOpen: boolean): void`
  - 닫힘 이벤트는 `onOpenChange(false)`로 통일
  - iOS/Android/Web의 dismiss/gesture/esc/backdrop 모두 이 경로로 수렴
  - Android: hardware back(시스템 뒤로가기)도 `onOpenChange(false)`로 수렴
  - 호출부는 `onOpenChange(false)`를 **idempotent** 하게 처리해야 한다 (중복 호출되어도 안전)
- `children: ReactNode`

### 4.2 2차(옵션) Props

- `title?: string`
  - Web(vaul/desktop): sr-only title/aria-label 용도. a11y를 위해 가급적 제공 권장.
  - Native(iOS/Android): UI 타이틀이 아니므로 선택.
  - `PageSheet.title`은 Stack 헤더 타이틀이 아니다(§4.3 참고).
- `trigger?: ReactNode`
  - 필요 시에만 (기존 `BottomSheet`와 비슷한 패턴)
- `snapPoints?: Array<string | number>`
  - 사용 플랫폼: Android / Web mobile만. (iOS / Web desktop에서는 무시)
  - 허용 값:
    - `'90%'` 같은 **% 문자열**
    - `0.9` 같은 **0~1 비율 number**
  - 금지: `300` 같은 px number (플랫폼별 의미가 달라 버그 유발)
  - 변환 규칙:
    - Web(vaul): % 문자열 → 0~1 비율 변환 (`'90%'` → `0.9`)
    - Android(gorhom): 0~1 number → % 문자열 변환 (`0.9` → `'90%'`)
  - 기본값(1차): `['90%']`
- `enablePanDownToClose?: boolean` (default true)
  - 의미 보장 범위:
    - Android(gorhom): 지원 (pan-down 닫기 제어)
    - Web mobile(vaul): 지원 (drag/gesture 닫기 제어)
  - iOS pageSheet / Web desktop modal: **no-op** (동등한 매핑 보장 불가)
    - "닫힘 방지(unsaved changes)"는 이 prop에 의존하지 않는다. 호출부에서 `onOpenChange(false)` 시 confirm 등으로 처리.
- `scroll?: 'scrollview' | 'view'` (default 'scrollview')
  - Android에서 `BottomSheetScrollView` / `BottomSheetView` 선택
  - ⚠️ 이 prop은 **Android(gorhom)에서만** 물리적 의미가 있다. iOS/Web에서는 무시된다.
  - ⚠️ `scroll='scrollview'`일 때 children은 ScrollView를 **직접 렌더링하면 안 된다** (이중 스크롤 충돌).
- `contentContainerStyle?`
  - `scroll='scrollview'`일 때: scroll content 컨테이너에 적용
  - `scroll='view'`일 때: root view 스타일로 적용
- `testID?`

> 주의: iOS의 "detents" 같은 고급 pageSheet 옵션은 RN 표준 Modal에서 제어가 제한적이므로 **1차 스코프에서 제외**한다.

### 4.3 In‑Sheet Navigation(Stack) + Header 정책 (중요)

이 문서에서 말하는 "iOS 스타일의 `< 이전 페이지 타이틀`"은 **React Native Modal이 제공하는 게 아니라**,  
**Stack Navigator가 제공하는 Navigation Header 동작**이다.

정책(결정):

1. `PageSheet`는 **컨테이너(Modal/BottomSheet)만** 제공한다.  
   - `PageSheet` 자체는 "네비게이션 헤더"를 내장하지 않는다.
2. "시트 안에서 다음 페이지/이전 페이지"가 필요한 플로우는 **`PageSheet`의 children으로 Stack Navigator를 넣는다.**
3. 헤더는 1차 스코프에서는 **Stack 기본 헤더를 그대로 사용**한다.  
   - 공통화는 "커스텀 헤더 컴포넌트"가 아니라 `screenOptions`로 먼저 맞춘다.
4. iOS의 back 라벨에 "이전 페이지 타이틀"이 자연스럽게 나오려면:
   - 이전 화면의 `options.title`이 비어있지 않아야 하고
   - `headerBackTitleVisible`을 숨기지 않아야 한다.
5. 이 문서의 `PageSheet.title`은 "Stack 헤더 타이틀"이 아니다.  
   - `PageSheet.title`은 **Web(vaul) a11y/sr-only** 용도로 두고,
   - 네비게이션 타이틀은 **각 Stack.Screen의 `options.title`** 로 설정한다.
6. In‑Sheet Stack은 **기존 NavigationContainer 안에서 렌더될 때만** 지원한다.
   - `PageSheet`가 NavigationContainer를 새로 만들지 않는다(1차 스코프).
   - "Global overlay(네비게이션 컨텍스트 밖)" 케이스에서는 In‑Sheet Stack을 사용하지 않는다(기존 패턴 유지).
7. 닫힘/재열림 시 내부 Stack은 **초기 라우트로 리셋**되는 것을 기본으로 한다.
8. Android 하드웨어 back 우선순위(시트가 열려있을 때):
   - (a) 내부 Stack에서 뒤로 갈 수 있으면 pop
   - (b) 아니면 `onOpenChange(false)`로 시트 닫기

구조 예시(개념):

```
PageSheet(open/onOpenChange)
  └─ Stack.Navigator(screenOptions=공통 헤더 스타일)
       ├─ Screen A (title="카테고리")
       └─ Screen B (title="색상 선택")  // iOS back 라벨: "< 카테고리"
```

> 메모: "Global overlay(네비게이션 컨텍스트 밖)"에서 시트를 띄우는 경우(예: 현재 Todo 폼)는  
> Stack을 쓰기 어렵기 때문에 `FormHeader + viewMode` 같은 "커스텀 헤더/상태 전환" 패턴을 유지한다.  
> (이 케이스는 본 `page-sheet` 스코프에서 다루지 않는다.)

### 4.4 Rendering / Mount 정책 (성능 & 버그 방지)

- `open=false`인 동안 children 렌더를 최소화한다. 플랫폼별:
  - iOS: `<Modal visible={false}>` 유지 + children은 `{open && children}`으로 조건부 렌더 권장
  - Android: `BottomSheetModal` 항상 mount + `present()/dismiss()` 제어. children 조건부 렌더 금지 (API 충돌)
  - Web Desktop: `open=false`이면 `return null` (complete unmount)
  - Web Mobile (vaul): `Drawer.Root` 항상 mount, `open` prop 제어
- 닫았다가 다시 열기 = 기본적으로 **초기 상태로 재시작**. draft 유지가 필요하면 호출부에서 state 보존.

---

## 5) File/Module 구조(제안)

기존 `bottom-sheet`는 유지하고, 새로운 "상위 추상화"로 `page-sheet`를 추가한다.  
(기존 bottom-sheet를 page-sheet로 바꾸는 마이그레이션은 범위가 커서 지금은 금지)

### 5.1 제안 경로

- `client/src/components/ui/page-sheet/`
  - `PageSheet.ios.js`
  - `PageSheet.android.js`
  - `PageSheet.web.js` (내부에서 desktop/mobile 분기)
  - `PageSheetInput.android.js` — `BottomSheetTextInput` 기반 (아래 §6)
  - `PageSheetInput.ios.js` — 일반 `TextInput` 기반
  - `PageSheetInput.web.js` — 일반 `TextInput` 기반
  - `index.js`

### 5.2 기존 코드 재사용 원칙

- iOS 구현은 `DetailContainer.ios.js` 패턴을 재사용 (Modal + KeyboardAvoidingView)
- Android 구현은 `DetailContainer.android.js` 패턴을 재사용 (**`BottomSheetModal`**, not 일반 `BottomSheet`)
  - `BottomSheetModalProvider` 의존 (App.js에서 이미 제공 확인)
  - 일반 `BottomSheet`(기존 `bottom-sheet-native.js`)는 inline embed 용도이므로 혼동 금지
- Web 구현은 `DetailContainer.web.js` + `bottom-sheet-web.js(vaul)` 패턴을 재사용

---

## 6) 키보드/입력 정책 (Bug 예방 핵심)

### 6.1 iOS (Modal pageSheet)

- `KeyboardAvoidingView`를 기본 적용한다.
- 폼이 길면 내부는 `ScrollView`가 기본이어야 한다.
- ⚠️ iOS `Modal`에서는 `onRequestClose`와 `onDismiss`가 동일 dismiss에 양쪽 모두 호출될 수 있다.
  `PageSheet.ios`는 내부에서 close guard를 둔다:
  - `onOpenChange(false)` 호출 전 현재 `open` 상태를 체크하여 중복 호출을 방지한다.

### 6.2 Android (gorhom BottomSheetModal)

현행 Todo 폼은 `BottomSheetModal + ScrollView` 패턴으로 동작 중이다.

주의할 리스크:
- 입력 포커스/키보드가 올라올 때 레이아웃이 튀거나, 입력이 가려질 수 있음
- 일부 입력은 `BottomSheetTextInput`이 필요할 수 있음

대응 정책:
- `PageSheet`는 Android에서 기본적으로:
  - `keyboardBehavior="interactive"`
  - `android_keyboardInputMode="adjustResize"`
  - `keyboardBlurBehavior="restore"` (필요 시 조정)
  - `enablePanDownToClose=true`
  - `enableDynamicSizing={false}` (snapPoints 사용 시 필수. gorhom v5+ 기본값 true → 충돌 위험)
  를 적용한다 (Todo 폼과 동일 계열).
- "폼 입력" 안정성을 위해 `PageSheetInput`을 제공한다:
  - Android(`PageSheetInput.android.js`): `BottomSheetTextInput` 기반
  - iOS(`PageSheetInput.ios.js`): 일반 `TextInput` 기반
  - Web(`PageSheetInput.web.js`): 일반 `TextInput` 기반
  - 목적: "바텀시트 내부 입력 컴포넌트 혼동"을 원천 차단. 플랫폼 분기를 소비자가 신경 쓰지 않게 함.

> 참고: 프로젝트에는 이미 `Input`(일반)과 `BottomSheetInput`이 분리되어 있다.  
> (`client/src/components/ui/Input.js`, `client/src/components/ui/bottom-sheet/BottomSheetInput.js`)

### 6.3 Web (vaul)

- 모바일 web: 내부 스크롤 영역을 명확히 분리 (content가 overflow-y를 가져야 함)
- iOS Safari에서 키보드/viewport 높이 변화가 있어 "maxHeight" 제한이 필요할 수 있음 (현행 bottom-sheet-web 패턴 유지)

---

## 7) 접근성/포커스 정책 (Web 경고 재발 방지)

Web에서 `vaul`/Radix 계열은 `aria-hidden` 및 focus restore 과정에서 경고가 날 수 있다.

대표 경고:
- "Blocked aria-hidden … descendant retained focus … Consider using inert …"

정책:
1. `PageSheet.web`(모바일, vaul)는 `title`이 없더라도 `Drawer.Title`(sr-only)를 항상 렌더링한다.
2. 닫힐 때(`onOpenChange(false)` 흐름) **활성 포커스가 시트 내부에 남아있으면 blur/focus 이동**을 수행한다.
   - (구현 단계에서) `document.activeElement?.blur()` 또는 "trigger로 focus restore" 중 택1
3. Desktop modal은 backdrop click close 시, focus가 숨겨진 영역에 남지 않도록 포커스를 이동한다.
4. **Web Desktop Modal** a11y 기본 요건:
   - Content 래퍼에 `role="dialog"`, `aria-modal="true"` 적용
   - ESC 키 닫기: `onKeyDown` 또는 `onRequestClose` 경로
   - 1차 스코프에서 focus trap이 복잡하면, 최소한 open 시 focus-on-first-element + `aria-hidden` 보장

---

## 8) 검증 체크리스트 (Manual)

### 8.1 iOS

- [ ] open/close(버튼, swipe dismiss) 모두 `onOpenChange(false)`로 수렴
- [ ] 입력 포커스 시 키보드가 컨텐츠를 가리지 않음
- [ ] 긴 폼 스크롤/탭 전환 시 버벅임 없음

### 8.2 Android

- [ ] open/close(팬다운 포함) 안정적으로 동작
- [ ] hardware back(시스템 뒤로가기) → (In-Sheet Stack이 있으면 pop) → 아니면 시트 close
- [ ] 입력 포커스 시 키보드 + 시트가 자연스럽게 동작 (튀지 않음)
- [ ] ScrollView/Content 영역이 정상 스크롤되고, 드래그 제스처 충돌 최소

### 8.3 Web (mobile)

- [ ] open/close 시 console a11y 경고(aria-hidden/focus) 재발 없음
- [ ] 스크롤/오버스크롤/바운스가 자연스럽고 컨텐츠가 잘림 없음

### 8.4 Web (desktop)

- [ ] 중앙 Modal 열림/닫힘, backdrop 클릭, ESC(가능 시) 동작
- [ ] Tab/Shift+Tab으로 배경 요소 포커스 불가 (모달 범위 유지)
- [ ] 닫힘 후 포커스가 이상한 곳에 남지 않음

### 8.5 공통(회귀/안전)

- [ ] 동시에 2개 page-sheet가 열리지 않도록 호출부에서 제어 가능
- [ ] `open=false`일 때 §4.4 Rendering/Mount 정책 준수 확인
- [ ] 기존 Todo 폼 동작과 비교해 UX/버그 회귀 없음 (추후 마이그레이션 시)

---

## 9) 작업 계획 (Tasks, 문서 1장 버전)

1. `PageSheet` 컴포넌트 3종(platform files) 설계 확정
2. Web mobile(vaul) focus/a11y 경고 방지 정책 구현
3. Android keyboard/scroll 정책을 Todo 폼 수준으로 안정화
4. `PageSheetInput` 플랫폼 분기 파일 구현 (android/ios/web)
5. 최소 샘플 화면(또는 Story)로 플랫폼별 체크리스트 수행
6. 적용 대상(카테고리 폼 등)로 확장하기 전에 "page-sheet만" 리그레션 확인
