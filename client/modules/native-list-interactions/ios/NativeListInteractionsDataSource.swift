import UIKit

extension NativeListInteractionsView {
  func configureDataSource() {
    dataSource = UICollectionViewDiffableDataSource<String, String>(
      collectionView: collectionView
    ) { [weak self] collectionView, indexPath, itemId in
      guard let self, let item = self.findItem(by: itemId) else {
        return nil
      }
      let cell = collectionView.dequeueReusableCell(
        withReuseIdentifier: self.cellReuseIdentifier,
        for: indexPath
      )
      self.configure(cell: cell, with: item)
      return cell
    }

    dataSource.supplementaryViewProvider = { [weak self] collectionView, elementKind, indexPath in
      guard let self else {
        return nil
      }

      switch elementKind {
      case UICollectionView.elementKindSectionHeader:
        guard
          self.shouldShowSectionHeaders,
          self.sections.indices.contains(indexPath.section),
          self.sections[indexPath.section].title?.isEmpty == false
        else {
          return nil
        }

        return collectionView.dequeueConfiguredReusableSupplementary(
          using: self.headerRegistration,
          for: indexPath
        )

      case UICollectionView.elementKindSectionFooter:
        guard
          self.shouldShowSectionFooters,
          self.sections.indices.contains(indexPath.section),
          self.sections[indexPath.section].footer?.isEmpty == false
        else {
          return nil
        }

        return collectionView.dequeueConfiguredReusableSupplementary(
          using: self.footerRegistration,
          for: indexPath
        )

      default:
        return nil
      }
    }

    dataSource.reorderingHandlers.canReorderItem = { [weak self] itemId in
      guard let self, let item = self.findItem(by: itemId) else {
        return false
      }
      return (item.kind == "category" || item.kind == "todo") && item.reorderable == true
    }

    dataSource.reorderingHandlers.didReorder = { [weak self] transaction in
      guard let self else {
        return
      }

      let finalSnapshot = transaction.finalSnapshot
      self.rebuildSections(from: finalSnapshot)
      let expandedSectionIdsToPersist = Array(self.temporarilyExpandedSectionIds)
      self.dismissCustomCategoryMenuOverlay(animated: false)
      self.resetCustomCategoryGestureState()
      if self.containsTodoRows() {
        self.onReorder(self.buildTodoReorderPayload())
        expandedSectionIdsToPersist.forEach { sectionId in
          self.onSectionExpandRequest([
            "sectionId": sectionId
          ])
        }
      } else {
        self.onReorder([
          "orderedIds": self.orderedCategoryIds()
        ])
      }
    }
  }

  func visibleItems(in section: NativeSection) -> [NativeItem] {
    if temporarilyCollapsedSectionIds.contains(section.id) {
      return section.items.filter { $0.kind != "todo" }
    }

    if temporarilyExpandedSectionIds.contains(section.id) {
      return section.items
    }

    return section.items.filter { $0.hidden != true }
  }

  func applySnapshot(animatingDifferences: Bool, completion: (() -> Void)? = nil) {
    var snapshot = NSDiffableDataSourceSnapshot<String, String>()

    for section in sections {
      snapshot.appendSections([section.id])
      snapshot.appendItems(visibleItems(in: section).map(\.id), toSection: section.id)
    }

    dataSource.apply(snapshot, animatingDifferences: animatingDifferences, completion: completion)
  }

  func item(at indexPath: IndexPath) -> NativeItem? {
    guard let itemId = dataSource.itemIdentifier(for: indexPath) else {
      return nil
    }
    return findItem(by: itemId)
  }

  func findItem(by itemId: String) -> NativeItem? {
    for section in sections {
      if let item = section.items.first(where: { $0.id == itemId }) {
        return item
      }
    }
    return nil
  }

  func sectionId(for itemId: String) -> String? {
    for section in sections {
      if section.items.contains(where: { $0.id == itemId }) {
        return section.id
      }
    }
    return nil
  }

  func containsTodoRows() -> Bool {
    sections.contains { section in
      section.items.contains(where: { $0.kind == "todo" })
    }
  }

  func buildTodoReorderPayload(
    movedItemId: String? = nil,
    fromSectionId: String? = nil,
    toSectionId: String? = nil
  ) -> [String: Any] {
    var payload: [String: Any] = [
      "sections": sections.map { section in
        [
          "sectionId": section.id,
          "orderedItemIds": section.items.map(\.id)
        ]
      }
    ]

    if let movedItemId {
      payload["movedItemId"] = movedItemId
    }
    if let fromSectionId {
      payload["fromSectionId"] = fromSectionId
    }
    if let toSectionId {
      payload["toSectionId"] = toSectionId
    }

    return payload
  }

  private func rebuildSections(from snapshot: NSDiffableDataSourceSnapshot<String, String>) {
    let sectionById = Dictionary(uniqueKeysWithValues: sections.map { ($0.id, $0) })
    let itemById = Dictionary(uniqueKeysWithValues: sections.flatMap(\.items).map { ($0.id, $0) })

    sections = snapshot.sectionIdentifiers.compactMap { sectionId in
      guard var section = sectionById[sectionId] else {
        return nil
      }

      section = NativeSection(
        id: section.id,
        title: section.title,
        footer: section.footer,
        reorderMode: section.reorderMode,
        items: {
          let visibleIds = snapshot.itemIdentifiers(inSection: sectionId)
          let visibleIdSet = Set(visibleIds)
          let reorderedVisibleItems = visibleIds.compactMap { itemById[$0] }
          let hiddenItems = temporarilyExpandedSectionIds.contains(sectionId)
            ? []
            : section.items.filter { item in
                item.hidden == true && !visibleIdSet.contains(item.id)
              }
          return reorderedVisibleItems + hiddenItems
        }()
      )
      return section
    }
  }

  private func orderedCategoryIds() -> [String] {
    sections.flatMap { section in
      section.items
        .filter { $0.kind == "category" }
        .map(\.id)
    }
  }
}
