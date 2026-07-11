import ExpoModulesCore
import UIKit

private struct NativeSelectionOption: Decodable {
  let id: String
  let label: String
  let subtitle: String?
  let keywords: [String]?
  let leadingColor: String?
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
  private var titleTopConstraint: NSLayoutConstraint?
  private var subtitleTopToTitleConstraint: NSLayoutConstraint?
  private var subtitleTopToTopConstraint: NSLayoutConstraint?
  private var searchTopToSubtitleConstraint: NSLayoutConstraint?
  private var searchTopToTitleConstraint: NSLayoutConstraint?
  private var searchTopToTopConstraint: NSLayoutConstraint?
  private var collectionTopToSearchConstraint: NSLayoutConstraint?
  private var collectionTopToSubtitleConstraint: NSLayoutConstraint?
  private var collectionTopToTitleConstraint: NSLayoutConstraint?
  private var collectionTopToTopConstraint: NSLayoutConstraint?

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

    titleTopConstraint = titleLabel.topAnchor.constraint(equalTo: topAnchor, constant: 16)
    subtitleTopToTitleConstraint = subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 6)
    subtitleTopToTopConstraint = subtitleLabel.topAnchor.constraint(equalTo: topAnchor, constant: 16)
    searchTopToSubtitleConstraint = searchBar.topAnchor.constraint(equalTo: subtitleLabel.bottomAnchor, constant: 8)
    searchTopToTitleConstraint = searchBar.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 8)
    searchTopToTopConstraint = searchBar.topAnchor.constraint(equalTo: topAnchor, constant: 8)
    collectionTopToSearchConstraint = collectionView.topAnchor.constraint(equalTo: searchBar.bottomAnchor, constant: 4)
    collectionTopToSubtitleConstraint = collectionView.topAnchor.constraint(equalTo: subtitleLabel.bottomAnchor, constant: 12)
    collectionTopToTitleConstraint = collectionView.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 12)
    collectionTopToTopConstraint = collectionView.topAnchor.constraint(equalTo: topAnchor)

    NSLayoutConstraint.activate([
      titleLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
      titleLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),

      subtitleLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
      subtitleLabel.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),

      searchBar.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 10),
      searchBar.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -10),

      collectionView.leadingAnchor.constraint(equalTo: leadingAnchor),
      collectionView.trailingAnchor.constraint(equalTo: trailingAnchor),
      collectionView.bottomAnchor.constraint(equalTo: bottomAnchor),

      emptyStateLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
      emptyStateLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
      emptyStateLabel.centerYAnchor.constraint(equalTo: collectionView.centerYAnchor)
    ])
  }

  private func renderHeader() {
    let hasTitle = !payload.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    let hasSubtitle = payload.subtitle?.isEmpty == false
    let hasSearch = payload.searchEnabled == true

    titleLabel.text = payload.title
    titleLabel.isHidden = !hasTitle
    subtitleLabel.text = payload.subtitle
    subtitleLabel.isHidden = !hasSubtitle
    searchBar.isHidden = !hasSearch
    if !hasSearch {
      searchBar.text = nil
    }

    updateHeaderLayout(hasTitle: hasTitle, hasSubtitle: hasSubtitle, hasSearch: hasSearch)
  }

  private func updateHeaderLayout(hasTitle: Bool, hasSubtitle: Bool, hasSearch: Bool) {
    let dynamicConstraints = [
      titleTopConstraint,
      subtitleTopToTitleConstraint,
      subtitleTopToTopConstraint,
      searchTopToSubtitleConstraint,
      searchTopToTitleConstraint,
      searchTopToTopConstraint,
      collectionTopToSearchConstraint,
      collectionTopToSubtitleConstraint,
      collectionTopToTitleConstraint,
      collectionTopToTopConstraint
    ].compactMap { $0 }

    NSLayoutConstraint.deactivate(dynamicConstraints)

    if hasTitle {
      titleTopConstraint?.isActive = true
    }

    if hasSubtitle {
      if hasTitle {
        subtitleTopToTitleConstraint?.isActive = true
      } else {
        subtitleTopToTopConstraint?.isActive = true
      }
    }

    if hasSearch {
      if hasSubtitle {
        searchTopToSubtitleConstraint?.isActive = true
      } else if hasTitle {
        searchTopToTitleConstraint?.isActive = true
      } else {
        searchTopToTopConstraint?.isActive = true
      }

      collectionTopToSearchConstraint?.isActive = true
    } else if hasSubtitle {
      collectionTopToSubtitleConstraint?.isActive = true
    } else if hasTitle {
      collectionTopToTitleConstraint?.isActive = true
    } else {
      collectionTopToTopConstraint?.isActive = true
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
    if let leadingColor = option.leadingColor,
       let color = UIColor(nativeSettingsHex: leadingColor) {
      content.image = UIImage.nativeSettingsColorDot(color: color)
    } else {
      content.image = nil
    }
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

private extension UIColor {
  convenience init?(nativeSettingsHex: String) {
    let cleaned = nativeSettingsHex.trimmingCharacters(in: .whitespacesAndNewlines)
      .replacingOccurrences(of: "#", with: "")

    guard cleaned.count == 6,
          let value = UInt64(cleaned, radix: 16) else {
      return nil
    }

    let red = CGFloat((value & 0xFF0000) >> 16) / 255.0
    let green = CGFloat((value & 0x00FF00) >> 8) / 255.0
    let blue = CGFloat(value & 0x0000FF) / 255.0
    self.init(red: red, green: green, blue: blue, alpha: 1.0)
  }
}

private extension UIImage {
  static func nativeSettingsColorDot(color: UIColor) -> UIImage {
    let size = CGSize(width: 22, height: 22)
    let format = UIGraphicsImageRendererFormat()
    format.scale = UIScreen.main.scale
    format.opaque = false

    return UIGraphicsImageRenderer(size: size, format: format).image { context in
      let bounds = CGRect(origin: .zero, size: size).insetBy(dx: 1, dy: 1)
      color.setFill()
      UIBezierPath(ovalIn: bounds).fill()

      UIColor.separator.withAlphaComponent(0.45).setStroke()
      let strokePath = UIBezierPath(ovalIn: bounds)
      strokePath.lineWidth = 1
      strokePath.stroke()
    }.withRenderingMode(.alwaysOriginal)
  }
}
