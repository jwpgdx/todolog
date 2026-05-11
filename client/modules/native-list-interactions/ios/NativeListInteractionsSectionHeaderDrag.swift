import UIKit

extension NativeListInteractionsView {
  func setCustomSectionHeaderDragSourceCellHidden(_ hidden: Bool) {
    guard
      let itemId = customSectionHeaderDragSession?.itemId,
      let indexPath = dataSource.indexPath(for: itemId),
      let cell = collectionView.cellForItem(at: indexPath)
    else {
      customSectionHeaderDragSourceCell?.alpha = hidden ? 0 : 1
      return
    }

    cell.alpha = hidden ? 0 : 1
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

    let sectionBounds = collectionView.bounds.insetBy(dx: 16, dy: 0)
    indicator.frame = CGRect(
      x: sectionBounds.minX + 12,
      y: yPosition - 1.5,
      width: max(36, sectionBounds.width - 24),
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
    restoreCustomCategoryMenuSourceCellAppearance()

    guard let sourceCell = collectionView.cellForItem(at: sourceIndexPath) else {
      return
    }

    let snapshotFrame = sourceCell.convert(sourceCell.bounds, to: overlayHost)
    let snapshotView = sourceCell.snapshotView(afterScreenUpdates: false) ?? UIView(frame: snapshotFrame)
    snapshotView.frame = snapshotFrame
    snapshotView.layer.shadowColor = UIColor.black.cgColor
    snapshotView.layer.shadowOpacity = 0.18
    snapshotView.layer.shadowRadius = 18
    snapshotView.layer.shadowOffset = CGSize(width: 0, height: 12)
    snapshotView.layer.cornerRadius = 16
    snapshotView.layer.cornerCurve = .continuous

    overlayHost.addSubview(snapshotView)
    overlayHost.bringSubviewToFront(snapshotView)

    let sourceSection = sections[sourceIndexPath.section]
    let touchOffset = CGPoint(
      x: locationInOverlay.x - snapshotFrame.midX,
      y: locationInOverlay.y - snapshotFrame.midY
    )

    customSectionHeaderDragSession = CustomSectionHeaderDragSession(
      itemId: item.id,
      sectionId: sourceSection.id,
      wasInitiallyCollapsed: isSectionCollapsed(sourceSection),
      touchOffset: touchOffset
    )
    customSectionHeaderDragSnapshotView = snapshotView
    customSectionHeaderDragSourceCell = sourceCell
    customSectionHeaderDropTarget = nil
    lastInteractiveMovementLocation = locationInCollection
    lastInteractiveMovementOverlayLocation = locationInOverlay

    dismissCustomCategoryMenuOverlay(animated: false)

    if !isSectionCollapsed(sourceSection) {
      temporarilyCollapsedSectionIds.insert(sourceSection.id)
      applySnapshot(animatingDifferences: true) { [weak self] in
        guard let self else {
          return
        }
        self.reconfigureVisibleCellsForCurrentMode()
        self.setCustomSectionHeaderDragSourceCellHidden(true)
        if let location = self.lastInteractiveMovementLocation {
          self.updateCustomSectionHeaderDropTarget(at: location)
        }
      }
    }

    setCustomSectionHeaderDragSourceCellHidden(true)
    updateCustomSectionHeaderSnapshotPosition(to: locationInOverlay)
    updateCustomSectionHeaderDropTarget(at: locationInCollection)
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
  }

  func completeCustomSectionHeaderDrag(cancelled: Bool) {
    guard let session = customSectionHeaderDragSession else {
      return
    }

    let target = cancelled ? nil : customSectionHeaderDropTarget
    stopCustomDragAutoScroll()

    if let target {
      commitCustomSectionHeaderDrag(session: session, target: target)
    } else if !session.wasInitiallyCollapsed {
      temporarilyCollapsedSectionIds.remove(session.sectionId)
      applySnapshot(animatingDifferences: false) { [weak self] in
        self?.reconfigureVisibleCellsForCurrentMode()
      }
    }

    let snapshotView = customSectionHeaderDragSnapshotView
    customSectionHeaderDragSession = nil
    customSectionHeaderDropTarget = nil
    customSectionHeaderDragSnapshotView = nil
    removeCustomSectionHeaderInsertionIndicator()

    let cleanup = {
      snapshotView?.removeFromSuperview()
      self.setCustomSectionHeaderDragSourceCellHidden(false)
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

    if !session.wasInitiallyCollapsed {
      temporarilyCollapsedSectionIds.remove(session.sectionId)
    }

    applySnapshot(animatingDifferences: false) { [weak self] in
      self?.reconfigureVisibleCellsForCurrentMode()
    }

    onReorder(buildTodoReorderPayload())
  }
}
