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
      focusedCategoryMenuPanOrigin = locationInOverlay
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
      guard distance >= focusedCategoryMenuReorderThreshold else {
        return
      }

      if
        let item = findItem(by: session.itemId),
        shouldUseCustomSectionHeaderDragEngine(for: item, at: session.sourceIndexPath)
      {
        beginCustomSectionHeaderDrag(
          for: item,
          at: session.sourceIndexPath,
          locationInCollection: locationInCollection,
          locationInOverlay: locationInOverlay
        )
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
      guard didBegin else {
        customCategoryMenuSourceCell?.alpha = 0
        return
      }

      customInteractiveReorderActive = true
      setSystemInteractiveReorderSourceCellDimmed(true)
      DispatchQueue.main.async { [weak self] in
        self?.setSystemInteractiveReorderSourceCellDimmed(true)
      }
      dismissCustomCategoryMenuOverlay(animated: false)
      lastInteractiveMovementLocation = locationInCollection
      collectionView.updateInteractiveMovementTargetPosition(locationInCollection)

    case .ended:
      focusedCategoryMenuPanOrigin = nil

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
        setSystemInteractiveReorderSourceCellDimmed(false)
        customInteractiveReorderActive = false
        reconfigureVisibleCellsForCurrentMode()
        return
      }

      if
        let previewContainer = customCategoryMenuPreviewContainerView,
        previewContainer.frame.contains(locationInOverlay)
      {
        return
      }

    case .cancelled, .failed:
      focusedCategoryMenuPanOrigin = nil

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
        setSystemInteractiveReorderSourceCellDimmed(false)
        customInteractiveReorderActive = false
        reconfigureVisibleCellsForCurrentMode()
      }
      discardTemporarilyExpandedSectionsIfNeeded()

    default:
      break
    }
  }
}
