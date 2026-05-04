import ExpoModulesCore
import UIKit

private struct NativeSection: Decodable {
  let id: String
  let title: String?
  let footer: String?
  let items: [NativeItem]
}

private struct NativeItem: Decodable {
  let id: String
  let kind: String
  let variant: String?
  let title: String
  let subtitle: String?
  let leadingIcon: String?
  let destructive: Bool?
  let disabled: Bool?
  let valueText: String?
  let switchValue: Bool?
  let menuActions: [String]?
  let accentColor: String?
  let metaText: String?
  let reorderable: Bool?
  let deletable: Bool?
  let supportsMenu: Bool?
  let toggleControlId: String?
  let toggleControlSource: String?
  let completed: Bool?
}

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

private struct CustomCategoryMenuActionDescriptor {
  let title: String
  let actionId: String?
  let destructive: Bool
}

private enum IOSCategoryGestureMode: String {
  case system
  case customExperiment = "custom-experiment"
  case customLifted = "custom-lifted"
  case systemCustom = "system-custom"
}

private enum CustomCategoryMenuInteractionStyle {
  case tapButtons
  case pressAndSlide
}

private struct CustomCategoryGestureSession {
  let sourceIndexPath: IndexPath
  let itemId: String
  let origin: CGPoint
  let reorderable: Bool
  let sourceCellFrame: CGRect
}

private struct SystemCategoryMenuDismissSession {
  let itemId: String
  let origin: CGPoint
  let sourceCellFrame: CGRect
}

private struct FocusedCategoryMenuSession {
  let sourceIndexPath: IndexPath
  let itemId: String
  let reorderable: Bool
}

private struct CategoryPreviewCornerStyle {
  let radius: CGFloat
  let maskedCorners: CACornerMask
}

final class NativeListInteractionsView: ExpoView, UICollectionViewDelegate, UIGestureRecognizerDelegate {
  let onItemPress = EventDispatcher()
  let onMenuAction = EventDispatcher()
  let onDelete = EventDispatcher()
  let onReorder = EventDispatcher()
  let onToggleSwitch = EventDispatcher()

