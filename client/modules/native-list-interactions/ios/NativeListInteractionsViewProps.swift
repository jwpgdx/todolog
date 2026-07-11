import UIKit

extension NativeListInteractionsView {
  func updateSectionsJson(_ sectionsJson: String) {
    dismissCustomCategoryMenuOverlay(animated: false)
    resetCustomCategoryGestureState()
    resetSystemCategoryMenuDismissState()
    cancelCollapsedSectionAutoExpand()

    guard let data = sectionsJson.data(using: .utf8) else {
      sections = []
      temporarilyExpandedSectionIds.removeAll()
      applySnapshot(animatingDifferences: false)
      return
    }

    do {
      sections = try JSONDecoder().decode([NativeSection].self, from: data)
    } catch {
      NSLog("[NativeListInteractionsView] Failed to decode sectionsJson: %@", String(describing: error))
      sections = []
    }

    temporarilyExpandedSectionIds = temporarilyExpandedSectionIds.filter { sectionId in
      guard let section = sections.first(where: { $0.id == sectionId }) else {
        return false
      }

      let hasCollapsedHeader = section.items.contains { item in
        item.kind == "sectionHeader" && item.collapsed == true
      }
      let hasHiddenItems = section.items.contains { item in
        item.kind == "todo" && item.hidden == true
      }
      return hasCollapsedHeader && hasHiddenItems
    }
    temporarilyCollapsedSectionIds = temporarilyCollapsedSectionIds.filter { sectionId in
      sections.contains(where: { section in
        section.id == sectionId && section.items.contains(where: { $0.kind == "sectionHeader" })
      })
    }

    updateCollectionViewScrollBehavior()
    applySnapshot(animatingDifferences: false) { [weak self] in
      guard let self else {
        return
      }

      self.collectionView.setCollectionViewLayout(self.makeLayout(), animated: false)
      DispatchQueue.main.async { [weak self] in
        self?.reconfigureVisibleCellsForCurrentMode()
      }
    }
  }

  func updateIOSCategoryGestureMode(_ mode: String?) {
    iosCategoryGestureMode = IOSCategoryGestureMode(rawValue: mode ?? "") ?? .system
    cancelCollapsedSectionAutoExpand()
    NSLog(
      "[NativeListInteractionsView] updateIOSCategoryGestureMode mode=%@ hasTodoRows=%@",
      iosCategoryGestureMode.rawValue,
      containsTodoRows() ? "true" : "false"
    )
    configureCategoryGestureMode()
    collectionView.collectionViewLayout.invalidateLayout()
    applySnapshot(animatingDifferences: false)
    collectionView.layoutIfNeeded()
    reconfigureVisibleCellsForCurrentMode()
  }

  func updateContentInsetBottom(_ value: Double?) {
    contentInsetBottom = CGFloat(max(0, value ?? 0))
    applyCollectionViewInsets()
  }

  func applyCollectionViewInsets() {
    let bottomInset = contentInsetBottom
    if collectionView.contentInset.bottom != bottomInset {
      collectionView.contentInset.bottom = bottomInset
    }
    if collectionView.verticalScrollIndicatorInsets.bottom != bottomInset {
      collectionView.verticalScrollIndicatorInsets.bottom = bottomInset
    }
  }
}
