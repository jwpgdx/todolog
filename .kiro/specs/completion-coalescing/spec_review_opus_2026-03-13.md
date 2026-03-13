# Completion Coalescing Spec Review Log (Opus, 2026-03-13)

## Review Meta

- Model: Opus
- Date: 2026-03-13
- Verdict: `Not Ready`
- Scope:
  - `.kiro/specs/completion-coalescing/requirements.md`
  - `.kiro/specs/completion-coalescing/design.md`
  - `.kiro/specs/completion-coalescing/tasks.md`

## Triage

### Must-Fix

1. **Accept** — ready-only compaction 금지
   - 이유: 현재 queue 모델은 `failed + future next_retry_at` row를 ready subset에서 제외하지만,
     defer 로직은 전체 pending snapshot을 본다.
   - 처리:
     - supersession 분석 대상을 **전체 non-dead_letter completion snapshot**으로 수정
     - requirements/design/tasks 반영 완료

2. **Accept** — defer 체크는 compacted snapshot 기준으로 명시
   - 이유: superseded create가 in-memory dependency view에 남아 있으면
     retained delete가 여전히 잘못 defer될 수 있다.
   - 처리:
     - design/tasks에 compacted snapshot 기준 또는 superseded completion create 무시 규칙 추가

3. **Accept** — 검증 시나리오 보강
   - 이유: `>200 cutoff`, `restart after cleanup`, `failed + future retry + newer intent`
     없이는 이 스펙의 핵심 리스크를 못 잡는다.
   - 처리:
     - requirements/tasks/design validation 항목에 추가

### Optional

1. **Accept** — Phase 1 보장 범위를 “completion key 기준 최종 상태 수렴”으로 명확화
   - 이유: 서버는 duplicate create에서 최신 client UUID를 채택한다고 보장하지 않는다.
   - 처리:
     - requirements/design에 note 추가

2. **Accept** — queue order tie-breaking 주의 메모
   - 이유: 현재 정렬 키는 `created_at` 중심이라 동일 ms enqueue는 구현체 순서에 의존할 수 있다.
   - 처리:
     - 이번 스펙 본문에는 별도 규칙 추가하지 않고, 구현/후속 최적화 검토 메모로 유지

### Reject

1. **Reject** — enqueue-time compaction을 이번 범위에 포함
   - 이유: 현재 single-flight + rerun latch 구조에서는 enqueue-time rewrite가 더 위험하다.
   - 처리:
     - out-of-scope 유지

2. **Reject** — base-state-aware no-op elimination을 이번 범위에 포함
   - 이유: synced base-state tracking 계약이 없어서 설계 복잡도만 급증한다.
   - 처리:
     - out-of-scope 유지

3. **Reject** — local completion tombstone migration을 이번 범위에 포함
   - 이유: queue compaction과 별개인 schema/삭제 모델 변경이다.
   - 처리:
     - out-of-scope 유지

## Patch Summary

반영 결과:

1. `ready-only` 표현을 `sync-start full non-dead_letter snapshot` 기준으로 수정
2. superseded older failed row retire를 in-scope로 승격
3. defer/dependency 판단이 compacted snapshot을 사용해야 함을 명시
4. validation matrix에:
   - future retry failed supersession
   - raw `maxItems=200` cutoff beyond latest intent
   - cleanup 후 restart
   를 추가
5. Phase 1 guarantee를 “completion key 기준 최종 상태 수렴”으로 명시
