# External Review Triage: Floating Tab Bar

Last Updated: 2026-03-24
Reviewer: External architecture review (`Opus`, multiple iterations)
Scope: `.kiro/specs/floating-tab-bar/{requirements,design,tasks}.md`

## 1. Summary

구현 전 외부 검토를 여러 차례 수행했고, 매 라운드의 finding을 `must-fix / optional / reject(stale)`로 triage했다.
최종 구현은 마지막 유효 `must-fix`였던 `/native-settings-catalog` disposition 충돌을 정리한 뒤 진행했다.

## 2. Must-Fix Findings

### 2.1 Route ownership / duplicate root route ambiguity

- Severity: Critical -> resolved
- Review concern:
  - `My Page` descendant product route ownership이 `/(app)`와 `/(app)/(tabs)/my-page/*` 사이에서 흔들리면 persistent shell이 깨질 수 있다는 지적
- Resolution:
  - `requirements.md` Decisions 14-18에서 product-owned descendant route family를 `/(app)/(tabs)/my-page/*`로 고정
  - `design.md` Route Ownership에서 duplicate root route를 legacy duplicate로 분류
  - `tasks.md` Routing checkpoint에 forbidden route search와 hotspot 검증 추가

### 2.2 Destination press / re-tap reset semantics 미정

- Severity: High -> resolved
- Review concern:
  - `My Page` nested stack에서 tab press 시 root reset인지 last-child restore인지 문서가 하나로 고정되지 않았다는 지적
- Resolution:
  - `requirements.md` Requirement 5
  - `design.md` Interaction Model
  - `tasks.md` Validation
  - 모두 `root reset / no last-child restore`로 맞춤

### 2.3 Modal / pageSheet / formSheet cover policy 미정

- Severity: High -> resolved
- Review concern:
  - persistent tab bar 계약과 sheet/modal cover policy가 섞여 있어서 런타임 동작이 갈릴 수 있다는 지적
- Resolution:
  - `requirements.md` Requirement 6
  - `design.md` Persistent Visibility Policy
  - `tasks.md` cover matrix validation
  - 에 `modal / pageSheet / formSheet` 예외를 명시

### 2.4 Reserved bottom inset contract / formula / rollout scope 충돌

- Severity: High -> resolved
- Review concern:
  - reserved inset 계산식이 design 내부에서 충돌하고, rollout 범위가 `/(app)/(tabs)` 전체 descendant와 다르게 축소되어 있다는 지적
- Resolution:
  - `requirements.md` Requirement 8
  - `design.md` Reserved Bottom Inset Contract
  - `tasks.md` Task 4 / Task 12 / Task 15
  - 에서 shared contract와 hotspot 적용 범위를 정리

### 2.5 Hotspot validation 부족

- Severity: Medium -> resolved
- Review concern:
  - `MyPageScreen`, `CategoryGroupList`, `DailyTodoList`, `CategoryTodosScreen` 같은 실제 hotspot이 tasks에 명시되지 않아 regression을 놓칠 수 있다는 지적
- Resolution:
  - `tasks.md` Routing checkpoint / Validation에 해당 파일 경로와 체크포인트를 추가

### 2.6 `/native-settings-catalog` disposition 충돌

- Severity: High -> resolved
- Review concern:
  - `requirements.md` / `design.md`는 product entry 금지인데, `tasks.md`는 "명시적 예외"를 남겨두고 있어 런타임 동작이 갈릴 수 있다는 지적
- Resolution:
  - `tasks.md`에서 "명시적 예외" 선택지를 제거
  - 최종 계약을 `product menu에서 제거` 또는 `in-shell debug-only subtree로 이동`으로 제한

## 3. Optional Findings

- None recorded as durable optional follow-up.

## 4. Rejected / Stale Findings

아래 항목은 이후 문서 패치 후에도 이전 finding을 반복한 리뷰를 `stale`로 분류한 사례다.

### 4.1 `/native-settings-catalog` handling이 spec에 없다

- Disposition: reject as stale
- Why:
  - 이후 패치된 `requirements.md`, `design.md`, `tasks.md`에는 해당 route disposition과 MyPage target inventory 검증이 이미 반영돼 있었다.

### 4.2 MyPageScreen target inventory 전수 검사가 없다

- Disposition: reject as stale
- Why:
  - 이후 패치된 `tasks.md`에서 `MyPageScreen`의 모든 navigation target 전수 확인 항목이 추가돼 있었다.

### 4.3 Padding hotspot validation이 없다

- Disposition: reject as stale
- Why:
  - `DailyTodoList.js`, `CategoryTodosScreen.js` hotspot이 이후 `tasks.md` Validation에 명시돼 있었다.

## 5. Outcome

- 구현 전 유효 `must-fix`는 모두 triage 후 문서에 반영했다.
- 마지막 유효 blocker는 `/native-settings-catalog` disposition 충돌이었고, 구현 착수 전 `tasks.md`를 `requirements/design`와 일치시키며 해소했다.
- 이후 구현은 실제 shell 구조, inset contract, route ownership, tab reset policy를 기준으로 진행했다.
