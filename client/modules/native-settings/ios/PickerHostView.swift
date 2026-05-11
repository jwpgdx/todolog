import ExpoModulesCore
import Foundation
import UIKit

private struct NativePickerTemporalConfig: Decodable {
  let mode: String
  let minISO: String?
  let maxISO: String?
  let minuteInterval: Int?
  let locale: String?
  let timeZone: String?
  let calendar: String?
  let presentation: String?
}

private struct NativePickerPayload: Decodable {
  let screenId: String
  let pickerId: String
  let title: String
  let subtitle: String?
  let valueISO: String?
  let allDay: Bool?
  let allowsAllDay: Bool?
  let expanded: Bool?
  let activeField: String?
  let temporalConfig: NativePickerTemporalConfig
}

private enum PickerExpansionTarget {
  case startDate
  case startTime
  case endDate
  case endTime
  case singleDate
  case singleTime
  case countdown
}

private enum PickerRowKind {
  case allDay
  case start
  case startEditor
  case end
  case endEditor
  case singleDate
  case singleDateEditor
  case singleTime
  case singleTimeEditor
  case countdown
  case countdownEditor
}

private struct PickerRowDescriptor {
  let id: String
  let kind: PickerRowKind
}

private struct PickerValueButtonModel {
  let title: String
  let accessibilityLabel: String
  let highlighted: Bool
  let action: UIAction
}

private final class PickerHostSectionSupplementaryView: UICollectionReusableView {
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

private final class PickerHostSwitchCell: UICollectionViewListCell {
  private let titleLabel = UILabel()
  private let toggleSwitch = UISwitch()
  private let horizontalStack = UIStackView()

  override init(frame: CGRect) {
    super.init(frame: frame)

    titleLabel.translatesAutoresizingMaskIntoConstraints = false
    titleLabel.font = .preferredFont(forTextStyle: .body)
    titleLabel.textColor = .label

    toggleSwitch.translatesAutoresizingMaskIntoConstraints = false

    horizontalStack.translatesAutoresizingMaskIntoConstraints = false
    horizontalStack.axis = .horizontal
    horizontalStack.alignment = .center
    horizontalStack.spacing = 12

    let spacer = UIView()
    spacer.setContentHuggingPriority(.defaultLow, for: .horizontal)

    horizontalStack.addArrangedSubview(titleLabel)
    horizontalStack.addArrangedSubview(spacer)
    horizontalStack.addArrangedSubview(toggleSwitch)

    contentView.addSubview(horizontalStack)

    NSLayoutConstraint.activate([
      horizontalStack.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
      horizontalStack.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
      horizontalStack.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 12),
      horizontalStack.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -12),
      contentView.heightAnchor.constraint(greaterThanOrEqualToConstant: 52)
    ])
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func apply(title: String, isOn: Bool, identifier: String, target: Any?, action: Selector) {
    titleLabel.text = title
    toggleSwitch.removeTarget(nil, action: nil, for: .valueChanged)
    toggleSwitch.isOn = isOn
    toggleSwitch.accessibilityLabel = title
    toggleSwitch.accessibilityIdentifier = identifier
    toggleSwitch.addTarget(target, action: action, for: .valueChanged)
    backgroundConfiguration = UIBackgroundConfiguration.listGroupedCell()
  }
}

private final class PickerHostValueCell: UICollectionViewListCell {
  private let titleLabel = UILabel()
  private let buttonStack = UIStackView()
  private let horizontalStack = UIStackView()

