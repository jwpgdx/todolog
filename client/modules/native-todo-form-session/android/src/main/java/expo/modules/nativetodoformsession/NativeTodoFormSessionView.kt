package expo.modules.nativetodoformsession

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup.LayoutParams
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.PopupMenu
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.setPadding
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

private enum class VisualState {
  COLLAPSED,
  EXPANDED
}

class NativeTodoFormSessionView(
  context: Context,
  appContext: AppContext
) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout: Boolean = true

  private val onDismiss by EventDispatcher<Map<String, Any>>()
  private val onStateSettled by EventDispatcher<Map<String, Any>>()

  private val root = FrameLayout(context)
  private val backdropView = View(context)
  private val panelView = LinearLayout(context)
  private val dragHandleZone = LinearLayout(context)
  private val handleView = View(context)
  private val quickContainer = LinearLayout(context)
  private val inputRow = LinearLayout(context)
  private val titleInput = EditText(context)
  private val submitButton = TextView(context)
  private val actionRow = LinearLayout(context)
  private val categoryButton = TextView(context)
  private val dateButton = TextView(context)
  private val repeatButton = TextView(context)
  private val detailHeaderRow = LinearLayout(context)
  private val detailCloseButton = TextView(context)
  private val detailTitleLabel = TextView(context)
  private val detailDoneButton = TextView(context)
  private val bodyScrollView = ScrollView(context)
  private val bodyPlaceholder = TextView(context)

  private val categories = listOf("개인", "업무", "읽기", "장보기")

  private var currentState = VisualState.COLLAPSED
  private var selectedCategory = "개인"
  private var detailPlaceholderText = "Detail content pending in the other Codex session."
  private var panelHeightPx = 0
  private var imeBottom = 0
  private var dragStartRawY = 0f
  private var dragStartHeight = 0
  private var dragging = false
  private var stateAnimator: ValueAnimator? = null

  init {
    orientation = VERTICAL
    setBackgroundColor(Color.TRANSPARENT)

    root.layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    addView(root)

    configureBackdrop()
    configurePanel()
    configureInsets()
    configureRootLayoutCallback()
    settleState(VisualState.COLLAPSED, animated = false, force = true)
  }

  fun updateDetailPlaceholderText(text: String?) {
    detailPlaceholderText = if (text.isNullOrBlank()) {
      "Detail content pending in the other Codex session."
    } else {
      text
    }
    bodyPlaceholder.text = detailPlaceholderText
  }

  private fun configureBackdrop() {
    backdropView.setBackgroundColor(Color.parseColor("#59000000"))
    backdropView.setOnClickListener {
      requestDismiss("backdrop")
    }
    root.addView(
      backdropView,
      FrameLayout.LayoutParams(
        LayoutParams.MATCH_PARENT,
        LayoutParams.MATCH_PARENT
      )
    )
  }

  private fun configurePanel() {
    panelView.orientation = LinearLayout.VERTICAL
    panelView.background = roundedDrawable("#FFFFFF", radiusDp = 28f)
    panelView.clipToOutline = true
    panelView.elevation = dp(10).toFloat()

    root.addView(
      panelView,
      FrameLayout.LayoutParams(
        LayoutParams.MATCH_PARENT,
        collapsedHeight(),
        Gravity.BOTTOM
      )
    )

    configureDragHandleZone()
    configureQuickContent()
    configureDetailShell()

    panelView.addView(dragHandleZone)
    panelView.addView(detailHeaderRow)
    panelView.addView(quickContainer)
    panelView.addView(
      bodyScrollView,
      LinearLayout.LayoutParams(
        LayoutParams.MATCH_PARENT,
        0,
        1f
      )
    )
  }

  private fun configureDragHandleZone() {
    dragHandleZone.orientation = LinearLayout.VERTICAL
    dragHandleZone.gravity = Gravity.CENTER_HORIZONTAL
    dragHandleZone.setPadding(dp(12), dp(14), dp(12), dp(10))

    handleView.background = roundedDrawable("#D1D5DB", radiusDp = 999f)
    dragHandleZone.addView(
      handleView,
      LinearLayout.LayoutParams(dp(42), dp(5))
    )

    dragHandleZone.setOnTouchListener { _, event ->
      handleDragTouch(event)
    }
  }

  private fun configureQuickContent() {
    quickContainer.orientation = LinearLayout.VERTICAL
    quickContainer.setPadding(dp(16), dp(6), dp(16), dp(16))

    inputRow.orientation = LinearLayout.HORIZONTAL
    inputRow.gravity = Gravity.CENTER_VERTICAL

    titleInput.hint = "제목"
    titleInput.setPadding(dp(14), dp(12), dp(14), dp(12))
    titleInput.setTextColor(Color.parseColor("#111827"))
    titleInput.setHintTextColor(Color.parseColor("#9CA3AF"))
    titleInput.textSize = 16f
    titleInput.maxLines = 1
    titleInput.isSingleLine = true
    titleInput.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
    titleInput.imeOptions = EditorInfo.IME_ACTION_DONE
    titleInput.background = roundedDrawable("#F3F4F6", radiusDp = 14f)
    titleInput.addTextChangedListener(object : TextWatcher {
      override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit

      override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit

      override fun afterTextChanged(s: Editable?) {
        updateSubmitButton()
      }
    })
    titleInput.setOnEditorActionListener { _, actionId, _ ->
      actionId == EditorInfo.IME_ACTION_DONE
    }

    submitButton.gravity = Gravity.CENTER
    submitButton.text = "저장"
    submitButton.setTextColor(Color.WHITE)
    submitButton.setTypeface(Typeface.DEFAULT_BOLD)
    submitButton.textSize = 13f
    submitButton.background = roundedDrawable("#D1D5DB", radiusDp = 22f)
    submitButton.setPadding(dp(14), dp(12), dp(14), dp(12))

    inputRow.addView(
      titleInput,
      LinearLayout.LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f)
    )
    inputRow.addView(
      submitButton,
      LinearLayout.LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
        marginStart = dp(10)
      }
    )

    actionRow.orientation = LinearLayout.HORIZONTAL
    actionRow.gravity = Gravity.START or Gravity.CENTER_VERTICAL

    configureQuickActionButton(categoryButton)
    configureQuickActionButton(dateButton)
    configureQuickActionButton(repeatButton)

    updateCategoryButtonText()
    dateButton.text = "오늘"
    repeatButton.text = "안 함"

    categoryButton.setOnClickListener { anchor ->
      openCategoryMenu(anchor)
    }
    dateButton.setOnClickListener {
      settleState(VisualState.EXPANDED, animated = true)
    }
    repeatButton.setOnClickListener {
      settleState(VisualState.EXPANDED, animated = true)
    }

    actionRow.addView(categoryButton)
    actionRow.addView(
      dateButton,
      LinearLayout.LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
        marginStart = dp(8)
      }
    )
    actionRow.addView(
      repeatButton,
      LinearLayout.LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
        marginStart = dp(8)
      }
    )

    quickContainer.addView(inputRow)
    quickContainer.addView(
      actionRow,
      LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply {
        topMargin = dp(12)
      }
    )
  }

  private fun configureQuickActionButton(button: TextView) {
    button.setTextColor(Color.parseColor("#374151"))
    button.textSize = 14f
    button.setTypeface(Typeface.DEFAULT_BOLD)
    button.setPadding(dp(12), dp(9), dp(12), dp(9))
    button.background = roundedDrawable("#F3F4F6", radiusDp = 16f)
    button.gravity = Gravity.CENTER
  }

  private fun configureDetailShell() {
    detailHeaderRow.orientation = LinearLayout.HORIZONTAL
    detailHeaderRow.gravity = Gravity.CENTER_VERTICAL
    detailHeaderRow.setPadding(dp(16), dp(4), dp(16), dp(8))

    configureHeaderButton(detailCloseButton, "✕")
    detailCloseButton.setOnClickListener {
      requestDismiss("button")
    }

    detailTitleLabel.text = "새 할 일"
    detailTitleLabel.setTextColor(Color.parseColor("#111827"))
    detailTitleLabel.setTypeface(Typeface.DEFAULT_BOLD)
    detailTitleLabel.textSize = 16f
    detailTitleLabel.gravity = Gravity.CENTER
    detailTitleLabel.setOnTouchListener { _, event ->
      handleDragTouch(event)
    }

    configureHeaderButton(detailDoneButton, "완료")
    detailDoneButton.setOnClickListener {
      requestDismiss("done")
    }

    detailHeaderRow.addView(
      detailCloseButton,
      LinearLayout.LayoutParams(dp(44), LayoutParams.WRAP_CONTENT)
    )
    detailHeaderRow.addView(
      detailTitleLabel,
      LinearLayout.LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f)
    )
    detailHeaderRow.addView(
      detailDoneButton,
      LinearLayout.LayoutParams(dp(52), LayoutParams.WRAP_CONTENT)
    )
    detailHeaderRow.visibility = View.GONE
    detailHeaderRow.alpha = 0f

    bodyPlaceholder.text = detailPlaceholderText
    bodyPlaceholder.setTextColor(Color.parseColor("#6B7280"))
    bodyPlaceholder.textSize = 15f
    bodyPlaceholder.gravity = Gravity.CENTER
    bodyPlaceholder.setPadding(dp(20), dp(48), dp(20), dp(48))

    bodyScrollView.visibility = View.GONE
    bodyScrollView.alpha = 0f
    bodyScrollView.isFillViewport = true

    val bodyContainer = FrameLayout(context).apply {
      addView(
        bodyPlaceholder,
        FrameLayout.LayoutParams(
          LayoutParams.MATCH_PARENT,
          LayoutParams.WRAP_CONTENT,
          Gravity.CENTER
        )
      )
    }
    bodyScrollView.addView(
      bodyContainer,
      FrameLayout.LayoutParams(
        LayoutParams.MATCH_PARENT,
        LayoutParams.MATCH_PARENT
      )
    )
  }

  private fun configureHeaderButton(button: TextView, label: String) {
    button.text = label
    button.gravity = Gravity.CENTER
    button.setTextColor(Color.parseColor("#2563EB"))
    button.setTypeface(Typeface.DEFAULT_BOLD)
    button.textSize = 15f
    button.setPadding(0, dp(8), 0, dp(8))
  }

  private fun configureInsets() {
    ViewCompat.setOnApplyWindowInsetsListener(this) { _, windowInsets ->
      imeBottom = windowInsets.getInsets(WindowInsetsCompat.Type.ime()).bottom
      updatePanelLayout()
      windowInsets
    }
  }

  private fun configureRootLayoutCallback() {
    root.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ ->
      settleState(currentState, animated = false, force = true)
    }

    post {
      focusTitleInput()
      ViewCompat.requestApplyInsets(this)
    }
  }

  private fun handleDragTouch(event: MotionEvent): Boolean {
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        dragStartRawY = event.rawY
        dragStartHeight = panelHeightPx.takeIf { it > 0 } ?: collapsedHeight()
        dragging = false
        stateAnimator?.cancel()
        return true
      }

      MotionEvent.ACTION_MOVE -> {
        val dy = event.rawY - dragStartRawY
        if (!dragging && abs(dy) > dp(8)) {
          dragging = true
        }

        if (dragging) {
          setPanelHeight(clampPanelHeight(dragStartHeight - dy.roundToInt()))
        }
        return true
      }

      MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
        val dy = event.rawY - dragStartRawY
        if (dragging) {
          handleDragRelease(dy)
        } else {
          performClick()
        }
        dragging = false
        return true
      }
    }

    return false
  }

  private fun handleDragRelease(dy: Float) {
    val collapsed = collapsedHeight()
    val current = panelHeightPx.takeIf { it > 0 } ?: collapsed

    if (currentState == VisualState.EXPANDED) {
      if (dy > dp(120).toFloat() && current <= collapsed + dp(48)) {
        requestDismiss("drag")
      } else {
        settleState(VisualState.EXPANDED, animated = true)
      }
      return
    }

    if (dy > dp(84).toFloat() && current <= collapsed + dp(24)) {
      requestDismiss("drag")
      return
    }

    val target = if (dy < 0f) {
      VisualState.EXPANDED
    } else {
      VisualState.COLLAPSED
    }
    settleState(target, animated = true)
  }

  private fun settleState(target: VisualState, animated: Boolean, force: Boolean = false) {
    val desiredHeight = when (target) {
      VisualState.COLLAPSED -> collapsedHeight()
      VisualState.EXPANDED -> expandedHeight()
    }
    val expanded = target == VisualState.EXPANDED

    if (target == currentState && !force && panelHeightPx == desiredHeight) {
      updatePanelLayout()
      return
    }

    stateAnimator?.cancel()

    if (expanded) {
      detailHeaderRow.visibility = View.VISIBLE
      bodyScrollView.visibility = View.VISIBLE
    } else {
      submitButton.visibility = View.VISIBLE
      actionRow.visibility = View.VISIBLE
    }

    val startHeight = panelHeightPx.takeIf { it > 0 } ?: desiredHeight

    if (!animated) {
      currentState = target
      setPanelHeight(desiredHeight)
      updateExpandedVisibility(expanded)
      emitStateSettled(target)
      return
    }

    stateAnimator = ValueAnimator.ofInt(startHeight, desiredHeight).apply {
      duration = 240
      addUpdateListener { animator ->
        setPanelHeight(animator.animatedValue as Int)
      }
      addListener(object : AnimatorListenerAdapter() {
        override fun onAnimationEnd(animation: Animator) {
          currentState = target
          updateExpandedVisibility(expanded)
          emitStateSettled(target)
        }
      })
      start()
    }
  }

  private fun updateExpandedVisibility(expanded: Boolean) {
    detailHeaderRow.alpha = if (expanded) 1f else 0f
    bodyScrollView.alpha = if (expanded) 1f else 0f
    submitButton.alpha = if (expanded) 0f else 1f
    actionRow.alpha = if (expanded) 0f else 1f
    submitButton.visibility = if (expanded) View.GONE else View.VISIBLE
    actionRow.visibility = if (expanded) View.GONE else View.VISIBLE
    if (!expanded) {
      detailHeaderRow.visibility = View.GONE
      bodyScrollView.visibility = View.GONE
    }
  }

  private fun emitStateSettled(target: VisualState) {
    onStateSettled(
      mapOf(
        "state" to if (target == VisualState.EXPANDED) "expanded" else "collapsed"
      )
    )
  }

  private fun requestDismiss(reason: String) {
    hideKeyboard()
    resetToCollapsedState()
    onDismiss(
      mapOf(
        "reason" to reason
      )
    )
  }

  private fun resetToCollapsedState() {
    currentState = VisualState.COLLAPSED
    imeBottom = 0
    stateAnimator?.cancel()
    detailHeaderRow.alpha = 0f
    detailHeaderRow.visibility = View.GONE
    bodyScrollView.alpha = 0f
    bodyScrollView.visibility = View.GONE
    submitButton.alpha = 1f
    submitButton.visibility = View.VISIBLE
    actionRow.alpha = 1f
    actionRow.visibility = View.VISIBLE
    setPanelHeight(collapsedHeight())
  }

  private fun openCategoryMenu(anchor: View) {
    val popup = PopupMenu(context, anchor)
    categories.forEachIndexed { index, category ->
      popup.menu.add(0, index, index, category)
    }
    popup.setOnMenuItemClickListener { item ->
      selectedCategory = categories.getOrElse(item.itemId) { selectedCategory }
      updateCategoryButtonText()
      true
    }
    popup.show()
  }

  private fun updateCategoryButtonText() {
    categoryButton.text = selectedCategory
  }

  private fun updateSubmitButton() {
    val enabled = titleInput.text?.toString()?.trim()?.isNotEmpty() == true
    submitButton.background = roundedDrawable(
      if (enabled) "#2563EB" else "#D1D5DB",
      radiusDp = 22f
    )
  }

  private fun focusTitleInput() {
    titleInput.post {
      titleInput.requestFocus()
      val inputMethodManager =
        context.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
      inputMethodManager?.showSoftInput(titleInput, InputMethodManager.SHOW_IMPLICIT)
    }
  }

  private fun hideKeyboard() {
    val inputMethodManager =
      context.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
    inputMethodManager?.hideSoftInputFromWindow(windowToken, 0)
  }

  private fun updatePanelLayout() {
    val layoutParams = panelView.layoutParams as FrameLayout.LayoutParams
    layoutParams.height = panelHeightPx.takeIf { it > 0 } ?: collapsedHeight()
    layoutParams.gravity = Gravity.BOTTOM
    layoutParams.bottomMargin = imeBottom
    panelView.layoutParams = layoutParams
  }

  private fun setPanelHeight(height: Int) {
    panelHeightPx = height
    updatePanelLayout()
  }

  private fun clampPanelHeight(height: Int): Int {
    return min(expandedHeight(), max(collapsedHeight(), height))
  }

  private fun collapsedHeight(): Int {
    return dp(186)
  }

  private fun expandedHeight(): Int {
    val totalHeight = if (root.height > 0) root.height else resources.displayMetrics.heightPixels
    val visibleHeight = max(collapsedHeight(), totalHeight - imeBottom)
    val desired = max(collapsedHeight() + dp(220), (visibleHeight * 0.84f).roundToInt())
    val maxHeight = max(collapsedHeight(), visibleHeight - dp(12))
    return min(maxHeight, desired)
  }

  private fun roundedDrawable(colorHex: String, strokeHex: String? = null, radiusDp: Float): GradientDrawable {
    return GradientDrawable().apply {
      shape = GradientDrawable.RECTANGLE
      setColor(Color.parseColor(colorHex))
      cornerRadius = dp(radiusDp).toFloat()
      if (strokeHex != null) {
        setStroke(dp(1), Color.parseColor(strokeHex))
      }
    }
  }

  private fun dp(value: Float): Int {
    return TypedValue.applyDimension(
      TypedValue.COMPLEX_UNIT_DIP,
      value,
      resources.displayMetrics
    ).roundToInt()
  }
}
