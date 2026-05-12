import UIKit

extension NativeListInteractionsView {
  @objc
  func handleFocusedCategoryMenuPan(_ recognizer: UIPanGestureRecognizer) {
    guard currentCustomCategoryMenuUsesLiftedPreview() else {
      return
    }

    let overlayHost = currentCustomCategoryMenuOverlayHostView()
    let locationInOverlay = recognizer.location(in: overlayHost)
    let locationInCollection = recognizer.location(in: collectionView)

    switch recognizer.state {
    case .began:
      return

    case .changed:
      if customSectionHeaderDragSession != nil {
        updateCustomSectionHeaderDrag(
          locationInCollection: locationInCollection,
          locationInOverlay: locationInOverlay
        )
        return
      }

      if customTodoDragSession != nil {
        updateCustomTodoDrag(
          locationInCollection: locationInCollection,
          locationInOverlay: locationInOverlay
        )
        return
      }

      if customInteractiveReorderActive {
        lastInteractiveMovementLocation = locationInCollection
        updateCollapsedSectionAutoExpandIfNeeded(at: locationInCollection)
        collectionView.updateInteractiveMovementTargetPosition(locationInCollection)
        return
      }

      guard let session = focusedCategoryMenuSession, session.reorderable else {
        return
      }

      let translation = recognizer.translation(in: self)
      let distance = hypot(translation.x, translation.y)
      if findItem(by: session.itemId)?.kind == "todo" {
        NSLog(
          "[NativeListInteractionsView] focused pan changed item=%@ distance=%.1f threshold=%.1f",
          session.itemId,
          distance,
          focusedCategoryMenuReorderThreshold
        )
      }
      guard distance >= focusedCategoryMenuReorderThreshold else {
        return
      }

      if
        let item = findItem(by: session.itemId),
        shouldUseCustomTodoCategoryDragEngine(for: item, at: session.sourceIndexPath)
      {
        beginCustomTodoDrag(
          for: item,
          at: session.sourceIndexPath,
          locationInCollection: locationInCollection,
          locationInOverlay: locationInOverlay
        )
        return
      }

      restoreCustomCategoryMenuSourceCellAppearance()
      let didBegin = collectionView.beginInteractiveMovementForItem(at: session.sourceIndexPath)
      if findItem(by: session.itemId)?.kind == "todo" {
        NSLog(
          "[NativeListInteractionsView] focused pan beginInteractiveMovement item=%@ didBegin=%@ section=%ld item=%ld",
          session.itemId,
          didBegin ? "true" : "false",
          session.sourceIndexPath.section,
          session.sourceIndexPath.item
        )
      }
      guard didBegin else {
        customCategoryMenuSourceCell?.alpha = 0
        return
      }

      customInteractiveReorderActive = true
      dismissCustomCategoryMenuOverlay(animated: false)
      lastInteractiveMovementLocation = locationInCollection
      collectionView.updateInteractiveMovementTargetPosition(locationInCollection)

    case .ended:
      if customSectionHeaderDragSession != nil {
        completeCustomSectionHeaderDrag(cancelled: false)
        return
      }

      if customTodoDragSession != nil {
        completeCustomTodoDrag(cancelled: false)
        return
      }

      if customInteractiveReorderActive {
        collectionView.endInteractiveMovement()
        customInteractiveReorderActive = false
        return
      }

      if
        let previewContainer = customCategoryMenuPreviewContainerView,
        previewContainer.frame.contains(locationInOverlay)
      {
        return
      }

    case .cancelled, .failed:
      if customSectionHeaderDragSession != nil {
        completeCustomSectionHeaderDrag(cancelled: true)
        return
      }

      if customTodoDragSession != nil {
        completeCustomTodoDrag(cancelled: true)
        return
      }

      if customInteractiveReorderActive {
        collectionView.cancelInteractiveMovement()
        customInteractiveReorderActive = false
      }
      discardTemporarilyExpandedSectionsIfNeeded()

    default:
      break
    }
  }
}
