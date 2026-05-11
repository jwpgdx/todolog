# Native Todo Form Session — Requirements

## Goal

`todo form`의 `quick mode`와 `detail mode`를 서로 다른 화면/세션으로 보지 않고, 하나의 네이티브 `todo form session`으로 다시 설계한다.

이 세션은 최소 두 상태를 가진다.

- `collapsed quick`
- `expanded detail`

핵심 목표는 아래와 같다.

- iOS와 Android에서 각각 자연스러운 네이티브 입력 경험 제공
- quick -> detail 전환을 route handoff가 아니라 세션 내부 상태 전환으로 처리
- 드래그 확장, 키보드, dismiss, back 동작을 네이티브에서 안정적으로 처리
- 기존 JS 비즈니스 로직과 offline-first 데이터 계약은 유지

## Scope

- ✅ 별도 스펙 폴더 추가: `.kiro/specs/native-todo-form-session/`
- ✅ `iOS` / `Android` 단일 native form session 요구사항 정의
- ✅ `collapsed quick` / `expanded detail` 상태 정의
- ✅ quick -> detail drag expand 정책 정의
- ✅ JS/native bridge 및 session contract 정의
- ✅ submit / dismiss / draft sync contract 정의
- ✅ detail 내부 surface 통합 경계 정의
- ✅ 기존 route-based quick -> detail handoff를 대체하는 방향 정의

- ❌ Web 지원
- ❌ Expo UI / SwiftUI / Jetpack Compose 도입
- ❌ SQLite / sync / API 계약 변경
- ❌ detail 내부 달력 / dropdown / recurrence surface 자체 구현 세부 확정
- ❌ production-ready native module 배포까지 보장
- ❌ 기존 edit entry (`openDetail(todo)`)를 이번 단계에서 즉시 migration 완료 보장

## External Dependency Assumption

현재 `detail mode` 내부 surface 일부는 다른 Codex 세션에서 작업 중이며, 완성 후 가져다 쓰는 방식으로 통합할 예정이다.

이번 스펙에서 이 surface들은 아래처럼 취급한다.

- calendar surface
- category selector / create surface
- recurrence surface
- 기타 detail body controls

즉, 이번 스펙의 source of truth는 "세션 구조와 통합 계약"이며, 내부 위젯 자체의 UI 세부 규칙은 해당 작업의 산출물을 따른다.

## Product Intent

이번 작업의 목적은 quick를 네이티브로, detail을 나중에 따로 네이티브로 바꾸는 식의 반쪽 migration이 아니다.
목적은 "todo form 전체를 하나의 native session으로 본다"는 전제를 먼저 고정하는 것이다.

즉:

- quick는 detail의 축약 상태다.
- detail은 quick의 다른 화면이 아니라 같은 세션의 확장 상태다.
- drag expand는 네비게이션이 아니라 세션 상태 전환이다.
- JS는 business rules를 소유하고, 네이티브는 form session UX를 소유한다.

## Freeze Decisions

1. 이번 스펙의 SOT는 `.kiro/specs/native-todo-form-session/`이다.
2. 기존 `.kiro/specs/native-quick-mode/`는 superseded 상태로 본다.
3. quick와 detail은 단일 native session 안의 두 상태다.
4. quick -> detail 전환은 원칙적으로 route push가 아니라 native session expand다.
5. drag up으로 expand하는 UX는 phase 1 범위에 포함한다.
6. detail collapse 가능 여부는 플랫폼 UX 기준으로 허용하되, 최소한 dismiss와 full expand는 지원해야 한다.
7. detail 내부 달력 / dropdown / recurrence는 "외부 제공 surface"로 통합한다.
8. submit / validation / payload 생성 / offline sync는 계속 JS를 source of truth로 둔다.
9. canonical todo schedule contract는 변경하지 않는다.
10. legacy payload field는 계속 금지한다:
   - `date`
   - `startDateTime`
   - `endDateTime`
   - `timeZone`
