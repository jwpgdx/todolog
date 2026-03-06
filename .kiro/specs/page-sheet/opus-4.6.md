# [page-sheet-pre-spec.md](file:///Users/admin/Documents/github/todo/.kiro/specs/page-sheet/page-sheet-pre-spec.md) Review

**Reviewer perspective**: Senior React Native / Expo Cross-Platform UI Architecture  
**Date**: 2026-03-06  
**Target**: [page-sheet-pre-spec.md](file:///Users/admin/Documents/github/todo/.kiro/specs/page-sheet/page-sheet-pre-spec.md)

---

## 1) Findings (severity order)

---

### [Critical] F1 — Android double-scroll risk undocumented

**Evidence**:
- [DetailContainer.android.js:55-60](file:///Users/admin/Documents/github/todo/client/src/features/todo/form/containers/DetailContainer.android.js#L55-L60): wraps `children` in `<BottomSheetScrollView>`
- [DetailContent.js:24](file:///Users/admin/Documents/github/todo/client/src/features/todo/form/content/DetailContent.js#L24): `withScrollView = true` (default) → adds *another* `<ScrollView>` inside
- [GlobalFormOverlay.js:77-84](file:///Users/admin/Documents/github/todo/client/src/features/todo/form/GlobalFormOverlay.js#L77-L84): [DetailContent](file:///Users/admin/Documents/github/todo/client/src/features/todo/form/content/DetailContent.js#8-103) is passed into [DetailContainer](file:///Users/admin/Documents/github/todo/client/src/features/todo/form/containers/DetailContainer.web.js#5-73) without `withScrollView={false}`
- Spec §4.2 line 107-108: `scroll?: 'scrollview' | 'view'` — spec says this controls `BottomSheetScrollView` vs `BottomSheetView` on Android

**Risk/Impact**: If `PageSheet` on Android wraps children in `BottomSheetScrollView` (as the spec proposes), and the consumer *also* renders a `ScrollView` (as [DetailContent](file:///Users/admin/Documents/github/todo/client/src/features/todo/form/content/DetailContent.js#8-103) does by default), there will be **nested scrollable containers** → gesture conflicts, unresponsive scroll, and inconsistent bounce behavior. The current Todo form likely has this bug already, and the spec will propagate it to every future consumer.

**Minimal fix — add to §4.2 after `scroll` prop definition (line 108)**:
```markdown
  - ⚠️ `scroll='scrollview'` 는 **PageSheet 자체가 스크롤 래퍼를 제공**한다는 뜻이다.
    이 경우 children은 ScrollView를 **직접 렌더링하면 안 된다** (이중 스크롤 충돌).
    - Android: `BottomSheetScrollView` 사용
    - iOS/Web: PageSheet는 스크롤 래퍼를 추가하지 않으므로 children이 자체 ScrollView를 써야 한다.
  - 즉 `scroll` prop은 **Android(gorhom)에서만** 물리적 의미가 있고,
    iOS/Web에서는 무시된다. 이 비대칭성을 API 문서에 명확히 한다.
```

---

### [Critical] F2 — `BottomSheetModal` vs [BottomSheet](file:///Users/admin/Documents/github/todo/client/src/components/ui/bottom-sheet/core/bottom-sheet-web.js#5-78) 구분이 불명확

**Evidence**:
- [DetailContainer.android.js:4](file:///Users/admin/Documents/github/todo/client/src/features/todo/form/containers/DetailContainer.android.js#L4): `import { BottomSheetModal, …} from '@gorhom/bottom-sheet'`
- [bottom-sheet-native.js:3](file:///Users/admin/Documents/github/todo/client/src/components/ui/bottom-sheet/core/bottom-sheet-native.js#L3): `import BottomSheetLib, { … } from '@gorhom/bottom-sheet'` (= 일반 [BottomSheet](file:///Users/admin/Documents/github/todo/client/src/components/ui/bottom-sheet/core/bottom-sheet-web.js#5-78))
- Spec §2.2 line 61: "Native: [bottom-sheet-native.js](file:///Users/admin/Documents/github/todo/client/src/components/ui/bottom-sheet/core/bottom-sheet-native.js) (gorhom BottomSheet)" — correctly says "일반 BottomSheet"
- Spec §3 table line 78: PageSheet Android 구현은 "`BottomSheetModal`" — Table says "BottomSheetModal"

**Risk/Impact**: `BottomSheetModal`은 `BottomSheetModalProvider`를 필요로 하고 `present()/dismiss()` 명령형 API를 사용한다. 반면 일반 [BottomSheet](file:///Users/admin/Documents/github/todo/client/src/components/ui/bottom-sheet/core/bottom-sheet-web.js#5-78)는 `isOpen` 조건부 렌더링 + [snapToIndex](file:///Users/admin/Documents/github/todo/client/src/components/ui/bottom-sheet/core/bottom-sheet-native.js#32-33) 패턴이다. 두 API는 호환되지 않는다. 문서가 이 둘을 구별 없이 "gorhom" 으로 뭉뚱그렸기 때문에, 구현 시 어떤 쪽을 쓸지 모호하고, 선택에 따라 Provider 의존성·lifecycle·open/close 경로가 완전히 달라진다.

**Minimal fix — §3 table과 §5.2에 명시 (line 78, line 165)**:

§3 table의 Android 행을 교체:
```markdown
| Android | Bottom Sheet (page-sheet 대체) | `@gorhom/bottom-sheet` **`BottomSheetModal`** (Todo 폼 패턴) | `BottomSheetModalProvider` 필요 (App.js 확인됨). present/dismiss 명령형 API. |
```

§5.2에 추가:
```markdown
- Android 구현은 `DetailContainer.android.js` 패턴(`BottomSheetModal`)을 재사용한다.
  - **`BottomSheetModal`** (not 일반 `BottomSheet`)을 사용하는 이유:
    `PageSheet`는 "열고 닫기"에 최적화되었고, `present()/dismiss()` API가 더 적합함.
  - 일반 `BottomSheet`(기존 `bottom-sheet-native.js`)는 inline embed 용도이므로 혼동하지 말 것.
```

---

### [High] F3 — [BottomSheetInput](file:///Users/admin/Documents/github/todo/client/src/components/ui/bottom-sheet/BottomSheetInput.js#5-16)은 Web에서 crash risk

**Evidence**:
- [BottomSheetInput.js:2](file:///Users/admin/Documents/github/todo/client/src/components/ui/bottom-sheet/BottomSheetInput.js#L2): `import { BottomSheetTextInput } from '@gorhom/bottom-sheet'`
- `@gorhom/bottom-sheet` 는 네이티브 전용 라이브러리 (react-native-reanimated / RNGH 의존)
- Spec §6 line 192-195: `PageSheetInput`을 "Android: BottomSheetTextInput / iOS·Web: TextInput"으로 분기 제안

**Risk/Impact**: 문서의 `PageSheetInput` 설계(§6 line 192-195)는 올바르지만, **`PageSheetInput`을 [.js](file:///Users/admin/Documents/github/todo/client/App.js) 단일 파일로 만들면** Web 번들에 `@gorhom/bottom-sheet` import가 포함되어 Web에서 crash한다. 반드시 **platform file split**([.android.js](file:///Users/admin/Documents/github/todo/client/src/features/todo/form/containers/DetailContainer.android.js) / [.ios.js](file:///Users/admin/Documents/github/todo/client/src/features/todo/form/containers/DetailContainer.ios.js) / [.web.js](file:///Users/admin/Documents/github/todo/client/src/features/todo/form/containers/DetailContainer.web.js)) 또는 **dynamic require**가 필요하다.

**Minimal fix — §5.1 line 159의 `PageSheetInput.js` 항목을 교체**:
```markdown
  - `PageSheetInput.android.js` — `BottomSheetTextInput` 기반
  - `PageSheetInput.ios.js` — 일반 `TextInput` 기반
  - `PageSheetInput.web.js` — 일반 `TextInput` 기반
  - (또는) `PageSheetInput.native.js` + `PageSheetInput.web.js` 로 2-split
```

---

### [High] F4 — `open=false` 시 렌더 정책이 플랫폼별로 불일치하며 문서 미비

**Evidence**:
- [DetailContainer.web.js:36](file:///Users/admin/Documents/github/todo/client/src/features/todo/form/containers/DetailContainer.web.js#L36): Desktop일 때 `if (!visible) return null` — **complete unmount**
- [DetailContainer.web.js:20-32](file:///Users/admin/Documents/github/todo/client/src/features/todo/form/containers/DetailContainer.web.js#L20-L32): Mobile(vaul)일 때 [BottomSheet](file:///Users/admin/Documents/github/todo/client/src/components/ui/bottom-sheet/core/bottom-sheet-web.js#5-78)에 `isOpen={visible}` — vaul `Drawer.Root` 항상 mount, `open` prop으로 제어
- [DetailContainer.ios.js:14](file:///Users/admin/Documents/github/todo/client/src/features/todo/form/containers/DetailContainer.ios.js#L14): `<Modal visible={visible}>` — Modal이 항상 mount, `visible`로 제어
- [DetailContainer.android.js:21-27](file:///Users/admin/Documents/github/todo/client/src/features/todo/form/containers/DetailContainer.android.js#L21-L27): `useEffect` + `present()/dismiss()` — **BottomSheetModal은 항상 mount**
- Spec §8.5 line 249: "open=false일 때는 가능하면 렌더 자체를 최소화"

**Risk/Impact**: 문서 §8.5의 "가능하면 최소화"가 모호하다. 실제로 iOS의 `Modal`과 Android의 `BottomSheetModal`은 `open=false`여도 DOM/뷰가 존재한다(각각 native hidden / present/dismiss). PageSheet가 이를 조건부 렌더(`open && <Component>`)로 바꾸면 BottomSheetModal의 `present()` 타이밍 이슈가 발생한다. 반대로 항상 마운트하면 자식 훅/effect가 불필요하게 실행된다.

**Minimal fix — §8.5 line 249 아래에 추가**:
```markdown
  - 렌더 최소화 정책 (플랫폼별):
    - iOS: `<Modal visible={open}>` — Modal 자체는 항상 mount (RN 기본 동작). children은 `open`일 때만 렌더하는 것을 **권장**한다 (예: `{open && children}`).
    - Android: `BottomSheetModal`은 항상 mount하고 `present()/dismiss()`로 제어. children의 조건부 렌더는 gorhom API와 충돌할 수 있으므로 **하지 않는다**.
    - Web Desktop: `open=false`이면 `return null` (complete unmount).
    - Web Mobile (vaul): `Drawer.Root`는 항상 mount, `open` prop으로 제어. children은 내부에서 자동 관리됨.
```

---

### [High] F5 — iOS `onDismiss` vs `onRequestClose` 를 `onOpenChange(false)` 로 수렴 시 이중 호출 위험

**Evidence**:
- [DetailContainer.ios.js:18-19](file:///Users/admin/Documents/github/todo/client/src/features/todo/form/containers/DetailContainer.ios.js#L18-L19): `onRequestClose={onClose}` AND `onDismiss={onClose}` 둘 다 `onClose` 연결
- RN Modal `pageSheet`: swipe-to-dismiss 시 `onDismiss`가 호출됨. `onRequestClose`는 Android 하드웨어 뒤로가기/iOS 쓸기에 호출됨.
- iOS pageSheet 에서 swipe-down dismiss → `onDismiss` 호출 → BUT `onRequestClose`도 호출될 수 있음 (RN 버전에 따라)

**Risk/Impact**: `onOpenChange(false)` 가 한 번의 dismiss에 두 번 호출되면, 상위 state가 flicker하거나 [close()](file:///Users/admin/Documents/github/todo/client/src/components/ui/bottom-sheet/core/bottom-sheet-native.js#35-36) side-effect가 중복 실행될 수 있다. Spec §4.1은 "dismiss/gesture/esc/…모두 이 경로로 수렴"(line 93)이라 했으나, 이중 호출 방어 언급이 없다.

**Minimal fix — §6.1 (line 172-175) 뒤에 추가**:
```markdown
- ⚠️ iOS `Modal`에서는 `onRequestClose`와 `onDismiss`가 동일 dismiss에 **양쪽 모두 호출**될 수 있다.
  `PageSheet.ios`는 내부에서 "이미 닫힌 상태면 무시"하는 guard를 둔다:
  - `onOpenChange(false)` 호출 전 현재 `open` 상태를 체크하여 중복 호출을 막는다.
```

---

### [Medium] F6 — `scroll` prop 시맨틱이 iOS/Web에서 무효한데 API에 설명 부족

**Evidence**:
- [DetailContainer.ios.js](file:///Users/admin/Documents/github/todo/client/src/features/todo/form/containers/DetailContainer.ios.js): Modal 내부에 `BottomSheetScrollView` 같은 것이 없음 — children 자체가 스크롤을 결정
- [bottom-sheet-web.js:66-71](file:///Users/admin/Documents/github/todo/client/src/components/ui/bottom-sheet/core/bottom-sheet-web.js#L66-L71): vaul 내부에 `overflow-y-auto` div가 항상 존재 — `scroll` prop 없이도 스크롤 가능
- Spec §4.2 line 107-108: `scroll` prop은 "Android에서 BottomSheetScrollView / BottomSheetView 선택"이라 함

**Risk/Impact**: 소비자가 `scroll='view'`를 주면 Android에서만 효과가 있고 iOS/Web에서는 무시된다. 소비자가 "스크롤 off"를 기대하면 iOS/Web에서 여전히 스크롤 가능해 혼란이 생긴다.

**Minimal fix — §4.2 line 108 뒤에 추가**:
```markdown
  - ⚠️ iOS/Web에서는 이 prop이 **무시**된다 (스크롤은 children 자체의 ScrollView 유무로 결정).
    이 비대칭은 의도적이며, PageSheet가 모든 플랫폼을 동일하게 추상화하지 않는 점을 소비자가 인지해야 한다.
```

---

### [Medium] F7 — In-Sheet Stack Navigator는 NavigationContainer 밖에서 별도 인스턴스가 필요한데 문서 미언급

**Evidence**:
- [App.js:245-248](file:///Users/admin/Documents/github/todo/client/App.js#L245-L248): `<NavigationContainer>` 안에 [MainStack](file:///Users/admin/Documents/github/todo/client/src/navigation/MainStack.js#16-199) 존재
- [App.js:251](file:///Users/admin/Documents/github/todo/client/App.js#L251): `<GlobalFormOverlay />` 는 `NavigationContainer` **밖**에 위치
- Spec §4.3 line 123: "PageSheet의 children으로 Stack Navigator를 넣는다" — 가능
- Spec §4.3 line 142-144: "Global overlay(네비게이션 컨텍스트 밖)에서는 Stack을 쓰기 어렵다" — 올바르게 예외 명시

**Risk/Impact**: 문서는 "Global overlay case는 스코프 밖"(line 144)이라 했으나, 실질적으로 `PageSheet`의 **첫 번째 소비자**가 Todo 폼([GlobalFormOverlay](file:///Users/admin/Documents/github/todo/client/src/features/todo/form/GlobalFormOverlay.js#13-88))일 가능성이 높다. 만약 `PageSheet`를 `NavigationContainer` 밖에서 사용하고 거기서 Stack Navigator를 넣으면, **별도 `NavigationContainer`가 필수**다. 이 제약이 문서에 없다.

**Minimal fix — §4.3 line 144 뒤에 추가**:
```markdown
  > ⚠️ **`NavigationContainer` 밖에서** `PageSheet` + Stack 조합을 쓰려면,
  > `PageSheet.children` 안에 **별도의 `NavigationContainer`를 포함한 독립 Stack**을 구성해야 한다.
  > (React Navigation은 nested `NavigationContainer`를 공식 지원하나, linking/deeplink가 동작하지 않을 수 있음.)
```

---

### [Medium] F8 — Web Desktop Modal의 a11y/focus 정책 누락

**Evidence**:
- [DetailContainer.web.js:38-70](file:///Users/admin/Documents/github/todo/client/src/features/todo/form/containers/DetailContainer.web.js#L38-L70): Desktop Modal은 RN `<Modal>` + `<Pressable>` backdrop으로 구현. `aria-*`, `role`, focus trap 등 a11y 속성 없음.
- Spec §7 line 215-218: vaul(mobile) 관련 정책만 기술. Desktop Modal에 대한 a11y는 "동일한 정책을 적용한다"(line 218)고만 한 줄.

**Risk/Impact**: RN `<Modal>` on Web은 `dialog` role / `aria-modal` / focus trap을 자동 제공하지 않는다 (RNW는 Portal 기반). Desktop Modal의 a11y 미비는 접근성 감사에서 실패하고, keyboard-only 사용자가 backdrop 뒤의 요소와 상호작용 가능.

**Minimal fix — §7 line 218 아래에 추가**:
```markdown
4. **Web Desktop Modal** (RN Modal on Web)은 다음을 구현해야 한다:
   - `role="dialog"`, `aria-modal="true"` 를 content 래퍼에 적용
   - ESC 키로 닫기: `onKeyDown` 또는 `onRequestClose` 경로
   - Focus trap: 시트 열릴 때 첫 focusable element로 이동, Tab cycle 제한
   - (1차에서 focus trap이 복잡하다면) 최소한 backdrop의 `aria-hidden` 처리를 명시
```

---

### [Low] F9 — `snapPoints` 변환 규칙이 문서에 설명된 것과 코드에 다른 부분

**Evidence**:
- Spec §4.2 line 104-105: "Web(vaul): 내부에서 0~1 비율로 변환"
- [bottom-sheet-web.js:18-23](file:///Users/admin/Documents/github/todo/client/src/components/ui/bottom-sheet/core/bottom-sheet-web.js#L18-L23): `parseInt(sp) / 100` 변환이 이미 구현됨

**Risk/Impact**: 문서와 코드가 일치한다. 그러나 `snapPoints`에 **절대 픽셀 값**(number)이 들어올 때의 처리가 코드에서도 문서에서도 미정의. vaul은 0~1 비율만 지원하므로, 픽셀 값이 들어오면 오동작한다.

**Minimal fix — §4.2 line 105 뒤에 추가**:
```markdown
  - ⚠️ 절대 픽셀 값(숫자)은 Web(vaul)에서 지원되지 않는다. `snapPoints`에는 `'90%'` 같은 퍼센트 문자열만 사용한다.
```

---

### [Low] F10 — `enableDynamicSizing={false}` 가 Android 기본 설정인데 문서에 없음

**Evidence**:
- [DetailContainer.android.js:47](file:///Users/admin/Documents/github/todo/client/src/features/todo/form/containers/DetailContainer.android.js#L47): `enableDynamicSizing={false}`
- [bottom-sheet-native.js:79](file:///Users/admin/Documents/github/todo/client/src/components/ui/bottom-sheet/core/bottom-sheet-native.js#L79): 동일
- Spec §6.2 line 186-191: keyboard 관련 props만 나열, `enableDynamicSizing` 언급 없음

**Risk/Impact**: gorhom v5+에서 `enableDynamicSizing`이 기본 `true`로 바뀌었으며, `snapPoints`와 동시 사용 시 충돌. PageSheet 구현에서 빠뜨리면 시트 높이가 의도대로 작동하지 않음.

**Minimal fix — §6.2 line 191의 prop 목록에 추가**:
```markdown
  - `enableDynamicSizing={false}` (snapPoints와 충돌 방지, gorhom v5+ 기본값이 true이므로 명시 필수)
```

---

## 2) Open Questions (must-decide only)

| # | Question | Why it matters |
|---|---|---|
| **Q1** | Todo 폼([GlobalFormOverlay](file:///Users/admin/Documents/github/todo/client/src/features/todo/form/GlobalFormOverlay.js#13-88))은 PageSheet의 "마이그레이션 대상"인가, "영구 예외"인가? | 마이그레이션 대상이면 NavigationContainer 밖 + Stack 이슈(F7)를 PageSheet가 해결해야 하고, 예외라면 스코프에서 명확히 제외해야 한다. 현재 §4.3 line 144 "스코프에서 다루지 않는다"지만, §9 Task 6 "적용 대상(카테고리 폼 등)으로 확장" 에 Todo 폼이 포함되는지 불분명. |
| **Q2** | Android에서 `BottomSheetModal`과 일반 [BottomSheet](file:///Users/admin/Documents/github/todo/client/src/components/ui/bottom-sheet/core/bottom-sheet-web.js#5-78) 중 어느 것을 PageSheet 기반으로 확정하는가? | F2에서 설명. 두 API는 lifecycle, Provider 의존성, open/close 패턴이 완전히 다르다. |
| **Q3** | `scroll` prop의 비대칭(Android only) 대신, PageSheet가 **모든 플랫폼에서 스크롤 래퍼를 제공하지 않고** children에게 스크롤 책임을 넘기는 방향도 검토하는가? | F1의 이중 스크롤 문제의 근본 해결. 현재 Android만 래퍼 제공 → 소비자 혼란. |
| **Q4** | `PageSheetInput`은 1차 스코프인가, 선택적인가? 1차라면 기존 [BottomSheetInput](file:///Users/admin/Documents/github/todo/client/src/components/ui/bottom-sheet/BottomSheetInput.js#5-16) 사용처 마이그레이션도 포함하는가? | §9 Task 4에 "(선택)"으로 되어 있지만, F3처럼 안전 문제가 있어서 판단 필요. |

---

## 3) Patch Proposal

아래는 [page-sheet-pre-spec.md](file:///Users/admin/Documents/github/todo/.kiro/specs/page-sheet/page-sheet-pre-spec.md) 에 대한 복붙 가능한 수정안이다.  
**추가(+)** / **교체(→)** / **삭제(-)** 로 표시.

---

### Patch A: §3 table — Android 구현 행 교체 (F2)

**교체** line 78:

```diff
-| Android | Bottom Sheet (page-sheet 대체) | `@gorhom/bottom-sheet` `BottomSheetModal` | 키보드/스크롤 최적화 필요 |
+| Android | Bottom Sheet (page-sheet 대체) | `@gorhom/bottom-sheet` **`BottomSheetModal`** | `BottomSheetModalProvider` 필요 (App.js 확인). present/dismiss 명령형 API. 일반 `BottomSheet`(bottom-sheet-native.js 패턴)과 혼동 금지. |
```

### Patch B: §4.2 `scroll` prop — 비대칭 경고 추가 (F1, F6)

**추가** line 108 뒤:

```markdown
  - ⚠️ `scroll='scrollview'` 는 **Android에서만** PageSheet가 `BottomSheetScrollView`로 children을 감싼다는 뜻이다.
    이 경우 children은 ScrollView를 **직접 렌더링하면 안 된다** (이중 스크롤 충돌).
  - iOS/Web에서는 이 prop이 **무시**된다 (스크롤은 children의 ScrollView 유무로 결정).
  - ⚠️ 절대 픽셀 값(숫자)은 `snapPoints`에서 Web(vaul)에서 지원되지 않는다. `'90%'` 같은 퍼센트 문자열만 사용한다.
```

### Patch C: §4.3 — NavigationContainer 밖 제약 추가 (F7)

**추가** line 144 뒤:

```markdown
  > ⚠️ **`NavigationContainer` 밖에서** `PageSheet` + Stack 조합을 쓰려면,
  > `PageSheet.children` 안에 **별도 `NavigationContainer`를 포함한 독립 Stack**을 구성해야 한다.
  > React Navigation은 nested `NavigationContainer`를 지원하나, linking/deeplink가 해당 Stack에서 동작하지 않는 제약이 있다.
```

### Patch D: §5.1 `PageSheetInput` — platform file split (F3)

**교체** line 159:

```diff
-  - `PageSheetInput.js` (선택, 아래 §6)
+  - `PageSheetInput.android.js` — `BottomSheetTextInput` 기반 (선택, 아래 §6)
+  - `PageSheetInput.ios.js` — 일반 `TextInput` 기반
+  - `PageSheetInput.web.js` — 일반 `TextInput` 기반
```

### Patch E: §5.2 — BottomSheetModal 명시 (F2)

**교체 및 추가** line 165:

```diff
-- Android 구현은 `DetailContainer.android.js` 패턴을 재사용 (BottomSheetModal)
+- Android 구현은 `DetailContainer.android.js` 패턴을 재사용 (**`BottomSheetModal`**, not 일반 `BottomSheet`)
+  - `BottomSheetModalProvider` 의존 (App.js에서 이미 제공 확인)
+  - 일반 `BottomSheet`(기존 `bottom-sheet-native.js`)는 inline embed 용도이므로 혼동 금지
```

### Patch F: §6.1 — iOS 이중 호출 guard (F5)

**추가** line 175 뒤:

```markdown
- ⚠️ iOS `Modal`에서는 `onRequestClose`와 `onDismiss`가 동일 dismiss에 **양쪽 모두 호출**될 수 있다 (RN 버전 의존).
  `PageSheet.ios`는 내부에서 close guard를 둔다:
  - `onOpenChange(false)` 호출 전 현재 `open` 상태를 체크하여 중복 호출을 방지한다.
```

### Patch G: §6.2 — enableDynamicSizing 누락 보완 (F10)

**추가** line 191 (prop 목록 끝)에:

```markdown
  - `enableDynamicSizing={false}` (snapPoints 사용 시 필수. gorhom v5+ 기본값 true → 충돌 위험)
```

### Patch H: §7 — Desktop Modal a11y 정책 (F8)

**교체** line 218:

```diff
-3. Desktop modal은 backdrop click close 시, focus가 숨겨진 영역에 남지 않도록 동일한 정책을 적용한다.
+3. Desktop modal은 backdrop click close 시, focus가 숨겨진 영역에 남지 않도록 포커스를 이동한다.
+4. **Web Desktop Modal** (RN Modal on Web) a11y 기본 요건:
+   - Content 래퍼에 `role="dialog"`, `aria-modal="true"` 적용
+   - ESC 키 닫기: `onKeyDown` capture 또는 `onRequestClose` 경로 활용
+   - 1차 스코프에서 focus trap이 복잡하면, 최소한 `aria-hidden` + focus-on-open만 보장
```

### Patch I: §8.5 — 렌더 최소화 정책 구체화 (F4)

**교체** line 249:

```diff
-- [ ] `open=false`일 때는 가능하면 "렌더 자체를 최소화" (성능)
+- [ ] `open=false`일 때 렌더 최소화 (플랫폼별 정책):
+  - iOS: `<Modal visible={false}>` 유지 + children을 `{open && children}`으로 조건부 렌더 **권장**
+  - Android: `BottomSheetModal` 항상 mount + `present()/dismiss()` 제어. children 조건부 렌더 **금지** (API 충돌)
+  - Web Desktop: `open=false`이면 `return null` (complete unmount)
+  - Web Mobile (vaul): `Drawer.Root` 항상 mount, `open` prop 제어. children은 vaul이 자동 관리.
```

---

## 4) Final Verdict

> **Conditionally ready**

문서의 방향과 구조는 건전하며, 현재 코드베이스와의 정합성도 대부분 맞다.  
그러나 위의 **Critical 2건**(F1 이중 스크롤, F2 BottomSheetModal/BottomSheet 구분)과 **High 3건**(F3 Input platform split, F4 렌더 정책, F5 iOS 이중 호출)이 해결되지 않으면 구현 시 확실하게 버그가 재발한다.

**조건**: 위 Patch A~I가 반영되고, Open Questions Q2("BottomSheetModal vs BottomSheet 확정")와 Q3("scroll prop 비대칭 유지 여부")에 대한 결정이 내려지면 **구현 착수 가능**.
