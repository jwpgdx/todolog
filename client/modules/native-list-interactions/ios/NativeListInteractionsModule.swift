import ExpoModulesCore

public final class NativeListInteractionsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeListInteractions")

    View(NativeListInteractionsView.self) {
      Prop("sectionsJson") { (view: NativeListInteractionsView, sectionsJson: String?) in
        view.updateSectionsJson(sectionsJson ?? "[]")
      }

      Prop("iosCategoryGestureMode") { (view: NativeListInteractionsView, mode: String?) in
        view.updateIOSCategoryGestureMode(mode)
      }

      Events(
        "onItemPress",
        "onMenuAction",
        "onDelete",
        "onReorder",
        "onToggleSwitch"
      )
    }
  }
}
