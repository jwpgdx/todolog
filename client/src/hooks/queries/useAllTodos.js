import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { todoAPI } from '../../api/todos';
import { loadTodos } from '../../storage/todoStorage';

export const useAllTodos = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['todos', 'all'],
    queryFn: async () => {
      // ⚡ Cache-First: 캐시 먼저 확인
      const cachedTodos = queryClient.getQueryData(['todos', 'all']);
      if (cachedTodos) {
        // 백그라운드에서 서버 요청 (비동기)
        todoAPI.getAllTodos()
          .then(res => {
            queryClient.setQueryData(['todos', 'all'], res.data);
            console.log('🔄 [useAllTodos] 백그라운드 업데이트 완료');
          })
          .catch(() => {
            // 백그라운드 업데이트 실패는 무시 (캐시 데이터 사용 중)
          });
        
        // 즉시 반환
        console.log('⚡ [useAllTodos] 캐시 즉시 반환:', cachedTodos.length, '개');
        return cachedTodos;
      }
      
      // 캐시 없으면 서버 요청
      try {
        console.log('🌐 [useAllTodos] 캐시 없음 - 서버 요청');
        const res = await todoAPI.getAllTodos();
        return res.data;
      } catch (error) {
        console.log('⚠️ [useAllTodos] 서버 요청 실패 - AsyncStorage 확인');
        
        // 서버 실패하면 AsyncStorage
        const storedTodos = await loadTodos();
        queryClient.setQueryData(['todos', 'all'], storedTodos);
        
        console.log('✅ [useAllTodos] AsyncStorage에서 로드:', storedTodos.length, '개');
        return storedTodos;
      }
    },
    enabled: !!user,
  });
};
