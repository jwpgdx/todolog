# Native Quick Mode — Tasks

> Superseded on 2026-03-19 by [native-todo-form-session](/Users/admin/Documents/github/todo/.kiro/specs/native-todo-form-session/tasks.md). This spec remains as historical quick-only baseline and is no longer the source of truth for the active direction.

## Task 1: Spec Baseline

- `requirements.md` 작성
- `design.md` 작성
- `tasks.md` 작성
- quick mode의 freeze scope를 `iOS` / `Android` / `native-first`로 고정
- legacy quick spec의 비-SOT 상태를 문서상 명시

## Task 2: JS Orchestration Refactor

- quick mode orchestration을 `GlobalFormOverlay`에서 분리할지 결정
- active quick session lifecycle을 담당하는 JS coordinator 추가
- `useTodoFormStore`와 연결
- `useTodoFormLogic`와 연결
- stale session 방지용 session id 전략 추가
- 중복 dismiss / close guard 추가

## Task 3: Native Bridge API Scaffold

- JS wrapper 설계
- native module / event emitter interface 설계
- `open(config)` / `update(config)` / `dismiss(sessionId)` 계약 추가
- native event subscription 추가
- stale session filtering 추가
- latest title flush 규칙을 코드 계약으로 고정

## Task 4: iOS Native Quick Composer

- UIKit 기반 quick composer session 구현
- open 시 keyboard 자동 표시
- accessory-style composer UI 구현
- native title input 구현
- submit button 구현
- category / date / repeat action 구현
- backdrop dismiss 구현
- keyboard dismiss -> quick dismiss 구현
- return key submit 구현
- latest title 포함 event emit 구현

## Task 5: Android Native Quick Composer

- Android native quick composer session 구현
- open 시 `EditText` focus + keyboard 표시
- bottom anchored composer layout 구현
- submit button 구현
- category / date / repeat action 구현
- backdrop dismiss 구현
- system back dismiss 구현
- IME 변화 대응 구현
- latest title 포함 event emit 구현

## Task 6: Shared Submit / Handoff Integration

- native `submit` event를 `logic.handleSubmit({ quickMode: true })`와 연결
- native action event에서 title을 먼저 JS state에 반영
- `CATEGORY` / `DATE` / `REPEAT` focus target handoff 연결
- `useTodoFormV2Store.setDraft()` 연결
- `/todo-form/v2` route push 연결
- quick close -> route push 순서 안정화

## Task 7: Legacy Quick Path Cleanup

- web quick path를 active flow에서 제거
- quick mode desktop web redirect 제거 또는 dead path 처리
- 기존 RN quick UI 파일의 처리 방식 결정
  - 삭제
  - legacy fallback 격리
  - unused path 정리
- active path 기준 문서/주석 정리

## Task 8: Validation

### Shared Checkpoints

- `+` 버튼에서 quick mode가 한 번만 열린다.
- quick mode open/close 연타 시 crash가 없다.
- 마지막 입력 글자가 submit 전에 유실되지 않는다.
- 마지막 입력 글자가 quick -> detail handoff 전에 유실되지 않는다.
- quick submit이 기존 create flow와 동일한 pending/sync 경로를 탄다.
- quick submit payload가 canonical contract를 유지한다.
- legacy field가 새로 주입되지 않는다.
- quick dismiss가 중복 close를 만들지 않는다.

### iOS Checkpoints

- open 직후 keyboard와 composer가 바로 보인다.
- keyboard dismiss gesture 시 quick mode도 닫힌다.
- backdrop tap 시 quick mode가 닫힌다.
- submit 버튼으로 저장 가능하다.
- return key로 저장 가능하다.
- category/date/repeat 버튼이 detail handoff를 유발한다.
- handoff 후 `/todo-form/v2`에서 최신 title이 보존된다.

### Android Checkpoints

- open 직후 `EditText` focus와 keyboard가 보인다.
- composer가 detail sheet처럼 과도하게 커지지 않는다.
- backdrop tap 시 quick mode가 닫힌다.
- system back으로 quick mode가 닫힌다.
- submit 버튼으로 저장 가능하다.
- IME action으로 저장 가능하다.
- category/date/repeat 버튼이 detail handoff를 유발한다.
- handoff 후 `/todo-form/v2`에서 최신 title이 보존된다.

### Regression Checkpoints

- 기존 detail mode edit flow는 유지된다.
- `useTodoFormLogic` quick submit semantics가 바뀌지 않는다.
- `useTodoFormV2Store` handoff shape가 유지된다.
- `Web`이 active acceptance path에 남아 있지 않다.

## Task 9: Documentation / Decision Record

- 구현 완료 후 실제 iOS primitive를 기록
- 구현 완료 후 실제 Android primitive를 기록
- legacy quick RN path를 최종 삭제했는지 여부 기록
- quick mode active architecture가 native-first로 전환되었음을 관련 문서에 반영
- 필요 시 `PROJECT_CONTEXT.md` / `ROADMAP.md` 업데이트
