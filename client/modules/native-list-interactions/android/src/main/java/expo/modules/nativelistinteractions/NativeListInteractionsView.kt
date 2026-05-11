package expo.modules.nativelistinteractions

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.PopupMenu
import android.widget.Switch
import android.widget.TextView
import androidx.core.view.setPadding
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs

private data class NativeSectionModel(
  val id: String,
  val title: String?,
  val footer: String?,
  val items: List<NativeItemModel>
)

private data class NativeItemModel(
  val id: String,
  val kind: String,
  val variant: String?,
  val title: String,
  val subtitle: String?,
  val destructive: Boolean,
  val disabled: Boolean,
  val valueText: String?,
  val switchValue: Boolean,
  val menuActions: List<String>,
  val accentColor: String?,
  val metaText: String?,
  val reorderable: Boolean,
  val deletable: Boolean,
  val supportsMenu: Boolean
)

class NativeListInteractionsView(
  context: Context,
  appContext: AppContext
) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout: Boolean = true

  private val content = LinearLayout(context)
  private var sections: List<NativeSectionModel> = emptyList()

  private val onItemPress by EventDispatcher<Map<String, Any>>()
  private val onMenuAction by EventDispatcher<Map<String, Any>>()
  private val onDelete by EventDispatcher<Map<String, Any>>()
  private val onReorder by EventDispatcher<Map<String, Any>>()
  private val onToggleSwitch by EventDispatcher<Map<String, Any>>()

  init {
    orientation = VERTICAL
    setBackgroundColor(Color.TRANSPARENT)

    content.orientation = VERTICAL
    addView(
      content,
      LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
    )
  }

  fun updateSectionsJson(sectionsJson: String) {
    sections = parseSections(sectionsJson)
    renderSections()
  }

  private fun renderSections() {
    content.removeAllViews()

    sections.forEach { section ->
      if (!section.title.isNullOrBlank()) {
        content.addView(createSectionLabel(section.title.uppercase()))
      }

      content.addView(createSectionCard(section))

      if (!section.footer.isNullOrBlank()) {
        val footer = createFootnote(section.footer)
        footer.setPadding(dp(4), dp(8), dp(12), 0)
        content.addView(footer)
      }
    }
  }

  private fun createSectionCard(section: NativeSectionModel): View {
    val card = LinearLayout(context).apply {
      orientation = VERTICAL
      background = roundedDrawable("#FFFFFF", "#D1D5DB", 18f)
      elevation = dp(1).toFloat()
    }

    section.items.forEachIndexed { index, item ->
      card.addView(createRow(section, item))
      if (index != section.items.lastIndex) {
        card.addView(
          View(context).apply {
            setBackgroundColor(Color.parseColor("#E5E7EB"))
          },
          LayoutParams(LayoutParams.MATCH_PARENT, 1).apply {
            marginStart = dp(56)
          }
        )
      }
    }

    return card.apply {
      val params = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
      params.topMargin = dp(8)
      layoutParams = params
    }
  }

  private fun createRow(section: NativeSectionModel, item: NativeItemModel): View {
    val row = LinearLayout(context).apply {
      orientation = HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(16), dp(14), dp(16), dp(14))
      isEnabled = !item.disabled
      alpha = if (item.disabled) 0.45f else 1f
    }

    val leadingBadge = TextView(context).apply {
      text = item.title.take(1).uppercase()
      setTextColor(Color.WHITE)
      setTypeface(typeface, Typeface.BOLD)
      gravity = Gravity.CENTER
      textSize = 12f
      background = roundedDrawable(
        if (item.kind == "category") item.accentColor ?: "#9CA3AF" else "#9CA3AF",
        if (item.kind == "category") item.accentColor ?: "#9CA3AF" else "#9CA3AF",
        8f
      )
    }
    row.addView(
      leadingBadge,
      LayoutParams(dp(24), dp(24)).apply {
        marginEnd = dp(14)
      }
    )

    val textColumn = LinearLayout(context).apply {
      orientation = VERTICAL
    }
    val titleView = TextView(context).apply {
      text = item.title
      setTextColor(if (item.destructive) Color.parseColor("#DC2626") else Color.parseColor("#111827"))
      setTypeface(typeface, Typeface.BOLD)
      textSize = 16f
    }
    textColumn.addView(titleView)

    val secondary = item.subtitle ?: item.metaText
    if (!secondary.isNullOrBlank()) {
      textColumn.addView(
        TextView(context).apply {
          text = secondary
          setTextColor(Color.parseColor("#6B7280"))
          textSize = 12f
        }
      )
    }

    row.addView(
      textColumn,
      LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f)
    )

    row.addView(createTrailingView(section, item))

    if (!item.disabled) {
      when {
        item.kind == "menu" && item.variant == "menu" -> {
          row.setOnClickListener {
            onItemPress(
              mapOf("itemId" to item.id)
            )
          }
        }
        else -> {
          row.setOnClickListener {
            onItemPress(
              mapOf("itemId" to item.id)
            )
          }
        }
      }
    }

    if (item.kind == "category" && item.reorderable && !item.disabled) {
      row.setOnLongClickListener {
        val orderedIds = moveIdForward(categoryIds(section), item.id)
        onReorder(
          mapOf("orderedIds" to orderedIds)
        )
        true
      }
    }

    return row
  }

  private fun createTrailingView(section: NativeSectionModel, item: NativeItemModel): View {
    if (item.kind == "menu") {
      when (item.variant) {
        "switch" -> {
          return Switch(context).apply {
            isChecked = item.switchValue
            setOnCheckedChangeListener { _, nextValue ->
              onToggleSwitch(
                mapOf(
                  "itemId" to item.id,
                  "nextValue" to nextValue
                )
              )
            }
          }
        }
        "value-navigation" -> {
          return createValueChevron(item.valueText ?: "")
        }
        "navigation" -> {
          return createChevron()
        }
        "menu" -> {
          return createOverflowButton(item, section)
        }
      }
    }

    if (item.kind == "category") {
      if (item.supportsMenu) {
        return createOverflowButton(item, section)
      }

      return TextView(context).apply {
        text = "길게 눌러 정렬"
        setTextColor(Color.parseColor("#9CA3AF"))
        textSize = 12f
      }
    }

    return View(context)
  }

  private fun createOverflowButton(item: NativeItemModel, section: NativeSectionModel): View {
    return ImageButton(context).apply {
      setImageResource(android.R.drawable.ic_menu_more)
      background = null
      setColorFilter(Color.parseColor("#6B7280"))
      setOnClickListener { anchor ->
        openPopupMenu(anchor, item, section)
      }
    }
  }

  private fun createChevron(): View {
    return TextView(context).apply {
      text = ">"
      setTextColor(Color.parseColor("#9CA3AF"))
      textSize = 15f
      setTypeface(typeface, Typeface.BOLD)
    }
  }

  private fun createValueChevron(valueText: String): View {
    return LinearLayout(context).apply {
      orientation = HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      addView(
        TextView(context).apply {
          text = valueText
          setTextColor(Color.parseColor("#6B7280"))
          textSize = 14f
        }
      )
      addView(
        TextView(context).apply {
          text = " >"
          setTextColor(Color.parseColor("#9CA3AF"))
          textSize = 14f
        }
      )
    }
  }

  private fun openPopupMenu(anchor: View, item: NativeItemModel, section: NativeSectionModel) {
    val popup = PopupMenu(context, anchor)
    val actionIds = mutableListOf<String>()

    item.menuActions.forEachIndexed { index, action ->
      popup.menu.add(0, index, index, labelForAction(action))
      actionIds.add(action)
    }

    if (item.kind == "category" && item.deletable) {
      popup.menu.add(0, actionIds.size, actionIds.size, "삭제")
      actionIds.add("delete")
    }

    popup.setOnMenuItemClickListener { menuItem ->
      val action = actionIds.getOrNull(menuItem.itemId) ?: return@setOnMenuItemClickListener false
      if (action == "delete") {
        onDelete(
          mapOf("itemId" to item.id)
        )
      } else {
        onMenuAction(
          mapOf(
            "itemId" to item.id,
            "action" to action
          )
        )
      }
      true
    }
    popup.show()
  }

  private fun createSectionLabel(text: String): View {
    return TextView(context).apply {
      this.text = text
      setTextColor(Color.parseColor("#6B7280"))
      setTypeface(typeface, Typeface.BOLD)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
      letterSpacing = 0.03f
      setPadding(dp(4), dp(18), dp(4), 0)
    }
  }

  private fun createFootnote(text: String): View {
    return TextView(context).apply {
      this.text = text
      setTextColor(Color.parseColor("#6B7280"))
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
    }
  }

  private fun parseSections(rawJson: String): List<NativeSectionModel> {
    return try {
      val sectionsArray = JSONArray(rawJson)
      buildList {
        for (sectionIndex in 0 until sectionsArray.length()) {
          val sectionObject = sectionsArray.getJSONObject(sectionIndex)
          add(
            NativeSectionModel(
              id = sectionObject.optString("id"),
              title = sectionObject.optString("title").takeIf { it.isNotBlank() },
              footer = sectionObject.optString("footer").takeIf { it.isNotBlank() },
              items = parseItems(sectionObject.optJSONArray("items") ?: JSONArray())
            )
          )
        }
      }
    } catch (error: Throwable) {
      emptyList()
    }
  }

  private fun parseItems(itemsArray: JSONArray): List<NativeItemModel> {
    return buildList {
      for (itemIndex in 0 until itemsArray.length()) {
        val itemObject = itemsArray.getJSONObject(itemIndex)
        add(
          NativeItemModel(
            id = itemObject.optString("id"),
            kind = itemObject.optString("kind"),
            variant = itemObject.optString("variant").takeIf { it.isNotBlank() },
            title = itemObject.optString("title"),
            subtitle = itemObject.optString("subtitle").takeIf { it.isNotBlank() },
            destructive = itemObject.optBoolean("destructive", false),
            disabled = itemObject.optBoolean("disabled", false),
            valueText = itemObject.optString("valueText").takeIf { it.isNotBlank() },
            switchValue = itemObject.optBoolean("switchValue", false),
            menuActions = parseStringArray(itemObject.optJSONArray("menuActions")),
            accentColor = itemObject.optString("accentColor").takeIf { it.isNotBlank() },
            metaText = itemObject.optString("metaText").takeIf { it.isNotBlank() },
            reorderable = itemObject.optBoolean("reorderable", false),
            deletable = itemObject.optBoolean("deletable", false),
            supportsMenu = itemObject.optBoolean("supportsMenu", false)
          )
        )
      }
    }
  }

  private fun parseStringArray(array: JSONArray?): List<String> {
    if (array == null) {
      return emptyList()
    }
    return buildList {
      for (index in 0 until array.length()) {
        add(array.optString(index))
      }
    }
  }

  private fun categoryIds(section: NativeSectionModel): List<String> {
    return section.items.filter { it.kind == "category" }.map { it.id }
  }

  private fun moveIdForward(ids: List<String>, targetId: String): List<String> {
    val index = ids.indexOf(targetId)
    if (index < 0 || ids.size < 2) {
      return ids
    }

    val next = ids.toMutableList()
    val moved = next.removeAt(index)
    val insertIndex = if (index >= next.size) 0 else index + 1
    next.add(insertIndex, moved)
    return next
  }

  private fun labelForAction(action: String): String {
    return when (action) {
      "open" -> "열기"
      "rename" -> "이름 변경"
      "edit" -> "편집"
      "duplicate" -> "복제"
      "archive" -> "보관"
      else -> action
    }
  }

  private fun roundedDrawable(fillHex: String, strokeHex: String, radiusDp: Float): GradientDrawable {
    return GradientDrawable().apply {
      shape = GradientDrawable.RECTANGLE
      cornerRadius = dp(radiusDp.toInt()).toFloat()
      setColor(Color.parseColor(fillHex))
      setStroke(1, Color.parseColor(strokeHex))
    }
  }

  private fun dp(value: Int): Int {
    return TypedValue.applyDimension(
      TypedValue.COMPLEX_UNIT_DIP,
      value.toFloat(),
      resources.displayMetrics
    ).toInt()
  }
}
