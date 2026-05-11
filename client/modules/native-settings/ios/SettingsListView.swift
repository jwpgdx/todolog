import ExpoModulesCore
import UIKit

private struct NativeSettingsSelectionOption: Decodable {
  let id: String
  let label: String
  let subtitle: String?
}

private struct NativeSettingsTemporalConfig: Decodable {
  let mode: String
  let presentation: String?
  let timeZone: String?
}

private struct NativeSettingsListItem: Decodable {
  let id: String
  let kind: String
  var title: String?
  let subtitle: String?
  var value: String?
  let destination: String?
  let selectionScreenId: String?
  var toggleValue: Bool?
  let options: [NativeSettingsSelectionOption]?
  var selectedOptionId: String?
  var expanded: Bool?
  let embeddedContentId: String?
  let contentType: String?
  let temporalConfig: NativeSettingsTemporalConfig?
  let confirmStyle: String?
  let childVisibilityKey: String?
  let enabled: Bool?
  let loading: Bool?

  private enum CodingKeys: String, CodingKey {
    case id
    case kind
    case title
    case subtitle
    case value
    case destination
    case selectionScreenId
    case options
    case selectedOptionId
    case expanded
    case embeddedContentId
    case contentType
    case temporalConfig
    case confirmStyle
    case childVisibilityKey
    case enabled
    case loading
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)

    id = try container.decode(String.self, forKey: .id)
    kind = try container.decode(String.self, forKey: .kind)
    title = try container.decodeIfPresent(String.self, forKey: .title)
    subtitle = try container.decodeIfPresent(String.self, forKey: .subtitle)
    value = try? container.decodeIfPresent(String.self, forKey: .value)
    destination = try container.decodeIfPresent(String.self, forKey: .destination)
    selectionScreenId = try container.decodeIfPresent(String.self, forKey: .selectionScreenId)
    toggleValue = try? container.decodeIfPresent(Bool.self, forKey: .value)
    options = try container.decodeIfPresent([NativeSettingsSelectionOption].self, forKey: .options)
    selectedOptionId = try container.decodeIfPresent(String.self, forKey: .selectedOptionId)
    expanded = try container.decodeIfPresent(Bool.self, forKey: .expanded)
    embeddedContentId = try container.decodeIfPresent(String.self, forKey: .embeddedContentId)
    contentType = try container.decodeIfPresent(String.self, forKey: .contentType)
    temporalConfig = try container.decodeIfPresent(NativeSettingsTemporalConfig.self, forKey: .temporalConfig)
    confirmStyle = try container.decodeIfPresent(String.self, forKey: .confirmStyle)
    childVisibilityKey = try container.decodeIfPresent(String.self, forKey: .childVisibilityKey)
    enabled = try container.decodeIfPresent(Bool.self, forKey: .enabled)
    loading = try container.decodeIfPresent(Bool.self, forKey: .loading)
  }
}

private struct NativeSettingsListSection: Decodable {
  let id: String
  let title: String?
  let footer: String?
  var items: [NativeSettingsListItem]
}

private final class SettingsListSwitchAccessory: UISwitch {
  var itemId: String?
}

private final class SettingsListSectionSupplementaryView: UICollectionReusableView {
  private let label = UILabel()

  override init(frame: CGRect) {
    super.init(frame: frame)

    label.translatesAutoresizingMaskIntoConstraints = false
    label.numberOfLines = 0

    addSubview(label)

    NSLayoutConstraint.activate([
      label.leadingAnchor.constraint(equalTo: layoutMarginsGuide.leadingAnchor),
      label.trailingAnchor.constraint(equalTo: layoutMarginsGuide.trailingAnchor),
      label.topAnchor.constraint(equalTo: topAnchor, constant: 4),
      label.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -4)
    ])
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func applyHeader(text: String?) {
    label.text = text
    label.font = .preferredFont(forTextStyle: .footnote)
    label.textColor = .secondaryLabel
    label.isHidden = (text?.isEmpty ?? true)
    isAccessibilityElement = false
  }

  func applyFooter(text: String?) {
    label.text = text
    label.font = .preferredFont(forTextStyle: .footnote)
    label.textColor = .secondaryLabel
    label.isHidden = (text?.isEmpty ?? true)
    isAccessibilityElement = false
  }
}

final class NativeSettingsListView: ExpoView, UICollectionViewDelegate {
  let onPressItem = EventDispatcher()
  let onToggleChange = EventDispatcher()
  let onMenuAction = EventDispatcher()
  let onNavigate = EventDispatcher()
  let onExpandChange = EventDispatcher()
  let onError = EventDispatcher()

  private var screenId = "settings-list"
  private var sections: [NativeSettingsListSection] = []
  private var dataSource: UICollectionViewDiffableDataSource<String, String>!
  private let cellReuseIdentifier = "NativeSettingsListCell"
  private let headerReuseIdentifier = "NativeSettingsListHeader"
  private let footerReuseIdentifier = "NativeSettingsListFooter"

