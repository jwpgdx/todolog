import ExpoModulesCore
import UIKit

private struct NativeCategorySwipeAction: Decodable {
  let id: String
  let title: String
  let role: String?
}

private struct NativeCategoryMenuAction: Decodable {
  let id: String
  let title: String
  let role: String?
}

private struct NativeCategoryItem: Decodable {
  let id: String
  let kind: String
  let title: String
  let subtitle: String?
  let reorderable: Bool
  let pinned: Bool?
  let swipeActions: [NativeCategorySwipeAction]?
  let menuActions: [NativeCategoryMenuAction]?
  let enabled: Bool?
  let loading: Bool?
}

private struct NativeCategorySection: Decodable {
  let id: String
  let title: String?
  let footer: String?
  var items: [NativeCategoryItem]
}

private final class CategoryManagerSectionSupplementaryView: UICollectionReusableView {
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

final class NativeCategoryManagerView: ExpoView, UICollectionViewDelegate {
  let onPressItem = EventDispatcher()
  let onMenuAction = EventDispatcher()
  let onReorderCommit = EventDispatcher()
  let onSwipeAction = EventDispatcher()
  let onRequestDelete = EventDispatcher()
  let onError = EventDispatcher()

  private var screenId = "category-manager"
  private var sections: [NativeCategorySection] = []
  private var dataSource: UICollectionViewDiffableDataSource<String, String>!
  private let cellReuseIdentifier = "NativeCategoryManagerCell"
  private let headerReuseIdentifier = "NativeCategoryManagerHeader"
  private let footerReuseIdentifier = "NativeCategoryManagerFooter"

  private lazy var collectionView: UICollectionView = {
    let layout = makeLayout()
    let view = UICollectionView(frame: .zero, collectionViewLayout: layout)
    view.translatesAutoresizingMaskIntoConstraints = false
    view.backgroundColor = .clear
    view.delegate = self
    view.dragInteractionEnabled = true
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
      CategoryManagerSectionSupplementaryView.self,
      forSupplementaryViewOfKind: UICollectionView.elementKindSectionHeader,
      withReuseIdentifier: headerReuseIdentifier
    )
    collectionView.register(
      CategoryManagerSectionSupplementaryView.self,
      forSupplementaryViewOfKind: UICollectionView.elementKindSectionFooter,
      withReuseIdentifier: footerReuseIdentifier
    )

    configureDataSource()
  }

  func updateScreenId(_ nextScreenId: String?) {
    screenId = nextScreenId ?? "category-manager"
  }

  func updateSectionsJson(_ sectionsJson: String) {
    guard let data = sectionsJson.data(using: .utf8) else {
      sections = []
      onError([
        "code": "category_manager_invalid_json",
        "message": "Failed to encode sectionsJson as UTF-8"
      ])
      applySnapshot(animatingDifferences: false)
      return
    }

    do {
      sections = try JSONDecoder().decode([NativeCategorySection].self, from: data)
    } catch {
      sections = []
      onError([
        "code": "category_manager_decode_failed",
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

    onPressItem([
      "itemId": item.id,
      "kind": item.kind
    ])
  }

  func collectionView(
    _ collectionView: UICollectionView,
    contextMenuConfigurationForItemAt indexPath: IndexPath,
    point: CGPoint
  ) -> UIContextMenuConfiguration? {
    guard let item = item(at: indexPath), isItemEnabled(item) else {
      return nil
    }

    let menuActions = item.menuActions ?? []
    guard !menuActions.isEmpty else {
      return nil
    }

    return UIContextMenuConfiguration(identifier: item.id as NSString, previewProvider: nil) { [weak self] _ in
      guard let self else {
        return nil
      }

      let actions = menuActions.map { action in
        UIAction(
          title: action.title,
          attributes: action.role == "destructive" ? [.destructive] : []
        ) { [weak self] _ in
          self?.onMenuAction([
            "itemId": item.id,
            "actionId": action.id
          ])
        }
      }

      return UIMenu(children: actions)
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
          ) as? CategoryManagerSectionSupplementaryView
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
          ) as? CategoryManagerSectionSupplementaryView
        else {
          return nil
        }

        view.applyFooter(text: self.sections[indexPath.section].footer)
        return view
      }

      return nil
    }

    dataSource.reorderingHandlers.canReorderItem = { [weak self] itemId in
      guard let self, let item = self.findItem(by: itemId) else {
        return false
      }
      return item.reorderable && item.pinned != true
    }

    dataSource.reorderingHandlers.didReorder = { [weak self] transaction in
      guard let self else {
        return
      }

      self.rebuildSections(from: transaction.finalSnapshot)
      self.onReorderCommit([
        "orderedItemIds": self.orderedItemIds()
      ])
    }
  }

