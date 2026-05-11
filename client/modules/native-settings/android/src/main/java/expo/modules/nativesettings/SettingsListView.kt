package expo.modules.nativesettings

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.PopupMenu
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.widget.SwitchCompat
import androidx.core.view.setPadding
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import org.json.JSONArray
import org.json.JSONObject

private const val VIEW_TYPE_HEADER = 1
private const val VIEW_TYPE_ROW = 2
private const val VIEW_TYPE_EMBEDDED = 3
private const val VIEW_TYPE_FOOTER = 4

private data class NativeSettingsSelectionOption(
  val id: String,
  val label: String
)

private data class NativeSettingsTemporalConfig(
  val mode: String,
  val presentation: String?,
  val timeZone: String?
)

private data class NativeSettingsItem(
  val id: String,
  val kind: String,
  val title: String?,
  val subtitle: String?,
  val value: String?,
  val destination: String?,
  val selectionScreenId: String?,
  val toggleValue: Boolean,
  val options: List<NativeSettingsSelectionOption>,
  val selectedOptionId: String?,
  val expanded: Boolean,
  val embeddedContentId: String?,
  val contentType: String?,
  val temporalConfig: NativeSettingsTemporalConfig?,
  val confirmStyle: String?,
  val childVisibilityKey: String?,
  val enabled: Boolean,
  val loading: Boolean
)

private data class NativeSettingsSection(
  val id: String,
  val title: String?,
  val footer: String?,
  val items: List<NativeSettingsItem>
)

private sealed class SettingsDisplayEntry(val stableId: String) {
  data class Header(val sectionId: String, val title: String) :
    SettingsDisplayEntry("header:$sectionId")

  data class Row(val sectionId: String, val item: NativeSettingsItem) :
    SettingsDisplayEntry("row:${item.id}")

  data class Embedded(val sectionId: String, val item: NativeSettingsItem) :
    SettingsDisplayEntry("embedded:${item.id}")

  data class Footer(val sectionId: String, val footer: String) :
    SettingsDisplayEntry("footer:$sectionId")
}

