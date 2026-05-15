import UIKit

extension NativeListInteractionsView {
  func temporarilyCollapseSectionHeaderLongPressIfNeeded(
    for item: NativeItem,
    at indexPath: IndexPath
  ) {
    guard
      item.kind == "sectionHeader",
      iosCategoryGestureMode == .customLifted,
      sections.indices.contains(indexPath.section)
    else {
      return
    }

    let section = sections[indexPath.section]
    guard
      isTodoCategoryModeSection(section),
      !isSectionCollapsedByPayload(section),
      !temporarilyCollapsedSectionIds.contains(section.id)
    else {
      return
    }

    temporarilyCollapsedSectionIds.insert(section.id)
    applySnapshot(animatingDifferences: true) { [weak self] in
      self?.reconfigureVisibleCellsForCurrentMode()
    }
  }

  func temporarilyCollapseExpandedTodoCategorySectionsForSectionHeaderDrag(
    completion: (() -> Void)? = nil
  ) {
    let expandedSectionIds = sections.compactMap { section -> String? in
      guard
        isTodoCategoryModeSection(section),
        !isSectionCollapsedByPayload(section)
      else {
        return nil
      }

      return section.id
    }
    let previousCollapsedSectionIds = temporarilyCollapsedSectionIds
    temporarilyCollapsedSectionIds.formUnion(expandedSectionIds)

    guard previousCollapsedSectionIds != temporarilyCollapsedSectionIds else {
      completion?()
      return
    }

    applySnapshot(animatingDifferences: true) { [weak self] in
      self?.reconfigureVisibleCellsForCurrentMode()
      completion?()
    }
  }

  func customDragAnchorLocationInOverlay(
    for itemId: String,
    fallback: CGPoint
  ) -> CGPoint {
    if
      let session = customCategoryGestureSession,
      session.itemId == itemId
    {
      return session.origin
    }

    if
      let session = focusedCategoryMenuSession,
      session.itemId == itemId,
      let origin = focusedCategoryMenuPanOrigin
    {
      return origin
    }

    return fallback
  }

  func makeCustomSectionHeaderDragSnapshotView(
    from sourceView: UIView,
    frame snapshotFrame: CGRect,
    previewStyle: NativeListPreviewStyle
  ) -> UIView {
    let container = UIView(frame: snapshotFrame)
    container.backgroundColor = .clear

    let clippedContent = UIView(frame: container.bounds)
    clippedContent.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    clippedContent.backgroundColor = resolvedDefaultCategorySurfaceColor()
    clippedContent.clipsToBounds = true
    clippedContent.layer.cornerCurve = .continuous
    applyCategoryPreviewCornerStyle(previewStyle.cornerStyle, to: clippedContent)

    if let cellSnapshot = sourceView.snapshotView(afterScreenUpdates: false) {
      cellSnapshot.frame = clippedContent.bounds
      cellSnapshot.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      clippedContent.addSubview(cellSnapshot)
    }

    container.addSubview(clippedContent)
    applyPreviewShadowStyle(previewStyle.shadow, to: container)
    container.layer.cornerRadius = previewStyle.cornerStyle.radius
    container.layer.maskedCorners = previewStyle.cornerStyle.maskedCorners
    container.layer.cornerCurve = .continuous

    return container
  }

  func setCustomSectionHeaderDragSourceCellDimmed(_ dimmed: Bool) {
    let alpha = dimmed ? customDragSourceCellDimmedAlpha : 1
    guard
      let itemId = customSectionHeaderDragSession?.itemId,
      let indexPath = dataSource.indexPath(for: itemId),
      let cell = collectionView.cellForItem(at: indexPath)
    else {
      customSectionHeaderDragSourceCell?.alpha = alpha
      return
    }

    cell.alpha = alpha
    customSectionHeaderDragSourceCell = cell
  }

  func removeCustomSectionHeaderInsertionIndicator() {
    customSectionHeaderInsertionIndicatorView?.removeFromSuperview()
    customSectionHeaderInsertionIndicatorView = nil
  }

  func visibleSectionHeaderLayouts(excluding draggedSectionId: String?) -> [CustomSectionHeaderLayout] {
    sections.enumerated().compactMap { sectionIndex, section in
      guard
        isTodoCategoryModeSection(section),
        section.id != draggedSectionId,
        let headerItem = sectionHeaderItem(in: section),
        dataSource.indexPath(for: headerItem.id) != nil
      else {
        return nil
      }

      let visibleSectionItems = visibleItems(in: section)
      let visibleFrames = visibleSectionItems.compactMap { visibleItem -> CGRect? in
        guard
          let visibleIndexPath = dataSource.indexPath(for: visibleItem.id),
          let cell = collectionView.cellForItem(at: visibleIndexPath)
        else {
          return nil
        }

        return cell.frame
      }

      guard let firstFrame = visibleFrames.first else {
        return nil
      }

      let frame = visibleFrames.dropFirst().reduce(firstFrame) { partial, nextFrame in
        partial.union(nextFrame)
      }

      return CustomSectionHeaderLayout(
        sectionId: section.id,
        sectionIndex: sectionIndex,
        reorderable: headerItem.reorderable == true,
        frame: frame
      )
    }
  }

