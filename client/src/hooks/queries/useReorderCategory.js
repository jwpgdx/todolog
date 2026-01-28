import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateCategory } from '../../api/categories';

export const useReorderCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, order }) => updateCategory({ id, data: { order } }),
    onMutate: async ({ id, order }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['categories'] });

      // Snapshot the previous value
      const previousCategories = queryClient.getQueryData(['categories']);

      // Optimistically update to the new value
      queryClient.setQueryData(['categories'], (old) => {
        if (!old) return [];
        return old.map((cat) => 
          cat._id === id ? { ...cat, order } : cat
        ).sort((a, b) => a.order - b.order);
      });

      // Return a context object with the snapshotted value
      return { previousCategories };
    },
    onError: (err, newTodo, context) => {
      queryClient.setQueryData(['categories'], context.previousCategories);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
};
