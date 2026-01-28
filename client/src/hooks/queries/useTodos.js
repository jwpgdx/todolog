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
      try {
        const res = await todoAPI.getTodos(date);
        return res.data;
      } catch (error) {
        console.log('⚠️ [useTodos] 서버 요청 실패 - 로컬 데이터 사용');
        
        // 1. 전체 캐시 확인
        const allTodos = queryClient.getQueryData(['todos', 'all']);
        if (allTodos) {
          const startTime = performance.now();
          const filtered = filterByDate(allTodos, date);
          const endTime = performance.now();
          console.log(`✅ [useTodos] 캐시에서 필터링: ${filtered.length}개 (${(endTime - startTime).toFixed(2)}ms)`);
          return filtered;
        }
        
        // 2. AsyncStorage 확인
        console.log('📂 [useTodos] 캐시 없음 - AsyncStorage 확인');
        const storedTodos = await loadTodos();
        const filtered = filterByDate(storedTodos, date);
        
        // 3. 전체 캐시에 저장
        queryClient.setQueryData(['todos', 'all'], storedTodos);
        
        console.log('✅ [useTodos] AsyncStorage에서 필터링:', filtered.length, '개');
        return filtered;
      }
    },
    enabled: !!date && !!user,
    staleTime: 1000 * 60 * 5,
  });
};
