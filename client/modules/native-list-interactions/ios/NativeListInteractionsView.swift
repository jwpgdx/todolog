import ExpoModulesCore
import UIKit

final class NativeListInteractionsView: ExpoView, UICollectionViewDelegate, UIGestureRecognizerDelegate {
  let onItemPress = EventDispatcher()
  let onMenuAction = EventDispatcher()
  let onDelete = EventDispatcher()
  let onReorder = EventDispatcher()
  let onToggleSwitch = EventDispatcher()
  let onSectionExpandRequest = EventDispatcher()

  var sections: [NativeSection] = []
  var dataSource: UICollectionViewDiffableDataSource<String, String>!
  var iosCategoryGestureMode: IOSCategoryGestureMode = .system
  private var contentInsetBottom: CGFloat = 0
  let cellReuseIdentifier = "NativeListInteractionsListCell"
  var customCategoryGestureSession: CustomCategoryGestureSession?
  var systemCategoryMenuDismissSession: SystemCategoryMenuDismissSession?
  var visibleCategoryContextMenuItemId: String?
  var customInteractiveReorderActive = false
  let customCategoryReorderThreshold: CGFloat = 22
  let systemCategoryMenuDismissThreshold: CGFloat = 22
  weak var customCategoryMenuBackdropView: UIView?
  weak var customCategoryMenuCardView: UIVisualEffectView?
  weak var customCategoryMenuPreviewContainerView: UIView?
  weak var customCategoryMenuOverlayHostView: UIView?
  weak var customCategoryMenuSourceCell: UICollectionViewCell?
  private var detachedCollectionViewContextMenuInteraction: UIContextMenuInteraction?
  var customCategoryMenuSourceIndexPath: IndexPath?
  var customCategoryMenuItemId: String?
  var customCategoryMenuDescriptors: [CustomCategoryMenuActionDescriptor] = []
  var customCategoryMenuButtons: [UIButton] = []
  var customCategoryMenuInteractionStyle: CustomCategoryMenuInteractionStyle = .tapButtons
  var customCategoryMenuHighlightedIndex: Int?
  var focusedCategoryMenuSession: FocusedCategoryMenuSession?
  let focusedCategoryMenuReorderThreshold: CGFloat = 6
  let collapsedSectionAutoExpandDelay: TimeInterval = 0.5
  var hoveredCollapsedSectionId: String?
  var collapsedSectionAutoExpandWorkItem: DispatchWorkItem?
  var temporarilyExpandedSectionIds = Set<String>()
  var temporarilyCollapsedSectionIds = Set<String>()
  var lastInteractiveMovementLocation: CGPoint?
  var lastInteractiveMovementOverlayLocation: CGPoint?
  private lazy var customDragAutoScroller = NativeListInteractionsAutoScroller(
    activationInset: 88,
    maxVelocity: 920,
    onTick: { [weak self] displayLink in
      self?.handleCustomDragAutoScrollTick(displayLink)
    }
  )
  var customTodoDragSession: CustomTodoDragSession?
  weak var customTodoDragSnapshotView: UIView?
  weak var customTodoDragSourceCell: UICollectionViewCell?
  weak var customTodoDragInsertionIndicatorView: UIView?
  var customTodoDragDropTarget: CustomTodoDropTarget?
  var customSectionHeaderDragSession: CustomSectionHeaderDragSession?
  weak var customSectionHeaderDragSnapshotView: UIView?
  weak var customSectionHeaderDragSourceCell: UICollectionViewCell?
  weak var customSectionHeaderInsertionIndicatorView: UIView?
  var customSectionHeaderDropTarget: CustomSectionHeaderDropTarget?
  private lazy var categoryCustomLongPressRecognizer: UILongPressGestureRecognizer = {
    let recognizer = UILongPressGestureRecognizer(target: self, action: #selector(handleCategoryCustomLongPress(_:)))
    recognizer.minimumPressDuration = 0.5
    recognizer.allowableMovement = 40
    recognizer.cancelsTouchesInView = true
    recognizer.delegate = self
    return recognizer
  }()
  private lazy var categorySystemMenuTrackingRecognizer: UILongPressGestureRecognizer = {
    let recognizer = UILongPressGestureRecognizer(target: self, action: #selector(handleCategorySystemMenuTrackingLongPress(_:)))
    recognizer.minimumPressDuration = 0.35
    recognizer.allowableMovement = 1000
    recognizer.cancelsTouchesInView = false
    recognizer.delegate = self
    return recognizer
  }()
  private lazy var focusedCategoryMenuPanRecognizer: UIPanGestureRecognizer = {
    let recognizer = UIPanGestureRecognizer(target: self, action: #selector(handleFocusedCategoryMenuPan(_:)))
    recognizer.cancelsTouchesInView = true
    recognizer.delegate = self
    return recognizer
  }()

  lazy var collectionView: UICollectionView = {
    let layout = makeLayout()
    let view = UICollectionView(frame: .zero, collectionViewLayout: layout)
    view.translatesAutoresizingMaskIntoConstraints = false
    view.backgroundColor = .clear
    view.delegate = self
    view.dragInteractionEnabled = false
    view.isScrollEnabled = false
    view.alwaysBounceVertical = false
    return view
  }()

  lazy var headerRegistration = makeHeaderRegistration()

  lazy var footerRegistration = makeFooterRegistration()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    backgroundColor = .clear

    addSubview(collectionView)
    addGestureRecognizer(focusedCategoryMenuPanRecognizer)
    NSLayoutConstraint.activate([
      collectionView.leadingAnchor.constraint(equalTo: leadingAnchor),
      collectionView.trailingAnchor.constraint(equalTo: trailingAnchor),
      collectionView.topAnchor.constraint(equalTo: topAnchor),
      collectionView.bottomAnchor.constraint(equalTo: bottomAnchor)
    ])

    collectionView.register(UICollectionViewListCell.self, forCellWithReuseIdentifier: cellReuseIdentifier)
    configureDataSource()
    configureCategoryGestureMode()
    applyCollectionViewInsets()
  }

  func updateSectionsJson(_ sectionsJson: String) {
    dismissCustomCategoryMenuOverlay(animated: false)
    resetCustomCategoryGestureState()
    resetSystemCategoryMenuDismissState()
    cancelCollapsedSectionAutoExpand()

    guard let data = sectionsJson.data(using: .utf8) else {
      sections = []
      temporarilyExpandedSectionIds.removeAll()
      applySnapshot(animatingDifferences: false)
      return
    }

    do {
      sections = try JSONDecoder().decode([NativeSection].self, from: data)
    } catch {
      NSLog("[NativeListInteractionsView] Failed to decode sectionsJson: %@", String(describing: error))
      sections = []
    }

    temporarilyExpandedSectionIds = temporarilyExpandedSectionIds.filter { sectionId in
      guard let section = sections.first(where: { $0.id == sectionId }) else {
        return false
      }

      let hasCollapsedHeader = section.items.contains { item in
        item.kind == "sectionHeader" && item.collapsed == true
      }
      let hasHiddenItems = section.items.contains { item in
        item.kind == "todo" && item.hidden == true
      }
      return hasCollapsedHeader && hasHiddenItems
    }
    temporarilyCollapsedSectionIds = temporarilyCollapsedSectionIds.filter { sectionId in
      sections.contains(where: { section in
        section.id == sectionId && section.items.contains(where: { $0.kind == "sectionHeader" })
      })
    }

    updateCollectionViewScrollBehavior()
    collectionView.setCollectionViewLayout(makeLayout(), animated: false)
    applySnapshot(animatingDifferences: false)
    DispatchQueue.main.async { [weak self] in
      self?.reconfigureVisibleCellsForCurrentMode()
    }
  }

  func updateIOSCategoryGestureMode(_ mode: String?) {
    iosCategoryGestureMode = IOSCategoryGestureMode(rawValue: mode ?? "") ?? .system
    cancelCollapsedSectionAutoExpand()
    NSLog(
      "[NativeListInteractionsView] updateIOSCategoryGestureMode mode=%@ hasTodoRows=%@",
      iosCategoryGestureMode.rawValue,
      containsTodoRows() ? "true" : "false"
    )
    configureCategoryGestureMode()
    collectionView.reloadData()
    collectionView.layoutIfNeeded()
    reconfigureVisibleCellsForCurrentMode()
  }

  func updateContentInsetBottom(_ value: Double?) {
    contentInsetBottom = CGFloat(max(0, value ?? 0))
    applyCollectionViewInsets()
  }

  private func applyCollectionViewInsets() {
    let bottomInset = contentInsetBottom
    if collectionView.contentInset.bottom != bottomInset {
      collectionView.contentInset.bottom = bottomInset
    }
    if collectionView.scrollIndicatorInsets.bottom != bottomInset {
      collectionView.scrollIndicatorInsets.bottom = bottomInset
    }
  }

  private func setCollectionViewContextMenuEnabled(_ enabled: Bool) {
    if enabled {
      if
        let interaction = detachedCollectionViewContextMenuInteraction,
        !collectionView.interactions.contains(where: { $0 === interaction })
      {
        collectionView.addInteraction(interaction)
      }
      detachedCollectionViewContextMenuInteraction = nil
      return
    }

    if detachedCollectionViewContextMenuInteraction == nil {
      detachedCollectionViewContextMenuInteraction = collectionView.contextMenuInteraction
    }

    if
      let interaction = detachedCollectionViewContextMenuInteraction,
      collectionView.interactions.contains(where: { $0 === interaction })
    {
      collectionView.removeInteraction(interaction)
    }
  }

  private func configureCategoryGestureMode() {
    switch iosCategoryGestureMode {
    case .system:
      setCollectionViewContextMenuEnabled(true)
      if collectionView.gestureRecognizers?.contains(categoryCustomLongPressRecognizer) == true {
        collectionView.removeGestureRecognizer(categoryCustomLongPressRecognizer)
      }
      if collectionView.gestureRecognizers?.contains(categorySystemMenuTrackingRecognizer) == true {
        collectionView.removeGestureRecognizer(categorySystemMenuTrackingRecognizer)
      }
      dismissCustomCategoryMenuOverlay(animated: false)
      resetCustomCategoryGestureState()
      resetSystemCategoryMenuDismissState()
    case .customExperiment, .customLifted, .systemCustom:
      if iosCategoryGestureMode == .customExperiment || iosCategoryGestureMode == .customLifted {
        setCollectionViewContextMenuEnabled(false)
        if collectionView.gestureRecognizers?.contains(categorySystemMenuTrackingRecognizer) == true {
          collectionView.removeGestureRecognizer(categorySystemMenuTrackingRecognizer)
        }
        if collectionView.gestureRecognizers?.contains(categoryCustomLongPressRecognizer) != true {
          collectionView.addGestureRecognizer(categoryCustomLongPressRecognizer)
        }
        resetSystemCategoryMenuDismissState()
      } else {
        setCollectionViewContextMenuEnabled(true)
        if collectionView.gestureRecognizers?.contains(categoryCustomLongPressRecognizer) == true {
          collectionView.removeGestureRecognizer(categoryCustomLongPressRecognizer)
        }
        if collectionView.gestureRecognizers?.contains(categorySystemMenuTrackingRecognizer) != true {
          collectionView.addGestureRecognizer(categorySystemMenuTrackingRecognizer)
        }
        dismissCustomCategoryMenuOverlay(animated: false)
        resetCustomCategoryGestureState()
      }
    }
  }

  func cancelCollapsedSectionAutoExpand() {
    collapsedSectionAutoExpandWorkItem?.cancel()
    collapsedSectionAutoExpandWorkItem = nil
    hoveredCollapsedSectionId = nil
  }

  func stopCustomDragAutoScroll() {
    customDragAutoScroller.stop()
  }

  func updateCustomDragAutoScrollIfNeeded(at locationInCollection: CGPoint) {
    customDragAutoScroller.update(
      locationInCollection: locationInCollection,
      bounds: collectionView.bounds,
      isActive: customTodoDragSession != nil || customSectionHeaderDragSession != nil
    )
  }

  @objc
  private func handleCustomDragAutoScrollTick(_ displayLink: CADisplayLink) {
    guard customTodoDragSession != nil || customSectionHeaderDragSession != nil else {
      stopCustomDragAutoScroll()
      return
    }

    let minOffsetY = -collectionView.adjustedContentInset.top
    let maxOffsetY = max(
      minOffsetY,
      collectionView.contentSize.height - collectionView.bounds.height + collectionView.adjustedContentInset.bottom
    )

    guard maxOffsetY > minOffsetY else {
      stopCustomDragAutoScroll()
      return
    }

    let currentOffsetY = collectionView.contentOffset.y
    let deltaY = customDragAutoScroller.currentVelocity * CGFloat(displayLink.duration)
    let nextOffsetY = min(max(currentOffsetY + deltaY, minOffsetY), maxOffsetY)

    if abs(nextOffsetY - currentOffsetY) < 0.5 {
      stopCustomDragAutoScroll()
      return
    }

    collectionView.setContentOffset(
      CGPoint(x: collectionView.contentOffset.x, y: nextOffsetY),
      animated: false
    )

    guard let locationInCollection = lastInteractiveMovementLocation else {
      return
    }

    if let locationInOverlay = lastInteractiveMovementOverlayLocation {
      if customTodoDragSession != nil {
        updateCustomTodoDragSnapshotPosition(to: locationInOverlay)
      } else if customSectionHeaderDragSession != nil {
        updateCustomSectionHeaderSnapshotPosition(to: locationInOverlay)
      }
    }

    if customTodoDragSession != nil {
      updateCustomTodoDropTarget(at: locationInCollection)
      updateCollapsedSectionAutoExpandIfNeeded(at: locationInCollection)
    } else if customSectionHeaderDragSession != nil {
      updateCustomSectionHeaderDropTarget(at: locationInCollection)
    }
  }

  func sectionHeaderItem(in section: NativeSection) -> NativeItem? {
    section.items.first(where: { $0.kind == "sectionHeader" })
  }

  func minimumSectionHeaderInsertionIndex(
    in layouts: [CustomSectionHeaderLayout]
  ) -> Int {
    var minimumIndex = 0

    for layout in layouts {
      if layout.reorderable {
        break
      }
      minimumIndex += 1
    }

    return minimumIndex
  }

  func minimumSectionHeaderInsertionIndex(
    in sections: [NativeSection]
  ) -> Int {
    var minimumIndex = 0

    for section in sections {
      if sectionHeaderItem(in: section)?.reorderable == true {
        break
      }
      minimumIndex += 1
    }

    return minimumIndex
  }

  func todoItems(in section: NativeSection, excluding itemId: String? = nil) -> [NativeItem] {
    section.items.filter { item in
      guard item.kind == "todo" else {
        return false
      }
      if let itemId, item.id == itemId {
        return false
      }
      return true
    }
  }

  func isSectionTemporarilyExpanded(_ sectionId: String) -> Bool {
    temporarilyExpandedSectionIds.contains(sectionId)
  }

  func isSectionTemporarilyCollapsed(_ sectionId: String) -> Bool {
    temporarilyCollapsedSectionIds.contains(sectionId)
  }

  func isSectionCollapsed(_ section: NativeSection) -> Bool {
    if isSectionTemporarilyCollapsed(section.id) {
      return true
    }

    guard let headerItem = sectionHeaderItem(in: section) else {
      return false
    }
    return headerItem.collapsed == true && !isSectionTemporarilyExpanded(section.id)
  }

  func isTodoCategoryModeSection(_ section: NativeSection) -> Bool {
    section.items.contains(where: { $0.kind == "sectionHeader" })
  }

  func shouldUseCustomTodoCategoryDragEngine(for item: NativeItem, at indexPath: IndexPath) -> Bool {
    guard
      item.kind == "todo",
      item.reorderable == true,
      iosCategoryGestureMode == .customLifted,
      sections.indices.contains(indexPath.section)
    else {
      return false
    }

    return isTodoCategoryModeSection(sections[indexPath.section])
  }

  func shouldUseCustomSectionHeaderDragEngine(for item: NativeItem, at indexPath: IndexPath) -> Bool {
    guard
      item.kind == "sectionHeader",
      item.reorderable == true,
      iosCategoryGestureMode == .customLifted,
      sections.indices.contains(indexPath.section)
    else {
      return false
    }

    return isTodoCategoryModeSection(sections[indexPath.section])
  }

  func rebuildTodoSection(_ section: NativeSection, todoItems: [NativeItem]) -> NativeSection {
    let headerItem = sectionHeaderItem(in: section)
    let nonTodoTrailingItems = section.items.filter { item in
      item.kind != "todo" && item.kind != "sectionHeader"
    }
    let shouldHideTodos = isSectionCollapsed(section)
    let rebuiltTodoItems = todoItems.map { item in
      NativeItem(
        id: item.id,
        kind: item.kind,
        variant: item.variant,
        title: item.title,
        subtitle: item.subtitle,
        leadingIcon: item.leadingIcon,
        destructive: item.destructive,
        disabled: item.disabled,
        valueText: item.valueText,
        switchValue: item.switchValue,
        menuActions: item.menuActions,
        accentColor: item.accentColor,
        metaText: item.metaText,
        collapsed: item.collapsed,
        hidden: shouldHideTodos,
        reorderable: item.reorderable,
        deletable: item.deletable,
        supportsMenu: item.supportsMenu,
        toggleControlId: item.toggleControlId,
        toggleControlSource: item.toggleControlSource,
        completed: item.completed
      )
    }

    return NativeSection(
      id: section.id,
      title: section.title,
      footer: section.footer,
      reorderMode: section.reorderMode,
      items: ([headerItem].compactMap { $0 }) + rebuiltTodoItems + nonTodoTrailingItems
    )
  }

  private func currentInteractiveReorderItemId() -> String? {
    if let itemId = customSectionHeaderDragSession?.itemId {
      return itemId
    }

    if let itemId = customTodoDragSession?.itemId {
      return itemId
    }

    if let itemId = customCategoryGestureSession?.itemId {
      return itemId
    }

    return focusedCategoryMenuSession?.itemId
  }

  func discardTemporarilyExpandedSectionsIfNeeded() {
    guard !temporarilyExpandedSectionIds.isEmpty else {
      return
    }

    temporarilyExpandedSectionIds.removeAll()
    applySnapshot(animatingDifferences: false) { [weak self] in
      self?.reconfigureVisibleCellsForCurrentMode()
    }
  }

  func discardTemporarilyCollapsedSectionsIfNeeded() {
    guard !temporarilyCollapsedSectionIds.isEmpty else {
      return
    }

    temporarilyCollapsedSectionIds.removeAll()
    applySnapshot(animatingDifferences: false) { [weak self] in
      self?.reconfigureVisibleCellsForCurrentMode()
    }
  }

  func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
    collectionView.deselectItem(at: indexPath, animated: true)

    guard let item = item(at: indexPath), item.disabled != true else {
      return
    }

    switch item.kind {
    case "menu":
      switch item.variant {
      case "navigation", "value-navigation":
        onItemPress(["itemId": item.id])
      default:
        break
      }
    case "category":
      onItemPress(["itemId": item.id])
    case "todo":
      onItemPress(["itemId": item.id])
    case "sectionHeader":
      onItemPress(["itemId": item.id])
    default:
      break
    }
  }

  func collectionView(_ collectionView: UICollectionView, shouldHighlightItemAt indexPath: IndexPath) -> Bool {
    guard let item = item(at: indexPath) else {
      return true
    }

    if item.kind == "category" && shouldDisableCustomCategoryHighlightAppearance() {
      return false
    }

    return true
  }

  func collectionView(
    _ collectionView: UICollectionView,
    targetIndexPathForMoveOfItemFromOriginalIndexPath originalIndexPath: IndexPath,
    atCurrentIndexPath currentIndexPath: IndexPath,
    toProposedIndexPath proposedIndexPath: IndexPath
  ) -> IndexPath {
    let sectionIndex = originalIndexPath.section
    guard
      sections.indices.contains(sectionIndex),
      let sourceItem = item(at: originalIndexPath),
      sourceItem.reorderable == true,
      let validRange = reorderableIndexRange(in: sectionIndex, kind: sourceItem.kind),
      validRange.contains(originalIndexPath.item)
    else {
      return originalIndexPath
    }

    let originalReorderMode = sections[sectionIndex].reorderMode ?? "withinSection"
    let allowsCrossSection = sourceItem.kind == "todo" && originalReorderMode == "acrossSections"
    let targetSection = allowsCrossSection && sections.indices.contains(proposedIndexPath.section)
      ? proposedIndexPath.section
      : originalIndexPath.section
    let targetRange = reorderableIndexRange(in: targetSection, kind: sourceItem.kind)
    let clampedItem = min(
      max(proposedIndexPath.item, targetRange?.lowerBound ?? validRange.lowerBound),
      targetRange?.upperBound ?? validRange.upperBound
    )
    return IndexPath(item: clampedItem, section: targetSection)
  }

  func collectionView(
    _ collectionView: UICollectionView,
    contextMenuConfigurationForItemAt indexPath: IndexPath,
    point: CGPoint
  ) -> UIContextMenuConfiguration? {
    guard let item = item(at: indexPath), item.kind == "category" || item.kind == "todo" else {
      return nil
    }

    if item.kind == "todo", item.reorderable == true {
      return nil
    }

    if item.kind == "todo", iosCategoryGestureMode != .system {
      return nil
    }

    if
      item.kind == "category" &&
      (iosCategoryGestureMode == .customExperiment || iosCategoryGestureMode == .customLifted)
    {
      return nil
    }

    let hasMenuActions = item.supportsMenu == true && !(item.menuActions ?? []).isEmpty
    let hasDeleteAction = item.deletable == true
    guard hasMenuActions || hasDeleteAction else {
      return nil
    }

    return UIContextMenuConfiguration(identifier: item.id as NSString, previewProvider: nil) { [weak self] _ in
      guard let self else {
        return nil
      }
      return self.makeItemContextMenu(for: item)
    }
  }

  func collectionView(
    _ collectionView: UICollectionView,
    willDisplayContextMenu configuration: UIContextMenuConfiguration,
    animator: UIContextMenuInteractionAnimating?
  ) {
    visibleCategoryContextMenuItemId = configuration.identifier as? String
  }

  func collectionView(
    _ collectionView: UICollectionView,
    willEndContextMenuInteraction configuration: UIContextMenuConfiguration,
    animator: UIContextMenuInteractionAnimating?
  ) {
    let identifier = configuration.identifier as? String
    if visibleCategoryContextMenuItemId == identifier {
      visibleCategoryContextMenuItemId = nil
    }
    if systemCategoryMenuDismissSession?.itemId == identifier {
      resetSystemCategoryMenuDismissState()
    }
  }

  func gestureRecognizer(
    _ gestureRecognizer: UIGestureRecognizer,
    shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
  ) -> Bool {
    if gestureRecognizer === focusedCategoryMenuPanRecognizer || otherGestureRecognizer === focusedCategoryMenuPanRecognizer {
      return false
    }
    if gestureRecognizer === categorySystemMenuTrackingRecognizer || otherGestureRecognizer === categorySystemMenuTrackingRecognizer {
      return true
    }
    if gestureRecognizer === categoryCustomLongPressRecognizer || otherGestureRecognizer === categoryCustomLongPressRecognizer {
      return false
    }
    return true
  }

  func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
    if gestureRecognizer === focusedCategoryMenuPanRecognizer {
      guard
        currentCustomCategoryMenuUsesLiftedPreview(),
        let previewContainer = customCategoryMenuPreviewContainerView,
        focusedCategoryMenuSession != nil
      else {
        return false
      }

      let location = touch.location(in: currentCustomCategoryMenuOverlayHostView())
      return previewContainer.frame.contains(location)
    }

    guard
      gestureRecognizer === categoryCustomLongPressRecognizer ||
      gestureRecognizer === categorySystemMenuTrackingRecognizer
    else {
      return true
    }

    let location = touch.location(in: collectionView)
    guard
      let indexPath = collectionView.indexPathForItem(at: location),
      let item = item(at: indexPath)
    else {
      return false
    }

    if item.kind == "todo" {
      return item.disabled != true
    }

    if item.kind == "sectionHeader" {
      return item.disabled != true && item.reorderable == true
    }

    return item.kind == "category" && item.disabled != true
  }

