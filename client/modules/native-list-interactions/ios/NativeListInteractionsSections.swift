import UIKit

extension NativeListInteractionsView {
  func sectionHeaderItem(in section: NativeSection) -> NativeItem? {
    section.items.first(where: { $0.kind == "sectionHeader" })
  }

  func minimumSectionHeaderInsertionIndex(
    in layouts: [CustomSectionHeaderLayout]
  ) -> Int {
    var minimumIndex = 0

    for layout in layouts {
      if layout.reorderable {
        break
      }
      minimumIndex += 1
    }

    return minimumIndex
  }

  func minimumSectionHeaderInsertionIndex(
    in sections: [NativeSection]
  ) -> Int {
    var minimumIndex = 0

    for section in sections {
      if sectionHeaderItem(in: section)?.reorderable == true {
        break
      }
      minimumIndex += 1
    }

    return minimumIndex
  }

  func todoItems(in section: NativeSection, excluding itemId: String? = nil) -> [NativeItem] {
    section.items.filter { item in
      guard item.kind == "todo" else {
        return false
      }
      if let itemId, item.id == itemId {
        return false
      }
      return true
    }
  }

  func isSectionTemporarilyExpanded(_ sectionId: String) -> Bool {
    temporarilyExpandedSectionIds.contains(sectionId)
  }

  func isSectionTemporarilyCollapsed(_ sectionId: String) -> Bool {
    temporarilyCollapsedSectionIds.contains(sectionId)
  }

  func isSectionCollapsed(_ section: NativeSection) -> Bool {
    if isSectionTemporarilyCollapsed(section.id) {
      return true
    }

    return isSectionCollapsedByPayload(section)
  }

  func isSectionCollapsedByPayload(_ section: NativeSection) -> Bool {
    guard let headerItem = sectionHeaderItem(in: section) else {
      return false
    }
    return headerItem.collapsed == true && !isSectionTemporarilyExpanded(section.id)
  }

  func isTodoCategoryModeSection(_ section: NativeSection) -> Bool {
    section.items.contains(where: { $0.kind == "sectionHeader" })
  }

  func shouldUseCustomTodoCategoryDragEngine(for item: NativeItem, at indexPath: IndexPath) -> Bool {
    guard
      item.kind == "todo",
      item.reorderable == true,
      iosCategoryGestureMode == .customLifted,
      sections.indices.contains(indexPath.section)
    else {
      return false
    }

    return isTodoCategoryModeSection(sections[indexPath.section])
  }

  func shouldUseCustomSectionHeaderDragEngine(for item: NativeItem, at indexPath: IndexPath) -> Bool {
    guard
      item.kind == "sectionHeader",
      item.reorderable == true,
      iosCategoryGestureMode == .customLifted,
      sections.indices.contains(indexPath.section)
    else {
      return false
    }

    return isTodoCategoryModeSection(sections[indexPath.section])
  }

  func rebuildTodoSection(_ section: NativeSection, todoItems: [NativeItem]) -> NativeSection {
    let headerItem = sectionHeaderItem(in: section)
    let nonTodoTrailingItems = section.items.filter { item in
      item.kind != "todo" && item.kind != "sectionHeader"
    }
    let shouldHideTodos = isSectionCollapsed(section)
    let rebuiltTodoItems = todoItems.map { item in
      NativeItem(
        id: item.id,
        kind: item.kind,
        variant: item.variant,
        title: item.title,
        subtitle: item.subtitle,
        leadingIcon: item.leadingIcon,
        destructive: item.destructive,
        disabled: item.disabled,
        valueText: item.valueText,
        switchValue: item.switchValue,
        menuActions: item.menuActions,
        accentColor: item.accentColor,
        metaText: item.metaText,
        collapsed: item.collapsed,
        hidden: shouldHideTodos,
        reorderable: item.reorderable,
        deletable: item.deletable,
        supportsMenu: item.supportsMenu,
        toggleControlId: item.toggleControlId,
        toggleControlSource: item.toggleControlSource,
        completed: item.completed
      )
    }

    return NativeSection(
      id: section.id,
      title: section.title,
      footer: section.footer,
      reorderMode: section.reorderMode,
      items: ([headerItem].compactMap { $0 }) + rebuiltTodoItems + nonTodoTrailingItems
    )
  }

  func discardTemporarilyExpandedSectionsIfNeeded() {
    guard !temporarilyExpandedSectionIds.isEmpty else {
      return
    }

    temporarilyExpandedSectionIds.removeAll()
    applySnapshot(animatingDifferences: false) { [weak self] in
      self?.reconfigureVisibleCellsForCurrentMode()
    }
  }

  func discardTemporarilyCollapsedSectionsIfNeeded() {
    guard !temporarilyCollapsedSectionIds.isEmpty else {
      return
    }

    temporarilyCollapsedSectionIds.removeAll()
    applySnapshot(animatingDifferences: false) { [weak self] in
      self?.reconfigureVisibleCellsForCurrentMode()
    }
  }
}
