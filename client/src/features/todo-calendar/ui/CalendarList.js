import React, { useCallback, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteCalendar } from '../hooks/useInfiniteCalendar';
import MonthSection from './MonthSection';

/**
 * CalendarList Component
 * 
 * FlashList container for infinite scroll calendar with fixed weekday header (Apple Calendar style).
 * 
 * Features:
 * - Fixed weekday header at top (scrolls with content but visually fixed)
 * - Month titles visible in each MonthSection
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

  /**
   * Render individual month section
   * Validates: Requirements 1.2, 1.3
   */
  const renderMonth = useCallback(({ item }) => (
    <MonthSection monthMetadata={item} />
  ), []);

  /**
   * Handle viewable items change to detect top scroll
   * FlashList does not support onStartReached, so we use onViewableItemsChanged
   * Validates: Requirements 1.3, 1.4
   */
  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    // Skip if months array is not initialized yet
    if (months.length === 0 || viewableItems.length === 0) {
      return;
    }

    const firstIdx = viewableItems[0].index;

    // Trigger prepend when user reaches top 3 months
    if (firstIdx !== undefined && firstIdx <= 3) {
      handleStartReached();
    }
  }, [months, handleStartReached]);

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
      {/* Fixed Weekday Header */}
      <View style={styles.weekdayHeader}>
        <Text style={[styles.weekdayText, styles.sunday]}>일</Text>
        <Text style={styles.weekdayText}>월</Text>
        <Text style={styles.weekdayText}>화</Text>
        <Text style={styles.weekdayText}>수</Text>
        <Text style={styles.weekdayText}>목</Text>
        <Text style={styles.weekdayText}>금</Text>
        <Text style={[styles.weekdayText, styles.saturday]}>토</Text>
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
