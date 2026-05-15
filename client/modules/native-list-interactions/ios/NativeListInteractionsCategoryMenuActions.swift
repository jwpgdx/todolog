import UIKit

extension NativeListInteractionsView {
  func currentCustomCategoryMenuInteractionStyle() -> CustomCategoryMenuInteractionStyle? {
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

  func makeNativeMenuActionDescriptors(
    for item: NativeItem,
    includeDelete: Bool = true
  ) -> [NativeListMenuActionDescriptor] {
    let actionIds = item.supportsMenu == true ? (item.menuActions ?? []) : []
    var descriptors = actionIds.map { action in
      NativeListMenuActionDescriptor(
        title: label(for: action),
        actionId: action,
        destructive: false
      )
    }

    if includeDelete && item.deletable == true {
      descriptors.append(
        NativeListMenuActionDescriptor(
          title: "삭제",
          actionId: nil,
          destructive: true
        )
      )
    }

    return descriptors
  }

  func hasNativeMenuActions(
    for item: NativeItem,
    includeDelete: Bool = true
  ) -> Bool {
    !makeNativeMenuActionDescriptors(
      for: item,
      includeDelete: includeDelete
    ).isEmpty
  }

  func makeNativeMenuAction(
    _ descriptor: NativeListMenuActionDescriptor,
    for itemId: String
  ) -> UIAction {
    UIAction(
      title: descriptor.title,
      attributes: descriptor.destructive ? .destructive : []
    ) { [weak self] _ in
      self?.executeNativeMenuActionDescriptor(descriptor, for: itemId)
    }
  }

  func makeNativeItemMenu(
    for item: NativeItem,
    includeDelete: Bool = true
  ) -> UIMenu {
    let actions = makeNativeMenuActionDescriptors(
      for: item,
      includeDelete: includeDelete
    ).map { descriptor in
      makeNativeMenuAction(descriptor, for: item.id)
    }

    return UIMenu(title: item.title, children: actions)
  }

  func updateCustomCategoryMenuHighlight(at location: CGPoint) -> Bool {
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

  func setCustomCategoryMenuHighlightedIndex(_ index: Int?) {
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

  func performCustomCategoryMenuSelectionIfNeeded() {
    guard
      customCategoryMenuInteractionStyle == .pressAndSlide,
      let itemId = customCategoryGestureSession?.itemId,
      let highlightedIndex = customCategoryMenuHighlightedIndex,
      customCategoryMenuDescriptors.indices.contains(highlightedIndex)
    else {
      return
    }

    let descriptor = customCategoryMenuDescriptors[highlightedIndex]
    executeNativeMenuActionDescriptor(descriptor, for: itemId)
  }

  func executeNativeMenuActionDescriptor(
    _ descriptor: NativeListMenuActionDescriptor,
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
  func handleCustomCategoryMenuBackdropTap() {
    dismissCustomCategoryMenuOverlay(animated: true)
  }
}
