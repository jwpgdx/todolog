import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatMonthTitle } from '../../../utils/calendarMonthHelpers';
import { useTodoCalendarV2Store } from '../store/useTodoCalendarV2Store';
import { buildMonthGridWeeks, TC2_MONTH_TITLE_HEIGHT } from '../utils/monthLayoutUtils';
import TodoCalendarV2WeekRow from './TodoCalendarV2WeekRow';

function buildFallbackLayout(monthMetadata, startDayOfWeek, language) {
  const weeks = buildMonthGridWeeks(monthMetadata.year, monthMetadata.month, startDayOfWeek).map((week, weekIndex) => ({
    weekIndex,
    days: week.map((day) => ({ ...day, hiddenCount: 0 })),
    segments: [],
  }));

  return {
    id: monthMetadata.id,
    title: formatMonthTitle(monthMetadata.year, monthMetadata.month, language),
    weeks,
  };
}

function TodoCalendarV2MonthSection({
  monthMetadata,
  startDayOfWeek = 0,
  language = 'ko',
  todayDate,
}) {
  const layout = useTodoCalendarV2Store((state) => state.monthLayoutsById?.[monthMetadata.id] || null);
  const fallbackLayout = useMemo(
    () => buildFallbackLayout(monthMetadata, startDayOfWeek, language),
    [language, monthMetadata, startDayOfWeek],
  );
  const resolvedLayout = layout || fallbackLayout;

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{resolvedLayout.title}</Text>
      </View>

      {resolvedLayout.weeks.map((week) => (
        <TodoCalendarV2WeekRow
          key={`${resolvedLayout.id}-${week.weekIndex}`}
          week={week}
          todayDate={todayDate}
        />
      ))}
    </View>
  );
}

export default React.memo(TodoCalendarV2MonthSection);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
  titleRow: {
    height: TC2_MONTH_TITLE_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
});
