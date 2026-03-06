# Page Sheet — Design

## 1. Platform Mapping

| Platform | Component | Base | Key Props |
|---|---|---|---|
| iOS | `PageSheet.ios.js` | RN `Modal` + `presentationStyle="pageSheet"` | `visible`, `animationType="slide"`, `onDismiss`, `onRequestClose` |
| Android | `PageSheet.android.js` | `BottomSheetModal` (gorhom) | `snapPoints`, `keyboardBehavior`, `enablePanDownToClose`, `enableDynamicSizing={false}` |
| Web mobile | `PageSheet.web.js` (width ≤ 768) | `vaul` `Drawer.Root` | `open`, `onOpenChange`, `snapPoints` (0~1 변환), `shouldScaleBackground` |
| Web desktop | `PageSheet.web.js` (width > 768) | RN `Modal` + `Pressable` backdrop | `visible`, `transparent`, `animationType="fade"` |

> **Android `BottomSheetModal` 선택 근거**: PageSheet는 AS-IS `DetailContainer.android.js` 패턴(Modal 방식 open/close)을 레퍼런스로 삼는다. `bottom-sheet-native.js`의 일반 `BottomSheet`는 inline embed 용도이며 목적/스코프가 다르다.

## 2. File Structure

```
client/src/components/ui/page-sheet/
├── PageSheet.ios.js
├── PageSheet.android.js
├── PageSheet.web.js          ← 내부에서 desktop/mobile 분기
├── PageSheetInput.android.js ← BottomSheetTextInput 기반
├── PageSheetInput.ios.js     ← 일반 TextInput 기반
├── PageSheetInput.web.js     ← 일반 TextInput 기반
└── index.js                  ← Platform.OS 기반 re-export
```

## 3. Public API

### PageSheet Props

```js
{
  // 필수
  open: boolean,
  onOpenChange: (nextOpen: boolean) => void,
  children: ReactNode,

  // 옵션
  title?: string,              // Web a11y sr-only 용. Native는 UI 타이틀 아님.
  snapPoints?: string[],       // Android/Web mobile만. 기본 ['90%']. px 금지.
  enablePanDownToClose?: bool,  // 기본 true. iOS/Web desktop은 no-op.
  scroll?: 'scrollview'|'view', // 기본 'scrollview'. Android-only 효과.
  contentContainerStyle?: obj,  // scroll mode에 따라 적용 위치 다름
  testID?: string,
}
```

### PageSheetInput Props

기존 `BaseInput`과 동일한 props. 내부에서 플랫폼별 TextInput 컴포넌트를 자동 선택.

## 4. Reference Patterns (AS-IS → 재사용)

### 4.1 iOS (`DetailContainer.ios.js` 패턴)

```
<Modal visible={open} presentationStyle="pageSheet" animationType="slide"
       onRequestClose={handleClose} onDismiss={handleClose}>
  <View style={{ flex:1, backgroundColor:'white', paddingTop:20 }}>
    <KeyboardAvoidingView behavior="padding" style={{ flex:1 }}>
      {children}
    </KeyboardAvoidingView>
  </View>
</Modal>
```

⚠️ close guard 필수: `onRequestClose`와 `onDismiss` 양쪽 호출 가능 → 현재 `open` 체크 후 `onOpenChange(false)` 호출.

### 4.2 Android (`DetailContainer.android.js` 패턴)

```
<BottomSheetModal
  ref={sheetRef}
  snapPoints={['90%']}
  enableDynamicSizing={false}
  keyboardBehavior="interactive"
  keyboardBlurBehavior="restore"
  android_keyboardInputMode="adjustResize"
  enablePanDownToClose={true}
  backdropComponent={renderBackdrop}
  onDismiss={handleClose}
>
  <BottomSheetScrollView>  // scroll='scrollview' 일 때
    {children}
  </BottomSheetScrollView>
</BottomSheetModal>
```

- `open` → `useEffect`로 `sheetRef.current?.present()` / `dismiss()` 제어
- `BottomSheetModalProvider` 필요 (App.js에서 이미 제공)

### 4.3 Web Mobile (`bottom-sheet-web.js` 내부 vaul 패턴)

> 참고: AS-IS `DetailContainer.web.js`는 `<BottomSheet isOpen={visible}>` 래퍼를 사용하며, 아래는 `bottom-sheet-web.js`의 내부 Drawer 패턴이다.

```
<Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground
             snapPoints={parsedSnapPoints}>
  <Drawer.Portal>
    <Drawer.Overlay />
    <Drawer.Content style={{ maxHeight:'96%' }} aria-describedby={undefined}>
      <Drawer.Title className="sr-only">{title || '팝업'}</Drawer.Title>
      <Drawer.Description className="sr-only">{title || '팝업 내용'}</Drawer.Description>
      <div className="overflow-y-auto">{children}</div>
    </Drawer.Content>
  </Drawer.Portal>
</Drawer.Root>
```

