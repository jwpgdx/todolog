import React, { useRef, useLayoutEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { View, Platform } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import WeekRow from './WeekRow';
import { SCREEN_WIDTH, CELL_HEIGHT } from './constants';

const WeeklyView = forwardRef(({ weeks, onDatePress, initialIndex, onWeekChange, eventsByDate = {} }, ref) => {
    const listRef = useRef(null);
    const scrollOffset = useRef(initialIndex * SCREEN_WIDTH);

    // ⚡️ 부모에서 호출 가능한 메소드 노출
    useImperativeHandle(ref, () => ({
        scrollToIndex: (index, animated = true) => {
            listRef.current?.scrollToIndex({ index, animated });
            scrollOffset.current = index * SCREEN_WIDTH;
        }
    }));

    // ✨ 핵심 안정성 로직: 렌더링 전 초기 인덱스로 즉시 이동하여 깜빡임 방지
    useLayoutEffect(() => {
        if (listRef.current && initialIndex !== -1) {
            listRef.current.scrollToIndex({ index: initialIndex, animated: false });
            scrollOffset.current = initialIndex * SCREEN_WIDTH;
        }
    }, []);

    // ⚡️ 성능 최적화: currentDate는 WeekRow에서 직접 store 구독하므로 dependency에서 제거
    const renderItem = useCallback(({ item }) => (
        // 페이징이 정확하게 되도록 너비 강제
        <View style={{ width: SCREEN_WIDTH }}>
            <WeekRow
                week={item}
                onPressDate={onDatePress}
                eventsByDate={eventsByDate}
            />
        </View>
    ), [onDatePress, eventsByDate]);

    const onMomentumScrollEnd = useCallback((e) => {
        // 오프셋을 기준으로 현재 인덱스 계산
        const offsetX = e.nativeEvent.contentOffset.x;
        const index = Math.round(offsetX / SCREEN_WIDTH);
        scrollOffset.current = offsetX;

        // 부모 컴포넌트에 새로운 주 정보 알림 (헤더 업데이트용)
        if (weeks[index] && onWeekChange) {
            onWeekChange(weeks[index][0].dateObj, index);
        }
    }, [weeks, onWeekChange]);

    // 🖱️ 웹 마우스 드래그 지원
    const isWeb = Platform.OS === 'web';

    // 웹일 경우에만 제스처 연결, 네이티브는 FlashList 자체 기능 사용
    const panGesture = Gesture.Pan()
        .enabled(isWeb)
        .onStart(() => {
            // 시작 시 별도 동작 없음
        })
        .onUpdate((e) => {
            if (listRef.current) {
                // 새로운 오프셋 계산 (드래그 반대 방향으로 스크롤)
                const newOffset = scrollOffset.current - e.translationX;
                listRef.current.scrollToOffset({ offset: newOffset, animated: false });
            }
        })
        .onEnd((e) => {
            if (listRef.current) {
                // ⚡️ 감도 및 속도 로직
                const velocity = e.velocityX;
                const dragDistance = e.translationX; // +는 오른쪽(이전), -는 왼쪽(다음)

                // 현재 위치 기준 인덱스
                const currentIndex = Math.round(scrollOffset.current / SCREEN_WIDTH);
                let targetIndex = currentIndex;

                // 속도가 빠르거나(500 이상) 이동 거리가 50px 이상이면 페이지 넘김
                if (Math.abs(velocity) > 500) {
                    // 빠른 스와이프
                    const direction = velocity > 0 ? -1 : 1;
                    targetIndex = currentIndex + direction;
                } else if (Math.abs(dragDistance) > 20) {
                    // 느리지만 확실한 드래그 (> 20px)
                    const direction = dragDistance > 0 ? -1 : 1;
                    targetIndex = currentIndex + direction;
                }

                // 인덱스 범위 제한
                targetIndex = Math.max(0, Math.min(targetIndex, weeks.length - 1));

                listRef.current.scrollToIndex({ index: targetIndex, animated: true });

                // 다음 드래그 시작을 위해 오프셋 업데이트
                scrollOffset.current = targetIndex * SCREEN_WIDTH;

                // ⚡️ Web Fix: Manually trigger header update since onMomentumScrollEnd won't fire
                if (weeks[targetIndex] && onWeekChange) {
                    onWeekChange(weeks[targetIndex][0].dateObj, targetIndex);
                }
            }
        });

    const Container = isWeb ? GestureDetector : View;
    const containerProps = isWeb ? { gesture: panGesture } : { style: { height: CELL_HEIGHT, width: SCREEN_WIDTH } };

    return (
        <Container {...containerProps}>
            {/*
                웹에서는 GestureDetector가 자식 View를 감싸야 동작함.
                FlashList 자체가 View 역할을 하지만, 명시적인 View로 감싸는 것이 안전함.
            */}
            <View style={{ height: CELL_HEIGHT, width: SCREEN_WIDTH }}>
                <FlashList
                    ref={listRef}
                    data={weeks}
                    renderItem={renderItem}
                    keyExtractor={(item, index) => `week-${index}`}
                    estimatedItemSize={SCREEN_WIDTH}
                    initialScrollIndex={initialIndex}

                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}

                    // 네이티브 스냅 (정밀도 보장)
                    snapToInterval={SCREEN_WIDTH}
                    snapToAlignment="start"
                    decelerationRate="fast"

                    // 성능 최적화
                    drawDistance={SCREEN_WIDTH * 2} // 1-2페이지 미리 렌더링
                    removeClippedSubviews={false}   // 안드로이드 공백 현상 방지
                    onMomentumScrollEnd={onMomentumScrollEnd}

                    // 웹 스크롤 설정
                    // 직접 제스처를 다루므로 웹에서는 네이티브 스크롤 비활성화
                    scrollEnabled={!isWeb}
                />
            </View>
        </Container>
    );
});

export default WeeklyView;