  func updateCustomSectionHeaderSnapshotPosition(to locationInOverlay: CGPoint) {
    guard
      let session = customSectionHeaderDragSession,
      let snapshotView = customSectionHeaderDragSnapshotView
    else {
      return
    }

    snapshotView.center = CGPoint(
      x: locationInOverlay.x - session.touchOffset.x,
      y: locationInOverlay.y - session.touchOffset.y
    )
  }

  func resolveCustomSectionHeaderDropTarget(at location: CGPoint) -> CustomSectionHeaderDropTarget? {
    let layouts = visibleSectionHeaderLayouts(excluding: customSectionHeaderDragSession?.sectionId)
    guard !layouts.isEmpty else {
      return nil
    }

    let minimumInsertionSectionIndex = minimumSectionHeaderInsertionIndex(in: layouts)

    for layout in layouts {
      if location.y < layout.frame.midY {
        let insertionSectionIndex = max(layout.sectionIndex, minimumInsertionSectionIndex)
        return CustomSectionHeaderDropTarget(insertionSectionIndex: insertionSectionIndex)
      }
    }

    return CustomSectionHeaderDropTarget(
      insertionSectionIndex: layouts.last!.sectionIndex + 1
    )
  }

  func updateCustomSectionHeaderInsertionIndicator(for target: CustomSectionHeaderDropTarget) {
    let layouts = visibleSectionHeaderLayouts(excluding: customSectionHeaderDragSession?.sectionId)
    guard !layouts.isEmpty else {
      removeCustomSectionHeaderInsertionIndicator()
      return
    }

    let minimumInsertionSectionIndex = minimumSectionHeaderInsertionIndex(in: layouts)
    let resolvedInsertionSectionIndex = max(target.insertionSectionIndex, minimumInsertionSectionIndex)

    let indicator = customSectionHeaderInsertionIndicatorView ?? {
      let view = UIView(frame: .zero)
      view.backgroundColor = UIColor.systemBlue.withAlphaComponent(0.95)
      view.layer.cornerRadius = 1.5
      collectionView.addSubview(view)
      customSectionHeaderInsertionIndicatorView = view
      return view
    }()

    let yPosition: CGFloat
    if resolvedInsertionSectionIndex <= minimumInsertionSectionIndex,
       let firstReorderableLayout = layouts.first(where: { $0.reorderable }) {
      yPosition = firstReorderableLayout.frame.minY
    } else if resolvedInsertionSectionIndex > layouts[layouts.count - 1].sectionIndex {
      yPosition = layouts[layouts.count - 1].frame.maxY
    } else if let nextLayout = layouts.first(where: { $0.sectionIndex == resolvedInsertionSectionIndex }) {
      yPosition = nextLayout.frame.minY
    } else {
      yPosition = layouts[layouts.count - 1].frame.maxY
    }

    indicator.frame = CGRect(
      x: collectionView.bounds.minX,
      y: yPosition - 1.5,
      width: max(36, collectionView.bounds.width),
      height: 3
    )
    collectionView.bringSubviewToFront(indicator)
  }

  func updateCustomSectionHeaderDropTarget(at location: CGPoint) {
    guard customSectionHeaderDragSession != nil else {
      customSectionHeaderDropTarget = nil
      removeCustomSectionHeaderInsertionIndicator()
      return
    }
    defer {
      setCustomSectionHeaderDragSourceCellDimmed(true)
    }

    let target = resolveCustomSectionHeaderDropTarget(at: location)
    customSectionHeaderDropTarget = target

    if let target {
      updateCustomSectionHeaderInsertionIndicator(for: target)
    } else {
      removeCustomSectionHeaderInsertionIndicator()
    }
  }

