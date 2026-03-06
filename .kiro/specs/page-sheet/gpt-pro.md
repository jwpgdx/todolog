1. Findings (severity order)

* [Critical] “AS‑IS Evidence”가 파일 경로 나열 수준이라, spec-코드 불일치(회귀) 방어력이 부족함

  * Evidence: (문서 §2 “현재 코드 근거(AS-IS Evidence)”) “`DetailContainer.*` … iOS: `Modal` + `presentationStyle="pageSheet"`” 
  * Risk/Impact: 이 문서가 **“현재 잘 되는 동작”을 기준선으로 삼는다**고 해놓고, 실제로는 “어디를 보라”만 적혀있어서 구현자가 확인을 누락하면 **기존 Todo 폼 대비 키보드/스크롤/포커스 회귀**가 그대로 터질 수 있음. (스펙이 아니라 ‘전설의 README’가 되어버림)
  * Minimal fix (문서 추가 블록):

    ```md
    ### 2.4 AS-IS Snapshot (필수: 구현 전/후 갱신)

    이 문서의 §2는 “현재 잘 동작하는 기준선”이다. 아래 항목은 실제 코드에서 확인 후 **값을 그대로** 적어 둔다.
    (목적: spec-코드 불일치로 인한 회귀 방지)

    - DetailContainer.ios.js
      - Modal: 사용 prop 목록(예: presentationStyle, animationType, onDismiss/onRequestClose 등)
      - KeyboardAvoidingView: behavior, keyboardVerticalOffset 사용 여부
    - DetailContainer.android.js
      - BottomSheetModal: snapPoints 기본값, keyboardBehavior, android_keyboardInputMode, keyboardBlurBehavior 등
      - 닫힘 이벤트 소스(팬다운/백드롭/하드웨어 back)와 onOpenChange(false) 수렴 여부
    - DetailContainer.web.js
      - breakpoint 기준(예: 768)과 desktop/mobile 분기 방식
    - bottom-sheet-web.js / bottom-sheet-native.js
      - scroll wrapper/portal/open=false 렌더 정책(마운트 유지 여부)

    ※ 위 값이 바뀌면 PageSheet도 동일하게 따라가야 한다.
    ```

* [Critical] `enablePanDownToClose`의 플랫폼별 의미/제한이 문서에 정의되지 않아 “닫힘 방지” 기대가 깨질 수 있음

  * Evidence: (문서 §4.2) “`enablePanDownToClose?: boolean` (default true)”
  * Risk/Impact: 호출부가 `enablePanDownToClose={false}`로 **“실수로 닫힘 방지/데이터 유실 방지”**를 기대할 수 있는데, iOS(pageSheet Modal) / Web desktop(Modal)에서 동일하게 보장할지 문서가 침묵함 → 구현/호출부 기대가 갈라지면 **예상치 못한 dismiss + 폼 상태 유실**로 직행함.
  * Minimal fix (문서 교체 블록):

    ```md
    - `enablePanDownToClose?: boolean` (default true)
      - 의미 보장 범위(1차):
        - Android(gorhom): 지원 (pan-down 닫기 제어)
        - Web mobile(vaul): 지원 (drag/gesture 닫기 제어)
      - iOS pageSheet / Web desktop modal: 1차 스코프에서는 **동등한 매핑을 보장하지 않는다(no-op로 간주)**.
        - 따라서 “닫힘 방지(unsaved changes)”는 이 prop에 의존하지 않는다. (닫힘 시도에 대한 저장/confirm 정책은 호출부/플로우에서 처리)
    ```

