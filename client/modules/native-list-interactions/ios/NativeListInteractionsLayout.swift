import UIKit

private final class SwitchAccessory: UISwitch {
  var itemId: String?
}

private final class MenuPrimaryActionButton: UIButton {
  var itemId: String?
}

private final class TodoCompleteAccessoryButton: UIButton {
  var itemId: String?
  var controlId: String?
  var controlSource: String?
  var nextValue: Bool = false
}

private struct SectionDividerContentConfiguration: UIContentConfiguration {
  let height: CGFloat

  func makeContentView() -> UIView & UIContentView {
    SectionDividerContentView(configuration: self)
  }

  func updated(for state: UIConfigurationState) -> SectionDividerContentConfiguration {
    self
  }
}

private final class SectionDividerContentView: UIView, UIContentView {
  private var heightConstraint: NSLayoutConstraint?
  var configuration: UIContentConfiguration {
    didSet {
      apply(configuration)
    }
  }

  init(configuration: SectionDividerContentConfiguration) {
    self.configuration = configuration
    super.init(frame: .zero)
    isUserInteractionEnabled = false
    heightConstraint = heightAnchor.constraint(equalToConstant: configuration.height)
    heightConstraint?.isActive = true
    apply(configuration)
  }

  required init?(coder: NSCoder) {
    self.configuration = SectionDividerContentConfiguration(height: 16)
    super.init(coder: coder)
    isUserInteractionEnabled = false
    heightConstraint = heightAnchor.constraint(equalToConstant: 16)
    heightConstraint?.isActive = true
    apply(configuration)
  }

  override var intrinsicContentSize: CGSize {
    let height = (configuration as? SectionDividerContentConfiguration)?.height ?? 16
    return CGSize(width: UIView.noIntrinsicMetric, height: height)
  }

  private func apply(_ configuration: UIContentConfiguration) {
    guard let configuration = configuration as? SectionDividerContentConfiguration else {
      return
    }

    backgroundColor = UIColor.systemGroupedBackground
    heightConstraint?.constant = configuration.height
    invalidateIntrinsicContentSize()
  }
}

extension NativeListInteractionsView {
  func makeLayout() -> UICollectionViewLayout {
    var config = UICollectionLayoutListConfiguration(appearance: currentListAppearance())
    // Section labels are rendered by JS or normal list rows in v0. Keeping
    // supplementary views enabled can assert during prop-driven layout swaps.
    config.headerMode = .none
    config.footerMode = .none
    config.backgroundColor = .clear
    config.trailingSwipeActionsConfigurationProvider = { [weak self] indexPath in
      self?.makeTrailingSwipeActions(for: indexPath)
    }
    return UICollectionViewCompositionalLayout.list(using: config)
  }

  func configure(cell: UICollectionViewCell, with item: NativeItem) {
    guard let listCell = cell as? UICollectionViewListCell else {
      return
    }

    resetReusableDecorations(for: listCell)

    var content = item.kind == "category"
      ? UIListContentConfiguration.cell()
      : UIListContentConfiguration.subtitleCell()
    content.text = item.title
    content.secondaryText = item.kind == "category" ? nil : item.subtitle ?? item.metaText
    content.image = makeLeadingBadge(for: item)
    content.imageProperties.cornerRadius = item.kind == "category" ? 0 : 8
    let baseBackgroundConfiguration = nativeListBackgroundConfiguration(for: item)
    listCell.contentConfiguration = content
    listCell.accessories = []
    listCell.backgroundConfiguration = baseBackgroundConfiguration
    listCell.isUserInteractionEnabled = item.disabled != true
    let keepsFullContentAlpha = item.kind == "sectionHeader" || item.kind == "sectionDivider"
    listCell.contentView.alpha = keepsFullContentAlpha ? 1.0 : (item.disabled == true ? 0.45 : 1.0)
    let isActiveDragSource =
      customTodoDragSession?.itemId == item.id ||
      customSectionHeaderDragSession?.itemId == item.id ||
      (customInteractiveReorderActive && currentInteractiveReorderItemId() == item.id)
    listCell.alpha = isActiveDragSource ? customDragSourceCellDimmedAlpha : 1
    listCell.accessibilityIdentifier = item.kind == "category" ? "category-row-\(item.id)" : item.id

    if item.kind == "category", shouldDisableCustomCategoryHighlightAppearance() {
      listCell.automaticallyUpdatesBackgroundConfiguration = false
      listCell.configurationUpdateHandler = { cell, _ in
        cell.backgroundConfiguration = baseBackgroundConfiguration
      }
      listCell.isHighlighted = false
    }

    switch item.kind {
    case "menu":
      configureMenuRow(cell: listCell, item: item)
    case "category":
      configureCategoryRow(cell: listCell, item: item)
    case "todo":
      configureTodoRow(cell: listCell, item: item)
    case "sectionHeader":
      configureSectionHeaderRow(cell: listCell, item: item)
    case "sectionDivider":
      configureSectionDividerRow(cell: listCell, item: item)
    default:
      break
    }
  }

