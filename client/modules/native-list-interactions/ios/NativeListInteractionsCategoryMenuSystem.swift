import UIKit

extension NativeListInteractionsView {
  @objc
  func handleCategorySystemMenuTrackingLongPress(_ recognizer: UILongPressGestureRecognizer) {
    guard iosCategoryGestureMode == .systemCustom else {
      return
    }

    let location = recognizer.location(in: collectionView)

    switch recognizer.state {
    case .began:
      guard
        let indexPath = collectionView.indexPathForItem(at: location),
        let item = item(at: indexPath),
        item.kind == "category",
        item.disabled != true,
        let cell = collectionView.cellForItem(at: indexPath)
      else {
        return
      }

      let cellFrame = cell.convert(cell.bounds, to: self)
      systemCategoryMenuDismissSession = SystemCategoryMenuDismissSession(
        itemId: item.id,
        origin: location,
        sourceCellFrame: cellFrame
      )

    case .changed:
      guard
        let session = systemCategoryMenuDismissSession,
        visibleCategoryContextMenuItemId == session.itemId
      else {
        return
      }

      let distance = hypot(location.x - session.origin.x, location.y - session.origin.y)
      guard distance >= systemCategoryMenuDismissThreshold else {
        return
      }

      let protectedCellFrame = session.sourceCellFrame.insetBy(dx: -16, dy: -10)
      guard !protectedCellFrame.contains(location) else {
        return
      }

      collectionView.contextMenuInteraction?.dismissMenu()
      resetSystemCategoryMenuDismissState()

    case .ended, .cancelled, .failed:
      resetSystemCategoryMenuDismissState()

    default:
      break
    }
  }

  func resetSystemCategoryMenuDismissState() {
    systemCategoryMenuDismissSession = nil
  }
}