* [High] Web a11y: `title`을 optional로 두면서 “없어도 Drawer.Title 렌더”라고 써서 스펙 내부가 자기모순

  * Evidence: (문서 §4.2) “`title?: string`” + (문서 §7 정책 1) “`title`이 없더라도 `Drawer.Title`… 항상 렌더링”
  * Risk/Impact: “sr-only title을 항상 렌더링”이 목표면 **title이 비어있을 때 무엇을 읽게 할지**가 결정돼야 함. 지금 상태로 구현되면 (1) 스크린리더가 제목 없는 dialog를 만날 수 있고 (2) 닫힘 시 포커스 경고 재발 방지 정책이 호출부(트리거 유무)에 따라 흔들림. 즉, 콘솔 경고 잡으려다 a11y가 더 망가질 수 있음.
  * Minimal fix (문서 교체 블록):

    ```md
    - `title?: string`
      - Web(vaul / desktop)에서는 **필수(빈 문자열 금지)**. sr-only title/aria-label 용도.
      - Native(iOS/Android)에서는 UI 타이틀이 아니므로 선택.
      - `PageSheet.title`은 Stack 헤더 타이틀이 아니다(§4.3 참고).
    ```

* [High] `snapPoints`가 `string | number`로 너무 넓고, Web 변환 규칙이 “0~1 변환” 수준이라 실제 구현에서 해석이 갈릴 여지가 큼

  * Evidence: (문서 §4.2) “`snapPoints?: Array<string | number>` … Web(vaul): 내부에서 0~1 비율로 변환”
  * Risk/Impact: 숫자 snapPoint가 **px인지 비율인지** 플랫폼별로 의미가 달라질 수 있고, 변환 규칙이 느슨하면 Android/Web에서 **높이/스크롤/키보드 겹침**이 엇갈림. (이런 건 한번 터지면 “기기별로 다름” 지옥 시작임)
  * Minimal fix (문서 교체 블록):

    ```md
    - `snapPoints?: Array<string | number>`
      - 사용 플랫폼: Android / Web mobile만. (iOS / Web desktop에서는 무시)
      - 허용 값(교차 플랫폼 의미를 고정):
        - `'90%'`처럼 **% 문자열**
        - `0.9`처럼 **0~1 비율(number)**
      - 금지: `300` 같은 px number (플랫폼별 의미가 달라 버그 유발)
      - 변환 규칙:
        - Web(vaul): % 문자열 → 0~1 비율로 변환 (예: `'90%'` → `0.9`)
        - Android(gorhom): 0~1 비율 number → % 문자열로 변환 (예: `0.9` → `'90%'`)
      - 기본값(1차): `['90%']` (현재 Todo 폼 계열과 동일)
    ```

* [High] In‑Sheet Navigation이 “Stack 넣으면 됨”까지만 있고, **지원 조건(네비게이션 컨텍스트) / 닫힘 후 상태 리셋 / back 우선순위**가 빠져있음

  * Evidence: (문서 §4.3 정책 2) “children으로 Stack Navigator를 넣는다.”
  * Risk/Impact:

    * PageSheet가 “Global overlay(네비게이션 컨텍스트 밖)”에서도 쓰일 수 있는데, 그 경우 Stack을 넣으면 **컨텍스트/구조에 따라 런타임 에러 또는 비정상 동작** 가능.
    * 닫았다가 다시 열었는데 내부 stack이 이전 화면(B)에서 그대로 시작하면 UX가 깨지고, 상태 꼬임이 곧 버그로 이어짐.
  * Minimal fix (문서 추가 블록):

    ```md
    6. In‑Sheet Stack은 **기존 NavigationContainer 안에서 렌더될 때만** 지원한다.
       - `PageSheet`가 NavigationContainer를 새로 만들지 않는다(1차 스코프).
       - “Global overlay(네비게이션 컨텍스트 밖)” 케이스에서는 In‑Sheet Stack을 사용하지 않는다(기존 패턴 유지).
    7. 닫힘/재열림 시 내부 Stack은 **초기 라우트로 리셋**되는 것을 기본으로 한다. (성능/예측가능성 우선, §4.4 참조)
    8. Android 하드웨어 back 우선순위(시트가 열려있을 때):
       - (a) 내부 Stack에서 뒤로 갈 수 있으면 pop
       - (b) 아니면 `onOpenChange(false)`로 시트 닫기
    ```

