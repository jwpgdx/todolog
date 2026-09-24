# iOS Native Interaction Audit — Context Menu / Drag / Reorder

Date: 2026-09-24  
Status: Technical audit only. **Not a product freeze and not implementation approval.**  
Repository baseline: `codex/web-gpt-handoff-2026-09-21`, app code baseline remains `79cbc8d667019e99799bc4ade545c8085b8cba35`.

## Purpose

Todolog prioritizes platform-native interaction when the OS provides an appropriate primitive. This audit checks whether the existing iOS custom context-menu/reorder engine is still necessary with current UIKit capabilities, and separates:

1. behavior UIKit can own,
2. Todolog-specific policy that must remain custom,
3. behavior that needs a bounded device spike before D04 is frozen.

No Swift/JS implementation is changed by this audit.

## Current repository facts

- The native list is a `UICollectionView` backed by `UICollectionViewDiffableDataSource`.
- The data source already uses `reorderingHandlers.canReorderItem` and `didReorder`.
- `UICollectionView.dragInteractionEnabled` is currently explicitly `false`; there is no active `UICollectionViewDragDelegate` / `UICollectionViewDropDelegate` path.
- For reorderable todo rows, `contextMenuConfigurationForItemAt` currently returns `nil`, so the normal UIKit context-menu path is intentionally bypassed.
- The current lifted path uses custom long-press/pan state, custom preview snapshots, insertion indicators, auto-scroll, collapsed-section hover expansion, and custom todo/section-header drag sessions.
- For simpler cases, the current code can transition from its custom menu/pan into `beginInteractiveMovementForItem` and lets UIKit perform interactive movement.
- Native module minimum iOS is 15.1. The UIKit APIs discussed below predate that deployment target, so adopting them does not require raising the current iOS minimum merely for API availability.

## What UIKit already provides

### 1. Context menu → drag without lifting the finger

Apple documents that `UIContextMenuInteraction` is integrated with Drag and Drop. When an app adopts both interactions, the user can transition from the context-menu gesture into dragging, including after the menu has appeared, without lifting the finger.

For collection views, UIKit provides specialized drag/drop support through:

- `UICollectionViewDragDelegate`
- `UICollectionViewDropDelegate`
- `dragInteractionEnabled`
- `UICollectionViewDropProposal`
- `UICollectionViewDropCoordinator`

This means Todolog does **not** need a custom gesture merely to achieve the base interaction “long press → system context menu → continue moving the same touch into a drag”.

Official references:

- https://developer.apple.com/videos/play/wwdc2019/224/
- https://developer.apple.com/documentation/uikit/supporting-drag-and-drop-in-collection-views
- https://developer.apple.com/documentation/uikit/uicollectionviewdragdelegate
- https://developer.apple.com/documentation/uikit/uicollectionviewdropdelegate

### 2. Simple reorder

`UICollectionViewDiffableDataSource.reorderingHandlers` provides system interactive reordering transactions and lets the app update its backing model from the final diff/snapshot.

Todolog already uses these handlers. Flat-list reorder should therefore continue to prefer UIKit behavior unless a concrete product requirement cannot be represented.

Official reference:

- https://developer.apple.com/documentation/uikit/uicollectionviewdiffabledatasource/reorderinghandlers

### 3. Local moves, including between sections

Collection-view drag/drop lets the drop delegate decide whether and where a dragged item may be inserted. UIKit collection items can also be moved between sections. The app still owns the semantic data update.

Official references:

- https://developer.apple.com/documentation/uikit/supporting-drag-and-drop-in-collection-views
- https://developer.apple.com/documentation/uikit/uicollectionview/moveitem(at:to:)

### 4. Expand/collapse storage primitives

Diffable data sources have section-snapshot handlers for hierarchical expand/collapse behavior. They do not define Todolog's “hover a collapsed category for ~0.5s while dragging, temporarily expand it, then persist expansion only after a successful drop” policy.

Official reference:

- https://developer.apple.com/documentation/uikit/uicollectionviewdiffabledatasource/sectionsnapshothandlers

## Native-first replacement candidates

These are candidates for a future bounded spike, not approved rewrites.

