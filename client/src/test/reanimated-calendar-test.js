import React, { useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Platform } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { FlashList } from '@shopify/flash-list';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import 'dayjs/locale/ko';
import { useDateStore } from '../store/dateStore';

dayjs.extend(weekOfYear);
dayjs.locale('ko');

// 📱 1. 치수 및 상수 정의
const SCREEN_WIDTH = Dimensions.get('window').width;
const COLUMN_WIDTH = SCREEN_WIDTH / 7;

// 🔥 [핵심 수정 1] 높이를 '반올림'해서 정수로 만듭니다.
// 소수점 오차(Sub-pixel issue)를 없애서 스크롤 스냅이 1px도 안 틀리게 함
const CELL_HEIGHT = Math.round(COLUMN_WIDTH);

const WEEK_DAY_HEIGHT = 30;
const HANDLE_BAR_HEIGHT = 24;

// 📏 애니메이션 목표 높이 (핸들바 제외, 순수 리스트 영역)
const CALENDAR_HEIGHT_WEEK = CELL_HEIGHT;
const CALENDAR_HEIGHT_MONTH = CELL_HEIGHT * 6;

// ⚡ 2. 애니메이션 설정 (부드러운 감속)
const SPRING_CONFIG = {
    mass: 1,
    damping: 50,
    stiffness: 250,
    overshootClamping: true,
    restDisplacementThreshold: 0.1,
    restSpeedThreshold: 0.1,
};

// ⚡ 3. 최적화: Props 비교 함수
const arePropsEqual = (prevProps, nextProps) => {
    if (prevProps.week !== nextProps.week) return false;
    const isPrevSelectedInThisWeek = prevProps.week.some(d => d.dateString === prevProps.currentDate);
    const isNextSelectedInThisWeek = nextProps.week.some(d => d.dateString === nextProps.currentDate);
    return !(isPrevSelectedInThisWeek || isNextSelectedInThisWeek);
};

// 📅 날짜 셀 컴포넌트
const DayCell = React.memo(({ day, currentDate, onPressDate }) => {
    const isSelected = day.dateString === currentDate;
    return (
        <TouchableOpacity
            style={[styles.cell, { backgroundColor: day.bgColor }]}
            onPress={() => onPressDate(day.dateString)}
            activeOpacity={0.7}
        >
            <View style={[
                styles.dateContainer,
                day.isToday && styles.todayContainer,
                isSelected && styles.selectedContainer
            ]}>
                <Text style={[
                    styles.dateText,
                    { color: isSelected ? 'white' : (day.isToday ? 'white' : day.textColor) },
                    day.isFirstDay && { fontWeight: 'bold' }
                ]}>
                    {day.text}
                </Text>
            </View>
            {isSelected && !day.isToday && (
                <View style={styles.selectionDot} />
            )}
        </TouchableOpacity>
    );
});

// 🗓️ 주간 행 컴포넌트
const WeekRow = React.memo(({ week, currentDate, onPressDate }) => {
    return (
        <View style={styles.weekRow}>
            {week.map((day, idx) => (
                <DayCell
                    key={idx}
                    day={day}
                    currentDate={currentDate}
                    onPressDate={onPressDate}
                />
            ))}
        </View>
    );
}, arePropsEqual);

