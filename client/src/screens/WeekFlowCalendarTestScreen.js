import React, { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useDateStore } from "../store/dateStore";
import { useSettings } from "../hooks/queries/useSettings";
import {
  WeekFlowMonthly,
  WeekFlowWeekly,
} from "../features/week-flow-calendar";
import {
  addWeeks,
  toWeekStart,
} from "../features/week-flow-calendar/utils/weekFlowDateUtils";

/**
 * WeekFlowCalendarTestScreen
 *
 * Week Flow Calendar 전용 테스트 화면
 * - Weekly <-> Monthly 전환 + 위치 공유(성능 우선)
 * - 일정/데이터 로딩은 제외 (프로토타입)
 */
export default function WeekFlowCalendarTestScreen() {
  const { currentDate } = useDateStore();
  const { data: settings = {} } = useSettings();

  const startDayOfWeek = settings.startDayOfWeek || "sunday";

  const [mode, setMode] = useState("weekly"); // 'weekly' | 'monthly'
  const topWeekStartRef = useRef(null);
  const [weeklyWeekStart, setWeeklyWeekStart] = useState(() =>
    toWeekStart(currentDate, startDayOfWeek),
  );

  const onWeeklyWeekStartChange = useCallback((weekStart) => {
    if (!weekStart) return;
    setWeeklyWeekStart(weekStart);
  }, []);

  const onTopWeekStartChange = useCallback((weekStart) => {
    if (!weekStart) return;
    topWeekStartRef.current = weekStart;
  }, []);

  const onToggleMode = useCallback(() => {
    if (mode === "weekly") {
      const currentWeekStart =
        weeklyWeekStart || toWeekStart(currentDate, startDayOfWeek);
      topWeekStartRef.current = currentWeekStart;
      setMode("monthly");
      return;
    }

    const topWeekStart =
      topWeekStartRef.current || toWeekStart(currentDate, startDayOfWeek);
    const selectedWeekStart = toWeekStart(currentDate, startDayOfWeek);

    // If the current selection is visible within the 5-week monthly viewport,
    // keep it and just switch modes (no selection jump).
    if (topWeekStart && selectedWeekStart) {
      const visibleEndWeekStart = addWeeks(topWeekStart, 4);
      if (
        visibleEndWeekStart &&
        selectedWeekStart >= topWeekStart &&
        selectedWeekStart <= visibleEndWeekStart
      ) {
        setWeeklyWeekStart(selectedWeekStart);
        setMode("weekly");
        return;
      }
    }

    // Otherwise, align weekly to the top-most visible week (no selection jump).
    if (topWeekStart) {
      setWeeklyWeekStart(topWeekStart);
    }
    setMode("weekly");
  }, [currentDate, mode, startDayOfWeek, weeklyWeekStart]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Week Flow Calendar Test</Text>
        <Text style={styles.infoText}>Mode: {mode}</Text>
        <Text style={styles.infoText}>Selected Date: {currentDate}</Text>
      </View>

      {mode === "weekly" ? (
        <WeekFlowWeekly
          onToggleMode={onToggleMode}
          visibleWeekStart={weeklyWeekStart}
          onVisibleWeekStartChange={onWeeklyWeekStartChange}
        />
      ) : (
        <WeekFlowMonthly
          initialTopWeekStart={weeklyWeekStart}
          onToggleMode={onToggleMode}
          onTopWeekStartChange={onTopWeekStartChange}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  infoCard: {
    marginHorizontal: 12,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  infoText: {
    marginTop: 6,
    fontSize: 13,
    color: "#374151",
  },
});
