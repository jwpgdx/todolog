package expo.modules.nativesettings

import android.app.AlertDialog
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
import androidx.core.view.setPadding
import androidx.recyclerview.widget.ItemTouchHelper
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import org.json.JSONArray

private const val CATEGORY_VIEW_TYPE_HEADER = 1
private const val CATEGORY_VIEW_TYPE_ROW = 2
private const val CATEGORY_VIEW_TYPE_FOOTER = 3

private data class NativeCategorySwipeAction(
  val id: String,
  val title: String,
  val role: String?
)

private data class NativeCategoryMenuAction(
  val id: String,
  val title: String,
  val role: String?
)

private data class NativeCategoryItem(
  val id: String,
  val kind: String,
  val title: String,
  val subtitle: String?,
  val reorderable: Boolean,
  val pinned: Boolean,
  val swipeActions: List<NativeCategorySwipeAction>,
  val menuActions: List<NativeCategoryMenuAction>,
  val enabled: Boolean,
  val loading: Boolean
)

private data class NativeCategorySection(
  val id: String,
  val title: String?,
  val footer: String?,
  val items: List<NativeCategoryItem>
)

private sealed class CategoryEntry(val stableId: String) {
  data class Header(val sectionId: String, val title: String) :
    CategoryEntry("header:$sectionId")

  data class Row(val sectionId: String, val item: NativeCategoryItem) :
    CategoryEntry("row:${item.id}")

  data class Footer(val sectionId: String, val footer: String) :
    CategoryEntry("footer:$sectionId")
}

