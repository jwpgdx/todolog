import React, { useRef, useLayoutEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import WeekRow from './WeekRow';
import { CELL_HEIGHT, SCREEN_WIDTH } from './constants';

const MonthlyView = forwardRef(({ weeks, onDatePress, onVisibleWeeksChange, initialIndex, eventsByDate = {} }, ref) => {
    const listRef = useRef(null);

    // ⚡️ 부모에서 호출 가능한 메소드 노출
    useImperativeHandle(ref, () => ({
        scrollToIndex: (index, animated = true) => {
            listRef.current?.scrollToIndex({ index, animated });
        }
    }));

    // Initial scroll setup: Jump to the specified index immediately
    // useLayoutEffect(() => {
    //     if (listRef.current && initialIndex !== undefined && initialIndex !== -1) {
    //         listRef.current.scrollToIndex({ index: initialIndex, animated: false });
    //     }
    // }, []);

    // ⚡️ 성능 최적화: currentDate는 WeekRow에서 직접 store 구독하므로 dependency에서 제거
    const renderItem = useCallback(({ item }) => (
        <WeekRow
            week={item}
            onPressDate={onDatePress}
            eventsByDate={eventsByDate}
        />
    ), [onDatePress, eventsByDate]);

    const onViewableItemsChanged = useCallback(({ viewableItems }) => {
        if (viewableItems.length > 0) {
            // Ideally we pass the first visible item to update the header title
            const firstItem = viewableItems[0];
            if (onVisibleWeeksChange) {
                onVisibleWeeksChange(firstItem.item[0].dateObj, firstItem.index);
            }
        }
    }, [onVisibleWeeksChange]);

    // Use a ref for viewabilityConfig to avoid re-creation
    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 50,
        minimumViewTime: 100
    }).current;

    return (
        <View style={{ height: '100%', width: SCREEN_WIDTH }}>
            <FlashList
                ref={listRef}
                data={weeks}
                renderItem={renderItem}
                keyExtractor={(item, index) => `month-week-${index}`}
                estimatedItemSize={CELL_HEIGHT}
                initialScrollIndex={initialIndex}

                showsVerticalScrollIndicator={false}

                // Optimization
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                removeClippedSubviews={false} // Android: sometimes rendering issues with true inside complex views
            />
        </View>
    );
});

// ⚡️ memo 적용 및 비교 함수 추가
// currentDate는 WeekRow에서 직접 구독하므로 여기서는 weeks만 비교
export default React.memo(MonthlyView, (prev, next) => {
    return prev.weeks === next.weeks &&
        prev.onDatePress === next.onDatePress &&
        prev.initialIndex === next.initialIndex &&
        prev.eventsByDate === next.eventsByDate;
});
