import UIKit

extension NativeListInteractionsView {
  func setCustomTodoDragSourceCellHidden(_ hidden: Bool) {
    guard
      let itemId = customTodoDragSession?.itemId,
      let indexPath = dataSource.indexPath(for: itemId),
      let cell = collectionView.cellForItem(at: indexPath)
    else {
      customTodoDragSourceCell?.alpha = hidden ? 0 : 1
      return
    }

    cell.alpha = hidden ? 0 : 1
    customTodoDragSourceCell = cell
  }

  func removeCustomTodoDragInsertionIndicator() {
    customTodoDragInsertionIndicatorView?.removeFromSuperview()
    customTodoDragInsertionIndicatorView = nil
  }

  func forceExpandSectionTemporarilyIfNeeded(_ sectionId: String) {
    guard
      let section = sections.first(where: { $0.id == sectionId }),
      section.items.contains(where: { $0.kind == "sectionHeader" && $0.collapsed == true }),
      section.items.contains(where: { $0.kind == "todo" && $0.hidden == true }),
      !temporarilyExpandedSectionIds.contains(sectionId)
    else {
      return
    }

    temporarilyExpandedSectionIds.insert(sectionId)
    applySnapshot(animatingDifferences: true)
    DispatchQueue.main.async { [weak self] in
      guard let self else {
        return
      }
      self.reconfigureVisibleCellsForCurrentMode()
      self.setCustomTodoDragSourceCellHidden(true)

      if let location = self.lastInteractiveMovementLocation {
        self.updateCustomTodoDropTarget(at: location)
      }
    }
  }

  func updateCollapsedSectionAutoExpandIfNeeded(at location: CGPoint) {
    guard customInteractiveReorderActive || customTodoDragSession != nil else {
      cancelCollapsedSectionAutoExpand()
      return
    }

    guard
      let indexPath = collectionView.indexPathForItem(at: location),
      sections.indices.contains(indexPath.section)
    else {
      cancelCollapsedSectionAutoExpand()
      return
    }

    let section = sections[indexPath.section]
    guard
      let item = item(at: indexPath),
      item.kind == "sectionHeader",
      item.collapsed == true,
      section.items.contains(where: { $0.kind == "todo" && $0.hidden == true }),
      !temporarilyExpandedSectionIds.contains(section.id)
    else {
      cancelCollapsedSectionAutoExpand()
      return
    }

    if hoveredCollapsedSectionId == section.id {
      return
    }

    cancelCollapsedSectionAutoExpand()
    hoveredCollapsedSectionId = section.id

    let workItem = DispatchWorkItem { [weak self] in
      guard let self else {
        return
      }
      self.collapsedSectionAutoExpandWorkItem = nil
      self.hoveredCollapsedSectionId = nil
      self.forceExpandSectionTemporarilyIfNeeded(section.id)
    }

    collapsedSectionAutoExpandWorkItem = workItem
    DispatchQueue.main.asyncAfter(
      deadline: .now() + collapsedSectionAutoExpandDelay,
      execute: workItem
    )
  }

  func beginCustomTodoDrag(
    for item: NativeItem,
    at sourceIndexPath: IndexPath,
    locationInCollection: CGPoint,
    locationInOverlay: CGPoint
  ) {
    guard customTodoDragSession == nil else {
      return
    }

    let overlayHost = currentCustomCategoryMenuOverlayHostView()
    restoreCustomCategoryMenuSourceCellAppearance()

    guard let sourceCell = collectionView.cellForItem(at: sourceIndexPath) else {
      return
    }

    let snapshotSourceView = customCategoryMenuPreviewContainerView ?? sourceCell
    let snapshotFrame = snapshotSourceView.convert(snapshotSourceView.bounds, to: overlayHost)
    let snapshotView = snapshotSourceView.snapshotView(afterScreenUpdates: false) ?? UIView(frame: snapshotFrame)
    snapshotView.frame = snapshotFrame
    snapshotView.layer.shadowColor = UIColor.black.cgColor
    snapshotView.layer.shadowOpacity = 0.18
    snapshotView.layer.shadowRadius = 18
    snapshotView.layer.shadowOffset = CGSize(width: 0, height: 12)
    snapshotView.layer.cornerRadius = 16
    snapshotView.layer.cornerCurve = .continuous

    overlayHost.addSubview(snapshotView)
    overlayHost.bringSubviewToFront(snapshotView)

    let touchOffset = CGPoint(
      x: locationInOverlay.x - snapshotFrame.midX,
      y: locationInOverlay.y - snapshotFrame.midY
    )

    customTodoDragSession = CustomTodoDragSession(
      itemId: item.id,
      sourceSectionId: sections[sourceIndexPath.section].id,
      touchOffset: touchOffset
    )
    customTodoDragSnapshotView = snapshotView
    customTodoDragSourceCell = sourceCell
    customTodoDragDropTarget = nil
    lastInteractiveMovementLocation = locationInCollection
    lastInteractiveMovementOverlayLocation = locationInOverlay
    dismissCustomCategoryMenuOverlay(animated: false)
    setCustomTodoDragSourceCellHidden(true)
    updateCustomTodoDragSnapshotPosition(to: locationInOverlay)
    updateCustomTodoDropTarget(at: locationInCollection)
    updateCustomDragAutoScrollIfNeeded(at: locationInCollection)
  }