class NativeCategoryManagerView(
  context: Context,
  appContext: AppContext
) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout: Boolean = true

  private val onPressItem by EventDispatcher<Map<String, Any>>()
  private val onMenuAction by EventDispatcher<Map<String, Any>>()
  private val onReorderCommit by EventDispatcher<Map<String, Any>>()
  private val onSwipeAction by EventDispatcher<Map<String, Any>>()
  private val onRequestDelete by EventDispatcher<Map<String, Any>>()
  private val onError by EventDispatcher<Map<String, Any>>()

  private var screenId = "category-manager"
  private var sections: List<NativeCategorySection> = emptyList()
  private var entries: List<CategoryEntry> = emptyList()
  private var dragChanged = false

  private val recyclerView = RecyclerView(context)
  private val adapter = CategoryManagerAdapter()
  private lateinit var itemTouchHelper: ItemTouchHelper

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

    itemTouchHelper = ItemTouchHelper(CategoryTouchHelperCallback())
    itemTouchHelper.attachToRecyclerView(recyclerView)
  }

  fun updateScreenId(nextScreenId: String?) {
    screenId = nextScreenId ?: "category-manager"
  }

  fun updateSectionsJson(sectionsJson: String) {
    sections = parseSections(sectionsJson)
    rebuildEntries()
  }

  private fun parseSections(json: String): List<NativeCategorySection> {
    return try {
      val array = JSONArray(json)
      buildList {
        for (index in 0 until array.length()) {
          val section = array.optJSONObject(index) ?: continue
          add(
            NativeCategorySection(
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
          "code" to "category_manager_decode_failed",
          "message" to (error.message ?: "unknown")
        )
      )
      emptyList()
    }
  }

  private fun parseItems(array: JSONArray): List<NativeCategoryItem> {
    return buildList {
      for (index in 0 until array.length()) {
        val item = array.optJSONObject(index) ?: continue
        val swipeActions = item.optJSONArray("swipeActions") ?: JSONArray()
        val menuActions = item.optJSONArray("menuActions") ?: JSONArray()

        add(
          NativeCategoryItem(
            id = item.optString("id"),
            kind = item.optString("kind"),
            title = item.optString("title"),
            subtitle = item.optString("subtitle").takeIf { it.isNotBlank() },
            reorderable = item.optBoolean("reorderable"),
            pinned = item.optBoolean("pinned"),
            swipeActions = buildList {
              for (actionIndex in 0 until swipeActions.length()) {
                val action = swipeActions.optJSONObject(actionIndex) ?: continue
                add(
                  NativeCategorySwipeAction(
                    id = action.optString("id"),
                    title = action.optString("title"),
                    role = action.optString("role").takeIf { it.isNotBlank() }
                  )
                )
              }
            },
            menuActions = buildList {
              for (actionIndex in 0 until menuActions.length()) {
                val action = menuActions.optJSONObject(actionIndex) ?: continue
                add(
                  NativeCategoryMenuAction(
                    id = action.optString("id"),
                    title = action.optString("title"),
                    role = action.optString("role").takeIf { it.isNotBlank() }
                  )
                )
              }
            },
            enabled = if (item.has("enabled")) item.optBoolean("enabled") else true,
            loading = item.optBoolean("loading")
          )
        )
      }
    }
  }

  private fun rebuildEntries() {
    val nextEntries = mutableListOf<CategoryEntry>()

    sections.forEach { section ->
      if (!section.title.isNullOrBlank()) {
        nextEntries += CategoryEntry.Header(section.id, section.title)
      }

      section.items.forEach { item ->
        nextEntries += CategoryEntry.Row(section.id, item)
      }

      if (!section.footer.isNullOrBlank()) {
        nextEntries += CategoryEntry.Footer(section.id, section.footer)
      }
    }

    entries = nextEntries
    adapter.submit(nextEntries)
  }

  private fun isItemEnabled(item: NativeCategoryItem): Boolean {
    return item.enabled && !item.loading
  }

  private fun orderedItemIds(): List<String> {
    return sections.flatMap { section -> section.items.map { item -> item.id } }
  }

  private fun handlePress(item: NativeCategoryItem) {
    if (!isItemEnabled(item)) {
      return
    }

    onPressItem(
      mapOf(
        "itemId" to item.id,
        "kind" to item.kind
      )
    )
  }

  private fun showMenu(anchor: View, item: NativeCategoryItem) {
    if (!isItemEnabled(item) || item.menuActions.isEmpty()) {
      return
    }

    val popupMenu = PopupMenu(context, anchor)
    item.menuActions.forEachIndexed { index, action ->
      popupMenu.menu.add(0, index, index, action.title)
    }
    popupMenu.setOnMenuItemClickListener { menuItem ->
      val action = item.menuActions.getOrNull(menuItem.itemId) ?: return@setOnMenuItemClickListener false
      onMenuAction(
        mapOf(
          "itemId" to item.id,
          "actionId" to action.id
        )
      )
      true
    }
    popupMenu.show()
  }

  private fun handleSwipe(entry: CategoryEntry.Row, adapterPosition: Int) {
    val item = entry.item
    val swipeActions = item.swipeActions

    if (!isItemEnabled(item) || swipeActions.isEmpty()) {
      adapter.notifyItemChanged(adapterPosition)
      return
    }

    if (swipeActions.size == 1) {
      dispatchSwipeAction(item, swipeActions.first())
      adapter.notifyItemChanged(adapterPosition)
      return
    }

    adapter.notifyItemChanged(adapterPosition)
    AlertDialog.Builder(context)
      .setTitle(item.title)
      .setItems(swipeActions.map { it.title }.toTypedArray()) { _, which ->
        swipeActions.getOrNull(which)?.let { action ->
          dispatchSwipeAction(item, action)
        }
      }
      .setNegativeButton("취소", null)
      .show()
  }

  private fun dispatchSwipeAction(item: NativeCategoryItem, action: NativeCategorySwipeAction) {
    if (action.id == "delete") {
      onRequestDelete(
        mapOf(
          "itemId" to item.id
        )
      )
      return
    }

    onSwipeAction(
      mapOf(
        "itemId" to item.id,
        "actionId" to action.id
      )
    )
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

    if (fromIndex < 0 || toIndex < 0) {
      return false
    }

    val fromItem = mutableItems[fromIndex]
    val toItem = mutableItems[toIndex]
    if (!fromItem.reorderable || fromItem.pinned || !toItem.reorderable || toItem.pinned) {
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

  private inner class HeaderViewHolder(val textView: TextView) :
    RecyclerView.ViewHolder(textView)

  private inner class FooterViewHolder(val textView: TextView) :
    RecyclerView.ViewHolder(textView)

  private inner class RowViewHolder(
    val root: LinearLayout,
    val contentRow: LinearLayout,
    val textColumn: LinearLayout,
    val titleRow: LinearLayout,
    val titleView: TextView,
    val pinnedBadge: TextView,
    val subtitleView: TextView,
    val overflowView: TextView,
    val divider: View
  ) : RecyclerView.ViewHolder(root)

  private inner class CategoryManagerAdapter :
    RecyclerView.Adapter<RecyclerView.ViewHolder>() {
    private var items: List<CategoryEntry> = emptyList()

    init {
      setHasStableIds(true)
    }

    fun submit(next: List<CategoryEntry>) {
      items = next
      notifyDataSetChanged()
    }

    override fun getItemCount(): Int = items.size

    override fun getItemId(position: Int): Long = items[position].stableId.hashCode().toLong()

    override fun getItemViewType(position: Int): Int {
      return when (items[position]) {
        is CategoryEntry.Header -> CATEGORY_VIEW_TYPE_HEADER
        is CategoryEntry.Row -> CATEGORY_VIEW_TYPE_ROW
        is CategoryEntry.Footer -> CATEGORY_VIEW_TYPE_FOOTER
      }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
      return when (viewType) {
        CATEGORY_VIEW_TYPE_HEADER -> HeaderViewHolder(createSectionLabel())
        CATEGORY_VIEW_TYPE_FOOTER -> FooterViewHolder(createFooterLabel())
        else -> createRowHolder()
      }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
      when (val entry = items[position]) {
        is CategoryEntry.Header -> {
          (holder as HeaderViewHolder).textView.text = entry.title.uppercase()
        }

        is CategoryEntry.Footer -> {
          (holder as FooterViewHolder).textView.text = entry.footer
        }

        is CategoryEntry.Row -> bindRow(holder as RowViewHolder, entry, position)
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
      setPadding(dp(16), dp(14), dp(16), dp(14))
    }

    val textColumn = LinearLayout(context).apply {
      orientation = VERTICAL
    }

    val titleRow = LinearLayout(context).apply {
      orientation = HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }

    val titleView = TextView(context).apply {
      setTextColor(Color.parseColor("#111827"))
      setTypeface(typeface, Typeface.BOLD)
      textSize = 16f
    }

    val pinnedBadge = TextView(context).apply {
      setTextColor(Color.parseColor("#4B5563"))
      textSize = 11f
      setTypeface(typeface, Typeface.BOLD)
      text = "PINNED"
      background = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = dp(999).toFloat()
        setColor(Color.parseColor("#E5E7EB"))
      }
      setPadding(dp(8), dp(3), dp(8), dp(3))
    }

    val subtitleView = TextView(context).apply {
      setTextColor(Color.parseColor("#6B7280"))
      textSize = 13f
    }

    val overflowView = TextView(context).apply {
      text = "…"
      setTextColor(Color.parseColor("#111827"))
      setTypeface(typeface, Typeface.BOLD)
      textSize = 20f
      gravity = Gravity.CENTER
      background = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = dp(10).toFloat()
        setColor(Color.parseColor("#E5E7EB"))
      }
      setPadding(dp(10), dp(4), dp(10), dp(6))
    }

    titleRow.addView(titleView)
    titleRow.addView(
      pinnedBadge,
      LinearLayout.LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
        marginStart = dp(8)
      }
    )

    textColumn.addView(titleRow)
    textColumn.addView(subtitleView)

    contentRow.addView(
      textColumn,
      LinearLayout.LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f)
    )
    contentRow.addView(overflowView)

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

    return RowViewHolder(
      root,
      contentRow,
      textColumn,
      titleRow,
      titleView,
      pinnedBadge,
      subtitleView,
      overflowView,
      divider
    )
  }

  private fun bindRow(holder: RowViewHolder, entry: CategoryEntry.Row, position: Int) {
    val item = entry.item
    holder.titleView.text = item.title
    holder.pinnedBadge.visibility = if (item.pinned) View.VISIBLE else View.GONE
    holder.subtitleView.text = item.subtitle
    holder.subtitleView.visibility = if (item.subtitle.isNullOrBlank()) View.GONE else View.VISIBLE
    holder.overflowView.visibility = if (item.menuActions.isEmpty()) View.GONE else View.VISIBLE
    holder.contentRow.alpha = if (isItemEnabled(item)) 1f else 0.45f
    holder.divider.visibility = if (position == entries.lastIndex || isLastInSection(position)) View.GONE else View.VISIBLE

    holder.root.setOnClickListener {
      handlePress(item)
    }

    holder.root.setOnLongClickListener {
      if (item.reorderable && !item.pinned && isItemEnabled(item)) {
        dragChanged = false
        itemTouchHelper.startDrag(holder)
        true
      } else {
        false
      }
    }

    holder.overflowView.setOnClickListener { anchor ->
      showMenu(anchor, item)
    }
  }

  private fun isLastInSection(position: Int): Boolean {
    val current = entries.getOrNull(position) as? CategoryEntry.Row ?: return true
    val next = entries.getOrNull(position + 1)
    return when (next) {
      is CategoryEntry.Row -> next.sectionId != current.sectionId
      else -> true
    }
  }

  private inner class CategoryTouchHelperCallback : ItemTouchHelper.Callback() {
    override fun isLongPressDragEnabled(): Boolean = false

    override fun isItemViewSwipeEnabled(): Boolean = true

    override fun getMovementFlags(
      recyclerView: RecyclerView,
      viewHolder: RecyclerView.ViewHolder
    ): Int {
      val entry = entries.getOrNull(viewHolder.bindingAdapterPosition) as? CategoryEntry.Row
        ?: return makeMovementFlags(0, 0)

      val dragFlags = if (entry.item.reorderable && !entry.item.pinned && isItemEnabled(entry.item)) {
        ItemTouchHelper.UP or ItemTouchHelper.DOWN
      } else {
        0
      }

      val swipeFlags = if (entry.item.swipeActions.isNotEmpty() && isItemEnabled(entry.item)) {
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
      val sourceEntry = entries.getOrNull(viewHolder.bindingAdapterPosition) as? CategoryEntry.Row
        ?: return false
      val targetEntry = entries.getOrNull(target.bindingAdapterPosition) as? CategoryEntry.Row
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
      val entry = entries.getOrNull(adapterPosition) as? CategoryEntry.Row ?: return
      handleSwipe(entry, adapterPosition)
    }

    override fun clearView(recyclerView: RecyclerView, viewHolder: RecyclerView.ViewHolder) {
      super.clearView(recyclerView, viewHolder)

      if (dragChanged) {
        onReorderCommit(
          mapOf(
            "orderedItemIds" to orderedItemIds()
          )
        )
      }
      dragChanged = false
    }
  }

  private fun dp(value: Int): Int {
    return (value * resources.displayMetrics.density).toInt()
  }
}
