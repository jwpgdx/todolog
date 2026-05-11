import ExpoModulesCore
import UIKit

private enum TodoFormVisualState: String {
  case collapsed
  case expanded
}

final class NativeTodoFormSessionView: ExpoView, UITextFieldDelegate, UIGestureRecognizerDelegate {
  let onDismiss = EventDispatcher()
  let onStateSettled = EventDispatcher()

  private let backdropButton = UIControl()
  private let keyboardUnderlayView = UIView()
  private let panelView = UIView()
  private let dragHandleZone = UIView()
  private let handleView = UIView()
  private let contentStack = UIStackView()
  private let quickStack = UIStackView()
  private let inputRow = UIStackView()
  private let titleContainer = UIView()
  private let titleField = UITextField()
  private let submitButton = UIButton(type: .system)
  private let actionScrollView = UIScrollView()
  private let actionRow = UIStackView()
  private let categoryButton = UIButton(type: .system)
  private let dateButton = UIButton(type: .system)
  private let repeatButton = UIButton(type: .system)
  private let detailHeaderContainer = UIView()
  private let detailNavigationBar = UINavigationBar()
  private let detailNavigationItem = UINavigationItem(title: "새 할 일")
  private let bodyScrollView = UIScrollView()
  private let bodyPlaceholderLabel = UILabel()

  private var keyboardObservers: [NSObjectProtocol] = []
  private var panelHeightConstraint: NSLayoutConstraint!
  private var panelBottomConstraint: NSLayoutConstraint!
  private var keyboardUnderlayHeightConstraint: NSLayoutConstraint!
  private var currentKeyboardOverlap: CGFloat = 0
  private var currentState: TodoFormVisualState = .collapsed
  private var selectedCategory = "개인"
  private var dragStartHeight: CGFloat = 0
  private var detailPlaceholderText = "Detail content pending in the other Codex session."

  private let categories = ["개인", "업무", "읽기", "장보기"]