class NativeSettingsListView(
  context: Context,
  appContext: AppContext
) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout: Boolean = true

  private val onPressItem by EventDispatcher<Map<String, Any>>()
  private val onToggleChange by EventDispatcher<Map<String, Any>>()
  private val onMenuAction by EventDispatcher<Map<String, Any>>()
  private val onNavigate by EventDispatcher<Map<String, Any>>()
  private val onExpandChange by EventDispatcher<Map<String, Any>>()
  private val onError by EventDispatcher<Map<String, Any>>()

  private var screenId = "settings-list"
  private var sections: List<NativeSettingsSection> = emptyList()
  private var entries: List<SettingsDisplayEntry> = emptyList()

  private val recyclerView = RecyclerView(context)
  private val adapter = SettingsListAdapter()

  init {
    orientation = VERTICAL
    setBackgroundColor(Color.TRANSPARENT)

    recyclerView.layoutManager = LinearLayoutManager(context)
    recyclerView.adapter = adapter
    recyclerView.isNestedScrollingEnabled = false
    recyclerView.overScrollMode = OVER_SCROLL_NEVER
    recyclerView.setBackgroundColor(Color.TRANSPARENT)

    addView(
      recyclerView,
      LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
    )
  }

  fun updateScreenId(nextScreenId: String?) {
    screenId = nextScreenId ?: "settings-list"
  }

  fun updateSectionsJson(sectionsJson: String) {
    sections = parseSections(sectionsJson)
    rebuildEntries()
  }

  private fun rebuildEntries() {
    val nextEntries = mutableListOf<SettingsDisplayEntry>()

    sections.forEach { section ->
      if (!section.title.isNullOrBlank()) {
        nextEntries += SettingsDisplayEntry.Header(section.id, section.title)
      }

      visibleItems(section).forEach { item ->
        nextEntries += if (item.kind == "embeddedContent") {
          SettingsDisplayEntry.Embedded(section.id, item)
        } else {
          SettingsDisplayEntry.Row(section.id, item)
        }
      }

      if (!section.footer.isNullOrBlank()) {
        nextEntries += SettingsDisplayEntry.Footer(section.id, section.footer)
      }
    }

    entries = nextEntries
    adapter.submit(nextEntries)
  }

  private fun visibleItems(section: NativeSettingsSection): List<NativeSettingsItem> {
    val expandedIds = section.items
      .filter { it.kind == "expandableParent" && it.expanded }
      .mapNotNull { it.embeddedContentId }
      .toSet()

    val toggleDrivenIds = section.items
      .filter { it.kind == "toggle" && it.toggleValue }
      .mapNotNull { it.childVisibilityKey }
      .toSet()

    return section.items.filter { item ->
      if (item.kind != "embeddedContent") {
        true
      } else {
        expandedIds.contains(item.id) || toggleDrivenIds.contains(item.id)
      }
    }
  }

  private fun parseSections(json: String): List<NativeSettingsSection> {
    return try {
      val array = JSONArray(json)
      buildList {
        for (index in 0 until array.length()) {
          val section = array.optJSONObject(index) ?: continue
          add(
            NativeSettingsSection(
              id = section.optString("id"),
              title = section.optString("title").takeIf { it.isNotBlank() },
              footer = section.optString("footer").takeIf { it.isNotBlank() },
              items = parseItems(section.optJSONArray("items") ?: JSONArray())
            )
          )
        }
      }
    } catch (error: Throwable) {
      onError(
        mapOf(
          "code" to "settings_list_decode_failed",
          "message" to (error.message ?: "unknown")
        )
      )
      emptyList()
    }
  }

  private fun parseItems(array: JSONArray): List<NativeSettingsItem> {
    return buildList {
      for (index in 0 until array.length()) {
        val item = array.optJSONObject(index) ?: continue
        val options = item.optJSONArray("options") ?: JSONArray()
        val temporalConfig = item.optJSONObject("temporalConfig")

        add(
          NativeSettingsItem(
            id = item.optString("id"),
            kind = item.optString("kind"),
            title = item.optString("title").takeIf { it.isNotBlank() },
            subtitle = item.optString("subtitle").takeIf { it.isNotBlank() },
            value = item.optString("value").takeIf { it.isNotBlank() },
            destination = item.optString("destination").takeIf { it.isNotBlank() },
            selectionScreenId = item.optString("selectionScreenId").takeIf { it.isNotBlank() },
            toggleValue = item.optBoolean("value"),
            options = buildList {
              for (optionIndex in 0 until options.length()) {
                val option = options.optJSONObject(optionIndex) ?: continue
                add(
                  NativeSettingsSelectionOption(
                    id = option.optString("id"),
                    label = option.optString("label")
                  )
                )
              }
            },
            selectedOptionId = item.optString("selectedOptionId").takeIf { it.isNotBlank() },
            expanded = item.optBoolean("expanded"),
            embeddedContentId = item.optString("embeddedContentId").takeIf { it.isNotBlank() },
            contentType = item.optString("contentType").takeIf { it.isNotBlank() },
            temporalConfig = temporalConfig?.let {
              NativeSettingsTemporalConfig(
                mode = it.optString("mode", "date"),
                presentation = it.optString("presentation").takeIf { text -> text.isNotBlank() },
                timeZone = it.optString("timeZone").takeIf { text -> text.isNotBlank() }
              )
            },
            confirmStyle = item.optString("confirmStyle").takeIf { it.isNotBlank() },
            childVisibilityKey = item.optString("childVisibilityKey").takeIf { it.isNotBlank() },
            enabled = if (item.has("enabled")) item.optBoolean("enabled") else true,
            loading = item.optBoolean("loading")
          )
        )
      }
    }
  }

  private fun isItemEnabled(item: NativeSettingsItem): Boolean {
    return item.enabled && !item.loading
  }

  private fun emitPress(item: NativeSettingsItem) {
    onPressItem(
      mapOf(
        "itemId" to item.id,
        "kind" to item.kind
      )
    )
  }

  private fun applyToggleChange(itemId: String, nextValue: Boolean) {
    sections = sections.map { section ->
      section.copy(
        items = section.items.map { item ->
          if (item.id == itemId) item.copy(toggleValue = nextValue) else item
        }
      )
    }
    rebuildEntries()
    onToggleChange(
      mapOf(
        "itemId" to itemId,
        "value" to nextValue
      )
    )
  }

  private fun applyMenuSelection(itemId: String, optionId: String) {
    sections = sections.map { section ->
      section.copy(
        items = section.items.map { item ->
          if (item.id == itemId) {
            val selectedLabel = item.options.firstOrNull { it.id == optionId }?.label
            item.copy(
              selectedOptionId = optionId,
              value = selectedLabel ?: item.value
            )
          } else {
            item
          }
        }
      )
    }
    rebuildEntries()
    onMenuAction(
      mapOf(
        "itemId" to itemId,
        "actionId" to optionId
      )
    )
  }

  private fun applyExpandChange(itemId: String, expanded: Boolean) {
    sections = sections.map { section ->
      section.copy(
        items = section.items.map { item ->
          if (item.id == itemId) item.copy(expanded = expanded) else item
        }
      )
    }
    rebuildEntries()
    onExpandChange(
      mapOf(
        "itemId" to itemId,
        "expanded" to expanded
      )
    )
  }

  private fun handleStandardRowPress(item: NativeSettingsItem) {
    if (!isItemEnabled(item)) {
      return
    }

    when (item.kind) {
      "navigationValue" -> {
        emitPress(item)
        item.destination?.let { destination ->
          onNavigate(mapOf("itemId" to item.id, "destination" to destination))
        }
      }

      "selectionNavigation" -> {
        emitPress(item)
        item.selectionScreenId?.let { destination ->
          onNavigate(mapOf("itemId" to item.id, "destination" to destination))
        }
      }

      "toggle" -> applyToggleChange(item.id, !item.toggleValue)
      "expandableParent" -> applyExpandChange(item.id, !item.expanded)
      "action" -> emitPress(item)
      "destructiveAction" -> showDestructiveConfirmation(item)
    }
  }

  private fun showDestructiveConfirmation(item: NativeSettingsItem) {
    AlertDialog.Builder(context)
      .setTitle(item.title ?: "확인")
      .setMessage("이 작업을 계속할까요?")
      .setNegativeButton("취소", null)
      .setPositiveButton("실행") { _, _ ->
        emitPress(item)
      }
      .show()
  }

  private fun currentMenuLabel(item: NativeSettingsItem): String {
    return item.options.firstOrNull { it.id == item.selectedOptionId }?.label
      ?: item.value
      ?: "선택"
  }

  private fun embeddedContentSummary(item: NativeSettingsItem): String {
    val pieces = mutableListOf<String>()
    item.contentType?.let { pieces += it }
    item.temporalConfig?.mode?.let { pieces += it }
    item.temporalConfig?.presentation?.let { pieces += it }
    item.temporalConfig?.timeZone?.let { pieces += it }
    return pieces.joinToString(" · ")
  }

  private fun isLastRowInSection(position: Int): Boolean {
    val current = entries.getOrNull(position) as? SettingsDisplayEntry.Row ?: return true
    val next = entries.getOrNull(position + 1)
    return when (next) {
      is SettingsDisplayEntry.Row -> next.sectionId != current.sectionId
      is SettingsDisplayEntry.Embedded -> next.sectionId != current.sectionId
      else -> true
    }
  }

  private inner class HeaderViewHolder(val textView: TextView) :
    RecyclerView.ViewHolder(textView)

  private inner class FooterViewHolder(val textView: TextView) :
    RecyclerView.ViewHolder(textView)

  private inner class EmbeddedViewHolder(
    val container: LinearLayout,
    val titleView: TextView,
    val summaryView: TextView
  ) : RecyclerView.ViewHolder(container)

  private inner class StandardRowViewHolder(
    val root: LinearLayout,
    val contentRow: LinearLayout,
    val textColumn: LinearLayout,
    val titleView: TextView,
    val subtitleView: TextView,
    val trailingContainer: LinearLayout,
    val divider: View
  ) : RecyclerView.ViewHolder(root)

  private inner class SettingsListAdapter :
    RecyclerView.Adapter<RecyclerView.ViewHolder>() {
    private var items: List<SettingsDisplayEntry> = emptyList()

    init {
      setHasStableIds(true)
    }

    fun submit(next: List<SettingsDisplayEntry>) {
      items = next
      notifyDataSetChanged()
    }

    override fun getItemCount(): Int = items.size

    override fun getItemId(position: Int): Long = items[position].stableId.hashCode().toLong()

    override fun getItemViewType(position: Int): Int {
      return when (items[position]) {
        is SettingsDisplayEntry.Header -> VIEW_TYPE_HEADER
        is SettingsDisplayEntry.Row -> VIEW_TYPE_ROW
        is SettingsDisplayEntry.Embedded -> VIEW_TYPE_EMBEDDED
        is SettingsDisplayEntry.Footer -> VIEW_TYPE_FOOTER
      }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
      return when (viewType) {
        VIEW_TYPE_HEADER -> HeaderViewHolder(createSectionLabel())
        VIEW_TYPE_FOOTER -> FooterViewHolder(createFooterLabel())
        VIEW_TYPE_EMBEDDED -> createEmbeddedHolder()
        else -> createRowHolder()
      }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
      when (val entry = items[position]) {
        is SettingsDisplayEntry.Header -> {
          (holder as HeaderViewHolder).textView.text = entry.title.uppercase()
        }

        is SettingsDisplayEntry.Footer -> {
          (holder as FooterViewHolder).textView.text = entry.footer
        }

        is SettingsDisplayEntry.Embedded -> {
          val embeddedHolder = holder as EmbeddedViewHolder
          embeddedHolder.titleView.text = "Embedded Content"
          embeddedHolder.summaryView.text = embeddedContentSummary(entry.item)
        }

        is SettingsDisplayEntry.Row -> bindStandardRow(
          holder as StandardRowViewHolder,
          entry.item,
          position
        )
      }
    }
  }

  private fun createSectionLabel(): TextView {
    return TextView(context).apply {
      setTextColor(Color.parseColor("#6B7280"))
      setTypeface(typeface, Typeface.BOLD)
      textSize = 12f
      setPadding(dp(2), dp(14), dp(2), dp(8))
    }
  }

  private fun createFooterLabel(): TextView {
    return TextView(context).apply {
      setTextColor(Color.parseColor("#6B7280"))
      textSize = 12f
      setPadding(dp(2), dp(8), dp(8), dp(14))
    }
  }

  private fun createEmbeddedHolder(): EmbeddedViewHolder {
    val container = LinearLayout(context).apply {
      orientation = VERTICAL
      setPadding(dp(16), dp(14), dp(16), dp(14))
      background = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = dp(14).toFloat()
        setColor(Color.parseColor("#F3F4F6"))
      }
    }

    val titleView = TextView(context).apply {
      setTextColor(Color.parseColor("#111827"))
      setTypeface(typeface, Typeface.BOLD)
      textSize = 15f
    }

    val summaryView = TextView(context).apply {
      setTextColor(Color.parseColor("#6B7280"))
      textSize = 13f
    }

    container.addView(titleView)
    container.addView(summaryView)

    return EmbeddedViewHolder(container, titleView, summaryView)
  }

  private fun createRowHolder(): StandardRowViewHolder {
    val root = LinearLayout(context).apply {
      orientation = VERTICAL
      background = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        setColor(Color.WHITE)
      }
    }

    val contentRow = LinearLayout(context).apply {
      orientation = HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(16), dp(14), dp(16), dp(14))
    }

    val textColumn = LinearLayout(context).apply {
      orientation = VERTICAL
    }

    val titleView = TextView(context).apply {
      setTextColor(Color.parseColor("#111827"))
      setTypeface(typeface, Typeface.BOLD)
      textSize = 16f
    }

    val subtitleView = TextView(context).apply {
      setTextColor(Color.parseColor("#6B7280"))
      textSize = 13f
    }

    textColumn.addView(titleView)
    textColumn.addView(subtitleView)

    val trailingContainer = LinearLayout(context).apply {
      orientation = HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }

    contentRow.addView(
      textColumn,
      LinearLayout.LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f)
    )
    contentRow.addView(trailingContainer)

    val divider = View(context).apply {
      setBackgroundColor(Color.parseColor("#E5E7EB"))
    }

    root.addView(
      contentRow,
      LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
    )
    root.addView(
      divider,
      LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, 1).apply {
        marginStart = dp(16)
      }
    )

    return StandardRowViewHolder(
      root,
      contentRow,
      textColumn,
      titleView,
      subtitleView,
      trailingContainer,
      divider
    )
  }

  private fun bindStandardRow(
    holder: StandardRowViewHolder,
    item: NativeSettingsItem,
    position: Int
  ) {
    holder.titleView.text = item.title ?: item.id
    holder.subtitleView.text = item.subtitle
    holder.subtitleView.visibility =
      if (item.subtitle.isNullOrBlank()) View.GONE else View.VISIBLE
    holder.contentRow.alpha = if (isItemEnabled(item)) 1f else 0.45f
    holder.root.isEnabled = isItemEnabled(item)
    holder.divider.visibility = if (isLastRowInSection(position)) View.GONE else View.VISIBLE
    holder.trailingContainer.removeAllViews()
    holder.root.setOnClickListener(null)

    val titleColor = when (item.kind) {
      "action" -> Color.parseColor("#2563EB")
      "destructiveAction" -> Color.parseColor("#DC2626")
      else -> Color.parseColor("#111827")
    }
    holder.titleView.setTextColor(titleColor)

    when (item.kind) {
      "navigationValue" -> {
        holder.trailingContainer.addView(createTrailingText("${item.value ?: ""} ›".trim()))
        holder.root.setOnClickListener { handleStandardRowPress(item) }
      }

      "staticValue" -> {
        holder.trailingContainer.addView(createTrailingText(item.value ?: "-"))
      }

      "toggle" -> {
        val toggle = SwitchCompat(context).apply {
          isChecked = item.toggleValue
          setOnCheckedChangeListener { _, checked ->
            applyToggleChange(item.id, checked)
          }
        }
        holder.trailingContainer.addView(toggle)
        holder.root.setOnClickListener { handleStandardRowPress(item) }
      }

      "menu" -> {
        val button = createMenuButton(currentMenuLabel(item))
        button.setOnClickListener { anchor ->
          showMenu(anchor, item)
        }
        holder.trailingContainer.addView(button)
      }

      "selectionNavigation" -> {
        holder.trailingContainer.addView(createTrailingText("${item.value ?: ""} ›".trim()))
        holder.root.setOnClickListener { handleStandardRowPress(item) }
      }

      "expandableParent" -> {
        holder.trailingContainer.addView(
          createTrailingText(
            listOfNotNull(item.value?.takeIf { it.isNotBlank() }, if (item.expanded) "⌃" else "⌄")
              .joinToString(" ")
          )
        )
        holder.root.setOnClickListener { handleStandardRowPress(item) }
      }

      "action", "destructiveAction" -> {
        holder.root.setOnClickListener { handleStandardRowPress(item) }
      }
    }
  }

  private fun showMenu(anchor: View, item: NativeSettingsItem) {
    val popupMenu = PopupMenu(context, anchor)
    item.options.forEachIndexed { index, option ->
      popupMenu.menu.add(0, index, index, option.label)
    }
    popupMenu.setOnMenuItemClickListener { menuItem ->
      val option = item.options.getOrNull(menuItem.itemId) ?: return@setOnMenuItemClickListener false
      applyMenuSelection(item.id, option.id)
      true
    }
    popupMenu.show()
  }

  private fun createTrailingText(value: String): TextView {
    return TextView(context).apply {
      text = value
      setTextColor(Color.parseColor("#6B7280"))
      textSize = 14f
    }
  }

  private fun createMenuButton(value: String): TextView {
    return TextView(context).apply {
      text = "$value ▾"
      setTextColor(Color.parseColor("#6B7280"))
      textSize = 14f
      setPadding(dp(8), dp(6), dp(8), dp(6))
      background = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = dp(10).toFloat()
        setColor(Color.parseColor("#F3F4F6"))
      }
    }
  }

  private fun dp(value: Int): Int {
    return (value * resources.displayMetrics.density).toInt()
  }
}
