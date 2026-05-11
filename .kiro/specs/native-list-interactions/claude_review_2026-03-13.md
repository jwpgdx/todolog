# Claude Review Log — 2026-03-13

- Reviewer: Claude
- Scope:
  - `.kiro/specs/native-list-interactions/requirements.md`
  - `.kiro/specs/native-list-interactions/design.md`
  - `.kiro/specs/native-list-interactions/tasks.md`
- Verdict: Not ready

## Accepted Findings

### must-fix

1. 삭제 이벤트 계약이 `onDelete`와 `onMenuAction('delete')` 사이에서 충돌함
2. public test route 구조와 auth gate 예외 정책이 불명확함
3. row/category schema가 느슨해서 구현 드리프트 위험이 큼
4. iOS same-touch handoff가 보장 기능처럼 읽힘
5. validation 범위가 row variant / callback 계약 / public route 검증을 충분히 포함하지 않음

### optional

1. Android action surface 용어를 추후 한 번 더 정리
2. public API와 내부 구현 컴포넌트의 경계를 더 명확히 유지

### reject

- 없음

## Resolution

- `onDelete`를 삭제의 유일한 canonical callback으로 고정
- `onMenuAction`에서는 delete를 제외
- menu row를 discriminated union으로 강화
- category row를 capability 기반 schema로 분리
- public route를 mandatory requirement로 명시하고 `/(app)` route는 보조 재사용 route로 격하
- same-touch handoff를 phase 1 실험 verdict로 재정의
- validation 항목에 switch/value-navigation/single trailing/public access를 추가
