import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { todoAPI } from '../../api/todos';
import { getTodosByMonth } from '../../db/todoService';
import { ensureDatabase } from '../../db/database';

/**
 * 월별 이벤트 조회 훅 (SQLite 기반)
 * @param {number} year - 연도
 * @param {number} month - 월 (1-12)
 */
export const useMonthEvents = (year, month) => {
    const { isLoggedIn } = useAuthStore();

    return useQuery({
        queryKey: ['events', year, month],
        queryFn: async () => {
            const startTime = performance.now();

            try {
                await ensureDatabase();
                const todos = await getTodosByMonth(year, month);

                const endTime = performance.now();
                console.log(`⚡ [useMonthEvents] SQLite 조회 (${year}-${month}): ${todos.length}개 (${(endTime - startTime).toFixed(2)}ms)`);

                // 백그라운드 서버 동기화
                todoAPI.getMonthEvents(year, month)
                    .then(res => {
                        if (res.data.length !== todos.length) {
                            console.log(`🔄 [useMonthEvents] 서버 데이터 차이 감지`);
                        }
                    })
                    .catch(() => { });

                return todos;
            } catch (error) {
                console.log(`⚠️ [useMonthEvents] SQLite 실패 - 서버 폴백`);
                const response = await todoAPI.getMonthEvents(year, month);
                return response.data;
            }
        },
        enabled: isLoggedIn && !!year && !!month,
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
    });
};
