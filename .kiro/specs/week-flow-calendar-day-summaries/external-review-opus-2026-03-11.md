# External Spec Review Log: Opus (2026-03-11)

Model: Opus (reviewer)  
Date: 2026-03-11 (KST)  
Scope:

- `.kiro/specs/week-flow-calendar-day-summaries/requirements.md`
- `.kiro/specs/week-flow-calendar-day-summaries/design.md`
- `.kiro/specs/week-flow-calendar-day-summaries/tasks.md`

Verdict: **Conditionally ready**

## Findings Triage

### Must-fix (Accepted)

- High: Unbounded recurrence invalidation MUST NOT collapse sparse `loadedRanges` into one contiguous `min~max`.
  - Fix: invalidate by `(todoImpactRange ∩ each loadedRanges segment)` and clip to `Retention_Window`.
  - Status: Applied to requirements/design/tasks.

- High: Category update/delete coarse invalidation (`clear()`) MUST queue one idle re-ensure for current `Active_Range` when calendar is mounted.
  - Status: Applied to requirements/design/tasks.

- High: Monthly ensure trigger MUST be “actual settle”.
  - Fix: native uses `onMomentumScrollEnd`; web/no-momentum uses debounced idle settle; `onScrollEndDrag` MUST NOT call ensure directly.
  - Status: Applied to design/tasks.

- High: Dirty refresh MUST be gated by viewport settled token.
  - Fix: mutations during drag/momentum only enqueue `dirtyRanges`; execute refresh only when settled.
  - Status: Applied to design/tasks.

- High: Per-date subscription MUST be mandatory.
  - Fix: replace range selector with `selectDaySummary(date)`; range selector is diagnostics-only; preserve object identity for unchanged `DaySummary`.
  - Status: Applied to requirements/design/tasks.

### Optional (Accepted)

- Medium: Retention pruning gating should be tightened to settled `anchorMonthId` changes and idle-only.
  - Status: Applied to requirements/design/tasks.

- Medium: Dirty refresh should avoid “ghost dots” after deletions.
  - Fix: refreshed range should materialize empty defaults before overlaying adapter output.
  - Status: Applied to design/tasks.

### Questions / Assumptions (Resolved)

- Completion semantics: whether completed occurrences affect marker calculation.
  - Decision (Product/Perf): completion state is **excluded** from day-summary markers; completion changes do **not** trigger invalidation.
  - Status: Reflected in requirements/design/tasks + review-prompt.

