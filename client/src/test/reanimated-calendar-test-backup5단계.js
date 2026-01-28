import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
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
const CELL_HEIGHT = Math.round(COLUMN_WIDTH); // 정수 반올림 (스냅 보정)
const WEEK_DAY_HEIGHT = 30;
const HANDLE_BAR_HEIGHT = 24;

const CALENDAR_HEIGHT_WEEK = CELL_HEIGHT;
const CALENDAR_HEIGHT_MONTH = CELL_HEIGHT * 6;

// ⚡ 2. 애니메이션 설정
const SPRING_CONFIG = {
    mass: 1,
    damping: 50,
    stiffness: 250,
    overshootClamping: true,
    restDisplacementThreshold: 0.1,
    restSpeedThreshold: 0.1,
};

// ⚡ 3. Props 비교 함수
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
    const prevWeekRef = useRef('');

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

    // ✨ 헤더 즉시 업데이트
    const updateHeaderUI = useCallback((dateObj) => {
        if (!dateObj) return;
        const yearMonth = dateObj.format('YYYY년 M월');
        const weekNumStr = `${Math.ceil(dateObj.date() / 7)}주차`;

        if (prevWeekRef.current !== weekNumStr || headerTitle !== yearMonth) {
            prevWeekRef.current = weekNumStr;
            setHeaderTitle(yearMonth);
            setWeekNumber(weekNumStr);
        }
    }, [headerTitle]);

    const onViewableItemsChanged = useCallback(({ viewableItems }) => {
        if (viewableItems.length > 0) {
            const firstWeek = viewableItems[0].item;
            currentIndexRef.current = viewableItems[0].index;
            updateHeaderUI(firstWeek[0].dateObj);
        }
    }, [updateHeaderUI]);

    // ✨ [수정] 모드 전환: 애니메이션 없이 즉시 이동 (animated: false)
    const toggleMode = useCallback(() => {
        if (isWeekly) {
            // [주간 -> 월간]
            // 확장할 때는 현재 보고 있는 주차를 유지하면서 확장
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

            updateHeaderUI(dayjs(currentDate));

            // 🔥 핵심: 애니메이션 끄고(false) 순간이동!
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
    }, [isWeekly, weeks, currentDate, updateHeaderUI]);

    const runOnJsChangeMode = (targetIsWeekly) => {
        if (targetIsWeekly === isWeekly) return;
        setIsWeekly(targetIsWeekly);

        if (targetIsWeekly) {
            const selectedWeekIndex = weeks.findIndex(week =>
                week.some(d => d.dateString === currentDate)
            );
            const targetIndex = selectedWeekIndex !== -1 ? selectedWeekIndex : currentIndexRef.current;

            updateHeaderUI(dayjs(currentDate));

            // 🔥 제스처로 닫을 때도 순간이동
            if (listRef.current) {
                listRef.current.scrollToIndex({
                    index: targetIndex,
                    animated: false,
                    viewPosition: 0,
                });
            }
        }
    };

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

    // ✨ [수정] 오늘 버튼: 순간이동
    const handleTodayPress = useCallback(() => {
        const todayStr = dayjs().format('YYYY-MM-DD');
        setCurrentDate(todayStr);
        updateHeaderUI(dayjs(todayStr));

        if (listRef.current) {
            listRef.current.scrollToIndex({
                index: todayWeekIndex,
                animated: false, // 🔥 스크롤 애니메이션 제거 (즉시 이동)
                viewPosition: 0,
            });
        }
    }, [setCurrentDate, todayWeekIndex, updateHeaderUI]);

    const handleDatePress = useCallback((dateString) => {
        setCurrentDate(dateString);
        updateHeaderUI(dayjs(dateString));
    }, [setCurrentDate, updateHeaderUI]);

    const renderItem = useCallback(({ item }) => (
        <WeekRow week={item} currentDate={currentDate} onPressDate={handleDatePress} />
    ), [currentDate, handleDatePress]);

    const animatedStyle = useAnimatedStyle(() => ({
        height: height.value,
    }));

    const isWeb = Platform.OS === 'web';

    useEffect(() => {
        updateHeaderUI(dayjs(currentDate));
    }, []);

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
                            snapToInterval={CELL_HEIGHT}
                            snapToAlignment="start"
                            decelerationRate="fast"
                            disableIntervalMomentum={false}
                        />
                    </View>
                </Animated.View>

                <GestureDetector gesture={pan}>
                    <View style={styles.handleBarContainer}>
                        <View style={styles.handleBar} />
                    </View>
                </GestureDetector>

            </View>
        </GestureHandlerRootView>
    );
}

// 스타일 동일
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