11. `expanded detail` 상태에서는 quick mode가 별도 strip/composer 레이어로 남아 있으면 안 된다.

## Hard Constraints

1. Offline-first / SQLite SOT 아키텍처를 건드리지 않는다.
2. native session은 직접 서버 호출을 하지 않는다.
3. JS bridge는 per-frame animation state를 주고받지 않는다.
4. gesture / animation / keyboard tracking은 native에서 처리한다.
5. dismiss / close callback은 중복 호출에 안전해야 한다.
6. 마지막 입력 title은 expand / submit / dismiss 직전 절대로 유실되면 안 된다.
7. quick 기본 의미는 계속 "오늘 날짜 + 하루종일"이다.
8. quick submit semantics는 유지된다.
   - `quickMode=true`
   - `isAllDay=true`
   - `startTime`, `endTime` 제거
9. detail submit semantics는 기존 detail payload contract를 유지한다.
10. detail 내부 surface 통합이 늦어져도 session shell은 독립적으로 설계 가능해야 한다.

## Functional Requirements

### FR-1: Single Native Todo Form Session

todo form은 open 시 하나의 native session으로 시작해야 한다.

세션은 최소 아래 state를 가진다.

- `collapsed`
- `expanded`
- `closing`

필요 시 내부 substate를 가질 수 있지만, 외부 계약은 위 상태를 기준으로 본다.

### FR-2: Collapsed Quick State

collapsed 상태는 최소 아래 UI를 제공해야 한다.

- title input
- submit button
- category action
- date action
- repeat action

collapsed 상태는 빠른 입력과 quick submit에 최적화되어야 한다.

quick action policy:

- `category`는 collapsed 상태에서 바로 변경 가능한 action이어야 한다.
- 즉 `category` tap이 항상 detail expand를 요구해서는 안 된다.
- `category` action은 anchored menu 또는 동등한 lightweight selection UI를 통해 즉시 선택 가능해야 한다.
- `date`와 `repeat`는 기본적으로 expanded detail 진입 action으로 본다.
- `category` 관련 고급 작업(예: 추가/관리)이 필요한 경우에만 expanded detail 또는 child surface로 승격할 수 있다.

### FR-3: Expanded Detail State

expanded 상태는 detail form body를 보여준다.

expanded 상태는 최소 아래 성격을 가져야 한다.

- 더 큰 height 또는 full-screen에 가까운 form container
- detail header / body / scroll area
- external detail surfaces 삽입 가능
- 기존 detail submit 의미 유지

expanded composition rule:

- quick mode는 `expanded`에서 독립된 상단 bar/composer로 남지 않는다.
- collapsed quick surface는 expand 과정에서 detail header 또는 form chrome으로 흡수되어야 한다.
- `expanded`에서 사용자에게 보이는 구조는 `detail header + detail body`여야 한다.
- title/value continuity는 유지하되, quick 전용 capsule row나 quick strip이 중복 표시되어서는 안 된다.

이 스펙은 expanded 내부의 개별 위젯 UI를 정의하지 않는다.
대신 아래 통합 슬롯만 요구한다.

- header slot
- form body slot
- modal child surface slot (optional)

expanded 상태의 gesture 불변식:

- 시트 제어 gesture는 `header` 또는 명시적 `grabber` 영역이 primary surface여야 한다.
- `form body`는 기본적으로 스크롤 우선 surface다.
- 본문 임의 영역을 잡아 시트를 직접 drag하는 상호작용은 기본 정책으로 허용하지 않는다.

### FR-4: Expand Interaction

collapsed -> expanded 전환은 최소 아래 경로를 지원해야 한다.

- drag up gesture
- explicit expand affordance
- quick action으로 detail 진입이 필요한 경우

이 전환은 route navigation이 아니라 같은 native session 내 상태 전환이어야 한다.

전환 중 불변식:

