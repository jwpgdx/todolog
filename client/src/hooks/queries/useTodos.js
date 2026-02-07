import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { todoAPI } from '../../api/todos';
import { getTodosByDate } from '../../services/db/todoService';
import { getCompletionsByDate } from '../../services/db/completionService';
import { ensureDatabase } from '../../services/db/database';

/**
 * 날짜별 Todo 조회 Hook (SQLite 기반)
 * 
 * 새로운 흐름:
 * 1. SQLite에서 직접 조회 (Source of Truth)
 * 2. 백그라운드에서 서버 동기화
 * 3. 완료 상태도 SQLite에서 조회
 */
export const useTodos = (date) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['todos', date],
    queryFn: async () => {
      // 1. SQLite 초기화 보장 (자동 대기)
      try {
        await ensureDatabase();
      } catch (error) {
        console.log('⚠️ [useTodos] SQLite 초기화 실패 - 서버로 폴백');
        try {
          const res = await todoAPI.getTodos(date);
          return res.data;
        } catch (apiError) {
          console.error('❌ [useTodos] 서버 요청도 실패:', apiError.message);
          return [];
        }
      }

      // 2. SQLite에서 Todo + Completion 조회
      const startTime = performance.now();
      
      const todoStart = performance.now();
      const todos = await getTodosByDate(date);
      const todoEnd = performance.now();
      console.log(`  📝 [useTodos] getTodosByDate: ${todos.length}개 (${(todoEnd - todoStart).toFixed(2)}ms)`);
      
      const compStart = performance.now();
      const completions = await getCompletionsByDate(date);
      const compEnd = performance.now();
      console.log(`  ✅ [useTodos] getCompletionsByDate: ${Object.keys(completions).length}개 (${(compEnd - compStart).toFixed(2)}ms)`);
      
      const mergeStart = performance.now();
      // 3. 완료 상태 병합
      const todosWithCompletion = todos.map(todo => {
        const key = `${todo._id}_${date || 'null'}`;
        return {
          ...todo,
          completed: !!completions[key]
        };
      });
      const mergeEnd = performance.now();
      console.log(`  🔀 [useTodos] 병합: (${(mergeEnd - mergeStart).toFixed(2)}ms)`);
      
      const endTime = performance.now();
      console.log(`⚡ [useTodos] 전체: ${todosWithCompletion.length}개 (${(endTime - startTime).toFixed(2)}ms)`);

      // 4. 백그라운드 서버 동기화 (선택적)
      if (user) {
        todoAPI.getTodos(date)
          .then(res => {
            if (res.data.length !== todos.length) {
              console.log('🔄 [useTodos] 서버와 데이터 차이 감지 - 동기화 권장');
            }
          })
          .catch(() => { });
      }

      return todosWithCompletion;
    },
    enabled: !!date,
    staleTime: 1000 * 60 * 5,
  });
};
