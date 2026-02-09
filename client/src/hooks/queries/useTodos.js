import { useQuery } from '@tanstack/react-query';
import { getTodosByDate } from '../../services/db/todoService';
import { getCompletionsByDate } from '../../services/db/completionService';
import { ensureDatabase } from '../../services/db/database';
import { todoAPI } from '../../api/todos';

/**
 * 날짜별 Todo 조회 Hook (SQLite 기반)
 * 
 * SQLite만 조회 (Read Only):
 * 1. SQLite에서 직접 조회 (Source of Truth)
 * 2. 완료 상태도 SQLite에서 조회
 * 3. 서버 동기화는 useSyncService가 담당
 */
export const useTodos = (date) => {

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
          return res.data || [];
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
      console.log(`  🔍 [useTodos] Completion 상세:`, Object.keys(completions).map(key => ({
        key,
        date: completions[key].date,
        todoId: completions[key].todoId.slice(-8)
      })));
      
      const todosWithCompletion = todos.map(todo => {
        // 기간 일정인 경우 date=null인 Completion 조회
        const isRangeTodo = todo.startDate !== todo.endDate;
        const completionKey = isRangeTodo 
          ? `${todo._id}_null`  // 기간 일정: date=null
          : `${todo._id}_${date || 'null'}`;  // 단일 일정: 해당 날짜
        
        const hasCompletion = !!completions[completionKey];
        
        console.log(`  📝 [useTodos] Todo 병합:`, {
          id: todo._id.slice(-8),
          title: todo.title,
          isRangeTodo,
          completionKey,
          hasCompletion,
          startDate: todo.startDate,
          endDate: todo.endDate
        });
        
        return {
          ...todo,
          completed: hasCompletion
        };
      });
      const mergeEnd = performance.now();
      console.log(`  🔀 [useTodos] 병합: (${(mergeEnd - mergeStart).toFixed(2)}ms)`);
      
      const endTime = performance.now();
      console.log(`⚡ [useTodos] 전체: ${todosWithCompletion.length}개 (${(endTime - startTime).toFixed(2)}ms)`);

      return todosWithCompletion;
    },
    enabled: !!date,
    staleTime: 1000 * 60 * 5,
  });
};