* [High] Android의 “하드웨어 back”이 닫힘 수렴 대상에서 빠져 있고, Manual checklist에도 없다

  * Evidence: (문서 §4.1) “dismiss/gesture/esc/backdrop 모두 이 경로로 수렴” (Android hardware back 언급 없음)
  * Risk/Impact: Android에서 시트가 열린 상태로 back을 누르면 **시트가 아니라 화면 네비게이션이 먼저 먹힐 수 있음** → open 상태와 UI가 분리되거나, 사용자 입장에서는 “왜 뒤로가기가 앱을 꺼/화면을 바꿔”가 됨.
  * Minimal fix (문서 추가 문장 + 체크리스트 추가):

    ```md
    - Android: hardware back(시스템 뒤로가기)도 닫힘 이벤트로 간주하며 `onOpenChange(false)`로 수렴해야 한다.
    ```

    ```md
    ### 8.2 Android
    - [ ] hardware back(시스템 뒤로가기) → (가능하면 내부 Stack pop) → 아니면 시트 close로 수렴
    ```

* [High] 입력 컴포넌트 정책이 “선택적으로 PageSheetInput”이라서, 이미 존재하는 `Input`/`BottomSheetInput`과 함께 **혼동 3배 세트**가 됨

  * Evidence: (문서 §6.2) “선택적으로 `PageSheetInput`을 제공한다” + (문서 §6.2 참고) “이미 `Input`… `BottomSheetInput` 분리”
  * Risk/Impact: Android BottomSheetModal 내부에서 잘못된 입력을 쓰면 키보드/포커스/레이아웃이 바로 삐끗할 확률이 높음. “선택적으로”로 남겨두면 팀원이 실수할 여지가 커서, 결국 **버그 재발 방지**라는 문서 목적에 정면 역행.
  * Minimal fix (문서 교체 블록):

    ```md
    - “폼 입력” 안정성(특히 Android)을 위해 **입력 컴포넌트 규칙을 강제**한다:
      - Android PageSheet 내부 TextInput은 **반드시** `BottomSheetInput`(기존 컴포넌트)을 사용한다.
      - iOS/Web은 `Input`(기존 컴포넌트)을 사용한다.
      - 목적: “바텀시트 내부 입력 컴포넌트 혼동”을 원천 차단
    ```

* [Medium] `scroll`/`contentContainerStyle`의 의미가 Android 중심으로만 적혀 있어, iOS/Web에서 중첩 스크롤/제스처 충돌 리스크를 문서가 못 막음

  * Evidence: (문서 §4.2) “`scroll?: 'scrollview' | 'view'` … Android에서 `BottomSheetScrollView` / `BottomSheetView` 선택” + “`contentContainerStyle?`” (의미 정의 없음)
  * Risk/Impact: 호출부가 이미 ScrollView/리스트를 갖고 있는데 PageSheet가 또 ScrollView를 감싸면 **중첩 스크롤, 키보드 가림, 드래그 제스처 충돌**이 쉽게 생김. `contentContainerStyle`도 어디에 적용되는지 불명확해서 레이아웃이 플랫폼마다 달라질 수 있음.
  * Minimal fix (문서 교체/추가 블록):

    ```md
    - `scroll?: 'scrollview' | 'view'` (default 'scrollview')
      - 의미(공통):
        - `'scrollview'`: PageSheet가 “platform-appropriate scroll container”를 제공한다.
        - `'view'`: PageSheet는 스크롤 컨테이너를 제공하지 않는다(호출부가 직접 ScrollView/리스트를 둔다).
      - Android: `BottomSheetScrollView` / `BottomSheetView` 선택에 직접 매핑된다.
      - iOS/Web: `'scrollview'`일 때 기본 스크롤 컨테이너를 제공하되, **중첩 스크롤을 피해야 한다**.
    - `contentContainerStyle?`
      - `scroll='scrollview'`일 때: scroll content 컨테이너에 적용
      - `scroll='view'`일 때: root view 스타일로 적용
    ```

