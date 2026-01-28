import { useQuery, useQueryClient } from '@tanstack/react-query';
import { loadTodos } from '../../storage/todoStorage';

/**
 * 특정 카테고리의 Todo 목록을 로컬 저장소에서 가져오는 훅
 * @param {string} categoryId - 카테고리 ID
 * @returns TanStack Query 결과
 */
export const useTodosByCategory = (categoryId) => {
    const queryClient = useQueryClient();

    return useQuery({
        queryKey: ['todos', 'category', categoryId],
        queryFn: async () => {
            console.log('📂 [useTodosByCategory] 카테고리별 일정 로드:', categoryId);

            // 먼저 전체 캐시에서 시도
            const cachedAll = queryClient.getQueryData(['todos', 'all']);
            if (cachedAll && cachedAll.length > 0) {
                console.log('✅ [useTodosByCategory] 캐시에서 필터링');
                return cachedAll.filter(todo => {
                    const todoCategoryId = (todo.categoryId && typeof todo.categoryId === 'object')
                        ? todo.categoryId._id
                        : todo.categoryId;
                    return todoCategoryId === categoryId;
                });
            }

            // 캐시 없으면 로컬 저장소에서 로드
            const localTodos = await loadTodos();
            console.log('📱 [useTodosByCategory] 로컬에서 로드:', localTodos.length, '개');
            return localTodos.filter(todo => {
                const todoCategoryId = (todo.categoryId && typeof todo.categoryId === 'object')
                    ? todo.categoryId._id
                    : todo.categoryId;
                return todoCategoryId === categoryId;
            });
        },
        enabled: !!categoryId,
        staleTime: 5 * 60 * 1000, // 5분
    });
};
