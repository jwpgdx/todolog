import UIKit

private final class LightweightCategoryPreviewView: UIView {
  private let badgeImageView = UIImageView()
  private let titleLabel = UILabel()
  private let trailingLabel = UILabel()
  private let chevronImageView = UIImageView()

  init(
    title: String,
    trailingValue: String?,
    badgeImage: UIImage?,
    surfaceColor: UIColor
  ) {
    super.init(frame: .zero)

    backgroundColor = surfaceColor
    isUserInteractionEnabled = false

    badgeImageView.image = badgeImage
    badgeImageView.contentMode = .scaleAspectFit

    titleLabel.text = title
    titleLabel.font = UIFont.systemFont(ofSize: 17, weight: .regular)
    titleLabel.textColor = .label
    titleLabel.lineBreakMode = .byTruncatingTail

    trailingLabel.text = trailingValue
    trailingLabel.font = UIFont.systemFont(ofSize: 15, weight: .regular)
    trailingLabel.textColor = .secondaryLabel
    trailingLabel.textAlignment = .right
    trailingLabel.isHidden = trailingValue == nil

    chevronImageView.image = UIImage(
      systemName: "chevron.forward",
      withConfiguration: UIImage.SymbolConfiguration(pointSize: 12, weight: .semibold)
    )
    chevronImageView.tintColor = .tertiaryLabel
    chevronImageView.contentMode = .scaleAspectFit

    addSubview(badgeImageView)
    addSubview(titleLabel)
    addSubview(trailingLabel)
    addSubview(chevronImageView)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func layoutSubviews() {
    super.layoutSubviews()

    let leadingInset: CGFloat = 20
    let trailingInset: CGFloat = 16
    let badgeSize: CGFloat = 12
    let badgeSlotWidth: CGFloat = 20
    let interItemSpacing: CGFloat = 12
    let labelToChevronSpacing: CGFloat = trailingLabel.isHidden ? 0 : 6
    let chevronSize = CGSize(width: 7, height: 12)

    badgeImageView.frame = CGRect(
      x: leadingInset,
      y: round((bounds.height - badgeSize) / 2),
      width: badgeSize,
      height: badgeSize
    )

    chevronImageView.frame = CGRect(
      x: bounds.width - trailingInset - chevronSize.width,
      y: round((bounds.height - chevronSize.height) / 2),
      width: chevronSize.width,
      height: chevronSize.height
    )

    let maxTrailingLabelWidth: CGFloat = 44
    let trailingLabelSize = trailingLabel.isHidden
      ? .zero
      : trailingLabel.sizeThatFits(CGSize(width: maxTrailingLabelWidth, height: bounds.height))
    let trailingLabelX = chevronImageView.frame.minX - labelToChevronSpacing - trailingLabelSize.width
    trailingLabel.frame = CGRect(
      x: trailingLabelX,
      y: 0,
      width: trailingLabelSize.width,
      height: bounds.height
    )

    let titleLeading = leadingInset + badgeSlotWidth + interItemSpacing
    let titleTrailing = trailingLabel.isHidden
      ? chevronImageView.frame.minX - interItemSpacing
      : trailingLabel.frame.minX - interItemSpacing
    titleLabel.frame = CGRect(
      x: titleLeading,
      y: 0,
      width: max(0, titleTrailing - titleLeading),
      height: bounds.height
    )
  }
}

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
      guard
        let indexPath = collectionView.indexPathForItem(at: location),
        let item = item(at: indexPath),
        (item.kind == "category" || item.kind == "todo" || item.kind == "sectionHeader"),
        item.disabled != true,
        let cell = collectionView.cellForItem(at: indexPath)
      else {
        return
      }

      let menuDescriptors = makeCustomCategoryMenuDescriptors(for: item)
      let cellFrame = cell.convert(cell.bounds, to: overlayHost)
      if item.kind == "todo" {
        NSLog(
          "[NativeListInteractionsView] todo long-press began item=%@ reorderable=%@",
          item.id,
          item.reorderable == true ? "true" : "false"
        )
      }

      customCategoryGestureSession = CustomCategoryGestureSession(
        sourceIndexPath: indexPath,
        itemId: item.id,
        itemKind: item.kind,
        origin: overlayLocation,
        reorderable: item.reorderable == true,
        sourceCellFrame: cellFrame
      )

      if !menuDescriptors.isEmpty {
        presentCustomCategoryMenuOverlay(
          for: item,
          at: indexPath,
          descriptors: menuDescriptors,
          interactionStyle: menuInteractionStyle
        )
      } else {
        dismissCustomCategoryMenuOverlay(animated: false)
      }

