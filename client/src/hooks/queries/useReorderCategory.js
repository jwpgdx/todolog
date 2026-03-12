import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { invalidateAllScreenCaches } from '../../services/query-aggregation/cache';
import { updateCategoryOrders } from '../../services/db/categoryService';
import { addPendingChange } from '../../services/db/pendingService';
import { ensureDatabase } from '../../services/db/database';
import { useSyncContext } from '../../providers/SyncProvider';

export const useReorderCategory = () => {
  const queryClient = useQueryClient();
  const { syncAll } = useSyncContext();

  return useMutation({
    mutationFn: async ({ id, order }) => {
      await ensureDatabase();
      await updateCategoryOrders([{ _id: id, order }]);
      await addPendingChange({
        type: 'updateCategory',
        entityId: id,
        data: { order },
      });

      try {
        const netInfo = await NetInfo.fetch();
        if (netInfo.isConnected) {
          Promise.resolve(syncAll?.()).catch(() => { });
        }
      } catch { }

      return { id, order };
    },
    onMutate: async ({ id, order }) => {
      await queryClient.cancelQueries({ queryKey: ['categories'] });

      const previousCategories = queryClient.getQueryData(['categories']);

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

      return { previousCategories };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(['categories'], context.previousCategories);
      }
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onSuccess: async () => {
      invalidateAllScreenCaches({
        queryClient,
        reason: 'category:reorder',
      });
    },
  });
};