  func updateCustomTodoDragSnapshotPosition(to locationInOverlay: CGPoint) {
    guard
      let session = customTodoDragSession,
      let snapshotView = customTodoDragSnapshotView
    else {
      return
    }

    snapshotView.center = CGPoint(
      x: locationInOverlay.x - session.touchOffset.x,
      y: locationInOverlay.y - session.touchOffset.y
    )
  }

  func visibleTodoSectionLayouts(excluding draggedItemId: String?) -> [CustomTodoSectionLayout] {
    let visibleIndexPathByItemId: [String: IndexPath] = Dictionary(
      uniqueKeysWithValues: collectionView.indexPathsForVisibleItems.compactMap { indexPath in
        guard let itemId = dataSource.itemIdentifier(for: indexPath) else {
          return nil
        }
        return (itemId, indexPath)
      }
    )

    return sections.enumerated().compactMap { sectionIndex, section -> CustomTodoSectionLayout? in
      guard isTodoCategoryModeSection(section) else {
        return nil
      }

      let visibleSectionItems = visibleItems(in: section)
      let headerItem = visibleSectionItems.first(where: { $0.kind == "sectionHeader" })
      let headerFrame: CGRect?
      if
        let headerItem,
        let indexPath = visibleIndexPathByItemId[headerItem.id],
        let cell = collectionView.cellForItem(at: indexPath)
      {
        headerFrame = cell.frame
      } else {
        headerFrame = nil
      }

      let absoluteTodoItems = todoItems(in: section, excluding: draggedItemId)
      let absoluteIndexByItemId = Dictionary(
        uniqueKeysWithValues: absoluteTodoItems.enumerated().map { index, item in
          (item.id, index)
        }
      )
      let todoEntries = visibleSectionItems.compactMap { visibleItem -> CustomTodoVisibleTodoEntry? in
        guard
          visibleItem.kind == "todo",
          visibleItem.id != draggedItemId,
          let indexPath = visibleIndexPathByItemId[visibleItem.id],
          let cell = collectionView.cellForItem(at: indexPath),
          let absoluteIndex = absoluteIndexByItemId[visibleItem.id]
        else {
          return nil
        }

        return CustomTodoVisibleTodoEntry(
          itemId: visibleItem.id,
          absoluteIndex: absoluteIndex,
          frame: cell.frame
        )
      }

      return CustomTodoSectionLayout(
        sectionId: section.id,
        sectionIndex: sectionIndex,
        collapsed: isSectionCollapsed(section),
        headerFrame: headerFrame,
        todoEntries: todoEntries
      )
    }
  }

