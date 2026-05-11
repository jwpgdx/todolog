# Native Quick Mode — Requirements

> Superseded on 2026-03-19 by [native-todo-form-session](/Users/admin/Documents/github/todo/.kiro/specs/native-todo-form-session/requirements.md). This spec remains as historical quick-only baseline and is no longer the source of truth for the active direction.

## Goal

`todo form`의 `quick mode`를 `iOS`와 `Android`에서 각각 네이티브 기술로 다시 구현한다.
목표는 웹/공용 UI를 유지하는 것이 아니라, 각 플랫폼에서 더 자연스럽고 안정적인 입력 경험을 제공하는 것이다.

이번 작업은 `quick mode`에 한정된다.
`detail mode`의 화면 구조, 데이터 계약, 저장 로직은 새로 설계하지 않는다.

## Scope

- ✅ 별도 스펙 폴더 추가: `.kiro/specs/native-quick-mode/`
- ✅ `iOS` 네이티브 quick composer 요구사항 정의
- ✅ `Android` 네이티브 quick composer 요구사항 정의
- ✅ JS/native bridge 계약 정의
- ✅ 기존 JS 비즈니스 로직과의 연결 전략 정의
- ✅ quick submit 경로 정의
- ✅ quick -> detail handoff 경로 정의
- ✅ `Web` 비대상화 및 acceptance surface 제거

- ❌ `detail mode` native 전환
- ❌ 기존 todo edit flow (`openDetail(todo)`) 재설계
- ❌ SQLite / sync / API 계약 변경
- ❌ `Expo UI`, `SwiftUI`, `Jetpack Compose` 도입
- ❌ quick mode swipe-up gesture 신규 도입
- ❌ category / recurrence / detail form 내부 UI 재설계

## Product Intent

이번 작업의 목적은 "한 컴포넌트를 모든 플랫폼에서 똑같이 보이게 만든다"가 아니다.
목적은 "같은 데이터 계약 위에서 iOS는 iOS답게, Android는 Android답게 quick 입력을 제공한다"이다.

즉:

- iOS는 키보드와 붙은 native composer 느낌을 우선한다.
- Android는 IME / back / bottom anchored 입력 UX를 우선한다.
- 공통화는 UI 모양이 아니라 event contract와 submit contract에서만 유지한다.

## Freeze Decisions

1. 이번 스펙의 대상은 `quick mode`만이다.
2. `detail mode`는 기존 React Native / Expo Router 경로를 유지한다.
3. `Web`은 이번 기능의 지원 대상이 아니다.
4. `quick mode`는 새 todo 생성 진입 전용이다. 기존 todo 수정은 계속 detail 경로를 사용한다.
5. `quick mode`의 저장/검증/payload 생성은 계속 JS 쪽 `useTodoFormLogic`를 source of truth로 둔다.
6. `quick -> detail` handoff는 기존 `useTodoFormV2Store` + `/todo-form/v2` 라우트 계약을 유지한다.
7. canonical todo schedule contract는 변경하지 않는다.
8. legacy payload field는 계속 금지한다:
   - `date`
   - `startDateTime`
   - `endDateTime`
   - `timeZone`
9. `client/src/features/todo/form/TECH_SPEC_TodoQuickAdd.md`는 참고 문서일 뿐 source of truth가 아니다. 이번 작업의 SOT는 `.kiro/specs/native-quick-mode/`다.

## Hard Constraints

1. Offline-first / SQLite SOT 아키텍처를 건드리지 않는다.
2. native quick UI는 직접 서버 호출을 하지 않는다.
3. 모든 create/submit 로직은 기존 JS 훅과 pending/sync 경로를 그대로 사용한다.
4. `quick mode`는 한 번에 하나의 active session만 허용한다.
5. dismiss / close callback은 중복 호출에 안전해야 한다.
6. quick mode에서 마지막 타이핑 문자는 submit 또는 detail handoff 전에 절대로 유실되면 안 된다.
7. quick mode 기본 동작은 계속 "오늘 날짜 + 하루종일"을 유지한다.
8. quick mode 저장은 계속 `quickMode=true` 의미를 유지해야 하며, 결과적으로 `isAllDay=true` + 시간 필드 제거 규칙을 따라야 한다.
9. native 구현은 async label update를 허용해야 한다.
   - 예: 기본 category가 늦게 resolve되어 label이 나중에 바뀌는 경우

## Functional Requirements

