import React, { useMemo, useState } from "react";

import { useDateStore } from "../../../store/dateStore";
import { useSettings } from "../../../hooks/queries/useSettings";
import { toWeekStart } from "../utils/weekFlowDateUtils";

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
  const handleWeeklyWeekStartChange = React.useCallback((nextWeekStart) => {
    setWeeklyWeekStart(nextWeekStart);
  }, []);

  return (
    <WeekFlowDragSnapCard
      onWeeklyWeekStartChange={handleWeeklyWeekStartChange}
      weeklyWeekStart={weeklyWeekStart}
    />
  );
}
