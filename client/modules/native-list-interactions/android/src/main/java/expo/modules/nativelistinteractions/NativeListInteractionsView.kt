package expo.modules.nativelistinteractions

import android.app.AlertDialog
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.PopupMenu
import android.widget.Switch
import android.widget.TextView
import androidx.recyclerview.widget.ItemTouchHelper
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import org.json.JSONArray

private const val VIEW_TYPE_HEADER = 1
private const val VIEW_TYPE_ROW = 2
private const val VIEW_TYPE_FOOTER = 3

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
  val collapsed: Boolean,
  val hidden: Boolean,
  val reorderable: Boolean,
  val deletable: Boolean,
  val supportsMenu: Boolean,
  val selected: Boolean
)

private sealed class NativeEntry(val stableId: String) {
  data class Header(val sectionId: String, val title: String) :
    NativeEntry("header:$sectionId")

  data class Row(val sectionId: String, val item: NativeItemModel) :
    NativeEntry("row:${item.id}")

  data class Footer(val sectionId: String, val footer: String) :
    NativeEntry("footer:$sectionId")
}

class NativeListInteractionsView(
  context: Context,
  appContext: AppContext
) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout: Boolean = true

  private val recyclerView = RecyclerView(context)
  private val adapter = NativeListAdapter()
  private lateinit var itemTouchHelper: ItemTouchHelper

  private var sections: List<NativeSectionModel> = emptyList()
  private var entries: List<NativeEntry> = emptyList()
  private var dragChanged = false
  private var contentInsetBottomPx = 0

  private val onItemPress by EventDispatcher<Map<String, Any>>()
  private val onMenuAction by EventDispatcher<Map<String, Any>>()
  private val onDelete by EventDispatcher<Map<String, Any>>()
  private val onReorder by EventDispatcher<Map<String, Any>>()
  private val onToggleSwitch by EventDispatcher<Map<String, Any>>()
  @Suppress("unused")
  private val onSectionExpandRequest by EventDispatcher<Map<String, Any>>()

  init {
    orientation = VERTICAL
    setBackgroundColor(Color.TRANSPARENT)

    recyclerView.layoutManager = LinearLayoutManager(context)
    recyclerView.adapter = adapter
    recyclerView.isNestedScrollingEnabled = false
    recyclerView.overScrollMode = OVER_SCROLL_NEVER
    recyclerView.clipToPadding = false
    recyclerView.setBackgroundColor(Color.TRANSPARENT)

    addView(
      recyclerView,
      LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
    )

    itemTouchHelper = ItemTouchHelper(NativeTouchHelperCallback())
    itemTouchHelper.attachToRecyclerView(recyclerView)
  }

  fun updateSectionsJson(sectionsJson: String) {
    sections = parseSections(sectionsJson)
    rebuildEntries()
  }

  fun updateContentInsetBottom(contentInsetBottom: Double) {
    contentInsetBottomPx = dp(contentInsetBottom.toFloat())
    recyclerView.setPadding(0, 0, 0, contentInsetBottomPx)
  }

  private fun rebuildEntries() {
    val nextEntries = mutableListOf<NativeEntry>()

    sections.forEach { section ->
      if (!section.title.isNullOrBlank()) {
        nextEntries += NativeEntry.Header(section.id, section.title)
      }

      section.items
        .filter { item -> !item.hidden }
        .forEach { item ->
          nextEntries += NativeEntry.Row(section.id, item)
        }

      if (!section.footer.isNullOrBlank()) {
        nextEntries += NativeEntry.Footer(section.id, section.footer)
      }
    }

    entries = nextEntries
    adapter.submit(nextEntries)
  }

  private fun parseSections(rawJson: String): List<NativeSectionModel> {
    return try {
      val sectionsArray = JSONArray(rawJson)
      buildList {
        for (sectionIndex in 0 until sectionsArray.length()) {
          val sectionObject = sectionsArray.optJSONObject(sectionIndex) ?: continue
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
    } catch (_: Throwable) {
      emptyList()
    }
  }

  private fun parseItems(itemsArray: JSONArray): List<NativeItemModel> {
    return buildList {
      for (itemIndex in 0 until itemsArray.length()) {
        val itemObject = itemsArray.optJSONObject(itemIndex) ?: continue
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
            collapsed = itemObject.optBoolean("collapsed", false),
            hidden = itemObject.optBoolean("hidden", false),
            reorderable = itemObject.optBoolean("reorderable", false),
            deletable = itemObject.optBoolean("deletable", false),
            supportsMenu = itemObject.optBoolean("supportsMenu", false),
            selected = itemObject.optBoolean("selected", false)
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
        array.optString(index).takeIf { it.isNotBlank() }?.let(::add)
      }
    }
  }

  private fun isItemEnabled(item: NativeItemModel): Boolean {
    return !item.disabled
  }

  private fun canDrag(item: NativeItemModel): Boolean {
    return item.kind == "category" && item.reorderable && isItemEnabled(item)
  }

  private fun canSwipe(item: NativeItemModel): Boolean {
    return item.deletable && isItemEnabled(item)
  }

  private fun sectionAwareOrders(): List<Map<String, Any>> {
    return sections.map { section ->
      mapOf(
        "sectionId" to section.id,
        "orderedItemIds" to section.items.map { item -> item.id }
      )
    }
  }

  private fun reorderWithinSection(
    sectionId: String,
    fromItemId: String,
    toItemId: String
  ): Boolean {
    val sectionIndex = sections.indexOfFirst { it.id == sectionId }
    if (sectionIndex < 0) {
      return false
    }

    val mutableItems = sections[sectionIndex].items.toMutableList()
    val fromIndex = mutableItems.indexOfFirst { it.id == fromItemId }
    val toIndex = mutableItems.indexOfFirst { it.id == toItemId }

    if (fromIndex < 0 || toIndex < 0 || fromIndex == toIndex) {
      return false
    }

    val fromItem = mutableItems[fromIndex]
    val toItem = mutableItems[toIndex]
    if (!canDrag(fromItem) || !canDrag(toItem)) {
      return false
    }

    val moved = mutableItems.removeAt(fromIndex)
    mutableItems.add(toIndex, moved)
    sections = sections.toMutableList().also { mutableSections ->
      mutableSections[sectionIndex] = sections[sectionIndex].copy(items = mutableItems)
    }

    rebuildEntries()
    return true
  }

  private fun handlePress(item: NativeItemModel) {
    if (!isItemEnabled(item)) {
      return
    }

    onItemPress(
      mapOf("itemId" to item.id)
    )
  }

  private fun showMenu(anchor: View, item: NativeItemModel) {
    if (!isItemEnabled(item) || (!item.supportsMenu && !item.deletable)) {
      return
    }

    val popup = PopupMenu(context, anchor)
    val actionIds = mutableListOf<String>()

    item.menuActions.forEachIndexed { index, action ->
      popup.menu.add(0, index, index, labelForAction(action))
      actionIds.add(action)
    }

    if (item.deletable) {
      popup.menu.add(0, actionIds.size, actionIds.size, "삭제")
      actionIds.add("delete")
    }

    popup.setOnMenuItemClickListener { menuItem ->
      val action = actionIds.getOrNull(menuItem.itemId) ?: return@setOnMenuItemClickListener false
      if (action == "delete") {
        onDelete(mapOf("itemId" to item.id))
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

  private fun handleSwipe(entry: NativeEntry.Row, adapterPosition: Int) {
    val item = entry.item
    if (!canSwipe(item)) {
      adapter.notifyItemChanged(adapterPosition)
      return
    }

    adapter.notifyItemChanged(adapterPosition)
    AlertDialog.Builder(context)
      .setTitle(item.title)
      .setMessage("삭제하시겠습니까?")
      .setNegativeButton("취소", null)
      .setPositiveButton("삭제") { _, _ ->
        onDelete(mapOf("itemId" to item.id))
      }
      .show()
  }

  private inner class HeaderViewHolder(val textView: TextView) :
    RecyclerView.ViewHolder(textView)

  private inner class FooterViewHolder(val textView: TextView) :
    RecyclerView.ViewHolder(textView)

  private inner class RowViewHolder(
    val root: LinearLayout,
    val contentRow: LinearLayout,
    val badge: View,
    val textColumn: LinearLayout,
    val titleView: TextView,
    val subtitleView: TextView,
    val trailingContainer: LinearLayout,
    val divider: View
  ) : RecyclerView.ViewHolder(root)

  private inner class NativeListAdapter :
    RecyclerView.Adapter<RecyclerView.ViewHolder>() {
    private var items: List<NativeEntry> = emptyList()

    init {
      setHasStableIds(true)
    }

    fun submit(next: List<NativeEntry>) {
      items = next
      notifyDataSetChanged()
    }

    override fun getItemCount(): Int = items.size

    override fun getItemId(position: Int): Long = items[position].stableId.hashCode().toLong()

    override fun getItemViewType(position: Int): Int {
      return when (items[position]) {
        is NativeEntry.Header -> VIEW_TYPE_HEADER
        is NativeEntry.Row -> VIEW_TYPE_ROW
        is NativeEntry.Footer -> VIEW_TYPE_FOOTER
      }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
      return when (viewType) {
        VIEW_TYPE_HEADER -> HeaderViewHolder(createSectionLabel())
        VIEW_TYPE_FOOTER -> FooterViewHolder(createFooterLabel())
        else -> createRowHolder()
      }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
      when (val entry = items[position]) {
        is NativeEntry.Header -> {
          (holder as HeaderViewHolder).textView.text = entry.title.uppercase()
        }
        is NativeEntry.Footer -> {
          (holder as FooterViewHolder).textView.text = entry.footer
        }
        is NativeEntry.Row -> bindRow(holder as RowViewHolder, entry, position)
      }
    }
  }

  private fun createSectionLabel(): TextView {
    return TextView(context).apply {
      setTextColor(Color.parseColor("#6B7280"))
      setTypeface(typeface, Typeface.BOLD)
      textSize = 12f
      letterSpacing = 0.03f
      setPadding(dp(4), dp(14), dp(4), dp(8))
    }
  }

  private fun createFooterLabel(): TextView {
    return TextView(context).apply {
      setTextColor(Color.parseColor("#6B7280"))
      textSize = 12f
      setPadding(dp(4), dp(8), dp(12), dp(14))
    }
  }

  private fun createRowHolder(): RowViewHolder {
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
      setPadding(dp(16), dp(13), dp(12), dp(13))
    }

    val badge = View(context)

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
      textSize = 12f
    }

    textColumn.addView(titleView)
    textColumn.addView(subtitleView)

    val trailingContainer = LinearLayout(context).apply {
      orientation = HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }

    contentRow.addView(
      badge,
      LinearLayout.LayoutParams(dp(12), dp(12)).apply {
        marginEnd = dp(12)
      }
    )
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
        marginStart = dp(40)
      }
    )

    return RowViewHolder(
      root = root,
      contentRow = contentRow,
      badge = badge,
      textColumn = textColumn,
      titleView = titleView,
      subtitleView = subtitleView,
      trailingContainer = trailingContainer,
      divider = divider
    )
  }

  private fun bindRow(holder: RowViewHolder, entry: NativeEntry.Row, position: Int) {
    val item = entry.item
    holder.titleView.text = item.title
    holder.titleView.setTextColor(
      if (item.destructive) Color.parseColor("#DC2626") else Color.parseColor("#111827")
    )
    holder.subtitleView.text = item.subtitle ?: item.metaText
    holder.subtitleView.visibility = if (holder.subtitleView.text.isNullOrBlank()) View.GONE else View.VISIBLE
    holder.contentRow.alpha = if (isItemEnabled(item)) 1f else 0.45f
    holder.divider.visibility = if (position == entries.lastIndex || isLastInSection(position)) {
      View.GONE
    } else {
      View.VISIBLE
    }

    holder.badge.background = roundedDrawable(
      item.accentColor ?: "#D1D5DB",
      item.accentColor ?: "#D1D5DB",
      999f
    )

    holder.trailingContainer.removeAllViews()
    createTrailingView(item)?.let { trailingView ->
      holder.trailingContainer.addView(trailingView)
    }

    holder.root.setOnClickListener {
      handlePress(item)
    }

    holder.root.setOnLongClickListener {
      if (canDrag(item)) {
        dragChanged = false
        itemTouchHelper.startDrag(holder)
        true
      } else {
        false
      }
    }
  }

  private fun isLastInSection(position: Int): Boolean {
    val current = entries.getOrNull(position) as? NativeEntry.Row ?: return true
    val next = entries.getOrNull(position + 1)
    return when (next) {
      is NativeEntry.Row -> next.sectionId != current.sectionId
      else -> true
    }
  }

  private fun createTrailingView(item: NativeItemModel): View? {
    if (item.kind == "menu") {
      return when (item.variant) {
        "switch" -> Switch(context).apply {
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
        "value-navigation" -> createValueChevron(item.valueText ?: "")
        "navigation" -> createChevron()
        "menu" -> createOverflowButton(item)
        else -> View(context)
      }
    }

    if (item.supportsMenu || item.deletable) {
      return createOverflowButton(item)
    }

    if (item.kind == "sectionHeader") {
      return TextView(context).apply {
        text = if (item.collapsed) "▾" else "▴"
        setTextColor(Color.parseColor("#9CA3AF"))
        setTypeface(typeface, Typeface.BOLD)
        textSize = 12f
        gravity = Gravity.CENTER
      }
    }

    return null
  }

  private fun createOverflowButton(item: NativeItemModel): View {
    return TextView(context).apply {
      text = "⋮"
      setTextColor(Color.parseColor("#6B7280"))
      setTypeface(typeface, Typeface.BOLD)
      textSize = 20f
      gravity = Gravity.CENTER
      minWidth = dp(34)
      minHeight = dp(34)
      setOnClickListener { anchor ->
        showMenu(anchor, item)
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

  private inner class NativeTouchHelperCallback : ItemTouchHelper.Callback() {
    override fun isLongPressDragEnabled(): Boolean = false

    override fun isItemViewSwipeEnabled(): Boolean = true

    override fun getMovementFlags(
      recyclerView: RecyclerView,
      viewHolder: RecyclerView.ViewHolder
    ): Int {
      val entry = entries.getOrNull(viewHolder.bindingAdapterPosition) as? NativeEntry.Row
        ?: return makeMovementFlags(0, 0)

      val dragFlags = if (canDrag(entry.item)) {
        ItemTouchHelper.UP or ItemTouchHelper.DOWN
      } else {
        0
      }

      val swipeFlags = if (canSwipe(entry.item)) {
        ItemTouchHelper.START or ItemTouchHelper.END
      } else {
        0
      }

      return makeMovementFlags(dragFlags, swipeFlags)
    }

    override fun onMove(
      recyclerView: RecyclerView,
      viewHolder: RecyclerView.ViewHolder,
      target: RecyclerView.ViewHolder
    ): Boolean {
      val sourceEntry = entries.getOrNull(viewHolder.bindingAdapterPosition) as? NativeEntry.Row
        ?: return false
      val targetEntry = entries.getOrNull(target.bindingAdapterPosition) as? NativeEntry.Row
        ?: return false

      if (sourceEntry.sectionId != targetEntry.sectionId) {
        return false
      }

      val moved = reorderWithinSection(
        sectionId = sourceEntry.sectionId,
        fromItemId = sourceEntry.item.id,
        toItemId = targetEntry.item.id
      )
      if (moved) {
        dragChanged = true
      }
      return moved
    }

    override fun onSwiped(viewHolder: RecyclerView.ViewHolder, direction: Int) {
      val adapterPosition = viewHolder.bindingAdapterPosition
      val entry = entries.getOrNull(adapterPosition) as? NativeEntry.Row ?: return
      handleSwipe(entry, adapterPosition)
    }

    override fun clearView(recyclerView: RecyclerView, viewHolder: RecyclerView.ViewHolder) {
      super.clearView(recyclerView, viewHolder)

      if (dragChanged) {
        onReorder(
          mapOf(
            "sections" to sectionAwareOrders()
          )
        )
      }
      dragChanged = false
    }
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
      cornerRadius = dp(radiusDp).toFloat()
      setColor(parseColorOrDefault(fillHex, "#D1D5DB"))
      setStroke(1, parseColorOrDefault(strokeHex, "#D1D5DB"))
    }
  }

  private fun parseColorOrDefault(hex: String, fallback: String): Int {
    return try {
      Color.parseColor(hex)
    } catch (_: Throwable) {
      Color.parseColor(fallback)
    }
  }

  private fun dp(value: Int): Int {
    return dp(value.toFloat())
  }

  private fun dp(value: Float): Int {
    return TypedValue.applyDimension(
      TypedValue.COMPLEX_UNIT_DIP,
      value,
      resources.displayMetrics
    ).toInt()
  }
}
