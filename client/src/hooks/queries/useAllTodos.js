import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { todoAPI } from '../../api/todos';
import { getAllTodos } from '../../services/db/todoService';
import { ensureDatabase } from '../../services/db/database';

/**
 * 전체 Todo 조회 (SQLite 기반)
 * 주로 디버그나 전체 목록이 필요한 경우 사용
 */
export const useAllTodos = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['todos', 'all'],
    queryFn: async () => {
      try {
        await ensureDatabase();
        
        const startTime = performance.now();
        const todos = await getAllTodos();
        const endTime = performance.now();

        console.log(`⚡ [useAllTodos] SQLite 조회: ${todos.length}개 (${(endTime - startTime).toFixed(2)}ms)`);

        // 백그라운드 서버 동기화
        if (user) {
          todoAPI.getAllTodos()
            .then(res => {
              if (res.data.length !== todos.length) {
                console.log('🔄 [useAllTodos] 서버 데이터 차이 감지');
              }
            })
            .catch(() => {});
        }

        return todos;
      } catch (error) {
        console.log('⚠️ [useAllTodos] SQLite 실패 - 서버 폴백');
        const res = await todoAPI.getAllTodos();
        return res.data;
      }
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
};