  private var sections: [NativeSection] = []
  private var dataSource: UICollectionViewDiffableDataSource<String, String>!
  private var iosCategoryGestureMode: IOSCategoryGestureMode = .system
  private let cellReuseIdentifier = "NativeListInteractionsListCell"
  private var customCategoryGestureSession: CustomCategoryGestureSession?
  private var systemCategoryMenuDismissSession: SystemCategoryMenuDismissSession?
  private var visibleCategoryContextMenuItemId: String?
  private var customInteractiveReorderActive = false
  private let customCategoryReorderThreshold: CGFloat = 22
  private let systemCategoryMenuDismissThreshold: CGFloat = 22
  private weak var customCategoryMenuBackdropView: UIView?
  private weak var customCategoryMenuCardView: UIVisualEffectView?
  private weak var customCategoryMenuPreviewContainerView: UIView?
  private weak var customCategoryMenuOverlayHostView: UIView?
  private weak var customCategoryMenuSourceCell: UICollectionViewCell?
  private var customCategoryMenuSourceIndexPath: IndexPath?
  private var customCategoryMenuItemId: String?
  private var customCategoryMenuDescriptors: [CustomCategoryMenuActionDescriptor] = []
  private var customCategoryMenuButtons: [UIButton] = []
  private var customCategoryMenuInteractionStyle: CustomCategoryMenuInteractionStyle = .tapButtons
  private var customCategoryMenuHighlightedIndex: Int?
  private var focusedCategoryMenuSession: FocusedCategoryMenuSession?
  private let focusedCategoryMenuReorderThreshold: CGFloat = 6
  private lazy var categoryCustomLongPressRecognizer: UILongPressGestureRecognizer = {
    let recognizer = UILongPressGestureRecognizer(target: self, action: #selector(handleCategoryCustomLongPress(_:)))
    recognizer.minimumPressDuration = 0.5
    recognizer.allowableMovement = 40
    recognizer.cancelsTouchesInView = true
    recognizer.delegate = self
    return recognizer
  }()
  private lazy var categorySystemMenuTrackingRecognizer: UILongPressGestureRecognizer = {
    let recognizer = UILongPressGestureRecognizer(target: self, action: #selector(handleCategorySystemMenuTrackingLongPress(_:)))
    recognizer.minimumPressDuration = 0.35
    recognizer.allowableMovement = 1000
    recognizer.cancelsTouchesInView = false
    recognizer.delegate = self
    return recognizer
  }()
  private lazy var focusedCategoryMenuPanRecognizer: UIPanGestureRecognizer = {
    let recognizer = UIPanGestureRecognizer(target: self, action: #selector(handleFocusedCategoryMenuPan(_:)))
    recognizer.cancelsTouchesInView = true
    recognizer.delegate = self
    return recognizer
  }()

  private lazy var collectionView: UICollectionView = {
    let layout = makeLayout()
    let view = UICollectionView(frame: .zero, collectionViewLayout: layout)
    view.translatesAutoresizingMaskIntoConstraints = false
    view.backgroundColor = .clear
    view.delegate = self
    view.dragInteractionEnabled = false
    view.isScrollEnabled = false
    view.alwaysBounceVertical = false
    return view
  }()

  private lazy var headerRegistration = UICollectionView.SupplementaryRegistration<UICollectionViewListCell>(
    elementKind: UICollectionView.elementKindSectionHeader
  ) { [weak self] supplementaryView, _, indexPath in
    guard let self, self.sections.indices.contains(indexPath.section) else {
      return
    }

    let section = self.sections[indexPath.section]
    var content = UIListContentConfiguration.groupedHeader()
    content.text = section.title
    content.textProperties.color = .secondaryLabel
    supplementaryView.contentConfiguration = content
    supplementaryView.accessories = []
    supplementaryView.backgroundConfiguration = UIBackgroundConfiguration.clear()
    supplementaryView.isAccessibilityElement = false
  }

  private lazy var footerRegistration = UICollectionView.SupplementaryRegistration<UICollectionViewListCell>(
    elementKind: UICollectionView.elementKindSectionFooter
  ) { [weak self] supplementaryView, _, indexPath in
    guard let self, self.sections.indices.contains(indexPath.section) else {
      return
    }

    let section = self.sections[indexPath.section]
    var content = UIListContentConfiguration.groupedFooter()
    content.text = section.footer
    content.textProperties.color = .secondaryLabel
    supplementaryView.contentConfiguration = content
    supplementaryView.accessories = []
    supplementaryView.backgroundConfiguration = UIBackgroundConfiguration.clear()
    supplementaryView.isAccessibilityElement = false
  }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    backgroundColor = .clear

    addSubview(collectionView)
    addGestureRecognizer(focusedCategoryMenuPanRecognizer)
    NSLayoutConstraint.activate([
      collectionView.leadingAnchor.constraint(equalTo: leadingAnchor),
      collectionView.trailingAnchor.constraint(equalTo: trailingAnchor),
      collectionView.topAnchor.constraint(equalTo: topAnchor),
      collectionView.bottomAnchor.constraint(equalTo: bottomAnchor)
    ])

    collectionView.register(UICollectionViewListCell.self, forCellWithReuseIdentifier: cellReuseIdentifier)
    configureDataSource()
    configureCategoryGestureMode()
  }

  func updateSectionsJson(_ sectionsJson: String) {
    dismissCustomCategoryMenuOverlay(animated: false)
    resetCustomCategoryGestureState()
    resetSystemCategoryMenuDismissState()

    guard let data = sectionsJson.data(using: .utf8) else {
      sections = []
      applySnapshot(animatingDifferences: false)
      return
    }

    do {
      sections = try JSONDecoder().decode([NativeSection].self, from: data)
    } catch {
      NSLog("[NativeListInteractionsView] Failed to decode sectionsJson: %@", String(describing: error))
      sections = []
    }

    updateCollectionViewScrollBehavior()
    collectionView.setCollectionViewLayout(makeLayout(), animated: false)
    applySnapshot(animatingDifferences: false)
  }

  func updateIOSCategoryGestureMode(_ mode: String?) {
    iosCategoryGestureMode = IOSCategoryGestureMode(rawValue: mode ?? "") ?? .system
    configureCategoryGestureMode()
    collectionView.reloadData()
    collectionView.layoutIfNeeded()
    reconfigureVisibleCellsForCurrentMode()
  }

  private func configureCategoryGestureMode() {
    switch iosCategoryGestureMode {
    case .system:
      if collectionView.gestureRecognizers?.contains(categoryCustomLongPressRecognizer) == true {
        collectionView.removeGestureRecognizer(categoryCustomLongPressRecognizer)
      }
      if collectionView.gestureRecognizers?.contains(categorySystemMenuTrackingRecognizer) == true {
        collectionView.removeGestureRecognizer(categorySystemMenuTrackingRecognizer)
      }
      dismissCustomCategoryMenuOverlay(animated: false)
      resetCustomCategoryGestureState()
      resetSystemCategoryMenuDismissState()
    case .customExperiment, .customLifted, .systemCustom:
      if iosCategoryGestureMode == .customExperiment || iosCategoryGestureMode == .customLifted {
        if collectionView.gestureRecognizers?.contains(categorySystemMenuTrackingRecognizer) == true {
          collectionView.removeGestureRecognizer(categorySystemMenuTrackingRecognizer)
        }
        if collectionView.gestureRecognizers?.contains(categoryCustomLongPressRecognizer) != true {
          collectionView.addGestureRecognizer(categoryCustomLongPressRecognizer)
        }
        resetSystemCategoryMenuDismissState()
      } else {
        if collectionView.gestureRecognizers?.contains(categoryCustomLongPressRecognizer) == true {
          collectionView.removeGestureRecognizer(categoryCustomLongPressRecognizer)
        }
        if collectionView.gestureRecognizers?.contains(categorySystemMenuTrackingRecognizer) != true {
          collectionView.addGestureRecognizer(categorySystemMenuTrackingRecognizer)
        }
        dismissCustomCategoryMenuOverlay(animated: false)
        resetCustomCategoryGestureState()
      }
    }
  }

  func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
    collectionView.deselectItem(at: indexPath, animated: true)

    guard let item = item(at: indexPath), item.disabled != true else {
      return
    }

    switch item.kind {
    case "menu":
      switch item.variant {
      case "navigation", "value-navigation":
        onItemPress(["itemId": item.id])
      default:
        break
      }
    case "category":
      onItemPress(["itemId": item.id])
    case "todo":
      onItemPress(["itemId": item.id])
    default:
      break
    }
  }

  func collectionView(_ collectionView: UICollectionView, shouldHighlightItemAt indexPath: IndexPath) -> Bool {
    guard let item = item(at: indexPath) else {
      return true
    }

    if item.kind == "category" && shouldDisableCustomCategoryHighlightAppearance() {
      return false
    }

    return true
  }

  func collectionView(
    _ collectionView: UICollectionView,
    targetIndexPathForMoveOfItemFromOriginalIndexPath originalIndexPath: IndexPath,
    atCurrentIndexPath currentIndexPath: IndexPath,
    toProposedIndexPath proposedIndexPath: IndexPath
  ) -> IndexPath {
    let sectionIndex = originalIndexPath.section
    guard
      let validRange = reorderableIndexRange(in: sectionIndex),
      validRange.contains(originalIndexPath.item)
    else {
      return originalIndexPath
    }

    let targetSection = proposedIndexPath.section == sectionIndex
      ? sectionIndex
      : originalIndexPath.section
    let clampedItem = min(max(proposedIndexPath.item, validRange.lowerBound), validRange.upperBound)
    return IndexPath(item: clampedItem, section: targetSection)
  }

  func collectionView(
    _ collectionView: UICollectionView,
    contextMenuConfigurationForItemAt indexPath: IndexPath,
    point: CGPoint
  ) -> UIContextMenuConfiguration? {
    guard let item = item(at: indexPath), item.kind == "category" || item.kind == "todo" else {
      return nil
    }

    if
      item.kind == "category" &&
      (iosCategoryGestureMode == .customExperiment || iosCategoryGestureMode == .customLifted)
    {
      return nil
    }

    let hasMenuActions = item.supportsMenu == true && !(item.menuActions ?? []).isEmpty
    let hasDeleteAction = item.deletable == true
    guard hasMenuActions || hasDeleteAction else {
      return nil
    }

    return UIContextMenuConfiguration(identifier: item.id as NSString, previewProvider: nil) { [weak self] _ in
      guard let self else {
        return nil
      }
      return self.makeItemContextMenu(for: item)
    }
  }

  func collectionView(
    _ collectionView: UICollectionView,
    willDisplayContextMenu configuration: UIContextMenuConfiguration,
    animator: UIContextMenuInteractionAnimating?
  ) {
    visibleCategoryContextMenuItemId = configuration.identifier as? String
  }

  func collectionView(
    _ collectionView: UICollectionView,
    willEndContextMenuInteraction configuration: UIContextMenuConfiguration,
    animator: UIContextMenuInteractionAnimating?
  ) {
    let identifier = configuration.identifier as? String
    if visibleCategoryContextMenuItemId == identifier {
      visibleCategoryContextMenuItemId = nil
    }
    if systemCategoryMenuDismissSession?.itemId == identifier {
      resetSystemCategoryMenuDismissState()
    }
  }

  private func configureDataSource() {
    dataSource = UICollectionViewDiffableDataSource<String, String>(collectionView: collectionView) { [weak self] collectionView, indexPath, itemId in
      guard let self, let item = self.findItem(by: itemId) else {
        return nil
      }
      let cell = collectionView.dequeueReusableCell(withReuseIdentifier: self.cellReuseIdentifier, for: indexPath)
      self.configure(cell: cell, with: item)
      return cell
    }

    dataSource.reorderingHandlers.canReorderItem = { [weak self] itemId in
      guard let self, let item = self.findItem(by: itemId) else {
        return false
      }
      return item.kind == "category" && item.reorderable == true
    }

    dataSource.reorderingHandlers.didReorder = { [weak self] transaction in
      guard let self else {
        return
      }

      let finalSnapshot = transaction.finalSnapshot
      self.rebuildSections(from: finalSnapshot)
      self.dismissCustomCategoryMenuOverlay(animated: false)
      self.resetCustomCategoryGestureState()
      self.onReorder([
        "orderedIds": self.orderedCategoryIds()
      ])
    }
  }

  private func makeLayout() -> UICollectionViewLayout {
    var config = UICollectionLayoutListConfiguration(appearance: currentListAppearance())
    config.headerMode = .none
    config.footerMode = .none
    config.backgroundColor = .clear
    config.trailingSwipeActionsConfigurationProvider = { [weak self] indexPath in
      self?.makeTrailingSwipeActions(for: indexPath)
    }
    return UICollectionViewCompositionalLayout.list(using: config)
  }

  private func applySnapshot(animatingDifferences: Bool) {
    var snapshot = NSDiffableDataSourceSnapshot<String, String>()

    for section in sections {
      snapshot.appendSections([section.id])
      snapshot.appendItems(section.items.map(\.id), toSection: section.id)
    }

    dataSource.apply(snapshot, animatingDifferences: animatingDifferences)
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
        items: snapshot.itemIdentifiers(inSection: sectionId).compactMap { itemById[$0] }
      )
      return section
    }
  }

  private func configure(cell: UICollectionViewCell, with item: NativeItem) {
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
    let baseBackgroundConfiguration = baseBackgroundConfiguration(for: item)
    listCell.contentConfiguration = content
    listCell.accessories = []
    listCell.backgroundConfiguration = baseBackgroundConfiguration
    listCell.isUserInteractionEnabled = item.disabled != true
    listCell.contentView.alpha = item.disabled == true ? 0.45 : 1.0
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
    default:
      break
    }
  }

  private func reconfigureVisibleCellsForCurrentMode() {
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

  private func resetReusableDecorations(for cell: UICollectionViewListCell) {
    cell.configurationUpdateHandler = nil
    cell.automaticallyUpdatesBackgroundConfiguration = true
    cell.contentView.subviews
      .compactMap { $0 as? MenuPrimaryActionButton }
      .forEach { $0.removeFromSuperview() }
  }

  private func shouldDisableCustomCategoryHighlightAppearance() -> Bool {
    iosCategoryGestureMode == .customExperiment
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

  @objc
  private func handleCategoryCustomLongPress(_ recognizer: UILongPressGestureRecognizer) {
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
        item.kind == "category",
        item.disabled != true,
        let cell = collectionView.cellForItem(at: indexPath)
      else {
        return
      }

      let menuDescriptors = makeCustomCategoryMenuDescriptors(for: item)
      let cellFrame = cell.convert(cell.bounds, to: overlayHost)

      customCategoryGestureSession = CustomCategoryGestureSession(
        sourceIndexPath: indexPath,
        itemId: item.id,
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

      if customInteractiveReorderActive {
        collectionView.updateInteractiveMovementTargetPosition(location)
        return
      }

      let isInsideMenu = updateCustomCategoryMenuHighlight(at: overlayLocation)
      if isInsideMenu {
        return
      }

      guard shouldBeginCustomCategoryReorder(for: session, at: overlayLocation) else {
        return
      }

      dismissCustomCategoryMenuOverlay(animated: !currentCustomCategoryMenuUsesLiftedPreview())
      let didBegin = collectionView.beginInteractiveMovementForItem(at: session.sourceIndexPath)
      if didBegin {
        customInteractiveReorderActive = true
        collectionView.updateInteractiveMovementTargetPosition(location)
      }

    case .ended:
      if customInteractiveReorderActive {
        collectionView.endInteractiveMovement()
        dismissCustomCategoryMenuOverlay(animated: false)
      } else if customCategoryMenuInteractionStyle == .pressAndSlide {
        performCustomCategoryMenuSelectionIfNeeded()
        dismissCustomCategoryMenuOverlay(animated: false)
      }
      customCategoryGestureSession = nil
      customInteractiveReorderActive = false

    case .cancelled, .failed:
      if customInteractiveReorderActive {
        collectionView.cancelInteractiveMovement()
      }
      dismissCustomCategoryMenuOverlay(animated: true)
      resetCustomCategoryGestureState()

    default:
      break
    }
  }

  @objc
  private func handleCategorySystemMenuTrackingLongPress(_ recognizer: UILongPressGestureRecognizer) {
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

  private func resetCustomCategoryGestureState() {
    customCategoryGestureSession = nil
    customInteractiveReorderActive = false
    customCategoryMenuHighlightedIndex = nil
  }

  private func resetSystemCategoryMenuDismissState() {
    systemCategoryMenuDismissSession = nil
  }

  @objc
  private func handleFocusedCategoryMenuPan(_ recognizer: UIPanGestureRecognizer) {
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
      if customInteractiveReorderActive {
        collectionView.updateInteractiveMovementTargetPosition(locationInCollection)
        return
      }

      guard let session = focusedCategoryMenuSession, session.reorderable else {
        return
      }

      let translation = recognizer.translation(in: self)
      let distance = hypot(translation.x, translation.y)
      guard distance >= focusedCategoryMenuReorderThreshold else {
        return
      }

      restoreCustomCategoryMenuSourceCellAppearance()
      let didBegin = collectionView.beginInteractiveMovementForItem(at: session.sourceIndexPath)
      guard didBegin else {
        customCategoryMenuSourceCell?.alpha = 0
        return
      }

      customInteractiveReorderActive = true
      dismissCustomCategoryMenuOverlay(animated: false)
      collectionView.updateInteractiveMovementTargetPosition(locationInCollection)

    case .ended:
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
      if customInteractiveReorderActive {
        collectionView.cancelInteractiveMovement()
        customInteractiveReorderActive = false
      }

    default:
      break
    }
  }

  func gestureRecognizer(
    _ gestureRecognizer: UIGestureRecognizer,
    shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
  ) -> Bool {
    if gestureRecognizer === focusedCategoryMenuPanRecognizer || otherGestureRecognizer === focusedCategoryMenuPanRecognizer {
      return false
    }
    if gestureRecognizer === categorySystemMenuTrackingRecognizer || otherGestureRecognizer === categorySystemMenuTrackingRecognizer {
      return true
    }
    if gestureRecognizer === categoryCustomLongPressRecognizer || otherGestureRecognizer === categoryCustomLongPressRecognizer {
      return false
    }
    return true
  }

  func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
    if gestureRecognizer === focusedCategoryMenuPanRecognizer {
      guard
        currentCustomCategoryMenuUsesLiftedPreview(),
        let previewContainer = customCategoryMenuPreviewContainerView,
        focusedCategoryMenuSession != nil
      else {
        return false
      }

      let location = touch.location(in: currentCustomCategoryMenuOverlayHostView())
      return previewContainer.frame.contains(location)
    }

    guard
      gestureRecognizer === categoryCustomLongPressRecognizer ||
      gestureRecognizer === categorySystemMenuTrackingRecognizer
    else {
      return true
    }

    let location = touch.location(in: collectionView)
    guard
      let indexPath = collectionView.indexPathForItem(at: location),
      let item = item(at: indexPath)
    else {
      return false
    }

    return item.kind == "category" && item.disabled != true
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
    let actions = (item.menuActions ?? []).map { action in
      UIAction(title: label(for: action)) { [weak self] _ in
        self?.onMenuAction([
          "itemId": item.id,
          "action": action
        ])
      }
    }

    return UIMenu(title: item.title, children: actions)
  }

  private func makeItemContextMenu(for item: NativeItem) -> UIMenu {
    var actions = (item.menuActions ?? []).map { action in
      UIAction(title: label(for: action)) { [weak self] _ in
        self?.onMenuAction([
          "itemId": item.id,
          "action": action
        ])
      }
    }

    if item.deletable == true {
      let deleteAction = UIAction(title: "삭제", attributes: .destructive) { [weak self] _ in
        self?.onDelete([
          "itemId": item.id
        ])
      }
      actions.append(deleteAction)
    }

    return UIMenu(title: item.title, children: actions)
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

  private func currentCustomCategoryMenuUsesLiftedPreview() -> Bool {
    iosCategoryGestureMode == .customLifted
  }

  private func currentCustomCategoryMenuOverlayHostView() -> UIView {
    if let hostView = customCategoryMenuOverlayHostView, hostView.window != nil {
      return hostView
    }

    if let window {
      return window
    }

    return self
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

    if let cardView = customCategoryMenuCardView {
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

  private func dismissCustomCategoryMenuOverlay(animated: Bool) {
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

  private func restoreCustomCategoryMenuSourceCellAppearance() {
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

  private func item(at indexPath: IndexPath) -> NativeItem? {
    guard let itemId = dataSource.itemIdentifier(for: indexPath) else {
      return nil
    }
    return findItem(by: itemId)
  }

  private func currentListAppearance() -> UICollectionLayoutListConfiguration.Appearance {
    let hasOnlyCategoryRows = sections
      .flatMap(\.items)
      .allSatisfy { $0.kind == "category" }

    return hasOnlyCategoryRows ? .insetGrouped : .plain
  }

  private func updateCollectionViewScrollBehavior() {
    let hasOnlyCategoryRows = sections
      .flatMap(\.items)
      .allSatisfy { $0.kind == "category" }

    collectionView.isScrollEnabled = !hasOnlyCategoryRows
    collectionView.alwaysBounceVertical = !hasOnlyCategoryRows
  }

  private func baseBackgroundConfiguration(for item: NativeItem) -> UIBackgroundConfiguration {
    switch item.kind {
    case "category":
      return UIBackgroundConfiguration.listGroupedCell()
    case "todo":
      return UIBackgroundConfiguration.listPlainCell()
    default:
      return UIBackgroundConfiguration.clear()
    }
  }

  private func reorderableIndexRange(in sectionIndex: Int) -> ClosedRange<Int>? {
    guard sections.indices.contains(sectionIndex) else {
      return nil
    }

    let reorderableIndices = sections[sectionIndex].items.enumerated().compactMap { index, item in
      item.kind == "category" && item.reorderable == true ? index : nil
    }

    guard
      let firstIndex = reorderableIndices.first,
      let lastIndex = reorderableIndices.last
    else {
      return nil
    }

    return firstIndex...lastIndex
  }

  private func findItem(by itemId: String) -> NativeItem? {
    for section in sections {
      if let item = section.items.first(where: { $0.id == itemId }) {
        return item
      }
    }
    return nil
  }

  private func orderedCategoryIds() -> [String] {
    sections.flatMap { section in
      section.items
        .filter { $0.kind == "category" }
        .map(\.id)
    }
  }

  private func label(for action: String) -> String {
    switch action {
    case "open":
      return "열기"
    case "view":
      return "보기"
    case "rename":
      return "이름 변경"
    case "edit":
      return "편집"
    case "move":
      return "이동"
    case "duplicate":
      return "복제"
    case "archive":
      return "보관"
    case "favorite":
      return "즐겨찾기 추가"
    case "unfavorite":
      return "즐겨찾기 해제"
    case "delete":
      return "삭제"
    default:
      return action
    }
  }

  private func categoryTrailingValue(for item: NativeItem) -> String? {
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

  private func makeLeadingBadge(for item: NativeItem) -> UIImage? {
    if item.kind == "category" {
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
