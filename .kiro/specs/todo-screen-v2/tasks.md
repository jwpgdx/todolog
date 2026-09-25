# Todo Screen V2 — Tasks

## Current Status: 2026-09-25

D02-D06 are frozen as F24-F28.

This file is the execution plan for the **first production milestone only**. It must not be interpreted as approval to implement deferred TodoScreen, Android todo/favorite, or delete/complete/favorite bulk actions.

Feature-code baseline remains `79cbc8d667019e99799bc4ade545c8085b8cba35`; later commits on the handoff branch are documentation unless explicitly recorded otherwise.

## Gate 0: Formal Spec

- [x] D02 stale/missing selection policy freeze (F24)
- [x] D03 TodoScreen selection chrome freeze (F25)
- [x] D04 platform-native interaction freeze (F26)
- [x] D05 summary contract freeze (F27)
- [x] D06 first implementation scope freeze (F28)
- [x] iOS native interaction audit recorded
- [x] Android native interaction audit recorded
- [x] `requirements.md` drafted from latest freeze
- [x] `design.md` drafted from latest freeze
- [x] `tasks.md` drafted from latest freeze
- [x] user review/acceptance of the formal spec — approved 2026-09-25
- [x] approval recorded before environment/implementation Gate

**STOP:** do not start feature implementation automatically from this documentation gate.

## Gate 1: Environment / Workspace Verification

Run only after formal spec acceptance.

- [x] verify active repository/workspace — Windows CoS: `/dev/todolog`
- [x] verify branch and HEAD — `codex/web-gpt-handoff-2026-09-21` at approval-record commit
- [x] verify clean/known dirty state; no reset/stash of unrelated work
- [ ] verify lockfile-based dependency baseline
- [ ] verify iOS-capable Mac/Xcode environment before iOS code/device work
- [ ] verify simulator or physical iOS device target
- [ ] verify dev build / Metro / API connectivity needed for the selected test
- [x] record current Windows workspace facts in validation evidence; iOS-capable environment evidence remains pending

Windows may be used for document/repository work, but UIKit build/device validation requires the iOS-capable Mac environment.

## Gate 2: Bounded iOS Native Interaction Spike

Goal: validate F26's system-first path without replacing the production engine.

Scope:

- one simple reorderable todo list path/harness;
- UIKit system context menu;
- same-gesture transition into UICollectionView native drag;
- simple same-section reorder;
- system lift/preview/drop behavior;
- context-menu `선택` action.

Tasks:

- [x] identify the smallest isolated harness path: add a dedicated test-only todo route using `NativeManagedList(variant="todo", iosCategoryGestureMode="system")`; keep the existing category harness and production `NativeTodoManagedList(custom-lifted)` unchanged
- [ ] keep existing custom production engine intact
- [ ] enable native context-menu + collection drag only in the bounded spike path
- [ ] verify long press shows UIKit system menu
- [ ] verify moving the same touch transitions to native drag without lifting
- [ ] verify simple same-section reorder commit is correct
- [ ] verify native preview/drop animation is acceptable
- [ ] verify `선택` menu action can enter selection state
- [ ] compare with existing baseline for obvious interaction regressions
- [ ] record device/simulator evidence

**PASS:** system context menu → native drag → simple reorder works and meets the product contract.

**STOP/REPORT:** if this cannot be achieved reliably, do not delete or broadly replace the existing custom engine. Report the exact UIKit limitation and preserve the baseline.

Prepared spike boundary from Windows read-only audit:

- test-only JS surface: new `NativeTodoInteractionSpikeScreen` + file route; mock/in-memory todos only, no SQLite/sync/domain mutation
- use one simple section with a few reorderable `kind="todo"` items and a `선택` menu action
- route may be added to the same public test-route allowlist used by `/native-category-menu` for isolated launch
- do not repurpose or weaken the existing `/native-category-menu` category baseline
- production `NativeTodoManagedList.js` continues to force `custom-lifted` during the spike
- current Swift blockers are explicit: reorderable todo system context menu is suppressed and collection drag interaction is disabled
- isolate the native experiment to system-mode todo rows; do not include cross-section move, Favorites semantics, hover-expand, section-header drag, SQLite, or pending sync
- prefer a small dedicated system-todo-drag Swift extension plus narrowly guarded wiring over changes to the custom drag engine

