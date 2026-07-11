# Android Presentation Test Record

Last Updated: 2026-05-21
Scope: Android only

## Test Environment

- Device: Android Emulator `Medium_Phone_API_36.1`
- Model: `sdk_gphone64_x86_64`
- Android: 16 / SDK 36
- App: Expo development build
- Test entry: `My Page > 가짜 Presentation 비교`

## Tested Variants

- `push(card)`: Expo Router stack screen with `presentation: 'card'`
- `modal`: Expo Router stack screen with `presentation: 'modal'`
- `formSheet`: Expo Router stack screen with `presentation: 'formSheet'`
- `RN Modal`: React Native `Modal` overlay, not a route

`pageSheet` was removed from the candidate set.

## Frozen Presentation Policy

- `push(card)`: normal navigation inside the app structure.
- Use `push(card)` for list pages, detail pages, settings pages, and drill-down pages inside an existing task flow.
- `modal`: page-like task flow with a clear start and finish.
- Use `modal` for create/edit/account-conversion flows that should temporarily own the user's attention.
- `formSheet`: short selection or option panel only after Android bottom overlay behavior is explicitly tested.
- Do not use `formSheet` for full forms.
- Do not use `formSheet` for form-internal drill-down pages; use push inside the already-presented modal stack instead.
- `RN Modal` / native alert: short interruption such as delete confirmation, warning, authentication prompt, or custom temporary overlay.
- `pageSheet`: no new usage. Existing unfinished todo-form legacy `pageSheet` references are deferred until todo form redesign.

## Frozen Destructive / Action UI Policy

- Simple destructive confirmation can use `Alert.alert` through a shared wrapper; React Native maps it to platform-native dialog styles.
- Android delete confirmations should generally use AlertDialog when the action is destructive or needs explanation.
- Android can use Snackbar + Undo for low-risk single-item deletion once undo support exists.
- Android has no built-in `ActionSheetAndroid`; action lists should use AlertDialog, a custom bottom sheet, or a native Material bottom sheet wrapper.
- Category delete should use an alert/dialog because it deletes the category and its todos.
- Single todo delete can eventually use immediate delete + undo; until undo exists, use a confirmation wrapper where needed.
- Bulk todo delete should ask for confirmation before deleting multiple items.
- Multi-action menus are not the same as delete confirmation: Android should use bottom sheet or platform-appropriate menu for multiple actions.

## Frozen Category Flow

- `category/form`: Expo Router `modal`.
- `category/color`: normal push inside the already-presented category form modal stack.
- `category/color` must not use `formSheet`.
- Reason: color selection is a drill-down step of the category form, not an independent temporary picker. Push keeps the form context/back stack intact and avoids bottom-sheet/tab-overlay ambiguity on Android.
- Test-only routes such as `category/form-modal` and `category/form-formsheet` may remain for comparison, but production entry should use `category/form`.

## Frozen Account Direction

- My Page profile card should eventually open an Account Hub modal instead of going directly to `profile/edit`.
- Account Hub is a dedicated account task space, following the same information architecture as the iOS Settings / App Store-style account modal hub.
- Account Hub owns account-only actions such as profile edit, login/security, linked providers, logout, and account deletion.
- My Page remains the app-level personal/dashboard page; Account Hub owns account management.
- Account Hub internal pages use normal push navigation.
- `profile/edit` should become an Account Hub internal push screen, not a top-level modal by itself.
- Sensitive authentication steps, such as password confirmation, should be handled as modal/overlay gates inside the account flow when redesigned.
- If an auth gate is cancelled, returning to the previous account/app surface is acceptable rather than forcing the user to stay in the gated flow.
- Current `profile/edit` and `profile/verify-password` routes may remain as-is until Account Hub is implemented.

## Frozen Account Hub Structure

