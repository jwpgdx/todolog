package expo.modules.nativesettings

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.format.DateFormat
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.DatePicker
import android.widget.LinearLayout
import android.widget.NumberPicker
import android.widget.TextView
import android.widget.TimePicker
import androidx.core.view.setPadding
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import org.json.JSONObject
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.util.Locale

private data class NativePickerTemporalConfig(
  val mode: String,
  val minISO: String?,
  val maxISO: String?,
  val minuteInterval: Int?,
  val locale: String?,
  val timeZone: String?,
  val calendar: String?,
  val presentation: String?
)

private data class NativePickerPayload(
  val screenId: String,
  val pickerId: String,
  val title: String,
  val subtitle: String?,
  val valueISO: String?,
  val temporalConfig: NativePickerTemporalConfig
)

class NativePickerHostView(
  context: Context,
  appContext: AppContext
) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout: Boolean = true

  private val onError by EventDispatcher<Map<String, Any>>()

  private var screenId = "picker-host"
  private var payload = NativePickerPayload(
    screenId = "picker-host",
    pickerId = "picker",
    title = "PickerHost",
    subtitle = null,
    valueISO = null,
    temporalConfig = NativePickerTemporalConfig(
      mode = "date",
      minISO = null,
      maxISO = null,
      minuteInterval = null,
      locale = null,
      timeZone = null,
      calendar = null,
      presentation = null
    )
  )
  private var currentDateTime: ZonedDateTime = ZonedDateTime.now()
  private var countdownMinutes: Int = 15

  private val titleView = TextView(context)
  private val subtitleView = TextView(context)
  private val summaryView = TextView(context)
  private val metadataView = TextView(context)
  private val editorContainer = LinearLayout(context)

  init {
    orientation = VERTICAL
    setBackgroundColor(Color.TRANSPARENT)

    titleView.setTextColor(Color.parseColor("#111827"))
    titleView.setTypeface(titleView.typeface, Typeface.BOLD)
    titleView.textSize = 20f

    subtitleView.setTextColor(Color.parseColor("#6B7280"))
    subtitleView.textSize = 14f

    val summaryCard = LinearLayout(context).apply {
      orientation = VERTICAL
      setPadding(dp(14))
      background = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = dp(14).toFloat()
        setColor(Color.parseColor("#F3F4F6"))
      }
    }

    summaryView.setTextColor(Color.parseColor("#111827"))
    summaryView.setTypeface(summaryView.typeface, Typeface.BOLD)
    summaryView.textSize = 15f

    metadataView.setTextColor(Color.parseColor("#6B7280"))
    metadataView.textSize = 12f

    summaryCard.addView(summaryView)
    summaryCard.addView(metadataView)

    editorContainer.orientation = VERTICAL

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
      summaryCard,
      LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply {
        setMargins(dp(16), dp(12), dp(16), 0)
      }
    )
    addView(
      editorContainer,
      LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply {
        setMargins(dp(16), dp(12), dp(16), dp(16))
      }
    )

    render()
  }

  fun updateScreenId(nextScreenId: String?) {
    screenId = nextScreenId ?: "picker-host"
  }

  fun updatePayloadJson(payloadJson: String) {
    payload = parsePayload(payloadJson)
    if (screenId.isBlank()) {
      screenId = payload.screenId
    }
    render()
  }

  private fun parsePayload(json: String): NativePickerPayload {
    return try {
      val jsonObject = JSONObject(json)
      val temporalConfig = jsonObject.optJSONObject("temporalConfig") ?: JSONObject()

      NativePickerPayload(
        screenId = jsonObject.optString("screenId", "picker-host"),
        pickerId = jsonObject.optString("pickerId", "picker"),
        title = jsonObject.optString("title", "PickerHost"),
        subtitle = jsonObject.optString("subtitle").takeIf { it.isNotBlank() },
        valueISO = jsonObject.optString("valueISO").takeIf { it.isNotBlank() },
        temporalConfig = NativePickerTemporalConfig(
          mode = temporalConfig.optString("mode", "date"),
          minISO = temporalConfig.optString("minISO").takeIf { it.isNotBlank() },
          maxISO = temporalConfig.optString("maxISO").takeIf { it.isNotBlank() },
          minuteInterval = temporalConfig.takeIf { it.has("minuteInterval") }
            ?.optInt("minuteInterval")
            ?.takeIf { value -> value > 0 && value <= 30 && 60 % value == 0 },
          locale = temporalConfig.optString("locale").takeIf { it.isNotBlank() },
          timeZone = temporalConfig.optString("timeZone").takeIf { it.isNotBlank() },
          calendar = temporalConfig.optString("calendar").takeIf { it.isNotBlank() },
          presentation = temporalConfig.optString("presentation").takeIf { it.isNotBlank() }
        )
      )
    } catch (error: Throwable) {
      onError(
        mapOf(
          "code" to "picker_host_decode_failed",
          "message" to (error.message ?: "unknown")
        )
      )
      NativePickerPayload(
        screenId = screenId,
        pickerId = "picker",
        title = "PickerHost",
        subtitle = null,
        valueISO = null,
        temporalConfig = NativePickerTemporalConfig(
          mode = "date",
          minISO = null,
          maxISO = null,
          minuteInterval = null,
          locale = null,
          timeZone = null,
          calendar = null,
          presentation = null
        )
      )
    }
  }

  private fun render() {
    titleView.text = payload.title
    subtitleView.text = payload.subtitle
    subtitleView.visibility = if (payload.subtitle.isNullOrBlank()) View.GONE else View.VISIBLE

    initializeState()
    renderSummary()
    rebuildEditor()
  }

  private fun initializeState() {
    val zone = currentZoneId()

    if (payload.temporalConfig.mode == "countDownTimer") {
      countdownMinutes = parseCountdownMinutes(payload.valueISO) ?: 15
    } else {
      currentDateTime = parseDateTime(payload.valueISO, zone) ?: ZonedDateTime.now(zone)
    }
  }

  private fun renderSummary() {
    summaryView.text = "Current Value: ${currentValueText()}"

    val metadataLines = mutableListOf<String>()
    metadataLines += "mode: ${payload.temporalConfig.mode}"
    metadataLines += "presentation: ${payload.temporalConfig.presentation ?: "automatic"}"
    payload.temporalConfig.timeZone?.let { metadataLines += "timeZone: $it" }
    payload.temporalConfig.minuteInterval?.let { metadataLines += "minuteInterval: $it" }
    metadataView.text = metadataLines.joinToString(separator = "\n")
  }

  private fun rebuildEditor() {
    editorContainer.removeAllViews()

    when (payload.temporalConfig.mode) {
      "date" -> buildDateEditor()
      "time" -> buildTimeEditor()
      "dateTime" -> buildDateTimeEditor()
      "countDownTimer" -> buildCountdownEditor()
      else -> buildDateEditor()
    }
  }

  private fun buildDateEditor() {
    if (payload.temporalConfig.presentation == "inline") {
      val picker = DatePicker(context)
      val minDate = parseInstantMillis(payload.temporalConfig.minISO)
      val maxDate = parseInstantMillis(payload.temporalConfig.maxISO)
      minDate?.let { picker.minDate = it }
      maxDate?.let { picker.maxDate = it }
      picker.updateDate(currentDateTime.year, currentDateTime.monthValue - 1, currentDateTime.dayOfMonth)
      picker.setOnDateChangedListener { _, year, monthOfYear, dayOfMonth ->
        currentDateTime = currentDateTime
          .withYear(year)
          .withMonth(monthOfYear + 1)
          .withDayOfMonth(dayOfMonth)
        renderSummary()
      }
      editorContainer.addView(picker)
      return
    }

    editorContainer.addView(
      createActionButton("날짜 선택") {
        openDateDialog()
      }
    )
  }

  private fun buildTimeEditor() {
    if (payload.temporalConfig.presentation == "inline") {
      val picker = TimePicker(context)
      picker.setIs24HourView(DateFormat.is24HourFormat(context))
      picker.hour = currentDateTime.hour
      picker.minute = roundedMinute(currentDateTime.minute)
      picker.setOnTimeChangedListener { _, hourOfDay, minute ->
        applyTimeChange(hourOfDay, minute)
      }
      editorContainer.addView(picker)
      return
    }

    editorContainer.addView(
      createActionButton("시간 선택") {
        openTimeDialog()
      }
    )
  }

  private fun buildDateTimeEditor() {
    val row = LinearLayout(context).apply {
      orientation = HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }

    row.addView(
      createActionButton("날짜") {
        openDateDialog()
      },
      LinearLayout.LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f).apply {
        marginEnd = dp(6)
      }
    )
    row.addView(
      createActionButton("시간") {
        openTimeDialog()
      },
      LinearLayout.LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f).apply {
        marginStart = dp(6)
      }
    )

    editorContainer.addView(row)
  }

  private fun buildCountdownEditor() {
    val row = LinearLayout(context).apply {
      orientation = HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }

    val totalHours = countdownMinutes / 60
    val totalMinutes = countdownMinutes % 60
    val minuteStep = payload.temporalConfig.minuteInterval ?: 5

    val hourPicker = createNumberPicker(0, 23, totalHours)
    val minutePicker = createNumberPicker(0, (60 / minuteStep) - 1, totalMinutes / minuteStep).apply {
      displayedValues = Array((60 / minuteStep)) { index ->
        String.format(Locale.US, "%02d", index * minuteStep)
      }
      wrapSelectorWheel = false
    }

    hourPicker.setOnValueChangedListener { _, _, newValue ->
      countdownMinutes = (newValue * 60) + ((minutePicker.value) * minuteStep)
      renderSummary()
    }

    minutePicker.setOnValueChangedListener { _, _, newValue ->
      countdownMinutes = (hourPicker.value * 60) + (newValue * minuteStep)
      renderSummary()
    }

    row.addView(createPickerColumn("시간", hourPicker), LinearLayout.LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f))
    row.addView(createPickerColumn("분", minutePicker), LinearLayout.LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f))
    editorContainer.addView(row)
  }

  private fun openDateDialog() {
    val zone = currentZoneId()
    val minMillis = parseInstantMillis(payload.temporalConfig.minISO)
    val maxMillis = parseInstantMillis(payload.temporalConfig.maxISO)

    DatePickerDialog(
      context,
      { _, year, month, dayOfMonth ->
        currentDateTime = currentDateTime
          .withZoneSameInstant(zone)
          .withYear(year)
          .withMonth(month + 1)
          .withDayOfMonth(dayOfMonth)
        renderSummary()
      },
      currentDateTime.year,
      currentDateTime.monthValue - 1,
      currentDateTime.dayOfMonth
    ).apply {
      datePicker.minDate = minMillis ?: datePicker.minDate
      datePicker.maxDate = maxMillis ?: datePicker.maxDate
    }.show()
  }

  private fun openTimeDialog() {
    TimePickerDialog(
      context,
      { _, hourOfDay, minute ->
        applyTimeChange(hourOfDay, minute)
      },
      currentDateTime.hour,
      roundedMinute(currentDateTime.minute),
      DateFormat.is24HourFormat(context)
    ).show()
  }

  private fun createActionButton(title: String, onClick: () -> Unit): Button {
    return Button(context).apply {
      text = title
      setOnClickListener { onClick() }
    }
  }

  private fun createNumberPicker(minValue: Int, maxValue: Int, value: Int): NumberPicker {
    return NumberPicker(context).apply {
      this.minValue = minValue
      this.maxValue = maxValue
      this.value = value.coerceIn(minValue, maxValue)
      wrapSelectorWheel = false
    }
  }

  private fun createPickerColumn(label: String, picker: NumberPicker): LinearLayout {
    val column = LinearLayout(context).apply {
      orientation = VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
    }

    val labelView = TextView(context).apply {
      text = label
      setTextColor(Color.parseColor("#6B7280"))
      textSize = 12f
      setPadding(0, 0, 0, dp(8))
    }

    column.addView(labelView)
    column.addView(picker)
    return column
  }

  private fun currentValueText(): String {
    val locale = payload.temporalConfig.locale
      ?.let(::localeFromIdentifier)
      ?: Locale.getDefault()

    return when (payload.temporalConfig.mode) {
      "date" -> currentDateTime.format(DateTimeFormatter.ofPattern("yyyy-MM-dd", locale))
      "time" -> currentDateTime.format(DateTimeFormatter.ofPattern(if (DateFormat.is24HourFormat(context)) "HH:mm" else "h:mm a", locale))
      "dateTime" -> currentDateTime.format(DateTimeFormatter.ofPattern(if (DateFormat.is24HourFormat(context)) "yyyy-MM-dd HH:mm" else "yyyy-MM-dd h:mm a", locale))
      "countDownTimer" -> formatCountdownMinutes(countdownMinutes)
      else -> currentDateTime.toString()
    }
  }

  private fun currentZoneId(): ZoneId {
    return payload.temporalConfig.timeZone
      ?.let { timeZoneId ->
        try {
          ZoneId.of(timeZoneId)
        } catch (_: Throwable) {
          null
        }
      }
      ?: ZoneId.systemDefault()
  }

  private fun parseDateTime(value: String?, zoneId: ZoneId): ZonedDateTime? {
    if (value.isNullOrBlank()) {
      return null
    }

    return try {
      Instant.parse(value).atZone(zoneId)
    } catch (_: DateTimeParseException) {
      try {
        ZonedDateTime.parse(value).withZoneSameInstant(zoneId)
      } catch (_: DateTimeParseException) {
        try {
          LocalDate.parse(value).atStartOfDay(zoneId)
        } catch (_: DateTimeParseException) {
          null
        }
      }
    }
  }

  private fun parseInstantMillis(value: String?): Long? {
    if (value.isNullOrBlank()) {
      return null
    }

    return try {
      Instant.parse(value).toEpochMilli()
    } catch (_: DateTimeParseException) {
      try {
        LocalDate.parse(value).atStartOfDay(currentZoneId()).toInstant().toEpochMilli()
      } catch (_: DateTimeParseException) {
        null
      }
    }
  }

  private fun parseCountdownMinutes(value: String?): Int? {
    if (value.isNullOrBlank()) {
      return null
    }

    return try {
      Duration.parse(value).toMinutes().toInt()
    } catch (_: DateTimeParseException) {
      null
    }
  }

  private fun roundedMinute(minute: Int): Int {
    val interval = payload.temporalConfig.minuteInterval ?: return minute
    val rounded = ((minute + (interval / 2)) / interval) * interval
    return if (rounded == 60) 0 else rounded
  }

  private fun applyTimeChange(hourOfDay: Int, minute: Int) {
    val interval = payload.temporalConfig.minuteInterval
    val rounded = if (interval == null) {
      minute
    } else {
      ((minute + (interval / 2)) / interval) * interval
    }
    val carry = if (rounded == 60) 1 else 0
    val finalMinute = if (rounded == 60) 0 else rounded
    val finalHour = (hourOfDay + carry) % 24

    currentDateTime = currentDateTime
      .withHour(finalHour)
      .withMinute(finalMinute)
    renderSummary()
  }

  private fun formatCountdownMinutes(totalMinutes: Int): String {
    val hours = totalMinutes / 60
    val minutes = totalMinutes % 60
    return if (hours > 0) {
      "${hours}h ${minutes}m"
    } else {
      "${minutes}m"
    }
  }

  private fun localeFromIdentifier(identifier: String): Locale {
    return Locale.forLanguageTag(identifier.replace('_', '-'))
  }

  private fun dp(value: Int): Int {
    return (value * resources.displayMetrics.density).toInt()
  }
}