## Gate 3: Selection State Foundation — Calendar-Free iOS

Target screens:

- AllTodos
- Favorites
- Category detail

### 3.1 Selection Membership vs Order

- [ ] refactor selection state so membership is a set/stable-ID concept
- [ ] expose/derive current screen-visible todo order
- [ ] derive `orderedSelectedTodoIds` from visible order + selected set
- [ ] prove reverse tap order does not change derived move order
- [ ] do not add recurrence occurrence snapshot in this milestone

### 3.2 Header / Chrome Lifecycle

- [ ] normal screen action menu exposes `일정 선택`
- [ ] item native context menu can expose `선택` on iOS
- [ ] selection title shows `일정 선택` at zero
- [ ] selection title shows `n개 선택됨` when nonzero
- [ ] right `완료` exits selection
- [ ] original back context remains
- [ ] floating tab bar hides only for the active selection owner
- [ ] exit/back/unmount restores tab state
- [ ] modal cancel does not accidentally exit the parent selection mode

### 3.3 Selection Interaction Gating

- [ ] row tap toggles selected state
- [ ] completion control becomes selection control
- [ ] context/item menus disabled in selection mode
- [ ] swipe disabled in selection mode
- [ ] reorder/drag disabled in selection mode
- [ ] collapse/expand disabled in selection mode
- [ ] selected styling remains visible and accessible

### 3.4 Selection Action Bar

- [ ] remove permanent hard-coded bottom inset assumptions where they fail actual action-bar/safe-area size
- [ ] ensure list last item remains visible above the action bar
- [ ] keep Move as the only required working bulk mutation for this milestone
- [ ] do not wire API-first bulk delete as a shortcut
- [ ] do not imply Complete/Favorite are production-complete

## Gate 4: Native Summary Item

- [ ] add/standardize managed-list `summary` item contract
- [ ] implement iOS native summary rendering using list/content configuration
- [ ] ensure summary is non-selectable
- [ ] ensure summary is non-reorderable
- [ ] ensure summary has no swipe/menu
- [ ] ensure summary is not a todo drop target
- [ ] AllTodos shows `총 n개의 일정`
- [ ] Favorites shows `총 n개의 즐겨찾기`
- [ ] Category detail shows `총 n개의 일정`
- [ ] remove RN count header ahead of the native list on affected iOS paths
- [ ] hide summary item in selection mode
- [ ] verify section collapse does not change the count
- [ ] verify duplicate representation does not double-count a todo
- [ ] do not implement Completed `지우기`

## Gate 5: Bulk Move Data Layer

### 5.1 Request Contract

- [ ] define ordered selected ID request using screen-visible order
- [ ] include origin selection scope
- [ ] target picker does not calculate authoritative target max order
- [ ] picker does not silently filter missing selected IDs and continue

### 5.2 Transactional Validation

- [ ] use one SQLite transaction for validation + move writes + pending enqueue
- [ ] validate active target category
- [ ] load and account for the exact selected ID set
- [ ] reject missing/tombstoned/deleted selected rows
- [ ] validate originating action scope
- [ ] read latest active target-category max order inside the transaction
- [ ] return structured stale-selection result
- [ ] return structured invalid-target result
- [ ] no pending rows on validation failure

### 5.3 Move Semantics

- [ ] already-target selected todo is a no-op
- [ ] already-target selected todo keeps its existing category order
- [ ] moved todos append after the latest target content
- [ ] moved todos keep screen-visible relative order
- [ ] preserve custom order
- [ ] preserve favorite order
- [ ] preserve date/time/recurrence and unrelated fields
- [ ] enqueue existing `updateTodo` pending type for actually moved todos only
- [ ] rollback all local move/pending changes on local mutation failure