  func resolveCustomTodoDropTarget(at location: CGPoint) -> CustomTodoDropTarget? {
    guard let draggedItemId = customTodoDragSession?.itemId else {
      return nil
    }

    let layouts = visibleTodoSectionLayouts(excluding: draggedItemId)
    guard !layouts.isEmpty else {
      return nil
    }

    for layout in layouts where layout.collapsed {
      guard let headerFrame = layout.headerFrame else {
        continue
      }

      let hitFrame = headerFrame.insetBy(dx: 0, dy: -6)
      if hitFrame.contains(location) {
        let todoCount = todoItems(in: sections[layout.sectionIndex], excluding: draggedItemId).count
        return CustomTodoDropTarget(
          sectionId: layout.sectionId,
          insertionIndex: todoCount,
          collapsed: true
        )
      }
    }

    for (layoutIndex, layout) in layouts.enumerated() where !layout.collapsed {
      let nextHeaderMinY = layouts
        .dropFirst(layoutIndex + 1)
        .compactMap(\.headerFrame?.minY)
        .first
      let sectionMinY = layout.headerFrame?.minY
        ?? layout.todoEntries.first?.frame.minY
        ?? collectionView.bounds.minY
      let sectionMaxY = nextHeaderMinY
        ?? max(
          layout.todoEntries.last?.frame.maxY ?? sectionMinY,
          layout.headerFrame?.maxY ?? sectionMinY
        ) + 32

      guard location.y >= sectionMinY, location.y < sectionMaxY else {
        continue
      }

      let insertionIndex: Int
      if layout.todoEntries.isEmpty {
        insertionIndex = 0
      } else {
        let entriesBeforeLocation = layout.todoEntries.filter { location.y > $0.frame.midY }

        if let lastEntryBeforeLocation = entriesBeforeLocation.last {
          insertionIndex = lastEntryBeforeLocation.absoluteIndex + 1
        } else {
          insertionIndex = layout.todoEntries.first?.absoluteIndex ?? 0
        }
      }

      return CustomTodoDropTarget(
        sectionId: layout.sectionId,
        insertionIndex: insertionIndex,
        collapsed: false
      )
    }

    return nil
  }

  func updateCustomTodoInsertionIndicator(for target: CustomTodoDropTarget) {
    guard sections.contains(where: { $0.id == target.sectionId }) else {
      removeCustomTodoDragInsertionIndicator()
      return
    }

    if target.collapsed {
      removeCustomTodoDragInsertionIndicator()
      return
    }

    let layout = visibleTodoSectionLayouts(excluding: customTodoDragSession?.itemId)
      .first(where: { $0.sectionId == target.sectionId })
    guard let layout else {
      removeCustomTodoDragInsertionIndicator()
      return
    }

    let indicator = customTodoDragInsertionIndicatorView ?? {
      let view = UIView(frame: .zero)
      view.backgroundColor = UIColor.systemBlue
      view.layer.cornerRadius = 1
      collectionView.addSubview(view)
      customTodoDragInsertionIndicatorView = view
      return view
    }()

    let horizontalInset: CGFloat = 56
    let yPosition: CGFloat
    let firstVisibleAbsoluteIndex = layout.todoEntries.first?.absoluteIndex ?? 0
    let afterLastVisibleAbsoluteIndex = (layout.todoEntries.last?.absoluteIndex ?? -1) + 1

    if target.insertionIndex <= firstVisibleAbsoluteIndex {
      if let firstTodoFrame = layout.todoEntries.first?.frame {
        yPosition = firstTodoFrame.minY
      } else if let headerFrame = layout.headerFrame {
        yPosition = headerFrame.maxY
      } else {
        yPosition = collectionView.bounds.minY + 8
      }
    } else if target.insertionIndex >= afterLastVisibleAbsoluteIndex {
      if let lastTodoFrame = layout.todoEntries.last?.frame {
        yPosition = lastTodoFrame.maxY
      } else if let headerFrame = layout.headerFrame {
        yPosition = headerFrame.maxY
      } else {
        yPosition = collectionView.bounds.minY + 8
      }
    } else {
      guard let nextVisibleEntry = layout.todoEntries.first(where: { $0.absoluteIndex >= target.insertionIndex }) else {
        removeCustomTodoDragInsertionIndicator()
        return
      }

      yPosition = nextVisibleEntry.frame.minY
    }

    let sectionBounds = collectionView.bounds.insetBy(dx: 16, dy: 0)
    indicator.frame = CGRect(
      x: sectionBounds.minX + horizontalInset,
      y: yPosition - 1,
      width: max(32, sectionBounds.width - horizontalInset - 12),
      height: 2
    )
    collectionView.bringSubviewToFront(indicator)
  }

