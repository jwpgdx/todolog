import ExpoModulesCore

public final class NativeSettingsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeSettings")

    View(NativeSettingsListView.self) {
      ViewName("NativeSettingsListView")

      Prop("screenId") { (view: NativeSettingsListView, screenId: String?) in
        view.updateScreenId(screenId)
      }

      Prop("sectionsJson") { (view: NativeSettingsListView, sectionsJson: String?) in
        view.updateSectionsJson(sectionsJson ?? "[]")
      }

      Events(
        "onPressItem",
        "onToggleChange",
        "onMenuAction",
        "onNavigate",
        "onExpandChange",
        "onError"
      )
    }

    View(NativeSelectionListView.self) {
      ViewName("NativeSelectionListView")

      Prop("screenId") { (view: NativeSelectionListView, screenId: String?) in
        view.updateScreenId(screenId)
      }

      Prop("payloadJson") { (view: NativeSelectionListView, payloadJson: String?) in
        view.updatePayloadJson(payloadJson ?? "{}")
      }

      Events(
        "onPressItem",
        "onSelectionCommit",
        "onError"
      )
    }

    View(NativeCategoryManagerView.self) {
      ViewName("NativeCategoryManagerView")

      Prop("screenId") { (view: NativeCategoryManagerView, screenId: String?) in
        view.updateScreenId(screenId)
      }

      Prop("sectionsJson") { (view: NativeCategoryManagerView, sectionsJson: String?) in
        view.updateSectionsJson(sectionsJson ?? "[]")
      }

      Events(
        "onPressItem",
        "onMenuAction",
        "onReorderCommit",
        "onSwipeAction",
        "onRequestDelete",
        "onError"
      )
    }

    View(NativePickerHostView.self) {
      ViewName("NativePickerHostView")

      Prop("screenId") { (view: NativePickerHostView, screenId: String?) in
        view.updateScreenId(screenId)
      }

      Prop("payloadJson") { (view: NativePickerHostView, payloadJson: String?) in
        view.updatePayloadJson(payloadJson ?? "{}")
      }

      Events("onError")
    }
  }
}