- Entry: My Page profile card opens Account Hub as a root-level modal.
- Account Hub uses the native Stack modal header.
- Header title: `계정`.
- Header left action: `닫기`.
- Account Hub body starts with a profile summary: avatar, display name, and email/login status.
- Group 1, account: `프로필 수정`, `로그인 및 보안`, `연결된 계정`.
- Group 2, app account settings: `알림 / 마케팅 수신`, and later sync/backup status if needed.
- Group 3, support and policy: `개인정보 처리방침`, `이용 약관`, and later customer support if needed.
- Group 4, dangerous actions: `로그아웃`, `계정 삭제`.
- Account Hub internal detail pages use push navigation inside the modal stack.
- `프로필 수정` is an internal push screen.
- `로그인 및 보안` is an internal push screen.
- `연결된 계정` is an internal push screen.
- `로그아웃` uses a confirm alert/dialog, not a full page.
- `계정 삭제` uses a separate destructive flow and must not be reduced to a single casual alert.
- Password confirmation, re-authentication, and other sensitive gates use modal/overlay gates inside the account flow.
- Account deletion must stay easy to find inside Account Hub if the app supports account creation.
- Existing profile routes stay as legacy routes until Account Hub implementation replaces them.

## Frozen Delete / Confirm UI

- Category delete: use a centered native alert/dialog, not a bottom sheet.
- Category delete message must clearly state that todos inside the category will also be deleted.
- Category delete buttons: `취소` and destructive `삭제`.
- Single todo delete: immediate delete is acceptable only after undo support exists. Until then, use the shared confirmation wrapper where accidental deletion is likely.
- Bulk todo delete: always confirm before deleting multiple todos.
- Android bulk delete should generally use AlertDialog rather than an iOS-style bottom action sheet.
- Delete confirmations should be routed through a shared helper so wording, destructive styling, and platform behavior stay consistent.
- Confirmation UI should not be implemented as full route modal.

## Frozen Selection Mode

- Entry points: header `...` menu > `일정 선택`, and row long-press menu > `선택`.
- Selection mode does not navigate to a separate screen; the current list screen transforms in place.
- Header left area preserves the original page back context.
- Example: `My Page -> 즐겨찾기` shows `My Page` on the left, and selection mode on `즐겨찾기` should still show `My Page` on the left.
- Header center title is `일정 선택` when 0 items are selected, and `n개 선택됨` when one or more items are selected.
- Header right action is `완료`.
- Body row tap toggles selection.
- The normal completion checkbox/control position is replaced by a selection checkbox/multiselect control.
- Selected row visual state must be explicit.
- Swipe actions, context menus, reorder, and collapse/expand interactions are disabled while selection mode is active.
- Bottom tab bar is hidden during selection mode.
- A shared selection action bar is shown at the bottom.
- Initial action set: delete, complete, favorite, move.
- The action model must be extensible so more actions can be added later without rewriting selection mode.
- All actions are disabled when 0 items are selected.
- Bulk delete uses the frozen delete confirmation policy.
- Bulk move opens the category selection flow.

## Frozen Bulk Action Semantics

- Bulk actions are applied using the selected visible occurrence context.
- Bulk complete completes the selected `occurrenceDate` only.
- Recurring todos are completed only for the selected occurrence, not the entire recurring series.
- Bulk favorite is additive outside the Favorite screen: non-favorite todos are added to favorites, and existing favorites remain unchanged.
- Favorite screen shows `즐겨찾기 해제` instead of `즐겨찾기 추가`.
- Non-Favorite screens show `즐겨찾기 추가` only.
- Bulk favorite assigns `favorite_order` after the current last favorite order, preserving the selected visible order.
- Bulk unfavorite clears `favorite_order` only and does not otherwise change category/custom order.
- Bulk move appends selected todos to the target category after the target category's last `category_order`.
- Bulk move preserves the selected visible order when assigning new `category_order` values.
- Successful bulk actions exit selection mode.
- Bulk actions should run transactionally where possible.
- Avoid partial local success; if one item fails locally, roll back the local bulk action when possible.
- Local SQLite success is treated as UI success; remote sync is handled later by the pending queue.

## Frozen Bulk Move Category Picker

- Bulk move opens a category selection modal.
- The picker should look like an item-list screen, similar in structure to category color selection.
- iOS should present the category picker as a modal coming over the current flow.
- Android should use the same modal route semantics; Android modal may visually behave like a full page.
- Header content is frozen conceptually: title `카테고리 선택`, left `취소`, right `이동`.
- Header implementation uses the native Stack header according to the frozen modal header policy.
- Category rows are selected first; the move is committed by the `이동` action, not by tapping a category row immediately.
- `이동` is disabled until a target category is selected.
- Inbox is included as a valid target category unless a later business rule explicitly forbids it.
- Moving to the same category may be treated as no-op or disabled during implementation.
- Successful move exits selection mode according to the frozen bulk action semantics.
- Modal item-list styling follows the frozen `SelectionList` / `SelectionListScreen` visual policy.

