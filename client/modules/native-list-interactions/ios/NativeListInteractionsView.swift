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
  var contentInsetBottom: CGFloat = 0
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
  var detachedCollectionViewContextMenuInteraction: UIContextMenuInteraction?
  var customCategoryMenuSourceIndexPath: IndexPath?
  var customCategoryMenuItemId: String?
  var customCategoryMenuDescriptors: [NativeListMenuActionDescriptor] = []
  var customCategoryMenuButtons: [UIButton] = []
  var customCategoryMenuInteractionStyle: CustomCategoryMenuInteractionStyle = .tapButtons
  var customCategoryMenuHighlightedIndex: Int?
  var focusedCategoryMenuSession: FocusedCategoryMenuSession?
  var focusedCategoryMenuPanOrigin: CGPoint?
  let focusedCategoryMenuReorderThreshold: CGFloat = 6
  let collapsedSectionAutoExpandDelay: TimeInterval = 0.5
  let collapsedSectionAutoExpandHitSlop: CGFloat = 26
  let customDragSourceCellDimmedAlpha: CGFloat = 0.32
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
  lazy var categoryCustomLongPressRecognizer: UILongPressGestureRecognizer = {
    let recognizer = UILongPressGestureRecognizer(target: self, action: #selector(handleCategoryCustomLongPress(_:)))
    recognizer.minimumPressDuration = 0.5
    recognizer.allowableMovement = 40
    recognizer.cancelsTouchesInView = true
    recognizer.delegate = self
    return recognizer
  }()
  lazy var categorySystemMenuTrackingRecognizer: UILongPressGestureRecognizer = {
    let recognizer = UILongPressGestureRecognizer(target: self, action: #selector(handleCategorySystemMenuTrackingLongPress(_:)))
    recognizer.minimumPressDuration = 0.35
    recognizer.allowableMovement = 1000
    recognizer.cancelsTouchesInView = false
    recognizer.delegate = self
    return recognizer
  }()
  lazy var focusedCategoryMenuPanRecognizer: UIPanGestureRecognizer = {
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

  func currentInteractiveReorderItemId() -> String? {
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

  func setSystemInteractiveReorderSourceCellDimmed(_ dimmed: Bool) {
    let alpha = dimmed ? customDragSourceCellDimmedAlpha : 1
    let sourceItemId = customCategoryGestureSession?.itemId ?? focusedCategoryMenuSession?.itemId
    let sourceIndexPath = customCategoryGestureSession?.sourceIndexPath ?? focusedCategoryMenuSession?.sourceIndexPath

    if
      let sourceItemId,
      let indexPath = dataSource.indexPath(for: sourceItemId),
      let cell = collectionView.cellForItem(at: indexPath)
    {
      cell.alpha = alpha
      return
    }

    if
      let sourceIndexPath,
      let cell = collectionView.cellForItem(at: sourceIndexPath)
    {
      cell.alpha = alpha
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

    if item.kind == "sectionDivider" {
      return false
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
      let sourceRange = reorderableIndexRange(in: sectionIndex, kind: sourceItem.kind),
      sourceRange.contains(originalIndexPath.item)
    else {
      return originalIndexPath
    }

    let originalReorderMode = sections[sectionIndex].reorderMode ?? "withinSection"
    let allowsCrossSection = sourceItem.kind == "todo" && originalReorderMode == "acrossSections"
    let targetSection = allowsCrossSection && sections.indices.contains(proposedIndexPath.section)
      ? proposedIndexPath.section
      : originalIndexPath.section
    let targetRange = dropTargetableIndexRange(in: targetSection, kind: sourceItem.kind)
    if
      let targetRange,
      !targetRange.contains(proposedIndexPath.item),
      sections[targetSection].dropOutsideReorderRangeBehavior == "returnOriginal"
    {
      return originalIndexPath
    }

    let clampedItem = min(
      max(proposedIndexPath.item, targetRange?.lowerBound ?? sourceRange.lowerBound),
      targetRange?.upperBound ?? sourceRange.upperBound
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

    guard hasNativeMenuActions(for: item) else {
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

  private func dropTargetableIndexRange(in sectionIndex: Int, kind: String) -> ClosedRange<Int>? {
    guard sections.indices.contains(sectionIndex) else {
      return nil
    }

    let visibleSectionItems = visibleItems(in: sections[sectionIndex])
    let targetableIndices = visibleSectionItems.enumerated().compactMap { index, item in
      item.kind == kind && item.reorderable == true && item.dropTargetable != false ? index : nil
    }

    if targetableIndices.isEmpty, kind == "todo" {
      let headerIndex = visibleSectionItems.firstIndex(where: { $0.kind == "sectionHeader" }) ?? -1
      let insertionIndex = max(0, headerIndex + 1)
      return insertionIndex...insertionIndex
    }

    guard
      let firstIndex = targetableIndices.first,
      let lastIndex = targetableIndices.last
    else {
      return nil
    }

    return firstIndex...lastIndex
  }

  func label(for action: String) -> String {
    switch action {
    case "openCategory":
      return "카테고리로 이동"
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
