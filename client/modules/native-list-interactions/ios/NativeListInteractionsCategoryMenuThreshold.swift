import UIKit

extension NativeListInteractionsView {
  func shouldBeginCustomCategoryReorder(
    for session: CustomCategoryGestureSession,
    at location: CGPoint
  ) -> Bool {
    guard session.reorderable else {
      return false
    }

    let distance = hypot(location.x - session.origin.x, location.y - session.origin.y)
    guard distance >= customCategoryReorderThreshold else {
      return false
    }

    let protectedCellFrame = session.sourceCellFrame.insetBy(dx: -16, dy: -10)
    if protectedCellFrame.contains(location) {
      return false
    }

    if session.itemKind != "todo", let cardView = customCategoryMenuCardView {
      let protectedMenuFrame = cardView.frame.insetBy(dx: -16, dy: -12)
      if protectedMenuFrame.contains(location) {
        return false
      }
    }

    return true
  }
}
