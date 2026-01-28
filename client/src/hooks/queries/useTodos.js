import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { todoAPI } from '../../api/todos';

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
        console.log('⚠️ [useTodos] 서버 요청 실패 - 캐시 사용');
        // 서버 요청 실패 시 캐시된 데이터 반환
        const cachedData = queryClient.getQueryData(['todos', date]);
        if (cachedData) {
          console.log('✅ [useTodos] 캐시 데이터 사용:', cachedData.length, '개');
          return cachedData;
        }
        // 캐시도 없으면 빈 배열 반환
        return [];
      }
    },
    enabled: !!date && !!user,
    staleTime: 1000 * 60 * 5, // 5분간 캐시 유지
  });
};
