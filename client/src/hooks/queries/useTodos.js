import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { todoAPI } from '../../api/todos';
import { loadTodos } from '../../storage/todoStorage';
import { filterByDate } from '../../utils/todoFilters';

export const useTodos = (date) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['todos', date],
    queryFn: async () => {
      // ⚡ Cache-First: 캐시 먼저 확인
      const allTodos = queryClient.getQueryData(['todos', 'all']);
      if (allTodos) {
        // 백그라운드에서 서버 요청 (비동기)
        todoAPI.getTodos(date)
          .then(res => {
            // 서버 응답에 로컬 Completion 병합
            const completions = queryClient.getQueryData(['completions']) || {};
            const todosWithCompletion = res.data.map(todo => {
              const key = `${todo._id}_${date || 'null'}`;
              return {
                ...todo,
                completed: !!completions[key]  // 로컬 Completion 우선
              };
            });
            
            queryClient.setQueryData(['todos', date], todosWithCompletion);
            console.log('🔄 [useTodos] 백그라운드 업데이트 완료');
          })
          .catch(() => {
            // 백그라운드 업데이트 실패는 무시 (캐시 데이터 사용 중)
          });
        
        // 즉시 반환 (로컬 Completion 포함)
        const startTime = performance.now();
        const filtered = filterByDate(allTodos, date);
        
        // 로컬 Completion 조회하여 completed 필드 추가 (메모리 캐시에서 즉시 읽기)
        const completions = queryClient.getQueryData(['completions']) || {};
        const todosWithCompletion = filtered.map(todo => {
          const key = `${todo._id}_${date || 'null'}`;
          return {
            ...todo,
            completed: !!completions[key]
          };
        });
        
        const endTime = performance.now();
        console.log(`⚡ [useTodos] 캐시 즉시 반환: ${todosWithCompletion.length}개 (${(endTime - startTime).toFixed(2)}ms) - 완료 상태 포함`);
        return todosWithCompletion;
      }
      
      // 캐시 없으면 서버 요청
      try {
        console.log('🌐 [useTodos] 캐시 없음 - 서버 요청');
        const res = await todoAPI.getTodos(date);
        return res.data;
      } catch (error) {
        console.log('⚠️ [useTodos] 서버 요청 실패 - AsyncStorage 확인');
        
        // 서버 실패하면 AsyncStorage
        const storedTodos = await loadTodos();
        const filtered = filterByDate(storedTodos, date);
        
        // 로컬 Completion 조회하여 completed 필드 추가 (메모리 캐시에서 즉시 읽기)
        const completions = queryClient.getQueryData(['completions']) || {};
        const todosWithCompletion = filtered.map(todo => {
          const key = `${todo._id}_${date || 'null'}`;
          return {
            ...todo,
            completed: !!completions[key]
          };
        });
        
        // 전체 캐시에 저장
        queryClient.setQueryData(['todos', 'all'], storedTodos);
        
        console.log('✅ [useTodos] AsyncStorage에서 필터링:', todosWithCompletion.length, '개 (완료 상태 포함)');
        return todosWithCompletion;
      }
    },
    enabled: !!date && !!user,
    staleTime: 1000 * 60 * 5,
  });
};
