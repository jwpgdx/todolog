package expo.modules.nativesettings

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.widget.TextView
import androidx.core.view.setPadding
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import org.json.JSONArray
import org.json.JSONObject

data class NativeSettingsSectionSummary(
  val sections: Int,
  val items: Int
)

fun summarizeSectionsJson(json: String): NativeSettingsSectionSummary {
  return try {
    val array = JSONArray(json)
    var items = 0
    for (index in 0 until array.length()) {
      val section = array.optJSONObject(index) ?: continue
      items += section.optJSONArray("items")?.length() ?: 0
    }
    NativeSettingsSectionSummary(array.length(), items)
  } catch (_: Throwable) {
    NativeSettingsSectionSummary(0, 0)
  }
}

fun parseObject(json: String): JSONObject? {
  return try {
    JSONObject(json)
  } catch (_: Throwable) {
    null
  }
}

open class NativeSettingsPlaceholderView(
  context: Context,
  appContext: AppContext,
  private val placeholderTitle: String
) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout: Boolean = true

  val onPressItem by EventDispatcher<Map<String, Any>>()
  val onToggleChange by EventDispatcher<Map<String, Any>>()
  val onMenuAction by EventDispatcher<Map<String, Any>>()
  val onNavigate by EventDispatcher<Map<String, Any>>()
  val onSelectionCommit by EventDispatcher<Map<String, Any>>()
  val onExpandChange by EventDispatcher<Map<String, Any>>()
  val onReorderCommit by EventDispatcher<Map<String, Any>>()
  val onSwipeAction by EventDispatcher<Map<String, Any>>()
  val onRequestDelete by EventDispatcher<Map<String, Any>>()
  val onError by EventDispatcher<Map<String, Any>>()

  private val titleView = TextView(context)
  private val bodyView = TextView(context)
  private val noteView = TextView(context)

  init {
    orientation = VERTICAL
    background = GradientDrawable().apply {
      shape = GradientDrawable.RECTANGLE
      cornerRadius = dp(16).toFloat()
      setColor(Color.WHITE)
      setStroke(1, Color.parseColor("#D1D5DB"))
    }
    elevation = dp(1).toFloat()
    setPadding(dp(16))

    titleView.text = placeholderTitle
    titleView.setTextColor(Color.parseColor("#111827"))
    titleView.setTypeface(titleView.typeface, Typeface.BOLD)
    titleView.textSize = 18f

    bodyView.setTextColor(Color.parseColor("#6B7280"))
    bodyView.typeface = Typeface.MONOSPACE
    bodyView.textSize = 13f

    noteView.setTextColor(Color.parseColor("#9CA3AF"))
    noteView.textSize = 12f
    noteView.text =
      "Scaffold placeholder: native view mounted, full renderer is deferred to the next task group."

    addView(titleView)
    addView(bodyView)
    addView(noteView)
  }

  fun applySummary(title: String, lines: List<String>) {
    titleView.text = title
    bodyView.text = lines.joinToString(separator = "\n")
  }

  fun dp(value: Int): Int {
    return (value * resources.displayMetrics.density).toInt()
  }
}
