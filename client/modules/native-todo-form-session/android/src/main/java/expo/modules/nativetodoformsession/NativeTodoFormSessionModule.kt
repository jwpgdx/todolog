package expo.modules.nativetodoformsession

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NativeTodoFormSessionModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NativeTodoFormSession")

    View(NativeTodoFormSessionView::class) {
      Prop("detailPlaceholderText") { view: NativeTodoFormSessionView, text: String? ->
        view.updateDetailPlaceholderText(text)
      }

      Events(
        "onDismiss",
        "onStateSettled"
      )
    }
  }
}