  func reconfigureVisibleCellsForCurrentMode() {
    for cell in collectionView.visibleCells {
      guard
        let indexPath = collectionView.indexPath(for: cell),
        let item = item(at: indexPath)
      else {
        continue
      }

      configure(cell: cell, with: item)
    }
  }

  func shouldDisableCustomCategoryHighlightAppearance() -> Bool {
    iosCategoryGestureMode == .customExperiment
  }

  func makeItemContextMenu(for item: NativeItem) -> UIMenu {
    makeNativeItemMenu(for: item)
  }

  func updateCollectionViewScrollBehavior() {
    let hasOnlyCategoryRows = sections
      .flatMap(\.items)
      .allSatisfy { $0.kind == "category" }

    collectionView.isScrollEnabled = !hasOnlyCategoryRows
    collectionView.alwaysBounceVertical = !hasOnlyCategoryRows
    collectionView.dragInteractionEnabled = false
    collectionView.isEditing = false
  }

  func makeLeadingBadge(for item: NativeItem) -> UIImage? {
    if item.kind == "category" || item.kind == "sectionHeader" {
      let size = CGSize(width: 12, height: 12)
      let renderer = UIGraphicsImageRenderer(size: size)
      let tint = UIColor(hexString: item.accentColor) ?? UIColor.systemGray

      return renderer.image { _ in
        tint.setFill()
        UIBezierPath(ovalIn: CGRect(origin: .zero, size: size)).fill()
      }.withRenderingMode(.alwaysOriginal)
    }

    return nil
  }

  private func resetReusableDecorations(for cell: UICollectionViewListCell) {
    cell.configurationUpdateHandler = nil
    cell.automaticallyUpdatesBackgroundConfiguration = true
    cell.contentView.subviews
      .compactMap { $0 as? MenuPrimaryActionButton }
      .forEach { $0.removeFromSuperview() }
  }

