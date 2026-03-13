# Completion Coalescing Spec Re-Review Log (Opus, 2026-03-13)

## Review Meta

- Model: Opus
- Date: 2026-03-13
- Verdict: `Conditionally Ready`
- Freeze Decision: `Freeze after must-fix spec edits`
- Scope:
  - `.kiro/specs/completion-coalescing/requirements.md`
  - `.kiro/specs/completion-coalescing/design.md`
  - `.kiro/specs/completion-coalescing/tasks.md`

## Triage

### Must-Fix

1. **Accept** — generic pending queue rule의 좁은 예외를 명시
   - 이유: 공통 sync 스펙은 기본적으로 `성공 후 제거 / failed 유지`를 규정하지만,
     coalescing은 superseded completion row를 replay 전 retire한다.
   - 처리:
     - requirements에 “superseded non-dead_letter completion rows만 허용되는 좁은 예외” 문구 추가
     - design의 cleanup policy에도 동일한 예외 문구 추가

### Optional

1. **Accept** — design의 defer 문구를 단일 규칙으로 정리
   - 이유: requirements/tasks는 이미 compacted snapshot 기준으로 고정되어 있어,
     design도 같은 표현으로 맞추는 편이 안전하다.
   - 처리:
     - design의 “둘 중 하나” 문구 제거
     - compacted snapshot 단일 규칙으로 통일

2. **Defer** — symmetric validation case 추가
   - 내용: “older ready + newer failed(not-ready)” 대칭 케이스
   - 이유: 현재 스펙 문구만으로도 full-snapshot rule은 충분히 고정돼 있어, freeze blocker는 아님
   - 처리:
     - 후속 validation 보강 후보로 유지

### Reject

1. **Reject** — enqueue-time compaction 도입
   - 이유: single-flight + rerun latch 구조와 충돌 리스크가 더 크다.

2. **Reject** — base-state-aware no-op elimination 도입
   - 이유: synced base-state tracking 계약이 없어 이번 Phase 1 범위를 넘어선다.

3. **Reject** — local completion tombstone migration 동시 진행
   - 이유: queue compaction과 분리된 schema/삭제 모델 변경이다.

## Patch Summary

반영 결과:

1. requirements에 generic pending queue rule의 narrow exception 문구 추가
2. design의 cleanup policy에 같은 예외 문구 추가
3. design의 defer handling을 compacted snapshot 단일 규칙으로 정리
