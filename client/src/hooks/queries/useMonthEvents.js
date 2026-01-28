import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { todoAPI } from '../../api/todos';

/**
 * 월별 이벤트 조회 훅
 * @param {number} year - 연도
 * @param {number} month - 월 (1-12)
 * @returns TanStack Query 결과 (raw Todo 데이터, RRule 포함)
 */
export const useMonthEvents = (year, month) => {
    const { isLoggedIn } = useAuthStore();

    return useQuery({
        queryKey: ['events', year, month],
        queryFn: async () => {
            const response = await todoAPI.getMonthEvents(year, month);
            return response.data;
        },
        enabled: isLoggedIn && !!year && !!month,
        staleTime: 5 * 60 * 1000, // 5분
        gcTime: 30 * 60 * 1000,   // 30분 (cacheTime → gcTime in v5)
    });
};