- title draft 유지
- session 유지
- keyboard / focus 정책 일관성 유지

### FR-5: Collapse / Dismiss Interaction

세션은 아래 닫힘/전환 동작을 지원해야 한다.

- backdrop tap
- platform back
- keyboard dismiss와 연계된 close 또는 state change
- submit 성공 후 close

expanded 상태에서 아래 중 최소 하나는 플랫폼 정책으로 명확해야 한다.

- drag down -> collapsed
- drag down -> dismiss
- explicit close only

공통 gesture 정책:

- expanded 상태의 drag-down 제어는 `header/grabber` 영역을 기본 진입점으로 사용한다.
- 본문 영역은 스크롤 우선이며, 시트 drag보다 스크롤 해석이 우선되어야 한다.
- 플랫폼이 허용하더라도 "본문 아무 데서나 잡아 내리는 dismiss"를 공통 정책으로 채택하지 않는다.

정확한 iOS / Android 차이는 design에서 플랫폼별로 정의한다.

### FR-6: JS / Native Session Contract

JS는 native session에 최소 아래 state를 전달할 수 있어야 한다.

- mode: `collapsed` | `expanded`
- title
- category label
- date label
- repeat label
- canQuickSubmit
- external surface readiness flags

native는 JS에 최소 아래 이벤트를 보낼 수 있어야 한다.

- title change
- quick submit
- category selected
- expand request
- category action
- date action
- repeat action
- detail submit
- dismiss
- state transition completed

### FR-7: External Detail Surface Integration

detail 내부 달력 / dropdown / recurrence surface는 이번 스펙의 구현 범위 밖이지만, session 안에서 삽입 가능해야 한다.

불변식:

- session shell은 내부 surface 구체 구현을 모른다.
- 내부 surface는 JS 또는 native adapter를 통해 붙을 수 있다.
- expanded body는 해당 surface가 늦게 연결되어도 mount 순서에 안전해야 한다.

### FR-7.1: Quick Category Action Policy

collapsed 상태의 `category` action은 플랫폼별 네이티브 lightweight menu를 사용한다.

기본안:

- iOS: pull-down menu
- Android: anchored popup menu

불변식:

- menu open/close는 same-session 안에서 처리한다.
- category 변경은 expanded detail 진입 없이 즉시 반영 가능해야 한다.
- 선택 결과는 canonical JS form state와 quick label에 즉시 반영되어야 한다.
- 메뉴에서 해결 불가능한 action만 expanded detail 또는 child surface로 넘긴다.

### FR-8: Quick Submit Contract

collapsed 상태에서 submit은 기존 quick submit contract를 그대로 사용해야 한다.

불변식:

- quick submit은 항상 JS `handleSubmit({ quickMode: true })` 의미를 유지한다.
- `isAllDay=true`
- 시간 필드는 제거된다.
- startDate / category / recurrence draft는 현재 JS 상태를 따른다.

### FR-9: Detail Submit Contract

expanded 상태에서 submit은 기존 detail submit contract를 그대로 사용해야 한다.

즉:

- normalized payload 생성은 JS 로직이 담당한다.
- native는 submit intent와 최신 draft만 전달한다.

### FR-10: Editing / Create Session Compatibility

장기적으로 create와 edit 모두 같은 native session 구조를 쓸 수 있어야 한다.

이번 단계에서 최소 요구사항:

- create session 우선 설계
- edit session도 같은 아키텍처로 확장 가능해야 함
- 기존 edit entry를 막는 설계를 하면 안 됨

## Non-Functional Requirements

- drag expand는 네이티브 기준으로 부드럽게 보여야 한다.
- 세션 open/close/expand/collapse 중 flicker가 없어야 한다.
- keyboard와 container animation이 충돌하면 안 된다.
- detail surface가 늦게 준비되어도 session이 crash하면 안 된다.
- Web은 active acceptance path에서 제외한다.
