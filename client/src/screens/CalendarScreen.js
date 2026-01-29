import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import { useTranslation } from 'react-i18next';

import MonthSection from '../components/ui/ultimate-calendar/MonthSection';
import { generateMonthlyData } from '../components/ui/ultimate-calendar/calendarUtils';
import { SCREEN_WIDTH, CELL_HEIGHT, THEME } from '../components/ui/ultimate-calendar/constants';
import { useAllTodos } from '../hooks/queries/useAllTodos';
import { useCategories } from '../hooks/queries/useCategories';
import { useDateStore } from '../store/dateStore';
import { useAuthStore } from '../store/authStore';
import { isDateInRRule } from '../utils/routineUtils';

export default function CalendarScreen() {
    const { t, i18n } = useTranslation();
    const navigation = useNavigation();
    const { setCurrentDate } = useDateStore();
    const { user } = useAuthStore();
    const startDayOfWeek = user?.settings?.startDayOfWeek || 'sunday';

    const { data: todos, isLoading: isTodosLoading } = useAllTodos();
    const { data: categories, isLoading: isCatsLoading } = useCategories();

    const flatListRef = useRef(null);
    const eventsCacheRef = useRef({}); // ✅ 월별 이벤트 캐시
    const [cacheVersion, setCacheVersion] = useState(0); // ✅ 캐시 버전 (상태로 변경)
    const [currentViewIndex, setCurrentViewIndex] = useState(6); // 현재 월 인덱스 (초기 6개월 후)
    
    // ✅ 무한 스크롤을 위한 상태 추가
    const [months, setMonths] = useState([]);
    const [todayMonthIndex, setTodayMonthIndex] = useState(6);
    const [loadedRange, setLoadedRange] = useState({
        start: dayjs().subtract(6, 'month'),
        end: dayjs().add(12, 'month')
    });
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isLoadingPast, setIsLoadingPast] = useState(false);

    // ✅ 초기 데이터 생성 (19개월: 6 past + current + 12 future)
    useEffect(() => {
        console.log('📅 [CalendarScreen] 초기 데이터 생성 시작...');
        const startTime = performance.now();
        
        const initialMonths = [];
        let current = loadedRange.start.clone().startOf('month'); // ✅ startOf('month') 추가
        let todayIdx = 0;
        let currentIdx = 0;
        
        while (current.isBefore(loadedRange.end) || current.isSame(loadedRange.end, 'month')) {
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
        console.log(`✅ [CalendarScreen] 초기 생성 완료: ${initialMonths.length}개 월 (${(endTime - startTime).toFixed(2)}ms)`);
        console.log(`📅 [CalendarScreen] 범위: ${loadedRange.start.format('YYYY-MM')} ~ ${loadedRange.end.format('YYYY-MM')}`);
        console.log(`📍 [CalendarScreen] 오늘 인덱스: ${todayIdx}`);
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
            console.log('⚠️ [무한스크롤-하단] 이미 로딩 중 - 스킵');
            return;
        }
        
        console.log('🔄 [무한스크롤-하단] onEndReached 트리거됨');
        setIsLoadingMore(true);
        
        const startTime = performance.now();
        const currentEnd = loadedRange.end;
        const newEnd = currentEnd.add(12, 'month');
        
        console.log(`📅 [무한스크롤-하단] 12개월 추가 시작: ${currentEnd.format('YYYY-MM')} ~ ${newEnd.format('YYYY-MM')}`);
        
        const newMonths = [];
        let current = currentEnd.add(1, 'month').startOf('month');
        
        while (current.isBefore(newEnd) || current.isSame(newEnd, 'month')) {
            newMonths.push(createMonthData(current, startDayOfWeek));
            current = current.add(1, 'month').startOf('month');
        }
        
        setMonths(prev => [...prev, ...newMonths]);
        setLoadedRange(prev => ({ ...prev, end: newEnd }));
        
        const endTime = performance.now();
        console.log(`✅ [무한스크롤-하단] 완료: ${newMonths.length}개 월 추가 (총 ${months.length + newMonths.length}개) (${(endTime - startTime).toFixed(2)}ms)`);
        
        setIsLoadingMore(false);
    }, [loadedRange, isLoadingMore, isLoadingPast, startDayOfWeek, months.length]);

    // ✅ 무한 스크롤 핸들러 (위로 스크롤 시 12개월 추가)
    const handleStartReached = useCallback(() => {
        if (isLoadingMore || isLoadingPast) {
            console.log('⚠️ [무한스크롤-상단] 이미 로딩 중 - 스킵');
            return;
        }
        
        // 상단 3개월 이내로 스크롤 시 트리거
        if (visibleRange.start > 3) {
            return;
        }
        
        console.log('🔄 [무한스크롤-상단] 상단 도달 감지');
        setIsLoadingPast(true);
        
        const startTime = performance.now();
        const currentStart = loadedRange.start;
        const newStart = currentStart.subtract(12, 'month');
        
        console.log(`📅 [무한스크롤-상단] 12개월 추가 시작: ${newStart.format('YYYY-MM')} ~ ${currentStart.format('YYYY-MM')}`);
        
        const newMonths = [];
        let current = newStart.clone().startOf('month');
        
        while (current.isBefore(currentStart)) {
            newMonths.push(createMonthData(current, startDayOfWeek));
            current = current.add(1, 'month').startOf('month');
        }
        
        // 앞에 추가하고 인덱스 조정
        const addedCount = newMonths.length;
        setMonths(prev => [...newMonths, ...prev]);
        setLoadedRange(prev => ({ ...prev, start: newStart }));
        setTodayMonthIndex(prev => prev + addedCount);
        setCurrentViewIndex(prev => prev + addedCount);
        
        const endTime = performance.now();
        console.log(`✅ [무한스크롤-상단] 완료: ${addedCount}개 월 추가 (총 ${months.length + addedCount}개) (${(endTime - startTime).toFixed(2)}ms)`);
        console.log(`📍 [무한스크롤-상단] 인덱스 조정: +${addedCount}`);
        
        // 스크롤 위치 유지 (현재 보던 위치로 이동)
        setTimeout(() => {
            const newIndex = visibleRange.start + addedCount;
            flatListRef.current?.scrollToIndex({ 
                index: newIndex, 
                animated: false 
            });
            setIsLoadingPast(false);
        }, 50);
    }, [loadedRange, isLoadingMore, isLoadingPast, startDayOfWeek, months.length, visibleRange]);

    // ✅ todos 변경 시 캐시 무효화 (상태 업데이트로 강제 재렌더링)
    useEffect(() => {
        if (todos) {
            eventsCacheRef.current = {};
            setCacheVersion(prev => prev + 1);
            console.log('🔄 [캐시] todos 변경 감지 - 캐시 초기화');
        }
    }, [todos]);

    // ✅ 동적 이벤트 계산 (보이는 범위 ±3개월만, 월별 캐싱)
    const eventsByDate = useMemo(() => {
        if (!todos || !categories || months.length === 0) return {};

        const startTime = performance.now();
        
        // 보이는 범위 확장 (±3개월)
        const startIdx = Math.max(0, visibleRange.start - 3);
        const endIdx = Math.min(months.length - 1, visibleRange.end + 3);
        
        const startMonth = months[startIdx];
        const endMonth = months[endIdx];
        
        if (!startMonth || !endMonth) return {};
        
        console.log(`🎯 [이벤트계산] 범위: ${startMonth.monthKey} ~ ${endMonth.monthKey} (인덱스: ${startIdx} ~ ${endIdx})`);

        const categoryColorMap = {};
        categories.forEach(c => categoryColorMap[c._id] = c.color);

        const eventsMap = {};
        let cacheHits = 0;
        let cacheMisses = 0;

        // ✅ 월별로 캐시 확인 및 계산
        for (let i = startIdx; i <= endIdx; i++) {
            const month = months[i];
            if (!month) continue;
            
            const monthKey = month.monthKey;
            
            // 캐시 확인
            if (eventsCacheRef.current[monthKey]) {
                // 캐시 히트
                Object.assign(eventsMap, eventsCacheRef.current[monthKey]);
                cacheHits++;
                continue;
            }
            
            // 캐시 미스 - 계산 필요
            cacheMisses++;
            const monthStart = dayjs(monthKey).startOf('month');
            const monthEnd = monthStart.endOf('month');
            const monthEvents = {};

            todos.forEach(todo => {
                if (!todo.startDate) return;

                // 반복 일정 처리
                if (todo.recurrence) {
                    const rruleString = todo.recurrence?.[0];
                    if (!rruleString) return;

                    const todoStartDate = new Date(todo.startDate);
                    const todoEndDate = todo.recurrenceEndDate ? new Date(todo.recurrenceEndDate) : null;

                    let loopDate = monthStart.clone();
                    while (loopDate.isBefore(monthEnd) || loopDate.isSame(monthEnd, 'day')) {
                        if (isDateInRRule(loopDate.toDate(), rruleString, todoStartDate, todoEndDate)) {
                            const dateStr = loopDate.format('YYYY-MM-DD');
                            if (!monthEvents[dateStr]) monthEvents[dateStr] = [];
                            monthEvents[dateStr].push({
                                title: todo.title,
                                color: categoryColorMap[todo.categoryId] || '#ccc',
                                todo,
                            });
                        }
                        loopDate = loopDate.add(1, 'day');
                    }
                } else {
                    // 단일 일정
                    const start = dayjs(todo.startDate);
                    const end = todo.endDate ? dayjs(todo.endDate) : start;

                    let current = start.clone();
                    while (current.isBefore(end) || current.isSame(end, 'day')) {
                        // 해당 월에 포함되는지 체크
                        if ((current.isAfter(monthStart) || current.isSame(monthStart, 'day')) &&
                            (current.isBefore(monthEnd) || current.isSame(monthEnd, 'day'))) {
                            const dateStr = current.format('YYYY-MM-DD');
                            if (!monthEvents[dateStr]) monthEvents[dateStr] = [];
                            monthEvents[dateStr].push({
                                title: todo.title,
                                color: categoryColorMap[todo.categoryId] || '#ccc',
                                todo,
                            });
                        }
                        current = current.add(1, 'day');
                    }
                }
            });

            // 캐시 저장
            eventsCacheRef.current[monthKey] = monthEvents;
            Object.assign(eventsMap, monthEvents);
        }

        // ✅ 캐시 메모리 관리 (최근 24개월만 유지)
        const cacheKeys = Object.keys(eventsCacheRef.current);
        if (cacheKeys.length > 24) {
            const sortedKeys = cacheKeys.sort();
            const keysToDelete = sortedKeys.slice(0, cacheKeys.length - 24);
            keysToDelete.forEach(key => delete eventsCacheRef.current[key]);
            console.log(`🗑️ [캐시] 오래된 캐시 삭제: ${keysToDelete.length}개`);
        }

        const endTime = performance.now();
        const eventCount = Object.keys(eventsMap).length;
        console.log(`✅ [이벤트계산] 완료: ${eventCount}개 날짜 (${(endTime - startTime).toFixed(2)}ms)`);
        console.log(`📊 [캐시] 히트: ${cacheHits}개, 미스: ${cacheMisses}개, 총 캐시: ${Object.keys(eventsCacheRef.current).length}개, 버전: ${cacheVersion}`);

        return eventsMap;
    }, [todos, categories, months, visibleRange, cacheVersion]);

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
    const renderMonth = useCallback(({ item }) => (
        <MonthSection
            monthData={item}
            eventsByDate={eventsByDate}
            onDatePress={handleDatePress}
            startDayOfWeek={startDayOfWeek}
            showWeekDays={false}
        />
    ), [eventsByDate, handleDatePress, startDayOfWeek]);

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

    // 6. 스크롤 시 현재 월 업데이트 + 보이는 범위 추적 + 상단 무한 스크롤
    const onViewableItemsChanged = useRef(({ viewableItems }) => {
        if (viewableItems.length > 0) {
            const firstIdx = viewableItems[0].index;
            const lastIdx = viewableItems[viewableItems.length - 1].index;
            
            console.log(`👁️ [보이는범위] ${firstIdx} ~ ${lastIdx}`);
            
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

    // 로딩 상태
    if (isTodosLoading || isCatsLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={THEME.primary} />
            </View>
        );
    }

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
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.5}
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
