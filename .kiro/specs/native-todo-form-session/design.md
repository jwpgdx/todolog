# Native Todo Form Session — Design

## Background / Decision

기존 구조는 아래처럼 분리되어 있다.

- quick: overlay / platform-specific shortcut input
- detail: route 또는 별도 modal/sheet

이 구조는 quick와 detail을 서로 다른 세션으로 취급하기 때문에, `drag up -> detail`처럼 연속적인 전환을 구현할 때 구조적으로 불리하다.

새 설계의 핵심 결정은 아래와 같다.

- quick와 detail은 같은 session의 두 상태다.
- session shell은 native-first로 구현한다.
- JS는 draft, validation, submit, data contract를 계속 소유한다.
- detail 내부 위젯은 별도 작업 산출물을 slot 형태로 통합한다.

## High-Level Architecture

구조는 5계층으로 나눈다.

1. JS session coordinator
2. JS/native bridge wrapper
3. native session host
4. native session states (`collapsed` / `expanded`)
5. shared JS todo logic + external detail surfaces

```text
openQuick / future openEdit
  -> TodoFormSessionCoordinator (JS)
    -> useTodoFormLogic
    -> NativeTodoFormSessionBridge
      -> iOS Native Todo Form Session Host
      -> Android Native Todo Form Session Host
        -> collapsed quick surface
        -> expanded detail shell
        -> gesture / keyboard / backdrop / back
      <- native session events
    -> JS draft / submit / sync / router fallback
```

중요한 점:

- route push는 더 이상 quick -> detail 주 경로가 아니다.
- expand는 same-session transition이다.
- native는 shell과 transitions를 담당한다.
- JS는 canonical form state를 담당한다.

## Session Model

각 open은 하나의 session id를 가진다.

```ts
type TodoFormSessionId = string;
```

state model:

```ts
type NativeTodoFormState =
  | 'collapsed'
  | 'expanding'
  | 'expanded'
  | 'collapsing'
  | 'closing';
```

JS는 canonical state를 단순화해 `collapsed` / `expanded` 관점에서 다루되, native는 transition state를 내부적으로 가질 수 있다.

목적:

- stale callback 무시
- transition 중 중복 open/close 차단
- animation completion 후 후속 action 처리

## JS Coordinator

### Responsibilities

- session open/update/close orchestration
- `useTodoFormStore`와 연결
- create/edit entry source 관리
- `useTodoFormLogic`와 연결
- native event 수신 후 JS form state 반영
- submit intent 처리
- external detail surface readiness 관리

### Coordinator Inputs

- `useTodoFormStore`
- `useTodoFormLogic`
- `useTodoFormV2Store` 또는 후속 draft store
- future edit mode entry

### Coordinator Outputs

- `NativeTodoFormSessionBridge.open(config)`
- `NativeTodoFormSessionBridge.update(config)`
- `NativeTodoFormSessionBridge.dismiss(sessionId)`

## JS <-> Native Contract

### Open / Update Payload

```ts
type NativeTodoFormSessionConfig = {
  sessionId: string;
  visualState: 'collapsed' | 'expanded';
  title: string;
  categoryLabel: string;
  dateLabel: string;
  repeatLabel: string;
  canQuickSubmit: boolean;
  isEditMode: boolean;
  detailSurfaceReady: {
    header: boolean;
    body: boolean;
    modalChild: boolean;
  };
};
```

설명:

- `visualState`는 native shell이 목표 상태를 아는 데 사용한다.
- `detailSurfaceReady`는 external detail surface가 늦게 연결될 때 placeholder 정책을 제어한다.

### Native Event Contract