## Frozen Selection List Components

- `SelectionList` is the shared selectable item-list row group.
- `SelectionList` itself is non-scroll by default.
- Parent screen or modal body owns scrolling for embedded/short lists.
- `SelectionList` does not support reorder, drag, auto-scroll, collapse, swipe, or context menu.
- Single-select rows use a trailing checkmark, not radio buttons.
- Navigation rows use a trailing chevron, not a checkmark.
- Row tap changes selected state; whether selection immediately commits or waits for a header action is decided by the host screen.
- Selection rows share the same item model across color, category, settings, and future form choices.
- iOS visual target is native/inset grouped list styling.
- Android visual target is platform-appropriate Material-like list styling.
- The existing `native-settings` family is the standard home for this subsystem.
- `NativeSelectionList` / native-settings implementations may be used as the native renderer, but the conceptual contract is `SelectionList` first.

## Frozen Selection List Screen Pattern

- `SelectionListScreen` is the screen/modal wrapper for selection lists.
- `SelectionListScreen` owns optional header integration, search, empty state, and scrolling.
- `SelectionListScreen` renders `SelectionList` rows inside its body.
- Long lists and searchable lists use `SelectionListScreen`.
- Short embedded lists may use `SelectionList` directly inside an existing parent scroll.
- Time zone selection and language selection use a separate searchable `SelectionListScreen` pattern.
- In time zone and language selection screens, the search field stays pinned under the header while the list scrolls.
- The search field must not scroll away with the option rows on these two screens.
- Search filters local option fields: label, subtitle, and keywords.
- Search is local-only unless a later feature explicitly requires remote search.
- Empty search results show an empty-state message such as `검색 결과가 없습니다.`
- Time zone selection and language selection remain single-select and immediate-commit.
- Bulk move category picker uses the same `SelectionList` item model, but commit waits for the modal header `이동` action.

## Frozen Selection List Adoption Targets

- Category color selection should migrate to `SelectionList`.
- Bulk move category picker should use `SelectionListScreen` modal.
- Settings theme selection should migrate to `SelectionList`.
- Settings language selection should migrate to searchable `SelectionListScreen` with pinned search.
- Settings start-day selection should migrate to `SelectionList`.
- Settings time-zone selection should migrate to `SelectionListScreen` with search.
- Future yes/no, repeat option, notification option, account/security option, and todo-form choices should use the same SelectionList contract.
- Todo form remains deferred until the todo-form redesign.

## Frozen Native Settings List Migration Order

1. Category color selection: short `SelectionList`, single-select, immediate commit.
2. Settings theme selection: short `SelectionList`, single-select, immediate commit.
3. Settings start-day selection: short `SelectionList`, single-select, immediate commit.
4. Settings language selection: searchable `SelectionListScreen` with pinned search, single-select, immediate commit.
5. Settings time-zone selection: searchable `SelectionListScreen` with pinned search, single-select, immediate commit.
6. Bulk move category picker: modal `SelectionListScreen`, single-select staged target, commit through header `이동`.

Rationale:

- Start with short lists to validate the base row, grouped styling, checkmark behavior, and commit contract.
- Move to searchable screens only after the base list behavior is stable.
- Put bulk move last because it differs from normal selection screens: row tap stages a target, while header `이동` commits the real action.

## Frozen Modal Header Policy

- Page-like modals use Expo Router modal routes with the native Stack header.
- Modal headers are configured through Stack/native-stack options such as title, headerLeft, and headerRight.
- Common task modal header patterns are `취소 / 제목 / 완료` and `취소 / 제목 / 이동`.
- Do not build custom RN modal headers by default.
- React Native `Modal` remains reserved for short overlays, alerts, and non-route interruptions.
- `Stack.Toolbar` is not the baseline modal header technology because it is iOS-only/experimental for parts of the current Expo Router surface.
- Modal header behavior should be smoke-tested when a production modal flow is implemented, but no separate prototype is required before the next freeze decision.

## Frozen Create/Edit Task Modal Chrome

