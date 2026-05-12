import UIKit

final class LightweightCategoryPreviewView: UIView {
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

extension NativeListInteractionsView {
  func makeLightweightCategoryPreviewView(
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

  func categoryPreviewCornerStyle(
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

  func applyCategoryPreviewCornerStyle(
    _ style: CategoryPreviewCornerStyle,
    to view: UIView
  ) {
    view.layer.cornerRadius = style.radius
    view.layer.maskedCorners = style.maskedCorners
  }

  func makePreviewShadowPath(
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

  func rectCorners(from maskedCorners: CACornerMask) -> UIRectCorner {
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

  func resolvedDefaultCategorySurfaceColor() -> UIColor {
    let baseColor = UIBackgroundConfiguration.listGroupedCell().backgroundColor
      ?? UIColor.secondarySystemGroupedBackground
    return baseColor.resolvedColor(with: traitCollection)
  }
}
