import UIKit

extension NativeListInteractionsView {
  func resetCustomCategoryGestureState() {
    customCategoryGestureSession = nil
    customInteractiveReorderActive = false
    customCategoryMenuHighlightedIndex = nil
    lastInteractiveMovementLocation = nil
    lastInteractiveMovementOverlayLocation = nil
    cancelCollapsedSectionAutoExpand()
    stopCustomDragAutoScroll()
    customSectionHeaderDragSession = nil
    customSectionHeaderDropTarget = nil
    customSectionHeaderDragSnapshotView?.removeFromSuperview()
    customSectionHeaderDragSnapshotView = nil
    removeCustomSectionHeaderInsertionIndicator()
    setCustomSectionHeaderDragSourceCellHidden(false)
    customSectionHeaderDragSourceCell = nil
    discardTemporarilyCollapsedSectionsIfNeeded()
    customTodoDragSession = nil
    customTodoDragDropTarget = nil
    customTodoDragSnapshotView?.removeFromSuperview()
    customTodoDragSnapshotView = nil
    removeCustomTodoDragInsertionIndicator()
    setCustomTodoDragSourceCellHidden(false)
    customTodoDragSourceCell = nil
  }
}
