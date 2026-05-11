import ExpoModulesCore
import UIKit

private struct NativeSelectionOption: Decodable {
  let id: String
  let label: String
  let subtitle: String?
  let keywords: [String]?
}

private struct NativeSelectionListPayload: Decodable {
  let screenId: String
  let title: String
  let subtitle: String?
  let options: [NativeSelectionOption]
  var selectedIds: [String]
  let searchEnabled: Bool?
  let allowsMultiple: Bool?
  let emptyStateText: String?
}

final class NativeSelectionListView: ExpoView, UICollectionViewDelegate, UISearchBarDelegate {
  let onPressItem = EventDispatcher()
  let onSelectionCommit = EventDispatcher()
  let onError = EventDispatcher()

  private var screenId = "selection-list"
  private var payload = NativeSelectionListPayload(
    screenId: "selection-list",
    title: "SelectionList",
    subtitle: nil,
    options: [],
    selectedIds: [],
    searchEnabled: false,
    allowsMultiple: false,
    emptyStateText: nil
  )
  private var filteredOptions: [NativeSelectionOption] = []
  private var dataSource: UICollectionViewDiffableDataSource<String, String>!
  private let sectionId = "options"
  private let cellReuseIdentifier = "NativeSelectionListCell"

  private let titleLabel: UILabel = {
    let label = UILabel()
    label.translatesAutoresizingMaskIntoConstraints = false
    label.font = .systemFont(ofSize: 20, weight: .bold)
    label.textColor = .label
    label.numberOfLines = 0
    return label
  }()

  private let subtitleLabel: UILabel = {
    let label = UILabel()
    label.translatesAutoresizingMaskIntoConstraints = false
    label.font = .systemFont(ofSize: 14, weight: .regular)
    label.textColor = .secondaryLabel
    label.numberOfLines = 0
    return label
  }()

  private lazy var searchBar: UISearchBar = {
    let view = UISearchBar(frame: .zero)
    view.translatesAutoresizingMaskIntoConstraints = false
    view.searchBarStyle = .minimal
    view.placeholder = "검색"
    view.delegate = self
    view.autocapitalizationType = .none
    return view
  }()