### 5.4 Query/UI Completion

- [ ] invalidate/update relevant queries after transaction commit
- [ ] close picker after success
- [ ] exit selection after success
- [ ] restore bottom tab after success
- [ ] remote retry failure does not roll back committed local state

## Gate 6: Stale-Selection UX

- [ ] stale request causes zero move writes
- [ ] stale request causes zero pending writes
- [ ] identify invalid selected IDs where possible
- [ ] remove invalid IDs from selection when returned
- [ ] preserve valid remaining selection
- [ ] show user-facing changed-selection feedback
- [ ] no automatic retry
- [ ] return/reveal the originating selection surface for review
- [ ] temporary query/cache gap is not treated as deletion

## Gate 7: Screen Integration

### AllTodos

- [ ] fix root/list layout issue identified as A01
- [ ] preserve favorites + category section model
- [ ] selection uses screen-visible section order
- [ ] summary item lives inside native list
- [ ] native header/large-title behavior remains correct

### Favorites

- [ ] remove RN count header from ahead of native list
- [ ] preserve favorite order outside selection mode
- [ ] Move changes category only and preserves favorite order
- [ ] selection mode hides summary and disables reorder/menu/swipe

### Category Detail

- [ ] remove RN count header from ahead of iOS native list
- [ ] preserve category-detail order outside selection mode
- [ ] Move out of current category preserves unrelated order lanes
- [ ] selected item leaving the originating category before commit is detected as stale/scope-invalid

## Gate 8: Regression / Acceptance Validation

Prepare test data that includes:

- multiple categories;
- at least one Inbox/system category;
- favorite and non-favorite todos;
- at least two selected todos with screen order different from tap order;
- a selection containing one todo already in the target category;
- a target category with existing ordered todos;
- a stale/deleted selected todo case;
- a deleted/invalid target-category case.

Validate:

- [ ] reverse tap order moves in screen-visible order
- [ ] already-target selected todo unchanged
- [ ] moved rows append after latest target max
- [ ] custom/favorite/date/time preserved
- [ ] SQLite evidence matches expected rows
- [ ] pending updateTodo evidence matches moved rows only
- [ ] stale selected todo -> zero writes / zero pending
- [ ] invalid target -> zero writes / zero pending
- [ ] picker cancel preserves selection
- [ ] success exits selection
- [ ] tab restores
- [ ] Back/reentry leaves no stuck selection/tab chrome
- [ ] summary visible normal / hidden selection
- [ ] iOS native large-title/list height remains correct
- [ ] normal-mode reorder regression smoke
- [ ] normal-mode favorite interaction regression smoke
- [ ] no unrelated screen or schema behavior changed

Record commit/platform/device/build/steps/expected/actual/DB/pending evidence.

## Gate 9: First Milestone Closeout

- [ ] update implementation audit A01-A13 statuses using actual evidence
- [ ] update validation record with current device/build results
- [ ] record any retained custom iOS interaction boundary
- [ ] ensure no deferred bulk actions were accidentally added
- [ ] user reviews first-milestone result

Only after closeout choose the next single milestone.

## Deferred Milestones — Not Authorized by This Task File

### Bulk Delete / Complete / Favorite

Includes:

- offline-first bulk delete
- bulk complete/uncomplete
- recurrence occurrence snapshot
- favorite add/remove override
- destructive confirmation policy implementation

### TodoScreen Selection

Includes F25 calendar hide/state restore and TodoScreen-specific interaction verification.

### Android Todo/Favorite Native Parity

Includes:

- long-press selection;
- explicit native drag affordance;
- ItemTouchHelper reorder;
- anchored item menu;
- Android summary/list parity.

### Other Deferred Work

- Account Hub
- settings native rollout
- theme rollout
- Todo form redesign
- broad dependency upgrades
