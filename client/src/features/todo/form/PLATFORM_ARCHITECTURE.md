# TodoForm 플랫폼별 아키텍처 및 구현 가이드 (v2.0)

Todo 생성/수정 폼의 플랫폼별 UI 전략, 상태 관리, 그리고 전환 애니메이션 로직을 정리한 문서입니다.

---

## 📊 플랫폼별 UI/UX 전략 요약

모든 플랫폼은 **Zustand Store**(`useTodoFormStore`)를 통해 전역적으로 제어되며, `GlobalFormOverlay` 컴포넌트에서 렌더링됩니다.

| 플랫폼 | Quick Mode (진입점) | Detail Mode (상세) | 주요 라이브러리 |
| --- | --- | --- | --- |
| **iOS** | **Keyboard Accessory Bar**<br>

<br>(InputAccessoryView) | **Native Modal**<br>

<br>(`pageSheet` 스타일) | RN Built-in `InputAccessoryView`<br>

<br>RN Built-in `Modal` |
| **Android** | **Float View**<br>

<br>(KeyboardStickyView) | **Bottom Sheet**<br>

<br>(Material 스타일) | `react-native-keyboard-controller`<br>

<br>`@gorhom/bottom-sheet` |
| **Web Mobile** | **Sticky Footer**<br>

<br>(CSS Fixed) | **Drawer**<br>

<br>(Vaul) | `vaul` (Radix UI 기반) |
| **Web Desktop** | ❌ **없음** (바로 상세 진입) | **Center Modal**<br>

<br>(PC 팝업 스타일) | RN Built-in `Modal` |

---

## 🏗️ 전역 상태 관리 (Zustand)

폼의 열림/닫힘 및 데이터 전달은 전역 스토어에서 관리합니다.

### `useTodoFormStore` 구조

```javascript
const useTodoFormStore = create((set) => ({
  mode: 'CLOSED', // 'CLOSED' | 'QUICK' | 'DETAIL'
  activeTodo: null, // 수정 시 데이터
  initialFocusTarget: null, // 'CATEGORY' | 'DATE' 등 (Detail 진입 시 자동 열림 타겟)

  // Quick Mode 열기
  openQuick: (todo = null) => set({ mode: 'QUICK', activeTodo: todo, initialFocusTarget: null }),

  // Detail Mode 열기 (타겟 지정 가능)
  openDetail: (todo = null, target = null) => set((state) => ({
    mode: 'DETAIL',
    activeTodo: todo || state.activeTodo,
    initialFocusTarget: target
  })),

  close: () => set({ mode: 'CLOSED', activeTodo: null, initialFocusTarget: null }),
}));

```

---

## 📱 Mobile Native (iOS & Android)

### 1. Quick Mode

* **UI:** 키보드 바로 위에 붙어 있는 Bar.
* **iOS 구현:** RN 내장 **`InputAccessoryView`** + 화면 밖(host) `TextInput`로 bar를 키보드에 부착.
* **Android 구현:** `react-native-keyboard-controller` 기반 키보드 높이 추적 + `translateY`로 Bar 이동.

### 2. Detail Mode (플랫폼 분기)

#### 🍎 iOS Implementation

* **컴포넌트:** React Native 내장 `<Modal>`
* **스타일:** `presentationStyle="pageSheet"`
* **특징:** iOS 네이티브 카드 UI 사용. 제스처로 닫기 지원.

#### 🤖 Android Implementation

* **컴포넌트:** `@gorhom/bottom-sheet` (`BottomSheetModal`)
* **설정:**
* `keyboardBehavior="fill"` (튀는 현상 방지)
* `android_keyboardInputMode="adjustResize"`


* **특징:** Android에서 가장 안정적인 키보드 핸들링 및 제스처 지원.

---

## 🌐 Web (Mobile & Desktop)

### 1. Web Mobile

* **Quick Mode:** CSS `position: fixed; bottom: 0` + `input autoFocus`.
* **Detail Mode:** `vaul` 라이브러리 사용.
* iOS 스타일의 드러워(Drawer) UI 제공.
* 배경 클릭 시 닫힘, 드래그 제스처 지원.



### 2. Web Desktop

* **Quick Mode:** 제공하지 않음. (추가 버튼 클릭 시 바로 Detail Mode 오픈)
* **Detail Mode:** 화면 중앙에 뜨는 고정 크기 모달 (`RN Modal` + 커스텀 스타일).

---

## 🎬 트랜지션 및 인터랙션 로직

### 1. Quick → Detail 전환 (오케스트레이션)

