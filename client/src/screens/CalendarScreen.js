import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import { useTranslation } from 'react-i18next';

import MonthSection from '../components/ui/ultimate-calendar/MonthSection';
import { SCREEN_WIDTH, CELL_HEIGHT, THEME } from '../components/ui/ultimate-calendar/constants';
import { useDateStore } from '../store/dateStore';
import { useAuthStore } from '../store/authStore';
import { useCalendarDynamicEvents } from '../hooks/useCalendarDynamicEvents';

export default function CalendarScreen() {
    const { t, i18n } = useTranslation();
    const navigation = useNavigation();
    const { setCurrentDate } = useDateStore();
    const { user } = useAuthStore();
    const startDayOfWeek = user?.settings?.startDayOfWeek || 'sunday';

    const flatListRef = useRef(null);
    const scrollOffsetRef = useRef(0); // ✅ 스크롤 오프셋 추적
    const loadedRangeRef = useRef({
        start: dayjs().subtract(6, 'month').startOf('month'),
        end: dayjs().add(12, 'month').endOf('month')
    }); // ✅ loadedRange ref 추가
    const [currentViewIndex, setCurrentViewIndex] = useState(6); // 현재 월 인덱스 (초기 6개월 후)
    
    // ✅ 무한 스크롤을 위한 상태 추가
    const [months, setMonths] = useState([]);
    const [todayMonthIndex, setTodayMonthIndex] = useState(6);
    const [loadedRange, setLoadedRange] = useState({
        start: dayjs().subtract(6, 'month').startOf('month'),
        end: dayjs().add(12, 'month').endOf('month')
    });
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isLoadingPast, setIsLoadingPast] = useState(false);

    // ✅ 초기 데이터 생성 (19개월: 6 past + current + 12 future)
    useEffect(() => {
        const startTime = performance.now();
        
        const initialMonths = [];
        let current = loadedRangeRef.current.start.clone().startOf('month'); // ✅ ref 사용
        let todayIdx = 0;
        let currentIdx = 0;
        
        while (current.isBefore(loadedRangeRef.current.end) || current.isSame(loadedRangeRef.current.end, 'month')) {
            const monthData = createMonthData(current, startDayOfWeek);
            
            // 오늘이 포함된 월 인덱스 저장
            if (current.isSame(dayjs(), 'month')) {
                todayIdx = currentIdx;
            }
            
            
            initialMonths.push(monthData);
            current = current.add(1, 'month').startOf('month'); // ✅ startOf('month') 추가
            currentIdx++;
        }
        
        setMonths(initialMonths);
        setTodayMonthIndex(todayIdx);
        setCurrentViewIndex(todayIdx);
        
        const endTime = performance.now();
    }, [startDayOfWeek]);

    // 요일 헤더 (고정)
    const weekDays = useMemo(() => {
        return Array.from({ length: 7 }).map((_, i) => {
            const dayIndex = startDayOfWeek === 'monday' ? i + 1 : i;
            return dayjs().day(dayIndex).format('dd');
        });
    }, [startDayOfWeek, i18n.language]);

    // ✅ 무한 스크롤 핸들러 (아래로 스크롤 시 12개월 추가)
    const handleEndReached = useCallback(() => {
        if (isLoadingMore || isLoadingPast) {
            return;
        }
        
        setIsLoadingMore(true);
        
        const startTime = performance.now();
        const currentEnd = loadedRangeRef.current.end; // ✅ ref 사용
        const newEnd = currentEnd.add(12, 'month');
        
        
        const newMonths = [];
        let current = currentEnd.add(1, 'month').startOf('month');
        
        while (current.isBefore(newEnd) || current.isSame(newEnd, 'month')) {
            newMonths.push(createMonthData(current, startDayOfWeek));
            current = current.add(1, 'month').startOf('month');
        }
        
        setMonths(prev => [...prev, ...newMonths]);
        setLoadedRange(prev => ({ ...prev, end: newEnd }));
        loadedRangeRef.current = { ...loadedRangeRef.current, end: newEnd }; // ✅ ref 동기화
        
        const endTime = performance.now();
        
        setIsLoadingMore(false);
    }, [isLoadingMore, isLoadingPast, startDayOfWeek, months.length]);

    // ✅ 무한 스크롤 핸들러 (위로 스크롤 시 12개월 추가) - Option A: maintainVisibleContentPosition
    const handleStartReached = useCallback(() => {
        if (isLoadingMore || isLoadingPast) {
            return;
        }
        
        
        setIsLoadingPast(true);
        
        const startTime = performance.now();
        const currentStart = loadedRangeRef.current.start; // ✅ ref 사용
        const newStart = currentStart.subtract(12, 'month');
        
        
        const newMonths = [];
        let current = newStart.clone().startOf('month');
        
        // ⚠️ currentStart는 이미 존재하는 첫 번째 월이므로 제외해야 함
        while (current.isBefore(currentStart)) {
            newMonths.push(createMonthData(current, startDayOfWeek));
            current = current.add(1, 'month').startOf('month');
        }
        
        const addedCount = newMonths.length;
        
        
        // ✅ maintainVisibleContentPosition이 자동으로 처리하므로
        // 수동 스크롤 조정 불필요!
        setMonths(prev => [...newMonths, ...prev]);
        setLoadedRange(prev => ({ ...prev, start: newStart }));
        loadedRangeRef.current = { ...loadedRangeRef.current, start: newStart }; // ✅ ref 동기화
        setTodayMonthIndex(prev => prev + addedCount);
        setCurrentViewIndex(prev => prev + addedCount);
        
        const endTime = performance.now();
        
        // ✅ 짧은 딜레이 후 로딩 상태 해제
        setTimeout(() => {
            setIsLoadingPast(false);
        }, 100);
    }, [isLoadingMore, isLoadingPast, startDayOfWeek, months.length, visibleRange, currentViewIndex]);

    // ✅ 동적 이벤트 계산 (useCalendarDynamicEvents Hook 사용)
    const eventsByDate = useCalendarDynamicEvents({
        months,
        visibleIndex: currentViewIndex,
        range: 3,
        cacheType: 'month'
    });

    // 헤더 타이틀 포맷팅 (months 생성 이후에 위치해야 함)
    const currentMonthTitle = useMemo(() => {
        const monthData = months[currentViewIndex];
        if (!monthData) return '';
        return dayjs(monthData.monthKey).format(t('date.header_fmt') || 'YYYY[. ]M[.]');
    }, [months, currentViewIndex, i18n.language, t]);

    // 3. 날짜 클릭 핸들러
    const handleDatePress = useCallback((dateString) => {
        setCurrentDate(dateString);
        navigation.navigate('Home');
    }, [setCurrentDate, navigation]);

    // 4. 월 렌더링
    const renderMonth = useCallback(({ item, index }) => {
        // Hook이 반환하는 이벤트 형식을 MonthSection이 기대하는 형식으로 변환
        const formattedEvents = {};
        Object.keys(eventsByDate).forEach(dateStr => {
            formattedEvents[dateStr] = eventsByDate[dateStr].map(event => ({
                title: event.title,
                color: event.color,
                todo: event.event, // Hook의 'event' 필드를 'todo'로 매핑
            }));
        });
        
        
        return (
            <MonthSection
                monthData={item}
                eventsByDate={formattedEvents}
                onDatePress={handleDatePress}
                startDayOfWeek={startDayOfWeek}
                showWeekDays={false}
            />
        );
    }, [eventsByDate, handleDatePress, startDayOfWeek]);

    // 5. 아이템 높이 계산 (FlashList 최적화)
    const getItemLayout = useCallback((data, index) => {
        // 월 헤더(52) + 요일 헤더(30) + 주 수 * CELL_HEIGHT
        const monthData = months[index];
        const weeksCount = monthData?.weeks?.length || 5;
        const height = 52 + 30 + (weeksCount * CELL_HEIGHT);

        // offset 계산
        let offset = 0;
        for (let i = 0; i < index; i++) {
            const m = months[i];
            offset += 52 + 30 + ((m?.weeks?.length || 5) * CELL_HEIGHT);
        }

        return { length: height, offset, index };
    }, [months]);

    // ✅ 스크롤 오프셋 추적
    const onScroll = useCallback((e) => {
        scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
    }, []);

    // 6. 스크롤 시 현재 월 업데이트 + 보이는 범위 추적 + 상단 무한 스크롤
    const onViewableItemsChanged = useRef(({ viewableItems }) => {
        if (viewableItems.length > 0) {
            const firstIdx = viewableItems[0].index;
            const lastIdx = viewableItems[viewableItems.length - 1].index;
            
            // ✅ 보이는 월 정보 상세 로그
            const visibleMonths = viewableItems.map(v => `${v.index}:${v.item.monthKey}`).join(', ');
            
            setCurrentViewIndex(firstIdx);
            setVisibleRange({ start: firstIdx, end: lastIdx });
            
            // ✅ 상단 도달 감지 (상위 3개월 이내)
            if (firstIdx <= 3 && !isLoadingPast && !isLoadingMore) {
                handleStartReached();
            }
        }
    }).current;

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 30
    }).current;

    // 7. 월 네비게이션
    const scrollToMonth = useCallback((offset) => {
        const newIndex = currentViewIndex + offset;
        if (newIndex >= 0 && newIndex < months.length) {
            flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
        }
    }, [currentViewIndex, months.length]);

    const scrollToToday = useCallback(() => {
        flatListRef.current?.scrollToIndex({ index: todayMonthIndex, animated: true });
    }, [todayMonthIndex]);

    return (
        <View style={styles.container}>
            {/* 네비게이션 헤더 */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => scrollToMonth(-1)} style={styles.navButton}>
                    <Ionicons name="chevron-back" size={24} color={THEME.text} />
                </TouchableOpacity>

                <TouchableOpacity onPress={scrollToToday} style={styles.titleContainer}>
                    <Text style={styles.headerTitle}>{currentMonthTitle}</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => scrollToMonth(1)} style={styles.navButton}>
                    <Ionicons name="chevron-forward" size={24} color={THEME.text} />
                </TouchableOpacity>
            </View>

            {/* 요일 헤더 (고정) */}
            <View style={styles.weekDaysHeader}>
                {weekDays.map((day, idx) => {
                    const isSun = (startDayOfWeek === 'sunday' && idx === 0) ||
                        (startDayOfWeek === 'monday' && idx === 6);
                    const isSat = (startDayOfWeek === 'sunday' && idx === 6) ||
                        (startDayOfWeek === 'monday' && idx === 5);
                    return (
                        <Text
                            key={idx}
                            style={[
                                styles.weekDayText,
                                isSun && { color: THEME.sunday },
                                isSat && { color: THEME.saturday }
                            ]}
                        >
                            {day}
                        </Text>
                    );
                })}
            </View>

            {/* 캘린더 리스트 */}
            <FlashList
                ref={flatListRef}
                data={months}
                renderItem={renderMonth}
                keyExtractor={(item) => item.monthKey}
                estimatedItemSize={400}
                initialScrollIndex={todayMonthIndex}
                showsVerticalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.5}
                maintainVisibleContentPosition={{
                    minIndexForVisible: 0,
                }}
                drawDistance={SCREEN_WIDTH * 3}
                onScrollToIndexFailed={(info) => {
                    flatListRef.current?.scrollToOffset({
                        offset: info.averageItemLength * info.index,
                        animated: false
                    });
                }}
            />
            
            {/* 로딩 인디케이터 */}
            {isLoadingMore && (
                <View style={styles.loadingFooter}>
                    <ActivityIndicator size="small" color="#999" />
                    <Text style={styles.loadingText}>더 불러오는 중...</Text>
                </View>
            )}
            
            {isLoadingPast && (
                <View style={styles.loadingHeader}>
                    <ActivityIndicator size="small" color="#999" />
                    <Text style={styles.loadingText}>과거 불러오는 중...</Text>
                </View>
            )}
        </View>
    );
}

