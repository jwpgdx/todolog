# Phase 3 Recurrence Engine Core — Spec Review

## Verdict: ✅ Green Light (with 4 notes below)

The spec (ONE_PAGER, requirements R1-R10, design, tasks) is **well-structured, correctly scoped, and aligns with design principles**. The codebase audit confirms this is both necessary and achievable.

---

## R1-R10 Requirement Alignment

| Req | Status | Notes |
|-----|--------|-------|
| R1: Engine Independence | ✅ | No `rrule` dependency. Self-contained. |
| R2: Input Coverage | ✅ | RRULE string, object, array — matches existing [extractRecurrenceEndDateFromValue](file:///Users/admin/Documents/github/todo/client/src/services/db/database.js#508-549) patterns |
| R3: Normalized Rule | ✅ | Single contract replaces ad-hoc parsing in [checkRecurrenceOnDate](file:///Users/admin/Documents/github/todo/client/src/utils/recurrenceUtils.js#360-433) |
| R4: Date-only Safety | ✅ | Critical. Current code has **6 violations** (see below) |
| R5: End-date Resolution | ✅ | [extractRecurrenceEndDateFromValue](file:///Users/admin/Documents/github/todo/client/src/services/db/database.js#508-549) already handles multi-source — engine formalizes this |
| R6: Frequency Semantics | ✅ | daily/weekly/monthly/yearly — matches current [checkRecurrenceOnDate](file:///Users/admin/Documents/github/todo/client/src/utils/recurrenceUtils.js#360-433) switch cases |
| R7: Edge-case Policy | ⚠️ | **New territory** — current code has no short-month/leap-year handling. See Note 1 |
| R8: DB Contract | ✅ | Schema already has `recurrence_end_date` + `idx_todos_recurrence_window`. v4 migration exists |
| R9: Greenfield Init | ✅ | `SCHEMA_SQL` already includes the column. Reset path exists via [resetDatabase()](file:///Users/admin/Documents/github/todo/client/src/services/db/database.js#763-777) |
| R10: Validation Baseline | ✅ | Tasks 8-12 cover this with checkpoints |

---

## Codebase Audit: Current Date-Safety Violations (R4)

The new engine will fix these. For reference, here's what exists today:

| File | Line | Violation |
|------|------|-----------|
| [recurrenceUtils.js](file:///Users/admin/Documents/github/todo/client/src/utils/recurrenceUtils.js#L389) | 389 | `new Date(startDate + 'T00:00:00')` |
| [recurrenceUtils.js](file:///Users/admin/Documents/github/todo/client/src/utils/recurrenceUtils.js#L390) | 390 | `new Date(targetDate + 'T00:00:00')` |
| [recurrenceUtils.js](file:///Users/admin/Documents/github/todo/client/src/utils/recurrenceUtils.js#L338) | 338 | `new Date(todo.startDateTime)` inside [occursOnDate](file:///Users/admin/Documents/github/todo/client/src/utils/recurrenceUtils.js#308-359) |
| [todoFilters.js](file:///Users/admin/Documents/github/todo/client/src/utils/todoFilters.js#L28) | 28 | `new Date(todo.startDateTime)` |
| [todoFilters.js](file:///Users/admin/Documents/github/todo/client/src/utils/todoFilters.js#L29) | 29 | `toISOString().split('T')[0]` |
| [todoFilters.js](file:///Users/admin/Documents/github/todo/client/src/utils/todoFilters.js#L56) | 56 | `new Date(year, month, 0).toISOString().split('T')[0]` |

> [!IMPORTANT]
> [todoFilters.js](file:///Users/admin/Documents/github/todo/client/src/utils/todoFilters.js) is **not in spec scope** (it's a consumer, not engine). But it MUST be updated in Phase 3 Step 2 (공통 경로 연결) since it imports [occursOnDate](file:///Users/admin/Documents/github/todo/client/src/utils/recurrenceUtils.js#308-359) from the old utils.

---

## 4 Notes for Implementation

### Note 1: Edge-case Policy Needs Explicit Test Cases

R7 mentions short-month + 31st and leap-year 2/29 but the policy is **"skip"** and **"윤년만"**. This is correct, but confirm these specific test cases are in scope:

- Monthly BYMONTHDAY=31 on Feb → **skip** (no occurrence)
- Monthly BYMONTHDAY=31 on Apr (30 days) → **skip**
- Yearly BYMONTH=2;BYMONTHDAY=29 on non-leap year → **skip**
- Yearly BYMONTH=2;BYMONTHDAY=29 on 2028 (leap) → **occurs**

### Note 2: `dayjs` Dependency Check

The spec says `dayjs + YYYY-MM-DD`. Verify `dayjs` is in [client/package.json](file:///Users/admin/Documents/github/todo/client/package.json/Users/admin/Documents/github/todo/client/package.json). If not, it needs adding — or the engine should use pure string arithmetic (which is feasible for date-only operations and avoids a new dependency).

### Note 3: [recurrenceUtils.js](file:///Users/admin/Documents/github/todo/client/src/utils/recurrenceUtils.js) Deprecation Path

The spec lists [recurrenceUtils.js](file:///Users/admin/Documents/github/todo/client/src/utils/recurrenceUtils.js) as a "호환 래퍼 정리" target. Clarify the strategy:

- **Option A**: Keep [recurrenceUtils.js](file:///Users/admin/Documents/github/todo/client/src/utils/recurrenceUtils.js) as a thin wrapper that delegates to `recurrenceEngine.js` (backward-compatible, safer)
- **Option B**: Direct replacement + update all imports (cleaner, but touches more files)

Recommend **Option A** for this phase, **Option B** for Phase 3 Step 2.

### Note 4: `expandOccurrencesInRange` Max Expansion Guard

R7 AC4 says "range safety guard to prevent unbounded expansion." Define a concrete max:

- Suggestion: `MAX_EXPANSION_DAYS = 366` (1 year). Any range > 366 days returns an error or truncates with a warning log.
- This prevents accidental `expandOccurrencesInRange('2020-01-01', '2030-12-31')` calls from freezing the UI.

---

## Tasks Plan Assessment

The 13-task plan with traceability matrix is solid. The checkpoint pattern (A → B → C → Final) provides good verification gates. Two observations:

1. **Tasks 11-12 are marked optional (`*`)**. For R10 compliance, at least the engine unit tests (Task 11) should be **required**, not optional.
2. **Task ordering is correct**: engine first (1-5), then DB (6-7), then validation (8-13).

---

## Summary

| Category | Assessment |
|----------|-----------|
| Spec completeness | ✅ Covers all requirements |
| Design principles alignment | ✅ Single Core / Date-only / Fail-soft / SQL+Engine |
| Codebase compatibility | ✅ Schema ready, migration exists, clear replacement target |
| Risk areas | Edge-cases (Note 1), dayjs dependency (Note 2), expansion guard (Note 4) |
| Recommendation | **Proceed with implementation** |
