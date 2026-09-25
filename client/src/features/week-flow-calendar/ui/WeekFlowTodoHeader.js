import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDateStore } from "../../../store/dateStore";
import { useSettings } from "../../../hooks/queries/useSettings";
import { addDays, toWeekStart } from "../utils/weekFlowDateUtils";

import WeekFlowDragSnapCard from "./WeekFlowDragSnapCard";

export default function WeekFlowTodoHeader() {
  const { currentDate } = useDateStore();
  const { data: settings = {} } = useSettings();

  const startDayOfWeek = settings.startDayOfWeek || "sunday";
  const currentWeekStart = useMemo(
    () => toWeekStart(currentDate, startDayOfWeek),
    [currentDate, startDayOfWeek],
  );
  const [weeklyWeekStart, setWeeklyWeekStart] = useState(() => currentWeekStart);
  const [calendarMode, setCalendarMode] = useState("weekly");
  const previousCurrentDateRef = useRef(currentDate);
  const previousStartDayOfWeekRef = useRef(startDayOfWeek);

  const handleWeeklyWeekStartChange = useCallback((nextWeekStart) => {
    setWeeklyWeekStart(nextWeekStart);
  }, []);
  const handleModeChange = useCallback((nextMode) => {
    setCalendarMode(nextMode === "monthly" ? "monthly" : "weekly");
  }, []);

  useEffect(() => {
    const previousStartDayOfWeek = previousStartDayOfWeekRef.current;
    previousStartDayOfWeekRef.current = startDayOfWeek;
    if (previousStartDayOfWeek === startDayOfWeek) return;

    setWeeklyWeekStart((previousWeekStart) => {
      const previousSelectedWeekStart = toWeekStart(
        currentDate,
        previousStartDayOfWeek,
      );
      const selectedWasVisible =
        Boolean(previousWeekStart) &&
        previousWeekStart === previousSelectedWeekStart;
      const fallbackAnchor = previousWeekStart
        ? addDays(previousWeekStart, 3)
        : currentDate;
      const anchorDate = selectedWasVisible ? currentDate : fallbackAnchor;
      return toWeekStart(anchorDate, startDayOfWeek) || previousWeekStart;
    });
  }, [currentDate, startDayOfWeek]);

  useEffect(() => {
    const previousCurrentDate = previousCurrentDateRef.current;
    previousCurrentDateRef.current = currentDate;
    if (!currentDate || previousCurrentDate === currentDate) return;
    if (calendarMode !== "weekly") return;

    setWeeklyWeekStart((previousWeekStart) => {
      const previousSelectedWeekStart = toWeekStart(
        previousCurrentDate,
        startDayOfWeek,
      );
      const nextSelectedWeekStart = toWeekStart(currentDate, startDayOfWeek);

      if (
        previousWeekStart &&
        previousSelectedWeekStart &&
        previousWeekStart !== previousSelectedWeekStart
      ) {
        return previousWeekStart;
      }

      return nextSelectedWeekStart || previousWeekStart;
    });
  }, [calendarMode, currentDate, startDayOfWeek]);

  return (
    <WeekFlowDragSnapCard
      onModeChange={handleModeChange}
      onWeeklyWeekStartChange={handleWeeklyWeekStartChange}
      weeklyWeekStart={weeklyWeekStart}
    />
  );
}