// ✅ 헬퍼 함수: 단일 월 데이터 생성
function createMonthData(monthStart, startDayOfWeek) {
    // ✅ 방어적 코딩: 항상 월의 1일로 정규화
    const normalizedStart = monthStart.startOf('month');
    
    const monthKey = normalizedStart.format('YYYY-MM');
    const title = normalizedStart.format('YYYY년 M월');
    const targetDayIndex = startDayOfWeek === 'monday' ? 1 : 0;
    
    // 해당 월의 첫 주 시작일 계산
    const diff = (normalizedStart.day() + 7 - targetDayIndex) % 7;
    let currentWeekStart = normalizedStart.subtract(diff, 'day');
    const monthEnd = normalizedStart.endOf('month');
    
    const weeks = [];
    
    // 해당 월의 마지막 날이 포함된 주까지 반복
    while (currentWeekStart.isBefore(monthEnd) || currentWeekStart.isSame(monthEnd, 'day')) {
        const week = [];
        
        // ✅ 각 요일 생성
        for (let d = 0; d < 7; d++) {
            const date = currentWeekStart.add(d, 'day');
            const isCurrentMonth = date.month() === normalizedStart.month();
            const isToday = date.isSame(dayjs(), 'day');
            const isFirstDay = date.date() === 1;
            
            week.push({
                dateObj: date,
                dateString: date.format('YYYY-MM-DD'),
                text: date.date(),
                dayOfWeek: date.day(),
                monthIndex: date.month(),
                isToday,
                isFirstDay,
                isSunday: date.day() === 0,
                isSaturday: date.day() === 6,
                isCurrentMonth,
            });
        }
        
        weeks.push(week);
        currentWeekStart = currentWeekStart.add(7, 'day');
    }
    
    return { monthKey, title, weeks };
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'white',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    weekDaysHeader: {
        flexDirection: 'row',
        height: 30,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        backgroundColor: 'white',
    },
    weekDayText: {
        flex: 1,
        textAlign: 'center',
        fontSize: 12,
        color: '#666',
        fontWeight: '500',
    },
    navButton: {
        padding: 8,
    },
    titleContainer: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: THEME.text,
    },
    loadingFooter: {
        position: 'absolute',
        bottom: 20,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        alignSelf: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    loadingHeader: {
        position: 'absolute',
        top: 100,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        alignSelf: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    loadingText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#666',
    },
});
