import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, UIManager } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import dayjs from 'dayjs';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    runOnJS
} from 'react-native-reanimated';

import CalendarHeader from './CalendarHeader';
import WeeklyView from './WeeklyView';
import MonthlyView from './MonthlyView';
import { useDateStore } from '../../store/dateStore';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';
import { generateCalendarData } from './calendarUtils';
import { CELL_HEIGHT, WEEK_DAY_HEIGHT, THEME, SCREEN_WIDTH } from './constants';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Limits
const CALENDAR_HEIGHT_WEEK = CELL_HEIGHT;
const CALENDAR_HEIGHT_MONTH = CELL_HEIGHT * 6;

export default function UltimateCalendar() {
    // Localization
    const { t, i18n } = useTranslation();

    if (dayjs.locale() !== i18n.language) {
        dayjs.locale(i18n.language);
    }

    const today = useMemo(() => dayjs(), []);
    const { currentDate, setCurrentDate } = useDateStore();

    // Auth Store
    const { user } = useAuthStore();
    const startDayOfWeek = user?.settings?.startDayOfWeek || 'sunday';

    // Refs
    const weeklyRef = useRef(null);
    const monthlyRef = useRef(null);

    // State
    const [hasLoadedMonthly, setHasLoadedMonthly] = useState(false);
    const [isWeekly, setIsWeekly] = useState(true);
    const [headerDate, setHeaderDate] = useState(today);

    // ⚡️ [최적화] 앱 진입 0.5초 후 월간 뷰를 미리 로딩
    useEffect(() => {
        const timer = setTimeout(() => {
            setHasLoadedMonthly(true);
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    // Generate Data
    const { weeks, todayWeekIndex } = useMemo(() =>
        generateCalendarData(today, startDayOfWeek),
        [today, startDayOfWeek]);

    const weekDays = useMemo(() => {
        return Array.from({ length: 7 }).map((_, i) => {
            const dayIndex = startDayOfWeek === 'monday' ? i + 1 : i;
            return dayjs().day(dayIndex).format('dd');
        });
    }, [startDayOfWeek, i18n.language]);

    const currentWeekIndex = useMemo(() => {
        const idx = weeks.findIndex(week => week.some(d => d.dateString === currentDate));
        return idx !== -1 ? idx : todayWeekIndex;
    }, [weeks, currentDate, todayWeekIndex]);

    const headerTitle = headerDate.format(t('date.header_fmt'));

    // Reanimated Values
    const height = useSharedValue(CALENDAR_HEIGHT_WEEK);
    const opacity = useSharedValue(isWeekly ? 0 : 1);
    const isWeeklyShared = useSharedValue(1); // 1: Weekly, 0: Monthly
    const gestureState = useSharedValue(0);   // 0: Idle, 1: Active, 2: Triggered

    // Effect: Handle button toggle animation
    useEffect(() => {
        isWeeklyShared.value = isWeekly ? 1 : 0;

        // 제스처 중이 아닐 때만 useEffect가 애니메이션 제어
        if (gestureState.value === 0) {
            opacity.value = withTiming(isWeekly ? 0 : 1, { duration: 300 });
            height.value = withSpring(isWeekly ? CALENDAR_HEIGHT_WEEK : CALENDAR_HEIGHT_MONTH, {
                mass: 1, damping: 50, stiffness: 250,
            });
        }
    }, [isWeekly]);

    // ⚡️ [핵심 수정 1] 양방향 그림자 동기화 (Shadow Sync)
    // 어느 한쪽 모드에 있더라도, 날짜가 바뀌면 반대쪽 뷰를 미리 이동시켜 둡니다.
    useEffect(() => {
        // 1. 주간 모드일 때 -> 숨겨진 월간 뷰 동기화
        if (isWeekly && hasLoadedMonthly && monthlyRef.current) {
            monthlyRef.current.scrollToIndex(currentWeekIndex, false);
        }

        // 2. 월간 모드일 때 -> 숨겨진 주간 뷰 동기화 (이게 빠져있어서 늦었던 것!)
        if (!isWeekly && weeklyRef.current) {
            weeklyRef.current.scrollToIndex(currentWeekIndex, false);
        }
    }, [currentWeekIndex, isWeekly, hasLoadedMonthly]);


    const animatedStyle = useAnimatedStyle(() => ({
        height: height.value,
        overflow: 'hidden'
    }));

    const monthlyStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        zIndex: isWeekly ? 0 : 1,
        pointerEvents: isWeekly ? 'none' : 'auto',
    }));

    const weeklyStyle = useAnimatedStyle(() => ({
        opacity: 1 - opacity.value,
        zIndex: isWeekly ? 1 : 0,
        pointerEvents: isWeekly ? 'auto' : 'none',
    }));

    // =================================================================
    // ⚡️ 동기화 및 모드 전환 로직
    // =================================================================

    const switchToMonthly = useCallback(() => {
        setIsWeekly(false);
        setHasLoadedMonthly(true);
        // 확인 사살용 (이미 useEffect가 했겠지만)
        setTimeout(() => {
            monthlyRef.current?.scrollToIndex(currentWeekIndex, false);
        }, 0);
    }, [currentWeekIndex]);

    const switchToWeekly = useCallback(() => {
        setIsWeekly(true);
        // 확인 사살용
        setTimeout(() => {
            weeklyRef.current?.scrollToIndex(currentWeekIndex, false); // false로 변경 (즉시 이동)
        }, 0);
    }, [currentWeekIndex]);

    const toggleMode = useCallback(() => {
        if (isWeekly) {
            switchToMonthly();
        } else {
            switchToWeekly();
        }
    }, [isWeekly, switchToMonthly, switchToWeekly]);

    const handleDatePress = useCallback((dateString) => {
        setCurrentDate(dateString);
        setHeaderDate(dayjs(dateString));
        // useEffect가 currentWeekIndex 변경을 감지해서 양쪽 뷰를 자동 동기화함
    }, [setCurrentDate]);

    const handleTodayPress = useCallback(() => {
        const todayStr = dayjs().format('YYYY-MM-DD');
        setCurrentDate(todayStr);
        if (weeklyRef.current) weeklyRef.current.scrollToIndex(todayWeekIndex, true);
        if (hasLoadedMonthly && monthlyRef.current) monthlyRef.current.scrollToIndex(todayWeekIndex, true);
    }, [setCurrentDate, todayWeekIndex, hasLoadedMonthly]);

    const handleWeekChange = useCallback((dateObj) => { if (dateObj) setHeaderDate(dateObj); }, []);
    const handleVisibleWeeksChange = useCallback((dateObj) => { if (dateObj) setHeaderDate(dateObj); }, []);
    const isTodaySelected = currentDate === today.format('YYYY-MM-DD');


    // ⚡️ [핵심 추가 2] 터치 시작 시 강제 동기화 함수들
    const preSyncMonthlyPosition = useCallback(() => {
        if (hasLoadedMonthly && monthlyRef.current) {
            monthlyRef.current.scrollToIndex(currentWeekIndex, false);
        }
    }, [currentWeekIndex, hasLoadedMonthly]);

    const preSyncWeeklyPosition = useCallback(() => {
        if (weeklyRef.current) {
            weeklyRef.current.scrollToIndex(currentWeekIndex, false);
        }
    }, [currentWeekIndex]);


    // =================================================================
    // ⚡️ 제스처 로직
    // =================================================================
    const panGesture = Gesture.Pan()
        .onBegin(() => {
            gestureState.value = 1;

            // ⚡️ 핸들에 손을 대자마자 안 보이는 뷰의 위치를 강제로 맞춥니다.
            if (isWeeklyShared.value === 1) {
                // 주간 모드면 -> 월간 뷰 미리 준비
                runOnJS(preSyncMonthlyPosition)();
            } else {
                // 월간 모드면 -> 주간 뷰 미리 준비 (이게 추가됨!)
                runOnJS(preSyncWeeklyPosition)();
            }
        })
        .onChange((e) => {
            if (gestureState.value === 2) return;

            // 1. 주간 -> 월간 (내리기)
            if (isWeeklyShared.value === 1 && e.translationY > 10) {
                gestureState.value = 2; // 잠금

                opacity.value = withTiming(1, { duration: 300 });

                height.value = withSpring(CALENDAR_HEIGHT_MONTH, {
                    mass: 1, damping: 50, stiffness: 250,
                }, (finished) => {
                    if (finished) {
                        runOnJS(switchToMonthly)();
                    }
                });
            }

            // 2. 월간 -> 주간 (올리기)
            else if (isWeeklyShared.value === 0 && e.translationY < -10) {
                gestureState.value = 2; // 잠금

                opacity.value = withTiming(0, { duration: 300 });

                height.value = withSpring(CALENDAR_HEIGHT_WEEK, {
                    mass: 1, damping: 50, stiffness: 250,
                }, (finished) => {
                    if (finished) {
                        runOnJS(switchToWeekly)();
                    }
                });
            }
        })
        .onEnd(() => {
            if (gestureState.value === 1) {
                if (isWeeklyShared.value === 1) {
                    height.value = withSpring(CALENDAR_HEIGHT_WEEK);
                } else {
                    height.value = withSpring(CALENDAR_HEIGHT_MONTH);
                }
            }
            gestureState.value = 0;
        });

    return (
        <GestureHandlerRootView style={styles.root}>
            <View style={styles.container}>
                {/* Header */}
                <CalendarHeader
                    title={headerTitle}
                    isWeekly={isWeekly}
                    onToggleMode={toggleMode}
                    onTodayPress={handleTodayPress}
                    isTodayVisible={isTodaySelected}
                />

                {/* Week Days Header */}
                <View style={styles.weekDaysHeader}>
                    {weekDays.map((d, i) => {
                        let isSun = false;
                        let isSat = false;
                        if (startDayOfWeek === 'monday') {
                            if (i === 5) isSat = true;
                            if (i === 6) isSun = true;
                        } else {
                            if (i === 0) isSun = true;
                            if (i === 6) isSat = true;
                        }
                        return (
                            <Text key={i} style={[
                                styles.weekDayText,
                                isSun && { color: THEME.sunday },
                                isSat && { color: THEME.saturday }
                            ]}>{d}</Text>
                        );
                    })}
                </View>

                {/* Body: Overlay Structure */}
                <Animated.View style={[styles.bodyContainer, animatedStyle]}>

                    {/* 1. Monthly View (Pre-loaded via useEffect) */}
                    {hasLoadedMonthly && (
                        <Animated.View style={[styles.monthlyPosition, monthlyStyle]}>
                            <MonthlyView
                                ref={monthlyRef}
                                weeks={weeks}
                                currentDate={currentDate}
                                onDatePress={handleDatePress}
                                onVisibleWeeksChange={handleVisibleWeeksChange}
                                initialIndex={currentWeekIndex}
                            />
                        </Animated.View>
                    )}

                    {/* 2. Weekly View */}
                    <Animated.View style={[StyleSheet.absoluteFill, weeklyStyle]}>
                        <WeeklyView
                            ref={weeklyRef}
                            weeks={weeks}
                            currentDate={currentDate}
                            onDatePress={handleDatePress}
                            initialIndex={currentWeekIndex}
                            onWeekChange={handleWeekChange}
                        />
                    </Animated.View>

                </Animated.View>

                {/* Handle Bar */}
                <GestureDetector gesture={panGesture}>
                    <View style={styles.handleBarContainer}>
                        <View style={styles.handleBar} />
                    </View>
                </GestureDetector>
            </View>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: 'white',
    },
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    weekDaysHeader: {
        flexDirection: 'row',
        height: WEEK_DAY_HEIGHT,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    weekDayText: {
        flex: 1,
        textAlign: 'center',
        fontSize: 12,
        color: '#666',
        fontWeight: '500',
    },
    bodyContainer: {
        backgroundColor: 'white',
        overflow: 'hidden',
    },
    monthlyPosition: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: CALENDAR_HEIGHT_MONTH,
    },
    handleBarContainer: {
        height: 30, // Increased touch area
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        cursor: 'ns-resize', // Web cursor
    },
    handleBar: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#ccc',
    }
});