  private func reorderableIndexRange(in sectionIndex: Int, kind: String) -> ClosedRange<Int>? {
    guard sections.indices.contains(sectionIndex) else {
      return nil
    }

    let visibleSectionItems = visibleItems(in: sections[sectionIndex])
    let reorderableIndices = visibleSectionItems.enumerated().compactMap { index, item in
      item.kind == kind && item.reorderable == true ? index : nil
    }

    if reorderableIndices.isEmpty, kind == "todo" {
      let headerIndex = visibleSectionItems.firstIndex(where: { $0.kind == "sectionHeader" }) ?? -1
      let insertionIndex = max(0, headerIndex + 1)
      return insertionIndex...insertionIndex
    }

    guard
      let firstIndex = reorderableIndices.first,
      let lastIndex = reorderableIndices.last
    else {
      return nil
    }

    return firstIndex...lastIndex
  }

  func label(for action: String) -> String {
    switch action {
    case "open":
      return "열기"
    case "view":
      return "보기"
    case "rename":
      return "이름 변경"
    case "edit":
      return "편집"
    case "move":
      return "이동"
    case "duplicate":
      return "복제"
    case "archive":
      return "보관"
    case "favorite":
      return "즐겨찾기 추가"
    case "unfavorite":
      return "즐겨찾기 해제"
    case "delete":
      return "삭제"
    default:
      return action
    }
  }

}