  private lazy var collectionView: UICollectionView = {
    let layout = makeLayout()
    let view = UICollectionView(frame: .zero, collectionViewLayout: layout)
    view.translatesAutoresizingMaskIntoConstraints = false
    view.backgroundColor = .clear
    view.delegate = self
    view.isScrollEnabled = false
    view.alwaysBounceVertical = false
    return view
  }()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    backgroundColor = .clear
    addSubview(collectionView)

    NSLayoutConstraint.activate([
      collectionView.leadingAnchor.constraint(equalTo: leadingAnchor),
      collectionView.trailingAnchor.constraint(equalTo: trailingAnchor),
      collectionView.topAnchor.constraint(equalTo: topAnchor),
      collectionView.bottomAnchor.constraint(equalTo: bottomAnchor)
    ])

    collectionView.register(
      UICollectionViewListCell.self,
      forCellWithReuseIdentifier: cellReuseIdentifier
    )
    collectionView.register(
      SettingsListSectionSupplementaryView.self,
      forSupplementaryViewOfKind: UICollectionView.elementKindSectionHeader,
      withReuseIdentifier: headerReuseIdentifier
    )
    collectionView.register(
      SettingsListSectionSupplementaryView.self,
      forSupplementaryViewOfKind: UICollectionView.elementKindSectionFooter,
      withReuseIdentifier: footerReuseIdentifier
    )