  func beginCustomSectionHeaderDrag(
    for item: NativeItem,
    at sourceIndexPath: IndexPath,
    locationInCollection: CGPoint,
    locationInOverlay: CGPoint
  ) {
    guard
      customSectionHeaderDragSession == nil,
      sections.indices.contains(sourceIndexPath.section)
    else {
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
    let dragPreviewStyle = listHeaderPreviewStyle(for: sourceIndexPath, phase: .dragPreview)
    let snapshotView = makeCustomSectionHeaderDragSnapshotView(
      from: snapshotSourceView,
      frame: snapshotFrame,
      previewStyle: dragPreviewStyle
    )

    overlayHost.addSubview(snapshotView)
    overlayHost.bringSubviewToFront(snapshotView)

    let sourceSection = sections[sourceIndexPath.section]
    let anchorLocationInOverlay = customDragAnchorLocationInOverlay(
      for: item.id,
      fallback: locationInOverlay
    )
    let touchOffset = CGPoint(
      x: anchorLocationInOverlay.x - snapshotFrame.midX,
      y: anchorLocationInOverlay.y - snapshotFrame.midY
    )

    let wasInitiallyCollapsed = isSectionCollapsedByPayload(sourceSection)

    customSectionHeaderDragSession = CustomSectionHeaderDragSession(
      itemId: item.id,
      sectionId: sourceSection.id,
      wasInitiallyCollapsed: wasInitiallyCollapsed,
      touchOffset: touchOffset
    )
    customSectionHeaderDragSnapshotView = snapshotView
    customSectionHeaderDragSourceCell = sourceCell
    customSectionHeaderDropTarget = nil
    lastInteractiveMovementLocation = locationInCollection
    lastInteractiveMovementOverlayLocation = locationInOverlay

    dismissCustomCategoryMenuOverlay(
      animated: false,
      restoreTemporaryCollapse: false,
      restoreSourceCellAppearance: false
    )

    setCustomSectionHeaderDragSourceCellDimmed(true)
    updateCustomSectionHeaderSnapshotPosition(to: locationInOverlay)
    temporarilyCollapseExpandedTodoCategorySectionsForSectionHeaderDrag { [weak self] in
      guard let self else {
        return
      }
      self.setCustomSectionHeaderDragSourceCellDimmed(true)
      if let location = self.lastInteractiveMovementLocation {
        self.updateCustomSectionHeaderDropTarget(at: location)
      }
    }
    DispatchQueue.main.async { [weak self] in
      self?.setCustomSectionHeaderDragSourceCellDimmed(true)
    }
    updateCustomDragAutoScrollIfNeeded(at: locationInCollection)
  }

  func updateCustomSectionHeaderDrag(
    locationInCollection: CGPoint,
    locationInOverlay: CGPoint
  ) {
    guard customSectionHeaderDragSession != nil else {
      return
    }

    lastInteractiveMovementLocation = locationInCollection
    lastInteractiveMovementOverlayLocation = locationInOverlay
    updateCustomSectionHeaderSnapshotPosition(to: locationInOverlay)
    updateCustomSectionHeaderDropTarget(at: locationInCollection)
    updateCustomDragAutoScrollIfNeeded(at: locationInCollection)
    setCustomSectionHeaderDragSourceCellDimmed(true)
  }

  func completeCustomSectionHeaderDrag(cancelled: Bool) {
    guard let session = customSectionHeaderDragSession else {
      return
    }

    let target = cancelled ? nil : customSectionHeaderDropTarget
    stopCustomDragAutoScroll()

    if let target {
      commitCustomSectionHeaderDrag(session: session, target: target)
    } else {
      discardTemporarilyCollapsedSectionsIfNeeded()
    }

    let snapshotView = customSectionHeaderDragSnapshotView
    customSectionHeaderDragSession = nil
    customSectionHeaderDropTarget = nil
    customSectionHeaderDragSnapshotView = nil
    removeCustomSectionHeaderInsertionIndicator()

    let cleanup = {
      snapshotView?.removeFromSuperview()
      self.setCustomSectionHeaderDragSourceCellDimmed(false)
      self.customSectionHeaderDragSourceCell = nil
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
  }

  func commitCustomSectionHeaderDrag(
    session: CustomSectionHeaderDragSession,
    target: CustomSectionHeaderDropTarget
  ) {
    guard let sourceSectionIndex = sections.firstIndex(where: { $0.id == session.sectionId }) else {
      return
    }

    var updatedSections = sections
    let movedSection = updatedSections.remove(at: sourceSectionIndex)
    let minimumInsertionIndex = minimumSectionHeaderInsertionIndex(in: updatedSections)
    let normalizedInsertionIndex = target.insertionSectionIndex > sourceSectionIndex
      ? target.insertionSectionIndex - 1
      : target.insertionSectionIndex
    let clampedInsertionIndex = min(max(normalizedInsertionIndex, minimumInsertionIndex), updatedSections.count)
    updatedSections.insert(movedSection, at: clampedInsertionIndex)
    sections = updatedSections

    temporarilyCollapsedSectionIds.removeAll()

    applySnapshot(animatingDifferences: false) { [weak self] in
      self?.reconfigureVisibleCellsForCurrentMode()
    }

    onReorder(buildTodoReorderPayload())
  }
}
