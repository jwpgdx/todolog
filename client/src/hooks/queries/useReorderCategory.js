import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateCategory } from '../../api/categories';
import { invalidateAllScreenCaches } from '../../services/query-aggregation/cache';
import { updateCategoryOrders } from '../../services/db/categoryService';
import { ensureDatabase } from '../../services/db/database';

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
        ).sort((a, b) => {
          const aInbox = a?.systemKey === 'inbox';
          const bInbox = b?.systemKey === 'inbox';
          if (aInbox && !bInbox) return -1;
          if (!aInbox && bInbox) return 1;
          return (a.order || 0) - (b.order || 0);
        });
      });

      // Return a context object with the snapshotted value
      return { previousCategories };
    },
    onError: (err, newTodo, context) => {
      queryClient.setQueryData(['categories'], context.previousCategories);
    },
    onSuccess: async (_data, variables) => {
      try {
        await ensureDatabase();
        await updateCategoryOrders([{ _id: variables.id, order: variables.order }]);
      } catch {}
      invalidateAllScreenCaches({
        queryClient,
        reason: 'category:reorder',
      });
    },
  });
};