  override init(frame: CGRect) {
    super.init(frame: frame)

    titleLabel.translatesAutoresizingMaskIntoConstraints = false
    titleLabel.font = .preferredFont(forTextStyle: .body)
    titleLabel.textColor = .label

    buttonStack.translatesAutoresizingMaskIntoConstraints = false
    buttonStack.axis = .horizontal
    buttonStack.alignment = .center
    buttonStack.spacing = 6
    buttonStack.distribution = .fill

    horizontalStack.translatesAutoresizingMaskIntoConstraints = false
    horizontalStack.axis = .horizontal
    horizontalStack.alignment = .center
    horizontalStack.spacing = 12

    let spacer = UIView()
    spacer.setContentHuggingPriority(.defaultLow, for: .horizontal)

    horizontalStack.addArrangedSubview(titleLabel)
    horizontalStack.addArrangedSubview(spacer)
    horizontalStack.addArrangedSubview(buttonStack)

    contentView.addSubview(horizontalStack)

    NSLayoutConstraint.activate([
      horizontalStack.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
      horizontalStack.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
      horizontalStack.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 10),
      horizontalStack.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -10),
      contentView.heightAnchor.constraint(greaterThanOrEqualToConstant: 52)
    ])
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func prepareForReuse() {
    super.prepareForReuse()
    buttonStack.arrangedSubviews.forEach { subview in
      buttonStack.removeArrangedSubview(subview)
      subview.removeFromSuperview()
    }
  }

  func apply(title: String, buttons: [PickerValueButtonModel]) {
    titleLabel.text = title

    buttonStack.arrangedSubviews.forEach { subview in
      buttonStack.removeArrangedSubview(subview)
      subview.removeFromSuperview()
    }

    for model in buttons {
      let button = UIButton(type: .system)
      var config = UIButton.Configuration.gray()
      config.title = model.title
      config.buttonSize = .medium
      config.baseForegroundColor = model.highlighted ? .systemBlue : .label
      button.configuration = config
      button.accessibilityLabel = model.accessibilityLabel
      button.accessibilityHint = model.highlighted ? "편집기를 닫거나 유지합니다" : "편집기를 엽니다"
      button.titleLabel?.adjustsFontSizeToFitWidth = true
      button.titleLabel?.minimumScaleFactor = 0.85
      button.setContentCompressionResistancePriority(.required, for: .horizontal)
      button.setContentHuggingPriority(.required, for: .horizontal)
      button.addAction(model.action, for: .touchUpInside)
      buttonStack.addArrangedSubview(button)
    }

    backgroundConfiguration = UIBackgroundConfiguration.listGroupedCell()
  }
}

private final class PickerHostEditorCell: UICollectionViewCell {
  private let containerView = UIView()

  override init(frame: CGRect) {
    super.init(frame: frame)

    containerView.translatesAutoresizingMaskIntoConstraints = false
    contentView.addSubview(containerView)

    NSLayoutConstraint.activate([
      containerView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 6),
      containerView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -6),
      containerView.topAnchor.constraint(equalTo: contentView.topAnchor),
      containerView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor)
    ])
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func prepareForReuse() {
    super.prepareForReuse()
    containerView.subviews.forEach { $0.removeFromSuperview() }
  }

  func applyHostedView(_ hostedView: UIView) {
    containerView.subviews.forEach { $0.removeFromSuperview() }

    hostedView.removeFromSuperview()
    hostedView.translatesAutoresizingMaskIntoConstraints = false
    containerView.addSubview(hostedView)

    NSLayoutConstraint.activate([
      hostedView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
      hostedView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
      hostedView.topAnchor.constraint(equalTo: containerView.topAnchor),
      hostedView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor)
    ])

    var background = UIBackgroundConfiguration.listGroupedCell()
    background.backgroundColor = .secondarySystemGroupedBackground
    background.cornerRadius = 0
    self.backgroundConfiguration = background
  }
}

final class NativePickerHostView: ExpoView, UICollectionViewDelegate {
  let onError = EventDispatcher()

  private let sectionId = "picker-host-section"
  private let switchCellReuseIdentifier = "NativePickerHostSwitchCell"
  private let valueCellReuseIdentifier = "NativePickerHostValueCell"
  private let editorCellReuseIdentifier = "NativePickerHostEditorCell"
  private let headerReuseIdentifier = "NativePickerHostHeader"
  private let footerReuseIdentifier = "NativePickerHostFooter"

  private var screenId = "picker-host"
  private var payload = NativePickerPayload(
    screenId: "picker-host",
    pickerId: "picker",
    title: "",
    subtitle: nil,
    valueISO: nil,
    allDay: nil,
    allowsAllDay: nil,
    expanded: true,
    activeField: "date",
    temporalConfig: NativePickerTemporalConfig(
      mode: "date",
      minISO: nil,
      maxISO: nil,
      minuteInterval: nil,
      locale: nil,
      timeZone: nil,
      calendar: nil,
      presentation: nil
    )
  )

  private var startDate = Date()
  private var endDate = Date().addingTimeInterval(60 * 60)
  private var countdownDuration: TimeInterval = 15 * 60
  private var isAllDay = false
  private var isExpanded = true
  private var expansionTarget: PickerExpansionTarget = .singleDate
  private var dataSource: UICollectionViewDiffableDataSource<String, String>!

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