Quick Mode에서 확장 버튼 클릭 시, 자연스러운 전환을 위해 다음 순서를 따릅니다.

1. **User Action:** 확장 버튼 클릭.
2. **Keyboard Dismiss:** `Keyboard.dismiss()` 호출.
3. **UI Sync:** iOS는 `InputAccessoryView`가 키보드에 부착되어 함께 숨겨지고, Android는 키보드 높이 추적/`translateY`로 Bar 위치를 동기화.
4. **Event Listener:** `keyboardDidHide` 이벤트 감지.
5. **State Change:** 키보드가 완전히 사라진 후 `store.openDetail()` 실행.
6. **Transition:** Quick Mode 언마운트 & Detail Mode 슬라이드 업 (Slide Up).

### 2. Contextual Deep Linking (맥락 기반 오픈)

Quick Mode에서 특정 아이콘(날짜, 폴더 등)을 클릭하여 Detail Mode로 진입할 경우:

1. `openDetail(todo, 'DATE')` 호출.
2. Detail Mode가 렌더링됨.
3. `useEffect`에서 `initialFocusTarget`을 감지하여 **자동으로 날짜 섹션(Accordion)을 펼침.**
4. 사용자는 뎁스(Depth) 없이 바로 날짜 설정 가능.

---

## 📁 파일 구조 및 컴포넌트

```
src/
├── features/
│   └── todo/
│       ├── form/
│       │   ├── GlobalFormOverlay.js    # [진입점] 앱 최상단에 배치 (플랫폼 분기 로직)
│       │   ├── QuickInputFloat.js      # [공통] Quick Mode 입력창 (StickyView)
│       │   ├── DetailFormContent.js    # [공통] 상세 폼 내부 컨텐츠
│       │   └── wrappers/               # 플랫폼별 Detail Mode 껍데기
│       │       ├── NativeIOSModal.js   # iOS Modal (pageSheet)
│       │       ├── AndroidBottomSheet.js # Gorhom BottomSheet
│       │       ├── WebDrawer.js        # Vaul Drawer
│       │       └── WebCenterModal.js   # Web Desktop Modal
│       └── stores/
│           └── useTodoFormStore.js     # Zustand Store
└── App.js                              # GlobalFormOverlay 배치

```

---

## ✅ 핵심 구현 체크리스트

* [ ] **Global Overlay:** `App.js` 최상단에 `GlobalFormOverlay`가 배치되었는가?
* [ ] **Android Keyboard:** `AndroidManifest.xml`에 `adjustResize`가 설정되었는가?
* [ ] **Keyboard Sync:** iOS(`InputAccessoryView`) / Android(키보드 높이 추적)에서 Quick Bar가 키보드와 함께 자연스럽게 움직이는가?
* [ ] **Transition:** Quick -> Detail 전환 시 키보드가 먼저 내려가고 Detail이 올라오는가?
* [ ] **Conditional Rendering:** `mode`가 `CLOSED`일 때 컴포넌트가 언마운트 되어 메모리를 점유하지 않는가?





### 🗓️ Phase 1: 환경 설정 및 기본 뼈대 구축

가장 먼저 전역 상태를 만들고, 앱 어디서든 폼을 띄울 준비를 합니다.

**1. 패키지 설치 및 설정**

* [ ] `zustand` (상태 관리)
* [ ] `@gorhom/bottom-sheet`, `react-native-reanimated`, `react-native-gesture-handler` (Android 필수)
* [ ] `react-native-keyboard-controller` (Quick Mode 필수)
* [ ] **중요:** Android `AndroidManifest.xml`에 `windowSoftInputMode="adjustResize"` 설정 확인.
* [ ] **중요:** `App.js` 최상단을 `GestureHandlerRootView`와 `BottomSheetModalProvider`로 감싸기.

**2. Zustand Store 구현 (`useTodoFormStore.js`)**

* [ ] `mode` ('CLOSED', 'QUICK', 'DETAIL'), `activeTodo`, `initialFocusTarget` 상태 정의.
* [ ] `openQuick()`, `openDetail()`, `close()` 액션 구현.

**3. Global Overlay 껍데기 배치 (`GlobalFormOverlay.js`)**

* [ ] 빈 컴포넌트를 만들고 `App.js`의 네비게이션 컨테이너 **바깥(최하단)**에 배치.
* [ ] Store의 `mode` 상태를 구독하여 로그(`console.log`)가 잘 찍히는지 테스트.

---

### 🗓️ Phase 2: Quick Mode (키보드 연동) 구현

사용자가 가장 많이 쓰는 Quick Mode부터 구현하여 키보드 연동을 확실히 잡습니다.