  private func configureMenuRow(cell: UICollectionViewListCell, item: NativeItem) {
    switch item.variant {
    case "switch":
      let toggle = SwitchAccessory()
      toggle.itemId = item.id
      toggle.isOn = item.switchValue == true
      toggle.addTarget(self, action: #selector(handleSwitchValueChanged(_:)), for: .valueChanged)
      let config = UICellAccessory.CustomViewConfiguration(
        customView: toggle,
        placement: .trailing()
      )
      cell.accessories = [.customView(configuration: config)]

    case "value-navigation":
      cell.accessories = [
        .label(text: item.valueText ?? ""),
        .disclosureIndicator()
      ]

    case "navigation":
      cell.accessories = [.disclosureIndicator()]

    case "menu":
      cell.accessories = [.label(text: "메뉴")]
      attachMenuPrimaryActionButton(to: cell, item: item)

    default:
      break
    }
  }

  private func configureCategoryRow(cell: UICollectionViewListCell, item: NativeItem) {
    var accessories: [UICellAccessory] = []

    if let trailingValue = categoryTrailingValue(for: item) {
      accessories.append(.label(text: trailingValue))
    }

    accessories.append(.disclosureIndicator())

    if iosCategoryGestureMode == .system, item.reorderable == true {
      accessories.append(.reorder(displayed: .always))
    }

    cell.accessories = accessories
  }

  private func configureTodoRow(cell: UICollectionViewListCell, item: NativeItem) {
    guard var content = cell.contentConfiguration as? UIListContentConfiguration else {
      return
    }

    content.image = nil
    content.textProperties.color = item.completed == true ? .secondaryLabel : .label
    content.secondaryTextProperties.color = item.completed == true ? .tertiaryLabel : .secondaryLabel
    cell.contentConfiguration = content

    var accessories: [UICellAccessory] = []

    if let toggleAccessory = makeTodoCompletionAccessory(for: item) {
      let config = UICellAccessory.CustomViewConfiguration(
        customView: toggleAccessory,
        placement: .leading()
      )
      accessories.append(.customView(configuration: config))
    }

    cell.accessories = accessories
  }

  private func configureSectionHeaderRow(cell: UICollectionViewListCell, item: NativeItem) {
    guard var content = cell.contentConfiguration as? UIListContentConfiguration else {
      return
    }

    content.image = makeLeadingBadge(for: item)
    content.imageProperties.cornerRadius = 0
    content.text = item.title
    content.secondaryText = nil
    content.textProperties.font = UIFont.systemFont(ofSize: 12, weight: .semibold)
    content.textProperties.color = .secondaryLabel
    cell.contentConfiguration = content
    let resolvedSectionId = sectionId(for: item.id) ?? ""
    let resolvedCollapsed =
      isSectionTemporarilyCollapsed(resolvedSectionId) ||
      (item.collapsed == true && !isSectionTemporarilyExpanded(resolvedSectionId))
    if
      let accessoryView = makeSectionHeaderAccessoryView(
        countText: categoryTrailingValue(for: item),
        collapsed: item.collapsed == nil ? nil : resolvedCollapsed
      )
    {
      let config = UICellAccessory.CustomViewConfiguration(
        customView: accessoryView,
        placement: .trailing()
      )
      cell.accessories = [.customView(configuration: config)]
    } else {
      cell.accessories = []
    }
    cell.backgroundConfiguration = nativeListBackgroundConfiguration(for: item)
    cell.isUserInteractionEnabled = item.disabled != true
    cell.accessibilityIdentifier = item.id
    cell.accessibilityLabel = item.title
  }

  private func configureSectionDividerRow(cell: UICollectionViewListCell, item: NativeItem) {
    cell.contentConfiguration = SectionDividerContentConfiguration(height: 16)
    cell.accessories = []
    cell.backgroundConfiguration = UIBackgroundConfiguration.clear()
    cell.isUserInteractionEnabled = false
    cell.accessibilityIdentifier = item.id
    cell.accessibilityLabel = nil
  }

  private func makeSectionHeaderAccessoryView(
    countText: String?,
    collapsed: Bool?
  ) -> UIView? {
    guard countText != nil || collapsed != nil else {
      return nil
    }

    let stackView = UIStackView()
    stackView.axis = .horizontal
    stackView.alignment = .center
    stackView.spacing = 6
    stackView.isUserInteractionEnabled = false

    if let countText {
      let countLabel = UILabel()
      countLabel.text = countText
      countLabel.font = UIFont.systemFont(ofSize: 12, weight: .semibold)
      countLabel.textColor = .tertiaryLabel
      countLabel.textAlignment = .right
      stackView.addArrangedSubview(countLabel)
    }

    if let collapsed {
      let imageView = UIImageView(
        image: UIImage(
          systemName: collapsed ? "chevron.down" : "chevron.up",
          withConfiguration: UIImage.SymbolConfiguration(pointSize: 12, weight: .semibold)
        )
      )
      imageView.tintColor = .tertiaryLabel
      imageView.contentMode = .scaleAspectFit
      imageView.widthAnchor.constraint(equalToConstant: 12).isActive = true
      imageView.heightAnchor.constraint(equalToConstant: 12).isActive = true
      stackView.addArrangedSubview(imageView)
    }

    return stackView
  }

  @objc
  private func handleSwitchValueChanged(_ sender: SwitchAccessory) {
    guard let itemId = sender.itemId else {
      return
    }

    onToggleSwitch([
      "itemId": itemId,
      "nextValue": sender.isOn
    ])
  }

  @objc
  private func handleTodoCompletionAccessoryTap(_ sender: TodoCompleteAccessoryButton) {
    guard let itemId = sender.itemId else {
      return
    }

    var payload: [String: Any] = [
      "itemId": itemId,
      "nextValue": sender.nextValue
    ]

    if let controlId = sender.controlId {
      payload["controlId"] = controlId
    }

    if let source = sender.controlSource {
      payload["source"] = source
    }

    onToggleSwitch(payload)
  }

  private func makeTrailingSwipeActions(for indexPath: IndexPath) -> UISwipeActionsConfiguration? {
    guard
      let item = item(at: indexPath),
      (item.kind == "category" || item.kind == "todo"),
      item.deletable == true
    else {
      return nil
    }

    let deleteAction = UIContextualAction(style: .destructive, title: "삭제") { [weak self] _, _, completion in
      if self?.customCategoryMenuItemId == item.id {
        self?.dismissCustomCategoryMenuOverlay(animated: true)
      }
      self?.onDelete([
        "itemId": item.id
      ])
      completion(true)
    }

    let config = UISwipeActionsConfiguration(actions: [deleteAction])
    config.performsFirstActionWithFullSwipe = false
    return config
  }

  private func attachMenuPrimaryActionButton(to cell: UICollectionViewListCell, item: NativeItem) {
    let button = MenuPrimaryActionButton(type: .custom)
    button.itemId = item.id
    button.translatesAutoresizingMaskIntoConstraints = false
    button.backgroundColor = .clear
    button.isAccessibilityElement = true
    button.accessibilityIdentifier = "menu-row-\(item.id)"
    button.accessibilityLabel = "menu-row-\(item.id)"
    button.accessibilityHint = item.title
    button.showsMenuAsPrimaryAction = true
    button.menu = makePrimaryActionMenu(for: item)

    cell.contentView.addSubview(button)
    NSLayoutConstraint.activate([
      button.leadingAnchor.constraint(equalTo: cell.contentView.leadingAnchor),
      button.trailingAnchor.constraint(equalTo: cell.contentView.trailingAnchor),
      button.topAnchor.constraint(equalTo: cell.contentView.topAnchor),
      button.bottomAnchor.constraint(equalTo: cell.contentView.bottomAnchor)
    ])
  }

  private func makePrimaryActionMenu(for item: NativeItem) -> UIMenu {
    makeNativeItemMenu(for: item, includeDelete: false)
  }

  private func currentListAppearance() -> UICollectionLayoutListConfiguration.Appearance {
    let hasOnlyCategoryRows = sections
      .flatMap(\.items)
      .allSatisfy { $0.kind == "category" }

    return hasOnlyCategoryRows ? .insetGrouped : .plain
  }

  private func nativeListBackgroundConfiguration(for item: NativeItem) -> UIBackgroundConfiguration {
    switch item.kind {
    case "category":
      return groupCategoryBackgroundConfiguration()
    case "todo":
      return listTodoBackgroundConfiguration()
    default:
      return UIBackgroundConfiguration.clear()
    }
  }

  private func groupCategoryBackgroundConfiguration() -> UIBackgroundConfiguration {
    UIBackgroundConfiguration.listGroupedCell()
  }

  private func listTodoBackgroundConfiguration() -> UIBackgroundConfiguration {
    UIBackgroundConfiguration.listPlainCell()
  }

  private func makeTodoCompletionAccessory(for item: NativeItem) -> TodoCompleteAccessoryButton? {
    guard item.switchValue != nil else {
      return nil
    }

    let button = TodoCompleteAccessoryButton(type: .system)
    let buttonSize: CGFloat = 28
    button.itemId = item.id
    button.controlId = item.toggleControlId
    button.controlSource = item.toggleControlSource
    button.nextValue = !(item.switchValue == true)
    button.backgroundColor = .clear
    button.frame = CGRect(x: 0, y: 0, width: buttonSize, height: buttonSize)
    button.widthAnchor.constraint(equalToConstant: buttonSize).isActive = true
    button.heightAnchor.constraint(equalToConstant: buttonSize).isActive = true

    let symbolName = item.switchValue == true ? "checkmark.circle.fill" : "circle"
    let pointSize: CGFloat = 22
    let symbolConfig = UIImage.SymbolConfiguration(pointSize: pointSize, weight: .semibold)
    let image = UIImage(systemName: symbolName, withConfiguration: symbolConfig)
    let tintColor = UIColor(hexString: item.accentColor) ?? UIColor.systemBlue
    button.setImage(image?.withRenderingMode(.alwaysTemplate), for: .normal)
    button.imageView?.contentMode = .scaleAspectFit
    button.tintColor = tintColor
    button.accessibilityIdentifier = "todo-complete-\(item.id)"
    button.accessibilityLabel = item.switchValue == true ? "완료 해제" : "완료"
    button.addTarget(self, action: #selector(handleTodoCompletionAccessoryTap(_:)), for: .touchUpInside)
    return button
  }
}

private extension UIColor {
  convenience init?(hexString: String?) {
    guard var hexString else {
      return nil
    }
    hexString = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
    if hexString.hasPrefix("#") {
      hexString.removeFirst()
    }
    guard hexString.count == 6, let value = Int(hexString, radix: 16) else {
      return nil
    }

    self.init(
      red: CGFloat((value >> 16) & 0xFF) / 255.0,
      green: CGFloat((value >> 8) & 0xFF) / 255.0,
      blue: CGFloat(value & 0xFF) / 255.0,
      alpha: 1
    )
  }
}
