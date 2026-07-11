package expo.modules.nativelistinteractions

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NativeListInteractionsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NativeListInteractions")

    View(NativeListInteractionsView::class) {
      Prop("sectionsJson") { view: NativeListInteractionsView, sectionsJson: String? ->
        view.updateSectionsJson(sectionsJson ?: "[]")
      }

      Prop("iosCategoryGestureMode") { _: NativeListInteractionsView, _: String? ->
        // iOS-only compatibility prop.
      }

      Prop("contentInsetBottom") { view: NativeListInteractionsView, contentInsetBottom: Double? ->
        view.updateContentInsetBottom(contentInsetBottom ?: 0.0)
      }

      Events(
        "onItemPress",
        "onMenuAction",
        "onDelete",
        "onReorder",
        "onToggleSwitch",
        "onSectionExpandRequest"
      )
    }
  }
}
