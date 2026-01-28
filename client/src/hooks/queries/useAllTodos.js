import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { todoAPI } from '../../api/todos';

export const useAllTodos = () => {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: ['todos', 'all'],
    queryFn: () => todoAPI.getAllTodos().then(res => res.data),
    enabled: !!user, // 사용자가 로그인한 경우에만 실행
  });
};