    case .changed:
      guard let session = customCategoryGestureSession else {
        return
      }

      if customSectionHeaderDragSession != nil {
        updateCustomSectionHeaderDrag(
          locationInCollection: location,
          locationInOverlay: overlayLocation
        )
        return
      }

      if customTodoDragSession != nil {
        updateCustomTodoDrag(
          locationInCollection: location,
          locationInOverlay: overlayLocation
        )
        return
      }

      if customInteractiveReorderActive {
        lastInteractiveMovementLocation = location
        updateCollapsedSectionAutoExpandIfNeeded(at: location)
        collectionView.updateInteractiveMovementTargetPosition(location)
        return
      }

      let isInsideMenu = updateCustomCategoryMenuHighlight(at: overlayLocation)
      if isInsideMenu {
        return
      }

      let shouldBegin = shouldBeginCustomCategoryReorder(for: session, at: overlayLocation)
      if session.itemKind == "todo" {
        NSLog(
          "[NativeListInteractionsView] todo long-press changed item=%@ shouldBegin=%@ point=(%.1f, %.1f)",
          session.itemId,
          shouldBegin ? "true" : "false",
          location.x,
          location.y
        )
      }
      guard shouldBegin else {
        return
      }

      if
        let item = findItem(by: session.itemId),
        shouldUseCustomSectionHeaderDragEngine(for: item, at: session.sourceIndexPath)
      {
        beginCustomSectionHeaderDrag(
          for: item,
          at: session.sourceIndexPath,
          locationInCollection: location,
          locationInOverlay: overlayLocation
        )
        return
      }

      if
        let item = findItem(by: session.itemId),
        shouldUseCustomTodoCategoryDragEngine(for: item, at: session.sourceIndexPath)
      {
        beginCustomTodoDrag(
          for: item,
          at: session.sourceIndexPath,
          locationInCollection: location,
          locationInOverlay: overlayLocation
        )
        return
      }

      dismissCustomCategoryMenuOverlay(animated: !currentCustomCategoryMenuUsesLiftedPreview())
      let didBegin = collectionView.beginInteractiveMovementForItem(at: session.sourceIndexPath)
      if session.itemKind == "todo" {
        NSLog(
          "[NativeListInteractionsView] todo beginInteractiveMovement item=%@ didBegin=%@ section=%ld item=%ld",
          session.itemId,
          didBegin ? "true" : "false",
          session.sourceIndexPath.section,
          session.sourceIndexPath.item
        )
      }
      if didBegin {
        customInteractiveReorderActive = true
        lastInteractiveMovementLocation = location
        collectionView.updateInteractiveMovementTargetPosition(location)
      }

    case .ended:
      if customSectionHeaderDragSession != nil {
        completeCustomSectionHeaderDrag(cancelled: false)
        dismissCustomCategoryMenuOverlay(animated: false)
      } else if customTodoDragSession != nil {
        completeCustomTodoDrag(cancelled: false)
        dismissCustomCategoryMenuOverlay(animated: false)
      } else if customInteractiveReorderActive {
        collectionView.endInteractiveMovement()
        dismissCustomCategoryMenuOverlay(animated: false)
      } else if customCategoryMenuInteractionStyle == .pressAndSlide {
        performCustomCategoryMenuSelectionIfNeeded()
        dismissCustomCategoryMenuOverlay(animated: false)
      }
      customCategoryGestureSession = nil
      customInteractiveReorderActive = false

    case .cancelled, .failed:
      if customSectionHeaderDragSession != nil {
        completeCustomSectionHeaderDrag(cancelled: true)
      } else if customTodoDragSession != nil {
        completeCustomTodoDrag(cancelled: true)
      } else if customInteractiveReorderActive {
        collectionView.cancelInteractiveMovement()
      }
      dismissCustomCategoryMenuOverlay(animated: true)
      discardTemporarilyExpandedSectionsIfNeeded()
      resetCustomCategoryGestureState()