  private lazy var quickPanGesture: UIPanGestureRecognizer = {
    let recognizer = UIPanGestureRecognizer(target: self, action: #selector(handleHeaderPan(_:)))
    recognizer.cancelsTouchesInView = false
    recognizer.delegate = self
    return recognizer
  }()

  private lazy var detailPanGesture: UIPanGestureRecognizer = {
    let recognizer = UIPanGestureRecognizer(target: self, action: #selector(handleHeaderPan(_:)))
    recognizer.cancelsTouchesInView = false
    recognizer.delegate = self
    return recognizer
  }()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    backgroundColor = .clear
    configureViewHierarchy()
    applyVisualState(.collapsed, animated: false, force: true)
  }

  deinit {
    unregisterKeyboardObservers()
  }

  func updateDetailPlaceholderText(_ text: String?) {
    detailPlaceholderText = text?.isEmpty == false
      ? text!
      : "Detail content pending in the other Codex session."
    bodyPlaceholderLabel.text = detailPlaceholderText
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()

    if window != nil {
      registerKeyboardObservers()
      DispatchQueue.main.async { [weak self] in
        self?.titleField.becomeFirstResponder()
      }
    } else {
      unregisterKeyboardObservers()
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    updatePanelMetrics()
  }

  override func safeAreaInsetsDidChange() {
    super.safeAreaInsetsDidChange()
    updatePanelMetrics()
  }

  private func configureViewHierarchy() {
    backdropButton.translatesAutoresizingMaskIntoConstraints = false
    backdropButton.backgroundColor = UIColor.black.withAlphaComponent(0.35)
    backdropButton.addTarget(self, action: #selector(handleBackdropTap), for: .touchUpInside)
    addSubview(backdropButton)

    keyboardUnderlayView.translatesAutoresizingMaskIntoConstraints = false
    keyboardUnderlayView.backgroundColor = .systemBackground
    keyboardUnderlayView.alpha = 0
    addSubview(keyboardUnderlayView)

    panelView.translatesAutoresizingMaskIntoConstraints = false
    panelView.backgroundColor = .systemBackground
    panelView.layer.cornerRadius = 28
    panelView.layer.cornerCurve = .continuous
    panelView.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
    panelView.clipsToBounds = true
    addSubview(panelView)

    NSLayoutConstraint.activate([
      backdropButton.leadingAnchor.constraint(equalTo: leadingAnchor),
      backdropButton.trailingAnchor.constraint(equalTo: trailingAnchor),
      backdropButton.topAnchor.constraint(equalTo: topAnchor),
      backdropButton.bottomAnchor.constraint(equalTo: bottomAnchor),

      keyboardUnderlayView.leadingAnchor.constraint(equalTo: leadingAnchor),
      keyboardUnderlayView.trailingAnchor.constraint(equalTo: trailingAnchor),
      keyboardUnderlayView.bottomAnchor.constraint(equalTo: bottomAnchor),

      panelView.leadingAnchor.constraint(equalTo: leadingAnchor),
      panelView.trailingAnchor.constraint(equalTo: trailingAnchor)
    ])

    keyboardUnderlayHeightConstraint = keyboardUnderlayView.heightAnchor.constraint(equalToConstant: 0)
    panelBottomConstraint = panelView.bottomAnchor.constraint(equalTo: bottomAnchor)
    panelHeightConstraint = panelView.heightAnchor.constraint(equalToConstant: collapsedHeight)
    NSLayoutConstraint.activate([
      keyboardUnderlayHeightConstraint,
      panelBottomConstraint,
      panelHeightConstraint
    ])

    configureContentStack()
  }

  private func configureContentStack() {
    contentStack.translatesAutoresizingMaskIntoConstraints = false
    contentStack.axis = .vertical
    contentStack.spacing = 0
    panelView.addSubview(contentStack)

    NSLayoutConstraint.activate([
      contentStack.leadingAnchor.constraint(equalTo: panelView.leadingAnchor),
      contentStack.trailingAnchor.constraint(equalTo: panelView.trailingAnchor),
      contentStack.topAnchor.constraint(equalTo: panelView.topAnchor),
      contentStack.bottomAnchor.constraint(equalTo: panelView.bottomAnchor)
    ])

    configureDragHandleZone()
    configureQuickContent()
    configureDetailShell()

    contentStack.addArrangedSubview(dragHandleZone)
    contentStack.addArrangedSubview(detailHeaderContainer)
    contentStack.addArrangedSubview(quickStack)
    contentStack.addArrangedSubview(bodyScrollView)
  }

  private func configureDragHandleZone() {
    dragHandleZone.translatesAutoresizingMaskIntoConstraints = false
    dragHandleZone.heightAnchor.constraint(equalToConstant: 40).isActive = true
    dragHandleZone.addGestureRecognizer(quickPanGesture)

    handleView.translatesAutoresizingMaskIntoConstraints = false
    handleView.backgroundColor = UIColor.systemGray3
    handleView.layer.cornerRadius = 2.5
    dragHandleZone.addSubview(handleView)

    NSLayoutConstraint.activate([
      handleView.centerXAnchor.constraint(equalTo: dragHandleZone.centerXAnchor),
      handleView.centerYAnchor.constraint(equalTo: dragHandleZone.centerYAnchor),
      handleView.widthAnchor.constraint(equalToConstant: 42),
      handleView.heightAnchor.constraint(equalToConstant: 5)
    ])
  }

  private func configureQuickContent() {
    quickStack.axis = .vertical
    quickStack.spacing = 12
    quickStack.isLayoutMarginsRelativeArrangement = true
    updateQuickLayoutMargins()

    inputRow.axis = .horizontal
    inputRow.spacing = 10
    inputRow.alignment = .center

    titleContainer.translatesAutoresizingMaskIntoConstraints = false
    titleContainer.backgroundColor = UIColor.secondarySystemBackground
    titleContainer.layer.cornerRadius = 14

    titleField.translatesAutoresizingMaskIntoConstraints = false
    titleField.placeholder = "제목"
    titleField.textColor = .label
    titleField.returnKeyType = .done
    titleField.delegate = self
    titleField.addTarget(self, action: #selector(handleTextChanged), for: .editingChanged)
    titleContainer.addSubview(titleField)

    NSLayoutConstraint.activate([
      titleField.leadingAnchor.constraint(equalTo: titleContainer.leadingAnchor, constant: 14),
      titleField.trailingAnchor.constraint(equalTo: titleContainer.trailingAnchor, constant: -14),
      titleField.topAnchor.constraint(equalTo: titleContainer.topAnchor, constant: 12),
      titleField.bottomAnchor.constraint(equalTo: titleContainer.bottomAnchor, constant: -12)
    ])

    submitButton.translatesAutoresizingMaskIntoConstraints = false
    submitButton.widthAnchor.constraint(equalToConstant: 44).isActive = true
    submitButton.heightAnchor.constraint(equalToConstant: 44).isActive = true
    submitButton.layer.cornerRadius = 22
    submitButton.clipsToBounds = true
    submitButton.accessibilityLabel = "저장"
    updateSubmitButton()

    inputRow.addArrangedSubview(titleContainer)
    inputRow.addArrangedSubview(submitButton)

    actionScrollView.translatesAutoresizingMaskIntoConstraints = false
    actionScrollView.showsHorizontalScrollIndicator = false
    actionScrollView.alwaysBounceHorizontal = true
    actionScrollView.clipsToBounds = false
    actionScrollView.heightAnchor.constraint(equalToConstant: 34).isActive = true

    actionRow.axis = .horizontal
    actionRow.spacing = 8
    actionRow.alignment = .fill
    actionRow.translatesAutoresizingMaskIntoConstraints = false
    actionScrollView.addSubview(actionRow)

    NSLayoutConstraint.activate([
      actionRow.leadingAnchor.constraint(equalTo: actionScrollView.contentLayoutGuide.leadingAnchor),
      actionRow.trailingAnchor.constraint(equalTo: actionScrollView.contentLayoutGuide.trailingAnchor),
      actionRow.topAnchor.constraint(equalTo: actionScrollView.contentLayoutGuide.topAnchor),
      actionRow.bottomAnchor.constraint(equalTo: actionScrollView.contentLayoutGuide.bottomAnchor),
      actionRow.heightAnchor.constraint(equalTo: actionScrollView.frameLayoutGuide.heightAnchor)
    ])

    configureCapsuleButton(categoryButton, title: selectedCategory, systemName: "folder")
    configureCapsuleButton(dateButton, title: "오늘", systemName: "calendar")
    configureCapsuleButton(repeatButton, title: "안 함", systemName: "repeat")

    categoryButton.showsMenuAsPrimaryAction = true
    updateCategoryMenu()
    dateButton.addTarget(self, action: #selector(handleExpandTap), for: .touchUpInside)
    repeatButton.addTarget(self, action: #selector(handleExpandTap), for: .touchUpInside)

    actionRow.addArrangedSubview(categoryButton)
    actionRow.addArrangedSubview(dateButton)
    actionRow.addArrangedSubview(repeatButton)

    quickStack.addArrangedSubview(inputRow)
    quickStack.addArrangedSubview(actionScrollView)
  }

  private func configureCapsuleButton(_ button: UIButton, title: String, systemName: String) {
    var configuration = UIButton.Configuration.plain()
    configuration.title = title
    configuration.image = UIImage(systemName: systemName)
    configuration.imagePadding = 6
    configuration.buttonSize = .mini
    configuration.baseForegroundColor = .label
    configuration.background.backgroundColor = UIColor.secondarySystemBackground
    configuration.background.cornerRadius = 16
    button.configuration = configuration
    button.setContentHuggingPriority(.required, for: .horizontal)
    button.setContentCompressionResistancePriority(.required, for: .horizontal)
  }

  private func configureDetailShell() {
    detailHeaderContainer.translatesAutoresizingMaskIntoConstraints = false
    detailHeaderContainer.isHidden = true
    detailHeaderContainer.alpha = 0
    detailHeaderContainer.addGestureRecognizer(detailPanGesture)
    detailHeaderContainer.heightAnchor.constraint(equalToConstant: 52).isActive = true

    detailNavigationBar.translatesAutoresizingMaskIntoConstraints = false
    detailNavigationBar.prefersLargeTitles = false
    detailHeaderContainer.addSubview(detailNavigationBar)

    let closeAction = UIAction { [weak self] _ in
      self?.handleCloseButtonTap()
    }
    detailNavigationItem.leftBarButtonItem = UIBarButtonItem(systemItem: .close, primaryAction: closeAction)
    detailNavigationItem.rightBarButtonItem = UIBarButtonItem(
      title: "완료",
      style: .done,
      target: self,
      action: #selector(handleDoneButtonTap)
    )
    detailNavigationBar.setItems([detailNavigationItem], animated: false)

    NSLayoutConstraint.activate([
      detailNavigationBar.leadingAnchor.constraint(equalTo: detailHeaderContainer.leadingAnchor),
      detailNavigationBar.trailingAnchor.constraint(equalTo: detailHeaderContainer.trailingAnchor),
      detailNavigationBar.topAnchor.constraint(equalTo: detailHeaderContainer.topAnchor),
      detailNavigationBar.bottomAnchor.constraint(equalTo: detailHeaderContainer.bottomAnchor)
    ])

    bodyScrollView.translatesAutoresizingMaskIntoConstraints = false
    bodyScrollView.isHidden = true
    bodyScrollView.alpha = 0

    let bodyContainer = UIView()
    bodyContainer.translatesAutoresizingMaskIntoConstraints = false
    bodyScrollView.addSubview(bodyContainer)

    bodyPlaceholderLabel.translatesAutoresizingMaskIntoConstraints = false
    bodyPlaceholderLabel.text = detailPlaceholderText
    bodyPlaceholderLabel.textColor = .secondaryLabel
    bodyPlaceholderLabel.font = .preferredFont(forTextStyle: .body)
    bodyPlaceholderLabel.textAlignment = .center
    bodyPlaceholderLabel.numberOfLines = 0
    bodyContainer.addSubview(bodyPlaceholderLabel)

    NSLayoutConstraint.activate([
      bodyContainer.leadingAnchor.constraint(equalTo: bodyScrollView.contentLayoutGuide.leadingAnchor),
      bodyContainer.trailingAnchor.constraint(equalTo: bodyScrollView.contentLayoutGuide.trailingAnchor),
      bodyContainer.topAnchor.constraint(equalTo: bodyScrollView.contentLayoutGuide.topAnchor),
      bodyContainer.bottomAnchor.constraint(equalTo: bodyScrollView.contentLayoutGuide.bottomAnchor),
      bodyContainer.widthAnchor.constraint(equalTo: bodyScrollView.frameLayoutGuide.widthAnchor),
      bodyContainer.heightAnchor.constraint(greaterThanOrEqualTo: bodyScrollView.frameLayoutGuide.heightAnchor),

      bodyPlaceholderLabel.leadingAnchor.constraint(equalTo: bodyContainer.leadingAnchor, constant: 24),
      bodyPlaceholderLabel.trailingAnchor.constraint(equalTo: bodyContainer.trailingAnchor, constant: -24),
      bodyPlaceholderLabel.centerYAnchor.constraint(equalTo: bodyContainer.centerYAnchor),
      bodyPlaceholderLabel.topAnchor.constraint(greaterThanOrEqualTo: bodyContainer.topAnchor, constant: 48),
      bodyPlaceholderLabel.bottomAnchor.constraint(lessThanOrEqualTo: bodyContainer.bottomAnchor, constant: -48)
    ])
  }

  private func updatePanelMetrics() {
    guard bounds.height > 0 else {
      return
    }

    panelHeightConstraint.constant = currentState == .expanded ? expandedHeight : collapsedHeight
    updatePanelBottomConstraint()
    updateKeyboardUnderlay()
    updateQuickLayoutMargins()
  }

  private func updatePanelBottomConstraint() {
    panelBottomConstraint.constant = -currentKeyboardOverlap
  }

  private func updateQuickLayoutMargins() {
    let bottomInset = currentKeyboardOverlap > 0 ? 12 : max(16, safeAreaInsets.bottom + 8)
    quickStack.layoutMargins = UIEdgeInsets(top: 6, left: 16, bottom: bottomInset, right: 16)
  }

  private func updateKeyboardUnderlay() {
    keyboardUnderlayHeightConstraint.constant = currentKeyboardOverlap
    keyboardUnderlayView.alpha = currentKeyboardOverlap > 0 ? 1 : 0
  }

  private func applyVisualState(_ state: TodoFormVisualState, animated: Bool, force: Bool = false) {
    let targetHeight = state == .expanded ? expandedHeight : collapsedHeight
    let expanded = state == .expanded

    if currentState == state && !force && panelHeightConstraint.constant == targetHeight {
      updatePanelBottomConstraint()
      return
    }

    if expanded && currentState != .expanded && titleField.isFirstResponder {
      titleField.resignFirstResponder()
    }

    if expanded {
      detailHeaderContainer.isHidden = false
      bodyScrollView.isHidden = false
    } else {
      submitButton.isHidden = false
      actionScrollView.isHidden = false
    }

    currentState = state
    panelHeightConstraint.constant = targetHeight
    updatePanelBottomConstraint()

    let updates = {
      self.detailHeaderContainer.alpha = expanded ? 1 : 0
      self.bodyScrollView.alpha = expanded ? 1 : 0
      self.submitButton.alpha = expanded ? 0 : 1
      self.actionScrollView.alpha = expanded ? 0 : 1
      self.layoutIfNeeded()
    }

    let completion: (Bool) -> Void = { _ in
      self.submitButton.isHidden = expanded
      self.actionScrollView.isHidden = expanded
      if !expanded {
        self.detailHeaderContainer.isHidden = true
        self.bodyScrollView.isHidden = true
      }
      self.onStateSettled([
        "state": state.rawValue
      ])
    }

    if animated {
      UIView.animate(withDuration: 0.24, delay: 0, options: [.curveEaseInOut]) {
        updates()
      } completion: { finished in
        completion(finished)
      }
    } else {
      updates()
      completion(true)
    }
  }

  private func updateCategoryMenu() {
    let actions = categories.map { category in
      UIAction(
        title: category,
        state: category == selectedCategory ? .on : .off
      ) { [weak self] _ in
        guard let self else {
          return
        }
        self.selectedCategory = category
        self.configureCapsuleButton(self.categoryButton, title: category, systemName: "folder")
        self.updateCategoryMenu()
      }
    }

    categoryButton.menu = UIMenu(title: "", options: .displayInline, children: actions)
  }

  private func updateSubmitButton() {
    let enabled = !(titleField.text?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true)
    var configuration = UIButton.Configuration.filled()
    configuration.image = UIImage(systemName: "arrow.up")
    configuration.baseBackgroundColor = enabled ? .systemBlue : .systemGray4
    configuration.baseForegroundColor = .white
    configuration.background.cornerRadius = 22
    submitButton.configuration = configuration
    submitButton.isEnabled = enabled
  }

  @objc
  private func handleBackdropTap() {
    requestDismiss(reason: "backdrop")
  }

  @objc
  private func handleExpandTap() {
    applyVisualState(.expanded, animated: true)
  }

  @objc
  private func handleCloseButtonTap() {
    requestDismiss(reason: "button")
  }

  @objc
  private func handleDoneButtonTap() {
    requestDismiss(reason: "done")
  }

  @objc
  private func handleTextChanged() {
    updateSubmitButton()
  }

  @objc
  private func handleHeaderPan(_ recognizer: UIPanGestureRecognizer) {
    let translation = recognizer.translation(in: self)

    switch recognizer.state {
    case .began:
      dragStartHeight = panelHeightConstraint.constant
    case .changed:
      let nextHeight = clampPanelHeight(dragStartHeight - translation.y)
      panelHeightConstraint.constant = nextHeight
      layoutIfNeeded()
    case .ended, .cancelled, .failed:
      let velocityY = recognizer.velocity(in: self).y
      let currentHeight = panelHeightConstraint.constant

      if currentState == .expanded {
        if translation.y > 120 && currentHeight <= collapsedHeight + 48 {
          requestDismiss(reason: "drag")
        } else {
          applyVisualState(.expanded, animated: true)
        }
        return
      }

      if translation.y > 84 && currentHeight <= collapsedHeight + 24 {
        requestDismiss(reason: "drag")
        return
      }

      let shouldExpand = translation.y < -36 || velocityY < -300 || currentHeight >= collapsedHeight + 44
      applyVisualState(shouldExpand ? .expanded : .collapsed, animated: true)
    default:
      break
    }
  }

  private func clampPanelHeight(_ height: CGFloat) -> CGFloat {
    min(expandedHeight, max(collapsedHeight, height))
  }

  private var collapsedHeight: CGFloat {
    186
  }

  private var expandedHeight: CGFloat {
    let keyboardOffset = currentKeyboardOverlap
    let visibleHeight = max(collapsedHeight, bounds.height - keyboardOffset)
    let desired = max(collapsedHeight + 220, visibleHeight * 0.84)
    let maxHeight = max(collapsedHeight, visibleHeight - safeAreaInsets.top - 12)
    return min(maxHeight, desired)
  }

  private func resetToCollapsedState() {
    currentState = .collapsed
    currentKeyboardOverlap = 0
    panelHeightConstraint.constant = collapsedHeight
    panelBottomConstraint.constant = 0
    updateKeyboardUnderlay()
    updateQuickLayoutMargins()
    submitButton.alpha = 1
    submitButton.isHidden = false
    actionScrollView.alpha = 1
    actionScrollView.isHidden = false
    detailHeaderContainer.alpha = 0
    detailHeaderContainer.isHidden = true
    bodyScrollView.alpha = 0
    bodyScrollView.isHidden = true
    layoutIfNeeded()
  }

  private func requestDismiss(reason: String) {
    titleField.resignFirstResponder()
    resetToCollapsedState()
    onDismiss([
      "reason": reason
    ])
  }

  private func registerKeyboardObservers() {
    guard keyboardObservers.isEmpty else {
      return
    }

    let willChange = NotificationCenter.default.addObserver(
      forName: UIResponder.keyboardWillChangeFrameNotification,
      object: nil,
      queue: .main
    ) { [weak self] notification in
      self?.handleKeyboardNotification(notification)
    }

    let willHide = NotificationCenter.default.addObserver(
      forName: UIResponder.keyboardWillHideNotification,
      object: nil,
      queue: .main
    ) { [weak self] notification in
      self?.handleKeyboardNotification(notification)
    }

    keyboardObservers = [willChange, willHide]
  }

  private func unregisterKeyboardObservers() {
    keyboardObservers.forEach(NotificationCenter.default.removeObserver)
    keyboardObservers.removeAll()
  }

  private func handleKeyboardNotification(_ notification: Notification) {
    guard let userInfo = notification.userInfo,
          let keyboardFrame = userInfo[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else {
      return
    }

    let keyboardFrameInView = convert(keyboardFrame, from: nil)
    currentKeyboardOverlap = max(0, bounds.maxY - keyboardFrameInView.minY)
    updatePanelBottomConstraint()
    updateKeyboardUnderlay()
    updateQuickLayoutMargins()

    let duration = userInfo[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double ?? 0.25
    let curveRaw = userInfo[UIResponder.keyboardAnimationCurveUserInfoKey] as? UInt ?? 7
    let curve = UIView.AnimationOptions(rawValue: curveRaw << 16)

    UIView.animate(withDuration: duration, delay: 0, options: [curve, .beginFromCurrentState]) {
      self.layoutIfNeeded()
    }
  }

  func textFieldShouldReturn(_ textField: UITextField) -> Bool {
    textField.resignFirstResponder()
    return true
  }
}
