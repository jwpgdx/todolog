import UIKit

struct NativeSection: Decodable {
  let id: String
  let title: String?
  let footer: String?
  let reorderMode: String?
  let dropOutsideReorderRangeBehavior: String?
  let items: [NativeItem]
}

struct NativeItem: Decodable {
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
  let collapsed: Bool?
  let hidden: Bool?
  let reorderable: Bool?
  let dropTargetable: Bool?
  let deletable: Bool?
  let supportsMenu: Bool?
  let toggleControlId: String?
  let toggleControlSource: String?
  let completed: Bool?
  let selected: Bool?
}

struct NativeListMenuActionDescriptor {
  let title: String
  let actionId: String?
  let destructive: Bool
}

enum IOSCategoryGestureMode: String {
  case system
  case customExperiment = "custom-experiment"
  case customLifted = "custom-lifted"
  case systemCustom = "system-custom"
}

enum CustomCategoryMenuInteractionStyle {
  case tapButtons
  case pressAndSlide
}

struct CustomCategoryGestureSession {
  let sourceIndexPath: IndexPath
  let itemId: String
  let itemKind: String
  let origin: CGPoint
  let reorderable: Bool
  let sourceCellFrame: CGRect
}

struct SystemCategoryMenuDismissSession {
  let itemId: String
  let origin: CGPoint
  let sourceCellFrame: CGRect
}

struct FocusedCategoryMenuSession {
  let sourceIndexPath: IndexPath
  let itemId: String
  let reorderable: Bool
}

struct CustomTodoDragSession {
  let itemId: String
  let sourceSectionId: String
  let touchOffset: CGPoint
}

struct CustomTodoDropTarget {
  let sectionId: String
  let insertionIndex: Int
  let collapsed: Bool
}

struct CustomTodoVisibleTodoEntry {
  let itemId: String
  let absoluteIndex: Int
  let frame: CGRect
}

struct CustomTodoSectionLayout {
  let sectionId: String
  let sectionIndex: Int
  let collapsed: Bool
  let dropFrame: CGRect
  let headerFrame: CGRect?
  let todoEntries: [CustomTodoVisibleTodoEntry]
}

struct CustomSectionHeaderDragSession {
  let itemId: String
  let sectionId: String
  let wasInitiallyCollapsed: Bool
  let touchOffset: CGPoint
}

struct CustomSectionHeaderDropTarget {
  let insertionSectionIndex: Int
}

struct CustomSectionHeaderLayout {
  let sectionId: String
  let sectionIndex: Int
  let reorderable: Bool
  let frame: CGRect
}

struct CategoryPreviewCornerStyle {
  let radius: CGFloat
  let maskedCorners: CACornerMask
}

enum NativeListPreviewStylePhase {
  case normal
  case menuPreviewInitial
  case menuPreviewLifted
  case dragPreview
}

struct NativeListPreviewShadowStyle {
  let opacity: Float
  let radius: CGFloat
  let offset: CGSize
}

struct NativeListPreviewStyle {
  let cornerStyle: CategoryPreviewCornerStyle
  let shadow: NativeListPreviewShadowStyle
  let scale: CGFloat
  let translationY: CGFloat
}
