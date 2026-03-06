# Page Sheet — Tasks

## Phase 1: Core Component

### 1.1 `PageSheet.ios.js`
- [x] RN `Modal` + `presentationStyle="pageSheet"` + `animationType="slide"`
- [x] `KeyboardAvoidingView behavior="padding"` wrapping
- [x] `onRequestClose` + `onDismiss` → close guard (idempotent `onOpenChange(false)`)
- [x] `open` prop → `visible` 매핑
- [x] children 조건부 렌더: `{open && children}`

### 1.2 `PageSheet.android.js`
- [x] `BottomSheetModal` + `ref` 패턴 (항상 mount, conditional mount 금지 — design §5 준수)
- [x] `useEffect(open)` → `present()` / `dismiss()` (children 조건부 렌더 금지)
- [x] Android children subtree reset용 internal open session mount boundary 적용 (dismiss/open만으로 reset 보장하지 않음)
- [x] 기본 props: `snapPoints=['90%']`, `enableDynamicSizing={false}`, `keyboardBehavior="interactive"`, `android_keyboardInputMode="adjustResize"`, `keyboardBlurBehavior="restore"`, `enablePanDownToClose={true}`
- [x] `scroll` prop → `BottomSheetScrollView` / `BottomSheetView` 분기
- [x] `contentContainerStyle` 전달
- [x] `onDismiss` → `onOpenChange(false)`
- [x] Backdrop 렌더 (`pressBehavior="close"`)

### 1.3 `PageSheet.web.js`
- [ ] `useWindowDimensions()` → width > 768 분기

**Mobile (vaul):**
- [x] `Drawer.Root` + `open`/`onOpenChange` 매핑
- [x] Web mobile children subtree reset용 internal open session mount boundary 적용 (`open={false}`만으로 reset 보장하지 않음)
- [x] `snapPoints` % → 0~1 변환
- [x] `shouldScaleBackground` 적용 (AS-IS bottom-sheet-web 패턴)
- [x] `Drawer.Title` sr-only 항상 렌더 (title prop 활용)
- [x] `Drawer.Description` sr-only
- [x] `Drawer.Content`에 `aria-describedby={undefined}` 적용 (AS-IS bottom-sheet-web 패턴)
- [x] `maxHeight: '96%'`
- [x] 스크롤 영역 `overflow-y-auto`

**Desktop (modal):**
- [x] `open=false` → `return null`
- [x] RN `Modal` + `transparent` + `animationType="fade"`
- [x] Pressable backdrop + content (stopPropagation)
- [ ] `role="dialog"`, `aria-modal="true"` 적용 (DevTools로 실제 DOM 반영 검증)
- [x] ESC key handler (`onKeyDown` 또는 `onRequestClose`)
- [x] Focus-on-open (첫 focusable element)
- [x] 명시적 focus trap / focus scope 처리 (Tab/Shift+Tab 배경 포커스 금지)
- [x] 닫힘 시 focus restore

### 1.4 `index.js`
- [x] Platform.OS 기반 re-export (`PageSheet`, `PageSheetInput`)

### 1.5 FR-5 In-Sheet Stack 지원
- [x] `PageSheet`는 NavigationContainer를 만들지 않고, child Stack route state는 consumer-owned로 유지
- [x] 닫힘/재열림 시 internal open session mount boundary로 child Stack이 initial route로 리셋되도록 보장
- [x] Android hardware back에서 child navigator를 먼저 가로채지 않도록 하고, 미처리 시에만 `onOpenChange(false)` fallback close 수행

---

## Phase 2: PageSheetInput

### 2.1 `PageSheetInput.android.js`
- [x] `BottomSheetTextInput` 기반 (기존 `BottomSheetInput`과 동일 패턴)
- [x] `BaseInput` 래퍼 사용

### 2.2 `PageSheetInput.ios.js`
- [x] 일반 `TextInput` 기반 (기존 `Input`과 동일 패턴)
- [x] `BaseInput` 래퍼 사용

### 2.3 `PageSheetInput.web.js`
- [x] 일반 `TextInput` 기반
- [x] `BaseInput` 래퍼 사용

---

## Phase 3: 검증

### 3.1 샘플 화면 작성
- [x] 간단한 테스트 화면 or Story 생성 (PageSheet + PageSheetInput 포함 폼)
- [x] NavigationContainer 안에서 렌더하는 케이스
- [x] 긴 폼 (스크롤 필요) 케이스
- [x] In-Sheet Stack 2-step 플로우 (1→2 화면 전환) 포함

### 3.2 플랫폼별 검증 (Manual Checklist)

**iOS:**
- [ ] open/close (버튼, swipe dismiss) → `onOpenChange(false)` 수렴
- [ ] 입력 포커스 시 키보드가 컨텐츠 안 가림
- [ ] 긴 폼 스크롤 정상

**Android:**
- [ ] open/close (pan-down 포함) 안정
- [ ] hardware back → (Stack pop or 시트 close)
- [ ] 입력 포커스 시 키보드 + 시트 자연스러움
- [ ] ScrollView/Content 스크롤 + 드래그 제스처 충돌 없음

**Web mobile:**
- [ ] open/close 시 console a11y 경고 없음
- [ ] 닫힘 후 focus restore (트리거로 복귀 / 불가 시 blur)
- [ ] 스크롤/오버스크롤/바운스 자연스러움

**Web desktop:**
- [ ] 중앙 Modal 열림/닫힘, backdrop 클릭, ESC 동작
- [ ] Tab/Shift+Tab 배경 포커스 불가
- [ ] 닫힘 후 포커스 정상 복귀
- [ ] open/close 시 console a11y 경고(aria-hidden/focus) 없음

**공통:**
- [ ] `open=false` 시 렌더 최소화 확인
- [ ] 동시 2개 PageSheet 안 열림 확인
- [ ] 닫기→재열림 시 내부 state(입력값/스크롤/내부 네비게이션)가 초기화되는지 확인
- [ ] In-Sheet Stack: 닫기→재열림 시 항상 1번 화면으로 복귀 검증
- [ ] In-Sheet Stack (Android): 2번 화면에서 hardware back → 1번 화면, 1번에서 hardware back → 시트 close
- [ ] 기존 Todo 폼 대비 UX 회귀 없음 확인
