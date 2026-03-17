# External Review Log: Todo Calendar V2 Line Monthly

Date: 2026-03-14
Model: Opus
Verdict: Not ready

## Triage Summary

### Must-fix findings

1. Deterministic lane allocation / overflow / hiddenCount contract
   - Classification: accepted
   - Reason:
     - Original spec left room for multiple valid implementations with different
       lane packing and overflow behavior.
     - Requirements / design / tasks were updated to freeze:
       - exact final sort key
       - row-local lane allocation
       - lane conflict definition
       - per-covered-day hiddenCount increment for hidden segments

2. 42-day grid / adjacent-month rendering / `startDayOfWeek` boundary
   - Classification: accepted
   - Reason:
     - Original spec did not explicitly state whether leading/trailing
       adjacent-month cells were renderable event cells.
     - Requirements / design / tasks were updated to freeze:
       - renderable adjacent-month cells inside visible 42-day grid
       - cross-month clipping against visible grid only
       - week-row segmentation based on `user.settings.startDayOfWeek`

3. Loading bounds / retention / subscription / scroll update policy
   - Classification: accepted
   - Reason:
     - Performance was a stated priority, but the original spec did not bound
       visible buffer, retention window, or projection update timing.
     - Requirements / design / tasks were updated to freeze:
       - visible load window = current visible month + `±1 month`
       - retention window = anchor `±6 months`
       - no per-frame projection/store writes during active scroll
       - subscriptions scoped to visible month layouts or day cells

4. Completion glyph ambiguity in frozen baseline
   - Classification: accepted
   - Reason:
     - The original spec allowed two different frozen outcomes.
     - Completion glyphs were removed from the frozen baseline and deferred to a
       follow-up spec after baseline performance validation.

### Medium / optional findings

1. Canonical date-string renderer boundary
   - Classification: accepted
   - Reason:
     - Added explicit rule that renderer consumes shared-query canonical
       `YYYY-MM-DD` strings and must not reinterpret day boundaries with local
       `Date` math.

2. Continuation cue definition
   - Classification: accepted
   - Reason:
     - Added baseline visual rule:
       - continuing side = flat/clipped
       - true segment start/end = normal end-cap shape
       - no platform-specific cue variants

3. Deterministic fixture matrix
   - Classification: accepted
   - Reason:
     - Added explicit fixture matrix task for:
       - cross-week spans
       - cross-month spans
       - Sunday/Monday week starts
       - timed multi-day spans
       - ordering collisions
       - overflow with fully occupied span lanes

## Answered Review Questions

1. Navigation model
   - Frozen as: vertically scrollable month list

2. Cross-row lane continuity
   - Frozen as: row-local packing only; no guaranteed cross-row lane identity

3. Adjacent-month cell treatment
   - Frozen as: same line/overflow rendering, muted date styling allowed

## Outcome

The spec was revised after this review.

Expected next state:
- re-review should move from `Not ready` to at least `Conditionally ready`
- no remaining blocker is intentionally left unresolved in the frozen baseline