export default function OptimizedCalendar() {
    const today = dayjs();
    const { currentDate, setCurrentDate } = useDateStore();

    const height = useSharedValue(CALENDAR_HEIGHT_WEEK);
    const listRef = useRef(null);
    const [isWeekly, setIsWeekly] = useState(true);
    const [headerTitle, setHeaderTitle] = useState('');
    const [weekNumber, setWeekNumber] = useState('');

    const currentIndexRef = useRef(0);
    const prevWeekRef = useRef(''); // 헤더 업데이트 최적화용 Ref

    // 🗓️ 데이터 생성
    const { weeks, todayWeekIndex } = useMemo(() => {
        const start = today.subtract(18, 'month').startOf('month').startOf('week');
        const end = today.add(18, 'month').endOf('month').endOf('week');
        const weeksArray = [];
        let currentDateIter = start;

        while (currentDateIter.isBefore(end) || currentDateIter.isSame(end, 'day')) {
            const week = [];
            for (let i = 0; i < 7; i++) {
                const date = currentDateIter.add(i, 'day');
                const month = date.month() + 1;
                const dayOfWeek = date.day();
                const isFirstDay = date.date() === 1;
                const isToday = date.isSame(today, 'day');
                const dateString = date.format('YYYY-MM-DD');

                week.push({
                    text: isFirstDay ? `${month}.1` : date.date(),
                    isToday,
                    isFirstDay,
                    dateString,
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

    const updateHeader = useCallback((weekData, index) => {
        if (!weekData || weekData.length === 0) return;

        const firstDay = weekData[0].dateObj;
        const yearMonth = firstDay.format('YYYY년 M월');
        const weekNumStr = `${Math.ceil(firstDay.date() / 7)}주차`;

        // ✨ 최적화: 값이 변했을 때만 상태 업데이트 (스크롤 버벅임 방지)
        if (prevWeekRef.current !== weekNumStr || currentIndexRef.current !== index) {
            prevWeekRef.current = weekNumStr;
            currentIndexRef.current = index;
            setHeaderTitle(yearMonth);
            setWeekNumber(weekNumStr);
        }
    }, []);

    // 🔄 모드 전환 로직
    const toggleMode = useCallback(() => {
        if (isWeekly) {
            // [주간 -> 월간]
            height.value = withSpring(CALENDAR_HEIGHT_MONTH, SPRING_CONFIG, (finished) => {
                if (finished) {
                    runOnJS(setIsWeekly)(false);
                }
            });
        } else {
            // [월간 -> 주간]
            const selectedWeekIndex = weeks.findIndex(week =>
                week.some(d => d.dateString === currentDate)
            );
            const targetIndex = selectedWeekIndex !== -1 ? selectedWeekIndex : currentIndexRef.current;

            if (listRef.current) {
                listRef.current.scrollToIndex({
                    index: targetIndex,
                    animated: false,
                    viewPosition: 0,
                });
            }

            height.value = withSpring(CALENDAR_HEIGHT_WEEK, SPRING_CONFIG, (finished) => {
                if (finished) {
                    runOnJS(setIsWeekly)(true);
                }
            });
        }
    }, [isWeekly, weeks, currentDate]);

    const runOnJsChangeMode = (targetIsWeekly) => {
        if (targetIsWeekly === isWeekly) return;
        setIsWeekly(targetIsWeekly);

        if (targetIsWeekly) {
            const selectedWeekIndex = weeks.findIndex(week =>
                week.some(d => d.dateString === currentDate)
            );
            const targetIndex = selectedWeekIndex !== -1 ? selectedWeekIndex : currentIndexRef.current;

            if (listRef.current) {
                listRef.current.scrollToIndex({
                    index: targetIndex,
                    animated: false,
                    viewPosition: 0,
                });
            }
        }
    };

    // 👋 제스처 핸들러
    const pan = Gesture.Pan()
        .onChange((event) => {
            const newHeight = height.value + event.changeY;
            if (newHeight >= CALENDAR_HEIGHT_WEEK && newHeight <= CALENDAR_HEIGHT_MONTH + 100) {
                height.value = newHeight;
            }
        })
        .onEnd((event) => {
            const VELOCITY_THRESHOLD = 500;
            const isFlingUp = event.velocityY < -VELOCITY_THRESHOLD;
            const isFlingDown = event.velocityY > VELOCITY_THRESHOLD;

            if (isFlingDown || (height.value > (CALENDAR_HEIGHT_WEEK + CALENDAR_HEIGHT_MONTH) / 2 && !isFlingUp)) {
                height.value = withSpring(CALENDAR_HEIGHT_MONTH, SPRING_CONFIG);
                runOnJS(runOnJsChangeMode)(false);
            } else {
                height.value = withSpring(CALENDAR_HEIGHT_WEEK, SPRING_CONFIG);
                runOnJS(runOnJsChangeMode)(true);
            }
        });

    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

    const onViewableItemsChanged = useCallback(({ viewableItems }) => {
        if (viewableItems.length > 0) {
            const firstWeek = viewableItems[0].item;
            const index = viewableItems[0].index;
            updateHeader(firstWeek, index);
        }
    }, [updateHeader]);

    const handleTodayPress = useCallback(() => {
        const todayStr = dayjs().format('YYYY-MM-DD');
        setCurrentDate(todayStr);
        if (listRef.current) {
            listRef.current.scrollToIndex({
                index: todayWeekIndex,
                animated: true,
                viewPosition: 0,
            });
        }
    }, [setCurrentDate, todayWeekIndex]);

    const handleDatePress = useCallback((dateString) => {
        setCurrentDate(dateString);
    }, [setCurrentDate]);

    const renderItem = useCallback(({ item }) => (
        <WeekRow week={item} currentDate={currentDate} onPressDate={handleDatePress} />
    ), [currentDate, handleDatePress]);

    const animatedStyle = useAnimatedStyle(() => ({
        height: height.value,
    }));

    const isWeb = Platform.OS === 'web';

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={styles.container}>
                <View style={styles.topHeader}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.topHeaderText}>{headerTitle}</Text>
                        {currentDate !== dayjs().format('YYYY-MM-DD') && (
                            <TouchableOpacity style={styles.todayButton} onPress={handleTodayPress}>
                                <Text style={styles.todayButtonText}>오늘</Text>
                            </TouchableOpacity>
                        )}
                        {isWeekly && <Text style={styles.weekText}>{weekNumber}</Text>}
                    </View>
                    <TouchableOpacity style={styles.modeButton} onPress={toggleMode}>
                        <Text style={styles.modeButtonText}>{isWeekly ? '월간' : '주간'}</Text>
                    </TouchableOpacity>
                </View>

                {/* 요일 헤더 (고정) */}
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

                {/* ✨ 마스크 영역 (순수 달력 리스트만 포함) */}
                <Animated.View style={[animatedStyle, styles.calendarMask]}>
                    <View style={{ height: CALENDAR_HEIGHT_MONTH, width: '100%' }}>
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
                            removeClippedSubviews={false}
                            scrollEnabled={true}
                            drawDistance={SCREEN_WIDTH * 2}

                            // 🔥 [핵심 수정 2] 스냅 정확도 향상
                            snapToInterval={CELL_HEIGHT} // 정수 높이 사용
                            snapToAlignment="start"
                            decelerationRate="fast"
                            // 🔥 [핵심 수정 3] 관성 허용 (중간에 걸리지 않게 함)
                            disableIntervalMomentum={false}
                        />
                    </View>
                </Animated.View>

                {/* ✨ 핸들바 (Animated.View 밖으로 배출 -> 리스트 아래에 위치) */}
                <GestureDetector gesture={pan}>
                    <View style={styles.handleBarContainer}>
                        <View style={styles.handleBar} />
                    </View>
                </GestureDetector>

            </View>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    calendarMask: {
        overflow: 'hidden',
        backgroundColor: 'white',
    },
    topHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 10,
        paddingTop: 10,
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
        height: WEEK_DAY_HEIGHT,
        backgroundColor: 'white',
        zIndex: 10,
    },
    weekDayText: {
        fontSize: 12,
        color: '#666',
        width: COLUMN_WIDTH,
        textAlign: 'center',
        fontWeight: '500',
    },
    weekRow: {
        flexDirection: 'row',
        height: CELL_HEIGHT,
        alignItems: 'center',
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
        backgroundColor: '#333',
        borderWidth: 2,
        borderColor: '#00AAAF'
    },
    dateText: {
        fontSize: 14,
        fontWeight: '500'
    },
    handleBarContainer: {
        width: '100%',
        height: HANDLE_BAR_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    handleBar: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#ccc'
    },
    selectionDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#00AAAF',
        marginTop: 4
    }
});