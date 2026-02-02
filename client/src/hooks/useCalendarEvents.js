import { useMemo } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useAuthStore } from '../store/authStore';
import { todoAPI } from '../api/todos';
import { isDateInRRule } from '../utils/routineUtils';
import { getTodosByMonth } from '../db/todoService';
import { getCompletionsByMonth } from '../db/completionService';
import { ensureDatabase } from '../db/database';

/**
 * 캘린더 이벤트 훅 (SQLite 기반)
 * 여러 월의 데이터를 SQLite에서 가져와 RRule을 전개하여 eventsByDate 맵 반환
 */
export const useCalendarEvents = (year, month, options = {}) => {
    const { isLoggedIn } = useAuthStore();
    const queryClient = useQueryClient();
    const { monthRange = 1 } = options;

    const monthsToLoad = useMemo(() => {
        if (!year || !month) return [];

        const months = [];
        const baseDate = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);

        for (let i = -monthRange; i <= monthRange; i++) {
            const targetDate = baseDate.add(i, 'month');
            months.push({
                year: targetDate.year(),
                month: targetDate.month() + 1,
            });
        }

        return months;
    }, [year, month, monthRange]);

    const queries = useQueries({
        queries: monthsToLoad.map(({ year: y, month: m }) => ({
            queryKey: ['events', y, m],
            queryFn: async () => {
                const startTime = performance.now();

                try {
                    await ensureDatabase();
                    const todos = await getTodosByMonth(y, m);
                    const completions = await getCompletionsByMonth(y, m);

                    const todosWithCompletion = todos.map(todo => ({
                        ...todo,
                        completions: completions
                    }));

                    const endTime = performance.now();
                    console.log(`⚡ [useCalendarEvents] SQLite 조회 (${y}-${m}): ${todos.length}개 (${(endTime - startTime).toFixed(2)}ms)`);

                    // 백그라운드 서버 동기화
                    todoAPI.getMonthEvents(y, m)
                        .then(res => {
                            if (res.data.length !== todos.length) {
                                console.log(`🔄 [useCalendarEvents] 서버 데이터 차이 감지 (${y}-${m})`);
                            }
                        })
                        .catch(() => { });

                    return todosWithCompletion;
                } catch (error) {
                    console.log(`⚠️ [useCalendarEvents] SQLite 실패 - 서버 폴백 (${y}-${m})`);
                    const response = await todoAPI.getMonthEvents(y, m);
                    return response.data;
                }
            },
            enabled: isLoggedIn && !!y && !!m,
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
        })),
    });

    const isLoading = queries.some(q => q.isLoading);
    const isError = queries.some(q => q.isError);

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

    const eventsByDate = useMemo(() => {
        if (allEvents.length === 0) return {};

        const eventsMap = {};

        const rangeStart = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).subtract(monthRange, 'month').startOf('month');
        const rangeEnd = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).add(monthRange, 'month').endOf('month');

        allEvents.forEach(event => {
            if (!event.startDate) return;

            if (event.recurrence) {
                const rruleString = Array.isArray(event.recurrence)
                    ? event.recurrence[0]
                    : event.recurrence;

                if (!rruleString) return;

                const eventStartDate = new Date(event.startDate);
                const eventEndDate = event.recurrenceEndDate ? new Date(event.recurrenceEndDate) : null;

                let loopDate = rangeStart.clone();
                while (loopDate.isBefore(rangeEnd) || loopDate.isSame(rangeEnd, 'day')) {
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
                const start = dayjs(event.startDate);
                const end = event.endDate ? dayjs(event.endDate) : start;

                let current = start.clone();
                while (current.isBefore(end) || current.isSame(end, 'day')) {
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
        rawEvents: allEvents,
    };
};
