# Native Quick Mode — Design

> Superseded on 2026-03-19 by [native-todo-form-session](/Users/admin/Documents/github/todo/.kiro/specs/native-todo-form-session/design.md). This spec remains as historical quick-only baseline and is no longer the source of truth for the active direction.

## Background / Decision

현재 quick mode는 React Native 기반 공용 UI와 플랫폼별 예외 처리를 혼합해 구현되어 있다.
이 구조는 기능 자체는 제공하지만, 입력 UX의 핵심인 아래 구간에서 플랫폼 고유 동작을 충분히 살리지 못한다.

- iOS keyboard accessory / responder lifecycle
- Android IME / back / bottom-anchored composer 동작
- 마지막 입력값 flush와 quick -> detail handoff 안정성

이번 설계의 핵심 결정은 아래와 같다.

- quick mode UI shell은 native-first로 간다.
- domain logic / validation / payload / offline sync는 JS에 남긴다.
- 공유 대상은 renderer가 아니라 session contract와 event contract다.
- Web renderer는 active architecture에서 제외한다.

## High-Level Architecture

구조는 4계층으로 나눈다.

1. JS orchestration
2. JS bridge wrapper
3. platform native quick session
4. existing JS todo logic

```text
Tabs (+)
  -> useTodoFormStore.openQuick()
    -> Quick Mode Coordinator (JS)
      -> useTodoFormLogic
      -> NativeQuickModeBridge (JS wrapper)
        -> iOS Quick Composer Session
        -> Android Quick Composer Session
      <- native quick events
    -> existing JS submit / handoff
      -> useCreateTodo / useTodoFormV2Store / router.push('/todo-form/v2')
```

중요한 점:

- native는 UI session만 담당한다.
- JS는 draft state와 submit contract를 계속 소유한다.
- quick -> detail handoff와 quick submit의 최종 authority는 JS다.

## Module Split

### 1. Quick Mode Coordinator (JS)

기존 `GlobalFormOverlay`에서 quick orchestration 책임을 분리하는 것을 기본안으로 둔다.

책임:

- `useTodoFormStore.mode === 'QUICK'` 감시
- session open / update / dismiss 제어
- `useTodoFormLogic` state를 native props로 변환
- native event 수신 후 JS state 반영
- submit / close / detail handoff 실행

Coordinator는 아래 JS state를 바라본다.

- `useTodoFormStore`
- `useTodoFormLogic`
- `useTodoFormV2Store`

### 2. NativeQuickModeBridge (JS Wrapper)

bridge wrapper는 platform native module을 감싼다.

책임:

- `open(sessionConfig)`
- `update(sessionConfig)`
- `dismiss(sessionId, reason?)`
- native event subscription
- stale session filtering

native 세부 구현이 `UIViewController`, `DialogFragment`, custom view 중 무엇이든 caller는 모르게 해야 한다.

### 3. Native Quick Session (Platform)

각 플랫폼은 open 동안 자기 로컬 UI lifecycle을 소유한다.

공통 역할:

- text input rendering
- submit button enabled state 반영
- local text edit responsiveness
- backdrop / dismiss 처리
- latest title를 포함한 action event emit

### 4. Existing JS Todo Logic

아래 로직은 유지한다.

- `useTodoFormLogic`
- `useCreateTodo`
- `useUpdateTodo`
- `useTodoFormV2Store`
- existing `/todo-form/v2` route

즉 native quick mode 도입으로 todo payload contract나 sync 순서는 바뀌지 않는다.

## Session Model

quick mode는 open마다 새로운 session id를 발급한다.

```ts
type QuickSessionId = string;
```

이 session id는 아래 문제를 막기 위해 필요하다.

- 빠른 open/close 반복 중 stale dismiss event
- route transition 중 늦게 도착한 native callback
- 두 번째 open 이후 첫 번째 session callback 오염

Rule:

- JS는 active session id 하나만 유지한다.
- native event는 항상 `sessionId`를 포함한다.
- active session id와 다르면 event를 무시한다.

## JS <-> Native Contract

### Open / Update Payload

```ts
type NativeQuickSessionConfig = {
  sessionId: string;
  title: string;
  categoryLabel: string;
  dateLabel: string;
  repeatLabel: string;
  canSubmit: boolean;
};
```

`open`과 `update`는 같은 shape를 사용한다.

이유:

- async category resolution로 label이 바뀔 수 있음
- title이 JS에서 reset될 수 있음
- submit enabled state를 native가 즉시 반영해야 함

### Native Event Contract

```ts
type NativeQuickDismissReason =
  | 'backdrop'
  | 'back'
  | 'keyboard'
  | 'submit'
  | 'route'
  | 'programmatic';

type NativeQuickEvent =
  | { type: 'changeTitle'; sessionId: string; title: string }
  | { type: 'submit'; sessionId: string; title: string }
  | { type: 'pressCategory'; sessionId: string; title: string }
  | { type: 'pressDate'; sessionId: string; title: string }
  | { type: 'pressRepeat'; sessionId: string; title: string }
  | { type: 'dismiss'; sessionId: string; title: string; reason: NativeQuickDismissReason };
```

