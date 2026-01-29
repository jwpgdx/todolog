import React, { useRef, useLayoutEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import WeekRow from './WeekRow';
import { CELL_HEIGHT, SCREEN_WIDTH } from './constants';

const MonthlyView = forwardRef(({ 
    weeks, 
    onDatePress, 
    onVisibleWeeksChange, 
    initialIndex, 
    eventsByDate = {},
    onEndReached,
    onStartReached 
}, ref) => {
    const listRef = useRef(null);
    const visibleIndexRef = useRef(initialIndex);
    const scrollOffsetRef = useRef(0); // ✅ 스크롤 오프셋 추적
    
    // ✅ 로딩 상태 추적
    const isLoadingMore = useRef(false);
    const isLoadingPast = useRef(false);

    // ⚡️ 부모에서 호출 가능한 메소드 노출
    useImperativeHandle(ref, () => ({
        scrollToIndex: (index, animated = true) => {
            listRef.current?.scrollToIndex({ index, animated });
        },
        scrollToOffset: (offset, animated = false) => {
            listRef.current?.scrollToOffset({ offset, animated });
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

    const onScroll = useCallback((e) => {
        scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
    }, []);

    const onViewableItemsChanged = useCallback(({ viewableItems }) => {
        if (viewableItems.length > 0) {
            // Ideally we pass the first visible item to update the header title
            const firstItem = viewableItems[0];
            const firstIndex = firstItem.index;
            visibleIndexRef.current = firstIndex;
            
            // ✅ 무한 스크롤 트리거 (끝에서 15주 이내, 로딩 중이 아닐 때만)
            if (onEndReached && firstIndex >= weeks.length - 15 && !isLoadingMore.current) {
                isLoadingMore.current = true;
                onEndReached();
                setTimeout(() => { isLoadingMore.current = false; }, 1000);
            }
            if (onStartReached && firstIndex <= 15 && !isLoadingPast.current) {
                isLoadingPast.current = true;
                onStartReached(scrollOffsetRef.current); // ✅ 현재 오프셋 전달
                setTimeout(() => { isLoadingPast.current = false; }, 1000);
            }
            
            if (onVisibleWeeksChange) {
                onVisibleWeeksChange(firstItem.item[0].dateObj, firstIndex);
            }
        }
    }, [onVisibleWeeksChange, onEndReached, onStartReached, weeks.length]);

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
                onScroll={onScroll}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                removeClippedSubviews={false} // Android: sometimes rendering issues with true inside complex views
            />
        </View>
    );
});

// ⚡️ memo 적용 및 비교 함수 추가
export default React.memo(MonthlyView, (prev, next) => {
    return prev.weeks === next.weeks &&
        prev.onDatePress === next.onDatePress &&
        prev.initialIndex === next.initialIndex &&
        prev.eventsByDate === next.eventsByDate &&
        prev.onEndReached === next.onEndReached &&
        prev.onStartReached === next.onStartReached;
});
