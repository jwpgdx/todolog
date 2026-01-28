import { useMutation, useQueryClient } from '@tanstack/react-query';
import { completionAPI } from '../../api/todos';

export const useToggleCompletion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ todoId, date, completed }) => {
      // 새로운 통합 완료 토글 API 사용
      return completionAPI.toggleCompletion(todoId, date);
    },
    onSuccess: (_, variables) => {
      // 날짜별 할일 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['todos', variables.date] });
      queryClient.invalidateQueries({ queryKey: ['calendarSummary'] });
    },
  });
};
