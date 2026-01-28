import React, { useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { FlashList } from '@shopify/flash-list';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import 'dayjs/locale/ko';
import { useDateStore } from '../store/dateStore'; // ✅ Global Store Import

dayjs.extend(weekOfYear);
dayjs.locale('ko');

const SCREEN_WIDTH = Dimensions.get('window').width;
const COLUMN_WIDTH = SCREEN_WIDTH / 7;
const CELL_HEIGHT = SCREEN_WIDTH / 7;
const WEEK_DAY_HEIGHT = 16;
const HANDLE_BAR_HEIGHT = 20;
const CALENDAR_HEIGHT_WEEK = SCREEN_WIDTH / 7 + WEEK_DAY_HEIGHT + HANDLE_BAR_HEIGHT;
const CALENDAR_HEIGHT_MONTH = CELL_HEIGHT * 5 + WEEK_DAY_HEIGHT + HANDLE_BAR_HEIGHT;

// 주 컴포넌트 (7개 날짜)
const WeekRow = React.memo(({ week, currentDate, onPressDate }) => {
    return (
        <View style={styles.weekRow}>
            {week.map((day, idx) => {
                const isSelected = day.dateString === currentDate;
                return (
                    <TouchableOpacity
                        key={idx}
                        style={[styles.cell, { backgroundColor: day.bgColor }]}
                        onPress={() => onPressDate(day.dateString)}
                        activeOpacity={0.7}
                    >
                        <View style={[
                            styles.dateContainer,
                            day.isToday && styles.todayContainer,
                            isSelected && styles.selectedContainer // ✅ Selection Style Overrides Today if needed, or co-exists
                        ]}>
                            <Text style={[
                                styles.dateText,
                                { color: isSelected ? 'white' : (day.isToday ? 'white' : day.textColor) },
                                day.isFirstDay && { fontWeight: 'bold' }
                            ]}>
                                {day.text}
                            </Text>
                        </View>
                        {/* Selected Indicator Dot (Optional) */}
                        {isSelected && !day.isToday && (
                            <View style={styles.selectionDot} />
                        )}
                    </TouchableOpacity>
                );
            })}
        </View>
    );
});

export default function OptimizedCalendar() {
    const today = dayjs();
    const { currentDate, setCurrentDate } = useDateStore(); // ✅ Use Global Store

    const height = useSharedValue(CALENDAR_HEIGHT_WEEK); // 시작은 Weekly
    const listRef = useRef(null);
    const [isWeekly, setIsWeekly] = useState(true); // 시작 모드
    const [headerTitle, setHeaderTitle] = useState('');
    const [weekNumber, setWeekNumber] = useState('');
    const currentIndexRef = useRef(0);
    const scrollEnabledRef = useRef(!true); // Weekly는 스크롤 잠금

    // ✅ 스냅 기능을 위한 Ref 추가
    const scrollY = useRef(0);
    const scrollTimeoutRef = useRef(null);

    // 연속된 주 데이터 생성 (±1.5년)
    const { weeks, todayWeekIndex } = useMemo(() => {
        const start = today.subtract(18, 'month').startOf('month').startOf('week');
        const end = today.add(18, 'month').endOf('month').endOf('week');

        const weeksArray = [];
        let currentDateIter = start; // Renamed to avoid confusion with store 'currentDate'

        while (currentDateIter.isBefore(end) || currentDateIter.isSame(end, 'day')) {
            const week = [];

            for (let i = 0; i < 7; i++) {
                const date = currentDateIter.add(i, 'day');
                const month = date.month() + 1;
                const dayOfWeek = date.day();
                const isFirstDay = date.date() === 1;
                const isToday = date.isSame(today, 'day');
                const dateString = date.format('YYYY-MM-DD'); // ✅ Format for comparison

                week.push({
                    text: isFirstDay ? `${month}.1` : date.date(),
                    isToday,
                    isFirstDay,
                    dateString, // ✅ Include formatted date
                    bgColor: month % 2 === 0 ? '#F9F9F9' : '#FFFFFF',
                    textColor: dayOfWeek === 0 ? '#ff5e5e' : dayOfWeek === 6 ? '#5e5eff' : '#333',
                    dateObj: date,
                });
            }

            weeksArray.push(week);
            currentDateIter = currentDateIter.add(7, 'day');
        }

        const tIndex = weeksArray.findIndex(week => week.some(d => d.isToday));
        return { weeks: weeksArray, todayWeekIndex: tIndex };
    }, []);

    // 헤더 업데이트 함수
    const updateHeader = useCallback((weekData, index) => {
        const firstDay = weekData[0].dateObj;

        const yearMonth = firstDay.format('YYYY년 M월');
        const weekNum = Math.ceil(firstDay.date() / 7);

        setHeaderTitle(yearMonth);
        setWeekNumber(`${weekNum}주차`);
        currentIndexRef.current = index;
    }, []);

    const toggleMode = useCallback(() => {
        if (isWeekly) {
            // Weekly → Monthly
            height.value = withSpring(CALENDAR_HEIGHT_MONTH, { damping: 15 });
            setIsWeekly(false);
            scrollEnabledRef.current = true;
        } else {
            // Monthly → Weekly
            height.value = withSpring(CALENDAR_HEIGHT_WEEK, { damping: 15 });
            setIsWeekly(true);
            scrollEnabledRef.current = false;

            // ✅ Find index of the selected week
            const selectedWeekIndex = weeks.findIndex(week =>
                week.some(d => d.dateString === currentDate)
            );
            const targetIndex = selectedWeekIndex !== -1 ? selectedWeekIndex : currentIndexRef.current;

            setTimeout(() => {
                if (listRef.current) {
                    listRef.current.scrollToIndex({
                        index: targetIndex,
                        animated: true,
                        viewPosition: 0,
                    });
                }
            }, 100);
        }
    }, [isWeekly, weeks, currentDate]);

    const runOnJsChangeMode = (isWeek) => {
        setIsWeekly(isWeek);
        scrollEnabledRef.current = !isWeek; // Scroll enabled only in monthly mode (isWeek=false)

        if (isWeek) { // Switching to Weekly

            // ✅ Find index of the selected week
            const selectedWeekIndex = weeks.findIndex(week =>
                week.some(d => d.dateString === currentDate)
            );
            const targetIndex = selectedWeekIndex !== -1 ? selectedWeekIndex : currentIndexRef.current;

            setTimeout(() => {
                if (listRef.current) {
                    listRef.current.scrollToIndex({
                        index: targetIndex,
                        animated: true,
                        viewPosition: 0,
                    });
                }
            }, 100);
        }
    };

    const pan = Gesture.Pan()
        .onChange((event) => {
            const newHeight = height.value + event.changeY;
            if (newHeight >= CALENDAR_HEIGHT_WEEK && newHeight <= 600) {
                height.value = newHeight;
            }
        })
        .onEnd((event) => {
            // Dragged Down (Expand to Month)
            if (event.translationY > 50) {
                height.value = withSpring(CALENDAR_HEIGHT_MONTH, { damping: 15 });
                runOnJS(runOnJsChangeMode)(false);
            }
            // Dragged Up (Collapse to Week)
            else if (event.translationY < -50) {
                height.value = withSpring(CALENDAR_HEIGHT_WEEK, { damping: 15 });
                runOnJS(runOnJsChangeMode)(true);
            }
            // Not dragged enough - Snap back to current state
            else {
                if (isWeekly) {
                    height.value = withSpring(CALENDAR_HEIGHT_WEEK, { damping: 15 });
                } else {
                    height.value = withSpring(CALENDAR_HEIGHT_MONTH, { damping: 15 });
                }
            }
        });

    // 렌더링 최적화를 위한 설정 객체 (외부 정의 또는 useRef)
    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

    // 스크롤 성능을 위한 스로틀링 Ref
    const lastUpdateRef = useRef(0);

    // State for Today Visibility
    const [isTodayVisible, setIsTodayVisible] = useState(true);

    const onViewableItemsChanged = useCallback(({ viewableItems }) => {
        const now = Date.now();
        // 100ms 스로틀링: 너무 잦은 상태 업데이트 방지
        if (now - lastUpdateRef.current < 100) return;

        if (viewableItems.length > 0) {
            lastUpdateRef.current = now;
            const firstWeek = viewableItems[0].item;
            const index = viewableItems[0].index;
            updateHeader(firstWeek, index);

            // ✅ Debug & Check if Today's week is visible
            const visibleIndices = viewableItems.map(v => v.index);
            const isFound = visibleIndices.includes(todayWeekIndex);

            console.log(`👀 Visibility Check: TodayIndex=${todayWeekIndex}, Visible=${visibleIndices}, Found=${isFound}`);

            setIsTodayVisible(isFound);
        }
    }, [updateHeader, todayWeekIndex]);

    // ✅ Today Button Handler
    const handleTodayPress = useCallback(() => {
        const todayStr = dayjs().format('YYYY-MM-DD');
        setCurrentDate(todayStr); // 1. Select Today

        // 2. Scroll to Today
        if (listRef.current) {
            console.log(`🚀 Scrolling to Today Index: ${todayWeekIndex}`);
            listRef.current.scrollToIndex({
                index: todayWeekIndex,
                animated: true,
                viewPosition: 0,
            });
        }
    }, [setCurrentDate, todayWeekIndex]);

    // ✅ 스크롤 중 위치 추적 + 디바운싱으로 스냅 실행
    const handleScroll = useCallback((event) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        scrollY.current = offsetY;

        // 이전 타이머 취소
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }

        // 스크롤이 멈춘 후 100ms 후에 스냅 실행
        scrollTimeoutRef.current = setTimeout(() => {
            // console.log('⏱️ Scroll stopped, attempting snap...');

            if (isWeekly) {
                // console.log('❌ Weekly mode - snap cancelled');
                return;
            }

            const offset = scrollY.current;
            const targetIndex = Math.round(offset / CELL_HEIGHT);

            // console.log('🎯 Snapping to index:', targetIndex, 'from offset:', offset);

            if (targetIndex >= 0 && targetIndex < weeks.length && listRef.current) {
                listRef.current.scrollToIndex({
                    index: targetIndex,
                    animated: true,
                    viewPosition: 0,
                });
                // console.log('✅ Snap executed to index:', targetIndex);
            } else {
                // console.log('❌ Invalid index or no ref');
            }
        }, 100);
    }, [isWeekly, weeks.length]);

    // ✅ Date Press Handler
    const handleDatePress = useCallback((dateString) => {
        setCurrentDate(dateString);
        console.log('📅 Selected Date:', dateString);
    }, [setCurrentDate]);

    // ✅ Pass currentDate and handler to WeekRow
    const renderItem = useCallback(({ item }) => (
        <WeekRow
            week={item}
            currentDate={currentDate}
            onPressDate={handleDatePress}
        />
    ), [currentDate, handleDatePress]);

    const animatedStyle = useAnimatedStyle(() => ({
        height: height.value,
        overflow: 'hidden',
    }));

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={styles.container}>
                <View style={styles.topHeader}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.topHeaderText}>{headerTitle}</Text>
                        {/* ✅ Today Button (Visible only when currentDate is NOT today) */}
                        {currentDate !== dayjs().format('YYYY-MM-DD') && (
                            <TouchableOpacity style={styles.todayButton} onPress={handleTodayPress}>
                                <Text style={styles.todayButtonText}>오늘</Text>
                            </TouchableOpacity>
                        )}
                        {isWeekly && <Text style={styles.weekText}>{weekNumber}</Text>}
                    </View>
                    <TouchableOpacity
                        style={styles.modeButton}
                        onPress={toggleMode}
                    >
                        <Text style={styles.modeButtonText}>
                            {isWeekly ? '월간' : '주간'}
                        </Text>
                    </TouchableOpacity>
                </View>

                <Animated.View style={animatedStyle}>
                    <View style={styles.weekDaysHeader}>
                        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                            <Text key={i} style={[
                                styles.weekDayText,
                                i === 0 && { color: '#ff5e5e' },
                                i === 6 && { color: '#5e5eff' }
                            ]}>
                                {d}
                            </Text>
                        ))}
                    </View>

                    <FlashList
                        ref={listRef}
                        data={weeks}
                        renderItem={renderItem}
                        keyExtractor={(_, index) => `week-${index}`}
                        estimatedItemSize={CELL_HEIGHT}
                        initialScrollIndex={todayWeekIndex}
                        onViewableItemsChanged={onViewableItemsChanged}
                        viewabilityConfig={viewabilityConfig}
                        showsVerticalScrollIndicator={false}
                        scrollEnabled={!isWeekly}

                        // ✅ 디바운싱 기반 스냅
                        onScroll={handleScroll}
                        scrollEventThrottle={16}

                        // Extra Data needed for re-rendering on selection change
                        extraData={currentDate}
                    />

                    <GestureDetector gesture={pan}>
                        <View style={styles.handleBarContainer}>
                            <View style={styles.handleBar} />
                        </View>
                    </GestureDetector>
                </Animated.View>

                {/* Debug View For Selection */}
                <View style={{ padding: 20 }}>
                    <Text>Currently Selected: {currentDate}</Text>
                </View>
            </View>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    topHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 10,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
    },
    topHeaderText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333'
    },
    weekText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#00AAAF',
    },
    todayButton: {
        backgroundColor: '#e6f7f8',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginLeft: 4,
    },
    todayButtonText: {
        color: '#00AAAF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    modeButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#00AAAF',
        borderRadius: 20,
    },
    modeButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: 'white',
    },
    weekDaysHeader: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    weekDayText: {
        fontSize: 12,
        color: '#666',
        width: COLUMN_WIDTH,
        height: WEEK_DAY_HEIGHT,
        textAlign: 'center'
    },
    weekRow: {
        flexDirection: 'row',
        height: CELL_HEIGHT
    },
    cell: {
        width: COLUMN_WIDTH,
        height: CELL_HEIGHT,
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 10,
        borderBottomWidth: 0.5,
        borderBottomColor: '#f0f0f0',
    },
    dateContainer: {
        width: 30,
        height: 30,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 15,
    },
    todayContainer: {
        backgroundColor: '#00AAAF'
    },
    selectedContainer: {
        backgroundColor: '#333', // Dark background for selection
        borderWidth: 2,
        borderColor: '#00AAAF' // Blue border
    },
    dateText: {
        fontSize: 14,
        fontWeight: '500'
    },
    handleBarContainer: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        height: HANDLE_BAR_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    handleBar: {
        width: 50,
        height: HANDLE_BAR_HEIGHT,
        borderRadius: 2,
        backgroundColor: '#000'
    },
    selectionDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'orange',
        marginTop: 2
    }
});