import UIKit

extension NativeListInteractionsView {
  func setCustomTodoDragSourceCellDimmed(_ dimmed: Bool) {
    let alpha = dimmed ? customDragSourceCellDimmedAlpha : 1
    guard
      let itemId = customTodoDragSession?.itemId,
      let indexPath = dataSource.indexPath(for: itemId),
      let cell = collectionView.cellForItem(at: indexPath)
    else {
      customTodoDragSourceCell?.alpha = alpha
      return
    }

    cell.alpha = alpha
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
      self.setCustomTodoDragSourceCellDimmed(true)

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

    let layouts = visibleTodoSectionLayouts(excluding: customTodoDragSession?.itemId)
    guard
      let layout = collapsedSectionLayout(at: location, in: layouts),
      sections.indices.contains(layout.sectionIndex)
    else {
      cancelCollapsedSectionAutoExpand()
      return
    }

    let section = sections[layout.sectionIndex]
    guard
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

  func collapsedSectionLayout(
    at location: CGPoint,
    in layouts: [CustomTodoSectionLayout]
  ) -> CustomTodoSectionLayout? {
    for layout in layouts where layout.collapsed {
      guard let headerFrame = layout.headerFrame else {
        continue
      }

      var hitFrame = headerFrame.insetBy(dx: -8, dy: -collapsedSectionAutoExpandHitSlop)
      hitFrame.origin.x = collectionView.bounds.minX
      hitFrame.size.width = collectionView.bounds.width

      if hitFrame.contains(location) {
        return layout
      }
    }

    return nil
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

    guard let sourceCell = collectionView.cellForItem(at: sourceIndexPath) else {
      return
    }

    let snapshotSourceView = customCategoryMenuPreviewContainerView ?? sourceCell
    if snapshotSourceView === sourceCell {
      restoreCustomCategoryMenuSourceCellAppearance()
    }

    let snapshotFrame = snapshotSourceView.convert(snapshotSourceView.bounds, to: overlayHost)
    let snapshotView = snapshotSourceView.snapshotView(afterScreenUpdates: false) ?? UIView(frame: snapshotFrame)
    let dragPreviewStyle = listTodoPreviewStyle(for: sourceIndexPath, phase: .dragPreview)
    snapshotView.frame = snapshotFrame
    applyPreviewShadowStyle(dragPreviewStyle.shadow, to: snapshotView)
    applyCategoryPreviewCornerStyle(dragPreviewStyle.cornerStyle, to: snapshotView)
    snapshotView.layer.cornerCurve = .continuous

    overlayHost.addSubview(snapshotView)
    overlayHost.bringSubviewToFront(snapshotView)

    let anchorLocationInOverlay = customDragAnchorLocationInOverlay(
      for: item.id,
      fallback: locationInOverlay
    )
    let touchOffset = CGPoint(
      x: anchorLocationInOverlay.x - snapshotFrame.midX,
      y: anchorLocationInOverlay.y - snapshotFrame.midY
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
    dismissCustomCategoryMenuOverlay(animated: false, restoreTemporaryCollapse: false)
    setCustomTodoDragSourceCellDimmed(true)
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
    var visibleFrameBySectionIndex: [Int: CGRect] = [:]

    collectionView.indexPathsForVisibleItems.forEach { indexPath in
      guard
        sections.indices.contains(indexPath.section),
        let cell = collectionView.cellForItem(at: indexPath)
      else {
        return
      }

      if let currentFrame = visibleFrameBySectionIndex[indexPath.section] {
        visibleFrameBySectionIndex[indexPath.section] = currentFrame.union(cell.frame)
      } else {
        visibleFrameBySectionIndex[indexPath.section] = cell.frame
      }
    }

    return sections.enumerated().compactMap { sectionIndex, section -> CustomTodoSectionLayout? in
      guard isCustomTodoDragTargetSection(section) else {
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
        dropFrame: customTodoSectionDropFrame(
          for: sectionIndex,
          visibleFrameBySectionIndex: visibleFrameBySectionIndex
        ),
        headerFrame: headerFrame,
        todoEntries: todoEntries
      )
    }
  }

  func customTodoSectionDropFrame(
    for sectionIndex: Int,
    visibleFrameBySectionIndex: [Int: CGRect]
  ) -> CGRect {
    let ownFrame = visibleFrameBySectionIndex[sectionIndex]
    let previousMaxY = (0..<sectionIndex)
      .compactMap { visibleFrameBySectionIndex[$0]?.maxY }
      .max()
    let nextMinY = ((sectionIndex + 1)..<sections.count)
      .compactMap { visibleFrameBySectionIndex[$0]?.minY }
      .min()
    let minY = ownFrame?.minY ?? previousMaxY ?? collectionView.bounds.minY
    let ownMaxY = ownFrame?.maxY ?? minY
    let maxY = nextMinY ?? max(ownMaxY + 80, collectionView.bounds.maxY)

    return CGRect(
      x: collectionView.bounds.minX,
      y: minY,
      width: collectionView.bounds.width,
      height: max(44, maxY - minY)
    )
  }

  func resolveCustomTodoDropTarget(at location: CGPoint) -> CustomTodoDropTarget? {
    guard let draggedItemId = customTodoDragSession?.itemId else {
      return nil
    }

    let layouts = visibleTodoSectionLayouts(excluding: draggedItemId)
    guard !layouts.isEmpty else {
      return nil
    }

    if let collapsedLayout = collapsedSectionLayout(at: location, in: layouts) {
      let todoCount = todoItems(in: sections[collapsedLayout.sectionIndex], excluding: draggedItemId).count
      return CustomTodoDropTarget(
        sectionId: collapsedLayout.sectionId,
        insertionIndex: todoCount,
        collapsed: true
      )
    }

    for (layoutIndex, layout) in layouts.enumerated() where !layout.collapsed {
      let nextSectionMinY = layouts
        .dropFirst(layoutIndex + 1)
        .map(\.dropFrame.minY)
        .first
      let sectionMinY = layout.dropFrame.minY
      let sectionMaxY = nextSectionMinY ?? layout.dropFrame.maxY

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

    let yPosition: CGFloat
    let firstVisibleAbsoluteIndex = layout.todoEntries.first?.absoluteIndex ?? 0
    let afterLastVisibleAbsoluteIndex = (layout.todoEntries.last?.absoluteIndex ?? -1) + 1

    if target.insertionIndex <= firstVisibleAbsoluteIndex {
      if let firstTodoFrame = layout.todoEntries.first?.frame {
        yPosition = firstTodoFrame.minY
      } else if let headerFrame = layout.headerFrame {
        yPosition = headerFrame.maxY
      } else {
        yPosition = layout.dropFrame.minY
      }
    } else if target.insertionIndex >= afterLastVisibleAbsoluteIndex {
      if let lastTodoFrame = layout.todoEntries.last?.frame {
        yPosition = lastTodoFrame.maxY
      } else if let headerFrame = layout.headerFrame {
        yPosition = headerFrame.maxY
      } else {
        yPosition = layout.dropFrame.minY
      }
    } else {
      guard let nextVisibleEntry = layout.todoEntries.first(where: { $0.absoluteIndex >= target.insertionIndex }) else {
        removeCustomTodoDragInsertionIndicator()
        return
      }

      yPosition = nextVisibleEntry.frame.minY
    }

    indicator.frame = CGRect(
      x: collectionView.bounds.minX,
      y: yPosition - 1,
      width: max(32, collectionView.bounds.width),
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

    let resolvedTarget = resolveCustomTodoDropTarget(at: location)
    let target = resolvedTarget.flatMap { resolvedTarget -> CustomTodoDropTarget? in
      guard let session = customTodoDragSession else {
        return resolvedTarget
      }
      return normalizedCustomTodoDropTarget(session: session, target: resolvedTarget)
    }
    if
      let session = customTodoDragSession,
      let target,
      !shouldCommitCustomTodoDrag(session: session, target: target)
    {
      customTodoDragDropTarget = nil
      removeCustomTodoDragInsertionIndicator()
      return
    }

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
    let shouldCommit = target.map { shouldCommitCustomTodoDrag(session: session, target: $0) } ?? false
    var expandedSectionIdsToPersist = shouldCommit ? Array(temporarilyExpandedSectionIds) : []
    if
      shouldCommit,
      let target,
      shouldPersistExpandedSectionAfterCustomTodoDrop(target.sectionId)
    {
      expandedSectionIdsToPersist.append(target.sectionId)
    }
    stopCustomDragAutoScroll()

    if shouldCommit {
      Set(expandedSectionIdsToPersist).forEach { sectionId in
        onSectionExpandRequest([
          "sectionId": sectionId
        ])
      }
    }

    if shouldCommit, let target {
      commitCustomTodoDrag(session: session, target: target)
    }

    let snapshotView = customTodoDragSnapshotView
    let restoreFrame = !shouldCommit ? customTodoDragRestoreFrame() : nil
    customTodoDragSession = nil
    customTodoDragDropTarget = nil
    customTodoDragSnapshotView = nil
    removeCustomTodoDragInsertionIndicator()
    cancelCollapsedSectionAutoExpand()

    let cleanup = {
      snapshotView?.removeFromSuperview()
      self.setCustomTodoDragSourceCellDimmed(false)
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
          if let restoreFrame {
            snapshotView.frame = restoreFrame
            snapshotView.transform = .identity
          } else {
            snapshotView.alpha = 0
            snapshotView.transform = CGAffineTransform(scaleX: 0.96, y: 0.96)
          }
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
  }

  func shouldPersistExpandedSectionAfterCustomTodoDrop(_ sectionId: String) -> Bool {
    guard
      let section = sections.first(where: { $0.id == sectionId }),
      section.items.contains(where: { $0.kind == "sectionHeader" }),
      isSectionCollapsedByPayload(section)
    else {
      return false
    }

    return true
  }

  func customTodoDragRestoreFrame() -> CGRect? {
    guard
      let sourceCell = customTodoDragSourceCell,
      let overlayHost = customTodoDragSnapshotView?.superview
    else {
      return nil
    }

    return sourceCell.convert(sourceCell.bounds, to: overlayHost)
  }

  func shouldCommitCustomTodoDrag(
    session: CustomTodoDragSession,
    target: CustomTodoDropTarget
  ) -> Bool {
    guard
      let sourceSectionIndex = sections.firstIndex(where: { $0.id == session.sourceSectionId }),
      let targetSectionIndex = sections.firstIndex(where: { $0.id == target.sectionId }),
      let movedItem = sections[sourceSectionIndex].items.first(where: { $0.id == session.itemId })
    else {
      return false
    }

    let sourceSection = sections[sourceSectionIndex]
    let targetSection = sections[targetSectionIndex]
    let isDroppingToFavorites = targetSection.id == "favorites"

    if isDroppingToFavorites {
      return true
    }

    guard movedItem.dropTargetable != false else {
      return false
    }

    guard targetSection.dropOutsideReorderRangeBehavior == "returnOriginal" else {
      return true
    }

    let targetTodoItems = todoItems(in: targetSection, excluding: session.itemId)
    let firstTargetableIndex = targetTodoItems.firstIndex { item in
      item.kind == movedItem.kind && item.reorderable == true && item.dropTargetable != false
    }

    if
      firstTargetableIndex == nil,
      sourceSection.id == "favorites"
    {
      return true
    }

    guard let firstTargetableIndex else {
      return false
    }

    return target.insertionIndex >= firstTargetableIndex &&
      target.insertionIndex <= targetTodoItems.count
  }

  func normalizedCustomTodoDropTarget(
    session: CustomTodoDragSession,
    target: CustomTodoDropTarget
  ) -> CustomTodoDropTarget {
    guard
      let sourceSectionIndex = sections.firstIndex(where: { $0.id == session.sourceSectionId }),
      let targetSectionIndex = sections.firstIndex(where: { $0.id == target.sectionId })
    else {
      return target
    }

    let sourceSection = sections[sourceSectionIndex]
    let targetSection = sections[targetSectionIndex]
    guard
      sourceSection.id == "favorites",
      targetSection.id != "favorites",
      targetSection.dropOutsideReorderRangeBehavior == "returnOriginal"
    else {
      return target
    }

    let targetTodoItems = todoItems(in: targetSection, excluding: session.itemId)
    guard let firstTargetableIndex = targetTodoItems.firstIndex(where: { item in
      item.kind == "todo" && item.reorderable == true && item.dropTargetable != false
    }) else {
      return CustomTodoDropTarget(
        sectionId: target.sectionId,
        insertionIndex: targetTodoItems.count,
        collapsed: target.collapsed
      )
    }

    guard target.insertionIndex < firstTargetableIndex else {
      return target
    }

    return CustomTodoDropTarget(
      sectionId: target.sectionId,
      insertionIndex: firstTargetableIndex,
      collapsed: target.collapsed
    )
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