* [Medium] Web desktop(RN Modal center)의 a11y/focus 범위가 “닫힘 후 포커스 이상한 곳 X”만 있어서, **열려있는 동안의 포커스 제한(탭 이동)**이 빠져있음

  * Evidence: (문서 §3 표) “Web (desktop) … RN `Modal`” + (문서 §7 정책 3) “backdrop click close 시… 동일 정책”
  * Risk/Impact: desktop에서 모달이 열려도 탭 이동으로 배경 UI가 포커스될 수 있으면 a11y가 깨지고 UX도 이상해짐. (모달인데 배경 버튼이 눌리는 느낌)
  * Minimal fix (문서 체크리스트 보강):

    ```md
    ### 8.4 Web (desktop)
    - [ ] Tab/Shift+Tab으로 배경 요소에 포커스가 이동하지 않음(모달 포커스 범위 유지)
    - [ ] 닫힘 후 포커스가 trigger(또는 합리적인 위치)로 복귀
    ```

* [Low] “page-sheet vs 기존 bottom-sheet” 선택 기준이 문서 목적(‘기준 없음’)을 완전히 해결할 정도로 명시되어 있지 않음

  * Evidence: (문서 §0) “어떤 방식으로 띄워야 하는지 기준이 없음”
  * Risk/Impact: 이름만 생기고 기준이 흐리면, 결국 또 “아무나 아무거나 띄움” 상태로 회귀함.
  * Minimal fix (문서 추가 블록):

    ```md
    **사용 기준(1차):**
    - 폼/상세/설정처럼 “화면 단위” 컨텐츠 = `PageSheet`
    - 짧은 액션/필터/선택처럼 “부분 UI” = 기존 `bottom-sheet` 유지
    ```

2. Open Questions (must-decide only, 최대 5개)

1) `enablePanDownToClose={false}`가 필요한 “unsaved changes” 플로우가 실제로 존재하나? 존재한다면 iOS(pageSheet)에서 **동등한 ‘닫힘 방지’가 불가/불명확**할 때 UX 정책(자동 저장 vs 닫힘 confirm vs 닫힘 후 복원)을 무엇으로 고정할 건가?
2) `trigger` prop을 v1에서 유지할 건가, 아니면 **controlled-only 단순 API**를 위해 제거/비권장으로 둘 건가? (web focus restore까지 엮여있어서 결정을 안 하면 문서가 계속 흔들림)
3) In‑Sheet Stack 사용 시, “닫힘 → 재열림”에서 내부 네비게이션 상태를 **항상 초기화**(권장)할지, **마지막 화면 유지**를 허용할지? (성능/예측가능성 vs 연속성)
4) `snapPoints` 기본값을 문서처럼 `['90%']`로 고정할지, 아니면 특정 플로우에서만 명시하도록(=기본값 없음) 할지?
5) Web desktop의 “포커스 범위 유지(탭 이동 제한)”을 **필수 요구사항**으로 둘 건가, 아니면 현행 Modal 한계로 인해 “닫힘 후 복귀만 보장”으로 타협할 건가?

3. Patch Proposal

