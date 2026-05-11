# Opus Review Log

**Model:** Opus
**Date:** 2026-03-19
**Verdict:** Not ready
**Review scope:** `native-settings-subsystem` spec package + related docs/context

## Triage Summary

| ID | Classification | Decision | Reason |
|------|------|------|------|
| `NS-01` | must-fix | accept | local Expo module scaffold가 repo-buildable shape를 누락함 |
| `NS-02` | must-fix | accept | `Custom Experiment`를 baseline으로 승격한 문구가 spike source와 충돌함 |
| `NS-03` | must-fix | accept | `menu` / `selectionNavigation` / event mapping이 bridge-concrete하지 않았음 |
| `NS-04` | must-fix | accept | `onReorderCommit`가 pinned/non-reorderable row 포함 규칙을 명시하지 않았음 |
| `NS-05` | must-fix | accept | task coverage가 requirements/design을 충분히 덮지 못했음 |
| `OF-01` | optional | accept | route example을 current My Page routing에 맞추는 편이 정합성이 높음 |
| `OF-02` | optional | accept | `countDownTimer` scope를 docs/spec에서 동일하게 맞춤 |
| `OF-03` | optional | accept | common state layer / accessibility를 spec/task로 승격 |
| `RC-01` | rejected concern | accept reject | TS/TSX 사용 자체는 repo 관례와 충돌하지 않음 |
| `RC-02` | rejected concern | accept reject | catalog-first가 즉시 production migration을 강제하지는 않음 |

## Applied Response

- spec 3종(`requirements.md`, `design.md`, `tasks.md`)에 must-fix 반영
- local module build shape 명시
- `Custom Experiment` baseline 문구 수정
- event mapping / reorder payload 규칙 명시
- task coverage 보강
- docs route/countDownTimer/common-state 정합성 보완
- 2차 재검증에서 남은 stale table / top-level doc drift / task coverage 잔여분도 추가 정리

## Follow-up Gate

- spec 문구 재검토 필요
- 이후 구현 시작 전 reviewer verdict를 `Conditionally ready` 이상으로 끌어올릴 것
