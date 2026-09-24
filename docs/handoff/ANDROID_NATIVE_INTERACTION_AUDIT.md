# Android Native Interaction Audit — Selection / Reorder / Menus

Date: 2026-09-24  
Status: Technical audit only. **Not a product freeze and not implementation approval.**  
Repository baseline: `codex/web-gpt-handoff-2026-09-21`. App code baseline remains `79cbc8d667019e99799bc4ade545c8085b8cba35`.

## Purpose

Todolog wants iOS and Android to share product behavior without forcing identical gestures or presentation. This audit checks the Android-native conventions that matter for D04: long-press selection, reorder, row actions, and app-bar overflow.

No Kotlin/JS implementation is changed by this audit.

## Current repository facts

- Android native list currently exists only for the `variant="category"` path; todo/favorite native parity is still incomplete.
- The native RecyclerView implementation uses `ItemTouchHelper`.
- The current callback explicitly disables ItemTouchHelper's built-in long-press start and instead calls `startDrag(holder)` from the row's `setOnLongClickListener`.
- The current native row shows a trailing `⋮` when menu/deletion actions are available and opens an Android `PopupMenu`.
- Therefore the current first-slice Android behavior is effectively:
  - row long-press → reorder,
  - trailing `⋮` → item actions.
- This is a real native baseline, but it predates the final todo/favorite selection-mode policy and must not be treated as the final Android todo interaction contract.

## What Android provides natively

### 1. Contextual multi-selection

Android's contextual action mode (`ActionMode`) is the platform pattern for actions that apply to selected content. Android documentation explicitly describes touch-and-hold as a usual way to invoke contextual action mode, after which the user can select multiple items.

`RecyclerView SelectionTracker` also provides selection state/policies and documents gesture selection scenarios involving long press.

Official references:

- https://developer.android.com/develop/ui/views/components/menus
- https://developer.android.com/reference/androidx/recyclerview/selection/SelectionTracker
- https://developer.android.com/reference/androidx/recyclerview/selection/SelectionTracker.Builder

### 2. Reorder

`ItemTouchHelper` supports drag/reorder. Its default behavior can start a drag on long press, but Android explicitly supports disabling long-press drag and calling `startDrag(viewHolder)` from a descendant view such as a drag handle.

Therefore Android does not require row long-press to own reorder.

Official reference:

- https://developer.android.com/reference/androidx/recyclerview/widget/ItemTouchHelper

### 3. Overflow / popup actions

Android app bars provide action items and an overflow menu. For actions related to a particular row/content region, `PopupMenu` is a native anchored menu pattern.

Official references:

- https://developer.android.com/develop/ui/views/components/appbar/actions
- https://developer.android.com/develop/ui/views/components/menus

## Gesture conflict

Both of these are Android-supported:

```text
row long-press -> contextual selection
row long-press -> ItemTouchHelper reorder
```

They cannot both own the same gesture reliably on the same row.

The product must choose which behavior receives row long-press and provide a different explicit affordance for the other.

## Native-first options

### Option A — long-press selection, explicit drag affordance

```text
tap row        -> open todo
long-press row -> enter selection with that row selected
⋮              -> anchored item menu
drag handle    -> ItemTouchHelper.startDrag
```

Advantages:

- aligns directly with Android contextual-selection conventions,
- selection is discoverable without opening a menu,
- reorder remains fully native through ItemTouchHelper,
- no gesture collision.

Tradeoff:

- reorderable screens need an explicit handle or an explicit reorder mode.

### Option B — long-press reorder, selection through menu/header

```text
tap row        -> open todo
long-press row -> ItemTouchHelper reorder
⋮ > 선택       -> enter selection with row selected
app bar > 일정 선택 -> enter empty selection mode
```

Advantages:

- preserves the current category native baseline,
- keeps very fast direct reorder.

Tradeoff:

- Android's common long-press contextual-selection entry is unavailable,
- a row that is not reorderable needs a consistent no-op or another interaction; long-press must not silently change meaning from reorder to selection depending on row state.

## Menu presentation audit

The existing Android `PopupMenu` implementation is itself a native Android pattern for content-specific overflow actions.

For a native-first policy:

- app-bar `⋮` should normally use the platform/app-bar overflow menu,
- row `⋮` should normally use an anchored `PopupMenu`,
- contextual multi-selection actions may use contextual action mode / the app's shared selection chrome,
- bottom sheets should be reserved for flows that genuinely need a larger action/selection surface, not used as the default replacement for every Android overflow menu.

This means older Todolog wording that treats Android multi-action menus as generally bottom/action sheets should be revisited before final freeze.

## Relationship to Todolog's shared selection contract

Regardless of which Android entry gesture is chosen:

- selection remains in-place, not a separate route,
- selected row visuals and stable IDs are shared at the JS/domain-contract level,
- while selection is active, reorder, swipe, overflow/context menu, and collapse/expand interactions are disabled,
- bulk actions and offline-first semantics remain platform-independent,
- Android presentation does not need to copy iOS context menus or navigation chrome.

## Recommended D04 decision boundary

The strongest Android-native choice for a task app with first-class multi-selection is **Option A: row long-press enters contextual selection and reorder moves to an explicit drag affordance**.

However, Todolog already has direct long-press reorder behavior and reorder is a major product interaction. Therefore D04 should freeze the product priority deliberately rather than treating either Android API default as mandatory.

If Option A is chosen, implementation should use `ItemTouchHelper.startDrag` from the explicit affordance rather than rebuilding drag behavior in JS.

If Option B is chosen, keep long-press meaning consistent across reorderable and non-reorderable todo rows; do not make long-press select only when reorder is unavailable.

## STOP condition before implementation

D04 is not frozen by this audit. Do not modify the Android native list yet.

First freeze:

1. which action owns row long-press,
2. the reorder affordance when long-press belongs to selection,
3. anchored overflow vs larger sheet presentation boundaries.

Then implement only the selected Android native path.
