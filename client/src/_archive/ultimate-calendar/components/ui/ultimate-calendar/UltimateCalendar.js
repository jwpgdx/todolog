import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, UIManager } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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
import { useDateStore } from '../../../store/dateStore';
import { useAuthStore } from '../../../store/authStore';
import { useTranslation } from 'react-i18next';
import { generateCalendarData } from './calendarUtils';
import { useCalendarDynamicEvents } from '../../../hooks/useCalendarDynamicEvents';
import { CELL_HEIGHT, WEEK_DAY_HEIGHT, THEME, SCREEN_WIDTH } from './constants';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Limits
const CALENDAR_HEIGHT_WEEK = CELL_HEIGHT;
const CALENDAR_HEIGHT_MONTH = CELL_HEIGHT * 5; // ✅ 6주 → 5주로 축소 (성능 + range 매칭)
const MAX_WEEKS = 156; // ✅ Virtual Window: 3년치 (52주 × 3)

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
    const visibleWeekIndexRef = useRef(0); // ✅ ref로 즉시 추적
    const isArrowNavigating = useRef(false); // ✅ Arrow 네비게이션 중 플래그
    const isUserScrolling = useRef(false); // ✅ 사용자 스크롤 중 플래그 (스와이프 감지)
    const loadedRangeRef = useRef({
        start: today.subtract(6, 'month').startOf('month'),
        end: today.add(12, 'month').endOf('month')
    }); // ✅ loadedRange ref 추가

    // State
    const [hasLoadedMonthly, setHasLoadedMonthly] = useState(false);
    const [isWeekly, setIsWeekly] = useState(true);
    const [headerDate, setHeaderDate] = useState(today);
    
    // ✅ 무한 스크롤 상태
    const [weeks, setWeeks] = useState([]);
    const [todayWeekIndex, setTodayWeekIndex] = useState(0);
    const [loadedRange, setLoadedRange] = useState({
        start: today.subtract(6, 'month').startOf('month'),
        end: today.add(12, 'month').endOf('month')
    });
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isLoadingPast, setIsLoadingPast] = useState(false);
    
    // ✅ 실제 화면에 보이는 주 인덱스 추적
    const [visibleWeekIndex, setVisibleWeekIndex] = useState(0);

    // ✅ 동적 이벤트 계산 Hook
    // range: 12 = ±12주 = 총 25주 (6개월, 부드러운 스크롤 경험)
    const { eventsByDate, cacheVersion } = useCalendarDynamicEvents({
        weeks,
        visibleIndex: visibleWeekIndex,
        range: 12,
        cacheType: 'week'
    });

    // ⚡️ [최적화] 앱 진입 0.5초 후 월간 뷰를 미리 로딩
    useEffect(() => {
        const timer = setTimeout(() => {
            setHasLoadedMonthly(true);
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    // ✅ 초기 데이터 생성 (19개월: 6 past + current + 12 future)
    useEffect(() => {
        const startTime = performance.now();
        
        const { weeks: initialWeeks, todayWeekIndex: initialTodayIdx } = 
            generateCalendarData(today, startDayOfWeek, loadedRangeRef.current.start, loadedRangeRef.current.end);
        
        
        setWeeks(initialWeeks);
        setTodayWeekIndex(initialTodayIdx);
        setVisibleWeekIndex(initialTodayIdx);
        visibleWeekIndexRef.current = initialTodayIdx; // ✅ ref도 초기화
        
        const endTime = performance.now();
    }, [today, startDayOfWeek]);

    // Generate Data (제거 - useState로 대체)
    // const { weeks, todayWeekIndex } = useMemo(() =>
    //     generateCalendarData(today, startDayOfWeek),
    //     [today, startDayOfWeek]);

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

    // ✅ 무한 스크롤 핸들러 (하단)
    const handleEndReached = useCallback(() => {
        if (isLoadingMore || isLoadingPast || weeks.length === 0) {
            return;
        }
        
        // ✅ 비활성 뷰에서 트리거된 경우 무시
        if (isWeekly) {
            return;
        }
        
        setIsLoadingMore(true);
        
        const startTime = performance.now();
        
        // 1️⃣ 현재 상태 확인
        const currentWeeksLength = weeks.length;
        
        // 2️⃣ 새 데이터 생성
        const lastWeek = weeks[weeks.length - 1];
        const lastDate = lastWeek[6].dateObj;
        const newStart = lastDate.add(1, 'day');
        const newEnd = newStart.add(12, 'month').endOf('month');
        
        const { weeks: newWeeks } = generateCalendarData(
            today, 
            startDayOfWeek, 
            newStart,
            newEnd
        );
        
        // 3️⃣ 중복 체크
        if (newWeeks.length > 0 && newWeeks[0][0].dateString === lastWeek[0].dateString) {
            newWeeks.shift();
        } else {
        }
        
        const addedCount = newWeeks.length;
        
        // 4️⃣ 상태 업데이트 (하단은 인덱스 변경 없음)
        setWeeks(prev => [...prev, ...newWeeks]);
        setLoadedRange(prev => ({ ...prev, end: newEnd.startOf('month') }));
        
        const endTime = performance.now();
        
        setTimeout(() => setIsLoadingMore(false), 100);
    }, [loadedRange, isLoadingMore, isLoadingPast, weeks.length, today, startDayOfWeek, isWeekly]);

    // ✅ 무한 스크롤 핸들러 (상단) - maintainVisibleContentPosition 사용
    const handleStartReached = useCallback(() => {
        if (isLoadingMore || isLoadingPast || weeks.length === 0) {
            return;
        }
        
        // ✅ 비활성 뷰에서 트리거된 경우 무시
        if (isWeekly) {
            return;
        }
        
        setIsLoadingPast(true);
        
        const startTime = performance.now();
        
        // 1️⃣ 현재 상태 확인
        const currentVisibleIdx = visibleWeekIndexRef.current;
        const currentWeeksLength = weeks.length;
        
        // 2️⃣ 새 데이터 생성
        const firstWeek = weeks[0];
        const firstDate = firstWeek[0].dateObj;
        const newEnd = firstDate.subtract(1, 'day');
        const newStart = newEnd.subtract(12, 'month').startOf('month');
        
        
        const { weeks: newWeeks } = generateCalendarData(
            today,
            startDayOfWeek,
            newStart,
            newEnd
        );
        
        // 3️⃣ 중복 체크
        if (newWeeks.length > 0 && newWeeks[newWeeks.length - 1][0].dateString === firstWeek[0].dateString) {
            newWeeks.pop();
        } else {
        }
        
        const addedCount = newWeeks.length;
        
        // 4️⃣ ref 업데이트 (동기)
        const newTargetIndex = currentVisibleIdx + addedCount;
        visibleWeekIndexRef.current = newTargetIndex;
        
        // 5️⃣ 상태 업데이트 (Virtual Window 비활성화 - CalendarScreen과 동일)
        setWeeks(prev => [...newWeeks, ...prev]);
        
        setLoadedRange(prev => ({ ...prev, start: newStart }));
        loadedRangeRef.current = { ...loadedRangeRef.current, start: newStart }; // ✅ ref 동기화
        setTodayWeekIndex(prev => prev + addedCount);
        setVisibleWeekIndex(newTargetIndex);
        
        const endTime = performance.now();
        
        setTimeout(() => setIsLoadingPast(false), 100);
    }, [isLoadingMore, isLoadingPast, weeks, today, startDayOfWeek, isWeekly]);

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
    // ✅ 사용자 스크롤 중에는 동기화 비활성화 (충돌 방지)
    useEffect(() => {
        // ✅ 사용자가 스크롤 중이면 동기화 스킵
        if (isUserScrolling.current) {
            return;
        }
        
        // 1. 주간 모드일 때 -> 숨겨진 월간 뷰 동기화 (visibleWeekIndex 사용)
        if (isWeekly && hasLoadedMonthly && monthlyRef.current) {
            monthlyRef.current.scrollToIndex(visibleWeekIndex, false);
        }

        // 2. 월간 모드일 때 -> 숨겨진 주간 뷰 동기화 (visibleWeekIndex 사용)
        if (!isWeekly && weeklyRef.current) {
            weeklyRef.current.scrollToIndex(visibleWeekIndex, false);
        }
    }, [visibleWeekIndex, isWeekly, hasLoadedMonthly]);


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
        // 확인 사살용 (이미 useEffect가 했겠지만) - visibleWeekIndex 사용
        setTimeout(() => {
            monthlyRef.current?.scrollToIndex(visibleWeekIndex, false);
        }, 0);
    }, [visibleWeekIndex]);

    const switchToWeekly = useCallback(() => {
        setIsWeekly(true);
        
        // ✅ Selected Date가 화면에 보이는지 체크 (월간뷰는 ±3주 범위)
        const isSelectedVisible = Math.abs(currentWeekIndex - visibleWeekIndex) <= 3;
        
        // Selected Date가 보이면 해당 주로, 아니면 현재 보는 주로
        const targetIndex = isSelectedVisible ? currentWeekIndex : visibleWeekIndex;
        
        
        // 확인 사살용
        setTimeout(() => {
            weeklyRef.current?.scrollToIndex(targetIndex, false);
        }, 0);
    }, [visibleWeekIndex, currentWeekIndex]);

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
        
        // ✅ 클릭한 날짜가 속한 주의 인덱스 찾기
        const clickedWeekIndex = weeks.findIndex(week => 
            week.some(d => d.dateString === dateString)
        );
        
        if (clickedWeekIndex !== -1 && clickedWeekIndex !== visibleWeekIndex) {
            
            // ✅ 스크롤 플래그 설정 (동기화 방지)
            isUserScrolling.current = true;
            
            visibleWeekIndexRef.current = clickedWeekIndex;
            setVisibleWeekIndex(clickedWeekIndex);
            
            // ✅ 즉시 이동 (애니메이션 없음) - 스와이프 충돌 방지
            if (weeklyRef.current) weeklyRef.current.scrollToIndex(clickedWeekIndex, false);
            if (hasLoadedMonthly && monthlyRef.current) monthlyRef.current.scrollToIndex(clickedWeekIndex, false);
            
            // ✅ 플래그 해제 (300ms 후)
            setTimeout(() => {
                isUserScrolling.current = false;
            }, 300);
        }
    }, [setCurrentDate, weeks, hasLoadedMonthly, visibleWeekIndex]);

    const handleTodayPress = useCallback(() => {
        const todayStr = dayjs().format('YYYY-MM-DD');
        
        
        setCurrentDate(todayStr);
        setHeaderDate(today);
        
        // ✅ Arrow 네비게이션 플래그 설정 (스크롤 이벤트 무시)
        isArrowNavigating.current = true;
        
        // ✅ visibleWeekIndex 업데이트 (모드 전환 시 올바른 위치 유지)
        visibleWeekIndexRef.current = todayWeekIndex;
        setVisibleWeekIndex(todayWeekIndex);
        
        if (weeklyRef.current) weeklyRef.current.scrollToIndex(todayWeekIndex, true);
        if (hasLoadedMonthly && monthlyRef.current) monthlyRef.current.scrollToIndex(todayWeekIndex, true);
        
        
        // ✅ 애니메이션 완료 후 플래그 해제 (500ms)
        setTimeout(() => {
            isArrowNavigating.current = false;
        }, 500);
    }, [setCurrentDate, todayWeekIndex, hasLoadedMonthly, today]);

    // ✅ Arrow 네비게이션 핸들러 (옵션 2: Current Date 고정, 헤더만 변경)
    const handlePrevious = useCallback(() => {
        const targetIndex = visibleWeekIndex - 1;
        if (targetIndex < 0) return;
        
        
        // ✅ Arrow 네비게이션 시작 플래그
        isArrowNavigating.current = true;
        
        // ✅ ref와 state 즉시 업데이트 (스크롤 이벤트를 기다리지 않음)
        visibleWeekIndexRef.current = targetIndex;
        setVisibleWeekIndex(targetIndex);
        
        if (isWeekly && weeklyRef.current) {
            weeklyRef.current.scrollToIndex(targetIndex, true);
        } else if (!isWeekly && monthlyRef.current) {
            monthlyRef.current.scrollToIndex(targetIndex, true);
        }
        
        // ✅ 헤더만 업데이트 (Current Date는 변경하지 않음)
        if (weeks[targetIndex]) {
            const firstDate = weeks[targetIndex][0].dateObj;
            setHeaderDate(firstDate);
        }
        
        // ✅ 애니메이션 완료 후 플래그 해제 (500ms)
        setTimeout(() => {
            isArrowNavigating.current = false;
        }, 500);
    }, [visibleWeekIndex, isWeekly, weeks]);

    const handleNext = useCallback(() => {
        const targetIndex = visibleWeekIndex + 1;
        if (targetIndex >= weeks.length) return;
        
        
        // ✅ Arrow 네비게이션 시작 플래그
        isArrowNavigating.current = true;
        
        // ✅ ref와 state 즉시 업데이트 (스크롤 이벤트를 기다리지 않음)
        visibleWeekIndexRef.current = targetIndex;
        setVisibleWeekIndex(targetIndex);
        
        if (isWeekly && weeklyRef.current) {
            weeklyRef.current.scrollToIndex(targetIndex, true);
        } else if (!isWeekly && monthlyRef.current) {
            monthlyRef.current.scrollToIndex(targetIndex, true);
        }
        
        // ✅ 헤더만 업데이트 (Current Date는 변경하지 않음)
        if (weeks[targetIndex]) {
            const firstDate = weeks[targetIndex][0].dateObj;
            setHeaderDate(firstDate);
        }
        
        // ✅ 애니메이션 완료 후 플래그 해제 (500ms)
        setTimeout(() => {
            isArrowNavigating.current = false;
        }, 500);
    }, [visibleWeekIndex, weeks.length, isWeekly, weeks]);

    // ✅ 스와이프 시 헤더만 업데이트 (Current Date는 변경하지 않음)
    const handleWeekChange = useCallback((dateObj, index) => {
        // ✅ Arrow 네비게이션 중에는 스크롤 이벤트 무시
        if (isArrowNavigating.current) {
            return;
        }
        
        // ✅ 사용자 스크롤 시작 플래그 설정
        isUserScrolling.current = true;
        
        if (dateObj) setHeaderDate(dateObj); 
        if (index !== undefined) {
            setVisibleWeekIndex(index);
            visibleWeekIndexRef.current = index;
        }
        
        // ✅ 스크롤 완료 후 플래그 해제 (500ms 후)
        setTimeout(() => {
            isUserScrolling.current = false;
        }, 500);
    }, [weeks]);
    
    const handleVisibleWeeksChange = useCallback((dateObj, index) => {
        // ✅ Arrow 네비게이션 중에는 스크롤 이벤트 무시
        if (isArrowNavigating.current) {
            return;
        }
        
        // ✅ 사용자 스크롤 시작 플래그 설정
        isUserScrolling.current = true;
        
        if (dateObj) setHeaderDate(dateObj); 
        if (index !== undefined) {
            
            setVisibleWeekIndex(index);
            visibleWeekIndexRef.current = index;
        }
        
        // ✅ 스크롤 완료 후 플래그 해제 (500ms 후)
        setTimeout(() => {
            isUserScrolling.current = false;
        }, 500);
    }, [weeks]);
    // ✅ [오늘] 버튼 표시 조건: 오늘이 속한 주가 화면에 안 보일 때
    const isTodayVisible = Math.abs(visibleWeekIndex - todayWeekIndex) <= 2; // 2주 이내면 보이는 것으로 간주


    // ⚡️ [핵심 추가 2] 터치 시작 시 강제 동기화 함수들 (visibleWeekIndex 사용)
    const preSyncMonthlyPosition = useCallback(() => {
        if (hasLoadedMonthly && monthlyRef.current) {
            monthlyRef.current.scrollToIndex(visibleWeekIndex, false);
        }
    }, [visibleWeekIndex, hasLoadedMonthly]);

    const preSyncWeeklyPosition = useCallback(() => {
        if (weeklyRef.current) {
            weeklyRef.current.scrollToIndex(visibleWeekIndex, false);
        }
    }, [visibleWeekIndex]);


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
        <View style={styles.root}>
            <View style={styles.container}>
                {/* Header */}
                <CalendarHeader
                    title={headerTitle}
                    isWeekly={isWeekly}
                    onToggleMode={toggleMode}
                    onTodayPress={handleTodayPress}
                    isTodayVisible={isTodayVisible}
                    onPrevious={handlePrevious}
                    onNext={handleNext}
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
                                onDatePress={handleDatePress}
                                onVisibleWeeksChange={handleVisibleWeeksChange}
                                initialIndex={visibleWeekIndex}
                                eventsByDate={eventsByDate}
                                cacheVersion={cacheVersion}
                                onEndReached={handleEndReached}
                                onStartReached={handleStartReached}
                            />
                        </Animated.View>
                    )}

                    {/* 2. Weekly View */}
                    <Animated.View style={[StyleSheet.absoluteFill, weeklyStyle]}>
                        <WeeklyView
                            ref={weeklyRef}
                            weeks={weeks}
                            onDatePress={handleDatePress}
                            initialIndex={visibleWeekIndex}
                            onWeekChange={handleWeekChange}
                            eventsByDate={eventsByDate}
                            cacheVersion={cacheVersion}
                            onEndReached={handleEndReached}
                            onStartReached={handleStartReached}
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
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        // flex: 1 제거 - 콘텐츠 높이만큼만 차지
        backgroundColor: 'white',
    },
    container: {
        // flex: 1 제거 - 콘텐츠 높이만큼만 차지
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