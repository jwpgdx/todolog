import UIKit

extension NativeListInteractionsView {
  func handleCategoryCustomLongPressBegan(
    at location: CGPoint,
    overlayLocation: CGPoint,
    overlayHost: UIView,
    menuInteractionStyle: CustomCategoryMenuInteractionStyle
  ) {
    guard
      let indexPath = collectionView.indexPathForItem(at: location),
      let item = item(at: indexPath),
      (item.kind == "category" || item.kind == "todo" || item.kind == "sectionHeader"),
      item.disabled != true,
      let cell = collectionView.cellForItem(at: indexPath)
    else {
      return
    }

    let menuDescriptors = makeNativeMenuActionDescriptors(for: item)
    let cellFrame = cell.convert(cell.bounds, to: overlayHost)
    customCategoryGestureSession = CustomCategoryGestureSession(
      sourceIndexPath: indexPath,
      itemId: item.id,
      itemKind: item.kind,
      origin: overlayLocation,
      reorderable: item.reorderable == true,
      sourceCellFrame: cellFrame
    )

    if !menuDescriptors.isEmpty {
      presentCustomCategoryMenuOverlay(
        for: item,
        at: indexPath,
        descriptors: menuDescriptors,
        interactionStyle: menuInteractionStyle
      )
    } else {
      dismissCustomCategoryMenuOverlay(animated: false)
    }

    temporarilyCollapseSectionHeaderLongPressIfNeeded(for: item, at: indexPath)
  }

  func handleCategoryCustomLongPressChanged(
    at location: CGPoint,
    overlayLocation: CGPoint
  ) {
    guard let session = customCategoryGestureSession else {
      return
    }

    if customSectionHeaderDragSession != nil {
      updateCustomSectionHeaderDrag(
        locationInCollection: location,
        locationInOverlay: overlayLocation
      )
      return
    }

    if customTodoDragSession != nil {
      updateCustomTodoDrag(
        locationInCollection: location,
        locationInOverlay: overlayLocation
      )
      return
    }

    if customInteractiveReorderActive {
      lastInteractiveMovementLocation = location
      updateCollapsedSectionAutoExpandIfNeeded(at: location)
      collectionView.updateInteractiveMovementTargetPosition(location)
      return
    }

    let isInsideMenu = updateCustomCategoryMenuHighlight(at: overlayLocation)
    if isInsideMenu {
      return
    }

    let shouldBegin = shouldBeginCustomCategoryReorder(for: session, at: overlayLocation)
    guard shouldBegin else {
      return
    }

    if
      let item = findItem(by: session.itemId),
      shouldUseCustomSectionHeaderDragEngine(for: item, at: session.sourceIndexPath)
    {
      beginCustomSectionHeaderDrag(
        for: item,
        at: session.sourceIndexPath,
        locationInCollection: location,
        locationInOverlay: overlayLocation
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
        locationInCollection: location,
        locationInOverlay: overlayLocation
      )
      return
    }

    dismissCustomCategoryMenuOverlay(animated: !currentCustomCategoryMenuUsesLiftedPreview())
    let didBegin = collectionView.beginInteractiveMovementForItem(at: session.sourceIndexPath)
    if didBegin {
      customInteractiveReorderActive = true
      setSystemInteractiveReorderSourceCellDimmed(true)
      DispatchQueue.main.async { [weak self] in
        self?.setSystemInteractiveReorderSourceCellDimmed(true)
      }
      lastInteractiveMovementLocation = location
      collectionView.updateInteractiveMovementTargetPosition(location)
    }
  }

  func handleCategoryCustomLongPressEnded() {
    if customSectionHeaderDragSession != nil {
      completeCustomSectionHeaderDrag(cancelled: false)
      dismissCustomCategoryMenuOverlay(animated: false)
    } else if customTodoDragSession != nil {
      completeCustomTodoDrag(cancelled: false)
      dismissCustomCategoryMenuOverlay(animated: false)
    } else if customInteractiveReorderActive {
      collectionView.endInteractiveMovement()
      setSystemInteractiveReorderSourceCellDimmed(false)
      dismissCustomCategoryMenuOverlay(animated: false)
    } else if customCategoryMenuInteractionStyle == .pressAndSlide {
      performCustomCategoryMenuSelectionIfNeeded()
      dismissCustomCategoryMenuOverlay(animated: false)
    } else {
      if customCategoryMenuCardView == nil {
        discardTemporarilyCollapsedSectionsIfNeeded()
      }
    }
    customCategoryGestureSession = nil
    customInteractiveReorderActive = false
    reconfigureVisibleCellsForCurrentMode()
  }

  func handleCategoryCustomLongPressCancelled() {
    if customSectionHeaderDragSession != nil {
      completeCustomSectionHeaderDrag(cancelled: true)
    } else if customTodoDragSession != nil {
      completeCustomTodoDrag(cancelled: true)
    } else if customInteractiveReorderActive {
      collectionView.cancelInteractiveMovement()
      setSystemInteractiveReorderSourceCellDimmed(false)
    }
    dismissCustomCategoryMenuOverlay(animated: true)
    discardTemporarilyExpandedSectionsIfNeeded()
    resetCustomCategoryGestureState()
  }
}
