import dayjs from 'dayjs';

/**
 * Todo 변경 시 영향받는 월 목록을 계산
 * @param {Object} todo - Todo 객체 (startDate, endDate, recurrence, recurrenceEndDate 포함)
 * @returns {Array<{year: number, month: number}>} 영향받는 월 목록
 */
export const getAffectedMonths = (todo) => {
    if (!todo?.startDate) return [];

    const months = new Set();
    const startDate = dayjs(todo.startDate);

    // 단일 일정
    if (!todo.recurrence) {
        const endDate = todo.endDate ? dayjs(todo.endDate) : startDate;

        let current = startDate.startOf('month');
        while (current.isBefore(endDate.endOf('month')) || current.isSame(endDate, 'month')) {
            months.add(`${current.year()}-${current.month() + 1}`);
            current = current.add(1, 'month');
        }
    } else {
        // 반복 일정: 시작월부터 종료월(또는 현재+12개월)까지
        const endDate = todo.recurrenceEndDate
            ? dayjs(todo.recurrenceEndDate)
            : dayjs().add(12, 'month'); // 무한 반복은 12개월까지만

        let current = startDate.startOf('month');
        while (current.isBefore(endDate.endOf('month')) || current.isSame(endDate, 'month')) {
            months.add(`${current.year()}-${current.month() + 1}`);
            current = current.add(1, 'month');
        }
    }

    // Set을 배열로 변환
    return Array.from(months).map(key => {
        const [year, month] = key.split('-').map(Number);
        return { year, month };
    });
};

/**
 * 영향받는 월의 캐시를 무효화
 * @param {Object} queryClient - TanStack Query client
 * @param {Object} todo - Todo 객체
 */
export const invalidateAffectedMonths = (queryClient, todo) => {
    const affectedMonths = getAffectedMonths(todo);

    affectedMonths.forEach(({ year, month }) => {
        queryClient.invalidateQueries({ queryKey: ['events', year, month] });
    });

    // 기존 쿼리도 무효화 (하위 호환성)
    queryClient.invalidateQueries({ queryKey: ['todos'] });
    queryClient.invalidateQueries({ queryKey: ['calendarSummary'] });
};
