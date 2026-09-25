# Todo Screen V2 — Requirements

> Formalized: 2026-09-25.
>
> This document promotes the frozen product decisions in `docs/handoff/DECISIONS.md` and `triage.md` into an implementation contract. It does **not** mean the implementation or device validation is complete. When this document conflicts with older raw notes, prototypes, presentation records, or historical checklists, the latest frozen decisions F01-F28 take precedence.

## Goal

Todo list screens must preserve Todolog's offline-first data model while providing platform-native list interaction, stable in-place multi-selection, and atomic bulk movement.

The first production milestone is intentionally narrow:

- iOS only
- calendar-free todo list screens only
  - All Todos
  - Favorites
  - Category detail
- selection-mode stabilization
- native-list summary migration
- bulk move stabilization

The first milestone is **not** a full Todo Screen V2 rollout.

## Source of Truth

Read in this order:

1. `docs/handoff/DECISIONS.md` — latest product freeze
2. this `requirements.md`
3. `design.md`
4. `tasks.md`
5. `triage.md` — historical candidates, code audit notes, and supporting rationale
6. `docs/handoff/IMPLEMENTATION_AUDIT.md` — current-code gaps
7. older presentation/prototype/raw documents — history only where they do not conflict

Technical evidence for platform-native interaction:

- `docs/handoff/IOS_NATIVE_INTERACTION_AUDIT.md`
- `docs/handoff/ANDROID_NATIVE_INTERACTION_AUDIT.md`

## Current Production Milestone

### Included

- AllTodos iOS selection lifecycle
- Favorites iOS selection lifecycle
- Category detail iOS selection lifecycle
- common selection header/action-bar behavior
- F27 native-list summary item
- bulk category move
- F24 stale/missing all-or-nothing validation
- screen-visible selection ordering for move
- target-category no-op behavior
- latest SQLite target/order validation at commit time
- success/cancel/back/reentry/tab-bar regression handling
- bounded iOS native-interaction spike required by F26

### Explicitly excluded

- TodoScreen selection implementation
- TodoScreen calendar changes
- bulk delete implementation
- bulk complete/uncomplete implementation
- bulk favorite/unfavorite implementation
- recurrence occurrence snapshot implementation for bulk completion
- Android todo/favorite native parity implementation
- Account Hub
- settings/theme rollout
- Todo form redesign
- dependency upgrades
- sync architecture redesign
- server bulk APIs
- visual polish not needed to satisfy the native interaction contract

## Hard Constraints

1. SQLite remains the local source of truth.
2. Existing UUID identity and pending-change types remain unchanged unless a separately approved migration requires otherwise.
3. Bulk local writes are transactional and all-or-nothing.
4. Native list code does not directly write SQLite, call sync, or execute domain mutation semantics.
5. Native events use stable IDs, not IndexPath/adapter positions as domain identity.
6. `custom_order`, `category_order`, and `favorite_order` remain separate order lanes.
7. Moving category must not modify `custom_order` or `favorite_order`.
8. An already-target-category selected todo is an idempotent no-op, not an error and not a reorder request.
9. Tap order must never determine bulk-move order.
10. A stale/missing/scope-invalid selected todo must never be silently skipped while the rest succeeds.
11. Local success is UI success; remote sync remains the existing pending/retry flow.
12. Selection mode stays in the current route; no selection-only page is introduced.
13. Platform parity means shared product semantics, not identical gestures or presentation.
14. Existing iOS custom interaction code is not deleted before the native spike proves the replacement scope on an iOS device/simulator.
15. Android todo/favorite behavior follows F26 when that later milestone begins; the older category long-press-reorder pilot is not a todo/favorite product requirement.
16. The current milestone must not opportunistically implement deferred bulk actions.

## Functional Requirements

### FR-1: Eligible Screens

The current production milestone shall apply selection stabilization to:

- All Todos
- Favorites
- Category detail

Each screen shall preserve its existing content scope, sort, and section model when entering selection mode.

TodoScreen follows its already-frozen future contract but is not implemented in this milestone.

### FR-2: Selection Entry

On iOS calendar-free todo screens:

- the screen action menu shall provide `일정 선택`;
- a todo's UIKit context menu may provide `선택`;
- entering through a todo action shall enter selection mode with that todo selected;
- entering through the screen action menu may enter with zero selected todos.

Selection mode shall not navigate to another route.

### FR-3: Selection Header and Navigation

While selection mode is active:

