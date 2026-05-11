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