    default:
      break
    }
  }

  @objc
  func handleCategorySystemMenuTrackingLongPress(_ recognizer: UILongPressGestureRecognizer) {
    guard iosCategoryGestureMode == .systemCustom else {
      return
    }

    let location = recognizer.location(in: collectionView)

    switch recognizer.state {
    case .began:
      guard
        let indexPath = collectionView.indexPathForItem(at: location),
        let item = item(at: indexPath),
        item.kind == "category",
        item.disabled != true,
        let cell = collectionView.cellForItem(at: indexPath)
      else {
        return
      }

      let cellFrame = cell.convert(cell.bounds, to: self)
      systemCategoryMenuDismissSession = SystemCategoryMenuDismissSession(
        itemId: item.id,
        origin: location,
        sourceCellFrame: cellFrame
      )

    case .changed:
      guard
        let session = systemCategoryMenuDismissSession,
        visibleCategoryContextMenuItemId == session.itemId
      else {
        return
      }

      let distance = hypot(location.x - session.origin.x, location.y - session.origin.y)
      guard distance >= systemCategoryMenuDismissThreshold else {
        return
      }

      let protectedCellFrame = session.sourceCellFrame.insetBy(dx: -16, dy: -10)
      guard !protectedCellFrame.contains(location) else {
        return
      }

      collectionView.contextMenuInteraction?.dismissMenu()
      resetSystemCategoryMenuDismissState()

    case .ended, .cancelled, .failed:
      resetSystemCategoryMenuDismissState()

    default:
      break
    }
  }

  func resetCustomCategoryGestureState() {
    customCategoryGestureSession = nil
    customInteractiveReorderActive = false
    customCategoryMenuHighlightedIndex = nil
    lastInteractiveMovementLocation = nil
    lastInteractiveMovementOverlayLocation = nil
    cancelCollapsedSectionAutoExpand()
    stopCustomDragAutoScroll()
    customSectionHeaderDragSession = nil
    customSectionHeaderDropTarget = nil
    customSectionHeaderDragSnapshotView?.removeFromSuperview()
    customSectionHeaderDragSnapshotView = nil
    removeCustomSectionHeaderInsertionIndicator()
    setCustomSectionHeaderDragSourceCellHidden(false)
    customSectionHeaderDragSourceCell = nil
    discardTemporarilyCollapsedSectionsIfNeeded()
    customTodoDragSession = nil
    customTodoDragDropTarget = nil
    customTodoDragSnapshotView?.removeFromSuperview()
    customTodoDragSnapshotView = nil
    removeCustomTodoDragInsertionIndicator()
    setCustomTodoDragSourceCellHidden(false)
    customTodoDragSourceCell = nil
  }

  func resetSystemCategoryMenuDismissState() {
    systemCategoryMenuDismissSession = nil
  }

  @objc
  func handleFocusedCategoryMenuPan(_ recognizer: UIPanGestureRecognizer) {
    guard currentCustomCategoryMenuUsesLiftedPreview() else {
      return
    }

    let overlayHost = currentCustomCategoryMenuOverlayHostView()
    let locationInOverlay = recognizer.location(in: overlayHost)
    let locationInCollection = recognizer.location(in: collectionView)

    switch recognizer.state {
    case .began:
      return

    case .changed:
      if customSectionHeaderDragSession != nil {
        updateCustomSectionHeaderDrag(
          locationInCollection: locationInCollection,
          locationInOverlay: locationInOverlay
        )
        return
      }

      if customTodoDragSession != nil {
        updateCustomTodoDrag(
          locationInCollection: locationInCollection,
          locationInOverlay: locationInOverlay
        )
        return
      }

      if customInteractiveReorderActive {
        lastInteractiveMovementLocation = locationInCollection
        updateCollapsedSectionAutoExpandIfNeeded(at: locationInCollection)
        collectionView.updateInteractiveMovementTargetPosition(locationInCollection)
        return
      }

      guard let session = focusedCategoryMenuSession, session.reorderable else {
        return
      }

      let translation = recognizer.translation(in: self)
      let distance = hypot(translation.x, translation.y)
      if findItem(by: session.itemId)?.kind == "todo" {
        NSLog(
          "[NativeListInteractionsView] focused pan changed item=%@ distance=%.1f threshold=%.1f",
          session.itemId,
          distance,
          focusedCategoryMenuReorderThreshold
        )
      }
      guard distance >= focusedCategoryMenuReorderThreshold else {
        return
      }

      if
        let item = findItem(by: session.itemId),
        shouldUseCustomTodoCategoryDragEngine(for: item, at: session.sourceIndexPath)
      {
        beginCustomTodoDrag(
          for: item,
          at: session.sourceIndexPath,
          locationInCollection: locationInCollection,
          locationInOverlay: locationInOverlay
        )
        return
      }

      restoreCustomCategoryMenuSourceCellAppearance()
      let didBegin = collectionView.beginInteractiveMovementForItem(at: session.sourceIndexPath)
      if findItem(by: session.itemId)?.kind == "todo" {
        NSLog(
          "[NativeListInteractionsView] focused pan beginInteractiveMovement item=%@ didBegin=%@ section=%ld item=%ld",
          session.itemId,
          didBegin ? "true" : "false",
          session.sourceIndexPath.section,
          session.sourceIndexPath.item
        )
      }
      guard didBegin else {
        customCategoryMenuSourceCell?.alpha = 0
        return
      }

      customInteractiveReorderActive = true
      dismissCustomCategoryMenuOverlay(animated: false)
      lastInteractiveMovementLocation = locationInCollection
      collectionView.updateInteractiveMovementTargetPosition(locationInCollection)

    case .ended:
      if customSectionHeaderDragSession != nil {
        completeCustomSectionHeaderDrag(cancelled: false)
        return
      }

      if customTodoDragSession != nil {
        completeCustomTodoDrag(cancelled: false)
        return
      }

      if customInteractiveReorderActive {
        collectionView.endInteractiveMovement()
        customInteractiveReorderActive = false
        return
      }

      if
        let previewContainer = customCategoryMenuPreviewContainerView,
        previewContainer.frame.contains(locationInOverlay)
      {
        return
      }

    case .cancelled, .failed:
      if customSectionHeaderDragSession != nil {
        completeCustomSectionHeaderDrag(cancelled: true)
        return
      }

      if customTodoDragSession != nil {
        completeCustomTodoDrag(cancelled: true)
        return
      }

      if customInteractiveReorderActive {
        collectionView.cancelInteractiveMovement()
        customInteractiveReorderActive = false
      }
      discardTemporarilyExpandedSectionsIfNeeded()

    default:
      break
    }
  }

  func currentCustomCategoryMenuUsesLiftedPreview() -> Bool {
    iosCategoryGestureMode == .customLifted
  }

  func currentCustomCategoryMenuOverlayHostView() -> UIView {
    if let hostView = customCategoryMenuOverlayHostView, hostView.window != nil {
      return hostView
    }

    if let window {
      return window
    }

    return self
  }

  func dismissCustomCategoryMenuOverlay(animated: Bool) {
    guard let backdrop = customCategoryMenuBackdropView else {
      restoreCustomCategoryMenuSourceCellAppearance()
      customCategoryMenuItemId = nil
      return
    }

    let removeViews = {
      self.restoreCustomCategoryMenuSourceCellAppearance()
      self.customCategoryMenuPreviewContainerView?.removeFromSuperview()
      self.customCategoryMenuCardView?.removeFromSuperview()
      backdrop.removeFromSuperview()
      self.customCategoryMenuBackdropView = nil
      self.customCategoryMenuCardView = nil
      self.customCategoryMenuPreviewContainerView = nil
      self.customCategoryMenuOverlayHostView = nil
      self.customCategoryMenuSourceCell = nil
      self.customCategoryMenuSourceIndexPath = nil
      self.customCategoryMenuItemId = nil
      self.customCategoryMenuDescriptors = []
      self.customCategoryMenuButtons = []
      self.customCategoryMenuInteractionStyle = .tapButtons
      self.customCategoryMenuHighlightedIndex = nil
      self.focusedCategoryMenuSession = nil
    }

    if animated {
      UIView.animate(
        withDuration: 0.18,
        animations: {
          backdrop.alpha = 0
          self.customCategoryMenuPreviewContainerView?.transform = .identity
          self.customCategoryMenuPreviewContainerView?.alpha = 1
          self.customCategoryMenuCardView?.alpha = 0
          self.customCategoryMenuCardView?.transform = CGAffineTransform(scaleX: 0.96, y: 0.96)
        },
        completion: { _ in
          removeViews()
        }
      )
    } else {
      removeViews()
    }
  }

  func restoreCustomCategoryMenuSourceCellAppearance() {
    if let cell = customCategoryMenuSourceCell {
      cell.alpha = 1
      return
    }

    guard
      let indexPath = customCategoryMenuSourceIndexPath,
      let cell = collectionView.cellForItem(at: indexPath)
    else {
      return
    }

    cell.alpha = 1
  }

  func categoryTrailingValue(for item: NativeItem) -> String? {
    let source = (item.metaText ?? item.subtitle ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    guard !source.isEmpty else {
      return nil
    }

    var digits = ""
    var started = false
    for character in source {
      if character.isNumber {
        digits.append(character)
        started = true
      } else if started {
        break
      }
    }

    if !digits.isEmpty {
      return digits
    }

    return source
  }

  private func currentCustomCategoryMenuInteractionStyle() -> CustomCategoryMenuInteractionStyle? {
    switch iosCategoryGestureMode {
    case .system:
      return nil
    case .customExperiment:
      return .tapButtons
    case .customLifted:
      return .tapButtons
    case .systemCustom:
      return nil
    }
  }

  private func makeCustomCategoryMenuDescriptors(for item: NativeItem) -> [CustomCategoryMenuActionDescriptor] {
    var descriptors = (item.menuActions ?? []).map { action in
      CustomCategoryMenuActionDescriptor(
        title: label(for: action),
        actionId: action,
        destructive: false
      )
    }

    if item.deletable == true {
      descriptors.append(
        CustomCategoryMenuActionDescriptor(
          title: "삭제",
          actionId: nil,
          destructive: true
        )
      )
    }

    return descriptors
  }

  private func presentCustomCategoryMenuOverlay(
    for item: NativeItem,
    at indexPath: IndexPath,
    descriptors: [CustomCategoryMenuActionDescriptor],
    interactionStyle: CustomCategoryMenuInteractionStyle
  ) {
    dismissCustomCategoryMenuOverlay(animated: false)

    guard let cell = collectionView.cellForItem(at: indexPath), !descriptors.isEmpty else {
      return
    }

    let overlayHost = currentCustomCategoryMenuOverlayHostView()
    let backdrop: UIView
    if interactionStyle == .tapButtons {
      let control = UIControl(frame: overlayHost.bounds)
      control.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      control.backgroundColor = UIColor.black.withAlphaComponent(0.08)
      control.addTarget(self, action: #selector(handleCustomCategoryMenuBackdropTap), for: .touchUpInside)
      backdrop = control
    } else {
      let view = UIView(frame: overlayHost.bounds)
      view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      view.backgroundColor = UIColor.black.withAlphaComponent(0.08)
      backdrop = view
    }

    let usesLiftedPreview = currentCustomCategoryMenuUsesLiftedPreview()
    let baseSurfaceColor = resolvedDefaultCategorySurfaceColor()
    let groupedCornerStyle = categoryPreviewCornerStyle(for: indexPath, expanded: false)
    let menuCornerStyle = categoryPreviewCornerStyle(for: indexPath, expanded: true)
    let blurView = UIVisualEffectView(effect: UIBlurEffect(style: .systemChromeMaterial))
    blurView.clipsToBounds = true
    blurView.layer.cornerRadius = 16
    blurView.layer.cornerCurve = .continuous
    blurView.layer.borderWidth = 0.5
    blurView.layer.borderColor = UIColor.white.withAlphaComponent(0.35).cgColor

    let menuWidth: CGFloat = 220
    let rowHeight: CGFloat = 46
    let menuHeight = CGFloat(descriptors.count) * rowHeight
    let cellFrame = cell.convert(cell.bounds, to: overlayHost)
    let previewPhaseOneScale: CGFloat = usesLiftedPreview ? 1.06 : 1
    let liftedPreviewScale: CGFloat = usesLiftedPreview ? 1.08 : 1
    let liftedPreviewTranslationY: CGFloat = 0
    let menuVerticalSpacing: CGFloat = usesLiftedPreview ? 18 : 10
    let previewPhaseOneDuration: TimeInterval = 0.35
    let previewPhaseTwoDuration: TimeInterval = 0.18
    let horizontalInset: CGFloat = 16
    let topInset = overlayHost.safeAreaInsets.top + 16
    let bottomInset = overlayHost.safeAreaInsets.bottom + 16
    let previewHorizontalExpansion = (cellFrame.width * (liftedPreviewScale - 1)) / 2
    let previewVerticalExpansion = (cellFrame.height * (liftedPreviewScale - 1)) / 2
    let referenceFrame = cellFrame
      .insetBy(dx: -previewHorizontalExpansion, dy: -previewVerticalExpansion)
      .offsetBy(dx: 0, dy: liftedPreviewTranslationY)
    let minMenuY = topInset
    let maxMenuY = max(minMenuY, overlayHost.bounds.height - bottomInset - menuHeight)
    let aboveCandidate = referenceFrame.minY - menuHeight - menuVerticalSpacing
    let belowCandidate = referenceFrame.maxY + menuVerticalSpacing
    let fitsAbove = aboveCandidate >= minMenuY
    let fitsBelow = belowCandidate <= maxMenuY
    let availableAbove = referenceFrame.minY - minMenuY
    let availableBelow = (overlayHost.bounds.height - bottomInset) - referenceFrame.maxY
    let clampedX = min(
      max(cellFrame.midX - (menuWidth / 2), horizontalInset),
      overlayHost.bounds.width - menuWidth - horizontalInset
    )
    let resolvedY: CGFloat
    if fitsAbove && (!fitsBelow || availableAbove >= availableBelow) {
      resolvedY = aboveCandidate
    } else if fitsBelow {
      resolvedY = belowCandidate
    } else if availableAbove >= availableBelow {
      resolvedY = max(minMenuY, aboveCandidate)
    } else {
      resolvedY = min(maxMenuY, belowCandidate)
    }
    blurView.frame = CGRect(x: clampedX, y: resolvedY, width: menuWidth, height: menuHeight)
    let menuInitialTranslationY: CGFloat = blurView.frame.maxY <= referenceFrame.minY ? 10 : -10

    let previewContainer: UIView?
    var previewContentView: UIView?
    var previewView: LightweightCategoryPreviewView?
    if usesLiftedPreview {
      let container = UIView(frame: cellFrame)
      container.isUserInteractionEnabled = true
      container.layer.shadowColor = UIColor.black.cgColor
      container.layer.shadowOpacity = 0
      container.layer.shadowRadius = 0
      container.layer.shadowOffset = .zero
      container.layer.shadowPath = makePreviewShadowPath(for: container.bounds, style: groupedCornerStyle).cgPath

      let clippedContent = UIView(frame: container.bounds)
      clippedContent.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      clippedContent.layer.cornerCurve = .continuous
      clippedContent.clipsToBounds = true
      applyCategoryPreviewCornerStyle(groupedCornerStyle, to: clippedContent)
      let preview = makeLightweightCategoryPreviewView(
        for: item,
        surfaceColor: baseSurfaceColor
      )
      preview.frame = clippedContent.bounds
      preview.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      clippedContent.addSubview(preview)

      container.addSubview(clippedContent)
      previewContainer = container
      previewContentView = clippedContent
      previewView = preview
      customCategoryMenuPreviewContainerView = container
      customCategoryMenuSourceCell = cell
      customCategoryMenuSourceIndexPath = indexPath
      focusedCategoryMenuSession = FocusedCategoryMenuSession(
        sourceIndexPath: indexPath,
        itemId: item.id,
        reorderable: item.reorderable == true
      )
      cell.alpha = 0
    } else {
      previewContainer = nil
      customCategoryMenuPreviewContainerView = nil
      customCategoryMenuSourceCell = nil
      customCategoryMenuSourceIndexPath = nil
      focusedCategoryMenuSession = nil
    }

    let stackView = UIStackView()
    stackView.axis = .vertical
    stackView.spacing = 0
    stackView.translatesAutoresizingMaskIntoConstraints = false
    blurView.contentView.addSubview(stackView)
    NSLayoutConstraint.activate([
      stackView.leadingAnchor.constraint(equalTo: blurView.contentView.leadingAnchor),
      stackView.trailingAnchor.constraint(equalTo: blurView.contentView.trailingAnchor),
      stackView.topAnchor.constraint(equalTo: blurView.contentView.topAnchor),
      stackView.bottomAnchor.constraint(equalTo: blurView.contentView.bottomAnchor)
    ])

    customCategoryMenuDescriptors = descriptors
    customCategoryMenuButtons = []
    customCategoryMenuInteractionStyle = interactionStyle
    customCategoryMenuHighlightedIndex = nil

    for (index, descriptor) in descriptors.enumerated() {
      let button = UIButton(type: .system)
      button.contentHorizontalAlignment = .leading
      var configuration = UIButton.Configuration.plain()
      configuration.contentInsets = NSDirectionalEdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16)
      configuration.baseForegroundColor = descriptor.destructive ? .systemRed : .label
      var attributes = AttributeContainer()
      attributes.font = UIFont.systemFont(ofSize: 17, weight: .regular)
      configuration.attributedTitle = AttributedString(descriptor.title, attributes: attributes)
      button.configuration = configuration
      button.backgroundColor = .clear
      button.heightAnchor.constraint(equalToConstant: rowHeight).isActive = true
      if interactionStyle == .tapButtons {
        button.addAction(
          UIAction { [weak self] _ in
            guard let self else {
              return
            }
            self.dismissCustomCategoryMenuOverlay(animated: true)
            self.executeCustomCategoryMenuDescriptor(descriptor, for: item.id)
          },
          for: .touchUpInside
        )
      } else {
        button.isUserInteractionEnabled = false
      }
      customCategoryMenuButtons.append(button)
      stackView.addArrangedSubview(button)

      if !usesLiftedPreview && index < descriptors.count - 1 {
        let separator = UIView()
        separator.backgroundColor = UIColor.separator.withAlphaComponent(0.4)
        separator.translatesAutoresizingMaskIntoConstraints = false
        separator.heightAnchor.constraint(equalToConstant: 0.5).isActive = true
        stackView.addArrangedSubview(separator)
      }
    }

    overlayHost.addSubview(backdrop)
    if let previewContainer {
      overlayHost.addSubview(previewContainer)
      overlayHost.bringSubviewToFront(previewContainer)
    }
    overlayHost.addSubview(blurView)
    overlayHost.bringSubviewToFront(backdrop)
    if let previewContainer {
      overlayHost.bringSubviewToFront(previewContainer)
    }
    overlayHost.bringSubviewToFront(blurView)
    customCategoryMenuBackdropView = backdrop
    customCategoryMenuCardView = blurView
    customCategoryMenuOverlayHostView = overlayHost
    customCategoryMenuItemId = item.id

    if usesLiftedPreview {
      backdrop.alpha = 0
      previewContainer?.alpha = 1
      previewContainer?.transform = .identity
      blurView.alpha = 0
      blurView.transform = CGAffineTransform(
        translationX: 0,
        y: menuInitialTranslationY
      ).scaledBy(x: 0.96, y: 0.96)

      UIView.animate(
        withDuration: previewPhaseOneDuration,
        delay: 0,
        options: [.curveEaseOut, .beginFromCurrentState, .allowUserInteraction],
        animations: {
          previewContainer?.transform = CGAffineTransform(scaleX: previewPhaseOneScale, y: previewPhaseOneScale)
          previewContainer?.layer.shadowOpacity = 0.08
          previewContainer?.layer.shadowRadius = 12
          previewContainer?.layer.shadowOffset = CGSize(width: 0, height: 8)
        },
        completion: { [weak self] _ in
          guard let self, self.customCategoryMenuBackdropView === backdrop else {
            return
          }

          UIView.animate(
            withDuration: previewPhaseTwoDuration,
            delay: 0,
            options: [.curveEaseInOut, .beginFromCurrentState, .allowUserInteraction],
            animations: {
              backdrop.alpha = 1
              previewView?.backgroundColor = baseSurfaceColor
              previewContentView.map {
                self.applyCategoryPreviewCornerStyle(menuCornerStyle, to: $0)
              }
              previewContainer?.layer.shadowOpacity = 0.18
              previewContainer?.layer.shadowRadius = 18
              previewContainer?.layer.shadowOffset = CGSize(width: 0, height: 12)
              previewContainer?.layer.shadowPath = self.makePreviewShadowPath(
                for: previewContainer?.bounds ?? CGRect(origin: .zero, size: cellFrame.size),
                style: menuCornerStyle
              ).cgPath
              previewContainer?.transform = CGAffineTransform(translationX: 0, y: liftedPreviewTranslationY)
                .scaledBy(x: liftedPreviewScale, y: liftedPreviewScale)
              blurView.alpha = 1
              blurView.transform = .identity
            }
          )
        }
      )
    }
  }

  private func shouldBeginCustomCategoryReorder(
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

  private func updateCustomCategoryMenuHighlight(at location: CGPoint) -> Bool {
    guard customCategoryMenuInteractionStyle == .pressAndSlide, let cardView = customCategoryMenuCardView else {
      return false
    }

    let overlayHost = currentCustomCategoryMenuOverlayHostView()

    let protectedMenuFrame = cardView.frame.insetBy(dx: -12, dy: -10)
    guard protectedMenuFrame.contains(location) else {
      setCustomCategoryMenuHighlightedIndex(nil)
      return false
    }

    let highlightedIndex = customCategoryMenuButtons.firstIndex { button in
      let buttonFrame = button.convert(button.bounds, to: overlayHost).insetBy(dx: -6, dy: -4)
      return buttonFrame.contains(location)
    }
    setCustomCategoryMenuHighlightedIndex(highlightedIndex)
    return true
  }

  private func setCustomCategoryMenuHighlightedIndex(_ index: Int?) {
    guard customCategoryMenuHighlightedIndex != index else {
      return
    }

    customCategoryMenuHighlightedIndex = index
    for (buttonIndex, button) in customCategoryMenuButtons.enumerated() {
      button.backgroundColor = buttonIndex == index
        ? UIColor.secondarySystemFill.withAlphaComponent(0.95)
        : .clear
    }
  }

  private func performCustomCategoryMenuSelectionIfNeeded() {
    guard
      customCategoryMenuInteractionStyle == .pressAndSlide,
      let itemId = customCategoryGestureSession?.itemId,
      let highlightedIndex = customCategoryMenuHighlightedIndex,
      customCategoryMenuDescriptors.indices.contains(highlightedIndex)
    else {
      return
    }

    let descriptor = customCategoryMenuDescriptors[highlightedIndex]
    executeCustomCategoryMenuDescriptor(descriptor, for: itemId)
  }

  private func executeCustomCategoryMenuDescriptor(
    _ descriptor: CustomCategoryMenuActionDescriptor,
    for itemId: String
  ) {
    if descriptor.destructive {
      onDelete(["itemId": itemId])
    } else if let actionId = descriptor.actionId {
      onMenuAction([
        "itemId": itemId,
        "action": actionId
      ])
    }
  }

  @objc
  private func handleCustomCategoryMenuBackdropTap() {
    dismissCustomCategoryMenuOverlay(animated: true)
  }

  private func makeLightweightCategoryPreviewView(
    for item: NativeItem,
    surfaceColor: UIColor
  ) -> LightweightCategoryPreviewView {
    LightweightCategoryPreviewView(
      title: item.title,
      trailingValue: categoryTrailingValue(for: item),
      badgeImage: makeLeadingBadge(for: item),
      surfaceColor: surfaceColor
    )
  }

  private func categoryPreviewCornerStyle(
    for indexPath: IndexPath,
    expanded: Bool
  ) -> CategoryPreviewCornerStyle {
    if expanded {
      return CategoryPreviewCornerStyle(
        radius: 18,
        maskedCorners: [
          .layerMinXMinYCorner,
          .layerMaxXMinYCorner,
          .layerMinXMaxYCorner,
          .layerMaxXMaxYCorner,
        ]
      )
    }

    guard sections.indices.contains(indexPath.section) else {
      return CategoryPreviewCornerStyle(
        radius: 12,
        maskedCorners: [
          .layerMinXMinYCorner,
          .layerMaxXMinYCorner,
          .layerMinXMaxYCorner,
          .layerMaxXMaxYCorner,
        ]
      )
    }

    let itemCount = sections[indexPath.section].items.count
    if itemCount <= 1 {
      return CategoryPreviewCornerStyle(
        radius: 12,
        maskedCorners: [
          .layerMinXMinYCorner,
          .layerMaxXMinYCorner,
          .layerMinXMaxYCorner,
          .layerMaxXMaxYCorner,
        ]
      )
    }

    if indexPath.item == 0 {
      return CategoryPreviewCornerStyle(
        radius: 12,
        maskedCorners: [
          .layerMinXMinYCorner,
          .layerMaxXMinYCorner,
        ]
      )
    }

    if indexPath.item == itemCount - 1 {
      return CategoryPreviewCornerStyle(
        radius: 12,
        maskedCorners: [
          .layerMinXMaxYCorner,
          .layerMaxXMaxYCorner,
        ]
      )
    }

    return CategoryPreviewCornerStyle(radius: 0, maskedCorners: [])
  }

  private func applyCategoryPreviewCornerStyle(
    _ style: CategoryPreviewCornerStyle,
    to view: UIView
  ) {
    view.layer.cornerRadius = style.radius
    view.layer.maskedCorners = style.maskedCorners
  }

  private func makePreviewShadowPath(
    for bounds: CGRect,
    style: CategoryPreviewCornerStyle
  ) -> UIBezierPath {
    let rectCorners = rectCorners(from: style.maskedCorners)
    if rectCorners.isEmpty || style.radius <= 0 {
      return UIBezierPath(rect: bounds)
    }

    return UIBezierPath(
      roundedRect: bounds,
      byRoundingCorners: rectCorners,
      cornerRadii: CGSize(width: style.radius, height: style.radius)
    )
  }

  private func rectCorners(from maskedCorners: CACornerMask) -> UIRectCorner {
    var rectCorners: UIRectCorner = []

    if maskedCorners.contains(.layerMinXMinYCorner) {
      rectCorners.insert(.topLeft)
    }
    if maskedCorners.contains(.layerMaxXMinYCorner) {
      rectCorners.insert(.topRight)
    }
    if maskedCorners.contains(.layerMinXMaxYCorner) {
      rectCorners.insert(.bottomLeft)
    }
    if maskedCorners.contains(.layerMaxXMaxYCorner) {
      rectCorners.insert(.bottomRight)
    }

    return rectCorners
  }

  private func resolvedDefaultCategorySurfaceColor() -> UIColor {
    let baseColor = UIBackgroundConfiguration.listGroupedCell().backgroundColor
      ?? UIColor.secondarySystemGroupedBackground
    return baseColor.resolvedColor(with: traitCollection)
  }
}
