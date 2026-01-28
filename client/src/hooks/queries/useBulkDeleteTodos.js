import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';

const bulkDeleteTodos = async (todoIds) => {
  const response = await api.post('/todos/bulk-delete', { todoIds });
  return response.data;
};

export const useBulkDeleteTodos = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bulkDeleteTodos,
    onSuccess: () => {
      // 모든 할일 관련 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['allTodos'] });
      queryClient.invalidateQueries({ queryKey: ['calendarSummary'] });
    },
  });
};