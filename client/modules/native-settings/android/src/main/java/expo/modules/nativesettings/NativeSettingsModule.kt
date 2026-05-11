package expo.modules.nativesettings

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NativeSettingsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NativeSettings")

    View(NativeSettingsListView::class) {
      Prop("screenId") { view: NativeSettingsListView, screenId: String? ->
        view.updateScreenId(screenId)
      }

      Prop("sectionsJson") { view: NativeSettingsListView, sectionsJson: String? ->
        view.updateSectionsJson(sectionsJson ?: "[]")
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

    View(NativeSelectionListView::class) {
      Prop("screenId") { view: NativeSelectionListView, screenId: String? ->
        view.updateScreenId(screenId)
      }

      Prop("payloadJson") { view: NativeSelectionListView, payloadJson: String? ->
        view.updatePayloadJson(payloadJson ?: "{}")
      }

      Events(
        "onPressItem",
        "onSelectionCommit",
        "onError"
      )
    }

    View(NativeCategoryManagerView::class) {
      Prop("screenId") { view: NativeCategoryManagerView, screenId: String? ->
        view.updateScreenId(screenId)
      }

      Prop("sectionsJson") { view: NativeCategoryManagerView, sectionsJson: String? ->
        view.updateSectionsJson(sectionsJson ?: "[]")
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

    View(NativePickerHostView::class) {
      Prop("screenId") { view: NativePickerHostView, screenId: String? ->
        view.updateScreenId(screenId)
      }

      Prop("payloadJson") { view: NativePickerHostView, payloadJson: String? ->
        view.updatePayloadJson(payloadJson ?: "{}")
      }

      Events("onError")
    }
  }
}
