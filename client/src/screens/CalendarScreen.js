import React, { useMemo, useCallback, useRef, useState } from 'react';
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
    const [currentViewIndex, setCurrentViewIndex] = useState(12); // 현재 월 인덱스

    // 1. 월별 캘린더 데이터 생성
    const { months, todayMonthIndex } = useMemo(() =>
        generateMonthlyData(12, 24, startDayOfWeek),
        [startDayOfWeek]
    );

    // 요일 헤더 (고정)
    const weekDays = useMemo(() => {
        return Array.from({ length: 7 }).map((_, i) => {
            const dayIndex = startDayOfWeek === 'monday' ? i + 1 : i;
            return dayjs().day(dayIndex).format('dd');
        });
    }, [startDayOfWeek, i18n.language]);

    // 2. 날짜별 이벤트 Map 생성
    const eventsByDate = useMemo(() => {
        if (!todos || !categories) return {};

        const categoryColorMap = {};
        categories.forEach(c => categoryColorMap[c._id] = c.color);

        const eventsMap = {};

        todos.forEach(todo => {
            if (!todo.startDate) return;

            // 반복 일정 처리
            if (todo.recurrence) {
                const rruleString = todo.recurrence?.[0]; // 배열의 첫 번째 요소
                if (!rruleString) return;

                const todoStartDate = new Date(todo.startDate);
                const todoEndDate = todo.recurrenceEndDate ? new Date(todo.recurrenceEndDate) : null;

                // 표시 범위: 과거 12개월 ~ 미래 24개월
                const rangeStart = dayjs().subtract(12, 'month').startOf('month');
                const rangeEnd = dayjs().add(24, 'month').endOf('month');

                let loopDate = rangeStart.clone();
                while (loopDate.isBefore(rangeEnd)) {
                    if (isDateInRRule(loopDate.toDate(), rruleString, todoStartDate, todoEndDate)) {
                        const dateStr = loopDate.format('YYYY-MM-DD');
                        if (!eventsMap[dateStr]) eventsMap[dateStr] = [];
                        eventsMap[dateStr].push({
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
                    const dateStr = current.format('YYYY-MM-DD');
                    if (!eventsMap[dateStr]) eventsMap[dateStr] = [];
                    eventsMap[dateStr].push({
                        title: todo.title,
                        color: categoryColorMap[todo.categoryId] || '#ccc',
                        todo,
                    });
                    current = current.add(1, 'day');
                }
            }
        });

        return eventsMap;
    }, [todos, categories]);

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

    // 6. 스크롤 시 현재 월 업데이트
    const onViewableItemsChanged = useRef(({ viewableItems }) => {
        if (viewableItems.length > 0) {
            setCurrentViewIndex(viewableItems[0].index);
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
                onScrollToIndexFailed={(info) => {
                    flatListRef.current?.scrollToOffset({
                        offset: info.averageItemLength * info.index,
                        animated: false
                    });
                }}
            />
        </View>
    );
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
});
