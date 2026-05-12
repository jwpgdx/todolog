import UIKit

extension NativeListInteractionsView {
  @objc
  func handleCategoryCustomLongPress(_ recognizer: UILongPressGestureRecognizer) {
    guard let menuInteractionStyle = currentCustomCategoryMenuInteractionStyle() else {
      return
    }

    let location = recognizer.location(in: collectionView)
    let overlayHost = currentCustomCategoryMenuOverlayHostView()
    let overlayLocation = collectionView.convert(location, to: overlayHost)

    switch recognizer.state {
    case .began:
      handleCategoryCustomLongPressBegan(
        at: location,
        overlayLocation: overlayLocation,
        overlayHost: overlayHost,
        menuInteractionStyle: menuInteractionStyle
      )

    case .changed:
      handleCategoryCustomLongPressChanged(
        at: location,
        overlayLocation: overlayLocation
      )

    case .ended:
      handleCategoryCustomLongPressEnded()

    case .cancelled, .failed:
      handleCategoryCustomLongPressCancelled()

    default:
      break
    }
  }

}
