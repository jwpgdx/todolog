package expo.modules.nativesettings

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.widget.SearchView
import androidx.core.view.setPadding
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

private const val SELECTION_VIEW_TYPE_OPTION = 1
private const val SELECTION_VIEW_TYPE_EMPTY = 2

private data class NativeSelectionOption(
  val id: String,
  val label: String,
  val subtitle: String?,
  val keywords: List<String>
)

private data class NativeSelectionPayload(
  val screenId: String,
  val title: String,
  val subtitle: String?,
  val options: List<NativeSelectionOption>,
  val selectedIds: List<String>,
  val searchEnabled: Boolean,
  val allowsMultiple: Boolean,
  val emptyStateText: String?
)

private sealed class SelectionEntry(val stableId: String) {
  data class Option(val option: NativeSelectionOption) : SelectionEntry("option:${option.id}")
  data class Empty(val message: String) : SelectionEntry("empty")
}

class NativeSelectionListView(
  context: Context,
  appContext: AppContext
) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout: Boolean = true

  private val onPressItem by EventDispatcher<Map<String, Any>>()
  private val onSelectionCommit by EventDispatcher<Map<String, Any>>()
  private val onError by EventDispatcher<Map<String, Any>>()

  private var screenId = "selection-list"
  private var payload = NativeSelectionPayload(
    screenId = "selection-list",
    title = "SelectionList",
    subtitle = null,
    options = emptyList(),
    selectedIds = emptyList(),
    searchEnabled = false,
    allowsMultiple = false,
    emptyStateText = null
  )
  private var entries: List<SelectionEntry> = emptyList()

  private val titleView = TextView(context)
  private val subtitleView = TextView(context)
  private val searchView = SearchView(context)
  private val recyclerView = RecyclerView(context)
  private val adapter = SelectionListAdapter()

  init {
    orientation = VERTICAL
    setBackgroundColor(Color.TRANSPARENT)

    titleView.setTextColor(Color.parseColor("#111827"))
    titleView.setTypeface(titleView.typeface, Typeface.BOLD)
    titleView.textSize = 20f

    subtitleView.setTextColor(Color.parseColor("#6B7280"))
    subtitleView.textSize = 14f

    searchView.queryHint = "검색"
    searchView.isIconified = false
    searchView.clearFocus()
    searchView.setOnQueryTextListener(
      object : SearchView.OnQueryTextListener {
        override fun onQueryTextSubmit(query: String?): Boolean {
          applyFilter(query, false)
          return true
        }

        override fun onQueryTextChange(newText: String?): Boolean {
          applyFilter(newText, false)
          return true
        }
      }
    )

    recyclerView.layoutManager = LinearLayoutManager(context)
    recyclerView.adapter = adapter
    recyclerView.isNestedScrollingEnabled = false
    recyclerView.overScrollMode = OVER_SCROLL_NEVER
    recyclerView.setBackgroundColor(Color.TRANSPARENT)

    addView(
      titleView,
      LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply {
        setMargins(dp(16), dp(16), dp(16), 0)
      }
    )
    addView(
      subtitleView,
      LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply {
        setMargins(dp(16), dp(6), dp(16), 0)
      }
    )
    addView(
      searchView,
      LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply {
        setMargins(dp(8), dp(8), dp(8), 0)
      }
    )
    addView(
      recyclerView,
      LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply {
        setMargins(0, dp(4), 0, 0)
      }
    )

    renderHeader()
    applyFilter(null, false)
  }

  fun updateScreenId(nextScreenId: String?) {
    screenId = nextScreenId ?: "selection-list"
  }

  fun updatePayloadJson(payloadJson: String) {
    payload = parsePayload(payloadJson)
    if (screenId.isBlank()) {
      screenId = payload.screenId
    }
    renderHeader()
    applyFilter(searchView.query?.toString(), false)
  }

  private fun renderHeader() {
    titleView.text = payload.title
    subtitleView.text = payload.subtitle
    subtitleView.visibility = if (payload.subtitle.isNullOrBlank()) View.GONE else View.VISIBLE
    searchView.visibility = if (payload.searchEnabled) View.VISIBLE else View.GONE
    if (!payload.searchEnabled) {
      searchView.setQuery("", false)
      searchView.clearFocus()
    }
  }

  private fun parsePayload(json: String): NativeSelectionPayload {
    return try {
      val jsonObject = JSONObject(json)
      val optionsJson = jsonObject.optJSONArray("options") ?: JSONArray()
      val selectedIdsJson = jsonObject.optJSONArray("selectedIds") ?: JSONArray()

      NativeSelectionPayload(
        screenId = jsonObject.optString("screenId", "selection-list"),
        title = jsonObject.optString("title", "SelectionList"),
        subtitle = jsonObject.optString("subtitle").takeIf { it.isNotBlank() },
        options = buildList {
          for (index in 0 until optionsJson.length()) {
            val option = optionsJson.optJSONObject(index) ?: continue
            val keywords = option.optJSONArray("keywords") ?: JSONArray()
            add(
              NativeSelectionOption(
                id = option.optString("id"),
                label = option.optString("label"),
                subtitle = option.optString("subtitle").takeIf { it.isNotBlank() },
                keywords = buildList {
                  for (keywordIndex in 0 until keywords.length()) {
                    val keyword = keywords.optString(keywordIndex)
                    if (keyword.isNotBlank()) {
                      add(keyword)
                    }
                  }
                }
              )
            )
          }
        },
        selectedIds = buildList {
          for (index in 0 until selectedIdsJson.length()) {
            val selectedId = selectedIdsJson.optString(index)
            if (selectedId.isNotBlank()) {
              add(selectedId)
            }
          }
        },
        searchEnabled = jsonObject.optBoolean("searchEnabled"),
        allowsMultiple = jsonObject.optBoolean("allowsMultiple"),
        emptyStateText = jsonObject.optString("emptyStateText").takeIf { it.isNotBlank() }
      )
    } catch (error: Throwable) {
      onError(
        mapOf(
          "code" to "selection_list_decode_failed",
          "message" to (error.message ?: "unknown")
        )
      )
      NativeSelectionPayload(
        screenId = screenId,
        title = "SelectionList",
        subtitle = null,
        options = emptyList(),
        selectedIds = emptyList(),
        searchEnabled = false,
        allowsMultiple = false,
        emptyStateText = null
      )
    }
  }

  private fun applyFilter(query: String?, animated: Boolean) {
    val normalizedQuery = query
      ?.trim()
      ?.lowercase(Locale.ROOT)
      .orEmpty()

    val filteredOptions = if (normalizedQuery.isBlank()) {
      payload.options
    } else {
      payload.options.filter { option ->
        buildList {
          add(option.label)
          option.subtitle?.let(::add)
          addAll(option.keywords)
        }.any { candidate ->
          candidate.lowercase(Locale.ROOT).contains(normalizedQuery)
        }
      }
    }

    entries = if (filteredOptions.isEmpty()) {
      listOf(
        SelectionEntry.Empty(
          payload.emptyStateText ?: "검색 결과가 없습니다."
        )
      )
    } else {
      filteredOptions.map(SelectionEntry::Option)
    }

    adapter.submit(entries, animated)
  }

  private fun currentSelectedIdsSet(): Set<String> {
    return payload.selectedIds.toSet()
  }

  private fun currentScreenId(): String {
    return if (screenId.isBlank()) payload.screenId else screenId
  }

  private fun commitSelection(option: NativeSelectionOption) {
    val nextSelectedIds = payload.selectedIds.toMutableList()

    if (payload.allowsMultiple) {
      val existingIndex = nextSelectedIds.indexOf(option.id)
      if (existingIndex >= 0) {
        nextSelectedIds.removeAt(existingIndex)
      } else {
        nextSelectedIds.add(option.id)
      }
    } else {
      nextSelectedIds.clear()
      nextSelectedIds.add(option.id)
    }

    payload = payload.copy(selectedIds = nextSelectedIds)
    applyFilter(searchView.query?.toString(), true)
    onPressItem(
      mapOf(
        "itemId" to option.id,
        "kind" to "selectionOption"
      )
    )
    onSelectionCommit(
      mapOf(
        "screenId" to currentScreenId(),
        "selectedIds" to nextSelectedIds
      )
    )
  }

  private inner class OptionViewHolder(
    val root: LinearLayout,
    val contentRow: LinearLayout,
    val textColumn: LinearLayout,
    val titleView: TextView,
    val subtitleView: TextView,
    val checkView: TextView,
    val divider: View
  ) : RecyclerView.ViewHolder(root)

  private inner class EmptyViewHolder(
    val textView: TextView
  ) : RecyclerView.ViewHolder(textView)

  private inner class SelectionListAdapter :
    RecyclerView.Adapter<RecyclerView.ViewHolder>() {
    private var items: List<SelectionEntry> = emptyList()

    init {
      setHasStableIds(true)
    }

    fun submit(next: List<SelectionEntry>, animated: Boolean) {
      items = next
      if (animated) {
        notifyDataSetChanged()
      } else {
        notifyDataSetChanged()
      }
    }

    override fun getItemCount(): Int = items.size

    override fun getItemId(position: Int): Long = items[position].stableId.hashCode().toLong()

    override fun getItemViewType(position: Int): Int {
      return when (items[position]) {
        is SelectionEntry.Option -> SELECTION_VIEW_TYPE_OPTION
        is SelectionEntry.Empty -> SELECTION_VIEW_TYPE_EMPTY
      }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
      return when (viewType) {
        SELECTION_VIEW_TYPE_EMPTY -> EmptyViewHolder(createEmptyStateLabel())
        else -> createOptionHolder()
      }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
      when (val entry = items[position]) {
        is SelectionEntry.Option -> bindOptionRow(holder as OptionViewHolder, entry.option, position)
        is SelectionEntry.Empty -> (holder as EmptyViewHolder).textView.text = entry.message
      }
    }
  }

  private fun createOptionHolder(): OptionViewHolder {
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

    val checkView = TextView(context).apply {
      textSize = 18f
      setTypeface(typeface, Typeface.BOLD)
      setTextColor(Color.parseColor("#16A34A"))
    }

    textColumn.addView(titleView)
    textColumn.addView(subtitleView)

    contentRow.addView(
      textColumn,
      LinearLayout.LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f)
    )
    contentRow.addView(checkView)

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

    return OptionViewHolder(
      root,
      contentRow,
      textColumn,
      titleView,
      subtitleView,
      checkView,
      divider
    )
  }

  private fun createEmptyStateLabel(): TextView {
    return TextView(context).apply {
      setTextColor(Color.parseColor("#6B7280"))
      gravity = Gravity.CENTER_HORIZONTAL
      textSize = 14f
      setPadding(dp(16), dp(18), dp(16), dp(18))
    }
  }

  private fun bindOptionRow(
    holder: OptionViewHolder,
    option: NativeSelectionOption,
    position: Int
  ) {
    val selected = currentSelectedIdsSet().contains(option.id)
    holder.titleView.text = option.label
    holder.subtitleView.text = option.subtitle
    holder.subtitleView.visibility =
      if (option.subtitle.isNullOrBlank()) View.GONE else View.VISIBLE
    holder.checkView.text = if (selected) "✓" else "○"
    holder.checkView.setTextColor(
      if (selected) Color.parseColor("#16A34A") else Color.parseColor("#D1D5DB")
    )
    holder.divider.visibility =
      if (position == entries.lastIndex) View.GONE else View.VISIBLE
    holder.root.setOnClickListener {
      commitSelection(option)
    }
  }

  private fun dp(value: Int): Int {
    return (value * resources.displayMetrics.density).toInt()
  }
}