  private func makeLayout() -> UICollectionViewLayout {
    var config = UICollectionLayoutListConfiguration(appearance: .plain)
    config.headerMode = .supplementary
    config.footerMode = .supplementary
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
      guard let section = sectionById[sectionId] else {
        return nil
      }

      return NativeCategorySection(
        id: section.id,
        title: section.title,
        footer: section.footer,
        items: snapshot.itemIdentifiers(inSection: sectionId).compactMap { itemById[$0] }
      )
    }
  }

  private func configure(cell: UICollectionViewCell, with item: NativeCategoryItem) {
    guard let listCell = cell as? UICollectionViewListCell else {
      return
    }

    var content = UIListContentConfiguration.cell()
    content.text = item.title
    listCell.contentConfiguration = content
    listCell.backgroundConfiguration = UIBackgroundConfiguration.listPlainCell()
    listCell.isUserInteractionEnabled = isItemEnabled(item)
    listCell.contentView.alpha = isItemEnabled(item) ? 1.0 : 0.45
    listCell.accessibilityIdentifier = "category-row-\(item.id)"
    listCell.accessories = accessories(for: item)
  }

  private func accessories(for item: NativeCategoryItem) -> [UICellAccessory] {
    var accessories: [UICellAccessory] = []

    if let subtitle = item.subtitle, !subtitle.isEmpty {
      accessories.append(.label(text: subtitle))
    }

    accessories.append(.disclosureIndicator())

    if item.reorderable && item.pinned != true {
      accessories.append(.reorder(displayed: .always))
    }

    return accessories
  }

  private func makeTrailingSwipeActions(for indexPath: IndexPath) -> UISwipeActionsConfiguration? {
    guard let item = item(at: indexPath), isItemEnabled(item) else {
      return nil
    }

    let swipeActions = item.swipeActions ?? []
    guard !swipeActions.isEmpty else {
      return nil
    }

    let actions = swipeActions.map { action in
      UIContextualAction(
        style: action.role == "destructive" ? .destructive : .normal,
        title: action.title
      ) { [weak self] _, _, completion in
        guard let self else {
          completion(false)
          return
        }

        if action.id == "delete" {
          self.onRequestDelete([
            "itemId": item.id
          ])
        } else {
          self.onSwipeAction([
            "itemId": item.id,
            "actionId": action.id
          ])
        }

        self.applySnapshot(animatingDifferences: false)
        completion(true)
      }
    }

    let config = UISwipeActionsConfiguration(actions: actions)
    config.performsFirstActionWithFullSwipe = false
    return config
  }

  private func isItemEnabled(_ item: NativeCategoryItem) -> Bool {
    (item.enabled ?? true) && (item.loading != true)
  }

  private func item(at indexPath: IndexPath) -> NativeCategoryItem? {
    guard let itemId = dataSource.itemIdentifier(for: indexPath) else {
      return nil
    }
    return findItem(by: itemId)
  }

  private func findItem(by itemId: String) -> NativeCategoryItem? {
    sections.flatMap(\.items).first(where: { $0.id == itemId })
  }

  private func orderedItemIds() -> [String] {
    sections.flatMap(\.items).map(\.id)
  }
}
