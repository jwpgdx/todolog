import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useFloatingTabBarScrollPadding } from '../../../navigation/useFloatingTabBarInset';
import { useFocusEffect } from 'expo-router';

import { useAuthStore } from '../../../store/authStore';
import { useTodayDate } from '../../../hooks/useTodayDate';
import { getWeekdayNames, formatMonthTitle } from '../../../utils/calendarMonthHelpers';
import { useTodoCalendarV2Data } from '../hooks/useTodoCalendarV2Data';
import { useTodoCalendarV2InfiniteMonths } from '../hooks/useTodoCalendarV2InfiniteMonths';
import { TC2_MONTH_HEIGHT } from '../utils/monthLayoutUtils';
import TodoCalendarV2MonthSection from './TodoCalendarV2MonthSection';

export default function TodoCalendarV2CalendarList() {
  const bottomInset = useFloatingTabBarScrollPadding(16);
  const isFocusedRef = useRef(true);
  const hasHandledInitialViewabilityRef = useRef(false);
  const hasDispatchedSyntheticInitialRef = useRef(false);
  const flashListRef = useRef(null);
  const {
    months,
    handleEndReached,
    handleStartReached,
    initialScrollIndex,
  } = useTodoCalendarV2InfiniteMonths();

  const startDayOfWeek = useAuthStore((state) =>
    state.user?.settings?.startDayOfWeek === 'monday' ? 1 : 0,
  );
  const language = useAuthStore((state) => state.user?.settings?.language || 'ko');
  const weekdayNames = useMemo(
    () => getWeekdayNames(language, startDayOfWeek),
    [language, startDayOfWeek],
  );
  const { todayDate } = useTodayDate();
  const { onVisibleMonthsChange } = useTodoCalendarV2Data({
    startDayOfWeek,
    language,
  });

  const [currentMonth, setCurrentMonth] = useState(
    months[initialScrollIndex] || months[0] || null,
  );

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      return () => {
        isFocusedRef.current = false;
      };
    }, []),
  );

  const currentMonthTitle = useMemo(() => {
    if (!currentMonth) return '';
    return formatMonthTitle(currentMonth.year, currentMonth.month, language);
  }, [currentMonth, language]);

  const renderMonth = useCallback(({ item }) => (
    <TodoCalendarV2MonthSection
      monthMetadata={item}
      startDayOfWeek={startDayOfWeek}
      language={language}
      todayDate={todayDate}
    />
  ), [language, startDayOfWeek, todayDate]);

  const handleVisibleItems = useCallback((viewableItems) => {
    if (!isFocusedRef.current) return;
    if (!Array.isArray(viewableItems) || viewableItems.length === 0) return;

    const isInitial = !hasHandledInitialViewabilityRef.current;
    hasHandledInitialViewabilityRef.current = true;

    if (viewableItems[0]?.item) {
      setCurrentMonth(viewableItems[0].item);
    }

    const firstIndex = viewableItems[0]?.index;
    if (Number.isFinite(firstIndex) && firstIndex <= 1 && !isInitial) {
      handleStartReached();
    }

    onVisibleMonthsChange(viewableItems);
  }, [handleStartReached, onVisibleMonthsChange]);

  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    handleVisibleItems(viewableItems);
  }, [handleVisibleItems]);

  useEffect(() => {
    if (hasDispatchedSyntheticInitialRef.current) return;
    if (!Array.isArray(months) || months.length === 0) return;

    const initialItem = months[initialScrollIndex] || months[0];
    if (!initialItem) return;

    hasDispatchedSyntheticInitialRef.current = true;
    handleVisibleItems([
      {
        item: initialItem,
        index: initialScrollIndex,
      },
    ]);
  }, [handleVisibleItems, initialScrollIndex, months]);

  const onEndReached = useCallback(() => {
    if (!isFocusedRef.current) return;
    handleEndReached();
  }, [handleEndReached]);

  const keyExtractor = useCallback((item) => item.id, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{currentMonthTitle}</Text>
      </View>

      <View style={styles.weekdayHeader}>
        {weekdayNames.map((name, index) => (
          <Text
            key={`${name}-${index}`}
            style={[
              styles.weekdayText,
              index === 0 && styles.firstDayText,
              index === 6 && styles.lastDayText,
            ]}
          >
            {name}
          </Text>
        ))}
      </View>

      <FlashList
        ref={flashListRef}
        data={months}
        renderItem={renderMonth}
        keyExtractor={keyExtractor}
        estimatedItemSize={TC2_MONTH_HEIGHT}
        drawDistance={TC2_MONTH_HEIGHT * 2}
        initialScrollIndex={initialScrollIndex}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.2}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 30 }}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        contentContainerStyle={{ paddingBottom: bottomInset }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  weekdayHeader: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  weekdayText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    color: '#475569',
  },
  firstDayText: {
    color: '#DC2626',
  },
  lastDayText: {
    color: '#2563EB',
  },
});