| Existing custom responsibility | Native-first candidate | Audit judgment |
|---|---|---|
| Long-press menu presentation | UIKit `UIContextMenuConfiguration` / system preview | Prefer system |
| Menu → drag transition | UICollectionView drag interaction + context-menu integration | Strong candidate to replace custom transition |
| Basic drag preview/lift animation | UIKit drag preview/default interaction | Prefer system unless a requirement proves insufficient |
| Simple same-section reorder | diffable `reorderingHandlers` / UIKit movement | Keep system-first |
| Local todo move between visible sections | `UICollectionViewDragDelegate/DropDelegate` + custom drop policy | Strong spike candidate |
| Drop acceptance / pinned constraints | `dropSessionDidUpdate` + `UICollectionViewDropProposal` | Keep policy custom, let UIKit own gesture |
| Drop animation | `UICollectionViewDropCoordinator` | Prefer system |
| Generic insertion feedback | UIKit default reorder/drop feedback | Prefer system unless product requires the full-width custom line |

## Behavior that remains Todolog-specific

UIKit primitives do not decide these product semantics:

- Favorites drop changes `favorite_order` without necessarily changing category/custom order.
- Dragging out of Favorites has different meaning depending on target screen/mode.
- Inbox is pinned and may reject otherwise valid targets.
- TodoScreen time mode rejects reorder for timed rows while still allowing permitted favorites moves.
- Category-grouped mode supports category-to-category semantic moves.
- A collapsed category may temporarily expand after a Todolog-defined hover delay.
- Expansion caused by drag may be persisted only after a successful drop.
- Category-section header reorder moves an entire logical section, not merely one normal row.
- During some category-header drags, other sections temporarily collapse and later restore.
- Screen-specific reorder payloads must preserve `custom_order`, `category_order`, `favorite_order`, recurrence/schedule fields, and offline-first write semantics.

These rules may be implemented inside UIKit drag/drop delegates and diffable snapshots, but UIKit does not supply the rules themselves.

## Areas that still require a device spike

### A. Reorderable todo: system context menu → native drag/drop

Goal:

- Long press shows the real UIKit context menu.
- Without lifting, moving the same finger transitions into native collection drag.
- Default system preview/lift/drop animation is retained as much as possible.
- Same-section reorder works without custom snapshot/pan code.

This is the highest-value spike because the repository currently disables the system drag interaction and suppresses the system context menu for reorderable todos.

### B. Cross-section todo move

Test whether the same native drag session can preserve:

- category → category move,
- regular ↔ Favorites semantics,
- prohibited timed-row targets,
- Inbox constraints,
- correct visible insertion location,
- native auto-scroll/drop feedback.

If UIKit's default feedback is sufficient, do not recreate the current full-width indicator merely for parity with the old custom engine.

### C. Collapsed-category hover expansion

Use native drag/drop tracking as the gesture source, but keep the hover timer and expansion policy custom.

Verify that expanding/applying a snapshot during an active native drag does not cancel or corrupt the drag session and that the user can continue to the intended internal gap.

### D. Category section-header reorder

UIKit's item reorder APIs do not by themselves define “drag this logical category header and move its whole section.” Test whether a native drag item can represent the section while UIKit owns the gesture/preview. If this cannot preserve the required behavior cleanly, retain a custom section-header drag engine only for this boundary.

## Recommended architecture direction for D04 discussion

Do **not** choose between “all custom” and “all native”.

Preferred direction to evaluate:

```text
UIKit owns
- context menu gesture/presentation
- drag session
- lift/preview/drop animation
- ordinary reorder feedback
- collection drag auto-behavior where sufficient

Todolog owns
- allowed targets
- category/favorite/order semantics
- pinned constraints
- hover-expand policy
- section-level semantics
- SQLite/pending persistence
```

Custom gesture/snapshot rendering should be retained only where an identified requirement cannot be expressed reliably through UIKit's native drag/drop and diffable APIs.

## STOP condition before implementation

D04 is not frozen by this audit. Do not rewrite the existing iOS engine yet.

Before implementation:

1. freeze the platform interaction policy,
2. define one bounded UIKit spike with explicit acceptance criteria,
3. compare the spike on a real/simulator iOS device against the existing validated behavior,
4. only then decide which custom engine pieces can be deleted or retained.

The existing custom engine remains the known implementation baseline until that comparison succeeds.
