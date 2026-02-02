import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getTodosByCategory } from '../../db/todoService';
import { ensureDatabase } from '../../db/database';

/**
 * 카테고리별 Todo 조회 (SQLite 기반)
 * 
 * @param {string} categoryId - 카테고리 ID
 */
export const useTodosByCategory = (categoryId) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['todos', 'category', categoryId],
    queryFn: async () => {
      const startTime = performance.now();

      try {
        await ensureDatabase();
        const todos = await getTodosByCategory(categoryId);

        const endTime = performance.now();
        console.log(`⚡ [useTodosByCategory] SQLite 조회 (${categoryId}): ${todos.length}개 (${(endTime - startTime).toFixed(2)}ms)`);

        return todos;
      } catch (error) {
        console.error('❌ [useTodosByCategory] SQLite 조회 실패:', error);
        return [];
      }
    },
    enabled: !!categoryId,
    staleTime: 1000 * 60 * 5,
  });
};
