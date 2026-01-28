import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';
import { useAuthStore } from '../../store/authStore';

export const useShowCompletedTodos = () => {
  const queryClient = useQueryClient();
  const { user, setUser } = useAuthStore();

  const updateShowCompletedTodos = useMutation({
    mutationFn: async (show) => {
      const response = await api.post('/auth/show-completed-todos', { show });
      return response.data;
    },
    onSuccess: (data) => {
      // 로컬 상태 즉시 업데이트
      setUser({
        ...user,
        showCompletedTodos: data.showCompletedTodos,
      });
    },
    onError: (error) => {
      console.error('완료된 할일 표시 설정 업데이트 실패:', error);
    },
  });

  return {
    updateShowCompletedTodos: updateShowCompletedTodos.mutate,
    isLoading: updateShowCompletedTodos.isPending,
  };
};