- the original back/navigation context remains available;
- zero selected items shows `일정 선택`;
- one or more selected items shows `n개 선택됨`;
- the right header action is `완료`;
- the normal screen overflow/menu is hidden or disabled;
- pressing `완료` exits selection mode without changing todo data;
- normal route Back exits the route and discards that screen's transient selection state without a confirmation dialog.

### FR-4: Selection Row Interaction

While selection mode is active:

- row tap toggles selection;
- the completion control position becomes a selection control;
- selected state is visually explicit;
- swipe actions are disabled;
- item context/overflow menus are disabled;
- todo reorder/drag is disabled;
- category/favorites collapse-expand interaction is disabled;
- summary items are not selectable.

### FR-5: Selection Action Bar

Selection mode shall:

- hide the floating bottom tab bar;
- show the common `TodoSelectionActionBar`;
- expose an extensible action registry;
- disable actions at zero selected items;
- reserve delete/complete/favorite/move as the common action model.

For the current milestone:

- Move is the only production bulk mutation that must be completed.
- Delete/Complete/Favorite may remain unavailable until their later milestone.
- Their presence must not imply that they are implemented.

The list bottom inset shall use the actual action-bar/safe-area requirement, not a permanently hard-coded device-specific value.

### FR-6: Summary Item

Calendar-free todo screens shall render count/summary information inside `NativeManagedList`, not as an RN header view before the native list.

First-milestone labels:

- All Todos: `총 n개의 일정`
- Favorites: `총 n개의 즐겨찾기`
- Category detail: `총 n개의 일정`

Count rules:

- count the current screen's valid todo scope after applicable filtering;
- section collapse does not reduce the count;
- the same todo must not be counted twice because it is represented through a favorites/top-section model;
- selection mode hides the summary item.

The summary item is:

- non-selectable;
- non-reorderable;
- non-swipeable;
- without item menu;
- not a todo drop/insertion target.

Completed's future `n개 완료됨` summary is frozen conceptually, but a `지우기` action is not approved until its destructive meaning is separately frozen.

### FR-7: Ordered Selection for Bulk Move

Bulk move shall use the selected todos' **screen-visible order**, not the order in which the user tapped them.

The implementation shall maintain selection membership independently from move ordering.

When a move action request is constructed, the ordered todo IDs shall be derived from the current screen-visible item order filtered by the selected-ID set.

### FR-8: Move Picker

Bulk Move opens the existing route-based category-selection modal.

The picker contract remains:

- title: `카테고리 선택`;
- left action: `취소`;
- right action: `이동`;
- row tap stages the target category;
- `이동` commits;
- Inbox remains a valid target unless a later business freeze says otherwise.

Cancel shall close the picker and preserve the originating screen's selection state.

### FR-9: Move Semantics

For selected todos that are not already in the target category:

- set `categoryId` to the selected target;
- append after the current last active todo in the target category;
- assign category order using the existing order-step convention;
- preserve the selected screen-visible order among moved todos;
- preserve `custom_order`;
- preserve `favorite_order`;
- preserve date/time/recurrence and other unrelated todo fields.

For a selected todo already in the target category:

- do not change category;
- do not change category order;
- do not create an unintended reorder.

If every selected todo is already in the target category, the action is an idempotent no-op; the UI may prevent commit when there is nothing to change.

### FR-10: Commit-Time Validation and Atomicity

Immediately before the local write, the move operation shall validate against SQLite inside the transaction boundary.

It shall verify:

- target category exists and is active;
- every requested selected todo exists and is active;
- the exact requested set is accounted for;
- every selected todo is still valid for the originating action scope;
- the latest target-category maximum order is used for newly moved todos.

If any selected todo is deleted, tombstoned, missing, or no longer valid for the action scope:

- no todo write is committed;
- no pending change is committed;
- valid selected todos are not silently processed;
- invalid selection entries are identified for the UI;
- valid remaining selection is preserved;
- the user must explicitly run the action again after reviewing the changed selection.

A temporary React Query/cache/loading absence alone must not be treated as deletion. SQLite active-row validation is authoritative.

Ordinary field changes to an otherwise-valid todo do not automatically invalidate its identity.

### FR-11: Pending Changes and Sync

For each todo actually moved, the transaction shall enqueue the existing per-todo `updateTodo` pending change.

The current milestone shall not add a new bulk pending type.

After local success:

- UI treats the operation as successful;
- selection mode exits;
- bottom tab state restores;
- relevant todo/category/favorite queries are invalidated or updated;
- later remote failure remains the existing retry/dead-letter concern and does not roll back successful local state.

