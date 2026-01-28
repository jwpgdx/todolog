import { useMemo } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useAuthStore } from '../store/authStore';
import { todoAPI } from '../api/todos';
import { isDateInRRule } from '../utils/routineUtils';
import { filterByMonth } from '../utils/todoFilters';
import { loadTodos } from '../storage/todoStorage';

/**
 * 캘린더 이벤트 훅 - 여러 월의 데이터를 가져와 RRule을 전개하여 eventsByDate 맵 반환
 * @param {number} year - 기준 연도
 * @param {number} month - 기준 월 (1-12)
 * @param {Object} options - 옵션
 * @param {number} options.monthRange - 로드할 월 범위 (기본: 1, 이전/다음 월 포함시 1)
 * @returns {{ eventsByDate: Object, isLoading: boolean, isError: boolean }}
 */
export const useCalendarEvents = (year, month, options = {}) => {
    const { isLoggedIn } = useAuthStore();
    const queryClient = useQueryClient();
    const { monthRange = 1 } = options; // 기본 1 = 이전월 + 현재월 + 다음월

    // 로드할 월 목록 생성 (이전월, 현재월, 다음월)
    const monthsToLoad = useMemo(() => {
        if (!year || !month) return [];

        const months = [];
        const baseDate = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);

        for (let i = -monthRange; i <= monthRange; i++) {
            const targetDate = baseDate.add(i, 'month');
            months.push({
                year: targetDate.year(),
                month: targetDate.month() + 1, // dayjs는 0-indexed
            });
        }

        return months;
    }, [year, month, monthRange]);

    // 병렬로 여러 월의 데이터 가져오기
    const queries = useQueries({
        queries: monthsToLoad.map(({ year: y, month: m }) => ({
            queryKey: ['events', y, m],
            queryFn: async () => {
                try {
                    const response = await todoAPI.getMonthEvents(y, m);
                    return response.data;
                } catch (error) {
                    console.log(`⚠️ [useCalendarEvents] 서버 요청 실패 (${y}-${m}) - 로컬 데이터 사용`);
                    
                    // 1. 전체 캐시 확인
                    const allTodos = queryClient.getQueryData(['todos', 'all']);
                    if (allTodos) {
                        const filtered = filterByMonth(allTodos, y, m);
                        console.log(`✅ [useCalendarEvents] 캐시에서 필터링 (${y}-${m}):`, filtered.length, '개');
                        return filtered;
                    }
                    
                    // 2. AsyncStorage 확인
                    console.log(`📂 [useCalendarEvents] 캐시 없음 - AsyncStorage 확인 (${y}-${m})`);
                    const storedTodos = await loadTodos();
                    const filtered = filterByMonth(storedTodos, y, m);
                    
                    // 3. 전체 캐시에 저장
                    queryClient.setQueryData(['todos', 'all'], storedTodos);
                    
                    console.log(`✅ [useCalendarEvents] AsyncStorage에서 필터링 (${y}-${m}):`, filtered.length, '개');
                    return filtered;
                }
            },
            enabled: isLoggedIn && !!y && !!m,
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
        })),
    });

    // 로딩/에러 상태
    const isLoading = queries.some(q => q.isLoading);
    const isError = queries.some(q => q.isError);

    // 모든 데이터를 하나의 배열로 합치고 중복 제거
    const allEvents = useMemo(() => {
        const eventsMap = new Map();

        queries.forEach(query => {
            if (query.data) {
                query.data.forEach(event => {
                    eventsMap.set(event._id, event);
                });
            }
        });

        return Array.from(eventsMap.values());
    }, [queries]);

    // RRule 전개하여 eventsByDate 맵 생성
    const eventsByDate = useMemo(() => {
        if (allEvents.length === 0) return {};

        const eventsMap = {};

        // 표시 범위: 로드된 월 범위 전체
        const rangeStart = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).subtract(monthRange, 'month').startOf('month');
        const rangeEnd = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).add(monthRange, 'month').endOf('month');

        allEvents.forEach(event => {
            if (!event.startDate) return;

            // 반복 일정 처리
            if (event.recurrence) {
                const rruleString = Array.isArray(event.recurrence)
                    ? event.recurrence[0]
                    : event.recurrence;

                if (!rruleString) return;

                const eventStartDate = new Date(event.startDate);
                const eventEndDate = event.recurrenceEndDate ? new Date(event.recurrenceEndDate) : null;

                // 범위 내 모든 날짜 확인
                let loopDate = rangeStart.clone();
                while (loopDate.isBefore(rangeEnd) || loopDate.isSame(rangeEnd, 'day')) {
                    // exdates 확인
                    const dateStr = loopDate.format('YYYY-MM-DD');
                    const isExcluded = event.exdates?.some(exdate => {
                        const exdateStr = typeof exdate === 'string'
                            ? exdate.split('T')[0]
                            : dayjs(exdate).format('YYYY-MM-DD');
                        return exdateStr === dateStr;
                    });

                    if (!isExcluded && isDateInRRule(loopDate.toDate(), rruleString, eventStartDate, eventEndDate)) {
                        if (!eventsMap[dateStr]) eventsMap[dateStr] = [];
                        eventsMap[dateStr].push({
                            _id: event._id,
                            title: event.title,
                            color: event.color || '#808080',
                            isRecurring: true,
                            event,
                        });
                    }
                    loopDate = loopDate.add(1, 'day');
                }
            } else {
                // 단일/기간 일정
                const start = dayjs(event.startDate);
                const end = event.endDate ? dayjs(event.endDate) : start;

                let current = start.clone();
                while (current.isBefore(end) || current.isSame(end, 'day')) {
                    // 범위 내에 있는지 확인
                    if ((current.isAfter(rangeStart) || current.isSame(rangeStart, 'day')) &&
                        (current.isBefore(rangeEnd) || current.isSame(rangeEnd, 'day'))) {
                        const dateStr = current.format('YYYY-MM-DD');
                        if (!eventsMap[dateStr]) eventsMap[dateStr] = [];
                        eventsMap[dateStr].push({
                            _id: event._id,
                            title: event.title,
                            color: event.color || '#808080',
                            isRecurring: false,
                            event,
                        });
                    }
                    current = current.add(1, 'day');
                }
            }
        });

        return eventsMap;
    }, [allEvents, year, month, monthRange]);

    return {
        eventsByDate,
        isLoading,
        isError,
        // 디버깅용
        rawEvents: allEvents,
    };
};
