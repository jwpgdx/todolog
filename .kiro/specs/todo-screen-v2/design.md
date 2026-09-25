# Todo Screen V2 — Design

> Formalized: 2026-09-25.
>
> This design implements the frozen contract in `requirements.md`. It is intentionally milestone-scoped. It does not authorize deferred TodoScreen, Android todo/favorite, or other bulk-action work.

## Design Principles

1. Product semantics live above native rendering.
2. Native code owns platform interaction and rendering, not domain persistence.
3. SQLite owns local truth.
4. Selection membership and screen-visible ordering are separate concepts.
5. Bulk move validates and writes in one transaction.
6. Platform-native behavior is preferred over recreating old custom visuals.
7. Existing validated custom native code remains a fallback/reference until a native replacement scope passes.
8. Scope expansion requires a new Gate.

## Milestone Architecture

```text
AllTodos / Favorites / CategoryDetail screen
        |
        | screen scope + visible todo order
        v
useTodoSelectionMode / selection coordinator
        |
        | selected ID set
        | orderedVisibleTodoIds
        v
NativeTodoManagedList / NativeManagedList
        |
        +---- iOS UICollectionView rendering / native interaction
        |
        v
TodoSelectionActionBar
        |
        | Move
        v
TodoCategorySelect modal
        |
        | ordered selected IDs + target category
        v
bulk-move hook / service
        |
        v
SQLite transaction
  - validate target
  - validate exact selected set
  - validate screen/action scope
  - read latest target max order
  - no-op already-target items
  - update moved rows
  - enqueue existing updateTodo pending rows
        |
        v
transaction commit
        |
        +---- query invalidation / UI success
        +---- exit selection / restore tabs
```

## Responsibility Boundaries

### Screen / Feature Layer

Owns:

- which todos are in the current screen scope;
- visible section/sort order;
- selection-mode lifecycle;
- current selected-ID membership;
- deriving selected IDs in screen-visible order;
- header options;
- opening the category picker;
- translating structured stale-validation results into user feedback;
- exiting selection after success.

Does not own:

- per-row SQL write loops;
- silent missing-ID filtering;
- target max-order calculation from a stale query snapshot.

### NativeManagedList

Owns:

- platform-native list rendering;
- summary item rendering;
- selected visual state/control;
- interaction gating in selection mode;
- native list scroll ownership;
- native event emission using stable IDs.

Does not own:

- SQLite;
- category move semantics;
- order-lane mutation;
- pending sync;
- recurrence semantics.

### Bulk-Move Service

Owns:

- transaction boundary;
- exact request-set validation;
- target-category validation;
- latest target order lookup;
- idempotent already-target handling;
- category/order updates;
- pending enqueue;
- structured success/failure result.

Does not own:

- navigation;
- alerts;
- selection header;
- screen-visible order derivation.

## Screen Composition

### Calendar-Free Normal Mode

```text
[ native Stack header / native large title / screen actions ]
[ NativeManagedList - primary vertical scroll owner ]
  summary item
  favorites/category section headers as applicable
  todo rows
[ floating bottom tab bar ]
```

Rules:

- no RN `총 n개` header view before NativeManagedList;
- no extra vertical ScrollView wrapping the native list;
- native content inset behavior remains system-managed where applicable.

### Calendar-Free Selection Mode

```text
[ native Stack header: back context | n개 선택됨 | 완료 ]
[ NativeManagedList - same scope/sort/sections ]
  no summary item
  selectable todo rows
[ TodoSelectionActionBar ]
```

Normal item menus, reorder, swipe, and collapse-expand are disabled.

## Selection State Model

The current tap-ordered `selectedTodoIds` array must not be the authority for bulk move order.

Use two concepts:

```text
selectedTodoIdSet
  = membership only

orderedVisibleTodoIds
  = current screen render order of actionable todo rows

orderedSelectedTodoIds
  = orderedVisibleTodoIds.filter(id => selectedTodoIdSet.has(id))
```

The action request captures `orderedSelectedTodoIds` when Move is invoked.

This satisfies the frozen “screen-visible order” rule and prevents tap order from leaking into category order.

For the current Move-only milestone, todo ID is sufficient action identity. The recurrence `occurrenceDate` snapshot required by bulk Complete is explicitly deferred to the next milestone.

## Screen Scope Validation

A bulk-move request carries enough origin context for the service/feature layer to determine whether every selected todo is still valid for the action.

Suggested origin context:

```ts
type TodoSelectionScope =
  | { screen: 'allTodos' }
  | { screen: 'favorites' }
  | { screen: 'category'; categoryId: string };
```

Validation meaning:

- `allTodos`: selected todo is active and still belongs to the active all-todos scope/filter;
- `favorites`: selected todo is active and still favorite/visible for that screen's action scope;
- `category`: selected todo is active and still belongs to the originating category scope.

The exact helper/function name is implementation detail. The important requirement is that scope invalidation cannot become silent partial success.

A transient query-cache absence is never authoritative; SQLite active state is.

## Bulk Move Request

Conceptual request:

```ts
type BulkMoveRequest = {
  orderedTodoIds: string[];
  targetCategoryId: string;
  originScope: TodoSelectionScope;
};
```

The request must not include target order values computed from React Query state.

## Transaction Design

Conceptual transaction:

1. Reject an empty/invalid target ID before write work.
2. Load target category as active/non-deleted.
3. Load all requested todos by ID in one transaction-aware path.
4. Verify exact request cardinality/identity.
5. Reject deleted/tombstoned/missing rows.
6. Validate each row against `originScope`.
7. Partition:
   - `noOpTodos`: already in target category;
   - `movingTodos`: category actually changes.
