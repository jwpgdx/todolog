# Native Todo Form Session — Tasks

## Task 1: Spec Baseline

- `requirements.md` 작성
- `design.md` 작성
- `tasks.md` 작성
- quick/detail 단일 native session 범위 freeze
- 기존 `native-quick-mode` superseded 처리

## Task 2: Session Architecture Scaffold

- JS session coordinator 초안 작성
- active session id 전략 추가
- `collapsed` / `expanded` visual state 계약 추가
- stale callback guard 추가
- create flow entry와 연결
- 기능 연결 전 shell 검증을 위해 `TodoScreen` 임시 버튼으로 여는 prototype 경로를 허용

## Task 3: Native Bridge Contract

- JS wrapper 설계
- `open(config)` / `update(config)` / `dismiss(sessionId)` 계약 정의
- native event emitter 계약 정의
- discrete event만 JS로 전달하는 원칙 적용
- latest title flush 규칙 고정

## Task 4: iOS Native Session Host

- UIKit 기반 session host 구현
- collapsed quick composer 구현
- drag up expand 구현
- explicit expand affordance 구현
- dismiss / keyboard / backdrop 처리 구현
- expanded shell 구현
- header/body/child surface slot mount point 구현

## Task 5: Android Native Session Host

- `DialogFragment` 기반 session host 구현
- transparent/full-screen window 구성
- bottom-aligned collapsed composer 구현
- collapsed category `PopupMenu` 구현
- drag up expand 구현
- system back / backdrop 정책 구현
- expanded shell 구현
- header/body/child surface slot mount point 구현
- IME 대응 구현

## Task 6: Shared JS Logic Integration

- `useTodoFormLogic`와 연결
- latest title를 native event마다 JS form state에 반영
- quick submit -> `handleSubmit({ quickMode: true })` 연결
- quick category select -> JS canonical form state 반영 연결
- detail submit -> 기존 detail submit semantics 연결
- create/update branching 유지

## Task 7: External Detail Surface Integration Layer

- calendar surface 연결 지점 정의
- category surface 연결 지점 정의
- recurrence surface 연결 지점 정의
- readiness flag / placeholder 정책 정의
- 다른 터미널 작업 산출물과 merge 가능한 adapter 경계 정의

## Task 8: Expand / Collapse UX Validation

### Shared Checkpoints

- open 시 collapsed composer가 한 번만 열린다.
- drag up으로 expanded 전환이 가능하다.
- explicit 버튼으로도 expanded 전환이 가능하다.
- expand 중 title draft가 유실되지 않는다.
- expand 후 detail body mount가 늦어져도 crash가 없다.
- dismiss / close 중복 호출로 crash가 없다.
- expanded 상태가 되면 quick strip/composer가 별도 레이어로 남지 않고 detail header로 흡수된다.
- expanded 상태에서 body 영역은 scroll-first로 동작한다.
- expanded 상태에서 시트 제어 gesture는 header/handle 영역에서 우선 동작한다.
- collapsed category action이 expanded 진입 없이도 즉시 category를 바꿀 수 있다.

### iOS Checkpoints

- collapsed 입력이 keyboard accessory 느낌으로 동작한다.
- drag expand가 부드럽다.
- expanded 전환 후 focus/keyboard가 어색하게 끊기지 않는다.
- submit 성공 후 session이 정상 종료된다.
- header/grabber drag-down이 page-sheet스럽게 동작한다.
- body scroll이 top일 때만 downward pull이 자연스럽게 collapse/dismiss에 연계된다.
- collapsed category 버튼 tap 시 `UIMenu` pull-down이 뜬다.
- iOS quick category action은 context menu가 아니라 primary-action menu로 동작한다.

### Android Checkpoints

- `DialogFragment` 기반 session이 안정적으로 열린다.
- collapsed composer가 bottom anchored로 보인다.
- drag expand가 detail sheet 재오픈 없이 같은 session 안에서 일어난다.
- IME와 panel이 충돌하지 않는다.
- system back 정책이 일관된다.
- header/handle drag-down이 panel 제어 surface로 동작한다.
- body 임의 영역 drag가 dismiss와 충돌하지 않고 스크롤 우선으로 해석된다.
- collapsed category 버튼 tap 시 anchored `PopupMenu`가 뜬다.
- category 수가 적은 기본 시나리오에서 expanded detail 진입 없이 category를 바꿀 수 있다.

## Task 9: Migration / Cleanup Plan

- 기존 quick overlay 경로 비활성화 계획 수립
- 기존 route-based quick -> detail handoff 제거 계획 수립
- legacy detail modal path 정리 시점 기록
- create flow 우선 전환 후 edit flow 이관 계획 기록

## Task 10: Documentation / Decision Record

- external detail surface 의존성 기록
- iOS primitive 최종 선택 기록
- Android `DialogFragment` host 결정 기록
- expand/collapse 최종 정책 기록
- 필요 시 `PROJECT_CONTEXT.md` / `ROADMAP.md` 업데이트