```ts
type NativeTodoFormDismissReason =
  | 'backdrop'
  | 'back'
  | 'keyboard'
  | 'submit'
  | 'programmatic';

type NativeTodoFormEvent =
  | { type: 'changeTitle'; sessionId: string; title: string }
  | { type: 'requestExpand'; sessionId: string; title: string; source: 'drag' | 'button' | 'action' }
  | { type: 'requestCollapse'; sessionId: string; title: string; source: 'drag' | 'button' | 'back' }
  | { type: 'quickSubmit'; sessionId: string; title: string }
  | { type: 'selectCategory'; sessionId: string; title: string; categoryId: string }
  | { type: 'pressCategory'; sessionId: string; title: string }
  | { type: 'pressDate'; sessionId: string; title: string }
  | { type: 'pressRepeat'; sessionId: string; title: string }
  | { type: 'detailSubmit'; sessionId: string; title: string }
  | { type: 'dismiss'; sessionId: string; title: string; reason: NativeTodoFormDismissReason }
  | { type: 'stateSettled'; sessionId: string; state: 'collapsed' | 'expanded' | 'closed' };
```

핵심 규칙:

- action event는 항상 latest title을 포함한다.
- JS는 action 처리 전에 title을 canonical form state에 먼저 반영한다.
- per-frame drag progress는 JS로 보내지 않는다.
- JS는 discrete event만 받는다.

## Native Session Host

각 플랫폼은 "세션 호스트"를 가진다.

세션 호스트 역할:

- dim backdrop 관리
- keyboard tracking
- drag expand / collapse gesture
- focus 이동
- collapsed surface 렌더
- expanded shell 렌더
- detail child surface mount point 제공

## State Layout Model

### Collapsed

- 작은 bottom composer
- title input
- quick action row
- quick submit button

Quick action row policy:

- `category`: inline lightweight selection action
- `date`: expanded detail entry action
- `repeat`: expanded detail entry action

### Expanded

- 더 큰 panel 또는 full-height form container
- detail header area
- detail scroll/content area
- optional child modal/surface slot

Expanded composition rule:

- collapsed quick UI는 `expanded`에서 별도 레이어로 남지 않는다.
- expand 전환의 결과는 `quick + detail` 중첩이 아니라, quick surface가 detail header/form chrome으로 변형된 상태여야 한다.
- title input, submit affordance, 현재 값 요약은 detail header 안으로 흡수될 수 있지만, quick 전용 strip/action row가 expanded 상단에 그대로 붙어 있어서는 안 된다.

Expanded gesture zoning:

- `header/grabber zone`
  - 시트 drag / collapse / dismiss 제어 surface
- `body scroll zone`
  - detail content scrolling 우선 surface

기본 원칙은 `본문은 스크롤`, `시트 제어는 헤더`다.

### Transition

- same host 안에서 height / layout / focus 상태만 바뀐다.
- route change는 일어나지 않는다.
- 전환 완료 후 visual hierarchy는 `detail header + detail body`로 정리되어야 한다.

## iOS Design

## Primitive

- UIKit 기반 custom session host
- keyboard accessory-style 입력 경험 유지
- expanded 시 page-sheet 유사 경험을 줄 수 있으나, 핵심은 same-session expand다

## Interaction Model

- open -> collapsed
- drag up -> expanded
- explicit expand affordance -> expanded
- submit success -> dismiss
- backdrop / dismiss gesture -> collapsed or dismiss

Collapsed category action:

- `UIButton` 또는 동등한 native control에 `UIMenu`를 연결한다.
- `showsMenuAsPrimaryAction` 방식의 tap-triggered pull-down menu를 기본안으로 둔다.
- `UIContextMenuInteraction`은 quick category 1차 action의 기본안으로 사용하지 않는다.
- category 선택 시 same-session 안에서 label과 JS canonical state를 즉시 갱신한다.
- `카테고리 추가/관리`처럼 메뉴만으로 충분하지 않은 action은 expanded detail 또는 child surface로 넘긴다.

Expanded gesture policy:

- header 또는 상단 grabber를 잡고 drag-down 하면 page-sheet처럼 collapse/dismiss 제어가 가능해야 한다.
- body는 기본적으로 scroll-first surface다.
- 단, body scroll이 최상단(top)일 때는 iOS page-sheet 관례처럼 downward pull이 시트 collapse/dismiss로 자연스럽게 연계될 수 있다.
- 즉 iOS는 `header/grabber 중심 + scroll-top일 때 제한적 body 연계`를 허용한다.

## Keyboard Policy

- collapsed에서는 빠른 입력에 최적화
- expanded 전환 중 focus continuity를 보장
- keyboard와 panel transition이 같은 native transaction 안에서 움직여야 함

## Android Design

## Primitive

- `DialogFragment` 기반 session host
- transparent/full-screen window
- bottom-aligned native container
- expanded는 같은 `DialogFragment` 내부 panel 확장으로 처리

중요:

- plain detail sheet를 새로 여는 방식이 아니다.
- 하나의 `DialogFragment` 내부에서 collapsed/expanded를 전환한다.

## Interaction Model

- open -> collapsed quick composer
- drag up -> panel expand
- explicit expand affordance -> panel expand
- system back:
  - expanded 상태면 collapse 또는 dismiss 정책 적용
  - collapsed 상태면 dismiss
- backdrop tap:
  - collapsed 상태면 dismiss
  - expanded 상태면 플랫폼 정책에 따라 collapse 또는 dismiss

Collapsed category action:

- 기본안은 anchor 기반 `PopupMenu`다.
- category 버튼 tap 시 same-session 안에서 lightweight anchored menu를 띄운다.
- category 선택 시 same-session 안에서 label과 JS canonical state를 즉시 갱신한다.
- category 수가 많거나 custom row 표현이 필요해 `PopupMenu`가 부족해질 경우에만 `ListPopupWindow` 또는 child surface로 승격한다.
- 1차 구현과 freeze 기준은 `PopupMenu`다.

Expanded gesture policy:

- drag-down 제어 surface는 header 또는 handle 영역으로 제한하는 것을 기본안으로 둔다.
- body는 scroll-first surface다.
- body 임의 영역에서 panel drag-dismiss를 허용하지 않는다.
- Android는 iOS보다 보수적으로 gesture를 해석하며, expanded detail에서 `본문은 스크롤`, `헤더는 시트 제어` 원칙을 더 강하게 유지한다.

## IME Policy

- open 시 `EditText` focus
- IME와 panel이 충돌 없이 함께 움직여야 함
- drag 중 JS sync 금지
- state settle 후 필요한 discrete event만 JS로 전달

## External Detail Surface Integration

이번 설계는 detail body 자체를 정의하지 않고, 세 가지 슬롯을 정의한다.

### 1. Header Slot

- title row
- save / close affordance
- optional back/collapse affordance

### 2. Body Slot

- calendar
- category selector
- recurrence section
- memo / switch / date-time sections

### 3. Child Surface Slot

- category create
- color picker
- recurrence picker
- nested subflow

이 슬롯들은 native view일 수도 있고, 별도 adapter를 통한 surface일 수도 있다.
session host는 이들 surface의 내부 구현을 알지 않는다.

## Data / Submit Ownership

native session이 소유하지 않는 것:

- payload normalization
- recurrence rule build
- category persistence
- create/update mutation
- pending queue / sync

JS가 계속 소유하는 것:

- canonical `formState`
- quick/detail submit semantics
- create vs edit branching
- toast / success / error follow-up

## Migration Strategy

### Phase 1

- single native session host 설계/구현
- collapsed quick baseline
- expand/collapse shell
- external detail surface slot 연결점 정의

### Phase 2

- detail 내부 surface 연결
- create flow 전체 native session 경로로 통합

### Phase 3

- edit flow를 같은 native session으로 이관
- legacy route/modal path 정리

## Explicit Non-Goals

이번 설계는 아래를 다루지 않는다.

- Web renderer 복구
- quick와 detail을 서로 다른 세션으로 유지하는 절충안
- route push 기반 quick -> detail handoff 유지
- external detail surface 내부의 최종 UX 세부 고정
