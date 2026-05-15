import UIKit

extension NativeListInteractionsView {
  func resetCustomCategoryGestureState() {
    setSystemInteractiveReorderSourceCellDimmed(false)
    customCategoryGestureSession = nil
    customInteractiveReorderActive = false
    customCategoryMenuHighlightedIndex = nil
    focusedCategoryMenuPanOrigin = nil
    lastInteractiveMovementLocation = nil
    lastInteractiveMovementOverlayLocation = nil
    cancelCollapsedSectionAutoExpand()
    stopCustomDragAutoScroll()
    customSectionHeaderDragSession = nil
    customSectionHeaderDropTarget = nil
    customSectionHeaderDragSnapshotView?.removeFromSuperview()
    customSectionHeaderDragSnapshotView = nil
    removeCustomSectionHeaderInsertionIndicator()
    setCustomSectionHeaderDragSourceCellDimmed(false)
    customSectionHeaderDragSourceCell = nil
    discardTemporarilyCollapsedSectionsIfNeeded()
    customTodoDragSession = nil
    customTodoDragDropTarget = nil
    customTodoDragSnapshotView?.removeFromSuperview()
    customTodoDragSnapshotView = nil
    removeCustomTodoDragInsertionIndicator()
    setCustomTodoDragSourceCellDimmed(false)
    customTodoDragSourceCell = nil
  }
}