  func updateCustomTodoDropTarget(at location: CGPoint) {
    guard customTodoDragSession != nil else {
      customTodoDragDropTarget = nil
      removeCustomTodoDragInsertionIndicator()
      return
    }

    let target = resolveCustomTodoDropTarget(at: location)
    customTodoDragDropTarget = target

    if let target {
      updateCustomTodoInsertionIndicator(for: target)
    } else {
      removeCustomTodoDragInsertionIndicator()
    }
  }

  func updateCustomTodoDrag(
    locationInCollection: CGPoint,
    locationInOverlay: CGPoint
  ) {
    guard customTodoDragSession != nil else {
      return
    }

    lastInteractiveMovementLocation = locationInCollection
    lastInteractiveMovementOverlayLocation = locationInOverlay
    updateCustomTodoDragSnapshotPosition(to: locationInOverlay)
    updateCustomTodoDropTarget(at: locationInCollection)
    updateCollapsedSectionAutoExpandIfNeeded(at: locationInCollection)
    updateCustomDragAutoScrollIfNeeded(at: locationInCollection)
  }

  func completeCustomTodoDrag(cancelled: Bool) {
    guard let session = customTodoDragSession else {
      return
    }

    let target = cancelled ? nil : customTodoDragDropTarget
    let shouldCommit = target != nil
    let expandedSectionIdsToPersist = shouldCommit ? Array(temporarilyExpandedSectionIds) : []
    stopCustomDragAutoScroll()

    if let target {
      commitCustomTodoDrag(session: session, target: target)
    }

    let snapshotView = customTodoDragSnapshotView
    customTodoDragSession = nil
    customTodoDragDropTarget = nil
    customTodoDragSnapshotView = nil
    removeCustomTodoDragInsertionIndicator()
    cancelCollapsedSectionAutoExpand()

    let cleanup = {
      snapshotView?.removeFromSuperview()
      self.setCustomTodoDragSourceCellHidden(false)
      self.customTodoDragSourceCell = nil
      self.lastInteractiveMovementLocation = nil
      self.lastInteractiveMovementOverlayLocation = nil
      self.reconfigureVisibleCellsForCurrentMode()
    }

    if let snapshotView {
      UIView.animate(
        withDuration: 0.18,
        delay: 0,
        options: [.curveEaseOut, .beginFromCurrentState],
        animations: {
          snapshotView.alpha = 0
          snapshotView.transform = CGAffineTransform(scaleX: 0.96, y: 0.96)
        },
        completion: { _ in
          cleanup()
        }
      )
    } else {
      cleanup()
    }

    if !shouldCommit {
      discardTemporarilyExpandedSectionsIfNeeded()
      return
    }

    expandedSectionIdsToPersist.forEach { sectionId in
      onSectionExpandRequest([
        "sectionId": sectionId
      ])
    }
  }

  func commitCustomTodoDrag(
    session: CustomTodoDragSession,
    target: CustomTodoDropTarget
  ) {
    guard
      let sourceSectionIndex = sections.firstIndex(where: { $0.id == session.sourceSectionId }),
      let targetSectionIndex = sections.firstIndex(where: { $0.id == target.sectionId }),
      let movedItem = sections[sourceSectionIndex].items.first(where: { $0.id == session.itemId })
    else {
      return
    }

    var updatedSections = sections
    let sourceTodoItems = todoItems(in: updatedSections[sourceSectionIndex], excluding: session.itemId)
    var targetTodoItems = todoItems(in: updatedSections[targetSectionIndex], excluding: session.itemId)
    let clampedInsertionIndex = min(max(target.insertionIndex, 0), targetTodoItems.count)
    targetTodoItems.insert(movedItem, at: clampedInsertionIndex)

    updatedSections[sourceSectionIndex] = rebuildTodoSection(
      updatedSections[sourceSectionIndex],
      todoItems: sourceTodoItems
    )
    updatedSections[targetSectionIndex] = rebuildTodoSection(
      updatedSections[targetSectionIndex],
      todoItems: targetTodoItems
    )

    sections = updatedSections
    applySnapshot(animatingDifferences: false)
    DispatchQueue.main.async { [weak self] in
      self?.reconfigureVisibleCellsForCurrentMode()
    }

    onReorder(
      buildTodoReorderPayload(
        movedItemId: session.itemId,
        fromSectionId: session.sourceSectionId,
        toSectionId: target.sectionId
      )
    )
  }
}
