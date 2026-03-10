import React, { useMemo } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

import { getWeekMeta } from '../utils/weekFlowWeekMetaCache';
import WeekRow from './WeekRow';

export default function WeekModeRow({
  visibleWeekStart,
  todayDate,
  selectedDate,
  language,
  onDayPress,
  onPrevWeek,
  onNextWeek,
}) {
  const days = useMemo(() => getWeekMeta(visibleWeekStart, language), [language, visibleWeekStart]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderRelease: (_, gestureState) => {
          const dx = gestureState.dx;
          if (dx > 30) {
            onPrevWeek?.();
            return;
          }
          if (dx < -30) {
            onNextWeek?.();
          }
        },
      }),
    [onNextWeek, onPrevWeek]
  );

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <WeekRow
        weekStart={visibleWeekStart}
        days={days}
        selectedDate={selectedDate}
        todayDate={todayDate}
        onDayPress={onDayPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
  },
});

