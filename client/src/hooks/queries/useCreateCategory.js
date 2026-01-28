import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCategory } from '../../api/categories';

export const useCreateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      // categories 쿼리 무효화로 인해 리스트가 갱신됨
    },
  });
};