핵심 규칙:

- action event는 항상 `title`을 포함한다.
- JS는 action 처리 전에 event의 `title`을 먼저 form state에 반영한다.
- `changeTitle` 이벤트는 고빈도일 수 있으므로 coalescing이 가능하다.
- 하지만 `submit`, `pressCategory`, `pressDate`, `pressRepeat`, `dismiss`는 최신 title 포함이 필수다.

## JS Orchestration Rules

### Open

1. `mode === 'QUICK'`가 되면 session id를 생성한다.
2. `useTodoFormLogic`에서 현재 `formState.title` / quick labels / submit 가능 여부를 읽는다.
3. `NativeQuickModeBridge.open()` 호출.

### Update

아래 값이 바뀌면 active session에 `update()`를 보낸다.

- title
- category label
- date label
- repeat label
- canSubmit

### Submit

1. native `submit` event 수신
2. event.title을 JS form state에 먼저 반영
3. `logic.handleSubmit({ quickMode: true })` 실행
4. submit 성공 후 close flow 수행

### Handoff To Detail

1. native `pressCategory` / `pressDate` / `pressRepeat` event 수신
2. event.title을 JS form state에 먼저 반영
3. 최신 JS draft로 `useTodoFormV2Store.setDraft()` 호출
4. quick session dismiss
5. `/todo-form/v2` route push

### Dismiss

1. native `dismiss` event 수신
2. active session인지 확인
3. 이미 close 중이 아니면 `useTodoFormStore.close()` 호출

Dismiss는 idempotent해야 한다.

## iOS Design

## iOS Technology Choice

- `SwiftUI` 미사용
- `Expo UI` 미사용
- `UIKit` 기반 구현

## iOS Session Shape

iOS는 `keyboard accessory composer`를 기준 UX로 둔다.

예상 구조:

- presenter view controller
- dimmed backdrop view
- hidden or host `UITextField` / responder
- custom accessory bar view

행동 모델:

- open -> responder becomeFirstResponder -> keyboard + composer 표시
- keyboard dismiss gesture -> responder resign -> dismiss event emit
- backdrop tap -> responder resign + dismiss event emit
- submit 버튼 / return key -> submit event emit

## iOS State Policy

- native는 현재 typing text를 로컬로 즉시 반영한다.
- JS update가 들어오면 native text와 동기화한다.
- action emit 시점에는 local text를 event payload에 포함한다.

이 정책은 iOS 입력 responsiveness를 보장하면서도, JS가 canonical draft를 유지하도록 한다.

## Android Design

## Android Technology Choice

- `Jetpack Compose` 미사용
- `Expo UI` 미사용
- Android View system 기반 구현

## Android Session Shape

Android는 `bottom anchored native composer`를 기준 UX로 둔다.

예상 구조:

- `DialogFragment` 또는 동등한 native modal session
- dim backdrop
- 상단 sheet가 아니라 하단 composer 레이아웃
- `EditText`
- submit button
- category/date/repeat action chips

IME 대응:

- open 시 `EditText` focus + keyboard open
- bottom composer는 IME와 안정적으로 함께 움직여야 함
- system back 또는 backdrop dismiss 지원

중요:

- Android quick mode는 detail sheet처럼 large sheet로 커지지 않는다.
- quick mode는 "작은 입력 composer"라는 정보 구조를 유지해야 한다.

## Android State Policy

- native local text buffer 허용
- JS update로 text reset 가능
- action event는 항상 latest local text 포함
- system back / dismiss 시 latest local text를 포함한 dismiss event를 보낼 수 있어야 함

## Canonical Submit / Handoff Integration

native quick mode가 바꾸지 않는 영역:

- 기본 날짜 계산
- 기본 카테고리 선택
- recurrence label 계산
- quick submit payload 생성
- toast 처리
- create mutation / offline pending enqueue

즉 기존 JS 로직은 여전히 아래를 결정한다.

- 저장 가능 여부의 최종 판정
- payload shape
- `isAllDay=true` 강제
- detail route handoff draft

## Legacy / Cleanup Boundary

이번 설계에서 기존 RN quick UI는 active path에서 물러난다.

대상 예시:

- `QuickInput.js`
- `QuickModeContent.js`
- `QuickModeContent.ios.js`
- `QuickContainer.js`
- `QuickContainer.ios.js`
- `QuickContainer.web.js`

정리 방식은 구현 단계에서 선택한다.

- 완전 삭제
- legacy fallback으로 격리
- transition 기간 동안 비활성 경로로 유지

하지만 중요한 불변식은 아래다.

- production quick mode active path는 더 이상 web/RN quick UI를 기준으로 설계하지 않는다.

## Explicit Non-Goals

이번 설계는 아래를 다루지 않는다.

- detail mode native rewrite
- 기존 edit flow의 route 구조 변경
- native category picker / native date picker / native recurrence picker 자체 구현
- quick swipe-up to detail gesture
- shared pixel-perfect UI 추구