  private lazy var inlineDatePicker: UIDatePicker = {
    let picker = UIDatePicker(frame: .zero)
    picker.translatesAutoresizingMaskIntoConstraints = false
    picker.datePickerMode = .date
    picker.preferredDatePickerStyle = .inline
    picker.addTarget(self, action: #selector(handleInlineDateChanged(_:)), for: .valueChanged)
    return picker
  }()

  private lazy var wheelTimePicker: UIDatePicker = {
    let picker = UIDatePicker(frame: .zero)
    picker.translatesAutoresizingMaskIntoConstraints = false
    picker.datePickerMode = .time
    picker.preferredDatePickerStyle = .wheels
    picker.addTarget(self, action: #selector(handleWheelTimeChanged(_:)), for: .valueChanged)
    return picker
  }()

  private lazy var countdownPicker: UIDatePicker = {
    let picker = UIDatePicker(frame: .zero)
    picker.translatesAutoresizingMaskIntoConstraints = false
    picker.datePickerMode = .countDownTimer
    picker.preferredDatePickerStyle = .wheels
    picker.addTarget(self, action: #selector(handleCountdownChanged(_:)), for: .valueChanged)
    return picker
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
      PickerHostSwitchCell.self,
      forCellWithReuseIdentifier: switchCellReuseIdentifier
    )
    collectionView.register(
      PickerHostValueCell.self,
      forCellWithReuseIdentifier: valueCellReuseIdentifier
    )
    collectionView.register(
      PickerHostEditorCell.self,
      forCellWithReuseIdentifier: editorCellReuseIdentifier
    )
    collectionView.register(
      PickerHostSectionSupplementaryView.self,
      forSupplementaryViewOfKind: UICollectionView.elementKindSectionHeader,
      withReuseIdentifier: headerReuseIdentifier
    )
    collectionView.register(
      PickerHostSectionSupplementaryView.self,
      forSupplementaryViewOfKind: UICollectionView.elementKindSectionFooter,
      withReuseIdentifier: footerReuseIdentifier
    )

    configureDataSource()
    render()
  }

  func updateScreenId(_ nextScreenId: String?) {
    screenId = nextScreenId ?? "picker-host"
  }

  func updatePayloadJson(_ payloadJson: String) {
    guard let data = payloadJson.data(using: .utf8) else {
      onError([
        "code": "picker_host_invalid_json",
        "message": "Failed to encode payloadJson as UTF-8"
      ])
      return
    }

    do {
      payload = try JSONDecoder().decode(NativePickerPayload.self, from: data)
      if screenId.isEmpty {
        screenId = payload.screenId
      }
      render()
    } catch {
      onError([
        "code": "picker_host_decode_failed",
        "message": String(describing: error)
      ])
    }
  }

  func collectionView(_ collectionView: UICollectionView, shouldHighlightItemAt indexPath: IndexPath) -> Bool {
    false
  }

  func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {}

  private func configureDataSource() {
    dataSource = UICollectionViewDiffableDataSource<String, String>(
      collectionView: collectionView
    ) { [weak self] collectionView, indexPath, itemId in
      guard let self, let row = self.rowDescriptor(for: itemId) else {
        return nil
      }

      switch row.kind {
      case .allDay:
        guard let cell = collectionView.dequeueReusableCell(
          withReuseIdentifier: self.switchCellReuseIdentifier,
          for: indexPath
        ) as? PickerHostSwitchCell else {
          return nil
        }

        cell.apply(
          title: "하루 종일",
          isOn: self.isAllDay,
          identifier: "picker-toggle-all-day",
          target: self,
          action: #selector(self.handleAllDayChanged(_:))
        )
        cell.accessibilityIdentifier = "picker-row-all-day"
        return cell

      case .start, .end, .singleDate, .singleTime, .countdown:
        guard let cell = collectionView.dequeueReusableCell(
          withReuseIdentifier: self.valueCellReuseIdentifier,
          for: indexPath
        ) as? PickerHostValueCell else {
          return nil
        }

        self.configureValueCell(cell, for: row)
        return cell

      case .startEditor, .endEditor, .singleDateEditor, .singleTimeEditor, .countdownEditor:
        guard let cell = collectionView.dequeueReusableCell(
          withReuseIdentifier: self.editorCellReuseIdentifier,
          for: indexPath
        ) as? PickerHostEditorCell else {
          return nil
        }

        switch row.kind {
        case .startEditor, .endEditor:
          switch self.expansionTarget {
          case .startTime, .endTime:
            cell.applyHostedView(self.wheelTimePicker)
          default:
            cell.applyHostedView(self.inlineDatePicker)
          }
        case .singleDateEditor:
          cell.applyHostedView(self.inlineDatePicker)
        case .singleTimeEditor:
          cell.applyHostedView(self.wheelTimePicker)
        case .countdownEditor:
          cell.applyHostedView(self.countdownPicker)
        default:
          break
        }

        cell.accessibilityIdentifier = "picker-editor-\(itemId)"
        return cell
      }
    }

    dataSource.supplementaryViewProvider = { [weak self] collectionView, kind, indexPath in
      guard let self else {
        return nil
      }

      if kind == UICollectionView.elementKindSectionHeader {
        guard let view = collectionView.dequeueReusableSupplementaryView(
          ofKind: kind,
          withReuseIdentifier: self.headerReuseIdentifier,
          for: indexPath
        ) as? PickerHostSectionSupplementaryView else {
          return nil
        }

        view.applyHeader(text: self.payload.title)
        return view
      }

      if kind == UICollectionView.elementKindSectionFooter {
        guard let view = collectionView.dequeueReusableSupplementaryView(
          ofKind: kind,
          withReuseIdentifier: self.footerReuseIdentifier,
          for: indexPath
        ) as? PickerHostSectionSupplementaryView else {
          return nil
        }

        view.applyFooter(text: self.payload.subtitle)
        return view
      }

      return nil
    }
  }

  private func configureValueCell(_ cell: PickerHostValueCell, for row: PickerRowDescriptor) {
    switch row.kind {
    case .start:
      cell.apply(title: "시작", buttons: startRowButtons())
      cell.accessibilityIdentifier = "picker-row-start"

    case .end:
      cell.apply(title: "종료", buttons: endRowButtons())
      cell.accessibilityIdentifier = "picker-row-end"

    case .singleDate:
      cell.apply(
        title: payload.title.isEmpty ? "날짜" : payload.title,
        buttons: [
          makeButtonModel(
            title: formattedDateText(startDate),
            accessibilityLabel: "날짜 값",
            highlighted: isExpanded && expansionTarget == .singleDate,
            target: .singleDate
          )
        ]
      )
      cell.accessibilityIdentifier = "picker-row-single-date"

    case .singleTime:
      cell.apply(
        title: payload.title.isEmpty ? "시간" : payload.title,
        buttons: [
          makeButtonModel(
            title: formattedTimeText(startDate),
            accessibilityLabel: "시간 값",
            highlighted: isExpanded && expansionTarget == .singleTime,
            target: .singleTime
          )
        ]
      )
      cell.accessibilityIdentifier = "picker-row-single-time"

    case .countdown:
      cell.apply(
        title: payload.title.isEmpty ? "카운트다운" : payload.title,
        buttons: [
          makeButtonModel(
            title: formatCountdownDuration(countdownDuration),
            accessibilityLabel: "카운트다운 값",
            highlighted: isExpanded && expansionTarget == .countdown,
            target: .countdown
          )
        ]
      )
      cell.accessibilityIdentifier = "picker-row-countdown"

    default:
      break
    }
  }

  private func startRowButtons() -> [PickerValueButtonModel] {
    var models = [
      makeButtonModel(
        title: formattedDateText(startDate),
        accessibilityLabel: "시작 날짜",
        highlighted: isExpanded && expansionTarget == .startDate,
        target: .startDate
      )
    ]

    if !isAllDay {
      models.append(
        makeButtonModel(
          title: formattedTimeText(startDate),
          accessibilityLabel: "시작 시간",
          highlighted: isExpanded && expansionTarget == .startTime,
          target: .startTime
        )
      )
    }

    return models
  }

  private func endRowButtons() -> [PickerValueButtonModel] {
    var models = [
      makeButtonModel(
        title: formattedDateText(endDate),
        accessibilityLabel: "종료 날짜",
        highlighted: isExpanded && expansionTarget == .endDate,
        target: .endDate
      )
    ]

    if !isAllDay {
      models.append(
        makeButtonModel(
          title: formattedTimeText(endDate),
          accessibilityLabel: "종료 시간",
          highlighted: isExpanded && expansionTarget == .endTime,
          target: .endTime
        )
      )
    }

    return models
  }

  private func makeButtonModel(
    title: String,
    accessibilityLabel: String,
    highlighted: Bool,
    target: PickerExpansionTarget
  ) -> PickerValueButtonModel {
    PickerValueButtonModel(
      title: title,
      accessibilityLabel: accessibilityLabel,
      highlighted: highlighted,
      action: UIAction { [weak self] _ in
        self?.openEditor(target: target)
      }
    )
  }

  private func makeLayout() -> UICollectionViewLayout {
    var config = UICollectionLayoutListConfiguration(appearance: .insetGrouped)
    config.headerMode = .supplementary
    config.footerMode = .supplementary
    config.backgroundColor = .clear
    return UICollectionViewCompositionalLayout.list(using: config)
  }

  private func render() {
    applyPayloadState()
    syncPickersFromState()
    applySnapshot(animatingDifferences: false)
  }

  private func applySnapshot(animatingDifferences: Bool) {
    syncPickersFromState()

    var snapshot = NSDiffableDataSourceSnapshot<String, String>()
    snapshot.appendSections([sectionId])
    let itemIds = rows().map(\.id)
    snapshot.appendItems(itemIds, toSection: sectionId)
    snapshot.reloadItems(itemIds)
    dataSource.apply(snapshot, animatingDifferences: animatingDifferences)
    collectionView.collectionViewLayout.invalidateLayout()
    collectionView.layoutIfNeeded()
  }

  private func rows() -> [PickerRowDescriptor] {
    var descriptors: [PickerRowDescriptor] = []

    switch payload.temporalConfig.mode {
    case "dateTime":
      if allowsAllDayRow {
        descriptors.append(PickerRowDescriptor(id: "all-day", kind: .allDay))
      }

      descriptors.append(PickerRowDescriptor(id: "start", kind: .start))
      if isExpanded && isStartEditorTarget {
        descriptors.append(PickerRowDescriptor(id: "start-editor", kind: .startEditor))
      }

      descriptors.append(PickerRowDescriptor(id: "end", kind: .end))
      if isExpanded && isEndEditorTarget {
        descriptors.append(PickerRowDescriptor(id: "end-editor", kind: .endEditor))
      }

    case "date":
      descriptors.append(PickerRowDescriptor(id: "single-date", kind: .singleDate))
      if isExpanded {
        descriptors.append(PickerRowDescriptor(id: "single-date-editor", kind: .singleDateEditor))
      }

    case "time":
      descriptors.append(PickerRowDescriptor(id: "single-time", kind: .singleTime))
      if isExpanded {
        descriptors.append(PickerRowDescriptor(id: "single-time-editor", kind: .singleTimeEditor))
      }

    case "countDownTimer":
      descriptors.append(PickerRowDescriptor(id: "countdown", kind: .countdown))
      if isExpanded {
        descriptors.append(PickerRowDescriptor(id: "countdown-editor", kind: .countdownEditor))
      }

    default:
      descriptors.append(PickerRowDescriptor(id: "single-date", kind: .singleDate))
      if isExpanded {
        descriptors.append(PickerRowDescriptor(id: "single-date-editor", kind: .singleDateEditor))
      }
    }

    return descriptors
  }

  private func rowDescriptor(for itemId: String) -> PickerRowDescriptor? {
    rows().first { $0.id == itemId }
  }

  private var allowsAllDayRow: Bool {
    payload.allowsAllDay == true && payload.temporalConfig.mode == "dateTime"
  }

  private var isStartEditorTarget: Bool {
    switch expansionTarget {
    case .startDate, .startTime:
      return true
    default:
      return false
    }
  }

  private var isEndEditorTarget: Bool {
    switch expansionTarget {
    case .endDate, .endTime:
      return true
    default:
      return false
    }
  }

  private var editorReferenceDate: Date {
    switch expansionTarget {
    case .startDate, .startTime, .singleDate, .singleTime:
      return startDate
    case .endDate, .endTime:
      return endDate
    case .countdown:
      return startDate
    }
  }

  private func openEditor(target: PickerExpansionTarget) {
    if isExpanded && expansionTarget == target {
      isExpanded = false
    } else {
      expansionTarget = target
      isExpanded = true
    }

    applySnapshot(animatingDifferences: false)
  }

  @objc private func handleAllDayChanged(_ sender: UISwitch) {
    isAllDay = sender.isOn

    if isAllDay {
      switch expansionTarget {
      case .startTime:
        expansionTarget = .startDate
      case .endTime:
        expansionTarget = .endDate
      default:
        break
      }
    }

    normalizeEndDateIfNeeded()
    applySnapshot(animatingDifferences: false)
  }

  @objc private func handleInlineDateChanged(_ sender: UIDatePicker) {
    switch expansionTarget {
    case .startDate, .singleDate:
      startDate = mergedDateKeepingTime(base: startDate, nextDate: sender.date)
      normalizeEndDateIfNeeded()
    case .endDate:
      endDate = mergedDateKeepingTime(base: endDate, nextDate: sender.date)
      normalizeEndDateIfNeeded()
    default:
      return
    }

    applySnapshot(animatingDifferences: false)
  }

  @objc private func handleWheelTimeChanged(_ sender: UIDatePicker) {
    switch expansionTarget {
    case .startTime, .singleTime:
      startDate = mergedTimeKeepingDate(base: startDate, nextTime: sender.date)
      normalizeEndDateIfNeeded()
    case .endTime:
      endDate = mergedTimeKeepingDate(base: endDate, nextTime: sender.date)
      normalizeEndDateIfNeeded()
    default:
      return
    }

    applySnapshot(animatingDifferences: false)
  }

  @objc private func handleCountdownChanged(_ sender: UIDatePicker) {
    countdownDuration = sender.countDownDuration
    applySnapshot(animatingDifferences: false)
  }

  private func applyPayloadState() {
    let parsedDate = parseDate(from: payload.valueISO) ?? Date()
    startDate = parsedDate
    endDate = parsedDate.addingTimeInterval(60 * 60)
    countdownDuration = parseCountdownDuration(from: payload.valueISO) ?? (15 * 60)
    isAllDay = payload.allDay ?? false
    isExpanded = payload.expanded ?? true

    switch payload.temporalConfig.mode {
    case "dateTime":
      if payload.activeField == "time" && !isAllDay {
        expansionTarget = .startTime
      } else {
        expansionTarget = .startDate
      }
    case "time":
      expansionTarget = .singleTime
    case "countDownTimer":
      expansionTarget = .countdown
    default:
      expansionTarget = .singleDate
    }
  }

  private func syncPickersFromState() {
    let locale = resolvedLocale()
    let timeZone = resolvedTimeZone()
    let calendar = resolvedCalendar(locale: locale, timeZone: timeZone)
    let minimumDate = parseDate(from: payload.temporalConfig.minISO)
    let maximumDate = parseDate(from: payload.temporalConfig.maxISO)
    let minuteInterval = resolvedMinuteInterval()

    [inlineDatePicker, wheelTimePicker].forEach { picker in
      picker.locale = locale
      picker.timeZone = timeZone
      picker.calendar = calendar
      picker.minimumDate = minimumDate
      picker.maximumDate = maximumDate
      picker.minuteInterval = minuteInterval
    }

    inlineDatePicker.date = editorReferenceDate
    wheelTimePicker.date = editorReferenceDate
    countdownPicker.countDownDuration = countdownDuration
    countdownPicker.minuteInterval = minuteInterval
  }

  private func normalizeEndDateIfNeeded() {
    if endDate < startDate {
      endDate = startDate.addingTimeInterval(isAllDay ? 0 : 60 * 60)
    }
  }

  private func mergedDateKeepingTime(base: Date, nextDate: Date) -> Date {
    let calendar = resolvedCalendar(locale: resolvedLocale(), timeZone: resolvedTimeZone())
    let currentTime = calendar.dateComponents([.hour, .minute], from: base)
    var nextComponents = calendar.dateComponents([.year, .month, .day], from: nextDate)
    nextComponents.hour = currentTime.hour
    nextComponents.minute = currentTime.minute
    return calendar.date(from: nextComponents) ?? nextDate
  }

  private func mergedTimeKeepingDate(base: Date, nextTime: Date) -> Date {
    let calendar = resolvedCalendar(locale: resolvedLocale(), timeZone: resolvedTimeZone())
    let day = calendar.dateComponents([.year, .month, .day], from: base)
    let time = calendar.dateComponents([.hour, .minute], from: nextTime)

    var merged = DateComponents()
    merged.year = day.year
    merged.month = day.month
    merged.day = day.day
    merged.hour = time.hour
    merged.minute = time.minute

    return calendar.date(from: merged) ?? nextTime
  }

  private func formattedDateText(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.locale = resolvedLocale()
    formatter.timeZone = resolvedTimeZone()
    formatter.calendar = resolvedCalendar(locale: formatter.locale, timeZone: formatter.timeZone)
    formatter.dateFormat = "yyyy.MM.dd"
    return formatter.string(from: date)
  }

  private func formattedTimeText(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = resolvedTimeZone()
    formatter.calendar = resolvedCalendar(locale: resolvedLocale(), timeZone: formatter.timeZone)
    formatter.dateFormat = "HH:mm"
    return formatter.string(from: date)
  }

  private func resolvedLocale() -> Locale {
    if let localeIdentifier = payload.temporalConfig.locale, !localeIdentifier.isEmpty {
      return Locale(identifier: localeIdentifier)
    }
    return .current
  }

  private func resolvedTimeZone() -> TimeZone {
    if let timeZoneIdentifier = payload.temporalConfig.timeZone,
       let timeZone = TimeZone(identifier: timeZoneIdentifier) {
      return timeZone
    }
    return .current
  }

  private func resolvedCalendar(locale: Locale, timeZone: TimeZone) -> Calendar {
    if let rawCalendar = payload.temporalConfig.calendar,
       let identifier = calendarIdentifier(from: rawCalendar) {
      var calendar = Calendar(identifier: identifier)
      calendar.locale = locale
      calendar.timeZone = timeZone
      return calendar
    }

    var calendar = Calendar.current
    calendar.locale = locale
    calendar.timeZone = timeZone
    return calendar
  }

  private func resolvedMinuteInterval() -> Int {
    if let minuteInterval = payload.temporalConfig.minuteInterval,
       (1...30).contains(minuteInterval),
       60 % minuteInterval == 0 {
      return minuteInterval
    }
    return 1
  }

  private func parseDate(from value: String?) -> Date? {
    guard let value, !value.isEmpty else {
      return nil
    }

    let preciseFormatter = ISO8601DateFormatter()
    preciseFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = preciseFormatter.date(from: value) {
      return date
    }

    let internetFormatter = ISO8601DateFormatter()
    internetFormatter.formatOptions = [.withInternetDateTime]
    if let date = internetFormatter.date(from: value) {
      return date
    }

    let fallbackFormatter = DateFormatter()
    fallbackFormatter.locale = Locale(identifier: "en_US_POSIX")
    fallbackFormatter.timeZone = TimeZone(secondsFromGMT: 0)
    fallbackFormatter.dateFormat = "yyyy-MM-dd"
    return fallbackFormatter.date(from: value)
  }

  private func parseCountdownDuration(from value: String?) -> TimeInterval? {
    guard let value, value.hasPrefix("PT") else {
      return nil
    }

    let pattern = #"^PT(?:(\d+)H)?(?:(\d+)M)?$"#
    guard let regex = try? NSRegularExpression(pattern: pattern) else {
      return nil
    }

    let fullRange = NSRange(location: 0, length: value.utf16.count)
    guard let match = regex.firstMatch(in: value, range: fullRange) else {
      return nil
    }

    let hours = integerMatch(in: value, range: match.range(at: 1)) ?? 0
    let minutes = integerMatch(in: value, range: match.range(at: 2)) ?? 0
    return TimeInterval((hours * 3600) + (minutes * 60))
  }

  private func integerMatch(in source: String, range: NSRange) -> Int? {
    guard range.location != NSNotFound,
          let swiftRange = Range(range, in: source) else {
      return nil
    }
    return Int(source[swiftRange])
  }

  private func formatCountdownDuration(_ duration: TimeInterval) -> String {
    let totalMinutes = Int(duration / 60)
    let hours = totalMinutes / 60
    let minutes = totalMinutes % 60

    if hours > 0 {
      return String(format: "%02d:%02d", hours, minutes)
    }
    return String(format: "00:%02d", minutes)
  }

  private func calendarIdentifier(from value: String) -> Calendar.Identifier? {
    switch value {
    case "gregorian":
      return .gregorian
    case "buddhist":
      return .buddhist
    case "japanese":
      return .japanese
    case "islamic":
      return .islamic
    case "hebrew":
      return .hebrew
    case "iso8601":
      return .iso8601
    default:
      return nil
    }
  }
}
