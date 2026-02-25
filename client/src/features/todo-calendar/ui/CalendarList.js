import React, { useCallback, useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from '@react-navigation/native';
import { useInfiniteCalendar } from '../hooks/useInfiniteCalendar';
import { useTodoCalendarData } from '../hooks/useTodoCalendarData';
import { getWeekdayNames, formatMonthTitle } from '../utils/calendarHelpers';
import { useAuthStore } from '../../../store/authStore';
import { useTodayDate } from '../../../hooks/useTodayDate';
import MonthSection from './MonthSection';

/**
 * CalendarList Component
 * 
 * FlashList container for infinite scroll calendar with fixed header (Apple Calendar style).
 * 
 * Features:
 * - Fixed header showing current visible month (e.g., "2025년 5월")
 * - Fixed weekday header below month title
 * - Month titles visible in each MonthSection (for user convenience)
 * - Fixed height estimation (450px per month: 30px title + 420px weeks)
 * - Bottom scroll: append 6 future months
 * - Top scroll: prepend 6 past months (via onViewableItemsChanged)
 * - maintainVisibleContentPosition: prevent screen jump on prepend
 * - onScrollToIndexFailed: fallback to offset-based scroll
 * 
 * Height Calculation (Apple Calendar style):
 * - TITLE_HEIGHT: 30px (month title)
 * - WEEK_ROW_HEIGHT: 70px (week row)
 * - MONTH_HEIGHT: 30 + (6 × 70) = 450px
 * 
 * Validates: Requirements 1.2, 1.3, 1.4, 3.4, 7.4
 */

// Height constants (Apple Calendar style)
const TITLE_HEIGHT = 30;
const WEEK_ROW_HEIGHT = 70;
const MONTH_HEIGHT = TITLE_HEIGHT + (6 * WEEK_ROW_HEIGHT); // 450px

export default function CalendarList() {
  const {
    months,
    handleEndReached,
    handleStartReached,
    initialScrollIndex,
  } = useInfiniteCalendar();

  const flashListRef = useRef(null);
  const hasHandledInitialViewabilityRef = useRef(false);
  const [currentMonth, setCurrentMonth] = useState(
    months[initialScrollIndex] || months[0]
  );

  // Subscribe to settings from authStore (Selector pattern for optimization)
  const startDayOfWeek = useAuthStore(state => 
    state.user?.settings?.startDayOfWeek === 'monday' ? 1 : 0
  );
  const language = useAuthStore(state => 
    state.user?.settings?.language || 'ko'
  );
  const { todayDate } = useTodayDate();

  // Phase 2: Todo data batch fetch hook
  const { onVisibleMonthsChange, refetchInvalidated } = useTodoCalendarData(startDayOfWeek);

  // Phase 2: Refetch invalidated months on screen focus
  // When user returns from Todo CRUD screen, invalidated months are re-fetched
  useFocusEffect(
    useCallback(() => {
      refetchInvalidated();
    }, [refetchInvalidated])
  );

  // Generate weekday names based on settings (cached with useMemo)
  const weekdayNames = useMemo(() => {
    return getWeekdayNames(language, startDayOfWeek);
  }, [language, startDayOfWeek]);

  // Format current month title based on language
  const currentMonthTitle = useMemo(() => {
    if (!currentMonth) return '';
    return formatMonthTitle(currentMonth.year, currentMonth.month, language);
  }, [currentMonth, language]);

  /**
   * Render individual month section
   * Pass startDayOfWeek and language to MonthSection
   * Validates: Requirements 1.2, 1.3
   */
  const renderMonth = useCallback(({ item }) => (
    <MonthSection 
      monthMetadata={item} 
      startDayOfWeek={startDayOfWeek}
      language={language}
      todayDate={todayDate}
    />
  ), [startDayOfWeek, language, todayDate]);

  /**
   * Handle viewable items change to detect top scroll and update current month
   * FlashList does not support onStartReached, so we use onViewableItemsChanged
   * Phase 2: Also triggers todo data fetch for visible months
   * Validates: Requirements 1.3, 1.4, 7.1, 7.2, 7.3, 7.4, 7.5
   */
  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    // Skip if months array is not initialized yet
    if (months.length === 0 || viewableItems.length === 0) {
      return;
    }

    const isInitialViewability = !hasHandledInitialViewabilityRef.current;
    hasHandledInitialViewabilityRef.current = true;

    const firstIdx = viewableItems[0].index;

    // Update current visible month for header
    if (viewableItems[0]?.item) {
      setCurrentMonth(viewableItems[0].item);
    }

    // Trigger prepend only when user actually scrolls close to the top.
    // (Current month is index=2 initially, so <=3 would cause an immediate prepend and jank.)
    if (firstIdx !== undefined && firstIdx <= 1) {
      if (isInitialViewability) {
        console.log('[CalendarList] Skip initial handleStartReached (avoid first-enter jank)');
      } else {
        handleStartReached();
      }
    }

    // Phase 2: Trigger todo data fetch for visible months
    onVisibleMonthsChange(viewableItems);
  }, [months, handleStartReached, onVisibleMonthsChange]);

  /**
   * Viewability config for onViewableItemsChanged
   * 30% threshold: trigger when 30% of item is visible
   */
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 30,
  }).current;

  /**
   * Handle scroll to index failure
   * Fallback to offset-based scroll
   * Validates: Requirements 7.4
   */
  const onScrollToIndexFailed = useCallback((info) => {
    console.warn('[CalendarList] Scroll to index failed:', info);
    
    // Fallback: use offset-based scroll
    flashListRef.current?.scrollToOffset({
      offset: info.averageItemLength * info.index,
      animated: false,
    });
  }, []);

  /**
   * Extract unique key from month metadata
   */
  const keyExtractor = useCallback((item) => item.id, []);

  return (
    <View style={styles.container}>
      {/* Fixed Header: Current Month Title */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {currentMonthTitle}
        </Text>
      </View>

      {/* Fixed Weekday Header (Dynamic based on settings) */}
      <View style={styles.weekdayHeader}>
        {weekdayNames.map((name, index) => (
          <Text 
            key={index} 
            style={[
              styles.weekdayText,
              index === 0 && styles.sunday,  // First day (Sun or Mon)
              index === 6 && styles.saturday, // Last day (Sat or Sun)
            ]}
          >
            {name}
          </Text>
        ))}
      </View>

      {/* Scrollable Calendar List */}
      <FlashList
        ref={flashListRef}
        data={months}
        renderItem={renderMonth}
        keyExtractor={keyExtractor}
        estimatedItemSize={MONTH_HEIGHT}
        drawDistance={960}
        initialScrollIndex={initialScrollIndex}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.2}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        onScrollToIndexFailed={onScrollToIndexFailed}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  weekdayHeader: {
    flexDirection: 'row',
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  weekdayText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  sunday: {
    color: '#ff4444',  // 일요일 빨강
  },
  saturday: {
    color: '#4444ff',  // 토요일 파랑
  },
});