- Create/edit task flows open as page-like modal routes above the current app surface.
- The modal should cover the existing screen, including the floating bottom navigation.
- Users should not see or interact with the bottom navigation while a create/edit modal is active.
- Preferred implementation is a root-level modal route above the tab navigator.
- Do not rely on the modal floating above the bottom navigation as a separate layer.
- If route structure forces a modal to open inside a tab stack, explicitly hide or disable the bottom navigation for that modal as a fallback.
- Category add/edit follows this policy.
- Todo add/edit should follow this policy when the todo form redesign resumes.

## Pending Freeze Topics

- Todo form redesign: date-none, repeat, alarm, picker, and input presentation rules are deferred.
- Android parity: verify the same selection-list contract against Android native settings UI before production implementation.

## Observed Behavior

### `push(card)`

- Opens as a full-screen child page.
- Shows Android/native-stack style top header with back arrow.
- Previous screen is not dimmed and not visible.
- Floating bottom tab bar remains visible.
- Android back closes the page and returns to the same My Page scroll position.

Use for normal navigation pages:

- Settings detail
- Category detail
- All todos / Favorites / other list pages
- Category color selection when it is opened from the category form modal

### `modal`

- On Android, current test looks visually almost the same as `push(card)`.
- Opens as a full-screen page with top header and back arrow.
- Previous screen is not dimmed and not visible.
- Floating bottom tab bar remains visible.
- Android back closes the page.

Important note:

- `modal` is still semantically different from `push`: it represents a temporary create/edit flow.
- In the current nested My Page stack, Android visual behavior is effectively full-screen route navigation.

Use for page-like create/edit flows:

- Category add/edit
- Todo add/edit

Follow-up:

- If create/edit modals should hide the floating bottom tab bar, route placement or tab visibility must be adjusted separately.

### `formSheet`

- Opens as a bottom sheet on Android.
- Background is dimmed.
- Sheet has rounded top corners.
- Android back dismisses the sheet.
- It is visually distinct from `push` and `modal`.

Current issue:

- The app floating bottom tab bar / FAB remains above the sheet and overlaps the sheet content.
- Actual category form inside `formSheet` also auto-focuses the text input, which makes the sheet feel cramped.
- The form header/title is not as clear as the full-screen modal path.

Use only after fixing bottom overlay behavior:

- Short picker flows that are not part of a form navigation stack
- Category selection
- Small option panels

Do not use yet for full category add/edit form.
Do not use for `category/color`; color selection is part of the category form flow and should be pushed on top of the form modal.

### `RN Modal`

- Opens as an in-place overlay, not a route.
- Background is dimmed.
- Custom bottom panel slides up.
- Floating bottom tab bar is covered by the overlay instead of sitting above it.
- Close is handled by the custom close button or Android back.

Use for non-route overlays:

- Delete confirmation
- Short warnings
- Custom action sheet-like panels

Do not use for page-like form flows that need route state, header, back stack, or deep linking.

## Actual Category Form Check

### `category/form-modal`

- Opens full-screen.
- Shows top header title `새 카테고리`.
- Text input is auto-focused.
- Floating bottom tab bar remains visible.
- Visual behavior is consistent with Android `modal` observation.

Decision:

- Better candidate than `formSheet` for category add/edit on Android.
- Needs separate decision on whether bottom tab bar should be hidden during the form.

### `category/form-formsheet`

- Opens as bottom sheet.
- Background dims.
- Text input auto-focuses immediately.
- Floating bottom tab bar / FAB overlaps the lower sheet content.
- Not suitable for full category add/edit form in the current layout.

Decision:

- Keep only as a short-picker experiment, not as the category form default.

## Current Android Decision

- Normal pages: `push(card)`
- Page-like create/edit flows: Expo Router `modal`
- Category add/edit: Expo Router `modal` is frozen for both Android and iOS.
- Category color selection: normal push inside the category form modal stack, not `formSheet`.
- Category add/edit header details are not frozen yet.
- Short selection flows: `formSheet` candidate, but blocked until bottom tab overlap is solved
- Simple confirmation / warning overlays: RN `Modal` or platform alert/action sheet
- `pageSheet`: removed

## Open Issues

- Android `modal` and `push(card)` currently both keep the floating bottom tab bar visible.
- Android `formSheet` currently conflicts with the custom floating bottom tab bar / FAB.
- Before freezing final Android sheet UX, test with bottom tab hidden or route mounted above the tab layout.