**1. `QuickInputFloat` 컴포넌트 제작**

* [ ] `TextInput` 배치 및 `autoFocus={true}` 설정.
* [ ] iOS: `InputAccessoryView` + host `TextInput`로 키보드 위 Bar 구성.
* [ ] Android: 키보드 높이 추적 + `translateY`로 Bar 이동.

**2. Global Overlay 연동**

* [ ] `mode === 'QUICK'`일 때 `QuickInputFloat`가 렌더링되도록 조건부 렌더링 추가.
* [ ] 하단 탭바의 (+) 버튼에 `store.openQuick()` 연결.

**✅ 체크포인트:**

* 버튼을 누르자마자 키보드와 입력창이 **동시에** 올라오는지 확인 (Android/iOS).
* 입력창 바깥을 누르거나 닫기 버튼을 누르면 키보드가 내려가면서 입력창도 같이 내려가는지 확인.

---

### 🗓️ Phase 3: Detail Mode (UI 및 플랫폼 분기)

가장 복잡한 Android Bottom Sheet를 먼저 해결하면 나머지는 쉽습니다.

**1. 상세 폼 내부 컨텐츠 제작 (`DetailFormContent.js`)**

* [ ] 제목, 카테고리, 날짜, 반복 설정 등을 포함한 순수 UI 컴포넌트 제작.
* [ ] `props`로 `initialFocusTarget`을 받아 해당 섹션이 열리는(Accordion) 로직 구현.

**2. Android Wrapper 구현 (`AndroidBottomSheet.js`)**

* [ ] `@gorhom/bottom-sheet`의 `BottomSheetModal` 구현.
* [ ] `keyboardBehavior="fill"` 및 `android_keyboardInputMode="adjustResize"` 적용.
* [ ] Store의 `mode` 변화에 따라 `ref.current.present()` / `dismiss()` 호출 로직 연결.

**3. iOS Wrapper 구현 (`NativeIOSModal.js`)**

* [ ] RN 내장 `Modal` (`presentationStyle="pageSheet"`) 구현.

**4. Web Wrapper 구현 (`WebDrawer.js`, `WebCenterModal.js`)**

* [ ] Mobile: `vaul` Drawer 구현.
* [ ] Desktop: RN `Modal` (Center Style) 구현.

**✅ 체크포인트:**

* `store.openDetail()`을 직접 호출했을 때 각 플랫폼별로 올바른 UI(Sheet/Modal)가 뜨는지 확인.

---

### 🗓️ Phase 4: 트랜지션 & 인터랙션 연결 (핵심)

Quick Mode와 Detail Mode를 부드럽게 이어줍니다.

**1. Quick → Detail 전환 로직 (`QuickInputFloat.js`)**

* [ ] 확장 버튼(`expand-arrows`) 추가.
* [ ] 클릭 시 `Keyboard.dismiss()` 호출 -> `keyboardDidHide` 리스너 등록 -> `store.openDetail()` 호출 순서 구현.

**2. Contextual Deep Linking (심층 연결)**

* [ ] Quick Mode의 날짜/카테고리 아이콘 클릭 이벤트 연결.
* [ ] `store.openDetail(null, 'DATE')` 처럼 타겟 전달.
* [ ] Detail Mode 열릴 때 해당 섹션이 자동으로 펼쳐지는지 확인.

---

### 🗓️ Phase 5: 마무리 및 최적화

**1. 조건부 렌더링 최적화**

* [ ] `GlobalFormOverlay`에서 `mode === 'CLOSED'`일 때 불필요한 컴포넌트가 렌더링되지 않도록 확인.
* [ ] Android의 경우 `BottomSheetModal`은 유지하되 내부 컨텐츠만 조건부 렌더링하는지 확인.

**2. 애니메이션 및 UX 다듬기**

* [ ] iOS 모달 닫을 때/열 때 애니메이션 속도감 확인.
* [ ] Android 백버튼(뒤로가기) 눌렀을 때 시트가 잘 닫히는지 확인.

---

### 💡 추천 작업 순서 요약

1. **State** (Zustand) 먼저 만들기.
2. **Quick Mode** (iOS InputAccessoryView / Android 키보드 동기화) 완성하기.
3. **Android Detail** (Gorhom) 연동하기.
4. **Transition** (Quick -> Detail) 연결하기.
5. 나머지 플랫폼(iOS, Web) 붙이기.

이 순서대로 진행하시면 "다 만들어놨는데 키보드가 안 먹어서 처음부터 다시 뜯어고치는" 불상사를 막을 수 있습니다.
