import React, { useRef, useLayoutEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import WeekRow from './WeekRow';
import { CELL_HEIGHT, SCREEN_WIDTH } from './constants';

const MonthlyView = forwardRef(({ weeks, currentDate, onDatePress, onVisibleWeeksChange, initialIndex }, ref) => {
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

    const renderItem = useCallback(({ item }) => (
        <WeekRow
            week={item}
            currentDate={currentDate}
            onPressDate={onDatePress}
        />
    ), [currentDate, onDatePress]);

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
export default React.memo(MonthlyView, (prev, next) => {
    // 1. 보여지는 날짜 범위(weeks 데이터)가 바뀌었는가?
    const isWeeksSame = prev.weeks === next.weeks;
    // 2. 현재 선택된 날짜가 바뀌었는가?
    const isDateSame = prev.currentDate === next.currentDate;

    // 둘 다 같다면 리렌더링 하지 않음 (투두 리스트가 업데이트돼도 달력은 가만히 있음)
    return isWeeksSame && isDateSame;
});
