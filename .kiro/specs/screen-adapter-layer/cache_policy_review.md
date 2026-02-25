# Cache Policy Unification — Second-Pass Validation Report

> Role: Senior React Native offline-first architecture reviewer
> Date: 2026-02-22
> Pass: Second (post-must-fix patches)
> Prior review: [.kiro/specs/screen-adapter-layer/cache_policy_review.md](file:///Users/admin/Documents/github/todo/.kiro/specs/screen-adapter-layer/cache_policy_review.md)

---

## 1. Must-Fix Resolution Check

| Prior Item | Status | Evidence | Residual Risk |
|---|---|---|---|
| **[High-1]** TodoScreen invalidation co-fire | **Resolved** | `requirements.md:55` C4.4 — "SHALL co-fire TodoScreen React Query invalidation". `design.md:50-51` — explicit TodoScreen RQ path retention + co-fire. `design.md:150` — sync section co-fire. `tasks.md:57` — Task 7 sub-item includes RQ co-fire. | None. Contract is explicit and traceable. |
| **[High-2]** Unmeasurable rollback/DoD | **Resolved** | `requirements.md:74-77` C7 — 30% delay reduction, cache stats evidence, diff=0, 5s stale threshold. `design.md:170-178` — elapsed >100ms or 3x baseline, fetch >3x, delay <30%, diff >0, sync-to-refresh >5s. | None. All thresholds are concrete and measurable. |
| **[Medium-1]** In-flight dedupe undesigned | **Resolved** | `design.md:138-140` — fully-covered awaits existing Promise, partially-overlapped loads uncovered sub-range and merges. `tasks.md:39-40` — Task 4 sub-items for Promise map + partial load. | See [Medium-1] below for one edge case. |
| **[Medium-2]** Store role ambiguity | **Resolved** | `design.md:59-65` — explicit 5-item disposition list: [hasMonth](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/store/todoCalendarStore.js#121-131) → `covers()`, [hasRangeCoverage](file:///Users/admin/Documents/github/todo/client/src/features/strip-calendar/store/stripCalendarStore.js#55-56) → `covers()`, [clearAll](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/store/todoCalendarStore.js#112-120) → `invalidateAll()`, strip range tracking → internal, stores keep adapter projection only. | None. Disposition is complete. |
| **[Low-1]** Server fallback out-of-scope | **Resolved** | `design.md:185` — Non-Goal #4 explicitly excludes [useTodos](file:///Users/admin/Documents/github/todo/client/src/hooks/queries/useTodos.js#8-68) server fallback path. | None. |
| **[Low-2]** Prefetch file target missing | **Resolved** | `tasks.md:26-27` — Task 2 specifies [useStripCalendarDataRange](file:///Users/admin/Documents/github/todo/client/src/features/strip-calendar/hooks/useStripCalendarDataRange.js#25-95) + additional `useEffect` + [hasRangeCoverage](file:///Users/admin/Documents/github/todo/client/src/features/strip-calendar/store/stripCalendarStore.js#55-56) guard. | None. |

**Prior open questions:**

| Question | Status | Evidence |
|---|---|---|
| Cache stores raw or post-adapter? | **Answered** | `design.md:137` — "pre-adapter raw handoff (`itemsByDate`)" |
| Cache eviction policy? | **Answered** | `design.md:141` — "loaded range count 기본 상한 12, oldest-first" |
| TodoCalendar ±2 month prefetch preserved? | **Answered** | `design.md:99` — "기존 `visible +/-2 month` prefetch 전략은 초기 이행에서 유지" |

---

## 2. New Findings

### [Medium-1] Partially-overlapped sub-range load + eviction interaction is unspecified

**Evidence:**
- `design.md:140`: "partially overlapped면 uncovered sub-range만 추가 로드 후 merge 처리"
- `design.md:141`: "loaded range count가 기본 상한(12)을 초과하면 oldest-first로 정리"

**Why it matters:**
When a partial sub-range load merges into an existing range entry, does the merged result count as 1 range or 2? If merging produces 1 consolidated entry, eviction count stays stable. If the sub-range is stored separately and later merged asynchronously, transient range count spikes could trigger premature eviction of unrelated ranges.

This edge case only surfaces under heavy navigation (e.g., rapid scrolling through many months). For the initial implementation, "merge immediately after load completes" is the obvious choice, but the spec doesn't state this.

**Fix direction (optional, can be decided during Task 4):**

Add to `design.md:141`:

```
4. sub-range 로드 완료 후 기존 인접/겹침 range와 즉시 merge한 결과가 1개 range entry로 카운트된다.
```

---

### [Low-1] (Withdrawn) Prior citation for C7.2 used outdated wording

**Evidence:**
- Current `requirements.md:75` does not contain the quoted "zero direct calls outside cache service" wording.
- Actual C7.2 wording is cache adoption evidence (`hit/miss`, `inflight dedupe`) and does not claim direct-import detection via `getDebugStats()`.

**Why it matters:**
This finding was based on stale text from an earlier draft. Keeping it as an active issue can mislead implementation scope.

**Fix direction (optional):**
No spec action required. Keep this note as withdrawn for audit clarity.

---

### [Low-2] Task 6 (TodoCalendar transition) does not reference [useTodoCalendarData.js](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/hooks/useTodoCalendarData.js) ±2 month logic

**Evidence:**
- `tasks.md:49-52`: Task 6 says "calendar month fetch 경로에서 shared range cache 사용" and "기존 month bridge output 계약 유지"
- `design.md:99`: Confirms ±2 month strategy is preserved
- But Task 6 does not mention which file(s) change. Current code: [useTodoCalendarData.js:54-58](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/hooks/useTodoCalendarData.js#L54-L58) calculates the ±2 range, [calendarTodoService.js:62](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/services/calendarTodoService.js#L62) calls [runCommonQueryForRange](file:///Users/admin/Documents/github/todo/client/src/services/query-aggregation/index.js#94-164)

**Why it matters:**
The developer implementing Task 6 needs to know: change [calendarTodoService.js](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/services/calendarTodoService.js) to call `rangeCacheService.getOrLoadRange` instead of [runCommonQueryForRange](file:///Users/admin/Documents/github/todo/client/src/services/query-aggregation/index.js#94-164), while keeping [useTodoCalendarData.js](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/hooks/useTodoCalendarData.js) ±2 month calculation untouched. Without this file-level mapping, implementation scope is ambiguous.

**Fix direction (optional):**

Add to [tasks.md](file:///Users/admin/Documents/github/todo/.kiro/specs/cache-policy-unification/tasks.md) Task 6:

```
  - 변경 대상: `calendarTodoService.js`의 `runCommonQueryForRange` 호출을 `rangeCacheService.getOrLoadRange`로 교체
  - 유지: `useTodoCalendarData.js`의 ±2 month prefetch 범위 계산
```

---

## 3. Cross-Document Consistency Check

| Check | Result | Evidence |
|---|---|---|
| C0 ↔ tasks: TO-BE-first stated and followed | ✅ | `requirements.md:25-27`, `tasks.md:9` |
| C1 ↔ design: range cache API complete | ✅ | `requirements.md:31-34` maps to `design.md:32-34,109-132` |
| C2 ↔ tasks: Option A fully mapped | ✅ | `requirements.md:38-41` maps to Tasks 1-3 |
| C3 ↔ tasks: Option B fully mapped | ✅ | `requirements.md:45-48` maps to Tasks 4-6 |
| C4 ↔ tasks: invalidation + RQ co-fire | ✅ | `requirements.md:52-55` maps to Task 7 (L57) |
| C5 ↔ tasks: consistency verified | ✅ | `requirements.md:58-61` maps to Tasks 6, 9 |
| C6 ↔ tasks: observability | ✅ | `requirements.md:64-70` maps to Tasks 0, 2, 3, 8, 9 |
| C7 ↔ design rollback thresholds | ✅ | `requirements.md:74-77` thresholds match `design.md:170-178` |
| Scope alignment | ✅ | In-scope L82-87 matches task coverage; Out-of-scope L90-94 matches Non-Goals L181-185 |
| Traceability matrix completeness | ✅ | All C0-C7 covered in `tasks.md:90-97` |
| No boundary breach (recurrence re-query) | ✅ | `requirements.md:47` C3.3 preserves singular path; `requirements.md:91` out-of-scope |
| No boundary breach (adapter direct SQLite) | ✅ | `requirements.md:48` C3.4 |

---

## 4. Open Questions

None. All prior open questions have been resolved in the updated design (raw handoff cache L137, eviction policy L141, ±2 month preservation L99).

---

## 5. Final Verdict

### **Ready to implement**

All must-fix items from the first review are resolved with explicit, traceable evidence. No Critical or High findings remain. The 1 Medium finding (sub-range merge counting) and 2 Low findings are non-blocking and can be resolved during Task 4 implementation.

**Task 0 (baseline measurement) is safe to start immediately.**
