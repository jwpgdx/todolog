import React, { useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import 'dayjs/locale/ko';

dayjs.extend(weekOfYear);
dayjs.locale('ko');

const SCREEN_WIDTH = Dimensions.get('window').width;
const COLUMN_WIDTH = SCREEN_WIDTH / 7;
const CELL_HEIGHT = 70;
const CALENDAR_HEIGHT_MONTH = 500;
const CALENDAR_HEIGHT_WEEK = CELL_HEIGHT + 60;

// 주 컴포넌트 (7개 날짜)
const WeekRow = React.memo(({ week }) => {
    return (
        <View style={styles.weekRow}>
            {week.map((day, idx) => (
                <View key={idx} style={[styles.cell, { backgroundColor: day.bgColor }]}>
                    <View style={[styles.dateContainer, day.isToday && styles.todayContainer]}>
                        <Text style={[
                            styles.dateText,
                            { color: day.isToday ? 'white' : day.textColor },
                            day.isFirstDay && { fontWeight: 'bold' }
                        ]}>
                            {day.text}
                        </Text>
                    </View>
                </View>
            ))}
        </View>
    );
});

export default function OptimizedCalendar() {
    const today = dayjs();
    const height = useSharedValue(CALENDAR_HEIGHT_WEEK); // 시작은 Weekly
    const listRef = useRef(null);
    const [isWeekly, setIsWeekly] = useState(true); // 시작 모드
    const [headerTitle, setHeaderTitle] = useState('');
    const [weekNumber, setWeekNumber] = useState('');
    const currentIndexRef = useRef(0);
    const scrollEnabledRef = useRef(!true); // Weekly는 스크롤 잠금

    // 연속된 주 데이터 생성 (±1.5년)
    const { weeks, todayWeekIndex } = useMemo(() => {
        const start = today.subtract(18, 'month').startOf('month').startOf('week');
        const end = today.add(18, 'month').endOf('month').endOf('week');

        const weeksArray = [];
        let currentDate = start;

        while (currentDate.isBefore(end) || currentDate.isSame(end, 'day')) {
            const week = [];

            for (let i = 0; i < 7; i++) {
                const date = currentDate.add(i, 'day');
                const month = date.month() + 1;
                const dayOfWeek = date.day();
                const isFirstDay = date.date() === 1;
                const isToday = date.isSame(today, 'day');

                week.push({
                    text: isFirstDay ? `${month}월 1일` : date.date(),
                    isToday,
                    isFirstDay,
                    bgColor: month % 2 === 0 ? '#F9F9F9' : '#FFFFFF',
                    textColor: dayOfWeek === 0 ? '#ff5e5e' : dayOfWeek === 6 ? '#5e5eff' : '#333',
                    dateObj: date,
                });
            }

            weeksArray.push(week);
            currentDate = currentDate.add(7, 'day');
        }

        const tIndex = weeksArray.findIndex(week => week.some(d => d.isToday));
        return { weeks: weeksArray, todayWeekIndex: tIndex };
    }, []);

    // 헤더 업데이트 함수
    const updateHeader = useCallback((weekData, index) => {
        const firstDay = weekData[0].dateObj;
        const lastDay = weekData[6].dateObj;

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
            // Monthly → Weekly: 현재 보이는 첫 주로 스냅
            height.value = withSpring(CALENDAR_HEIGHT_WEEK, { damping: 15 });
            setIsWeekly(true);
            scrollEnabledRef.current = false;

            setTimeout(() => {
                if (listRef.current && currentIndexRef.current >= 0) {
                    listRef.current.scrollToIndex({
                        index: currentIndexRef.current,
                        animated: true,
                        viewPosition: 0,
                    });
                }
            }, 100);
        }
    }, [isWeekly]);

    const runOnJsChangeMode = (isWeek) => {
        setIsWeekly(isWeek);
        scrollEnabledRef.current = !isWeek; // Scroll enabled only in monthly mode (isWeek=false)

        if (isWeek) {
            setTimeout(() => {
                if (listRef.current && currentIndexRef.current >= 0) {
                    listRef.current.scrollToIndex({
                        index: currentIndexRef.current,
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
            if (event.velocityY < -500 || height.value < 300) {
                // Weekly 모드로
                height.value = withSpring(CALENDAR_HEIGHT_WEEK, { damping: 15 });
                runOnJS(runOnJsChangeMode)(true);
            } else {
                // Monthly 모드로
                height.value = withSpring(CALENDAR_HEIGHT_MONTH, { damping: 15 });
                runOnJS(runOnJsChangeMode)(false);
            }
        });

    const onViewableItemsChanged = useCallback(({ viewableItems }) => {
        if (viewableItems.length > 0) {
            const firstWeek = viewableItems[0].item;
            const index = viewableItems[0].index;
            updateHeader(firstWeek, index);
        }
    }, [updateHeader]);

    const renderItem = useCallback(({ item }) => <WeekRow week={item} />, []);

    const getItemLayout = useCallback((_, index) => ({
        length: CELL_HEIGHT,
        offset: CELL_HEIGHT * index,
        index,
    }), []);

    const animatedStyle = useAnimatedStyle(() => ({
        height: height.value,
        overflow: 'hidden',
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    }));

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={styles.container}>
                <View style={styles.topHeader}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.topHeaderText}>{headerTitle}</Text>
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

                    <FlatList
                        ref={listRef}
                        data={weeks}
                        renderItem={renderItem}
                        keyExtractor={(_, index) => `week-${index}`}
                        getItemLayout={getItemLayout}
                        initialScrollIndex={todayWeekIndex}
                        onViewableItemsChanged={onViewableItemsChanged}
                        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
                        windowSize={10}
                        initialNumToRender={15}
                        maxToRenderPerBatch={10}
                        removeClippedSubviews={true}
                        showsVerticalScrollIndicator={false}
                        scrollEnabled={!isWeekly}
                        onScrollToIndexFailed={(info) => {
                            setTimeout(() => listRef.current?.scrollToIndex({
                                index: info.index,
                                animated: false
                            }), 500);
                        }}
                    />

                    <GestureDetector gesture={pan}>
                        <View style={styles.handleBarContainer}>
                            <View style={styles.handleBar} />
                        </View>
                    </GestureDetector>
                </Animated.View>
            </View>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f2f7f7',
        paddingTop: 50
    },
    topHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 10,
        backgroundColor: '#f2f7f7'
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
        justifyContent: 'space-around',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        backgroundColor: 'white'
    },
    weekDayText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#666',
        width: COLUMN_WIDTH,
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
        borderRightWidth: 0.5,
        borderRightColor: '#f0f0f0'
    },
    dateContainer: {
        width: 30,
        height: 30,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 15
    },
    todayContainer: {
        backgroundColor: '#00AAAF'
    },
    dateText: {
        fontSize: 14,
        fontWeight: '500'
    },
    handleBarContainer: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent'
    },
    handleBar: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#ccc'
    },
});