### 4.4 Web Desktop (`DetailContainer.web.js` 패턴)

```
if (!open) return null;

<Modal visible={open} transparent animationType="fade" onRequestClose={handleClose}>
  <Pressable onPress={handleClose} style={backdropStyle}>
    <Pressable onPress={e => e.stopPropagation()} style={contentStyle}>
      {children}
    </Pressable>
  </Pressable>
</Modal>
```

a11y 추가 필요: `role="dialog"`, `aria-modal="true"`, ESC key handler, focus-on-open.
> RN 컴포넌트에 적용 시 실제 DOM 반영 여부를 DevTools로 검증할 것 (accessibilityRole vs role 등).

## 5. Rendering/Mount 정책

| Platform | open=false 시 | open=true → false → true |
|---|---|---|
| iOS | `<Modal visible={false}>` 유지, children은 `{open && children}` 권장 | 초기 상태 재시작 |
| Android | `BottomSheetModal` 항상 mount, `dismiss()` 호출. children 조건부 렌더 금지 | 초기 상태 재시작 |
| Web desktop | `return null` (complete unmount) | 초기 상태 재시작 |
| Web mobile | `Drawer.Root` 항상 mount, `open={false}` | 초기 상태 재시작 |

재열림 reset 책임은 플랫폼별로 다르다:
- iOS: `{open && children}`로 충분하다. 닫힘 시 children unmount → 재열림 시 remount.
- Web desktop: `return null`로 충분하다. complete unmount → remount.
- Android / Web mobile: `dismiss()` 또는 `open={false}`만으로는 children subtree reset이 보장되지 않는다.
  `PageSheet`가 내부적으로 **open session mount boundary**(예: session key 기반 remount 경계)를 가져야 하며,
  닫기 후 다시 열 때 이 경계를 새로 만들어 children / In-Sheet Stack을 초기 상태로 되돌린다.
  FR-6의 reset과 FR-5의 Stack initial-route 복귀는 이 경계가 보장하는 것이며, 라이브러리 기본 동작에 의존하지 않는다.

## 6. Keyboard/Input 정책

| Platform | 키보드 대응 | 입력 컴포넌트 |
|---|---|---|
| iOS | `KeyboardAvoidingView behavior="padding"` | `PageSheetInput` → 일반 `TextInput` |
| Android | gorhom `keyboardBehavior="interactive"` + `adjustResize` | `PageSheetInput` → `BottomSheetTextInput` |
| Web mobile | vaul 내부 처리 + `maxHeight` 제한 | `PageSheetInput` → 일반 `TextInput` |
| Web desktop | 일반 (키보드 이슈 없음) | `PageSheetInput` → 일반 `TextInput` |

## 7. Accessibility/Focus 정책

| 항목 | Web mobile (vaul) | Web desktop (Modal) |
|---|---|---|
| 제목 | `Drawer.Title` sr-only 항상 렌더 | `role="dialog"` + `aria-modal="true"` |
| 닫힘 시 focus | 열기 전 focus 위치로 restore > 없으면 blur | 동일 |
| 키보드 닫기 | vaul 내장 | ESC key handler 필요 |
| Focus trap | vaul 내장 | 배경 포커스 금지까지 포함해 `PageSheet`가 명시적으로 보장 |

## 8. In-Sheet Navigation (Stack) 정책 (FR-5)

- `PageSheet`는 컨테이너(Modal/Sheet)만 담당한다. `NavigationContainer`를 생성/소유하지 않는다.
- Sheet 내부 네비게이션이 필요하면 consumer가 children으로 Stack Navigator를 삽입한다. route state ownership은 child Stack에 있다.
- **지원 조건**: 앱 루트 `NavigationContainer` 안에서 렌더될 때만 지원한다. (그 외는 지원하지 않음)
- **헤더 정책**(iOS UX 기준): Stack의 기본 header를 사용한다. `PageSheet.title`은 Web a11y(sr-only) 용이며 네이티브 UI 타이틀이 아니다.
- **닫힘/재열림 정책**: Sheet를 닫았다가 다시 열면 내부 Stack은 항상 initial route로 돌아가야 한다. (draft/state 보존은 consumer 책임)
  Android / Web mobile에서는 §5의 open session mount boundary가 이 reset을 보장한다.
- **Android hardware back 정책**:
  - 우선순위는 child Stack pop → 최종 시트 close 이다.
  - `PageSheet`는 child navigator보다 먼저 back event를 가로채면 안 된다.
  - child navigator가 event를 처리하지 않은 경우에만 `onOpenChange(false)` fallback close를 수행한다.

## 9. Dependencies (이미 설치됨)

- `@gorhom/bottom-sheet` — Android BottomSheetModal
- `vaul` — Web mobile drawer
- `react-native` Modal — iOS/Web desktop
- `react-native-keyboard-controller` — KeyboardProvider (App.js)
- `react-native-gesture-handler` — GestureHandlerRootView (App.js)
