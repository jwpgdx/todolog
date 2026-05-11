import ExpoModulesCore
import UIKit

struct NativeSettingsSectionSummary {
  let sections: Int
  let items: Int
}

func parseJSONObject(from jsonString: String) -> [String: Any]? {
  guard let data = jsonString.data(using: .utf8) else {
    return nil
  }

  guard let object = try? JSONSerialization.jsonObject(with: data) else {
    return nil
  }

  return object as? [String: Any]
}

func summarizeSectionsJson(_ jsonString: String) -> NativeSettingsSectionSummary {
  guard let data = jsonString.data(using: .utf8) else {
    return .init(sections: 0, items: 0)
  }

  guard let array = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
    return .init(sections: 0, items: 0)
  }

  let itemCount = array.reduce(0) { partialResult, section in
    partialResult + ((section["items"] as? [[String: Any]])?.count ?? 0)
  }

  return .init(sections: array.count, items: itemCount)
}

class NativeSettingsPlaceholderView: ExpoView {
  let onPressItem = EventDispatcher()
  let onToggleChange = EventDispatcher()
  let onMenuAction = EventDispatcher()
  let onNavigate = EventDispatcher()
  let onSelectionCommit = EventDispatcher()
  let onExpandChange = EventDispatcher()
  let onReorderCommit = EventDispatcher()
  let onSwipeAction = EventDispatcher()
  let onRequestDelete = EventDispatcher()
  let onError = EventDispatcher()

  private let titleLabel = UILabel()
  private let bodyLabel = UILabel()
  private let noteLabel = UILabel()
  private let placeholderTitle: String

  init(appContext: AppContext? = nil, placeholderTitle: String) {
    self.placeholderTitle = placeholderTitle
    super.init(appContext: appContext)
    configureView()
  }

  required init(appContext: AppContext? = nil) {
    self.placeholderTitle = "NativeSettingsView"
    super.init(appContext: appContext)
    configureView()
  }

  private func configureView() {
    backgroundColor = .clear

    let container = UIStackView(arrangedSubviews: [titleLabel, bodyLabel, noteLabel])
    container.axis = .vertical
    container.spacing = 10
    container.translatesAutoresizingMaskIntoConstraints = false
    container.isLayoutMarginsRelativeArrangement = true
    container.directionalLayoutMargins = .init(top: 16, leading: 16, bottom: 16, trailing: 16)

    let background = UIVisualEffectView(effect: UIBlurEffect(style: .systemThinMaterial))
    background.translatesAutoresizingMaskIntoConstraints = false
    background.layer.cornerRadius = 16
    background.layer.masksToBounds = true

    addSubview(background)
    background.contentView.addSubview(container)

    NSLayoutConstraint.activate([
      background.leadingAnchor.constraint(equalTo: leadingAnchor),
      background.trailingAnchor.constraint(equalTo: trailingAnchor),
      background.topAnchor.constraint(equalTo: topAnchor),
      background.bottomAnchor.constraint(equalTo: bottomAnchor),
      container.leadingAnchor.constraint(equalTo: background.contentView.leadingAnchor),
      container.trailingAnchor.constraint(equalTo: background.contentView.trailingAnchor),
      container.topAnchor.constraint(equalTo: background.contentView.topAnchor),
      container.bottomAnchor.constraint(equalTo: background.contentView.bottomAnchor)
    ])

    titleLabel.font = .systemFont(ofSize: 18, weight: .bold)
    titleLabel.textColor = .label
    titleLabel.text = placeholderTitle

    bodyLabel.font = .monospacedSystemFont(ofSize: 13, weight: .regular)
    bodyLabel.textColor = .secondaryLabel
    bodyLabel.numberOfLines = 0

    noteLabel.font = .systemFont(ofSize: 12, weight: .semibold)
    noteLabel.textColor = .tertiaryLabel
    noteLabel.numberOfLines = 0
    noteLabel.text = "Scaffold placeholder: native view mounted, full renderer is deferred to the next task group."
  }

  func applySummary(title: String, bodyLines: [String]) {
    titleLabel.text = title
    bodyLabel.text = bodyLines.joined(separator: "\n")
  }
}