### FR-12: Selection Failure UX

When F24 validation fails:

- the user must be informed that the selected set changed or is no longer fully valid;
- the failed action must not auto-retry;
- invalid selected entries may be removed from selection;
- valid selected entries remain selected for review;
- the UI must provide a path back to the originating selection surface.

The exact alert/banner wording is implementation detail unless separately frozen.

### FR-13: Platform-Native Interaction — iOS

For todo rows on iOS:

- UIKit system context menu is the default long-press menu surface;
- reorderable rows should first attempt the native path where the same context-menu gesture transitions into UICollectionView Drag & Drop;
- UIKit should own gesture recognition, lift/preview, drag session, ordinary drop feedback, and drop animation where it meets the product requirement;
- Todolog retains target eligibility and domain semantics.

Before production replacement, a bounded spike shall verify:

1. system context menu appears;
2. the same touch can transition into native collection drag without lifting;
3. simple same-section reorder completes correctly;
4. system preview/drop behavior is acceptable;
5. the context-menu selection action still works;
6. the existing custom engine remains available until the tested scope passes.

A failed spike is a STOP condition for redesign, not permission to silently rewrite the whole engine.

### FR-14: Platform-Native Interaction — Android Future Contract

This requirement is frozen but **not implemented in the current milestone**.

For Android todo/favorite rows:

- row long-press enters contextual selection and selects that row;
- reorder starts from an explicit native drag affordance using `ItemTouchHelper.startDrag()`;
- long-press meaning does not change based on row reorderability;
- row `⋮` uses anchored native/Material item actions;
- app-bar `⋮` uses platform overflow;
- bottom sheet is reserved for a larger task/selection surface;
- selection mode disables reorder/drag/swipe/item menus/collapse-expand.

Existing Android category long-press reorder is a separate category baseline and is not automatically rewritten by this requirement.

### FR-15: TodoScreen Future Contract

This requirement is frozen but **not implemented in the current milestone**.

TodoScreen selection remains in-place. On entry:

- current date/sort/section state is preserved;
- RN title/date/calendar chrome is hidden and non-interactive;
- calendar mode/viewport state is preserved;
- NativeManagedList uses the freed body space;
- exit restores the previous calendar presentation state.

No separate selection route and no calendar native rewrite is introduced.

## Non-Functional Requirements

### NFR-1: Native-First

Prefer, in order:

1. OS native primitive;
2. native primitive plus Todolog policy/delegate;
3. custom native interaction;
4. RN custom interaction only when necessary.

### NFR-2: Scroll Ownership

On calendar-free native-list screens, `NativeManagedList` is the primary vertical scroll owner.

Do not insert RN header/wrapper scroll content ahead of it in a way that breaks native large-title/scroll-edge tracking.

### NFR-3: Offline-First

Bulk move must be fully usable offline and must not depend on a direct server bulk endpoint.

### NFR-4: Determinism

Given the same active SQLite state, ordered selected IDs, and target category, the local move result must be deterministic.

### NFR-5: No Silent Partial Success

Any local validation/write failure affecting the requested set must result in zero committed move writes for that request.

### NFR-6: Regression Safety

The current milestone must preserve:

- existing single-todo actions;
- favorite/order lanes not targeted by Move;
- native header behavior;
- native list scroll height;
- existing validated reorder behavior outside selection mode;
- tab restoration;
- modal cancel/back behavior.

## Milestone Acceptance Criteria

The first production milestone is complete only when all of the following are demonstrated on the agreed iOS environment:

- AllTodos, Favorites, Category detail enter and exit selection mode correctly.
- Choosing rows in reverse tap order still moves them in screen-visible order.
- Mixed selection containing an already-target-category todo leaves that todo unchanged.
- Moved todos append after the latest active target-category order.
- `custom_order`, `favorite_order`, date/time and unrelated fields are unchanged by Move.
- SQLite rows and pending `updateTodo` payloads match the expected move.
- A missing/stale selected ID causes zero local move writes and zero pending writes.
- A deleted target category causes zero local move writes and zero pending writes.
- Picker cancel preserves selection.
- Successful move exits selection and restores the bottom tab.
- Back/reentry does not leave stale selection chrome/tab state behind.
- Summary is inside the native list in normal mode and absent in selection mode.
- Native large-title/primary-scroll behavior is not regressed on calendar-free screens.
- Existing reorder/favorites behavior outside selection mode still works.
- Results record commit, OS/device, build type, steps, expected/actual result, and DB/pending evidence.
