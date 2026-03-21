import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useDateStore } from "../../../store/dateStore";
import { useTodayDate } from "../../../hooks/useTodayDate";
import { useSettings } from "../../../hooks/queries/useSettings";
import { useWeekFlowDaySummaryRange } from "../../calendar-day-summaries";
import {
  formatHeaderYearMonth,
  getWeekdayLabels,
  resolveCalendarLanguage,
} from "../utils/weekFlowLocaleUtils";
import { addDays, addWeeks, toWeekStart } from "../utils/weekFlowDateUtils";

import WeekFlowHeader from "./WeekFlowHeader";
import WeekModeRow from "./WeekModeRow";
import WeekFlowModeToggleBar from "./WeekFlowModeToggleBar";

export default function WeekFlowWeekly({
  onToggleMode,
  showToggle = true,
  visibleWeekStart: visibleWeekStartProp,
  selectedDate: selectedDateProp,
  onVisibleWeekStartChange,
  embedded = false,
  enableDaySummaries = true,
}) {
  const { currentDate, setCurrentDate } = useDateStore();
  const { todayDate } = useTodayDate();
  const { data: settings = {} } = useSettings();

  const startDayOfWeek = settings.startDayOfWeek || "sunday";
  const language = resolveCalendarLanguage(settings.language || "system");

  const resolvedVisibleWeekStart = useMemo(() => {
    if (visibleWeekStartProp) return visibleWeekStartProp;
    return toWeekStart(currentDate, startDayOfWeek);
  }, [currentDate, startDayOfWeek, visibleWeekStartProp]);
  const [displayWeekStart, setDisplayWeekStart] = useState(
    () => resolvedVisibleWeekStart,
  );

  useEffect(() => {
    if (!resolvedVisibleWeekStart) return;
    setDisplayWeekStart((prev) =>
      prev === resolvedVisibleWeekStart ? prev : resolvedVisibleWeekStart,
    );
  }, [resolvedVisibleWeekStart]);

  const visibleWeekStart = displayWeekStart || resolvedVisibleWeekStart;
  const selectedDate = selectedDateProp || currentDate;

  const commitVisibleWeekStart = useCallback(
    (nextWeekStart) => {
      if (!nextWeekStart) return;
      setDisplayWeekStart((prev) =>
        prev === nextWeekStart ? prev : nextWeekStart,
      );
      onVisibleWeekStartChange?.(nextWeekStart);
    },
    [onVisibleWeekStartChange],
  );

  const headerTitle = useMemo(() => {
    if (!visibleWeekStart || visibleWeekStart.length < 7) return "";
    const year = Number(visibleWeekStart.slice(0, 4));
    const month1Based = Number(visibleWeekStart.slice(5, 7));
    if (!Number.isFinite(year) || !Number.isFinite(month1Based)) return "";
    return formatHeaderYearMonth(year, month1Based, language);
  }, [language, visibleWeekStart]);

  const weekdayLabels = useMemo(
    () => getWeekdayLabels(language, startDayOfWeek),
    [language, startDayOfWeek],
  );

  const showTodayJumpButton = useMemo(() => {
    if (!todayDate || !visibleWeekStart) return false;
    const todayWeekStart = toWeekStart(todayDate, startDayOfWeek);
    return todayWeekStart != null && todayWeekStart !== visibleWeekStart;
  }, [startDayOfWeek, todayDate, visibleWeekStart]);

  const onTodayJump = useCallback(() => {
    if (!todayDate) return;
    const todayWeekStart = toWeekStart(todayDate, startDayOfWeek);
    commitVisibleWeekStart(todayWeekStart);
    setCurrentDate(todayDate);
  }, [commitVisibleWeekStart, setCurrentDate, startDayOfWeek, todayDate]);

  const onPrev = useCallback(() => {
    if (!visibleWeekStart) return;
    const nextWeekStart = addWeeks(visibleWeekStart, -1);
    commitVisibleWeekStart(nextWeekStart);
  }, [commitVisibleWeekStart, visibleWeekStart]);

  const onNext = useCallback(() => {
    if (!visibleWeekStart) return;
    const nextWeekStart = addWeeks(visibleWeekStart, 1);
    commitVisibleWeekStart(nextWeekStart);
  }, [commitVisibleWeekStart, visibleWeekStart]);

  const onDayPress = useCallback(
    (dateYmd) => {
      if (!dateYmd) return;
      commitVisibleWeekStart(toWeekStart(dateYmd, startDayOfWeek));
      setCurrentDate(dateYmd);
    },
    [commitVisibleWeekStart, setCurrentDate, startDayOfWeek],
  );

  const activeRange = useMemo(() => {
    if (!visibleWeekStart) return null;
    const startDate = addDays(visibleWeekStart, -14);
    const endDate = addDays(visibleWeekStart, 20);
    if (!startDate || !endDate) return null;
    return { startDate, endDate };
  }, [visibleWeekStart]);

  const getIsViewportSettled = useCallback(() => true, []);

  useWeekFlowDaySummaryRange({
    mode: "weekly",
    activeRange: enableDaySummaries ? activeRange : null,
    retentionAnchorDate: enableDaySummaries ? visibleWeekStart : null,
    viewportSettledToken: enableDaySummaries ? visibleWeekStart : null,
    getIsViewportSettled,
  });

  return (
    <View style={[styles.container, embedded ? styles.embeddedContainer : null]}>
      <WeekFlowHeader
        title={headerTitle}
        mode="weekly"
        showTodayJumpButton={showTodayJumpButton}
        onTodayJump={onTodayJump}
        onPrev={onPrev}
        onNext={onNext}
        onToggleMode={onToggleMode}
        showToggle={showToggle}
      />

      <View style={styles.weekdayRow}>
        {weekdayLabels.map((label) => (
          <View key={label} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{label}</Text>
          </View>
        ))}
      </View>

      <WeekModeRow
        visibleWeekStart={visibleWeekStart}
        todayDate={todayDate}
        selectedDate={selectedDate}
        language={language}
        onDayPress={onDayPress}
        onPrevWeek={onPrev}
        onNextWeek={onNext}
      />

      {showToggle ? (
        <WeekFlowModeToggleBar mode="weekly" onToggleMode={onToggleMode} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    overflow: "hidden",
    marginHorizontal: 12,
    marginTop: 12,
  },
  embeddedContainer: {
    borderWidth: 0,
    borderRadius: 0,
    marginHorizontal: 0,
    marginTop: 0,
  },
  weekdayRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  weekdayCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    backgroundColor: "#FFFFFF",
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
  },
});
