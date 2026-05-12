import UIKit

extension NativeListInteractionsView {
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

  func configureCategoryGestureMode() {
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
}
