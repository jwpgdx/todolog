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
            queryClient.setQueryData(['todos', date], res.data);
            console.log('🔄 [useTodos] 백그라운드 업데이트 완료');
          })
          .catch(() => {
            // 백그라운드 업데이트 실패는 무시 (캐시 데이터 사용 중)
          });
        
        // 즉시 반환
        const startTime = performance.now();
        const filtered = filterByDate(allTodos, date);
        const endTime = performance.now();
        console.log(`⚡ [useTodos] 캐시 즉시 반환: ${filtered.length}개 (${(endTime - startTime).toFixed(2)}ms)`);
        return filtered;
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
        
        // 전체 캐시에 저장
        queryClient.setQueryData(['todos', 'all'], storedTodos);
        
        console.log('✅ [useTodos] AsyncStorage에서 필터링:', filtered.length, '개');
        return filtered;
      }
    },
    enabled: !!date && !!user,
    staleTime: 1000 * 60 * 5,
  });
};