8. Query the latest active maximum `category_order` for the target category.
9. Starting after that max, assign order values only to `movingTodos`, preserving `orderedTodoIds` order.
10. For each moving todo:
    - update `categoryId`;
    - update only category-order lane;
    - preserve custom/favorite/date/time/recurrence fields;
    - enqueue existing `updateTodo` pending change.
11. Commit.
12. Return a structured result.

If steps 2-6 or any write/pending operation fails, the transaction rolls back.

### Important Target-Max Rule

Already-target selected todos remain exactly where they are. They are part of the existing target category and must not be removed from max-order consideration merely because they are selected.

Newly moved todos append after the current active target contents.

## Structured Result

Recommended conceptual result:

```ts
type BulkMoveResult =
  | {
      status: 'success';
      movedTodoIds: string[];
      noOpTodoIds: string[];
    }
  | {
      status: 'selection_stale';
      invalidTodoIds: string[];
      validTodoIds: string[];
      reasonsById?: Record<string, string>;
    }
  | {
      status: 'target_invalid';
      targetCategoryId: string;
    };
```

Names can differ, but the UI must be able to distinguish stale selection from invalid target and from ordinary mutation/runtime failure.

Do not encode stale selection as generic “success with fewer rows”.

## Selection Failure Flow

```text
Move requested
   |
SQLite validation fails
   |
ROLLBACK / no pending writes
   |
structured stale/target-invalid result
   |
no automatic retry
   |
UI informs user
   |
invalid selected IDs removed when identifiable
valid selected IDs preserved
   |
return/reveal originating selection surface
   |
user reviews and explicitly retries
```

The specific alert/banner component is not frozen.

## Success Flow

```text
Move requested
   |
SQLite transaction commits
   |
invalidate/update relevant queries
   |
close picker
   |
exit selection mode
   |
restore bottom tab
   |
render latest SQLite-backed state
```

Remote sync later uses the existing pending queue. No UI rollback occurs solely because the later remote push fails.

## Move Picker Design

The existing modal route remains the picker.

Its list is selection-only, not a reorder surface.

```text
취소 | 카테고리 선택 | 이동
--------------------------------
Inbox
Category A        ✓
Category B
...
```

- row tap stages the target;
- right action commits;
- cancel preserves parent selection;
- picker does not calculate authoritative target max order;
- picker must not silently filter missing selected IDs and proceed.

The authoritative request-set and target validation occurs at commit time.

## Summary Item Design

Add/standardize a `summary` managed-list item kind or equivalent contract that renders inside the native list snapshot.

Properties:

- text/count content;
- optional trailing action only when separately frozen;
- no reorder;
- no menu;
- no swipe;
- no selection control;
- not a drag target.

Screen adapters place it before normal list sections in normal mode and omit it in selection mode.

The public contract should support Android later even though the current production milestone validates iOS first.

## iOS Platform Interaction Design

### Bounded Spike First

Before changing the production interaction engine:

```text
UICollectionView todo row
   |
long press
   v
UIKit system context menu
   |
same touch moves
   v
UICollectionView native drag session
   |
simple same-section reorder
```

Acceptance for the spike:

- no custom fake menu for the tested path;
- same-gesture transition works;
- native lift/preview/drop animation remains;
- final reorder event/data is correct;
- `선택` remains available through the system context menu;
- existing production custom path remains intact during the experiment.

### Native/Custom Boundary

Prefer UIKit for:

- context-menu gesture/presentation;
- drag session;
- lift/preview;
- ordinary reorder feedback;
- drop animation;
- simple same-section reorder.

Keep Todolog policy for:

- favorites semantics;
- category target semantics;
- timed-row restrictions;
- Inbox constraints;
- hover-expand;
- persistence of expansion;
- order-lane updates.

Logical section-header drag remains separately custom-capable unless a later bounded spike proves a clean native path.

### STOP Condition

If the bounded native spike cannot preserve the required context-menu + drag behavior cleanly, stop and report the exact limitation. Do not delete the existing custom engine or broaden the experiment into a full rewrite.

## Android Frozen Future Design

Not part of this implementation milestone.

When Android todo/favorite native parity begins:

```text
tap row        -> open todo
long press     -> enter selection; select row
row ⋮          -> anchored item menu
drag affordance-> ItemTouchHelper.startDrag()
```

The existing Android category baseline can keep its category-specific interaction until separately migrated.

## TodoScreen Frozen Future Design

Not part of this implementation milestone.

Selection mode will:

- keep route/scope/date/sort/section state;
- hide RN title/date/calendar chrome;
- prevent calendar interaction;
- preserve calendar mode/viewport;
- let NativeManagedList occupy the remaining body;
- restore calendar presentation on exit.

No selection-only route and no calendar native rewrite.

## Cache / Query Strategy

For the first milestone, correctness is more important than a complex optimistic cache patch.

After a committed bulk move, invalidate the relevant todo/category/favorite/all-todos query families and any list-derived caches needed to render the new category placement.

Do not treat cache state as transaction truth.

If broad invalidation later shows a measurable performance issue, narrow it in a separate optimization task.

## Validation Design

Every device/manual validation record must include:

- date;
- commit;
- platform/OS/device;
- build type;
- route;
- prepared data;
- exact interaction;
- expected result;
- actual result;
- SQLite evidence;
- pending-queue evidence where mutation occurs;
- logs/screenshots when useful.

Differentiate:

- “screen rendered”;
- “interaction worked”;
- “SQLite changed correctly”;
- “pending payload correct”;
- “remote sync eventually worked”.

They are not interchangeable evidence.