    configureDataSource()
  }

  func updateScreenId(_ nextScreenId: String?) {
    screenId = nextScreenId ?? "settings-list"
  }

  func updateSectionsJson(_ sectionsJson: String) {
    guard let data = sectionsJson.data(using: .utf8) else {
      sections = []
      onError([
        "code": "settings_list_invalid_json",
        "message": "Failed to encode sectionsJson as UTF-8"
      ])
      applySnapshot(animatingDifferences: false)
      return
    }

    do {
      sections = try JSONDecoder().decode([NativeSettingsListSection].self, from: data)
    } catch {
      sections = []
      onError([
        "code": "settings_list_decode_failed",
        "message": String(describing: error)
      ])
    }

    applySnapshot(animatingDifferences: false)
  }

  func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
    collectionView.deselectItem(at: indexPath, animated: true)

    guard let item = item(at: indexPath), isItemEnabled(item) else {
      return
    }

    switch item.kind {
    case "navigationValue":
      emitPress(item)
      if let destination = item.destination {
        onNavigate(["itemId": item.id, "destination": destination])
      }

    case "selectionNavigation":
      emitPress(item)
      if let selectionScreenId = item.selectionScreenId {
        onNavigate(["itemId": item.id, "destination": selectionScreenId])
      }

    case "toggle":
      applyToggleChange(itemId: item.id, nextValue: !(item.toggleValue ?? false))

    case "expandableParent":
      applyExpandChange(itemId: item.id, expanded: !(item.expanded ?? false))

    case "action":
      emitPress(item)

    case "destructiveAction":
      presentDestructiveConfirmation(for: item)

    default:
      break
    }
  }

  private func configureDataSource() {
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

    dataSource.supplementaryViewProvider = { [weak self] collectionView, kind, indexPath in
      guard let self else {
        return nil
      }

      if kind == UICollectionView.elementKindSectionHeader {
        guard
          self.sections.indices.contains(indexPath.section),
          let view = collectionView.dequeueReusableSupplementaryView(
            ofKind: kind,
            withReuseIdentifier: self.headerReuseIdentifier,
            for: indexPath
          ) as? SettingsListSectionSupplementaryView
        else {
          return nil
        }

        view.applyHeader(text: self.sections[indexPath.section].title)
        return view
      }

      if kind == UICollectionView.elementKindSectionFooter {
        guard
          self.sections.indices.contains(indexPath.section),
          let view = collectionView.dequeueReusableSupplementaryView(
            ofKind: kind,
            withReuseIdentifier: self.footerReuseIdentifier,
            for: indexPath
          ) as? SettingsListSectionSupplementaryView
        else {
          return nil
        }

        view.applyFooter(text: self.sections[indexPath.section].footer)
        return view
      }

      return nil
    }
  }

  private func makeLayout() -> UICollectionViewLayout {
    var config = UICollectionLayoutListConfiguration(appearance: .insetGrouped)
    config.headerMode = .supplementary
    config.footerMode = .supplementary
    config.backgroundColor = .clear
    return UICollectionViewCompositionalLayout.list(using: config)
  }

  private func applySnapshot(animatingDifferences: Bool) {
    var snapshot = NSDiffableDataSourceSnapshot<String, String>()

    for section in sections {
      snapshot.appendSections([section.id])
      snapshot.appendItems(visibleItems(for: section).map(\.id), toSection: section.id)
    }

    dataSource.apply(snapshot, animatingDifferences: animatingDifferences)
  }

  private func visibleItems(for section: NativeSettingsListSection) -> [NativeSettingsListItem] {
    let expandedContentIds = Set(
      section.items.compactMap { item in
        if item.kind == "expandableParent" && item.expanded == true {
          return item.embeddedContentId
        }
        return nil
      }
    )

    let toggleDrivenContentIds = Set(
      section.items.compactMap { item in
        if item.kind == "toggle" && item.toggleValue == true {
          return item.childVisibilityKey
        }
        return nil
      }
    )

    return section.items.filter { item in
      guard item.kind == "embeddedContent" else {
        return true
      }

      return expandedContentIds.contains(item.id) || toggleDrivenContentIds.contains(item.id)
    }
  }

  private func configure(cell: UICollectionViewCell, with item: NativeSettingsListItem) {
    guard let listCell = cell as? UICollectionViewListCell else {
      return
    }

    var content = (item.subtitle?.isEmpty == false)
      ? UIListContentConfiguration.subtitleCell()
      : UIListContentConfiguration.cell()

    content.text = titleText(for: item)
    content.secondaryText = subtitleText(for: item)
    content.textProperties.color = titleColor(for: item)
    content.secondaryTextProperties.color = .secondaryLabel
    listCell.contentConfiguration = content
    listCell.backgroundConfiguration = backgroundConfiguration(for: item)
    listCell.accessories = accessories(for: item)
    listCell.isUserInteractionEnabled = isItemEnabled(item)
    listCell.contentView.alpha = isItemEnabled(item) ? 1.0 : 0.45
    listCell.accessibilityIdentifier = "settings-row-\(item.id)"
  }

  private func titleText(for item: NativeSettingsListItem) -> String {
    if let title = item.title, !title.isEmpty {
      return title
    }

    if item.kind == "embeddedContent" {
      return "Embedded Content"
    }

    return item.id
  }

  private func subtitleText(for item: NativeSettingsListItem) -> String? {
    if let subtitle = item.subtitle, !subtitle.isEmpty {
      return subtitle
    }

    if item.kind == "embeddedContent" {
      return embeddedContentSummary(for: item)
    }

    return nil
  }

  private func embeddedContentSummary(for item: NativeSettingsListItem) -> String {
    var lines = [item.contentType ?? "custom"]
    if let mode = item.temporalConfig?.mode {
      lines.append(mode)
    }
    if let presentation = item.temporalConfig?.presentation {
      lines.append(presentation)
    }
    if let timeZone = item.temporalConfig?.timeZone {
      lines.append(timeZone)
    }
    return lines.joined(separator: " · ")
  }

  private func titleColor(for item: NativeSettingsListItem) -> UIColor {
    switch item.kind {
    case "action":
      return tintColor
    case "destructiveAction":
      return .systemRed
    default:
      return .label
    }
  }

  private func backgroundConfiguration(for item: NativeSettingsListItem) -> UIBackgroundConfiguration {
    if item.kind == "embeddedContent" {
      var config = UIBackgroundConfiguration.listGroupedCell()
      config.backgroundColor = UIColor.secondarySystemGroupedBackground
      return config
    }

    return UIBackgroundConfiguration.listGroupedCell()
  }

  private func accessories(for item: NativeSettingsListItem) -> [UICellAccessory] {
    switch item.kind {
    case "navigationValue":
      var accessories: [UICellAccessory] = []
      if let value = item.value, !value.isEmpty {
        accessories.append(.label(text: value))
      }
      accessories.append(.disclosureIndicator())
      return accessories

    case "staticValue":
      if let value = item.value, !value.isEmpty {
        return [.label(text: value)]
      }
      return []

    case "toggle":
      let toggle = SettingsListSwitchAccessory()
      toggle.itemId = item.id
      toggle.isOn = item.toggleValue ?? false
      toggle.addTarget(self, action: #selector(handleSwitchValueChanged(_:)), for: .valueChanged)
      let config = UICellAccessory.CustomViewConfiguration(
        customView: toggle,
        placement: .trailing()
      )
      return [.customView(configuration: config)]

    case "menu":
      let button = UIButton(type: .system)
      var buttonConfig = UIButton.Configuration.plain()
      buttonConfig.title = currentMenuLabel(for: item) ?? "선택"
      buttonConfig.image = UIImage(systemName: "chevron.up.chevron.down")
      buttonConfig.imagePlacement = .trailing
      buttonConfig.imagePadding = 4
      buttonConfig.baseForegroundColor = .secondaryLabel
      button.configuration = buttonConfig
      button.showsMenuAsPrimaryAction = true
      button.menu = makeMenu(for: item)
      let config = UICellAccessory.CustomViewConfiguration(
        customView: button,
        placement: .trailing()
      )
      return [.customView(configuration: config)]

    case "selectionNavigation":
      var accessories: [UICellAccessory] = []
      if let value = item.value, !value.isEmpty {
        accessories.append(.label(text: value))
      }
      accessories.append(.disclosureIndicator())
      return accessories

    case "expandableParent":
      var accessories: [UICellAccessory] = []
      if let value = item.value, !value.isEmpty {
        accessories.append(.label(text: value))
      }
      let chevron = UIImageView(
        image: UIImage(
          systemName: item.expanded == true ? "chevron.up" : "chevron.down"
        )
      )
      chevron.tintColor = .tertiaryLabel
      let config = UICellAccessory.CustomViewConfiguration(
        customView: chevron,
        placement: .trailing()
      )
      accessories.append(.customView(configuration: config))
      return accessories

    default:
      return []
    }
  }

  private func currentMenuLabel(for item: NativeSettingsListItem) -> String? {
    if let selectedOptionId = item.selectedOptionId,
       let option = item.options?.first(where: { $0.id == selectedOptionId }) {
      return option.label
    }

    return item.value
  }

  private func makeMenu(for item: NativeSettingsListItem) -> UIMenu? {
    let actions = (item.options ?? []).map { option in
      UIAction(
        title: option.label,
        state: option.id == item.selectedOptionId ? .on : .off
      ) { [weak self] _ in
        self?.applyMenuSelection(itemId: item.id, optionId: option.id)
      }
    }

    if actions.isEmpty {
      return nil
    }

    return UIMenu(children: actions)
  }

  private func isItemEnabled(_ item: NativeSettingsListItem) -> Bool {
    (item.enabled ?? true) && (item.loading != true)
  }

  private func item(at indexPath: IndexPath) -> NativeSettingsListItem? {
    guard let itemId = dataSource.itemIdentifier(for: indexPath) else {
      return nil
    }
    return findItem(by: itemId)
  }

  private func findItem(by itemId: String) -> NativeSettingsListItem? {
    sections.flatMap(\.items).first { $0.id == itemId }
  }

  private func emitPress(_ item: NativeSettingsListItem) {
    onPressItem(["itemId": item.id, "kind": item.kind])
  }

  @objc private func handleSwitchValueChanged(_ sender: SettingsListSwitchAccessory) {
    guard let itemId = sender.itemId else {
      return
    }
    applyToggleChange(itemId: itemId, nextValue: sender.isOn)
  }

  private func applyToggleChange(itemId: String, nextValue: Bool) {
    mutateItem(itemId: itemId) { item in
      item.toggleValue = nextValue
    }

    applySnapshot(animatingDifferences: true)
    onToggleChange(["itemId": itemId, "value": nextValue])
  }

  private func applyMenuSelection(itemId: String, optionId: String) {
    mutateItem(itemId: itemId) { item in
      item.selectedOptionId = optionId
      if let option = item.options?.first(where: { $0.id == optionId }) {
        item.value = option.label
      }
    }

    applySnapshot(animatingDifferences: true)
    onMenuAction(["itemId": itemId, "actionId": optionId])
  }

  private func applyExpandChange(itemId: String, expanded: Bool) {
    mutateItem(itemId: itemId) { item in
      item.expanded = expanded
    }

    applySnapshot(animatingDifferences: true)
    onExpandChange(["itemId": itemId, "expanded": expanded])
  }

  private func mutateItem(itemId: String, transform: (inout NativeSettingsListItem) -> Void) {
    for sectionIndex in sections.indices {
      guard let itemIndex = sections[sectionIndex].items.firstIndex(where: { $0.id == itemId }) else {
        continue
      }

      transform(&sections[sectionIndex].items[itemIndex])
      break
    }
  }

  private func presentDestructiveConfirmation(for item: NativeSettingsListItem) {
    guard let viewController = nearestViewController() else {
      emitPress(item)
      return
    }

    let style: UIAlertController.Style = item.confirmStyle == "sheet" ? .actionSheet : .alert
    let alert = UIAlertController(
      title: item.title ?? "확인",
      message: "이 작업을 계속할까요?",
      preferredStyle: style
    )

    alert.addAction(
      UIAlertAction(title: "취소", style: .cancel)
    )

    alert.addAction(
      UIAlertAction(title: "실행", style: .destructive) { [weak self] _ in
        self?.emitPress(item)
      }
    )

    viewController.present(alert, animated: true)
  }

  private func nearestViewController() -> UIViewController? {
    var responder: UIResponder? = self
    while let current = responder {
      if let viewController = current as? UIViewController {
        return viewController
      }
      responder = current.next
    }

    return UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap(\.windows)
      .first(where: \.isKeyWindow)?
      .rootViewController
  }
}
