import UIKit

extension NativeListInteractionsView {
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

  func dismissCustomCategoryMenuOverlay(
    animated: Bool,
    restoreTemporaryCollapse: Bool = true,
    restoreSourceCellAppearance: Bool = true
  ) {
    guard let backdrop = customCategoryMenuBackdropView else {
      if restoreSourceCellAppearance {
        restoreCustomCategoryMenuSourceCellAppearance()
      }
      customCategoryMenuItemId = nil
      if restoreTemporaryCollapse {
        discardTemporarilyCollapsedSectionsIfNeeded()
      }
      return
    }

    let removeViews = {
      if restoreSourceCellAppearance {
        self.restoreCustomCategoryMenuSourceCellAppearance()
      }
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
      self.focusedCategoryMenuPanOrigin = nil
      if restoreTemporaryCollapse {
        self.discardTemporarilyCollapsedSectionsIfNeeded()
      }
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

  func presentCustomCategoryMenuOverlay(
    for item: NativeItem,
    at indexPath: IndexPath,
    descriptors: [NativeListMenuActionDescriptor],
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
    let normalPreviewStyle = nativeListPreviewStyle(for: item, at: indexPath, phase: .normal)
    let initialPreviewStyle = nativeListPreviewStyle(for: item, at: indexPath, phase: .menuPreviewInitial)
    let liftedPreviewStyle = nativeListPreviewStyle(for: item, at: indexPath, phase: .menuPreviewLifted)
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
    let previewPhaseOneScale: CGFloat = usesLiftedPreview ? initialPreviewStyle.scale : 1
    let liftedPreviewScale: CGFloat = usesLiftedPreview ? liftedPreviewStyle.scale : 1
    let liftedPreviewTranslationY: CGFloat = usesLiftedPreview ? liftedPreviewStyle.translationY : 0
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
      applyPreviewShadowStyle(normalPreviewStyle.shadow, to: container)
      container.layer.shadowPath = makePreviewShadowPath(
        for: container.bounds,
        style: normalPreviewStyle.cornerStyle
      ).cgPath

      let clippedContent = UIView(frame: container.bounds)
      clippedContent.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      clippedContent.layer.cornerCurve = .continuous
      clippedContent.clipsToBounds = true
      applyCategoryPreviewCornerStyle(normalPreviewStyle.cornerStyle, to: clippedContent)
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
            self.executeNativeMenuActionDescriptor(descriptor, for: item.id)
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
          if let previewContainer {
            self.applyPreviewShadowStyle(initialPreviewStyle.shadow, to: previewContainer)
          }
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
                self.applyCategoryPreviewCornerStyle(liftedPreviewStyle.cornerStyle, to: $0)
              }
              if let previewContainer {
                self.applyPreviewShadowStyle(liftedPreviewStyle.shadow, to: previewContainer)
              }
              previewContainer?.layer.shadowPath = self.makePreviewShadowPath(
                for: previewContainer?.bounds ?? CGRect(origin: .zero, size: cellFrame.size),
                style: liftedPreviewStyle.cornerStyle
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
}