  private let emptyStateLabel: UILabel = {
    let label = UILabel()
    label.translatesAutoresizingMaskIntoConstraints = false
    label.font = .systemFont(ofSize: 14, weight: .regular)
    label.textColor = .secondaryLabel
    label.numberOfLines = 0
    label.textAlignment = .center
    label.isHidden = true
    return label
  }()

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
    configureViewHierarchy()
    configureDataSource()
    renderHeader()
    applyFilter(query: nil, animated: false)
  }

  func updateScreenId(_ nextScreenId: String?) {
    screenId = nextScreenId ?? "selection-list"
  }

  func updatePayloadJson(_ payloadJson: String) {
    guard let data = payloadJson.data(using: .utf8) else {
      onError([
        "code": "selection_list_invalid_json",
        "message": "Failed to encode payloadJson as UTF-8"
      ])
      payload = NativeSelectionListPayload(
        screenId: screenId,
        title: "SelectionList",
        subtitle: nil,
        options: [],
        selectedIds: [],
        searchEnabled: false,
        allowsMultiple: false,
        emptyStateText: nil
      )
      applyFilter(query: nil, animated: false)
      return
    }

    do {
      payload = try JSONDecoder().decode(NativeSelectionListPayload.self, from: data)
      if screenId.isEmpty {
        screenId = payload.screenId
      }
      renderHeader()
      applyFilter(query: searchBar.text, animated: false)
    } catch {
      onError([
        "code": "selection_list_decode_failed",
        "message": String(describing: error)
      ])
      payload = NativeSelectionListPayload(
        screenId: screenId,
        title: "SelectionList",
        subtitle: nil,
        options: [],
        selectedIds: [],
        searchEnabled: false,
        allowsMultiple: false,
        emptyStateText: nil
      )
      renderHeader()
      applyFilter(query: nil, animated: false)
    }
  }

  func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
    collectionView.deselectItem(at: indexPath, animated: true)

    guard let optionId = dataSource.itemIdentifier(for: indexPath),
          let option = filteredOptions.first(where: { $0.id == optionId }) else {
      return
    }

    var nextSelectedIds = payload.selectedIds
    let allowsMultiple = payload.allowsMultiple == true

    if allowsMultiple {
      if let existingIndex = nextSelectedIds.firstIndex(of: option.id) {
        nextSelectedIds.remove(at: existingIndex)
      } else {
        nextSelectedIds.append(option.id)
      }
    } else {
      nextSelectedIds = [option.id]
    }

    payload.selectedIds = nextSelectedIds
    applyFilter(query: searchBar.text, animated: true)
    onPressItem([
      "itemId": option.id,
      "kind": "selectionOption"
    ])
    onSelectionCommit([
      "screenId": currentScreenId(),
      "selectedIds": nextSelectedIds
    ])
  }

  func searchBar(_ searchBar: UISearchBar, textDidChange searchText: String) {
    applyFilter(query: searchText, animated: false)
  }

  private func configureViewHierarchy() {
    addSubview(titleLabel)
    addSubview(subtitleLabel)
    addSubview(searchBar)
    addSubview(collectionView)
    addSubview(emptyStateLabel)

    NSLayoutConstraint.activate([
      titleLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
      titleLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
      titleLabel.topAnchor.constraint(equalTo: topAnchor, constant: 16),

      subtitleLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
      subtitleLabel.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),
      subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 6),

      searchBar.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 10),
      searchBar.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -10),
      searchBar.topAnchor.constraint(equalTo: subtitleLabel.bottomAnchor, constant: 8),

      collectionView.leadingAnchor.constraint(equalTo: leadingAnchor),
      collectionView.trailingAnchor.constraint(equalTo: trailingAnchor),
      collectionView.topAnchor.constraint(equalTo: searchBar.bottomAnchor, constant: 4),
      collectionView.bottomAnchor.constraint(equalTo: bottomAnchor),

      emptyStateLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
      emptyStateLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
      emptyStateLabel.centerYAnchor.constraint(equalTo: collectionView.centerYAnchor)
    ])
  }

  private func renderHeader() {
    titleLabel.text = payload.title
    subtitleLabel.text = payload.subtitle
    subtitleLabel.isHidden = payload.subtitle?.isEmpty != false
    searchBar.isHidden = payload.searchEnabled != true
    if payload.searchEnabled != true {
      searchBar.text = nil
    }
  }

  private func configureDataSource() {
    collectionView.register(
      UICollectionViewListCell.self,
      forCellWithReuseIdentifier: cellReuseIdentifier
    )

    dataSource = UICollectionViewDiffableDataSource<String, String>(
      collectionView: collectionView
    ) { [weak self] collectionView, indexPath, itemId in
      guard let self,
            let option = self.filteredOptions.first(where: { $0.id == itemId }) else {
        return nil
      }

      let cell = collectionView.dequeueReusableCell(
        withReuseIdentifier: self.cellReuseIdentifier,
        for: indexPath
      )

      self.configure(cell: cell, with: option)
      return cell
    }
  }

  private func makeLayout() -> UICollectionViewLayout {
    var config = UICollectionLayoutListConfiguration(appearance: .insetGrouped)
    config.backgroundColor = .clear
    return UICollectionViewCompositionalLayout.list(using: config)
  }

  private func configure(cell: UICollectionViewCell, with option: NativeSelectionOption) {
    guard let listCell = cell as? UICollectionViewListCell else {
      return
    }

    var content = (option.subtitle?.isEmpty == false)
      ? UIListContentConfiguration.subtitleCell()
      : UIListContentConfiguration.cell()

    content.text = option.label
    content.secondaryText = option.subtitle
    content.textProperties.color = .label
    content.secondaryTextProperties.color = .secondaryLabel
    listCell.contentConfiguration = content
    listCell.backgroundConfiguration = UIBackgroundConfiguration.listGroupedCell()
    listCell.accessories = selectedIdsSet().contains(option.id) ? [.checkmark()] : []
    listCell.accessibilityIdentifier = "selection-option-\(option.id)"
  }

  private func applyFilter(query: String?, animated: Bool) {
    let normalizedQuery = query?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""

    if normalizedQuery.isEmpty {
      filteredOptions = payload.options
    } else {
      filteredOptions = payload.options.filter { option in
        let candidates = [option.label] + (option.subtitle.map { [$0] } ?? []) + (option.keywords ?? [])
        return candidates.contains { candidate in
          candidate.lowercased().contains(normalizedQuery)
        }
      }
    }

    emptyStateLabel.text = payload.emptyStateText ?? "검색 결과가 없습니다."
    let isEmpty = filteredOptions.isEmpty
    emptyStateLabel.isHidden = !isEmpty
    collectionView.isHidden = isEmpty

    var snapshot = NSDiffableDataSourceSnapshot<String, String>()
    snapshot.appendSections([sectionId])
    snapshot.appendItems(filteredOptions.map(\.id), toSection: sectionId)
    dataSource.apply(snapshot, animatingDifferences: animated)
  }

  private func selectedIdsSet() -> Set<String> {
    Set(payload.selectedIds)
  }

  private func currentScreenId() -> String {
    screenId.isEmpty ? payload.screenId : screenId
  }
}