### FR-1: Quick Session Lifecycle

JS에서 `mode === 'QUICK'`가 되면 하나의 native quick session이 열린다.

아래 모든 닫힘 경로는 최종적으로 동일한 close flow로 수렴해야 한다.

- backdrop tap
- keyboard dismiss
- platform back / dismiss
- submit 성공 후 close
- quick -> detail 전환
- JS에서 명시적으로 `close()`

닫힘 이벤트는 stale session에 전달되면 무시되어야 한다.

### FR-2: Shared Quick Surface

native quick UI는 최소 아래 요소를 제공해야 한다.

- 제목 입력
- submit 버튼
- 카테고리 버튼
- 날짜 버튼
- 반복 버튼

표시 정보는 아래 canonical 의미를 유지해야 한다.

- title
- category label
- date label
- repeat label
- submit enabled state

### FR-3: iOS Native Quick Behavior

iOS quick mode는 UIKit 기반 native composer로 구현해야 한다.

행동 요구사항:

- open 시 즉시 키보드가 떠야 한다.
- composer는 키보드에 붙은 accessory-style 경험을 제공해야 한다.
- 키보드를 아래로 내리거나 dismiss gesture를 수행하면 quick mode도 닫혀야 한다.
- backdrop tap 시 quick mode가 닫혀야 한다.
- return / submit action과 버튼 submit 모두 지원해야 한다.

### FR-4: Android Native Quick Behavior

Android quick mode는 Android native UI로 구현해야 한다.

행동 요구사항:

- open 시 즉시 입력 포커스와 키보드가 떠야 한다.
- composer는 bottom anchored 입력 surface여야 하며, detail sheet처럼 보이면 안 된다.
- IME 표시/숨김에 따라 입력 surface가 안정적으로 반응해야 한다.
- backdrop tap 또는 system back으로 quick mode를 닫을 수 있어야 한다.
- IME action / submit 버튼 모두 지원해야 한다.

### FR-5: JS / Native Sync Contract

JS는 native quick session에 아래 state를 전달할 수 있어야 한다.

- 현재 title
- category label
- date label
- repeat label
- submit 가능 여부

native는 아래 action/event를 JS에 전달해야 한다.

- title change
- submit
- category press
- date press
- repeat press
- dismiss

중요 규칙:

- typing 중 native가 로컬 버퍼를 가져도 된다.
- 하지만 submit / category / date / repeat / dismiss 직전에는 최신 title이 JS에 반영되어 있어야 한다.
- quick -> detail handoff와 quick submit은 항상 "마지막 글자까지 반영된 title"을 기준으로 수행되어야 한다.

### FR-6: Quick Submit Contract

quick submit은 기존 JS submit 경로를 그대로 사용해야 한다.

불변식:

- quick mode는 `quickMode=true` 의미를 유지한다.
- quick submit 결과는 항상 `isAllDay=true`로 처리된다.
- quick submit payload에는 `startTime`, `endTime`이 포함되지 않는다.
- category, startDate, recurrence 등 quick draft에 이미 반영된 값은 기존 JS 로직대로 유지된다.

### FR-7: Quick -> Detail Handoff Contract

category / date / repeat 버튼을 누르면 quick mode는 detail mode로 전환되어야 한다.

불변식:

- quick session은 먼저 닫혀야 한다.
- 최신 title을 포함한 draft가 `useTodoFormV2Store`에 저장되어야 한다.
- detail route는 계속 `/todo-form/v2`를 사용한다.
- focus target은 아래 canonical 값만 사용한다.
  - `CATEGORY`
  - `DATE`
  - `REPEAT`

### FR-8: Out Of Scope Gesture Policy

phase 1에서는 quick mode의 신규 제스처 실험을 하지 않는다.

즉 이번 스펙에서는 아래를 요구하지 않는다.

- quick composer swipe-up -> detail 전환
- platform별 custom drag gesture 확장
- half-sheet / full-sheet 전환

먼저 native baseline 입력 경험과 contract 안정성을 확보하는 것이 우선이다.

## Non-Functional Requirements

- 키보드 표시/숨김 중 visible flicker가 없어야 한다.
- quick mode open/close 중복 호출로 crash가 나면 안 된다.
- submit / dismiss / handoff 이벤트가 중복 fire되면 안 된다.
- detail mode와 sync 경로에 회귀를 만들면 안 된다.
- `Web`은 이번 검증 대상에서 제외한다.