```diff
--- a/.kiro/specs/page-sheet/page-sheet-pre-spec.md
+++ b/.kiro/specs/page-sheet/page-sheet-pre-spec.md
@@
 ## 2) 현재 코드 근거(AS-IS Evidence)
@@
 ### 2.3 Provider/전역 세팅
@@
   - `<KeyboardProvider>` 존재 (키보드 컨트롤)
+
+### 2.4 AS-IS Snapshot (필수: 구현 전/후 갱신)
+
+이 문서의 §2는 “현재 잘 동작하는 기준선”이다. 아래 항목은 실제 코드에서 확인 후 **값을 그대로** 적어 둔다.
+(목적: spec-코드 불일치로 인한 회귀 방지)
+
+- DetailContainer.ios.js
+  - Modal: 사용 prop 목록(예: presentationStyle, animationType, onDismiss/onRequestClose 등)
+  - KeyboardAvoidingView: behavior, keyboardVerticalOffset 사용 여부
+- DetailContainer.android.js
+  - BottomSheetModal: snapPoints 기본값, keyboardBehavior, android_keyboardInputMode, keyboardBlurBehavior 등
+  - 닫힘 이벤트 소스(팬다운/백드롭/하드웨어 back)와 onOpenChange(false) 수렴 여부
+- DetailContainer.web.js
+  - breakpoint 기준(예: 768)과 desktop/mobile 분기 방식
+- bottom-sheet-web.js / bottom-sheet-native.js
+  - scroll wrapper/portal/open=false 렌더 정책(마운트 유지 여부)
+
+※ 위 값이 바뀌면 PageSheet도 동일하게 따라가야 한다.
@@
 ## 3) TO-BE: `page-sheet`의 정의
@@
 | Web (desktop) | Center Modal | RN `Modal` | 기존 Todo 폼과 동일 |
+
+**사용 기준(1차):**
+- 폼/상세/설정처럼 “화면 단위” 컨텐츠 = `PageSheet`
+- 짧은 액션/필터/선택처럼 “부분 UI” = 기존 `bottom-sheet` 유지
@@
 ## 4) Public API (초안)
@@
 목표는 “카테고리/다른 화면에서도 그대로 재사용” 가능한 최소 API다.
+
+### 4.0 공통 규칙 (중요)
+
+- `PageSheet`는 **Controlled-only** 컴포넌트다. `open`이 단일 소스 오브 트루스다.
+- `onOpenChange`는 “사용자 액션으로 인한 open 상태 변경 요청”을 알린다.
+  - 호출부는 `onOpenChange(false)`를 **idempotent** 하게 처리해야 한다(중복 호출되어도 안전).
+- 일부 prop은 플랫폼에 따라 **no-op** 일 수 있다(아래 각 prop에 명시).
@@
 ### 4.2 2차(옵션) Props
@@
-- `title?: string`
-  - Web(vaul) a11y를 위해 “sr-only title”을 항상 제공할 수 있게 함
+- `title?: string`
+  - Web(vaul / desktop)에서는 **필수(빈 문자열 금지)**. sr-only title/aria-label 용도.
+  - Native(iOS/Android)에서는 UI 타이틀이 아니므로 선택.
+  - `PageSheet.title`은 Stack 헤더 타이틀이 아니다(§4.3 참고).
 - `trigger?: ReactNode`
-  - 필요 시에만 (기존 `BottomSheet`와 비슷한 패턴)
+  - **상태를 내부에서 관리하지 않는다.** trigger는 `onOpenChange(true)`를 호출하기 위한 선택적 UI일 뿐이다.
+  - Web에서는 닫힘 후 focus restore 대상으로도 사용될 수 있다(§7).
 - `snapPoints?: Array<string | number>`
-  - Android/웹 모바일에서만 사용
-  - Android: `['90%']` 같은 기존 패턴 유지
-  - Web(vaul): 내부에서 0~1 비율로 변환
+  - 사용 플랫폼: Android / Web mobile만. (iOS / Web desktop에서는 무시)
+  - 허용 값(교차 플랫폼 의미를 고정):
+    - `'90%'`처럼 **% 문자열**
+    - `0.9`처럼 **0~1 비율(number)**
+  - 금지: `300` 같은 px number (플랫폼별 의미가 달라 버그 유발)
+  - 변환 규칙:
+    - Web(vaul): % 문자열 → 0~1 비율로 변환 (예: `'90%'` → `0.9`)
+    - Android(gorhom): 0~1 비율 number → % 문자열로 변환 (예: `0.9` → `'90%'`)
+  - 기본값(1차): `['90%']` (현재 Todo 폼 계열과 동일)
 - `enablePanDownToClose?: boolean` (default true)
-- `scroll?: 'scrollview' | 'view'` (default 'scrollview')
-  - Android에서 `BottomSheetScrollView` / `BottomSheetView` 선택
-- `contentContainerStyle?`
+  - 의미 보장 범위(1차):
+    - Android(gorhom): 지원
+    - Web mobile(vaul): 지원
+  - iOS pageSheet / Web desktop modal: 1차 스코프에서는 **동등한 매핑을 보장하지 않는다(no-op로 간주)**.
+    - 따라서 “닫힘 방지(unsaved changes)”는 이 prop에 의존하지 않는다.
+- `scroll?: 'scrollview' | 'view'` (default 'scrollview')
+  - 의미(공통):
+    - `'scrollview'`: PageSheet가 “platform-appropriate scroll container”를 제공한다.
+    - `'view'`: PageSheet는 스크롤 컨테이너를 제공하지 않는다(호출부가 직접 ScrollView/리스트를 둔다).
+  - Android: `BottomSheetScrollView` / `BottomSheetView` 선택에 직접 매핑된다.
+  - iOS/Web: `'scrollview'`일 때 기본 스크롤 컨테이너를 제공하되, **중첩 스크롤을 피해야 한다**.
+- `contentContainerStyle?`
+  - `scroll='scrollview'`일 때: scroll content 컨테이너에 적용
+  - `scroll='view'`일 때: root view 스타일로 적용
 - `testID?`
+
+### 4.4 Rendering / Mount 정책 (성능 & 버그 방지)
+
+- 기본: `open=false`인 동안은 오버레이 트리와 `children`을 **렌더링하지 않는다**.
+  - 목적: 불필요한 마운트/리렌더 방지, in-sheet stack 상태 누수 방지.
+- 따라서 “닫았다가 다시 열기”는 기본적으로 **초기 상태로 재시작**한다.
+  - 닫힘 후에도 draft 상태 유지가 필요하면, 상태는 호출부에서 보존한다(예: 상위 state/store).
@@
 ### 4.3 In‑Sheet Navigation(Stack) + Header 정책 (중요)
@@
 5. 이 문서의 `PageSheet.title`은 “Stack 헤더 타이틀”이 아니다.  
@@
    - 네비게이션 타이틀은 **각 Stack.Screen의 `options.title`** 로 설정한다.
+
+6. In‑Sheet Stack은 **기존 NavigationContainer 안에서 렌더될 때만** 지원한다.
+   - `PageSheet`가 NavigationContainer를 새로 만들지 않는다(1차 스코프).
+   - “Global overlay(네비게이션 컨텍스트 밖)” 케이스에서는 In‑Sheet Stack을 사용하지 않는다(기존 패턴 유지).
+7. 닫힘/재열림 시 내부 Stack은 **초기 라우트로 리셋**되는 것을 기본으로 한다(§4.4).
+8. Android 하드웨어 back 우선순위(시트가 열려있을 때):
+   - (a) 내부 Stack에서 뒤로 갈 수 있으면 pop
+   - (b) 아니면 `onOpenChange(false)`로 시트 닫기
@@
 ## 5) File/Module 구조(제안)
@@
 - `client/src/components/ui/page-sheet/`
   - `PageSheet.ios.js`
   - `PageSheet.android.js`
   - `PageSheet.web.js` (내부에서 desktop/mobile 분기)
-  - `PageSheetInput.js` (선택, 아래 §6)
   - `index.js`
@@
 ## 6) 키보드/입력 정책 (Bug 예방 핵심)
@@
 ### 6.2 Android (gorhom BottomSheetModal)
@@
 대응 정책:
 - `PageSheet`는 Android에서 기본적으로:
   - `keyboardBehavior="interactive"`
   - `android_keyboardInputMode="adjustResize"`
   - `keyboardBlurBehavior="restore"` (필요 시 조정)
   - `enablePanDownToClose=true`
   를 적용한다 (Todo 폼과 동일 계열).
-- “폼 입력”을 안전하게 만들기 위해, 선택적으로 `PageSheetInput`을 제공한다:
-  - Android: `BottomSheetTextInput` 기반
-  - iOS/Web: 일반 `TextInput` 기반
-  - 목적: “바텀시트 내부 입력 컴포넌트 혼동”을 원천 차단
+- “폼 입력” 안정성(특히 Android)을 위해 **입력 컴포넌트 규칙을 강제**한다:
+  - Android PageSheet 내부 TextInput은 **반드시** `BottomSheetInput`(기존 컴포넌트)을 사용한다.
+  - iOS/Web은 `Input`(기존 컴포넌트)을 사용한다.
+  - 목적: “바텀시트 내부 입력 컴포넌트 혼동”을 원천 차단
+- 닫힘(팬다운/백드롭/백버튼 포함) 시: 포커스가 입력에 있으면 먼저 blur(키보드 dismiss) 후 `onOpenChange(false)`로 수렴한다.
@@
 ## 7) 접근성/포커스 정책 (Web 경고 재발 방지)
@@
 정책:
-1. `PageSheet.web`(모바일, vaul)는 `title`이 없더라도 `Drawer.Title`(sr-only)를 항상 렌더링한다.
-2. 닫힐 때(`onOpenChange(false)` 흐름) **활성 포커스가 시트 내부에 남아있으면 blur/focus 이동**을 수행한다.
-   - (구현 단계에서) `document.activeElement?.blur()` 또는 “trigger로 focus restore” 중 택1
-3. Desktop modal은 backdrop click close 시, focus가 숨겨진 영역에 남지 않도록 동일한 정책을 적용한다.
+1. `PageSheet.web`(모바일, vaul)는 **non-empty `title`을 필수로 받으며** `Drawer.Title`(sr-only)를 항상 렌더링한다.
+2. 닫힐 때(`onOpenChange(false)` 흐름) 활성 포커스가 시트 내부에 남아있으면 아래 중 **하나만** 수행한다.
+   - 1순위: trigger(열었던 버튼)로 focus restore
+   - 2순위: trigger가 없거나 복귀 불가하면 activeElement blur
+3. Web desktop modal도 동일한 “닫힘 후 focus 정리” 정책을 적용한다.
@@
 ## 8) 검증 체크리스트 (Manual)
@@
 ### 8.2 Android
@@
 - [ ] open/close(팬다운 포함) 안정적으로 동작
+- [ ] hardware back(시스템 뒤로가기) → (가능하면 내부 Stack pop) → 아니면 시트 close로 수렴
 - [ ] 입력 포커스 시 키보드 + 시트가 자연스럽게 동작 (튀지 않음)
 - [ ] ScrollView/Content 영역이 정상 스크롤되고, 드래그 제스처 충돌 최소
@@
 ### 8.4 Web (desktop)
@@
 - [ ] 중앙 Modal 열림/닫힘, backdrop 클릭, ESC(가능 시) 동작
+- [ ] Tab/Shift+Tab으로 배경 요소에 포커스가 이동하지 않음(모달 포커스 범위 유지)
 - [ ] 닫힘 후 포커스가 이상한 곳에 남지 않음
@@
 ## 9) 작업 계획 (Tasks, 문서 1장 버전)
@@
-4. (선택) `PageSheetInput` 제공 여부 결정 및 도입
+4. 입력 컴포넌트 정책 확정 및 회귀 방지(=Android는 BottomSheetInput, iOS/Web은 Input)
```

4. Final Verdict

Conditionally ready
